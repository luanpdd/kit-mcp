---
phase: 172
slug: cost-tracking
milestone: v1.37.0
status: spec-locked
effort: L
authored_by: claude-sonnet
authored_at: 2026-06-05
inputs:
  - workflow: wf_82661024-cfa (discovery + 3 designs + plan + 2 adversarial verdicts)
  - reference_impl: https://github.com/ryoppippi/ccusage (Rust crate `ccusage` v3+)
  - pricing_source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
---

# Phase 172 — Cost Tracking Suite

## Objetivo

Adicionar uma suíte completa de **cost tracking** ao kit-mcp inspirada no `ccusage` (Rust), expondo 5 MCP tools + CLI + statusline + skill, com paridade numérica auditável (delta ≤ 0.5% vs ccusage) e snapshot de pricing LiteLLM embedded at build time.

**Diferencial vs ccusage:** integração nativa com o framework de fases do kit (`cost-phase` correlaciona usage com `.planning/phases/<n>/`) — coisa que o ccusage não consegue por falta de contexto de workflow.

## Escopo

### Dentro
- Discovery + parse + dedup + pricing de JSONLs do Claude Code
- 5 MCP tools: `cost-today`, `cost-session`, `cost-blocks`, `cost-phase`, `cost-estimate`
- CLI `kit cost <action>` com 7 sub-actions
- Statusline command respeitando contrato stdin do Claude Code
- Snapshot de pricing embedded + fallback opt-in models.dev
- Skill `cost-tracking` auto-trigger por keywords
- Persistência opt-in de snapshots em `.planning/costs/<ts>.json`
- GH Action weekly de refresh de pricing-snapshot (abre PR)
- Cross-platform (Windows + Linux + macOS)

### Fora (scope-out v1.37.0, debt acordada)
- Multi-account/profile switching ativo (suporte estrutural via `config_dirs[]` mas sem UI de switch)
- Tokenizer real (tiktoken/anthropic-tokenizer) — `cost-estimate` usa heurística `chars/4` com disclaimer explícito
- Cost de outros modelos (codex, gemini, copilot) — só Anthropic Claude na v1.37.0
- Dashboard UI em `kit ui` — pode entrar em v1.38.0

## Convenções (locked)

### Naming
**TODAS** as 5 tools em **kebab-case** (consistente com `metrics-snapshot`, `reverse-sync`, `ack-restart`):
- `cost-today`, `cost-session`, `cost-blocks`, `cost-phase`, `cost-estimate`

### Dependências
**ZERO novas dependencies em runtime.** Preserva o budget de 6 deps enforçado em CI desde Phase 92.01. Para validação de shape: `typeof` + `Array.isArray` manual em `parser.js`. **Sem Zod.**

`ccusage` entra como **devDependency** pinned (`ccusage@^15.0.0` ou versão estável na data) APENAS para o golden test de paridade — não vai para `dependencies`.

### Paths cross-platform
- Discovery usa `path.sep` + `os.homedir()`
- `CLAUDE_CONFIG_DIR` parser: detecta `process.platform === 'win32'` → usa `';'`; outras plataformas → `','`
- Statusline cache: `os.tmpdir()` (já portable)
- PID liveness via `process.kill(pid, 0)` com try/catch: Windows lança `EPERM` → tratar como `alive=true`; `ESRCH` → `alive=false`; outros erros → log + `alive=false` defensivo

### Dedup (3 níveis)
1. Se `messageId` OU `requestId` for nulo/undefined → skip + incrementa `skipped_entry_count` (logado, não silencioso)
2. Hash composto `${messageId}|${requestId}|${model}|${minuteBucket(timestamp)}` para detectar resume-duplicate vs identidade idempotente
3. Tie-break: arquivo mais novo > não-sidechain > maior soma de tokens > timestamp mais cedo

### Parser
Modo default: `lenient` — try/catch por linha, retorna `{ entries, ok_count, error_count, errors: [{line_no, snippet, reason}] }`. Warning se `error_count / total > 0.5%`. Modo `strict` opt-in para tests.

### Pricing
- Snapshot embedded em `src/core/cost/pricing-snapshot.json` (gerado por `scripts/regen-pricing.mjs`)
- Meta em `src/core/cost/pricing-snapshot.meta.json` com `sha256`, `fetched_at`, `source_url`, `model_count`, `litellm_commit`
- Toda tool retorna `pricing_source: 'snapshot' | 'fallback-modelsdev' | 'unknown'` por modelo
- Toda tool retorna `pricing_staleness_days: number` (idade do snapshot)
- Modelo desconhecido → `unknown_models: string[]` no output + `usd: null` para a entry (NUNCA `$0` silencioso)
- Fallback `models.dev` opt-in via flag `refresh_pricing:true`, cache em `~/.kit-mcp/pricing-cache.json` TTL 24h
- Cache write falha graceful (EACCES/EROFS → warning + segue sem cache)

### Output canônico (todas as tools)
```js
{
  total_usd: number | null,           // null se 100% unknown_models
  by_model: Record<model, { usd, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, entry_count }>,
  entry_count: number,
  deduped_count: number,              // quantas foram descartadas pelo dedup
  skipped_entry_count: number,        // messageId/requestId null
  parse_error_count: number,
  unknown_models: string[],
  pricing_source: 'snapshot' | 'mixed' | 'fallback-modelsdev',
  pricing_staleness_days: number,
  pricing_warning?: string,           // se staleness > 30d
  // campos específicos por tool (date, session_id, blocks[], phase_id, etc.)
}
```

## Open Questions resolvidas (defaults)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Timezone `cost-today` | **UTC** (paridade com ccusage + blocks). Flag `--tz` opcional pra override local. |
| 2 | Persistir snapshots em `.planning/costs/` | **Opt-in** via flag `persist:true` (default `false`). |
| 3 | Statusline format default | **compact** (`$0.42 sess \| $1.20 day \| $0.18 5h`). Env `KIT_MCP_STATUSLINE_FORMAT=verbose\|json` override. |
| 4 | Fallback models.dev cache TTL | **24h**. Env `KIT_MCP_PRICING_CACHE_TTL_HOURS` override. |
| 5 | `cost-estimate` tokenizer | **Heurística `chars/4` + disclaimer + range ±30%**. Sem dep tiktoken. Move tokenizer real para v1.38.0. |
| 6 | GH Action weekly refresh auto-merge | **Sempre PR aberto, nunca auto-merge.** Review humano obrigatório. |
| 7 | `correlation_confidence` em `cost-phase` | **Ship v1 com heurística inicial** (high/medium/low/unknown), iterar com sinais reais em v1.37.1. |
| 8 | Multi-account | **Cobertura estrutural** via `config_dirs[]` no input das tools. Sem UI de switch. |
| 9 | Mutation testing target | **≥ 50% inicial** em `pricing.js` + `dedup.js`. Debt acordada pra ≥ 70% em v1.38.0. |

## Critical gaps absorvidos (vereditos)

| # | Gap | Mitigação no plano |
|---|---|---|
| G1 | Naming snake_case quebra convenção | ✅ Todas as 5 tools em **kebab-case** |
| G2 | Zod fantasma viola budget de deps | ✅ Validação manual `typeof/Array.isArray`, **sem Zod** |
| G3 | Windows path handling ausente | ✅ `path-normalize.js` + detecção `win32` + `EPERM` handling |
| G4 | `prepublishOnly` quebra offline | ✅ `regen-pricing` é script **manual**, fora do prepublishOnly. Refresh via GH Action weekly. |
| G5 | Oracle de paridade indefinido | ✅ `scripts/generate-oracle-paridade.mjs` roda `ccusage@<pinned>` (devDep) contra fixture e grava `*.expected.json` |
| G6 | Dedup colapsa em `hash('undefined\|undefined')` | ✅ Algoritmo 3 níveis (skip nulos, hash composto, tie-break) |
| G7 | JSONL corrompido no meio perde 50% silencioso | ✅ `parse-mode: lenient` default, retorna `error_count` + lista de erros |
| G8 | Skill keyword collision com `burn-rate-status`/`risk-budget` | ✅ SKILL.md com disambiguation explícita: "esta skill é sobre **USD/tokens gastos**, NÃO error budget SLO" |
| G9 | Statusline P50 < 50ms é fantasia em cold start | ✅ Exit criterion reescrito: **< 200ms cold OU < 50ms warm**, bench mede ambos |
| G10 | `pricing-snapshot.meta.json` ausente do `files[]` do package.json | ✅ Listado explicitamente |
| G11 | GH Action sem permissions | ✅ `pull-requests: write` + `contents: write` + `peter-evans/create-pull-request@v6` + concurrency group |
| G12 | LiteLLM lag-behind oficial (snapshot stale mesmo on fresh) | ⚠️ Documentado em SKILL.md como limitação conhecida. `pricing_staleness_days` + warning. |

## Estrutura de arquivos

```
src/core/cost/
  discovery.js              # CLAUDE_CONFIG_DIR / XDG / ~/.claude + Windows
  path-normalize.js         # cross-platform path utils
  parser.js                 # JSONL lenient parser (sem Zod)
  dedup.js                  # 3-level dedup
  pricing.js                # tiered 200k + fast-multiplier + unknown handling
  pricing-fallback.js       # models.dev on-miss + ~/.kit-mcp/pricing-cache.json
  pricing-snapshot.json     # gerado por scripts/regen-pricing.mjs
  pricing-snapshot.meta.json
  aggregate-today.js
  aggregate-session.js
  aggregate-blocks.js       # 5h windows + gap detection
  aggregate-phase.js        # cruza .planning/STATE.md + git log + mtime
  aggregate-estimate.js     # heurística chars/4 + ±30% range
  persist-snapshot.js       # opt-in mirror de metrics.js

scripts/
  regen-pricing.mjs              # fetch LiteLLM raw + filtra anthropic/*
  generate-oracle-paridade.mjs   # roda ccusage devDep → *.expected.json

kit/skills/cost-tracking/SKILL.md
kit/commands/custo-sessao.md      # opcional, espelha cost-session
kit/commands/custo-hoje.md
kit/commands/custo-fase.md

test/unit/
  cost-discovery.test.js
  cost-parser.test.js
  cost-dedup.test.js
  cost-pricing.test.js
  cost-pricing-fallback.test.js
  cost-aggregate-today.test.js
  cost-aggregate-session.test.js
  cost-aggregate-blocks.test.js
  cost-aggregate-phase.test.js
  cost-aggregate-estimate.test.js
  cost-path-normalize.test.js
  cost-persist-snapshot.test.js

test/integration/
  cost-tools.test.js
  cost-cli.test.js
  cost-statusline.bench.test.js
  cost-statusline.large-jsonl.test.js
  cost-paridade-ccusage.test.js   # golden test

test/fixtures/
  jsonl-paridade-ccusage.jsonl
  jsonl-paridade-ccusage.expected.json  # gerado por script
  jsonl-modelo-desconhecido.jsonl
  jsonl-parcial.jsonl
  jsonl-corrompido-meio.jsonl
  jsonl-resume-duplicate.jsonl
  jsonl-windows-paths.jsonl

.github/workflows/
  refresh-pricing-snapshot.yml

src/mcp-server/index.js          # MOD: append-only, 5 tools + 5 handlers
src/cli/index.js                  # MOD: subcommand `cost`
package.json                      # MOD: version 1.37.0, scripts, files[], devDep ccusage
.gitignore                        # MOD: + .planning/costs/
README.md                         # MOD: seção Cost tracking
CHANGELOG.md                      # MOD: entry v1.37.0
```

## Milestones (5 ondas)

### M1 — Núcleo (discovery + dedup + pricing)
**Goal:** delta paridade ≤ 0.5% vs ccusage em fixture de 1k entries.
- discovery.js, path-normalize.js, parser.js (lenient), dedup.js (3 níveis), pricing.js, pricing-fallback.js
- scripts/regen-pricing.mjs + pricing-snapshot.json + meta
- scripts/generate-oracle-paridade.mjs (devDep ccusage)
- 7 fixtures + 7 unit tests
- **Exit:** golden test paridade passa; modelo desconhecido NUNCA retorna `$0`.

### M2 — Agregadores
**Goal:** 5 agregadores reusáveis cobrindo today/session/blocks/phase/estimate.
- aggregate-*.js (5 arquivos)
- persist-snapshot.js (opt-in, mirror metrics.js)
- 5 unit tests
- `correlation_confidence: high|medium|low|unknown` documentado em JSDoc
- **Exit:** todos os agregadores testados isoladamente + edge cases (fase ativa sem completed_at, blocks com gap > 5h, DST boundary).

### M3 — MCP tools + skill
**Goal:** 5 tools registradas em TOOLS array + HANDLERS, skill auto-trigger.
- MOD src/mcp-server/index.js (append-only, 5 entries TOOLS + 5 handlers + 5 HANDLERS entries)
- kit/skills/cost-tracking/SKILL.md (disambiguation explícita)
- 3 slash commands kit/commands/custo-*.md
- Validar `check-tool-descriptions.mjs` ≤ 1024 chars
- Validar `audit-skill-triggers.mjs` sem colisão
- 1 integration test (cost-tools.test.js)
- **Exit:** `regen-manifest.js` auto-indexa as 5 tools; `update-readme-counts.js` bump 9→14.

### M4 — CLI + statusline
**Goal:** `kit cost <action>` funcional + statusline com cold/warm bench.
- MOD src/cli/index.js (`program.command('cost')` + 7 actions)
- statusline reads stdin → resolve transcriptPath → compute → cache tmpdir
- 1 integration test + 2 bench tests (cold/warm)
- **Exit:** `kit cost today --json` < 200ms para 1k entries; statusline P50 < 200ms cold OR < 50ms warm.

### M5 — Build pipeline + release v1.37.0
**Goal:** publicar v1.37.0 sem quebrar offline-publish.
- MOD package.json: version 1.37.0, scripts `regen-pricing` (manual), files[] inclui pricing-snapshot.json + meta, devDeps ccusage pinned
- `prepublishOnly` continua offline-safe (regen-pricing NÃO encadeado)
- MOD .gitignore: + `.planning/costs/`
- MOD README.md: seção Cost tracking
- MOD CHANGELOG.md: entry v1.37.0
- NEW .github/workflows/refresh-pricing-snapshot.yml com permissions + concurrency
- **Exit:** `npm pack` gera tarball com pricing-snapshot.json + meta; `prepublishOnly` passa offline; CHANGELOG ok.

## Critérios de aceitação (verifier)

1. ✅ Todas as 5 tools cost-* registradas e respondem com shape canônico
2. ✅ Golden test paridade vs ccusage delta ≤ 0.5%
3. ✅ Modelo desconhecido NÃO retorna $0 silencioso (verificado via fixture)
4. ✅ JSONL corrompido no meio NÃO perde linhas válidas posteriores
5. ✅ Dedup cross-file com mesma message resolvida (1x, não 2x)
6. ✅ Statusline P50 < 200ms cold OR < 50ms warm
7. ✅ Windows path: CLAUDE_CONFIG_DIR semicolon-split funciona
8. ✅ `prepublishOnly` passa em ambiente offline (sem rede)
9. ✅ `npm pack` contém `src/core/cost/pricing-snapshot.json` + `pricing-snapshot.meta.json`
10. ✅ `kit/skills/cost-tracking/SKILL.md` tem disambiguation vs burn-rate-status
11. ✅ Test coverage ≥ existing project ratchet (não regride)
12. ✅ Mutation score ≥ 50% em `pricing.js` + `dedup.js`
13. ✅ Zero novas runtime deps (apenas devDep ccusage)
14. ✅ CHANGELOG v1.37.0 entry com FEAT/zero BREAKING

## Riscos residuais (não bloqueantes)

- LiteLLM lag-behind oficial em modelos novos → mitigado por warning, não eliminado
- `correlation_confidence` heurística inicial pode dar falsos positivos → iterar v1.37.1
- `cost-estimate` chars/4 diverge em PT-BR → disclaimer + roadmap v1.38.0 tokenizer real
- Statusline P50 < 50ms só atingível com warm cache → documentado no exit criterion

## Rollback

Se v1.37.0 quebrar consumers: v1.37.1 hotfix com 5 tools cost-* removidas do TOOLS array. Sem migration de dados pois `.planning/costs/` é gitignored.
