# Changelog

All notable changes to `@luanpdd/kit-mcp`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.8.1] - 2026-05-06

Patch de integração da Suíte Supabase v1.8.0 — fecha 7 lacunas onde o conteúdo novo não estava "wired" nos pontos de entrada existentes do framework.

### Mudado — integração entre Suíte Supabase e fluxo padrão

- **`/fazer`** (`kit/commands/fazer.md`) — adicionada linha "Tarefa Supabase → `/supabase`" na decision tree + parágrafo "Detecção de intenção Supabase" listando 7 categorias de termos (DB / Auth / Realtime / Edge / Storage / RAG / Background) que devem rotear para `/supabase` em vez de `/discutir-fase` ou `/expresso`.
- **`planner` agent** (`kit/agents/planner.md`) — nova seção `<specialized_agents>` instrui o planner a delegar para `supabase-*` agents (architect, migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer) em fases Supabase em vez de gerar tasks genéricas para o `executor` resolver inline.
- **`executor` agent** (`kit/agents/executor.md`) — nova tabela "Delegação para agents especializados" lista 8 patterns de task (migrations, schemas declarative, RLS, Edge Functions, Realtime, Auth bootstrap, Storage, schema-checker) com `Task(subagent_type=...)` correto. Princípio: agent especializado é mais barato + mais correto que o executor genérico em domínios cobertos.
- **`/depurar`** (`kit/commands/depurar.md`) — `<available_agent_types>` agora inclui `schema-checker`. Nova seção `<supabase_pre_check>` faz triagem de bugs SQL/Supabase e pré-valida via `schema-checker` antes do `debugger` genérico (5 sintomas mapeados: migration falhou, RLS quebrou query, Edge Function quebrou, user_metadata em policy, service_role exposto).
- **`discuss-phase` workflow** (`kit/framework/workflows/discuss-phase.md`) — nova seção `<supabase_detection>` antes da identificação de áreas cinzentas. Se a fase é Supabase, delega o questionamento para `supabase-architect` (que já tem template de perguntas Supabase-específicas) em vez de gerar gray areas genéricas.
- **`plan-phase` workflow** (`kit/framework/workflows/plan-phase.md`) — `<available_agent_types>` agora inclui agents Supabase. Nova seção `<supabase_phase_detection>` no Step 1 — se fase é Supabase, usa `supabase-architect` em vez de `phase-researcher` genérico, e instrui o `planner` a marcar tasks com `subagent_type` apontando para o agent especializado correto (tabela com 7 patterns).
- **CI** (`.github/workflows/ci.yml`) — novo step "Audit — v1.8 Supabase suite gates" que executa os 4 gates blocking (`budget-description`, `no-personal-uuid`, `agent-no-recursive-dispatch`, `skill-must-include`) extraindo o bash check de cada `gates/<name>.md` e rodando. Falha o CI se algum violar. Gate non-blocking `sync-idempotent` defer (exige CLI completo).

### Adicionado — agentes existentes ganham awareness Supabase

Sem novos arquivos. As 6 edições em arquivos de agent/workflow/command existentes integram o conteúdo da v1.8.0 nos pontos de entrada que LLMs usam, fechando o gap "conteúdo entregue mas não chamado".

### Sem mudanças de API runtime

Patch v1.8.1 continua content-only. Zero alterações em `src/core/`, `registry.js`, `sync.js`. Stable API v1.0+ preservada.

### Tests

Todos os 4 gates blocking continuam passing após o patch. CI agora os roda explicitamente — Phase 28 deixou os specs prontos mas sem step de execução.

## [1.8.0] - 2026-05-06

Milestone v1.8 — Suíte Supabase: primeira coleção especializada de skills+agents+command focada em um stack concreto. 31 REQs em 4 fases (Phases 25-28).

### Adicionado — 11 skills Supabase canônicas (Phase 25)

Cada skill é auto-contida (sem `references/` folder), com frontmatter `description ≤ 200 chars`, template fixo de 5 seções (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Ver também), code blocks EN com comentários PT-BR pedagógicos, e cross-refs via Markdown link relativo.

- `supabase-realtime` — broadcast vs postgres_changes, `private: true` obrigatório, naming `scope:entity:id`, `realtime.broadcast_changes` triggers, `removeChannel` cleanup
- `supabase-auth-ssr` — Next.js v16 + `@supabase/ssr` (NUNCA `auth-helpers-nextjs`), padrão `getAll`/`setAll` exclusivo, middleware com `getUser()` + redirects, single serverClient factory
- `supabase-edge-functions` — Deno runtime, imports `npm:`/`jsr:` versionados, env vars pre-populadas, `Deno.serve`, `EdgeRuntime.waitUntil`, file writes apenas em `/tmp`, basePath `/<function-name>`
- `supabase-declarative-schema` — workflow `supabase/schemas/` → `supabase stop` → `db diff -f` → revisar → apply, com caveats sobre views, RLS, partitions
- `supabase-rls-policies` — REGRA #1 absoluta `(select auth.uid())` wrapper, WARNING `user_metadata` em autorização (privilege escalation), policies granulares por operação, `to authenticated`/`to anon` explícito, indexes obrigatórios, MFA via `aal2`
- `supabase-database-functions` — `SECURITY INVOKER` por default, `set search_path = ''` SEMPRE (lint advisor 0011), schema-qualified names, `IMMUTABLE`/`STABLE` quando aplicável
- `supabase-migrations` — naming `YYYYMMDDHHmmss_<name>.sql` UTC, header de metadados, RLS obrigatório em toda nova tabela, granular policies, comentários extensivos em comandos destrutivos
- `supabase-postgres-style` — lowercase reserved, `snake_case`, plurais para tabelas/singular para colunas, `ISO 8601`, CTEs lineares para queries complexas
- `supabase-storage` — buckets públicos vs privados, `signed URL` com expiration, RLS sobre `storage.objects` com multi-tenant path isolation, image transforms (Pro+), TUS para uploads > 6 MB, awareness de egress billing
- `supabase-pgvector-rag` — `create extension vector`, dim consistente por modelo, `HNSW` (default 2026) vs `IVFFlat`, operadores `<=>`/`<#>`/`<->`, RAG with permissions via RLS, chunking 200-500 tokens
- `supabase-cron-queues` — `pg_cron` + `pgmq` (Postgres 15.6.1.143+) + `pg_net` v0.10.0+, pattern canônico `cron → pgmq → Edge Function`, idempotência obrigatória em consumers

Plus glossário compartilhado em `kit/skills/_shared-supabase/glossary.md` — termos PT-BR↔EN, comandos CLI canônicos, patterns canônicos consolidados (não-skill, arquivo de referência).

### Adicionado — 7 agents Supabase + convenção universal (Phase 26)

Cada agent inclui tabela `## Compatibilidade` por IDE (Full / Partial / Offline-only), preflight detection MCP no Step 0 (declara MODO OFFLINE explícito se MCP indisponível — NUNCA finge sucesso), output em layout canônico do CLI Supabase (`supabase/migrations/`, `supabase/schemas/`, `supabase/functions/<name>/`), e frontmatter `tools:` com nomes canônicos `mcp__supabase__*` (zero UUIDs).

- `supabase-architect` (blue) — projeta schema + RLS + topologia realtime ANTES da implementação. Pergunta tier (Free/Pro/Team/Enterprise) upfront via `AskUserQuestion`. Alerta sobre Free pause + branch billing. NÃO escreve código.
- `supabase-migration-writer` (yellow) — escreve migrations seguindo declarative schema + RLS obrigatório + style guide. Detecta layout `schemas/` vs `migrations/` no boot. Aplica via `mcp__supabase__apply_migration` se MCP disponível; modo offline gera SQL.
- `supabase-rls-writer` (red) — gera 4 policies granulares por operação com `(select auth.uid())` wrapper + indexes recomendados. **ABORTA explicitamente** se input menciona `user_metadata` em policy de autorização.
- `supabase-edge-fn-writer` (cyan) — escreve Edge Functions Deno com `npm:`/`jsr:` versionados, `Deno.serve`, env vars pre-populadas, file writes em `/tmp`, basePath em multi-rota. Alerta cold start em bundles grandes.
- `supabase-realtime-implementer` (magenta) — configura 3 layers (RLS sobre `realtime.messages` + trigger DB via `realtime.broadcast_changes` + client subscribe com cleanup obrigatório). Migra `postgres_changes` para `broadcast`.
- `supabase-auth-bootstrapper` (green) — bootstrap Next.js v16 com `@supabase/ssr` (browser client + server client + middleware completo). **Audita `.env*` files** e ABORTA se detectar `NEXT_PUBLIC_*SERVICE*` (service_role leak).
- `supabase-storage-implementer` (orange) — configura bucket + RLS sobre `storage.objects` com multi-tenant path (`<auth.uid()>/<file>`) + client code (upload + signedURL). Suporta TUS para uploads grandes.

### Adicionado — Command `/supabase` orquestrador único (Phase 27)

`kit/commands/supabase.md` aceita 10 subcomandos com sinônimos PT-BR/EN: `arquiteto|architect`, `migration|migrar`, `rls`, `edge|edge-function|funcao`, `realtime|tempo-real`, `auth|autenticacao`, `storage|armazenamento`, `rag|pgvector|embeddings`, `cron|queues|pgmq|background`, `check|validar` (invoca `schema-checker` existente), `help|ajuda|?`.

Detecta `supabase/config.toml` para extrair `project_id`. Dispatch via `Task(subagent_type=supabase-...)`. **É o único ponto de chain de agents Supabase** — agents permanecem função pura (anti-pitfall A10).

### Adicionado — 5 audit gates novos (Phase 28)

Markdown specs em `gates/` com `## Check` em bash:

- `gates/budget-description.md` — valida `description ≤ 200 chars` em todo agent/command/skill (anti-pitfall A2 — CLAUDE.md inflation)
- `gates/no-personal-uuid.md` — detecta UUIDs `[0-9a-f]{8}-...` em frontmatter ou body de `kit/{agents,commands,skills}/` (anti-pitfall A12)
- `gates/agent-no-recursive-dispatch.md` — valida zero `Task(...subagent_type=...supabase-...)` em `kit/agents/supabase-*.md` (anti-pitfall A10)
- `gates/skill-must-include.md` — valida strings obrigatórias por skill verbatim — `(select auth.uid())`, `set search_path = ''`, `getAll`/`setAll`, `private: true`, `Deno.serve`, etc. (anti-pitfall A7)
- `gates/sync-idempotent.md` — valida que `kit sync claude-code` rodado 2× produz `.claude/` byte-idêntico (anti-pitfall A1, non-blocking warn)

### Mudado — schema-checker.md UUID migration

`kit/agents/schema-checker.md` migrado de `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql` (UUID do projeto pessoal do mantenedor) para `mcp__supabase__execute_sql`/`__list_tables`/`__apply_migration` (canônico). **Breaking interno:** instaladores de versões anteriores tinham um UUID que não funcionava para eles; com v1.8 funciona com qualquer Supabase MCP server configurado. Mesma funcionalidade — apenas referência canônica.

### Sem mudanças de API runtime

v1.8 é **content-only por design** — zero alterações em `src/core/`, `registry.js`, `sync.js`. Stable API v1.0+ totalmente preservada. CI passa sem mudança em `.github/workflows/`. Deps budget mantido em 6/6 (zero deps novas — todo o conteúdo é markdown).

### Tests

Tests existentes (115 unit + 67 integration de v1.7) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`).

### Decisões arquiteturais

Validadas em `.planning/research/`:
- **Naming flat** `kit/skills/supabase-*/SKILL.md` (não subárvore — quebraria `readSkillsDir`)
- **MCP-first com fallback offline gracioso** — 5 dos 8 IDE targets não têm Supabase MCP; agents funcionam offline gerando SQL/código
- **Cross-references via Markdown link relativo** (não `@-include` — quebraria lazy-load das skills)
- **Outputs em layouts canônicos do CLI Supabase** — `supabase/migrations/`, `supabase/schemas/`, `supabase/functions/<name>/`
- **Glossário compartilhado** em `_shared-supabase/` — não é skill (sem trigger), apenas referência cross-skill

### Detalhes

`.planning/milestones/v1.8.0/` (após `/concluir-marco`).

## [1.7.0] - 2026-05-06

Milestone v1.7 — perf+lean part 2 + UX naming canonical: 10 REQs em 3 fases.

### Performance

- **Workflow files compactados** (Phase 22) — `discuss-phase.md` 49→39 KB (-22%), `plan-phase.md` 36→31 KB (-15%), `new-project.md` 40→37 KB (-7%). Cuts em prosa redundante; specs core (questionamento, fluxo de fases, retornos estruturados) preservados.
- **`listKit({ stubsOnly: true })`** (Phase 23, PERF-S1) — sync em mode=reference (default) lê só os primeiros 4KB de cada arquivo (frontmatter), pulando body/content que stub renderers nunca usam. Cache key separado (`${kitRoot}:full` vs `${kitRoot}:stubs`). Benchmark local: 1.79× speedup em cold listKit.

### Tokens (boilerplate dedup)

- **Output style centralizado** (Phase 24, TOK-D1) — `kit/framework/references/output-style.md` é a única fonte; 18 agentes referenciam via `@./.claude/framework/references/output-style.md`. Economia: 19,110 bytes na árvore agents/ (-6%).

### UX (naming canonical)

- **`/fazer` é o entrypoint canônico** (Phase 24, UX-F1/F2/F3) — abre com tabela de decisão "intenção → comando". `/rapido`, `/expresso`, `/proximo` continuam funcionando direto, mas cada um tem nova seção "Quando usar" com trade-offs (✅/❌/🤔) e link de volta a `/fazer`. `/ajuda` (e `kit/framework/workflows/help.md`) destaca `/fazer` no topo.

### Sem mudanças de API runtime

Stable API v1.0+ preservada. `mode=copy` continua lendo content full. `mcp__kit__kit action=get` retorna content/absPath. Aliases de comando todos preservados.

### Tests

115 unit (+3 stubs-only) + 67 integration. Todos verdes.

## [1.6.1] - 2026-05-05

DX patch: comando `kit doctor` + upgrade-check no boot do sidecar + cache de gates.

### Adicionado

- **`kit doctor`** ([src/cli/index.js](src/cli/index.js), nova função `runDoctorChecks`) — comando único de diagnóstico que checa: versão local vs npm latest, sidecar reachability via lockfile + healthz, validade do `~/.claude/settings.json`, presença do hook PostToolUse `sidecar-tool-publisher`, dirs do kit bundled, integridade do `.planning/`, e lockfiles órfãos em tmpdir. Retorna checklist colorido com `fix:` específico em cada falha. Suporta `--json` (via flag global) pra consumo programático.
- **Upgrade-check no `kit ui start`** ([src/cli/index.js](src/cli/index.js), [src/cli/upgrade-check.js](src/cli/upgrade-check.js)) — verifica npm registry em background; se versão local atrás da latest, imprime banner amarelo "v1.6 → v1.6.1 disponível, atualize com npm i -g". Cache TTL 24h em `~/.kit-mcp/version-check.json` evita hit no registry em todo boot. Falha gracefully em modo offline.
- **Cache TTL em `listGates`** ([src/core/gates.js](src/core/gates.js)) — mesmo padrão de PERF-01 (`listKit`). Sequência `listGates → getGate → gatesForStage` num único processo agora faz 1 walk de disco em vez de 3.

### Sem mudanças de API

`mcp__kit__gates` action=list e action=get continuam funcionando com mesma assinatura. Doctor e upgrade-check são CLI-only.

### Testes

+10 unit (112 total): 8 cobrindo `compareVersions`/`getLocalVersion`/constantes do upgrade-check, 2 cobrindo cache hit/miss em gates.

## [1.6.0] - 2026-05-05

Milestone v1.6 — perf+lean: 16 itens de auditoria de codebase entregues em 3 fases (Phase 19 quick wins, Phase 20 hardening, Phase 21 token economy) + observability hook (Phase 19.5).

### Adicionado

- **Hook PostToolUse para sidecar** (`kit/hooks/sidecar-tool-publisher.js`). Publica `tool_invocation` events no sidecar a cada tool use do Claude Code. Source detection (claude-code/cursor/vscode/jetbrains) + pid para multi-IDE. UI ganha `.tl-source` pill com cor por IDE e `renderArgsSummary` com hint de file_path/command. Resolve "sidecar não viu o que Claude estava fazendo".
- **Sidecar `/state` aceita `?offset=N&limit=M`** para paginação (PERF-05). Comportamento default (ring inteiro) preservado.
- **`prepublishOnly` script** (INF-01) — `npm publish` agora roda unit + integration tests como preflight.
- **Node 24 no CI matrix** (INF-03) — 3 OS × 3 Node = 9 combos.
- **`npm audit --audit-level=high --omit=dev` no CI** (SEC-04) — falha em CVEs Alto+ na única dep runtime (open@11).
- **`.npmignore` explícito** (INF-02) — belt-and-braces alongside `package.json` files allowlist.

### Corrigido

- **listKit cache TTL 30s** (PERF-01) — repeated `mcp__kit__kit list-*` calls no longer re-walk 60+ files.
- **Frontmatter regex top-level** (PERF-02) — was recompiled 60x per listKit.
- **`opts.kit` em sync/reverse-sync** (PERF-03) — sequential sync+reverse-sync agora 1 walk em vez de 2.
- **healthz probe timeout 500ms** (PERF-04) — sidecar travado não bloqueia mais startup de novo sidecar.
- **TOCTOU re-probe em acquireLockOrReclaim** (SEC-01) — race entre releaseLock e retry-acquire fechado.
- **walkTree path traversal block** (SEC-02) — `isSafeRel()` rejeita `../`, abs, drive-prefixed em mode=copy.
- **redactPath case-insensitive + separator-agnostic** (SEC-03) — Windows paths com casing/slash variantes agora redatam.
- **deps-budget message dinâmico** (INF-04) — "Runtime deps: $CURRENT / $BUDGET" em vez de baseline obsoleta.

### Tokens

- **`planner.md` compactado de 53 KB → 35 KB** (TOK-01) — -34%, mantendo specs core (anatomia, checkpoints, TDD, frontmatter).
- **CLAUDE.md gerado por `kit sync` slim** (TOK-02) — descrições truncadas a 80 chars; 10.4 → 8.5 KB.
- **planner.md headers de 72 → 47** (TOK-03 parcial) — meta era ≤25; consolidação adicional risco de perder navegação.

### Sem mudanças de API runtime

Stable API v1.0+ preservada. `mcp__kit__kit action=get` ainda retorna content/absPath completos. Hook é opt-in via `~/.claude/settings.json`.

## [1.5.3] - 2026-05-05

Patch bundle de auditoria — 4 melhorias quick-win (1 segurança, 1 infra, 2 token-economy).

### Segurança

- **POST /shutdown agora valida Origin** ([src/ui/server.js](src/ui/server.js)). Antes, qualquer página local podia derrubar o sidecar via fetch cross-origin (CSRF local por DNS rebinding). Agora retorna 403 em Origin não permitido — alinha com o comportamento de POST /publish. Novo teste em [test/integration/ui-server.test.js](test/integration/ui-server.test.js) cobre o caso.

### Infraestrutura

- **Fix do extrator de release notes** ([.github/workflows/publish.yml](.github/workflows/publish.yml)). O awk regex `## [VERSION]` interpretava `[…]` como bracket class em vez de literal — todo release desde a v1.0.0 caía em fallback `Release vX.Y.Z.` em vez de pegar o body do CHANGELOG. Corrigido com `[[]VERSION[]]` (POSIX char-class trick para casar `[` e `]` literais). Validado localmente contra o CHANGELOG da v1.5.2.

### Economia de tokens

- **`mcp__kit__kit list-*` não retorna mais `absPath`** ([src/mcp-server/index.js](src/mcp-server/index.js), [src/cli/index.js](src/cli/index.js)). Caminhos absolutos do filesystem (especialmente em Windows com Long Paths) custam tokens em todo turn que liste agents/commands/skills sem trazer benefício para o consumidor IA. Para o caminho específico de um item, use `action=get`.
- **Tabela "Vago/Correto" do `planner.md` reduzida de 5 → 2 linhas** ([kit/agents/planner.md](kit/agents/planner.md)). Mantém a heurística de teste sem repetir 5 exemplos didáticos. Cada agente carregado paga menos.

### Sem mudanças de API runtime

`absPath` segue disponível via `mcp__kit__kit action=get`. Stable API v1.0+ preservada.

## [1.5.2] - 2026-05-05

Patch de lifecycle: sidecar não desliga mais sozinho por idle.

### Corrigido

- **Sidecar encerrava sozinho após 30min** mesmo com a aba aberta sem eventos. Default de `idleMs` mudou de `30 * 60 * 1000` (30min) para `0` (nunca encerra). Resolve "abro a sidecar pra acompanhar trabalho longo, saio almoçar, volto e tá morta". Quem quiser o comportamento antigo: `kit ui start --idle-ms 1800000`.

### Sem mudanças de API

Patch isolado em `src/ui/server.js`. Stable API v1.0+ preservada.

### Heads-up

Se você tem `@luanpdd/kit-mcp` instalado globalmente (`npm i -g`) e `kit ui start` está dando "unknown command 'ui'", a versão global está stale. Atualize com `npm i -g @luanpdd/kit-mcp@latest`.

## [1.5.1] - 2026-05-05

Patch da UI sidecar: auto-reconnect quando o server reinicia + bordas com respiro.

### Corrigido

- **UI fica presa em "desconectado" quando server volta.** O `EventSource` nativo às vezes estagna no estado `CONNECTING` mesmo depois do server voltar — usuário precisava recarregar a aba. Agora um poll do `/healthz` a cada 3s roda em paralelo: ao detectar 200, fecha o `EventSource` antigo, hidrata `/state`, e abre um novo. Funciona pra qualquer cenário (kill -9, `kit ui stop` + `kit ui start`, network blip, máquina suspended). Usuário **não precisa mais recarregar** — basta o server voltar.

- **Banner "Sidecar encerrou" persistia mesmo após reconnect.** Race entre o handler de shutdown e o poll de saúde podia deixar o banner visível mesmo com a conexão de volta. Agora `applyConnState("open")` sempre remove o banner — estado saudável significa que o aviso está stale.

- **Cropping nas bordas da timeline:** "há 22m" colado na borda esquerda e `runId`/tokens-chip cortados na direita. `.tl-row` ganhou `padding: var(--pad-tight) 12px`. `.tl-time` virou `padding-right: 8px`. `.tl-content` ganhou `padding-right: 4px` + `overflow: hidden`. Tokens-chip e tl-runid agora têm `flex-shrink: 0` explícito pra não encolher quando a mensagem ocupa muita largura.

### Sem mudanças de API

Patch puro de UI. `src/ui/static/index.html` e `test/integration/ui-static.test.js` apenas. Stable API v1.0+ preservada.

## [1.5.0] - 2026-05-05

UI sidecar — bug fixes visuais + tokens + histórico de sessão.

### Adicionado

- **Tokens chip** em cada row da timeline e card de active run quando o evento traz `payload.tokens` (também aceita `payload.usage.total_tokens` e `payload.cost.tokens` para compatibilidade com diferentes wrappers). Formato `1.2k` / `5.3k` / `1.5M`.
- **Soma cumulativa de tokens da sessão** no footer (`6.2k tokens nesta sessão`). Aparece só quando algum evento veio com tokens — quem não usa LLM continua vendo o footer enxuto.
- **Histórico desta sessão** — drawer flutuante (botão de relógio na toolbar). Persiste em `sessionStorage` (não cross-tab, não cross-session); cada run terminada vira uma row com status (✓/✗/·), título, timestamp, duração, tokens, contagem de eventos e runId truncado. Click expande pra mostrar até os 100 últimos eventos da run com %, label e tokens. Cap em 50 runs (mais antigos são descartados).
- **Footer mostra runs concluídas** total da sessão (`3 runs concluídas`).

### Corrigido

- **Mojibake (`�`) em payloads** — eventos publicados via shells com locale ruim podiam vazar U+FFFD. Helper `safeStr()` agora limpa esses bytes antes de qualquer renderização.
- **Rows vazias na timeline** — `milestone` event que vinha com `payload.label` mas sem `payload.name` rendia em branco. Cascata defensiva agora tenta `name → title → label → name → tipo humanizado` em todos os tipos. Garantia: nenhuma row sai sem texto.
- **Active card sem título** — antes mostrava `—` sozinho se `payload.tool` estava vazio. Helper `runTitle(run)` cascata `humanizeTool(tool) → lastTitle → lastLabel → lastName → "Processo"`.
- **Tool inline mostrava `—` em vez de fallback** — `escapeHtml(safeStr(run.tool) || "processo")` no rc-tool, `escapeHtml(safeStr(run.tool) || "")` no rc-foot.

### Removido

- **Painel "Cenário (mock)" do Tweaks** — apenas cenários reais agora; sem botões de demo.
- **Botão "▸ replay"** — dependia de mock.
- **Funções `scenarioSync` / `scenarioMulti` / `scenarioError` / `scenarioIdle` / `runScenario` / `mockTimers` / `later` / `clearMock`** — toda infraestrutura de mock event generator (~80 LOC). `EventSource('/events')` é a única fonte de verdade.
- **Fallback `file://` boot** — sidecar não é mais aberto via `file://`; só via servidor.

### Sem mudanças de API runtime

Mudanças concentradas em `src/ui/static/index.html`. `src/core/`, `src/cli/`, `src/mcp-server/`, `src/ui/server.js` intocados. Stable API v1.0+ preservada.

### Migration

Wrappers que quiserem expor cost/tokens podem agora popular `payload.tokens` (number) em qualquer evento. Quem não popula continua funcionando idêntico — chips não aparecem, footer não mostra a linha de tokens. Histórico é per-tab via `sessionStorage` — fechar a aba apaga (intencional, não persistir é a feature).

## [1.4.0] - 2026-05-05

Framework velocity — 7 melhorias para os comandos / agentes do kit, focadas em reduzir fricção, evitar conflitos com main, e auto-detectar configs que hoje exigem env var manual.

### Adicionado

- **`/publicar-rapido`** — variante leve de `/publicar` para hotfix / quick-task. Não exige ROADMAP arquivado, MILESTONE-AUDIT.md nem `STATE.md`. Infere `TIPO_MUDANCA` (`fix:`/`feat:`/`refactor:`/...) do prefix do commit, gera Notion enxuto + PR + nota Obsidian em ~30s. Pre-flight de sync com `main` herdado do `/publicar`. (REQ F-01) `kit/commands/publicar-rapido.md`, ~210 LOC.

- **Pre-flight `main` sync no `/publicar` (Passo 0)** — antes de criar PR, faz `git fetch origin main` e detecta commits novos. Se houver, apresenta a lista e pergunta via `AskUserQuestion`: integrar via rebase (recomendado), via merge, ignorar (com flag `SYNC_SKIPPED` registrada na descrição do PR), ou cancelar. Trava de segurança contra conflitos tardios em times com vários devs em paralelo. (REQ F-07)

- **Auto-detect `notion-config.json` (Passo 0.5)** — se o config está ausente, em vez de encerrar com erro, busca a página do projeto via `notion-search`, apresenta candidatos via `AskUserQuestion`, lista subpáginas via `notion-fetch`, e gera o config automaticamente. `/setup-notion` continua existindo para quando a estrutura Notion ainda não existe. (REQ F-02)

- **Auto-detect cofre Obsidian (Passo 0.7)** — se `$OBSIDIAN_TEAM_VAULT` está ausente, tenta caminhos canônicos antes de pular o passo: `~/Documentos/Obsidian/chat-trynux`, `~/Documents/Obsidian/chat-trynux`, variantes `$USERPROFILE` (Windows), `/mnt/c/Users/$USER/...` (WSL). Funciona out-of-the-box em qualquer máquina (Linux/macOS/Windows/WSL) que siga o layout padrão `Documentos/Obsidian/chat-trynux`. (REQ F-03)

- **`schema-checker` agent** — sub-agente novo invocável via `Task(subagent_type="schema-checker")`. Lê uma migration SQL, extrai FKs / JOINs / refs implícitas, consulta o schema real em produção via Supabase MCP (`information_schema` + `pg_constraint`), cruza, e devolve veredito GO / NO-GO / NEEDS-REVIEW com diff por referência. Pega o caso clássico do "comentário do dev errado" (`contact_id → conversations.id` em comentário, mas em prod aponta para `contacts.id`) ANTES de aplicar a migration e ver falhar silenciosamente. (REQ F-04) `kit/agents/schema-checker.md`, ~160 LOC.

- **Hook `post-apply-migration` (PostToolUse)** — dispara automaticamente depois de qualquer `apply_migration` bem-sucedido via Supabase MCP e faz os 3 passos manuais que devs sempre esquecem: (a) escreve a SQL em `supabase/migrations/{TIMESTAMP}_{name}.sql`, (b) cria stub no cofre Obsidian em `07 - Banco de Dados/Migrations/{YYYY}/{TIMESTAMP}_{name}.md` (se vault detectado), (c) `git add` no projeto. Soft-fails — nunca bloqueia o tool call. (REQ F-05) `kit/hooks/post-apply-migration.js`, ~190 LOC.

### Alterado

- **Heurística de gatilho do `/publicar`** — documentada explicitamente: "publicar" depois de aplicar mudança = pipeline completo, NÃO apenas push. Para push isolado em outra branch sem cerimônia, dev precisa pedir explicitamente "só fazer push" OU usar `/publicar-rapido`. (REQ F-06)

### Sem mudanças de API runtime

Todas as adições são em `kit/` (templates de prompt distribuídos). `src/core/`, `src/cli/`, `src/mcp-server/`, e `src/ui/` permanecem intocados. Stable API v1.0+ preservada literalmente.

### Migration

Usuários da v1.3 não precisam fazer nada — re-rodar `kit sync install <ide>` no projeto puxa as adições. Quem usa `/publicar` em produção colhe os 3 passos novos automaticamente (pre-flight sync, auto-detect notion-config, auto-detect Obsidian) sem mudar workflow.

## [1.3.0] - 2026-05-05

UI redesign completo entregue por handoff do Claude Design (claude.ai/design). Layout repensado, paleta OKLCH, painel de tweaks (acento/densidade/movimento) acessível, timeline com rail + nó por evento, hero card de active runs com borda cônica animada e barra com gradient + shimmer, empty state com heartbeat bars, e cenários de demo (`Sync` / `Multi` / `Erro` / `Idle`) mockáveis pelo painel de tweaks.

### Adicionado — design

- **Tokens OKLCH** com hue do acento configurável (padrão `130` — lima/verde). Trocas em runtime via tweaks panel: 6 swatches (lima, azul, roxo, laranja, magenta, ciano).
- **Tema dark é puro `#000` no fundo**, com surfaces escalonados (`#0b0d10`, `#11141a`, `#171b22`). Light mode preservado via `prefers-color-scheme` (não é o default).
- **Layout shell** centralizado em 980px. Header (logo + brand + conn pill), toolbar (search com atalho `/`, filter popover, pause, tweaks), main (active region + timeline + empty), footer (counts + last-seen).
- **Hero card de active run**: ícone do tool family (sync/reverse/gates), título humanizado, tool id em mono cinza, elapsed badge à direita (vira `--warn` após 30s), barra com gradient OKLCH + shimmer linear infinito, caption do passo atual em pill com glyph spinning, run id chip em mono. Borda cônica animada (`@property --ang`) anuncia "rodando".
- **Multi-run stacking**: quando há 2+ runs simultâneos, `active-region[data-count]` reduz padding/font-size dos cards pra caber sem rolagem.
- **Timeline com rail**: coluna de tempo relativo (`agora`, `há 5s`, `há 2m`), rail vertical pontilhado conectando os nós, nó colorido por tipo (verde pra `run.start`, vermelho pra `error`, etc). Eventos do mesmo `runId` consecutivos viram `data-grouped="true"` (visualmente sub-eventos).
- **Empty state com `empty-viz`**: 13 barras animadas em onda heartbeat enquanto aguarda o primeiro evento.
- **Tweaks panel** flutuante (canto inferior direito, dialog acessível): paleta de acento, densidade (compacta / normal / confortável), movimento (sutil / médio / rico), e cenário mock (sync/multi/error/idle) pra demos.

### Adicionado — produção

- **Conexão real via `EventSource('/events')`** com retry nativo + `visibilitychange` que força `hydrate + reconnect` quando o tab volta a ser visível.
- **Hydrate inicial via `GET /state`** ANTES do connect, replayando o ring buffer pelo mesmo `ingest()` (dedup por `ts|type|runId`).
- **Shutdown banner** acima do main quando o servidor envia evento `shutdown`. Conn pill vai pra estado `off` com label `encerrado`.
- **Estados de conexão** humanizados no pill: `conectado` (verde, pulsa), `conectando`, `desconectado`, `pausado`, `encerrado`.
- **Mock scenarios preservados** via tweaks (mas não rodam mais em loop ao boot — `EventSource` é a fonte real). Útil pra demo offline e pra testar visualmente cada estado sem precisar disparar workflow real.

### Corrigido

- **Filter pop incluía só 5 tipos por default** — agora `tool_invocation` e `shutdown` aparecem na lista de eventos por default (sem chip de filtro, mas visíveis); evita esconder eventos importantes do servidor.

### Removido

- Helpers `pausedBuffer`/`flushPaused` da v1.2.x — o design optou por **descartar eventos durante pause** em vez de bufferizar (evita explosão de memória se user esquece pausado). Trade-off documentado.
- Botão "rolagem auto" — timeline rola naturalmente conforme novos eventos entram; sem toggle.
- Botão "limpar tela" — `clearAll()` continua disponível pelos tweaks (botão `limpar` no painel).

### Stable API ainda preservada

Todas as mudanças são apenas em `src/ui/static/index.html`. Nada em `src/core/`, `src/cli/`, `src/mcp-server/`, ou em qualquer schema MCP/CLI. Servidor (`src/ui/server.js`) intocado — endpoints `/`, `/events`, `/state`, `/healthz`, `/publish`, `/shutdown` mesmos.

Bump pra **minor** (não patch) porque a UI é experiência radicalmente diferente — usuários verão a mudança visual imediatamente.

## [1.2.3] - 2026-05-04

UI inteira agora fala português e usa termos que fazem sentido pra quem não conhece o código por dentro. Os tipos de evento técnicos viraram nomes legíveis, os caminhos absolutos viraram descrições do tipo "agente planner" / "comando novo-marco" / "skill limpeza", e o status badge da conexão agora lê "CONECTADO/CONECTANDO/DESCONECTADO".

### Adicionado — humanização de labels

- `EVENT_TYPE_LABEL` mapeia `run.start → Iniciado`, `run.end → Finalizado`, `progress → Em andamento`, `tool_invocation → Comando`, `milestone → Marco`, `error → Erro`, `shutdown → Desligado`. O `data-type` raw continua na markup (CSS de cor + filtros funcionam igual), apenas o texto exibido muda.
- `TOOL_LABEL` mapeia ids técnicos pra descrições amigáveis: `sync.install → Sincronizando kit`, `reverse-sync.apply → Importando edições do IDE`, `gates.run → Executando gate`, `sync.watch → Vigiando kit (watch)`, `sidecar → Servidor sidecar`.
- `STATUS_LABEL` traduz `running → em execução`, `done → concluído`, `error → erro`. Usado nos badges dos cards de active runs e no label de fade-out.
- `CONN_LABEL` traduz `CONNECTING → CONECTANDO`, `OPEN → CONECTADO`, `CLOSED → DESCONECTADO`.
- `humanizePath()` reconhece padrões comuns e devolve descrições amigáveis:
  - `.claude/agents/planner.md` → `agente planner`
  - `kit/commands/novo-marco.md` → `comando novo-marco`
  - `kit/skills/limpeza/SKILL.md` → `skill limpeza`
  - `.claude/framework/...` → `framework`
  - `CLAUDE.md` → `manifesto CLAUDE.md`
- `humanizeLabel()` reconhece o padrão "verbo + caminho" comum em payloads de progresso e traduz: `writing .claude/agents/planner.md` → `criando agente planner`, `merging kit/commands/foo.md` → `mesclando comando foo`. Verbos suportados: reading, writing, projecting, merging, copying, deleting, creating, updating, syncing, applying, fetching.

### Adicionado — copy PT-BR

Toda a interface está em português:
- Placeholder do search: `filtrar por nome ou conteúdo…`
- Botões: `⏸ pausar` / `▶ retomar`, `↧ rolagem auto`, `limpar tela`
- Header active runs: `Em execução agora`
- Footer: `eventos: N`, `pausado: N em fila`, `fonte: ao vivo`
- Header port: `porta NNNN`
- Estados de timing: `há 2m 15s` (substitui `started 2m 15s`)
- Status do card: `em execução` / `concluído` / `erro`
- Fim de run: `concluído com sucesso` / `falhou` (em vez de `done` / `failed`)
- Início de run: `iniciando…` (em vez de `starting…`)

### Por que

A v1.2.2 tinha layout bonito mas linguagem técnica — `RUN.START`, `writing .claude/agents/example-reviewer.md`, `RUNNING`. Pra quem usa o sidecar pra primeira vez ou não conhece a arquitetura interna do kit, esses labels eram opacos. Agora o painel diz "Sincronizando kit · em execução · criando agente example-reviewer · 34/100 · 12s" em vez de jogar paths absolutos e enums no usuário.

### Sem mudanças de API

Pure UI patch, ainda. Stable API v1.0+ preservada. Sem deps novas. `data-type` no DOM continua raw (filtros e CSS não quebram). Apenas `src/ui/static/index.html` mudou.

## [1.2.2] - 2026-05-04

UX upgrade da sidecar: o feed cronológico continua, mas agora a janela mostra TAMBÉM um painel "Active runs" no topo com cards visuais pra cada execução em andamento — barra de progresso animada, percentual grande, label do passo atual, runId truncado e tempo decorrido tickando ao vivo.

### Adicionado

- **Active runs panel** em `src/ui/static/index.html` — uma `<section id="active-runs">` antes do log de eventos. Para cada `runId` ativo, renderiza um card com:
  - Nome do tool (de `payload.tool` no `run.start`) com badge de status (running/done/error)
  - Percentual grande (22px tabular-nums) à direita
  - Barra de progresso 8px com transição suave + shimmer animado em estado `running`
  - Label do passo atual (último `payload.label` ou `current/total` derivado)
  - Footer com tempo decorrido (tick a cada 1s) + runId truncado + current/total
- Estado consolidado via `Map<runId, ActiveRun>`, atualizado por `run.start` (cria), `progress` (incrementa), `tool_invocation` (refina título), `run.end` (marca done, fade-out em 4s), `error` (marca erro, fade-out em 8s).
- Cards são **atualizados in-place** via `dataset.runid` matching — preserva a transição CSS da barra em vez de recriar o DOM a cada update.
- Painel some quando 0 runs ativos; aparece automaticamente quando o primeiro `run.start` chega.

### Por que

A v1.2.0 mostrava progresso, mas misturado no feed cronológico — pra saber "tô em quanto" você precisava scanar o último `progress`. O painel novo mostra o estado atual sem rolagem, com afordância visual: barra cresce, percentual sobe, shimmer anda. Quando termina, o card vira verde e some 4s depois (vermelho 8s pra erro). Pareceu "log do servidor", agora parece "process viewer".

### Sem mudanças de API

Pure UI patch. Stable API v1.0+ preservada. Sem deps novas. Apenas `src/ui/static/index.html` (~120 LOC adicionados — CSS dos cards + lógica do `upsertActiveRun` + tick interval).

## [1.2.1] - 2026-05-04

Cosmetic + UX patches descobertos durante o smoke da v1.2.0. Sem mudanças de comportamento de API.

### Corrigido

- **`eventLabel()` agora lê `payload.name`.** Eventos `milestone` que usavam `payload.name` (sem `label`) renderizavam como texto cru "milestone" em vez do nome real. Adicionado fallback `name` na cadeia de helpers no `src/ui/static/index.html`.
- **SSE reconecta quando o tab volta a ficar visível.** Chrome (e outros browsers Chromium) throttla timers em background tabs, podendo suspender o retry interno do `EventSource` e deixar a conexão presa em `CLOSED` mesmo depois do `kit ui` voltar. Adicionado listener `visibilitychange` que faz `hydrateFromState() → connect()` quando o tab volta a `visible` e o status atual é `CLOSED`. Re-hidrata o ring buffer pra mostrar eventos que chegaram durante o gap.

### Sem mudanças de API

`v1.2.0 → v1.2.1` é puro patch:
- Stable API v1.0+ preservada
- Sem deps novas (deps em 6/6)
- Sem mudança em `src/core/`, `src/cli/`, `src/mcp-server/`, ou em qualquer schema MCP/CLI
- Apenas `src/ui/static/index.html` recebeu ~10 LOC

## [1.2.0] - 2026-05-04

**GUI sidecar de acompanhamento.** Janela web localhost paralela mostra ao vivo (via Server-Sent Events) o que kit-mcp está fazendo enquanto sua IDE chama tools — `sync install`, `reverse-sync apply`, `gates run`. Sidecar é totalmente opt-in: quem não invoca `kit ui` continua com a experiência v1.1 idêntica.

### Adicionado — Phase 11: Lock arquitetural
- ADR consolidado em `.planning/decisions.md` (porta 7100-7199, lockfile em `os.tmpdir()` keyed por sha1(projectRoot), idle 30min default, sem auth no v1.2 com mitigação compensatória)
- Threat model em `docs/sidecar-security.md`
- 2 audit gates novos no CI: stdout discipline em `src/ui/` (proíbe `console.log`/`process.stdout.write`) e dep budget (≤ baseline+1)

### Adicionado — Phase 12: Fundações
- `src/ui/events.js` — schema de evento, validador puro, `makeEvent`, `newRunId`
- `src/ui/port.js` — `findFreePort` na faixa 7100-7199 com retry-loop
- `src/ui/lockfile.js` — `acquireLock` atômico via `O_EXCL`, `probeStale` via `process.kill(pid, 0)` + healthz HTTP

### Adicionado — Phase 13: Servidor HTTP + SSE
- `src/ui/server.js` — http.Server nativo, bind 127.0.0.1 literal, 5 rotas (`/`, `/events` SSE, `/healthz`, `/state`, `/publish`, `/shutdown`)
- Heartbeat `: ping\n\n` cada 15s; reconnect auto via EventSource native + `retry: 3000`
- Ring buffer in-memory de 200 eventos (FIFO; sem persistência em disco)
- Cap de 32 conexões SSE; cleanup quádruplo (req+res × close+error)
- Idle shutdown 30min default (`--idle-ms 0` desabilita)
- Encerramento gracioso em SIGINT/SIGTERM com active sockets destruídos
- Validação de `Host` header (mitiga DNS rebinding) e `Origin` em endpoints non-GET
- `bin/ui.js` entry detached

### Adicionado — Phase 14: UI estática single-file
- `src/ui/static/index.html` (~470 LOC) — vanilla DOM + EventSource, sem build step
- Lista cronológica + auto-scroll + `<details>` expand
- Badges coloridos por tipo (`run.start`, `run.end`, `tool_invocation`, `progress`, `milestone`, `error`, `shutdown`)
- Status conexão (CONNECTING/OPEN/CLOSED) + reconexão automática
- Filter por tipo (chips) + substring search
- Pause/resume com buffer + autoscroll toggle
- Dark mode automático via `prefers-color-scheme`
- Banner de shutdown PT-BR em CLOSED >5s ou evento `shutdown`
- CSP estrito (`default-src 'self'; ...; frame-ancestors 'none'`)

### Adicionado — Phase 15: Publisher + wrapper + browser-open
- `src/ui/client.js` — `publish(event, {projectRoot})` fire-and-forget, cache TTL 5s, falha silenciosa em ECONNREFUSED
- `src/ui/wrapper.js` — `wrapProgressForUi(onProgress, ctx)` multiplexa terminal + sidecar; helpers `.done/.error/.emit`; `redactPath` central scrubando `$HOME → ~` e `projectRoot → <project>` em TODO payload
- `src/ui/browser.js` — wrapper sobre `open@11` com detection de headless (CI, DISPLAY, SSH, WSL, sandbox); fallback "imprime URL no stderr"
- Nova dep: `open@^11.0.0` (única adição; budget atingido em 6/6)

### Adicionado — Phase 16: CLI integration
- `kit ui start` — sobe sidecar foreground (Ctrl+C mata); flags `--port`, `--idle-ms`, `--no-open`
- `kit ui stop` — POST /shutdown
- `kit ui status` — exibe pid, port, uptime, eventos, subscribers
- `kit ui open` — reabre browser na sidecar atual
- Auto-detect: `kit sync install` e `kit reverse-sync apply` checam lockfile e wrappam `onProgress` automaticamente quando sidecar está rodando
- Opt-out global via `--no-ui` flag ou `KIT_MCP_NO_UI=1` env var

### Adicionado — Phase 17: MCP --auto-spawn
- `src/ui/auto-spawn.js` — `ensureSidecar({projectRoot})` checa lockfile + healthz; se ausente, spawna `bin/ui.js` em **detached** com `windowsHide: true` e `stdio: ['ignore', 'ignore', 'inherit']` (fecha stdout completamente — não pode poluir canal MCP do parent)
- 3 tools MCP ganham campo opcional `autoSpawn: boolean` no inputSchema:
  - `sync` (action=install)
  - `reverse-sync` (action=apply)
  - `gates` (nova action `run`, com autoSpawn)
- Tools triviais (`kit`, `forensics`, `install`) **não** ganham autoSpawn — explicit-out por design

### Adicionado — Phase 18: Hardening + release
- 3 hardening tests novos: kill -9 recovery, multi-publisher race, MCP stdio uncorrupted (validação rigorosa do REQ SEC-04 em produção)
- README seção "Live UI" com primeiros passos
- `npm pack --dry-run` valida que `src/ui/static/index.html` é incluído no tarball

### Corrigido
- **REL-01 (bug pré-existente):** `kit --version` agora lê de `package.json` em vez de retornar string hardcoded `1.0.0`. Em v1.0/v1.1 o comando exibia versão errada — corrigido nesta release.

### Stable API additions (1.x compatible)

A v1.0 commitment continua válida. Estas adições são parte do contrato:

- **MCP tool `sync` inputSchema:** campo opcional `autoSpawn: boolean` em action=install. Tools que não passam mantêm comportamento idêntico.
- **MCP tool `reverse-sync` inputSchema:** campo opcional `autoSpawn: boolean` em action=apply.
- **MCP tool `gates` inputSchema:** campo opcional `autoSpawn: boolean` E nova action `run` com `id`/`projectRoot`/`autoSpawn` campos.
- **CLI subgroup `kit ui`:** novo grupo com `start | stop | status | open` subcommands.
- **CLI flag `--no-ui` global** + env var `KIT_MCP_NO_UI=1` — opt-out do auto-detect de sidecar.
- **Stable runtime guarantee:** core (`syncTo`, `applyReverse`, `runGate`) é literalmente intocado. Wrapper de `onProgress` é montado APENAS no callsite (CLI handler ou MCP tool handler).

### Migration

**Usuários v1.1 não precisam fazer nada.** Sidecar é estritamente opt-in.

Para experimentar a UI:
```bash
# 1. Em um terminal:
kit ui start

# 2. Em outro (ou via Claude Code/Cursor):
kit sync install claude-code

# A janela mostra o progresso em tempo real.
```

Para tools MCP, passe `autoSpawn: true` quando quiser auto-abrir:
```jsonc
{ "tool": "sync", "arguments": { "action": "install", "target": "claude-code", "autoSpawn": true } }
```

### Threat model resumido

Sidecar é **localhost only**, single-user, dev workstation. Sem auth (mitigado por bind 127.0.0.1 + Host/Origin check + CSP estrito + path scrubbing). Sem persistência. Sem TLS (loopback). Detalhes em [`docs/sidecar-security.md`](docs/sidecar-security.md).

## [1.1.0] - 2026-05-03

**Visual feedback in the terminal.** Running `kit ...` now prints colored tables, progress bars, summary panels and interactive selectors instead of the raw JSON-to-stdout default of v1.0. Programmatic consumers add `--json` to restore the previous behavior.

### Added — Phase 6: UI primitives
- `src/core/ui.js` — single module exposing `c` (color helpers), `icons`, `spinner`, `progress`, `select`, `confirm`, `summary`. Respects `NO_COLOR`, `FORCE_COLOR`, `process.stdout.isTTY`. Animations write to stderr so stdout stays clean for `--json` piping.
- Deps: `picocolors` (~3KB, zero subdeps) and `@inquirer/prompts` (modular — only `select`+`confirm` imported).

### Added — Phase 7: `--json` flag, default human
- `--json` global flag preserves v1.0's JSON-to-stdout behavior for programmatic consumers.
- Without `--json`: every subcommand renders a human-readable table or summary panel via `src/cli/render.js`.
- `kit get` is unchanged (still raw, cat-like).

### Added — Phase 8: Progress + spinner
- `syncTo` and `applyReverse` accept an `opts.onProgress({ phase, current, total, label })` callback. Default no-op preserves backward compat.
- CLI wraps long ops in `withProgress(label, total, fn)` and short ops in `withSpinner(text, fn)`. TTY animates; pipes/CI emit linear status text (`10%, 20%, ...`).

### Added — Phase 9: Interactive selectors + diff confirm
- `install write [target]` and `sync install [target]` — when target argument is omitted in TTY mode, opens a select prompt listing all 8 IDEs with labels.
- `install write` always previews the JSON/TOML to be written and asks `Apply these changes? (y/N)` before applying. `--yes` or `--json` bypasses the prompt for CI/programmatic use.
- In non-TTY mode without target: exits with a helpful message ("pass the value as a flag instead").

### Stable API additions (1.x compatible)

The 1.0 commitment is unchanged. These additions become part of the contract:

- **`--json` global flag.** Behavior locked: JSON-to-stdout, no ANSI codes, no progress on stderr, prompts replaced by descriptive errors.
- **`onProgress` callback signature** on `syncTo` and `applyReverse`: `({ phase, current, total, label }) => void`. Adding optional fields is non-breaking.
- **Interactive selectors fall back to errors in non-TTY**, not to defaults — programs MUST pass the target as argument or use `--json`.

### Migration

Programs and scripts that piped `kit ... | jq` need to add `--json` explicitly:
```bash
# Before (v1.0):
kit list-agents | jq '.[].name'

# After (v1.1):
kit list-agents --json | jq '.[].name'
```

Interactive shell users get the new visual output automatically — no flags needed.

### Tests
- `test/unit/ui.test.js` — 6 new tests covering `summary` rendering, `NO_COLOR` honored, icons set.
- `test/integration/cli-roundtrip.test.js` — 4 new tests covering `--json` opt-in, default human output, selector fallback in non-TTY for `install write` / `sync install`.
- Total: 49 unit + 9 integration = **58 tests** in ~4s. CI verde 6/6 (Ubuntu/macOS/Windows × Node 20/22).

## [1.0.0] - 2026-05-03

**First stable release.** kit-mcp now commits to backwards compatibility on the surfaces listed under "Stable API" below; breaking changes there require a 2.0.0 bump.

### Added — Phase 1: Tooling debt
- `.github/dependabot.yml` — weekly grouped npm + github-actions updates.
- GitHub Release object created for v0.5.0 (was stuck on v0.2.0 "cleanup" as Latest).
- `.github/workflows/publish.yml` now creates a GitHub Release object automatically on every `v*` tag push, with notes extracted from this CHANGELOG. Closes the gap permanently.

### Fixed — Phase 2: Slash-command parser
- `src/core/sync.js` — `renderReference` reorders the stub body so the first non-blank line is the H1 + description blockquote, not the `<!-- kit-mcp:reference -->` marker. Strict downstream parsers (notably Claude Desktop's skill listing) now surface the real description.
- `src/core/kit.js` — `firstNonEmptyLine` skips lines starting with `<!--` as a defensive fallback when the canonical has no frontmatter description.
- `kit/commands/*` — 8 commands (`adicionar-backlog`, `adicionar-fase`, `adicionar-tarefa`, `concluir-marco`, `definir-perfil`, `depurar`, `fio`, `inserir-fase`) had unquoted angle-bracket `argument-hint` values that strict YAML parsers misinterpreted as flow-style flags. Now consistently quoted.

### Added — Phase 3: Reverse-sync for mirror-tree caps
- `detectReverse` now walks `.claude/framework/` and `.claude/hooks/` and reports any byte-for-byte difference vs `kit/<source>/<rel>`. The `.kit-mcp-managed` marker is automatically excluded from candidates.
- `applyReverse` adds `applyMirrorTreeOne` for `framework`/`hooks` candidates: `skip`, `overwrite`, `merge` (degenerates to overwrite — no frontmatter to preserve), `rename` (writes to `kit/<source>/<rel>.from-<tag>.<ext>` preserving the original).
- `--only framework/<rel>` / `--only hooks/<file>` filters narrow apply to one file.
- README "kit reverse-sync" section updated with the new examples.

### Added — Phase 4: Test infrastructure
- `node:test`-based runner — zero dependencies. `test/run.mjs` walks for `*.test.js` files (works on Node 20+ where `--test` glob support is partial).
- 37 unit tests across `kit`, `sync`, `reverse-sync`, `gates`, `gate-runner`, `registry`.
- 5 integration tests spawning `bin/cli.js` end-to-end (incl. MCP server boot smoke).
- `test/fixtures/sample-kit/` minimal fixture (1 of each kind + framework template + hook + frontmatter-less command for fallback test).
- CI runs `npm test` + `npm run test:integration` before existing smoke + MCP boot, on Ubuntu / macOS / Windows × Node 20 / 22 (6/6 combinations).
- `package.json` scripts: `test`, `test:integration`, `test:all`.

### Stable API (commitments locked at 1.0.0)

The following surfaces are covered by SemVer — breaking changes require a 2.0.0 release:

- **`src/core/registry.js` TARGETS table format.** Adding capabilities, IDEs, or new modes is non-breaking. Renaming or removing existing capability keys (`rules`, `agents`, `commands`, `skills`, `framework`, `hooks`, `mcpConfig`) is breaking.
- **MCP tool action signatures.** Tool names (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`) and their action-dispatch contracts are stable. New actions are non-breaking; renaming or removing existing actions is breaking.
- **CLI subcommand surface.** Top-level commands (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`) and their action sub-commands are stable. New flags are non-breaking; renaming or removing existing ones is breaking.
- **`src/core/*.js` named exports.** Functions consumed programmatically (`listKit`, `searchKit`, `findItem`, `resolveKitRoot`, `BUNDLED_KIT_ROOT`, `syncTo`, `statusOf`, `removeFrom`, `detectReverse`, `applyReverse`, `listGates`, `getGate`, `gatesForStage`, `runGate`, `listTargets`, `getTarget`, `TARGETS`) keep their signatures. Adding new exports is non-breaking; signature changes are breaking.
- **Stub format.** Files written by sync `--mode reference` keep the `<!-- kit-mcp:reference -->` marker somewhere in the body so `sync remove` and `reverse-sync detect` continue to identify them. Position within the body may change; presence is the contract.
- **`.kit-mcp-managed` marker semantics.** Mirror-tree directories (`framework/`, `hooks/`) are managed only when the marker is present at the root. Without it, `sync remove` never deletes the tree.

### Migration

No code changes required for users on 0.5.0 — `npm install @luanpdd/kit-mcp@latest` brings in 1.0.0 with the same behavior plus the parser fixes, reverse-sync expansions, and test coverage.

If you were on 0.4.0 (deprecated) or earlier, upgrade to skip the import-time crash and missing-framework regression entirely.

## [0.5.0] - 2026-05-03

### Added
- **Mirror-tree sync for `framework` and `hooks`.** `kit/framework/` (124 files: workflows, templates, references, libs) and `kit/hooks/` (5 files) are now projected into `.claude/framework/` and `.claude/hooks/` on every `sync install claude-code`. Without this, the bundled slash-commands like `/novo-marco` were broken-by-design — they referenced `@./.claude/framework/workflows/new-milestone.md` and similar paths that never existed in the destination project. Now they resolve correctly end-to-end.
- New `mode: 'mirror-tree'` capability spec in `src/core/registry.js`. Each mirror-tree entry has a `source` (relative path inside `kit/`) and a `path` (destination path in the target project).
- A `.kit-mcp-managed` marker file is written at the root of each managed tree so `kit sync remove` can recursively clean up the directory **only** when the marker is present. Trees you authored yourself (without the marker) are never touched.
- CI smoke test asserts `.claude/framework/workflows/new-milestone.md`, `.claude/framework/templates/project.md`, and `.claude/hooks/workflow-guard.js` are projected, and that `sync remove` cleans them up.
- New CI safety test: `sync remove` against a `.claude/framework/` directory with no marker preserves user content.

### Changed
- `statusOf` now reports `framework` and `hooks` capability paths.
- README capability matrix gained two columns (`framework`, `hooks`) and a paragraph explaining the mirror-tree semantics.

### Migration
No action needed — `npx -y @luanpdd/kit-mcp@latest sync install claude-code --project-root .` projects the new directories automatically. If you had a manually-created `.claude/framework/` or `.claude/hooks/`, kit-mcp will overwrite individual files but won't delete user files; `sync remove` continues to leave them alone.

## [0.4.1] - 2026-05-03

### Fixed
- `src/mcp-server/index.js` was importing `DEFAULT_KIT_ROOT` from `core/kit.js`, but that export was renamed to `BUNDLED_KIT_ROOT` / `resolveKitRoot` during the v0.2.0 refactor. The unused import wasn't caught by CI (which only smoke-tests CLI commands, not MCP server boot) and made the server crash on `npx -y @luanpdd/kit-mcp` for any sync/install command. Removed the dead import — server now boots cleanly.

### Tests (suggestion)
- CI should boot `node bin/mcp.js` and validate exit. Tracked in roadmap.

## [0.4.0] - 2026-05-03

### Changed
- README rewritten: bundled workflow framed as the default install path; `--kit-root` framed as the escape hatch for users who want to replace it entirely.
- "What ships in the box" lists actual bundled folders (19 agents, 60 commands, framework, hooks) instead of "example kit".
- Quick start reordered: use bundled as-is first, replace with own kit second.
- CLI examples updated with real counts.

This release is content-equivalent to 0.3.0 plus the documentation overhaul. No code changes versus 0.3.0.

## [0.3.0] - 2026-05-03

**Reverts the v0.2.0 cleanup.** kit-mcp goes back to shipping an opinionated, embedded workflow — installing `@luanpdd/kit-mcp` once again gives you the maintainer's brownfield planning workflow (PT-BR) ready to use. The "generic infrastructure, bring your own kit" framing of v0.2.0 was based on the wrong premise: the bundled content **is** the maintainer's workflow, intentionally distributed for anyone to inherit. The `--kit-root` / `KIT_MCP_KIT_ROOT` escape hatch from v0.2.0 stays — point it at your own folder if you want to replace the bundled workflow entirely.

### Restored
- 19 agents — planner, executor, verifier, debugger, codebase-mapper, ui-auditor, ui-checker, ui-researcher, advisor-researcher, assumptions-analyzer, integration-checker, nyquist-auditor, phase-researcher, plan-checker, project-researcher, research-synthesizer, roadmapper, user-profiler (plus the example-reviewer kept from 0.2.0).
- 60 slash-commands in PT-BR — milestone lifecycle (`/novo-marco`, `/concluir-marco`, `/auditar-marco`, `/planejar-lacunas`, `/resumo-marco`), phase lifecycle (`/discutir-fase`, `/planejar-fase`, `/executar-fase`, `/validar-fase`, `/verificar-trabalho`, `/adicionar-fase`, `/inserir-fase`, `/remover-fase`), task & idea capture (`/adicionar-tarefa`, `/nota`, `/plantar-ideia`, `/adicionar-backlog`, `/revisar-backlog`), workflows (`/autonomo`, `/expresso`, `/rapido`, `/fazer`, `/proximo`, `/fluxos-trabalho`), debugging (`/depurar`, `/forense`), publishing (`/publicar`, `/setup-notion`, `/branch-pr`), and more.
- `kit/framework/` — workflows + templates + bin libs the agents and commands delegate into.
- `kit/hooks/` — workflow guards, prompt guards, statusline.
- `kit/COMANDOS.md`, `kit/file-manifest.json`, `kit/settings.json`.

### Not restored (intentionally)
- The 13 skills from the Anthropic Cowork ecosystem (paperclip, design-guide, company-creator, paperclip-create-agent, paperclip-create-plugin, release, release-changelog, prcheckloop, pr-report, doc-maintenance, deal-with-security-advisory, create-agent-adapter, para-memory-files). These belong to Anthropic, not to this package — install them separately if you want them.

### Changed
- `kit/commands/setup-notion.md` — hardcoded Notion page ID and "Trynux" workspace name replaced with placeholder `{NOTION_PARENT_PAGE_ID}` configurable via env var `KIT_NOTION_PARENT_PAGE_ID`.
- `kit/commands/publicar.md` — hardcoded GitHub repo URL `IEP-Advocacia/obsidian-chat-trynux` replaced with placeholder `${OBSIDIAN_VAULT_REPO}` configurable via env var `OBSIDIAN_VAULT_REPO`. If the env var isn't set, the Obsidian publishing step is skipped cleanly.
- README rewritten: bundled workflow framed as the default install path; `--kit-root` framed as the escape hatch for users who want to replace it entirely.

### Migration

If you installed v0.2.0 expecting the empty/example kit and don't want the bundled workflow, set `KIT_MCP_KIT_ROOT` to your own kit folder before any sync command — nothing else changes:

```bash
export KIT_MCP_KIT_ROOT=~/my-kit
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

If you were on v0.1.x and want the original bundled workflow back, just upgrade — `npm install @luanpdd/kit-mcp@latest` ships it again. (Note: the Anthropic Cowork skills bundled in 0.1.x are still excluded.)

## [0.2.0] - 2026-05-03

**BREAKING.** kit-mcp is now generic infrastructure. The bundled "personal kit" content was removed — bring your own via `--kit-root` or `KIT_MCP_KIT_ROOT`.

### Removed
- All third-party content from the bundled `kit/`:
  - 13 skills (paperclip, design-guide, company-creator, paperclip-create-agent, paperclip-create-plugin, release, release-changelog, prcheckloop, pr-report, doc-maintenance, deal-with-security-advisory, create-agent-adapter, para-memory-files) — these were Anthropic Cowork ecosystem skills, not authored by the package owner.
  - 18 agents and 59 commands previously bundled — these depended on a third-party Portuguese framework that's not redistributed here.
  - `kit/framework/`, `kit/hooks/`, `kit/COMANDOS.md`, `kit/file-manifest.json`, `kit/settings.json` — same reason.
- Internal references (Trynux Notion page IDs, private repo URLs) that leaked from the user's personal projects.

### Added
- `LICENSE` — MIT, Copyright © 2026 luanpdd.
- Bundled **example kit** with 1 agent, 1 command, 1 skill demonstrating the file format. Replace with your own.
- `kit/README.md` documenting the kit file format (frontmatter + body) and structure.
- `--kit-root <path>` global CLI flag to point at any kit folder.
- `KIT_MCP_KIT_ROOT` env var for sticky session-wide override.
- `resolveKitRoot(kitRoot)` exported from `core/kit.js` — lazy resolution so env var changes after import are honored.

### Migration

If you were using 0.1.x with the bundled kit, **the kit content was never yours and is no longer included**. Author your own kit/ folder following the format in [`kit/README.md`](kit/README.md), and point kit-mcp at it:

```bash
npx -y @luanpdd/kit-mcp --kit-root ~/my-kit sync install claude-code --project-root .
# or
export KIT_MCP_KIT_ROOT=~/my-kit
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

## [0.1.6] - 2026-05-03

### Added
- GitHub Actions workflow that publishes to npm on tag push (`v*`) with provenance attestation.
- CI workflow that runs CLI smoke tests on Ubuntu / macOS / Windows × Node 20 / 22.
- `CHANGELOG.md` (this file).
- README badges: npm version, downloads, license, CI status.
- README "Releasing" section documenting `npm version` → `git push --follow-tags` flow.
- The project's own `.mcp.json` re-issued with `--via npx` so collaborators cloning the repo get a portable MCP server registration.

## [0.1.5] - 2026-05-03

### Added
- `forensics reflect` — LLM-driven prompt evolution. Reads `.planning/learnings/{agent}.md` plus current agent prompt, calls Anthropic API, proposes minimal surgical edits, asks for confirmation before applying.
- CLI: `kit forensics reflect --agent <name> [--dry-run | --apply]`.
- MCP: `forensics.reflect` action (returns proposal, never auto-applies).
- Env config: `KIT_REFLECT_MODEL`, `KIT_REFLECT_MAX_TOKENS`. Requires `ANTHROPIC_API_KEY`.

### Notes
- Zero new dependencies — uses native `fetch`.
- Without `ANTHROPIC_API_KEY`, falls back to saving the assembled prompt for manual paste.

## [0.1.4] - 2026-05-03

### Added
- `kit gates run <id>` — gate runner with explicit user confirmation.
- Auto-detects shell gates (` ```bash ` blocks under `## Check`) vs manual gates.
- Verdict mapping: exit 0 → `passed`; exit≠0 → `block` (if blocking) or `warn`.
- `--yes` for non-interactive (CI) mode; `--no-interactive` makes manual gates return `verdict=manual`.

### Fixed
- Gate body section parser now handles gates without trailing `## Verdict` heading.

## [0.1.3] - 2026-05-03

### Added
- `kit sync watch <targets...> [--all]` — watches `kit/` and re-syncs to one or more IDEs on every change.
- Debounce window (default 300ms), per-event log, clean shutdown on Ctrl+C.
- Auto-detect via `--all` of every IDE target that already has files in the project.
- New dep: `chokidar ^5.0.0`.

## [0.1.2] - 2026-05-03

### Added
- `kit reverse-sync detect|apply <target>` — bring edits made directly in an IDE's layout back into the canonical `kit/`.
- Strategies: `skip` (default), `merge` (preserve canonical frontmatter, take edited body), `overwrite`, `rename` (write to `-from-{ide}.md`).
- `--only kind/name` filter, `--dry-run` preview.
- MCP: `reverse-sync` tool.

### Fixed
- Stubs for canonical files without frontmatter now get a synthesized `---name/description---` block (was making downstream parsers read the `<!-- kit-mcp:reference -->` marker as the description).
- Blank line inserted between frontmatter and the stub marker so YAML parsers don't choke.

## [0.1.1] - 2026-05-03

### Added
- `--via {npx | local | global}` flag on `install` command.
- `--via npx` writes `npx -y @luanpdd/kit-mcp` into the IDE's MCP config — portable, no clone needed.
- README rewritten with three quick-start paths (npx, global install, clone).

### Fixed
- `bin` paths in `package.json` no longer prefixed with `./` (npm 11 stripped them as invalid script names, removing the bin entries from published tarball).

## [0.1.0] - 2026-05-03

### Added
- Initial release. MVP with 5 MCP tools (`kit`, `sync`, `gates`, `forensics`, `install`).
- 18 agents, 59 commands, 13 skills (3 + 10 extras) bundled from the user's personal kit.
- 5 reusable workflow gates extracted from inline workflow steps.
- Single `registry.js` adapter table for 8 IDE targets (Claude Code, Cursor, Codex, Gemini CLI, Copilot, Windsurf, Antigravity, Trae).
- Markdown-reference projection mode (default) so the canonical kit stays the single source of truth.
- CLI mirror of all MCP tools.
- `install` command that registers kit-mcp into an IDE's MCP config (JSON for Claude/Cursor/Gemini/Windsurf, TOML for Codex).

[Unreleased]: https://github.com/luanpdd/kit-mcp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/luanpdd/kit-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/luanpdd/kit-mcp/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/luanpdd/kit-mcp/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/luanpdd/kit-mcp/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/luanpdd/kit-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/luanpdd/kit-mcp/compare/v0.2.1...v0.3.0
[0.2.0]: https://github.com/luanpdd/kit-mcp/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/luanpdd/kit-mcp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/luanpdd/kit-mcp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/luanpdd/kit-mcp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/luanpdd/kit-mcp/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/luanpdd/kit-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/luanpdd/kit-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/luanpdd/kit-mcp/releases/tag/v0.1.0
