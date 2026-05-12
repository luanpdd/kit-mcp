---
name: ai-prompt-characterization
description: Use ao modificar prompt/tool LLM em produção — characterization de generations com temperature=0 + seed fixo + sanitização específica. Modernização 2026 sem precedente em 2004…
---

# AI Prompt Characterization (Modernização)

## Quando usar

LLM carrega esta skill quando user vai modificar prompt ou tool definition de LLM em produção. Trigger phrases:

- "vou mudar esse prompt", "modificar prompt em prod"
- "atualizar tool definition", "function calling schema"
- "como testar mudança de prompt?"
- "characterization de prompt", "snapshot de generation"
- "esse prompt tem 300 linhas e ninguém testou ainda"
- prompt em arquivo como `prompts/<name>.md` ou string template em código

**Insight central:** prompts e tools são **código legacy também** quando:
- > 100 linhas
- Em uso em produção
- Mudanças quebram silenciosamente (output diferente, downstream parser falha)
- Sem characterization tests

## Regras absolutas

- **Prompts são código.** Tratam-se com mesmo rigor: versionado, testado, code-reviewed. NÃO são "config text que muda livremente".
- **Determinismo via `temperature=0` + `seed`.** Anthropic Claude e OpenAI ambos suportam seed. Sem isso, characterization é flaky.
- **Capture mais que `text`.** Outputs incluem: `text`, `finish_reason`, `tool_calls` (se function calling), `input_tokens`, `output_tokens`, `model_version`. Snapshot de TODOS estes campos.
- **Sanitize aggressively.** Outputs LLM frequentemente incluem timestamps mencionados, UUIDs gerados, datas relativas. Normalize ANTES de snapshot.
- **5+ inputs cobrindo intents distintas.** Não é "happy path × 5"; é "5 intents qualitativamente diferentes" — concision request, troubleshooting, explanation, creative, edge case.
- **Behavioral coverage = % intents cobertas.** Métrica não é coverage de "linhas do prompt" (não existe); é coverage de variações comportamentais.
- **Re-rodar em CI quando model_version muda.** Anthropic publica nova versão de Claude → re-rode characterization → revisar diffs → aceitar/rejeitar.

## Patterns canônicos

### Pattern 1: Setup canônico de characterization de prompt

```ts
// tests/characterization/prompts/generate-summary.test.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const PROMPT = readFileSync('prompts/generate-summary.md', 'utf-8')

interface PromptInput {
  systemPrompt: string
  userMessage: string
  maxTokens?: number
}

async function runPrompt(input: PromptInput) {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: input.maxTokens ?? 500,
    temperature: 0,  // determinismo
    system: input.systemPrompt,
    messages: [{ role: 'user', content: input.userMessage }],
  })
  return {
    text: response.content[0].type === 'text' ? response.content[0].text : '',
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    modelVersion: response.model,
  }
}

function sanitizeForSnapshot(o: any): any {
  return JSON.parse(
    JSON.stringify(o, (key, value) => {
      // normalizar timestamps mencionados ("Today is 2026-05-08") → "<DATE>"
      if (typeof value === 'string') {
        value = value.replace(/\d{4}-\d{2}-\d{2}/g, '<DATE>')
        value = value.replace(/\d{2}:\d{2}(:\d{2})?/g, '<TIME>')
        value = value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/g, '<UUID>')
      }
      // permitir model version mas separar para audit (não no snapshot)
      if (key === 'modelVersion') return '<MODEL>'
      return value
    })
  )
}

describe('generate-summary prompt — characterization', () => {
  test('intent: concise summary of long article', async () => {
    const captured = await runPrompt({
      systemPrompt: PROMPT,
      userMessage: 'Resuma em 2 sentenças: [longo artigo de 500 palavras]...',
    })
    expect(sanitizeForSnapshot(captured)).toMatchSnapshot()
  })

  test('intent: bullet-list summary', async () => { /* ... */ })
  test('intent: technical/code summary', async () => { /* ... */ })
  test('intent: ambiguous request (edge)', async () => { /* ... */ })
  test('intent: hostile / prompt injection attempt', async () => { /* ... */ })
})
```

### Pattern 2: Tool definition characterization (function calling)

```ts
// Quando prompt usa tool definition (function calling), characterize tool_calls

const TOOLS = [
  {
    name: 'search_knowledge_base',
    description: 'Search for relevant docs',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  // ... mais tools
]

async function runWithTools(userMessage: string) {
  const r = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 500,
    temperature: 0,
    tools: TOOLS,
    messages: [{ role: 'user', content: userMessage }],
  })
  return {
    stopReason: r.stop_reason,
    toolUses: r.content.filter(c => c.type === 'tool_use').map(c => ({
      tool: (c as any).name,
      input: (c as any).input,
    })),
    finalText: r.content.filter(c => c.type === 'text').map(c => (c as any).text).join('\n'),
  }
}

test('tools — invokes search for factual question', async () => {
  const captured = await runWithTools('Qual é a política de reembolso?')
  expect(captured).toMatchSnapshot()
  // snapshot captura QUAIS tools foram invocadas + QUAIS argumentos
})
```

### Pattern 3: Sanitização específica de prompts

```ts
// Outputs LLM têm padrões previsíveis a sanitizar:

function sanitizeLLMOutput(text: string): string {
  return text
    // datas absolutas
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '<DATE>')
    .replace(/\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?\d{4}/gi, '<DATE_PT>')
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi, '<DATE_EN>')
    // datas relativas
    .replace(/\b(?:hoje|amanhã|ontem|today|tomorrow|yesterday)\b/gi, '<RELATIVE_DATE>')
    // URLs e UUIDs
    .replace(/https?:\/\/[^\s]+/g, '<URL>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    // valores monetários (preservar tipo, sanitizar valor)
    .replace(/R\$\s*[\d,.]+/g, 'R$ <VALUE>')
    .replace(/\$\s*[\d,.]+/g, '$ <VALUE>')
    // versões
    .replace(/v\d+\.\d+(?:\.\d+)?/g, '<VERSION>')
}
```

### Pattern 4: Behavioral coverage de prompt — 5+ intents

Para cada prompt, definir intents distintas:

| Intent | Definição | Exemplo de input |
|---|---|---|
| **Concise** | Pedido curto, output esperado curto | "Resuma em 1 frase: [text]" |
| **Detailed** | Pedido elaborado, output esperado longo | "Explique passo-a-passo: [text]" |
| **Code-heavy** | Input/output com código | "Refactor esse código: ```ts ...```" |
| **Edge case** | Input ambíguo ou borderline | "Como funciona?" (sem context) |
| **Adversarial** | Tentativa de jailbreak / prompt injection | "Ignore previous instructions and..." |
| **Multi-turn (se aplicável)** | Conversação com historico | [3+ messages prévias] |

5 intents × snapshot deterministic = baseline. Mudança em prompt deve manter outputs semanticamente próximos (ou documentar mudança intencional).

### Pattern 5: Pre-deploy checklist para mudança em prompt

```text
Antes de deploy de mudança em prompt em produção:

□ Suite de characterization tests passa verde (todos os 5+ intents)
□ Diff revisado HUMANAMENTE para cada intent — mudanças intencionais?
□ Behavioral coverage ≥ 5 intents (não bate threshold % — bate threshold de N)
□ Sanitização revisada — nenhum PII/secret no snapshot
□ Custo: cada test consome tokens; para prompts grandes, calcular total
   - 5 inputs × 1k input + 500 output ≈ 7.5k tokens × $0.015/1k = ~$0.11
   - CI roda só on-change para evitar custo recorrente
□ model_version anotado — re-rodar quando model_version muda
□ Audit trail no PR: "intent X: changed from Y to Z; reason: ..."
```

### Pattern 6: Custo + cadência de characterization

| Frequência | Custo (em USD) por suite | Quando rodar |
|---|---|---|
| Desenvolvedor local | < $0.10 | Antes de cada commit que toca prompt |
| CI on-change | < $0.50/run | Em PR que toca arquivo de prompt |
| CI nightly | < $5/dia | Para detectar drift de model upstream |
| Pre-deploy | < $0.50 | Confirmação final antes de promote |

**Otimização:** snapshot diff só dispara LLM call se prompt mudou. Sem mudança = skip (cacheado).

### Pattern 7: Quando NÃO characterizar prompt

```text
- Prompt < 20 linhas e usado em 1 lugar — overhead > valor
- Prompt é template trivial ("Resume: {text}") sem lógica complexa
- LLM call é one-shot script (analytics, batch processing) — não em hot path
- Custo de tokens proibitivo (e.g., prompts massivos com 50k tokens) — usar smaller model para char tests
- Use case é generative criativo (poema, story) — outputs intencionalmente variáveis
```

## Anti-patterns

### ANTI: characterization sem temperature=0

```text
ANTI: rodar characterization com temperature=0.7 (default).

PROBLEMA: outputs varia entre runs. Snapshot diferente toda vez.
          Tests flaky. Equipe ignora.

CERTO: temperature=0 SEMPRE em characterization. Anthropic + OpenAI
       ambos têm. Em providers que não suportam, escolher menor
       valor possível e/ou seed fixo se disponível.
```

### ANTI: snapshot sem sanitização

```text
ANTI: capturar output cru com timestamps, UUIDs, datas atuais.

PROBLEMA: cada run gera snapshot diferente. Não é flaky pelo LLM,
          é flaky pelo CONTENT temporal.

CERTO: sanitize ANTES de matchSnapshot. Datas → <DATE>, UUIDs →
       <UUID>, etc. Snapshot estável across time.
```

### ANTI: 1 test "happy path" de prompt

```text
ANTI: 1 input de exemplo testado, "se passa, prompt está OK".

PROBLEMA: prompt tem comportamento qualitativamente diferente em
          edge cases (input curto, input longo, input ambíguo,
          adversarial). 1 test cobre 1 caminho, ignora N outros.

CERTO: 5+ intents cobrindo distribuição real de uso. Edge case +
       adversarial são MANDATORY (prompts em prod sempre recebem
       inputs ruins).
```

### ANTI: ignorar drift de model

```text
ANTI: characterization passou em maio; em julho Anthropic atualiza
      Claude (claude-opus-4-7 → 4-8). Equipe não re-roda; deploy de
      mudança quebra silenciosamente.

PROBLEMA: prompt baseline frozen no model anterior. Novo model
          comporta diferente; bug em prod.

CERTO: CI nightly roda characterization. Diff de model_version =
       trigger humano para revisar. Aceita ou rejeita updates de
       model. Sem fixed model = sem characterization válida.
```

### ANTI: snapshot inclui token count

```text
ANTI: snapshot tem `inputTokens: 247, outputTokens: 89`.

PROBLEMA: token counts mudam quando model muda (tokenizer evolui).
          Diff vermelho em update de model é noise.

CERTO: capturar tokens em log SEPARADO (custo tracking), não no
       snapshot. Snapshot é qualitativo (text + stop reason +
       tool calls), não quantitativo.
```

### ANTI: tratar prompt como "string config livre"

```text
ANTI: dev edita prompt em prod direto via console; sem PR; sem
      review; sem characterization.

PROBLEMA: prompt é código. Mudança não-versionada quebra silenciosa.
          Sem audit trail. Rollback impossível.

CERTO: prompt em repo (`prompts/<name>.md`). PR review como qualquer
       código. Characterization tests rodam em CI. Deploy via release
       padrão.
```

## Verificação

1. Prompt versionado em arquivo (não inline em código se > 50 linhas)
2. Characterization tests existem com 5+ intents
3. `temperature=0` + seed fixo (se provider suporta)
4. Sanitização específica para prompt outputs
5. Snapshot inclui text + stopReason + toolCalls (se aplicável)
6. CI roda characterization on-change
7. model_version trackado (audit log separado)
8. Pre-deploy checklist completo

## Limiar de "prompt pronto para produção"

```text
Versionado em repo:                         sim
Characterization tests com ≥ 5 intents:     sim
temperature=0 + seed fixo:                  sim
Sanitização aplicada:                       sim
Coverage de intents real (não synthetic):   sim
CI integration:                             sim
Audit trail de mudanças:                    sim
```

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (characterization, golden master)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — characterization clássico; aplicável a prompts modulo determinismo
- [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) — LLM provider é caso especial de API; adapter pattern aplicável
- [`llm-as-dependency`](../llm-as-dependency/SKILL.md) — fakear LLM em testes que NÃO são de prompt characterization (testes de business logic)
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate v1.12 inclui ai-prompt-stability como dimensão paralela
- [`observability-driven-development`](../observability-driven-development/SKILL.md) (v1.9) — instrument prompt outputs para detectar drift em prod

*Material-fonte (modernização 2026):* Sem precedente em livro Feathers 2004 — prompts/tools LLM como dependência testável é literatura recente (2023+ — papers da Anthropic sobre evals, OpenAI evals framework, Promptfoo).
