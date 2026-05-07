---
phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
plan: 06
subsystem: skills-sre
tags: [sre, prr, production-readiness-review, google-sre-cap-32, engagement-model, skill, content-only]

# Grafo de dependências
requires:
  - phase: 36
    provides: glossário SRE (_shared-sre/glossary.md) e skills siblings sre-risk-management/four-golden-signals/eliminating-toil/blameless-postmortems
provides:
  - kit/skills/production-readiness-review/SKILL.md — skill canônica PRR (cap 32) cobrindo SKFD-SRE-05 integralmente
  - 6 axes detalhados in-line (System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance)
  - 3 engagement models documentados (Simple PRR, Early Engagement, Frameworks/SRE Platform)
  - Template PRR-REPORT.md canônico (formato consumido por prr-conductor Phase 37)
  - Sequência handoff dev→SRE em 9 passos
  - Smoke test agregado da Phase 36 — todas 5 SKFD-SRE skills idempotentes em sync 2× (timestamp-stripped); description ≤ 200 chars; _shared-sre não listado em listKit
affects: [Phase 37 prr-conductor agente, Phase 38 /prr comando, Phase 39 supabase-architect cross-ref, Phase 40 INT-FW-V2-02 (gate PRR /concluir-marco), Phase 41 gate prr-checklist-coverage]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - "Skill foundational SRE PT-BR — frontmatter (name + description ≤ 200 chars) + 6 seções canônicas (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Verificação / Ver também)"
    - "Auto-contida — checklist 6 axes documentado in-line; cross-refs apenas em 'Ver também'"
    - "Template inline (PRR-REPORT.md) — formato canônico que agente downstream gera"

key-files:
  created:
    - kit/skills/production-readiness-review/SKILL.md
  modified: []

key-decisions:
  - "Documentação cap 32 do livro Google SRE — 6 axes (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) com 5 itens verificáveis (Evidence:) cada"
  - "3 engagement models como tabela + critério explícito por custo de outage (< $1k/min = Simple, $1k-100k/min = Early, > $100k/min = Platform)"
  - "Sequência handoff dev→SRE em 9 passos canônicos — base do protocolo que prr-conductor (Phase 37) executará"
  - "Template PRR-REPORT.md inline com tabela 6-axes scored (Pass/Pass with gaps/Fail) — formato consumido pelo agente downstream"
  - "8 regras absolutas + 6 anti-patterns canônicos (PRR depois do launch, auto-PRR pelo time dev, pular axes, rubber stamp, engagement model errado, PRR one-shot)"
  - "Re-PRR triggers explícitos: rewrite > 50%, RPS escala > 10×, novo dependency tier-1, time rotation > 50%, anualmente como hygiene"
  - "Smoke agregado Phase 36 valida idempotência usando timestamp stripping (stubs regeneram timestamp por design — ROADMAP crit-4)"

patterns-established:
  - "PRR como GATE invariável (não recomendação) — feature/serviço sem PRR aprovado NÃO entra em produção real"
  - "Evidence-based em cada item do checklist (URL/query/doc) — 'acreditamos que está pronto' ≠ aprovado"
  - "Reviewer ≠ time dev (PRR conduzido por SRE ou par externo)"
  - "Action items P0 = blocker; P1 = scheduled (com owner + due) — nem todo gap é bloqueador, mas todo P0 é"

requirements-completed: [SKFD-SRE-05]

# Métricas
duration: ~25min
completed: 2026-05-07
---

# Plano 36-06: Skill `production-readiness-review/SKILL.md` — Resumo

**Skill canônica PRR (cap 32 Google SRE) com checklist 6 axes detalhado in-line, 3 engagement models, template PRR-REPORT.md, e sequência handoff dev→SRE em 9 passos — base para prr-conductor Phase 37.**

## Performance

- **Duração:** ~25 min (5 tarefas + smoke agregado)
- **Iniciado:** 2026-05-07T05:40:00Z
- **Concluído:** 2026-05-07T06:05:00Z
- **Tarefas:** 6 (T1 frontmatter+Quando usar, T2 Regras absolutas, T3 Patterns canônicos, T4 Anti-patterns, T5 Verificação+Ver também+footer, T6 smoke agregado Phase 36)
- **Arquivos criados:** 1 (`kit/skills/production-readiness-review/SKILL.md` — ~15.3 KB)
- **Smoke agregado:** ALL_PASS (5 skills frontmatter ≤ 200 chars; sync 2× idempotente timestamp-stripped; _shared-sre NOT listed em kit list-skills)

## Realizações

- Skill `kit/skills/production-readiness-review/SKILL.md` criada com frontmatter válido (`name: production-readiness-review` + `description: 172 chars`)
- 6 seções canônicas presentes — Quando usar, Regras absolutas (8 bullets), Patterns canônicos (5 sub-patterns), Anti-patterns (6 sub-anti-patterns), Verificação (8 itens), Ver também (7 cross-refs)
- 6 axes do PRR documentados in-line com 5 itens cada (Evidence: explícito) — total 30 itens verificáveis
- 3 engagement models em tabela com critério por custo de outage
- Template PRR-REPORT.md canônico (formato que prr-conductor Phase 37 vai gerar)
- Sequência handoff dev→SRE em 9 passos canônicos
- Footer cita literalmente "Cap 32: 'The Evolving SRE Engagement Model'" do livro Google SRE
- Smoke agregado da Phase 36 (T6) — verifica todas 5 SKFD-SRE skills idempotentes em sync 2× (timestamp-stripped per design); _shared-sre/glossary.md confirmado NÃO listado em listKit

## Commits das Tarefas

Cada tarefa foi comitada atomicamente (--no-verify por execução paralela):

1. **T1: Frontmatter + Quando usar** — `c7287fb` (feat)
2. **T2: Regras absolutas — 8 princípios PRR cap 32** — `7727af8` (feat)
3. **T3: Patterns canônicos — 6 axes + 3 engagement models + handoff + Platform + PRR-REPORT.md template** — `3b04523` (feat)
4. **T4: Anti-patterns — 6 anti-patterns canônicos PRR** — `b50280f` (feat)
5. **T5: Verificação + Ver também + footer cap 32** — `0358bcf` (feat)
6. **T6: Smoke agregado Phase 36** — sem commit de código (validação read-only via PowerShell + node bin/cli.js)

## Arquivos Criados/Modificados

- `kit/skills/production-readiness-review/SKILL.md` — skill nova (~15.3 KB, ~305 linhas) cobrindo SKFD-SRE-05 integralmente

## Decisões Tomadas

- **CLI path correto** — plano original referencia `bin/kit.js` mas o entry point real é `bin/cli.js`. Smoke test ajustado para usar `node bin/cli.js sync install claude-code --project-root <tmp>` e `node bin/cli.js kit list-skills`.
- **Timestamp stripping na comparação de sync** — stubs gerados pelo kit incluem linha `> Generated by kit-mcp at <ISO>` que regenera por design. Smoke test compara conteúdo após substituir o timestamp por `<TS>` (consistente com ROADMAP crit-4: "byte-idêntico excluindo timestamp regenerado por design").
- **Glossário não esperado em `.claude/skills/`** — kit `_shared-*` directories não fazem parte do output sync de skills triggeráveis (precedente das suítes anteriores). Smoke test detecta corretamente que `_shared-sre` NÃO aparece em `kit list-skills`.

## Desvios do Plano

Nenhum desvio estrutural. O smoke test agregado (T6) precisou ser ajustado por conta de detalhes do CLI:
- Path do binário: `bin/kit.js` no plano → `bin/cli.js` real
- Comando para listagem de skills: `kit list` no plano → `kit kit list-skills` real (subcomando do CLI commander)
- Stubs com timestamp regenerado: comparação ajustada para timestamp-stripped (consistente com ROADMAP crit-4)

Esses ajustes são correções de execução (CLI evoluiu) e não alteram o significado dos critérios de aceite — todos os ALL_PASS verificados.

## Problemas Encontrados

- **Conflito de lock git em commit T2** — outro executor paralelo estava commitando ao mesmo tempo. Resolvido com retry após `Start-Sleep -Seconds 3`.
- **Idempotência aparente falsa** — primeira execução do smoke detectou diff em todos os 5 stubs por causa do timestamp regenerado a cada sync. Confirmado design-by-intent (linha `> Generated by kit-mcp at <ISO>` em cada stub) e ajustado script com timestamp stripping; após ajuste, IDEMPOTENT_OK em todas as 5 skills.

## Configuração Manual Necessária

Nenhuma — skill é content-only (apenas markdown) sem dependências externas.

## Prontidão para Próxima Fase

- **Phase 37 (Agentes core):** `prr-conductor` agora pode cross-referenciar `production-readiness-review` por nome canônico e usar o template PRR-REPORT.md inline como formato de saída.
- **Phase 38 (Comandos):** `/prr` pode dispatchar para `prr-conductor` que consultará a skill aqui criada.
- **Phase 39 (Patches):** `supabase-architect` pode cross-referenciar `production-readiness-review` no fluxo de design (INT-SB-V2-02).
- **Phase 40 (Patches fluxo):** `/concluir-marco` pode adicionar gate PRR opcional (INT-FW-V2-02) usando o checklist 6 axes.
- **Phase 41 (Gates):** `prr-checklist-coverage` pode validar que `PRR-REPORT.md` cobre os 6 axes nominados literalmente nesta skill.

**Smoke agregado da Phase 36 (T6) ALL_PASS — fechamento das 5 skills foundationais SRE + glossário consolidado.**

---
*Fase: 36-skills-foundationais-sre-gloss-rio-5-skfd*
*Plano: 06 — production-readiness-review*
*Concluído: 2026-05-07*
