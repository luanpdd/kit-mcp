---
phase: 85-token-economy-wave-2
plan: 02
subsystem: docs
tags: [kit-content, agent-headers, token-economy, manifest, dedup, compatibility-matrix]

requires:
  - phase: 83-core-fs-hardening
    provides: file-manifest verification (verifyManifest in src/core/manifest-verify.js) — manifest gating for sync install
provides:
  - kit/COMPATIBILITY.md as canonical IDE × agent matrix (single source of truth)
  - 27 agents with `**Compat:**` reference line + relative link replacing inline tables
  - Regenerated kit/file-manifest.json (327 entries, hashes refreshed)
  - test/unit/compatibility-dedup.test.js (3 regression tests)
affects: [phase-86 manifest-tooling, phase-87+ agent-edits, all multi-agent sessions]

tech-stack:
  added: []
  patterns:
    - "Canonical reference pattern — agents linkam para single-source-of-truth via `**Compat:**` linha + relative markdown link"
    - "3 patterns canônicos de tier IDE × MCP — A (filesystem-only), B (Supabase MCP-dependent), C (MCP-augmented degraded)"
    - "Manifest scope curated (não auto-walk) — preserva existing.files keys; só hashes refreshed em phase-85"

key-files:
  created:
    - kit/COMPATIBILITY.md
    - test/unit/compatibility-dedup.test.js
  modified:
    - kit/agents/ai-mutation-tester.md
    - kit/agents/burn-rate-forecaster.md
    - kit/agents/cascading-failures-auditor.md
    - kit/agents/golden-signals-instrumenter.md
    - kit/agents/incident-investigator.md
    - kit/agents/legacy-characterizer.md
    - kit/agents/load-shedding-instrumenter.md
    - kit/agents/observability-coverage-auditor.md
    - kit/agents/observability-instrumenter.md
    - kit/agents/omm-auditor.md
    - kit/agents/payload-capture-instrumenter.md
    - kit/agents/postmortem-writer.md
    - kit/agents/prr-conductor.md
    - kit/agents/refactor-safety-auditor.md
    - kit/agents/release-pipeline-auditor.md
    - kit/agents/seam-finder.md
    - kit/agents/shotgun-surgery-detector.md
    - kit/agents/slo-engineer.md
    - kit/agents/storytelling-analyst.md
    - kit/agents/supabase-architect.md
    - kit/agents/supabase-auth-bootstrapper.md
    - kit/agents/supabase-edge-fn-writer.md
    - kit/agents/supabase-migration-writer.md
    - kit/agents/supabase-realtime-implementer.md
    - kit/agents/supabase-rls-writer.md
    - kit/agents/supabase-storage-implementer.md
    - kit/agents/toil-auditor.md
    - kit/file-manifest.json

key-decisions:
  - "3 patterns (A/B/C) em vez de 2 — Pattern C captura agents MCP-augmented degraded (observability-coverage-auditor, payload-capture-instrumenter, shotgun-surgery-detector) que CONTEXT.md / PLAN não previam separadamente. Postmortem-writer ficou como variant inline (Partial em todos os non-Claude/Cursor) sem promover a 4º pattern para evitar over-classification."
  - "Manifest version preservada (1.13.0) — Phase 86 introduz `scripts/regen-manifest.js` com bumping pattern explícito. Phase 85 só atualiza hashes + timestamp."
  - "kit/COMPATIBILITY.md NÃO adicionado ao manifest — manifest scope é curado, expansão fica para Phase 86. verifyManifest só checa o que está NO manifest; arquivo adicional em kit/ não bloqueia."
  - "Inline node script para regen (no Bash tool call) — não criou `scripts/regen-manifest.js` per CONTEXT.md decision: Phase 86 cuida disso."

patterns-established:
  - "Canonical reference: cada item duplicado em N agents (compatibility tables, future common patterns) deve ter SOURCE OF TRUTH único + linha de referência por agent. Reduz drift, single update point."
  - "Pattern matrix horizontal (1 row/agent) — grep-friendly, table-render em IDEs, 50 linhas vs 300 linhas se 27 sub-sections."

requirements-completed:
  - PERF-15-02

duration: 6.5min
completed: 2026-05-09
---

# Phase 85 Plan 02: Compatibility Dedup Summary

**Single canonical kit/COMPATIBILITY.md substitui 27 tabelas inline duplicadas em agents — cada agent ganhou linha `**Compat:**` + link relativo; manifest regenerado limpo; 3 regression tests garantem zero drift.**

## Performance

- **Duração:** 6min 27s
- **Iniciado:** 2026-05-09T12:05:39Z
- **Concluído:** 2026-05-09T12:12:06Z
- **Tarefas:** 3
- **Arquivos modificados:** 30 (1 novo COMPATIBILITY.md + 27 agents editados + manifest + test file)

## Realizações

- **Single source of truth:** `kit/COMPATIBILITY.md` (65 linhas) consolida matriz × agent × IDE × tier × capability — atualização futura toca 1 arquivo, não 27.
- **Token economy estrutural:** 271 linhas removidas (per-agent tables), 27 linhas adicionadas (`**Compat:**` lines) — net -244 linhas no kit, redução ~10× no overhead duplicado. Sessions multi-agent (executor + planner + ui-researcher + verifier etc) economizam tokens proporcionalmente.
- **3 patterns canônicos identificados:** A (filesystem-only Full em todos), B (Supabase MCP-dependent), C (MCP-augmented degraded) — explicitamente documentados em "Visão Geral por Pattern" do COMPATIBILITY.md.
- **Manifest regen sem regressão:** 327/327 SHA256 verified clean; sync install dry-run smoke (321 files synced) confirma `verifyManifest` não bloqueia.
- **Regression tests:** 3 tests em `test/unit/compatibility-dedup.test.js` — heading absent + reference line + manifest verifies — garantem que futuras edições em agents não revertam acidentalmente.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (per parallel_execution context):

1. **Tarefa 1: Criar kit/COMPATIBILITY.md canônico** — `844c0e7` (feat)
2. **Tarefa 2: Substituir bloco em 27 agents** — `cbe5956` (refactor; 27 files changed, 27 insertions(+), 271 deletions(-))
3. **Tarefa 3: Regen manifest + 3 regression tests** — `21be5e4` (chore)

## Arquivos Criados/Modificados

**Criados:**
- `kit/COMPATIBILITY.md` (65 linhas) — Matriz horizontal por agent + Visão Geral por Pattern + Troubleshooting
- `test/unit/compatibility-dedup.test.js` (76 linhas, 3 tests) — Regression suite PERF-15-02

**Modificados:**
- 27 `kit/agents/*.md` — bloco `## Compatibilidade` (~6-12 linhas) substituído por linha única `**Compat:**`
- `kit/file-manifest.json` — 327 entries com SHA256 frescos, timestamp `2026-05-09T12:11Z`, version `1.13.0` preservada

## Decisões Tomadas

1. **3 patterns em vez de 2.** O PLAN previu 2 patterns (A/B); leitura sistemática dos 27 agents revelou 3 + 1 variant. Pattern C (MCP-augmented degraded — full em Codex também, partial só em Gemini+) cobre observability-coverage-auditor, payload-capture-instrumenter, shotgun-surgery-detector — agents que funcionam razoavelmente sem MCP usando filesystem como fallback. Postmortem-writer ficou inline como variant (Partial all non-Claude/Cursor) sem promover a Pattern D.
2. **Manifest version preservada (1.13.0).** Phase 86 introduz tooling de bumping; Phase 85 só refresca hashes.
3. **kit/COMPATIBILITY.md fora do manifest.** Adicionar entry nova é scope expansion — Phase 86 cuida (auto-discover via scripts/regen-manifest.js).
4. **Inline node script para regen.** CONTEXT.md decision: não criar `scripts/regen-manifest.js` em Phase 85.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 2 — Funcionalidade ausente] Pattern C (MCP-augmented degraded) não previsto no PLAN**
- **Encontrado durante:** Tarefa 1 (read_first lendo 27 agents)
- **Problema:** PLAN.md interfaces seção previa apenas Pattern A (Full em todos) e Pattern B (Supabase MCP-dependent com 3 tiers). Leitura sistemática revelou 3 agents (observability-coverage-auditor, payload-capture-instrumenter, shotgun-surgery-detector) que NÃO se encaixam em A nem B — Full em Claude/Cursor/Codex, Partial em Gemini+/Windsurf+. Mais 1 variant (postmortem-writer) com Partial em todos non-Claude/Cursor.
- **Correção:** Introduzi Pattern C com linha canônica `**Compat:** Full em Claude Code + Cursor + Codex (com MCP/embedder); Partial em Gemini CLI + Windsurf/Antigravity/Copilot/Trae`. Postmortem-writer ficou como linha custom inline (não promove a 4º pattern para evitar fragmentação). COMPATIBILITY.md "Visão Geral por Pattern" documenta os 3 patterns explicitamente.
- **Arquivos modificados:** 4 agents (observability-coverage-auditor.md, payload-capture-instrumenter.md, shotgun-surgery-detector.md, postmortem-writer.md) + kit/COMPATIBILITY.md.
- **Verificação:** Test `PERF-15-02: all 27 deduped agents have **Compat:** reference line + relative link to COMPATIBILITY.md` valida que TODOS os 27 (incluindo os 4 com tier custom) têm linha canônica + link.
- **Comitado em:** `cbe5956` (Task 2)

---

**Total de desvios:** 1 corrigido automaticamente (Regra 2 — funcionalidade crítica ausente).
**Impacto no plano:** Necessário para correção semântica — sem Pattern C, esses 4 agents teriam sido forçados em A ou B errado, perdendo informação sobre tier degraded. Sem expansão de escopo (mesmo input/output, classificação mais fina).

## Problemas Encontrados

**Edge cases descobertos durante a edição:**

1. **shotgun-surgery-detector tem 4 colunas** (não 3) — coluna extra "Embedding source" (`OpenAI API OR pgvector` / `—`). A linha `**Compat:**` resumida absorveu essa info ("com OpenAI API ou pgvector"). Capability resumida em COMPATIBILITY.md preserva a justificativa.
2. **prr-conductor tem nota multilinha** ("Modo offline fallback" com 2 frases). Substituído integralmente; substância migrada para "Capability resumida" em COMPATIBILITY.md.
3. **Notes em Pattern A** (8 dos 13 — golden-signals-instrumenter, observability-instrumenter, refactor-safety-auditor, etc) tinham justificativa "Não usa `mcp__supabase__*`". Substância preservada em COMPATIBILITY.md "Capability resumida" (ex: "Não usa `mcp__supabase__*` — instrumentação em arquivos do app").

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Notas sobre Reverse-Sync Drift

Se algum agent já foi reverse-synced para uma IDE pelo user (Claude Code/Cursor) antes deste plan, o conteúdo dos arquivos sincronizados está agora divergente do `kit/` source. **Não-bloqueador:** próximo `kit sync install <ide>` reaplica conteúdo canônico (com nova linha `**Compat:**`). User pode também rodar `kit sync reverse <ide>` se houver edits locais a preservar.

## Prontidão para Próxima Fase

- **Phase 85 Plan 02 fechado.** PERF-15-02 atendido — token economy estrutural confirmada (271 → 27 linhas).
- **Plan 85.01 (PERF-15-01 terse mode) está em paralelo** — seu manifest ainda pode estar stale após este plan se 85.01 também tocar agentes; não é o caso (85.01 toca src/mcp-server e src/cli, não kit/agents).
- **Phase 86 (manifest-tooling) recebe input claro:** scripts/regen-manifest.js + bumping pattern + auto-discover devem suceder o approach inline deste plan. Manifest version 1.13.0 mantida — primeira candidata a bump em Phase 86 ou no próximo milestone.
- **Stable API v1.0+ preservada:** mudanças são content-only no kit; zero impact em src/ (tools, schemas, contracts inalterados).
- **Suite total:** 282 testes (198 unit + 84 integration), 0 fails — ≥ baseline (273) + Plan 01 (4 esperados) + Plan 02 (3 entregues).

## Self-Check: PASSED

- ✅ `kit/COMPATIBILITY.md` exists (65 linhas, 27 rows na matriz)
- ✅ `test/unit/compatibility-dedup.test.js` exists (76 linhas, 3 tests)
- ✅ Commit `844c0e7` exists in git log (Task 1)
- ✅ Commit `cbe5956` exists in git log (Task 2)
- ✅ Commit `21be5e4` exists in git log (Task 3)
- ✅ Zero `## Compatibilidade` headings in kit/agents/*.md (Grep count: 0)
- ✅ 27 `**Compat:**` lines in kit/agents/*.md (Grep count: 27)
- ✅ `verifyManifest('kit')` returns `{ok: true}` (manifest ok)
- ✅ 3/3 PERF-15-02 tests pass + suite total 0 fails (282 tests)
- ✅ Sync install dry-run smoke does NOT raise EMANIFESTMISMATCH (321 files synced)

---
*Fase: 85-token-economy-wave-2*
*Plan 02 concluído: 2026-05-09*
