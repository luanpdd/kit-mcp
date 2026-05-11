# SUMMARY — Phase 131: Skill nova `supabase-column-level-security`

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 8/8 (COL-01..COL-08)
**Commits:** 1 atomic

## O que foi feito

Criada skill nova `kit/skills/supabase-column-level-security/SKILL.md` documentando 100% da documentação oficial Supabase Column Level Security — GRANT/REVOKE column-level, table-level vs column-level distinção, wildcard `*` restriction caveat, impacto cross-operation, integração com RLS, dedicated role table pattern (recomendado pela doc), Studio dashboard reference, anti-patterns. Aviso explícito embutido: "advanced feature — não recomendado para maioria dos casos".

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| COL-01 | GRANT/REVOKE column-level basics — section "Princípio canônico" + Pattern 1 | `grep -c "grant.*update.*\(.*\).*on table\|revoke.*update.*on table" SKILL.md` ≥ 2 |
| COL-02 | Table-level vs column-level distinção — section "Princípio canônico" com SQL passo-a-passo | section explicita hierarquia + exemplo concreto |
| COL-03 | Wildcard `*` restriction — Caveat #1 dedicated + erro Postgres exemplo + SDK Supabase implication | `grep -c "wildcard\|SELECT \*\|select \*" SKILL.md` ≥ 4 |
| COL-04 | Considerações cross-operation — Caveat #2 dedicated com tabela INSERT/UPDATE/DELETE/SELECT + exemplos | section "Caveat #2 — Impacto cross-operation" |
| COL-05 | Integração com RLS row-level — Pattern 1 (UPDATE restricted + RLS owner check) + Pattern 2 (SELECT PII + RLS own row) | patterns mostram combinação canônica |
| COL-06 | Dedicated role table pattern — section dedicada com SQL completo (user_roles table + helper function + RLS policy) + 5 vantagens vs column-level | section "Dedicated role table pattern (RECOMENDADO pela doc oficial)" |
| COL-07 | Studio Dashboard reference — section "Studio Dashboard (Supabase UI)" com path + caveat de não-versionamento | section explicita "Feature Preview > Column Privileges" |
| COL-08 | Anti-patterns + caveats — section "Anti-patterns" com 4 anti-patterns numerados (Errado/Por quê/Certo) | `grep -c "### Anti-pattern" SKILL.md` ≥ 4 |

## Métricas

- **Skill nova criada**: `kit/skills/supabase-column-level-security/SKILL.md` (440+ linhas)
- **Caveats canônicos documentados**: 2 (wildcard + cross-operation)
- **Patterns canônicos**: 4 (UPDATE restricted, SELECT PII, audit log protected, token raw service-role-only)
- **Anti-patterns documentados**: 4 (sem revoke prévio, `SELECT *` esperando funcionar, em vez de dedicated role, INSERT esquecendo defaults)
- **Auditoria query SQL**: 1 (detectar tabelas com PII sem column privileges)
- **Cross-refs ativos**: 6+ para skills/agents v1.23 + futuros artefatos v1.24

## Counts atualizados

- Skills antes de Phase 131: 68 → após: 69 (+1: `supabase-column-level-security`)
- Agents/commands/gates: inalterados

## Próxima fase

Phase 132: Patches em skills existentes (rls-policies + migrations + defense-in-depth) integrando column-level security.
