# MILESTONES.md — Histórico de releases

## v1.16 Performance Runtime Wave (Shipped: 2026-05-09)

**Phases completed:** 2 phases, 5 plans, 2 tasks

**Key accomplishments:**

- 1. `src/core/sync.js` — write loop refactored.
- Cache-aware 500ms debounce in watchKit() — coalesces IDE save-bursts and invalidates kitCache before re-sync, eliminating stale TTL-cached projections after edits
- detectReverse() executa os 5 walks (agents, commands, skills, framework, hooks) via Promise.all em vez de awaits sequenciais, mantendo Stable API e fail-fast error semantics — synthetic A/B no kit-mcp tree mostra ~52% speedup das walks orchestration.
- Top-level eager imports of `../ui/server.js`, `../ui/wrapper.js`, and `../ui/browser.js` were moved to dynamic `await import()` inside the subcommand handlers that actually use them, with a 3-test regression suite asserting cold-start stays under a 1500ms ceiling.
- `@inquirer/prompts` and `chokidar` moved to optionalDependencies + lazy-loaded via closure-cached `await import()` with descriptive fallback errors instructing `npm i <package>` — consumers running `npm install --omit=optional` now get functional core CLI while interactive/watch commands fail with actionable messages.

---

## v1.15 DX & Token Economy Wave 2 (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 5 plans, 9 tasks

**Key accomplishments:**

- `terse:true` param + `--terse` CLI flag em list-agents/list-commands/list-skills retornam apenas `{kind, name}` — payload medido em corpus real reduz 68.8% (well above ≥40% threshold)
- Single canonical kit/COMPATIBILITY.md substitui 27 tabelas inline duplicadas em agents — cada agent ganhou linha `
- Idempotent ESM script regen the AUTOGEN-COUNTS block in README.md from real kit/ disk counts (47 agents · 87 commands · 45 skills · 20 gates), with cross-platform EOL preservation and 4 regression tests guarding against future drift.
- Idempotent SHA256 manifest regenerator script + prepublishOnly chain + CI drift gate that fails any PR shipping a stale `kit/file-manifest.json`, formally fixing recurring drift seen in v1.13/v1.14/v1.15.85.
- CI smoke matrix expanded from 1 → 8 IDE targets via `target` axis with step gating (`if: matrix.target == claude-code`) for target-agnostic steps; generic registry-driven Sync round-trip step replaces hardcoded claude-code asserts; local regression test (10 cases) mirrors the same contract for defense in depth

---

## v1.14 Web/Core Security Hardening (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 6 plans, 14 tasks

**Key accomplishments:**

- Strict CSP via SHA-256 hash of inline script, 64-char hex auth token in lockfile, and requireAuth middleware on /publish /shutdown /events /state — closing 2 HIGH XSS+CSRF vulnerabilities deferred from v1.13.
- Transparent auth-token handshake from sidecar to browser via `?t=<token>` URL handshake (then scrubbed via history.replaceState), plus Authorization Bearer in both in-process publisher (`src/ui/client.js`) and out-of-process hook (`kit/hooks/sidecar-tool-publisher.js` v1.14.0), closing SEC-14-02 end-to-end with zero user-visible token interaction.
- MCP handlers handleSync e handleReverseSync agora bloqueiam projectRoot fora de git workspace (UNC fake host, AppData arbitrário) via helper puro com walk-up `.git/` heurístico — fechando vetor SEC-14-03 de write-anywhere.
- SEC-14-04 closed: gate-runner.execScript replaces predictable Date.now+Math.random tmp filename with fs.mkdtemp + per-run unique dir, eliminating symlink TOCTOU vector in shared multi-user /tmp.
- SHA256 manifest verification at sync install boundary, regenerated kit/file-manifest.json (221 to 327 entries), opt-out env var for dev — closes SEC-14-05 against tampered-kit projection.
- Single shared redactSecrets + sanitizeMcpError helper applied at MCP central catch + Anthropic API 401 rethrow + replay JSON persistence — closes SEC-14-06 with three call sites, six regex patterns, and 35 new regression tests covering positive matches, no-false-positive fixtures, and runtime stdio guarantees.

---

## v1.13 Security & Performance Hardening (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 10 plans, 13 tasks

**Key accomplishments:**

- Closed CRITICAL `gates.run` arbitrary-shell-exec primitive over MCP transport — handler now returns stable refusal sentinel instead of spawning bash from gate body content; CLI `kit gates run` unaffected.
- Defense-in-depth path traversal guard for `.planning/replays/` — allowlist regex `/^[A-Za-z0-9_.-]+$/` + post-resolve assertion applied to all 3 MCP-exposed callers (loadReplay, annotateReplay, recordReplay)
- Strict `npm ci` enforcement in publish + CI workflows, with mandatory unit/integration tests and high-CVE audit gate before any `npm publish` — closes the v1.12.1 race condition escape vector at the publish boundary.
- Aplicação do pattern v1.12.1 sidecar (callback antes de process.exit) a 4 hooks com bug latente de drop de payload em pipes lentos, plus taxonomia inline em 6 hooks e regression test de 3 cases.
- 1. [Rule 3 - Blocker] Corrected `listKit` import path in test file
- Removed 66 lines of dead `# hooks:` example block from 11 agent frontmatters and added a 3-test anti-regression guard, recovering ~880 tokens per multi-agent session.
- 1. [Rule 2 - Critical] Mitigated DEP0190 deprecation in test runner
- Backfill de 3 entries de release ausentes (v1.11.0, v1.12.0, v1.12.1) em CHANGELOG.md + transformação do awk-extract gate de warn em hard-fail para final tags, fechando DRIFT-13-01.
- Substituição estática de 10 contadores hardcoded em README.md (drift +147% / +45% / +4800% / +300%) pelos valores reais do filesystem (47 agents, 87 commands, 49 skills, 20 gates) — DRIFT-13-02 fechado.
- MCP server reads `serverInfo.version` from package.json at boot via `readPkgVersion()` mirroring bin/cli.js:43-51, plus 4-case regression test guarding against drift recurrence

---

## v1.10 SRE Engagement (Shipped: 2026-05-07)

**Phases completed:** 6 phases, 30 plans, 0 tasks

**Key accomplishments:**

- Skill canônica SRE Risk Management documentando cap 3 do livro Google SRE (Embracing Risk): risk continuum 6 targets, sabedoria 99.99%, error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more".
- Skill canônica SRE cap 6 documentando os 4 sinais dourados universais (Latency/Traffic/Errors/Saturation), black-box vs white-box monitoring, latência success vs error separadas, percentis vs mean, e histograms com bucketing exponencial — auto-contida com OTel SDK em TypeScript/Deno e queries SQL prontas.
- Skill canônica `eliminating-toil` documentando cap 5 do livro Google SRE — definição operacionalizável de toil (6 critérios), regra ≤ 50%, distinção toil vs overhead vs grungy work, template TOIL-AUDIT.md, estágios de automação L0-L4 e 5 anti-patterns.
- Skill canônica em kit/skills/blameless-postmortems/SKILL.md cobrindo capítulo 15 do livro Google SRE — template canônico de 9 seções (Summary/Impact/Root Causes/Trigger/Resolution/Detection/Action Items/Lessons Learned/Timeline UTC), cultura blameless explícita, no postmortem left unreviewed, Wheel of Misfortune como training trimestral.
- Skill canônica PRR (cap 32 Google SRE) com checklist 6 axes detalhado in-line, 3 engagement models, template PRR-REPORT.md, e sequência handoff dev→SRE em 9 passos — base para prr-conductor Phase 37.
- Especialização do observability-instrumenter (v1.9) com 4 golden signals OTel canônicos — Latency (histogram bucketed exponencial), Traffic (counter), Errors (counter por error.type enum), Saturation (gauge resource-specific)
- Agente content-only `kit/agents/toil-auditor.md` (11.9 KB / 277 linhas) que audita repo + git log + scripts shell + runbooks aplicando 6 critérios canônicos de toil (manual/repetitivo/automatizável/tático/sem valor durável/escala linear), prioriza P0/P1/P2 via score `(frequency × pain) / effort_days`, computa `% do tempo do time` vs ≤ 50% rule, e gera TOIL-AUDIT.md com priorização e estágio L0-L4 de automação alvo
- Agent canônico em kit/agents/postmortem-writer.md que gera postmortem blameless seguindo template de 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC); suporta 2 modos mutuamente exclusivos — `--from-investigation <id>` extrai automaticamente de `.planning/investigations/<id>.md` (artefato do incident-investigator v1.9) e `--incident "<descrição>"` standalone com AskUserQuestion guiado em 9 perguntas; aplica 5 Whys quando blame culture detectada via regex; produz output em `.planning/postmortems/<id>.md` com status Draft + checklist 8 perguntas para reviewer sênior ("no postmortem left unreviewed").
- Agente SRE que conduz Production Readiness Review (cap 32 do livro Google SRE) para serviço/feature antes de produção, lendo schema/Edge Functions/SLOs/advisors via 4 Supabase MCP tools (list_tables, execute_sql, get_advisors, list_edge_functions), produzindo PRR-REPORT.md scored em 6 axes com modo offline fallback gracioso quando MCP indisponível.
- Wrapper command kit/commands/golden-signals.md (142 linhas / 6.1 KB) que dispatch para `golden-signals-instrumenter` via `Task(subagent_type=...)` e suporta 3 modos de target resolution (arquivo único, diretório, número de fase) — entrada canônica do user para aplicar 4 golden signals OTel (Latency histogram + Traffic counter + Errors counter + Saturation gauge) em código de serviço.
- Wrapper command kit/commands/auditar-toil.md (146-char description, 5.8 KB / 129 linhas) que dispatch para toil-auditor via Task(subagent_type=...) com 4 flags opcionais e graceful degradation sem git history, gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2.
- Wrapper /postmortem invoca postmortem-writer com 2 modos mutuamente exclusivos (--from-investigation v1.9 trail OU --incident standalone) gerando postmortem blameless 9 seções em .planning/postmortems/<id>.md
- Wrapper command `kit/commands/prr.md` que dispatcha para `prr-conductor` agent com 2 modos `--service|--feature`, 6 axes obrigatórios, 3 engagement models e AskUserQuestion duplo (engagement + reviewer anti auto-PRR).
- Comando direto read-only que exibe error budget vs risk continuum (cap 3 SRE) — lê .planning/slos/, posiciona cada SLO no continuum 99% → 99.999%, classifica em 4 status enum (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED), e aplica sabedoria 99.99% inline em modo --explain.
- Terceiro orquestrador da família v1.8/v1.9/v1.10 — dispatch para 4 agents SRE com sinônimos PT/EN + caso especial risk-budget como comando direto + validação flags mutuamente exclusivas pre-dispatch
- Patch editorial em kit/skills/event-based-slos/SKILL.md inserindo bloco "Risk continuum — SLO target é decisão explícita" com tabela canônica de 5 linhas (99%–99.99%) + sabedoria 99.99% + cross-ref Markdown ativo para sre-risk-management; frontmatter byte-idêntico preservado.
- Patch puramente editorial de `kit/agents/omm-auditor.md` (+52 linhas / -0 linhas) que faz a Capacidade 3 (Complexidade / Tech Debt) consultar `toil-auditor` via cross-ref Markdown ativo e incorporar `% toil pelo time` no scoring 1-5 — frontmatter byte-idêntico, modelo 5-capacidade canônico preservado, regra absoluta "score > 3 exige TOIL-AUDIT.md fresco" estabelecida.
- Patch substancial em `kit/agents/supabase-edge-fn-writer.md` (v1.8 + v1.9) adiciona seção "Four Golden Signals" (cap 6 livro Google SRE) — toda Edge Function gerada nasce com Latency histogram + Traffic counter + Errors counter por error.type + Saturation gauge resource-specific. Frontmatter byte-idêntico preservado.
- Patch v1.10 do agent supabase-architect: nova seção 'Production Readiness Review' (cap 32 livro Google SRE) + extensão do template de output com '## 10. PRR pré-production' — frontmatter byte-preservado
- Chain canônico /forense → /postmortem documentado via bloco <sre_integration> em kit/commands/forense.md (cap 15 Google SRE)
- Gate PRR opcional adicionado ao /concluir-marco via flag workflow.complete_milestone_prr_gate (default false), com status table 3-row, critério ≥ 2 dos 4 sinais de production maturity e cross-refs ATIVOS para skill + agent v1.10
- Bloco `<sre_integration>` adicionado ao `/auditar-marco` — auto-invoca `/auditar-toil` antes de `/auditar-observabilidade`, fechando loop cap 5 SRE → omm-auditor Capacidade 3 (Phase 39 INT-OBS-02)
- Gate bash 3.2-portable blocking pre-verify que detecta os 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter, Saturation=gauge) via regex inclusiva em código tocado, com skip gracefully para projetos content-only.
- Bash 3.2-portable blocking pre-conclude gate enforcing "no postmortem left unreviewed" (cap 15 Google SRE) by cross-checking .planning/investigations/ vs .planning/postmortems/ via basename match, with Status: INCONCLUSIVE recognized as exception
- Gate bash 3.2-portable blocking pre-verify validando que cada PRR-REPORT.md em .planning/prr/
- README.md updated with new SRE Engagement suite (v1.10) section listing 6 skills + 4 agents + 6 commands + 3 audit gates with end-to-end workflow example, citing Site Reliability Engineering book (Google/O'Reilly 2016) — pure additive patch (55 insertions / 0 deletions)
- QA-SRE-05

---

> Reconstruído a partir do CHANGELOG e dos commits. Fonte canônica das versões está em `CHANGELOG.md`.

## Concluídos

### v0.1.x — Foundation (2026-05-03)

- v0.1.0: Initial release. 5 MCP tools, 8 IDE targets, registry table, markdown-reference projection.
- v0.1.1–0.1.6: Polishes (`--via npx`/`local`/`global`, CI, npm provenance, README, badges, reverse-sync, watch, gate runner, forensics reflect).

### v0.2.0 — Cleanup falho (2026-05-03)

- Removeu por engano o kit pessoal achando ser third-party. **Deprecated retroativamente** — não usar.

### v0.2.1 — Patch da v0.2.0 (2026-05-03)

- Mantém o erro da v0.2.0. Não usar.

### v0.3.0 — Workflow restaurado (2026-05-03)

- 19 agents, 60 commands, framework, hooks restaurados de `069349c^`.
- Skills da Anthropic Cowork excluídas conscientemente.
- Trynux/IEP-Advocacia/Notion ID hardcoded → env vars (`KIT_NOTION_PARENT_PAGE_ID`, `OBSIDIAN_VAULT_REPO`).

### v0.4.0 — Docs alinhados (2026-05-03)

- README reescrito: kit bundled é caminho default; `--kit-root` é escape hatch.
- BUG: import morto `DEFAULT_KIT_ROOT` em `src/mcp-server/index.js` quebrava boot via `npx`. **Deprecated**.

### v0.4.1 — Fix MCP boot (2026-05-03)

- Removido import morto.
- Adicionado boot test ao CI.

### v0.5.0 — Mirror-tree sync (2026-05-03)

- Nova capability `framework` e `hooks` no registry: cópia recursiva de `kit/framework/` e `kit/hooks/` para `.claude/framework/` e `.claude/hooks/`.
- Marker `.kit-mcp-managed` na raiz pra `sync remove` seguro.
- CI cobre projection + safety (preserva user files sem marker).
- **Resolve a regressão estrutural** que fazia commands tipo `/novo-marco` aparecerem na IDE mas falharem em runtime ao tentar ler templates.

### v1.0.0 — Estabilização para 1.0 (2026-05-03) 🎉 First stable

- 12/12 REQs entregues em 5 fases (tooling, parser, reverse-sync, tests, cut).
- Tests: 42 automatizados (37 unit + 5 integration) via `node:test`, zero deps.
- CI: 6/6 combinações verdes (Ubuntu/macOS/Windows × Node 20/22) em todo push.
- Reverse-sync simétrico: detect/apply para framework + hooks (mirror-tree).
- Parser fixes coordenados: stub reorder + HTML-comment skip + YAML quoting.
- publish.yml cria GitHub Release object automaticamente em todo `v*`.
- Stable API commitment: TARGETS, MCP actions, CLI surface, core exports, stub format, marker semantics.
- Detalhes: `.planning/milestones/v1.0.0/`.

### v1.2.0 — GUI sidecar de acompanhamento (2026-05-04) 🪟 Live process viewer

- 56/56 REQs entregues em 8 fases (lock arquitetural, fundações, servidor HTTP+SSE, UI estática, publisher+wrapper, CLI integration, MCP auto-spawn, hardening+release).
- Sidecar web localhost (porta 7100-7199) com SSE; abre via `kit ui start` ou `autoSpawn:true` em tools MCP de sync/reverse-sync/gates.
- Stable API v1.0+ preservada — apenas adições. `src/core/` literalmente intocado (`git diff` vazio).
- 1 dep nova: `open@11` (única; budget atingido em 6/6).
- Tests: 151 (49 u + 9 i baseline → ~80 u + ~71 i = 151). +93 vs v1.1.
- 7 audit gates ativos no CI: stdout discipline em `src/ui/`, dep budget, npm pack UI assets, Host check, Origin check, CSP shape, path redaction.
- Threat model finalizado em `docs/sidecar-security.md`: bind 127.0.0.1, CSP estrito, path scrubbing central, sem auth (mitigado).
- Bug pré-existente corrigido: `kit --version` agora lê de `package.json` (era hardcoded 1.0.0).
- Ship readiness: working tree clean, todos os tests verde, REL-02 (tag) e REL-03 (npm publish) requerem user action.
- Detalhes: `.planning/milestones/v1.2.0/`.

### v1.1.0 — Feedback visual no terminal (2026-05-03) 🎨 Visual UX

- 10/10 REQs entregues em 5 fases (UI primitives, --json flag, progress, selectors, cut).
- `src/core/ui.js` (~167 LOC) — color/icons/spinner/progress/select/confirm/summary, respeita NO_COLOR + isTTY.
- Default output muda de JSON para human-readable; `--json` global flag preserva v1.0.
- Progress bar em ops longas (sync install, reverse-sync apply); spinner em curtas (kit list-*, sync targets).
- Selector interativo em `install write` e `sync install` quando target ausente em TTY.
- `install write` sempre faz dry-run + preview + confirm (`--yes`/`--json` bypass).
- Tests +16 (49 unit + 9 integration = 58 total).
- Deps adicionadas: picocolors, @inquirer/prompts (selectivamente importado).
- Stable API additions: --json semantics, onProgress callback signature, non-TTY error fallback.
- Detalhes: `.planning/milestones/v1.1.0/`.

### v1.3.0 → v1.5.3 — Patches ad-hoc (2026-05-04 → 2026-05-05)

Série de patches feitos fora do framework — UI redesign, framework velocity, UI tokens display, auto-reconnect, idle-default fix, audit bundle. Todos em `CHANGELOG.md` (canônico). Resumo:

- v1.2.3 — humanize labels (PT-BR, caminhos amigáveis)
- v1.3.0 — UI redesign Claude Design (active hero, timeline rail, tweaks panel)
- v1.4.0 — framework velocity (publicar-rapido, main-sync, auto-detects, schema-checker, post-migration hook)
- v1.5.0 — UI tokens display + sessão history + defensive labels
- v1.5.1 — UI auto-reconnect via /healthz + bordas com respiro
- v1.5.2 — sidecar idle-default = 0 (não encerra sozinho)
- v1.5.3 — bundle audit quick-wins (POST /shutdown Origin check, awk regex em publish.yml, drop absPath de list-*, trim Vago/Correto)

### v1.6.0 — Perf+lean (2026-05-05) 🧹 16 audit items + observability hook

- 16/16 REQs entregues em 3 fases (Phase 19 quick wins / Phase 20 hardening / Phase 21 token economy) + Phase 19.5 inserida (observability hook).
- planner.md compactado 53→35 KB (-34%); CLAUDE.md gerado 10→8.5 KB (-19%).
- listKit cache TTL 30s, regex top-level, sync/reverse-sync aceitam kit pré-carregado.
- Sidecar `/state` paginado, healthz timeout 500ms, TOCTOU re-probe, walkTree path traversal bloqueado, redactPath Windows-aware.
- CI: Node 24 na matriz, npm audit gate, deps-budget mensagem dinâmica, prepublishOnly preflight.
- Hook PostToolUse `sidecar-tool-publisher.js` publica `tool_invocation` events com source detection (multi-IDE pill na UI).
- Stable API v1.0+ preservada. Tests: 102 unit + 67 integration verde.

### v1.6.1 — DX patch (2026-05-05) 🩺 Diagnostic + upgrade-check

- `kit doctor` — diagnostic command (version/sidecar/hook/settings/.planning/orphan locks)
- Upgrade-check no boot do `kit ui start` com banner amarelo se atrás do npm latest
- Cache TTL 30s em `listGates` (mirrors PERF-01 pattern)
- 112 unit + 67 integration green; Stable API preservada.

### v1.7.0 — Perf+lean part 2 + UX canonical (2026-05-06) 🧹 Workflow compaction + naming

- Phase 22: workflow files compactados (discuss-phase 49→39 KB, plan-phase 36→31 KB, new-project 40→37 KB)
- Phase 23: stubs-only sync mode (1.79× speedup em cold listKit; cache key separado)
- Phase 24: boilerplate dedup (output-style centralizado em references/, 19 KB economizados em 18 agents) + /fazer canonical com árvore de decisão; aliases /rapido /expresso /proximo linkam de volta
- 115 unit + 67 integration green; Stable API preservada.

### v1.8.0 — Suíte Supabase (2026-05-06) 🗄️ Skills+Agents+Command especializados

- 31/31 REQs entregues em 4 fases (Phases 25-28).
- **11 skills canônicas** em `kit/skills/supabase-*/SKILL.md`: realtime, auth-ssr, edge-functions, declarative-schema, rls-policies, database-functions, migrations, postgres-style, storage, pgvector-rag, cron-queues. Auto-contidas, template fixo de 5 seções, code blocks EN com comentários PT-BR.
- **Glossário** em `kit/skills/_shared-supabase/glossary.md` — termos PT-BR↔EN + comandos CLI canônicos + patterns canônicos consolidados.
- **7 agents** em `kit/agents/supabase-*.md`: architect, migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer. Cada um com tabela Compatibilidade IDE + preflight MCP + modo offline gracioso + canonical layouts.
- **1 command** `/supabase` em `kit/commands/supabase.md` com 10 subcomandos (sinônimos PT/EN). Dispatch via `Task(subagent_type=supabase-...)`. Único orquestrador.
- **5 audit gates** em `gates/`: budget-description, no-personal-uuid, agent-no-recursive-dispatch, skill-must-include, sync-idempotent.
- **Cleanup oportunístico:** `kit/agents/schema-checker.md` migrado de UUID `mcp__0a712001-...` (UUID pessoal) para `mcp__supabase__*` canônico. Breaking interno fixado.
- Stable API v1.0+ preservada — content-only milestone (zero alterações em `src/core/`).
- Material-fonte: 7 guias oficiais Supabase + 4 dimensões de pesquisa (`.planning/research/`).
- Detalhes: `.planning/milestones/v1.8.0/` (após `/concluir-marco`).

### v1.9.0 — Observabilidade (2026-05-06) 🔭 Skills+Agentes+Comandos derivados de Observability Engineering

- 41/41 REQs entregues em 7 fases (Phases 29-35).
- **11 skills observability** em `kit/skills/`: `_shared-observability/glossary.md`, `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `core-analysis-loop`, `observability-driven-development`, `event-based-slos`, `burn-rate-alerting`, `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model`.
- **5 agents** em `kit/agents/`: `observability-instrumenter`, `incident-investigator` (usa MCP Supabase get_logs/execute_sql/get_advisors), `slo-engineer` (apply_migration), `burn-rate-forecaster`, `omm-auditor`.
- **6 commands**: `/instrumentar-fase`, `/investigar-producao`, `/definir-slo`, `/burn-rate-status`, `/auditar-observabilidade`, `/observabilidade` (orquestrador análogo a `/supabase`).
- **3 audit gates** em `gates/`: `obs-skills-frontmatter`, `obs-agents-mcp-supabase`, `omm-no-regression`.
- **Integração profunda com Suíte Supabase v1.8** — 7 agents Supabase patcheados com bloco "Observabilidade integrada" (skills observability cross-referenced; SLI tables nascem com schema; auth/storage/edge-fn/realtime instrumentados desde projeto).
- **Integração com fluxo framework** — `/discutir-fase`, `/planejar-fase`, `/verificar-trabalho`, `/forense`, `/auditar-marco`, `/concluir-marco` ganharam blocos `<observability_integration>` com hooks ODD + OMM.
- Material-fonte: livro *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022, ISBN 978-1-492-07644-5).
- Stable API v1.0+ preservada — content-only milestone (zero alterações em `src/core/`).
- Detalhes: `.planning/milestones/v1.9/`.

## Em andamento

(nada — v1.9.0 concluído)

## Backlog macro (não-priorizado)

- **CLI awkwardness do double-`kit`**: `kit kit list-agents`, `kit kit search`, `kit kit get` — o grupo "kit" repete o nome do binário. Considerar achatar (alias top-level: `kit list-agents` direto, mantendo `kit kit ...` como compatibilidade) ou renomear o grupo (`kit browse list-agents`?). Detectado em smoke da v1.1.0.
- **HTTP transport** para IDEs que não falam stdio MCP.
- **forensics reflect com diff visual** em vez de full content.
- **`kit gates run --all`** agregando vereditos de todas as gates de um stage.
- **Dependabot config** para `chokidar` e `@modelcontextprotocol/sdk`.
- **`kit sync watch` exposto via MCP** (challenge: long-running tool).
- **Tests além de smoke** — unit/integration para kit.js, sync.js, reverse-sync.js, gate-runner.js.
- **Skill da `inserir-fase` com description quebrada** (mostra `<!-- kit-mcp:reference -->` em vez do real description). Bug de parsing do frontmatter quando há linha em branco antes do conteúdo.
- **GitHub Releases page** ainda mostra `v0.2.0 — cleanup` como Latest. Criar Release object pra v0.5.0.
- **Documentação site** (a partir do README + CHANGELOG).
- **Reverse-sync para framework/hooks** — atualmente só agents/commands/skills.
