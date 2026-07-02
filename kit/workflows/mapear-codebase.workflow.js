export const meta = {
  name: 'mapear-codebase',
  description:
    'Mapeamento de codebase em paralelo — 4 mappers (tech, arch, quality, concerns) escrevem os 7 docs de .planning/codebase/ e um synthesizer final consolida, verifica e roda secret scan.',
  whenToUse:
    'Quando o fanout hardcoded do /mapear-codebase fica lento em codebase grande ou voce quer verificacao consolidada dos 7 documentos com recuperacao de falha parcial. Aceita os mesmos argumentos do command tradicional via `args`.',
  phases: [
    { title: 'Prepare', detail: 'checar codebase nao-trivial + criar .planning/codebase/' },
    { title: 'Fanout', detail: '4 mappers paralelos — cada um escreve seus proprios documentos' },
    { title: 'Synthesize', detail: 'verificar 7 docs + secret scan + consolidar resultado final' },
  ],
}

const PROJECT_ROOT = args?.projectRoot ?? '.'
const OUTPUT_DIR = args?.outputDir ?? '.planning/codebase'
const FOCUS_AREA = args?.focusArea ?? null
const MIN_LINES = args?.minLines ?? 20

// Espelha o contrato do /mapear-codebase + agent codebase-mapper:
// 4 areas de foco → 7 documentos canonicos em .planning/codebase/.
const MAPPERS = [
  {
    focus: 'tech',
    docs: ['STACK.md', 'INTEGRATIONS.md'],
    briefing:
      'stack tecnologico e integracoes externas — linguagens, runtime, frameworks, dependencias criticas, configuracao, APIs externas, bancos de dados, provedores de auth, webhooks',
  },
  {
    focus: 'arch',
    docs: ['ARCHITECTURE.md', 'STRUCTURE.md'],
    briefing:
      'arquitetura e estrutura — padrao geral, camadas, fluxo de dados, abstracoes-chave, pontos de entrada, layout de diretorios, convencoes de nomenclatura, onde adicionar codigo novo',
  },
  {
    focus: 'quality',
    docs: ['CONVENTIONS.md', 'TESTING.md'],
    briefing:
      'convencoes de codigo e padroes de teste — estilo, nomenclatura, organizacao de imports, tratamento de erros, logging, framework de teste, estrutura de suites, mocking, fixtures, cobertura',
  },
  {
    focus: 'concerns',
    docs: ['CONCERNS.md'],
    briefing:
      'divida tecnica e riscos — TODOs/FIXMEs, bugs conhecidos, seguranca, gargalos de performance, areas frageis, limites de escala, dependencias em risco, gaps de cobertura de teste',
  },
]

const EXPECTED_DOCS = MAPPERS.flatMap((m) => m.docs)

const FOCUS_HINT = FOCUS_AREA
  ? `Area de foco pedida pelo usuario: "${FOCUS_AREA}" — priorize esse subsistema, mas mantenha a estrutura completa dos templates.`
  : 'Sem area de foco especifica — cubra a codebase inteira.'

const PREPARE_SCHEMA = {
  type: 'object',
  required: ['trivial', 'sourceFileCount', 'existingDocs'],
  properties: {
    trivial: { type: 'boolean' },
    sourceFileCount: { type: 'number' },
    existingDocs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'lines'],
        properties: {
          name: { type: 'string' },
          lines: { type: 'number' },
        },
      },
    },
  },
}

const MAPPER_SCHEMA = {
  type: 'object',
  required: ['focus', 'documents'],
  properties: {
    focus: { type: 'string', enum: ['tech', 'arch', 'quality', 'concerns'] },
    documents: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'path', 'lines'],
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          lines: { type: 'number' },
        },
      },
    },
    highlights: { type: 'array', items: { type: 'string' } },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['status', 'documents', 'missing', 'secretsSuspected'],
  properties: {
    status: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED'] },
    documents: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'lines', 'status'],
        properties: {
          name: { type: 'string' },
          lines: { type: 'number' },
          status: { type: 'string', enum: ['ok', 'degraded', 'missing'] },
        },
      },
    },
    missing: { type: 'array', items: { type: 'string' } },
    secretsSuspected: { type: 'boolean' },
    secretFiles: { type: 'array', items: { type: 'string' } },
  },
}

phase('Prepare')

const prepared = await agent(
  `Prepare o mapeamento da codebase em ${PROJECT_ROOT}. Sem narracao.

1. Conte arquivos de codigo-fonte (excluindo node_modules, .git, dist, build, vendor, coverage):
   find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" -o -name "*.php" -o -name "*.cs" -o -name "*.sql" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/vendor/*" -not -path "*/coverage/*" | wc -l
2. trivial = true SOMENTE se a contagem for < 5 (codebase trivial — nada a mapear).
3. Garanta o diretorio de saida: mkdir -p ${OUTPUT_DIR}
4. Liste documentos ja existentes em ${OUTPUT_DIR} com contagem de linhas (wc -l). Eles serao sobrescritos pelos mappers — apenas registre o estado atual em existingDocs (array vazio se nao houver nenhum).

Apenas o objeto JSON conforme schema.`,
  { label: 'prepare', phase: 'Prepare', schema: PREPARE_SCHEMA }
)

if (!prepared || prepared.trivial) {
  log('Codebase trivial (< 5 arquivos de codigo) — nada a mapear. Abortando.')
  return {
    aborted: true,
    reason: 'trivial-codebase',
    outputDir: OUTPUT_DIR,
    documents: [],
    missing: EXPECTED_DOCS,
  }
}

log(
  `${prepared.sourceFileCount} arquivos de codigo detectados; ${prepared.existingDocs.length} docs previos em ${OUTPUT_DIR}`
)

phase('Fanout')

const fanout = await pipeline(MAPPERS, (m) =>
  agent(
    `Focus: ${m.focus}

Analise a codebase em ${PROJECT_ROOT} para ${m.briefing}.
${FOCUS_HINT}

Escreva ESTES documentos diretamente em ${OUTPUT_DIR}/ usando a ferramenta Write e os templates canonicos do seu papel (codebase-mapper):
${m.docs.map((d) => `- ${OUTPUT_DIR}/${d}`).join('\n')}

Regras:
- Explore minuciosamente antes de escrever; todo achado com caminho de arquivo real em backticks.
- Seja prescritivo (oriente codigo futuro), nao apenas descritivo.
- NUNCA leia ou cite conteudo de .env, credenciais, chaves ou segredos — apenas registre a existencia do arquivo.
- Cada documento deve ter no minimo ${MIN_LINES} linhas uteis.
- NAO faca commit — o orquestrador cuida do git.

Ao final NAO retorne o conteudo dos documentos — apenas a confirmacao estruturada conforme schema: focus, documents ([{ name, path, lines }]) e highlights (3 a 5 achados-chave de 1 linha cada, para o synthesizer).`,
    { agentType: 'codebase-mapper', label: `map:${m.focus}`, phase: 'Fanout', schema: MAPPER_SCHEMA }
  )
)

phase('Synthesize')

const confirmations = fanout.filter(Boolean)
if (confirmations.length < MAPPERS.length) {
  log(
    `${MAPPERS.length - confirmations.length} mapper(s) sem confirmacao — synthesizer tentara recuperar pelo disco/highlights`
  )
}

const synthesis = await agent(
  `Voce e o consolidador final do mapeamento de codebase. Documentos esperados em ${OUTPUT_DIR}/: ${EXPECTED_DOCS.join(', ')}.

CONFIRMACOES DOS MAPPERS (resumos compactos — a fonte da verdade e o disco):
${JSON.stringify(confirmations, null, 2)}

TAREFAS:
1. Verifique cada documento esperado no disco: wc -l ${OUTPUT_DIR}/*.md. Status por doc: "ok" (existe e >= ${MIN_LINES} linhas), "degraded" (existe mas < ${MIN_LINES} linhas), "missing" (nao existe).
2. Para doc "missing" ou "degraded" cujo mapper correspondente devolveu highlights: escreva (Write) uma versao minima do documento a partir dos highlights, iniciando com o aviso "> Documento degradado — regenere com /mapear-codebase". Depois reclassifique como "degraded". Sem highlights disponiveis, mantenha "missing".
3. Secret scan nos documentos gerados (NUNCA cite o valor de um match — apenas o arquivo):
   grep -lE '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.)' ${OUTPUT_DIR}/*.md
   secretsSuspected = true se houver qualquer match; liste os arquivos em secretFiles.
4. status agregado: GREEN se todos "ok" e sem secrets; YELLOW se algum "degraded" (e nenhum missing/secret); RED se algum "missing" OU secretsSuspected.
5. NAO faca commit — o orquestrador cuida do git.

Retorne apenas o objeto JSON conforme schema.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTHESIS_SCHEMA }
)

if (synthesis?.secretsSuspected) {
  log(
    `ALERTA: possiveis segredos em ${(synthesis.secretFiles ?? []).join(', ')} — revise antes de commitar`
  )
}

return {
  outputDir: OUTPUT_DIR,
  status: synthesis?.status ?? 'RED',
  documents: synthesis?.documents ?? [],
  missing: synthesis?.missing ?? EXPECTED_DOCS,
  secretsSuspected: synthesis?.secretsSuspected ?? false,
  secretFiles: synthesis?.secretFiles ?? [],
  mappersCompleted: confirmations.length,
  mappersTotal: MAPPERS.length,
}
