---
phase: 39
plan: 06
title: Patch supabase-storage-implementer — saturation signal (gauge bucket size + counter quota)
status: complete
completed_at: 2026-05-07
commits:
  - f92d95f
files_modified:
  - kit/agents/supabase-storage-implementer.md
requirements: [INT-SB-V2-04]
---

# Plan 06 — SUMMARY

## Goal recap

Estender `kit/agents/supabase-storage-implementer.md` (v1.8) com seção dedicada de **saturation signal** — `ObservableGauge` de bucket size em bytes (% do quota plan) + `Counter` de quota near-exhaustion events. Storage agora cobre os **4 signals canônicos** (Latency + Traffic + Errors via `## Observabilidade integrada` v1.9 + Saturation novo de v1.10). Cross-refs canônicas com a skill `four-golden-signals` (cap 6 livro Google SRE) e o agente `golden-signals-instrumenter`. Frontmatter v1.8 preservado byte-a-byte (anti-pitfall A2).

## What was changed

### `kit/agents/supabase-storage-implementer.md` (+156 linhas, -0)

Nova seção `## Saturation signal — bucket size + quota` adicionada **entre** `## Observabilidade integrada` e `## Ver também` (preserva ordem editorial existente). Conteúdo:

1. **Cross-ref bloco superior** — Markdown literal para `four-golden-signals` skill + `golden-signals-instrumenter` agent
2. **Tabela "Saturation = bucket size ÷ quota plan"** — 4 plans (Free/Pro/Team/Enterprise) com thresholds 80% (yellow) e 95% (red)
3. **Signal 1 — Gauge** — duas `createObservableGauge` (`storage_bucket_bytes` em bytes + `storage_saturation_pct` ratio 0..1) com callback async via SQL RPC
4. **SQL helper canônico** — function `public.storage_bucket_sizes_bytes()` com `security definer` + `set search_path = ''` (anti-pattern Supabase prevenido)
5. **Signal 2 — Counter** — `createCounter('storage_quota_warnings_total')` incrementado em pre-check de upload; emite `threshold: '95pct'` ou `'80pct'`
6. **Cron schedule** — materialized view `obs.storage_saturation` + `cron.schedule('refresh_storage_saturation', '* * * * *', ...)` para refresh por minuto
7. **Alert SLO YAML** — `storage_quota_healthy` event-based (target 0.99, window 30d_sliding, good_event saturation_pct < 0.80)
8. **Output do agent** — 5 artefatos sempre incluídos (function SQL, MV, gauge, counter, SLO)
9. **Anti-patterns prevenidos** — 4 items: saturation ≠ "% disco do servidor"; threshold direto vs SLO event-based; polling per-request vs MV+cron; quota hardcoded vs env var

`## Ver também` ganhou 2 entries (sem reordenar/substituir as 5 existentes):
- `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` — 4 sinais canônicos cap 6 SRE
- `[golden-signals-instrumenter](./golden-signals-instrumenter.md)` — agent retro-instrumenter

## Smoke validation results

| Check | Expected | Actual | Status |
|---|---|---|---|
| Frontmatter byte-identical | `name: supabase-storage-implementer`, `tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql`, `color: orange` | preservado | OK |
| `## Saturation signal` heading | == 1 | 1 | OK |
| `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` | ≥ 1 | 2 (body + Ver também) | OK |
| `[golden-signals-instrumenter](./golden-signals-instrumenter.md)` | ≥ 1 | 2 (body + Ver também) | OK |
| `createObservableGauge` | ≥ 2 | 2 (bucket_bytes + saturation_pct) | OK |
| `createCounter` | ≥ 1 | 1 (quota_warnings) | OK |
| Métricas canônicas (bucket_bytes / saturation_pct / quota_warnings_total / sizes_bytes / quota_healthy) | combined ≥ 5 | 11 | OK |
| `security definer` | ≥ 1 | 1 | OK |
| `## Observabilidade integrada` heading preserved | == 1 | 1 | OK |
| `## Ver também` heading preserved | == 1 | 1 | OK |
| `git diff --numstat` | insertions > 0; deletions ≤ 2 | 156 / 0 | OK |

## Acceptance criteria

- [x] Frontmatter byte-idêntico (não alterado)
- [x] Heading `## Saturation signal — bucket size + quota` adicionada (entre `## Observabilidade integrada` e `## Ver também`)
- [x] Tabela "Saturation = bucket size ÷ quota plan" com 4 plans (Free/Pro/Team/Enterprise) + thresholds 80/95%
- [x] OTel `ObservableGauge` × 2 (`storage_bucket_bytes` + `storage_saturation_pct`)
- [x] OTel `Counter` × 1 (`storage_quota_warnings_total`)
- [x] SQL function `storage_bucket_sizes_bytes()` com `security definer` + `set search_path = ''`
- [x] Materialized view `obs.storage_saturation` + pg_cron refresh
- [x] SLO YAML `storage_quota_healthy` event-based (target 0.99, 30d_sliding)
- [x] Bloco "Output do agent" lista 5 artefatos (function, MV, gauge, counter, SLO)
- [x] Anti-patterns explícitos (4 items)
- [x] Cross-refs Markdown ativos (skill + agent)
- [x] `## Ver também` ganhou 2 entries (sem reordenar existentes)
- [x] Cobre INT-SB-V2-04 integralmente

## Requirements coverage

- **INT-SB-V2-04** — `supabase-storage-implementer` agora cobre os 4 golden signals (3 do v1.9 em `## Observabilidade integrada` + Saturation novo de v1.10); saturation = bucket size / quota plan (recurso correto, não disco genérico); SQL function + MV + pg_cron + SLO event-based; cross-refs canônicas para skill `four-golden-signals` + agent `golden-signals-instrumenter`. COMPLETO.

## Commits

- `f92d95f` — feat(supabase-storage-implementer): add saturation signal section (gauge bucket size + counter quota)

## Notes

- Patch editorial substancial — adicionou ~156 linhas em uma única seção dedicada (a maior do milestone v1.10)
- v1.8 (`## Observabilidade integrada`) cobre 3 signals (latency/traffic/errors implícitos no span); v1.10 adiciona o **4º signal canônico** (saturation) que o livro SRE cap 6 prescreve
- Storage é caso especial: saturation tem recurso ÚNICO claramente identificado (quota plan), diferente de Edge Function onde varia (db_pool / queue / concurrency)
- Phase 41 vai criar gate `golden-signals-coverage` que regex-checa `histogram\|counter\|gauge\|saturation` em código tocado por fase — este patch garante que `gauge` + `counter` aparecem em todo storage tocado
- Pure addition (156/0); zero alteração em Steps 0-8 ou bloco `## Observabilidade integrada` v1.8
