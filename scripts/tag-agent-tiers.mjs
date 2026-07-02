#!/usr/bin/env node
// #6 — Classifica os 67 agents em tiers e injeta `tier:` no frontmatter.
//
//   tier: core         → backbone de workflow, usado em quase todo projeto/fase.
//   tier: specialized  → domínio específico (Supabase, multi-tenant, SRE, …).
//
// Objetivo: reduzir a superfície de decisão. Core fica sempre visível; o resto
// é descoberto sob demanda (kit list-agents tier=core, sidebar do docs, etc).
//
// Idempotente: se o agent já tem `tier:`, é pulado. Preserva line ending.
// Uso: node scripts/tag-agent-tiers.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = path.join(ROOT, 'kit', 'agents');

// Backbone do workflow framework — invocados em qualquer milestone, sem
// depender do domínio do projeto. Todo o resto é `specialized`.
const CORE = new Set([
  'planner',
  'executor',
  'verifier',
  'phase-researcher',
  'plan-checker',
  'roadmapper',
  'project-researcher',
  'research-synthesizer',
  'codebase-mapper',
  'debugger',
  'integration-checker',
  'assumptions-analyzer',
  'advisor-researcher',
]);

async function main() {
  const files = (await readdir(AGENTS_DIR)).filter((f) => f.endsWith('.md'));
  let tagged = 0, skipped = 0, core = 0, spec = 0;

  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    const abs = path.join(AGENTS_DIR, file);
    const raw = await readFile(abs, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';

    // Já tem tier? idempotente.
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) { console.warn(`  [skip] ${name}: sem frontmatter`); skipped++; continue; }
    if (/^tier:/m.test(fmMatch[1])) { skipped++; continue; }

    const tier = CORE.has(name) ? 'core' : 'specialized';
    if (tier === 'core') core++; else spec++;

    // Insere `tier:` logo após a linha `name:` (mantém ordem name→tier→description).
    const lines = raw.split(/\r?\n/);
    const nameIdx = lines.findIndex((l) => /^name:/.test(l));
    if (nameIdx === -1) { console.warn(`  [skip] ${name}: sem linha name:`); skipped++; continue; }
    lines.splice(nameIdx + 1, 0, `tier: ${tier}`);
    await writeFile(abs, lines.join(eol), 'utf8');
    tagged++;
  }

  console.log(`[tag-agent-tiers] ${files.length} agents`);
  console.log(`  tagueados: ${tagged}  (core ${core}, specialized ${spec})`);
  console.log(`  pulados (já tinham tier / sem fm): ${skipped}`);
}

main().catch((e) => { console.error('[tag-agent-tiers] FAIL:', e.message); process.exit(1); });
