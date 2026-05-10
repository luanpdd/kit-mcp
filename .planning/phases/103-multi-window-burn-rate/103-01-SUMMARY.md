---
phase: 103-multi-window-burn-rate
plan: 01
subsystem: observability
tags: [burn-rate, dual-window, slo, alert-thresholds, page-tier, ticket-tier, OBS-20-02, skill-burn-rate-alerting]

requires:
  - phase: 102-auto-snapshot-metrics-tool
    provides: auto-persist via persistSnapshot in handleMetricsSnapshot (snapshots no longer empty in production)
  - phase: 99-metrics-retention-burn-rate
    provides: loadSnapshots(rootDir, windowMs) accepts arbitrary window — fast (1h) and slow (6h) are 2 invocations
  - phase: 95-define-slos-burn-status
    provides: alert_thresholds.page + alert_thresholds.ticket already populated in both SLO YAMLs
provides:
  - Dual-window burn-rate calculation (fast 1h + slow 6h independent) in /burn-rate-status
  - Combined status enum: PAGE / TICKET / WARN / OK / no_data per skill burn-rate-alerting (fator 4× canonical)
  - SLO YAML schema regression: alert_thresholds.page + .ticket validated for shape + ordering + canonical multipliers
  - combinedStatus pure-function pinned by 8 canonical scenarios (PAGE/TICKET/WARN-fast/WARN-mild/OK/OK-zero/no_data/custom-mult)
affects: [/burn-rate-status, .planning/slos/, kit/skills/burn-rate-alerting/]

tech-stack:
  added: []
  patterns:
    - "Dual-window logic: 2 loadSnapshots() calls + independent burn calc + combined status enum"
    - "Defensive defaults: 14.4 (page) / 6 (ticket) / 1h / 6h applied if YAML omits alert_thresholds"
    - "Conservative no_data: ANY window with null burn → combined=no_data (never escalates on partial info)"
    - "Pure-function regression for command bash-embedded JS: helper inlined verbatim in test file"
    - "YAML extraction via line-scan + indent-tracking (vs js-yaml dep) — preserves dep budget"

key-files:
  created: []
  modified:
    - kit/commands/burn-rate-status.md (rewrite calculation steps 3.2-3.6 + table format)
    - test/unit/slo-schema.test.js (extend with 5 new alert_thresholds.page+ticket invariant tests)
    - test/unit/burn-rate-calc.test.js (extend with 8 new combinedStatus dual-window scenario tests)
    - kit/file-manifest.json (regen after kit/ content change — SHA-256 reseal)

key-decisions:
  - "Dual-window: fastBurn from 1h baseline, slowBurn from 6h baseline — 2 independent loadSnapshots() calls"
  - "Combined status logic: PAGE (both critical) / TICKET (slow only) / WARN (fast only OR mild >=1x) / OK / no_data"
  - "Conservative no_data: any window null wins — even if other window is critical, partial info does NOT escalate to PAGE"
  - "Defensive defaults applied if YAML omits alert_thresholds: 14.4 (page) / 6 (ticket) / 1h / 6h canonical Google SRE"
  - "ETA exhaustão computed from slow window (6h) — more stable signal vs fast spike"
  - "Test helper combinedStatus() inlined verbatim in test/unit/burn-rate-calc.test.js (vs exporting from src/) — preserves Stable API v1.0+ literal"
  - "Skill burn-rate-alerting cross-referenced 9× in command (frontmatter + objective + node script + footer) — fator 4× canonical referenced 5×"
  - "extractAlertBlock() in slo-schema.test.js uses line-scan + indent tracking instead of js-yaml dep — kit dep budget preserved"

patterns-established:
  - "Dual-window burn calculation: fast/slow independent + combined status enum"
  - "no_data conservatism: partial-info never escalates alert tier (must have BOTH windows healthy data to PAGE)"
  - "Defensive defaults for alert_thresholds: command applies canonical 14.4/6 if YAML omits — schema test enforces explicit declaration"
  - "Skill cross-reference pattern: command links skill in frontmatter + objective + inline + footer (4 placement layers)"

requirements-completed:
  - OBS-20-02

duration: ~30 min (Task 1: 12min rewrite, Task 2: 6min schema tests, Task 3: 5min combinedStatus tests, Task 4: 7min sanity + closure)
completed: 2026-05-10
---

# Phase 103 Plan 01: Multi-window Burn-rate (1h fast + 6h slow) — Resumo

**`/burn-rate-status` agora calcula burn rate dual-window (fast 1h + slow 6h) independentemente por SLO e combina via canonical Google SRE logic — PAGE quando ambos críticos, TICKET para slow erosion sustained, WARN para spike isolado ou mild burn ≥1×, conservativo no_data quando qualquer janela tem snapshots insuficientes.**

## Performance

- **Duração:** ~30 min (Task 1 rewrite: 12min, Task 2 schema tests: 6min, Task 3 combinedStatus tests: 5min, Task 4 sanity + closure: 7min)
- **Iniciado:** 2026-05-10
- **Concluído:** 2026-05-10
- **Tarefas:** 4 (rewrite, schema tests, combinedStatus tests, sanity + closure)
- **Arquivos modificados:** 4 (burn-rate-status.md + 2 test files + file-manifest.json regen)

## Realizações

- **Dual-window calculation** completamente substitui o single-window anterior — fast (1h baseline, page-tier) e slow (6h baseline, ticket-tier) calculados via 2 chamadas independentes a `loadSnapshots()` (Phase 99 helper).
- **Combined status enum** canonical Google SRE: PAGE (ambos críticos) / TICKET (slow only) / WARN (fast only OR mild ≥1×) / OK / no_data. Tabela de output ganha colunas `Fast (1h)`, `Slow (6h)`, `Combined` explícitas.
- **Conservative no_data** — qualquer janela com burn=null força combined=no_data, evitando escalação prematura para PAGE com informação parcial.
- **Defensive defaults aplicados** — se YAML omite `alert_thresholds.{page,ticket}`, aplicam-se 14.4 / 6 / 1h / 6h verbatim do canonical Google SRE (skill burn-rate-alerting).
- **5 testes novos em slo-schema.test.js** validam shape do YAML: page + ticket blocks com lookahead/baseline/multiplier, ordering invariant (page < ticket), canonical multipliers 14.4/6.
- **8 testes novos em burn-rate-calc.test.js** pinam combinedStatus em 6 cenários canônicos + 2 boundary/custom-mult: PAGE both, TICKET slow only, WARN fast spike, WARN mild burn, OK steady, OK zero, no_data partial info, custom multipliers.
- **Skill burn-rate-alerting cross-referenced 9×** no command (frontmatter description + objective + node script comment + footer) e fator 4× canonical referenced 5× — discoverabilidade máxima.
- **Stable API v1.0+ literal preservada** — zero alterações em `src/` e `bin/`. Mudança é exclusivamente conteúdo do kit (markdown command + tests) + manifest reseal.
- **Suite all-green pre/post**: 546 → 559 unit (+13 = 5 schema + 8 combinedStatus, exatamente como planejado), 109 integration unchanged, 0 fail, 2 skipped.

## Commits das Tarefas

Cada tarefa foi commitada atomicamente:

1. **Task 1: Rewrite kit/commands/burn-rate-status.md to dual-window calc** — `029321a` (feat)
2. **Task 2: Extend test/unit/slo-schema.test.js with 5 alert_thresholds tests** — `38e3de1` (test)
3. **Task 3: Extend test/unit/burn-rate-calc.test.js with 8 combinedStatus tests** — `8282057` (test)
4. **Task 4: SUMMARY + STATE/ROADMAP closure + manifest regen** — (este commit, docs)

## Arquivos Criados/Modificados

- `kit/commands/burn-rate-status.md` — rewrite completo dos steps 3.2-3.6 + table format. Lê `alert_thresholds.page` + `.ticket` via awk state machine, calcula fastBurn + slowBurn via 2 `loadSnapshots()` calls, combina via `combinedStatus()` inline JS, renderiza tabela com 3 colunas dedicadas (Fast / Slow / Combined). Skill cross-referenced 9× e fator 4× referenced 5×.
- `test/unit/slo-schema.test.js` — 5 testes novos OBS-20-02 mais 2 helpers (durationToMs, extractAlertBlock com line-scan + indent tracking). Testes validam: page block presente, ticket block presente, page.lookahead < ticket.lookahead, page.baseline < ticket.baseline, multipliers canonical 14.4/6.
- `test/unit/burn-rate-calc.test.js` — 8 testes novos OBS-20-02 + helper combinedStatus inline (mirroring command bash-embedded JS verbatim). Cenários: PAGE both, TICKET slow only, WARN fast spike, WARN mild, OK steady, OK zero, no_data partial, custom multipliers.
- `kit/file-manifest.json` — regen via `node scripts/regen-manifest.js` após edição de kit/. SHA-256 reseal de 328 arquivos. Necessário porque optional-deps.test.js verifica manifest integrity.

## Decisões Tomadas

1. **Dual-window via 2 loadSnapshots calls** — em vez de 1 call que filtra in-memory, 2 chamadas explícitas com janelas diferentes (1h vs 6h). Isto é o pattern natural já que `loadSnapshots(rootDir, windowMs)` aceita janela arbitrária — Phase 99 já planejou para este uso.
2. **Combined status enum (5 valores)** — PAGE/TICKET/WARN/OK/no_data segue o canonical Google SRE da skill burn-rate-alerting verbatim. Resistimos à tentação de adicionar tier intermediário (e.g. ELEVATED) — manter o enum existente preserva expectativas operacionais.
3. **Conservative no_data** — qualquer janela com burn=null wins. Mesmo quando uma janela está crítica e outra é null, combined=no_data. Rationale: paginar com info parcial é pior que esperar mais snapshots; auto-persist da Phase 102 garante que dados aparecem quase imediatamente em uso real.
4. **Defensive defaults inline** — command aplica 14.4/6/1h/6h se YAML omitir blocos. Phase 102+ schema test (Task 2) força declaração explícita, então defaults são fallback puro (failure mode safe). Test 8 do Task 3 pina o comportamento com custom multipliers.
5. **ETA computado do slow window** — mais estável vs fast spike. Burn instantâneo de 1h pode flapar; 6h smoothing dá ETA realista.
6. **combinedStatus inline em test (não export)** — preserva Stable API v1.0+ literal. Helper duplicado no test file vs export adiciona ZERO surface area. Trade-off: drift entre command e test detectado em CI próximo, não em unit tick.
7. **extractAlertBlock via line-scan + indent tracking** — alternativa a `js-yaml` dep (que violaria dep budget Phase 92.01). Robusto para shape canonical do projeto; falha graciosamente se YAML for malformed.
8. **Manifest regen via scripts/regen-manifest.js** — kit/ é tamper-evident via SHA-256 manifest. Toda edição de kit/ requer regen. optional-deps.test.js falha CI se manifest stale.

## Desvios do Plano

**1. [Regra 1 - Bug] Manifest stale após kit/ edit (descoberto em Task 4 sanity)**
- **Encontrado durante:** Task 4 (sanity + commits + closure)
- **Problema:** `node test/run.mjs test/unit` falhou em `optional-deps.test.js:211` com `kit manifest mismatch — 1 file(s) tampered: commands/burn-rate-status.md (expected 040fcc64..., got 29f12747...)`. Esta era uma falha esperada — kit/ tem manifesto SHA-256 tamper-evident e edição de kit/commands/burn-rate-status.md no Task 1 invalidou a hash anterior.
- **Correção:** `node scripts/regen-manifest.js` — regenerou hash de 328 arquivos em kit/. `kit/file-manifest.json` modificado para refletir nova hash.
- **Arquivos modificados:** `kit/file-manifest.json`
- **Verificação:** Re-rodada `node test/run.mjs test/unit` passou 559/559 (incluindo o teste optional-deps que estava falhando).
- **Comitado em:** Task 4 commit (junto com SUMMARY + STATE/ROADMAP). Manifest regen é parte natural do workflow `prepublishOnly` (`scripts/regen-manifest.js && ...`); operacionalmente se aplica também ao mid-workflow.

**Total de desvios:** 1 corrigido automaticamente (Regra 1 — Bug detectado em Task 4 sanity, manifest regen padrão).
**Impacto no plano:** zero expansão de escopo; manifest regen é workflow padrão para kit/ edits. Acrescentado nota em "Decisões Tomadas" 8.

## Problemas Encontrados

**1. extractAlertBlock — primeira regex não match ticket block**

Encontrado durante Task 2 implementation. Primeira versão do helper usava `new RegExp` com lookbehind/lookahead complexos para capturar severity sub-block — funcionou para `page:` mas falhou para `ticket:` (4 falhas de teste consecutivas). 

**Resolução:** reescrita do helper para line-scan + indent tracking (não-regex para o estrutura de blocks; regex apenas para grab de fields finais). Algoritmo: localiza `<severity>:` por pattern, captura indent dele, coleta linhas seguintes até atingir sibling key (mesmo indent + non-empty). Mais robusto e evita as armadilhas do `^` + `$` em regex multiline com keys YAML aninhados.

Após reescrita, todos os 5 testes novos passaram em primeira execução (15/15 total para slo-schema.test.js).

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Phase 103 entregou OBS-20-02** completamente. ROADMAP/REQUIREMENTS atualizados.
- **`/burn-rate-status` agora dual-window** — operadores veem PAGE / TICKET / WARN / OK / no_data combinado, com colunas explícitas Fast (1h) / Slow (6h) / Combined.
- **Snapshots auto-populados** (Phase 102) garantem que `no_data` é raro em uso real — primeiros segundos de operação produzem snapshots via auto-persist.
- **Phase 104 (PRR Emergency 4/5 → 5/5)** está pronta para começar — depende de RUNBOOK.md (já existente) + drill log template (criação direta). Sem bloqueios técnicos.
- **Skill burn-rate-alerting** continua sendo a SSOT canônica da fórmula e dos thresholds. Comandos consumidores agora referenciam-na de forma rica (9× hits no command, 5× para fator 4×). Operadores que vejam burn-rate alerts são guiados ao SSOT correto.
- **3/6 fases v1.20 concluídas** (100, 101, 102, 103) — restam 104 (PRR Emergency) + 105 (PRR Performance) para fechar o milestone.

## Self-Check: PASSED

- `kit/commands/burn-rate-status.md` exists on disk ✅
- `test/unit/slo-schema.test.js` exists on disk com 15 tests ✅
- `test/unit/burn-rate-calc.test.js` exists on disk com 27 tests ✅
- `kit/file-manifest.json` regenerated and matches ✅
- `git log --oneline --all --grep="103-01"` returns ≥ 3 commits (029321a feat + 38e3de1 test + 8282057 test) ✅
- Suite all-green: 559 unit (546→559, +13), 557 pass, 0 fail, 2 skipped ✅
- Integration: 109/109 green ✅
- Stable API v1.0+ literal preservada (`git diff --stat HEAD~3..HEAD -- src/ bin/` empty) ✅
- Skill burn-rate-alerting cross-referenced 9× in command, fator 4× referenced 5× ✅
- Defensive defaults applied per YAML omission case (Test 8 OBS-20-02) ✅

---
*Fase: 103-multi-window-burn-rate*
*Concluída: 2026-05-10*
