---
state_version: 1.0
milestone: v1.14
milestone_name: — Web/Core Security Hardening
status: Phase 82 concluída — Plans 01+02 entregues; Phase 83 (Core Filesystem Hardening) próxima
last_updated: "2026-05-09T10:34:31.666Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Phase 82 — Web Surface Hardening **concluída** (Plans 01 + 02)
Status: Phase 82 concluída — Plans 01+02 entregues; Phase 83 (Core Filesystem Hardening) próxima
Última atividade: 2026-05-09T10:25Z — Plan 82.02 (token-propagation) entregue: auto-spawn `?t=` handshake + index.html scrub via replaceState + authedFetch/authedEventSourceUrl + client.js Authorization Bearer + hook v1.14.0. 4 commits, 3 testes reativados + 3 testes novos. Suite 222 passing (139 unit + 83 integration), 0 skipped da fase 82.

## Milestone ativo

**v1.14 Web/Core Security Hardening** — continuação direta da v1.13. Fecha as 6 vulnerabilidades HIGH explicitamente deferidas no `v1.13-MILESTONE-AUDIT.md` "Tech Debt". Mesma origem da v1.13 (meta-auditoria com 12 agentes paralelos sobre v1.12.1).

**3 fases (82-84):**

- Phase 82 — Web Surface Hardening: CSP/XSS no UI sidecar + auth nos endpoints /shutdown e /publish ✅ **CONCLUÍDA**
- Phase 83 — Core Filesystem Hardening: reverse-sync projectRoot validation + gate-runner tmpdir mkdtemp + file-manifest verification
- Phase 84 — MCP Error Sanitization: error envelope scrubbing + reflect.js leak prevention

**Adiado para v1.15:** CI matrix expansion para 8 IDEs, T2 (terse mode list-*), T3 (compatibility dedup 27 agents), README counters auto-gen.

## Próximo passo

1. Iniciar Phase 83 — Core Filesystem Hardening (planejar via `/discutir-fase` + `/planejar-fase`, ou se já planejado, `/executar-fase 83`).
2. Continuar fases 83 e 84 do milestone v1.14 (`/autonomo` ou execução individual).

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

## Contexto Acumulado

v1.14 é continuação tática da v1.13 — mesmo ciclo de auditoria (12-agent parallel sweep), só com escopo diferente. v1.13 foi os 4 CRITICAL + 4 quick wins; v1.14 são os 6 HIGH deferidos.

**Phase 82 acumulado (Plans 01 + 02):**

- Lockfile estendido com `token: randomBytes(32).toString('hex')` (additive, sem LOCK_VERSION bump).
- CSP estrito sem `'unsafe-inline'` em script-src, via SHA-256 hash do `<script>` inline (computado uma vez no boot).
- `requireAuth` middleware em `/publish`, `/shutdown`, `/events`, `/state`. `/healthz` continua aberto (boot handshake).
- Token propagation transparente: auto-spawn → URL `?t=<token>` → browser scrub via `history.replaceState` → `authedFetch` + `authedEventSourceUrl` → server valida via `Authorization: Bearer` ou `?t=`.
- Hook `kit/hooks/sidecar-tool-publisher.js` v1.14.0 — anexa Bearer; backward-compat com sidecars v1.13.
- Suite v1.14 baseline: 222 tests verde (139 unit + 83 integration), 0 skipped.

Stable API v1.0+ continua preservada. Budget 6/6 deps mantido. Zero conteúdo do kit alterado (content-zero hardening).

**Princípio editorial v1.14:** cada fix tem regression test obrigatório. v1.13 deixou alguns gates "armed but not green" (audit gate); v1.14 deve fechar todos os fixes com prova executável.

## Evolução

Este documento evolui nas transições de fase e limites de milestone.
