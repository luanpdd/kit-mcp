# Plano: Fase 131 — Skill nova `supabase-column-level-security`

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** COL-01..COL-08 (8 REQs)

## Objetivo

Criar skill `kit/skills/supabase-column-level-security/SKILL.md` documentando 100% da documentação oficial Supabase Column Level Security.

## Tarefas

1. **Criar dir + frontmatter** — `kit/skills/supabase-column-level-security/SKILL.md` com `name` + `description` + trigger phrases
2. **COL-01..COL-08** — incorporar conteúdo doc oficial:
   - Section "Quando usar (e quando NÃO usar)" com lista de casos válidos + alternativas
   - Section "Princípio canônico" — table-level vs column-level hierarchy
   - Caveat #1 — Wildcard `*` restriction
   - Caveat #2 — Impacto cross-operation
   - 4 patterns concretos (UPDATE restricted, SELECT PII, audit log protected, token raw)
   - Dedicated role table pattern (recomendado pela doc)
   - Studio Dashboard reference (Feature Preview)
   - Manage column privileges in migrations (BLOCO 6 reference)
   - Auditoria query SQL
   - 4 anti-patterns
   - Cross-suite integration (v1.24)
   - Ver também

## Arquivos criados

- `kit/skills/supabase-column-level-security/SKILL.md` (skill nova, ~400 linhas)

## Validação

```bash
grep -c "grant.*on table\|revoke.*on table" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 8 (patterns canônicos)

grep -c "wildcard\|SELECT \*\|select \*" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 4 (caveat documentado)

grep -c "dedicated role table\|advanced feature\|usar com parc" kit/skills/supabase-column-level-security/SKILL.md
# Esperado: ≥ 2 (recomendação canônica)
```

## Riscos

- **Risco baixo:** Skill standalone. Aditiva, sem breaking changes.
- **Mitigação:** Aviso "advanced feature" claro; recomenda dedicated role table como alternativa preferida.
