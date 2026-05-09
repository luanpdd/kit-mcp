---
state_version: 1.0
milestone: v1.14
milestone_name: — Web/Core Security Hardening
status: Milestone v1.14 completo — todas 3 fases (82, 83, 84) concluídas
last_updated: "2026-05-09T11:28:17.732Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
---

# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Phase 84 — MCP Error Sanitization **CONCLUÍDA** (Plan 84.01 entregue)
Status: Milestone v1.14 completo — todas 3 fases (82, 83, 84) concluídas
Última atividade: 2026-05-09T11:17Z — Plan 84.01 (error-redaction SEC-14-06) entregue: helper puro `redactSecrets` + `sanitizeMcpError` em `src/core/error-redaction.js` (6 regex patterns + non-false-positive contract + idempotente), aplicado em 3 call sites (mcp-server central catch, reflect.js Anthropic 401 rethrow, replays.js recordReplay JSON persistence). Stack só vai para stderr; envelope MCP nunca leva path absoluto / stack / sk-ant / Bearer. 35 testes novos (23 helper unit + 5 envelope integration + 3 reflect-redact + 3 replays-redact + 1 spawn smoke). Suite total 275 tests (191 unit + 84 integration), 0 fails. 4 commits atômicos (34a99e0 helper, a488616 central-catch, f6eabd4 reflect+replays, 74574c5 spawn-smoke).

## Milestone ativo

**v1.14 Web/Core Security Hardening** — continuação direta da v1.13. Fecha as 6 vulnerabilidades HIGH explicitamente deferidas no `v1.13-MILESTONE-AUDIT.md` "Tech Debt". Mesma origem da v1.13 (meta-auditoria com 12 agentes paralelos sobre v1.12.1).

**3 fases (82-84):**

- Phase 82 — Web Surface Hardening: CSP/XSS no UI sidecar + auth nos endpoints /shutdown e /publish ✅ **CONCLUÍDA**
- Phase 83 — Core Filesystem Hardening: reverse-sync projectRoot validation + gate-runner tmpdir mkdtemp + file-manifest verification
- Phase 84 — MCP Error Sanitization: error envelope scrubbing + reflect.js leak prevention

**Adiado para v1.15:** CI matrix expansion para 8 IDEs, T2 (terse mode list-*), T3 (compatibility dedup 27 agents), README counters auto-gen.

## Próximo passo

1. Auditar milestone v1.14 (`/auditar-marco`) para verificar que todas as 6 vulnerabilidades HIGH foram fechadas com regression tests.
2. Publicar v1.14.0 (`/publicar`) — tag → GitHub Action publica em npm.

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
