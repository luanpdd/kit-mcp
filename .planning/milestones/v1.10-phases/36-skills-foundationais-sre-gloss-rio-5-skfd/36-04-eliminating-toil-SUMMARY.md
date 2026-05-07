---
phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
plan: 04
subsystem: skills-content
tags: [sre, toil, automation, google-sre-cap-5, skill]

requires:
  - phase: pre-phase-context
    provides: precedente _shared-observability/glossary.md + observability-driven-development/SKILL.md (frontmatter pattern, 5-section shape)
provides:
  - kit/skills/eliminating-toil/SKILL.md (skill SKFD-SRE-03 auto-contida)
  - definição canônica de toil (6 critérios)
  - regra ≤ 50% canônica
  - decision tree para classificar trabalho (toil/overhead/grungy work/project work)
  - template TOIL-AUDIT.md (consumido por toil-auditor Phase 37)
  - tabela L0-L4 estágios de automação Google
  - 5 anti-patterns canônicos de toil
affects:
  - phase-37-agentes-sre (toil-auditor consome decision tree + template TOIL-AUDIT.md desta skill)
  - phase-38-comandos-sre (/auditar-toil dispatch para toil-auditor)
  - phase-39-patches-suite (omm-auditor v1.9 cap 3 consome toil score; supabase-migration-writer alerta toil em SQL repetitivo)
  - phase-40-patches-fluxo (/auditar-marco invoca /auditar-toil quando workflow.audit_milestone_toil=true)

tech-stack:
  added: []
  patterns:
    - "skill SKFD pattern com 6 seções: Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns, Verificação, Ver também"
    - "frontmatter mínimo: name + description ≤ 200 chars (anti-pitfall A2)"
    - "auto-contida: cross-refs apenas em Ver também (anti-pitfall A8)"

key-files:
  created:
    - kit/skills/eliminating-toil/SKILL.md
  modified: []

key-decisions:
  - "Description final: 175 chars (margem confortável vs limite 200)"
  - "Decision tree usa diagrama ASCII com chave para visual clareza dos 6 critérios"
  - "Template TOIL-AUDIT.md inteiro embedded — toil-auditor (Phase 37) gera a partir deste shape"
  - "L0-L4 enumera 5 estágios (Manual / Documented / Tooled / Self-service / Autonomous) — meta SRE é mover toil de L0/L1 para L3/L4"
  - "L1 (apenas runbook) explicitamente nomeado como toil disfarçado"
  - "Anti-patterns shape ANTI/PROBLEMA/CERTO mantém precedente de outras skills SKFD"

patterns-established:
  - "Decision tree para classificar trabalho: aplica os 6 critérios; fallback para overhead/grungy work/project work"
  - "TOIL-AUDIT.md template canônico: tabela com colunas Frequência/Hours/Pain/Automation effort/Priority"
  - "Estágios de automação L0-L4 (Google): meta é L3/L4 autonomous"
  - "Pre-merge toil tax (6 perguntas): bloqueia feature nascer com toil"
  - "Identificação via git log + scripts: find/grep/git log/crontab heurísticas"

requirements-completed:
  - SKFD-SRE-03

duration: ~30min
completed: 2026-05-07
---

# Plan 04 — Skill `eliminating-toil/SKILL.md` — Resumo

**Skill canônica `eliminating-toil` documentando cap 5 do livro Google SRE — definição operacionalizável de toil (6 critérios), regra ≤ 50%, distinção toil vs overhead vs grungy work, template TOIL-AUDIT.md, estágios de automação L0-L4 e 5 anti-patterns.**

## Performance

- **Duração:** ~30 min
- **Iniciado:** 2026-05-07
- **Concluído:** 2026-05-07
- **Tarefas:** 5
- **Arquivos modificados:** 1 (SKILL.md criado)

## Realizações

- Skill `kit/skills/eliminating-toil/SKILL.md` (~12 KB, 243 linhas) auto-contida com 6 seções canônicas
- 6 critérios operacionalizáveis de toil enumerados literalmente: Manual, Repetitivo, Automatizável, Tático, Sem valor durável, Escala linear (TODOS os 6 simultâneos = toil)
- Regra ≤ 50% canônica documentada com red flag (> 50% por 1+ trimestre)
- Decision tree visual para classificar trabalho como toil / overhead / grungy work / project work
- Template TOIL-AUDIT.md inteiro embedded (formato que `toil-auditor` Phase 37 vai produzir)
- Tabela L0-L4 (Manual / Documented / Tooled / Self-service / Autonomous) enumerando estágios de automação Google
- 5 anti-patterns canônicos: confundir overhead com toil, hero culture, runbook em vez de automação, automação parcial, ignorar toil de baixa frequência
- Toil tax pré-merge: 6 perguntas que bloqueiam feature nascer com toil
- Comandos shell para identificar toil via git log + find + grep + crontab

## Commits das Tarefas

Cada tarefa foi comitada atomicamente (com `--no-verify` por estar em executor paralelo):

1. **T1: Frontmatter + Quando usar** — `3c38885` (feat)
2. **T2: Regras absolutas — 6 critérios canônicos + ≤ 50% rule** — `b51f9f3` (feat)
3. **T3: Patterns canônicos — decision tree + TOIL-AUDIT + L0-L4** — `8c610e4` (feat)
4. **T4: Anti-patterns — 5 toil pitfalls canônicos** — `dd18fa8` (feat)
5. **T5: Verificação + Ver também + footer** — `c8d4fb4` (feat)

## Arquivos Criados/Modificados

- `kit/skills/eliminating-toil/SKILL.md` (criado) — skill SKFD-SRE-03, ~12 KB, 243 linhas, frontmatter `name` + `description` (175 chars), 6 seções canônicas, auto-contida

## Decisões Tomadas

- **Description final 175 chars** — margem confortável vs limite 200 chars (anti-pitfall A2 cumprido)
- **Cross-refs apenas em "Ver também"** — skill auto-contida, sem dependência de leitura cruzada (anti-pitfall A8 cumprido)
- **Template TOIL-AUDIT.md inteiro embedded** — fornece shape canônico que `toil-auditor` Phase 37 vai produzir, evitando contrato implícito
- **L1 (apenas runbook) explicitamente nomeado como toil disfarçado** — destaque contra anti-pattern frequente "documentar em vez de automatizar"
- **5 anti-patterns no shape ANTI/PROBLEMA/CERTO** — alinhado com precedente de skills v1.9 (observability-driven-development, event-based-slos)

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Todas as 5 tarefas aceitas conforme `acceptance_criteria` definidos em PLAN.md.

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- Skill `eliminating-toil` consumível por:
  - **Phase 37** — agente `toil-auditor` referencia esta skill para classificação + gera `TOIL-AUDIT.md` no formato definido aqui
  - **Phase 38** — comando `/auditar-toil` dispatch para `toil-auditor`
  - **Phase 39** — `omm-auditor` v1.9 consome toil score para Capacidade 3 (Complexidade/Tech Debt); `supabase-migration-writer` v1.8 alerta sobre toil em SQL repetitivo cross-ref para esta skill
  - **Phase 40** — comando `/auditar-marco` invoca `/auditar-toil` quando `workflow.audit_milestone_toil=true`
- REQ SKFD-SRE-03 coberto integralmente
- Sem bloqueios

---

*Fase: 36-skills-foundationais-sre-gloss-rio-5-skfd*
*Plano: 04*
*Concluído: 2026-05-07*
