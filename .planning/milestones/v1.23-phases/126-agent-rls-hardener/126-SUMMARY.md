# SUMMARY — Phase 126: Agent novo `supabase-rls-hardener`

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 6/6 (HARDEN-01..HARDEN-06)
**Commits:** 1 atomic

## O que foi feito

Criado agent canônico `kit/agents/supabase-rls-hardener.md` (332 linhas) que recebe draft SQL via `Task()` upstream context + intent original e produz SQL final hardenado preservando intent. Implementa verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação. Base para handoff cooperativo cross-suite em Phases 127-129.

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| HARDEN-01 | Frontmatter + seção "Inputs esperados (do caller via `Task()`)" com bloco XML-like (`<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>`) | `grep -c "<upstream_intent>\|<draft_sql>\|<user_facing_caller>" kit/agents/supabase-rls-hardener.md` ≥ 3 |
| HARDEN-02 | Seção "Verdict: GO — exemplo" mostrando 7/7 checklist passing | `grep -A 5 "Verdict: GO" kit/agents/supabase-rls-hardener.md` retorna example completo |
| HARDEN-03 | Seção "Verdict: STRENGTHEN — exemplo" com diff explícito (GRANT adicionado, wrapper aplicado, IS NOT NULL, INSERT/UPDATE/DELETE policies, index) | `grep -A 20 "Verdict: STRENGTHEN" kit/agents/supabase-rls-hardener.md` retorna diff + notas |
| HARDEN-04 | Seção "Verdict: REWRITE — exemplo (com user_facing_caller=true)" + bloco "Confirmação Pendente" no output format + step 3 da árvore decisão | `grep -c "Confirmação Pendente\|user_facing_caller" kit/agents/supabase-rls-hardener.md` ≥ 3 |
| HARDEN-05 | Seção "HARDEN-05: Validar Event Trigger `rls_auto_enable`" com query de detecção + patch SQL completo se ausente | `grep -A 15 "HARDEN-05" kit/agents/supabase-rls-hardener.md` retorna query + patch |
| HARDEN-06 | Tabela "Cross-suite invocação" com 12 callers documentados (8 v1.21 + 1 v1.22 + 3 framework core) + pattern Python pseudo-code | `grep -c "Task(subagent_type=supabase-rls-hardener" kit/agents/supabase-rls-hardener.md` ≥ 1; tabela com 12 rows |

## Métricas

- **Agent novo criado**: `kit/agents/supabase-rls-hardener.md` (332 linhas)
- **Verdicts canônicos documentados**: 3 (GO, STRENGTHEN, REWRITE)
- **Anti-patterns prevenidos documentados**: 10 (todos cross-ref para skill `supabase-rls-policies` v1.23)
- **Cross-suite callers documentados**: 12 (multi-tenant-rls-writer, audit-log-implementer, crm-pipeline-implementer, org-onboarding-implementer, invite-flow-implementer, super-admin-implementer, evolution-go-integrator, lgpd-compliance-auditor, auditor-consistencia-isolamento, planner, executor, debugger)
- **Defense-in-depth checklist items**: 7 (C1..C7)
- **Examples concretos**: 3 (1 por verdict)

## Counts atualizados

- Agents antes de Phase 126: 60 → após: 61 (+1: `supabase-rls-hardener`)
- Commands/skills/gates: inalterados

## Próxima fase

Phase 127: Patches em agents Supabase existentes (rls-writer, migration-writer, command) para emitir output conforme novos templates + invocar `supabase-rls-hardener` automaticamente em CREATE TABLE.
