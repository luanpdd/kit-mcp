---
phase: 172
slug: cost-tracking
plan_for: 172-SPEC.md
authored_by: claude-opus-4-7-planner
authored_at: 2026-06-05
status: ready-for-executor
---

# Phase 172 — Cost Tracking Suite — EXECUTABLE PLAN

> Executor: leia este arquivo de cima a baixo. Cada milestone abre com um Goal mensurável, lista wave/onda, tasks numeradas (ID, descrição, arquivos absolutos, dependências, LOC estimate) e fecha com Verificação de Saída + Gate Command. **Não pule gates.**

---

## Estratégia de commits

- **1 commit por milestone** (M1..M5), NUNCA 1 commit por task.
- Mensagem: `feat(cost): M<n> <nome-curto-da-milestone>` (português curto, infinitivo/substantivo)
  - M1: `feat(cost): M1 nucleo discovery dedup pricing`
  - M2: `feat(cost): M2 agregadores today/session/blocks/phase/estimate`
  - M3: `feat(cost): M3 registra 5 MCP tools + skill cost-tracking`
  - M4: `feat(cost): M4 CLI kit cost + statusline`
  - M5: `feat(cost): M5 release v1.37.0 + GH Action pricing refresh`
- Co-author trailer obrigatório:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- Cada commit só ocorre **após** o Gate Command da milestone passar verde.
- Stage explícito por path (NUNCA `git add -A`). Listas de paths em "Arquivos tocados".

---

## Ondas de execução (paralelismo permitido)

```
Wave A (sequencial - bloqueia tudo)
  └── M1 — Núcleo
      └── Gate A: npm test -- test/unit/cost-discovery test/unit/cost-parser
                            test/unit/cost-dedup test/unit/cost-pricing*
                            test/unit/cost-path-normalize
                  + npm test -- test/integration/cost-paridade-ccusage

Wave B (sequencial após M1)
  └── M2 — Agregadores
      └── Gate B: npm test -- test/unit/cost-aggregate-* test/unit/cost-persist-snapshot

Wave C (PARALELO após M2) — M3 e M4 podem rodar em paralelo
  ├── M3 — MCP tools + skill
  │   └── Gate C1: node scripts/check-tool-descriptions.mjs
  │              + node scripts/audit-skill-triggers.mjs
  │              + node scripts/regen-manifest.js (idempotente)
  │              + npm test -- test/integration/cost-tools.test.js
  └── M4 — CLI + statusline
      └── Gate C2: npm test -- test/integration/cost-cli.test.js
                              test/integration/cost-statusline.bench.test.js
                              test/integration/cost-statusline.large-jsonl.test.js

Wave D (sequencial após M3 + M4 ambos verdes)
  └── M5 — Build pipeline + release v1.37.0
      └── Gate D: npm run prepublishOnly (deve passar OFFLINE — desconecte rede)
                + npm pack --dry-run | findstr pricing-snapshot
                + npm test (suite inteira)
```

**Política de paralelismo concreto:**
- Wave C: o executor pode abrir 2 sub-contextos (M3, M4) em paralelo SE as edits a `package.json` e `README.md` forem **deferidas para M5**. M3 e M4 NÃO devem editar package.json/README.md.
- Se executor for serial single-threaded: ordem recomendada M3 → M4 (M3 mais curta, libera contexto).

---

## Convenções globais para todas as tasks

- **Arquivos absolutos** sempre sob `D:\projetos\opensource\mcp\` (raiz do repo). O worktree atual é `D:\projetos\opensource\mcp\.claude\worktrees\optimistic-margulis-59ce23\` — paths abaixo já consideram este worktree.
- **Tests:** `node:test` nativo. Import shape:
  ```js
  import { test, beforeEach, afterEach } from 'node:test';
  import assert from 'node:assert/strict';
  ```
- **Sem TypeScript, sem Zod, sem novos deps runtime.** Validação manual.
- **MCP tools naming:** kebab-case (`cost-today`, etc).
- **CLI:** commander, espelhar pattern de `program.command('status')` em `src/cli/index.js` (linhas ~815-865).
- **Edits em arquivos compartilhados** (`src/mcp-server/index.js`, `src/cli/index.js`, `package.json`): APPEND-ONLY quando possível, preserve ordem alfabética se já existir.

---

## M1 — Núcleo (discovery + parser + dedup + pricing)

**Goal mensurável:** delta paridade ≤ 0.5% vs `ccusage` em fixture de 1k entries; modelo desconhecido NUNCA retorna `$0` silencioso.

**Wave:** A (bloqueia M2..M5)

**Paralelismo interno:** T1.1 (path-normalize) e T1.6 (regen-pricing script) podem rodar antes de T1.2-T1.5. Fixtures (T1.10) podem ser geradas em paralelo a T1.2-T1.5. Tests (T1.11) escrevem-se em qualquer ordem após o módulo correspondente existir.

### Tasks

#### M1.T1 — path-normalize.js
- **Descrição:** utilitário cross-platform: `toPosix(p)`, `splitConfigDirs(envValue)` com detecção `process.platform === 'win32'` (semicolon) vs others (colon). Inclui `isPathAlive(pid)` com try/catch para EPERM/ESRCH.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\path-normalize.js`
- **Depende de:** —
- **LOC estimate:** ~60

#### M1.T2 — discovery.js
- **Descrição:** descobre dirs de JSONL: `CLAUDE_CONFIG_DIR` (split), `XDG_CONFIG_HOME/claude`, `~/.claude` (POSIX), `%APPDATA%\claude` (Windows). Retorna `{ config_dirs: string[], jsonl_files: string[], source_map: Record<file, dir> }`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\discovery.js`
- **Depende de:** M1.T1
- **LOC estimate:** ~90

#### M1.T3 — parser.js (lenient)
- **Descrição:** JSONL parser modo `lenient` default. Por linha: try/catch JSON.parse + validação manual de shape (`typeof entry.timestamp === 'string'`, `Array.isArray(entry.messages)` ou shape Claude Code real). Retorna `{ entries, ok_count, error_count, errors: [{line_no, snippet, reason}] }`. Modo `strict` opt-in jogando exceção. Warning quando `error_count/total > 0.005`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\parser.js`
- **Depende de:** —
- **LOC estimate:** ~120

#### M1.T4 — dedup.js (3 níveis)
- **Descrição:** input `entries[]`, output `{ kept, deduped_count, skipped_entry_count }`.
  - Nível 1: skip entries com `messageId == null || requestId == null` → conta em `skipped_entry_count`.
  - Nível 2: hash composto `${messageId}|${requestId}|${model}|${minuteBucket(timestamp)}` (minuteBucket = `Math.floor(ts/60000)`).
  - Nível 3: tie-break — file mais novo (mtime) > não-sidechain > maior `input+output+cache_*` > timestamp mais cedo.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\dedup.js`
- **Depende de:** —
- **LOC estimate:** ~110

#### M1.T5 — pricing.js
- **Descrição:** load embed `pricing-snapshot.json`. Função `priceEntry(entry, snapshot)` retorna `{ usd, pricing_source: 'snapshot'|'unknown', tier_used }`. Suporta tiered 200k input/output do Claude (long-context multiplier). Modelo não no snapshot → `usd: null` + adiciona ao `unknown_models[]`. Função top-level `priceEntries(entries, snapshot, opts)` retorna agregado `{ total_usd, by_model, unknown_models, pricing_source, pricing_staleness_days }`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\pricing.js`
- **Depende de:** M1.T6 (snapshot deve existir pra teste)
- **LOC estimate:** ~150

#### M1.T6 — scripts/regen-pricing.mjs + snapshot inicial
- **Descrição:** script Node ESM que fetcha `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`, filtra chaves `anthropic/*` + variantes claude, grava `pricing-snapshot.json` + `pricing-snapshot.meta.json` (com sha256, fetched_at, source_url, model_count, litellm_commit obtido via `GET /repos/BerriAI/litellm/commits/main`). Executar uma vez agora pra popular snapshot inicial v1.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\scripts\regen-pricing.mjs`
  - NEW `D:\projetos\opensource\mcp\src\core\cost\pricing-snapshot.json`
  - NEW `D:\projetos\opensource\mcp\src\core\cost\pricing-snapshot.meta.json`
- **Depende de:** —
- **LOC estimate:** ~100 (script) + JSON gerado

#### M1.T7 — pricing-fallback.js (models.dev opt-in)
- **Descrição:** quando `refresh_pricing:true` e modelo no `unknown_models[]`, fetcha `https://models.dev/<model>.json` (ou endpoint correto). Cache em `~/.kit-mcp/pricing-cache.json` TTL 24h (override via `KIT_MCP_PRICING_CACHE_TTL_HOURS`). Write falha graceful (EACCES/EROFS → warning + segue). Marca `pricing_source: 'fallback-modelsdev'` na entry.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\pricing-fallback.js`
- **Depende de:** M1.T5
- **LOC estimate:** ~120

#### M1.T8 — scripts/generate-oracle-paridade.mjs
- **Descrição:** roda `ccusage` (devDep CLI/lib) contra `test/fixtures/jsonl-paridade-ccusage.jsonl`, captura output JSON, grava `test/fixtures/jsonl-paridade-ccusage.expected.json`. NÃO é executado em CI — apenas manual quando atualizar fixture.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\scripts\generate-oracle-paridade.mjs`
- **Depende de:** —
- **LOC estimate:** ~70

#### M1.T9 — devDep ccusage no package.json
- **Descrição:** adicionar `"ccusage": "^15.0.0"` em `devDependencies`. NÃO mexer em `dependencies` nem em `version`. NÃO bump major outras coisas. (Version bump 1.37.0 fica em M5.)
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\package.json`
- **Depende de:** —
- **LOC estimate:** ~1 (apenas devDep)
- **Nota:** se houver lockfile, rodar `npm install --package-lock-only` para atualizar.

#### M1.T10 — Fixtures JSONL (7 arquivos)
- **Descrição:** criar fixtures mínimas (10-50 linhas cada salvo paridade que tem 1k):
  - `jsonl-paridade-ccusage.jsonl` — 1k entries realistas (gerar a partir de sample real anonimizado, modelos sonnet+opus mix).
  - `jsonl-paridade-ccusage.expected.json` — gerar via M1.T8.
  - `jsonl-modelo-desconhecido.jsonl` — entries com `model: "claude-3-unknown-future"`.
  - `jsonl-parcial.jsonl` — alguns campos faltando (messageId null).
  - `jsonl-corrompido-meio.jsonl` — 10 linhas válidas + 1 lixo `{{ broken` + 10 válidas após.
  - `jsonl-resume-duplicate.jsonl` — mesmo messageId em 2 arquivos (na real são 2 strings concatenadas com newline marker, ou fixture refere-se a outro fixture-pair).
  - `jsonl-windows-paths.jsonl` — entries com `cwd: "C:\\Users\\..."`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-paridade-ccusage.jsonl`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-paridade-ccusage.expected.json`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-modelo-desconhecido.jsonl`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-parcial.jsonl`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-corrompido-meio.jsonl`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-resume-duplicate.jsonl`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-windows-paths.jsonl`
- **Depende de:** M1.T8 (para `.expected.json`)
- **LOC estimate:** ~1100 (mostly data)

#### M1.T11 — Unit tests M1 (6 arquivos)
- **Descrição:** cobertura mínima dos invariantes do SPEC:
  - `cost-path-normalize.test.js`: split CLAUDE_CONFIG_DIR em win32 vs linux, isPathAlive com PID inválido.
  - `cost-discovery.test.js`: mock homedir/env, espera array determinístico.
  - `cost-parser.test.js`: linha corrompida no meio NÃO derruba subsequentes; warning quando >0.5%; modo strict joga.
  - `cost-dedup.test.js`: null messageId → skipped; resume duplicate (mesmo hash) → 1 entry kept + 1 deduped; tie-break por mtime.
  - `cost-pricing.test.js`: modelo desconhecido → `usd: null` + entra em `unknown_models[]`; tier 200k aplicado.
  - `cost-pricing-fallback.test.js`: cache hit < TTL não fetcha; cache write falha graceful.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-path-normalize.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-discovery.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-parser.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-dedup.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-pricing.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-pricing-fallback.test.js`
- **Depende de:** M1.T1, M1.T2, M1.T3, M1.T4, M1.T5, M1.T7, M1.T10
- **LOC estimate:** ~480 (80 por arquivo)

#### M1.T12 — Integration test paridade ccusage (golden)
- **Descrição:** carrega `jsonl-paridade-ccusage.jsonl`, roda pipeline kit-mcp (parse → dedup → price), compara `total_usd` e `by_model[*].usd` com `jsonl-paridade-ccusage.expected.json`. Asserção: `abs(delta) / expected <= 0.005`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\integration\cost-paridade-ccusage.test.js`
- **Depende de:** M1.T5, M1.T10 (.expected.json populado)
- **LOC estimate:** ~80

### Verificação de saída M1

Executor confirma TODOS abaixo passam:

1. Arquivos existem: `src/core/cost/{path-normalize,discovery,parser,dedup,pricing,pricing-fallback,pricing-snapshot.json,pricing-snapshot.meta.json}.js`
2. `pricing-snapshot.meta.json` tem chaves `sha256`, `fetched_at`, `source_url`, `model_count`, `litellm_commit`.
3. **Gate A command:**
   ```bash
   npm test -- test/unit/cost-discovery.test.js test/unit/cost-parser.test.js \
                 test/unit/cost-dedup.test.js test/unit/cost-pricing.test.js \
                 test/unit/cost-pricing-fallback.test.js test/unit/cost-path-normalize.test.js
   npm test -- test/integration/cost-paridade-ccusage.test.js
   ```
4. Test paridade reporta `delta_pct <= 0.5`.
5. Fixture `jsonl-modelo-desconhecido` test mostra `usd: null` (NÃO `0`).

**Commit M1** após gate verde.

---

## M2 — Agregadores

**Goal mensurável:** 5 agregadores reusáveis (`today`/`session`/`blocks`/`phase`/`estimate`) cobrem casos: fase ativa sem `completed_at`, blocks com gap > 5h, DST boundary, modelo desconhecido propagado.

**Wave:** B (após M1; bloqueia M3+M4+M5)

**Paralelismo interno:** os 5 agregadores são INDEPENDENTES entre si. Podem ser implementados em qualquer ordem ou paralelo. Persist-snapshot é último (T2.6) pois depende dos agregadores existirem.

### Tasks

#### M2.T1 — aggregate-today.js
- **Descrição:** input `{ config_dirs?, tz='UTC', refresh_pricing?, persist? }`. Roda discovery → parse → dedup → price, filtra entries do dia corrente em `tz` (default UTC), retorna shape canônico + campo `date: 'YYYY-MM-DD'`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\aggregate-today.js`
- **Depende de:** M1 completo
- **LOC estimate:** ~90

#### M2.T2 — aggregate-session.js
- **Descrição:** input `{ session_id?, config_dirs?, refresh_pricing? }`. Se `session_id` ausente, deduz da sessão ativa (heurística: arquivo JSONL mais recente com mtime < 30min). Filtra por `session_id`. Retorna shape canônico + `session_id`, `started_at`, `last_activity_at`.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\aggregate-session.js`
- **Depende de:** M1 completo
- **LOC estimate:** ~110

#### M2.T3 — aggregate-blocks.js
- **Descrição:** janelas de 5h sliding com gap-detection (entries separadas por > 5h iniciam novo bloco). Retorna `{ blocks: [{ started_at, ended_at, total_usd, by_model, entry_count, is_active }], ... }`. DST boundary: usar timestamps absolutos (epoch ms), NÃO horas locais.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\aggregate-blocks.js`
- **Depende de:** M1 completo
- **LOC estimate:** ~140

#### M2.T4 — aggregate-phase.js
- **Descrição:** input `{ phase_id, config_dirs? }`. Lê `.planning/phases/<phase_id>-*/` para inferir janela temporal (started_at = mtime de SPEC.md, ended_at = `completed_at` de STATE.md ou null se ativa). Cross-ref com `git log --since/--until` para apertar a janela. Retorna shape canônico + `phase_id`, `phase_slug`, `correlation_confidence: 'high'|'medium'|'low'|'unknown'`. Heurística confidence: high se phase tem STATE.md completed_at + commits associados; medium se só uma das duas; low se só mtime; unknown se phase não encontrada.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\aggregate-phase.js`
- **Depende de:** M1 completo
- **LOC estimate:** ~180

#### M2.T5 — aggregate-estimate.js
- **Descrição:** input `{ text: string, model?: string }`. Heurística `tokens ≈ chars/4`. Estima `input_tokens`, output assumindo ratio configurável (default 1:3 input:output). Retorna `{ estimated_input_tokens, estimated_output_tokens, estimated_usd, estimated_usd_range: [low, high], disclaimer: 'heuristic_chars_div_4_±30%', model }`. Range ±30%.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\aggregate-estimate.js`
- **Depende de:** M1.T5
- **LOC estimate:** ~80

#### M2.T6 — persist-snapshot.js
- **Descrição:** mirror de `src/core/metrics.js`. Quando `persist:true` na tool, grava `.planning/costs/<ISO-ts>.json` com o output da tool. Falha graceful se `.planning/costs/` não puder ser criado.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\core\cost\persist-snapshot.js`
- **Depende de:** —
- **LOC estimate:** ~60

#### M2.T7 — Unit tests M2 (6 arquivos)
- **Descrição:**
  - `cost-aggregate-today.test.js`: tz=UTC vs tz=America/Sao_Paulo cruza meia-noite corretamente.
  - `cost-aggregate-session.test.js`: session_id explícito vs auto-deduzida; arquivo > 30min não conta.
  - `cost-aggregate-blocks.test.js`: 3 entries em 5h → 1 bloco; gap > 5h → 2 blocos; DST boundary (relógio recua 1h) não cria bloco fantasma.
  - `cost-aggregate-phase.test.js`: phase com STATE.md completed_at → confidence high; phase ativa → medium/low; phase inexistente → unknown.
  - `cost-aggregate-estimate.test.js`: chars/4 estimate; disclaimer presente; range ±30%.
  - `cost-persist-snapshot.test.js`: persist=false não escreve; persist=true escreve em `.planning/costs/`; falha graceful em dir read-only (mockado).
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-aggregate-today.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-aggregate-session.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-aggregate-blocks.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-aggregate-phase.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-aggregate-estimate.test.js`
  - NEW `D:\projetos\opensource\mcp\test\unit\cost-persist-snapshot.test.js`
- **Depende de:** M2.T1-T6
- **LOC estimate:** ~540

### Verificação de saída M2

1. 6 arquivos `aggregate-*.js` + `persist-snapshot.js` existem em `src/core/cost/`.
2. Todos exportam função pura (testável sem rede em modo default).
3. **Gate B command:**
   ```bash
   npm test -- test/unit/cost-aggregate-today.test.js test/unit/cost-aggregate-session.test.js \
                 test/unit/cost-aggregate-blocks.test.js test/unit/cost-aggregate-phase.test.js \
                 test/unit/cost-aggregate-estimate.test.js test/unit/cost-persist-snapshot.test.js
   ```
4. Coverage incremental não regride (rodar `npm run coverage` se script existir; senão ignorar este passo).

**Commit M2** após gate verde.

---

## M3 — MCP tools + skill

**Goal mensurável:** 5 tools cost-* registradas em `TOOLS` array + `HANDLERS` map; `check-tool-descriptions.mjs` ≤ 1024 chars; `audit-skill-triggers.mjs` zero colisão; `regen-manifest.js` auto-indexa; README counter bump 9→14.

**Wave:** C (paralelo com M4)

**Paralelismo interno:** T3.1 (TOOLS entries) e T3.2 (HANDLERS implementations) devem ir no mesmo edit pra preservar correlação. T3.3 (skill) e T3.4 (slash commands) são independentes.

### Tasks

#### M3.T1 — Registrar 5 tools no TOOLS array
- **Descrição:** abrir `src/mcp-server/index.js` (~linha 40). Adicionar 5 entries em ordem alfabética se houver convenção; senão appendar no final do bloco. Cada entry com `name`, `description` (≤1024 chars, em PT-BR), `inputSchema` (manual, sem Zod — objeto literal `{ type:'object', properties:{...}, required:[...] }`).
  - `cost-today`: input `{ config_dirs?, tz?, refresh_pricing?, persist? }`
  - `cost-session`: input `{ session_id?, config_dirs?, refresh_pricing?, persist? }`
  - `cost-blocks`: input `{ config_dirs?, tz?, refresh_pricing?, persist? }`
  - `cost-phase`: input `{ phase_id, config_dirs?, refresh_pricing?, persist? }`
  - `cost-estimate`: input `{ text, model? }`
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\src\mcp-server\index.js`
- **Depende de:** M2 completo
- **LOC estimate:** ~150 (entries) no MOD

#### M3.T2 — Registrar 5 handlers + HANDLERS map
- **Descrição:** ainda em `src/mcp-server/index.js`, no bloco de handlers (~linha 581). Cada handler:
  - chama o aggregator correspondente (`aggregate-today.js`, etc) importando do core
  - retorna o shape canônico do SPEC
  - wrap try/catch retornando `{ error: { message, code } }`
  - se `persist:true`, chama `persist-snapshot.js` após produzir output
  - adicionar 5 entradas no `HANDLERS` map
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\src\mcp-server\index.js` (mesmo arquivo de T3.1, mesmo edit)
- **Depende de:** M3.T1
- **LOC estimate:** ~200

#### M3.T3 — Skill `cost-tracking`
- **Descrição:** criar `SKILL.md` com:
  - Front-matter padrão (auto-trigger keywords: `custo`, `cost`, `gasto`, `tokens`, `usd`, `ccusage`, `sessao cara`, `quanto gastei`)
  - **Disambiguation block explícito:** "Esta skill é sobre **USD/tokens gastos com Claude Code (cost-tracking)**. Para SLO error budgets, use `burn-rate-status` ou `risk-budget`. Para métricas de produtividade do framework, use `metrics-snapshot`."
  - Map de intents → tool (ex: "quanto gastei hoje" → `cost-today`)
  - Limitação documentada: LiteLLM lag-behind.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\kit\skills\cost-tracking\SKILL.md`
- **Depende de:** —
- **LOC estimate:** ~120

#### M3.T4 — Slash commands PT-BR
- **Descrição:** 3 slash commands espelhando tools com input pré-formatado:
  - `custo-hoje.md` → `cost-today {}`
  - `custo-sessao.md` → `cost-session {}` (auto-deduz session)
  - `custo-fase.md` → prompt pede `phase_id` e chama `cost-phase`
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\kit\commands\custo-hoje.md`
  - NEW `D:\projetos\opensource\mcp\kit\commands\custo-sessao.md`
  - NEW `D:\projetos\opensource\mcp\kit\commands\custo-fase.md`
- **Depende de:** —
- **LOC estimate:** ~60 total

#### M3.T5 — Regen manifest + bump README counter
- **Descrição:** rodar `node scripts/regen-manifest.js` (idempotente) para auto-indexar as 5 tools. Rodar `node scripts/update-readme-counts.js` para bump de contador (esperado 9→14 tools). Se update-readme-counts.js não existir como script, MOD manual no README só na seção de contagem (linhas que dizem "9 MCP tools"). NOTA: edits estruturais no README ficam pra M5; este passo só atualiza CONTADORES.
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\kit\manifest.json` (auto-gerado)
  - MOD `D:\projetos\opensource\mcp\README.md` (só contador)
- **Depende de:** M3.T1, M3.T2, M3.T3
- **LOC estimate:** auto-gerado

#### M3.T6 — Integration test cost-tools
- **Descrição:** spawn server MCP em subprocess (ou import handler diretamente), chama cada uma das 5 tools com input mínimo válido, assert shape canônico presente (campos do SPEC: `total_usd`, `by_model`, `entry_count`, `deduped_count`, `skipped_entry_count`, `parse_error_count`, `unknown_models`, `pricing_source`, `pricing_staleness_days`). Mock filesystem com fixtures M1.
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\integration\cost-tools.test.js`
- **Depende de:** M3.T1, M3.T2
- **LOC estimate:** ~180

### Verificação de saída M3

1. `src/mcp-server/index.js` contém literal `'cost-today'`, `'cost-session'`, `'cost-blocks'`, `'cost-phase'`, `'cost-estimate'`.
2. Cada description ≤ 1024 chars (`check-tool-descriptions.mjs` verde).
3. Skill `cost-tracking/SKILL.md` tem bloco de disambiguation.
4. **Gate C1 command:**
   ```bash
   node scripts/check-tool-descriptions.mjs
   node scripts/audit-skill-triggers.mjs
   node scripts/regen-manifest.js
   npm test -- test/integration/cost-tools.test.js
   ```
5. README counter incrementado (numericamente correto).

**Commit M3** após gate verde.

---

## M4 — CLI + statusline

**Goal mensurável:** `kit cost today --json` < 200ms para 1k entries; statusline P50 < 200ms cold OR < 50ms warm; 7 sub-actions funcionais.

**Wave:** C (paralelo com M3)

**Paralelismo interno:** T4.1 (CLI subcommand) e T4.2 (statusline) são INDEPENDENTES. T4.3-T4.5 (tests) podem rodar em paralelo após T4.1+T4.2 prontos.

### Tasks

#### M4.T1 — CLI `kit cost <action>` (7 sub-actions)
- **Descrição:** em `src/cli/index.js`, adicionar `program.command('cost')` espelhando pattern de `status` (linhas ~815-865). Sub-actions:
  - `kit cost today [--tz=UTC] [--json] [--refresh-pricing] [--persist]`
  - `kit cost session [--id=<session>] [--json] [--refresh-pricing] [--persist]`
  - `kit cost blocks [--tz=UTC] [--json] [--refresh-pricing] [--persist]`
  - `kit cost phase <phase_id> [--json] [--refresh-pricing] [--persist]`
  - `kit cost estimate <text...> [--model=claude-sonnet-4]`
  - `kit cost statusline` (delega ao M4.T2)
  - `kit cost refresh-pricing` (executa script manual `scripts/regen-pricing.mjs`)
  - Default output: tabela human-friendly via console.table ou string format simples. `--json` retorna shape canônico cru.
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\src\cli\index.js`
- **Depende de:** M2 completo
- **LOC estimate:** ~280

#### M4.T2 — Statusline command
- **Descrição:** novo arquivo `src/cli/statusline.js`:
  - Lê stdin JSON do Claude Code (contrato: `{ transcript_path, ... }`)
  - Resolve `transcript_path` → session_id
  - Computa custo da sessão atual + custo do dia + custo do bloco 5h ativo
  - Output formato compact default: `$0.42 sess | $1.20 day | $0.18 5h`
  - Env `KIT_MCP_STATUSLINE_FORMAT=verbose|json` override
  - Cache em `os.tmpdir()/kit-mcp-statusline.json` com TTL configurável (default 5s)
  - Falha graceful: print string vazia + log stderr, NÃO crashar Claude Code
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\src\cli\statusline.js`
- **Depende de:** M2 completo
- **LOC estimate:** ~150

#### M4.T3 — Integration test cost-cli
- **Descrição:** spawn `node src/cli/index.js cost today --json` com env `HOME` apontando pra fixture dir, assert output JSON tem shape canônico. Repetir pra cada sub-action (mínimo today/session/phase/estimate). Smoke test apenas — não testa pricing fidelity (já coberto em M1.T12).
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\integration\cost-cli.test.js`
- **Depende de:** M4.T1
- **LOC estimate:** ~200

#### M4.T4 — Bench cold/warm statusline
- **Descrição:** test executa statusline 5x cold (limpa cache tmpdir antes de cada run), mede P50 < 200ms. Depois 20x warm (sem limpar cache), mede P50 < 50ms. Skip em CI se env `CI_SKIP_BENCH=1` (CI lento).
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\integration\cost-statusline.bench.test.js`
- **Depende de:** M4.T2
- **LOC estimate:** ~120

#### M4.T5 — Statusline large-jsonl test
- **Descrição:** fixture com 10k entries, statusline ainda < 200ms cold (sanity).
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\test\integration\cost-statusline.large-jsonl.test.js`
  - NEW `D:\projetos\opensource\mcp\test\fixtures\jsonl-statusline-10k.jsonl` (gerado por loop)
- **Depende de:** M4.T2
- **LOC estimate:** ~100

### Verificação de saída M4

1. `kit cost --help` lista 7 sub-actions.
2. `kit cost today --json` retorna JSON válido.
3. Statusline reflete contrato stdin do Claude Code.
4. **Gate C2 command:**
   ```bash
   npm test -- test/integration/cost-cli.test.js \
                 test/integration/cost-statusline.bench.test.js \
                 test/integration/cost-statusline.large-jsonl.test.js
   ```
5. Bench tests reportam P50 dentro dos thresholds (200ms cold / 50ms warm).

**Commit M4** após gate verde.

---

## M5 — Build pipeline + release v1.37.0

**Goal mensurável:** `npm pack` gera tarball contendo `pricing-snapshot.json` + meta; `prepublishOnly` passa OFFLINE (sem rede); CHANGELOG v1.37.0 entry presente; GH Action de refresh weekly criada com permissions corretas.

**Wave:** D (após M3 + M4)

### Tasks

#### M5.T1 — package.json bumps
- **Descrição:**
  - `version: "1.37.0"`
  - `scripts.regen-pricing`: `"node scripts/regen-pricing.mjs"` (MANUAL, fora de `prepublishOnly`)
  - `files[]`: adicionar `"src/core/cost/pricing-snapshot.json"`, `"src/core/cost/pricing-snapshot.meta.json"` (e wildcard `"src/core/cost/**/*.js"` se ainda não coberto).
  - Verificar que `prepublishOnly` NÃO inclui `regen-pricing` (continua offline-safe).
  - devDep `ccusage` já estava (M1.T9).
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\package.json`
- **Depende de:** M3, M4 commits feitos
- **LOC estimate:** ~10 (json edit)

#### M5.T2 — .gitignore
- **Descrição:** adicionar linha `.planning/costs/` (snapshots persistidos não vão pro repo).
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\.gitignore`
- **Depende de:** —
- **LOC estimate:** ~1

#### M5.T3 — README seção Cost tracking
- **Descrição:** adicionar seção "Cost tracking" no README cobrindo:
  - lista das 5 tools com 1-linha cada
  - exemplo `kit cost today` output
  - exemplo statusline
  - link pra SKILL.md
  - disclaimer LiteLLM lag-behind
  - menção ao golden test ccusage
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\README.md`
- **Depende de:** —
- **LOC estimate:** ~80

#### M5.T4 — CHANGELOG v1.37.0
- **Descrição:** novo bloco no topo de CHANGELOG.md:
  - `## v1.37.0 — Cost Tracking Suite (2026-06-05)`
  - `### Features` — 5 tools, CLI, statusline, skill, GH Action
  - `### Notes` — paridade ccusage delta ≤ 0.5%, devDep ccusage adicionada
  - `### Known limitations` — LiteLLM lag, chars/4 estimate, correlation_confidence heurística
  - `### Breaking` — none.
- **Arquivos tocados:**
  - MOD `D:\projetos\opensource\mcp\CHANGELOG.md`
- **Depende de:** —
- **LOC estimate:** ~40

#### M5.T5 — GH Action refresh-pricing-snapshot.yml
- **Descrição:** novo workflow:
  - `on.schedule: [{ cron: '0 6 * * 1' }]` (segundas 6h UTC)
  - `on.workflow_dispatch: {}` para trigger manual
  - `permissions: { contents: write, pull-requests: write }`
  - `concurrency: { group: refresh-pricing, cancel-in-progress: false }`
  - Steps: checkout → setup-node 20 → `node scripts/regen-pricing.mjs` → `peter-evans/create-pull-request@v6` com branch `chore/refresh-pricing-${{ github.run_id }}`, title `chore(cost): refresh pricing snapshot`, body com diff resumido.
  - **NUNCA auto-merge.**
- **Arquivos tocados:**
  - NEW `D:\projetos\opensource\mcp\.github\workflows\refresh-pricing-snapshot.yml`
- **Depende de:** —
- **LOC estimate:** ~50

#### M5.T6 — Sanity offline + npm pack
- **Descrição:** executor desconecta rede (ou usa `npm pack --dry-run` que não toca rede para deps já instaladas), valida:
  - `npm run prepublishOnly` passa
  - `npm pack --dry-run` (ou `npm pack` + inspeção do tarball) lista `src/core/cost/pricing-snapshot.json` E `pricing-snapshot.meta.json` em files reportadas.
- **Arquivos tocados:** nenhum (validação)
- **Depende de:** M5.T1-T5
- **LOC estimate:** 0

### Verificação de saída M5

1. `package.json` version = `1.37.0`.
2. `package.json` files[] inclui `pricing-snapshot.json` + meta.
3. `prepublishOnly` NÃO contém `regen-pricing` (grep).
4. `.gitignore` contém `.planning/costs/`.
5. CHANGELOG v1.37.0 presente.
6. `.github/workflows/refresh-pricing-snapshot.yml` tem `permissions:` block e `concurrency:` block.
7. **Gate D command:**
   ```bash
   npm run prepublishOnly
   npm pack --dry-run
   npm test
   ```
8. Suite completa verde.

**Commit M5** após gate verde.

---

## Pós-release (não-bloqueante, fora desta fase)

- Tag `v1.37.0` (executor faz apenas se usuário pedir explicitamente).
- `npm publish` (executor NUNCA faz sem comando explícito do usuário).
- Abrir PR de merge para `main` (executor faz quando usuário pedir).

---

## Sumário das tasks

| Milestone | Tasks | LOC total estimado | Gate |
|---|---|---|---|
| M1 | T1.1-T1.12 (12 tasks) | ~2500 (data-heavy fixtures + tests) | Gate A |
| M2 | T2.1-T2.7 (7 tasks) | ~1200 | Gate B |
| M3 | T3.1-T3.6 (6 tasks) | ~700 + manifest auto | Gate C1 |
| M4 | T4.1-T4.5 (5 tasks) | ~850 | Gate C2 |
| M5 | T5.1-T5.6 (6 tasks) | ~180 | Gate D |
| **Total** | **36 tasks** | **~5430 LOC** | 5 commits |

---

## Anti-patterns a evitar (do SPEC)

- ❌ Tools em snake_case (G1)
- ❌ Adicionar Zod ou qualquer runtime dep (G2)
- ❌ `priceEntry` retornar `0` para modelo desconhecido (deve ser `null`)
- ❌ Parser strict-mode default (perde 50% silencioso em corrompido)
- ❌ Dedup com hash incluindo `undefined` (G6) — skip primeiro, hash depois
- ❌ `prepublishOnly` chamando `regen-pricing` (G4) — quebra offline-publish
- ❌ Auto-merge no GH Action de refresh (G6) — sempre PR aberto
- ❌ Statusline crashando o Claude Code em erro — sempre fallback string vazia

---

## Final notes para o executor

- Cada milestone fecha com 1 commit. Mensagem usa template acima.
- Se um gate falhar, NÃO commitar — fixar e re-rodar gate.
- Se um teste de performance (M4.T4) falhar marginalmente em hardware lento, registrar em PR description, NÃO bypassar.
- Mantém worktree branch atual (`claude/optimistic-margulis-59ce23`). Não criar sub-branches.
- Após M5, reporta de volta ao orchestrator com: número de commits criados, suite test result, tamanho do tarball `npm pack`.
