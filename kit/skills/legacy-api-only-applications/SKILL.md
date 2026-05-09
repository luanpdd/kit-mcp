---
name: legacy-api-only-applications
description: Use ao escrever ou refatorar código que é maioritariamente wrapper de API externa (cap 15 Feathers + Supabase Edge Functions). Adapter / anti-corruption layer canônico — interface mínima testável + adapter para API real.
---

# Legacy — API-Only Applications

## Quando usar

LLM carrega esta skill quando user trabalha em código que é primariamente wrapper de API externa. Trigger phrases:

- "essa edge function só chama Stripe/OpenAI/Twilio"
- "como testar integração com [vendor]?"
- "anti-corruption layer", "adapter pattern"
- "API-only application", "cap 15 Feathers"
- "wrapper de API"
- arquivo em `supabase/functions/<name>/index.ts` com 60%+ de chamadas a SDKs/APIs externos

## Regras absolutas

- **Adapter pattern é a resposta canônica.** Code de produção depende de **interface mínima**, não da API completa do vendor. Adapter concreto envolve a API real.
- **Interface mínima = só o que VOCÊ usa.** SDKs do Stripe/OpenAI/etc têm 100+ métodos; você usa 5. Sua interface tem 5.
- **Anti-corruption layer (DDD) = adapter + tradução de tipos.** Tipos do vendor (e.g., `Stripe.Charge`, `OpenAI.ChatCompletion`) NÃO atravessam camadas internas. Adapter traduz vendor type → domain type.
- **Modernização Supabase Edge Functions:** Edge Function que wrappar Stripe/OpenAI é o caso paradigmático moderno do cap 15. Pattern canônico: handler depende de interface, adapter implementa, adapter testado isolado, fake adapter em testes.
- **Modernização LLM providers:** OpenAI/Anthropic clients são API externa. Aplicar exatamente o mesmo pattern — `LLMProvider` interface + `OpenAIAdapter` + `AnthropicAdapter` + `FakeLLMProvider`. Nunca acoplar handler ao SDK específico.
- **Versionar a interface, não a API do vendor.** Quando vendor muda assinatura, adapter absorve a mudança; consumidor (handler interno) não vê.
- **Idempotência via adapter.** Adapter pode adicionar idempotency key, retry com jitter, deadline propagation, sem que handler precise saber.

## Patterns canônicos

### Pattern 1: Adapter para vendor API (Stripe canônico)

```ts
// ANTES — handler acoplado ao SDK Stripe (intestável sem mock global)
import Stripe from 'stripe'

const stripe = new Stripe(Deno.env.get('STRIPE_KEY')!)

Deno.serve(async (req) => {
  const order = await req.json()
  const charge = await stripe.charges.create({  // ← acoplamento direto
    amount: order.totalCents,
    currency: order.currency,
    source: order.cardToken,
  })
  return new Response(JSON.stringify({ id: charge.id, status: charge.status }))
})

// DEPOIS — handler depende de interface mínima
interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>
}
type ChargeInput = { amountCents: number; currency: string; cardToken: string }
type ChargeResult = { id: string; status: 'succeeded' | 'failed' | 'pending' }

class StripeAdapter implements PaymentGateway {
  constructor(private stripe: Stripe) {}
  async charge(input: ChargeInput): Promise<ChargeResult> {
    const c = await this.stripe.charges.create({
      amount: input.amountCents,
      currency: input.currency,
      source: input.cardToken,
    })
    // anti-corruption: traduz Stripe.Charge.status para nosso domain enum
    const status = this.translateStatus(c.status)
    return { id: c.id, status }
  }
  private translateStatus(s: Stripe.Charge.Status): ChargeResult['status'] {
    if (s === 'succeeded') return 'succeeded'
    if (s === 'failed' || s === 'canceled') return 'failed'
    return 'pending'
  }
}

// Em produção
const gateway: PaymentGateway = new StripeAdapter(new Stripe(Deno.env.get('STRIPE_KEY')!))

// Handler — agora testável
async function handleCharge(req: Request, gateway: PaymentGateway) {
  const order = await req.json()
  const result = await gateway.charge({
    amountCents: order.totalCents,
    currency: order.currency,
    cardToken: order.cardToken,
  })
  return new Response(JSON.stringify(result))
}

Deno.serve(req => handleCharge(req, gateway))

// Em teste
class FakePaymentGateway implements PaymentGateway {
  charged: ChargeInput[] = []
  result: ChargeResult = { id: 'ch_fake', status: 'succeeded' }
  async charge(input: ChargeInput): Promise<ChargeResult> {
    this.charged.push(input)
    return this.result
  }
}

test('handleCharge — typical input', async () => {
  const gw = new FakePaymentGateway()
  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ totalCents: 5000, currency: 'BRL', cardToken: 'tok_x' }),
  })
  await handleCharge(req, gw)
  expect(gw.charged).toHaveLength(1)
  expect(gw.charged[0].amountCents).toBe(5000)
})
```

### Pattern 2: Adapter para LLM provider (modernização total — sem precedente em 2004)

```ts
// LLM provider como dependência testável (canônico em 2026)
interface LLMProvider {
  generate(input: GenerateInput): Promise<GenerateResult>
}
type GenerateInput = {
  prompt: string
  maxTokens: number
  temperature?: number
  seed?: number  // determinismo em testes
}
type GenerateResult = {
  text: string
  finishReason: 'stop' | 'length' | 'content_filter'
  inputTokens: number
  outputTokens: number
}

class OpenAIAdapter implements LLMProvider {
  constructor(private client: OpenAI) {}
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const r = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: input.prompt }],
      max_tokens: input.maxTokens,
      temperature: input.temperature ?? 0,
      seed: input.seed,
    })
    return {
      text: r.choices[0].message.content ?? '',
      finishReason: this.translateFinish(r.choices[0].finish_reason),
      inputTokens: r.usage?.prompt_tokens ?? 0,
      outputTokens: r.usage?.completion_tokens ?? 0,
    }
  }
  private translateFinish(f: string): GenerateResult['finishReason'] {
    if (f === 'stop') return 'stop'
    if (f === 'length') return 'length'
    return 'content_filter'
  }
}

class AnthropicAdapter implements LLMProvider {
  constructor(private client: Anthropic) {}
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const r = await this.client.messages.create({
      model: 'claude-opus-4-7',
      messages: [{ role: 'user', content: input.prompt }],
      max_tokens: input.maxTokens,
      temperature: input.temperature ?? 0,
    })
    return {
      text: r.content[0].type === 'text' ? r.content[0].text : '',
      finishReason: this.translateStop(r.stop_reason),
      inputTokens: r.usage.input_tokens,
      outputTokens: r.usage.output_tokens,
    }
  }
  private translateStop(s: string | null): GenerateResult['finishReason'] {
    if (s === 'end_turn') return 'stop'
    if (s === 'max_tokens') return 'length'
    return 'content_filter'
  }
}

class FakeLLMProvider implements LLMProvider {
  responses: GenerateResult[] = []
  callIndex = 0
  async generate(_: GenerateInput): Promise<GenerateResult> {
    if (this.callIndex < this.responses.length) return this.responses[this.callIndex++]
    return { text: 'fake response', finishReason: 'stop', inputTokens: 10, outputTokens: 5 }
  }
}
```

**Insight:** sem essa abstração, edge function fica acoplada a 1 vendor. Trocar OpenAI → Anthropic = rewrite. Com adapter = trocar 1 linha (`new AnthropicAdapter(...)` em vez de `new OpenAIAdapter(...)`).

### Pattern 3: Anti-corruption layer (DDD)

```ts
// VENDOR types — bagunça típica (Stripe, OpenAI, Twilio têm shapes próprios)
type StripeChargeRaw = {
  id: string
  amount: number  // cents
  currency: string  // lowercase ISO
  status: 'succeeded' | 'pending' | 'failed' | 'canceled'
  receipt_url?: string  // snake_case do vendor
  metadata?: Record<string, string>
}

// DOMAIN types — sua linguagem
type Charge = {
  chargeId: string
  amountCents: number
  currencyIso4217: string  // uppercase
  status: ChargeStatus  // domain enum, NÃO o do vendor
  receiptUrl?: string
}
type ChargeStatus = 'succeeded' | 'failed' | 'pending'  // simplificou; canceled vira failed

// Adapter ABSORVE diferenças — domain interno NÃO vê StripeChargeRaw
class StripeAdapter implements PaymentGateway {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    const raw = await this.stripe.charges.create(...)
    return this.toDomain(raw)
  }
  private toDomain(raw: StripeChargeRaw): Charge {
    return {
      chargeId: raw.id,
      amountCents: raw.amount,
      currencyIso4217: raw.currency.toUpperCase(),
      status: raw.status === 'canceled' || raw.status === 'failed' ? 'failed' : raw.status,
      receiptUrl: raw.receipt_url,
    }
  }
}
```

### Pattern 4: Adapter aplicando cross-cutting concerns

Adapter é lugar canônico para retry, timeout, idempotency, instrumentation:

```ts
class StripeAdapterResilient implements PaymentGateway {
  constructor(private stripe: Stripe, private logger: Logger) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const idempotencyKey = await crypto.randomUUID()
    const startMs = performance.now()

    try {
      const c = await retryWithJitter(
        () => this.stripe.charges.create(
          { amount: input.amountCents, currency: input.currency, source: input.cardToken },
          { idempotencyKey, timeout: 5000 }
        ),
        { maxRetries: 3, baseMs: 250 }
      )

      const latency = performance.now() - startMs
      this.logger.info('stripe.charge', { latency_ms: latency, status: c.status })
      return this.toDomain(c)
    } catch (e) {
      this.logger.warn('stripe.charge.failed', { error: e.message })
      throw e
    }
  }
}
```

**Cross-suite:**
- Retry pattern de v1.11 (`retry-strategies`) aplicável aqui
- Logging segue v1.9 (`structured-events`)
- Latency histogram segue v1.10 (`four-golden-signals`)
- Adapter é exatamente onde "instrumentation shift-left" (v1.9 ODD) faz mais sentido

### Pattern 5: Quando NÃO criar adapter

```text
- Vendor SDK já tem interface mínima e estável (raríssimo)
- Edge function é one-shot script (não tem testes nem manutenção continuada)
- Spike/POC para validar viabilidade (descartável após decisão)
- Adapter custaria > 4h e prazo é < 1 dia (faça inline com warning de débito)
```

## Anti-patterns

### ANTI: handler depende direto do SDK do vendor

```text
ANTI: handler.ts: import Stripe from 'stripe'; ... stripe.charges.create(...)

PROBLEMA: handler intestável sem mocking SDK inteiro. Trocar vendor
          = rewrite. Vendor SDK breaking change = bugs em handler.

CERTO: handler depende de interface mínima `PaymentGateway`. Adapter
       absorve SDK. Testes do handler usam fake. Trocar vendor =
       trocar 1 linha (constructor injection).
```

### ANTI: adapter expondo tipos do vendor

```text
ANTI: interface PaymentGateway { charge(input): Promise<Stripe.Charge> }

PROBLEMA: Stripe.Charge atravessa camadas internas. Quando Stripe
          renomeia field, refactor cascateia. Sem anti-corruption.

CERTO: interface tem TIPO próprio (ChargeResult). Adapter traduz.
       Stripe.Charge fica encapsulado dentro do adapter.
```

### ANTI: 1 adapter por método do vendor

```text
ANTI: StripeChargeAdapter, StripeRefundAdapter, StripePayoutAdapter,
      StripeCustomerAdapter — 1 classe por endpoint.

PROBLEMA: explosão. 30 adapters para 1 vendor. Cross-cutting (retry,
          logging) duplicado em cada um.

CERTO: 1 adapter por VENDOR + capability cluster. StripePaymentAdapter
       (charge + refund), StripeCustomerAdapter (create + update).
       Cross-cutting concerns aplicados consistente.
```

### ANTI: fake adapter testando o vendor real

```text
ANTI: FakeStripeAdapter faz HTTP real para Stripe sandbox em testes.

PROBLEMA: testes lentos, flaky, dependentes de rede, custam $.
          Sandbox vendor pode ter rate limits.

CERTO: FakeStripeAdapter implementa interface NÃO depende de Stripe.
       Coleta inputs em array; retorna outputs canned. Test puramente
       local. Fast, deterministic, free.
```

## Verificação

1. Handler depende de interface, não de SDK do vendor diretamente
2. Adapter implementa interface, encapsula SDK do vendor
3. Tipos do vendor não atravessam adapter (anti-corruption)
4. Fake adapter existe; tests do handler usam fake
5. Adapter centraliza retry/timeout/idempotency/logging (cross-cutting)
6. Tipos de DOMAIN são uppercase ISO/etc (não passam por convenção do vendor)
7. Trocar vendor = trocar 1 linha (constructor)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (adapter, anti-corruption layer)
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — extract-interface é técnica do cap 25 que produz adapter
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — characterize handler usando fake adapter (sem rede)
- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) (v1.8) — Edge Functions são API-only paradigmáticas; adapter pattern aplicável
- [`supabase-edge-fn-writer`](../../agents/supabase-edge-fn-writer.md) (v1.8) — patch v1.12: adapter pattern como template default
- [`four-golden-signals`](../four-golden-signals/SKILL.md) (v1.10) — adapter é lugar canônico de instrumentation
- [`retry-strategies`](../retry-strategies/SKILL.md) (v1.11 — quando entregar) — retry pattern aplicado dentro do adapter
- [`llm-as-dependency`](../llm-as-dependency/SKILL.md) — caso especial de API-only para LLM providers

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 15: "My Application Is All API Calls".*
*Modernização (2026):* Supabase Edge Functions + LLM providers (OpenAI/Anthropic) como aplicação canônica do pattern.
