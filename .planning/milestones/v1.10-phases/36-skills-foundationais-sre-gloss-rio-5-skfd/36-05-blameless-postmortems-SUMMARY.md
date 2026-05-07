---
phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
plan: 05
subsystem: skills
tags: [sre, postmortem, blameless, google-sre-cap15, content-only, markdown]

# Grafo de dependências
requires:
  - phase: 35-gates-omm-no-fluxo-framework-qa-cross-ide-docs
    provides: precedente de skill canônica (event-based-slos), pattern de cross-ref para core-analysis-loop, shape de frontmatter ≤ 200 chars
provides:
  - kit/skills/blameless-postmortems/SKILL.md — skill auto-contida com template canônico (9 seções), cultura blameless, no postmortem left unreviewed, Wheel of Misfortune
  - Template canônico de postmortem inline (Summary/Impact/Root Causes/Trigger/Resolution/Detection/Action Items/Lessons Learned/Timeline UTC)
  - Pattern de chain `/forense` → `/postmortem` (base para Phase 37 postmortem-writer e Phase 38 /postmortem)
  - Wheel of Misfortune training canônico (frequência trimestral, 60-90 min, 4-8 participantes)
affects: [37-agentes-core-postmortem-writer, 38-comandos-postmortem, 40-int-fw-v2-01-forense-chain, 41-gate-postmortem-template-required]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns: [skill-auto-contida-com-cross-refs-em-ver-tambem, frontmatter-name-description-200-chars, anti-patterns-shape-ANTI-PROBLEMA-CERTO]

key-files:
  created:
    - kit/skills/blameless-postmortems/SKILL.md
  modified: []

key-decisions:
  - "Template canônico inline (não apenas referência ao glossário) — anti-pitfall A8 preservado, skill é auto-contida"
  - "5 sub-patterns ao invés de monolítico — template, 5 whys, revisão por par, Wheel of Misfortune, postmortem chain"
  - "6 anti-patterns canônicos cobrindo as falhas mais comuns documentadas no cap 15 do livro Google SRE"
  - "Pattern de postmortem chain ligado explicitamente a v1.9 (incident-investigator) e Phase 37/38 — viabiliza integração futura"

patterns-established:
  - "Skill foundacional SRE: 6 seções (Quando usar / Regras absolutas / Patterns / Anti-patterns / Verificação / Ver também) + footer com material-fonte"
  - "Template canônico inline em fenced code com fence quádruplo para escapar Markdown interno"
  - "5 whys exemplificado com sintoma → root cause sistêmico (não pessoal) → action item SMART"
  - "Anti-pattern shape ANTI: <comportamento> / PROBLEMA: <consequência sistêmica> / CERTO: <ação substituta>"

requirements-completed: [SKFD-SRE-04]

# Métricas
duration: ~25min
completed: 2026-05-07
---

# Plan 36-05: Skill `blameless-postmortems` — Summary

**Skill canônica em kit/skills/blameless-postmortems/SKILL.md cobrindo capítulo 15 do livro Google SRE — template canônico de 9 seções (Summary/Impact/Root Causes/Trigger/Resolution/Detection/Action Items/Lessons Learned/Timeline UTC), cultura blameless explícita, no postmortem left unreviewed, Wheel of Misfortune como training trimestral.**

## Performance

- **Duração:** ~25 min
- **Iniciado:** 2026-05-07
- **Concluído:** 2026-05-07
- **Tarefas:** 5 (T1–T5)
- **Arquivos modificados:** 1 (criado)

## Realizações

- Skill `kit/skills/blameless-postmortems/SKILL.md` criada (14.8 KB, dentro do target ≤ 16 KB)
- Frontmatter válido: `name: blameless-postmortems` + `description: 168 chars` (≤ 200, anti-pitfall A2)
- 6 seções canônicas presentes: Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Verificação / Ver também
- 9 headers literais do template canônico de postmortem presentes inline (## Summary, ## Impact, ## Root Causes, ## Trigger, ## Resolution, ## Detection, ## Action Items, ## Lessons Learned, ## Timeline (UTC))
- 5 sub-patterns: template, 5 whys, revisão por par sênior (8 perguntas), Wheel of Misfortune, postmortem chain
- 6 sub-anti-patterns no shape ANTI/PROBLEMA/CERTO: blame culture, action items vagos, postmortem left unreviewed, postmortem só para SEV1, timeline ambígua, copy-paste sem investigation
- Cross-refs canônicos para `_shared-sre/glossary.md`, `core-analysis-loop` (v1.9), `sre-risk-management`, `production-readiness-review`, `eliminating-toil` (apenas em "Ver também" — auto-contida)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **T1: Frontmatter + Quando usar** — `d8a586f` (feat)
2. **T2: Regras absolutas — 8 princípios canônicos** — `a7c1e55` (feat)
3. **T3: Patterns canônicos — 5 sub-patterns** — `ea00c2f` (feat)
4. **T4: Anti-patterns — 6 sub-anti-patterns** — `6c0d844` (feat)
5. **T5: Verificação + Ver também + footer** — `71edff5` (feat)

## Arquivos Criados/Modificados

- `kit/skills/blameless-postmortems/SKILL.md` — Skill auto-contida documentando capítulo 15 do livro Google SRE; cobertura SKFD-SRE-04 integral.

## Decisões Tomadas

- **Template canônico inline** — não apenas referência ao glossário (que ainda não existia ao começar; criado em paralelo no Plan 01); decisão preserva auto-contenção (anti-pitfall A8) e permite que LLM gere postmortem completo sem ler outras skills.
- **Pattern de postmortem chain documentado explicitamente** — fluxo de 7 passos `/forense` → `/postmortem` ligando v1.9 (incident-investigator) com Phase 37 (postmortem-writer) e Phase 38 (/postmortem). Cria base concreta para integração futura.
- **Wheel of Misfortune com anti-objetivo explícito** — "NÃO é humilhar quem tomou decisão errada" — reforça cultura blameless mesmo em training (sem essa cláusula, training pode virar blame em retrospecto).
- **Antiidentificação como pessoa em todo o documento** — Regras absolutas, anti-patterns e verificação reforçam o mesmo princípio de 3 ângulos diferentes (cap 15 enfatiza repetição como ferramenta cultural).

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Acceptance criteria de cada task atingido:

- T1: diretório criado, frontmatter válido (168 chars), 8 trigger phrases incluindo "postmortem", "blameless", "Wheel of Misfortune", "no postmortem left unreviewed"
- T2: 8 bullets com palavras-âncora literais (`Foco em sistema/processo, NÃO em pessoas`, `SEV1/SEV2`, `No postmortem left unreviewed`, `SMART`, `UTC`, `Quantificar impact`, `Lições generalizáveis`, `Wheel of Misfortune`)
- T3: 5 sub-patterns, 9 headers do template canônico literais, 5 perguntas Why sequenciais, checklist de 8 perguntas, Wheel trimestral 60-90 min 4-8 pessoas, fluxo de 7 passos
- T4: 6 sub-anti-patterns com shape ANTI/PROBLEMA/CERTO literais
- T5: checklist de 9 itens, 5 cross-refs Markdown, footer com `Cap 15: "Postmortem Culture"`, arquivo total = 14.8 KB (≤ 16 KB)

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Phase 37 (`postmortem-writer` agent)** pode consumir esta skill — template canônico inline está disponível para o agente preencher seção a seção
- **Phase 38 (`/postmortem` command)** pode despachar para o agente sabendo que a skill cobre todo o vocabulário, template e checklist de revisão
- **Phase 40 (INT-FW-V2-01 — `/forense` → `/postmortem` chain)** pode citar o "Pattern: postmortem chain" para ligação direta entre Core Analysis Loop e postmortem
- **Phase 41 (gate `postmortem-template-required`)** pode validar que postmortems gerados em `.planning/postmortems/` cobrem os 9 headers literais documentados aqui
- **Cross-refs em "Ver também"** apontam para skills que ainda não existem (`sre-risk-management`, `production-readiness-review`, `eliminating-toil`, `_shared-sre/glossary.md`) — sendo criadas em paralelo nos Plans 01-04, 06 desta mesma Phase 36; links Markdown ativam quando aterrissarem

---
*Fase: 36-skills-foundationais-sre-gloss-rio-5-skfd*
*Plano: 05 — blameless-postmortems*
*Concluída: 2026-05-07*
