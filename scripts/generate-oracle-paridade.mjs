#!/usr/bin/env node
// Phase 172 — Gerador do oracle de paridade vs ccusage.
//
// MANUAL. NÃO encadear em prepublishOnly nem em CI default.
// Executa quando dev quer atualizar `test/fixtures/jsonl-paridade-ccusage.expected.json`.
//
// Estratégia:
//   1. Carrega test/fixtures/jsonl-paridade-ccusage.jsonl
//   2. Invoca ccusage como devDep (CLI ou import) com o fixture
//   3. Captura output JSON com total_usd + by_model
//   4. Grava jsonl-paridade-ccusage.expected.json
//
// Fallback: se ccusage não estiver instalado (dev não rodou `npm install`),
// imprime warning e exit 0 sem reescrever fixture. Isso é OK porque a
// fixture .expected.json é versionada (gerada uma vez, commitada).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures');
const FIXTURE = path.join(FIXTURES_DIR, 'jsonl-paridade-ccusage.jsonl');
const EXPECTED = path.join(FIXTURES_DIR, 'jsonl-paridade-ccusage.expected.json');

function findCcusageBin() {
  const candidates = [
    path.join(REPO_ROOT, 'node_modules', '.bin', 'ccusage'),
    path.join(REPO_ROOT, 'node_modules', '.bin', 'ccusage.cmd'),
    path.join(REPO_ROOT, 'node_modules', 'ccusage', 'dist', 'index.js'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function main() {
  if (!fs.existsSync(FIXTURE)) {
    console.warn(`[oracle] fixture missing: ${FIXTURE} — nothing to do.`);
    return;
  }
  const bin = findCcusageBin();
  if (!bin) {
    console.warn('[oracle] ccusage not installed (devDep skipped). Re-run after `npm install`.');
    return;
  }

  // ccusage CLI typically scans CLAUDE_CONFIG_DIR. We point it ao dir
  // que contém o fixture (1 arquivo jsonl).
  const env = { ...process.env, CLAUDE_CONFIG_DIR: FIXTURES_DIR };
  const r = spawnSync('node', [bin, 'daily', '--json'], { env, encoding: 'utf8' });
  if (r.status !== 0) {
    console.warn(`[oracle] ccusage exit=${r.status} stderr=${r.stderr?.slice(0, 200)}`);
    return;
  }
  let payload;
  try {
    payload = JSON.parse(r.stdout);
  } catch (err) {
    console.warn(`[oracle] could not parse ccusage stdout: ${err.message}`);
    return;
  }
  fs.writeFileSync(EXPECTED, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[oracle] wrote ${EXPECTED}`);
}

main();
