---
name: risk-budget
description: Exibe error budget atual vs risk continuum (cap 3 SRE) — lê .planning/slos/, posiciona no continuum 99% → 99.999%, aplica sabedoria 99.99% e "as reliable as needs to be".
argument-hint: "[<slo_name>] [--format table|json]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Snapshot read-only de **error budget vs risk continuum** (cap 3 do livro Google SRE) para 1 SLO ou todos. Aplica skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) — risk continuum como decisão explícita, error budget como balanço risk × innovation, sabedoria 99.99% (user em smartphone 99% NÃO distingue 99.99% vs 99.999%), "as reliable as needs to be, no more".

Lê SLOs definidos em [`event-based-slos`](../skills/event-based-slos/SKILL.md) (v1.9) — `.planning/slos/*.md`. Complementa [`burn-rate-status`](./burn-rate-status.md) (v1.9 — burn rate forecast) com **decisão estratégica** sobre target apropriado.

**Cria/Atualiza:** nada — comando read-only.

**Após:** o user vê posição de cada SLO no continuum, % budget gasto, custo relativo (1× → 100×+), e recomendação de tier (free/paid/enterprise) consistente com user-perception.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos os SLOs.

**Flags:**
- `--format <table|json>` — output format (default: `table`)
- `--explain` — incluir bloco "sabedoria 99.99%" + anti-patterns inline (verbose)

**Pré-requisito:** SLOs definidos em `.planning/slos/*.md` (v1.9 — comando `/observabilidade slo` ou `/definir-slo`).

**Risk continuum canônico** (cap 3, aplicado inline pela skill):

| Target | Tolerância 30d | User-perceptible? | Recomendação | Custo relativo |
|---|---|---|---|---|
| 99% | 7.2 h | Sim | Tier free, beta, internal | 1× |
| 99.5% | 3.6 h | Notável | Tier free de produção | 2× |
| 99.9% | 43.2 min | Aceitável para UX | Tier paid default | 5× |
| 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical | 10× |
| 99.99% | 4.3 min | Imperceptível em smartphone | Apenas se justificado (raro) | 50×+ |
| 99.999% | 26 s | NÃO perceptível | NUNCA para user-facing | 100×+ |

**Loop pattern:** rodar via skill `loop` para monitoramento contínuo.

```text
/loop 1h /risk-budget
```

**Exemplos:**
```
/risk-budget                              # todos SLOs, formato table
/risk-budget checkout_success             # 1 SLO específico
/risk-budget --format json                # output estruturado
/risk-budget login_success --explain      # com sabedoria 99.99% + anti-patterns inline
```
</context>
