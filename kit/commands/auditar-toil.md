---
name: auditar-toil
description: Invoca toil-auditor — analisa repo + git log + scripts + runbooks; gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2 com esforço de automação.
argument-hint: "[--time-window 3m] [--team-size N] [--output PATH]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Auditar o repositório atual em busca de **toil** (cap 5 do livro Google SRE) — trabalho manual, repetitivo, automatizável, tático, sem valor durável que escala linear com tráfego/usuários. Invoca o agente [`toil-auditor`](../agents/toil-auditor.md) que aplica a skill [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — 6 critérios canônicos, regra ≤ 50%, distinção toil vs overhead vs grungy work.

**Cria/Atualiza:**
- `.planning/TOIL-AUDIT.md` — lista priorizada P0/P1/P2 com 6 critérios scored + esforço de automação estimado

**Após:** o user tem audit acionável para reduzir toil pelo time. Phase 39 INT-OBS-02 integra ao `omm-auditor` (v1.9) — Capacidade 3 do OMM scoring usa este audit.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — todas as flags são opcionais; comando funciona com defaults.

**Flags:**
- `--time-window <Nm|Nd>` — janela de git history a analisar (default: `3m` = 3 meses)
- `--team-size <N>` — número de pessoas no time (default: inferido via `git shortlog -sn`)
- `--output <path>` — caminho do output (default: `.planning/TOIL-AUDIT.md`)
- `--runbooks-paths <p1,p2,...>` — paths customizados de runbooks (default: `runbooks/, docs/runbooks/, ops/, scripts/, .github/workflows/`)

**Exemplos:**
```
/auditar-toil                                            # defaults — 3m de git, team auto-detect
/auditar-toil --time-window 6m --team-size 5             # janela maior + team explícito
/auditar-toil --output .planning/audit/toil-2026-Q2.md   # path customizado
```

**Pré-requisito:** repositório git inicializado (sem isso, agent skip git log analysis e usa apenas scripts/runbooks).
</context>
