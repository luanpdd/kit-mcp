# REQUIREMENTS — kit-mcp v1.8

**Milestone:** v1.8 — Suíte Supabase
**Aberto em:** 2026-05-06
**Status:** Definindo

> Adiciona uma camada completa de expertise Supabase ao kit (11 skills + 7 agents + 1 command + 5 audit gates) para que consumidores do `@luanpdd/kit-mcp` tenham apoio canônico ao construir/manter backends Supabase. v1.8 é **content-only por design** — zero mudanças em `src/core/`, registry, sync ou MCP server runtime. Stable API v1.0+ preservada.

> Material-fonte: 7 guias oficiais Supabase fornecidos pelo user (Realtime, Auth SSR, Edge Functions, Declarative Schema, RLS, DB Functions, Migrations, Postgres Style) + 4 dimensões de pesquisa (`.planning/research/`). Top 7 findings validados em 2026-05-06.

---

## Requisitos do Milestone v1.8

### Skills — 11 skills Supabase canônicas (SB-S)

- [ ] **SB-S01**: `kit/skills/supabase-realtime/SKILL.md` documenta broadcast vs `postgres_changes`, presence sparing, naming `scope:entity:id`, eventos `entity_action`, RLS sobre `realtime.messages` (SELECT+INSERT separados, com index nas colunas), triggers `realtime.broadcast_changes` e `realtime.send`, error handling automático e migração de `postgres_changes`.
- [ ] **SB-S02**: `kit/skills/supabase-auth-ssr/SKILL.md` documenta `@supabase/ssr` (NUNCA `@supabase/auth-helpers-nextjs`), padrão exclusivo `getAll`/`setAll` (NUNCA `get`/`set`/`remove` individuais), browser/server clients, proxy completo com `getUser()` e redirects, regra "auth method order" (proxy → never call between createServerClient and getUser).
- [ ] **SB-S03**: `kit/skills/supabase-edge-functions/SKILL.md` documenta Deno runtime, imports `npm:` e `jsr:` (NUNCA bare specifiers), env vars pre-populadas (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`), `Deno.serve`, `EdgeRuntime.waitUntil`, file writes apenas em `/tmp`, multi-rota com Hono ou Express prefixadas com `/function-name`.
- [ ] **SB-S04**: `kit/skills/supabase-declarative-schema/SKILL.md` documenta workflow `supabase/schemas/` → `supabase stop` → `supabase db diff -f <name>` → revisão da migration gerada → apply. Documenta caveats (DML não rastreável, view ownership, RLS policies, partitions, comments, alter publication, create domain). Inclui regra "stop antes de diff".
- [ ] **SB-S05**: `kit/skills/supabase-rls-policies/SKILL.md` documenta REGRA #1 absoluta `(select auth.uid())` em vez de `auth.uid()` (1000× degradação sem `select`), policies separadas por operação (NUNCA `FOR ALL`), índices obrigatórios em colunas usadas, autenticated/anon roles via `TO`, MFA via `auth.jwt()->>'aal'`, `app_metadata` (admin) vs `user_metadata` (cliente — WARNING: NUNCA usar em policy de autorização — privilege escalation B5).
- [ ] **SB-S06**: `kit/skills/supabase-database-functions/SKILL.md` documenta `SECURITY INVOKER` por padrão (`SECURITY DEFINER` apenas com justificativa explícita), `SET search_path = ''` SEMPRE (lint advisor 0011), qualified names (`schema_name.table_name`), `IMMUTABLE`/`STABLE` por padrão, triggers com `CREATE TRIGGER` válido, error handling com `RAISE EXCEPTION`.
- [ ] **SB-S07**: `kit/skills/supabase-migrations/SKILL.md` documenta naming `YYYYMMDDHHmmss_short_description.sql` (UTC), header de comentário com metadados, lowercase SQL, comentários copiosos em comandos destrutivos, RLS obrigatório em toda nova tabela, policies granulares (uma por operação por role), `auth.uid()` em `(select)`.
- [ ] **SB-S08**: `kit/skills/supabase-postgres-style/SKILL.md` documenta lowercase reserved words, snake_case, plurals para tabelas e singular para columns, ISO 8601 dates, comentários `/* */` (block) e `--` (line), aliases descritivos com `as`, CTEs lineares para queries complexas, JOIN com nomes completos de tabela.
- [ ] **SB-S09**: `kit/skills/supabase-storage/SKILL.md` documenta buckets públicos vs privados, signed URLs com expiration, RLS sobre `storage.objects` (path tenant prefix isolation), image transformations, multipart resumable uploads (TUS), egress billing awareness, anti-pattern overwrite de arquivo (CDN cache).
- [ ] **SB-S10**: `kit/skills/supabase-pgvector-rag/SKILL.md` documenta extension setup (`create extension vector`), embedding dimensions, HNSW vs IVFFlat (HNSW = recall melhor, IVFFlat = mais rápido com mais data), distance operators (`<=>` cosine, `<#>` inner product), RAG with permissions (RLS + similarity), chunking strategies, hybrid search com FTS + RRF, anti-pattern dim mismatch.
- [ ] **SB-S11**: `kit/skills/supabase-cron-queues/SKILL.md` documenta `pg_cron` (scheduled jobs), `pgmq` (Postgres Message Queue, requer Postgres 15.6.1.143+), `pg_net` v0.10.0+ (HTTP from DB), pattern canônico `cron → pgmq → Edge Function` para background jobs sem dep externa, anti-pattern jobs >10 min em `pg_cron`.

### Glossário compartilhado (SB-D)

- [ ] **SB-D01**: `kit/skills/_shared-supabase/glossary.md` documenta termos canônicos PT-BR ↔ EN (RLS, broadcast, postgres_changes, schemas/, db diff, etc.) referenciado pelas 11 skills via Markdown link relativo (não-skill — arquivo de referência, NÃO listado em listKit).

### Agents — 7 workers Supabase especializados (SB-A)

- [ ] **SB-A01**: `kit/agents/supabase-architect.md` projeta schema + RLS + topologia realtime ANTES da implementação. Pergunta upfront "Free ou Pro?" — se Free, gera GitHub Action de heartbeat. Pergunta sobre branches — alerta sobre custo de preview branches abertas. NÃO escreve código de implementação (delega para outros agents).
- [ ] **SB-A02**: `kit/agents/supabase-migration-writer.md` escreve migrations seguindo declarative schema + RLS obrigatório + style guide. Detecta layout (`supabase/schemas/` vs `supabase/migrations/`) no boot. Inclui schema-check interno (last step). Usa `mcp__supabase__*` tools quando disponível, fallback offline (gera SQL para aplicação manual).
- [ ] **SB-A03**: `kit/agents/supabase-rls-writer.md` gera RLS policies para tabelas com indexing recomendado, `(select auth.uid())` wrapper sempre, policies granulares por operação por role. ABORTA se detecta `user_metadata` em policy de autorização (privilege escalation prevention B5).
- [ ] **SB-A04**: `kit/agents/supabase-edge-fn-writer.md` escreve Deno Edge Functions com imports versionados, env vars pre-populadas, file writes apenas em `/tmp`, alerta cold start se bundle > threshold (definido empiricamente durante implementação).
- [ ] **SB-A05**: `kit/agents/supabase-realtime-implementer.md` configura canais (client + DB triggers + RLS) com cleanup obrigatório (`useEffect return` ou equivalente), state checking antes de subscribe, naming canônico `scope:entity:id`. Migra `postgres_changes` para `broadcast` quando encontrado.
- [ ] **SB-A06**: `kit/agents/supabase-auth-bootstrapper.md` bootstrap Next.js v16 com `@supabase/ssr` (browser client + server client + proxy completo). Audita `.env*` files para detectar `NEXT_PUBLIC_*SERVICE*` (vazamento de service_role). Scaffolda single serverClient factory (não múltiplos clients em layouts — race condition B13).
- [ ] **SB-A07**: `kit/agents/supabase-storage-implementer.md` configura Storage (buckets, RLS sobre `storage.objects`, signed URLs, image transforms). Detecta multi-tenant pattern (path prefix com `auth.uid()`) ou single-tenant. Alerta sobre egress se patterns indicam alto volume.

### Convenção universal de agents Supabase (SB-A00)

- [ ] **SB-A00**: Cada um dos 7 agents Supabase inclui no topo: (1) tabela "Compatibilidade" por IDE (full / partial / offline-only), (2) preflight detection de capabilities MCP no Step 0 (declara MODO OFFLINE explicitamente se MCP indisponível — NUNCA finge sucesso), (3) detecção de layout no boot, (4) output em layout canônico do CLI Supabase (`supabase/migrations/`, `supabase/schemas/`, `supabase/functions/<name>/`), (5) frontmatter `tools:` lista NOMES CANÔNICOS `mcp__supabase__*` (zero UUIDs).

### Command — orquestrador único (SB-C)

- [ ] **SB-C01**: `kit/commands/supabase.md` é orquestrador único com 9 subcomandos: `arquiteto|architect`, `migration|migrar`, `rls`, `edge`, `realtime`, `auth`, `storage`, `rag`, `cron`, `check`. Aceita sinônimos PT-BR e EN.
- [ ] **SB-C02**: Cada subcomando dispatch o agent correto via `Task(subagent_type=supabase-...)`. Subcomando `check` invoca `schema-checker` (existente). Detecta `supabase/config.toml` para passar `project_id` como contexto opcional. É o ÚNICO ponto de chain de agents Supabase (agents permanecem função pura — anti-pitfall A10).

### Gates — 5 audit gates novos no CI (SB-G)

- [ ] **SB-G01**: `gates/budget-description.mjs` valida que cada agent/command/skill tem `description:` ≤ 200 chars no frontmatter. Falha CI se violado. Aplica em `kit/agents/*.md`, `kit/commands/*.md`, `kit/skills/*/SKILL.md`. (Anti-pitfall A2 — CLAUDE.md inflation)
- [ ] **SB-G02**: `gates/no-personal-uuid.mjs` detecta UUIDs no formato `[0-9a-f]{8}-[0-9a-f]{4}-...` em frontmatter `tools:` de qualquer agent ou em corpo de skill/command. Falha CI se encontrado. Inclui allowlist para `_shared-supabase/glossary.md` (referência documentada). (Anti-pitfall A12)
- [ ] **SB-G03**: `gates/agent-no-recursive-dispatch.mjs` valida que agents `kit/agents/supabase-*.md` NÃO contêm `Task(...subagent_type=supabase-...)`. Orquestração de agents Supabase só via `/supabase` command. Falha CI se violado. (Anti-pitfall A10)
- [ ] **SB-G04**: `gates/skill-must-include.mjs` valida strings obrigatórias por skill (ex: `supabase-rls-policies` deve incluir `(select auth.uid())`; `supabase-database-functions` deve incluir `set search_path = ''`; `supabase-auth-ssr` deve incluir `getAll` e `NEVER use auth-helpers`; etc.). Mapeamento `skill → must-include strings` em `gates/lib/supabase-must-include.json`. Falha CI se string faltando. (Anti-pitfall A7)
- [ ] **SB-G05**: `gates/sync-idempotent.mjs` roda `kit sync claude-code --project-root <tmpdir>` 2× consecutivos e verifica que `.claude/` produzido é byte-idêntico (diff vazio). Falha CI se houver drift. (Anti-pitfall A1 — drift kit/ ↔ .claude/)

### Validação cross-IDE + cleanup (SB-V)

- [ ] **SB-V01**: Sync da Suíte Supabase (11 skills + 7 agents + 1 command) para todos os 8 IDE targets (claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae). Smoke test: cada target produz arquivos esperados em layout nativo sem erros.
- [ ] **SB-V02**: Smoke test em ≥4 IDEs reais (Claude Code + Cursor + Codex + Gemini) invocando `supabase-rls-writer` em projeto teste. Verificação manual: agent gera output coerente em cada IDE (live mode em Claude Code/Cursor com MCP; offline mode nos demais).
- [ ] **SB-V03**: Migrar `kit/agents/schema-checker.md` de `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql`/`__list_tables` para `mcp__supabase__execute_sql`/`__list_tables`. Update referências internas. CHANGELOG documenta breaking interno (qualquer instalador de versões anteriores tinha UUID que não funcionava — agora funciona com MCP server canônico).
- [ ] **SB-V04**: CHANGELOG.md atualizado com seção `## [1.8.0] — 2026-MM-DD` listando: Suíte Supabase (11 skills, 7 agents, command `/supabase`), 5 audit gates novos, schema-checker UUID migration, breaking interno. STATE.md, MILESTONES.md atualizados. PR/branch ready para cut.

---

## Requisitos Futuros (adiados para v1.9+)

### Auth avançado
- MFA TOTP/Phone + AAL2 enforcement (skill `supabase-auth-mfa`)
- SSO/SAML com identity providers
- Multi-tenant (organizations/teams + RLS) (skill `supabase-multi-tenant`)

### Workflow
- Branching workflow completo — preview environments, schema sync entre branches (skill `supabase-branches`)
- CLI canonical reference (skill `supabase-cli` com versões e comandos)

### Search
- Full-text search (`tsvector` + GIN + RRF híbrido com vector) (skill `supabase-fts`)

### Frontends extras
- Expo/React Native (skill `supabase-expo`)
- SvelteKit (skill `supabase-sveltekit`)
- Nuxt (skill `supabase-nuxt`)
- Remix, Astro, vanilla SPA (skills futuras)

## Fora do Escopo (v1.8)

- **Mudanças em `src/core/`** — Stable API v1.0+ preservada. v1.8 é content-only.
- **Self-hosting Supabase** — fora do scope de skills cross-IDE; documentação separada.
- **`pg_graphql`** — fora de uso típico em apps modernos; defer indefinidamente.
- **Foreign Data Wrappers (FDW)** — uso muito específico; defer para v2+.
- **Vector Buckets / Analytics Buckets** — ainda alpha em 2026-05-06; mencionar como notas de futuro nas skills `supabase-storage` e `supabase-pgvector-rag` mas NÃO detalhar (risco de breaking).
- **Streaming SSE/WebSockets em Edge Functions** — fora do MVP; documentar apenas como existência.
- **Vault (secrets management)** — fora de scope de Suíte de skills/agents; defer.
- **Observability dedicada (log_drains, metrics)** — defer para v1.9+ se houver demanda.
- **Hooks customizados nas skills/agents Supabase** — anti-pitfall A6 (hooks só rodam em Claude Code; quebram cross-IDE). Schema-check fica como step interno do `supabase-migration-writer`, não como hook.
- **Quality dimension de RLS** validation runtime (ex: rodar EXPLAIN ANALYZE) — defer; gates apenas validam string presence (must-include).

## Rastreabilidade

(preenchida pelo roadmap em ROADMAP.md)
