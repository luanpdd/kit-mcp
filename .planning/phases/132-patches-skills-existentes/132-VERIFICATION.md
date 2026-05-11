---
phase: 132
status: passed
verified_at: 2026-05-11
must_haves_total: 3
must_haves_verified: 3
must_haves_unverified: 0
---

# VERIFICATION — Phase 132: Patches em skills existentes

## Status: ✅ PASSED (3/3 must-haves verificados)

## Must-haves

### COL-09: `supabase-rls-policies` ganha section "Combining RLS with Column-Level Privileges (v1.24)"

✅ Verificado. Section adicionada entre patterns canônicos e "Bypassing RLS — quando e como" com:
- Distinção RLS row-level vs column-level
- Pattern SQL canônico combinado (REVOKE + GRANT column-level + RLS policy)
- "Quando combinar" + "Quando NÃO combinar"
- Caveat wildcard `*` restriction
- Cross-ref ativo para skill `supabase-column-level-security`

### COL-10: `supabase-migrations` template canônico ganha BLOCO 6 opcional

✅ Verificado. Template "5 blocos obrigatórios" expandido para "BLOCO 6 (v1.24, OPCIONAL)" no template canônico + example concreto "Criar tabela com 5 blocos obrigatórios" também atualizado com BLOCO 6 reference. Aviso explícito "adicionar APENAS se há colunas sensíveis (PII, billing, audit payload, tokens raw)" + recomendação "para casos comuns, prefira RLS + dedicated role table".

### COL-11: `supabase-rls-defense-in-depth` ganha Camada 8 + checklist 8-item

✅ Verificado. Mudanças aplicadas:
- Section "Princípio canônico" expandida de 6 para 8 camadas (Camada 7 = Cooperative handoff via hardener v1.23, Camada 8 = Column-Level Privileges v1.24)
- Section nova "DEFENSE-06 (v1.24): Column-Level Privileges para PII/audit/billing/tokens" com 4 sub-sections (Quando aplicar, Pattern canônico, Caveat wildcard, Auditoria query SQL)
- Checklist defense-in-depth atualizado de 7 para 8 itens (DEFENSE-06 adicionado)
- Cross-ref ativo para skill nova `supabase-column-level-security` (Phase 131) e agents `supabase-rls-hardener` (Detector 8 — Phase 134) + `supabase-column-privileges-writer` (Phase 133)

## Verificação automatizada

```bash
# COL-09
grep -c "Combining RLS with Column-Level\|column-level" kit/skills/supabase-rls-policies/SKILL.md
# Esperado: ≥ 2

# COL-10
grep -c "BLOCO 6\|column.level.*privileges" kit/skills/supabase-migrations/SKILL.md
# Esperado: ≥ 2

# COL-11
grep -c "Camada 8\|DEFENSE-06\|column-level privileges" kit/skills/supabase-rls-defense-in-depth/SKILL.md
# Esperado: ≥ 4
```

## Cobertura

3/3 must-haves verificados (100%). Sem human-verification pendente. Sem gaps.

## Notas

- Patches aditivos: comportamento default v1.24 preservado para callers existentes
- BLOCO 6 é OPCIONAL — não força projetos sem PII a aplicar column-level
- Aviso "advanced feature, usar com parcimônia" preservado em todos os 3 artefatos
- Phase 133 vai usar este pattern para criar agent `supabase-column-privileges-writer`
