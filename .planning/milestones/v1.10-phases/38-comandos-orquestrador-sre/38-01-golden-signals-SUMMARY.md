---
phase: 38-comandos-orquestrador-sre
plan: 01
subsystem: commands
tags: [sre, golden-signals, otel, observability, wrapper-command]

# Dependency graph
requires:
  - phase: 36-skills-foundationais-sre
    provides: skill four-golden-signals (knowledge base canônico dos 4 signals)
  - phase: 37-agentes-core-sre
    provides: agent golden-signals-instrumenter (worker que aplica patches OTel)
provides:
  - kit/commands/golden-signals.md (wrapper command)
  - 3 modos de target resolution (arquivo/diretório/número de fase)
  - dispatch padrão para golden-signals-instrumenter via Task() com 4 signals enumerados
  - cross-refs para família observability + sre (instrumentar-fase, observabilidade slo, prr)
affects: [phase-39-integracao-fluxo, phase-40-integracao-supabase, phase-41-gates-docs]

# Tech tracking
tech-stack:
  added: []  # zero novos deps — wrapper puro markdown
  patterns: [wrapper-command-pattern, agent-dispatch-via-task, target-resolution-3-modes]

key-files:
  created:
    - kit/commands/golden-signals.md
  modified: []

key-decisions:
  - "Wrapper puro — comando NÃO duplica lógica do agent; minimiza superfície de manutenção"
  - "3 modos de target resolution (arquivo/diretório/número de fase) — flexibilidade pragmática alinhada com /instrumentar-fase precedente"
  - "Description 177 chars (anti-pitfall A2 ≤ 200) — agressivo cuts em texto secundário, mantém substantivo"
  - "Cross-refs ativos para família observability v1.9 (/instrumentar-fase) + SRE (/prr) no Step 4 de output — comando vira hub de chaining"

patterns-established:
  - "Padrão de wrapper command para agent SRE: parse $ARGUMENTS → resolve target (3 modos) → Task(subagent_type=...) → forward output"
  - "Padrão de dispatch prompt: enumerar literalmente os signals/axes que o agent deve cobrir (anti-prompt-drift)"
  - "Padrão de smoke test: verificar canonical anchors == 1 + cross-refs presentes + kit sync install <ide> instala arquivo"

requirements-completed: [CMD-SRE-01]

# Metrics
duration: 9 min
completed: 2026-05-07
---

# Phase 38 Plan 01: Comando /golden-signals — Summary

**Wrapper command kit/commands/golden-signals.md (142 linhas / 6.1 KB) que dispatch para `golden-signals-instrumenter` via `Task(subagent_type=...)` e suporta 3 modos de target resolution (arquivo único, diretório, número de fase) — entrada canônica do user para aplicar 4 golden signals OTel (Latency histogram + Traffic counter + Errors counter + Saturation gauge) em código de serviço.**

## Performance

- **Duração:** 9 min
- **Iniciado:** 2026-05-07T03:38:00Z
- **Concluído:** 2026-05-07T03:47:00Z
- **Tarefas:** 3 (T1 frontmatter+objective+context, T2 process 4-steps, T3 success_criteria+smoke)
- **Arquivos modificados:** 1 (`kit/commands/golden-signals.md` — criado)

## Realizações

- **Wrapper puro criado** — comando dispatch para `golden-signals-instrumenter` (Phase 37 Plan 01) via `Task(subagent_type=...)` sem duplicar lógica do agent. Tamanho final 6.1 KB / 142 linhas (dentro da estimativa 5-7 KB do plano).
- **3 modos de target resolution implementados** em Step 2: número de fase (regex `^[0-9]+$` → extrai files_modified de PLAN.md(s)), diretório (`find -type f`), arquivo único — flexibilidade que cobre fluxo individual (1 handler) até fase inteira (todos arquivos).
- **4 signals literalmente enumerados** no dispatch prompt do Step 3 (Latency com explicitBucketBoundaries exponencial + dimension result=success|error, Traffic counter incrementado pré-processamento, Errors counter por error_type enum 5-15 valores, Saturation ObservableGauge do recurso mais escasso) — anti-prompt-drift garante que o agent cumpra contrato canônico.
- **Cross-refs ativos** para família completa de comandos: `/instrumentar-fase` (v1.9 — spans/wide events complementares), `/observabilidade slo <feature>` (v1.9 — SLO event-based após baseline), `/prr --service` (v1.10 — gate antes de production). Comando vira hub de chaining.
- **Smoke validation passou** — `kit sync install claude-code` instala arquivo em `.claude/commands/golden-signals.md` com sucesso (SYNC_OK).
- **Cobre CMD-SRE-01 integralmente** — único requisito mapeado para este plano.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T1: Frontmatter + objective + context** — `c550065` (feat)
   - Frontmatter válido: `name: golden-signals`, `description: 177 chars (≤200)`, `argument-hint`, `allowed-tools` com `Task` + `AskUserQuestion`
   - `<objective>` com cross-refs Markdown ativos para `golden-signals-instrumenter` agent + `four-golden-signals` skill
   - `<context>` com 3 flags (`--service`, `--saturation`, `--runtime`) + 4 exemplos de uso

2. **T2: Process block 4 steps** — `ffcfc1f` (feat)
   - Step 1: parse `$ARGUMENTS` para `<target>` + 3 flags com fallback de uso
   - Step 2: 3 modos de resolução (número de fase via `tools.cjs init phase-op`, diretório via `find`, arquivo único via `[ -f ]`)
   - Step 3: `Task(subagent_type="golden-signals-instrumenter")` com prompt enumerando 4 signals literalmente
   - Step 4: pós-output template com cross-refs para `/instrumentar-fase`, `/observabilidade slo`, `/prr`

3. **T3: Success criteria + smoke** — `c7df545` (feat)
   - `<success_criteria>` com 6 bullets cobrindo target parse, resolution, dispatch, patches, output, cross-refs
   - Smoke validation: 4 canonical anchors == 1 cada, subagent_type literal 1×, 4 signals (Latency 5× / Traffic 4× / Errors 4× / Saturation 10×) todos ≥3, `kit sync install claude-code` SYNC_OK

## Arquivos Criados/Modificados

- `kit/commands/golden-signals.md` — comando wrapper de 142 linhas / 6.1 KB:
  - Frontmatter com `Task` tool habilitado
  - `<objective>` cross-refs ativos
  - `<context>` 3 flags + 4 exemplos
  - `<process>` 4 steps numbered (parse → resolve 3-modes → dispatch → output)
  - `<success_criteria>` 6 bullets

## Decisões Tomadas

- **Wrapper puro** — comando não duplica lógica do agent. Minimiza superfície de manutenção: mudanças no agent (Phase 37) não requerem patch no comando. Único acoplamento é o nome do `subagent_type` literal.
- **3 modos de target resolution** — alinhado com precedente `/instrumentar-fase` v1.9 que aceita `<phase> [<plan>]`; aqui generalizamos para também aceitar arquivo/diretório direto, garantindo que o user pode aplicar signals em escopos micro (1 handler) até macro (fase inteira).
- **Description 177 chars** — descrição substantiva e auto-explicativa nomeando os 4 signals literalmente (Latency histogram, Traffic counter, Errors counter, Saturation gauge), abaixo do budget 200 chars do anti-pitfall A2.
- **Cross-refs ativos no Step 4 (output)** — comando vira hub de chaining: após `/golden-signals` o user é convidado a chamar `/instrumentar-fase` (complementar — spans/wide events), `/observabilidade slo` (próximo passo de SLO event-based), `/prr` (gate antes de production). Padrão a replicar nos demais wrappers SRE.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

Notas de execução:
- A smoke `npx kit-mcp sync claude-code --project-root <tmp>` no plano usa o pacote npm publicado (v1.9.0 em latest) que ainda não inclui o novo comando. Substituí por `node bin/cli.js sync install claude-code --project-root <tmp>` (CLI local, idem semântica) — desvio cosmético sem mudança de critério (file existe em `.claude/commands/golden-signals.md` após sync = pass).

**Total de desvios:** 0 corrigidos automaticamente.
**Impacto no plano:** zero — todos os critérios de aceitação verificados conforme escrito.

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Comando golden-signals pronto para uso** — após próximo `kit sync install claude-code` no consumidor, slash command `/golden-signals` fica disponível.
- **Próximo plano (38-02 auditar-toil)** — pronto para executar em paralelo (depends_on vazio); padrão wrapper estabelecido neste plano serve de template direto.
- **Integração com Phase 41 (gates)** — gate `golden-signals-coverage` (Plan 41-?) vai verificar regex `histogram\|counter\|gauge\|saturation` em código tocado por fase; este comando popula esse atributo via dispatch para o agent que escreve os patches.

---
*Phase: 38-comandos-orquestrador-sre*
*Concluída: 2026-05-07*
