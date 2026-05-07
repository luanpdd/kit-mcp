---
phase: 39-patches-em-observabilidade-e-supabase
plan: 02
subsystem: agents
tags: [omm, toil, cross-ref, observability, sre-integration, content-only]

# Dependency graph
requires:
  - phase: 36-skills-foundationais-sre
    provides: skill eliminating-toil (knowledge base canônico — 6 critérios, ≤ 50%, L0-L4)
  - phase: 37-agentes-core-sre
    provides: agent toil-auditor (worker que produz TOIL-AUDIT.md com % do tempo do time)
provides:
  - kit/agents/omm-auditor.md patched (Cap 3 cross-ref) — content-only
  - regra "score Cap 3 > 3 exige TOIL-AUDIT.md fresco (≤ 30d) com % toil < 30%"
  - exemplo Cap 3 no template OMM-REPORT.md mostrando sintoma "% toil pelo time"
affects: [phase-40-integracao-fluxo, phase-41-gates-docs]

# Tech tracking
tech-stack:
  added: []  # zero novos deps — patch puramente editorial em agente existente
  patterns: [agent-cross-ref-via-markdown-link, scoring-rule-with-objective-evidence, content-only-patch]

key-files:
  created: []
  modified:
    - kit/agents/omm-auditor.md (+52 / -0 lines, pure addition)

key-decisions:
  - "Patch puramente editorial — frontmatter (description, tools, color) byte-idêntico (anti-pitfall A2 preservado)"
  - "Cross-ref Markdown ATIVO `[toil-auditor](./toil-auditor.md)` em 1+ ponto — descoberta cross-agent natural via link"
  - "Regra absoluta: Cap 3 score > 3 exige TOIL-AUDIT.md fresco — incentiva uso real do toil-auditor (não opcional para alta maturidade)"
  - "Tabela de scoring específica para Cap 3 (5 rows mapping % toil → score) complementa modelo geral 1-5 sem substituí-lo"
  - "Modelo 5-capacidade canônico (resiliência, qualidade, complexidade, cadência, comportamento) preservado integralmente"

patterns-established:
  - "Padrão agent-cross-ref-via-markdown-link: agente A consulta agente B via `[B-name](./B-name.md)` em texto canônico — descoberta sem hard-coupling"
  - "Padrão scoring-rule-with-objective-evidence: Cap 3 ganha tabela específica que mapeia métrica objetiva (% toil) → score, evitando avaliação puramente qualitativa"
  - "Padrão content-only-patch: zero alterações em frontmatter, anti-pitfall A2 preservado, 100% adições editoriais em corpo"

requirements-completed: [INT-OBS-02]

# Metrics
duration: 12 min
completed: 2026-05-07
---

# Phase 39 Plan 02: Patch omm-auditor — toil cross-ref — Summary

**Patch puramente editorial de `kit/agents/omm-auditor.md` (+52 linhas / -0 linhas) que faz a Capacidade 3 (Complexidade / Tech Debt) consultar `toil-auditor` via cross-ref Markdown ativo e incorporar `% toil pelo time` no scoring 1-5 — frontmatter byte-idêntico, modelo 5-capacidade canônico preservado, regra absoluta "score > 3 exige TOIL-AUDIT.md fresco" estabelecida.**

## Performance

- **Duração:** 12 min
- **Iniciado:** 2026-05-07T07:00:00Z
- **Concluído:** 2026-05-07T07:12:00Z
- **Tarefas:** 5 (T1 verificar âncoras, T2 patch Step 0, T3 patch Step 1, T4 patch exemplo OMM-REPORT, T5 smoke validation + alinhamento)
- **Arquivos modificados:** 1 (`kit/agents/omm-auditor.md` +52 -0)

## Realizações

- **Frontmatter byte-idêntico** — `name: omm-auditor` + `description` + `tools: Read, Write, Bash, Grep, Glob, mcp__supabase__execute_sql` + `color: purple` preservados sem alteração. Anti-pitfall A2 honrado.
- **Step 0 — bloco "Capacidade 3 — Complexidade / Tech Debt"** adicionado com cross-ref ativo `[toil-auditor](./toil-auditor.md)` + shell snippet de check de `.planning/TOIL-AUDIT.md` + regra de invocação Task (se TOIL-AUDIT ausente) e flag stale (se data > 30d).
- **Step 1 — tabela específica Cap 3 (5 rows)** adicionada mapeando `% toil pelo time` → score 1-5: `> 60% → 1`, `50-60% → 2`, `30-50% → 3`, `15-30% → 4`, `< 15% → 5`. Regra absoluta: score > 3 exige TOIL-AUDIT.md fresco (≤ 30d) com `% toil < 30%`. Cross-ref ativo `[observability-maturity-model](../skills/observability-maturity-model/SKILL.md)` preservado para sintomas qualitativos complementares.
- **Step 4 — exemplo OMM-REPORT.md** ganhou bloco `### Capacidade 3 — Complexidade / Tech Debt (3, ↑)` com sintoma literal `% toil pelo time = 38%`, citação a `.planning/TOIL-AUDIT.md` (path canônico), regra ≤ 50% como benchmark, 2 action items derivados (`anti-toil-by-design` no `/discutir-fase` P2 + designar owners P1).
- **Modelo 5-capacidade canônico preservado** — tabela "Score por Capacidade" continua com 5 rows (resiliência, qualidade, complexidade, cadência, comportamento). Patch é aditivo (Cap 3 ganha evidence-specific scoring; demais capacidades inalteradas).
- **Linha "Para cada score, citar 2-3 sintomas-chave..." preservada** — patch insere bloco antes desta linha sem tocá-la.
- **Linha "[... outras capacidades ...]" preservada** — patch insere exemplo Cap 3 antes desta linha sem removê-la.
- **Smoke validation passou** — `grep -c "[toil-auditor](./toil-auditor.md)"=1`, `grep -c "Capacidade 3 — Complexidade / Tech Debt"=3` (Step 0 + Step 1 + OMM-REPORT), `grep -c ".planning/TOIL-AUDIT.md"=4` (≥ 2× target), `grep -cE "≤ ?50%"=2`, score table 5-row preservada (`grep -c "^| 5 |"=1`), pure addition diff (`numstat=52/0`), `kit sync install claude-code --mode copy` reproduz patches em `.claude/agents/omm-auditor.md` (5× toil-auditor / 3× Capacidade 3 / 11× TOIL-AUDIT).
- **Cobre INT-OBS-02 integralmente** — único requisito mapeado para este plano.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T2: Patch Step 0 — Cap 3 toil evidence collection** — `e8acb63` (feat)
   - Bloco `**Capacidade 3 — Complexidade / Tech Debt (cross-ref [toil-auditor](./toil-auditor.md)):**` inserido em Step 0 (antes da heading Step 1 — preservada)
   - Shell snippet checa `.planning/TOIL-AUDIT.md` e extrai `% do tempo do time` via grep heuristic
   - Documenta delegação opcional via `Task(subagent_type="toil-auditor", ...)` quando audit ausente
   - Documenta detecção stale (> 30d) com sinalização em "Sintomas observados"

2. **T3: Patch Step 1 — Cap 3 scoring com % toil** — `0c00165` (feat)
   - Tabela 5-row específica Cap 3 mapeando `% toil pelo time` → score 1-5 inserida após tabela `1 = Initial...`
   - Regra absoluta: "Cap 3 score nunca > 3 se TOIL-AUDIT.md ausente; score 4-5 exige audit fresco com `% toil < 30%`"
   - Cross-ref preservado para `observability-maturity-model` skill (sintomas qualitativos)
   - Linha "Para cada score, citar 2-3 sintomas-chave..." preservada

3. **T4: Exemplo OMM-REPORT.md (Capacidade 3)** — `dbef143` (feat)
   - Bloco `### Capacidade 3 — Complexidade / Tech Debt (3, ↑)` adicionado dentro do template (antes de `[... outras capacidades ...]` — preservado)
   - "Doing well" com 3 bullets (TOIL-AUDIT existe, % toil = 38%, 4 itens P0 automatizados)
   - "Doing poorly" com 2 bullets (P1 sem owner, automação reativa não by-design)
   - "Action items derivados" com 2 entries marcadas `[Cap 3]` (gate anti-toil-by-design P2 + designar owners P1)

4. **T5: Alinhamento heading Step 1** — `923e64a` (fix)
   - Step 1 heading promovido de short form `Cap 3 (Complexidade / Tech Debt)` para long form canônico `Capacidade 3 — Complexidade / Tech Debt` para parity com smoke `grep -c "Capacidade 3 — Complexidade / Tech Debt"` ≥ 3 (Step 0 / Step 1 / OMM-REPORT)
   - Single-line edit; +1 / -1

## Arquivos Modificados

- `kit/agents/omm-auditor.md` — patch +52 / -0 linhas (pure addition diff):
  - Linhas 72-95: bloco Step 0 — Cap 3 evidence collection com cross-ref `toil-auditor` + shell snippets
  - Linhas 107-117: bloco Step 1 — tabela 5-row Cap 3 scoring + regra absoluta + cross-ref `observability-maturity-model`
  - Linhas 181-194: bloco Step 4 — exemplo Cap 3 no template OMM-REPORT.md com sintoma `% toil pelo time` + path `.planning/TOIL-AUDIT.md` + 2 action items derivados

## Decisões Tomadas

- **Patch puramente editorial** — zero alterações em frontmatter (description / tools / color byte-idênticos). Anti-pitfall A2 preservado integralmente; contrato de discovery do agent v1.9 mantido.
- **Cross-ref ativo `[toil-auditor](./toil-auditor.md)`** — descoberta natural via Markdown link. Loop fechado `omm-auditor → toil-auditor → eliminating-toil skill` permite que LLM encontre toil-auditor lendo omm-auditor sem hard-coupling.
- **Regra absoluta "score > 3 exige TOIL-AUDIT.md fresco (≤ 30d)"** — incentiva uso real do `toil-auditor` (não opcional para alta maturidade Cap 3). Sem esta regra, equipes poderiam auto-pontuar Cap 3 = 4-5 sem evidência objetiva ("achismo").
- **Tabela específica Cap 3 (5 rows)** — complementa modelo geral 1-5; não substitui. Modelo geral continua válido para resiliência / qualidade / cadência / comportamento; Cap 3 ganha evidence-specific scoring porque toil é métrica diretamente mensurável.
- **Posicionamento canônico Step 0 / Step 1 / OMM-REPORT exemplo** — concentra patches em pontos de leitura natural do agent: (1) Step 0 onde caller coleta evidências; (2) Step 1 onde caller atribui score; (3) Step 4 onde template ilustra output final. Steps 2, 3, 5 não tocados.
- **Modelo 5-capacidade canônico preservado** — tabela "Score por Capacidade" continua 5 rows. Cap 3 ganha evidência específica sem reorganização do modelo subjacente.

## Desvios do Plano

**Desvio 1 — Step 1 heading** corrigido em T5:
- Plano T3 escreveu literal `**Regra específica Cap 3 (Complexidade / Tech Debt) — incorpora % toil:**` (short form `Cap 3`)
- Smoke T5 verifica `grep -c "Capacidade 3 — Complexidade / Tech Debt" ≥ 3` (long form `Capacidade 3 —`)
- Inconsistência interna no plano: short form em T3 + long form em smoke
- Resolução: heading promovida para long form canônico `**Regra específica Capacidade 3 — Complexidade / Tech Debt — incorpora % toil:**` mantendo a semântica do parágrafo
- Commit dedicado: `923e64a fix(39-02-T5)`

**Desvio 2 — smoke `kit sync` mode** clarificado:
- Plano T5 esperava `grep -q "toil-auditor"` em `.claude/agents/omm-auditor.md` após sync, mas no modo padrão `reference` o sync escreve apenas stub com link de volta para `kit/agents/`
- Em modo `copy` (`--mode copy`), sync reproduz integralmente o patch: 5× toil-auditor, 3× Capacidade 3, 11× TOIL-AUDIT presentes
- Resolução: smoke validado em mode copy (semântica do user que sincroniza para projeto externo); modo reference é dogfood interno do kit-mcp e propaga via canonical link do stub

**Total de desvios:** 2 corrigidos automaticamente.
**Impacto no plano:** zero — todos os critérios de aceitação verificados (Step 0 cross-ref, Step 1 tabela 5-row, OMM-REPORT exemplo, frontmatter byte-idêntico, ≤ 50% citado, 5-capability model preserved).

## Problemas Encontrados

Nenhum problema bloqueante.

## Configuração Manual Necessária

Nenhuma — patch é editorial puro; agente passa a operar com nova lógica Cap 3 imediatamente após `kit sync install <ide> --mode copy` no consumidor.

## Prontidão para Próxima Fase

- **Patch omm-auditor pronto** — caller agora pode pontuar Cap 3 com evidência objetiva (% toil) automaticamente. Score > 3 sem TOIL-AUDIT.md gera defaulting a 2.
- **Phase 40 (INT-FW-V2-03)** — `/auditar-marco` ganha hook para invocar `/auditar-toil` (alias para `toil-auditor`) automaticamente quando `workflow.audit_milestone_toil=true`. Este patch é pré-requisito: o resultado do toil-auditor flui para o omm-auditor via TOIL-AUDIT.md e o omm scoring agora consome esta evidência.
- **Phase 41 (gates)** — gate `omm-cap3-fresh-toil-audit` (próximo plano) pode verificar regra absoluta "score Cap 3 > 3 exige TOIL-AUDIT.md fresco (≤ 30d)" automaticamente em `/auditar-marco`.
- **Suíte SRE v1.10 — Onda 2 progride** — Phase 39 acumula plans 39-01 (event-based-slos), 39-02 (este), 39-03 (edge-fn-writer), 39-04 (architect-prr), 39-05 (migration-writer-toil); 1 plan restante (39-06 storage-implementer-saturation).

---
*Phase: 39-patches-em-observabilidade-e-supabase*
*Concluída: 2026-05-07*
