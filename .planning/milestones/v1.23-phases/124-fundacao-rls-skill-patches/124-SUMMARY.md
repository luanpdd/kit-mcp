# SUMMARY — Phase 124: Fundação RLS

**Concluído:** 2026-05-10
**Status:** ✅ Completed
**REQs entregues:** 8/8 (RLS-01..RLS-07, MIGR-01)
**Commits:** 1 atomic

## O que foi feito

Incorporados 100% da documentação oficial Supabase RLS na skill `kit/skills/supabase-rls-policies/SKILL.md` (185 → 401 linhas) e adicionado template canônico de 5 blocos obrigatórios na skill `kit/skills/supabase-migrations/SKILL.md` (CREATE TABLE → GRANT → ENABLE RLS → 4 policies → INDEX).

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| RLS-01 | Seção "Setup canônico — GRANTs + ENABLE RLS" + regra absoluta `GRANT antes de ENABLE RLS` | `grep -c "grant select on" kit/skills/supabase-rls-policies/SKILL.md` ≥ 3 |
| RLS-02 | REGRA #3 + padrão `auth.uid() IS NOT NULL AND ...` em todos patterns canônicos | `grep -c "IS NOT NULL" kit/skills/supabase-rls-policies/SKILL.md` ≥ 8 |
| RLS-03 | Seção "Views com `security_invoker=true` (Postgres 15+)" + Anti-pattern #6 | `grep -c "security_invoker" kit/skills/supabase-rls-policies/SKILL.md` ≥ 3 |
| RLS-04 | Seção "`anon` Postgres role vs anonymous Auth user (v1.23)" | `grep -c "is_anonymous" kit/skills/supabase-rls-policies/SKILL.md` ≥ 1 |
| RLS-05 | Seção "Performance — recomendações canônicas (v1.23)" com 6 recommendations + benchmarks oficiais | `grep -c "improvement" kit/skills/supabase-rls-policies/SKILL.md` ≥ 5 |
| RLS-06 | Seção "`app_metadata` vs `user_metadata` — caveats canônicos (v1.23)" com 3 caveats | `grep -c "raw_app_meta_data\|raw_user_meta_data\|JWT freshness\|cookie 4096" kit/skills/supabase-rls-policies/SKILL.md` ≥ 4 |
| RLS-07 | Seção "Defense in depth — RLS como camada (v1.23)" no topo + Bypassing RLS seção dedicada | `grep -c "defense in depth\|Defense in depth" kit/skills/supabase-rls-policies/SKILL.md` ≥ 2 |
| MIGR-01 | Template canônico v1.23 com 5 blocos obrigatórios + example "Criar tabela" reescrita | `grep -c "BLOCO [1-5]" kit/skills/supabase-migrations/SKILL.md` ≥ 10 |

## Métricas

- **Linhas adicionadas** (skill supabase-rls-policies): +216 linhas (185 → 401)
- **Linhas adicionadas** (skill supabase-migrations): +85 linhas
- **Anti-patterns expandidos**: 4 → 7 em supabase-rls-policies
- **Regras absolutas**: 6 → 9 em supabase-rls-policies (adicionado GRANT, IS NOT NULL, views security_invoker)

## Próxima fase

Phase 125: Skill nova `supabase-rls-defense-in-depth` + glossário parcial. Cross-ref ativo desde supabase-rls-policies (linha "Bypassing RLS — quando e como").
