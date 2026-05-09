# PRR-REPORT — kit-mcp v1.12.1 — 2026-05-09

**Reviewer:** TBD (auto-PRR — flagged as anti-pattern; assign external reviewer before sign-off)
**Engagement model:** Simple PRR (dev-tool, single-user dev workstation, no SaaS multi-tenant)
**Outage cost estimado:** ~$0/min direto (npm package; "outage" = broken release on npm; downstream cost = dev hours blocked installing/upgrading)
**Status:** **Approved with conditions** (4 P1 + 3 P2; zero P0)
**Modo:** [OFFLINE — sem Supabase MCP] (não-aplicável; kit-mcp não usa Supabase)

> **Adaptação de contexto:** kit-mcp NÃO é SaaS — é npm package + CLI + 3 binários (`bin/mcp.js` MCP stdio, `bin/cli.js` CLI, `bin/ui.js` HTTP localhost sidecar). Roda **single-user, single-machine, loopback-only**. Os 6 axes do PRR canônico (cap 32 livro Google SRE) foram reinterpretados para o contexto dev-tool publisher: "redundância de réplicas" → "package isolation"; "load balancing" → N/A; "RPS por tenant" → "MCP message rate"; "canary release" → "tag bump → npm publish workflow"; "p99 latency" → "cold start + sync time".

---

## Sumário executivo

| Axe | Score | Status | Justificativa curta |
|-----|-------|--------|--------------------|
| 1. System Architecture | **4/5** | Pass with gaps | Bins isolados, deps com budget hardcoded em CI, mas zero ADR estruturado de SPOFs |
| 2. Instrumentation | **2/5** | Fail | Zero telemetria opt-in do package em si; logs ad-hoc stderr; sem version-check error metrics |
| 3. Emergency Response | **3/5** | Pass with gaps | npm dist-tag rollback documentado em README; sem RUNBOOK.md; sem on-call (solo) |
| 4. Capacity Planning | **3/5** | Pass with gaps | SSE cap=32, ring=200, body=64KB hardcoded e enforced; sem load test do MCP stdio |
| 5. Change Management | **5/5** | Pass | CI matrix 3 OS × 3 Node, prepublishOnly, tag→workflow gate, 21 audit gates blocking |
| 6. Performance | **3/5** | Pass with gaps | Boot test em CI, latência sidecar SSE com heartbeat 15s; sem baseline p50/p99 documentado |

**Total: 20/30** — package é production-ready com gaps em observabilidade e documentação operacional.

---

## Detalhamento por axe

### Axe 1: System Architecture (4/5)

**O que está bom:**
- Arquitetura clara em 3 binários isolados — `bin/mcp.js` (stdio MCP), `bin/cli.js` (CLI), `bin/ui.js` (HTTP sidecar). Zero acoplamento estrutural entre eles. Evidence: `D:\projetos\opensource\mcp\package.json:6-9`, `D:\projetos\opensource\mcp\bin\mcp.js:1-7`, `D:\projetos\opensource\mcp\bin\cli.js:1-3`, `D:\projetos\opensource\mcp\bin\ui.js:1-75`.
- Deps runtime com budget hardcoded e enforced em CI: 6/6 (`@modelcontextprotocol/sdk`, `commander`, `chokidar`, `picocolors`, `@inquirer/prompts`, `open`). Evidence: `.github\workflows\ci.yml:46-53` (BUDGET=6 com fail explícito) e `package.json:50-57`.
- `npm audit --omit=dev --audit-level=high` rodado em CI. Evidence: `.github\workflows\ci.yml:55-68`.
- Threat model documentado: `docs\sidecar-security.md:1-80` lista 5 ataques mitigados (DNS rebinding, path leak, stdout poisoning, SSE leak, XSS) + 3 trade-offs aceitos conscientemente (sem auth, sem TLS, supply-chain audit-only).
- Sidecar rigorosamente loopback: `HOST = '127.0.0.1'` hardcoded, Host+Origin validation. Evidence: `src\ui\server.js:32`, `:60-74`.
- MCP server tem stdout reservado para JSON-RPC; sidecar logs vão pra stderr; CI gate rejeita PR com `console.log` em `src/ui/`. Evidence: `.github\workflows\ci.yml:18-38` e `src\ui\server.js:53-56`.

**Gaps:**
- [ ] **GAP P1**: ausência de `FAILURE-MODES.md` ou ADR estruturado de SPOFs. Threat model em `docs/sidecar-security.md` cobre security mas não modos de falha clássicos (port range esgotado 7100-7199, lockfile stale, npm registry down, ~/.kit-mcp inacessível, EACCES em tmpdir, child process spawn falhar no `auto-spawn.js`). Existem mitigations no código (`src\ui\port.js:54-67` ELIVE message; `src\ui\auto-spawn.js:88-89` spawn_failed; `src\ui\lockfile.js` reclaim) mas não há doc top-down.
- [ ] **GAP P2**: graceful degradation não testado em chaos test sintético (ex.: npm registry offline durante upgrade-check). Implementação trata via fallback gracioso (`src\cli\upgrade-check.js:121-124` "offline" branch), mas teste end-to-end de degradação está em `test/integration/ui-hardening.test.js` apenas para o sidecar — não para falha de network do upgrade-check.

### Axe 2: Instrumentation, Metrics, Monitoring (2/5)

**O que está bom:**
- Logs estruturados via stderr/file dentro do sidecar (JSON parseável com `ts`, `obj`). Evidence: `kit\hooks\sidecar-tool-publisher.js:119-125` (debugLog appendFileSync `~/tmp/kit-mcp-hook.log`).
- Eventos do sidecar têm schema estrito: 7 tipos (`run.start | run.end | tool_invocation | progress | milestone | error | shutdown`), validação de payload ≤ 64KB, frozen enum. Evidence: `src\ui\events.js:7-15`, `:39-62`.
- `redactPath` aplicado uniformemente antes de toda emissão de evento (privacy-safe). Evidence: `src\ui\wrapper.js:36-58`, `:101` (`redactPath({ tool, ...progress }, projectRoot)`).
- Upgrade check não-bloqueante com cache 24h e timeout 1.5s. Evidence: `src\cli\upgrade-check.js:17-18`.

**Gaps:**
- [ ] **GAP P1**: zero **golden signals do package em si**. Não existe counter de tool-invocations no MCP server, histogram de boot latency, gauge de SSE subscribers ativos, counter de errors por `error.type`. O sidecar é uma **plataforma de observação para o IDE** (que recebe eventos do hook), mas o MCP server (`bin/mcp.js`) não emite suas próprias métricas. Path: `src\mcp-server\index.js:271-286` — handler `CallToolRequestSchema` retorna `isError: true` em catch mas não conta erros nem mede duração.
- [ ] **GAP P1**: zero SLO para o package. Não há target documentado de "kit sync completes em < N ms p99" ou "MCP server responds em < N ms p99 para list_tools". Diretório `.planning/slos/` ausente.
- [ ] **GAP P2**: telemetria opt-in para o autor (`luanpdd`) saber quando upgrade-check detecta versões antigas em uso, ou quando sidecar crasha em wild. Trade-off privacy vs visibilidade — escolha consciente do projeto, mas não documentada.
- [ ] **GAP P2**: error tracking de hooks user-facing. Quando `kit/hooks/sidecar-tool-publisher.js` falha (race condition v1.12.1 era exatamente isto), erro vai pra stderr e exit 0 (`kit\hooks\sidecar-tool-publisher.js:81` SOFT failure). User não sabe que está silently broken.

### Axe 3: Emergency Response (3/5)

**O que está bom:**
- Caminho de hotfix é simples e existente: bump patch version → `git push --follow-tags` → workflow `publish.yml` automatiza tudo. Evidence: `.github\workflows\publish.yml:13-89` (sanity check de version vs tag, smoke test, npm publish, GitHub release auto). v1.12.1 é exemplo recente de hotfix executado nesse path em ~24h após reportar `b00738f`.
- Rollback via `npm dist-tag`: user pode `npm install @luanpdd/kit-mcp@1.10.0` para reverter. README seção "Releasing" documenta o flow embora não documente explicitamente o rollback. Evidence: `README.md:546-580`.
- Postmortem implícito existe via commit message do `56b327f` (root cause + fix + diagnosis + verification). Cumpre 4 das 9 seções canônicas de blameless postmortem.

**Gaps:**
- [ ] **GAP P1**: ausência de `RUNBOOK.md` para incidents comuns: "user reports kit-mcp não inicia" / "sidecar não recebe eventos do hook" / "sync corrompeu .claude/" / "MCP server crashes on boot". docs/sidecar-security.md cobre security mas não troubleshooting operacional.
- [ ] **GAP P1**: ausência de postmortem formal blameless do bug v1.12.1. Commit message é bom para diagnosis mas perde 5 das 9 seções canônicas (Impact quantificado, Detection delay, Action Items priorizados, Lessons Learned, Timeline UTC). Skill `blameless-postmortems` existe **dentro do kit** mas não foi aplicada **ao próprio kit**.
- [ ] **GAP P2**: on-call rotation N/A (solo dev — anti-pattern hero culture é risco real, não bloqueador para lib pessoal).
- [ ] **GAP P2**: sem alertas externos quando v1.12.1+ tem instalação falhando (npm CI broken, deps resolution erro). Path: package depende de `npm audit` em CI mas não monitora pós-publish.
- README seção "Troubleshooting" mencionada mas não localizada como section dedicada (Grep: `troubleshoot|debug` retorna match mas é menção genérica; nenhum heading `## Troubleshooting`).

### Axe 4: Capacity Planning (3/5)

**O que está bom:**
- Limites do sidecar HTTP **explícitos e enforced**: SSE subscribers ≤ 32 (conn 33+ → 503), ring buffer 200 events, payload ≤ 64KB, body ≤ 64KB, port range 7100-7199 (100 portas). Evidence: `src\ui\server.js:33-37`, `:95-110`, `src\ui\events.js:19-20`, `src\ui\port.js:7-8`.
- Idle shutdown opt-in (default 0 = never; `--idle-ms` ativa). Evidence: `src\ui\server.js:36`, `bin\ui.js:36`.
- File watcher (chokidar) com debounce 300ms e ignoreInitial. Evidence: `src\core\watch.js:23`, `:36-41`.
- Heartbeat SSE 15s evita conn idle dropping. Evidence: `src\ui\server.js:33`.
- Sync usa `stubsOnly` (lê só frontmatter, não body) em mode=reference para minimizar I/O em kits grandes. Evidence: `src\core\sync.js:33`.

**Gaps:**
- [ ] **GAP P1**: zero load test do MCP stdio. Quantos tools/sec o `bin/mcp.js` aguenta? Qual o boot time em cold/warm? Header timing existe via teste de integração (`test/integration/ui-server.test.js`) mas só do sidecar HTTP. Path: nenhum file `load-test*.md` em `.planning/` nem benchmark script em `test/`.
- [ ] **GAP P2**: sem métrica explícita de "MCP listing tools size" para detectar bloat (descrições muito longas saturam context budget do LLM caller). Existe gate `gates/budget-description.md` que valida ≤ 200 chars por agent/command/skill — proxy parcial mas não é métrica do tool listing serializado.
- [ ] **GAP P2**: file watcher sem cap explícito de número de arquivos. Em kits muito grandes (centenas de skills), chokidar pode consumir muita memória. Sem documentação de limite.
- Headroom: porta range 100 (7100-7199) é mais que suficiente para single-user; SSE 32 também — adequado para context dev-tool.

### Axe 5: Change Management (5/5)

**O que está bom:**
- **CI matrix robusta:** 3 OS (ubuntu, macos, windows) × 3 Node (20, 22, 24) = 9 jobs paralelos com tests + sync round-trip + MCP boot test. Evidence: `.github\workflows\ci.yml:101-221`.
- **prepublishOnly bloqueia npm publish** se unit + integration falharem. Evidence: `package.json:48`.
- **Workflow tag→publish é gate canônico**: `.github\workflows\publish.yml:38-46` (sanity check version=tag), `:48-52` (smoke test 3 comandos), `:54-57` (publish com `--provenance`). Falha em qualquer step bloqueia release.
- **21 audit gates** em `gates/`: inclusos `release-pipeline-policy`, `prr-checklist-coverage`, `legacy-refactor-safety`, `golden-signals-coverage`, `postmortem-template-required`, `budget-description`, `no-personal-uuid`, `agent-no-recursive-dispatch`, `skill-must-include`, `sync-idempotent`, e outros. Evidence: `Glob D:\projetos\opensource\mcp\gates\**`.
- **Mirror-tree safety** test no CI: verifica que `sync remove` NÃO apaga arquivos user que faltam o `.kit-mcp-managed` marker. Evidence: `.github\workflows\ci.yml:182-193`.
- **MCP server import-time crash detection** no CI: spawn com stdin EOF, verifica que ou stay-alive ou exit 0. Evidence: `.github\workflows\ci.yml:195-221` (regressão de v0.4.0 referenciada explicitamente).
- **Deploy frequency mensurado**: 276 commits últimos 6 meses; 10 tags semver (v1.5.4 → v1.12.1) — release cadence saudável.
- **5 v1.8 Supabase suite gates** rodados em CI. Evidence: `.github\workflows\ci.yml:132-157`.

**Gaps mínimos (não impedem score 5/5):**
- Canary release (1% → 10% → 100%) não-aplicável a npm package — npm é all-or-nothing por dist-tag. Mitigação efetiva é dist-tag `next` antes de `latest` (não documentado mas viável).
- Feature flags N/A (package binário, não SaaS dinâmico).

### Axe 6: Performance (3/5)

**O que está bom:**
- Boot test no CI captura import-time crashes (regressão v0.4.0). Evidence: `.github\workflows\ci.yml:195-221`.
- Smoke test `kit list-agents | head -5` no `prepublishOnly` e em `publish.yml`. Evidence: `package.json:44`, `.github\workflows\publish.yml:48-52`.
- 182 tests (19 files) com `--test-concurrency=1` e `--test-force-exit`. Evidence: `test\run.mjs:43-46`.
- Long tail mitigations explícitas:
  - Sidecar healthz probe timeout 500ms (PERF-04). Evidence: commit `195b210` referencia.
  - publish() agora retorna Promise que aguarda response.end / setTimeout (v1.12.1 fix). Evidence: `kit\hooks\sidecar-tool-publisher.js:161-180` e commit `56b327f`.
  - REQUEST_TIMEOUT_MS = 1500 em upgrade-check.

**Gaps:**
- [ ] **GAP P1**: zero baseline documentado de p50/p95/p99/p99.9 para operações críticas: cold start MCP server, `kit sync claude-code` (full kit ~50 files), MCP `list_tools` round-trip, sidecar SSE event publish→deliver. Path: nenhum `BENCHMARK.md` em `.planning/` ou `docs/`.
- [ ] **GAP P2**: sem error budget formal. Sem SLO definido (Axe 2 GAP), sem error budget. Para dev-tool isto é menos crítico que para SaaS, mas adicionar um SLO mínimo ("MCP server boots em < 500ms cold p99") validaria automaticamente regressão.
- [ ] **GAP P2**: saturation de SSE subscribers tracked pelo cap=32 mas não exposto como gauge para user inspecionar. `GET /state` retorna eventos mas não conta de subscribers ativos.

---

## Action Items

| # | Axe | Item | Severity | Owner | Due |
|---|-----|------|----------|-------|-----|
| 1 | 2 | Instrumentar `bin/mcp.js` com counter `kit_tool_invocations_total{tool, action, error_type}` + histogram `kit_tool_duration_ms{tool}` (escrever para stderr em modo `KIT_MCP_DEBUG=1`, opt-in). | **P1** | TBD | 2026-06-15 |
| 2 | 2 | Definir 3 SLOs mínimos em `.planning/slos/kit-mcp.md`: (a) MCP cold start < 500ms p99, (b) `kit sync claude-code` < 2s p99, (c) sidecar `/publish` ack < 50ms p99. Aplicar skill `event-based-slos`. | **P1** | TBD | 2026-06-15 |
| 3 | 1 | Criar `docs/FAILURE-MODES.md` listando 8 modos: port range esgotado, lockfile stale, npm registry down, ~/.kit-mcp inacessível, EACCES tmpdir, child spawn fail, kit/ corrupted, race condition em watcher. Mapear mitigation existente para cada um. | **P1** | TBD | 2026-06-30 |
| 4 | 3 | Criar `docs/RUNBOOK.md` com 5 incidents canônicos: (a) sidecar não recebe eventos, (b) `kit sync` corrompeu `.claude/`, (c) MCP server crashes on boot, (d) port 7100-7199 todos ocupados, (e) user em Node < 20. | **P1** | TBD | 2026-06-30 |
| 5 | 3 | Escrever postmortem formal blameless do bug v1.12.1 em `.planning/postmortems/2026-05-08-sidecar-hook-race.md` aplicando skill `blameless-postmortems` (9 seções). Dogfooding o próprio kit. | **P2** | TBD | 2026-06-15 |
| 6 | 6 | Adicionar `npm run bench` script com hyperfine ou similar mensurando cold start + sync time. Publicar baseline em `BENCHMARK.md`. Run em CI matrix. | **P2** | TBD | 2026-07-15 |
| 7 | 5 | Documentar processo formal de canary npm via dist-tag `next`: `npm publish --tag next` → soak 7 dias → `npm dist-tag add @luanpdd/kit-mcp@1.x.y latest`. | **P2** | TBD | 2026-07-15 |
| 8 | 3 | Reviewer assignment — auto-PRR é anti-pattern. Antes de marcar "Approved", obter sign-off de external reviewer (par open-source do MCP ecosystem). | **P0 (process)** | luanpdd | 2026-05-15 |

---

## Decisão

**Approved with conditions.**

Zero P0 técnico (release pipeline é robusto, security profile é defensável, package boot é testado em 9 OS×Node combinations). 4 P1 são gaps de **observabilidade interna do package** + **documentação operacional** — recomendados antes de v1.13 mas não bloqueiam continuidade da v1.12.x.

**1 P0 de processo:** este PRR foi auto-conduzido (anti-pattern explicitamente listado em `kit/skills/production-readiness-review/SKILL.md`). Reviewer external deve sign-off antes de tratar este report como "Approved" formal.

---

## Re-PRR triggers

Re-PRR triggered em qualquer:
- Adição de runtime dep além das 6 (budget mudança = ADR + Re-PRR)
- Mudança no transport do MCP server (stdio → HTTP/SSE) — quebra modelo single-user loopback
- Sidecar passa a aceitar conexões non-loopback
- Adoção de telemetria opt-in (mudança em privacy posture)
- Re-write > 50% de `src/core/` (sync engine)
- Tag major bump (v2.0.0)
- Anualmente como hygiene (próxima: 2027-05-09)

## Reviewer signature

Reviewer: TBD (auto-PRR — não aprovado formalmente até external sign-off)
Date: 2026-05-09
