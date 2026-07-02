---
phase: 131
status: passed
verified_at: 2026-05-11
must_haves_total: 8
must_haves_verified: 8
must_haves_unverified: 0
---

# VERIFICATION — Phase 131: Skill nova `supabase-column-level-security`

## Status: ✅ PASSED (8/8 must-haves verificados)

## Must-haves

Todos os 8 REQs cobertos com seções dedicadas, exemplos SQL concretos, e cross-refs ativos.

| REQ | Section/Element | Status |
|-----|-----------------|--------|
| COL-01 | "Princípio canônico" + Pattern 1 (UPDATE restricted) com SQL GRANT/REVOKE column-level | ✅ |
| COL-02 | "Princípio canônico" — table-level vs column-level com hierarquia explícita | ✅ |
| COL-03 | "Caveat #1 — Wildcard `*` restriction" dedicada + erro Postgres concreto + SDK implication | ✅ |
| COL-04 | "Caveat #2 — Impacto cross-operation" com tabela INSERT/UPDATE/DELETE/SELECT | ✅ |
| COL-05 | Patterns 1+2 mostram combinação RLS row-level + column-level privileges | ✅ |
| COL-06 | "Dedicated role table pattern (RECOMENDADO pela doc oficial)" com SQL completo + 5 vantagens | ✅ |
| COL-07 | "Studio Dashboard (Supabase UI)" — path + caveat de não-versionamento | ✅ |
| COL-08 | "Anti-patterns" com 4 anti-patterns numerados (Errado/Por quê/Certo) | ✅ |

## Verificação automatizada

```bash
grep -c "grant.*update.*on table\|grant.*select.*on table\|revoke.*update.*on table" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 8 (patterns canônicos com SQL completo)

grep -c "wildcard\|SELECT \*\|select \*" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 4 (caveat documentado em múltiplos lugares)

grep -c "dedicated role table\|advanced feature\|usar com parc\|Quando NÃO" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 3 (recomendação canônica destacada)

grep -c "### Anti-pattern\|## Anti-patterns" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 5 (4 anti-patterns + header)
```

## Cobertura

8/8 must-haves verificados (100%). Sem human-verification pendente. Sem gaps.

## Notas

- Skill standalone — não modifica artefatos existentes (Phase 132 fará patches em rls-policies/migrations/defense-in-depth)
- Aviso "advanced feature — usar com parcimônia" embutido no topo + várias menções ao longo
- Cross-refs ativos para skills v1.23 (rls-policies, defense-in-depth) e agents/skills futuros v1.24 (column-privileges-writer Phase 133, rls-hardener Detector 8 Phase 134)
- Auditoria query SQL ajuda Phase 134 (Detector 8 do hardener)
