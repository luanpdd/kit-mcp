---
name: prr
description: Invoca prr-conductor — Production Readiness Review scored em 6 axes (cap 32); modos --service <name> ou --feature <desc>; offline fallback se MCP ausente.
argument-hint: "(--service <name> | --feature \"<desc>\") [--engagement simple|early|platform] [--reviewer @sre]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Conduzir **Production Readiness Review** (PRR — cap 32 do livro Google SRE) para serviço/feature antes de production. Invoca o agente [`prr-conductor`](../agents/prr-conductor.md) que aplica a skill [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — checklist canônico **6 axes** + **3 engagement models** + handoff dev→SRE.

**6 axes obrigatórios** (pular um = aprovação inválida):
1. System Architecture — design, dependencies, blast radius, isolation
2. Instrumentation/Metrics/Monitoring — 4 golden signals, SLOs, alerting
3. Emergency Response — runbooks, on-call, rollback, communication
4. Capacity Planning — load testing, scaling, headroom
5. Change Management — canary, feature flags, rollback < 60s
6. Performance — latency budgets, throughput, optimization

**Cria/Atualiza:**
- `.planning/prr/<service>.md` (Modo A) OR `.planning/prr/feature-<slug>.md` (Modo B) — PRR-REPORT.md scored

**Após:** o user tem decisão `Approved` / `Approved with conditions` / `Blocked` + lista canônica de P0 items por axe + reviewer signature. Phase 40 INT-FW-V2-02 integra `/concluir-marco` com gate PRR opcional.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — comando suporta **2 modos mutuamente exclusivos**.

**Modo A: `--service <name>` (audit de serviço existente)**

Para serviços já em production OU prestes a entrar — agent lê schema (Supabase MCP), Edge Functions code, SLOs definidos (`.planning/slos/`), advisors. Output: `.planning/prr/<service>.md`.

**Modo B: `--feature <description>` (audit pré-launch)**

Para feature em design/dev — agent lê design docs, SLOs propostos, código WIP. Output: `.planning/prr/feature-<slug>.md`.

**Engagement models (cap 32):**
- `simple` — outage cost < $1k/min OR internal tool — 4-8h, 1 sessão
- `early` — outage cost $1k-100k/min OR customer-facing — semanas, SRE no design
- `platform` — outage cost > $100k/min OR built on Frameworks/SRE Platform — PRR é confirmação

**Flags:**
- `--engagement <simple|early|platform>` — engagement model (default: AskUserQuestion baseado em outage cost)
- `--reviewer <@handle>` — handle do reviewer SRE (default: AskUserQuestion — **NUNCA pode ser team dev**, anti-pattern auto-PRR)
- `--outage-cost <usd>` — custo de outage por minuto (default: AskUserQuestion para escolher engagement)
- `--output <path>` — caminho do output (override de default canônico)

**Exemplos:**
```
/prr --service orders-api                                          # Modo A — defaults
/prr --service orders-api --engagement early --reviewer @ops-lead  # Modo A com config
/prr --feature "RAG sobre documentos privados" --reviewer @sre     # Modo B
/prr --service edge-process-emails --engagement simple             # Edge Function simples
```

**Pré-requisito (Full mode):** projeto Supabase configurado, `mcp__supabase__*` disponível. Modo offline funciona com fallback graceful (filesystem only — itens MCP-dependentes ficam `EVIDENCE_PENDING_MCP`).
</context>
