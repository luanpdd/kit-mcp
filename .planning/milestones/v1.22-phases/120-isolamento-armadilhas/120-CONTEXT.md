# Fase 120: Isolamento Postgres + Armadilhas Distribuídas (DDIA Ch 7 + Ch 8) — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

2 skills da Suíte DDIA Foundations v1.22 — pareadas porque consumidores típicos (Edge Functions Supabase fazendo write em tabela compartilhada e dependendo de relógio/lock) enfrentam ambos os problemas simultaneamente.

REQs cobertos: ISOLAMENTO-01..05 + ARMADILHAS-01..05 (10 REQs).

Deliverables (2 skills):

1. `kit/skills/postgres-isolamento-concorrencia/SKILL.md` cobrindo:
   - 6 race conditions canônicos (dirty read, dirty write, read skew, lost update, write skew, phantom read) com SQL exemplo isolado
   - Árvore de decisão isolation level (READ COMMITTED 95% / REPEATABLE READ MVCC / SERIALIZABLE SSI)
   - 3 padrões para prevenir lost update com tradeoff (FOR UPDATE, atomic CAS, advisory_xact_lock)
   - Prevenção write skew (FOR UPDATE materialização, EXCLUDE constraint, SERIALIZABLE fallback)
   - Prevenção phantom read (SSI predicate-aware vs REPEATABLE READ snapshot-only)

2. `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` cobrindo:
   - Clock skew com tabela canônica (`now()` / `clock_timestamp()` / `transaction_timestamp()` / `statement_timestamp()`) + regra "NUNCA usar wall clock para expiração"
   - Fencing tokens canônicos (pg_advisory_xact_lock + sequence monotônico)
   - GC pause / process pause + cenário split-brain canônico + mitigação fencing
   - Falhas parciais (timeout-based detection falaciosa, phi accrual failure detector, consenso N-1)
   - Modelos de sistema (byzantine vs crash-stop vs crash-recovery — Supabase = crash-recovery)

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via workflow.skip_discuss=true. Decisões guiadas por:
- Pattern do `multi-tenant-rls-hierarchy/SKILL.md` (v1.21) e `tenant-quente-mitigacao/SKILL.md` (v1.22 Phase 119) como template estrutural — frontmatter PT-BR, "Quando usar" com trigger phrases, "Regras absolutas" numeradas, "Patterns canônicos" com SQL real, "Anti-patterns" numerados, "Ver também" com cross-refs.
- Tradução conceitual: DDIA Ch 7 e Ch 8 são genéricos (Cassandra, MySQL, ZooKeeper) — estas skills traduzem para Postgres (sintaxe `set transaction isolation level`, MVCC via `xmin`, SSI desde 9.1) + Supabase (Edge Functions, pgmq jobs, super-admin actions com TTL).
- Cross-suite: skills consomem `_shared-dados-distribuidos/glossary.md` (Phase 117), `cascading-failures` (v1.11), `super-admin-platform-pattern` (v1.21), `crm-lead-pipeline-patterns` (v1.21), `member-invite-flow` (v1.21). Cross-refs ATIVOS via Markdown link relativo.

### Decisões cristalizadas pela pesquisa (vinculantes)
- Os 6 race conditions seguem nomenclatura canônica do summary DDIA Ch 7 (linhas 11058-11084) e do manual oficial Postgres `transaction-iso.html` — termos EN preservados na descrição e nos SQL examples.
- Postgres NÃO permite dirty read mesmo se solicitado READ UNCOMMITTED (silenciosamente promove para READ COMMITTED) — citação ao manual oficial.
- Lost update tem 3 padrões com tradeoff explícito tabulado: pessimista (`FOR UPDATE`) vs otimista (CAS via `WHERE version = $v`) vs semântico (`pg_advisory_xact_lock`).
- Write skew exige uma de 3 técnicas (não OR — qualquer uma resolve): materializar conflito via FOR UPDATE em rows lidas, EXCLUDE constraint declarativo (overlap booking), ou SERIALIZABLE fallback genérico.
- Clock skew tabela inclui também `statement_timestamp()` para distinguir de `clock_timestamp()` em profiling — diferença sutil documentada no manual Postgres.
- Fencing token Postgres pattern: `pg_advisory_xact_lock(hashtext('lock_name'))` + `nextval('fencing_tokens_seq')` + storage rejeita writes com `last_token < $token`. Cenário canônico GC pause = lease 30s + pause 45s = split-brain.
- Phi accrual failure detector mencionado como pattern de literatura (Cassandra usa); regra prática Supabase: assumir nó morto apenas após timeout >= 3× P99 RTT histórico.
- Supabase = crash-recovery model (nó pode reiniciar com estado parcial após restart de Edge Function ou failover de Postgres). Byzantine fora de scope.

</decisions>

<code_context>
## Insights do Código Existente

- `kit/skills/multi-tenant-rls-hierarchy/SKILL.md` (v1.21) — template estrutural canônico (REGRA #1..#6 + Patterns canônicos com SQL real)
- `kit/skills/tenant-quente-mitigacao/SKILL.md` (v1.22 Phase 119) — primeiro precedente da Suíte DDIA Foundations com REQ-section format + 5 critérios SQL real
- `kit/skills/_shared-dados-distribuidos/glossary.md` (Phase 117) — define `dirty read`, `write skew`, `lost update`, `MVCC`, `SSI`, `clock skew`, `fencing token`, `phi accrual failure detector`, `byzantine fault` — esta fase NÃO duplica, apenas linka
- `kit/skills/_shared-supabase/glossary.md` (v1.8) — define `pg_advisory_xact_lock`, `pg_cron`, `pgmq`
- `kit/skills/cascading-failures/SKILL.md` (v1.11) — referência para timeout vs falha (cross-ref ativo)
- `kit/skills/super-admin-platform-pattern/SKILL.md` (v1.21) — referência para impersonation TTL (use case fencing token)
- `.claude/ddia-extracted.txt` linhas 9190-11250 — Ch 7 Transactions completo, summary 11034-11110
- `.claude/ddia-extracted.txt` linhas 11255-13197 — Ch 8 Trouble with Distributed Systems completo, summary 12824-12891

</code_context>

<specifics>
## Ideias Específicas

Skills pareadas porque:

1. Edge Function que faz lead deduplication (skill `crm-lead-pipeline-patterns` v1.21) precisa de **isolation correto** (lost update prevention via `unique(org_id, contact_email)` + `INSERT ... ON CONFLICT`) E precisa de **clock-safe TTL** (não usar `clock_timestamp()` para expirar invite token, definido em `member-invite-flow` v1.21).

2. Super-admin impersonation (skill `super-admin-platform-pattern` v1.21) precisa de **fencing token** quando TTL 30min expira durante GC pause de Deno Edge Function (cenário canônico Ch 8).

Essas conexões são citadas explicitamente nas seções "Ver também" das duas skills.

</specifics>

<deferred>
## Ideias Adiadas

- Agent `auditor-isolamento-armadilhas` (varre repo procurando `clock_timestamp()` em lógica de expiração + `UPDATE ... SET x = x + 1` sem `WHERE version`): defer para Phase 122 v1.22 (parte do roadmap original como agent dedicado).
- Skill standalone `ssi-postgres-deep-dive` (algoritmo SSI completo, predicate locks, abort heuristics): defer para v1.23+ — atual é suficiente para 95% dos casos.
- Integração com SLO suite (alert quando `serialization_failure` excede error budget): defer para v1.23 cross-suite.

</deferred>
