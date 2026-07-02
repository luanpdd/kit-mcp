#!/usr/bin/env node
// hook-version: 1.30.4
// kit-mcp · Kit Router (UserPromptSubmit)
//
// Lê o prompt do usuário, detecta domínio(s) canônico(s) por keyword e injeta
// `additionalContext` com uma DIRETIVA FIRME de delegação: para trabalho
// multi-passo do domínio, usar Task(subagent_type=...) em vez de improvisar
// inline.
//
// Motivação: o kit tem 67 agents que quase nunca eram invocados — o modelo
// resolvia tudo inline. Este hook faz o roteamento se materializar NO MOMENTO
// DA DECISÃO (todo prompt relevante), que é o lever mais forte disponível no
// sistema de hooks do Claude Code sem bloquear o prompt.
//
// Pipeline: UserPromptSubmit → lê stdin envelope → casa keywords no campo
// `prompt` → escreve JSON { continue:true, hookSpecificOutput:{ ...,
// additionalContext } } → exit 0. Sem match → exit 0 sem injetar (prompt limpo).
//
// SOFT failure: qualquer erro → exit 0 sem bloquear. Skip se KIT_MCP_NO_ROUTER=1.
// CommonJS (.cjs) — compatível com qualquer setup Node.

'use strict';

if (process.env.KIT_MCP_NO_ROUTER === '1' || process.env.KIT_MCP_NO_ROUTER === 'true') {
  process.exit(0);
}

// Content-pack awareness (RFC §7.4): o `sync` REESCREVE a linha abaixo com a
// lista de packs efetivamente instalados no momento da projeção (bundle-aware).
// Mantido como `null` na fonte (kit/) = todos os domínios ativos (dev/default,
// back-compat). NÃO lemos o lockfile a cada prompt — o conjunto é baked-in no
// arquivo projetado, então o filtro é só uma comparação em memória.
const INSTALLED_PACKS = null; // KIT_MCP_INSTALLED_PACKS

// Tabela domínio → { pack, keywords, entrypoint (suíte/commands), agents canônicos }.
// `pack` mapeia o domínio ao Content Pack que o fornece — domínios cujo pack não
// está instalado são filtrados (não roteia para /supabase nem para agents ausentes).
// keywords são casadas como substring no prompt em lowercase.
const DOMAINS = [
  {
    name: 'Supabase',
    pack: 'supabase',
    keywords: ['supabase', 'rls', 'row level security', 'edge function', 'pgvector',
      'custom claim', 'postgres role', 'realtime', ' migration', 'migração', 'supavisor'],
    entrypoint: '/supabase',
    agents: ['supabase-architect', 'supabase-rls-writer', 'supabase-migration-writer',
      'supabase-edge-fn-writer'],
  },
  {
    name: 'Multi-tenant SaaS',
    pack: 'supabase',
    keywords: ['multi-tenant', 'multi tenant', 'multitenant', 'b2b saas', 'tenant',
      'rbac', 'super-admin', 'super admin', 'org invite', 'convite de membro', 'lgpd'],
    entrypoint: '/multi-tenant',
    agents: ['b2b-saas-architect', 'multi-tenant-rls-writer', 'org-onboarding-implementer',
      'invite-flow-implementer'],
  },
  {
    name: 'Legacy / refactor',
    pack: 'legacy',
    keywords: ['refactor', 'refatorar', 'código legado', 'codigo legado', 'legacy',
      'characterization', 'caracterização', 'seam', 'sem testes', 'sem teste'],
    entrypoint: '/legacy',
    agents: ['seam-finder', 'legacy-characterizer', 'refactor-safety-auditor'],
  },
  {
    name: 'Observabilidade',
    pack: 'observability',
    keywords: ['observability', 'observabilidade', 'slo', 'golden signal', 'tracing',
      'telemetr', 'burn rate', 'opentelemetry', 'otel', 'error budget'],
    entrypoint: '/observabilidade',
    agents: ['observability-instrumenter', 'golden-signals-instrumenter', 'slo-engineer'],
  },
  {
    name: 'SRE',
    pack: 'observability',
    keywords: ['postmortem', 'post-mortem', 'post mortem', 'toil', ' prr',
      'production readiness', 'incident', 'incidente', 'release pipeline', 'runbook'],
    entrypoint: '/sre',
    agents: ['postmortem-writer', 'toil-auditor', 'prr-conductor', 'incident-investigator'],
  },
  {
    name: 'Sistemas distribuídos (DDIA)',
    pack: 'supabase',
    keywords: ['consistency', 'consistência', 'replication', 'replicação', 'replica',
      'schema evolution', 'evolução de schema', 'cdc', 'hot tenant', 'tenant quente'],
    entrypoint: '/dados-distribuidos',
    agents: ['auditor-consistencia-isolamento', 'detector-tenant-quente',
      'validador-evolucao-schema'],
  },
  {
    name: 'Workflow de fases / milestone',
    pack: 'core',
    keywords: ['planejar fase', 'executar fase', 'milestone', 'marco', 'roadmap',
      'nova fase', 'plano de fase'],
    entrypoint: '/planejar-fase, /executar-fase',
    agents: ['planner', 'executor', 'verifier'],
  },
];

// Domínios ativos = todos (INSTALLED_PACKS null) OU só os cujo pack está instalado.
const ACTIVE_DOMAINS = INSTALLED_PACKS
  ? DOMAINS.filter((d) => INSTALLED_PACKS.includes(d.pack))
  : DOMAINS;

function buildDirective(matched) {
  const lines = [
    '🧭 kit-mcp router — o prompt casa ' +
      (matched.length === 1 ? 'o domínio canônico' : 'domínios canônicos') + ':',
  ];
  for (const d of matched) {
    lines.push(
      `• ${d.name} → entrypoint ${d.entrypoint} · agents: ${d.agents.join(', ')}`,
    );
  }
  lines.push(
    'REGRA: para trabalho multi-passo destes domínios, DELEGUE via',
    'Task(subagent_type="<agent>") em vez de implementar inline. Não improvise',
    'o que um agent canônico já cobre — o valor do kit ESTÁ nos agents.',
    'Exceção: ação trivial de 1 passo (rename, fix de 1 linha, ajuste de texto)',
    '→ resolva inline. Disable: env KIT_MCP_NO_ROUTER=1.',
  );
  return lines.join('\n');
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  let envelope;
  try {
    envelope = JSON.parse(input || '{}');
  } catch {
    process.exit(0); // envelope inválido — não bloquear
  }
  // O campo do prompt varia entre versões — aceitar os nomes plausíveis.
  const prompt = String(
    envelope.prompt || envelope.user_prompt || envelope.text || '',
  ).toLowerCase();
  if (!prompt) process.exit(0);

  const matched = ACTIVE_DOMAINS.filter((d) => d.keywords.some((k) => prompt.includes(k)));
  if (matched.length === 0) process.exit(0); // sem domínio (ou pack não instalado) — prompt limpo

  const payload = JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: buildDirective(matched),
    },
  });
  // flush antes de exit
  process.stdout.write(payload, () => process.exit(0));
});

process.stdin.on('error', () => process.exit(0));
