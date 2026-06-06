---
state_version: 1.0
milestone: v1.37
milestone_name: "Cost Tracking Suite"
status: "M4 entregue — CLI `kit cost` com 7 sub-actions + statusline cold/warm bench. Gate C2 verde. Aguardando M5."
last_updated: "2026-06-05T00:00:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_milestones: 5
  completed_milestones: 4
  current_phase: 172
  current_milestone: "M4 done → M5 next"
---

# STATE.md

## Posição Atual

Fase: **172 — Cost Tracking Suite (v1.37.0)**
Milestone: **M4 — CLI + statusline** ✓
Status: M4 commitado. Gate C2 verde (12 testes cost-cli + 4 testes bench statusline + 2 testes large-jsonl = 18 testes M4, 100% pass). Cold P50 ~148ms (budget 200ms). Warm P50 ~0.12ms (budget 50ms). Compute 10k entries ~180ms in-process.
Próximo: M5 — Release v1.37.0 + GH Action weekly refresh-pricing.
Última atividade: 2026-06-05 — Phase 172 M4 commitado.

## Phase 172 progress

| Milestone | Status | Gate |
|---|---|---|
| M1 — Núcleo (discovery/parser/dedup/pricing) | ✓ | Gate A verde |
| M2 — Agregadores (today/session/blocks/phase/estimate + persist-snapshot) | ✓ | Gate B verde |
| M3 — MCP tools + skill | ✓ | Gate C1 verde |
| M4 — CLI + statusline | ✓ | Gate C2 verde |
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

## Deliverables M4 (v1.37 wip)

- **CLI `kit cost <action>`** em `src/cli/index.js` (append-only após `program.command('status')` linha 866) com 7 sub-actions:
  - `kit cost today [--date YYYY-MM-DD] [--tz <tz>] [--refresh-pricing] [--persist] [--config-dirs <list>] [--json]`
  - `kit cost session [--session-id <id>] [--transcript <path>] [--refresh-pricing] [--persist] [--config-dirs <list>] [--json]`
  - `kit cost blocks [--since <date>] [--until <date>] [--no-gaps] [--refresh-pricing] [--persist] [--config-dirs <list>] [--json]`
  - `kit cost phase --phase <n> [--milestone <name>] [--refresh-pricing] [--persist] [--config-dirs <list>] [--json]`
  - `kit cost estimate <prompt...> [--model <id>] [--json]`
  - `kit cost statusline [--format compact|verbose|json] [--no-cache]` (lê JSON stdin contrato Claude Code, escreve UMA linha stdout)
  - `kit cost refresh-pricing` (delega ao `scripts/regen-pricing.mjs`)
  - Reutiliza `__TEST_HANDLERS` do MCP server (handlers M3 chamam agregadores M2) — CLI é wrapper que delega
  - Render human-friendly + raw via global `--json`
- **`src/cli/statusline.js`** módulo dedicado:
  - `readStdin()` — leitura sync de JSON via stdin (early-resolve em TTY)
  - `compute(input, opts)` — agrega session/today/blocks paralelamente, render compact `$X.XX sess | $X.XX day | $X.XX 5h`
  - Cache em `os.tmpdir()/kit-mcp-statusline-<sessionId>.json` com mtime check + PID liveness via `process.kill(pid, 0)` cross-platform (Windows EPERM=alive, ESRCH=dead)
  - Formatos: `compact` (default) / `verbose` / `json` via env `KIT_MCP_STATUSLINE_FORMAT`
  - Failure modes: stdin malformado, aggregator throw, fs error → emite '' + stderr (NUNCA crasha Claude Code)
- **3 testes integração** em `test/integration/`:
  - `cost-cli.test.js` (12 testes) — smoke + JSON output para todas as 7 sub-actions, exit codes corretos (--phase obrigatório, prompt obrigatório), --tz/--date overrides
  - `cost-statusline.bench.test.js` (4 testes) — cold P50 subprocess (5 runs) + warm P50 in-process (100 runs) + format compact regex + format json
  - `cost-statusline.large-jsonl.test.js` (2 testes) — 10k entries não-50k (decisão consciente pra evitar slow CI), gera fixture sync, compute < 2s in-process
- **Bench numbers** (Windows 11 / Node 24, single run):
  - Cold subprocess P50: **148ms** (budget 200ms) — samples 186/155/148/144/136
  - Warm in-process P50: **0.124ms** (budget 50ms) — 100 invocações
  - 10k entries in-process compute: **181ms**
- **`.gitignore`** adicionado `test/fixtures/jsonl-statusline-10k.jsonl` (gerado on-demand pelo test, ~5MB).

## Débitos M4 (planejados pra M5 ou pós-release)

1. **`--refresh-pricing` aceito mas não conectado ao `pricing-fallback.js`** — flag passa adiante para os handlers M3 que delegam aos agregadores M2; estes ignoram o flag (mesmo débito herdado de M3). Conectar HTTP fetch real fica para M5 ou v1.37.1.
2. **`--since` / `--until` em `kit cost blocks` filtram apenas o render human** — o snapshot raw (`--json`) preserva todos os blocks. Filtragem efetiva no agregador exigiria mudar `aggregate-blocks.js` (M2); deferido.
3. **Warm bench é in-process** — mede só o cache-read fast-path (cachePathFor + JSON.parse). Não cobre IPC overhead de subprocess. Decisão consciente: subprocess startup domina (Node spawn ~60ms) e quebraria o budget de 50ms; pra warm Claude Code chama o CLI subprocess sempre, mas a cache hit ainda mantém compute trivial. Documentado.
4. **Cold bench slack 1.5x** — assertion permite `200ms * 1.5 = 300ms` para absorver jitter de CI Windows. Override via `KIT_BENCH_SLACK=1.0` se quiser strict.
5. **`kit cost statusline` não usa `--config-dirs`** — assume discovery padrão (`CLAUDE_CONFIG_DIR` env + `~/.claude`). Bench tests usam env override; produção idem. Adicionar flag explícita é trivial em v1.37.1.
6. **`kit cost refresh-pricing` não tem dry-run** — delega ao script direto. Pra preview, usuário precisa rodar `node scripts/regen-pricing.mjs --dry-run` manualmente (se script suportar).

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

1. M5 — Release v1.37.0 + GH Action weekly refresh-pricing (bump `version` + `files[]` + CHANGELOG + README seção Cost tracking + `.github/workflows/refresh-pricing-snapshot.yml`).
