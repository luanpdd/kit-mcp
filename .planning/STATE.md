---
state_version: 1.0
milestone: v1.37
milestone_name: "Cost Tracking Suite"
status: "M3 entregue — 5 MCP tools cost-* + skill cost-tracking + 3 slash commands. Gate C1 verde. Aguardando M4-M5."
last_updated: "2026-06-05T23:55:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_milestones: 5
  completed_milestones: 3
  current_phase: 172
  current_milestone: "M3 done → M4 next"
---

# STATE.md

## Posição Atual

Fase: **172 — Cost Tracking Suite (v1.37.0)**
Milestone: **M3 — MCP tools + skill cost-tracking** ✓
Status: M3 commitado. Gate C1 verde (23 testes integração cost-tools + check-tool-descriptions 14 tools / 0 over 1024 + regen-manifest idempotente + audit-skill-triggers sem colisão para cost-tracking).
Próximo: M4 — CLI `kit cost <action>` + statusline cold/warm.
Última atividade: 2026-06-05 — Phase 172 M3 commitado.

## Phase 172 progress

| Milestone | Status | Gate |
|---|---|---|
| M1 — Núcleo (discovery/parser/dedup/pricing) | ✓ | Gate A verde |
| M2 — Agregadores (today/session/blocks/phase/estimate + persist-snapshot) | ✓ | Gate B verde |
| M3 — MCP tools + skill | ✓ | Gate C1 verde |
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

## Deliverables M3 (v1.37 wip)

- **5 MCP tools cost-*** em `src/mcp-server/index.js` (append-only — 9 tools pré-existentes intocadas):
  - `cost-today`, `cost-session`, `cost-blocks`, `cost-phase`, `cost-estimate`
  - 5 handlers async `handleCostToday/Session/Blocks/Phase/Estimate` reutilizam os agregadores M2
  - Helper `_maybePersistCost` (opt-in `persist:true` grava `.planning/costs/<ts>-<tool>.json`)
  - Helper `_costError` envelopa try/catch em `{error:{message,code}}` — sem stack leak ao cliente MCP
  - Exports `TOOLS`, `HANDLERS`, `__TEST_HANDLERS` (5 cost handlers) para integration tests sem stdio
- **Skill `cost-tracking`** em `kit/skills/cost-tracking/SKILL.md`:
  - Disambiguation explícita vs `burn-rate-status` (SLO error budget) e `risk-budget` (SRE risk)
  - Map de intents → tool + 4 exemplos canônicos + 5 anti-patterns
  - Limitações conhecidas v1.37.0 (LiteLLM lag, chars/4 heurística, correlation_confidence)
- **3 slash commands PT-BR** em `kit/commands/`:
  - `custo-hoje.md` → wrapper `cost-today` (`--tz`, `--refresh-pricing`, `--persist`)
  - `custo-sessao.md` → wrapper `cost-session` (auto-deduz ou aceita session_id)
  - `custo-fase.md` → wrapper `cost-phase` (`phase_id` obrigatório; destaca confidence)
- **1 integration test** `test/integration/cost-tools.test.js` (23 testes):
  - TOOLS shape (5 cost tools presentes + desc ≤ 1024 chars + inputSchema válido + required correto)
  - HANDLERS map dispatch (5 cost handlers funcionam)
  - **Guarda regressão das 9 tools pré-existentes** (kit/sync/reverse-sync/gates/forensics/install/metrics-snapshot/auto-install/ack-restart)
  - Shape canônico do SPEC validado em cada handler (entries inline + fixtures M1)
  - Validação manual sem Zod (rejeita types errados com `error.code='invalid_arg'`)
  - Edge cases: cost-phase unknown vs mocked dir, cost-estimate range, persist=true cria arquivo, persist=false não cria dir
  - Fixture paridade-ccusage digerida sem erro
  - Fixture modelo-desconhecido NUNCA retorna $0 silencioso (total_usd=null quando todos unknown)
- **Contadores README** bumped 91→94 commands, 99→100 skills (auto-via `update-readme-counts.js`). Test `test/unit/update-readme-counts.test.js` atualizado para os novos valores hard-coded.
- **`kit/file-manifest.json`** regenerado (idempotente — apenas hashes dos arquivos novos/modificados).
- **`reports/SKILL-TRIGGER-AUDIT.md`** regenerado — `cost-tracking` NÃO colide com nenhuma skill existente (audit zero matches para `cost-tracking`).

## Débitos M3 (planejados pra M4-M5 ou pós-release)

1. **Sem spawn/transport test em M3** — testes M3 chamam handlers via `__TEST_HANDLERS` direto. End-to-end stdio (init handshake + tools/call) fica em M4 (cost-cli.test.js cobre CLI; o spawn MCP fica para uma sanity em M5 se necessário).
2. **`refresh_pricing:true` aceito em handlers mas não implementado** — args passa adiante para aggregateToday/Session/Blocks/Phase, mas a integração real com `pricing-fallback.js` (HTTP fetch + cache TTL) só conecta em M4/M5. Hoje o aggregator ignora o flag silenciosamente — débito a clarear quando M4 ligar.
3. **`persist=true` ignorado em cost-estimate** — handler retorna shape direto sem chamar `persistSnapshot` (estimativa é pura, sem entry_count agregado por dia). Documentado no handler como comentário; UX-wise o user pode achar estranho `--persist` ser silencioso ali. Considerar warning explícito em M4 CLI.
4. **Validação manual de inputSchema NÃO espelha 100% as constraints declaradas** — `inputSchema.required` é informativo para o MCP client; rejeição efetiva é dupla validação manual (`if (!args.text) error`). Sem Zod, qualquer mismatch entre schema declarado e validação manual pode passar. Mitigação: o teste verifica os 2 caminhos críticos (`cost-phase` sem phase_id, `cost-estimate` sem text).

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

1. M4 — CLI `kit cost <action>` (7 sub-actions) + statusline cold/warm bench
2. M5 — Release v1.37.0 + GH Action weekly refresh-pricing
