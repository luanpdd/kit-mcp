#!/usr/bin/env node
// Phase 172 — gera fixture jsonl-paridade-ccusage.jsonl (1k entries
// determinísticas) + .expected.json computado independente do nosso
// pricing.js, USANDO o snapshot LiteLLM diretamente.
//
// ⚠️ Débito documentado: o oracle ideal seria gerado por ccusage real
// (scripts/generate-oracle-paridade.mjs). Como ccusage devDep pode estar
// indisponível no ambiente de execução M1 (ambiente CI sem npm install),
// este script computa o expected lendo `pricing-snapshot.json` direto
// numa implementação INDEPENDENTE (sem importar pricing.js). Isso ainda
// pega regressões da nossa multiplicação de tokens — não é "paridade
// ccusage" estrita, mas é um oracle local válido até o devDep ser
// instalado e generate-oracle-paridade rodar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures');
const FIXTURE = path.join(FIXTURES_DIR, 'jsonl-paridade-ccusage.jsonl');
const EXPECTED = path.join(FIXTURES_DIR, 'jsonl-paridade-ccusage.expected.json');
const SNAPSHOT = path.join(REPO_ROOT, 'src', 'core', 'cost', 'pricing-snapshot.json');

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));

// Modelos exercitados (com prefixos como Claude Code grava). Confirmados
// presentes no snapshot LiteLLM via build-time check abaixo.
const MODELS = [
  'claude-sonnet-4-5',
  'claude-opus-4-1',
  'claude-haiku-4-5',
  'claude-3-7-sonnet-20250219',
];
for (const m of MODELS) {
  if (!snapshot[m]) {
    console.error(`[gen-paridade] model not in snapshot: ${m}`);
    process.exit(1);
  }
}

// PRNG determinístico para fixture reproducível.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const rndInt = (lo, hi) => Math.floor(rnd() * (hi - lo + 1)) + lo;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// Geração de 1k entries em janela de 5 dias.
const startMs = Date.parse('2026-05-25T08:00:00.000Z');
const lines = [];
const N = 1000;
for (let i = 0; i < N; i++) {
  const ts = new Date(startMs + i * 15_000).toISOString(); // 15s entre entries
  const model = pick(MODELS);
  const input = rndInt(50, 5000);
  const output = rndInt(20, 2000);
  const cacheRead = rnd() < 0.3 ? rndInt(0, 1000) : 0;
  const cacheCreate = rnd() < 0.1 ? rndInt(0, 500) : 0;
  const entry = {
    timestamp: ts,
    sessionId: `sess-paridade-${Math.floor(i / 100)}`,
    messageId: `msg-paridade-${i}`,
    requestId: `req-paridade-${i}`,
    model,
    usage: {
      input_tokens: input,
      output_tokens: output,
      cache_creation_input_tokens: cacheCreate,
      cache_read_input_tokens: cacheRead,
    },
  };
  lines.push(JSON.stringify(entry));
}
fs.writeFileSync(FIXTURE, lines.join('\n') + '\n', 'utf8');

// Compute expected — implementação INDEPENDENTE (não importa pricing.js).
const TIER = 200_000;
function numOr0(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function priceOne(entry) {
  const cfg = snapshot[entry.model];
  if (!cfg) return null;
  const u = entry.usage;
  const input = numOr0(u.input_tokens);
  const output = numOr0(u.output_tokens);
  const cc = numOr0(u.cache_creation_input_tokens);
  const cr = numOr0(u.cache_read_input_tokens);
  const inStd = numOr0(cfg.input_cost_per_token);
  const outStd = numOr0(cfg.output_cost_per_token);
  const inLong = numOr0(cfg.input_cost_per_token_above_200k_tokens) || inStd;
  const outLong = numOr0(cfg.output_cost_per_token_above_200k_tokens) || outStd;
  const ccCost = numOr0(cfg.cache_creation_input_token_cost);
  const crCost = numOr0(cfg.cache_read_input_token_cost);
  const totalIn = input + cc + cr;
  let inU, outU;
  if (totalIn > TIER && (cfg.input_cost_per_token_above_200k_tokens || cfg.output_cost_per_token_above_200k_tokens)) {
    const stdIn = Math.max(0, TIER - cr - cc);
    const longIn = Math.max(0, input - stdIn);
    inU = stdIn * inStd + longIn * inLong;
    outU = output * outLong;
  } else {
    inU = input * inStd;
    outU = output * outStd;
  }
  return inU + outU + cc * ccCost + cr * crCost;
}

const byModel = {};
let total = 0;
for (const line of lines) {
  const e = JSON.parse(line);
  const u = e.usage;
  if (!byModel[e.model]) {
    byModel[e.model] = {
      usd: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      entry_count: 0,
    };
  }
  byModel[e.model].input_tokens += numOr0(u.input_tokens);
  byModel[e.model].output_tokens += numOr0(u.output_tokens);
  byModel[e.model].cache_creation_tokens += numOr0(u.cache_creation_input_tokens);
  byModel[e.model].cache_read_tokens += numOr0(u.cache_read_input_tokens);
  byModel[e.model].entry_count += 1;
  const usd = priceOne(e);
  byModel[e.model].usd += usd;
  total += usd;
}

const expected = {
  total_usd: total,
  by_model: byModel,
  entry_count: N,
  unknown_models: [],
  pricing_source: 'snapshot',
  // staleness e warnings são dinâmicos, NÃO armazenar no expected.
  generator: 'scripts/gen-paridade-fixture.mjs',
  note: 'Independent oracle pending ccusage devDep install + generate-oracle-paridade.mjs run.',
};
fs.writeFileSync(EXPECTED, JSON.stringify(expected, null, 2) + '\n', 'utf8');
console.log(`[gen-paridade] wrote fixture (${N} entries) + expected. total_usd=${total.toFixed(4)}`);
