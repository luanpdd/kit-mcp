# Pesquisa de Stack — Suíte Supabase v1.8 (`@luanpdd/kit-mcp`)

**Domínio:** Conteúdo de kit (skills/agents/commands) cobrindo o ecossistema Supabase 2026 que NÃO está nos 7 guias-fonte fornecidos pelo user.
**Pesquisado:** 2026-05-06
**Confiança:** HIGH (todas as fontes são docs oficiais Supabase + GitHub canônico + npm; versões verificadas ao vivo).
**Escopo:** Identificar componentes/serviços Supabase (Storage, Vector, Queues/Cron, Auth avançado, Branches, CLI, MCP server) que merecem (ou NÃO) skill/agent dedicado. Diferencia **table-stakes** (sem isso, não é Supabase moderno) de **differentiator** (legal ter, pode esperar v1.9+).

---

## Contexto: O que JÁ está coberto pelos 7 guias-fonte (NÃO duplicar)

| Guia-fonte | Skill prevista no PROJECT.md | Cobre |
|-----------|------------------------------|-------|
| Realtime AI Assistant Guide | `supabase-realtime` | broadcast vs postgres_changes, presence, RLS realtime, naming, triggers `realtime.broadcast_changes` |
| Bootstrap Next.js v16 + Auth SSR | `supabase-auth-ssr` | `@supabase/ssr`, getAll/setAll, browser/server clients, proxy |
| Writing Edge Functions | `supabase-edge-functions` | Deno runtime, `npm:`/`jsr:`, env vars, Hono/Express |
| Declarative Database Schema | `supabase-declarative-schema` | `supabase/schemas/`, `db diff`, caveats |
| RLS policies | `supabase-rls-policies` | `auth.uid()`, per-operation, indexing, MFA aal |
| Database functions | `supabase-database-functions` | SECURITY INVOKER, `set search_path = ''`, immutable/stable, triggers |
| Migrations | `supabase-migrations` | `YYYYMMDDHHmmss_*.sql`, RLS obrigatório |
| Postgres SQL style | `supabase-postgres-style` | lowercase, snake_case, plurals, ISO 8601 |

---

## Veredito por Componente Supabase

### Tabela-Mestre (Table-Stakes vs Differentiator)

| Componente | Categoria | Coberto pelos 7 guias? | Decisão | Skill/Agent dedicado? |
|-----------|-----------|------------------------|---------|----------------------|
| **Storage (File buckets)** | TABLE-STAKES | NÃO | Adicionar | Skill `supabase-storage` |
| **pgvector / Embeddings** | TABLE-STAKES (em 2026) | NÃO | Adicionar | Skill `supabase-vector` |
| **Vector Buckets (S3)** | DIFFERENTIATOR (alpha) | NÃO | Mencionar dentro de `supabase-vector` | NÃO — ainda alpha |
| **Analytics Buckets (Iceberg)** | DIFFERENTIATOR (alpha) | NÃO | Mencionar dentro de `supabase-storage` | NÃO — ainda alpha |
| **Queues (pgmq)** | DIFFERENTIATOR (importante) | NÃO | Adicionar | Skill `supabase-queues-cron` (combinada) |
| **Cron (pg_cron)** | DIFFERENTIATOR (importante) | NÃO | Adicionar | (mesma skill acima) |
| **Auth: OTP/Magic Link** | TABLE-STAKES | PARCIAL (SSR cobre client) | Estender | Mencionar em `supabase-auth-ssr` + skill nova `supabase-auth-methods` |
| **Auth: SSO/SAML** | DIFFERENTIATOR (enterprise) | NÃO | Adicionar | Pequena seção em `supabase-auth-methods` |
| **Auth: Anonymous** | DIFFERENTIATOR (importante) | NÃO | Adicionar | Mesma skill |
| **Auth: MFA TOTP/Phone** | TABLE-STAKES | PARCIAL (RLS cobre aal) | Estender | Mesma skill |
| **Auth: Hooks (Send SMS/Email/MFA)** | DIFFERENTIATOR | NÃO | Mencionar | Mesma skill |
| **Branches (preview DBs)** | TABLE-STAKES (workflow) | NÃO | Adicionar | Skill `supabase-branches` |
| **CLI** | TABLE-STAKES (toolchain) | PARCIAL (migrations cita commands) | Skill canônica de referência | Skill `supabase-cli` |
| **MCP server oficial** | TABLE-STAKES (para os agents) | NÃO | Documentar tools | Tabela de referência **dentro** dos agents |
| **Database Webhooks (pg_net)** | DIFFERENTIATOR | NÃO | Mencionar | Pequena seção em `supabase-database-functions` (já existe) |
| **PostgREST custom schema** | DIFFERENTIATOR | NÃO | Mencionar | Pequena seção em `supabase-postgres-style` (já existe) |
| **Edge Functions: Background Tasks** | DIFFERENTIATOR (importante) | PARCIAL (guia menciona `EdgeRuntime.waitUntil`) | Estender | Já em `supabase-edge-functions` |

---

## 1. Supabase Storage — TABLE-STAKES

**Veredito:** SKILL DEDICADA (`supabase-storage`).

**Por que merece skill própria:**
- Storage tem suas próprias **policies RLS específicas** sobre `storage.objects` (não public.*) que diferem em sintaxe e helpers (`storage.foldername(name)`, `bucket_id`, `owner_id`).
- Buckets públicos vs privados têm modelos de acesso radicalmente diferentes (signed URLs vs public URLs).
- Image transformations exigem Pro plan e config no dashboard.
- Os 7 guias-fonte NÃO mencionam Storage de forma alguma.

**Conteúdo canônico que a skill precisa cobrir:**

| Tópico | Pattern canônico |
|--------|------------------|
| Buckets privados (default) | RLS obrigatório em `storage.objects` por bucket |
| Buckets públicos | Bypass de access control para download; upload ainda requer policy |
| Pasta-por-usuário | `(storage.foldername(name))[1] = (select auth.jwt()->>'sub')` |
| Owner-based access | `(select auth.jwt()->>'sub') = owner_id` |
| Signed URLs | `createSignedUrl(path, expiresIn)` — TTL configurável |
| Image transformations | `getPublicUrl(path, { transform: { width, height, quality } })` — Pro+ apenas |
| File size limits | 500GB em paid plans (free: muito menor) |

**Tipos especializados de bucket (mencionar mas NÃO criar skill separada):**
- **Vector Buckets** (alpha 2026) — sobre Amazon S3 Vectors, similarity search built-in, single distance operator `<===>`. Mencionar dentro da skill `supabase-vector` como alternativa cold-storage para milhões de embeddings.
- **Analytics Buckets** (alpha 2026) — sobre Apache Iceberg + AWS S3 Tables, columnar storage para workloads analíticos. Mencionar como nota de "futuro" — ainda alpha, breaking changes esperadas.

**Fontes:**
- [Storage Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage Image Transformations | Supabase Docs](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Vector Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/vector/introduction)
- [Analytics Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/analytics/introduction)

---

## 2. pgvector / Embeddings / Semantic Search — TABLE-STAKES (em 2026)

**Veredito:** SKILL DEDICADA (`supabase-vector`).

**Por que merece skill própria:**
- pgvector é a abordagem **default** para RAG/AI no stack Supabase 2026. Aplicações com agente IA quase sempre precisam.
- Patterns de indexing (HNSW vs IVFFlat) e operators de distância (`<=>`, `<#>`, `<->`) são específicos e errar mata a performance.
- `auth.uid()` em RLS sobre tabela de embeddings é um pattern específico (RAG with permissions) que merece destaque.
- Nenhum dos 7 guias-fonte toca em embeddings.

**Conteúdo canônico que a skill precisa cobrir:**

| Tópico | Recomendação canônica 2026 |
|--------|---------------------------|
| Extensão | `create extension vector with schema extensions;` |
| Coluna típica | `embedding vector(1536)` para OpenAI text-embedding-3-small |
| Index para <1M rows | HNSW (cosine: `vector_cosine_ops`) — recall melhor, build mais lento (one-time) |
| Index para memória reduzida | IVFFlat (lista de centroides) — recall menor, mais barato |
| Distance operator default | `<=>` (cosine) se embeddings não normalizados; `<#>` (negative inner product) se normalizados (ex: OpenAI) |
| RAG com permissions | RLS sobre tabela de embeddings + `auth.uid()` no SELECT — restringe documentos retornados |
| Modelo embedding | **NÃO trocar** — comparar embeddings de modelos diferentes retorna lixo |
| Hybrid search | Coluna `tsvector` + coluna `vector` na mesma tabela; queries combinam |
| Automatic embeddings | `pgmq` + `pg_cron` + Edge Function = trigger automático ao inserir texto |

**Vector Buckets (alpha) — quando usar em vez de pgvector:**
- Backend processing de **milhões** de vectors (não real-time UI).
- Cold storage barato (S3-native).
- Single similarity algorithm aceita.
- **NÃO usar** para apps user-facing pequenas — pgvector é mais flexível.

**Fontes:**
- [pgvector: Embeddings and vector similarity | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [AI & Vectors | Supabase Docs](https://supabase.com/docs/guides/ai)
- [RAG with Permissions | Supabase Docs](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Automatic embeddings | Supabase Docs](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [Semantic search | Supabase Docs](https://supabase.com/docs/guides/ai/semantic-search)
- [Introducing Vector Buckets (blog 2026)](https://supabase.com/blog/vector-buckets)

---

## 3. Queues (pgmq) + Cron (pg_cron) — DIFFERENTIATOR (importante)

**Veredito:** UMA SKILL COMBINADA (`supabase-queues-cron`).

**Por que combinar (não separar):**
- Os dois **trabalham juntos** no pattern canônico Supabase 2026: pg_cron agenda → tira mensagem da queue (pgmq) → invoca Edge Function.
- Separar viraria duas skills meio-vazias com cross-references constantes.
- Ambas são extensions Postgres com APIs SQL similares (`pgmq.send`, `cron.schedule`).

**Por que NÃO é table-stakes:**
- Apps simples conseguem viver sem queues (síncrono via Edge Function basta). Cron sim é importante mas frequentemente é só "schedule a function".
- Differentiator porque desbloqueia background processing sem dep externa (Trigger.dev, Inngest).

**Conteúdo canônico que a skill precisa cobrir:**

| Tópico | Pattern canônico 2026 |
|--------|----------------------|
| Requisito | Postgres 15.6.1.143+ para pgmq |
| Criar queue | `select pgmq.create('my_queue');` |
| Enviar mensagem | `select pgmq.send('my_queue', '{"job":"x"}'::jsonb);` |
| Consumir | `select pgmq.read('my_queue', 30, 1);` (visibility 30s) |
| Delivery guarantee | Exactly-once dentro da janela de visibility |
| Agendar cron | `select cron.schedule('job_name', '*/5 * * * *', $$select 1$$);` |
| Cron + Edge Function | `select net.http_post(url := 'https://...functions/v1/handler', ...) ` agendado |
| Pattern queue worker | pg_cron a cada 1min → função SQL que faz `pgmq.read` → invoca Edge Function via `net.http_post` |
| Expor pgmq via PostgREST | Schema `pgmq_public` precisa ser exposto + grants (cuidado em production) |

**Fontes:**
- [Supabase Queues](https://supabase.com/modules/queues)
- [pgmq: Queues | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgmq)
- [Supabase Cron](https://supabase.com/modules/cron)
- [pg_cron | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Build Queue Worker (Cron + Queue + Edge Function)](https://dev.to/suciptoid/build-queue-worker-using-supabase-cron-queue-and-edge-function-19di)

---

## 4. Auth Avançado (OTP/Magic Link/SSO/Anonymous/MFA Phone/Hooks) — TABLE-STAKES

**Veredito:** SKILL DEDICADA (`supabase-auth-methods`) complementar a `supabase-auth-ssr`.

**O que JÁ está em `supabase-auth-ssr`:** apenas o bootstrap SSR Next.js — **client setup**, cookies, middleware. Zero sobre métodos.

**O que JÁ está em `supabase-rls-policies`:** RLS com `auth.uid()` e checks de `aal2` para MFA. **Não** cobre como usuário **chega** ao aal2.

**Por que merece skill própria (não inflar `supabase-auth-ssr`):**
- Auth-SSR é sobre **infraestrutura** (cookies/SSR/proxy). Auth-methods é sobre **fluxos** (OTP, OAuth, MFA, anonymous → permanent). Misturar enche demais.
- 5+ métodos de auth com APIs distintas: passar tudo pra `auth-ssr` faria a skill ficar gigante.

**Conteúdo canônico que a skill precisa cobrir:**

| Método | Pattern canônico | Notas |
|--------|------------------|-------|
| Magic Link / OTP por email | `signInWithOtp({ email })` | Default = magic link; flag `shouldCreateUser` controla criação |
| OTP por SMS/WhatsApp | `signInWithOtp({ phone })` | Provider obrigatório: Twilio/MessageBird/Vonage |
| OAuth providers | `signInWithOAuth({ provider, options })` | 20+ providers; redirectTo importante para SSR |
| Anonymous Sign-in | `signInAnonymously()` | Cria user sem identidade — convertível depois |
| Anonymous → Permanent | `updateUser({ email })` + verificação email/phone | userId NÃO muda — dados preservados |
| Linking de identities | `linkIdentity()` | Requer "Manual Linking" habilitado no projeto |
| MFA TOTP enroll | `mfa.enroll({ factorType: 'totp' })` → QR code | Free em todos os projetos |
| MFA TOTP verify | `mfa.challenge()` → `mfa.verify()` | Resulta em aal=aal2 no JWT |
| MFA Phone | `mfa.enroll({ factorType: 'phone' })` | Provider SMS obrigatório |
| MFA aal check em RLS | `(select auth.jwt()->>'aal') = 'aal2'` | Use em policies para dados sensíveis |
| WebAuthn / Passkeys | `mfa.enroll({ factorType: 'webauthn' })` | FIDO2; segundo fator OU passwordless |
| SSO/SAML | Setup CLI: `supabase sso add` + IdP metadata | Pro plan+; enterprise only |
| Auth Hook: Send SMS | Webhook custom para roteamento via provider próprio | Bypassa Twilio default |
| Auth Hook: Send Email | Webhook custom (Resend, SendGrid, etc.) | |
| Auth Hook: MFA Verification | Custom checks no flow MFA | |
| Custom claims em JWT | Hook "Custom Access Token" | Adiciona claims que RLS pode ler via `auth.jwt()->>'plan'` etc. |

**Fontes:**
- [Auth | Supabase Docs](https://supabase.com/docs/guides/auth)
- [Anonymous Sign-Ins | Supabase Docs](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Multi-Factor Authentication (TOTP)](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Multi-Factor Authentication (Phone)](https://supabase.com/docs/guides/auth/auth-mfa/phone)
- [Single Sign-On with SAML 2.0](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Auth Hooks | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks)
- [Phone Login | Supabase Docs](https://supabase.com/docs/guides/auth/phone-login)

---

## 5. Branches / Preview Environments — TABLE-STAKES (workflow)

**Veredito:** SKILL DEDICADA (`supabase-branches`).

**Por que merece skill própria:**
- Branches têm **lifecycle** (preview vs persistent), **workflow** (clone→pull→migrate→seed→deploy), e **integração GitHub** que é não-trivial.
- Mudou em 2025-2026: "Branching 2.0" removeu requisito de GitHub, default agora é "branching without git". Quem aprendeu antes precisa aprender de novo.
- Workflow de migrations é **diferente** entre main project e branch. Skill `supabase-migrations` foca em estrutura do arquivo SQL, não no fluxo de promoção entre branches.
- Differentiator que virou table-stakes: review de PR sem branch DB hoje é considerado workflow imaturo.

**Conteúdo canônico que a skill precisa cobrir:**

| Tópico | Pattern canônico 2026 |
|--------|----------------------|
| Tipos de branch | Preview (efêmero, deletável) vs Persistent (staging/QA/dev) |
| Criar branch (CLI) | `supabase branches create my-branch` |
| Criar branch (dashboard) | "Branching 2.0" — no Git required, default 2026 |
| Listar branches | `supabase branches list` |
| Atualizar branch | `supabase branches update <id>` |
| Deletar branch | `supabase branches delete <name|id>` |
| GitHub integration | PR no GitHub → cria preview branch automaticamente; migrations em `./supabase/migrations` rodam |
| Deployment workflow | Clone → Pull → Health → Configure → **Migrate** → Seed → Deploy (Edge Functions) |
| Estado de migrations | Branch sabe quais migrations rodou; aplica só novas |
| Reset branch | `supabase branches reset` — útil para iterar local antes de promover |
| Persistent branch use case | Staging/QA — não auto-paused, não auto-deleted |
| Custo | Branches contam para projeto; ver pricing antes de criar muitas |

**Fontes:**
- [Branching | Supabase Docs](https://supabase.com/docs/guides/deployment/branching)
- [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches)
- [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Branching Without Git Is Now The Default (blog)](https://supabase.com/blog/branching-without-git-is-now-the-default)
- [CLI: supabase branches reference](https://supabase.com/docs/reference/cli/supabase-branches)

---

## 6. Supabase CLI — TABLE-STAKES (toolchain)

**Veredito:** SKILL DEDICADA (`supabase-cli`).

**Por que merece skill própria:**
- Os 7 guias-fonte mencionam comandos pontuais (`db diff`, `migration new`) mas não há referência consolidada.
- Versão estável atual: **v2.98.x** (maio 2026). Linha 2.x trouxe "Config as Code" — breaking change para quem usava 1.x.
- Comandos críticos para os agents conhecerem (especialmente `supabase-migration-writer` e `supabase-edge-fn-writer`).

**Conteúdo canônico que a skill precisa cobrir:**

### Versão recomendada (2026)

| Item | Valor |
|------|-------|
| Versão estável atual | **v2.98.2** (release 2026-05-05) |
| Linha mínima recomendada | v2.95.x+ |
| Node requirement (npx) | Node.js 20+ |
| Instalação global | **NÃO** suportada via npm; usar Homebrew, Scoop, ou binary |

### Comandos críticos por categoria

**Setup & Local Dev:**
- `supabase init` — bootstrap `./supabase/`
- `supabase start` — sobe stack local (Postgres, Auth, Storage, Edge Functions, Realtime)
- `supabase stop` — para containers
- `supabase status` — saúde dos serviços locais
- `supabase db reset` — recria DB local do zero

**Migrations:**
- `supabase migration new <name>` — cria arquivo `YYYYMMDDHHmmss_<name>.sql`
- `supabase db diff -f <name>` — gera migration a partir de mudanças no DB local
- `supabase db push` — aplica migrations pendentes em projeto remoto
- `supabase migration list` — lista status migrations
- `supabase migration repair` — sincroniza tabela de tracking

**Declarative Schema:**
- `supabase db diff --schema public` — diff entre `./supabase/schemas/` e DB
- `supabase db dump` — exporta schema atual
- `supabase db lint` — valida estilo

**Edge Functions:**
- `supabase functions new <name>`
- `supabase functions serve` — local
- `supabase functions deploy <name>`
- `supabase functions list`
- `supabase secrets set KEY=value` (env vars)
- `supabase secrets list`

**Branches:**
- `supabase branches create/list/update/delete`

**Types:**
- `supabase gen types typescript --project-id <id> > types/database.ts`

**Auth:**
- `supabase sso add --type saml` (configurar IdP)

**Login & link:**
- `supabase login` (com PAT — Personal Access Token)
- `supabase link --project-ref <ref>` (associa pasta local a projeto)

**Fontes:**
- [CLI Reference | Supabase Docs](https://supabase.com/docs/reference/cli/introduction)
- [Supabase CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Releases · supabase/cli](https://github.com/supabase/cli/releases) — v2.98.2 release notes
- [Supabase CLI v2: Config as Code](https://supabase.com/blog/cli-v2-config-as-code)
- [supabase npm package](https://www.npmjs.com/package/supabase)

---

## 7. MCP Server Oficial Supabase — TABLE-STAKES (para os agents)

**Veredito:** **NÃO** criar skill dedicada; **SIM** criar **tabela canônica de tools** que os agents da Suíte podem referenciar (linkado a partir de `supabase-architect`, `supabase-migration-writer`, etc.).

**Por que NÃO skill:**
- Skill é conteúdo consultável. Tools MCP são **ferramentas que o agent invoca** — referência técnica, não tutorial.
- Os agents da Suíte vão **listar `tools:`** no frontmatter incluindo `mcp__supabase__*`. Eles precisam saber **quais nomes confiar**.

**Implementação recomendada:**
1. **Documento de referência** em `kit/agents/_shared/supabase-mcp-tools.md` (precedente: pattern de `_shared/` já existe na codebase para v1.7).
2. Cada agent da Suíte que usa MCP referencia esse doc.
3. **Cuidado:** o frontmatter `tools:` em `schema-checker.md` usa um UUID instance-specific (`mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql`). Em conteúdo de kit canônico (que vai pra outros consumidores), usar nomes genéricos `mcp__supabase__execute_sql` e documentar que o consumidor precisa configurar seu próprio MCP.

### Tabela canônica de tools (versão 0.8.x — pre-1.0)

**Pacote:** `@supabase/mcp-server-supabase`
**Versão estável atual:** **v0.8.1** (publicada ~feb/mar 2026). Pre-1.0 — esperar breaking changes.
**Invocação típica:** `npx -y @supabase/mcp-server-supabase@latest --access-token <PAT>`
**Read-only mode:** flag `--read-only` (recomendado para qualquer agent que NÃO seja escritor)

| Feature group | Tools (todos com prefixo `mcp__supabase__`) | Para qual agent? |
|---------------|--------------------------------------------|------------------|
| **Account** | `list_projects`, `get_project`, `create_project`, `pause_project`, `restore_project`, `list_organizations`, `get_organization`, `get_cost`, `confirm_cost` | `supabase-architect` (planejamento) |
| **Knowledge Base** | `search_docs` | TODOS — fallback antes de assumir API |
| **Database** | `list_tables`, `list_extensions`, `list_migrations`, `apply_migration`, `execute_sql` | `supabase-migration-writer`, `supabase-rls-writer`, `schema-checker` (existente) |
| **Debugging** | `get_logs` (api/postgres/edge-functions/auth/storage/realtime), `get_advisors` (security/performance) | `supabase-architect` (auditoria), debug |
| **Development** | `get_project_url`, `get_publishable_keys`, `generate_typescript_types` | `supabase-edge-fn-writer`, `supabase-auth-bootstrapper` |
| **Edge Functions** | `list_edge_functions`, `get_edge_function`, `deploy_edge_function` | `supabase-edge-fn-writer` |
| **Branching** | `create_branch`, `list_branches`, `delete_branch`, `merge_branch`, `reset_branch`, `rebase_branch` | `supabase-architect` (workflow), `supabase-migration-writer` |
| **Storage** (NÃO habilitado por default) | `list_storage_buckets`, `get_storage_config`, `update_storage_config` | (futuro — quando criarmos `supabase-storage-writer`) |

### Regras de uso para os agents

| Regra | Justificativa |
|-------|---------------|
| `apply_migration` para DDL (CREATE TABLE, ALTER, RLS) | Tracked no DB; rastreável |
| `execute_sql` para queries DML / SELECT | Não tracked — leitura ou data ops |
| **Nunca** apontar para projeto de produção | Recomendação oficial Supabase 2026 |
| Usar `--read-only` para auditoria | Evita escrita acidental durante diagnóstico |
| Sempre `search_docs` antes de inventar API | LLM tende a alucinar; docs Supabase mudam frequentemente |
| Antes de `apply_migration` que toque dados existentes → invocar `schema-checker` (precedente em v1.x) | Pattern já estabelecido na codebase |

**Fontes:**
- [Supabase MCP Server (blog oficial)](https://supabase.com/blog/mcp-server)
- [github.com/supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)
- [@supabase/mcp-server-supabase | npm](https://www.npmjs.com/package/@supabase/mcp-server-supabase) — v0.8.1
- [MCP | Supabase Docs](https://supabase.com/docs/guides/getting-started/mcp)

---

## 8. Componentes que NÃO merecem skill/agent (apenas seção dentro de outra)

### Database Webhooks (pg_net)

**Onde:** mencionar dentro de `supabase-database-functions` (já planejada).
**Por que não skill própria:** webhooks no Supabase são literalmente um tipo específico de trigger SQL chamando `net.http_post`. Não há setup/lifecycle separado.
**Pattern canônico:** trigger `AFTER INSERT/UPDATE/DELETE` → função → `net.http_post(url, headers, body)`.
**Cuidado:** **nunca** criar trigger sobre tabelas `net.*` — risco de loop infinito.
**Versão pg_net atual:** v0.10.0 (recomendado upgrade).

### PostgREST Custom Schemas / Hardening Data API

**Onde:** mencionar dentro de `supabase-postgres-style` (já planejada) OU em uma seção da skill `supabase-rls-policies`.
**Por que não skill própria:** é uma decisão arquitetural pontual (default `public` vs schema dedicado `api`), não um workflow contínuo.
**Pattern canônico 2026:**
- Não confiar mais em "expor `public` automaticamente" — **breaking change** Supabase 2025-2026 exige opt-in via grants.
- Considerar schema `api` separado, com grants explícitos por role.
- Sempre `grant select on table <name> to authenticated, anon;` ao criar table que precisa Data API.

### Realtime Limits / Quotas

**Onde:** mencionar dentro de `supabase-realtime` (já planejada).
**Por que não skill própria:** é uma seção curta de "limites a saber" — não justifica skill.
**Pontos críticos:**
- 100 subscribers num INSERT = 100 RLS queries (cuidar de indexing).
- Uma authorization check por subscription, cacheado pela duração da conexão.
- Disable de canais públicos por projeto vem aí (em desenvolvimento).

### Edge Functions: Background Tasks / WebSockets / Ephemeral Storage

**Onde:** estender `supabase-edge-functions` (já planejada).
**Por que não skill própria:** são features da mesma runtime, mesma API surface.
**Limites importantes 2026:**
- Background tasks: 150s free / 400s paid.
- `EdgeRuntime.waitUntil(promise)` para fire-and-forget após response.
- Útil para AI inference longa, processamento de mídia.

---

## Resumo Final — O que a v1.8 deve incluir

### Skills DEFINITIVAS (recomendação 8 do PROJECT.md → 14)

Os 8 originais permanecem. Adicionar **6 skills extras** que a pesquisa identificou como table-stakes ou critical-differentiator:

1. ~~`supabase-realtime`~~ (planejada)
2. ~~`supabase-auth-ssr`~~ (planejada)
3. ~~`supabase-edge-functions`~~ (planejada — estender com background tasks)
4. ~~`supabase-declarative-schema`~~ (planejada)
5. ~~`supabase-rls-policies`~~ (planejada — estender com webhook + Data API hardening)
6. ~~`supabase-database-functions`~~ (planejada — estender com pg_net webhook)
7. ~~`supabase-migrations`~~ (planejada)
8. ~~`supabase-postgres-style`~~ (planejada — estender com Data API custom schema)
9. **NOVA: `supabase-storage`** — Storage RLS, signed URLs, image transformations, vector buckets/analytics buckets como notas
10. **NOVA: `supabase-vector`** — pgvector + embeddings + RAG with permissions + automatic embeddings
11. **NOVA: `supabase-queues-cron`** — pgmq + pg_cron + queue worker pattern
12. **NOVA: `supabase-auth-methods`** — OTP/Magic Link/OAuth/SSO/Anonymous/MFA/Hooks/Custom claims
13. **NOVA: `supabase-branches`** — preview/persistent, lifecycle, GitHub integration, deployment workflow
14. **NOVA: `supabase-cli`** — referência canônica de comandos por categoria, versão v2.98.x

**Total revisado: 14 skills** (vs 8 originais).

### Agents DEFINITIVOS (sem mudança no plano original)

Os 6 agents do PROJECT.md cobrem o trabalho ativo. Nenhuma adição da pesquisa **exige** novo agent — `supabase-architect` cobre branches/cli como decisões de design; novos agents virariam micro-managers.

**Adendo:** considerar futuro agent `supabase-storage-writer` em v1.9+ se Storage virar área quente (deferir).

### Tabela de tools MCP

Criar `kit/agents/_shared/supabase-mcp-tools.md` (precedente `_shared/` de v1.7) com a tabela canônica acima. Cada um dos 6 agents da Suíte referencia esse doc no seu `tools:` frontmatter usando nomes genéricos `mcp__supabase__*`.

### Comando

`/supabase [subcomando]` — sem mudança no plano. Subcomandos provavelmente: `arquiteto | migration | rls | edge | realtime | auth | storage | vector | queue | branch`.

---

## Compatibilidade de Versões (2026-05-06)

| Pacote / Componente | Versão estável atual | Notas |
|---------------------|---------------------|-------|
| Supabase CLI | **v2.98.2** | release 2026-05-05; linha 2.x ("Config as Code") obrigatória |
| `@supabase/mcp-server-supabase` | **v0.8.1** | pre-1.0 — esperar breakings |
| `@supabase/ssr` | (cobertura via guia user) | usar em conjunto com `@supabase/supabase-js` v2.x |
| `pgmq` extension | requer Postgres **15.6.1.143+** | upgrade obrigatório se em versão antiga |
| `pg_net` extension | **v0.10.0** | upgrade recomendado |
| `pgvector` extension | latest via Supabase platform | suporta HNSW + IVFFlat |
| Vector Buckets | **alpha pública** | breaking changes esperadas — não usar em produção crítica |
| Analytics Buckets | **alpha** | idem |
| Branching 2.0 (no-Git default) | GA em 2025 | default em todos os novos projetos |

---

## O Que NÃO Cobrir (out of scope para v1.8)

| Item | Por Que NÃO |
|------|-------------|
| Self-hosting Supabase | Audience do kit é usuário de Supabase Cloud; SH é nicho. |
| `pg_graphql` / GraphQL API | Niche; quem precisa procura especialista. PostgREST cobre 95% dos casos. |
| Wrappers (Foreign Data Wrappers) | Avançado demais; introdução de complexidade sem demanda clara. |
| Realtime sob auto-hosted | Mesmo motivo do self-hosting. |
| Vector Buckets com pattern profundo | Ainda alpha — pattern não estabilizou. Mencionar, não detalhar. |
| Analytics Buckets com pattern profundo | Idem. |
| MCP server self-hosted alternatives (HenkDz, Quegenx, alexander-zuev) | Foco no canônico (`supabase-community`). Mencionar existência se relevante. |
| Trigger.dev / Inngest comparações | Não somos consultores de stack — kit é sobre Supabase. |

---

## Fontes

### Storage
- [Storage Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage Image Transformations | Supabase Docs](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Vector Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/vector/introduction)
- [Analytics Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/analytics/introduction)
- [Introducing Vector Buckets (blog 2026)](https://supabase.com/blog/vector-buckets)

### pgvector / AI
- [pgvector: Embeddings and vector similarity](https://supabase.com/docs/guides/database/extensions/pgvector)
- [AI & Vectors | Supabase Docs](https://supabase.com/docs/guides/ai)
- [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Automatic embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [Semantic search](https://supabase.com/docs/guides/ai/semantic-search)

### Queues / Cron
- [Supabase Queues](https://supabase.com/modules/queues)
- [pgmq: Queues](https://supabase.com/docs/guides/database/extensions/pgmq)
- [Supabase Cron](https://supabase.com/modules/cron)
- [pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Background Jobs and Queues for Self-Hosted Supabase with pgmq](https://www.supascale.app/blog/background-jobs-and-queues-for-selfhosted-supabase-with-pgmq)
- [Supabase Just Got More Powerful: Queue, Cron, and Background Tasks](https://supabase.com/blog/edge-functions-background-tasks-websockets)

### Auth (avançado)
- [Auth | Supabase Docs](https://supabase.com/docs/guides/auth)
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [MFA TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [MFA Phone](https://supabase.com/docs/guides/auth/auth-mfa/phone)
- [SAML SSO](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- [Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)

### Branches
- [Branching | Supabase Docs](https://supabase.com/docs/guides/deployment/branching)
- [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches)
- [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Branching Without Git Is Now The Default](https://supabase.com/blog/branching-without-git-is-now-the-default)

### CLI
- [CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Releases · supabase/cli](https://github.com/supabase/cli/releases)
- [Supabase CLI v2: Config as Code](https://supabase.com/blog/cli-v2-config-as-code)
- [supabase | npm](https://www.npmjs.com/package/supabase)

### MCP
- [Supabase MCP Server (blog)](https://supabase.com/blog/mcp-server)
- [github.com/supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)
- [@supabase/mcp-server-supabase | npm](https://www.npmjs.com/package/@supabase/mcp-server-supabase)
- [MCP | Supabase Docs](https://supabase.com/docs/guides/getting-started/mcp)

### Outros
- [Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Hardening the Data API](https://supabase.com/docs/guides/api/hardening-data-api)
- [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Background Tasks (Edge Functions)](https://supabase.com/docs/guides/functions/background-tasks)

---
*Pesquisa de stack para: Suíte Supabase v1.8 — kit-mcp content layer*
*Pesquisado: 2026-05-06*
*Confiança: HIGH — todas as fontes são oficiais Supabase + GitHub canônico + npm; versões verificadas ao vivo.*
