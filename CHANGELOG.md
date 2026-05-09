# Changelog

All notable changes to `@luanpdd/kit-mcp`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.18.0] - 2026-05-09

**Eat Your Own Dog Food** — kit-mcp agora APLICA as observability/SRE skills que sempre ENSINOU. Fecha fail axe Instrumentation (PRR 2/5 → 5/5) que vinha aberto desde v1.12.1.

4 fases (94-97), 4 plans, 74 testes novos (418 baseline final, +74 vs v1.17). Coverage 69.95% → 77.89%.

### Golden Signals MCP Server (Phase 94)
- **OBS-18-01/02:** `src/core/metrics.js` (NEW) com Counter API (Map-based) + Histogram API (FIFO N=1000) + percentiles (p50/p95/p99 via linear interpolation). `src/mcp-server/index.js` central catch wrappado em 3 paths (success/thrown/unknown-tool). Novo MCP tool `metrics-snapshot` (parameterless, read-only) discoverable via `tools/list`. Reset via `KIT_MCP_METRICS_RESET=1`. Zero deps novas — Map + array stdlib only. Aplica skill `four-golden-signals` ao próprio MCP server.

### SLO Definitions (Phase 95)
- **OBS-18-03/04:** `.planning/slos/mcp-tool-availability.yml` + `.planning/slos/mcp-tool-latency.yml` event-based SLOs (skill `event-based-slos` aplicada). Availability: ratio success/total target 99.5%, window 30d sliding, alert burn-rate page 14.4× / ticket 6×. Latency: p95 ≤200ms, window 30d. SLI source = `metrics-snapshot` tool da Phase 94. README explica derivation + consumer workflow + future-work pointers (multi-window burn-rate).

### Operations Documentation (Phase 96)
- **OPS-18-01:** `.planning/RUNBOOK.md` (NEW) — Emergency Response Guide com 5 cenários estruturados Symptom→Diagnosis→Fix: MCP boot fail, sidecar UI hang, manifest mismatch, npm publish fail, sync corruption. Apply skill `blameless-postmortems`.
- **OPS-18-02:** `.planning/FAILURE-MODES.md` (NEW) — top-down catalog com 12 failure modes em matrix Impact × Likelihood × Mitigation, organizadas em 4-tier risk rollup. Apply skill `sre-risk-management`.
- **OPS-18-03:** `.planning/BENCHMARK.md` (NEW) — 5+ baseline performance metrics medidas em v1.17.0 (cold start 232ms median, sync wall time 503ms cold/391ms steady, RSS 53MB, MCP p95/p99 144/146ms, tarball 1.1MB packed). Reference para detection de regressões futuros. Cross-references com SLOs (Phase 95) e metrics (Phase 94).

### Coverage Ratchet (Phase 97)
- **INFRA-18-01:** Threshold CI bumped 65% → 75%. Coverage real measured **77.89%** (+7.94 pp acima do threshold). 4 hot files lifted via 38 tests novos:
  - `src/core/failures.js`: 17.65% → **99.35%** (+82pp)
  - `src/mcp-server/install.js`: 19.46% → **95.97%** (+76pp)
  - `src/ui/auto-spawn.js`: 30.97% → **56.64%** (+26pp)
  - `src/cli/index.js`: 37.47% → **55.26%** (+18pp)
- Ratchet plan v1.19+ documentado em ci.yml comments.

### PRR re-projection (24/30 → 27/30)
- Instrumentation 2/5 → **5/5** (fail axe → top)
- Emergency Response 3/5 → 4/5 (RUNBOOK + FAILURE-MODES)
- Capacity Planning 3/5 → 4/5 (BENCHMARK baseline)

### Tech debt → v1.19+
- Coverage threshold ratchet 75% → 80% (auto-spawn e cli/index ainda no 50s%)
- Long-term metrics retention (log-to-disk via metrics-snapshot)
- Multi-window burn-rate calculation alimentando `/burn-rate-status`
- Mutation testing (stryker)

[v1.18 milestone audit](./.planning/v1.18-MILESTONE-AUDIT.md) · [v1.18 ROADMAP](./.planning/milestones/v1.18-ROADMAP.md)

## [1.17.0] - 2026-05-09

Primeira release **pós-zerada-meta-auditoria-original**. Origem: nova meta-auditoria (5 agents) sobre v1.16.0 que identificou 2 P0 perf hotspots novos + items P1/P2 polish. PRR score sobe 22/30 → 24/30.

4 fases (90-93), 4 plans, 27 testes novos (344 baseline final, +27 vs v1.16).

### Performance Wave 2 (Phases 90-91)
- **PERF-17-01:** `verifyManifest` em `src/core/manifest-verify.js` agora usa `Promise.all` batches=16 (mesmo pattern da Phase 88.01 sync) + cache em-memória com TTL 30s. Watch trigger consecutivo (2º+) usa cache → <5ms. Mismatch path NUNCA cacheia (devs corrigindo files veem recovery imediato). Bypass via `KIT_MCP_VERIFY_NO_CACHE=1`. CRLF→LF normalize fix do v1.15 preservado.
- **PERF-17-02:** `syncTo()` em `src/core/sync.js` agora aplica diff filter via `fs.stat` (mtime + size) em treeCopy ops antes do batch loop. Files cujo destination já bate são skip. **~42% median speedup** medido em 327-file kit (bem dentro da banda 30-50% target). `KIT_MCP_FORCE_FULL_SYNC=1` força full sync (cleanup/recovery). `onProgress` recebe `{skipped: true}` para granularidade preservada. Content ops (rules/agents/commands/skills) NÃO afetadas — embedam timestamp em `renderReference()` que diff sempre acharia "different".

### Quick Wins Polish (Phase 92)
- **POL-17-01:** `open` movida de `dependencies` para `optionalDependencies`. Budget mantido: 3 deps (@modelcontextprotocol/sdk, commander, picocolors) + 3 optionalDependencies (@inquirer/prompts, chokidar, open) = 6 total. Fallback graceful em `src/ui/browser.js` quando ausente.
- **POL-17-02:** `scripts/regen-manifest.js` paralelizado (~37% speedup, 86ms → 54ms). Idempotência preservada — output bytes idênticos quando inputs iguais.
- **POL-17-03:** Removido import morto `getLocalVersion` em `src/cli/index.js` (Plan 89.01 deviation).
- **POL-17-04:** JSDoc `@param/@returns` adicionado em `validateProjectRoot` de `src/core/path-safety.js`.

### CI Infrastructure (Phase 93)
- **INFRA-17-01:** `.github/workflows/ci.yml` deps budget gate agora soma `dependencies + optionalDependencies` (cap=6 total). Fix gap onde gate ignorava optionalDependencies pós-v1.16 reorganização.
- **INFRA-17-02:** Novo step CI usando `node --experimental-test-coverage` em test/unit; gera coverage report; fail se line coverage < 65% (baseline measured 69%, threshold conservador). Ratchet plan documentado para 80% em v1.18+ (priorities cli/index.js 37%, mcp-server/install.js 19%, ui/auto-spawn.js 31%, core/failures.js 17%).

### Tech debt → v1.18+
- Coverage threshold ratchet 65% → 80%
- Mutation testing (stryker)
- Worker threads para hash (rejected — files pequenos, I/O bound)
- Os 4 P1 do PRR v1.12.1 que continuam abertos (Instrumentation fail axe — counter `tool_invocations_total`, `.planning/slos/`, `RUNBOOK.md`, `FAILURE-MODES.md`)

[v1.17 milestone audit](./.planning/v1.17-MILESTONE-AUDIT.md) · [v1.17 ROADMAP](./.planning/milestones/v1.17-ROADMAP.md)

## [1.16.0] - 2026-05-09

Fecha os **6 últimos items P1-P6** da meta-auditoria de v1.12.1 (perf runtime). Após esta release, a meta-auditoria está **100% ZERADA** — 23 items totais resolvidos.

2 fases (88-89), 5 plans, 18 testes novos (317 baseline final, +18 vs v1.15).

### Concurrent I/O (Phase 88)
- **PERF-16-01:** `syncTo()` em `src/core/sync.js` agora usa `Promise.all` em batches de 16 (configurável via `KIT_MCP_SYNC_BATCH_SIZE`, fallback safe `[1,256]`). **50.5% speedup real** medido em workspace típico de 321 files (target era 30%). `verifyManifest()` continua sendo chamado ANTES dos writes paralelos (sem TOCTOU).
- **PERF-16-02:** `src/core/watch.js` agora coalesce edit-burst via debounce 500ms — 10 saves rápidos durante save de IDE → 1 invalidação `clearKitCache()` em vez de 10. Default debounceMs bumped 300 → 500.
- **PERF-16-03:** `detectReverse()` em `src/core/reverse-sync.js` paraleliza 5 scans via `Promise.all`. **52.4% speedup real** (110.6ms → 52.7ms; target 10%). Helpers byte-idênticos — só body do `detectReverse` mudou.

### Lazy Imports & Optional Deps (Phase 89)
- **PERF-16-04:** `src/cli/index.js` agora tem 0 top-level imports de UI sidecar — 4 dynamic `await import('../ui/...')` sites scoped aos handlers que precisam (`sync watch`, `ui start/stop/status/open`). Cold start improvement de 18.8% (271ms → 220ms median, dev machine; abaixo do target 30% porque Phase 88 já tinha encurtado baseline). Pattern de referência: `src/ui/browser.js` `await import('open')`.
- **PERF-16-05 + PERF-16-06:** `package.json` move `@inquirer/prompts` e `chokidar` de `dependencies` para `optionalDependencies` (4 deps + 2 opt = 6 budget mantido). `src/core/ui.js` `loadInquirer()` + `src/core/watch.js` `loadChokidar()` helpers com closure cache + descriptive throw se ausente. `npm install --omit=optional` resulta em CLI core funcional com fallback graceful em commands que precisam dessas deps.

### Backlog meta-auditoria de v1.12.1: 100% ZERADO ✅
- v1.13: 4 CRITICAL + 4 quick wins
- v1.14: 6 HIGH
- v1.15: 5 DX/economy
- **v1.16: 6 PERF runtime**
- **Total: 23/23 items resolvidos.**

v1.17+ pode mover para features novas (não mais hardening).

[v1.16 milestone audit](./.planning/v1.16-MILESTONE-AUDIT.md) · [v1.16 ROADMAP](./.planning/milestones/v1.16-ROADMAP.md)

## [1.15.0] - 2026-05-09

Fecha o **backlog completo da meta-auditoria de v1.12.1**. Após esta release, os 17 items identificados pelos 12 agentes paralelos estão TODOS endereçados (CRITICAL em v1.13, HIGH em v1.14, DX/economy em v1.15).

3 fases (85-87), 5 plans, 26 testes novos (299 baseline final, +26 vs v1.14).

### Token Economy Wave 2 (Phase 85)
- **PERF-15-01:** terse mode em `list-agents`/`list-commands`/`list-skills` via arg `terse:true` (MCP) e flag `--terse` (CLI). Retorna apenas `{name, kind}` sem description. **Redução real de 68.8%** medida em corpus real (target era 40%) — 25486 → 7942 bytes em 179 items.
- **PERF-15-02:** Tabela `## Compatibilidade` repetida em 27 agents extraída para `kit/COMPATIBILITY.md` canônico (single source of truth, matriz horizontal 27 agents × IDE × tier × capability + Troubleshooting). Cada agent agora tem linha `**Compat:**` com link para o canônico. -271 linhas eliminadas, +27 referências limpas.

### Drift Auto-Prevention (Phase 86)
- **DX-15-01:** `scripts/update-readme-counts.js` (NEW) lê `kit/agents/*.md`, `kit/commands/*.md`, `kit/skills/*/SKILL.md`, `gates/*.md`, conta, substitui bloco `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->` no README. Idempotente (zero diff em re-run). README com contagem auto-gerada em vez de hardcoded.
- **DX-15-02:** `scripts/regen-manifest.js` (NEW) regenera `kit/file-manifest.json` com SHA256 de cada arquivo distribuído. Idempotente (preserva timestamp quando files+version unchanged). `package.json prepublishOnly` agora chama ambos scripts antes dos tests (`regen-manifest && update-readme-counts && unit && integration`). CI drift gate em `.github/workflows/ci.yml` falha hard se algum dev esqueceu de rodar local.

**Bonus catch:** primeira execução do `regen-manifest` detectou drift pré-existente do Plan 85.02 (manifest stale, faltava `COMPATIBILITY.md` + 4 framework templates) — corrigiu no mesmo commit, validando a premissa da automação.

### CI Matrix Expansion (Phase 87)
- **DX-15-03:** `.github/workflows/ci.yml` smoke job ganha matrix axis `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]` (8 IDEs). `fail-fast: false` permite cada target ser testado independentemente. Hardcoded `claude-code` no sync round-trip body substituído por `${{ matrix.target }}`. Step gating com `if: matrix.target == 'claude-code'` em 7 steps target-agnostic (tests unit, tests integration, audit drift, CLI smoke, Supabase gates, mirror-tree safety, MCP boot) economiza ~55% de step-executions (~351 vs naïve ~720). Regression test `test/unit/sync-round-trip-all-targets.test.js` valida todos 8 IDs no registry.

### Backlog meta-auditoria: ZERADO
- v1.13: 4 CRITICAL + 4 quick wins ✅
- v1.14: 6 HIGH ✅
- v1.15: 5 DX/economy ✅
- **Total: 17 items ✅ todos resolvidos.** v1.16+ pode focar em features novas (não hardening).

### Tech debt → v1.16+
- CI matrix size optimization (PR-mode subset 8 runs vs main full 72)
- YAML lint runtime confirmation (deferred para primeira CI run real em ubuntu-latest)

[v1.15 milestone audit](./.planning/v1.15-MILESTONE-AUDIT.md) · [v1.15 ROADMAP](./.planning/milestones/v1.15-ROADMAP.md)

## [1.14.0] - 2026-05-09

Continuação direta da v1.13 — fecha as **6 vulnerabilidades HIGH** explicitamente deferidas em `.planning/milestones/v1.13-MILESTONE-AUDIT.md` "Tech Debt". Mesma origem auditiva (meta-auditoria com 12 agentes paralelos sobre v1.12.1). Content-zero por design.

3 fases (82-84), 6 plans, 63 testes novos (273 baseline final, +63 vs v1.13).

### Web Surface Hardening (Phase 82)
- **SEC-14-01:** CSP estrito no UI sidecar — sha256 hash do `<script>` inline substitui `'unsafe-inline'`. 42 escape sites em `src/ui/static/index.html` adicionados como defesa-em-profundidade contra XSS via SSE payload (ex: hooks publishers que incluem comandos do user).
- **SEC-14-02:** Auth token de 64-char hex gerado em `src/ui/lockfile.js` por `crypto.randomBytes(32)`. Middleware `requireAuth` aplicado em POST /publish, POST /shutdown, GET /events (via `?t=` query param porque EventSource não suporta custom headers), GET /state. GET /healthz mantido aberto para handshake. Token propagado transparentemente: `auto-spawn` lê lockfile → injeta `?t=<token>` no URL → browser parseia query, scrub via `history.replaceState` (token não vaza no address bar), anexa `Authorization: Bearer` em todo fetch. `kit/hooks/sidecar-tool-publisher.js` bumpado para `hook-version: 1.14.0` com Authorization header.

### Core Filesystem Hardening (Phase 83)
- **SEC-14-03:** `validateProjectRoot` helper em `src/core/path-safety.js` (NEW) com walk-up `.git/` heurístico. Aplicado em `handleSync` + `handleReverseSync` (callers MCP). CLI behavior preservado — `process.cwd()` continua trusted. Sentinel uniforme: `"MCP sync requires projectRoot to be a git workspace"`. Bloqueia `\\evil-host\share`, paths do AppData, etc.
- **SEC-14-04:** `src/core/gate-runner.js` agora usa `fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'))` substituindo `Date.now() + Math.random()` predictable filename. Script criado dentro do diretório único (crypto-random nome via mkdtemp). Cleanup recursivo em finally garante zero leftovers em /tmp mesmo em error path. Elimina symlink TOCTOU em multi-user `/tmp` shared.
- **SEC-14-05:** `src/core/manifest-verify.js` (NEW) verifica SHA256 de cada arquivo listado em `kit/file-manifest.json` antes de `syncTo()` install. Throw `EMANIFESTMISMATCH` com mismatch list se corrupção detectada. `KIT_MCP_SKIP_MANIFEST_CHECK=1` permite opt-out (warn em stderr) para dev workflow. Manifest regenerado de 221 entries (v1.4.0, stale) para **327 entries (v1.13.0, fresh, 0 mismatches)**.

### MCP Error Sanitization (Phase 84)
- **SEC-14-06:** `src/core/error-redaction.js` (NEW) com `redactSecrets()` (regex global: `sk-ant-*`, `sk-*`, `x-api-key:`, `Bearer *`, paths absolutos `[A-Z]:[\\/]...` e `/{home,Users,root}/...`) + `sanitizeMcpError()` (NUNCA inclui `e.stack`). Aplicado em **exatamente 3 sites** (single source of truth, grep-verifiable):
  1. Central catch block em `src/mcp-server/index.js` — todos os handlers (sync, reverse-sync, gates, forensics, replays, install) propagam pra cá.
  2. `src/core/reflect.js` callClaude error rethrow — bloqueia leak de `ANTHROPIC_API_KEY` em response body 4xx.
  3. `src/core/replays.js` recordReplay — JSON persistido em `.planning/replays/*.json` é scrubbed.
- Stack trace COMPLETO continua em stderr (server-side log) — apenas o cliente MCP não recebe. Backward compat: envelope schema continua `{error: string, code?: string}` (drop apenas `stack` field). 6 negative fixtures contra false positives ("Compare A:B", "Modal: hello", `https://example.com/etc/passwd`, etc).

### Tech debt → v1.15
- CI matrix expansion para 8 IDEs (sync round-trip)
- T2 (terse mode em list-*), T3 (compatibility dedup em 27 agents)
- README counters auto-gen via prepublishOnly hook
- Manifest auto-regen em prepublishOnly

[v1.14 milestone audit](./.planning/v1.14-MILESTONE-AUDIT.md) · [v1.14 ROADMAP](./.planning/milestones/v1.14-ROADMAP.md)

## [1.13.0] - 2026-05-09

Suíte de hardening interno — derivada de meta-auditoria com 12 agentes em paralelo sobre kit-mcp v1.12.1. **Content-zero** (não adiciona ao kit, repara o framework e o package npm).

3 fases (79-81), 10 plans, 33 testes novos (210 testes total no baseline final).

### Security (CRITICAL/HIGH fechados)
- **SEC-13-01:** `gates.run` via MCP transport agora bloqueia exec arbitrário com erro estável. Surface MCP fechada; `kit gates run` CLI preservado.
- **SEC-13-02:** `replayId` validation com regex allowlist + `path.resolve` assertion em `loadReplay`/`annotateReplay`/`recordReplay` (3 callers em `src/core/replays.js`). Bloqueia path traversal contra `.planning/replays/`.
- **SEC-13-03:** `npm ci` strict (sem fallback `|| npm install`) em `.github/workflows/publish.yml` e `.github/workflows/ci.yml` — lockfile reproducibility no path de release.
- **SEC-13-04:** Publish workflow obriga `npm test` + `npm run test:integration` + `npm audit --omit=dev --audit-level=high` antes de `npm publish`. Race conditions e CVEs travam release.
- **SEC-13-05:** 6 hooks restantes (`workflow-guard`, `prompt-guard`, `context-monitor`, `post-apply-migration`, `statusline`, `check-update`) categorizados (A/B/C/E) e — onde aplicável — corrigidos com pattern `process.stdout.write(payload, () => process.exit(0))` (mesma classe de bug do fix v1.12.1, padrão diferente para hooks síncronos vs TCP).

### Performance / Token economy
- **PERF-13-01:** `summarize()` + `SUMMARY_MAX_CHARS` exportados de `src/core/sync.js`; aplicados em `slim()` de `src/mcp-server/index.js` e `src/cli/index.js`. **Redução real de 44.4%** em payload de listing (medida em corpus real do kit, 26057 → 14498 bytes).
- **PERF-13-02:** Bloco `# hooks:` comentado-morto removido de 11 agents (`planner`, `debugger`, `verifier`, etc.). −66 linhas, ~880 tokens economizados por sessão multi-agent. Anti-regression test guarda contra reintrodução.
- **PERF-13-03:** `CHANGELOG.md` removido de `package.json#files[]` — −79 KB (unpacked) por install npm. Mantido em GitHub releases.

### Drift cleanup (manutenção recorrente)
- **DRIFT-13-01:** CHANGELOG entries para v1.11.0, v1.12.0, v1.12.1 backfilled (eram ausentes — publish workflow caía em fallback awk silencioso). Hard-fail gate adicionado: tag final (`vX.Y.Z`) sem entry no CHANGELOG agora aborta release com `::error::CHANGELOG entry missing`. Pre-release tags (`-rcN`/`-betaN`) preservam fallback graceful.
- **DRIFT-13-02:** README counters hardcoded substituídos pelos valores reais — `47 agents`, `87 commands`, `49 skills`, `20 gates` (drift original era +147%/+45%/+4800%/+300%). Auto-gen via prepublishOnly hook escopado para v1.14.
- **DRIFT-13-03:** `src/mcp-server/index.js` agora exporta `PKG_VERSION` lido de `package.json` (mesmo pattern de `bin/cli.js`). Removeu hardcoded `version: '0.1.0'` que vinha desde antes do GA. MCP `initialize` response agora retorna versão real.

### Tech debt documentado para v1.14
- 4 CVEs ativas em transitivas do `@modelcontextprotocol/sdk@1.29.0` (1 high `fast-uri` + 3 moderate `hono`/`ip-address`/`express-rate-limit`)
- 7 issues HIGH não tocadas: reverse-sync trust de projectRoot via MCP, CSP unsafe-inline + XSS via SSE no UI sidecar, /shutdown sem auth (CSRF same-origin), gate-runner tmpdir predictable, file-manifest.json não verificado em sync, reflect.js leak de ANTHROPIC_API_KEY em error, sync expansion para 8 IDEs em CI matrix
- T2 (terse mode em list-*), T3 (compatibility dedup em 27 agents), README counters auto-gen
- Total: ~14 items auditados, ranqueados, escopo pronto para v1.14

[Detalhes da auditoria que originou este milestone](./.planning/codebase/concerns.md) · [PRR-REPORT.md](./.planning/PRR-REPORT.md) · [TOIL-AUDIT.md](./.planning/TOIL-AUDIT.md) · [.planning/v1.13-MILESTONE-AUDIT.md](./.planning/v1.13-MILESTONE-AUDIT.md) · [v1.13-ROADMAP](./.planning/milestones/v1.13-ROADMAP.md)

## [1.12.1] - 2026-05-08

Hotfix patch — corrige race condition no hook `sidecar-tool-publisher.js` que dropava `tool_invocation` events antes do TCP flush completar, causando UI sidecar não receber a maioria dos eventos quando `process.exit(0)` era chamado imediatamente após `socket.write`.

### Corrigido

- **Hook `sidecar-tool-publisher.js` race condition** ([kit/hooks/sidecar-tool-publisher.js](kit/hooks/sidecar-tool-publisher.js), commit 56b327f) — antes: `socket.write(payload); process.exit(0)` causava o processo terminar antes do kernel TCP buffer flusher completar (especialmente em payloads > 1 KB ou com IDEs múltiplas competindo no mesmo socket). Resultado: eventos chegavam parcialmente ou não chegavam à UI sidecar. Fix: `await new Promise(resolve => socket.end(payload, resolve))` + `socket.on('close', () => process.exit(0))` — exit só acontece após TCP graceful close. Não afeta hot path performance — `process.exit` continua imediato em modo `--no-ui`.

### Sem mudanças de API

Patch isolado em 1 arquivo de hook. Stable API v1.0+ preservada. CLI/MCP/sync inalterados.

### Heads-up

Esse fix v1.12.1 cobre APENAS `sidecar-tool-publisher.js`. 6 outros hooks (`workflow-guard.js`, `prompt-guard.js`, `context-monitor.js`, `post-apply-migration.js`, `statusline.js`, `check-update.js`) tinham o mesmo padrão `process.exit` antes de TCP flush — endereçados separadamente na v1.13 Phase 80.

## [1.12.0] - 2026-05-08

Milestone v1.12 — Suíte Legacy Code Mastery & AI-Era Refactoring: incorpora técnicas de *Working Effectively with Legacy Code* (Michael Feathers, Prentice Hall, 2004) ao kit-mcp, modernizadas para a era IA/Supabase (2026). 38 REQs em 31 fases (Phases 48-78), distribuídos em 5 ondas. Princípio editorial: cada artefato marca explicitamente "Feathers original (2004)" vs "extensão IA/Supabase (2026)" — leitor sempre distingue livro vs modernização.

### Adicionado — 13 skills foundationais + modernizações IA (Ondas 1-2, Phases 48-60)

- 7 skills clássicas Feathers: `_shared-legacy/glossary`, `legacy-characterization-tests`, `legacy-seams-and-test-harness`, `legacy-sprout-wrap-techniques`, `legacy-effect-analysis`, `legacy-monster-methods`, `pre-refactor-characterization` (auto-trigger gate skill).
- 6 skills modernizações IA/Supabase sem precedente em 2004: `legacy-extract-class`, `legacy-programming-by-difference`, `legacy-api-only-applications` (Edge Functions wrappando Stripe/OpenAI/etc como caso paradigmático), `legacy-shotgun-surgery` (detecção via embeddings), `legacy-storytelling-naked-crc` (LLM produz primeiro draft do storytelling), `ai-prompt-characterization` (prompts como código legacy testável com `temperature=0` + seed fixo).

### Adicionado — 8 agents (Onda 3, Phases 61-68)

- 3 clássicos: `legacy-characterizer` (gera characterization tests com 7 grupos canônicos), `seam-finder` (decision tree por linguagem para 24 técnicas do cap 25), `refactor-safety-auditor` (gate runtime canônico — REFACTOR-SAFETY.md).
- 5 modernizações: `payload-capture-instrumenter` (instrumenta Edge Function via `mcp__supabase__get_logs`), `storytelling-analyst` (LLM gera mental model + CRC sketch), `shotgun-surgery-detector` (detecção semântica via `text-embedding-3-small` + pgvector clustering), `ai-mutation-tester` (LLM-generated mutants comportamentais), `observability-coverage-auditor` (audita Edge Functions × 4 golden signals × SLO × characterization).

### Adicionado — 10 commands (Onda 4, Phases 69-78)

- 5 clássicos: `/caracterizar`, `/encontrar-seams`, `/auditar-refactor`, `/refactor-seguro`, `/legacy <subcomando>` (5ª suíte da família após `/supabase`, `/observabilidade`, `/sre`, `/sre-resilience`).
- 5 modernizações: `/capturar-payloads`, `/caracterizar-prompt`, `/storytelling`, `/detectar-duplicacao`, `/auditar-observabilidade-cobertura` (entrega explícita do user request `/observability-audit` mencionado).

### Adicionado — 3 audit gates + 7 cross-suite integration patches (Onda 5, Phases 79-87)

- Gates: `legacy-refactor-safety` (auto-trigger pré-refactor de arquivo > 500 linhas OR contrato externo), `ai-prompt-stability` (consultive — prompts em produção têm characterization linkados), `observability-coverage` (opt-in threshold ≥ X% Edge Functions com golden signals + SLO + burn alert).
- Integration patches em 4 suítes: Observabilidade (omm-auditor Cap 1 consume legacy coverage), Supabase (supabase-edge-fn-writer ganha API-only adapter pattern), SRE (prr-conductor Axe 5 consome REFACTOR-SAFETY.md), e patches em planner/executor/verifier/forense para awareness de legacy.
- Skill nova `llm-as-dependency` cobrindo fakear OpenAI/Anthropic clients + deterministic test mode + modo offline em CI.

### Sem mudanças de API runtime

v1.12 é **content-only por design** — zero alterações em `src/core/`, `registry.js`, `sync.js`. Stable API v1.0+ preservada. Deps budget 6/6 mantido. Conteúdo PT-BR alinhado com v1.8/v1.9/v1.10/v1.11.

### Tests

Tests existentes (133 unit + 71 integration acumulados de v1.10) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`).

### Detalhes

`.planning/milestones/v1.12-ROADMAP.md`. Modernizações canônicas sem precedente em 2004 documentadas: LLMs como dependência testável, embeddings para semantic duplicate detection, IA como ferramenta de comprehension, Supabase Edge Functions como API-only application paradigmático, mutation testing com LLM-generated mutants comportamentais.

## [1.11.0] - 2026-05-08

Milestone v1.11 — Suíte SRE Resilience & Release Engineering: 2ª camada SRE derivada do livro Google SRE — caps **22 (Addressing Cascading Failures)** + **8 (Release Engineering)** — completando a Suíte SRE iniciada na v1.10. 24 REQs em 6 fases (Phases 42-47), distribuídos em 3 ondas: Núcleo SRE-2 (Phases 42-44), Integração com suítes existentes (Phases 45-46), Gates QA + docs (Phase 47). v1.11 é content-only por design — zero alterações em `src/core/`. Stable API v1.0+ preservada.

### Adicionado — 5 skills SRE-2 foundationais + glossary patch (Phase 42)

- Patch em `_shared-sre/glossary.md` — 3 blocos novos (vocabulário cap 22, vocabulário cap 8, anti-patterns explícitos sobre cascading e release).
- `cascading-failures` — cap 22 main: 7 triggers canônicos (server overload, resource exhaustion, service unavailability, etc.), positive feedback loops, prevent vs detect vs treat, server slow start, prevention via load shedding.
- `load-shedding-graceful-degradation` — cap 22 sub: concurrency limits, queue bounds, deadline-aware processing, rate limit por client, slow start.
- `retry-strategies` — cap 22 sub: exponential backoff + jitter, retry budget, deadline propagation (não retry quando deadline excedido), idempotency keys.
- `hermetic-builds` — cap 8 sub: build reproducibility via lockfiles + pinned base images, no-cache para release builds, attestations (SLSA framework).
- `release-engineering` — cap 8 main: release pipeline policy (4 stages — build, test, canary, rollout), feature flags como controle ortogonal a release, semver discipline, release tag como contract.

### Adicionado — 3 agents core SRE-2 (Phase 43)

- `cascading-failures-auditor` — analisa código para 7 triggers; gera `CASCADING-AUDIT.md` priorizado P0/P1/P2 com remediation por trigger.
- `load-shedding-instrumenter` — aplica patches de load shedding (concurrency limit, queue bound, deadline-aware processing, rate limit, slow start) em código de Edge Function ou serviço.
- `release-pipeline-auditor` — audita CI/CD em 3 dimensões (hermeticidade, reprodutibilidade, policy enforcement); scored 30 pts; gera `RELEASE-AUDIT.md`.

### Adicionado — 3 commands SRE-2 + extensão do `/sre` orchestrator (Phase 44)

- `/auditar-cascading`, `/load-shedding`, `/auditar-release` — invocam respectivos agents.
- Patch em `kit/commands/sre.md` — 3 subcomandos novos (`cascading`, `load-shedding`, `release`); 8 subcomandos totais (5 v1.10 + 3 v1.11).

### Adicionado — 4 cross-suite patches (Phase 45)

- `four-golden-signals/SKILL.md` ganha seção "Saturation as cascading failure trigger" com tabela threshold canônica (Saturation > 80% sustained → trigger #4 do cap 22).
- `prr-conductor.md` — Axe 4 (Capacity Planning) ganha 3 itens (cascading prevention, load shedding, game day); Axe 5 (Change Management) ganha 3 itens (hermetic build, release pipeline policy, release via tag).
- `supabase-edge-fn-writer.md` — bloco "v1.11 Adicional SRE Resilience" com 5 patterns built-in (timeout, retry+jitter, deadline propagation, load shedding, idempotency key) — Edge Function template ganha cascading-prevention by default.
- `omm-auditor.md` — Capacidade 1 (Resilience) consulta `CASCADING-AUDIT.md`; mapping P0/P1 count → score; regra absoluta "score Cap 1 > 3 exige CASCADING-AUDIT.md fresco ≤ 30d".

### Adicionado — patch em `/concluir-marco` (Phase 46)

- Bloco `<sre_resilience_integration>` com gate `release-pipeline-policy` opt-in (paralelo ao PRR gate v1.10); thresholds ROBUST/ADEQUATE/FRAGILE/BROKEN; toggle via flag `workflow.complete_milestone_release_pipeline_gate`.

### Adicionado — 1 audit gate (Phase 47)

- `gates/release-pipeline-policy.md` — audit gate parsing `RELEASE-AUDIT.md` score; default opt-in; threshold configurável via `workflow.release_pipeline_policy_threshold` (default ADEQUATE).

### Sem mudanças de API runtime

v1.11 é content-only por design — zero alterações em `src/core/`, `registry.js`, `sync.js`, ou no MCP server. Stable API v1.0+ totalmente preservada. CI passa sem mudança em `.github/workflows/`. Deps budget mantido em 6/6 (zero deps novas — todo o conteúdo é Markdown).

### Tests

Tests existentes (115 unit + 67 integration acumulados de v1.7) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`).

### Detalhes

`.planning/milestones/v1.11-ROADMAP.md`. Material-fonte: *Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016). ISBN 978-1-491-92912-4. Caps 22 + 8. Plus: SLSA framework, 12-factor app, DORA metrics.

## [1.10.0] - 2026-05-07

Milestone v1.10 — Suíte SRE Engagement: incorpora técnicas do livro *Site Reliability Engineering: How Google Runs Production Systems* (Beyer, Jones, Petoff, Murphy — Google/O'Reilly, 2016) ao kit-mcp. 32 REQs em 6 fases (Phases 36-41), distribuídos em 3 ondas: Núcleo SRE (Phases 36-38), Integração com suítes existentes (Phases 39-40), Gates QA + docs (Phase 41). Complementa a Suíte Observabilidade v1.9.0 (publicada 2026-05-06) e a Suíte Supabase v1.8.0 — juntas formam o stack production engineering do kit.

### Adicionado — 6 skills SRE foundationais (Phase 36)

Cada skill é auto-contida (sem `references/`), com frontmatter `description ≤ 200 chars`, template canônico de 5 seções (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Ver também), e cross-refs via Markdown link relativo.

- `_shared-sre/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN): SLI, SLO, SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals (latency/traffic/errors/saturation), risk continuum, MTTR, MTBF. Lista anti-patterns explícitos (alert fatigue, hero culture, SLO 99.99%+, fixed-window error budget, blame culture, mean-only latency, monitoring causes não symptoms).
- `sre-risk-management` — risk continuum (cap 3 livro Google SRE), 99.99% wisdom (user em 99% smartphone não distingue 99.99% vs 99.999%), error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more".
- `four-golden-signals` — Latency + Traffic + Errors + Saturation (cap 6), black-box vs white-box monitoring, distinção de latência success vs error, percentis vs mean (long tail), histograms com bucketing exponencial.
- `eliminating-toil` — definição canônica de toil (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50% (cap 5), padrões de automação, distinção toil vs overhead vs grungy work.
- `blameless-postmortems` — template canônico 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC), cultura blameless (cap 15), "no postmortem left unreviewed", Wheel of Misfortune para training.
- `production-readiness-review` — checklist PRR (cap 32) — 6 axes: System architecture, Instrumentation/Metrics/Monitoring, Emergency response, Capacity planning, Change management, Performance — com 3 modelos de engagement: Simple PRR, Early Engagement, Frameworks/SRE Platform.

### Adicionado — 4 agents SRE core (Phase 37)

Cada agent inclui tabela `## Compatibilidade` por IDE (Full / Partial / Offline-only), preflight detection MCP no Step 0 quando aplicável, e frontmatter `tools:` com nomes canônicos.

- `golden-signals-instrumenter` — especialização de `observability-instrumenter` (v1.9). Recebe código de serviço/Edge Function e retorna patches OTel com Latency=histogram bucketed exponencial, Traffic=counter por endpoint × method, Errors=counter por `error.type` enum 5-15 valores fechado (NUNCA `error.message`), Saturation=gauge resource-specific identificado explicitamente.
- `toil-auditor` — analisa repo + git log ≤ 90d + scripts shell + comandos manuais documentados em README/runbooks. Retorna `.planning/TOIL-AUDIT.md` listando candidatos a automação com priorização P0/P1/P2 e ROI = freq × tempo / esforço.
- `postmortem-writer` — recebe `--from-investigation <id>` (continuação de `incident-investigator` v1.9 — lê `.planning/investigations/<id>.md`) ou `--incident "<descrição>"` (standalone). Gera postmortem blameless seguindo template canônico de 9 seções em `.planning/postmortems/<id>.md`.
- `prr-conductor` — conduz Production Readiness Review para serviço/feature. Lê schema (Supabase MCP), Edge Functions code, SLOs definidos (`.planning/slos/`), audit logs. Produz `PRR-REPORT.md` scored em 6 axes com gaps e action items priorizados (P0 blocker / P1 scheduled).

### Adicionado — 6 commands SRE (Phase 38)

- `/sre <subcommand>` — orquestrador único (análogo a `/supabase` v1.8 e `/observabilidade` v1.9); dispatch via `Task(subagent_type=...)` com sinônimos PT/EN para os 5 comandos abaixo.
- `/golden-signals` — invoca `golden-signals-instrumenter` para serviço/Edge Function/fase; gera `GOLDEN-SIGNALS.md` por target com instrumentação OTel pronta.
- `/auditar-toil` — invoca `toil-auditor`; gera `.planning/TOIL-AUDIT.md`.
- `/postmortem` — invoca `postmortem-writer`; suporta flag `--from-investigation <id>` (continuar de investigation v1.9) ou `--incident "<descrição>"` (postmortem standalone).
- `/prr` — invoca `prr-conductor` para serviço/feature; usa flag `--service <name>` ou `--feature <description>`; gera `PRR-REPORT.md`.
- `/risk-budget` — exibe state atual de error budget vs risk continuum, citando SLOs definidos em v1.9 (lê `.planning/slos/`); aplica skill `sre-risk-management`.

### Adicionado — 3 audit gates novos (Phase 41)

Markdown specs em `gates/` com `## Check` em bash 3.2-portable (macOS default):

- `gates/golden-signals-coverage.md` (blocking, pre-verify) — verifica código de serviço/Edge Function tocado em fase tem os 4 golden signals presentes (regex sobre `histogram | counter | gauge | saturation`). Skip gracefully em projetos content-only (sem `supabase/functions/` / `src/` / `lib/`).
- `gates/postmortem-template-required.md` (blocking, pre-conclude) — em `/concluir-marco`, bloqueia se houve incident em `.planning/investigations/` sem `.planning/postmortems/` correspondente. `Status: INCONCLUSIVE` reconhecido como exceção (sem root cause = sem aprendizado a documentar). Princípio canônico: "no postmortem left unreviewed" (cap 15).
- `gates/prr-checklist-coverage.md` (blocking, pre-verify) — verifica que `PRR-REPORT.md` em `.planning/prr/**/*.md` cobre os 6 axes do PRR (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance) — pular um axe = aprovação inválida (regra absoluta da skill `production-readiness-review`).

### Adicionado — integração com Suíte Observabilidade v1.9 (Phase 39)

- **Skill `event-based-slos` (v1.9)** ganha bloco "Risk continuum" cross-referenciando `sre-risk-management`; explica que target SLO é escolha explícita no continuum risk × innovation, não meta arbitrária.
- **Agent `omm-auditor` (v1.9)** consulta `toil-auditor` para Capacidade 3 (Complexidade/Tech Debt). Score OMM-3 considera % de tempo em toil pelo time. Tabela 5-row Cap 3 (`< 15%` → 5 / `15-30%` → 4 / `30-50%` → 3 / `50-60%` → 2 / `> 60%` → 1) replicada como single source of truth distribuída.

### Adicionado — integração com Suíte Supabase v1.8 (Phase 39)

- **`supabase-edge-fn-writer`** ganha seção "Four Golden Signals" — template canônico de Edge Function inclui histogram de latência, counter de tráfego, counter de erros por error.type enum, gauge de saturação (recurso identificado explicitamente: pg_pool / concurrency_limit / pgmq.queue_length / egress_bandwidth conforme tipo de função).
- **`supabase-architect`** ganha menção a PRR — plano arquitetural sugere PRR antes de production; cross-ref para `production-readiness-review`. Tabela 6 axes adaptada ao contexto Supabase (single project = SPOF mitigado por branches Pro; Spend Cap; RLS git-versioned; declarative schema; load test com p99 baseline).
- **`supabase-migration-writer`** ganha alerta sobre toil — scripts SQL repetitivos (rebuild de índices manuais, vacuums recorrentes) são candidatos a automação via pg_cron; cross-ref para `eliminating-toil`.
- **`supabase-storage-implementer`** ganha saturation signal — uploads emitem gauge de bucket size + counter de quota near-exhaustion (thresholds 80% yellow / 95% red por plan: Free 1 GB / Pro 100 GB / Team 1 TB / Enterprise custom); cross-ref para `four-golden-signals`.

### Mudado — lifecycle hooks no fluxo framework (Phase 40)

Patches editoriais puramente aditivos em 3 commands de fluxo framework — frontmatter (`description`, `allowed-tools`) preservado byte-a-byte (anti-pitfall A2), workflows em `.claude/framework/workflows/*.md` continuam funcionais como antes.

- **`/forense`** ganha bloco `<sre_integration>` que sugere chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause `VALIDATED`. Distinção fundamental: forense diagnostica (read-only, evidence-based, científico — output em `.planning/forensics/`); postmortem documenta blameless para aprendizado organizacional (cap 15 — output em `.planning/postmortems/`). 3 condições de trigger sugerido + 3 exceções explícitas de não-trigger (INT-FW-V2-01).
- **`/concluir-marco`** ganha gate PRR opcional — quando `workflow.complete_milestone_prr_gate=true` (default `false`, opt-in até maturidade SRE), exige `PRR-REPORT.md` com status `passed` para features production-bound antes de arquivar. Status table 3-row (`passed` 6/6 axes ≥ 3/5 = arquivável / `passed-with-warnings` P1 pendente = arquivável com warnings / `failed` P0 reprovado = BLOQUEIA). Coexiste ortogonalmente com gate OMM regression v1.9 — OMM mede observability maturity, PRR mede production readiness (INT-FW-V2-02).
- **`/auditar-marco`** invoca `/auditar-toil` automaticamente quando `workflow.audit_milestone_toil=true` (default `true`); resultado `.planning/TOIL-AUDIT.md` alimenta scoring OMM Capacidade 3 via `omm-auditor`. Loop fechado canônico: `/auditar-marco` → `/auditar-toil` → `/auditar-observabilidade` → `omm-auditor` consulta `TOIL-AUDIT.md` → `OMM-REPORT.md` inclui Cap 3 → `MILESTONE-AUDIT.md` (INT-FW-V2-03).

### Mudado — README ganha seção "SRE Engagement suite (v1.10)"

`README.md` adiciona nova seção entre "Observability suite (v1.9)" e o separador `---` listando 6 skills + 4 agents + 6 commands + 3 audit gates + lifecycle integration + quick start example end-to-end (PRR antes de produção → instrumentação golden signals → após incident, postmortem chain). Citação canônica ao livro Google SRE 2016 em paridade com a citação a *Observability Engineering* na seção v1.9 (QA-SRE-04).

### Sem mudanças de API runtime

v1.10 é **content-only por design** — zero alterações em `src/core/`, `registry.js`, `sync.js`, ou no MCP server. Stable API v1.0+ totalmente preservada. CI passa sem mudança em `.github/workflows/`. Deps budget mantido em 6/6 (zero deps novas — todo o conteúdo é Markdown).

### Tests

Tests existentes (115 unit + 67 integration acumulados de v1.7) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`). Smoke validation por gate: PASS na codebase atual (kit-mcp content-only) + FAIL em fixture sintético com gaps + PASS em fixture sintético com cobertura completa — todos os 3 gates novos validados.

### Decisões arquiteturais

- **Conteúdo-only milestone** — zero alterações em `src/core/`. Toda integração com fluxo framework via patches editoriais nos commands `kit/commands/{forense,concluir-marco,auditar-marco}.md` (paridade com pattern v1.9 que adicionou bloco `<observability_integration>` aos mesmos commands).
- **Specialização sobre overlap** — `golden-signals-instrumenter` é especialização de `observability-instrumenter` (v1.9), não substituto: aquele cuida de spans/atributos canônicos, este cuida de métricas dos 4 signals; ambos podem coexistir num mesmo PR (chain canônica: `observability-instrumenter` primeiro → `golden-signals-instrumenter` segundo).
- **Chain v1.9 → v1.10** — `incident-investigator` (v1.9) fecha Core Analysis Loop com root cause `VALIDATED` em `.planning/investigations/<id>.md`; `postmortem-writer` (v1.10) consome via `--from-investigation <id>` para gerar `.planning/postmortems/<id>.md`. Handoff é state-based via filesystem (não API).
- **Gates blocking pre-verify** — `golden-signals-coverage` e `prr-checklist-coverage` são blocking (cobertura mínima é regra absoluta). `postmortem-template-required` é blocking pre-conclude (regra cap 15 "no postmortem left unreviewed" não admite warn-only após adoption).
- **PRR gate em `/concluir-marco` é opt-in** — diferente do gate OMM regression v1.9 (default `true`, estabelecido), o gate PRR v1.10 é default `false` até time amadurecer cultura SRE. Toggle via `workflow.complete_milestone_prr_gate=true`. Critério de "ligar gate": ≥ 2 dos 4 indicadores (paid feature, SLO definido, on-call rotation, postmortem culture).
- **Vendor-neutral** — gate `golden-signals-coverage` aceita qualquer pattern com `histogram` / `counter` / `gauge` (OTel, Prometheus, StatsD, Borgmon-like). Livro Google SRE descreve Borgmon mas é proprietário; gate é genérico.

### Detalhes

`.planning/milestones/v1.10.0/` (após `/concluir-marco`).

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
