# Pesquisa de Funcionalidades — Suíte Supabase v1.8

**Domínio:** Conteúdo de kit (skills + agents + commands) que dá a LLMs expertise canônica para construir apps Supabase reais em 2026
**Pesquisado:** 2026-05-06
**Confiança:** HIGH (baseado em docs oficiais Supabase 2026 + posts da comunidade + patterns vistos em produção)

> **Escopo:** Esta pesquisa valida quais features de **app-level** (o que devs LLM-assistidos constroem) merecem cobertura no kit. **Não** discute features Supabase-internal (release pipeline, dashboard, etc.).
>
> **Plano-base do milestone (entrada da pesquisa):** 8 skills + 6 agents + comando `/supabase`. Resultado: a lista cobre ~75% das features essenciais. Lacunas e adições recomendadas estão marcadas com `[GAP]` e `[NOVO]` ao longo do documento.

---

## Sumário Executivo

**Veredito sobre o plano atual:** Sólido para o "core stack" (Auth + DB + RLS + Realtime + Edge Functions + Migrations + Postgres style). Cobre ~75% do que apps reais constroem. Há **3 lacunas essenciais** que merecem entrar em v1.8 e **4-5 diferenciais** candidatos a v1.9.

**Lacunas essenciais (recomendado adicionar a v1.8):**
1. **`supabase-storage`** (skill) + **`supabase-storage-implementer`** (agent) — uploads, signed URLs, multi-tenant isolation, image transformations. Apps com upload de imagem/arquivo são maioria absoluta.
2. **`supabase-pgvector-rag`** (skill) — pgvector + embeddings + chunking + hybrid search. Enorme em 2026 com onda de apps RAG.
3. **`supabase-cron-queues`** (skill) — pg_cron + pgmq + pg_net. Background jobs via Edge Functions é padrão para qualquer app que processa async (embeddings, emails, webhooks).

**Diferenciais (candidatos a v1.9):**
- `supabase-auth-mfa` (TOTP/phone enrollment + AAL2 enforcement)
- `supabase-auth-multi-tenant` (organizations/teams pattern com RLS)
- `supabase-branching` (preview/staging/prod environments + seed)
- `supabase-fts` (full-text search com tsvector/GIN/ranking)
- `supabase-frontend-frameworks` (Expo, SvelteKit, Nuxt, Remix — Next.js v16 já está em escopo)

**Anti-features (fora de escopo):**
- "Tudo realtime" (broadcast de tudo, postgres_changes em tabelas hot)
- Custom auth from scratch (reimplementar bcrypt/sessions)
- Service-role no client (anti-pattern crítico)

---

## 1. Auth Flows

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Email/password básico | Essencial | Sim, via `supabase-auth-ssr` + `supabase-auth-bootstrapper` | Manter |
| Magic link | Essencial | Parcial (skill cobre SSR, mas fluxo magic link precisa explicitação) | Adicionar seção dedicada em `supabase-auth-ssr` |
| OAuth social (Google/GitHub/Apple) | Essencial | Parcial (skill SSR menciona, agent bootstrapper precisa cobrir) | Estender `supabase-auth-bootstrapper` para gerar callback handlers |
| Password reset / account recovery | Essencial | Não explicitamente coberto | Estender `supabase-auth-ssr` com seção "recovery flows" |
| OTP via SMS/email | Essencial | Parcial | Estender `supabase-auth-ssr` |
| MFA TOTP (app authenticator) | Diferencial | Não coberto | **`supabase-auth-mfa` (skill nova)** — candidato v1.9 |
| MFA Phone | Diferencial | Não coberto | Cabe em `supabase-auth-mfa` |
| AAL2 enforcement (high-security paths) | Diferencial | Não coberto | Cabe em `supabase-auth-mfa` |
| Multi-tenant (organizations/teams) | Diferencial | Não coberto | **`supabase-auth-multi-tenant` (skill nova)** — candidato v1.9 |
| SSO (enterprise SAML) | Anti-feature p/ kit | N/A | Raro em apps indie/startup; cobertura via doc oficial é suficiente |

### Complexidade

- **Auth básico (email/password + magic link + OAuth):** 1-2 hrs por flow para LLM com skill bem escrita; 4-6 hrs sem skill (alto risco de bug em SSR)
- **MFA TOTP completo (enroll + challenge + verify + AAL2):** 1-2 dias multi-fase
- **Multi-tenant (organizations/teams + RLS):** 1-2 dias multi-fase, depende fortemente de RLS

### Dependências

```
supabase-auth-ssr (skill)
    └── requer: supabase-postgres-style (naming convention)
    └── requer: supabase-rls-policies (auth.uid() patterns)

supabase-auth-mfa
    └── requer: supabase-auth-ssr (cliente base)
    └── requer: supabase-rls-policies (AAL2 em policies)

supabase-auth-multi-tenant
    └── requer: supabase-auth-ssr
    └── requer: supabase-rls-policies (CRÍTICO — tenant_id em toda policy)
    └── requer: supabase-migrations (organizations/members tables)
```

### Mapeamento → kit

- **Já no plano:** `supabase-auth-ssr` (skill) + `supabase-auth-bootstrapper` (agent). **Estender ambos** para cobrir magic link, OAuth callbacks, password reset.
- **`[NOVO v1.9]` `supabase-auth-mfa` (skill).** Cobertura: enroll, challenge, verify, AAL claims, recovery codes, factor backup.
- **`[NOVO v1.9]` `supabase-auth-multi-tenant` (skill).** Cobertura: `organizations` + `members` tables, RLS com `is_member_of(org_id)`, invite flow, role enforcement.

---

## 2. Realtime Patterns

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Chat rooms (broadcast + persistência) | Essencial | Sim, via `supabase-realtime` | Manter; bom alvo de exemplo |
| Presence (who's online) | Essencial | Sim, skill cobre `realtime.broadcast_changes` mas presence merece seção dedicada | Estender skill com seção Presence |
| Typing indicators / cursors / brush strokes | Essencial | Sim (broadcast) | Coberto |
| Postgres Changes (live tables) | Essencial | Sim | Coberto |
| Live dashboards (gráficos em tempo real) | Diferencial | Parcial — pattern de subscription + UI throttle merece seção | Estender skill com seção "live dashboards" |
| Notifications push (browser/mobile) | Diferencial | Não coberto (depende de provider externo: Web Push, FCM, APNs) | Fora de escopo Supabase puro; cabe seção em `supabase-realtime` "como combinar com push provider" |
| Collaborative editing (CRDT/OT) | Anti-feature | N/A | Supabase fornece transport (broadcast); CRDT/OT são problema separado (Yjs, Automerge). Skill deve mencionar limites |
| Realtime sobre tabelas hot (high-write) | Anti-feature | N/A — skill atual deve avisar sobre custo | Garantir warning na skill `supabase-realtime` |

### Complexidade

- **Chat room básico (broadcast + DB):** 2-4 hrs com skill
- **Presence (online indicators):** 1-2 hrs com skill
- **Live dashboard (subscriptions + UI):** 1 dia (UI throttle é o difícil, não Supabase)
- **Collaborative editing (CRDT):** **multi-fase, fora do escopo** — skill deve direcionar a Yjs/Automerge

### Dependências

```
supabase-realtime
    └── requer: supabase-rls-policies (realtime.messages RLS)
    └── requer: supabase-database-functions (triggers para broadcast_changes)

supabase-realtime-implementer (agent)
    └── requer: supabase-rls-writer (gera policies)
    └── requer: supabase-migration-writer (cria tabela messages + trigger)
```

### Mapeamento → kit

- **Já no plano:** `supabase-realtime` (skill) + `supabase-realtime-implementer` (agent). **Estender skill** com seção Presence dedicada e seção "live dashboard" (UI throttle pattern).
- **Anti-feature explícita** na skill: "**não** habilite postgres_changes em tabelas com >1 write/s — use broadcast + server-side aggregation".

---

## 3. File Handling

### `[GAP]` Lacuna essencial — Storage não está no plano de v1.8

**Esta é a lacuna mais grave.** Apps Supabase reais quase sempre lidam com upload (avatar, foto de produto, anexo, PDF). Sem cobertura de Storage no kit, LLMs vão errar:
- Bucket público vs privado
- Path com user_id como prefixo (RLS)
- Signed URLs com expiração
- TUS resumable upload p/ arquivos >6 MB
- Image transformations (resize/crop) em signed URLs

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Image upload simples | Essencial | Não | **`supabase-storage` (skill nova)** |
| Signed URLs (privado + expiração) | Essencial | Não | **Cabe em `supabase-storage`** |
| Multi-tenant isolation (path = user_id/file) | Essencial | Não | **Cabe em `supabase-storage`** + RLS de Storage |
| Image transformations (resize, format, quality) | Essencial | Não | **Cabe em `supabase-storage`** |
| Multipart/TUS resumable upload (>6 MB) | Diferencial | Não | **Cabe em `supabase-storage`** |
| CDN cache + invalidação (write-to-new-path) | Essencial | Não | **Cabe em `supabase-storage`** |
| Direct upload via signed POST URL | Diferencial | Não | **Cabe em `supabase-storage`** |
| Antivírus / content moderation | Anti-feature p/ kit | N/A | Provider externo (cabe Edge Function chamando Cloudflare/AWS) |

### Complexidade

- **Upload + signed URL + RLS de Storage:** 2-4 hrs com skill, 1 dia sem
- **Image transformations + CDN-aware overwrite:** 2-3 hrs com skill
- **TUS resumable upload:** 4-6 hrs (requer entender protocol TUS)

### Dependências

```
supabase-storage (skill nova)
    └── requer: supabase-rls-policies (RLS aplica a storage.objects)
    └── requer: supabase-postgres-style (naming buckets snake_case)

supabase-storage-implementer (agent novo, opcional)
    └── requer: supabase-storage (skill)
    └── requer: supabase-rls-writer (policies)
    └── requer: supabase-migration-writer (criar bucket via SQL)
```

### Mapeamento → kit

- **`[NOVO v1.8 — ESSENCIAL]` `supabase-storage` (skill).** Cobertura mínima: bucket público vs privado, path policy com user_id, signed URL + transform, TUS p/ arquivos grandes, anti-overwrite (write-to-new-path), RLS sobre `storage.objects`.
- **`[NOVO v1.8 — ESSENCIAL]` `supabase-storage-implementer` (agent).** Worker que cria bucket + RLS + handler de upload no client. Compose com `supabase-rls-writer` e `supabase-migration-writer`.

---

## 4. AI / RAG Features

### `[GAP]` Lacuna essencial — pgvector/RAG não está no plano de v1.8

Apps RAG (chatbot sobre docs, busca semântica) explodiram em 2025-2026. pgvector é pivot. Sem skill, LLMs erram em escolha de index (HNSW vs IVFFlat), chunking strategy, hybrid search com lexical, e automação de embeddings via cron+queue.

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| pgvector setup + extension | Essencial | Não | **`supabase-pgvector-rag` (skill nova)** |
| Geração de embeddings (OpenAI/Google/local) | Essencial | Não | **Cabe em `supabase-pgvector-rag`** |
| Chunking de documentos (size + overlap) | Essencial | Não | **Cabe em `supabase-pgvector-rag`** |
| Index HNSW vs IVFFlat (escolha) | Essencial | Não | **Cabe em `supabase-pgvector-rag`** |
| Hybrid search (vector + tsvector RRF) | Diferencial | Não | **Cabe em `supabase-pgvector-rag`** |
| Embeddings automáticos via trigger+queue+cron | Diferencial | Parcialmente coberto por supabase-database-functions, mas pattern completo merece destaque | **Cabe em `supabase-pgvector-rag`** com cross-ref a `supabase-cron-queues` |
| RAG with permissions (RLS + vector search) | Diferencial | Não | **Cabe em `supabase-pgvector-rag`** — pattern crítico para multi-tenant RAG |
| Semantic caching | Diferencial | Não | **Cabe em `supabase-pgvector-rag`** |
| Vector store sem RLS | Anti-feature | N/A | Skill deve avisar: dados sensíveis sempre com RLS |

### Complexidade

- **RAG básico (embeddings + busca):** 4-6 hrs com skill
- **Hybrid search (RRF):** 1 dia
- **Embeddings automáticos (trigger+queue+cron):** 1-2 dias multi-fase

### Dependências

```
supabase-pgvector-rag (skill nova)
    └── requer: supabase-migrations (CREATE EXTENSION vector)
    └── requer: supabase-database-functions (similarity search RPC)
    └── requer: supabase-rls-policies (RAG with permissions)
    └── melhora-com: supabase-cron-queues (embeddings async)
    └── melhora-com: supabase-edge-functions (worker que chama OpenAI)
```

### Mapeamento → kit

- **`[NOVO v1.8 — ESSENCIAL]` `supabase-pgvector-rag` (skill).** Cobertura: extension setup, dimensionality (1536/3072/etc), HNSW vs IVFFlat (regra: HNSW para <1M rows), chunking (size+overlap), match_documents RPC, hybrid search com RRF, RAG with permissions (RLS + auth.uid()).
- **Sem agent dedicado** — `supabase-architect` cobre o design e workers existentes (`supabase-migration-writer`, `supabase-edge-fn-writer`) implementam as partes.

---

## 5. Backend Automation

### `[GAP]` Lacuna essencial — pg_cron/pgmq/queues não estão no plano de v1.8

Background jobs (processar email, gerar embedding, retry de webhook) são parte de qualquer app Supabase de produção. O stack canônico em 2026 é **pg_cron + pgmq + pg_net + Edge Functions**. Sem skill, LLMs vão sugerir cron externo (Inngest, Trigger.dev) quando a stack interna já resolve.

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Scheduled jobs (cron via pg_cron) | Essencial | Não | **`supabase-cron-queues` (skill nova)** |
| Queues (pgmq) | Essencial | Não | **Cabe em `supabase-cron-queues`** |
| pg_net (HTTP async de dentro do DB) | Essencial | Não | **Cabe em `supabase-cron-queues`** |
| Webhooks incoming (Stripe, GitHub, etc.) | Essencial | Parcial — Edge Functions cobertos, mas pattern de webhook (verify signature, idempotency) merece destaque | Estender `supabase-edge-functions` com seção "incoming webhooks" |
| Webhooks outgoing (DB trigger → external) | Essencial | Parcial | **Cabe em `supabase-cron-queues`** com pg_net |
| Email transactional (Resend, SendGrid, SES) | Essencial | Não | Estender `supabase-edge-functions` com seção "transactional email" |
| Auth emails (signup, recovery) com SMTP custom | Essencial | Parcial — `supabase-auth-ssr` deve cobrir | Estender `supabase-auth-ssr` |
| Batch processing (read 1000s, process, write) | Diferencial | Não | **Cabe em `supabase-cron-queues`** com visibility timeout |
| Long-running jobs (>10 min) | Anti-feature | N/A — Supabase recomenda chunking | Skill deve avisar: "split em jobs <10 min" |

### Complexidade

- **Cron simples (pg_cron → Edge Function):** 1-2 hrs com skill
- **Queue worker (pgmq + cron + Edge Function):** 4-6 hrs
- **Webhook robusto (verify + idempotency + retry):** 1 dia

### Dependências

```
supabase-cron-queues (skill nova)
    └── requer: supabase-migrations (criar schema, extensions)
    └── requer: supabase-database-functions (jobs em SQL)
    └── melhora-com: supabase-edge-functions (workers Deno)
    └── melhora-com: supabase-rls-policies (queue tables)
```

### Mapeamento → kit

- **`[NOVO v1.8 — ESSENCIAL]` `supabase-cron-queues` (skill).** Cobertura: pg_cron syntax, pgmq enqueue/read/delete, pg_net.http_post, visibility timeout p/ retry, anti-pattern (jobs >10 min, >8 concurrent).
- **Estender `supabase-edge-functions`** com seções: incoming webhooks (Stripe-style HMAC verify + idempotency key), transactional email (Resend/SendGrid via Deno).
- **Sem agent novo** — `supabase-edge-fn-writer` + `supabase-migration-writer` cobrem implementação.

---

## 6. Multi-Environment

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Local dev (supabase start) | Essencial | Parcial — `supabase-migrations` toca | Estender skill com seção "local workflow" |
| Preview branches (ephemeral, por PR) | Diferencial | Não | **`supabase-branching` (skill nova) — v1.9** |
| Persistent branches (staging, QA) | Diferencial | Não | **Cabe em `supabase-branching`** |
| Schema sync entre branches | Essencial p/ quem usa branching | Parcial via `supabase-migrations` | Estender migrations skill OU criar `supabase-branching` |
| Seed data (seed.sql) | Essencial | Não explicitamente | Estender `supabase-migrations` com seção "seed.sql" |
| GitHub integration (auto-deploy on merge) | Diferencial | Não | **Cabe em `supabase-branching`** |
| Production deployment checklist | Essencial | Não | Cabe em skill operacional separada (low-priority) |

### Complexidade

- **Setup local + migrations:** já coberto por `supabase-migrations` skill
- **Branching com GitHub integration:** 2-4 hrs setup, 0 hrs operação
- **Seed data:** 1-2 hrs

### Dependências

```
supabase-branching (skill nova, v1.9)
    └── requer: supabase-migrations
    └── melhora: workflow de qualquer outra skill (todas se beneficiam de preview env)
```

### Mapeamento → kit

- **Quick win v1.8:** estender `supabase-migrations` com seções "local workflow" (`supabase start`, `supabase db reset`) e "seed.sql".
- **`[NOVO v1.9]` `supabase-branching` (skill).** Cobertura: ephemeral branches via PR, persistent staging branch, env vars per branch, seed.sql, no-prod-data-copy guarantee, GitHub Action workflow.

---

## 7. Frontend Frameworks

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Next.js v16 + App Router + @supabase/ssr | Essencial | Sim, `supabase-auth-ssr` + `supabase-auth-bootstrapper` | Manter (alvo principal) |
| Expo / React Native | Diferencial | Não | **`supabase-expo` (skill nova) — v1.9** |
| SvelteKit | Diferencial | Não | **`supabase-sveltekit` (skill nova) — v1.9** |
| Nuxt | Diferencial | Não | **`supabase-nuxt` (skill nova) — v1.9** |
| Remix | Diferencial | Não | **Compactar com Next.js?** Patterns muito similares — talvez cabe em `supabase-auth-ssr` como seção secundária |
| Vanilla SPA / Vite | Diferencial | Parcial (cliente browser do `@supabase/supabase-js` é trivial) | Cobertura via doc oficial é suficiente |
| Astro | Diferencial | Não | Baixa prioridade — adoção menor que Svelte/Nuxt |
| Vue (não-Nuxt) | Diferencial | Não | Cobertura via Nuxt skill é suficiente |

### Complexidade

- **Cada framework:** 1-2 dias para skill bem feita (precisa testar real); 2-4 hrs se for stub redirecionando p/ docs

### Dependências

Todas as skills frontend dependem de `supabase-auth-ssr` (conceitos comuns: cookies, getAll/setAll, browser/server clients). A skill nova só foca nas **diferenças** do framework.

```
supabase-expo
    └── requer: supabase-auth-ssr (conceitos base)
    └── alerta: Expo NÃO usa SSR — usa AsyncStorage para sessão, deep links para OAuth

supabase-sveltekit
    └── requer: supabase-auth-ssr (conceitos base)
    └── diferença: hooks.server.ts, locals.supabase pattern

supabase-nuxt
    └── requer: supabase-auth-ssr (conceitos base)
    └── diferença: @nuxtjs/supabase module vs raw @supabase/ssr
```

### Mapeamento → kit

- **v1.8 (já no plano):** `supabase-auth-ssr` foca em Next.js v16. **Recomendado:** posicionar a skill como "Next.js + SSR generic concepts", criando uma seção "outras frameworks: ver skills dedicadas".
- **`[NOVO v1.9]` `supabase-expo` (skill).** Patterns: AsyncStorage, deep links para OAuth, sem cookies. Alta demanda — Expo + Supabase é combo padrão para apps mobile indie.
- **`[NOVO v1.9]` `supabase-sveltekit` (skill).** hooks.server.ts, event.locals pattern.
- **`[NOVO v1.9]` `supabase-nuxt` (skill).** @nuxtjs/supabase module + composables.
- **Remix:** decidir em v1.9 — patterns muito próximos a Next.js, talvez seção em `supabase-auth-ssr`.

---

## 8. Advanced DB

### Avaliação

| Feature | Classificação | Coberto pela suíte atual? | Recomendação |
|---|---|---|---|
| Index basics (B-tree, partial, multi-column) | Essencial | Parcial via `supabase-postgres-style` | Cobertura mínima atual é OK; pode estender |
| GIN indexes (jsonb, FTS, arrays) | Diferencial | Não | Cabe em `supabase-postgres-style` ou skill nova |
| Full-text search (tsvector, ts_rank, RRF) | Diferencial | Não | **`supabase-fts` (skill nova) — v1.9** |
| Materialized views | Diferencial | Não | Cabe em `supabase-postgres-style` ou skill operacional |
| jsonb queries + GIN | Diferencial | Não | Cabe em `supabase-postgres-style` |
| Generated columns | Diferencial | Não | Cabe em `supabase-postgres-style` |
| Partitioning (range/list/hash) | Diferencial | Não | Adoção é nicho; cobertura via doc oficial é suficiente |
| CTE-heavy queries / window functions | Essencial p/ analytics | Parcial via SQL style guide | Cabe em `supabase-postgres-style` |
| Table inheritance | Anti-feature | N/A | Postgres-só (não funciona com FKs); evitar |

### Complexidade

- **FTS bem feito:** 4-6 hrs com skill (tsvector + GIN + ranking + trigger para auto-update)
- **Materialized views:** 2-3 hrs (refresh strategy é o difícil)
- **Partitioning:** 1-2 dias (decisão de strategy + setup)

### Dependências

```
supabase-fts (skill nova, v1.9)
    └── requer: supabase-migrations (criar tsvector column + index)
    └── requer: supabase-database-functions (trigger para auto-update tsvector)
    └── relaciona-com: supabase-pgvector-rag (hybrid search = FTS + vector + RRF)
```

### Mapeamento → kit

- **v1.8:** estender `supabase-postgres-style` com seções: jsonb + GIN, generated columns, materialized views (1-2 parágrafos cada).
- **`[NOVO v1.9]` `supabase-fts` (skill).** Cobertura: tsvector + tsquery, GIN index, ts_rank vs ts_rank_cd, generated tsvector column + trigger, multilíngue (configuration `portuguese`/`english`), anti-pattern (LIKE em coluna com milhões de rows).
- **`supabase-pgvector-rag`** deve **referenciar** `supabase-fts` para hybrid search.

---

## Mapa Consolidado: Plano Atual vs. Recomendado

### Skills

| # | Nome | Plano v1.8 atual? | Recomendação |
|---|---|---|---|
| 1 | `supabase-realtime` | Sim | Manter; estender com Presence + live dashboard |
| 2 | `supabase-auth-ssr` | Sim | Manter; estender com magic link, OAuth callbacks, password reset |
| 3 | `supabase-edge-functions` | Sim | Manter; estender com webhooks incoming + transactional email |
| 4 | `supabase-declarative-schema` | Sim | Manter |
| 5 | `supabase-rls-policies` | Sim | Manter |
| 6 | `supabase-database-functions` | Sim | Manter |
| 7 | `supabase-migrations` | Sim | Manter; estender com seed.sql + local workflow |
| 8 | `supabase-postgres-style` | Sim | Manter; estender com jsonb/GIN/generated columns/materialized views |
| **9** | **`supabase-storage`** | **Não — `[NOVO v1.8 — ESSENCIAL]`** | **Adicionar** |
| **10** | **`supabase-pgvector-rag`** | **Não — `[NOVO v1.8 — ESSENCIAL]`** | **Adicionar** |
| **11** | **`supabase-cron-queues`** | **Não — `[NOVO v1.8 — ESSENCIAL]`** | **Adicionar** |
| 12 | `supabase-auth-mfa` | `[NOVO v1.9]` | Diferencial |
| 13 | `supabase-auth-multi-tenant` | `[NOVO v1.9]` | Diferencial |
| 14 | `supabase-branching` | `[NOVO v1.9]` | Diferencial |
| 15 | `supabase-fts` | `[NOVO v1.9]` | Diferencial |
| 16 | `supabase-expo` | `[NOVO v1.9]` | Diferencial |
| 17 | `supabase-sveltekit` | `[NOVO v1.9]` | Diferencial |
| 18 | `supabase-nuxt` | `[NOVO v1.9]` | Diferencial |

**Total v1.8 recomendado:** 8 originais + 3 essenciais = **11 skills**.

### Agents

| # | Nome | Plano v1.8 atual? | Recomendação |
|---|---|---|---|
| 1 | `supabase-architect` | Sim | Manter; deve agora considerar Storage + pgvector + queues no design |
| 2 | `supabase-migration-writer` | Sim | Manter |
| 3 | `supabase-rls-writer` | Sim | Manter |
| 4 | `supabase-edge-fn-writer` | Sim | Manter |
| 5 | `supabase-realtime-implementer` | Sim | Manter |
| 6 | `supabase-auth-bootstrapper` | Sim | Manter; estender p/ magic link + OAuth + reset |
| **7** | **`supabase-storage-implementer`** | **Não — `[NOVO v1.8 — ESSENCIAL]`** | **Adicionar** (cria bucket + RLS de storage + handlers de upload) |

**Total v1.8 recomendado:** 6 originais + 1 essencial = **7 agents**.

### Comando

- `/supabase` (orquestrador) — manter como está; adicionar subcomandos `storage`, `rag`, `cron`.

---

## Anti-Features (explícitas no kit)

Cada skill deve ter seção "anti-patterns" alertando:

| Anti-feature | Por que é pedida | Por que é problemática | Alternativa |
|---|---|---|---|
| postgres_changes em tabela hot (>1 write/s) | "Quero tudo realtime" | Custo proibitivo + latência | Broadcast + server-side aggregation |
| Realtime + sem RLS na tabela messages | "Mais simples" | Vazamento de mensagens entre tenants | RLS sempre, mesmo em dev |
| Service-role no client | "Para evitar RLS" | Vulnerabilidade crítica de segurança | Anon key + RLS, ou Edge Function como gateway |
| Custom auth from scratch | "Mais controle" | Reinventar bcrypt/JWT/sessions = bugs garantidos | Supabase Auth + `auth.uid()` em RLS |
| Long-running jobs (>10 min) em pg_cron | "Job pesado" | Quebra concurrency, pgmq não retry | Chunk em jobs <10 min via queue |
| Overwrite de arquivo (mesmo path) | "Atualizar imagem" | CDN cacheado serve versão velha | Write-to-new-path + delete antigo |
| Vector store sem RLS p/ dados sensíveis | "RAG é só read" | Multi-tenant RAG vaza embeddings | RLS em coluna `tenant_id` mesmo em busca semântica |
| MFA opcional em rotas sensíveis | "Friction" | Bypass = vulnerabilidade | AAL2 enforcement em policies de admin |

---

## Definição de MVP (v1.8)

### Lançar Com (v1.8)

11 skills + 7 agents + comando `/supabase`. Cobre **~90%** do que apps Supabase reais constroem em 2026.

**Skills v1.8:**
- [ ] `supabase-realtime`, `supabase-auth-ssr`, `supabase-edge-functions`, `supabase-declarative-schema`, `supabase-rls-policies`, `supabase-database-functions`, `supabase-migrations`, `supabase-postgres-style` *(originais)*
- [ ] `supabase-storage` **`[NOVO ESSENCIAL]`** — apps com upload (a maioria)
- [ ] `supabase-pgvector-rag` **`[NOVO ESSENCIAL]`** — apps RAG explodiram em 2026
- [ ] `supabase-cron-queues` **`[NOVO ESSENCIAL]`** — background jobs internos sem cron externo

**Agents v1.8:**
- [ ] `supabase-architect`, `supabase-migration-writer`, `supabase-rls-writer`, `supabase-edge-fn-writer`, `supabase-realtime-implementer`, `supabase-auth-bootstrapper` *(originais)*
- [ ] `supabase-storage-implementer` **`[NOVO ESSENCIAL]`**

**Comando v1.8:**
- [ ] `/supabase [arquiteto|migration|rls|edge|realtime|auth|storage|rag|cron]`

### Adicionar Após Validação (v1.9)

Diferenciais — quando o usuário começa a construir apps que precisam:

- [ ] `supabase-auth-mfa` — quando app tem rotas sensíveis (admin/financeiro)
- [ ] `supabase-auth-multi-tenant` — quando app tem organizations/teams
- [ ] `supabase-branching` — quando time cresce e precisa de preview environments
- [ ] `supabase-fts` — quando app precisa de busca textual além de ILIKE
- [ ] `supabase-expo` — primeiro app mobile do user
- [ ] `supabase-sveltekit` — primeiro projeto Svelte
- [ ] `supabase-nuxt` — primeiro projeto Vue/Nuxt

### Consideração Futura (v2.0+)

- [ ] `supabase-edge-fn-streaming` — SSE/streaming responses (ChatGPT-like)
- [ ] `supabase-vault` — secrets management
- [ ] `supabase-observability` — log_drains, metrics, alerting
- [ ] `supabase-self-hosted` — deploy próprio (Docker, K8s)

---

## Matriz de Priorização v1.8

| Skill / Agent | Valor p/ user | Custo de criar | Prioridade |
|---|---|---|---|
| supabase-realtime | HIGH | MEDIUM | P1 |
| supabase-auth-ssr | HIGH | MEDIUM | P1 |
| supabase-edge-functions | HIGH | MEDIUM | P1 |
| supabase-declarative-schema | HIGH | LOW | P1 |
| supabase-rls-policies | HIGH | MEDIUM | P1 |
| supabase-database-functions | HIGH | LOW | P1 |
| supabase-migrations | HIGH | LOW | P1 |
| supabase-postgres-style | MEDIUM | LOW | P1 |
| **supabase-storage** | **HIGH** | **MEDIUM** | **P1** |
| **supabase-pgvector-rag** | **HIGH** | **HIGH** | **P1** |
| **supabase-cron-queues** | **HIGH** | **MEDIUM** | **P1** |
| supabase-architect | HIGH | HIGH | P1 |
| supabase-migration-writer | HIGH | MEDIUM | P1 |
| supabase-rls-writer | HIGH | MEDIUM | P1 |
| supabase-edge-fn-writer | HIGH | MEDIUM | P1 |
| supabase-realtime-implementer | HIGH | MEDIUM | P1 |
| supabase-auth-bootstrapper | HIGH | MEDIUM | P1 |
| **supabase-storage-implementer** | **HIGH** | **MEDIUM** | **P1** |

---

## Análise de Concorrentes

| Feature | "Bolt.new / v0.dev" (LLM-IDE) | "Cursor + docs MCP" | Suíte Supabase v1.8 (proposta) |
|---|---|---|---|
| Setup Supabase Auth | Boilerplate Next.js padrão | Lê doc.supabase.com, erra cookies em SSR | Skill canônica `supabase-auth-ssr` testada |
| RLS policies corretas | Frequentemente erra `auth.uid()` em joins | Inconsistente | Skill + agent dedicado |
| pgvector RAG | Tutorial-level (HNSW errado) | Erra HNSW vs IVFFlat | Skill explica regra <1M rows |
| Storage uploads multi-tenant | Bucket público ou erro | Erra path policy | Skill + agent — tenant_id em path |
| Background jobs | Sugere Inngest/Trigger.dev | Sugere stack externo | Skill ensina pg_cron + pgmq interno |
| Realtime presence | Confunde broadcast/presence/postgres_changes | Inconsistente | Skill com decisão clara |

**Diferenciação:** outras tools dão respostas via lookup de doc; nosso kit dá **expertise pré-condicionada** com anti-patterns explícitos e workers ativos (agents) que **executam** as decisões corretas.

---

## Fontes

- [Supabase Realtime — Broadcast, Presence, Postgres Changes](https://supabase.com/docs/guides/realtime)
- [Supabase MFA TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase MFA Phone](https://supabase.com/docs/guides/auth/auth-mfa/phone)
- [Server-Side Rendering with @supabase/ssr](https://supabase.com/docs/guides/auth/server-side)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Multi-tenancy with Supabase (Itsuki, Mar 2026)](https://medium.com/@itsuki.enjoy/supabase-support-multi-tenancy-with-detail-template-project-34f3a3d97ee4)
- [pgvector — Embeddings and vector similarity](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase AI & Vectors](https://supabase.com/docs/guides/ai)
- [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Semantic Search](https://supabase.com/docs/guides/ai/semantic-search)
- [Automatic Embeddings (trigger + queue + cron)](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [Supabase Cron (pg_cron)](https://supabase.com/docs/guides/cron)
- [pg_net — Async Networking](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Processing Large Jobs with Edge Functions, Cron, and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- [Background Jobs and Queues for Self-Hosted Supabase with pgmq](https://www.supascale.app/blog/background-jobs-and-queues-for-selfhosted-supabase-with-pgmq)
- [Supabase Branching](https://supabase.com/docs/guides/deployment/branching)
- [The Vibe Coder's Guide to Supabase Environments](https://supabase.com/blog/the-vibe-coders-guide-to-supabase-environments)
- [Use Supabase with Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase SSR Auth with SvelteKit](https://dev.to/kvetoslavnovak/supabase-ssr-auth-48j4)
- [Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [Managing JSON and Unstructured Data](https://supabase.com/docs/guides/database/json)
- [Partitioning Tables](https://supabase.com/docs/guides/database/partitions)
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Standard Uploads + TUS](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase Storage in Practice (BetterLink Blog, Apr 2026)](https://eastondev.com/blog/en/posts/dev/20260409-supabase-storage-en/)

---

*Pesquisa de funcionalidades para: kit-mcp Suíte Supabase v1.8*
*Pesquisado: 2026-05-06*
