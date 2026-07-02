#!/usr/bin/env node
// Initial seed generator for the Content Packs system (docs/rfc-content-packs.md).
//
// Writes kit/packs/<id>/pack.json from the partition rules below, deriving the
// explicit member lists from the REAL kit/ contents so coverage is guaranteed
// (union of all packs == listKit). Run ONCE to seed; after that edit pack.json
// directly — re-running overwrites manual membership edits.
//
//   node scripts/bootstrap-packs.mjs            # write
//   node scripts/bootstrap-packs.mjs --check     # validate coverage only, no write
//
// The partition honors the dependency graph (docs/rfc-content-packs.md §4):
//   - supabase is the hub; multi-tenant/ddia HARD-require it.
//   - everything else is stack-agnostic base (core + legacy + observability + ui + cost-workflow).

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { listKit } from '../src/core/kit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const KIT_ROOT = path.join(REPO_ROOT, 'kit');
const PACKS_DIR = path.join(KIT_ROOT, 'packs');
const VERSION = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
const CHECK_ONLY = process.argv.includes('--check');

// --- Partition rules (the canonical initial mapping) ---------------------------
// Each domain pack lists explicit agent/command/skill members + a prefix rule.
// `core` is the catch-all: anything not claimed by a domain pack.

const PREFIX = {
  supabase:      { agents: 'supabase-', skills: 'supabase-' },
  legacy:        { skills: 'legacy-' },
  ui:            { agents: 'ui-', skills: 'ui-' },
};

const EXPLICIT = {
  // supabase = TODO o mundo Supabase, autossuficiente (sem requires): materialização
  // (supabase-*) + B2B multi-tenant + auditoria de dados distribuídos. Estes dois
  // últimos foram fundidos aqui porque dependem dos materializadores Supabase via
  // Task() — empacotá-los separados criaria packs que dependem de outros packs.
  supabase: {
    agents: [
      'schema-checker',
      // B2B multi-tenant
      'b2b-saas-architect','multi-tenant-isolation-auditor','multi-tenant-rls-writer','lgpd-compliance-auditor','org-onboarding-implementer','invite-flow-implementer','super-admin-implementer','audit-log-implementer','evolution-go-integrator','crm-pipeline-implementer',
      // auditoria de dados distribuídos (ex-"ddia")
      'auditor-consistencia-isolamento','detector-tenant-quente','validador-evolucao-schema',
    ],
    skills: [
      // B2B multi-tenant
      'audit-log-multi-tenant','b2b-saas-architecture','crm-lead-pipeline-patterns','evolution-go-whatsapp-integration','lgpd-multi-tenant-compliance','member-invite-flow','member-management-react-shadcn','multi-tenant-performance-scaling','multi-tenant-rls-hierarchy','org-onboarding-flow','org-switcher-react-pattern','permission-gate-react-pattern','rbac-permissions-matrix-supabase','super-admin-platform-pattern','whatsapp-conversation-state-machine',
      // dados distribuídos (ex-"ddia")
      'armadilhas-sistemas-distribuidos','consistencia-leitura-replica','escolha-modelo-consistencia','evolucao-schema-compativel','postgres-isolamento-concorrencia','streams-eventos-cdc','tenant-quente-mitigacao',
    ],
    commands: ['supabase','multi-tenant','dados-distribuidos'],
    workflows: [],
  },
  observability: {
    agents: ['observability-instrumenter','observability-coverage-auditor','omm-auditor','incident-investigator','golden-signals-instrumenter','burn-rate-forecaster','payload-capture-instrumenter','slo-engineer','toil-auditor','postmortem-writer','prr-conductor','cascading-failures-auditor','load-shedding-instrumenter','release-pipeline-auditor'],
    skills: ['observability-driven-development','observability-maturity-model','opentelemetry-standard','structured-events','distributed-tracing','core-analysis-loop','four-golden-signals','telemetry-pipelines','telemetry-sampling','event-based-slos','burn-rate-alerting','sre-risk-management','eliminating-toil','blameless-postmortems','production-readiness-review','cascading-failures','load-shedding-graceful-degradation','retry-strategies','release-engineering','hermetic-builds'],
    commands: ['observabilidade','sre','auditar-observabilidade','auditar-observabilidade-cobertura','auditar-observabilidade-cobertura-workflow','golden-signals','auditar-toil','postmortem','prr','definir-slo','burn-rate-status','risk-budget','auditar-cascading','load-shedding','auditar-release','instrumentar-fase','investigar-producao','capturar-payloads'],
    workflows: ['auditar-observabilidade-cobertura'],
  },
  legacy: {
    agents: ['legacy-characterizer','seam-finder','refactor-safety-auditor','shotgun-surgery-detector','storytelling-analyst','ai-mutation-tester'],
    skills: ['pre-refactor-characterization','ai-prompt-characterization','llm-as-dependency'],
    commands: ['legacy','caracterizar','caracterizar-prompt','encontrar-seams','auditar-refactor','refactor-seguro','detectar-duplicacao','storytelling'],
    workflows: [],
  },
  ui: {
    agents: ['designer-ui'],
    skills: [],
    commands: ['fase-ui','revisar-ui'],
    workflows: [],
  },
  'cost-workflow': {
    agents: ['workflow-generator'],
    skills: ['cost-tracking','dynamic-workflow-authoring'],
    commands: ['custo-fase','custo-hoje','custo-sessao','criar-workflow'],
    workflows: [],
  },
};

// PRINCÍPIO: todo pack é autossuficiente — requires SEMPRE vazio. Tudo que um pack
// usa está dentro dele ou na base (core). Sem deps entre packs = sem instalação quebrada.
const META = {
  core:            { name: 'Núcleo — Framework de Fases', kind: 'core', removable: false, description: 'Motor do framework (discutir→planejar→executar→verificar), roadmap/milestone, debugging e mapeamento de codebase. Stack-agnostic. Base obrigatória, sempre instalada.' },
  supabase:        { name: 'Supabase (completo)', kind: 'domain', removable: true, description: 'Tudo para apps Supabase, autossuficiente: schema/RLS/migrations/Edge Functions/Auth/Storage/Realtime + B2B multi-tenant (org/RBAC/convite/onboarding/super-admin/LGPD/CRM/WhatsApp) + auditoria de dados distribuídos (consistência, isolamento, hot-tenant, evolução de schema). Não usa Supabase? Não instale este pack.' },
  observability:   { name: 'Observabilidade & SRE', kind: 'domain', removable: true, description: 'OpenTelemetry, golden signals, SLO/burn-rate, toil, postmortem, PRR, cascading failures, load shedding, release audit. Stack-agnostic.' },
  legacy:          { name: 'Código Legado (Feathers)', kind: 'domain', removable: true, description: 'Characterization tests, seams, gate de refactor seguro, detecção de duplicação, storytelling de codebase, mutation testing. Aplica a qualquer codebase.' },
  ui:              { name: 'UI & Design', kind: 'domain', removable: true, description: 'Fluência de design para IA: contrato UI-SPEC, verificação, auditoria visual, designer guiado por MARCA.md. Stack-agnostic (React/shadcn).' },
  'cost-workflow': { name: 'Custo & Workflows', kind: 'domain', removable: true, description: 'Telemetria de custo USD/tokens do Claude Code + gerador de Dynamic Workflows. Utilitários sem dependência de stack.' },
};

const HOOKS = { supabase: ['post-apply-migration.js'] }; // metadata-only em v1 (hooks não são filtrados ainda)

const PACK_ORDER = ['core','supabase','observability','legacy','ui','cost-workflow'];

// --- Build membership from the real kit ---------------------------------------

function claim(name, kind, packsByName, prefixKindKey) {
  for (const id of PACK_ORDER) {
    if (id === 'core') continue;
    const ex = EXPLICIT[id]?.[kind] ?? [];
    if (ex.includes(name)) return id;
    const pref = PREFIX[id]?.[prefixKindKey];
    if (pref && name.startsWith(pref)) return id;
  }
  return 'core';
}

const kit = await listKit(KIT_ROOT);
const buckets = {
  agents: kit.agents.map(x => x.name),
  commands: kit.commands.map(x => x.name),
  skills: kit.skills.map(x => x.name),
  workflows: (kit.workflows ?? []).map(x => x.fileBase),
};

const membership = {};
for (const id of PACK_ORDER) membership[id] = { agents: [], commands: [], skills: [], workflows: [] };

for (const name of buckets.agents)    membership[claim(name, 'agents',    null, 'agents')].agents.push(name);
for (const name of buckets.commands)  membership[claim(name, 'commands',  null, null)].commands.push(name);
for (const name of buckets.skills)    membership[claim(name, 'skills',    null, 'skills')].skills.push(name);
for (const name of buckets.workflows) membership[claim(name, 'workflows', null, null)].workflows.push(name);

// --- Coverage validation -------------------------------------------------------

let problems = 0;
for (const kind of ['agents','commands','skills','workflows']) {
  const assigned = PACK_ORDER.flatMap(id => membership[id][kind]);
  const set = new Set(assigned);
  if (set.size !== assigned.length) { console.error(`✗ DUPLICATE ${kind} assignment`); problems++; }
  if (set.size !== buckets[kind].length) {
    const missing = buckets[kind].filter(n => !set.has(n));
    console.error(`✗ COVERAGE ${kind}: ${set.size}/${buckets[kind].length} — órfãos: ${missing.join(', ')}`);
    problems++;
  }
}

// --- Summary table -------------------------------------------------------------

console.log('\nPack            agents commands skills wf   requires');
console.log('-------------------------------------------------------------');
for (const id of PACK_ORDER) {
  const m = membership[id];
  const req = (META[id].requires ?? []).join(',') || '—';
  console.log(
    `${id.padEnd(15)} ${String(m.agents.length).padStart(5)} ${String(m.commands.length).padStart(8)} ${String(m.skills.length).padStart(6)} ${String(m.workflows.length).padStart(3)}   ${req}`
  );
}
console.log('-------------------------------------------------------------');
console.log(`TOTAL: ${buckets.agents.length} agents · ${buckets.commands.length} commands · ${buckets.skills.length} skills · ${buckets.workflows.length} workflows`);

if (problems > 0) { console.error(`\n${problems} problema(s) de cobertura. Abortado.`); process.exit(1); }
console.log('\n✓ Cobertura completa: união dos packs == listKit');

if (CHECK_ONLY) process.exit(0);

// --- Write manifests -----------------------------------------------------------

function manifestFor(id) {
  const m = membership[id];
  const meta = META[id];
  const resources = {
    agents: m.agents.sort(),
    commands: m.commands.sort(),
    skills: m.skills.sort(),
    workflows: m.workflows.sort(),
    hooks: HOOKS[id] ?? [],
  };
  return {
    schemaVersion: 1,
    id,
    name: meta.name,
    version: VERSION,
    description: meta.description,
    publisher: 'luanpdd',
    kind: meta.kind,
    removable: meta.removable,
    compat: { kitMcp: `>=${VERSION}`, targets: ['claude-code','cursor','codex','windsurf','antigravity','copilot','trae'] },
    requires: meta.requires ?? [],
    recommends: meta.recommends ?? [],
    conflicts: [],
    provides: meta.provides ?? [],
    resources,
  };
}

await fs.mkdir(PACKS_DIR, { recursive: true });
for (const id of PACK_ORDER) {
  const dir = path.join(PACKS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const json = JSON.stringify(manifestFor(id), null, 2) + '\n';
  await fs.writeFile(path.join(dir, 'pack.json'), json, 'utf8');
  console.log(`  wrote kit/packs/${id}/pack.json`);
}
console.log('\n✓ Manifestos escritos. Rode: node scripts/regen-pack-registry.js && node scripts/regen-manifest.js');
