---
name: sre
description: Orquestrador da Suíte SRE (v1.10) — dispatch para agents (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) com sinônimos PT/EN.
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte SRE (v1.10) — terceiro orquestrador da família após [`/supabase`](./supabase.md) (v1.8) e [`/observabilidade`](./observabilidade.md) (v1.9). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para o agent SRE correto. **Único ponto de chain de agents SRE** (anti-pitfall A10 mantido — agents permanecem função pura).

**Subcomandos cobrem cap 3, 5, 6, 15, 32 do livro Google SRE:**
- `golden-signals` — 4 signals universais (cap 6)
- `auditar-toil`/`audit-toil` — eliminating toil (cap 5)
- `postmortem` — blameless postmortem (cap 15)
- `prr` — Production Readiness Review (cap 32)
- `risk-budget`/`budget` — risk continuum (cap 3)

**Cria/Atualiza:** o que cada agent invocado cria (patches OTel, TOIL-AUDIT.md, postmortem, PRR-REPORT.md, snapshot risk-budget).

**Após:** o usuário tem o output do agent (instrumentação aplicada, audit, postmortem revisável, PRR scored, ou snapshot de budget).
</objective>

<execution_context>
Skills consultadas pelos agents (Phase 36): [`kit/skills/sre-risk-management/SKILL.md`](../skills/sre-risk-management/SKILL.md), [`kit/skills/four-golden-signals/SKILL.md`](../skills/four-golden-signals/SKILL.md), [`kit/skills/eliminating-toil/SKILL.md`](../skills/eliminating-toil/SKILL.md), [`kit/skills/blameless-postmortems/SKILL.md`](../skills/blameless-postmortems/SKILL.md), [`kit/skills/production-readiness-review/SKILL.md`](../skills/production-readiness-review/SKILL.md) + glossário em [`kit/skills/_shared-sre/glossary.md`](../skills/_shared-sre/glossary.md).

Agents disponíveis (Phase 37):
- [`golden-signals-instrumenter`](../agents/golden-signals-instrumenter.md) — AGCORE-SRE-01
- [`toil-auditor`](../agents/toil-auditor.md) — AGCORE-SRE-02
- [`postmortem-writer`](../agents/postmortem-writer.md) — AGCORE-SRE-03
- [`prr-conductor`](../agents/prr-conductor.md) — AGCORE-SRE-04

**Subcomando `risk-budget`** é caso especial — comando direto (Plan 05 não usa agent); orquestrador delega aplicando skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) inline ou re-encaminhando para `/risk-budget`.
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched | Cap livro |
|---|---|---|---|
| `golden-signals` | `signals`, `4signals`, `golden` | `golden-signals-instrumenter` | 6 |
| `auditar-toil` | `audit-toil`, `toil`, `auditar` | `toil-auditor` | 5 |
| `postmortem` | `pm`, `post-mortem` | `postmortem-writer` | 15 |
| `prr` | `production-readiness`, `readiness-review` | `prr-conductor` | 32 |
| `risk-budget` | `budget`, `risk`, `continuum` | (comando direto — `/risk-budget`) | 3 |
| `help` | `ajuda`, `?` | exibe esta tabela inline | — |

**Roteamento de flags por subcomando:**

- `golden-signals <target>` — args passados como `<target>` + flags `--service` `--saturation` `--runtime`
- `auditar-toil` — flags `--time-window` `--team-size` `--output` `--runbooks-paths`
- `postmortem` — flags **mutuamente exclusivas** `--from-investigation <id>` OU `--incident "<desc>"` + `--severity`
- `prr` — flags **mutuamente exclusivas** `--service <name>` OU `--feature "<desc>"` + `--engagement` `--reviewer`
- `risk-budget` — `[<slo_name>]` opcional + `--format` `--explain`

**Exemplos:**

```
/sre golden-signals supabase/functions/process-emails    # instrumentar Edge Function
/sre auditar-toil --time-window 6m                       # audit toil últimos 6 meses
/sre postmortem --from-investigation incident-2026-05-06-1432-checkout-burn  # continuação de v1.9
/sre prr --service orders-api --reviewer @sre-lead       # PRR de serviço existente
/sre risk-budget checkout_success --explain              # budget + sabedoria 99.99% inline
/sre help                                                # exibe tabela de subcomandos
```
</context>

<process>

## 1. Parsear subcomando

```bash
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

## 2. Resolver sinônimos para agent canônico

```text
golden-signals, signals, 4signals, golden          → golden-signals-instrumenter
auditar-toil, audit-toil, toil, auditar            → toil-auditor
postmortem, pm, post-mortem                        → postmortem-writer
prr, production-readiness, readiness-review        → prr-conductor
risk-budget, budget, risk, continuum               → (comando direto — /risk-budget)
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  golden-signals    → instrumentar 4 signals OTel (Latency/Traffic/Errors/Saturation)
  auditar-toil      → audit toil priorizado P0/P1/P2 + esforço de automação
  postmortem        → postmortem blameless 9 seções (--from-investigation OU --incident)
  prr               → Production Readiness Review 6 axes (--service OU --feature)
  risk-budget       → error budget vs risk continuum + sabedoria 99.99%

Uso: /sre <subcomando> <args...>
Exemplo: /sre prr --service orders-api
```

## 3. Detectar `supabase/config.toml` (passar `project_id` para agents que usam MCP)

```bash
PROJECT_ID=""
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

Apenas `prr-conductor` usa `mcp__supabase__*` — outros 3 agents não precisam de `project_id` (instrumentação/audit/postmortem são filesystem only).

## 4. Dispatch — caminhos por subcomando

### 4a. `golden-signals` → `golden-signals-instrumenter`

```text
Task(
  subagent_type="golden-signals-instrumenter",
  prompt="
${ARGS}

Aplicar skill four-golden-signals. Gerar patches OTel para os 4 signals (Latency: histogram bucketed; Traffic: counter; Errors: counter por error.type; Saturation: gauge resource-specific).
"
)
```

### 4b. `auditar-toil` → `toil-auditor`

```text
Task(
  subagent_type="toil-auditor",
  prompt="
project_root: .
output_path: .planning/TOIL-AUDIT.md
${ARGS}

Aplicar skill eliminating-toil. Scan git log + scripts + runbooks; aplicar 6 critérios canônicos; priorizar P0/P1/P2; estimar esforço de automação L0-L4.
"
)
```

### 4c. `postmortem` → `postmortem-writer`

Validar mutuamente exclusivos (`--from-investigation` E `--incident` ambos = ERROR; nenhum = AskUserQuestion sugerido).

```text
Task(
  subagent_type="postmortem-writer",
  prompt="
${ARGS}

Aplicar skill blameless-postmortems. Modo conforme flag (--from-investigation lê investigation v1.9; --incident standalone com 9 perguntas guiadas). 9 seções obrigatórias: Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC. Foco em sistema/processo (NUNCA pessoas).
"
)
```

### 4d. `prr` → `prr-conductor`

Validar mutuamente exclusivos (`--service` E `--feature` ambos = ERROR; nenhum = ERROR com sugestão). Se `--reviewer` ausente: AskUserQuestion (anti-pattern auto-PRR).

```text
Task(
  subagent_type="prr-conductor",
  prompt="
${ARGS}
${PROJECT_ID:+project_id: ${PROJECT_ID}}

Aplicar skill production-readiness-review. Audit em 6 axes (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) — todos obrigatórios. Engagement model conforme outage cost. Modo offline fallback graceful.
"
)
```

### 4e. `risk-budget` → comando direto `/risk-budget`

Caso especial — não há agent. Re-encaminhar via shell ou aplicar skill `sre-risk-management` direto.

```bash
# PT-BR: invocar comando /risk-budget passando args
# Em Claude Code, isso é equivalente a executar o comando file diretamente
# (orquestrador apenas valida sinônimo e delega)
/risk-budget ${ARGS}
```

Alternativa inline (se não há shell call): orquestrador lê `.planning/slos/*.md`, mapeia para tabela continuum (skill `sre-risk-management` Pattern 1), exibe tabela com status (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED).

## 5. Output

Output do agent (ou do comando direto risk-budget) é o output do orquestrador. Sem post-processing — agent já formata estruturado.

## 6. Sugestões de chains comuns (pós-output)

Após dispatch, orquestrador pode sugerir chains comuns:

| Subcomando rodado | Chain natural |
|---|---|
| `golden-signals` | `/sre prr --service <same>` (validar production-readiness) |
| `auditar-toil` | `/observabilidade omm` (alimentar OMM Capacidade 3) |
| `postmortem` | `/sre prr --service <affected>` OR `/observabilidade omm` (Capacidade 5 Incident Response) |
| `prr` | (se Approved) deploy; (se Blocked) fechar P0s e re-PRR |
| `risk-budget` | `/burn-rate-status` (live forecast) OR `/sre postmortem --incident "..."` se BUDGET-EXHAUSTED |

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (5 subcomandos × seus sinônimos)
- [ ] `project_id` extraído de `supabase/config.toml` se presente (apenas relevante para `prr`)
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain (anti-pitfall A10)
- [ ] Subcomando `risk-budget` delega para comando direto `/risk-budget` (não usa Task)
- [ ] Subcomando `postmortem` valida `--from-investigation` E `--incident` mutuamente exclusivos antes de dispatch
- [ ] Subcomando `prr` valida `--service` E `--feature` mutuamente exclusivos + AskUserQuestion para reviewer (anti auto-PRR)
- [ ] Subcomando inválido → mensagem clara com lista de 5 subcomandos válidos
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline com 6 linhas (5 + help)
- [ ] Args após subcomando passam transparentemente para o agent
- [ ] Sugestões de chains comuns na tabela final (5 chains documentadas)
</success_criteria>
