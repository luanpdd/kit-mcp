---
name: observability-driven-development
cost_tier: leve
description: Bundeia telemetria OTel com a feature no mesmo PR — 4 perguntas pré-PR obrigatórias, shift-left + auto-page do autor 30-60min pós-merge. Use ao escrever nova feature.
---

# Observabilidade — Observability-Driven Development (ODD)

## Quando usar

LLM carrega esta skill ao escrever nova feature, planejar fase, ou code review. Trigger phrases:

- "ODD", "observability-driven development"
- "como sei que essa feature funciona em prod?"
- "instrumentar antes do PR"
- "shift-left observability"
- "auto-page do autor"
- "bundle telemetry com feature"

## As 4 perguntas pré-PR (canônicas)

Antes de submeter PR, todo autor responde EM CÓDIGO:

| # | Pergunta | Como instrumentar |
|---|----------|-------------------|
| **1** | **Faz o que esperei?** | `result.success` boolean por evento + atributos do happy path (`order.id`, `user.id`) |
| **2** | **Compara à versão anterior?** | `build_id` em todo evento — permite `WHERE build_id = X vs build_id = Y` |
| **3** | **Usuários estão usando?** | Atributo de identidade (`user.id`, `tenant_id`, `customer.tier`) e do path do request (`endpoint`, `feature_flag.<name>`) |
| **4** | **Anomalias emergem?** | `error.type` enumerado + `duration_ms` + capturar todos os branches de código (try/catch + early returns) |

**Sem isso, o PR não é mergeável.** Não é regra burocrática — é a diferença entre "funciona em testes" e "funciona em produção".

## Regras absolutas

- **Bundle telemetria com a feature** — instrumentação não é fase separada. Mesmo PR adiciona feature + spans + atributos.
- **Auto-page o autor por 30-60min após merge** — feedback loop curto. "Fui eu, eu sei o que era e eu posso reverter." NUNCA pular essa janela.
- **Decouple deploy de release** — feature flag por default. Deploy = código em prod desligado; release = liga aos poucos.
- **Test em prod com subset** — 1% de tráfego com flag ativada > 100% rollout em horário de baixa.
- **Rollback < rollforward em duvida** — observabilidade rica mostra o que está errado em segundos, mas só se você não rolou-back o evidência primeiro. Pause primeiro, investigue, então decida.
- **Toda code branch = atributo** — `if (x) { ... } else { ... }` precisa emitir atributo de qual branch foi tomada (`branch_taken: 'fast_path'` vs `'slow_path'`).
- **Tighten do feedback loop é o objetivo** — minutos do commit ao prod, não dias. Cada hora de delay multiplica custo de debug.

## Patterns canônicos

### Pattern: feature instrumentada nasce ODD-compliant

```ts
// PT-BR: feature nova "novo método de pagamento" — instrumentação BUNDLED
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('payments')

export async function processPaymentV2(req: PaymentRequest) {
  return tracer.startActiveSpan('process_payment_v2', async (span) => {
    // PT-BR: Pergunta 3 — quem está usando?
    span.setAttribute('user.id', req.user.id)
    span.setAttribute('customer.tier', req.user.tier)
    span.setAttribute('tenant_id', req.user.tenant)
    span.setAttribute('endpoint', '/api/v2/payments')

    // PT-BR: Pergunta 2 — qual versão?
    span.setAttribute('build_id', process.env.BUILD_ID ?? 'dev')
    span.setAttribute('feature_flag.payments_v2', true)  // PT-BR: assumed via flag
    span.setAttribute('payment.method', req.method)  // novo: 'pix' | 'crypto' | 'card'

    // PT-BR: Pergunta 4 — atributo por branch
    if (req.amount > 1_000_00) {
      span.setAttribute('branch_taken', 'high_value')
      span.setAttribute('requires_3ds', true)
    } else {
      span.setAttribute('branch_taken', 'standard')
      span.setAttribute('requires_3ds', false)
    }

    try {
      const result = await chargeProvider(req)

      // PT-BR: Pergunta 1 — fez o que esperei?
      span.setAttribute('result.success', true)
      span.setAttribute('payment.id', result.id)
      span.setAttribute('payment.processor_response', result.processorCode)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (e) {
      // PT-BR: Pergunta 4 — anomalia identificada com type enum
      span.setAttribute('result.success', false)
      span.setAttribute('error.type', classify(e))  // 'provider_down' | 'declined' | 'fraud_block'
      span.setAttribute('error.processor_code', e.code)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw e
    } finally {
      span.end()
    }
  })
}
```

### Pattern: auto-page autor (config CI/CD)

```yaml
# PT-BR: GitHub Actions ou equivalente — paginar autor após merge
# .github/workflows/post-merge-watch.yml
name: post-merge-watch
on:
  push:
    branches: [main]
jobs:
  page-author:
    runs-on: ubuntu-latest
    steps:
      - name: Page commit author for 30-60min
        run: |
          AUTHOR_EMAIL="${{ github.event.head_commit.author.email }}"
          PAGER_TOKEN="${{ secrets.PAGERDUTY_TOKEN }}"
          # PT-BR: criar policy temporária — alertas SLO route para AUTHOR_EMAIL
          # por 45 minutos. Após, retorna ao on-call normal.
          curl -X POST https://api.pagerduty.com/oncall_overrides \
            -H "Authorization: Token token=$PAGER_TOKEN" \
            -d "{
              \"override\": {
                \"start\": \"$(date -u +%FT%TZ)\",
                \"end\": \"$(date -u -d '+45 minutes' +%FT%TZ)\",
                \"user\": {\"email\": \"$AUTHOR_EMAIL\"}
              }
            }"
```

### Pattern: deploy ≠ release (feature flag)

```ts
// PT-BR: deploy do código com flag DESLIGADA
const isV2Enabled = (req: Request): boolean => {
  // PT-BR: 0% inicialmente — deploy = código em prod, mas dormente
  if (!flags.isEnabled('payments_v2', { user_id: req.user.id })) {
    return false
  }
  return true
}

export async function processPayment(req: PaymentRequest) {
  if (isV2Enabled(req)) {
    return processPaymentV2(req)
  }
  return processPaymentV1(req)
}

// PT-BR: depois do deploy, release gradual:
// 1. flag.set('payments_v2', { user_id: 'me' }) — só dev
// 2. flag.set('payments_v2', { customer.tier: 'free' }, 1%) — 1% free users
// 3. observe SLO + error rate; se OK, sobe para 10%, 50%, 100%
```

### Pattern: comparar versão antes/depois (Pergunta 2)

```sql
-- PT-BR: SLI antes vs depois do deploy do build_id `abc123`
-- Mostra error_rate per build, agrupado por versão
select
  build_id,
  count(*) as total,
  sum(case when result_success = false then 1 else 0 end) as errors,
  100.0 * sum(case when result_success = false then 1 else 0 end) / count(*) as error_pct,
  percentile_cont(0.99) within group (order by duration_ms) as p99_ms
from observability.spans
where 
  service_name = 'payments' 
  and timestamp > '2026-05-06 10:00'
  and build_id in ('v1.5.2', 'v1.5.3')   -- versão anterior + atual
group by build_id;

-- PT-BR: se v1.5.3 tem error_pct ou p99_ms > v1.5.2 → regressão. Rollback ou fix.
```

### Pattern: instrumentação shift-left no PLAN.md de fase

```markdown
# PLAN: Fase 42 — Novo método de pagamento

## Tarefas

| # | Task | Output |
|---|------|--------|
| 1 | Implementar `processPaymentV2` em `src/payments/v2.ts` | função |
| 2 | **Instrumentação OTel — bundled** | spans + atributos |
| 3 | Adicionar feature flag `payments_v2` | flag config |
| 4 | Tests unitários | tests/v2.spec.ts |
| 5 | **ODD — 4 perguntas validadas** | comments no PR |

## ODD — Validação das 4 perguntas

1. **Faz o que esperei?**
   - Span `process_payment_v2` com atributo `result.success`
   - Query: `SELECT count(*) WHERE result_success=true / count(*)` deve ser ≥ 99% após release

2. **Compara à versão anterior?**
   - `build_id` em todo span permite cross-version
   - Query: ver "Pattern: comparar versão" acima

3. **Usuários estão usando?**
   - `customer.tier`, `payment.method` permitem slice & dice
   - Query: `SELECT customer.tier, payment.method, count(*) FROM ... WHERE feature_flag.payments_v2=true GROUP BY 1,2`

4. **Anomalias emergem?**
   - `error.type` enum: `'provider_down'`, `'declined'`, `'fraud_block'`
   - `branch_taken` para code paths
   - Alert: SLO burn rate > 2 sobre `WHERE feature_flag.payments_v2=true`
```

## Anti-patterns

### ANTI: instrumentação como fase separada

```text
ANTI: "Vamos shipá-la primeiro, instrumentar na próxima sprint."

PROBLEMA: você está em prod cego. Quando algo quebrar, você não tem dados para
          investigar. Adicionar instrumentação depois requer redeploy, que é 
          arriscado durante incident.

CERTO: instrumentação NO MESMO PR da feature. Não-negociável.
```

### ANTI: glass castle (medo de mexer em prod)

```text
ANTI: "Não deploy hoje, é véspera de feriado."
       "Não deploy depois das 17h."  
       "Vamos esperar a próxima janela de manutenção."
       (Equipe deploya 1× por semana, em batches grandes)

PROBLEMA: deploys raros = deploys grandes = mais código mudando = mais risco.
          Cada deploy fica mais perigoso por sua raridade. Cycle vicioso.

CERTO: deploy frequente (várias vezes ao dia) com features pequenas atrás de flags.
       Cada deploy quase nada. Reverter quase nada se quebra. Confiança aumenta.
```

### ANTI: rollback antes de investigar

```text
ANTI: alerta dispara → rollback automático → "voltou ao normal" → ninguém
       investiga porque "tá funcionando agora"

PROBLEMA: você perdeu a evidência. Próximo incident similar começa do zero.
          Padrão de regressão acumula tech debt invisível.

CERTO: pause feature flag (não rollback do deploy) → investigue com observability →
       fix root cause → re-release. Rollback só se investigation tomar > 30min.
```

### ANTI: testar com 100% rollout em horário de baixa

```text
ANTI: "Faz deploy 4h da manhã quando ninguém usa."

PROBLEMA: você está rodando com 100% de risk em condições não-realistas.
          0 tráfego = 0 sinal. Quando bug aparecer no horário de pico, você
          não terá dados.

CERTO: deploy a qualquer hora atrás de feature flag em 1% → observe → 10% → 100%.
       Bugs aparecem no progressive rollout, não no horário de pico.
```

### ANTI: paginar on-call em vez do autor

```text
ANTI: alerta dispara 2h após merge → on-call (que não escreveu o código) é paginado

PROBLEMA: on-call não tem contexto. Vai procurar "que mudou ultimamente" — toma 30min.
          Autor está dormindo / fora do contexto. Feedback loop quebrado.

CERTO: por 30-60min após merge, alertas vão para o AUTOR. Ele tem o contexto fresco,
       sabe o que mudou, pode reverter ou fix em 5min. Após janela, volta para on-call.
```

### ANTI: instrumentação só em happy path

```text
ANTI: span com atributos só no `try` block; catch sem instrumentação

PROBLEMA: você não sabe nada sobre falhas. Pergunta 4 (anomalias) impossível de responder.

CERTO: cada `catch` adiciona `error.type` enum + `error.message` + `result.success=false`.
       Cada early return adiciona `branch_taken: 'short_circuit_validation'` etc.
```

## Verificação

Antes de mergear PR, verificar as 4 perguntas:

| # | Pergunta | Validação |
|---|----------|-----------|
| 1 | **Faz o que esperei?** | Existe atributo `result.success` em algum span do código tocado? |
| 2 | **Compara à versão anterior?** | `build_id` é setado no span? (geralmente em SDK setup, validar uma vez) |
| 3 | **Usuários estão usando?** | Existe `user.id` ou `tenant_id` ou `customer.tier` no span? |
| 4 | **Anomalias emergem?** | `catch` blocks emitem `error.type` enum? branches if/else emitem `branch_taken`? |

Se qualquer pergunta = NÃO → PR não mergeable. Adicione instrumentação.

Após merge:
- ✅ Feature flag desligada por default? (deploy ≠ release)
- ✅ Auto-page do autor configurado por 30-60min?
- ✅ SLI/SLO baseline sabido para comparação pré/pós release?

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos canônicos, ODD, glass castle
- `kit/skills/structured-events/SKILL.md` — campos canônicos
- `kit/skills/distributed-tracing/SKILL.md` — instrumentação cross-service
- `kit/skills/event-based-slos/SKILL.md` *(Phase 32)* — SLI para baseline pré/pós release
- `kit/agents/observability-instrumenter.md` — agente que gera instrumentação
- `kit/commands/instrumentar-fase.md` — comando que aplica ODD em fases

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 11: "Observability-Driven Development".*
