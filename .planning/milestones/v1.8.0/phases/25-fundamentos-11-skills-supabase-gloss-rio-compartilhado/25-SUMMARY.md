# Phase 25 — Summary

**Status:** Concluída
**Concluída em:** 2026-05-06
**Commits:** `37e7750` (Wave 1), `6ed78fb` (Wave 2), `9fe8e56` (Wave 3)

## REQs entregues (12/12)

| REQ | Deliverable | Commit |
|---|---|---|
| SB-S01 | `kit/skills/supabase-realtime/SKILL.md` | 6ed78fb |
| SB-S02 | `kit/skills/supabase-auth-ssr/SKILL.md` | 6ed78fb |
| SB-S03 | `kit/skills/supabase-edge-functions/SKILL.md` | 9fe8e56 |
| SB-S04 | `kit/skills/supabase-declarative-schema/SKILL.md` | 6ed78fb |
| SB-S05 | `kit/skills/supabase-rls-policies/SKILL.md` | 37e7750 |
| SB-S06 | `kit/skills/supabase-database-functions/SKILL.md` | 37e7750 |
| SB-S07 | `kit/skills/supabase-migrations/SKILL.md` | 6ed78fb |
| SB-S08 | `kit/skills/supabase-postgres-style/SKILL.md` | 37e7750 |
| SB-S09 | `kit/skills/supabase-storage/SKILL.md` | 9fe8e56 |
| SB-S10 | `kit/skills/supabase-pgvector-rag/SKILL.md` | 9fe8e56 |
| SB-S11 | `kit/skills/supabase-cron-queues/SKILL.md` | 9fe8e56 |
| SB-D01 | `kit/skills/_shared-supabase/glossary.md` | 37e7750 |

## Verificação must-include strings (todas presentes)

- ✓ `(select auth.uid())` em supabase-rls-policies
- ✓ `WARNING — REGRA #1` cobrindo `user_metadata` em supabase-rls-policies
- ✓ `set search_path = ''` em supabase-database-functions
- ✓ `SECURITY INVOKER` em supabase-database-functions
- ✓ `getAll`/`setAll` + `NEVER use auth-helpers-nextjs` em supabase-auth-ssr
- ✓ `broadcast`, `private: true`, `realtime.broadcast_changes`, `removeChannel` em supabase-realtime
- ✓ `npm:`/`jsr:`, `Deno.serve`, `EdgeRuntime.waitUntil`, `/tmp` em supabase-edge-functions
- ✓ `signed URL`, `storage.objects`, multi-tenant path em supabase-storage
- ✓ `HNSW`, `IVFFlat`, `<=>`, RAG with permissions em supabase-pgvector-rag
- ✓ `pg_cron`, `pgmq`, `pg_net`, `cron → pgmq → Edge Function` em supabase-cron-queues
- ✓ `YYYYMMDDHHmmss` + `RLS` + granular policies em supabase-migrations
- ✓ `supabase/schemas/`, `supabase stop`, `supabase db diff -f`, caveats em supabase-declarative-schema
- ✓ `snake_case`, `ISO 8601`, lowercase reserved em supabase-postgres-style

## Anti-pitfalls cobertos

- **A1** (drift kit/↔.claude/): sync idempotente — gate `sync-idempotent.mjs` na Phase 28 valida
- **A2** (CLAUDE.md size): description ≤ 200 chars enforced (gate na Phase 28)
- **A3** (skills auto-contidas): cada SKILL.md tem expertise completa; cross-refs apenas em "Ver também"
- **A8** (stub-only mode preserva expertise): zero `references/` folders — body inline
- **A11** (idioma misto): glossário PT-BR↔EN canônico criado
- **B4** (RLS sem `(select)`): REGRA #1 absoluta documentada com explicação 1000× degradação
- **B5** (`user_metadata` em RLS): WARNING em maiúscula com privilege escalation explicada
- **B7** (`SECURITY DEFINER` sem `search_path`): REGRA absoluta + lint advisor 0011 referenciado

## Decisões implementadas

- **D-01:** Code blocks EN literal com comentários PT-BR pedagógicos
- **D-03:** Template fixo de 5 seções (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Ver também)
- **D-04:** Skills auto-contidas — sem `references/` folders
- **D-05:** Tom autoritativo (Sempre/Nunca em maiúscula com 1-frase justificativa)
- **D-06:** Anti-patterns formato triple (Errado / Por quê / Certo)
- **D-08:** Glossário com 3 seções (Termos PT-BR↔EN + Comandos CLI canônicos + Patterns canônicos consolidados)
- **D-09:** Cross-refs via Markdown link relativo

## Próximo passo

Phase 26 — 7 agents Supabase + convenção universal SB-A00.
