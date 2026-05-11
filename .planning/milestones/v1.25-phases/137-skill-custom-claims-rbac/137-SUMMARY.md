# SUMMARY — Phase 137: Skill nova `supabase-custom-claims-rbac`

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 10/10 (CLAIMS-01..CLAIMS-10)
**Commits:** 1 atomic

## O que foi feito

Criada skill nova `kit/skills/supabase-custom-claims-rbac/SKILL.md` documentando 100% da documentação oficial Supabase Custom Claims & RBAC via Custom Access Token Auth Hook — 7 passos canônicos (enum types, tables, hook function, supabase_auth_admin grants, authorize function, RLS policies, client decoder) + anti-patterns + caveat JWT freshness + comparação com 3 mecanismos de delivery (app_metadata, helper function STABLE, custom claims via auth hook).

## Mudanças por REQ

| REQ | Section/Element |
|-----|-----------------|
| CLAIMS-01 | "Passo 1: Enum types" — `app_role` e `app_permission` com SQL completo + caveat ALTER TYPE não transacional |
| CLAIMS-02 | "Passo 2: Tabelas user_roles + role_permissions" — N:1 user→role e N:N role→permission com unique constraints + seed inicial |
| CLAIMS-03 | "Passo 3: Custom Access Token Auth Hook function" — SQL completo `custom_access_token_hook(event jsonb)` + variante multi-role com array_agg |
| CLAIMS-04 | "Passo 4: Permissions canônicos para supabase_auth_admin" — 6 GRANTs/REVOKEs canônicos + RLS policy permissive para auth_admin |
| CLAIMS-05 | "Passo 6: authorize() function" — `security definer` + `set search_path = ''` + decisões canônicas (stable, security definer) |
| CLAIMS-06 | "Passo 7: RLS policies usando authorize()" — pattern `(SELECT authorize('permission'))` + vantagens vs hardcode role |
| CLAIMS-07 | "Passo 5: Habilitar o hook" — Dashboard (Authentication > Hooks Beta) + local development config.toml |
| CLAIMS-08 | "Client-side — acessar custom claims" — jwt-decode + onAuthStateChange + Next.js v16 SSR pattern + backend libraries lista |
| CLAIMS-09 | "⚠ Caveat — JWT Freshness" — tabela cenários + auth.admin.signOut() para invalidação imediata |
| CLAIMS-10 | "Anti-patterns" — 5 anti-patterns numerados (esquecer GRANT auth_admin, hardcode role, assumir JWT fresh, mutar app_metadata cliente, hook custoso) |

## Métricas

- **Skill nova criada**: `kit/skills/supabase-custom-claims-rbac/SKILL.md` (~470 linhas)
- **7 passos canônicos documentados**: enum types → tables → hook function → auth_admin grants → habilitar hook → authorize function → RLS policies
- **Anti-patterns**: 5 (esquecer GRANT, hardcode role, JWT freshness, mutar app_metadata, hook custoso)
- **3 mecanismos de delivery comparados**: app_metadata vs helper function STABLE vs custom claims (RECOMENDADO v1.25)
- **Cross-refs ativos**: 8+ para skills v1.21/v1.23/v1.24 + agents v1.23/v1.25

## Counts atualizados

- Skills antes de Phase 137: 69 → após: 70 (+1: `supabase-custom-claims-rbac`)
- Agents/commands/gates: inalterados

## Próxima fase

Phase 138: Patches em 4 skills existentes (rls-policies, defense-in-depth, database-functions, rbac-permissions-matrix-supabase).
