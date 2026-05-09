---
name: llm-as-dependency
description: Use ao escrever código que depende de LLM (OpenAI/Anthropic) — adapter pattern + FakeLLMProvider para testes determinísticos sem custo. Modernização 2026 sem precedente em 2004.
---

# LLM as Dependency (Modernização)

## Quando usar

LLM carrega esta skill quando user vai escrever ou refatorar código que chama LLM provider em produção. Trigger phrases:

- "como testar essa função que chama OpenAI?"
- "fake do client Anthropic", "mock LLM"
- "tornar testável código com LLM"
- "deterministic test mode para LLM"
- "DI de OpenAI/Anthropic client"
- "edge function usa LLM, como caracterizar?"
- "function calling em testes"

## Regras absolutas

- **LLM é DEPENDÊNCIA EXTERNA igual a DB ou HTTP API.** Mesmas regras: nunca acoplar handler ao SDK específico; sempre via interface; sempre com fake disponível.
- **Adapter pattern (do skill `legacy-api-only-applications`) é a aplicação correta.** Interface mínima `LLMProvider`; adapter por vendor; fake por testes.
- **Testes de BUSINESS LOGIC nunca chamam LLM real.** FakeLLMProvider canned responses. LLM real é exclusivamente em characterization tests de PROMPT (skill `ai-prompt-characterization`).
- **Determinismo via fake.** FakeLLMProvider retorna outputs fixos em ordem. Não há non-determinism em test de business logic.
- **Token tracking é cross-cutting concern do adapter.** Handler não precisa saber tokens. Adapter loga + opcionalmente reporta para observability.
- **Tradução de erros: vendor → domain.** Rate limit do OpenAI ≠ Rate limit do Anthropic ≠ Rate limit do Claude API. Adapter traduz para enum próprio (`LLMError = 'rate_limit' | 'timeout' | 'context_too_long' | 'content_filter' | 'auth' | 'unknown'`).
- **Fake suporta múltiplos modos:** (a) canned responses, (b) function-based responses (`(input) => output`), (c) error injection (`shouldFail: 'rate_limit'`).

## Patterns canônicos

### Pattern 1: Interface canônica `LLMProvider`

```ts
// Interface mínima — handler não vê SDK específico
interface LLMProvider {
  generate(input: GenerateInput): Promise<GenerateResult>
  embed?(input: EmbedInput): Promise<EmbedResult>  // opcional, só para providers que suportam
}

interface GenerateInput {
  prompt: string                     // ou messages, dependendo do provider
  systemPrompt?: string
  maxTokens: number
  temperature?: number
  seed?: number                      // determinismo
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'tool'; name: string }
}

interface GenerateResult {
  text: string
  finishReason: 'stop' | 'length' | 'tool_use' | 'content_filter'
  toolUses: Array<{ name: string; input: any }>
  inputTokens: number
  outputTokens: number
  modelVersion: string
}

interface EmbedInput {
  texts: string[]
  model?: string  // canônico: 'text-embedding-3-small' default; provider mapeia
}

interface EmbedResult {
  embeddings: number[][]  // 1 vector por input
  inputTokens: number
}

// LLM error canônico (anti-corruption layer)
type LLMError = 'rate_limit' | 'timeout' | 'context_too_long' | 'content_filter' | 'auth' | 'invalid_request' | 'server_error' | 'unknown'
class LLMException extends Error {
  constructor(public code: LLMError, message: string, public retryable: boolean) {
    super(message)
  }
}
```

### Pattern 2: Adapters por vendor

```ts
class OpenAIAdapter implements LLMProvider {
  constructor(private client: OpenAI) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    try {
      const r = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
          { role: 'user' as const, content: input.prompt },
        ],
        max_tokens: input.maxTokens,
        temperature: input.temperature ?? 0,
        seed: input.seed,
        tools: input.tools?.map(t => ({ type: 'function' as const, function: t })),
      })
      return this.toDomain(r)
    } catch (e: any) {
      throw this.translateError(e)
    }
  }

  private toDomain(r: any): GenerateResult { /* ... */ }
  private translateError(e: any): LLMException {
    if (e.status === 429) return new LLMException('rate_limit', e.message, true)
    if (e.status === 401) return new LLMException('auth', e.message, false)
    if (e.code === 'context_length_exceeded') return new LLMException('context_too_long', e.message, false)
    if (e.code === 'content_filter') return new LLMException('content_filter', e.message, false)
    return new LLMException('unknown', e.message, false)
  }
}

class AnthropicAdapter implements LLMProvider {
  constructor(private client: Anthropic) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    try {
      const r = await this.client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: input.maxTokens,
        temperature: input.temperature ?? 0,
        system: input.systemPrompt,
        messages: [{ role: 'user' as const, content: input.prompt }],
        tools: input.tools,
      })
      return this.toDomain(r)
    } catch (e: any) {
      throw this.translateError(e)
    }
  }

  private toDomain(r: any): GenerateResult { /* ... */ }
  private translateError(e: any): LLMException {
    if (e.status === 429) return new LLMException('rate_limit', e.message, true)
    if (e.status === 401) return new LLMException('auth', e.message, false)
    return new LLMException('unknown', e.message, false)
  }
}
```

### Pattern 3: FakeLLMProvider canônico para testes

```ts
class FakeLLMProvider implements LLMProvider {
  private responses: GenerateResult[] = []
  private index = 0
  private errorMode: LLMError | null = null
  private callLog: GenerateInput[] = []

  // Configuração
  setResponses(r: Array<Partial<GenerateResult>>): void {
    this.responses = r.map(p => ({
      text: p.text ?? '',
      finishReason: p.finishReason ?? 'stop',
      toolUses: p.toolUses ?? [],
      inputTokens: p.inputTokens ?? 100,
      outputTokens: p.outputTokens ?? 50,
      modelVersion: p.modelVersion ?? 'fake-model-1',
    }))
    this.index = 0
  }

  failNextWith(code: LLMError): void {
    this.errorMode = code
  }

  // Inspeção (assertions)
  callsLog(): GenerateInput[] { return [...this.callLog] }
  callCount(): number { return this.callLog.length }

  // LLMProvider interface
  async generate(input: GenerateInput): Promise<GenerateResult> {
    this.callLog.push(input)

    if (this.errorMode) {
      const code = this.errorMode
      this.errorMode = null
      throw new LLMException(code, `fake error: ${code}`, code === 'rate_limit' || code === 'timeout')
    }

    if (this.index < this.responses.length) {
      return this.responses[this.index++]
    }
    return {
      text: 'fake default response',
      finishReason: 'stop',
      toolUses: [],
      inputTokens: input.prompt.length / 4,  // rough estimate
      outputTokens: 50,
      modelVersion: 'fake-model-1',
    }
  }
}

// Uso em test
test('processOrder summary — handles LLM rate limit gracefully', async () => {
  const llm = new FakeLLMProvider()
  llm.failNextWith('rate_limit')  // primeiro call falha
  llm.setResponses([{ text: 'Successful summary' }])  // depois funciona

  const handler = new OrderSummarizer(llm)
  const result = await handler.summarizeOrder({ id: 'O-1', items: [...] })

  expect(result.summary).toBe('Successful summary')
  expect(llm.callCount()).toBe(2)  // 1 falhou + 1 retry sucesso
})
```

### Pattern 4: Function-based fake (mais flexível)

```ts
// Para tests onde fake response depende do input
class FunctionalFakeLLM implements LLMProvider {
  constructor(
    private generateFn: (input: GenerateInput) => Promise<GenerateResult> | GenerateResult,
  ) {}
  async generate(input: GenerateInput): Promise<GenerateResult> {
    return this.generateFn(input)
  }
}

// Uso
test('summarizer — handles long input via chunking', async () => {
  const llm = new FunctionalFakeLLM(async (input) => {
    // Simular comportamento real: prompt > 8000 chars retorna context_too_long
    if (input.prompt.length > 8000) {
      throw new LLMException('context_too_long', 'too long', false)
    }
    return {
      text: `Summary of ${input.prompt.length} chars`,
      finishReason: 'stop',
      toolUses: [],
      inputTokens: input.prompt.length / 4,
      outputTokens: 30,
      modelVersion: 'fake',
    }
  })

  const handler = new OrderSummarizer(llm)
  const longOrder = generateLongOrder(15000)
  const result = await handler.summarizeOrder(longOrder)
  expect(result.chunks).toBe(2)  // verificou que chunking foi acionado
})
```

### Pattern 5: Adapter para Edge Function (Supabase + Deno)

```ts
// supabase/functions/_shared/llm.ts
import { Anthropic } from 'npm:@anthropic-ai/sdk@0.30.0'

export interface LLMProvider {
  generate(input: GenerateInput): Promise<GenerateResult>
}

export class AnthropicAdapter implements LLMProvider {
  constructor(private client: Anthropic) {}
  async generate(input: GenerateInput): Promise<GenerateResult> { /* ... */ }
}

export function createLLMProvider(): LLMProvider {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')
  return new AnthropicAdapter(new Anthropic({ apiKey }))
}

// supabase/functions/summarize-order/index.ts
import { createLLMProvider } from '../_shared/llm.ts'

const llm = createLLMProvider()

Deno.serve(async (req) => {
  return await handleRequest(req, llm)
})

export async function handleRequest(req: Request, llm: LLMProvider): Promise<Response> {
  const order = await req.json()
  const summary = await llm.generate({
    prompt: `Resuma este pedido: ${JSON.stringify(order)}`,
    maxTokens: 200,
  })
  return new Response(JSON.stringify({ summary: summary.text }))
}

// tests/handle-request.test.ts
import { handleRequest } from '../supabase/functions/summarize-order/index.ts'
import { FakeLLMProvider } from './fakes.ts'

test('summarize-order — typical request', async () => {
  const llm = new FakeLLMProvider()
  llm.setResponses([{ text: 'Pedido de R$ 50, 2 items.' }])

  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ id: 'O-1', total: 5000, items: ['SKU-1', 'SKU-2'] }),
  })
  const res = await handleRequest(req, llm)
  const body = await res.json()
  expect(body.summary).toBe('Pedido de R$ 50, 2 items.')
})
```

### Pattern 6: Cross-cutting concerns no adapter

Adapter é o lugar canônico para retry, timeout, observability:

```ts
class ResilientLLMAdapter implements LLMProvider {
  constructor(
    private inner: LLMProvider,
    private logger: Logger,
    private metrics: Metrics,
  ) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const startMs = performance.now()
    try {
      const result = await retryWithJitter(
        () => this.inner.generate(input),
        { maxRetries: 3, baseMs: 500, retryOn: (e) => e instanceof LLMException && e.retryable }
      )

      const latency = performance.now() - startMs
      this.metrics.histogram('llm.generate.latency_ms', latency, { result: 'success' })
      this.metrics.counter('llm.generate.tokens', result.inputTokens + result.outputTokens)
      this.logger.info('llm.generate.ok', { latency_ms: latency, model: result.modelVersion })
      return result
    } catch (e) {
      const latency = performance.now() - startMs
      this.metrics.histogram('llm.generate.latency_ms', latency, { result: 'error' })
      this.metrics.counter('llm.errors', 1, { error_type: (e as LLMException).code })
      this.logger.warn('llm.generate.failed', { error: (e as Error).message })
      throw e
    }
  }
}

// Composição em produção
const llm = new ResilientLLMAdapter(
  new AnthropicAdapter(new Anthropic({ apiKey })),
  logger,
  metrics,
)
```

## Anti-patterns

### ANTI: handler chama OpenAI direto

```text
ANTI: handler.ts: import OpenAI from 'openai'; const client = new OpenAI(...);
      ... await client.chat.completions.create(...)

PROBLEMA: handler intestável sem mock global. Trocar Anthropic =
          rewrite. Tests rodam contra API real (lento + custo +
          flaky).

CERTO: handler depende de LLMProvider. Adapter encapsula. Tests
       usam FakeLLMProvider.
```

### ANTI: tests rodam contra LLM real

```text
ANTI: tests de business logic chamam OpenAI/Anthropic real.

PROBLEMA: testes lentos (5s por call), custosos ($X por suite),
          flaky (rate limits, network), não-determinísticos
          (mesma input pode gerar texto diferente entre runs).

CERTO: business logic tests usam FakeLLMProvider. LLM REAL apenas
       em tests específicos de characterization de PROMPT (skill
       `ai-prompt-characterization`). 99% dos tests = fakes.
```

### ANTI: fake retorna sempre mesma resposta

```text
ANTI: FakeLLM hardcoded retorna `text: "fake response"` sempre.

PROBLEMA: tests não conseguem simular caminhos múltiplos
          (sucesso/falha/edge case). Cobertura baixa.

CERTO: FakeLLM com setResponses() OR FunctionalFakeLLM. Cada teste
       configura comportamento esperado para aquele caso.
```

### ANTI: adapter expõe tipos do vendor

```text
ANTI: interface LLMProvider { generate(input): Promise<OpenAI.Chat.Completion> }

PROBLEMA: OpenAI.Chat.Completion atravessa camadas internas.
          Mudança no SDK do OpenAI cascateia.

CERTO: GenerateResult é tipo PRÓPRIO do domínio. Adapter traduz
       OpenAI.Chat.Completion → GenerateResult. Anti-corruption
       layer.
```

### ANTI: tratar rate_limit como `any error`

```text
ANTI: catch (e) { if (e.status === 429) retry; else throw }

PROBLEMA: lógica de erro acoplada à HTTP status do vendor. Outro
          provider tem outros códigos. Lógica duplicada.

CERTO: adapter traduz error para LLMException com código domain.
       Handler trata LLMException.code, não status HTTP.
```

## Verificação

1. Handler depende de `LLMProvider` interface
2. Adapter por vendor encapsula SDK
3. FakeLLMProvider existe e tests usam
4. Erros traduzidos para `LLMException` com código domain
5. ResilientLLMAdapter (com retry + observability) usado em produção
6. Tests de business logic NUNCA chamam LLM real (CI custa $0)
7. Trocar provider = trocar 1 linha (constructor)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (adapter, anti-corruption)
- [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) — pattern canônico (LLM provider é caso especial)
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — extract-interface é técnica do cap 25
- [`ai-prompt-characterization`](../ai-prompt-characterization/SKILL.md) — characterization de PROMPT (LLM real); essa skill é para tudo MAIS LLM (LLM fake)
- [`supabase-edge-fn-writer`](../../agents/supabase-edge-fn-writer.md) (v1.8) — patch v1.12: detecta uso de LLM e oferece DI pattern
- [`four-golden-signals`](../four-golden-signals/SKILL.md) (v1.10) — adapter é onde golden signals são instrumentados
- [`retry-strategies`](../retry-strategies/SKILL.md) (v1.11) — retry com jitter aplicado em ResilientLLMAdapter

*Material-fonte (modernização 2026):* Sem precedente em livro Feathers 2004 — LLMs como dependência de produção é literatura recente (2023+).
