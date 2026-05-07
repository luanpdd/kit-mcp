---
phase: 38-comandos-orquestrador-sre
plan: 04
subsystem: commands
tags: [sre, prr, production-readiness-review, wrapper-command, askuserquestion]

# Grafo de dependências
requires:
  - phase: 36-skills-foundationais-sre
    provides: skill production-readiness-review (knowledge base canônica do checklist 6 axes)
  - phase: 37-agentes-core-sre
    provides: prr-conductor agent (target do dispatch via Task subagent_type)
provides:
  - kit/commands/prr.md (wrapper command para /prr — 2 modos --service|--feature, 6 axes, 3 engagement models)
affects: [phase-39-integracao-supabase, phase-40-integracao-fluxo-framework, phase-41-gates-docs]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - wrapper command pattern (precedente direto kit/commands/definir-slo.md v1.9 — flag obrigatório + AskUserQuestion + Task dispatch)
    - 2 modos mutuamente exclusivos com validação explícita no Step 1
    - AskUserQuestion duplo (engagement model + reviewer anti auto-PRR)

key-files:
  created:
    - kit/commands/prr.md
  modified: []

key-decisions:
  - "Adotar precedente kit/commands/definir-slo.md como template — wrapper puro com Task dispatch + AskUserQuestion"
  - "Frontmatter com 7 allowed-tools (Read, Write, Bash, Grep, Glob, Task, AskUserQuestion) — Grep+Glob para filesystem inspection do output_path"
  - "Re-PRR não-bloqueante (informa último PRR mas permite sobrescrever) — re-PRR é válido após mudança grande, incident SEV1+, anual"
  - "AskUserQuestion para reviewer com nota explícita anti-auto-PRR (NUNCA team dev) — anti-pattern documentado em cap 32"
  - "Slug feature auto-gerado limitado a 30 chars + cleanup trailing dash (sed s/-$//) para output canônico"

patterns-established:
  - "Comando wrapper SRE: parse args → resolver output_path → detectar MCP → AskUserQuestion → Task dispatch → pós-output com cross-refs"
  - "Modo offline graceful via EVIDENCE_PENDING_MCP — comando passa flag mas agent decide se MCP disponível"
  - "Cross-refs canônicas no Step 6 para integração de fases futuras (/observabilidade omm Cap 4 + /concluir-marco Phase 40)"

requirements-completed: [CMD-SRE-04]

# Métricas
duration: ~12min
completed: 2026-05-07
---

# Phase 38, Plan 04: Comando `/prr` — Resumo

**Wrapper command `kit/commands/prr.md` que dispatcha para `prr-conductor` agent com 2 modos `--service|--feature`, 6 axes obrigatórios, 3 engagement models e AskUserQuestion duplo (engagement + reviewer anti auto-PRR).**

## Performance

- **Duração:** ~12 min
- **Iniciado:** 2026-05-07T03:35:00Z
- **Concluído:** 2026-05-07T03:47:00Z
- **Tarefas:** 3 (T1 frontmatter+objective+context, T2 process 6 steps, T3 success_criteria + smoke)
- **Arquivos modificados:** 1 (kit/commands/prr.md criado, 9.6 KB / 205 linhas)

## Realizações

- Comando wrapper `/prr` criado seguindo precedente direto `kit/commands/definir-slo.md` (v1.9) — frontmatter válido (description 157 chars ≤ 200), Task + AskUserQuestion habilitados
- 2 modos mutuamente exclusivos (`--service <name>` E `--feature "<desc>"`) com validação clara em Step 1 (ambos = ERROR; nenhum = ERROR com sugestão)
- 6 axes obrigatórios literalmente nominados em `<objective>` E Step 5 prompt (System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance) — pular um = aprovação inválida (cap 32)
- 3 engagement models (simple/early/platform) com critério de outage cost documentado no Step 4 AskUserQuestion (< $1k → simple, $1k-100k → early, > $100k → platform/frameworks)
- Anti-pattern auto-PRR explícito — Step 4 segundo AskUserQuestion para reviewer com nota "Reviewer DEVE ser SRE OU par externo ao time dev (confirmation bias)"
- Offline mode fallback graceful via `EVIDENCE_PENDING_MCP` — comando detecta `supabase/config.toml` para passar `project_id` mas agent decide modo
- Cross-refs ativos no `<objective>` para `prr-conductor` e skill `production-readiness-review`; cross-refs no Step 6 para `/observabilidade omm` (Capacidade 4 OMM) e `/concluir-marco` (Phase 40 INT-FW-V2-02 gate PRR opcional)
- Re-PRR não-bloqueante — Step 2 informa último PRR detectado mas permite sobrescrever (re-PRR é válido após mudança arquitetural grande, incident SEV1+, anual)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **Tarefa T1: Frontmatter + objective + context com 2 modos + 6 axes** — `722e520` (feat)
2. **Tarefa T2: Process com 6 steps — parse, output_path, MCP detection, AskUserQuestion, dispatch, pós-output** — `393e01d` (feat)
3. **Tarefa T3: Success_criteria + smoke validations** — `60ac919` (feat)

## Arquivos Criados/Modificados

- `kit/commands/prr.md` (criado, 9867 bytes / 205 linhas) — comando wrapper que invoca `prr-conductor` com Task subagent_type para conduzir PRR em 6 axes; suporta 2 modos `--service|--feature`, 3 engagement models, AskUserQuestion duplo (engagement + reviewer), offline fallback graceful

## Decisões Tomadas

1. **Adotar precedente `kit/commands/definir-slo.md` (v1.9)** — wrapper puro com Task dispatch + AskUserQuestion, mantém superfície de manutenção pequena (comando NÃO duplica scoring/checklist do agent)
2. **Frontmatter com 7 allowed-tools** (Read, Write, Bash, Grep, Glob, Task, AskUserQuestion) — Grep+Glob necessários para inspection do output_path (re-PRR detection) e supabase/config.toml parsing
3. **Re-PRR não-bloqueante** — Step 2 detecta último PRR via `grep -m1 '**Date:**'` mas permite sobrescrever; re-PRR é hygiene anual + trigger em mudança grande (cap 32)
4. **AskUserQuestion duplo no Step 4** — primeiro engagement model (3 opções com critério outage cost), segundo reviewer (texto livre com nota explícita anti auto-PRR)
5. **Slug feature limitado** — `tr ' ' '-' | tr -cd 'a-zA-Z0-9-' | head -c 30 | sed 's/-$//'` para output canônico determinístico

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

**Smoke sync invocation atualizada** — comando original do plano `npx kit-mcp sync claude-code --project-root` retornava SYNC_FAIL pois CLI moderno usa `sync install <target>` (subcommand). Validei com `node bin/cli.js sync install claude-code --project-root "$TMP"` que retornou correctly `SYNC_OK` e arquivo `.claude/commands/prr.md` com 809 bytes (stub markdown-reference, conforme design do kit-mcp). Não bloqueia plano — smoke do PLAN.md é apenas reference, output do comando real está correto.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Comando é content-only (markdown) sob `kit/commands/`, distribuído via `kit sync install <target>`.

## Prontidão para Próxima Fase

- **Plan 38-04 completo** — `/prr` wrapper invoca `prr-conductor` (Phase 37 Plan 04 completo) que aplica skill `production-readiness-review` (Phase 36 esperada)
- **Phase 38 cobertura** — todos 6 plans da Phase 38 entregues (CMD-SRE-01 golden-signals + CMD-SRE-02 auditar-toil + CMD-SRE-03 postmortem + **CMD-SRE-04 prr** + CMD-SRE-05 risk-budget + CMD-SRE-06 sre orquestrador)
- **Próximo:** Phase 39 (integração Supabase v1.8) — `supabase-architect` ganha menção a PRR antes de production. Phase 40 (integração fluxo framework) — `/concluir-marco` ganha gate PRR opcional via INT-FW-V2-02 quando `workflow.complete_milestone_prr_gate=true`
- **Smoke verificado** — `kit sync install claude-code` projeta `kit/commands/prr.md` para `.claude/commands/prr.md` (stub markdown-reference 809 bytes)

---
*Fase: 38-comandos-orquestrador-sre*
*Concluída: 2026-05-07*
