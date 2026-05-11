# SUMMARY — Phase 129: Patches cross-suite v1.22 + framework core

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 2/2 (CROSS-09, CROSS-10)
**Commits:** 1 atomic

## O que foi feito

Atualizado `auditor-consistencia-isolamento` (v1.22) com Detector 7 (CROSS-09) — auditoria de gap de hardener cooperativo em migrations + atualizado `planner`/`executor`/`debugger` (framework core) com SQL auto-handoff cooperativo (CROSS-10) — detectam SQL via regex heurística e fazem handoff via `Task(subagent_type=supabase-rls-hardener)`.

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| CROSS-09 | `auditor-consistencia-isolamento` (v1.22): section "Validação de RLS hardener cooperativo (v1.23 — CROSS-09)" + Detector 7 com query bash + output `hardener_passed: bool` + cross-refs ativos | `grep -c "Detector 7\|hardener_passed\|supabase-rls-hardener" kit/agents/auditor-consistencia-isolamento.md` ≥ 3 |
| CROSS-10 | `planner.md`, `executor.md`, `debugger.md`: section `<sql_auto_handoff_cooperativo>` com heurística regex + Task() pseudo-code customizado por agent | 3 files match `sql_auto_handoff_cooperativo` |

## Detalhes por agent

### auditor-consistencia-isolamento (CROSS-09)

- **Detector 7 — Migration sem hardener cooperativo (v1.23):** Camada 7 de defense-in-depth. Audit consulta git log para detectar commits de migration que NÃO incluem trace de handoff cooperativo (substring matching: "supabase-rls-hardener", "HARDENER OK", "verdict: GO").
- **Output enriquecido:** field `hardener_passed: bool` em audit output; migrations sem trace ficam P1 severity.
- **Princípio canônico v1.23:** agent não escreve fix — apenas detecta gap e delega para `supabase-rls-hardener` retroativamente (handoff cooperativo).

### planner (CROSS-10)

- **Heurística regex:** `(create\s+table|create\s+policy|create\s+view|alter\s+table|create\s+function.*security\s+definer|grant\s+.*on|enable\s+row\s+level\s+security)`
- **Comportamento:** se ≥ 1 match em qualquer tarefa do PLAN.md, injeta tarefa final "Handoff cooperativo SQL para supabase-rls-hardener (v1.23)" com Tipo=Validation, Action=Invoca Task(), Verify=Verdict + SQL hardenado, Done=GO atingido ou diff aplicado.

### executor (CROSS-10)

- **Heurística regex:** mesma que planner
- **Comportamento:** invoca hardener ANTES de aplicar SQL via `mcp__supabase__apply_migration`. Processa verdict:
  - GO → aplica direto
  - STRENGTHEN → aplica diff sugerido + registra em SUMMARY.md "## RLS Hardener Trace"
  - REWRITE com user_facing_caller=true → PAUSA execução + pede confirmação ao usuário

### debugger (CROSS-10)

- **Heurística hipótese mention:** `(RLS|policy|auth\.uid|permission\s+denied|42501|insufficient_privilege|user_metadata|security_definer|security_invoker|grant\s+.*on)`
- **Comportamento:** invoca hardener ANTES de propor fix SQL. Verdict é incorporado como evidence na hipótese atual no DEBUG.md (rastreabilidade pós-reset).

## Métricas

- **Arquivos modificados**: 4 agents (1 v1.22 + 3 framework core)
- **Section nova adicionada**: "Validação de RLS hardener cooperativo (v1.23 — CROSS-09)" (auditor) + `<sql_auto_handoff_cooperativo>` (3 framework core)
- **Detector novo no auditor**: Detector 7 (CROSS-09)
- **Patterns Task() pseudo-code**: 3 (1 por framework core agent, customizado)
- **Heurísticas regex documentadas**: 4 (auditor bash + 3 framework core regex)

## Counts atualizados

- Agents/commands/skills/gates: **inalterados** (patches editoriais)

## Próxima fase

Phase 130: Release artifacts — AUTOGEN-COUNTS regen (60→61 agents, 67→68 skills), file-manifest.json, CHANGELOG v1.23, glossário finalizado, MILESTONES.md transition.
