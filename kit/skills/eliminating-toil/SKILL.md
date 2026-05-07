---
name: eliminating-toil
description: Use ao identificar/eliminar toil — 6 critérios canônicos (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50%, automação como invariante.
---

# SRE — Eliminating Toil

## Quando usar

LLM carrega esta skill ao auditar tarefas operacionais, classificar trabalho como toil/non-toil, ou propor automação. Trigger phrases:

- "toil", "trabalho operacional"
- "eliminar toil", "reduzir toil"
- "≤ 50% toil", "regra 50%"
- "automation", "automatizar tarefa repetitiva"
- "isso é toil ou overhead?"
- "Google SRE cap 5"
- "TOIL-AUDIT"

## Regras absolutas

- **Toil tem 6 critérios canônicos** — uma tarefa É toil se TODOS os 6 valem: (1) **Manual** — humano executa cada vez; (2) **Repetitivo** — você já fez isso 3+ vezes; (3) **Automatizável** — script/cron resolve sem julgamento humano; (4) **Tático** — reage a evento, não planeja; (5) **Sem valor durável** — não cria asset permanente; (6) **Escala linear** — mais users = mais trabalho. Se QUALQUER um dos 6 = não, NÃO é toil (é overhead ou grungy work).
- **Regra ≤ 50%** — SRE não pode gastar mais que 50% do tempo em toil; restante é engineering (automação, capacity planning, instrumentation, postmortems). Se medindo > 50% por 1+ trimestre, é red flag — peça ajuda à liderança.
- **Toil ≠ overhead** — reuniões, RH, planejamento de quarter, performance review são **overhead** — necessários, não-elimináveis, NÃO contam para a regra ≤ 50%. Confundir overhead com toil = sub-medir.
- **Toil ≠ grungy work** — refactor de código legado, security cleanup, DB rebuild para reduzir bloat são **grungy work** — necessários, têm valor durável, são engineering trabalho. NÃO contam como toil.
- **Automação é o objetivo, não o meio** — automatizar parcialmente (humano clica botão A, depois B, depois C) ainda é toil. Automação completa (cron + script + alert se falhar) elimina toil. Meias-medidas perpetuam.
- **Toil tax cresce com produto** — cada feature nova adiciona toil potencial: deploy manual, migration manual, feature flag rotation, customer-specific config. Prevenir > remediar — design feature considerando "como auto-operar isso?".
- **Quantificar toil em horas-pessoa** — "TOIL-AUDIT.md" deve ter coluna `hours_per_week_per_person` para cada item. Sem quantificação, "muito toil" é subjetivo e não-acionável.
- **Priorizar por (frequency × pain) / automation_effort** — P0 = alto frequency + alto pain + baixo effort. P2 = baixa frequency OU alto effort. Não automatizar tudo de uma vez — começar pelo P0.

## Patterns canônicos

### Pattern: decision tree para classificar trabalho

```text
Tarefa repetitiva detectada → aplicar 6 critérios canônicos:

1. Manual?           (humano executa cada vez)             ┐
2. Repetitiva?       (já fiz isso 3+ vezes)                 │
3. Automatizável?    (script/cron resolve sem julgamento)   │── Se TODOS sim → TOIL
4. Tática?           (reage a evento, não planeja)          │   → automatizar / eliminar
5. Sem valor durável? (não cria asset permanente)           │   → contar em ≤ 50% rule
6. Escala linear?    (mais users = mais trabalho)          ─┘

Se NÃO for toil mas repetitivo, classificar:
- OVERHEAD       (reuniões, RH, planning) → não-eliminável; NÃO conta em ≤ 50%
- GRUNGY WORK    (refactor, sec cleanup) → necessário, valor durável → projeto engineering
- PROJECT WORK   (criar novo serviço) → engineering trabalho ≠ toil
```

### Pattern: template `TOIL-AUDIT.md`

Formato canônico que `toil-auditor` (Phase 37) gera:

```markdown
# TOIL-AUDIT — <projeto> — <data>

## Métrica agregada

- Toil estimado: X.X horas-pessoa/semana (Y% do tempo do time)
- **Status vs ≤ 50% rule:** [GREEN: < 30%] | [YELLOW: 30-50%] | [RED: > 50%]
- Top 3 áreas: <lista>

## Itens identificados

| # | Item | Frequência | Hours/week | Pain (1-5) | Automation effort | Priority |
|---|------|------------|------------|------------|-------------------|----------|
| 1 | Reset DB seed manual antes de cada test run | 2×/dia | 1.5 h | 4 | M (3 dias) | P0 |
| 2 | Rotation de access_token de Edge Function | 1×/semana | 0.5 h | 2 | S (1 dia) | P1 |
| 3 | Rebuild de índice fts_search após batch import | 1×/mês | 0.5 h | 3 | M (2 dias) | P1 |
| 4 | Limpeza manual de orphan rows em audit_log | 1×/semana | 0.3 h | 1 | S (1 dia) | P2 |

## P0 (automatizar agora)

### Item 1: Reset DB seed manual

**Por que é toil:** atende 6 critérios canônicos (manual, repetitivo 2×/dia, automatizável via script + pg_cron, tática reativa, sem valor durável, escala com #devs).

**Automação proposta:** `make db-reset` que invoca `supabase db reset && pnpm run seed`. Adicionar pre-test hook em CI.

**Esforço estimado:** 3 dias (Med — script existe parcialmente, falta seed deterministic).

**Owner sugerido:** @dev-tools-team

## P1 / P2 (escalonar)

...

## Não-toil identificado

- **Overhead:** sprint planning (2h × semana × 5 pessoas = 10h/semana) — NÃO conta no ≤ 50%
- **Grungy work:** refactor de `legacy_orders_service` (8h × semana × 1 pessoa = 8h/semana) — projeto, não toil
```

### Pattern: estágios de automação (níveis Google)

| Estágio | Descrição | Exemplo |
|---|---|---|
| **L0: Manual** | 100% humano | "Cada deploy: SSH no host, copy binary, kill+restart" |
| **L1: Documented** | Runbook escrito; humano segue passos | "Doc passo-a-passo de deploy em wiki" |
| **L2: Tooled** | Script executa passos; humano invoca | "`./deploy.sh prod`" |
| **L3: Self-service** | UI/CLI trigger; humano clica | "GitHub Actions deploy on PR merge" |
| **L4: Autonomous** | Sem humano; só fail-state intervenção | "Auto-rollback se SLO burn rate > 4 nos primeiros 5 min após deploy" |

Meta SRE é mover toda toil de L0/L1 para L3/L4. L2 é meio-passo aceitável quando L3+ requer investimento maior. **L1 (apenas runbook) é toil disfarçado** — runbook é manual com passo extra de "ler doc".

### Pattern: identificação de toil via git log + scripts

```bash
# PT-BR: scripts shell em runbooks/ ou docs/runbooks/
find . -name "*.sh" -path "*runbook*" -o -path "*ops*" | head -20

# PT-BR: "manual steps" em README/docs (heurística — frase canônica)
grep -rn "manually\|por favor\|run this\|every week\|cada semana" --include="*.md" .

# PT-BR: tarefas repetitivas via git log — commits de mesmo tipo
git log --since="3 months ago" --pretty=format:"%s" | sort | uniq -c | sort -rn | head -20
# Ex: "20× Re-run failed migration in prod"  → TOIL candidato
# Ex: "15× Bump deploy-token"                → TOIL candidato

# PT-BR: cron jobs já automatizados (saída esperada)
crontab -l 2>/dev/null
cat /etc/cron.d/* 2>/dev/null
```

### Pattern: "toil tax" — prevenir feature nascer com toil

```text
Antes de mergear PR de nova feature, perguntar:

1. "Como auto-operar isso em prod?"          → instrumentação ODD
2. "Como auto-monitorar?"                     → 4 golden signals
3. "Como auto-recuperar de fail comum?"       → retry, circuit breaker
4. "Como auto-rotacionar credenciais?"        → vault + cron rotation
5. "Como auto-limpar dados históricos?"       → retention policy + scheduled cleanup
6. "Como onboarding de novo cliente?"         → self-service signup, não Slack ping

Se QUALQUER resposta = "humano fará isso" → toil tax. Bloqueie ou descontar do release budget.
```
