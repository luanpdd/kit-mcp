#!/usr/bin/env node
// Phase 172 — Regen pricing snapshot from LiteLLM.
//
// Manual script (NÃO encadeado em prepublishOnly conforme G4 do SPEC).
// Roda local quando dev quer atualizar OU pela GH Action weekly.
//
// Output:
//   src/core/cost/pricing-snapshot.json   — só Anthropic claude-* models
//   src/core/cost/pricing-snapshot.meta.json — sha256, fetched_at, etc.
//
// Falha graceful: se LiteLLM API estiver offline, mantém snapshot existente
// e exit 1 com mensagem informativa. NÃO grava snapshot vazio.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'src', 'core', 'cost');
const SNAPSHOT_PATH = path.join(OUT_DIR, 'pricing-snapshot.json');
const META_PATH = path.join(OUT_DIR, 'pricing-snapshot.meta.json');

const SOURCE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const COMMIT_URL = 'https://api.github.com/repos/BerriAI/litellm/commits/main';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'kit-mcp-regen-pricing/1.0' },
  });
  if (!res.ok) throw new Error(`http_${res.status}_${url}`);
  return res.json();
}

function isClaudeKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return k.includes('claude') || k.startsWith('anthropic/');
}

async function main() {
  const offlineFallback = process.argv.includes('--offline-fallback');
  let upstream;
  let commitSha = 'unknown';
  try {
    upstream = await fetchJson(SOURCE_URL);
    try {
      const commit = await fetchJson(COMMIT_URL);
      commitSha = commit?.sha || 'unknown';
    } catch (err) {
      console.warn(`[regen-pricing] could not fetch commit sha: ${err.message}`);
    }
  } catch (err) {
    if (offlineFallback && fs.existsSync(SNAPSHOT_PATH)) {
      console.warn(`[regen-pricing] OFFLINE FALLBACK: keeping existing snapshot. err=${err.message}`);
      return;
    }
    console.error(`[regen-pricing] FATAL: cannot fetch ${SOURCE_URL}: ${err.message}`);
    process.exit(1);
  }

  const filtered = {};
  for (const [key, value] of Object.entries(upstream)) {
    if (!isClaudeKey(key)) continue;
    if (!value || typeof value !== 'object') continue;
    // Pick só campos relevantes para evitar payload bloat.
    filtered[key] = {
      max_tokens: value.max_tokens,
      max_input_tokens: value.max_input_tokens,
      max_output_tokens: value.max_output_tokens,
      input_cost_per_token: value.input_cost_per_token,
      output_cost_per_token: value.output_cost_per_token,
      input_cost_per_token_above_200k_tokens: value.input_cost_per_token_above_200k_tokens,
      output_cost_per_token_above_200k_tokens: value.output_cost_per_token_above_200k_tokens,
      cache_creation_input_token_cost: value.cache_creation_input_token_cost,
      cache_read_input_token_cost: value.cache_read_input_token_cost,
      mode: value.mode,
      litellm_provider: value.litellm_provider,
    };
  }

  if (Object.keys(filtered).length === 0) {
    console.error('[regen-pricing] FATAL: filter returned zero models. Aborting.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const snapshotJson = JSON.stringify(filtered, null, 2);
  fs.writeFileSync(SNAPSHOT_PATH, snapshotJson, 'utf8');

  const sha256 = crypto.createHash('sha256').update(snapshotJson).digest('hex');
  const meta = {
    sha256,
    fetched_at: new Date().toISOString(),
    source_url: SOURCE_URL,
    model_count: Object.keys(filtered).length,
    litellm_commit: commitSha,
    generator: 'scripts/regen-pricing.mjs',
    schema_version: 1,
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`[regen-pricing] wrote ${Object.keys(filtered).length} models. sha256=${sha256.slice(0, 12)}…`);
}

main().catch((err) => {
  console.error('[regen-pricing] uncaught:', err);
  process.exit(1);
});
