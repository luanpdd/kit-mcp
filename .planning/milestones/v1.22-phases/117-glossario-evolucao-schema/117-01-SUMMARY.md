# Phase 117 — Summary

**Status:** completed
**Data:** 2026-05-10
**Modo:** Materialização direta (autonomo workflow content-only)

## O que foi entregue

### Onda 1 (paralelo com Phase 119)

| Artefato | Linhas (~) | Conteúdo |
|---|---|---|
| `kit/skills/_shared-dados-distribuidos/glossary.md` | ~210 | 40+ termos canônicos PT-BR ↔ EN cobrindo capítulos 4, 5, 6, 7, 8, 9, 11 do DDIA + convenção de naming PT-BR v1.22 (seção i) + Cross-Suite Invocation Pattern herdado de v1.21 (seção k) + cross-ref ATIVO para `_shared-supabase` e `_shared-multi-tenant` |
| `kit/skills/evolucao-schema-compativel/SKILL.md` | ~310 | Frontmatter PT-BR + 6 REGRAs absolutas + 5 patterns canônicos com SQL/TS completos + 6 anti-patterns + checklist pré-merge + cross-refs |

### Estrutura do glossário (10 seções)

- (a) Modelos de Consistência (Ch 5, 9) — 6 termos
- (b) Replicação (Ch 5) — 6 termos
- (c) Transações e Isolamento (Ch 7) — 11 termos
- (d) Particionamento e Tenant Quente (Ch 6) — 7 termos
- (e) Sistemas Distribuídos: Armadilhas (Ch 8) — 6 termos
- (f) Consensus (Ch 9) — 7 termos
- (g) Encoding e Evolução (Ch 4) — 9 termos
- (h) Streams de Eventos (Ch 11) — 10 termos
- (i) **Convenção de naming PT-BR (v1.22+)** — regras + exemplos + rationale + checklist
- (j) Cross-Refs Externos
- (k) Cross-Suite Invocation Pattern

**Total: 62 termos PT-BR ↔ EN** (excede o mínimo de 15 do critério #1 em 4×).

### Estrutura da skill `evolucao-schema-compativel`

- 6 REGRAs absolutas (NOT NULL direto, DROP COLUMN, narrow type, mudar default, never-remove-required em payload, rolling upgrade preserva V1+V2)
- 5 patterns canônicos:
  1. Padrão 3-passos com SQL completo (3 migrations sequenciadas + DO loop de backfill em batches de 10k)
  2. Matriz Avro/Protobuf → Postgres (10 operações comparadas)
  3. Rename de coluna via view alias
  4. Mudança de default em coluna em uso (2-passos)
  5. Versionamento de payload em Edge Function TypeScript (V1 → V2 → V3) + rolling upgrade client-side com JWT/session compat
- 6 anti-patterns com Errado/Por quê/Certo
- Checklist pré-merge de migration
- Cross-refs ATIVOS para 6 skills v1.8/v1.22

## REQs cobertos (5/5)

| REQ | Status | Evidência |
|---|---|---|
| SUITE-03 | ✅ | Glossário canônico PT-BR ↔ EN com cross-ref ATIVO para `_shared-supabase` e `_shared-multi-tenant` (sem duplicação) |
| EVOLUCAO-01 | ✅ | Padrão 3-passos com SQL completo na skill (Migration 1 ADD COLUMN nullable; Migration 2 DO LOOP backfill 10k; Migration 3 NOT NULL via CHECK NOT VALID + VALIDATE pattern Postgres 12+) |
| EVOLUCAO-02 | ✅ | Seção "Versionamento de payload em Edge Functions Supabase" com TypeScript V1→V2→V3 demonstrando optional fields, never-remove-required, aliasing, deprecation warning |
| EVOLUCAO-03 | ✅ | Matriz Avro/Protobuf → Postgres (10 operações) + 3 patterns dedicados (rename via view, widening seguro vs narrowing inseguro, mudança de default 2-passos) |
| EVOLUCAO-04 | ✅ | Seção "Rolling upgrade client-side com JWT/session compat" com TypeScript demonstrando `app_metadata.schema_version` + adaptação de response server-side + `refreshSession()` após upgrade |

## Convenção PT-BR (v1.22+) — primeira aplicação

Esta phase é a **primeira materialização** da convenção PT-BR documentada em (i) do glossário:

- ✅ Diretório PT-BR: `evolucao-schema-compativel/`, `_shared-dados-distribuidos/`
- ✅ Frontmatter `description:` em PT-BR começando com "Use ao escrever migration..."
- ✅ Termos técnicos canônicos preservados em EN dentro da descrição: `rolling upgrade`, `Avro`, `Protobuf`, `NOT NULL`, `JWT/session compat`
- ✅ Headings em PT-BR: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Ver também`
- ✅ Texto narrativo em PT-BR
- ✅ Code blocks SQL/TS em EN com comentários PT-BR
- ✅ Cross-refs ATIVOS (links Markdown relativos) — sem duplicação de conteúdo do glossário

## Próxima fase

Onda 1 completa após Phase 117 + Phase 119. Onda 2 (Phases 118, 120, 121) pode iniciar em paralelo, dependentes apenas do glossário canônico (✓ disponível).

## Commits desta phase

1. `f224b69` — `feat(117): CONTEXT + PLAN inicial`
2. `2fef5ba` — `feat(117): glossário compartilhado _shared-dados-distribuidos`
3. `7af0567` — `feat(117): skill evolucao-schema-compativel`
4. (próximo) — `feat(117): SUMMARY + VERIFICATION`
