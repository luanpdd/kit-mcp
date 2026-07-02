# Phase 120 — Plan 01 Summary

**Status:** done
**Concluído:** 2026-05-10

## Arquivos criados

| Caminho | Linhas (aprox) | Descrição |
|---|---|---|
| `kit/skills/postgres-isolamento-concorrencia/SKILL.md` | ~430 | Skill canônica cobrindo 5 critérios DDIA Ch 7 (race conditions, isolation level, lost update, write skew, phantom) aplicados a Postgres + Supabase |
| `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` | ~410 | Skill canônica cobrindo 5 critérios DDIA Ch 8 (clock skew, fencing tokens, GC pause, falhas parciais, modelos de sistema) aplicados a Postgres + Edge Functions |

## REQs cobertos

### ISOLAMENTO (skill 1)

| REQ | Descrição | Evidência (path:section) |
|---|---|---|
| **ISOLAMENTO-01** | 6 race conditions com SQL exemplo isolado de cada (termos EN preservados) | `kit/skills/postgres-isolamento-concorrencia/SKILL.md` seção `### REQ ISOLAMENTO-01` — 6 sub-blocos numerados 1..6 (dirty read, dirty write, read skew, lost update, write skew com doctor on-call canônico, phantom read com booking) |
| **ISOLAMENTO-02** | Árvore de decisão isolation level (READ COMMITTED 95% / REPEATABLE READ MVCC / SERIALIZABLE SSI) | `kit/skills/postgres-isolamento-concorrencia/SKILL.md` seção `### REQ ISOLAMENTO-02` — árvore ASCII 3-vias + 3 formas de setar isolation level |
| **ISOLAMENTO-03** | 3 padrões prevenção lost update tabulados com tradeoff (FOR UPDATE / CAS otimista / advisory_xact_lock) | `kit/skills/postgres-isolamento-concorrencia/SKILL.md` seção `### REQ ISOLAMENTO-03` — tabela 3 linhas + 3 SQL examples completos + regra de polegar |
| **ISOLAMENTO-04** | Prevenção write skew em 3 caminhos (FOR UPDATE materialização / EXCLUDE constraint / SERIALIZABLE) | `kit/skills/postgres-isolamento-concorrencia/SKILL.md` seção `### REQ ISOLAMENTO-04` — 3 sub-blocos canônicos + retry loop TS canônico |
| **ISOLAMENTO-05** | Prevenção phantom read via SSI predicate-aware; contraste explícito com REPEATABLE READ | `kit/skills/postgres-isolamento-concorrencia/SKILL.md` seção `### REQ ISOLAMENTO-05` — tabela comparativa 3 linhas + explicação técnica de "por quê REPEATABLE READ NÃO previne" + quando NÃO usar SERIALIZABLE |

### ARMADILHAS (skill 2)

| REQ | Descrição | Evidência (path:section) |
|---|---|---|
| **ARMADILHAS-01** | Tabela canônica de timestamps Postgres (`now()` / `transaction_timestamp()` / `statement_timestamp()` / `clock_timestamp()`) + regra "NUNCA wall clock para expiração" | `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` seção `### REQ ARMADILHAS-01` — tabela 4 linhas com semântica/quando usar/quando NÃO + exemplo errado vs certo + profile DO block |
| **ARMADILHAS-02** | Fencing tokens canônicos (`pg_advisory_xact_lock` + `nextval('fencing_tokens_seq')` + storage rejeita `last_token < $token`) | `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` seção `### REQ ARMADILHAS-02` — pattern Postgres completo SQL + tabela 3 aplicações canônicas (super-admin, pgmq, eleição de líder) |
| **ARMADILHAS-03** | Cenário canônico GC pause / process pause + mitigação fencing | `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` seção `### REQ ARMADILHAS-03` — timeline ASCII 6 linhas + Edge Function Deno + 5 outros gatilhos de pause (VM suspend, swap, SIGSTOP, NTP step) |
| **ARMADILHAS-04** | Falhas parciais — timeout binário falacioso, phi accrual failure detector, regra consenso N-1 | `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` seção `### REQ ARMADILHAS-04` — explicação "lentidão ≠ morte" com cenários, phi accrual descrito, view SQL `private.suspected_dead_instances` com `>= 3× P99 RTT` |
| **ARMADILHAS-05** | Modelos de sistema (byzantine vs crash-stop vs crash-recovery — Supabase = crash-recovery) | `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` seção `### REQ ARMADILHAS-05` — tabela 3 linhas + 4 implicações práticas + anti-modelo "crash-stop em Edge Function" com TS errado vs certo |

## Cross-refs ATIVOS

### Skill `postgres-isolamento-concorrencia`
- `../supabase-database-functions/SKILL.md` (v1.8) — STABLE/IMMUTABLE/VOLATILE markers
- `../crm-lead-pipeline-patterns/SKILL.md` (v1.21) — lead deduplication com unique + ON CONFLICT
- `../member-invite-flow/SKILL.md` (v1.21) — accept invite usa FOR UPDATE para idempotência
- `../supabase-migrations/SKILL.md` (v1.8) — migration que adiciona `version bigint` para CAS
- `../_shared-dados-distribuidos/glossary.md` seção (c) — definições canônicas PT-BR ↔ EN

### Skill `armadilhas-sistemas-distribuidos`
- `../cascading-failures/SKILL.md` (v1.11) — timeout vs falha real
- `../super-admin-platform-pattern/SKILL.md` (v1.21) — TTL impersonation 30min usa fencing token
- `../supabase-cron-queues/SKILL.md` (v1.8) — pgmq worker crash-recovery + idempotency
- `../retry-strategies/SKILL.md` (v1.10) — retry exige idempotency
- `../postgres-isolamento-concorrencia/SKILL.md` (v1.22 esta fase) — `pg_advisory_xact_lock` definido lá
- `../_shared-dados-distribuidos/glossary.md` seção (e) — definições canônicas PT-BR ↔ EN

## Padrões reaproveitados

- Estrutura canônica SKILL.md: frontmatter PT-BR, "Quando usar" + trigger phrases, "Regras absolutas" numeradas, "Patterns canônicos" com SQL/TS real, "Anti-patterns" numerados, "Ver também" com cross-refs (template: `multi-tenant-rls-hierarchy/SKILL.md` v1.21 + `tenant-quente-mitigacao/SKILL.md` v1.22 Phase 119).
- Convenção `private.*` schema para helpers (consumido de `multi-tenant-rls-hierarchy`).
- Padrão "REQ <nome>-<num>" como heading de seção para fácil localização e cross-link entre VERIFICATION.md e SKILL.md (consumido de `tenant-quente-mitigacao` Phase 119).
- Snippets Deno com `npm:pg@8` consistente com convenção Edge Functions Supabase v1.8.

## Próximo passo

Commit 4 — adicionar SUMMARY + VERIFICATION (este arquivo + 120-VERIFICATION.md).
