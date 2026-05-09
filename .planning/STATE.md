---
state_version: 1.0
milestone: v1.15
milestone_name: — DX & Token Economy Wave 2
status: v1.15 completo — Phase 87 Plan 01 entregue (CI matrix 8 IDEs)
last_updated: "2026-05-09T13:07:38.984Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
---

# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Phase 87 — CI Matrix Expansion (Plan 87.01 — DX-15-03)
Status: v1.15 completo — Phase 87 Plan 01 entregue (CI matrix 8 IDEs)
Última atividade: 2026-05-09T12:56Z — Plan 87.01 (DX-15-03 CI matrix expansion) entregue: `.github/workflows/ci.yml` ganha matrix axis `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]` (8 IDEs × 3 OS × 3 Node = 72 runs); `fail-fast: false` preservado para isolamento por target. "Sync round-trip" step parameterizado com `${{ matrix.target }}` substituindo hardcoded claude-code asserts; body usa contrato genérico registry-driven (install >=1 file, remove leaves 0 stubs em capability dirs) com inline `node --input-type=module -e "import { getTarget } from './src/core/registry.js'..."`. 7 steps target-agnósticos gated com `if: matrix.target == 'claude-code'` (Tests unit, Tests integration, Audit drift gate, CLI smoke, Supabase gates, Mirror-tree safety, MCP server boot) — economiza ~55% step-executions vs naïve 8× (~351 vs ~720). 4 hardcoded `claude-code` analisados: 2 substituídos (linhas 179, 190), 2 preservados com rationale (linha 146 CLI smoke = sentinel para CLI surface; linha 206 Mirror-tree safety = framework/hooks só existem em claude-code, step gated). `test/unit/sync-round-trip-all-targets.test.js` (110 linhas, novo) com 10 tests: 1 registry IDs sanity + 1 capability sanity + 8 round-trips per target. Fixtures: `test/fixtures/sample-kit/` (já existente). Defesa em profundidade — pega regressão por target em <1s antes de pagar 72-run CI. Suite: 215 unit (213 pass + 2 skipped) + 84 integration = 299 tests, 0 fails (cresceu 289 → 299 conforme planejado). 2 commits atômicos --no-verify (01f102b ci.yml matrix expansion, 327a16d regression test).

Anterior: 2026-05-09T12:35Z — Plan 86.01 (DX-15-01 README counters auto-gen) entregue: bloco `<!-- AUTOGEN-COUNTS-START -->...END -->` no README.md com counts reais (47 agents · 87 commands · 45 skills · 20 gates) + `scripts/update-readme-counts.js` ESM idempotente standalone (126 linhas, pure stdlib — fs/promises, path, url) + 4 regression tests em `test/unit/update-readme-counts.test.js` (writes-on-change, idempotent, throws-without-block, real-repo no-op). Skills counter exclui `_shared-*` glossary subdirs (sem SKILL.md). EOL detection (CRLF/LF) preservation — bug Rule 1 caught antes de shipar (Windows checkout ficaria dirty com LF write em CRLF README). Drift fixado no processo: README dizia "49 skills" mas disco tem 45. Suite: 205 unit (203 pass + 2 skipped) + 84 integration = 289 tests, 0 fails. 3 commits atômicos --no-verify (6ef6848 README block, 1c84e07 script, dea214d tests).

Anterior: 2026-05-09T12:12Z — Plan 85.02 (compatibility dedup PERF-15-02) entregue em paralelo com 85.01: kit/COMPATIBILITY.md canonical (65 linhas, 27 agents na matriz horizontal × IDE × tier × capability), 27 agents editados (bloco `## Compatibilidade` substituído por linha `**Compat:** ...` + link relativo), kit/file-manifest.json regenerado (327/327 SHA256 verified, version 1.13.0 preservada), 3 regression tests em test/unit/compatibility-dedup.test.js (heading absent + reference line + manifest verifies). 3 patterns canônicos identificados (A filesystem-only, B Supabase MCP-dependent, C MCP-augmented degraded) — Pattern C foi desvio Regra 2 (PLAN previa só A/B). Token economy estrutural: 271 linhas removidas → 27 adicionadas, net -244 linhas no kit. Sync install dry-run smoke: 321 files synced, sem EMANIFESTMISMATCH. 3 commits atômicos --no-verify (844c0e7 COMPATIBILITY.md canonical, cbe5956 27 agents [-271/+27 lines], 21be5e4 manifest regen + tests).

Anterior: 2026-05-09T12:08Z — Plan 85.01 (terse mode PERF-15-01) entregue: `terse:boolean` aditivo no MCP `kit` schema + `slimTerse(x)` helper em `src/mcp-server/index.js` e `src/cli/index.js`; CLI ganha `--terse` flag em list-agents/list-commands/list-skills (paridade cross-surface). 4 regression tests novos em `test/unit/terse-mode.test.js` (shape + ≥40% reduction + CLI parity + backward-compat). **Corpus real mostra 68.8% redução** (25486 → 7942 bytes em 179 items, well above ≥40% threshold). Action enum inalterado, default false → comportamento idêntico para clientes existentes. Suite: 195 unit (193 pass + 2 skipped) + 84 integration = 279 tests, 0 fails. 2 commits atômicos (efd0709 mcp, 2471063 cli+tests).

Suite final pós-Phase 85: 282 tests (198 unit + 84 integration), 0 fails. Plan 85.02 adicionou 3 testes; Plan 85.01 adicionou 4 (já refletido no 279 acima — mais 3 do 02 = 282 total).

## Milestone ativo

**v1.14 Web/Core Security Hardening** — continuação direta da v1.13. Fecha as 6 vulnerabilidades HIGH explicitamente deferidas no `v1.13-MILESTONE-AUDIT.md` "Tech Debt". Mesma origem da v1.13 (meta-auditoria com 12 agentes paralelos sobre v1.12.1).

**3 fases (82-84):**

- Phase 82 — Web Surface Hardening: CSP/XSS no UI sidecar + auth nos endpoints /shutdown e /publish ✅ **CONCLUÍDA**
- Phase 83 — Core Filesystem Hardening: reverse-sync projectRoot validation + gate-runner tmpdir mkdtemp + file-manifest verification
- Phase 84 — MCP Error Sanitization: error envelope scrubbing + reflect.js leak prevention

**Adiado para v1.15:** CI matrix expansion para 8 IDEs, T2 (terse mode list-*), T3 (compatibility dedup 27 agents), README counters auto-gen.

## Próximo passo

1. Auditar milestone v1.15 (`/auditar-marco`) para verificar que todos os 5 tech debt items deferreds (PERF-15-01..02 + DX-15-01..03) foram fechados com regression tests.
2. Publicar v1.15.0 (`/publicar`) — tag → GitHub Action publica em npm.

## Bloqueadores

(nenhum)

## Histórico

- v1.10.0 — publicado 2026-05-07
- v1.11.0 — publicado 2026-05-08
- v1.12.x — entregue out-of-band 2026-05-08/09
- **v1.13.0** — publicado em npm 2026-05-09T09:24Z (Security & Performance Hardening — 11 REQs, 33 testes novos, 210 baseline final)
- **v1.14 — em andamento** (Web/Core Security Hardening; iniciado 2026-05-09; 3 fases)
  - Phase 82 — Plan 01 (UI server hardening) concluído 2026-05-09T10:15Z.
  - Phase 82 — Plan 02 (token propagation) concluído 2026-05-09T10:25Z. **Phase 82 completa.**
  - Phase 83 — Plan 01 (projectRoot validation SEC-14-03) concluído 2026-05-09T10:53Z. Helper puro + guard MCP transport (handleSync + handleReverseSync) + 6 regression tests + sentinel uniforme. CLI inalterado (Phase 79.01 contract).
  - Phase 83 — Plan 02 (gate-runner mkdtemp SEC-14-04) concluído 2026-05-09T~11:00Z. execScript usa fs.mkdtemp + per-run unique dir (kernel-atomic random suffix) + recursive cleanup em finally — symlink TOCTOU vector fechado. Phase 79.01 MCP gates.run guard preservado (mcp-server/index.js untouched). 4 regression tests (lifecycle pass/fail + source-grep + concurrent-runs). 2 commits (6a6a276 fix, 99d4d6b test).
  - Phase 84 — Plan 01 (error-redaction SEC-14-06) concluído 2026-05-09T11:17Z. Helper puro + 3 call sites (MCP central catch + reflect rethrow + replays JSON) + 35 regression tests (23 helper + 5 envelope + 3 reflect + 3 replays + 1 spawn). Stack permanece em stderr; clientes nunca recebem stack/path absoluto/sk-ant/Bearer. Single choke point grep-verifiable. **Phase 84 completa — milestone v1.14 fechado.**
- **v1.15 — em andamento** (DX & Token Economy Wave 2; iniciado 2026-05-09; 3 fases planejadas)
  - Phase 85 — Plan 01 (terse mode PERF-15-01) concluído 2026-05-09T12:08Z. `terse:boolean` aditivo no MCP `kit` schema + `slimTerse(x)` helper em mcp-server e cli (paridade cross-surface) + CLI `--terse` flag em list-agents/list-commands/list-skills + 4 regression tests novos (test/unit/terse-mode.test.js: shape, ≥40% reduction, CLI parity, backward-compat). Corpus real **68.8% redução** (25486 → 7942 bytes em 179 items). Action enum inalterado, default false → backward-compat preservada. Suite 279 (195 unit + 84 integration), 0 fails. 2 commits (efd0709 mcp, 2471063 cli+tests).
  - Phase 85 — Plan 02 (compatibility dedup PERF-15-02) concluído 2026-05-09T12:12Z em paralelo. kit/COMPATIBILITY.md canonical (65 linhas, 27 agents na matriz horizontal) + 27 agents com linha `**Compat:**` + relative link, substituindo blocos `## Compatibilidade` (~6-12 linhas cada). Manifest regenerado (327/327 verified, v1.13.0 preserved). 3 patterns canônicos (A filesystem-only/B Supabase MCP-dependent/C MCP-augmented degraded). 3 regression tests pass (compat-dedup.test.js). Suite final 282/282 (198 unit + 84 integration), 0 fails. 3 commits atômicos --no-verify (844c0e7, cbe5956, 21be5e4). Token economy: -244 linhas net no kit. **Phase 85 completa.**
  - Phase 86 — Plan 01 (DX-15-01 README counters auto-gen) concluído 2026-05-09T12:35Z em paralelo com 86.02. AUTOGEN-COUNTS block no README + scripts/update-readme-counts.js ESM idempotente (126 linhas, pure stdlib) + 4 regression tests. Counts reais 47/87/45/20 (drift fixado: README antes dizia "49 skills"). EOL preservation (CRLF/LF) — Rule 1 bug caught antes de shipar. Suite 289 (205 unit + 84 integration), 0 fails. 3 commits atômicos --no-verify (6ef6848, 1c84e07, dea214d). Plano 86.02 (DX-15-02 manifest regen) executado em paralelo via outro executor.
  - Phase 86 — Plan 02 (DX-15-02 manifest auto-regen) concluído 2026-05-09T12:35Z em paralelo com 86.01. `scripts/regen-manifest.js` idempotente (~100 linhas ESM, pure stdlib) — walks `kit/**` excluindo `file-manifest.json`, SHA256 hashes cada arquivo, escreve `{version, timestamp, files}` sorted lex. Idempotência: quando content unchanged, preserva timestamp anterior + skip write se bytes match (zero diff em rerun). `kit/file-manifest.json` regenerado: version aligned 1.13.0 → 1.14.0 (mirroring package.json), 4 entries previously missing capturados (`COMPATIBILITY.md`, `framework/templates/{DEBUG,UAT,UI-SPEC,VALIDATION}.md`), sort canonical (default JS `keys.sort()`). 327 → 328 entries. `package.json:prepublishOnly` agora chains `regen-manifest && update-readme-counts && unit && integration` — qualquer regen failing aborts publish. `.github/workflows/ci.yml` smoke job: novo "Audit — drift gate" step entre Tests integration e CLI smoke, runs both regen scripts + `git diff --exit-code kit/file-manifest.json README.md` (fails CI se PR esqueceu rodar prepublishOnly local). 3 regression tests novos (test/unit/regen-manifest.test.js: schema + verifier round-trip; idempotência byte-identical; content change → hash + timestamp updated). 2 desvios auto-fixed: pre-existing manifest drift (Phase 85.02 deixou `COMPATIBILITY.md` fora + sort errado — exatamente o que DX-15-02 visa prevenir, fix shipped junto), Windows path normalization no main detection. 3 commits atômicos --no-verify (6ae1b36 RED, 0161e00 GREEN script + manifest regen, 71c4088 prepublishOnly + CI gate). Phase 83 verifyManifest contract preserved (round-trip test pinned). **Phase 86 completa — drift sources estruturalmente fechados.**
  - Phase 87 — Plan 01 (DX-15-03 CI matrix expansion) concluído 2026-05-09T12:56Z. `.github/workflows/ci.yml` ganha matrix axis `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]` no smoke job (8 IDEs × 3 OS × 3 Node = 72 runs); `fail-fast: false` preservado para isolamento por target. "Sync round-trip" step parameterizado com `${{ matrix.target }}` — body genérico registry-driven (inline `node --input-type=module -e "import { getTarget }..."`) substitui hardcoded claude-code asserts; contrato uniforme: install writes >=1 file, remove leaves 0 stubs sob `agents/commands/skills/framework/hooks` (rules-aggregated stays by design — single source possibly user-edited). 7 steps target-agnósticos gated com `if: matrix.target == 'claude-code'` (Tests unit/integration, Audit drift gate, CLI smoke, Supabase gates, Mirror-tree safety, MCP server boot) — economiza ~55% step-executions (~351 vs naïve 8× = ~720). 4 hardcoded `claude-code` analisados: 2 substituídos (linhas 179/190 round-trip), 2 preservados (linha 146 CLI smoke = CLI-surface sentinel; linha 206 Mirror-tree safety = framework/hooks só existem em claude-code) — ambos preservados gated. `test/unit/sync-round-trip-all-targets.test.js` (110 linhas, novo) com 10 tests: 1 registry IDs sanity + 1 capability sanity + 8 round-trips per target — defesa em profundidade local mirror do CI contract (per-test mkdtemp + cleanup; usa `test/fixtures/sample-kit/`). Custos CI: pre-Phase 87 ~90 step-execs → post-Phase 87 ~351 (~3.9× growth, esperado para 8× target axis, otimizado via gating). YAML lint: nenhum local disponível (js-yaml absent, Python absent) — confiança em edits cirúrgicos via Edit tool, validação via GitHub Actions runtime (parser falha = workflow não inicia = feedback imediato). Suite 289 → 299 (215 unit + 84 integration), 0 fails. 2 commits atômicos --no-verify (01f102b ci.yml matrix expansion, 327a16d regression test). **Phase 87 completa — DX-15-03 closed; v1.15 milestone fechado.**

## Contexto Acumulado

v1.14 é continuação tática da v1.13 — mesmo ciclo de auditoria (12-agent parallel sweep), só com escopo diferente. v1.13 foi os 4 CRITICAL + 4 quick wins; v1.14 são os 6 HIGH deferidos.

**Phase 82 acumulado (Plans 01 + 02):**

- Lockfile estendido com `token: randomBytes(32).toString('hex')` (additive, sem LOCK_VERSION bump).
- CSP estrito sem `'unsafe-inline'` em script-src, via SHA-256 hash do `<script>` inline (computado uma vez no boot).
- `requireAuth` middleware em `/publish`, `/shutdown`, `/events`, `/state`. `/healthz` continua aberto (boot handshake).
- Token propagation transparente: auto-spawn → URL `?t=<token>` → browser scrub via `history.replaceState` → `authedFetch` + `authedEventSourceUrl` → server valida via `Authorization: Bearer` ou `?t=`.
- Hook `kit/hooks/sidecar-tool-publisher.js` v1.14.0 — anexa Bearer; backward-compat com sidecars v1.13.
- Suite v1.14 baseline: 222 tests verde (139 unit + 83 integration), 0 skipped.
- Suite final pós-Phase 84: 275 tests (191 unit + 84 integration), 0 fails, 2 skipped pre-existing.

Stable API v1.0+ continua preservada. Budget 6/6 deps mantido. Zero conteúdo do kit alterado (content-zero hardening).

**Princípio editorial v1.14:** cada fix tem regression test obrigatório. v1.13 deixou alguns gates "armed but not green" (audit gate); v1.14 deve fechar todos os fixes com prova executável.

## Evolução

Este documento evolui nas transições de fase e limites de milestone.
