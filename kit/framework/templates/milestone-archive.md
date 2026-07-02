# Template de Arquivo de Milestone

Este template é usado pelo workflow complete-milestone para criar arquivos em `.planning/milestones/`.

---

## Template do Arquivo

# Milestone v{{VERSION}}: {{MILESTONE_NAME}}

**Status:** ✅ ENTREGUE {{DATE}}
**Fases:** {{PHASE_START}}-{{PHASE_END}}
**Total de Planos:** {{TOTAL_PLANS}}

## Visão Geral

{{MILESTONE_DESCRIPTION}}

## Fases

{{PHASES_SECTION}}

[Para cada fase neste milestone, inclua:]

### Fase {{PHASE_NUM}}: {{PHASE_NAME}}

**Objetivo**: {{PHASE_GOAL}}
**Depende de**: {{DEPENDS_ON}}
**Planos**: {{PLAN_COUNT}} planos

Planos:

- [x] {{PHASE}}-01: {{PLAN_DESCRIPTION}}
- [x] {{PHASE}}-02: {{PLAN_DESCRIPTION}}
      [... todos os planos ...]

**Detalhes:**
{{PHASE_DETAILS_FROM_ROADMAP}}

**Para fases decimais, inclua o marcador (INSERIDA):**

### Fase 2.1: Patch de Segurança Crítico (INSERIDA)

**Objetivo**: Corrigir vulnerabilidade de bypass de autenticação
**Depende de**: Fase 2
**Planos**: 1 plano

Planos:

- [x] 02.1-01: Corrigir vulnerabilidade de auth

**Detalhes:**
{{PHASE_DETAILS_FROM_ROADMAP}}

---

## Resumo do Milestone

**Fases Decimais:**

- Fase 2.1: Patch de Segurança Crítico (inserida após Fase 2 para correção urgente)
- Fase 5.1: Hotfix de Performance (inserida após Fase 5 para problema em produção)

**Decisões Chave:**
{{DECISIONS_FROM_PROJECT_STATE}}
[Exemplo:]

- Decisão: Usar divisão do ROADMAP.md (Justificativa: Custo constante de contexto)
- Decisão: Numeração de fases decimais (Justificativa: Semântica clara de inserção)

**Problemas Resolvidos:**
{{ISSUES_RESOLVED_DURING_MILESTONE}}
[Exemplo:]

- Corrigido overflow de contexto com mais de 100 fases
- Resolvida confusão de inserção de fase

**Problemas Diferidos:**
{{ISSUES_DEFERRED_TO_LATER}}
[Exemplo:]

- Hierarquização do PROJECT-STATE.md (diferido até decisões > 300)

**Dívida Técnica Incorrida:**
{{SHORTCUTS_NEEDING_FUTURE_WORK}}
[Exemplo:]

- Alguns workflows ainda têm caminhos hardcoded (corrigir na Fase 5)

---

_Para o status atual do projeto, veja .planning/ROADMAP.md_

---

## Diretrizes de Uso

<guidelines>
**Quando criar arquivos de milestone:**
- Após completar todas as fases em um milestone (v1.0, v1.1, v2.0, etc.)
- Acionado pelo workflow complete-milestone
- Antes de planejar o trabalho do próximo milestone

**Como preencher o template:**

- Substitua {{PLACEHOLDERS}} pelos valores reais
- Extraia detalhes das fases do ROADMAP.md
- Documente fases decimais com o marcador (INSERIDA)
- Inclua decisões chave do PROJECT-STATE.md ou arquivos SUMMARY
- Liste problemas resolvidos vs. diferidos
- Capture dívida técnica para referência futura

**Local do arquivo:**

- Salve em `.planning/milestones/v{VERSION}-{NAME}.md`
- Exemplo: `.planning/milestones/v1.0-mvp.md`

**Após arquivar:**

- Atualize ROADMAP.md para colapsar o milestone completo em uma tag `<details>`
- Atualize PROJECT.md para o formato brownfield com seção de Estado Atual
- Continue a numeração de fases no próximo milestone (nunca reiniciar em 01)
  </guidelines>
