---
name: dynamic-workflow-authoring
cost_tier: pesado
description: Gera e valida `.workflow.js` para Dynamic Workflows — 6 patterns (Classify-Act, Fanout-Synthesize, Adversarial-Verify, Generate-Filter, Tournament, Loop-Done), anti-patterns fatais e regras de API.
---

# Dynamic Workflow Authoring

**Fonte canônica:** [A harness for every task — Anthropic blog](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code).

Esta skill existe para que workflows gerados pelo kit sigam um vocabulário comum e não reinventem padrões. Consulte-a SEMPRE antes de materializar um `.workflow.js`.

## FATAL anti-patterns observados em produção (LEIA PRIMEIRO)

Estes 3 erros foram detectados em workflows gerados que falharam ao executar. Memorize antes de tocar em qualquer `.workflow.js`:

### ❌ NUNCA `import` no topo

```js
// ✗ QUEBRA — não existe esse módulo
import { agent, pipeline, parallel } from 'kit-mcp/workflow'
import * as Workflow from '@anthropic/workflows'
```

```js
// ✓ CORRETO — sem imports. agent/pipeline/parallel/phase/log/args/budget/workflow
// são INJETADOS COMO GLOBAIS pelo harness. Começe direto com export const meta.
export const meta = { /* ... */ }
phase('Discover')
const r = await agent('...', { schema: SCHEMA })
```

### ❌ NUNCA `export default` no body

```js
// ✗ QUEBRA — o harness wrappeia o body ele mesmo
export default async function run() {
  phase('Discover')
  // ...
}

// ✗ QUEBRA — variantes
export default async () => { /* ... */ }
module.exports = async function () { /* ... */ }
```

```js
// ✓ CORRETO — body roda direto em async context após o meta
export const meta = { /* ... */ }

phase('Discover')              // top-level
const r = await agent(/*...*/) // top-level await é OK
return { ok: true }            // top-level return é OK
```

### ❌ NUNCA `agent({...})` com objeto na posição 1

```js
// ✗ QUEBRA — essa é a API do Task(subagent_type=...), NÃO do agent() do Workflow
const r = await agent({
  name: 'auditor',
  description: 'audita X',
  tools: ['Read', 'Bash'],
  systemPrompt: 'Você é um auditor...',
  schema: SCHEMA,
})
```

```js
// ✓ CORRETO — primeiro argumento é STRING (o prompt), segundo é opts
const r = await agent(
  'Você é um auditor. Avalie X e devolva o resultado.',
  { schema: SCHEMA, phase: 'Audit', label: 'audit:x' }
)

// Pra delegar para um agent canônico do kit, use opts.agentType:
const r = await agent(
  'Audite a Edge Function process-payments nos 4 golden signals.',
  { agentType: 'observability-coverage-auditor', schema: AUDIT_SCHEMA }
)
```

## Assinaturas EXATAS dos globais injetados

```ts
agent(prompt: string, opts?: {
  label?: string,
  phase?: string,
  schema?: object,                // JSON Schema com required: [...]
  model?: string,                 // raro — usa o da sessão por default
  isolation?: 'worktree',         // EXPENSIVE — só quando agents mutam arquivos paralelo
  agentType?: string,             // delega pra um agent do kit (subagent_type)
}): Promise<any>

pipeline(items: any[], stage1: (item) => Promise<any>, stage2?: (prev, item, i) => Promise<any>, ...): Promise<any[]>
parallel(thunks: Array<() => Promise<any>>): Promise<any[]>
phase(title: string): void
log(message: string): void
workflow(nameOrRef: string | { scriptPath: string }, args?: any): Promise<any>

args: any                         // o args passado em Workflow({args: ...})
budget: { total: number|null, spent(): number, remaining(): number }
```

## Outras regras banidas

```js
Date.now()           // ✗ banido — quebra resume cache
Math.random()        // ✗ banido — idem
new Date()           // ✗ banido sem argumento
new Date('2026-01-01') // ✓ OK
require(...)         // ✗ sem CommonJS no body
import ...           // ✗ sem ESM imports no body
fs / path / process  // ✗ sem Node APIs — leitura/escrita de arquivos é via agent() rodando Bash/Read/Write
```

## Os 6 patterns canônicos

A primeira decisão de design é qual pattern usar — ela determina a topologia do script. Todo workflow real ou é exatamente um destes ou uma composição limpa de dois.

### 1. Classify-And-Act
**Quando:** tipos diferentes de entrada precisam de tratamentos diferentes.
**Tasks:** ticket triage (severity → agent específico), content moderation (violation type → handler), routing de PRs por área de código.
**API:**
```js
phase('Classify')
const cls = await agent(`Classifique X em uma de: A, B, C.`, { schema: CLS_SCHEMA })
phase('Act')
const result = await agent(PROMPTS[cls.label], { schema: ACT_SCHEMA })
```
**Anti-pitfall:** classifier vagaroso anula o ganho — mantenha-o pequeno e schema-estruturado. Se o classifier precisa do contexto completo, considere se isn't really Fanout disfarçado.

### 2. Fanout-And-Synthesize
**Quando:** N itens similares onde isolation previne interferência cruzada.
**Tasks:** "renomeie User → Account em todos os arquivos", processar 80 currículos, auditar N Edge Functions, julgar N conversas.
**API:**
```js
phase('Fanout')
const results = await pipeline(
  items,
  item => agent(`Process ${item.id}`, { phase: 'Fanout', schema: ITEM_SCHEMA })
)
phase('Synthesize')
const summary = await agent(`Synthesize: ${JSON.stringify(results)}`, { schema: REPORT_SCHEMA })
```
**Default:** `pipeline()` sobre `parallel()` — barrier entre fanout e synthesize só se a síntese precisa de TODOS de uma vez.

### 3. Adversarial-Verification
**Quando:** qualidade crítica, custo de falso-positivo > custo de revisão extra.
**Tasks:** code review, fact-checking, audit de findings de segurança, qualquer "X é real ou ilusão?".
**API:**
```js
const finding = await agent(FIND_PROMPT, { phase: 'Find', schema: FINDING_SCHEMA })
const verdict = await agent(
  `Você é cético. Tente REFUTAR: ${JSON.stringify(finding)}.
   Default: refuted=true em caso de dúvida.`,
  { phase: 'Verify', schema: VERDICT_SCHEMA }
)
if (verdict.confirmed) commit(finding)
```
**Multi-voto:** quando o caso é cinza, spawne 3 verificadores independentes e exija majority:
```js
const votes = await parallel(Array.from({length: 3}, () => () =>
  agent(`Refute: ${claim}`, { schema: VERDICT_SCHEMA })))
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```
**Perspective-diverse:** se o achado pode falhar de mais de uma forma, dê lentes DIFERENTES a cada verificador (correctness/security/perf) — diversidade pega o que redundância não pega.

### 4. Generate-And-Filter
**Quando:** espaço de solução amplo, qualidade varia, descarte é barato.
**Tasks:** gerar nomes de CLI/produto, brainstormar abordagens de design, listar hipóteses de bug.
**API:**
```js
phase('Generate')
const candidates = (await parallel(Array.from({length: N}, (_, i) => () =>
  agent(GEN_PROMPT(i), { schema: GEN_SCHEMA })))).filter(Boolean)
phase('Filter')
const top = await agent(
  `Avalie e dê top ${K} pela rubrica: ${RUBRIC}. Candidatos: ${JSON.stringify(candidates)}`,
  { schema: TOP_SCHEMA }
)
```
**Varie o prompt do generator por índice** (i no exemplo acima) — gera diversidade. Se todos os generators têm exatamente o mesmo prompt, você paga N tokens pra obter ~1 resposta.

### 5. Tournament
**Quando:** ranking qualitativo, julgamento relativo > absoluto.
**Tasks:** ordenar 1000+ tickets por severidade, escolher melhor design entre N propostas, priorizar lista de bugs.
**API:**
```js
let bracket = candidates
while (bracket.length > 1) {
  bracket = await pipeline(
    chunk(bracket, 2),
    pair => agent(
      `Compare A e B pela métrica X. Devolva winner.`,
      { phase: `Round-${bracket.length}`, schema: COMPARE_SCHEMA }
    ).then(r => r.winner)
  )
}
return bracket[0]
```
**Anti-pitfall:** se a métrica é absoluta (score 0–10 estável), use Generate-And-Filter — Tournament é caro em wall-clock e tokens (log₂N rounds).

### 6. Loop-Until-Done
**Quando:** volume desconhecido, condição de parada > contador fixo.
**Tasks:** reproduzir flaky test até falhar, bug hunt até K rounds vazios, search com retry até confidence threshold.
**API (loop-until-dry):**
```js
const seen = new Set()
let dry = 0
while (dry < 2) {
  const fresh = (await agent(FIND_PROMPT, { schema: BUGS_SCHEMA })).bugs
    .filter(b => !seen.has(key(b)))
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach(b => seen.add(key(b)))
  // ... process fresh
}
```
**Loop-until-budget:** scale automático ao `+500k` do usuário:
```js
while (budget.total && budget.remaining() > 50_000) {
  const r = await agent(FIND_PROMPT, { schema: BUGS_SCHEMA })
  if (!r.bugs.length) break
  bugs.push(...r.bugs)
}
```
**Guard sempre** em `budget.total` — `remaining()` é `Infinity` sem target e o loop bate o cap de 1000 agents.

## Regras DURAS da API (violar = workflow quebra)

### O `meta` é literal puro
```js
// ✓ ok
export const meta = {
  name: 'audit-pr-staleness',
  description: 'List PRs open >7d without review and rank by impact.',
  phases: [{ title: 'Discover' }, { title: 'Rank' }],
}

// ✗ quebra
export const meta = {
  name: `audit-${type}-staleness`,   // template literal
  description: getDesc(),            // function call
  phases: [...DEFAULT_PHASES],       // spread
}
```

### Date.now / Math.random / argless `new Date()` são banidos
Quebrariam o resume cache. Passe timestamps via `args` e varie randomness pelo `index` do pipeline/parallel.

```js
// ✓ ok
const nowIso = args?.nowIso   // caller produz e passa
const label = `gen-${i}`      // i = índice do pipeline

// ✗ quebra
const ts = Date.now()
const id = Math.random().toString(36)
```

### Todo `agent()` com saída estruturada usa `schema`
Sem schema, o retorno é texto bruto e parsing fica frágil. Com schema (JSON Schema), o agent é forçado a chamar `StructuredOutput` e a validação acontece no tool-call layer (retry automático).

```js
const SCHEMA = {
  type: 'object', required: ['rank', 'reason'],
  properties: { rank: { type: 'number' }, reason: { type: 'string' } }
}
const r = await agent(PROMPT, { schema: SCHEMA })
// r.rank e r.reason garantidos do tipo
```

### `pipeline()` é o default; `parallel()` é exceção
Use `parallel()` SÓ quando o próximo stage precisa de TODOS os resultados anteriores ao mesmo tempo. Caso contrário, `pipeline()` deixa o item rápido avançar enquanto o lento ainda processa.

**Smell test:** se você escreveu `const a = await parallel(...); const b = transform(a); const c = await parallel(b.map(...))` — quase certo que deveria ser `pipeline(items, stage1, transform-inline, stage2)`.

### Concorrência tem cap real
`min(16, cores − 2)` por workflow. Em laptop de dev = ~14. Em CI/macOS pequeno = ~6. `parallel()`/`pipeline()` com 100 itens funciona — mas só ~10 rodam simultâneo.

### O budget é hard ceiling
`budget.total` é o `+500k` do usuário. Quando `spent()` bate o `total`, próximas `agent()` calls **throw**. Sempre cheque antes de loops dinâmicos.

### Composição via `workflow()` é 1 nível
`workflow('other-name', args)` pode chamar OUTRO workflow do registry. Mas o filho NÃO pode chamar outro `workflow()` — nesting > 1 throws. Use isto pra orquestrar fases grandes (Understand → Design → Implement → Review) cada uma como workflow separado.

## Reusar agents canônicos do kit

Workflows gerados não precisam reinventar. Use `opts.agentType` pra delegar a um agent específico do kit:

```js
const audit = await agent(
  `Audite Edge Function ${fn.name} pelos 4 golden signals.`,
  { agentType: 'observability-coverage-auditor', schema: AUDIT_SCHEMA }
)
```

Mapa rápido de quando reusar (consulte [`kit/agents/`](../../agents/) pra lista completa):

| Sua necessidade | Agent canônico |
|---|---|
| Cobertura observability por Edge Fn | `observability-coverage-auditor` |
| Isolamento cross-tenant (RLS) | `multi-tenant-isolation-auditor` |
| Compliance LGPD | `lgpd-compliance-auditor` |
| Hipóteses de bug em produção | `incident-investigator` |
| Validar migration antes de aplicar | `schema-checker` |
| Verificar refactor antes do código | `refactor-safety-auditor` |
| Pesquisar fase / projeto | `phase-researcher` / `project-researcher` |
| Designer de UI seguindo MARCA.md | `designer-ui` |

## Anti-pitfalls específicos

**1. Silent caps.** Se o workflow corta cobertura (top-N, no-retry, sampling), `log()` o que foi descartado. Truncar em silêncio lê como "cobri tudo" quando não cobriu.

**2. Synthesizer cego.** O último agent recebe `JSON.stringify(rows)` — se rows for 50MB de transcripts, ele estoura contexto. Pré-resuma cada item no stage anterior (campos só essenciais: id, score, top-3 evidence).

**3. Dedup vs `confirmed`.** Loop-until-dry deve dedupar contra TODOS os itens vistos (`seen`), NÃO só os confirmados. Senão findings judge-rejected reaparecem e o loop nunca converge.

**4. Schema sem `required`.** JSON Schema sem `required` deixa o agent retornar `{}` válido. Sempre liste `required: [...]`.

**5. Stage que mutate.** Stage 2 mutando o objeto vindo de stage 1 quebra resume cache. Crie objeto novo: `return { ...prev, extra: x }`.

## Ver também

- [`kit/workflows/auditar-observabilidade-cobertura.workflow.js`](../../workflows/auditar-observabilidade-cobertura.workflow.js) — exemplo canônico do pattern Fanout-And-Synthesize + Adversarial-Verification combinados
- [`workflow-generator`](../../agents/workflow-generator.md) — agent que consulta esta skill ao gerar `.workflow.js`
- [`criar-workflow`](../../commands/criar-workflow.md) — slash-command entrypoint do gerador
