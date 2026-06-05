export const meta = {
  name: 'auditar-observabilidade-cobertura',
  description:
    'Audit cross-suite (v1.9 Observability + v1.10 SRE + v1.12 Legacy) de cobertura por Edge Function — em paralelo, com verify adversarial por gap.',
  whenToUse:
    'Quando há >= 10 Edge Functions e o audit serial do agent observability-coverage-auditor fica lento ou perde foco. Aceita os mesmos argumentos do command tradicional via `args`.',
  phases: [
    { title: 'Discover', detail: 'enumerar Edge Functions e coletar traffic 30d' },
    { title: 'Audit', detail: '1 agent por função × 4 dimensões em paralelo' },
    { title: 'Verify', detail: 'verify adversarial só nos gaps reportados' },
    { title: 'Synthesize', detail: 'matriz X/N + top-N críticas + write report' },
  ],
}

const PROJECT_ROOT = args?.projectRoot ?? '.'
const TRAFFIC_WINDOW = args?.trafficWindow ?? '30d'
const TOP_N = args?.topN ?? 5
const DIMENSIONS = args?.dimensions ?? ['signals', 'slo', 'burn-alert', 'characterization']
const OUTPUT_PATH = args?.outputPath ?? '.planning/OBSERVABILITY-COVERAGE.md'

const FN_LIST_SCHEMA = {
  type: 'object',
  required: ['functions', 'tier'],
  properties: {
    tier: { type: 'string', enum: ['full', 'partial'] },
    projectId: { type: ['string', 'null'] },
    functions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'path'],
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          deployed: { type: 'boolean' },
          traffic30d: { type: ['number', 'null'] },
        },
      },
    },
  },
}

const COVERAGE_SCHEMA = {
  type: 'object',
  required: ['name', 'hasSignals', 'hasSlo', 'hasBurnAlert', 'hasChar'],
  properties: {
    name: { type: 'string' },
    hasSignals: { type: 'boolean' },
    hasLatency: { type: 'boolean' },
    hasTraffic: { type: 'boolean' },
    hasErrors: { type: 'boolean' },
    hasSaturation: { type: 'boolean' },
    hasSlo: { type: 'boolean' },
    hasBurnAlert: { type: 'boolean' },
    hasChar: { type: 'boolean' },
    evidence: {
      type: 'object',
      properties: {
        signalsHits: { type: 'array', items: { type: 'string' } },
        sloPath: { type: ['string', 'null'] },
        burnPath: { type: ['string', 'null'] },
        charPath: { type: ['string', 'null'] },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['name', 'confirmedGaps'],
  properties: {
    name: { type: 'string' },
    confirmedGaps: {
      type: 'object',
      properties: {
        signals: { type: 'boolean' },
        slo: { type: 'boolean' },
        burnAlert: { type: 'boolean' },
        characterization: { type: 'boolean' },
      },
    },
    refutedEvidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string' },
          foundAt: { type: 'string' },
        },
      },
    },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['outputPath', 'status', 'coverage'],
  properties: {
    outputPath: { type: 'string' },
    status: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED'] },
    coverage: {
      type: 'object',
      properties: {
        signals: { type: 'object', properties: { covered: { type: 'number' }, total: { type: 'number' } } },
        slo: { type: 'object', properties: { covered: { type: 'number' }, total: { type: 'number' } } },
        burnAlert: { type: 'object', properties: { covered: { type: 'number' }, total: { type: 'number' } } },
        characterization: { type: 'object', properties: { covered: { type: 'number' }, total: { type: 'number' } } },
      },
    },
    topCritical: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          traffic30d: { type: ['number', 'null'] },
          missing: { type: 'array', items: { type: 'string' } },
          criticality: { type: 'number' },
        },
      },
    },
  },
}

phase('Discover')

const discovery = await agent(
  `Enumerar Edge Functions do projeto em ${PROJECT_ROOT}.

1. Detectar project_id em supabase/config.toml (grep -E '^project_id\\s*=' supabase/config.toml | sed 's/.*= *"\\(.*\\)".*/\\1/').
2. Se project_id presente E mcp__supabase__list_edge_functions disponível → tier="full", listar via MCP.
3. Senão → tier="partial", listar via filesystem: find supabase/functions -mindepth 1 -maxdepth 1 -type d.
4. Para tier="full": coletar traffic ${TRAFFIC_WINDOW} via mcp__supabase__get_logs (service=edge-function, query_filter por fn_name, aggregate=count). Para tier="partial": traffic30d=null.
5. Para cada function, devolver { name, path (relativo, ex: "supabase/functions/process-payments"), deployed?, traffic30d }.

Sem narração. Apenas o objeto JSON conforme schema.`,
  { label: 'discover-fns', phase: 'Discover', schema: FN_LIST_SCHEMA }
)

if (!discovery || !discovery.functions?.length) {
  log('Nenhuma Edge Function detectada. Abortando.')
  return { aborted: true, reason: 'no-edge-functions', outputPath: null }
}

log(`${discovery.functions.length} Edge Functions detectadas (tier=${discovery.tier})`)

const audited = await pipeline(
  discovery.functions,
  (fn) =>
    agent(
      `Audite a Edge Function "${fn.name}" (path: ${fn.path}) em 4 dimensões usando grep determinístico. Sem narração.

ENTRYPOINT esperado: ${fn.path}/index.ts (fallback: ${fn.path}/mod.ts ou primeiro *.ts no diretório).

1. **4 Golden Signals** no entrypoint:
   - hasLatency:    grep -qE "createHistogram\\(.*duration|histogram.*ms|latency_histogram"
   - hasTraffic:    grep -qE "createCounter\\(.*requests|http_requests_total|trafficCounter"
   - hasErrors:     grep -qE "createCounter\\(.*errors|http_errors_total|errorsCounter|error_type"
   - hasSaturation: grep -qE "createObservableGauge\\(.*saturation|connection_pool|queue_depth"
   - hasSignals = AND(hasLatency, hasTraffic, hasErrors, hasSaturation)
2. **SLO**: arquivo .planning/slos/${fn.name}.md existe OU .planning/SLO.md grep -q "${fn.name}".
3. **Burn alert**: .planning/burn-rate-alerts.md grep -q "${fn.name}" OU .planning/SLO.md tem "burn" no contexto de "${fn.name}" (grep -A 20 "${fn.name}" .planning/SLO.md | grep -q "burn").
4. **Characterization tests**: find tests/characterization test/characterization __tests__/characterization -path "*${fn.name}*" 2>/dev/null produz ≥1 linha.

Em "evidence", liste paths/linhas encontrados para CADA dimensão positiva (vão ser auditados pelo verifier do próximo stage). Para dimensão negativa, deixe array vazio / null.`,
      { label: `audit:${fn.name}`, phase: 'Audit', schema: COVERAGE_SCHEMA }
    ),
  async (coverage, fn) => {
    if (!coverage) return null
    const gaps = {
      signals: !coverage.hasSignals,
      slo: !coverage.hasSlo,
      burnAlert: !coverage.hasBurnAlert,
      characterization: !coverage.hasChar,
    }
    const missingDims = Object.entries(gaps)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (!missingDims.length) {
      return { ...coverage, verifiedGaps: {}, traffic30d: fn.traffic30d ?? null }
    }

    const verdict = await agent(
      `Você é skeptic. Coverage report para "${fn.name}" (${fn.path}) diz que estas dimensões estão MISSING: ${missingDims.join(', ')}.

Tente REFUTAR esses gaps. Padrões alternativos a checar (false negatives comuns do grep simples):
- **signals**: wrapper helpers (instrumentRequest, traced, withMetrics, withGoldenSignals), imports renomeados (import { Counter as C }), instrumentação OTel via decorator/middleware em arquivo separado (./telemetry.ts, ./otel.ts, ./metrics.ts) importado pelo entrypoint.
- **slo**: SLO em .planning/marcos/*/SLO.md, docs/slo/*.yml, supabase/slos/, arquivo SLO.md em path não-canônico.
- **burnAlert**: alerting.yaml, grafana/, prometheus rules (*.rules.yml), .planning/burn-rates/*.
- **characterization**: __tests__/<name>.snapshot.ts, e2e/<name>.spec.ts, tests/golden/, tests/<name>.golden.*.

Para CADA dimensão MISSING acima, em "confirmedGaps":
- true SOMENTE se o gap for genuíno (não achou padrão alternativo após busca expandida).
- false se você encontrou evidência alternativa (registre em "refutedEvidence").

Default cético: na dúvida, confirmedGaps=true (preserva o gap reportado).`,
      { label: `verify:${fn.name}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    )

    const verifiedGaps = verdict?.confirmedGaps ?? gaps
    return {
      ...coverage,
      hasSignals: coverage.hasSignals || (gaps.signals && !verifiedGaps.signals),
      hasSlo: coverage.hasSlo || (gaps.slo && !verifiedGaps.slo),
      hasBurnAlert: coverage.hasBurnAlert || (gaps.burnAlert && !verifiedGaps.burnAlert),
      hasChar: coverage.hasChar || (gaps.characterization && !verifiedGaps.characterization),
      verifiedGaps,
      refutedEvidence: verdict?.refutedEvidence ?? [],
      traffic30d: fn.traffic30d ?? null,
    }
  }
)

phase('Synthesize')

const rows = audited.filter(Boolean)

const synthesis = await agent(
  `Sintetize o audit cross-suite em ${OUTPUT_PATH}. Use a estrutura canônica do agent observability-coverage-auditor (Resumo executivo → Top ${TOP_N} → Tabela completa → Análise por dimensão → Cross-suite scoring → Próximas ações priorizadas).

DADOS (já verificados adversarialmente — gaps falsos foram corrigidos no stage Verify):

tier: ${discovery.tier}
trafficWindow: ${TRAFFIC_WINDOW}
dimensions: ${JSON.stringify(DIMENSIONS)}
rows: ${JSON.stringify(rows, null, 2)}

REGRAS:
1. Cobertura por dimensão = count(true) / total.
2. Status agregado: GREEN se ≥80% em TODAS, YELLOW se 50–80% em alguma, RED se <50% em alguma.
3. criticality_score = (traffic30d ?? 1) × missing_count (NULL traffic → score = missing_count).
4. Top ${TOP_N} críticas: ordenar por criticality_score desc, listar com missing dims e comando recomendado:
   - signals missing → /golden-signals <fn>
   - slo missing → /definir-slo <fn>
   - burnAlert missing → /burn-rate-status + criar alert
   - characterization missing → /caracterizar <fn>
5. Em "Análise por dimensão", mencione o impacto cross-suite (OMM Capacidade X, PRR Axe Y) conforme o template do agent original.
6. Escrever o markdown via Write tool em ${OUTPUT_PATH}.
7. Retornar { outputPath, status, coverage: { signals: {covered,total}, slo: {covered,total}, burnAlert: {covered,total}, characterization: {covered,total} }, topCritical: [...] }.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTHESIS_SCHEMA }
)

return {
  outputPath: synthesis?.outputPath ?? OUTPUT_PATH,
  status: synthesis?.status,
  coverage: synthesis?.coverage,
  topCritical: synthesis?.topCritical,
  totalFunctions: discovery.functions.length,
  tier: discovery.tier,
}
