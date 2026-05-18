#!/usr/bin/env node
// #9 — Auditoria de colisão de gatilhos de skills.
//
// As skills auto-triggam pela `description` do SKILL.md. Quando duas skills
// compartilham muitos termos de gatilho, o roteamento fica ambíguo (o modelo
// não sabe qual disparar) — sintoma de "denso / se perdendo".
//
// Este script lê as 81 SKILL.md, tokeniza as descrições, e reporta:
//   1. Tokens "quentes" — termos que aparecem em muitas skills (gatilho fraco).
//   2. Pares de skills com alta sobreposição de descrição (Jaccard) — candidatos
//      a colisão real / merge / desambiguação.
//
// Saída: reports/SKILL-TRIGGER-AUDIT.md  (+ resumo no stdout).
// Uso: node scripts/audit-skill-triggers.mjs

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, 'kit', 'skills');
const OUT = path.join(ROOT, 'reports', 'SKILL-TRIGGER-AUDIT.md');

// Stopwords PT + EN + ruído estrutural ("use ao..." é prefixo de toda desc).
const STOP = new Set([
  'use', 'ao', 'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'e', 'ou', 'a', 'o',
  'as', 'os', 'para', 'por', 'que', 'um', 'uma', 'no', 'na', 'nos', 'nas', 'se',
  'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'a', 'an', 'with', 'as',
  'é', 'ser', 'sem', 'sob', 'via', 'vs', 'etc', 'quando', 'ANTES', 'antes',
  'após', 'apos', 'cada', 'todo', 'toda', 'pré', 'pre', 'já', 'mais', 'não',
  'nao', 'são', 'sao', 'está', 'esta', 'este', 'isso', 'seu', 'sua', 'ela',
  'ele', 'mesmo', 'qualquer', 'cap', 'modernização', 'modernizacao',
]);

function tokenize(desc) {
  return [...new Set(
    desc
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)),
  )];
}

function parseFrontmatter(raw) {
  // Normaliza CRLF→LF: `.` em JS não casa `\r` (line terminator), então
  // descrições de arquivos CRLF quebravam o `(.*)$`. 46/81 SKILL.md são CRLF.
  const norm = raw.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function jaccard(a, b) {
  const setB = new Set(b);
  const inter = a.filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

async function main() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_shared')) continue;
    let raw;
    try { raw = await readFile(path.join(SKILLS_DIR, e.name, 'SKILL.md'), 'utf8'); }
    catch { continue; }
    const fm = parseFrontmatter(raw);
    if (!fm?.name || !fm?.description) continue;
    skills.push({ name: fm.name, description: fm.description, tokens: tokenize(fm.description) });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // 1. Inverted index token → skills.
  const index = new Map();
  for (const s of skills) {
    for (const t of s.tokens) {
      if (!index.has(t)) index.set(t, []);
      index.get(t).push(s.name);
    }
  }
  const HOT_THRESHOLD = 6; // token em >=6 skills = gatilho fraco
  const hot = [...index.entries()]
    .filter(([, names]) => names.length >= HOT_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length);

  // 2. Pares com alta sobreposição.
  const PAIR_THRESHOLD = 0.30;
  const pairs = [];
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const sim = jaccard(skills[i].tokens, skills[j].tokens);
      if (sim >= PAIR_THRESHOLD) {
        pairs.push({ a: skills[i].name, b: skills[j].name, sim });
      }
    }
  }
  pairs.sort((a, b) => b.sim - a.sim);

  // Relatório.
  const lines = [
    '# Auditoria de gatilhos de skills (#9)',
    '',
    `Gerado: ${new Date().toISOString()}`,
    `Skills analisadas: **${skills.length}**`,
    '',
    '## 1. Tokens quentes (gatilho fraco)',
    '',
    `Termos presentes em ≥ ${HOT_THRESHOLD} descrições — disparam muitas skills`,
    'ao mesmo tempo, então não desambiguam nada. Candidatos a remover/qualificar.',
    '',
    '| Token | Nº de skills | Skills |',
    '| --- | --- | --- |',
    ...hot.map(([t, names]) =>
      `| \`${t}\` | ${names.length} | ${names.join(', ')} |`),
    '',
    '## 2. Pares com descrição sobreposta',
    '',
    `Pares com similaridade Jaccard ≥ ${PAIR_THRESHOLD} — colisão real de gatilho.`,
    'Candidatos a merge OU a desambiguar a descrição (deixar claro QUANDO cada uma).',
    '',
    '| Skill A | Skill B | Similaridade |',
    '| --- | --- | --- |',
    ...pairs.map((p) => `| ${p.a} | ${p.b} | ${(p.sim * 100).toFixed(0)}% |`),
    '',
    '## Resumo',
    '',
    `- ${hot.length} tokens quentes (≥ ${HOT_THRESHOLD} skills).`,
    `- ${pairs.length} pares colidindo (≥ ${PAIR_THRESHOLD * 100}% similaridade).`,
    '- Próximo passo (#2): reescrever descrições dos pares colidindo para',
    '  deixar explícito o gatilho diferenciador de cada skill.',
    '',
  ];

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, lines.join('\n'), 'utf8');

  console.log(`[audit-skill-triggers] ${skills.length} skills`);
  console.log(`  tokens quentes (≥${HOT_THRESHOLD}): ${hot.length}`);
  console.log(`  pares colidindo (≥${PAIR_THRESHOLD * 100}%): ${pairs.length}`);
  console.log(`  relatório: ${path.relative(ROOT, OUT)}`);
  if (hot.length) {
    console.log('  top 5 tokens:', hot.slice(0, 5).map(([t, n]) => `${t}(${n.length})`).join(', '));
  }
}

main().catch((e) => { console.error('[audit-skill-triggers] FAIL:', e.message); process.exit(1); });
