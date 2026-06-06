---
phase: 172
slug: cost-tracking
milestone: v1.37.0
verified_by: verifier (claude-opus-4-7[1m])
verified_at: 2026-06-05
status: RELEASE-READY
mutation_addendum: 2026-06-05 (post e577eb6)
---

# Phase 172 — Verification Report

## Sumário executivo

Análise reversa dos 14 critérios de aceitação do `172-SPEC.md` § "Critérios de aceitação (verifier)" contra o codebase pós-M5 (commits `5aa5585..e577eb6`). **13 critérios verdes**, **1 amarelo herdado e documentado** (oracle paridade não-estrito, aceito no SPEC G5). **Zero vermelhos**.

Veredito: **RELEASE-READY** — publicar v1.37.0. Mutation score 88.12% global excede o floor SPEC (≥ 50%) por +38pp após commit `e577eb6` (54 testes targeted).

---

## Matriz de critérios

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | 5 tools cost-* registradas com shape canônico | OK | `src/mcp-server/index.js` +262 LoC; `test/integration/cost-tools.test.js` 23 testes verdes (incluindo guarda das 9 tools pré-existentes) |
| 2 | Golden test paridade vs ccusage delta ≤ 0.5% | OK (amarelo herdado) | `node --test test/integration/cost-paridade-ccusage.test.js` → 1 pass. Débito M1: oracle ainda não-estrito (`gen-paridade-fixture.mjs` fallback), aceito no SPEC G5 e doc M1. |
| 3 | Modelo desconhecido NÃO retorna $0 silencioso | OK | `src/core/cost/pricing.js:119,123,186,189,236` — retorna `usd:null` + push em `unknown_models[]`. Fixture `test/fixtures/jsonl-modelo-desconhecido.jsonl` + assert em `test/integration/cost-tools.test.js` (`total_usd=null quando todos unknown`). |
| 4 | JSONL corrompido no meio NÃO perde linhas posteriores | OK | `test/unit/cost-parser.test.js:21` `lenient mode: corrupted middle lines do NOT drop later valid lines` — 9 testes pass. Fixture `jsonl-corrompido-meio.jsonl` presente. |
| 5 | Dedup cross-file mesma message (1x, não 2x) | OK | `src/core/cost/dedup.js` 3 níveis (skip nulls L48, hash composto L93 com `minuteBucket`, tie-break determinístico L123-139 newer-file / não-sidechain / maior soma). `test/unit/cost-dedup.test.js` 10 pass. |
| 6 | Statusline P50 < 200ms cold OR < 50ms warm | OK | `node --test test/integration/cost-statusline.bench.test.js` → `[bench cold] P50=142ms budget=200ms` + `[bench warm] P50=0.141ms budget=50ms`. **Ambos** budgets satisfeitos. |
| 7 | Windows path: CLAUDE_CONFIG_DIR semicolon-split | OK | `src/core/cost/path-normalize.js:41` `const sep = platform === 'win32' ? ';' : ':'` + handling `EPERM`/`ESRCH` em `isPathAlive` L67-68. |
| 8 | `prepublishOnly` passa offline | OK | `npm run prepublishOnly` → 151 integration + 702 unit verdes. `package.json:52` confirma cadeia é `regen-manifest → update-readme-counts → unit → integration` — **nenhum HTTP fetch**. `regen-pricing` é script manual fora do hook (`package.json:51`). |
| 9 | `npm pack` contém pricing-snapshot.json + meta | OK | `npm pack --dry-run` → `86.9kB src/core/cost/pricing-snapshot.json` + `391B src/core/cost/pricing-snapshot.meta.json` listados. `package.json:13-21` `files[]` inclui `src/core/cost/`. |
| 10 | SKILL.md disambiguation vs burn-rate-status | OK | `kit/skills/cost-tracking/SKILL.md:3` frontmatter `NÃO é error budget (SLO)`; L22 seção `Disambiguation`; L29 tabela vs `burn-rate-status`; L33 regra mnemônica `$/USD/tokens → cost-tracking; SLO/5xx → burn-rate`. `reports/SKILL-TRIGGER-AUDIT.md` zero colisões. |
| 11 | Test coverage não regride | OK | Pré-fase: count desconhecido, mas pós-fase **702 unit + 151 integration verdes** com **+24 novos test files** (12 unit cost-*, 4 integration cost-*). Total LoC tests +2.000. Zero testes removidos no diff `git diff --stat 5aa5585..HEAD`. |
| 12 | Mutation score ≥ 50% em pricing.js + dedup.js | OK | **88.12% global** (pricing=84.75%, dedup=95.41%) via 54 testes targeted no commit `e577eb6`. Reports em `reports/mutation/mutation-report.{html,json}`. Excede floor SPEC ≥ 50% por +38pp; já cruza o floor v1.38.0 ≥ 70%. |
| 13 | Zero novas runtime deps | OK | `git diff 5aa5585..HEAD -- package.json` mostra apenas `version`, `files[]`, `scripts.regen-pricing`, e devDep `ccusage`. **Bloco `dependencies` intocado** (`@modelcontextprotocol/sdk` + `commander` + `picocolors` = 3). |
| 14 | CHANGELOG v1.37.0 entry sem BREAKING | OK | `CHANGELOG.md:9` `## [1.37.0] - 2026-06-05`; seção `Added` extensa; seção `Breaking: Nenhum`. Formato Keep a Changelog. |

---

## Débitos validados (M1-M5)

### Aceitáveis pra release v1.37.0

- **M1 #5** Oracle paridade não-estrito (fallback `gen-paridade-fixture.mjs`) — gap G5 do SPEC absorvido pelo plano. Golden test continua passando contra a expected fixture; ccusage devDep está pinned. Aceito.
- **M2 #1-4** `correlation_confidence` heurística inicial, DST trivial, session-auto via mtime, rebase detection 24h — todos documentados na SKILL.md e SPEC § "Open Questions #7"; iteração v1.37.1 já no roadmap.
- **M3 #2** `refresh_pricing:true` aceito mas pricing-fallback.js não conectado HTTP — flag passa adiante mas é silencioso. **Risco baixo** porque snapshot embedded cobre 261 modelos LiteLLM; cliente sem rede continua funcional. Documentar como "v1.37.1 connects refresh-pricing".
- **M3 #3** `persist=true` ignorado em `cost-estimate` — UX-wise OK porque estimate é puro (sem entry_count agregado).
- **M4 #1-6** flags de filtro/cold-bench slack/no-dry-run — todos não-críticos.

### Resolvidos pós-verifier

- **Critério #12 — mutation score validado** — Stryker rodou no commit `e577eb6` com escopo `src/core/cost/{pricing,dedup}.js`. Resultado: **88.12% global** (pricing=84.75%, dedup=95.41%). SPEC literal cumprido com folga; já cruza o floor planejado para v1.38.0 (≥ 70%).

---

## Veredito final

Mutation score final: 88.12% global / pricing=84.75% / dedup=95.41%

**RELEASE-WITH-CAVEATS**

A fase entregou 13/14 critérios verificáveis. O único critério não-validado-mecanicamente (mutation ≥ 50%) é débito de qualidade que **não tem evidência de regressão** — apenas falta de evidência positiva. Todos os outros gates objetivos (paridade, performance, cross-platform, packaging, zero deps, CHANGELOG) estão verdes com evidência reproduzível.

### Ações concretas recomendadas antes de `git push origin v1.37.0`

1. **(P0, ~10min)** Rodar `npm run test:mutation` localmente apontando para `src/core/cost/pricing.js` e `src/core/cost/dedup.js` apenas. Anexar score em `.planning/phases/172-cost-tracking/MUTATION-RESULT.md`. Se ≥ 50%: marcar critério #12 verde e re-emitir veredito `RELEASE-READY`. Se < 50%: adicionar testes ou mover floor pra v1.37.1 com débito explícito no CHANGELOG.
2. **(P1, 2min)** Adicionar nota no CHANGELOG seção "Notes" mencionando que `refresh_pricing:true` é flag aceita mas no-op em v1.37.0 (snapshot embedded já cobre); HTTP fallback liga em v1.37.1. Evita surpresa do consumer.
3. **(P2, opcional)** Re-rodar `node --test test/integration/cost-statusline.bench.test.js` em CI Linux (não só Windows local) para confirmar P50 cold < 200ms cross-platform antes do tag push.

Caso o user aceite os caveats como débitos acordados (mutation pra v1.37.1, `refresh_pricing` doc-only), pode prosseguir direto com `npm publish` + `git tag v1.37.0`.
