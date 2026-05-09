# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.13 — Security & Performance Hardening (Fases 79-81)

**Milestone:** v1.13 — Security & Performance Hardening (derivado de meta-auditoria com 12 agentes em paralelo sobre kit-mcp v1.12.1)
**Numeração de fases:** continua de v1.12 (último concluído: Fase 78) → v1.13 começa em **Fase 79**
**Total de fases:** 3 (Fases 79-81)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** [.planning/PRR-REPORT.md](.planning/PRR-REPORT.md), [.planning/codebase/concerns.md](.planning/codebase/concerns.md), [.planning/TOIL-AUDIT.md](.planning/TOIL-AUDIT.md), [.planning/VALIDATION.md](.planning/VALIDATION.md)
[Detalhes](./milestones/v1.13-ROADMAP.md)

### Phase 79: Critical Security Fixes

**Goal:** Fechar 4 vulnerabilidades CRITICAL/HIGH identificadas pela auditoria de segurança — bypass de gates.run via MCP, replayId path traversal, e dois gaps no publish workflow (`npm ci || npm install` fallback + skip de tests/audit antes de `npm publish`).

**Escopo (artefatos a tocar):**
- `src/mcp-server/index.js` — `handleGates` deve recusar `runShellGate` quando invocado via MCP sem confirmação interativa explícita (preserva `kit gates run` CLI mas remove a surface de exec arbitrário do MCP).
- `src/core/replays.js` — `loadReplay(id)` e `annotateReplay(id, outcome)` devem validar `id` com regex `/^[A-Za-z0-9_.-]+$/` + `path.resolve` + assert prefix de `.planning/replays/`.
- `.github/workflows/publish.yml:36` — trocar `npm ci || npm install` por `npm ci` strict.
- `.github/workflows/publish.yml:47-53` — inserir `npm test`, `npm run test:integration` e `npm audit --omit=dev --audit-level=high` antes do step `npm publish`.

**Critérios de sucesso:**
- Tentar `gates.run` via MCP retorna erro descritivo sem executar shell.
- `loadReplay('../etc/passwd')` retorna erro "invalid replay id" sem ler o arquivo.
- `npm ci` em CI/publish falha hard se lockfile divergir (sem fallback silencioso).
- Publish workflow só publica se `npm test` + `npm audit` passarem.
- Suite de testes existente continua passando (zero regressão funcional).

**Plans:** 3 plans (todos onda 1, paralelos)

Plans:
- [x] 01-mcp-gates-guard-PLAN.md — guard em handleGates contra exec arbitrário via MCP (SEC-13-01)
- [x] 02-replay-id-validation-PLAN.md — validar replayId em loadReplay/annotateReplay/recordReplay contra path traversal (SEC-13-02)
- [x] 03-ci-publish-hardening-PLAN.md — npm ci strict + tests/audit gates antes de publish (SEC-13-03, SEC-13-04)

### Phase 80: Hooks Race Pattern + Token Economy Quick Wins

**Goal:** Aplicar o pattern do fix v1.12.1 (await on('end'+'close') antes de `process.exit`) aos 6 hooks restantes que ainda têm o mesmo bug latente, e capturar quick wins de economia de tokens (dedup de markup repetido em 11+ agents, cap em descrições, dropar CHANGELOG do tarball npm).

**Depends on:** Phase 79

**Escopo (artefatos a tocar):**
- `kit/hooks/workflow-guard.js`, `kit/hooks/prompt-guard.js`, `kit/hooks/context-monitor.js`, `kit/hooks/post-apply-migration.js`, `kit/hooks/statusline.js`, `kit/hooks/check-update.js` — aplicar mesmo pattern de flush+close antes de `process.exit(0)` que `sidecar-tool-publisher.js` recebeu em v1.12.1.
- `src/mcp-server/index.js` — `slim()` aplicar `SUMMARY_MAX_CHARS=80` (já existe em `src/core/sync.js:260`) na descrição.
- 11 agents em `kit/agents/` (planner, debugger, verifier, codebase-mapper, etc.) — remover bloco `# hooks:` comentado-morto do frontmatter.
- `package.json:13-21` — remover `CHANGELOG.md` de `files[]` (mantém em GitHub releases).

**Critérios de sucesso:**
- 6 hooks emitem evento final em test simulando processo killed mid-flush (regression test inspirada no fix v1.12.1).
- Listing de tools via MCP reduz ≥10% em payload de descrição.
- Bloco `# hooks:` ausente em todos os 11 agents listados.
- `npm pack --dry-run` mostra ausência de CHANGELOG.md no tarball.

**Plans:** 4 plans (todos onda 1, paralelos)

Plans:
- [ ] 01-hooks-flush-before-exit-PLAN.md — 6 hooks aplicam flush-before-exit + regression test (SEC-13-05)
- [x] 02-slim-cap-PLAN.md — slim() em mcp-server e cli aplica summarize() compartilhado de sync.js (PERF-13-01)
- [x] 03-dedup-hooks-block-PLAN.md — remover bloco `# hooks:` morto de 11 agents + anti-regression test (PERF-13-02)
- [ ] 04-drop-changelog-from-tarball-PLAN.md — remover CHANGELOG.md de package.json files[] + integration test (PERF-13-03)

### Phase 81: Drift Cleanup

**Goal:** Eliminar 3 fontes de drift que vão piorando ao longo do tempo: CHANGELOG.md sem entries para as 3 últimas releases (v1.11.0, v1.12.0, v1.12.1) — fallback awk silencioso vem disparando; contadores hardcoded em 7 lugares do README.md (drift +147%/+45%/+4800%); MCP server `version: '0.1.0'` hardcoded enquanto package.json é v1.12.1+.

**Depends on:** Phase 79

**Escopo (artefatos a tocar):**
- `CHANGELOG.md` — backfill de entries para v1.11.0, v1.12.0, v1.12.1 baseadas em git log + release notes existentes em `.planning/milestones/v1.11-ROADMAP.md` e `.planning/milestones/v1.12-ROADMAP.md`.
- `.github/workflows/publish.yml:73-76` — transformar warning de awk-extract vazio em `exit 1` (CHANGELOG drift bloqueia release).
- `README.md` — substituir contadores hardcoded por valores reais (47 agents, 87 commands, 49 skills) ou substituir por seção auto-gerada via script.
- `src/mcp-server/index.js:265` — ler `version` do `package.json` (mesmo padrão de `bin/cli.js:43-51`) em vez de hardcoded `'0.1.0'`.

**Critérios de sucesso:**
- CHANGELOG.md tem seção `## [1.11.0]`, `## [1.12.0]`, `## [1.12.1]` com bullets coerentes.
- Próximo `git tag v*` push falha workflow se a entry CHANGELOG correspondente estiver vazia.
- `grep -c "19 agents\|60 commands"` no README.md retorna 0.
- MCP `initialize` response mostra `serverInfo.version` = leitura de package.json.

<details>

## Concluídos

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- v1.8.0 — Suíte Supabase (Phases 25-28)
- v1.9.0 — Observabilidade (Phases 29-35)
- v1.10.0 — SRE Engagement (Phases 36-41)
- v1.11.0 — SRE Resilience & Release Engineering (Phases 42-47)
- v1.12 — Legacy Code Mastery & AI-Era Refactoring (Phases 48-78) — entregue out-of-band

</details>
