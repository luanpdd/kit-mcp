# SUMMARY — Phase 140: Patches agents Supabase (rls-hardener + auth-bootstrapper + /supabase command)

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 5/5 (HARDEN-09, HARDEN-10, AUTH-PATCH-01, CMD-05, CMD-06)
**Commits:** 1 atomic

## Mudanças por REQ

| REQ | Arquivo | Mudança |
|-----|---------|---------|
| HARDEN-09 | `supabase-rls-hardener.md` | Checklist defense-in-depth C9 (custom claims auth hook) + section "HARDEN-09 (v1.25): Detector 9" com query SQL detecção (pg_proc + has_function_privilege) |
| HARDEN-10 | `supabase-rls-hardener.md` | Section "HARDEN-10 (v1.25): Chain cooperativo" com Task() pseudo-code para `supabase-rbac-implementer`; comportamento OPT-IN (só ativado se user_roles table detectada) |
| AUTH-PATCH-01 | `supabase-auth-bootstrapper.md` | Section "Custom Claims & RBAC integration (v1.25)" com 4 sub-steps: jwt-decode dependency, client.ts listener com decoder, server.ts helper getUserRole(), handoff cooperativo para rbac-implementer + 3 caveats |
| CMD-05 | `supabase.md` | Tabela subcomandos + section "Resolver Sinônimos" ganham `rbac, roles, permissions, claims → supabase-rbac-implementer` |
| CMD-06 | `supabase.md` | Section "Subcomando `rbac` (v1.25 novo)" dedicada com aviso pattern recomendado + caveat JWT freshness + input format `<roles>` + `<permissions_matrix>` + `<multi_tenant>` |

## Métricas

- **Arquivos modificados**: 3 (`supabase-rls-hardener.md`, `supabase-auth-bootstrapper.md`, `supabase.md` command)
- **Patches editoriais**: 5
- **Checklist defense-in-depth items**: 8 → 9 (C9 = custom claims auth hook)
- **Detectors no hardener**: 8 → 9 (Detector 9 v1.25)
- **Subcomandos no `/supabase`**: 12 (pré-v1.25) + 1 (rbac v1.25) = 13 total
