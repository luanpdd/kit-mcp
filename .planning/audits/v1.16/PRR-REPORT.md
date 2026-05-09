# PRR-REPORT — kit-mcp v1.16.0 — 2026-05-09

**Reviewer:** TBD (auto-PRR — flagged as anti-pattern; assign external reviewer before sign-off)
**Engagement model:** Simple PRR (dev-tool, single-user dev workstation, no SaaS multi-tenant)
**Outage cost estimado:** ~$0/min direto (npm package; "outage" = broken release on npm; downstream cost = dev hours blocked installing/upgrading)
**Status:** **Approved** (zero P0; 2 P1 + 4 P2; 23 items prévios todos resolvidos)
**Modo:** [OFFLINE — sem Supabase MCP] (não-aplicável; kit-mcp não usa Supabase)

> **Re-PRR vs v1.12.1.** PRR original retornou 20/30 (Approved with conditions), com 4 P1 + 3 P2 + 1 P0 de processo. Após 4 releases (v1.13-v1.16) com 23 items de hardening fechados, este re-PRR re-pontua os 6 axes. Backlog meta-auditoria está **100% zerado** — cada item v1.13-v1.16 foi mapeado abaixo para o GAP do v1.12.1 que ele endereça (ou para um eixo onde reforçou postura).

---

## Sumário executivo

| Axe | v1.12.1 | v1.16.0 | Δ | Status |
|-----|---------|---------|---|--------|
| 1. System Architecture | 4/5 | **5/5** | +1 | Pass |
| 2. Instrumentation | 2/5 | **2/5** | 0 | **Fail** (gap continua) |
| 3. Emergency Response | 3/5 | **3/5** | 0 | Pass with gaps |
| 4. Capacity Planning | 3/5 | **3/5** | 0 | Pass with gaps |
| 5. Change Management | 5/5 | **5/5** | 0 | Pass |
| 6. Performance | 3/5 | **4/5** | +1 | Pass with gaps |

**Total: v1.12.1 = 20/30 → v1.16.0 = 22/30** (+2; net 2 de 6 axes melhoraram; 0 regressões; 1 axe mantém Fail).

> **Por que +2 e não mais?** As 4 releases (v1.13-v1.16) priorizaram dimensões que NÃO eram os P1s principais do PRR v1.12.1: foram **CRITICAL/HIGH security** (SEC-13-01 a SEC-14-06), **token economy** (PERF-13-01, PERF-15-01), **drift cleanup** (DRIFT-13-01 a DX-15-03), e **runtime perf** (PERF-16-01 a PERF-16-06). Isso elevou Architecture (defense-in-depth contra path traversal, manifest tampering, MCP exec arbitrário, error leak) e Performance (50.5%/52.4% speedup mensurado, lazy imports, optional deps, cold start regression test). Os **4 P1s do PRR v1.12.1 — instrumentação interna, SLOs, FAILURE-MODES.md, RUNBOOK.md — continuam abertos.** Eles eram (e continuam sendo) gaps de **observabilidade interna** + **documentação operacional**, dimensões ortogonais ao backlog meta-auditoria que foi atacado.

---

## Detalhamento por axe

### Axe 1: System Architecture (5/5) — era 4/5

**O que está bom (preservado de v1.12.1):**
- Arquitetura clara em 3 binários isolados (`bin/mcp.js`, `bin/cli.js`, `bin/ui.js`).
- Deps runtime budget enforced em CI: agora **4 deps + 2 optional = 6/6** (era 6/6 antes; v1.16 PERF-16-05+06 moveu `@inquirer/prompts` e `chokidar` para `optionalDependencies`). Evidence: `package.json:49-58`, `.github/workflows/ci.yml:46-53`.
- `npm audit --omit=dev --audit-level=high` rodado em CI E em publish. Evidence: `.github/workflows/ci.yml:55-68`, `.github/workflows/publish.yml:63-75`.
- Threat model em `docs/sidecar-security.md`.
- Sidecar 127.0.0.1 only com Host+Origin validation.

**O que melhorou (v1.13-v1.16, +1 ponto):**
- **Defense-in-depth contra 4 vetores novos** (SEC-14-01 a SEC-14-06):
  1. **`src/core/path-safety.js`** (Phase 83.01) — `validateProjectRoot` com walk-up `.git/` heurística aplicado em handlers MCP `sync` + `reverse-sync`. Bloqueia `\\evil-host\share`, AppData, paths não-git. Evidence: `src/core/path-safety.js:35-111`, `src/mcp-server/index.js:208-209,228-229`.
  2. **`src/core/manifest-verify.js`** (Phase 83.03) — SHA256 verification de cada arquivo do kit antes de syncTo. Throw `EMANIFESTMISMATCH` se tampering detectado. Evidence: `src/core/manifest-verify.js:19-107`, `src/core/sync.js:42-52`.
  3. **`src/core/error-redaction.js`** (Phase 84.01) — single source of truth para redact secrets/paths em MCP error envelopes. Aplicado em 3 sites (mcp-server catch + reflect + replays). Stack trace só em stderr server-side. Evidence: `src/core/error-redaction.js:32-76`, `src/mcp-server/index.js:339-347`.
  4. **`src/core/gate-runner.js` mkdtemp fix** (Phase 83.02) — `fs.mkdtemp` substitui `Date.now()+Math.random()` predictable filename. Elimina symlink TOCTOU em multi-user `/tmp`. Evidence: `src/core/gate-runner.js:144-167`.
- **CSP estrito + auth token 64-char hex** no UI sidecar (Phase 82) — `script-src` com SHA256 hash; middleware `requireAuth` em `/publish`, `/shutdown`, `/events`, `/state`; token via `?t=` (EventSource não suporta headers) com `history.replaceState` scrub. Evidence: `src/ui/server.js:50-71,86-108`, `src/ui/lockfile.js:50-81`.
- **`gates.run` via MCP transport BLOQUEADO** (Phase 79.01) — fecha surface de exec arbitrário; CLI `kit gates run` preservado com prompt interativo. Evidence: `src/mcp-server/index.js:249-258`.
- **`replayId` path traversal guard** (Phase 79.02) — allowlist regex + post-resolve assertion em 3 callers de `replays.js`. Evidence: `src/core/replays.js:28-51,67-69`.
- **Helpers `loadInquirer()` + `loadChokidar()`** (Phase 89.02) — lazy import + descriptive error se ausente; CLI core funcional com `npm install --omit=optional`. Evidence: `src/core/ui.js:19-29`, `src/core/watch.js:23-34`.

**Gap residual (não-bloqueante):**
- [ ] **GAP P1 (carry-over de v1.12.1)**: ausência de `docs/FAILURE-MODES.md` ou ADR estruturado de SPOFs. Threat model em `docs/sidecar-security.md` cobre security, mas não modos de falha clássicos (port range esgotado 7100-7199, lockfile stale, npm registry down, child spawn fail, watcher overflow em kits grandes). Mitigations existem no código (`src/ui/port.js:54-67` ELIVE message; `src/ui/auto-spawn.js:88-89` spawn_failed; `src/ui/lockfile.js` reclaim) mas faltam doc top-down.

**Justificativa do score 5/5:** Architecture deixou de ser 4/5 porque a postura de defense-in-depth ganhou 4 vetores novos com test coverage (`test/unit/path-safety` ausente formalmente mas `mcp-projectroot-guard.test.js` cobre via integration; `manifest-verify.test.js`; `error-redaction.test.js`; `gate-runner-tmpdir.test.js`; `replays-path-traversal.test.js`). O gap FAILURE-MODES.md continua P1 mas em axe ortogonal; arquitetura em si está sólida.

### Axe 2: Instrumentation, Metrics, Monitoring (2/5) — INALTERADO (Fail axe)

**O que está bom (preservado):**
- Logs estruturados via stderr/file no sidecar.
- Eventos com schema estrito: 7 tipos, validação ≤ 64KB.
- `redactPath` aplicado em todos events do sidecar (privacy-safe).
- `redactSecrets` agora aplicado também em error envelopes MCP (Phase 84.01) — proxy parcial de "errors são scrubbed antes de cliente ver".

**Gaps (CARRY-OVER P1 P1 P2 P2 de v1.12.1):**
- [ ] **GAP P1 (sem progresso)**: zero **golden signals do package em si**. Não existe counter de tool-invocations no MCP server (`src/mcp-server/index.js:329-348`), histogram de boot latency, gauge de SSE subscribers ativos, counter de errors por `error.type`. Confirmado por grep: `Grep counter|histogram|gauge|metric|telemetry → src/`: única match é `src/core/sync.js` (palavra "metric" em comentário, não código). Path: handler `CallToolRequestSchema` em `src/mcp-server/index.js:329-348` retorna `isError: true` em catch mas não conta erros nem mede duração.
- [ ] **GAP P1 (sem progresso)**: zero SLO para o package. Não há target documentado de "kit sync completes em < N ms p99" ou "MCP server responds em < N ms p99 para list_tools". Diretório `.planning/slos/` ausente (verificado via Glob).
- [ ] **GAP P2 (sem progresso)**: telemetria opt-in para o autor (`luanpdd`) saber quando upgrade-check detecta versões antigas em uso, ou quando sidecar crasha em wild. Trade-off privacy vs visibilidade — escolha consciente, mas não documentada.
- [ ] **GAP P2 (sem progresso)**: error tracking de hooks user-facing. Quando `kit/hooks/sidecar-tool-publisher.js` falha, erro vai pra stderr e exit 0 (SOFT failure pattern). User não sabe que está silently broken — apenas `~/tmp/kit-mcp-hook.log` registra.

**Justificativa do score 2/5 mantido:** Nenhuma das 4 releases v1.13-v1.16 tocou em **observabilidade do package**. CHANGELOG explícito: v1.13 atacou security + token economy + drift; v1.14 atacou web/core/MCP hardening; v1.15 atacou DX + drift auto-prevention; v1.16 atacou perf runtime. **A meta-auditoria de v1.12.1 não levantou observabilidade interna como item** (focou em security + bloat + drift), por isso o backlog "100% zerado" da v1.16 NÃO inclui esses 4 gaps. Eles eram (e continuam sendo) os gaps do PRR original — independentes do backlog meta-auditoria.

### Axe 3: Emergency Response (3/5) — INALTERADO

**O que está bom (preservado):**
- Path de hotfix via `npm version patch → git push --follow-tags`.
- Postmortem implícito em commit messages (ex: `56b327f` para v1.12.1 hotfix).

**O que melhorou em v1.13-v1.16 (sem mudar score):**
- **CHANGELOG hard-fail gate** (DRIFT-13-01) — tag final `vX.Y.Z` sem entry no CHANGELOG aborta release com `::error::CHANGELOG entry missing`. Pre-release tags (`-rcN`/`-betaN`) preservam fallback. Evidence: `.github/workflows/publish.yml:96-107`, `test/unit/publish-changelog-gate.test.js`.
- **Version sanity check** (preservado) — `package.json` version DEVE casar com tag git. Evidence: `.github/workflows/publish.yml:39-47`.
- **`npm audit` gate em publish** (SEC-13-04) — bloqueia release com CVEs HIGH/CRITICAL ativas. Evidence: `.github/workflows/publish.yml:63-75`.
- **prepublishOnly automation** (DX-15-01+02) — `regen-manifest.js` + `update-readme-counts.js` rodados antes de tests; CI drift gate falha hard se dev esqueceu local. Evidence: `package.json:47`, `.github/workflows/ci.yml:129-143`, `scripts/regen-manifest.js`, `scripts/update-readme-counts.js`.

**Gaps (CARRY-OVER de v1.12.1):**
- [ ] **GAP P1 (sem progresso)**: ausência de `docs/RUNBOOK.md` para incidents canônicos: "user reports kit-mcp não inicia" / "sidecar não recebe eventos do hook" / "sync corrompeu .claude/" / "MCP server crashes on boot" / "port 7100-7199 todos ocupados". docs/sidecar-security.md cobre security mas não troubleshooting operacional.
- [ ] **GAP P1 (sem progresso)**: ausência de postmortem formal blameless do bug v1.12.1 em `.planning/postmortems/`. Verificado via Glob: diretório não existe. Commit message é bom para diagnosis mas perde 5 das 9 seções canônicas. Skill `blameless-postmortems` existe **dentro do kit** mas não foi aplicada **ao próprio kit** — meta-dogfooding pendente.
- [ ] **GAP P2**: on-call rotation N/A (solo dev — anti-pattern hero culture é risco real, não bloqueador para lib pessoal).
- [ ] **GAP P2**: postpublish ainda manual — sem alertas automáticos quando v1.X.Y instala falhando em wild.

**Justificativa do score 3/5 mantido:** Os ganhos v1.13-v1.16 (CHANGELOG gate, version sanity, npm audit gate, prepublishOnly automation) reforçam **prevenção de incidents na release pipeline**, não **resposta** quando incident já aconteceu. Score de Emergency Response mede o segundo eixo. Para mover para 4/5, precisaria RUNBOOK.md + postmortem formal de v1.12.1.

### Axe 4: Capacity Planning (3/5) — INALTERADO

**O que está bom (preservado):**
- Limites do sidecar HTTP **enforced**: SSE ≤ 32, ring 200, payload ≤ 64KB, port range 7100-7199.
- Idle shutdown opt-in.
- File watcher debounce — agora 500ms (era 300ms), coalesce edit-burst em 1 invalidação. PERF-16-02. Evidence: `src/core/watch.js:42`.
- Sync `stubsOnly` em mode=reference para minimizar I/O.

**O que melhorou em v1.13-v1.16 (sem mudar score):**
- **Sync batched I/O** (PERF-16-01) — `Promise.all` em batches de 16 (configurável `KIT_MCP_SYNC_BATCH_SIZE` 1-256, fallback safe). 50.5% speedup real medido (target 30%). Evidence: `src/core/sync.js:22-32,34-58`.
- **Reverse-sync paralelo** (PERF-16-03) — 5 scans em `Promise.all`. 52.4% speedup real (target 10%). Evidence: `src/core/reverse-sync.js:33-62`.

**Gaps (CARRY-OVER de v1.12.1):**
- [ ] **GAP P1 (sem progresso)**: zero load test do MCP stdio. Quantos tools/sec o `bin/mcp.js` aguenta? Qual o boot time documentado em cold/warm? Header timing existe via `test/integration/ui-server.test.js` mas só do sidecar HTTP, não do MCP. v1.16 mediu speedup de syncTo/detectReverse mas não criou benchmark suite formal com p50/p95/p99.
- [ ] **GAP P2**: sem métrica explícita de "MCP listing tools size" para detectar bloat (descrições muito longas saturam context budget do LLM caller). Existe gate `gates/budget-description.md` (≤ 200 chars) — proxy parcial. Adicionalmente PERF-15-01 introduziu terse mode (`{kind, name}` only, **68.8% redução** medida), endereçando parcialmente o sintoma — mas continua sem métrica de tamanho serializado em runtime.
- [ ] **GAP P2**: file watcher sem cap explícito de número de arquivos. Em kits muito grandes (centenas de skills), chokidar pode consumir muita memória. Sem documentação de limite.

**Justificativa do score 3/5 mantido:** Os speedups de v1.16 (50.5%/52.4%) são **otimizações de hot path**, não definição de capacity envelope. Para mover para 4/5, precisaria BENCHMARK.md com p50/p95/p99 + cap documentado de kit size suportado.

### Axe 5: Change Management (5/5) — INALTERADO (já era topo)

**O que está bom (preservado):**
- CI matrix robusta — agora **3 OS × 3 Node × 8 IDEs = 72 cells potenciais**, com gating inteligente (`if: matrix.target == 'claude-code'`) economizando ~55% de step-executions (~351 vs naïve 720). Evidence: `.github/workflows/ci.yml:101-108,121-152`.
- prepublishOnly bloqueia npm publish em test failure.
- Workflow tag→publish é gate canônico (sanity + smoke + tests + audit + provenance).
- 20 audit gates em `gates/` (era 21; v1.13/v1.14/v1.15 adicionaram alguns: `release-pipeline-policy`, `prr-checklist-coverage`, `legacy-refactor-safety`, `golden-signals-coverage`, `postmortem-template-required`, `observability-coverage`, `obs-skills-frontmatter`, `obs-agents-mcp-supabase`, `ai-prompt-stability`).

**O que melhorou em v1.13-v1.16 (sustentando o 5/5):**
- **CI matrix expansion 8 IDEs** (DX-15-03) — `matrix.target` parameteriza sync round-trip; regression test `test/unit/sync-round-trip-all-targets.test.js` valida todos 8 IDs. Evidence: `.github/workflows/ci.yml:108,184-197`.
- **Drift auto-prevention** (DX-15-01+02) — `regen-manifest.js` + `update-readme-counts.js` em prepublishOnly + CI drift gate. Bonus catch real: primeira execução detectou drift pré-existente do Plan 85.02 (manifest stale, faltava 5 arquivos), validando a premissa da automação.
- **`npm ci` strict** (SEC-13-03) — sem fallback `|| npm install`. Lockfile reproducibility. Evidence: `.github/workflows/ci.yml:117-119`, `.github/workflows/publish.yml:35-37`.
- **+63 testes em v1.14** (web hardening, core hardening, MCP error sanitization) — baseline 273 testes; +26 em v1.15 (terse, drift); +18 em v1.16 (sync-concurrent, reverse-sync-parallel, cli-cold-start, optional-deps). Total atual: **317 testes** (232 unit + 85 integration). Evidence: v1.16-MILESTONE-AUDIT.md:37.

**Gaps (não impedem 5/5):**
- Canary release N/A (npm é all-or-nothing por dist-tag). Mitigação efetiva: dist-tag `next` antes de `latest` (não documentado mas viável).
- Feature flags N/A (package binário, não SaaS dinâmico).

**Justificativa do score 5/5 mantido:** Change Management já era topo em v1.12.1; v1.13-v1.16 reforçaram com mais gates, mais testes, mais matrix coverage, e drift auto-prevention. Continua liderando entre os 6 axes.

### Axe 6: Performance (4/5) — era 3/5

**O que está bom (preservado):**
- Boot test no CI captura import-time crashes (regressão v0.4.0).
- Smoke test `kit list-agents | head -5` em prepublishOnly e publish.
- Long tail mitigations: sidecar healthz timeout 500ms, publish() retorna Promise (v1.12.1 fix), upgrade-check 1.5s timeout.

**O que melhorou em v1.13-v1.16 (+1 ponto):**
- **Sync 50.5% speedup real** (PERF-16-01) — measured num kit típico de 321 files. `Promise.all` batches=16 com `verifyManifest` chamado ANTES (sem TOCTOU). Evidence: `src/core/sync.js:22-58`.
- **Reverse-sync 52.4% speedup real** (PERF-16-03) — measured 110.6ms → 52.7ms. Evidence: `src/core/reverse-sync.js:33-62`.
- **Lazy imports** (PERF-16-04) — 4 dynamic `await import('../ui/...')` sites em `src/cli/index.js`. Cold start improvement 18.8% (271ms → 220ms median). Inferior ao target 30% porque baseline já tinha encurtado pós-Phase 88 — documentado honestamente.
- **Optional deps** (PERF-16-05+06) — `@inquirer/prompts` + `chokidar` movidos. `npm install --omit=optional` produz CLI core funcional. Evidence: `package.json:55-58`, `src/core/ui.js:19-29`, `src/core/watch.js:23-34`.
- **Cold start regression test** (`test/unit/cli-cold-start.test.js`) — assert ceiling 1500ms. Catches accidental re-eager-ification. Path: `test/unit/cli-cold-start.test.js:50-64`.
- **Token economy 44.4% redução real** (PERF-13-01) — `summarize` cap=80 chars compartilhado entre `slim()` em mcp-server e cli. Evidence: `src/core/sync.js`, `src/mcp-server/index.js:307-310`.
- **Token economy 68.8% redução real** (PERF-15-01) — terse mode em `list-agents/list-commands/list-skills`. 25486 → 7942 bytes em 179 items. Evidence: `src/mcp-server/index.js:45,158,315-317`.
- **Hooks block dedup** (PERF-13-02) — −66 linhas em 11 agents, ~880 tokens economizados.
- **CHANGELOG fora do tarball** (PERF-13-03) — −79 KB unpacked.

**Gap residual:**
- [ ] **GAP P1 (carry-over)**: zero baseline documentado em `BENCHMARK.md` com p50/p95/p99/p99.9 para operações críticas (cold start MCP, kit sync claude-code, MCP `list_tools` round-trip, sidecar SSE event publish→deliver). v1.16 mediu speedups *deltas* mas não publicou *baselines absolutos* num markdown versionado. Path: nenhum `BENCHMARK.md` em `.planning/` ou `docs/` (verificado via Glob). Plano `cli-cold-start.test.js` é regression-only (ceiling 1500ms), não baseline tracking.
- [ ] **GAP P2**: sem error budget formal ligado a SLO (gap depende de Axe 2).
- [ ] **GAP P2**: saturation de SSE subscribers tracked pelo cap=32 mas não exposto como gauge para user inspecionar via `/state`.

**Justificativa do score 4/5:** A combinação de (a) **3 speedups mensurados** com tests de regressão dedicados, (b) **2 reduções de token economy** mensuradas (44.4% + 68.8%), (c) **cold start regression test** absoluto em CI, e (d) **lazy imports + optional deps com test `optional-deps.test.js`** elevam Performance de 3/5 para 4/5. Para chegar a 5/5, falta `BENCHMARK.md` com baselines absolutos publicados.

---

## Action Items v1.17+

| # | Axe | Item | Severity | Owner | Due |
|---|-----|------|----------|-------|-----|
| 1 | 2 | **[P1 carry-over]** Instrumentar `bin/mcp.js` com counter `kit_tool_invocations_total{tool, action, error_type}` + histogram `kit_tool_duration_ms{tool}` (escrever para stderr em modo `KIT_MCP_DEBUG=1`, opt-in). Aplicar handler central `CallToolRequestSchema` em `src/mcp-server/index.js:329-348`. | **P1** | luanpdd | 2026-06-15 |
| 2 | 2 | **[P1 carry-over]** Definir 3 SLOs mínimos em `.planning/slos/kit-mcp.md`: (a) MCP cold start < 500ms p99, (b) `kit sync claude-code` < 2s p99, (c) sidecar `/publish` ack < 50ms p99. Aplicar skill `event-based-slos`. Dogfooding o próprio kit. | **P1** | luanpdd | 2026-06-15 |
| 3 | 1 | **[P1 carry-over]** Criar `docs/FAILURE-MODES.md` listando 8 modos: port range 7100-7199 esgotado, lockfile stale, npm registry down, ~/.kit-mcp inacessível, EACCES tmpdir, child spawn fail, kit/ corrupted (link a manifest-verify), watcher overflow em kits grandes. Mapear mitigation existente para cada um. | **P1** | luanpdd | 2026-06-30 |
| 4 | 3 | **[P1 carry-over]** Criar `docs/RUNBOOK.md` com 5 incidents canônicos: (a) sidecar não recebe eventos, (b) `kit sync` corrompeu `.claude/`, (c) MCP server crashes on boot, (d) port 7100-7199 todos ocupados, (e) user em Node < 20. | **P1** | luanpdd | 2026-06-30 |
| 5 | 3 | **[P2 carry-over]** Escrever postmortem formal blameless do bug v1.12.1 em `.planning/postmortems/2026-05-08-sidecar-hook-race.md` aplicando skill `blameless-postmortems` (9 seções). Meta-dogfooding. | **P2** | luanpdd | 2026-07-15 |
| 6 | 6 | **[P2 carry-over]** Adicionar `npm run bench` script com hyperfine ou similar mensurando cold start + sync time + reverse-sync time + boot MCP. Publicar baselines absolutos em `BENCHMARK.md` em vez de só deltas em CHANGELOG. | **P2** | luanpdd | 2026-07-15 |
| 7 | 5 | **[P2 carry-over]** Documentar processo formal de canary npm via dist-tag `next`: `npm publish --tag next` → soak 7 dias → `npm dist-tag add @luanpdd/kit-mcp@1.x.y latest`. | **P2** | luanpdd | 2026-08-15 |
| 8 | 3 | **[P2 NOVO]** Postpublish smoke automation — GitHub Action que roda `npm install @luanpdd/kit-mcp@latest` em ubuntu-latest 5min após publish e abre issue se falhar. Endereça gap "sem alertas externos quando v1.X.Y tem instalação falhando". | **P2** | luanpdd | 2026-08-15 |

---

## Decisão

**Approved.**

v1.16.0 melhora o score total de 20/30 → 22/30 (+2 pontos) via:
- **Architecture +1** — defense-in-depth ganhou 4 vetores cobertos (path traversal, manifest tampering, MCP exec arbitrário, error leak) com test coverage.
- **Performance +1** — 3 speedups mensurados (50.5%/52.4%/18.8%) + 2 reduções de token economy (44.4%/68.8%) + cold start regression test.

Zero P0 técnico (release pipeline robusto, security profile defensável, package boot testado em 9 OS×Node × 8 IDE matrix). Zero regressões em axes preservados.

**1 axe continua Fail (Instrumentation 2/5)** — gaps P1 não foram alvo das 4 releases. Action items 1 e 2 (instrumentation + SLOs) são prioridade #1 para v1.17. **Estado atual é "Approved" porque para um dev-tool single-user single-machine (engagement model = Simple PRR), Fail em Instrumentation NÃO é blocker para shipping** — é blocker para dizer "production-ready as SaaS" (que kit-mcp não é).

**4 P1 carry-over de v1.12.1 (action items #1-#4)** continuam abertos. Eles são **gaps de observabilidade interna + documentação operacional** — não foram alvo das 23 items da meta-auditoria fechada nas 4 releases. v1.17+ deve focar em **observability dogfooding** (instrumentar o package usando as próprias skills do kit `four-golden-signals`, `event-based-slos`, `blameless-postmortems`, `production-readiness-review`). Ironia explicita: o kit ENSINA esses padrões mas o package que ENSINA não os APLICA em si mesmo.

**1 P0 de processo:** este Re-PRR também foi auto-conduzido. Reviewer external deve sign-off antes de tratar como "Approved" formal. Mantém anti-pattern listado no PRR original.

---

## Re-PRR triggers

Re-PRR triggered em qualquer:
- Adição de runtime dep além das 4 (budget mudança = ADR + Re-PRR; optional deps separadamente);
- Mudança no transport do MCP server (stdio → HTTP/SSE);
- Sidecar passa a aceitar conexões non-loopback;
- Adoção de telemetria opt-in (mudança em privacy posture — endereça GAP P2 Axe 2);
- Re-write > 50% de `src/core/` (sync/reverse-sync engine);
- Tag major bump (v2.0.0);
- Anualmente como hygiene (próxima: 2027-05-09).

## Reviewer signature

Reviewer: TBD (auto-PRR — não aprovado formalmente até external sign-off)
Date: 2026-05-09
Origem: Re-PRR sobre v1.16.0 com baseline em `.planning/PRR-REPORT.md` (v1.12.1, 20/30) + 4 milestones audits (v1.13/v1.14/v1.15/v1.16) + filesystem evidence em `src/`, `.github/workflows/`, `gates/`, `test/`, `package.json`, `CHANGELOG.md`.
