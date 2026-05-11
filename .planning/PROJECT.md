# PROJECT.md — kit-mcp

> Bootstrap inicial em 2026-05-03 a partir do histórico de releases. Contexto consolidado da sessão de restauração + fix-up + 0.5.0.
> Última atualização: 2026-05-11 — milestone v1.24 (Segurança em Nível de Coluna) iniciado.

## Estado Atual

**v1.23.0 — Reforço RLS Supabase + Handoff Cooperativo SQL** **entregue** 2026-05-11 (Phases 124-130, 7 phases, 42 REQs, content-only milestone). Incorporou 100% da documentação oficial Supabase Row Level Security na Suíte Supabase v1.8 e estabeleceu **princípio canônico de handoff cooperativo SQL**: agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Skill nova `supabase-rls-defense-in-depth` (6 camadas) + agent novo `supabase-rls-hardener` (verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação) + 12 cross-suite handoffs documentados (8 v1.21 + 1 v1.22 + 3 framework core). AUTOGEN-COUNTS: 60→**61 agents** (+1: supabase-rls-hardener), 89 commands (mantido), 67→**68 skills** (+1: supabase-rls-defense-in-depth), 23 gates (mantido); file-manifest 367→**369 files**. Stable API v1.0+ preservada. PRR 30/30 mantido (content-only).

**Stack acumulado:** v1.8 (Supabase) + v1.9 (Observabilidade) + v1.10 (SRE Engagement) + v1.11 (SRE Resilience) + v1.12 (Legacy Code Mastery) + v1.13-v1.20 (Hardening + Suítes auto-aplicadas + PRR 30/30) + v1.21 (Multi-Tenant SaaS B2B) + v1.22 (DDIA Foundations) + **v1.23 (Reforço RLS Supabase)**. **8 suítes ativas no kit** + framework eat-your-own-dog-food maduro (golden signals + dual-window SLOs + RUNBOOK 9 cenários + mutation testing baseline). Cross-suite invocation pattern formalizado em v1.21, herdado em v1.22, **enriquecido em v1.23 com semântica cooperativa explícita** (handoff cooperativo, não BLOCK rígido). Convenção PT-BR a partir de v1.22 mantida.

## Milestone Atual: v1.24 Segurança em Nível de Coluna (Column-Level Security)

**Objetivo:** Adicionar camada de Column-Level Security (CLS) à Suíte Supabase — complementa RLS (linha) com privilégios granulares por coluna via `GRANT/REVOKE (col1, col2) ON TABLE`. Estabelece handoff cooperativo para agents que produzem CREATE TABLE com PII (audit-log, CRM, LGPD, multi-tenant) — column-level privileges fazem parte do template materializado pelos agents Supabase.

**Princípio canônico (herdado de v1.23):** Agents não-Supabase **pensam/planejam**. Agents Supabase **materializam/hardenam**. Nenhum lado descarta o outro. Para column-level, o novo agent `supabase-column-privileges-writer` é canonical handoff target — recebe spec de "colunas sensíveis" e devolve REVOKE/GRANT column-level SQL preservando intent upstream.

**Caveat importante (da doc oficial):** Column-level privileges é **feature avançada**. Para a maioria dos casos, preferir RLS policies + tabela dedicada para user roles. O kit-mcp marca isso explicitamente nas skills/agents — column-level só quando há requisito real (PII em compliance LGPD/GDPR, audit logs sanitizados, billing data restrito).

**Funcionalidades alvo (6 entregáveis, todos aditivos, zero superfície de API quebrada):**

1. **Skill nova `supabase-column-level-security`** — patterns canônicos GRANT/REVOKE column-level (table-level vs column-level), wildcard `*` restriction caveat (restricted roles falham com `SELECT *`), considerações de impacto em INSERT/UPDATE/DELETE/SELECT, integração com RLS row-level, anti-patterns (column privilege sem dedicated role table, `*` em restricted roles, esquecer impacto de SELECT *)

2. **Patches em skills existentes (3 artefatos):**
   - `supabase-rls-policies`: section nova "Combining RLS with Column-Level Privileges" — quando combinar + como evitar conflitos
   - `supabase-migrations`: template canônico v1.24 com BLOCO 6 opcional (column-level privileges) — apenas se caller indica colunas sensíveis
   - `supabase-rls-defense-in-depth`: Camada 8 (column-level privileges) + checklist 8-item (era 7); auditoria query para detectar tabelas com PII sem column privileges

3. **Agent novo `supabase-column-privileges-writer`** — recebe spec de table + colunas sensíveis + roles permitidos, gera REVOKE table-level + GRANT column-level. Aceita `upstream_intent` via Task() (handoff cooperativo). Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (paralelo ao rls-hardener).

4. **Patches em agents Supabase (2 artefatos):**
   - `supabase-rls-hardener`: Detector 8 (column-level privileges check) — flagra tabelas com PII sem column-level GRANT/REVOKE; chain cooperativo para `supabase-column-privileges-writer`
   - `/supabase` command: subcomando novo `column` (sinônimos: `coluna`, `col-priv`) dispatcheando para column-privileges-writer

5. **Cross-suite handoff cooperativo (5 agents):** padrão v1.23 mantido — agents externos com PII passam draft via Task() para column-privileges-writer:
   - `audit-log-implementer` (v1.21) — PII sanitization granular por coluna (cross-ref Phase 109 ADMIN-03)
   - `lgpd-compliance-auditor` (v1.21) — DSR + erasure por coluna + cross-border PII restriction
   - `crm-pipeline-implementer` (v1.21) — lead PII columns (phone, email) com REVOKE select cross-user
   - `multi-tenant-rls-writer` (v1.21) — column-level dentro de hierarquia org/dept/role/permission
   - `invite-flow-implementer` (v1.21) — token raw column REVOKE select de todos exceto service_role

6. **Release artifacts (final phase):** AUTOGEN-COUNTS regen, file-manifest, CHANGELOG entry v1.24, glossário compartilhado +5 termos novos (column-level privileges, table-level privileges, wildcard restriction, dedicated role table pattern, column privilege auditing), package.json bump 1.23.0→1.24.0

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: documentação oficial Supabase Column Level Security fornecida no prompt do milestone (cobertura 100%).
- Conteúdo PT-BR (alinhado v1.22/v1.23). Code blocks SQL EN com comentários PT-BR.
- Roadmap começa em **Phase 131** (continuação de v1.23 que terminou em 130).
- Convenção PT-BR + handoff cooperativo herdados de v1.22/v1.23.
- **Aviso explícito embutido nas skills/agents:** column-level é feature avançada — usar com parcimônia.

**Beneficiários principais:**
- Suíte Supabase v1.8 — `supabase-rls-defense-in-depth` ganha Camada 8 (column-level)
- Suíte Multi-Tenant v1.21 — `audit-log-implementer`, `lgpd-compliance-auditor`, `crm-pipeline-implementer`, `multi-tenant-rls-writer`, `invite-flow-implementer` ganham handoff cooperativo column-level
- Suíte SRE v1.10 — `prr-conductor` Axe 1 (System Architecture) opcionalmente consulta column privileges em features production-bound com PII

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde. Stable API v1.0+ inalterada.

**Próximo passo após v1.24:** v1.25 (a definir) — possíveis candidatos: Supabase Vault (encryption at rest), Supabase Functions hooks com SQL triggers, advanced audit log analytics. Tech debt parqueado de v1.20-v1.23 também.

**Tech debt parqueado para v1.25+** (carry-over de v1.20 + v1.21 + v1.22 + v1.23):
- Phase 100 carry-over: cli/index.js extract helpers para 86→90 coverage ratchet
- Phase 101 carry-over: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
- Phase 105 carry-over: p99 latency monitoring + M1 cold-start CLI sub-200ms
- v1.21 deferred: TanStack Start/Expo/SolidStart/SvelteKit/Nuxt + Hono/Express/Fastify integrations
- v1.21 deferred: WhatsApp template management, CRM AI scoring, multi-region deployment
- v1.22 deferred: CRDTs (mergeable counters, OR-Sets) para colaborativo realtime
- v1.22 deferred: batch processing patterns (DDIA Ch 10 — pgmq cobre maioria dos casos)
- v1.22 deferred: multi-region active-active deployment Supabase
- v1.22 deferred: tooling para visualização event flow (CDC pipeline diagram)
- v1.23 deferred: RLS testing framework (pgTAP integration); migração automática policies existentes não-hardenadas; UI dashboard hardening status; burn rate alerting integrado com hardener; telemetry cooperative handoff

## ~~Milestone Anterior: v1.23 Reforço RLS Supabase + Handoff Cooperativo SQL~~ (entregue 2026-05-11)

**Objetivo:** Garantir que TODO SQL/Postgres/DDL/banco de dados gerado pelo kit passe pela trilha de segurança da Suíte Supabase via **handoff cooperativo** — agents externos (multi-tenant, debugger, planner, executor, etc.) planejam/sugerem estrutura SQL; agents Supabase materializam o código final hardenado preservando intent upstream. Incorpora 100% do conteúdo da documentação oficial RLS da Supabase.

**Princípio canônico:** Agents não-Supabase **pensam / planejam**. Agents Supabase **materializam / hardenam**. Nenhum lado descarta o outro — quando há conflito de patterns, agent Supabase explica e propõe alternativa via diff, nunca reescreve silenciosamente.

**Funcionalidades alvo (9 entregáveis, todos aditivos, zero superfície de API quebrada):**

1. **Patch skill `supabase-rls-policies`** — incorpora 100% da doc oficial fornecida no prompt do milestone:
   - GRANT SELECT/INSERT/UPDATE/DELETE TO anon/authenticated/service_role antes de ENABLE RLS
   - `auth.uid() IS NOT NULL AND ...` (anti silent-fail anônimo)
   - Views com `security_invoker=true` (Postgres 15+) — patternização do bypass default
   - Diferença `anon` Postgres role vs anonymous Auth user (claim `is_anonymous` no JWT)
   - Performance: minimize joins (IN ao invés de JOIN), filtros redundantes client-side (.eq() mesmo com policy), security definer functions com cache via (select)
   - `raw_app_meta_data` vs `raw_user_meta_data` + JWT freshness caveat + cookie 4096 bytes
   - Defense in depth narrative — RLS como camada vs third-party tooling

2. **Patch agent `supabase-rls-writer`** — emite GRANTs antes de ENABLE RLS; inclui `IS NOT NULL` check opcional; gera views com `security_invoker=true` quando aplicável. Recebe draft/intent via `Task()` upstream context (handoff cooperativo).

3. **Patch skill `supabase-migrations`** — template default de tabela nova passa a incluir como bloco obrigatório: GRANT statements + ALTER ENABLE RLS + indices em colunas RLS + 4 policies granulares.

4. **Patch agent `supabase-migration-writer`** — recebe draft/planejamento SQL via `Task()` upstream context + intent original. Em CREATE TABLE, auto-chain para `supabase-rls-writer` ou `supabase-rls-hardener`. Materializa migration final hardenada **preservando intent**. Devolve SQL pronto + nota de divergências (se houver).

5. **Patch command `/supabase`** — exposto como **serviço de materialização**: qualquer agent invoca `/supabase migration "<plano>"` ou via `Task()` para receber SQL hardenado. Não bloqueia — recebe planejamento e devolve código pronto. Subcomando `migration` agora exige RLS auto-injetada no output.

6. **Skill nova `supabase-rls-defense-in-depth`** — narrativa de RLS como camada de defesa em profundidade; event trigger `rls_auto_enable()` (default em projetos novos); `BYPASSRLS` role privilege para tarefas admin; service_role caveat (não bypassa RLS do user logged-in); security definer functions; views com `security_invoker=true`.

7. **Agent novo `supabase-rls-hardener`** — recebe draft/plano SQL de qualquer agent (via `Task()`) + contexto upstream. Produz SQL final hardenado **preservando intent original**. Verdicts:
   - **GO**: SQL já tem GRANT + RLS + indices corretos sem anti-patterns
   - **STRENGTHEN**: ajusta mantendo intent, devolve diff explícito do que mudou e por quê
   - **REWRITE**: anti-pattern crítico (user_metadata em authz, for all sem justificativa, auth.uid() sem wrapper) — **pede confirmação ao caller antes de reescrever**, nunca descarta silenciosamente
   - Invocável cross-suite por multi-tenant, CRM, audit-log, super-admin, debugger, planner (Task handoff cooperativo)

8. **Patch agents cross-suite (handoff cooperativo)** — agents externos que produzem **planejamento/sugestão SQL** passam o draft via `Task()` para `supabase-rls-hardener` ou `supabase-migration-writer`. Output final é colaborativo (agent X planeja, agent Supabase materializa). Conflitos são explicados via diff, não descartados silenciosamente. Aplicar em:
   - `multi-tenant-rls-writer` (v1.21) — já chain para supabase-rls-writer; adicionar hardener gate cooperativo
   - `audit-log-implementer` (v1.21) — chain cooperativo para supabase-migration-writer + hardener
   - `crm-pipeline-implementer` (v1.21) — chain cooperativo
   - `org-onboarding-implementer` (v1.21) — chain cooperativo
   - `invite-flow-implementer` (v1.21) — chain cooperativo
   - `super-admin-implementer` (v1.21) — chain cooperativo
   - `evolution-go-integrator` (v1.21) — chain cooperativo
   - `lgpd-compliance-auditor` (v1.21) — chain cooperativo
   - `auditor-consistencia-isolamento` (v1.22) — valida que migrations passaram pelo hardener cooperativo
   - `planner` + `executor` + `debugger` (framework core) — detectam SQL no plan/output e fazem handoff cooperativo para Supabase

9. **Auto-enable RLS event trigger como default em migrations novas** — skill `supabase-rls-defense-in-depth` documenta como pattern obrigatório; `supabase-architect` propõe na fase de schema; `supabase-rls-hardener` valida que projetos novos têm o trigger instalado e oferece instalação se ausente.

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: documentação oficial Supabase Row Level Security fornecida no prompt do usuário (cobertura 100% da doc).
- Conteúdo PT-BR (alinhado v1.21/v1.22). Code blocks SQL EN com comentários PT-BR.
- Roadmap começa em **Phase 124** (continuação de v1.22 que terminou em 123).
- Convenção PT-BR para naming preservada (skill nova `supabase-rls-defense-in-depth` mantém prefixo `supabase-` por consistência com a família existente).
- Padrão v1.21/v1.22 cross-suite invocation `Task()` handoff aplicado **com semântica cooperativa explícita**.

**Beneficiários principais:**
- Toda Suíte Supabase v1.8 — RLS pattern ganha defense-in-depth + auto-enable + IS NOT NULL + views security_invoker
- Suíte Multi-Tenant v1.21 — 8 agents implementers ganham handoff cooperativo obrigatório
- Suíte DDIA v1.22 — `auditor-consistencia-isolamento` ganha check de RLS hardening cooperativo
- Fluxo framework — `executor`, `planner`, `debugger` ganham awareness de SQL/RLS via handoff cooperativo

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde. Stable API v1.0+ inalterada.

**Valor:** Garantir que QUALQUER fluxo do kit que produza SQL/Postgres/banco de dados passe pela trilha de segurança da Suíte Supabase **sem desperdiçar tokens** do planejamento upstream — handoff cooperativo preserva inteligência específica do agent original e garante hardening Supabase no output final. Defense in depth aplicado ao próprio framework.

**Próximo passo após v1.23:** v1.24 — Segurança em Nível de Coluna (Column-Level Security) — fica parqueado para depois de v1.23 concluído.

**Tech debt parqueado (carry-over de v1.20 + v1.21 + v1.22, mantido para v1.24+):**
- Phase 100 carry-over: cli/index.js extract helpers para 86→90 coverage ratchet
- Phase 101 carry-over: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
- Phase 105 carry-over: p99 latency monitoring + M1 cold-start CLI sub-200ms
- v1.21 deferred: TanStack Start/Expo/SolidStart/SvelteKit/Nuxt + Hono/Express/Fastify integrations
- v1.21 deferred: WhatsApp template management, CRM AI scoring, multi-region deployment
- v1.22 deferred: CRDTs (mergeable counters, OR-Sets) para colaborativo realtime
- v1.22 deferred: batch processing patterns (DDIA Ch 10 — pgmq cobre maioria dos casos)
- v1.22 deferred: multi-region active-active deployment Supabase
- v1.22 deferred: tooling para visualização event flow (CDC pipeline diagram)

## ~~Milestone Anterior: v1.22 Suíte DDIA Foundations~~ (entregue 2026-05-10)

**Objetivo:** Adicionar 8ª suíte ao kit derivada de *Designing Data-Intensive Applications* (Martin Kleppmann, O'Reilly 2017) — fechar gaps de consistency, replication, partitioning hot spots, isolation levels, distributed systems traps (clock skew, fencing tokens) e event streams (CDC, event sourcing) nas suítes /supabase v1.8 + /multi-tenant v1.21 existentes.

**Convenção de naming (a partir de v1.22):** todos os artefatos novos (skills, agents, commands) com nomes em **PT-BR claros e descritivos**. Termos técnicos canônicos preservados (CDC, RLS, MVCC, Postgres, write skew em descrições internas pois são canônicos no manual oficial), mas nomes de arquivos/identificadores em PT-BR.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills novos (7)** — 1 skill por capítulo chave do DDIA, nomes PT-BR descritivos:
  - `evolucao-schema-compativel` (Ch 4 Encoding & Evolution) — compat backward/forward para migrations + contratos de API em Edge Functions; padrão 3-passos (adicionar nullable → backfill → impor NOT NULL); análogos Avro/Protobuf para Postgres
  - `consistencia-leitura-replica` (Ch 5 Replication) — read-after-write, leituras monotônicas, prefixo causal consistente em contexto Supabase (read replicas via Supavisor, realtime broadcast vs leitura DB, Edge Functions lendo após writes)
  - `tenant-quente-mitigacao` (Ch 6 Partitioning) — detectar+mitigar "tenant Justin Bieber" (1 tenant >>> outros); estratégias: rate limit por tenant, pool de conexão isolado, read replica dedicada, desnormalização, request shaping; particionamento range vs hash para tenant_id
  - `postgres-isolamento-concorrencia` (Ch 7 Transactions) — quando READ COMMITTED (default) vs REPEATABLE READ vs SERIALIZABLE; padrões SELECT FOR UPDATE; prevenção de lost update via row-level lock OU atomic UPDATE; detecção de write skew + materialização via FOR UPDATE/advisory lock; phantom reads
  - `armadilhas-sistemas-distribuidos` (Ch 8 Trouble with Distributed Systems) — perigos de clock skew (semântica `now()` vs `clock_timestamp()` vs `transaction_timestamp()`); fencing tokens para distributed locks (advisory locks, ações super-admin); GC pauses; falhas parciais; detecção falaciosa por timeout
  - `escolha-modelo-consistencia` (Ch 9 Consistency & Consensus) — quando precisa linearizabilidade (uniqueness constraint cross-tenant) vs consistência causal vs eventual; uniqueness distribuído via single-leader Postgres; análogos de total order broadcast
  - `streams-eventos-cdc` (Ch 11 Stream Processing) — padrões CDC via wal2json/pglogical; event sourcing em Postgres (audit_log como source of truth + projeções); semântica exactly-once em pgmq via dedup table; brokers log-based vs AMQP/JMS-style; transactional outbox

- **Agents novos (3)** — workers especializados, nomes PT-BR:
  - `auditor-consistencia-isolamento` — scaneia migrations/RPCs/Edge Functions por vulns de race condition: SELECT-then-UPDATE sem FOR UPDATE (lost update vulnerable), trigger + check constraint que não materializa o predicate (write skew vulnerable), `now()`/`clock_timestamp()` em lógica de expiração (clock skew vulnerable), dependência em UNIQUE check em nível de app vs DB constraint, write cross-tenant sem FOR UPDATE LOCKING adequado
  - `detector-tenant-quente` — analisa logs Supabase via `mcp__supabase__execute_sql`/get_logs (últimos 30d) → detecta tenants com queries/storage/conexões >>> outros; sugere estratégia de mitigação específica baseada no perfil de uso
  - `validador-evolucao-schema` — pré-validação de migration ANTES do apply: flagra quebras de compat backward/forward (NOT NULL adicionado em coluna existente, column dropped, type narrowed, default mudado em coluna em uso); sugere padrão 3-passos quando arriscado

- **Command novo (1):**
  - `/dados-distribuidos [subcomando]` — orquestrador da Suíte DDIA (sinônimos PT/EN: `dados-distribuidos`, `ddia`, `dados`, `consistencia`, `replicacao`, `streams`); subcomandos: `auditar-consistencia`, `auditar-tenant-quente`, `validar-evolucao-schema`, `implementar-cdc`

- **Updates cross-suite (12 patches em skills/agents existentes — nomes EN preservados pois são artefatos pré-v1.22):**
  - `multi-tenant-performance-scaling` ← detecção de tenant quente + range vs hash para tenant_id
  - `multi-tenant-rls-hierarchy` ← invariantes linearizáveis cross-tenant
  - `crm-lead-pipeline-patterns` ← SELECT FOR UPDATE em trigger de transição de stage
  - `super-admin-platform-pattern` ← fencing token para TTL de impersonação
  - `cascading-failures` ← clock skew como failure mode adicional
  - `audit-log-multi-tenant` ← semântica event sourcing + log compaction
  - `supabase-cron-queues` ← padrões exactly-once + idempotency keys + transactional outbox
  - `supabase-migrations` ← referência ao padrão rolling-upgrade (3-passos NOT NULL)
  - Agents: `supabase-architect` (pergunta consistency upfront), `supabase-migration-writer` (auto-detect schema evolution risks), `multi-tenant-isolation-auditor` (gap detection de tenant quente), `crm-pipeline-implementer` (FOR UPDATE locks built-in)

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: *Designing Data-Intensive Applications* — Martin Kleppmann (O'Reilly Media, 2017). ISBN 978-1-449-37332-0.
- Capítulos cobertos: 4 (Encoding/Evolution), 5 (Replication), 6 (Partitioning), 7 (Transactions), 8 (Trouble Distributed Systems), 9 (Consistency/Consensus), 11 (Stream Processing). Capítulos 1-3 já cobertos por suítes existentes (SRE Reliability, Storage already covered by `supabase-postgres-style`).
- Conteúdo PT-BR (alinhado com v1.8/v1.9/v1.10/v1.11/v1.12/v1.21). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 117** (continuação de v1.21 que terminou em 116).
- Padrão v1.21 cross-suite invocation Task() handoff aplicado (agents v1.22 invocam agents v1.8/v1.21 quando precisam tocar SQL/RLS).

**Beneficiários principais:**
- Suíte Supabase v1.8 — `supabase-architect` ganha pergunta de consistency model upfront; `supabase-migration-writer` ganha schema-evolution gate
- Suíte Multi-Tenant v1.21 — `multi-tenant-isolation-auditor` ganha hot-tenant detection; `multi-tenant-performance-scaling` ganha hot-spot mitigation
- Suíte CRM v1.21 — `crm-pipeline-implementer` aplica FOR UPDATE em stage transitions
- Suíte SRE v1.10/v1.11 — `cascading-failures` ganha clock skew como mode; `prr-conductor` ganha consistency check em Axe 1
- Fluxo framework — `/discutir-fase` para apps com concorrência alta passa a perguntar isolation level

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde. Stable API v1.0+ inalterada.

**Tech debt deferido (carry-over de v1.20 + v1.21, mantido para v1.23+):**
- Phase 100 carry-over: cli/index.js extract helpers para 86→90 coverage ratchet
- Phase 101 carry-over: completar mutation baseline 5 files restantes
- Phase 105 carry-over: p99 latency monitoring + M1 cold-start CLI sub-200ms
- v1.21 deferred: TanStack Start, Expo, SolidStart/SvelteKit/Nuxt integrations
- v1.21 deferred: Hono/Express/Fastify backend integrations
- v1.21 deferred: WhatsApp template management + media handling
- v1.21 deferred: Multi-region deployment patterns

**Próximo passo:** `/discutir-fase 117` ou `/planejar-fase 117` (após roadmap aprovado).

## ~~Milestone Anterior: v1.21 Suíte Multi-Tenant SaaS B2B~~ (entregue 2026-05-10)

**Objetivo:** Adicionar a 6ª suíte ao kit (Multi-Tenant SaaS B2B) — comando `/multi-tenant` + 10 agents + 15 skills + glossário compartilhado, especializando a suíte `/supabase` v1.8 existente para apps B2B com hierarquia firm→department→leader→collaborator e RBAC granular. Stack alvo: React + Supabase + Vercel.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Comando** `/multi-tenant` orquestrador (sinônimos PT/EN: `multi-tenant`, `b2b`, `tenant`, `escritorio`) com ~11 subcomandos roteando para os agents da suíte

- **Agents core (4)** — design + audit:
  - `b2b-saas-architect` — projeta hierarquia firm→department→role→permission antes de migrations (especializa `supabase-architect` v1.8)
  - `multi-tenant-rls-writer` — RLS hierárquica (org-level, dept-level, role-based, permission-based, super-admin bypass) com helper functions PG (especializa `supabase-rls-writer` v1.8)
  - `multi-tenant-isolation-auditor` — verifica que não há data leak entre orgs (cross-tenant SELECT, RLS bypass paths)
  - `lgpd-compliance-auditor` — auditoria LGPD per-tenant (data subject rights, retention, consent management, data export/delete)

- **Agents implementers (6)** — workers ativos:
  - `org-onboarding-implementer` — fluxo signup → criar org → primeiro admin → setup wizard
  - `invite-flow-implementer` — token-based invites com role pré-definido + accept flow
  - `super-admin-implementer` — você como god-mode sobre todos tenants (cross-tenant view, billing, métricas)
  - `audit-log-implementer` — audit trail multi-tenant (quem fez o quê em qual org, retention)
  - `evolution-go-integrator` — webhooks Evolution Go/WhatsApp (signature validation, idempotency, dedup, rate limit Meta)
  - `crm-pipeline-implementer` — leads + sales pipeline + ownership transfer + scoring + state machine

- **Skills core (4)** — arquitetura e padrões:
  - `b2b-saas-architecture` — patterns canônicos (org/dept/role/permission, single vs shared schema, tenant isolation strategy)
  - `multi-tenant-rls-hierarchy` — RLS para hierarquia firm/dept/role com helper functions PG (`is_member_of`, `has_role`, `has_permission`)
  - `rbac-permissions-matrix-supabase` — modelagem permissions (action × resource × scope)
  - `multi-tenant-performance-scaling` — partitioning por org_id, indexing strategy, connection pooling, MVs per-tenant

- **Skills flow (3)** — fluxos canônicos:
  - `org-onboarding-flow` — signup → setup wizard → first admin → invitar membros
  - `member-invite-flow` — token-based invites com role pré-definido (accept, decline, resend, expire)
  - `super-admin-platform-pattern` — view sobre todos tenants (impersonation, audit, cross-tenant queries)

- **Skills compliance (2)** — regulatório:
  - `audit-log-multi-tenant` — patterns canônicos (event taxonomy, retention, query, export)
  - `lgpd-multi-tenant-compliance` — data subject rights por tenant, consent management, retention policies, data export/delete

- **Skills domain (3)** — verticais aplicáveis a qualquer nicho:
  - `evolution-go-whatsapp-integration` — webhooks (signature, idempotency, dedup), rate limit Meta, message queue patterns
  - `whatsapp-conversation-state-machine` — modelagem de conversação WhatsApp como state machine
  - `crm-lead-pipeline-patterns` — state machine de leads, scoring, ownership, stage transitions

- **Skills React (3)** — frontend patterns:
  - `org-switcher-react-pattern` — UI org switcher com state management (assume Vite SPA OU Next.js v16)
  - `permission-gate-react-pattern` — `<PermissionGate permission="x">` declarativo
  - `member-management-react-shadcn` — list + invite + role manager UI (shadcn/ui canonical)

- **Glossário compartilhado:** `kit/skills/_shared-multi-tenant/glossary.md` — vocabulário PT-BR↔EN (tenant, org, member, role, permission, RLS scope, cross-tenant, super-admin, audit log, etc.)

**Decisões de stack:**
- **Stack alvo:** React + Supabase + Vercel — caminho `@supabase/ssr` para Next.js v16 OU `@supabase/supabase-js` para Vite SPA
- **Não duplica** suíte `/supabase` v1.8 — agents novos invocam `supabase-architect`, `supabase-rls-writer`, `supabase-edge-fn-writer`, `supabase-cron-queues` etc. e adicionam camada multi-tenant especializada
- **Verticais específicas (advocacia/OAB) fora do escopo** — genérico B2B aplicável a qualquer nicho (advocacia, médicos, contadores, vendas, etc.)
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Conteúdo PT-BR (alinhado v1.8/v1.9/v1.10/v1.11/v1.12). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 106** (continuação de v1.20 que terminou em 105).

**Beneficiários principais:**
- Suíte Supabase v1.8 — agents existentes ficam invocados pela camada multi-tenant
- Suíte Observabilidade v1.9 — `obs.events` ganha `tenant_id` canônico desde projeto; audit triggers por tenant
- Suíte SRE v1.10 — `prr-conductor` ganha checks de isolamento multi-tenant em Axe 1 (System Architecture); cross-tenant data leak vira incident class
- Suíte Legacy v1.12 — `multi-tenant-rls-writer` herda anti-pitfalls de `supabase-rls-writer` (`(select auth.uid())` wrapper, no `user_metadata` em authz)
- Fluxo framework — `/discutir-fase` para apps B2B passa a perguntar sobre isolamento multi-tenant

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde. Stable API v1.0+ inalterada.

**Tech debt deferido para v1.22+** (do v1.20 audit):
- Phase 100 carry-over: cli/index.js extract helpers para 86→90 coverage ratchet
- Phase 101 carry-over: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
- Phase 105 carry-over: p99 latency monitoring + M1 cold-start CLI sub-200ms

**Resultado v1.21:** ✅ ENTREGUE — 11/11 phases, 59/59 REQs, 18 commits atomic, [audit](./milestones/v1.21-MILESTONE-AUDIT.md) status `passed`, [roadmap](./milestones/v1.21-ROADMAP.md) arquivado.

## ~~Milestone Anterior: v1.20 Tech Debt Closure & Quality Hardening~~ (entregue 2026-05-10)

6 itens de tech debt parqueados pós-v1.19 fechados. PRR 28→30/30 atingido. Mutation testing como gate de qualidade canônico estabelecido (baseline 57.40%). Detalhes em [`.planning/milestones/v1.20-ROADMAP.md`](./milestones/v1.20-ROADMAP.md) + [`v1.20-MILESTONE-AUDIT.md`](./milestones/v1.20-MILESTONE-AUDIT.md).

## ~~Milestone Anterior: v1.13-v1.19 — Hardening Series (entregue 2026-05-09)~~

7 releases consecutivas em 2026-05-09 elevaram o kit de v1.12.1 a v1.19.0:
- v1.13 Security & Performance Hardening (Phases 79-81)
- v1.14 Web/Core Security Hardening (Phases 82-84)
- v1.15 DX & Token Economy Wave 2 (Phases 85-87)
- v1.16 Performance Runtime Wave (Phases 88-89)
- v1.17 Performance Wave 2 + Quick Wins (Phases 90-93)
- v1.18 Eat Your Own Dog Food (Phases 94-97)
- v1.19 Maturidade Operacional (Phases 98-99)

PRR 22→28/30, coverage 65→81.51%, suite 210→482 testes. Detalhes em `.planning/MILESTONES.md` + audits específicos.

## ~~Milestone Anterior: v1.12 Legacy Code Mastery & AI-Era Refactoring~~

**Objetivo:** Adicionar 5ª suíte ao kit (Legacy) derivada do livro Feathers (2004) — *characterization tests*, *seams*, *sprout/wrap*, *effect analysis*, *monster methods*, *extract class*, *programming by difference*, *API-only applications*, *shotgun surgery*, *storytelling/naked CRC* — todos modernizados para o contexto atual onde Supabase Edge Functions são as principais "API-only applications", LLMs são dependências legítimas que precisam ser fakeadas/instrumentadas, prompts são código legado que precisa de characterization, e embeddings + IA podem substituir trabalho mecânico de detecção.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (12+1 glossário)** — expertise consultável que viaja com o kit:
  - `_shared-legacy/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN) sobre legacy code, seams, characterization
  - `legacy-characterization-tests` — golden snapshots, 7 grupos de equivalência, sanitização (cap 13+23)
  - `legacy-seams-and-test-harness` — 3 tipos de seam, ~24 técnicas de break-deps (cap 3-4, 9-10, 25)
  - `legacy-sprout-wrap-techniques` — sprout method/class + wrap method/class (cap 6)
  - `legacy-effect-analysis` — effect sketches, inflection points, narrowing (cap 11-12, 16)
  - `legacy-monster-methods` — bulleted vs snarled, scratch refactoring, single-goal editing (cap 22)
  - `legacy-extract-class` — too-big classes, responsibility hot spots, single-responsibility refactoring (cap 20)
  - `legacy-programming-by-difference` — TDD em legacy, herança/composição como atalho temporário (cap 8)
  - `legacy-api-only-applications` — adapter/anti-corruption layer; aplicado a Supabase Edge Functions wrappando Stripe/OpenAI/etc (cap 15 + modernização)
  - `legacy-shotgun-surgery` — duplicate detection + extract; modernizado com semantic search via embeddings (cap 21 + modernização)
  - `legacy-storytelling-naked-crc` — gerar mental model de codebase desconhecido; modernizado com IA produzindo storytelling (cap 16-17 + modernização)
  - `ai-prompt-characterization` — prompts e tools são legacy code também; characterization de generations LLM com sampling deterministic (modernização sem precedente em 2004)
  - `llm-as-dependency` — fakear OpenAI/Anthropic clients; deterministic test mode com fixtures (modernização)
  - `pre-refactor-characterization` — auto-trigger gate ANTES de refactor de risco

- **Agentes (8)** — workers especializados:
  - `legacy-characterizer` — gera characterization tests cobrindo 7 grupos canônicos
  - `seam-finder` — analisa seams + recomenda técnica do cap 25 com menor custo
  - `refactor-safety-auditor` — gate canônico runtime; veredito GO/BLOCK/WARN/GO-OVERRIDE
  - `payload-capture-instrumenter` — instrumenta Edge Function para captura de payloads via mcp__supabase__get_logs (modernização)
  - `storytelling-analyst` — IA gera mental model + telling-the-story de codebase desconhecido (modernização)
  - `shotgun-surgery-detector` — detecta duplicação semântica via embeddings (pgvector se disponível) (modernização)
  - `ai-mutation-tester` — LLM gera mutants comportamentais (mais ricos que sintáticos) (modernização)
  - `observability-coverage-auditor` — audit de cobertura de 4 golden signals/SLO/burn-alert por Edge Function (modernização)

- **Comandos (10):**
  - `/caracterizar` — invoca legacy-characterizer
  - `/encontrar-seams` — invoca seam-finder
  - `/auditar-refactor` — invoca refactor-safety-auditor
  - `/refactor-seguro` — chain canônico (seams → caracterizar → audit → executar)
  - `/legacy [subcomando]` — orquestrador da Suíte Legacy (5ª da família após /supabase, /observabilidade, /sre)
  - `/capturar-payloads` — instrumenta Edge Function pra captura via Supabase logs (modernização)
  - `/caracterizar-prompt` — characterization de prompts/tools LLM (modernização)
  - `/storytelling` — IA gera mental model de codebase (modernização)
  - `/detectar-duplicacao` — shotgun surgery via embeddings (modernização)
  - `/auditar-observabilidade-cobertura` — audit X/N Edge Functions com 4 golden signals + SLO + burn alert (modernização)

- **Audit gates (3):**
  - `legacy-refactor-safety` — bloqueia plano com refactor sem characterization
  - `ai-prompt-stability` — prompts em prod precisam de characterization (modernização)
  - `observability-coverage` — % Edge Functions com golden signals + SLO + burn alert ≥ threshold (modernização)

- **Integração com Suítes existentes (4 patches):**
  - `four-golden-signals` (v1.10): patch para sugerir characterization de payloads ao instrumentar
  - `prr-conductor` (v1.10): Axe 5 (Change Management) consume REFACTOR-SAFETY.md
  - `omm-auditor` (v1.9): Capacidade 1 (Resilience) consulta % refactors com safety net
  - `supabase-edge-fn-writer` (v1.8): aplica adapter pattern + payload capture pattern built-in

- **Integração com fluxo framework (3 patches):**
  - `planner` + `executor` + `verifier` — gate runtime + verificação reversa pós-refactor
  - `/discutir-fase` — pergunta canônica + injeção de seção `<refactor_safety>` em CONTEXT.md
  - `/auditar-marco` + `/forense` — opt-in audit retroativo + lessons learned canônicas

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: *Working Effectively with Legacy Code* — Michael Feathers (Prentice Hall / Robert C. Martin Series, 2004). ISBN 978-0-13-117705-5.
- Modernizações documentadas explicitamente — cada skill nova marca o que é "Feathers original" vs "extensão IA/Supabase 2026".
- Conteúdo PT-BR (alinhado v1.8/v1.9/v1.10/v1.11). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 48** (continua v1.11 que termina em Phase 47).
- Integra naturalmente com as outras 4 suítes — Supabase, Observabilidade, SRE, e a futura SRE Resilience.

**Beneficiários principais:**
- Suíte Supabase v1.8 — `supabase-edge-fn-writer` ganha `legacy-api-only-applications` pattern + payload capture
- Suíte Observabilidade v1.9 — `omm-auditor` Capacidade 1 (Resilience) consulta legacy-refactor coverage; `/auditar-observabilidade-cobertura` complementa OMM
- Suíte SRE v1.10 — `prr-conductor` Axe 5 consume REFACTOR-SAFETY; `/postmortem` consulta REFACTOR-SAFETY em regression incidents
- Fluxo framework — todos os comandos principais ganham awareness de legacy code

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

## ~~Milestone Anterior: v1.11 SRE Resilience & Release Engineering~~

**Objetivo:** Adicionar a 2ª camada de expertise SRE ao kit, derivada dos caps 22 e 8 do livro Google SRE — resiliência operacional (cascading failures, retries com jitter, load shedding, graceful degradation) e disciplina de release (hermetic builds, deployment philosophy, policy enforcement). Completa a v1.10 e estabelece base para projetos production-bound com tier-1 maturity.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (5 + 1 glossary patch)** — expertise consultável que viaja com o kit:
  - `cascading-failures` — triggers, loops de feedback, prevenção (cap 22 main)
  - `load-shedding-graceful-degradation` — queue management, load shedding patterns (cap 22 sub)
  - `retry-strategies` — jitter + exponential backoff + deadlines + idempotency (cap 22 sub)
  - `hermetic-builds` — reproducibility + isolation + provenance (cap 8 sub)
  - `release-engineering` — deployment philosophy + self-service + policy enforcement (cap 8 main)
  - Patch em `_shared-sre/glossary.md` (v1.10) — adiciona vocabulário cap 22+8 (cascading failure, retry storm, load shedding, graceful degradation, hermetic build, release pipeline, deployment policy, kill switch, throttle)

- **Agentes (3)** — workers especializados:
  - `cascading-failures-auditor` — analisa código de serviço para triggers de cascading (sem timeout, retry sem jitter, sem circuit breaker, dependências sem health check) e produz `CASCADING-AUDIT.md` priorizado
  - `load-shedding-instrumenter` — aplica padrões de load shedding em código (queue depth gauge, drop policy, deadline propagation, server-side rate limit)
  - `release-pipeline-auditor` — audita CI/CD para hermeticidade, reprodutibilidade, policy enforcement; produz `RELEASE-AUDIT.md`

- **Comandos (3 + extensões /sre):**
  - `/auditar-cascading` — invoca `cascading-failures-auditor`
  - `/load-shedding` — invoca `load-shedding-instrumenter`
  - `/auditar-release` — invoca `release-pipeline-auditor`
  - Extensão do orquestrador `/sre` com 3 novos subcomandos (`cascading`, `load-shedding`, `release`)

- **Integração com Suítes existentes (5 patches):**
  - `four-golden-signals` (v1.10): Saturation signal documentada como early warning de cascading failure
  - `prr-conductor` (v1.10): Axe 4 (Capacity Planning) ganha checks de cascading; Axe 5 (Change Management) ganha hermeticidade
  - `supabase-edge-fn-writer` (v1.8): template ganha retry-with-jitter, deadline propagation, server-side load shedding
  - `omm-auditor` (v1.9): Capacidade 1 (Resilience) consulta `cascading-failures-auditor`
  - `/concluir-marco`: gate `release-pipeline-policy` opt-in (paralelo ao PRR gate v1.10)

- **Audit gates (2):** `cascading-failures-prevention`, `release-pipeline-policy`

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: mesmo livro v1.10 (*Site Reliability Engineering*, 978-1-491-92912-4). Caps 22 e 8 — sem expansão para Workbook por design (mantém narrativa SSOT).
- Conteúdo em PT-BR (alinhado com v1.8/v1.9/v1.10). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 42** (continuação de v1.10 que terminou em 41).
- Numeração de skills: extension natural da família SKFD (existing 5 SKFD-SRE + 5 novas SKFD-SRE-2).

**Beneficiários principais:**
- Suíte SRE v1.10 — `prr-conductor` ganha checks Axe 4+5; `four-golden-signals` ganha contexto cascading
- Suíte Observabilidade v1.9 — `omm-auditor` Capacidade 1 (Resilience) consulta cascading-auditor
- Suíte Supabase v1.8 — `supabase-edge-fn-writer` ganha resiliência built-in
- Fluxo framework — `/concluir-marco` ganha release-pipeline gate (opt-in)

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

## Histórico (arquivado abaixo)

<details>
<summary>v1.10 SRE Engagement — entregue 2026-05-07</summary>

## Milestone v1.10 SRE Engagement (entregue 2026-05-07)

## Histórico (arquivado abaixo)

<details>
<summary>v1.10 SRE Engagement — milestone original</summary>

## Milestone v1.10 SRE Engagement (entregue 2026-05-07)

**Objetivo:** Adicionar uma camada de expertise em SRE (Site Reliability Engineering) ao kit derivada do livro do Google, complementando v1.9 (Observabilidade) com práticas de engagement de SRE — Production Readiness Review (PRR), Four Golden Signals, Postmortem Culture blameless, Toil elimination, Risk management. Camada se beneficia profundamente da Suíte Observabilidade v1.9 (SLOs, burn-rate, OMM) e da Suíte Supabase v1.8 (instrumentação de Edge Functions com golden signals).

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (6)** — expertise consultável que viaja com o kit:
  - `_shared-sre/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN) sobre SRE
  - `sre-risk-management` — risk continuum, 99.99% wisdom, error budget como balanço explícito risk × innovation (cap 3)
  - `four-golden-signals` — Latency + Traffic + Errors + Saturation como sinais mínimos de monitoramento (cap 6)
  - `eliminating-toil` — definição de toil, regra ≤ 50%, padrões de automação (cap 5)
  - `blameless-postmortems` — template canônico, "no postmortem left unreviewed", Wheel of Misfortune (cap 15)
  - `production-readiness-review` — checklist PRR canônica + Engagement Model (Simple PRR / Early Engagement / Frameworks) (cap 32)

- **Agentes (4)** — workers especializados:
  - `golden-signals-instrumenter` — aplica os 4 golden signals em código (latency/traffic/errors/saturation com histograms/counters); especialização do `observability-instrumenter` v1.9
  - `toil-auditor` — analisa repo + commits + scripts para identificar toil (manual repetitivo automatizável sem valor durável); recomenda automação
  - `postmortem-writer` — após `incident-investigator` v1.9 fechar Core Analysis Loop, gera postmortem blameless seguindo template canônico
  - `prr-conductor` — conduz Production Readiness Review para serviço/feature; produz PRR-REPORT.md scored com gaps e action items

- **Comandos (5+1 orquestrador):**
  - `/golden-signals` — aplica 4 golden signals em fase ou serviço (invoca `golden-signals-instrumenter`)
  - `/auditar-toil` — identifica toil no projeto, sugere automação (invoca `toil-auditor`)
  - `/postmortem` — gera postmortem blameless após incident-investigator (invoca `postmortem-writer`)
  - `/prr` — conduz PRR para serviço/feature (invoca `prr-conductor`)
  - `/risk-budget` — exibe state do error budget vs risk continuum (consume SLOs v1.9)
  - `/sre [subcomando]` — orquestrador único (análogo a `/supabase`, `/observabilidade`)

- **Integração com Suíte Observabilidade v1.9** — patches em 2 artefatos: `event-based-slos` ganha menção a risk continuum; `omm-auditor` consume `toil-auditor` para Capacidade 3 (Complexidade).

- **Integração com Suíte Supabase v1.8** — patches em 4 agentes: `supabase-edge-fn-writer` aplica os 4 golden signals; `supabase-architect` referencia PRR antes de prod; `supabase-migration-writer` identifica toil em scripts SQL repetitivos; `supabase-storage-implementer` aplica saturation signal para uploads.

- **Integração com fluxo framework** — patches em 3 comandos: `/forense` → chain para `/postmortem`; `/concluir-marco` → gate `/prr` para features production-bound; `/auditar-marco` → invoca `/auditar-toil` para scoring OMM Capacidade 3.

- **Audit gates (3 novos):** `golden-signals-coverage`, `postmortem-template-required`, `prr-checklist-coverage`.

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: livro *Site Reliability Engineering* (978-1-491-92912-4), gratuito em sre.google/books.
- Conteúdo em PT-BR (alinhado com o resto do kit). Code blocks EN com comentários PT-BR (precedente v1.8/v1.9).
- Roadmap começa em **Phase 36** (continuação de v1.9 que terminou em 35).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

</details>

## ~~Milestone Anterior: v1.9 Observabilidade (concluído 2026-05-06)~~

**Objetivo:** Adicionar uma camada de expertise em observabilidade ao kit (skills + agentes + comandos), inspirada em *Observability Engineering*, aproveitada pela Suíte Supabase existente para potencializar o uso dos MCP tools `mcp__supabase__get_logs/get_advisors/execute_sql` em diagnóstico, SLOs e instrumentação.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (11)** — expertise consultável que viaja com o kit:
  - `_shared-observability/glossary.md` — vocabulário canônico (event, span, trace, SLI, SLO, error budget, burn rate, OMM)
  - `structured-events` — wide events de alta cardinalidade (1/request)
  - `distributed-tracing` — trace_id/span_id, W3C TraceContext, stitching
  - `opentelemetry-standard` — SDK, Tracer, Meter, Exporter, Collector, OTLP
  - `core-analysis-loop` — debug iterativo from first principles (4 fases)
  - `observability-driven-development` — bundle telemetria com feature, 4 perguntas pré-PR
  - `event-based-slos` — SLI event-based, sliding window, decouple what/why
  - `burn-rate-alerting` — lookahead/baseline windows, fator 4×
  - `telemetry-sampling` — head/tail, by-key, dynamic
  - `telemetry-pipelines` — routing, buffering, filtering
  - `observability-maturity-model` — 5 capacidades (resiliência, qualidade, complexidade, cadência, comportamento)

- **Agentes (5+1 opcional)** — workers especializados:
  - `observability-instrumenter` — instrumenta código com OTel + structured events
  - `incident-investigator` — aplica Core Analysis Loop usando `mcp__supabase__get_logs/execute_sql/get_advisors`
  - `slo-engineer` — define SLI/SLO/error budget materializando contagem em SQL
  - `burn-rate-forecaster` — calcula burn rate predictive com janelas
  - `omm-auditor` — pontua projeto contra Observability Maturity Model
  - `telemetry-sampler` (opcional) — config de sampling por endpoint
  - `telemetry-pipeline-architect` (opcional) — config de OTel Collector

- **Comandos (5+1 orquestrador):**
  - `/instrumentar-fase` — após `/planejar-fase`, gera `INSTRUMENTATION.md` por plano
  - `/definir-slo` — gera `SLO.md` + SQL para materializar SLI events
  - `/investigar-producao` — Core Analysis Loop guiado, estado persistente
  - `/burn-rate-status` — tabela SLO/% gasto/ETA exhaustão
  - `/auditar-observabilidade` — OMM scored 5 capacidades
  - `/observabilidade [subcomando]` — orquestrador único (análogo a `/supabase`)

- **Integração com Suíte Supabase** — patches nos 7 agentes existentes (architect, migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer) para consultarem as skills novas.

- **Integração com fluxo framework** — `/discutir-fase` pergunta sobre instrumentação, `/planejar-fase` bloqueia se ODD ausente, `/concluir-marco` gate em OMM regression.

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: livro *Observability Engineering* (978-1-492-07644-5).
- Conteúdo em PT-BR (alinhado com o resto do kit).
- Roadmap começa em **Phase 29** (continuação de v1.8 que terminou em 28).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde.

## ~~Milestone Anterior: v1.8 Suíte Supabase (concluído 2026-05-06)~~

**Objetivo:** Adicionar uma camada completa de expertise Supabase ao kit (skills + agents + commands), permitindo que consumidores do `@luanpdd/kit-mcp` tenham apoio canônico ao construir e manter backends Supabase — Postgres/DB, Auth, Realtime, Edge Functions, RLS, Migrations — diretamente do fluxo de trabalho do kit.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (8)** — expertise consultável que viaja com o kit:
  - `supabase-realtime` — broadcast vs postgres_changes, RLS para realtime, naming de canais, triggers `realtime.broadcast_changes`
  - `supabase-auth-ssr` — Next.js v16 + `@supabase/ssr` (getAll/setAll), browser/server clients, proxy
  - `supabase-edge-functions` — Deno runtime, `npm:`/`jsr:` imports, env vars, `EdgeRuntime.waitUntil`
  - `supabase-declarative-schema` — `supabase/schemas/`, `db diff`, ordering lexicográfica, caveats
  - `supabase-rls-policies` — `auth.uid()`, policies por operação, indexing, MFA, performance
  - `supabase-database-functions` — SECURITY INVOKER, `search_path`, immutable/stable, triggers
  - `supabase-migrations` — naming `YYYYMMDDHHmmss_*.sql`, RLS obrigatório, granular policies
  - `supabase-postgres-style` — Postgres SQL style guide (lowercase, snake_case, plurals)

- **Agents (6)** — workers ativos especializados:
  - `supabase-architect` — projeta schema + RLS + topologia realtime antes da implementação
  - `supabase-migration-writer` — escreve migrations seguindo declarative schema + RLS + style guide
  - `supabase-rls-writer` — gera RLS policies com indexing recomendado
  - `supabase-edge-fn-writer` — escreve Deno Edge Functions
  - `supabase-realtime-implementer` — configura canais (client + DB triggers + RLS)
  - `supabase-auth-bootstrapper` — bootstrap Next.js v16 com Supabase Auth (SSR)
  - (existente: `schema-checker` — pré-migration validator; será cross-referenced pelos novos agents)

- **Commands (1)** — entry point único:
  - `/supabase [subcomando]` — orquestrador que roteia para o agent certo (`arquiteto`, `migration`, `rls`, `edge`, `realtime`, `auth`)

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Agents usam tools `mcp__supabase__*` quando disponíveis (precedente: `schema-checker.md`).
- Conteúdo em PT-BR (alinhado com o resto do kit).
- Material-fonte: 7 guias oficiais Supabase (Realtime, Auth SSR, Edge Functions, Declarative Schema, RLS, DB Functions, Migrations, Postgres Style).
- Roadmap começa em **Phase 25** (continuação de v1.7 que terminou em 24).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos agents/commands/skills disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde.

## ~~Milestone Anterior: v1.7 perf+lean part 2 + UX naming canonical (concluído 2026-05-06)~~

**Objetivo:** Continuar otimização interna de v1.6 com cuts mais profundos em workflows + dedup de boilerplate de agentes + sync stub-only mode. Adicionar `/fazer` como entrypoint canônico que rouba os outros como aliases.

**Funcionalidades alvo:**
- **P1 cont.** — compactar 3 workflows maiores (discuss-phase 49 KB, new-project 40 KB, plan-phase 36 KB) usando playbook de v1.6
- **P3** — stub-only mode em sync (lê só frontmatter, não content body) → 3-5× mais rápido em sync default
- **P4** — agent boilerplate dedup via `<shared>` references (kit/agents/_shared/) — reduz custo agregado do executor multiplicado
- **U3** — `/fazer` vira canonical com árvore de decisão clara; `/expresso`, `/rapido`, `/proximo` ficam como aliases documentados

## ~~Milestone Anterior: v1.6 perf+lean (interno — concluído 2026-05-05)~~

**Objetivo:** Endereçar 16 itens identificados pela auditoria de codebase (executada após v1.5.3) que ficaram fora do bundle quick-win. Foco: tornar o servidor mais barato de rodar, mais seguro, com release pipeline mais robusto e prompts mais enxutos.

**Funcionalidades alvo (todas internas, zero superfície de API nova):**
- **Performance** — listKit caching, compilação top-level de regex, reuso de kit em sync/reverse-sync, healthz probe com timeout local, paginação opcional em /state
- **Segurança** — TOCTOU em acquireLockOrReclaim, normalização de path em walkTree, redactPath case-insensitive (Windows), audit periódico de open@11
- **Infra** — `prepublishOnly` script, `.npmignore` explícito, Node 24 na matriz CI, mensagem do deps-budget gate sincronizada com count real
- **Tokens** — compactar `planner.md` (53 KB → ~30 KB), lazy-load CLAUDE.md gerado, consolidar headers recursivos em agents grandes

**Decisões de stack:**
- Continua zero deps novas. Otimização interna sem ampliar superfície.
- Sem mudanças de API runtime (`Stable API v1.0+` preservada). Reduções em outputs de tool MCP são "remoções de campo opcional" — clientes ainda funcionam.
- Roadmap começa em **Phase 19** (continuando de v1.2 que terminou em Phase 18; v1.3-v1.5.x foram patches ad-hoc fora do framework).

**Contrato preservado:** Quem usa kit-mcp em produção (sync/reverse-sync/MCP via npx ou global) não percebe nada além de menor latência e menor consumo de tokens. CI permanece 6/6 verde, smoke tests inalterados.

## Visão de uma frase

kit-mcp é um MCP server que distribui o fluxo de trabalho pessoal do mantenedor (agents, slash-commands, framework de planejamento brownfield em PT-BR, hooks) e sincroniza esse kit no layout nativo de qualquer IDE compatível (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae).

## Por que existe

- O conteúdo de `.claude/agents/`, `.claude/commands/` e `.claude/skills/` é poderoso mas amarrado ao Claude Code.
- O mesmo conteúdo precisa também viver como `AGENTS.md` para Codex, `GEMINI.md` para Gemini, `.cursor/rules/` para Cursor, etc.
- Manter cópias paralelas drift imediatamente.
- kit-mcp guarda a fonte canônica em um único lugar (`kit/`) e projeta para cada IDE através de um registry table único (`src/core/registry.js`).

## Stack

- **Runtime**: Node.js ≥ 20, ESM puro, sem build step.
- **Deps de runtime**: `@modelcontextprotocol/sdk`, `commander`, `chokidar`.
- **Distribuição**: npm (`@luanpdd/kit-mcp`, scoped, public).
- **CI**: GitHub Actions, smoke tests em Ubuntu/macOS/Windows × Node 20/22.

## Arquitetura

```
CLI ↔ src/core/  (pure runtime: registry, kit, sync, gates, forensics, watch, reverse-sync)
       ↑       
MCP server (stdio) — exposes 6 action-dispatch tools (kit, sync, reverse-sync, gates, forensics, install)
       ↑
.mcp.json registration → IDE invoca o server quando abre o projeto
```

Sync grava stubs markdown-reference por padrão (`.claude/agents/foo.md` aponta de volta para `kit/agents/foo.md`). Mirror-tree para framework + hooks (cópia direta da subtree).

## Princípios de produto

1. **Single canonical source.** `kit/` é a verdade. Tudo em `.claude/` (e equivalentes) é regenerável.
2. **Add-an-IDE = uma entrada na tabela.** O TARGETS dict em `registry.js` é o único lugar onde IDEs são descritas.
3. **Pre-1.0 SemVer permissivo.** Mudanças comportamentais são minor bumps; correções são patch.
4. **Pacote pequeno, dependências mínimas.** Nada de build steps, frameworks de teste pesados, ou polifills.

## Restrições

- **Sem 2FA bypass nas chaves npm além do necessário pra publicação automática.**
- **Não embarcar conteúdo de terceiros** (Anthropic Cowork skills, Notion IDs privados, URLs de repos privados).
- **Cross-platform sempre.** Windows, macOS e Linux têm que funcionar igual.

## Evolução

Este documento evolui nas transições de fase e limites de milestone.

**Após cada transição de fase** (via `/transicao`):
1. Requisitos invalidados? → Mover para Fora do Escopo com motivo
2. Requisitos validados? → Mover para Validados com referência de fase
3. Novos requisitos surgiram? → Adicionar em Ativos
4. Decisões a registrar? → Adicionar em Decisões-chave
5. "O Que É" ainda está preciso? → Atualizar se driftar

**Após cada milestone** (via `/concluir-marco`):
1. Revisão completa de todas as seções
2. Verificação do Valor Central — ainda é a prioridade certa?
3. Auditar Fora do Escopo — motivos ainda são válidos?
4. Atualizar Contexto com estado atual
