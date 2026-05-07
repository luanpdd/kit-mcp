---
phase: 38-comandos-orquestrador-sre
plan: 06
subsystem: cli-orchestrator
tags: [sre, orchestrator, dispatch, command, family-v1.10]

# Grafo de dependências
requires:
  - phase: 36-skills-foundation-sre
    provides: 5 skills SRE (sre-risk-management, four-golden-signals, eliminating-toil, blameless-postmortems, production-readiness-review) + glossário _shared-sre
  - phase: 37-agentes-core-sre
    provides: 4 agents SRE (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor)
  - phase: 38-01-golden-signals
    provides: kit/commands/golden-signals.md
  - phase: 38-02-auditar-toil
    provides: kit/commands/auditar-toil.md
  - phase: 38-03-postmortem
    provides: kit/commands/postmortem.md
  - phase: 38-04-prr
    provides: kit/commands/prr.md
  - phase: 38-05-risk-budget
    provides: kit/commands/risk-budget.md
provides:
  - kit/commands/sre.md (orquestrador único família v1.10)
  - dispatch via Task(subagent_type=...) para 4 agents SRE
  - delegate via comando direto para risk-budget
  - sinônimos PT/EN para 5 subcomandos canônicos
  - validação flags mutuamente exclusivas em postmortem e prr
  - AskUserQuestion enforcement para PRR reviewer (anti auto-PRR)
  - tabela de chains comuns documentada
affects:
  - phase 39 (integração — patches Supabase + framework)
  - phase 40 (integração observabilidade)
  - phase 41 (gates + README + CHANGELOG — exemplos end-to-end usando /sre)

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - Family orchestrator pattern (terceiro: /supabase v1.8 → /observabilidade v1.9 → /sre v1.10)
    - Anti-pitfall A10 enforcement (orquestrador único ponto de chain; agents permanecem função pura)
    - Caso especial direct-command (risk-budget delega ao comando direto, não usa Task)
    - Mutually-exclusive flag validation BEFORE dispatch (evita propagar erro ao agent)

key-files:
  created:
    - kit/commands/sre.md (227 linhas / 10.3 KB)
  modified: []

key-decisions:
  - "Cap livro como coluna canônica na tabela — torna explícita a cobertura de cap 3, 5, 6, 15, 32 do livro Google SRE"
  - "5 sub-paths em Step 4 (4a-4e) — um por subcomando — incluindo caso especial 4e risk-budget como comando direto"
  - "Sugestão de chains comuns em Step 6 — UX hint sem enforcement (chain explícito é responsabilidade do user, preserva A10)"
  - "AskUserQuestion para reviewer ausente em prr enforcement no orquestrador — anti-pattern auto-PRR não pode escapar"

patterns-established:
  - "Tabela 4-colunas em context (Subcomando, Sinônimos, Agent dispatched, Cap livro) — padrão evolutivo de v1.9 (3-col) acrescentando rastreabilidade ao livro-fonte"
  - "Roteamento de flags por subcomando enumerado em context — facilita descoberta de flags mutuamente exclusivas"
  - "Tabela de chains comuns (Subcomando rodado → Chain natural) cross-família (v1.9 + v1.10)"

requirements-completed: [CMD-SRE-06]

# Métricas
duration: 8min
completed: 2026-05-07
---

# Fase 38-06: Comando orquestrador `/sre` — Resumo

**Terceiro orquestrador da família v1.8/v1.9/v1.10 — dispatch para 4 agents SRE com sinônimos PT/EN + caso especial risk-budget como comando direto + validação flags mutuamente exclusivas pre-dispatch**

## Performance

- **Duração:** ~8 min
- **Concluído:** 2026-05-07
- **Tarefas:** 4 (T1 frontmatter+objective+execution_context, T2 context+tabela, T3 process 6-steps, T4 success_criteria+smoke)
- **Arquivos modificados:** 1 (kit/commands/sre.md criado)

## Realizações

- `kit/commands/sre.md` criado (227 linhas / 10.3 KB) com 5 âncoras canônicas (`<objective>`, `<execution_context>`, `<context>`, `<process>`, `<success_criteria>`)
- Frontmatter válido: `name: sre`, `description` 159/200 chars, `allowed-tools` inclui `Task` + `AskUserQuestion`
- Tabela canônica de subcomandos com 6 linhas (5 subcomandos + help) e 4 colunas (Subcomando, Sinônimos, Agent dispatched, Cap livro)
- Process com 6 steps numerados (parse → resolve sinônimos → detectar config.toml → dispatch 5 paths → output → chains)
- Step 4 com 5 sub-paths (4a-4e) — um por subcomando, incluindo caso especial 4e risk-budget (comando direto, não usa Task)
- Validação de flags mutuamente exclusivas em postmortem (4c) e prr (4d) ANTES de dispatch
- AskUserQuestion enforcement para reviewer ausente em prr (anti-pattern auto-PRR enforced no orquestrador)
- Tabela de chains comuns no Step 6 com 5 linhas + cross-refs `/observabilidade omm` e `/burn-rate-status` (v1.9)
- Anti-pitfall A10 ("único ponto de chain", "função pura") preservado e citado 2× literalmente
- Cross-refs Markdown ativos para 4 agents SRE + skill `sre-risk-management` + cross-refs família `/supabase` (v1.8) + `/observabilidade` (v1.9, 3×)
- Capítulos do livro (3, 5, 6, 15, 32) citados 6× combinado
- Sync `kit sync install claude-code` instala em `.claude/commands/sre.md` corretamente
- Idempotência byte-idêntica timestamp-stripped (per design Phase 36 ROADMAP crit-4)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify`:

1. **T1: Frontmatter + objective + execution_context** — `f176617` (feat)
2. **T2: Context com tabela de subcomandos + sinônimos** — `f8bf386` (feat)
3. **T3: Process 6 steps com dispatch 5 paths** — `9796b4e` (feat)
4. **T4: Success criteria + smoke + idempotência sync** — `1658aa3` (feat)

## Arquivos Criados/Modificados

- `kit/commands/sre.md` — orquestrador único da Suíte SRE (v1.10), terceiro da família após `/supabase` (v1.8) e `/observabilidade` (v1.9). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para 4 agents SRE (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) ou delega para comando direto `/risk-budget`.

## Decisões Tomadas

- **Tabela com 4 colunas (vs 3 em v1.9)**: acrescentou coluna "Cap livro" para tornar explícita a rastreabilidade ao material-fonte (livro Google SRE caps 3/5/6/15/32). Padrão evolutivo, não breaking.
- **risk-budget como caso especial documentado**: linha de tabela marca "(comando direto — `/risk-budget`)" e Step 4e tem documentação explícita do delegate ao comando direto em vez de Task. Preserva simplicidade do Plan 05 e mantém descobribilidade via orquestrador.
- **AskUserQuestion enforcement no orquestrador**: anti-pattern auto-PRR (developer aprovando próprio PRR) enforced em Step 4d antes do dispatch. Não escapa nem se o agent fosse permissivo.
- **Sugestão de chains comuns sem enforcement**: Step 6 sugere encadeamentos naturais (golden-signals → prr, postmortem → omm, etc.) mas é UX hint apenas — chain explícito permanece responsabilidade do user, preservando A10.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Todas as 4 tarefas seguidas literalmente; aceitos `acceptance_criteria` foram todos cumpridos; smoke validation passou em todos os 12 checks (description length, 5 anchors count=1, 4 agent dispatches ≥1, subcomandos counts, family cross-refs, anti-pitfall A10, book chapters, sync install, idempotência timestamp-stripped).

## Problemas Encontrados

Nenhum técnico. Smoke `kit-mcp sync` inicialmente falhou ao usar `npx kit-mcp` (binary não encontrado no PATH); resolvido invocando direto via `node bin/cli.js sync install claude-code` que é o caminho de dogfooding canônico para este projeto.

## Configuração Manual Necessária

Nenhuma — comando file content-only. Instalado automaticamente via `kit sync install <target>` para qualquer IDE compatível.

## Prontidão para Próxima Fase

- **Phase 38 completa em 6/6 plans** (sre.md fecha o orquestrador da família). 5 comandos individuais (golden-signals/auditar-toil/postmortem/prr/risk-budget) + 1 orquestrador (`/sre`) entregues.
- **Phase 39** (integração — patches Supabase + framework) pode prosseguir referenciando `/sre <subcomando>` como entrypoint canônico nos exemplos.
- **Phase 41** (README v1.10 + CHANGELOG) já tem o orquestrador disponível para construir exemplos end-to-end (QA-SRE-04 do roadmap).
- Sem bloqueios.

---
*Fase: 38-comandos-orquestrador-sre*
*Concluída: 2026-05-07*
