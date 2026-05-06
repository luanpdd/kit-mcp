# Glossário Supabase — Termos, Comandos e Patterns Canônicos

> Arquivo de referência compartilhado pelas skills `supabase-*`. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas 11 skills via Markdown link relativo.

---

## (a) Termos PT-BR ↔ EN

### Authorization e Auth

| EN | PT-BR / Significado |
|---|---|
| **RLS** | Row Level Security — segurança em nível de linha. Filtra automaticamente quais linhas de uma tabela cada usuário vê/modifica baseado em policies. |
| **policy** | Política de RLS — regra `create policy ... on <table> for <op> ...`. Sempre granular por operação (SELECT/INSERT/UPDATE/DELETE). |
| **`auth.uid()`** | Função que retorna o UUID do usuário autenticado da sessão atual. **Sempre** usar em `(select auth.uid())` em policies. |
| **`auth.jwt()`** | Função que retorna o JWT decodificado da sessão. Acesso via `auth.jwt()->'app_metadata'` ou `auth.jwt()->>'aal'`. |
| **`app_metadata`** | Metadata controlado pelo backend (apenas service_role pode mutar). **Use para roles/permissions** em RLS. |
| **`user_metadata`** | Metadata controlado pelo cliente (`auth.updateUser({data: ...})`). **NUNCA** use em policy de autorização — privilege escalation. |
| **service_role** | Role do Postgres com bypass total de RLS. **NUNCA** expor ao cliente — vazamento = acesso total ao DB. |
| **anon** | Role para requests sem autenticação. RLS aplicado normalmente. |
| **authenticated** | Role para usuário autenticado. RLS aplicado normalmente. |
| **public** | Role default — equivale a anon + authenticated juntos. Evite — sempre use `to authenticated` ou `to anon` explícito. |
| **AAL** | Authentication Assurance Level. `aal1` = senha apenas; `aal2` = senha + 2FA. Verifica via `(auth.jwt()->>'aal')::text`. |

### Database e Schema

| EN | PT-BR / Significado |
|---|---|
| **`schemas/`** | Pasta `supabase/schemas/` — fonte da verdade declarative do schema. Editar aqui, depois `db diff` gera migration. |
| **`migrations/`** | Pasta `supabase/migrations/` — arquivos `YYYYMMDDHHmmss_<name>.sql` versionados em git. |
| **`db diff`** | `supabase db diff -f <name>` — gera migration a partir do diff entre schemas/ declarado e DB local atual. |
| **`db reset`** | `supabase db reset` — recria DB local do zero + reaplica todas as migrations + seeds. |
| **`search_path`** | Caminho de busca de schema do Postgres. **Sempre** `set search_path = ''` em funções. |
| **schema-qualified** | Referência a objeto com schema explícito: `public.tasks` em vez de só `tasks`. Obrigatório quando `search_path = ''`. |
| **`SECURITY INVOKER`** | Função executa com permissões de quem chamou. Default obrigatório. |
| **`SECURITY DEFINER`** | Função executa com permissões do owner. Apenas com justificativa documentada. |
| **`IMMUTABLE`** | Função sempre retorna o mesmo para os mesmos inputs (sem consultar DB). |
| **`STABLE`** | Função consulta DB mas não modifica — mesmo resultado dentro de uma transação. |
| **`VOLATILE`** | Default. Função pode retornar valores diferentes ou ter side effects. |

### Realtime

| EN | PT-BR / Significado |
|---|---|
| **broadcast** | Mensagens custom via WebSocket — tipo recomendado em 2026 (substitui `postgres_changes` em apps novos). |
| **postgres_changes** | Pattern legado de receber mudanças do DB via stream. Single-threaded — não escala. **Migrar para broadcast.** |
| **presence** | Tracking de "quem está online". Usar **com moderação** — só para presence real (online status, cursor de colaboração). |
| **channel** | Canal de comunicação — naming canônico `scope:entity:id` (ex: `room:123:messages`). |
| **private channel** | Canal autenticado — `private: true` + RLS sobre `realtime.messages`. **Default em produção.** |
| **`realtime.broadcast_changes`** | Função SQL para emitir broadcast de dentro do Postgres (de trigger). |
| **`realtime.send`** | Função SQL para emitir mensagem custom (não amarrada a tabela). |

### Edge Functions

| EN | PT-BR / Significado |
|---|---|
| **Edge Function** | Função serverless Deno hospedada por Supabase. Roda perto do usuário. |
| **`Deno.serve`** | Built-in para HTTP server em Edge Functions (NÃO usar `serve` de `deno.land/std`). |
| **`EdgeRuntime.waitUntil`** | Permite tarefa background continuar após response retornar. |
| **`npm:` / `jsr:`** | Specifiers de import obrigatórios (sem bare specifiers). Ex: `import x from "npm:hono@4.6.7"`. |

### Storage e Vector

| EN | PT-BR / Significado |
|---|---|
| **bucket** | Container de arquivos — público ou privado. Privado por default. |
| **signed URL** | URL temporária com expiration para download de arquivo privado. |
| **`storage.objects`** | Tabela onde Storage grava metadados — RLS aplicado aqui controla acesso. |
| **multi-tenant path isolation** | Pattern: prefixar path do arquivo com `auth.uid()` (`{user_id}/file.png`) para isolar por tenant via RLS. |
| **TUS** | Tus Resumable Upload protocol — upload em chunks resumable. |
| **pgvector** | Extensão Postgres para embeddings/similarity search. |
| **HNSW** | Hierarchical Navigable Small World — index para vector. **Recall melhor.** Default em 2026. |
| **IVFFlat** | Inverted File Flat — index alternativo. Mais rápido com volumes grandes mas recall menor. |
| **`<=>`** | Operador cosine distance em pgvector. |
| **`<#>`** | Operador inner product em pgvector. |
| **`<->`** | Operador L2 (euclidean) distance em pgvector. |

### Background Jobs

| EN | PT-BR / Significado |
|---|---|
| **`pg_cron`** | Extensão para jobs cron dentro do Postgres. Schedule SQL/funções. |
| **`pgmq`** | Postgres Message Queue — extensão de queues. Requer Postgres 15.6.1.143+. |
| **`pg_net`** | Extensão para requests HTTP de dentro do Postgres. v0.10.0+. |

### Branching

| EN | PT-BR / Significado |
|---|---|
| **branch database** | Cópia preview do DB de produção para feature branches. |
| **persistent branch** | Branch que sobrevive entre PRs (staging long-lived). |
| **preview branch** | Branch criado para PR específico — destruído ao merge. |

---

## (b) Comandos CLI canônicos

```bash
# Schema declarative
supabase stop                                          # parar containers (necessário antes de db diff)
supabase db diff -f <name>                             # gera migration de schemas/ → migrations/
supabase db reset                                      # reset local + reaplica migrations + seeds
supabase db push                                       # aplica migrations não aplicadas no DB remote
supabase db pull                                       # pulla mudanças remote → cria migration local

# Migrations
supabase migration new <name>                          # cria migration vazia com timestamp UTC

# Edge Functions
supabase functions new <name>                          # cria boilerplate de Edge Function
supabase functions deploy <name>                       # deploy para Supabase
supabase functions invoke <name> --body '{}'           # invoca localmente

# Tipos
supabase gen types typescript --local > types/db.ts    # gera tipos do schema local
supabase gen types typescript --linked > types/db.ts   # gera tipos do remote linked

# Project lifecycle
supabase init                                          # inicializa supabase/ no projeto
supabase start                                         # sobe stack local (Postgres + Studio + Auth + ...)
supabase stop                                          # derruba stack local
supabase status                                        # status dos containers locais
supabase link --project-ref <ref>                      # linka projeto local com remote

# Branching
supabase branches create <name>                        # cria preview branch
supabase branches list                                 # lista branches
supabase branches delete <name>                        # deleta branch (importante para custo!)

# Secrets
supabase secrets set --env-file .env.production        # setar secrets em remote
supabase secrets list                                  # listar (sem revelar valores)
```

---

## (c) Patterns canônicos consolidados

### Pattern: `(select auth.uid())` wrapper em RLS
- Sem `(select)`: degradação até **1000×** em queries com filtro RLS
- Detalhes: [supabase-rls-policies](../supabase-rls-policies/SKILL.md)

### Pattern: `set search_path = ''` em funções
- Sem isso: vulnerável a hijack de schema via `search_path` manipulation
- Detalhes: [supabase-database-functions](../supabase-database-functions/SKILL.md)

### Pattern: `getAll`/`setAll` cookies em SSR (Next.js)
- Pacote `@supabase/ssr` — **NUNCA** `@supabase/auth-helpers-nextjs` (deprecated)
- Detalhes: [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md)

### Pattern: `cron → pgmq → Edge Function` (background jobs)
- Schedule via `pg_cron` → enqueue em `pgmq` → consumir e disparar `pg_net.http_post()` para Edge Function
- Sem dep externa (Inngest/Trigger.dev) — tudo dentro de Supabase
- Detalhes: [supabase-cron-queues](../supabase-cron-queues/SKILL.md)

### Pattern: RAG with permissions (similarity + RLS)
- Embeddings em coluna vector + RLS policy filtrando por `user_id` ou `org_id`
- Sem RLS, qualquer cliente vê embeddings de todos os tenants
- Detalhes: [supabase-pgvector-rag](../supabase-pgvector-rag/SKILL.md)

### Pattern: multi-tenant path isolation em Storage
- Path do arquivo prefixado com `auth.uid()` ou `org_id`: `{user_id}/avatar.png`, `{org_id}/docs/file.pdf`
- RLS sobre `storage.objects` valida que o cliente acessa apenas o próprio prefixo
- Detalhes: [supabase-storage](../supabase-storage/SKILL.md)

### Pattern: declarative-first → diff → migration
- Editar schemas em `supabase/schemas/*.sql`
- Rodar `supabase stop && supabase db diff -f <name>` para gerar migration em `supabase/migrations/`
- Revisar migration manualmente antes de aplicar
- Detalhes: [supabase-declarative-schema](../supabase-declarative-schema/SKILL.md)

### Pattern: `private: true` em Realtime channels
- Default em produção (2026) — desabilita acesso anônimo
- Requer RLS sobre `realtime.messages` para SELECT (read) e INSERT (write)
- Detalhes: [supabase-realtime](../supabase-realtime/SKILL.md)

### Pattern: schema-qualified em Edge Functions chamando Supabase
- Function consulta `public.tasks` (não `tasks`) quando usar service-role client
- Combina com `set search_path = ''` em DB functions chamadas via RPC
- Detalhes: [supabase-edge-functions](../supabase-edge-functions/SKILL.md)
