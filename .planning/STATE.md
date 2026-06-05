---
state_version: 1.0
milestone: v1.37
milestone_name: "Cost Tracking Suite"
status: "M2 entregue — 5 agregadores + persist-snapshot verde. Aguardando M3-M5."
last_updated: "2026-06-05T23:30:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_milestones: 5
  completed_milestones: 2
  current_phase: 172
  current_milestone: "M2 done → M3 next"
---

# STATE.md

## Posição Atual

Fase: **172 — Cost Tracking Suite (v1.37.0)**
Milestone: **M2 — Agregadores (today/session/blocks/phase/estimate + persist-snapshot)** ✓
Status: M2 commitado. Gate B verde (37 unit cost-aggregate tests + persist-snapshot, suite 702/710).
Próximo: M3 — Registrar 5 MCP tools cost-* + skill cost-tracking.
Última atividade: 2026-06-05 — Phase 172 M2 commitado.

## Phase 172 progress

| Milestone | Status | Gate |
|---|---|---|
| M1 — Núcleo (discovery/parser/dedup/pricing) | ✓ | Gate A verde |
| M2 — Agregadores (today/session/blocks/phase/estimate + persist-snapshot) | ✓ | Gate B verde |
| M3 — MCP tools + skill | pendente | Gate C1 |
| M4 — CLI + statusline | pendente | Gate C2 |
| M5 — Build pipeline + release v1.37.0 | pendente | Gate D |

## Deliverables M1 (v1.37 wip)

- **6 módulos core** em `src/core/cost/`:
  - `path-normalize.js`, `discovery.js`, `parser.js` (lenient), `dedup.js` (3 níveis), `pricing.js`, `pricing-fallback.js`
- **2 scripts build manual** em `scripts/`:
  - `regen-pricing.mjs` (fetcha LiteLLM raw, filtra anthropic/claude, grava snapshot+meta)
  - `generate-oracle-paridade.mjs` (roda ccusage devDep contra fixture)
  - `gen-paridade-fixture.mjs` (fallback de oracle independente — débito documentado)
- **pricing-snapshot.json** + meta com 261 modelos LiteLLM (sha256 + commit pinned).
- **7 fixtures JSONL** em `test/fixtures/`.
- **6 unit tests** (50 testes) + **1 integration test** (paridade golden).
- **devDep ccusage@^15.0.0** em package.json.

## Deliverables M2 (v1.37 wip)

- **5 agregadores** em `src/core/cost/`:
  - `aggregate-today.js` (filtro por data, tz default UTC, Intl.DateTimeFormat pra tz override)
  - `aggregate-session.js` (filtro por sessionId; deriva de transcript_path; auto-deduz sessão ativa com max_idle_ms 30min)
  - `aggregate-blocks.js` (5h windows com floor de hora UTC ccusage-compatible + gap detection > 5h)
  - `aggregate-phase.js` (cruza `.planning/STATE.md` + git log + mtime SPEC.md → confidence high/medium/low/unknown; detecta rebase recente)
  - `aggregate-estimate.js` (heurística chars/4, range ±30%, disclaimer explícito)
- **`persist-snapshot.js`** opt-in, mirror do pattern `src/core/metrics.js` (persistSnapshot + loadSnapshots + cleanup rolling >30d).
- **6 unit tests M2** (37 testes) cobrindo DST boundary, fase ativa sem completed_at, blocks com gap > 5h, JSON corrompido em load, falha graceful em mkdir.
- **`.gitignore`** atualizado com `.planning/costs/`.

## Débitos M2 (planejados pra M3+ ou pós-release)

1. **`correlation_confidence` heurística inicial** — `aggregate-phase.js` usa 3 sinais binários (SPEC.md mtime, STATE.md completed_at, git log no dir). Iteração com sinais mais ricos (commits que mencionam phase_id, PR linkage) fica para v1.37.1.
2. **DST não-trivial** — `aggregate-today` usa `Intl.DateTimeFormat` no tz fornecido, o que cobre saltos automaticamente. Mas o teste DST específico para `America/New_York` testa só o caso simples (não testa o instante exato do salto 02:00→03:00).
3. **`aggregate-session` auto-dedução** — usa apenas mtime do arquivo. Não checa `last_activity_at` no JSONL. Heurística boa o bastante para statusline mas não para audits multi-sessão concorrentes.
4. **Rebase detection** em `aggregate-phase` lê reflog dos últimos 40 entries com janela de 24h. Em repos com rebase de longa data fora da janela, retorna `false` (potencial falso-positivo de confidence).
5. Débito herdado de M1: oracle paridade ccusage estrito + cobertura strict-mode parser.

## Contexto Acumulado pré-fase 172

(preservado de v1.29 release — não alterar até M5 v1.37 release)

- Counts: 66 agents, 89 commands, 76 skills, 23 audit gates.
- MCP tools: 9 (auto-install + ack-restart adicionados em v1.29).
- Stable API: preservada cross-17 releases.

## Próxima ação

1. M3 — Registrar 5 MCP tools cost-* + skill cost-tracking
2. M4 — CLI `kit cost` + statusline
3. M5 — Release v1.37.0 + GH Action weekly refresh-pricing
