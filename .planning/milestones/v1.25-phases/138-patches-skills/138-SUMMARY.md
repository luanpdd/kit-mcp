# SUMMARY — Phase 138: Patches em skills existentes (rls-policies + defense-in-depth + database-functions + rbac-permissions-matrix-supabase)

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 4/4 (SKILL-PATCH-01..SKILL-PATCH-04)
**Commits:** 1 atomic

## Mudanças por REQ

| REQ | Skill | Mudança |
|-----|-------|---------|
| SKILL-PATCH-01 | `supabase-rls-policies` | Section "RBAC via Custom Claims + authorize() function (v1.25)" antes de "Combining RLS with Column-Level Privileges (v1.24)" — pattern v1.25 vs v1.21 + vantagens + caveat JWT freshness + recomendação combinar custom claim + helper function PG para multi-tenant |
| SKILL-PATCH-02 | `supabase-rls-defense-in-depth` | Camada 9 (Auth Hooks - Custom Claims) na lista de princípios + DEFENSE-07 no checklist (era 8 itens → 9 itens) |
| SKILL-PATCH-03 | `supabase-database-functions` | Pattern "Custom Access Token Auth Hook (v1.25)" no Patterns canônicos com SQL completo + 6 GRANTs/REVOKEs canônicos para supabase_auth_admin + decisões canônicas (stable vs volatile, sem security definer, REVOKE FROM public obrigatório) |
| SKILL-PATCH-04 | `rbac-permissions-matrix-supabase` (v1.21) | Section "Mecanismo de delivery dos claims (v1.25 update)" — tabela comparativa helper function STABLE vs Custom Claim + recomendação combinar ambos para B2B multi-tenant + example policy combinada |

## Métricas

- **Arquivos modificados**: 4 skills
- **Patches editoriais**: 5 (1 em rls-policies, 2 em defense-in-depth, 1 em database-functions, 1 em rbac-permissions-matrix)
- **Camadas defense-in-depth**: 8 → 9 (Camada 9 = Auth Hooks Custom Claims)
- **Checklist defense-in-depth items**: 8 → 9 (DEFENSE-07 adicionado)
- **Cross-refs adicionados**: 4+ para skill nova `supabase-custom-claims-rbac` (Phase 137)
