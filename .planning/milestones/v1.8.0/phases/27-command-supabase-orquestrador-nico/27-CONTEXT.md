# Fase 27: Command `/supabase` orquestrador único - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Smart discuss em modo autônomo

<domain>
## Limite da Fase

Produzir 1 arquivo `kit/commands/supabase.md` que serve de orquestrador único para os 7 agents da Phase 26. Aceita subcomandos (sinônimos PT/EN), faz dispatch via `Task(subagent_type=supabase-...)`, detecta `supabase/config.toml` para passar `project_id`, e é o ÚNICO ponto de chain de agents Supabase (anti-pitfall A10).

**Fora do escopo:** audit gates + cleanup (Phase 28).
</domain>

<decisions>
## Decisões de Implementação

### Subcomandos (auto)
- **D-27-01:** Aceita 10 subcomandos com sinônimos PT-BR/EN:
  - `arquiteto` / `architect` → `supabase-architect`
  - `migration` / `migrar` → `supabase-migration-writer`
  - `rls` → `supabase-rls-writer`
  - `edge` → `supabase-edge-fn-writer`
  - `realtime` → `supabase-realtime-implementer`
  - `auth` → `supabase-auth-bootstrapper`
  - `storage` → `supabase-storage-implementer`
  - `rag` → `supabase-edge-fn-writer` (com prompt sobre embeddings) OU `supabase-architect` (se design RAG)
  - `cron` → `supabase-edge-fn-writer` (com prompt sobre `cron → pgmq → Edge`)
  - `check` → `schema-checker` (existente — para validar SQL antes de aplicar)

### Dispatch (auto)
- **D-27-02:** Cada subcomando dispatch via `Task(subagent_type=<agent_name>, prompt=<args>)`. Subcommand `check` invoca `schema-checker` (precedente Phase 24). Argumentos do user passam para o agent como prompt.
- **D-27-03:** Detect `supabase/config.toml` no projeto root — extrai `project_id` se presente, passa para agents via prompt. Se ausente, agent funciona sem project_id (modo offline ou pergunta ao user).

### Free vs Pro upfront (auto)
- **D-27-04:** Subcommand `arquiteto` pergunta tier upfront via `AskUserQuestion` (anti-pitfall B2 + B8 — ver agent supabase-architect).

### Estrutura do command (auto)
- **D-27-05:** Frontmatter: `name`, `description ≤ 200 chars`, `argument-hint`, `allowed-tools` (Read, Write, Bash, Task, AskUserQuestion).
- **D-27-06:** Body: `<objective>` + `<context>` + `<process>` (parsing de subcomando + dispatch) + `<success_criteria>`.

### Discrição do Claude
- Mensagens de erro quando subcomando inválido — Claude decide formato
- Aliases adicionais futuros — extensível sem breaking

</decisions>

<canonical_refs>
## Referências Canônicas

### Agents da Phase 26 (alvos do dispatch)
- `kit/agents/supabase-architect.md`
- `kit/agents/supabase-migration-writer.md`
- `kit/agents/supabase-rls-writer.md`
- `kit/agents/supabase-edge-fn-writer.md`
- `kit/agents/supabase-realtime-implementer.md`
- `kit/agents/supabase-auth-bootstrapper.md`
- `kit/agents/supabase-storage-implementer.md`
- `kit/agents/schema-checker.md` (existente — usado pelo subcomando `check`)

### Precedentes de commands com subcomandos
- `kit/commands/fluxos-trabalho.md` — listar/criar/alternar/status (patterns de subcomando)
- `kit/commands/depurar.md` — Task dispatch
- `kit/commands/fio.md` — outro exemplo de subcomando

### Pesquisa do milestone
- `.planning/research/ARCHITECTURE.md` — decisão #3 (orquestrador único com subcomandos)
- `.planning/research/PITFALLS.md` — A10 (recursive dispatch — só este command faz orquestração), A5 (overlap schema-checker — subcomando `check`)

</canonical_refs>

<code_context>
## Insights de Código Existente

### Ativos Reutilizáveis
- `kit/commands/fluxos-trabalho.md` — pattern de subcomandos com switch/case-like
- 7 novos agents da Phase 26 + `schema-checker` existente

### Padrões Estabelecidos
- Commands têm frontmatter com `name`, `description`, `argument-hint`, `allowed-tools` (lista YAML)
- Body: `<objective>`, `<context>`, `<process>` (passos numerados), `<success_criteria>`
- Task dispatch: `Task(subagent_type="<agent>", prompt="<input>")`

### Pontos de Integração
- `src/core/kit.js` `listCommands()` lê `kit/commands/*.md` — `/supabase` aparece automaticamente
- Sync para 8 IDEs em layouts nativos
- User invoca via `/supabase <subcommand> <args>` em qualquer IDE

</code_context>

<specifics>
## Ideias Específicas

- Dispatch deve passar **todos** os argumentos restantes (após subcomando) como prompt do agent
- `project_id` extraído de `supabase/config.toml` é apenas hint — agent pode ignorar se não precisa

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma. Sinônimos podem ser adicionados em v1.9+ sem breaking.

</deferred>
