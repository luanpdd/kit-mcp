# Fase 26: 7 agents Supabase + convenção universal - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Smart discuss em modo autônomo (auto-decisões baseadas em pesquisa + Phase 25)

<domain>
## Limite da Fase

Produzir 7 agents `kit/agents/supabase-*.md` (workers especializados) que aplicam o conhecimento das skills da Phase 25. Cada agent inclui convenção universal SB-A00 (Compatibilidade table + preflight MCP detection + canonical layout output + canonical tool names `mcp__supabase__*`).

**Fora do escopo:** command `/supabase` (Phase 27), audit gates + cleanup (Phase 28).
</domain>

<decisions>
## Decisões de Implementação

### Convenção universal SB-A00 (auto)
- **D-A00-01:** Cada agent inclui no topo bloco `## Compatibilidade` listando IDEs em 3 tiers:
  - **Full** (live mode): Claude Code (com Supabase MCP configurado), Cursor (com Supabase MCP)
  - **Partial:** Codex (apenas Read/Write), Gemini CLI (apenas Read/Write)
  - **Offline-only:** Windsurf, Antigravity, Copilot, Trae (gera SQL/código para aplicação manual)
- **D-A00-02:** Preflight MCP detection no Step 0 — agent tenta uma chamada inicial leve a `mcp__supabase__list_tables` (se disponível). Se falhar, declara `MODO OFFLINE` no output **explícito** e produz SQL/código para aplicação manual. NUNCA finge sucesso.
- **D-A00-03:** Output em **layout canônico do CLI Supabase**:
  - Migrations → `supabase/migrations/<YYYYMMDDHHmmss>_<name>.sql`
  - Declarative schemas → `supabase/schemas/<NN>_<name>.sql`
  - Edge Functions → `supabase/functions/<name>/index.ts`
  - Storage policies → arquivo de migration
- **D-A00-04:** Frontmatter `tools:` lista NOMES CANÔNICOS `mcp__supabase__*` (zero UUIDs). Tools comuns: `Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__apply_migration`.
- **D-A00-05:** Agents Supabase **NÃO** invocam outros agents Supabase via `Task(subagent_type=supabase-...)` — orquestração só via `/supabase` command (Phase 27 — anti-pitfall A10). Agents permanecem função pura.

### Estrutura de cada agent (auto)
- **D-26-01:** Cada agent.md segue estrutura: (1) frontmatter (name + description ≤ 200 chars + tools + color), (2) `## Compatibilidade` (matriz IDE → tier), (3) `## Por que existe` (quando o caller deve invocar), (4) `## Inputs esperados` (do caller), (5) `## Passos` (numerados), (6) `## Output` (estrutura do retorno).
- **D-26-02:** Color codes (alinhados com agents existentes): architect=`blue`, migration-writer=`yellow`, rls-writer=`red`, edge-fn-writer=`cyan`, realtime-implementer=`magenta`, auth-bootstrapper=`green`, storage-implementer=`orange`.

### Discrição do Claude
- Conteúdo específico dos prompts/passos de cada agent — Claude decide com base no skill correspondente da Phase 25
- Exemplos concretos dentro de cada agent — Claude escolhe os mais ilustrativos do domínio
- Detalhes do error handling em modo offline — Claude decide formato (markdown estruturado vs lista)

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

### Skills da Phase 25 (referenciadas via Markdown link relativo)
- `kit/skills/supabase-realtime/SKILL.md` — broadcast + RLS realtime.messages
- `kit/skills/supabase-auth-ssr/SKILL.md` — getAll/setAll + middleware
- `kit/skills/supabase-edge-functions/SKILL.md` — Deno + npm:/jsr:
- `kit/skills/supabase-declarative-schema/SKILL.md` — workflow stop → diff
- `kit/skills/supabase-rls-policies/SKILL.md` — REGRA #1 + WARNING user_metadata
- `kit/skills/supabase-database-functions/SKILL.md` — set search_path = ''
- `kit/skills/supabase-migrations/SKILL.md` — naming + RLS obrigatório
- `kit/skills/supabase-postgres-style/SKILL.md` — convenções de SQL
- `kit/skills/supabase-storage/SKILL.md` — multi-tenant path
- `kit/skills/supabase-pgvector-rag/SKILL.md` — HNSW + RAG with permissions
- `kit/skills/supabase-cron-queues/SKILL.md` — cron → pgmq → Edge
- `kit/skills/_shared-supabase/glossary.md` — termos + comandos CLI

### Precedente no kit-mcp
- `kit/agents/schema-checker.md` — agent existente que usa Supabase MCP tools (com UUID hardcoded — será migrado na Phase 28). Layout do prompt e estrutura serve de modelo.

### Pesquisa do milestone
- `.planning/research/ARCHITECTURE.md` — decisão #2 (MCP-first com fallback offline) + decisão #5 (output em layout canônico)
- `.planning/research/PITFALLS.md` — A4 (preflight), A5 (overlap schema-checker), A10 (recursive dispatch), A12 (UUID), B1, B6, B13

</canonical_refs>

<code_context>
## Insights de Código Existente

### Ativos Reutilizáveis
- `kit/agents/schema-checker.md` — modelo de agent com Supabase MCP tools (estrutura: frontmatter → propósito → inputs → passos numerados → output → quando invocar)
- 11 skills da Phase 25 — referência canônica para cada domínio do agent

### Padrões Estabelecidos
- Agent frontmatter: `name`, `description`, `tools` (lista vírgula-separada), `color`
- Body: prompt do agent — direto, com passos numerados, output estruturado
- Color codes: cada agent existente tem cor única (blue, red, orange, etc.) — mantemos pattern
- `tools:` — nomes canônicos quando MCP disponível; `Read, Write, Edit, Bash, Grep, Glob` como base

### Pontos de Integração
- `src/core/kit.js` `listAgents()` lê `kit/agents/*.md` — novos agents aparecem em listKit sem mudança de código
- Sync para 8 IDEs em layouts nativos
- Comando `/supabase` (Phase 27) fará dispatch via `Task(subagent_type=supabase-...)` para cada agent

</code_context>

<specifics>
## Ideias Específicas

- Agents em PT-BR (alinhado com kit), code blocks EN literal com comentários PT-BR (mesmo D-01 das skills)
- Cada agent referencia ≥ 1 skill da Phase 25 via Markdown link relativo no texto do prompt
- Tabela "Compatibilidade" no topo é literal (markdown table) — facilita gate de validação na Phase 28

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — escopo definido em REQUIREMENTS.md SB-A00 + SB-A01..SB-A07.

</deferred>
