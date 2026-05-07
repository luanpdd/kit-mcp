# PROJECT.md — kit-mcp

> Bootstrap inicial em 2026-05-03 a partir do histórico de releases. Contexto consolidado da sessão de restauração + fix-up + 0.5.0.
> Última atualização: 2026-05-07 — v1.10 SRE Engagement entregue.

## Estado Atual

**v1.10.0 — SRE Engagement** entregue 2026-05-07. 6 fases (36-41), 30 plans, 32 REQs entregues: 6 skills + 4 agents + 6 commands + 3 audit gates + 9 patches em artefatos v1.8/v1.9 + framework flow. Material-fonte: *Site Reliability Engineering* (Beyer/Jones/Petoff/Murphy — Google/O'Reilly, 2016).

Stack acumulado v1.8 (Supabase) + v1.9 (Observabilidade) + v1.10 (SRE) forma suíte coesa de production engineering. Stable API v1.0+ preservada (zero alterações em src/core/). Próximo milestone a definir.

## Objetivos do Próximo Milestone

A definir. Use `/novo-marco` para iniciar próximo ciclo.

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
