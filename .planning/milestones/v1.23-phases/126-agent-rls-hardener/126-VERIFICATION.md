---
phase: 126
status: passed
verified_at: 2026-05-11
must_haves_total: 6
must_haves_verified: 6
must_haves_unverified: 0
---

# VERIFICATION — Phase 126: Agent novo `supabase-rls-hardener`

## Status: ✅ PASSED (6/6 must-haves verificados)

## Must-haves

### HARDEN-01: Agent recebe draft/plano SQL via `Task()` + contexto upstream

✅ Verificado.

Evidência: frontmatter `tools: ..., Task, mcp__supabase__execute_sql, ...` permite Task handoff. Seção "Inputs esperados (do caller via `Task()`)" documenta input format estruturado com 3 blocks XML-like: `<upstream_intent>` (caller name + goal + business rules), `<draft_sql>` (SQL draft), `<user_facing_caller>` (bool para REWRITE confirmation). Erro explícito se `upstream_intent` ausente.

### HARDEN-02: Verdict **GO** quando SQL já tem GRANT + RLS + indices + sem anti-patterns

✅ Verificado.

Evidência: seção "Verdict: GO — exemplo" mostra input com 5 blocos obrigatórios cobertos (CREATE TABLE + GRANT + ENABLE RLS + 4 policies + INDEX) + IS NOT NULL + (select) wrapper → output "7/7 checklist items passing. SQL pronto para apply."

### HARDEN-03: Verdict **STRENGTHEN** com diff explícito

✅ Verificado.

Evidência: seção "Verdict: STRENGTHEN — exemplo" mostra input pré-hardening (sem GRANT, sem wrapper, sem IS NOT NULL, sem INSERT/UPDATE/DELETE policies, sem index) + output com diff `+/-` explícito + 5 notas justificando cada mudança + nota "Intent preservado: continua user lê apenas suas próprias linhas".

### HARDEN-04: Verdict **REWRITE** apenas com confirmação obrigatória do caller

✅ Verificado.

Evidência: árvore de decisão no Step 3 documenta:
```
SE user_facing_caller=true: PARE, peça confirmação ao caller antes de prosseguir
SE user_facing_caller=false: aplique rewrite + devolva diff + nota de "BREAKING — intent preservado mas approach mudou"
NUNCA reescreva silenciosamente
```

Output format inclui seção "## Confirmação Pendente (apenas REWRITE com user_facing_caller=true)" com prompt explícito ao caller. Example "Verdict: REWRITE — exemplo" mostra detecção de 3 anti-patterns simultâneos (user_metadata + for all + sem wrapper) + bloco "Confirmação Pendente" ao final.

### HARDEN-05: Agent valida instalação de event trigger `rls_auto_enable` + oferece patch

✅ Verificado.

Evidência: seção dedicada "HARDEN-05: Validar Event Trigger `rls_auto_enable`" com:
- Query de detecção via `mcp__supabase__execute_sql`: `select count(*) from pg_event_trigger where evtname = 'ensure_rls' and evtenabled = 'O'`
- Patch SQL completo (função PLpgSQL + `create event trigger ensure_rls`) se trigger ausente
- Comportamento documentado: "se trigger ausente E project é novo, output adiciona seção '## Defense-in-Depth Setup Recommended' com o patch SQL + instrução 'Apply via supabase-migration-writer'. Não aplica direto — handoff cooperativo."

### HARDEN-06: Agent invocável cross-suite via `Task(subagent_type=supabase-rls-hardener)`

✅ Verificado.

Evidência: seção "Cross-suite invocação" lista tabela com 12 callers documentados:
- 8 agents v1.21: `multi-tenant-rls-writer`, `audit-log-implementer`, `crm-pipeline-implementer`, `org-onboarding-implementer`, `invite-flow-implementer`, `super-admin-implementer`, `evolution-go-integrator`, `lgpd-compliance-auditor`
- 1 agent v1.22: `auditor-consistencia-isolamento`
- 3 framework core: `planner`, `executor`, `debugger`

Pattern de invocação Python pseudo-code mostra estrutura `Task(subagent_type="supabase-rls-hardener", prompt=...)` com `<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>`.

## Verificação automatizada (grep checks)

Todos os grep checks dos success criteria do ROADMAP Phase 126 passam:

```bash
# HARDEN-04 + format consistency
grep -c "Verdict:" kit/agents/supabase-rls-hardener.md
# Esperado: ≥ 3 verdicts canônicos (encontrado: 6+ matches em header + 3 verdicts + examples)

# HARDEN-06 — cross-suite pattern documentado
grep -c "Task(subagent_type=\"supabase-rls-hardener\"" kit/agents/supabase-rls-hardener.md
# Esperado: ≥ 1 (encontrado: 1 match no Python pseudo-code)

# HARDEN-06 — 12 callers na tabela
grep -c "multi-tenant-rls-writer\|audit-log-implementer\|crm-pipeline-implementer\|org-onboarding-implementer\|invite-flow-implementer\|super-admin-implementer\|evolution-go-integrator\|lgpd-compliance-auditor\|auditor-consistencia-isolamento\|planner.*framework\|executor.*framework\|debugger.*framework" kit/agents/supabase-rls-hardener.md
# Esperado: ≥ 12 (encontrado: 12 distinct matches na tabela)

# HARDEN-05 — query SQL + patch
grep -A 3 "select count.*pg_event_trigger" kit/agents/supabase-rls-hardener.md
# Esperado: query de detecção (encontrado)
```

## Cobertura

6/6 must-haves verificados (100%). Sem human-verification pendente. Sem gaps.

## Notas

- Agent é "canonical handoff target" para Phases 127-129
- Contrato versionado em frontmatter — input format `<upstream_intent>` é estável
- Observabilidade integrada (span structured) facilita Core Analysis Loop investigation de drift
- Cross-ref ativo desde skill `supabase-rls-policies` (Phase 124) e `supabase-rls-defense-in-depth` (Phase 125)
