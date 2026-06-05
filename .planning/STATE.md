---
state_version: 1.0
milestone: v1.37
milestone_name: "Cost Tracking Suite"
status: "M1 entregue — nucleo discovery/parser/dedup/pricing verde. Aguardando M2-M5."
last_updated: "2026-06-05T22:50:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_milestones: 5
  completed_milestones: 1
  current_phase: 172
  current_milestone: "M1 done → M2 next"
---

# STATE.md

## Posição Atual

Fase: **172 — Cost Tracking Suite (v1.37.0)**
Milestone: **M1 — Núcleo (discovery + parser + dedup + pricing)** ✓
Status: M1 commitado. Gate A verde (50 unit cost tests + 1 integration paridade).
Próximo: M2 — Agregadores (today/session/blocks/phase/estimate).
Última atividade: 2026-06-05 — Phase 172 M1 commitado.

## Phase 172 progress

| Milestone | Status | Gate |
|---|---|---|
| M1 — Núcleo (discovery/parser/dedup/pricing) | ✓ | Gate A verde |
| M2 — Agregadores | pendente | Gate B |
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

## Débitos M1 (planejados pra M5 ou pós-release)

1. **Oracle de paridade**: hoje gerado por `gen-paridade-fixture.mjs` (impl independente lendo o MESMO snapshot). Oracle ccusage estrito requer `npm install` + `generate-oracle-paridade.mjs` rodar. Documentado em comentário do test.
2. **Cobertura strict-mode parser**: apenas 1 caso testado; expandir em M2.

## Contexto Acumulado pré-fase 172

(preservado de v1.29 release — não alterar até M5 v1.37 release)

- Counts: 66 agents, 89 commands, 76 skills, 23 audit gates.
- MCP tools: 9 (auto-install + ack-restart adicionados em v1.29).
- Stable API: preservada cross-17 releases.

## Próxima ação

1. M2 — Agregadores (today/session/blocks/phase/estimate + persist-snapshot)
2. M3 — Registrar 5 MCP tools cost-* + skill cost-tracking
3. M4 — CLI `kit cost` + statusline
4. M5 — Release v1.37.0 + GH Action weekly refresh-pricing
