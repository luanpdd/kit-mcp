---
status: passed
phase: 38-comandos-orquestrador-sre
verified: 2026-05-07
verifier: verifier-agent
requirements: [CMD-SRE-01, CMD-SRE-02, CMD-SRE-03, CMD-SRE-04, CMD-SRE-05, CMD-SRE-06]
---

# Phase 38 — Comandos + orquestrador /sre — Verification Report

## Resumo executivo

**Status: PASSED**

Os 6 must-haves da Phase 38 foram verificados contra o código atual e estão cobertos integralmente. Todos os 6 requisitos (CMD-SRE-01..CMD-SRE-06) têm artefato correspondente em `kit/commands/`, com convenções de família (orquestrador v1.10) preservadas. Smoke `kit sync install claude-code` instala os 6 comandos em `.claude/commands/`.

## Verificação por must-have

### MH1 — `kit/commands/golden-signals.md` dispatches to `golden-signals-instrumenter` via Task — REQ CMD-SRE-01

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/golden-signals.md` (143 linhas)
- Frontmatter `name: golden-signals`, `allowed-tools` inclui `Task` (linha 11)
- Dispatch: `Task(subagent_type="golden-signals-instrumenter", ...)` em Step 3 (linhas 96-115)
- Suporta 3 modos de target (file, dir, phase number) em Step 2
- Flags `--service`, `--saturation`, `--runtime` parseadas
- Cross-refs ativos para skill `four-golden-signals` e agent

### MH2 — `kit/commands/auditar-toil.md` dispatches to `toil-auditor` via Task — REQ CMD-SRE-02

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/auditar-toil.md` (130 linhas)
- Frontmatter `name: auditar-toil`, `allowed-tools` inclui `Task` (linha 11)
- Dispatch: `Task(subagent_type="toil-auditor", ...)` em Step 3 (linhas 81-102)
- Output canônico `.planning/TOIL-AUDIT.md` com flags opcionais `--time-window`, `--team-size`, `--output`, `--runbooks-paths`
- Pré-requisitos validados de forma não-bloqueante (git ausente OK)
- Cross-refs ativos para `/auditar-marco`, `/observabilidade omm` (Capacidade 3)

### MH3 — `kit/commands/postmortem.md` supports mutually exclusive flags + dispatches to `postmortem-writer` — REQ CMD-SRE-03

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/postmortem.md` (180 linhas)
- Frontmatter `name: postmortem`, `allowed-tools` inclui `Task` + `AskUserQuestion`
- Modo A `--from-investigation <id>` e Modo B `--incident "<descrição>"` documentados em `<context>` (linhas 27-33) e parseados em Step 1 (linhas 54-56)
- Validação de mutual exclusivity em Step 1 (linhas 60-63): "✗ Erro: --from-investigation e --incident são mutuamente exclusivos"
- Dispatch: `Task(subagent_type="postmortem-writer", ...)` em Step 4 (linhas 126-147)
- Idempotência: não sobrescreve postmortem existente sem `--output` explícito
- 9 seções canônicas obrigatórias citadas no prompt do agent

### MH4 — `kit/commands/prr.md` supports mutually exclusive flags + dispatches to `prr-conductor` — REQ CMD-SRE-04

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/prr.md` (206 linhas)
- Frontmatter `name: prr`, `allowed-tools` inclui `Task` + `AskUserQuestion`
- Modo A `--service <name>` e Modo B `--feature "<desc>"` em `<context>` (linhas 35-41) e parseados em Step 1 (linhas 70-71)
- Validação de mutual exclusivity em Step 1 (linhas 78-90)
- Dispatch: `Task(subagent_type="prr-conductor", ...)` em Step 5 (linhas 146-169)
- 6 axes obrigatórios literalmente no prompt: System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance
- AskUserQuestion enforcement para reviewer ausente (anti-pattern auto-PRR) em Step 4 (linhas 137-141)
- 3 engagement models (simple/early/platform) suportados

### MH5 — `kit/commands/risk-budget.md` is a DIRECT command (no Task), reads `.planning/slos/`, applies skill inline — REQ CMD-SRE-05

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/risk-budget.md` (221 linhas)
- Frontmatter `name: risk-budget`, `allowed-tools` SEM `Task` (apenas Read/Bash/Grep/Glob)
- **Verificação direta:** `Task(` não aparece em risk-budget.md (count = 0 via Grep)
- Lê `.planning/slos/*.md` em Step 2 (linhas 71-83)
- Aplica skill `sre-risk-management` inline — Pattern 1 risk continuum (cap 3) em Step 3 (linhas 99-128)
- 4 status enum canônicos (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED) documentados
- Modo `--explain` anexa sabedoria 99.99% literal + anti-patterns inline (Step 5)
- Cross-refs para `/burn-rate-status` (v1.9), `/postmortem`, `/observabilidade omm`
- Read-only / loop-friendly (idempotente)

### MH6 — `kit/commands/sre.md` is orchestrator with subcommands + delegates correctly — REQ CMD-SRE-06

**Status: OK**

- Arquivo: `D:/projetos/opensource/mcp/kit/commands/sre.md` (227 linhas)
- Frontmatter `name: sre`, `allowed-tools` inclui `Task` + `AskUserQuestion`
- Tabela de subcomandos canônica em `<context>` (linhas 47-55) com 6 linhas (5 subcomandos + help)
- Subcomandos com sinônimos PT/EN:
  - `golden-signals` (signals, 4signals, golden) → `golden-signals-instrumenter`
  - `auditar-toil`/`audit-toil` (toil, auditar) → `toil-auditor`
  - `postmortem` (pm, post-mortem) → `postmortem-writer`
  - `prr` (production-readiness, readiness-review) → `prr-conductor`
  - `risk-budget`/`budget` (risk, continuum) → comando direto `/risk-budget`
  - `help`/`ajuda`/`?` → exibe tabela inline (linha 85)
- Dispatch via `Task(subagent_type=...)` em Step 4a-4d (linhas 126-183)
- Caso especial: `risk-budget` em Step 4e delega para comando direto sem Task (linhas 185-196)
- Validação mutual exclusivity preservada para postmortem (4c, linha 156) e prr (4d, linha 171)
- Tabela de chains comuns em Step 6 (linhas 206-213) cross-família v1.9 + v1.10
- Anti-pitfall A10 enforced ("único ponto de chain", "agents permanecem função pura")

### MH7 — description ≤ 200 chars on all 6 commands

**Status: OK**

| Command                | description length |
|------------------------|--------------------|
| golden-signals.md      | 177 chars          |
| auditar-toil.md        | 146 chars          |
| postmortem.md          | 158 chars          |
| prr.md                 | 156 chars          |
| risk-budget.md         | 175 chars          |
| sre.md                 | 159 chars          |

Todos abaixo do limite de 200 chars. Maior é golden-signals com 177 chars (margem 23 chars).

### MH8 — Smoke `kit sync install claude-code` lists 6 new commands in `.claude/commands/`

**Status: OK**

- Comando executado: `node bin/cli.js sync install claude-code`
- Output: `commands 74 ✓` (sync bem-sucedido)
- Verificação `.claude/commands/`:
  - `golden-signals.md` — presente
  - `auditar-toil.md` — presente
  - `postmortem.md` — presente
  - `prr.md` — presente
  - `risk-budget.md` — presente
  - `sre.md` — presente
- 6/6 comandos sincronizados.

## Cross-reference de requisitos

| REQ ID         | SUMMARY file                              | requirements-completed | Status |
|----------------|-------------------------------------------|------------------------|--------|
| CMD-SRE-01     | 38-01-golden-signals-SUMMARY.md           | [CMD-SRE-01]           | OK     |
| CMD-SRE-02     | 38-02-auditar-toil-SUMMARY.md             | [CMD-SRE-02]           | OK     |
| CMD-SRE-03     | 38-03-postmortem-SUMMARY.md               | [CMD-SRE-03] (lista)   | OK     |
| CMD-SRE-04     | 38-04-prr-SUMMARY.md                      | [CMD-SRE-04]           | OK     |
| CMD-SRE-05     | 38-05-risk-budget-SUMMARY.md              | [CMD-SRE-05] (lista)   | OK     |
| CMD-SRE-06     | 38-06-sre-SUMMARY.md                      | [CMD-SRE-06]           | OK     |

Todos os 6 REQs têm 1 plan dedicado + SUMMARY.md com `requirements-completed` populado e arquivo correspondente em `kit/commands/`.

## Verificação reversa: codebase entrega o que a phase prometeu?

**Goal da phase:** "6 comandos novos em kit/commands/ — golden-signals, auditar-toil, postmortem, prr, risk-budget, sre (orquestrador) — cada um wrappers de agentes Phase 37 ou (caso de risk-budget) direct command. Orquestrador /sre é terceiro da família após /supabase (v1.8) e /observabilidade (v1.9)."

Análise reversa:

1. **6 comandos novos em kit/commands/** — confirmado via Glob, todos os 6 .md existem e têm frontmatter válido.
2. **Wrappers de agents Phase 37** — golden-signals, auditar-toil, postmortem, prr usam `Task(subagent_type=...)` apontando para os 4 agents da Phase 37 (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor).
3. **risk-budget como direct command** — confirmado: zero invocações de `Task(` no arquivo; aplica skill `sre-risk-management` inline; lê `.planning/slos/*.md`.
4. **Orquestrador /sre terceiro da família** — confirmado: sre.md cita `/supabase` (v1.8) e `/observabilidade` (v1.9) literalmente em `<objective>` (linha 16) e segue mesmo padrão estrutural (subcomando + dispatch via Task + validação de flags).
5. **Sinônimos PT/EN** — confirmado para 5 subcomandos + help/ajuda/?.
6. **Anti-pitfall A10 mantido** — orquestrador é único ponto de chain; agents continuam função pura (citado 2× literal no sre.md).

A codebase **entrega integralmente** o que a phase prometeu. Nenhuma lacuna detectada.

## Decisão final

**PASSED — todos os 6 must-haves cobertos, todos os 6 REQs (CMD-SRE-01..06) cumpridos, smoke validation OK.**

Phase 38 está completa e pronta para Phase 39 (integração — patches Supabase + framework) prosseguir com `/sre <subcomando>` como entrypoint canônico.
