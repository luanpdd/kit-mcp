---
phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
plan: 02
subsystem: sre
tags: [sre, slo, risk-management, error-budget, google-sre, embracing-risk]

requires:
  - phase: 35
    provides: Suíte Observabilidade v1.9 (event-based-slos, burn-rate-alerting) — referenciada em "Ver também"
provides:
  - kit/skills/sre-risk-management/SKILL.md — skill canônica risk continuum + 99.99% wisdom + error budget
affects: [37-agentes-core-sre, 38-comandos-sre, 39-patches-observabilidade-supabase, 41-gates-readme-changelog]

tech-stack:
  added: []
  patterns:
    - "Skill SRE foundationais (SKFD) — frontmatter name+description, 6 seções canônicas"
    - "Cross-refs apenas em '## Ver também' — skill auto-contida"

key-files:
  created:
    - kit/skills/sre-risk-management/SKILL.md
  modified: []

key-decisions:
  - "Tabela risk continuum 6 targets (99% até 99.999%) com tolerância 30d, user-perceptibility, recomendação e custo relativo — formato canônico replicado em glossary (Plan 01)"
  - "Budget policy 4 estados (green/yellow/red/exhausted) em YAML — formato canônico para downstream agentes (slo-engineer, prr-conductor)"
  - "Checklist 4 perguntas para justificar 99.99%+ — gate explícito contra adoção descuidada de targets altos"
  - "Anti-patterns shape ANTI/PROBLEMA/CERTO em fence text — replicado de event-based-slos (v1.9)"

patterns-established:
  - "SKFD-SRE skill template: frontmatter (name + description ≤ 200 chars), 6 seções (Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns, Verificação, Ver também)"
  - "Code blocks YAML/SQL/text com comentários PT-BR inline — precedente v1.8/v1.9 preservado"
  - "Cross-refs Markdown relativos para skills/glossary — apenas em 'Ver também' no fim"

requirements-completed: [SKFD-SRE-01]

duration: 12min
completed: 2026-05-07
---

# Fase 36 — Plan 02: Skill `sre-risk-management/SKILL.md` — Resumo

**Skill canônica SRE Risk Management documentando cap 3 do livro Google SRE (Embracing Risk): risk continuum 6 targets, sabedoria 99.99%, error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more".**

## Performance

- **Duração:** ~12 min
- **Tarefas:** 5 (T1-T5)
- **Arquivos modificados:** 1 (criado)
- **Tamanho final:** 11.2 KB (221 linhas)

## Realizações

- Skill `kit/skills/sre-risk-management/SKILL.md` auto-contida com frontmatter válido (description 161/200 chars)
- 6 seções canônicas presentes: Quando usar, Regras absolutas (7 princípios), Patterns canônicos (4 sub-patterns), Anti-patterns (5 sub-anti-patterns), Verificação (checklist 7 itens), Ver também (5 cross-refs)
- Tabela risk continuum com 6 targets (99% até 99.999%) — referência canônica para outras skills/agentes
- Cobre cap 3 inteiro: risk continuum, 99.99% wisdom (smartphone vs network), error budget como balanço, "as reliable as needs to be, no more"
- Cross-refs apenas em "Ver também" — skill auto-contida (LLM gera workflow sem ler outra skill)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T1 — Frontmatter + Quando usar** — `2d6012d` (feat)
2. **T2 — Regras absolutas (7 princípios cap 3)** — `5389100` (feat)
3. **T3 — Patterns canônicos (4 sub-patterns)** — `581f903` (feat)
4. **T4 — Anti-patterns (5 sub-anti-patterns)** — `711cd3b` (feat)
5. **T5 — Verificação + Ver também + footer** — `759996a` (feat)

## Arquivos Criados/Modificados

- `kit/skills/sre-risk-management/SKILL.md` — skill canônica (criado, 11.2 KB)

## Decisões Tomadas

Nenhuma — plano seguido como especificado. Conteúdo dos 7 bullets de Regras absolutas, tabela risk continuum, YAML budget_policy, SQL tier-aware e checklist 99.99%+ foram emitidos literalmente do PLAN.md.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

Nenhum.

## Validação dos critérios de sucesso

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Skill em `kit/skills/sre-risk-management/SKILL.md` existe | ✅ Criado, 11.2 KB |
| 2 | Frontmatter `name` + `description ≤ 200 chars` | ✅ name: sre-risk-management; description: 161 chars |
| 3 | 6 seções canônicas (Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns, Verificação, Ver também) | ✅ Todas presentes (`grep '^## '` = 6) |
| 4 | Cobre cap 3: risk continuum, 99.99% wisdom, error budget, "as reliable as needs to be, no more" | ✅ Todos 4 tópicos cobertos |
| 5 | Auto-contida (cross-refs apenas em Ver também) | ✅ Validado — corpo da skill referencia conceitos sem links externos |
| 6 | Cobre SKFD-SRE-01 | ✅ |
| 7 | Tabela risk continuum 6 targets | ✅ 99%, 99.5%, 99.9%, 99.95%, 99.99%, 99.999% |
| 8 | Anti-patterns sobre pursuit of 100%, 99.99% sem justificativa, SLA==SLO | ✅ Os 3 + SLO global + budget como score (5 total) |
| 9 | Tamanho ≤ 12 KB | ✅ 11.2 KB |

## REQs cobertos

- ✅ **SKFD-SRE-01** — Skill `sre-risk-management` documentando cap 3 (risk continuum + 99.99% wisdom + error budget como balanço explícito + "as reliable as needs to be, no more")

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- Skill referenciável por agentes Phase 37 (`prr-conductor` em axis Performance) e patches Phase 39 (INT-OBS-01 — `event-based-slos` ganha bloco "Risk continuum" cross-ref)
- Tabela risk continuum 6 targets é referência canônica replicada em `_shared-sre/glossary.md` (Plan 01 T4)
- Sem bloqueios.

---
*Fase: 36-skills-foundationais-sre-gloss-rio-5-skfd*
*Plan: 02 — sre-risk-management*
*Concluída: 2026-05-07*
