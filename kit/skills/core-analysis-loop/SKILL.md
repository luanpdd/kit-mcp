---
name: core-analysis-loop
cost_tier: leve
description: Depura produção via método científico iterativo (sintoma, query, root cause) sem dashboard-flipping. Documenta trilha em .planning/investigations/. Gatilho — SLO burn, alerta, anomalia.
---

# Observabilidade — Core Analysis Loop

## Quando usar

LLM carrega esta skill ao investigar incidente, debugar comportamento de produção, ou validar hipótese sobre sistema. Trigger phrases:

- "investigar incidente", "debugar produção"
- "qual a causa raiz", "root cause analysis"
- "core analysis loop"
- "debug from first principles"
- "alerta disparou — onde começo?"
- "SLO burn — como descobrir o que quebrou?"

## Regras absolutas

- **Hipóteses vêm de DADOS, não intuição** — você não precisa conhecer o sistema. Comece com query `SELECT * WHERE result.success = false LIMIT 10` e itere.
- **NUNCA chute "deve ser X"** — toda hipótese é validada com query antes de aceitar. Se você está confiante mas não verificou, pare e verifique.
- **GROUP BY iterativo** — sempre comece amplo e estreite. Erro 5xx → group by `error.type` → group by `tenant_id` → group by `endpoint` → root cause.
- **Cardinalidade alta é sua amiga** — debug por user_id específico é só possível se você instrumentou alta cardinalidade (skill `structured-events`).
- **Documente a trilha** — cada hipótese, query, resultado, próxima hipótese. `incident-investigator` salva em `.planning/investigations/<id>.md`.
- **Pare quando achar root cause** — não vá além. "Tenant X em endpoint Y excedeu rate limit" é root cause; o "porquê tenant X excedeu" é um próximo loop separado.
- **Refute hipóteses agressivamente** — busque evidência CONTRA, não A FAVOR. Bias de confirmação é o inimigo.
- **Não confie em dashboards** — eles foram criados para problemas conhecidos. Você está investigando algo emergente.

## As 4 fases do Core Analysis Loop

```text
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   ┌──────────────────┐                                         │
│   │ 1. SINTOMA       │  Algo está errado (alerta, complaint,   │
│   │                  │  SLO burn, métrica anômala)             │
│   └────────┬─────────┘                                         │
│            ↓                                                   │
│   ┌──────────────────┐                                         │
│   │ 2. HIPÓTESE      │  Olhar para os DADOS (não intuição):    │
│   │    DE DADOS      │  query inicial ampla; ver o que aparece │
│   └────────┬─────────┘                                         │
│            ↓                                                   │
│   ┌──────────────────┐                                         │
│   │ 3. VALIDAÇÃO     │  Refinar com GROUP BY + WHERE.          │
│   │    POR QUERY     │  Tem evidência? Sim → próxima hipótese  │
│   └────────┬─────────┘  Não → volta para 2 com hipótese nova   │
│            ↓                                                   │
│   ┌──────────────────┐                                         │
│   │ 4. ITERAR        │  Foi para 2 (refinou hipótese)          │
│   │    OU PARAR      │  ou parar (achou root cause)            │
│   └──────────────────┘                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Patterns canônicos

### Pattern: investigação completa (exemplo realista)

```text
SINTOMA:
  Alerta disparou às 14:32 — "checkout SLO burn rate = 8" (4× acima de 2 normal)

HIPÓTESE 1 — qual tipo de erro domina?
  Query:
    select error.type, count(*) 
    from spans 
    where service.name = 'checkout' 
      and result.success = false
      and timestamp > '2026-05-06 14:00'
    group by 1
    order by count(*) desc
  Resultado:
    rate_limit  | 7,234  (78%)
    timeout     |   892  (10%)
    validation  |   452  ( 5%)
    db_conflict |   338  ( 4%)
    auth        |   215  ( 2%)

VALIDAÇÃO: rate_limit é o dominante. Foco aqui.

HIPÓTESE 2 — qual tenant está sofrendo rate_limit?
  Query:
    select tenant_id, count(*)
    from spans
    where service.name = 'checkout'
      and error.type = 'rate_limit'
      and timestamp > '2026-05-06 14:00'
    group by 1
    order by count(*) desc
  Resultado:
    acme-corp   | 6,872  (95%)
    other       |   362  ( 5%)

VALIDAÇÃO: tenant acme-corp domina. Não é spread cross-tenant.

HIPÓTESE 3 — qual endpoint específico de acme está hitando rate_limit?
  Query:
    select endpoint, count(*)
    from spans
    where tenant_id = 'acme-corp'
      and error.type = 'rate_limit'
      and timestamp > '2026-05-06 14:00'
    group by 1
  Resultado:
    /api/v1/bulk_orders | 6,872  (100%)

VALIDAÇÃO: 100% concentrado em /api/v1/bulk_orders.

HIPÓTESE 4 — começou quando exatamente?
  Query:
    select date_trunc('minute', timestamp) as minute, count(*)
    from spans
    where tenant_id = 'acme-corp'
      and endpoint = '/api/v1/bulk_orders'
      and timestamp > '2026-05-06 13:00'
    group by 1 order by 1
  Resultado:
    13:00–13:59  | 200/min (normal)
    14:00–14:01  | 230/min
    14:02        | 8,500/min  <-- spike!
    14:03+       | 7,800/min

ROOT CAUSE: tenant acme-corp começou às 14:02 a fazer bulk_orders ~40× acima do normal.

  Possíveis causas (próximo loop, fora deste escopo):
    a) Bug do lado deles (loop infinito num cron deles)
    b) Migração de dados que deveria ser one-shot virou continuous
    c) Ataque

AÇÃO IMEDIATA:
  1. Aumentar quota OU contactar acme-corp para entender
  2. Adicionar circuit breaker em /api/v1/bulk_orders
  3. Próximo loop: investigar PORQUÊ acme acelerou às 14:02
```

### Pattern: query inicial ampla (BFS, não DFS)

```sql
-- PT-BR: comece SEMPRE amplo. Group by por dimensão de alta cardinalidade
-- Não chute — deixe a query mostrar o que domina.
select 
  error_type, 
  tenant_id, 
  endpoint, 
  customer_tier,
  count(*) as occurrences
from observability.spans
where 
  service_name = 'checkout'
  and result_success = false
  and timestamp > now() - interval '30 minutes'
group by 1, 2, 3, 4
order by occurrences desc
limit 30;
```

### Pattern: refutar hipótese (bias check)

```sql
-- PT-BR: hipótese — "deploy às 14:00 causou problema"
-- Buscar EVIDÊNCIA CONTRA: comparar build_id antes/depois
select 
  build_id,
  date_trunc('minute', timestamp) as minute,
  sum(case when result_success = false then 1 else 0 end) as errors,
  count(*) as total,
  sum(case when result_success = false then 1 else 0 end)::float / count(*) as error_rate
from observability.spans
where timestamp between '2026-05-06 13:30' and '2026-05-06 14:30'
group by 1, 2
order by 2;

-- PT-BR: se error_rate é igual em build_id antigo e novo → deploy NÃO foi a causa
--        Refutado. Próxima hipótese.
```

### Pattern: investigação em incident-investigator (Supabase)

```text
PT-BR: usando MCP tools em sequência, mantendo estado em .planning/investigations/<id>.md

1. mcp__supabase__get_logs --service api --filter "status_code >= 500" --limit 100
   → identifica padrão "rate_limit" dominando

2. mcp__supabase__execute_sql --query "
     select tenant_id, count(*) 
     from logs.api 
     where status = 429 and timestamp > now() - interval '1 hour'
     group by 1 order by 2 desc"
   → tenant acme-corp = 95%

3. mcp__supabase__get_advisors --type performance
   → "índice missing em bulk_orders.tenant_id" (hipótese paralela: pode ser causa upstream)

4. mcp__supabase__execute_sql --query "
     select date_trunc('minute', timestamp) m, count(*)
     from logs.api 
     where tenant_id = 'acme-corp' and path = '/api/v1/bulk_orders'
     group by 1 order by 1"
   → spike em 14:02

ROOT CAUSE: tenant acme spike de bulk_orders às 14:02.
```

### Pattern: documentação da trilha (formato canônico)

```markdown
# Investigation: incident-2026-05-06-checkout-burn

**Started:** 2026-05-06 14:35
**Trigger:** SLO burn rate alert (checkout) = 8

## Sintoma inicial
- Alerta SLO burn rate=8 (4× acima do normal)
- p99 latency normal — não é problema de performance

## Hipóteses

### H1: qual tipo de erro domina?
- Query: `select error_type, count(*) from spans where ...`
- Resultado: rate_limit = 78%
- Status: VALIDATED — rate_limit é o foco

### H2: qual tenant?
- Query: `select tenant_id, count(*) where error_type='rate_limit'`
- Resultado: acme-corp = 95%
- Status: VALIDATED — concentrado

### H3: qual endpoint?
- Query: `select endpoint, count(*) where tenant_id='acme-corp' and error_type='rate_limit'`
- Resultado: /api/v1/bulk_orders = 100%
- Status: VALIDATED — endpoint único

### H4: quando começou?
- Query: time series por minuto desde 13:00
- Resultado: spike às 14:02 (200 → 8500/min)
- Status: VALIDATED — timestamp confirmado

## Root Cause
Tenant acme-corp começou às 14:02 a fazer bulk_orders 40× acima do baseline,
saturando rate limit do endpoint /api/v1/bulk_orders.

## Action Items
- [x] Page on-call (já feito antes da investigação começar)
- [ ] Contactar acme-corp para entender o que mudou às 14:02
- [ ] Adicionar circuit breaker em /api/v1/bulk_orders
- [ ] Próximo loop: por que acme acelerou? (separado deste)

## Lições / Tooling Gaps
- Faltou índice em (tenant_id, endpoint, timestamp) para query H3 ser rápida
- Logflare retention é só 24h — investigations além disso requerem export
```

## Anti-patterns

### ANTI: dashboard-flipping

```text
ANTI: ver spike no dashboard A, abrir B C D E procurando "shape similar"

PROBLEMA: pattern matching humano não escala. Você está limitado pelos dashboards
          que alguém criou no passado para problemas conhecidos. Falhas emergentes
          não têm dashboards.

CERTO: Core Analysis Loop — comece com query ampla, deixe os dados conduzirem.
```

### ANTI: debug from intuition

```text
ANTI: "Deve ser o cache" → mexer no cache → não funciona → "Deve ser o DB"...

PROBLEMA: chutes baseados em scar tissue não escalam. Engenheiros novos no time
          ficam paralisados. Cada incident é uma redescoberta.

CERTO: comece sem assumir nada. SELECT WHERE result.success=false; veja o que aparece.
```

### ANTI: confirmar hipótese sem refutar

```text
ANTI: "Acho que é rate_limit" → query confirma 78% rate_limit → "Resolvi!" → fim

PROBLEMA: 78% não é 100%. Os outros 22% (timeouts, validation) podem ter causa
          comum (mesma origem). Você parou cedo demais.

CERTO: validar que rate_limit explica o burn (não só representa maioria).
       Calcular: sem os rate_limits, burn rate cai para? Se sim → confirmado.
       Se não → há causa concorrente.
```

### ANTI: parar antes de identificar quem/onde/quando

```text
ANTI: "É rate_limit" → ticket criado → end

PROBLEMA: ações imediatas (aumentar quota? circuit breaker? contactar tenant?)
          dependem de quem (tenant), onde (endpoint) e quando (timing).

CERTO: 4 dimensões mínimas — error.type + tenant + endpoint + timestamp inicial.
       Sem isso, não há ação possível.
```

### ANTI: misturar 2 incidentes em 1 loop

```text
ANTI: "Por que checkout queimando?" + "Por que tenant acme acelerou?" — tudo junto

PROBLEMA: você nunca termina nem um nem outro. Loop fica infinito.

CERTO: 1 loop = 1 incident. Achou root cause de "por que checkout queimando" 
       (= acme spike) → PARE. Abra novo loop "por que acme spike às 14:02".
```

### ANTI: não documentar a trilha

```text
ANTI: investigar mentalmente, achar root cause, escrever postmortem horas depois

PROBLEMA: você esqueceu o caminho. Time não aprende. Próximo incident similar
          recomeça do zero. Bias retrospectivo torce a narrativa.

CERTO: incident-investigator agent salva trilha em tempo real
       em .planning/investigations/<id>.md (cada hipótese + query + resultado)
```

## Verificação

Antes de marcar incident como resolvido via Core Analysis Loop:

1. **Root cause é causal, não correlação** — "X aconteceu antes de Y" não é causa. "X causa Y" requer mecanismo explícito.
2. **4 dimensões mínimas** — error.type + identidade (user/tenant) + endpoint/component + timestamp inicial
3. **Próxima ação concreta** — root cause aponta para 1+ ações imediatas (mitigation, fix, escalation)
4. **Trilha documentada** — `.planning/investigations/<id>.md` tem todas as hipóteses (validated + refuted)
5. **Sem chutes não-validados** — cada hipótese tem query + resultado citado, não "achei que..."
6. **Sem dashboard-flipping nas notas** — só queries SQL/MCP, não "olhei o dashboard X"
7. **Próximo loop separado** — se há "por que" do "por que" (causa do tenant ter acelerado), abre-se outro loop

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — Core Analysis Loop, first principles, anti-patterns
- `kit/skills/structured-events/SKILL.md` — high cardinality é pré-requisito para queries ad hoc
- `kit/skills/distributed-tracing/SKILL.md` — trace_id permite focar 1 request específico
- `kit/agents/incident-investigator.md` *(Phase 30)* — agente que aplica este loop com MCP Supabase
- `kit/commands/investigar-producao.md` *(Phase 30)* — comando que lança o agente

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 8: "Analyzing Events to Achieve Observability".*
