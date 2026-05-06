# Phase 27 — Summary

**Status:** Concluída
**Concluída em:** 2026-05-06
**Commit:** `abc99ee`

## REQs entregues (2/2)

| REQ | Deliverable |
|---|---|
| SB-C01 | `kit/commands/supabase.md` orquestrador único com 10 subcomandos + sinônimos PT/EN |
| SB-C02 | Dispatch via `Task(subagent_type=supabase-...)` para 7 agents Supabase + `schema-checker`. Detecta `supabase/config.toml` para `project_id`. Único ponto de chain (anti-pitfall A10) |

## Subcomandos suportados

- `arquiteto`/`architect` → supabase-architect
- `migration`/`migrar` → supabase-migration-writer
- `rls` → supabase-rls-writer
- `edge`/`funcao` → supabase-edge-fn-writer
- `realtime`/`tempo-real` → supabase-realtime-implementer
- `auth`/`autenticacao` → supabase-auth-bootstrapper
- `storage`/`armazenamento` → supabase-storage-implementer
- `rag`/`pgvector`/`embeddings` → supabase-edge-fn-writer (modo embedding)
- `cron`/`queues`/`pgmq` → supabase-edge-fn-writer (modo cron→pgmq→Edge)
- `check`/`validar` → schema-checker (existente)
- `help`/`ajuda`/`?` → exibe tabela inline

## Anti-pitfalls cobertos

- A10 (orquestração centralizada), A5 (subcomando `check` invoca schema-checker), B2 (Free heartbeat), B8 (branch billing alert)
