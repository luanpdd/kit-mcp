---
phase: 39
plan: 05
title: Patch supabase-migration-writer — alerta sobre toil em scripts SQL repetitivos
status: complete
completed_at: 2026-05-07
commits:
  - 77c67d9
files_modified:
  - kit/agents/supabase-migration-writer.md
requirements: [INT-SB-V2-03]
---

# Plan 05 — SUMMARY

## Goal recap

Estender `kit/agents/supabase-migration-writer.md` (v1.8) com seção dedicada de **alerta toil** para padrões SQL recorrentes (REINDEX, VACUUM, REFRESH MATERIALIZED VIEW, ANALYZE, DELETE retention) — agent agora detecta operações toil-prone e alerta proativamente sugerindo automação via `pg_cron`. Cross-refs canônicas com a skill `eliminating-toil` (cap 5 livro Google SRE) e o agente `toil-auditor`. Frontmatter v1.8 preservado byte-a-byte (anti-pitfall A2).

## What was changed

### `kit/agents/supabase-migration-writer.md` (+80 linhas, -0)

Nova seção `## Alerta toil — automação via pg_cron` adicionada como **última seção** do arquivo, posicionada **após** `## Observabilidade integrada`. Conteúdo:

1. **Cross-ref bloco superior** — Markdown literal para `eliminating-toil` skill + `toil-auditor` agent
2. **Tabela "6 critérios — quando uma migration é toil-prone"** — manual, repetitivo, automatizável, tático, sem valor durável, escala linear
3. **Tabela "Padrões SQL canônicos que SEMPRE disparam alerta toil"** — 6 rows: REINDEX, VACUUM ANALYZE, REFRESH MATERIALIZED VIEW, ANALYZE pós-bulk, DELETE retention, dump+restore
4. **Snippet canônico ANTES/DEPOIS** — converter `psql -c 'reindex table heavy_table'` manual em `cron.schedule('reindex_heavy_table_biweekly', '0 3 1,15 * *', $$...$$)`
5. **Bloco "Quando NÃO automatizar"** — DDL one-shot, backfill único, rebuild com julgamento
6. **Bloco "Output do agent — adicionado ao SQL gerado"** — template comentário SQL `⚠ TOIL ALERT —` com regex de detecção (`reindex|vacuum|refresh materialized|delete from .* interval`)
7. **Bloco "Anti-patterns prevenidos"** — 4 items: "roda quando der", `pg_cron` sem alerta de falha, automação parcial, "só uma vez por mês"

## Smoke validation results

| Check | Expected | Actual | Status |
|---|---|---|---|
| Frontmatter byte-identical | `name: supabase-migration-writer`, `tools: ...mcp__supabase__apply_migration`, `color: yellow` | preservado | OK |
| `## Alerta toil` heading | == 1 | 1 | OK |
| `[eliminating-toil](../skills/eliminating-toil/SKILL.md)` | ≥ 1 | 1 | OK |
| `[toil-auditor](./toil-auditor.md)` | ≥ 1 | 1 | OK |
| `pg_cron` / `cron.schedule` | ≥ 3 | 20 | OK |
| REINDEX/VACUUM/REFRESH MATERIALIZED/TOIL ALERT (combined) | ≥ 4 | 10 | OK |
| `## Observabilidade integrada` heading preserved | == 1 | 1 | OK |
| `git diff --numstat` | insertions > 0; deletions == 0 | 80/0 | OK |

## Acceptance criteria

- [x] Frontmatter byte-idêntico (não alterado)
- [x] Heading `## Alerta toil — automação via pg_cron` adicionada (após `## Observabilidade integrada`, última seção)
- [x] 6 critérios canônicos tabulados (manual, repetitivo, automatizável, tático, sem valor durável, escala linear)
- [x] Padrões SQL toil-prone tabulados (6 rows: REINDEX, VACUUM, REFRESH MV, ANALYZE, DELETE retention, dump+restore)
- [x] Snippet `cron.schedule(...)` canônico presente
- [x] Bloco "Quando NÃO automatizar" diferencia toil de DDL one-shot, backfill único, rebuild com julgamento
- [x] Template comentário SQL `⚠ TOIL ALERT —` para output do agent
- [x] Anti-patterns explícitos (4 items)
- [x] Cross-refs Markdown ativos (skill + agent)
- [x] Cobre INT-SB-V2-03 integralmente

## Requirements coverage

- **INT-SB-V2-03** — `supabase-migration-writer` detecta padrões SQL recorrentes e alerta com automação `pg_cron` cross-ref a `eliminating-toil` (skill) + `toil-auditor` (agent). COMPLETO.

## Commits

- `77c67d9` — feat(supabase-migration-writer): add toil alert section for pg_cron automation

## Notes

- Patch puramente aditivo (80/0); zero alteração em Steps 0-6 ou bloco `## Observabilidade integrada` v1.8
- Mantém posicionamento canônico (última seção) e padrão editorial PT-BR + en-dashes + code fences sql consistentes
- Phase 40 vai integrar `/auditar-marco` para invocar `/auditar-toil` automaticamente; este patch garante alertas toil já aparecem nas migrations geradas durante o milestone
