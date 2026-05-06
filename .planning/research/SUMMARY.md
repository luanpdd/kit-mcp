# Resumo da Pesquisa do Projeto — kit-mcp Suíte Supabase v1.8

**Projeto:** kit-mcp — Suíte Supabase v1.8
**Domínio:** Conteúdo de kit (skills + agents + commands) cross-IDE para ecossistema Supabase 2026
**Pesquisado:** 2026-05-06
**Confiança:** HIGH

---

## Resumo Executivo

A pesquisa em 4 dimensões (Stack / Features / Architecture / Pitfalls) confirma que o plano original do PROJECT.md (8 skills + 6 agents + 1 command) cobre **~75% do que apps Supabase reais constroem em 2026** — sólido para "core stack" (Auth + DB + RLS + Realtime + Edge + Migrations) mas com **3 lacunas essenciais** (Storage, pgvector/RAG, Queues+Cron). Stack e Features convergem na recomendação **expandida**: 11 skills + 7 agents + 1 command. Architecture confirma que isso é viável sem tocar runtime — v1.8 segue **content-only** (zero código novo).

**Recomendação principal:** adotar escopo **expandido (11/7/1)** — adicionar `supabase-storage`, `supabase-pgvector-rag`, `supabase-cron-queues` (skills) e `supabase-storage-implementer` (agent). Diferenciais (MFA, multi-tenant, branching, FTS, Expo/SvelteKit/Nuxt) ficam para v1.9+.

**Risco principal:** drift entre `kit/` canonical e `.claude/` stubs após +15 itens, multiplicado por 8 IDEs alvo. Mitigação: gates antipattern + tabela "Compatibilidade" no topo de cada skill/agent + nomes canônicos de tools MCP (`mcp__supabase__*` em vez do UUID pessoal de `schema-checker.md`).

---

## Principais Descobertas

### Stack Recomendado

A pesquisa de Stack consolida **componentes Supabase 2026** em 3 categorias:

**Tabela-stakes (TODOS os apps modernos precisam):**
- Auth métodos avançados (OTP, OAuth, MFA, Anonymous) — extensão de `supabase-auth-ssr`
- Storage (uploads, signed URLs, RLS sobre `storage.objects`) — **lacuna crítica**
- pgvector / Embeddings / RAG — **lacuna crítica em 2026** (apps RAG explodiram)
- Branches (preview/persistent + Branching 2.0 sem-Git default) — diferencial-virou-tablestakes
- CLI v2.98+ ("Config as Code") — referência canônica

**Differentiator (importante mas pode esperar):**
- pgmq (Queues) + pg_cron — desbloqueia background jobs sem dep externa
- MCP server oficial (`@supabase/mcp-server-supabase` v0.8.1, pre-1.0) — referência de tools dentro dos agents

**Não-skill (apenas seção dentro de skill existente):**
- Database Webhooks (pg_net) → seção em `supabase-database-functions`
- PostgREST custom schema → seção em `supabase-postgres-style` ou `supabase-rls-policies`
- Edge Background Tasks → seção em `supabase-edge-functions`

**Compatibilidade fixada (2026-05-06):** CLI v2.98.2 · MCP server v0.8.1 · pgmq requer Postgres 15.6.1.143+ · pg_net v0.10.0 · Branching 2.0 GA · Vector Buckets/Analytics Buckets ainda **alpha** (mencionar, não detalhar).

> Detalhe: `.planning/research/STACK.md`

### Funcionalidades Esperadas

**Deve ter (essencial — entra em v1.8):**
- Auth básico (email/password + magic link + OAuth) — já coberto
- RLS com `auth.uid()` correto (com `(select)` wrapper + index obrigatório) — já coberto
- Edge Functions (Deno + npm:/jsr:) — já coberto
- Realtime (broadcast + presence + postgres_changes) — já coberto
- **Storage** (upload, signed URL, multi-tenant isolation, image transforms) — **lacuna v1.8**
- **pgvector RAG** (embeddings + chunking + HNSW vs IVFFlat + RAG with permissions) — **lacuna v1.8**
- **Cron+Queues** (pg_cron + pgmq + pg_net = background jobs internos) — **lacuna v1.8**

**Deveria ter (diferencial — defer para v1.9):**
- MFA TOTP/Phone + AAL2 enforcement
- Multi-tenant (organizations/teams + RLS)
- Branching workflow (preview environments)
- Full-text search (tsvector + GIN + RRF híbrido com vector)
- Frontends extras (Expo, SvelteKit, Nuxt)

**Adiar (v2+):** Streaming SSE, Vault, Observability (log_drains, metrics), Self-hosting.

> Detalhe: `.planning/research/FEATURES.md`

### Abordagem de Arquitetura

v1.8 é **content-only por design** — nenhuma mudança em `registry.js`, `sync.js`, `kit.js`. Apenas adições em `kit/{skills,agents,commands}/`. As 8 decisões arquiteturais validam que o plano cabe sem tocar runtime:

1. **Skills (11 dirs flat)** — `kit/skills/supabase-*/SKILL.md` com prefixo `supabase-`. Cluster alfabético em CLAUDE.md sem categoria custom.
2. **Agents (7 arquivos)** — `kit/agents/supabase-*.md` com tools `mcp__supabase__*` canônicos (NÃO UUID hardcoded). Detecção MCP-first com **graceful fallback offline** (5 dos 8 IDEs operam offline-only).
3. **Command (1 arquivo)** — `kit/commands/supabase.md` com dispatch via `Task(subagent_type=...)` para subcomandos `arquiteto|migration|rls|edge|realtime|auth|storage|rag|cron`. Espelha precedente `/fluxos-trabalho` + `/depurar`.
4. **Cross-references** — Markdown links relativos (`[supabase-rls-policies](../skills/supabase-rls-policies/SKILL.md)`), **NÃO** `@-include` (quebraria lazy-load das skills).
5. **Outputs dos agents** — escrevem em layouts canônicos do CLI Supabase (`supabase/migrations/`, `supabase/schemas/`, `supabase/functions/<name>/`), com detecção de layout no boot e `AskUserQuestion` se ambíguo.

> Detalhe: `.planning/research/ARCHITECTURE.md`

### Armadilhas Críticas

A pesquisa de Pitfalls cataloga **12 armadilhas de packaging** (A1-A12) + **14 armadilhas de Supabase** (B1-B14). Top 5 mais críticas:

1. **A12 — UUID pessoal em tools MCP** — `schema-checker.md` usa `mcp__0a712001-...__execute_sql`. Em v1.8 distribuído, quebra para outros users. **Fix:** nomes canônicos `mcp__supabase__*` + migrar `schema-checker.md` na Phase 28.
2. **A4 — Agent sem MCP = fail silencioso** — 5 dos 8 IDEs alvo não têm MCP Supabase. Sem preflight, agent finge sucesso. **Fix:** detecção de capabilities + modo offline gracioso.
3. **A10 — Recursive dispatch entre agents Supabase** — stack overflow lógico + custo LLM. **Fix:** regra "agents Supabase NÃO invocam outros agents Supabase". Gate `grep "Task" kit/agents/supabase-*` == 0.
4. **B5 — `user_metadata` em RLS = privilege escalation** — usuário pode auto-elevar `plan: 'premium'`. **Fix:** WARNING absoluto em `supabase-rls-policies` + agent ABORTA se detecta.
5. **B6 — `service_role` em client = banco exposto** — typo em `NEXT_PUBLIC_*` vaza chave que bypassa RLS. **Fix:** REGRA em `supabase-auth-ssr` + audit `.env*` no `supabase-auth-bootstrapper`.

Outras críticas: A1 (drift kit/ ↔ .claude/), A2 (CLAUDE.md infla), A8 (stub-only mode perde body de skill), B4 (RLS sem `(select)` wrapper = 1000× degradação), B7 (`SECURITY DEFINER` sem `search_path = ''`).

> Detalhe completo: `.planning/research/PITFALLS.md`

---

## Implicações para o Roadmap

### Decisão de Escopo — RECOMENDAÇÃO EXPANDIDA (11/7/1)

| Componente | Plano original | Recomendação | Adicionar |
|------------|----------------|--------------|-----------|
| Skills | 8 | **11** | `supabase-storage`, `supabase-pgvector-rag`, `supabase-cron-queues` |
| Agents | 6 | **7** | `supabase-storage-implementer` |
| Command | 1 | 1 | `/supabase` (subcomandos +3: `storage`, `rag`, `cron`) |

**Justificativa:** Stack/Features convergem que Storage/Vector/Queues são table-stakes em 2026; lançar sem cobre só ~75% dos apps. Architecture valida que cabe em content-only. Pitfalls mostra que NÃO incluir empurra prevenção de 4 das 14 armadilhas Supabase para skills inexistentes — vira tech debt imediata.

### Estrutura de Fases (4 fases — Phase 25 → 28)

#### Phase 25 — Fundamentos + 11 skills Supabase
- 11 SKILL.md (`supabase-{realtime,auth-ssr,edge-functions,declarative-schema,rls-policies,database-functions,migrations,postgres-style,storage,pgvector-rag,cron-queues}`)
- Glossário em `kit/skills/_shared-supabase/glossary.md`
- Critérios anti-pitfall: A1 (sync idempotente), A2 (CLAUDE.md ≤ +1.5 KB), A3 (auto-contidas), A8 (full mode em targets `single`), A11 (glossário), B4 (`(select)` wrapper como REGRA), B5 (warning user_metadata), B7 (`search_path = ''`)

#### Phase 26 — 7 agents Supabase
- 7 agent.md (`supabase-{architect,migration-writer,rls-writer,edge-fn-writer,realtime-implementer,auth-bootstrapper,storage-implementer}`)
- Cada agent: tabela "Compatibilidade" no topo, detecção layout/MCP no boot, output canônico
- Critérios anti-pitfall: A4 (preflight MCP), A5 (overlap schema-checker), A6 (sem hooks), A10 (zero recursive dispatch — gate), A12 (zero UUIDs — gate), B1 (Realtime cleanup), B6 (service_role audit), B13 (single serverClient)

#### Phase 27 — Command `/supabase` orquestrador
- 1 command.md
- Dispatch via `Task(subagent_type=...)` para 9 subcomandos (`arquiteto`/`architect` etc — sinônimos PT/EN)
- Detecta `supabase/config.toml` para `project_id`
- Critérios anti-pitfall: A10 (orquestração centralizada), A5 (subcomando `check` invoca `schema-checker`), B2 (Free tier heartbeat), B8 (branch billing alert)

#### Phase 28 — Validação cross-IDE + cleanup
- Sync para 8 IDEs + smoke test em ≥4 IDEs reais
- **Migrate `schema-checker.md`** UUID → `mcp__supabase__*` (cleanup oportunístico)
- 5 audit gates verde no CI: `deps-budget`, `no-personal-uuid`, `agent-no-recursive-dispatch`, `skill-must-include`, `budget-description`
- Critérios anti-pitfall: A1 (idempotência byte-idêntica), A2 (CLAUDE.md ≤ 12.5 KB), A7 (gates verde), A12 (zero UUIDs em todo `kit/`), B3 (smoke real branch Supabase)

### Justificativa do Ordenamento

- Skills antes de agents (cross-refs evitam links mortos).
- Agents antes de command (command faz dispatch via `Task`).
- Validação por último (cross-IDE smoke + cleanup do `schema-checker.md`).
- Phase 25 e 26 parcialmente paralelizáveis em tarefas internas; mas Phase 26 começa após Phase 25 entregar.

### Flags de Pesquisa em /planejar-fase

- **Phase 25 — pesquisa adicional para `supabase-pgvector-rag` + `supabase-cron-queues`:** novidade em 2026, validar exemplos contra docs Supabase atuais.
- **Phase 26 — pesquisa adicional para `supabase-storage-implementer`:** primeiro agent de Storage; sem precedente direto.
- **Phase 27 e 28 — sem pesquisa adicional:** padrões maduros (precedente `/fluxos-trabalho`, sync+smoke rotineiro).

---

## Avaliação de Confiança

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | HIGH | Fontes oficiais Supabase + GitHub + npm; versões ao vivo (2026-05-06) |
| Funcionalidades | HIGH | Patterns canônicos 2026 + análise de concorrentes |
| Arquitetura | HIGH | Cada decisão tem precedente direto no código ou em `.md` existente |
| Armadilhas | HIGH | 26 pitfalls com fonte primária e mitigação acionável |

**Confiança geral:** HIGH

### Lacunas a Abordar
- **Bundle size de Edge Functions:** threshold KB definido empiricamente na Phase 26.
- **Vector Buckets / Analytics Buckets (alpha):** mencionar como notas, NÃO detalhar.
- **CLI `gen types` ordering bug (B12):** workaround documentado; reavaliar se Supabase publicar fix.
- **MCP server v0.8.1 → v1.0:** pre-1.0; usar prefixo canônico + documentar configuração própria.

---

## Top 7 Findings para Validação do User (ANTES de roadmap)

1. **Aceita escopo expandido (11/7/1)?** Original 8/6/1 cobre ~75%; expandido cobre ~90%. Diferencial: 4 itens (3 skills + 1 agent).

2. **Aceita ordem 25→26→27→28 (skills → agents → command → validação)?** Ditada por dependências.

3. **Aceita migrar `schema-checker.md` na Phase 28 (cleanup oportunístico)?** UUID hardcoded é tech debt herdada; quebra para outros users.

4. **Aceita modo offline gracioso em 5 dos 8 IDEs?** Apenas Claude Code + Cursor (com Supabase MCP) operam "live". Os outros 6 operam "offline" (agent gera SQL/código, user aplica manualmente).

5. **Aceita budget CLAUDE.md ≤ +1.5 KB (Phase 25) → ≤ 12.5 KB total (Phase 28)?** Cluster alfabético; description budget 200 chars enforced via gate.

6. **Aceita 5 gates novos no CI?** `budget-description.mjs`, `no-personal-uuid.mjs`, `agent-no-recursive-dispatch.mjs`, `skill-must-include.mjs`, idempotência sync. Todos JS puro, ~50-100 LOC cada, zero deps novas.

7. **Aceita `kit/skills/_shared-supabase/glossary.md` (não-skill, arquivo de referência)?** Pitfalls sugere `supabase-setup` como skill; Architecture sugere consolidar em glossário compartilhado (precedente `_shared/` existe desde v1.7).

---

## Fontes

### Primárias (HIGH — docs oficiais Supabase 2026)
- [Supabase Storage](https://supabase.com/docs/guides/storage), [Auth](https://supabase.com/docs/guides/auth), [Realtime](https://supabase.com/docs/guides/realtime), [Edge Functions](https://supabase.com/docs/guides/functions), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), [Cron](https://supabase.com/docs/guides/cron), [Branching](https://supabase.com/docs/guides/deployment/branching), [CLI v2.98](https://supabase.com/docs/reference/cli/introduction), [MCP server](https://supabase.com/blog/mcp-server)
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Database Advisors lint 0011](https://supabase.com/docs/guides/database/database-advisors)
- [Splinter linter 0015 user_metadata](https://supabase.github.io/splinter/0015_rls_references_user_metadata/)
- [GitGuardian Supabase service_role remediation](https://www.gitguardian.com/remediation/supabase-service-role-jwt)
- GitHub issues: [`supabase/cli#3974`](https://github.com/supabase/cli/issues/3974), [`supabase/ssr#68`](https://github.com/supabase/ssr/issues/68), [`supabase/cli#3900`](https://github.com/supabase/cli/issues/3900)

### Secundárias (HIGH — codebase kit-mcp)
- `src/core/{kit,sync,registry}.js` — runtime estável desde v1.0
- `kit/agents/schema-checker.md` — precedente de tools MCP em agent (com UUID a migrar)
- `kit/commands/{fluxos-trabalho,depurar,fazer}.md` — precedentes de subcomandos + dispatch
- `.planning/PROJECT.md` — milestone v1.8 specification
- `.planning/MILESTONES.md` — histórico v1.6/v1.7 perf optims (CLAUDE.md size, stub-only mode)

### Documentos de pesquisa cruzados
- `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`

---
*Pesquisa concluída: 2026-05-06* · *Pronto para roadmap: sim*
