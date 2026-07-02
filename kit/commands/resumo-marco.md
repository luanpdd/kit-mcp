---
type: prompt
name: resumo-marco
description: Gera um resumo abrangente do projeto a partir dos artefatos do milestone para onboarding e revisão da equipe
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
Gerar um resumo estruturado do milestone para onboarding da equipe e revisão do projeto. Lê artefatos do milestone concluído (arquivos ROADMAP, REQUIREMENTS, CONTEXT, SUMMARY, VERIFICATION) e produz uma visão geral amigável do que foi construído, como e por quê.

Propósito: Permitir que novos membros da equipe entendam um projeto concluído lendo um documento e fazendo perguntas de acompanhamento.
Saída: MILESTONE_SUMMARY escrito em `.planning/reports/`, apresentado inline, Q&A interativo opcional.
</objective>

<execution_context>
@./.claude/framework/workflows/milestone-summary.md
</execution_context>

<context>
**Arquivos do projeto:**
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/RETROSPECTIVE.md`
- `.planning/milestones/v{version}-ROADMAP.md` (se arquivado)
- `.planning/milestones/v{version}-REQUIREMENTS.md` (se arquivado)
- `.planning/phases/*-*/` (SUMMARY.md, VERIFICATION.md, CONTEXT.md, RESEARCH.md)

**Entrada do usuário:**
- Versão: $ARGUMENTS (opcional — padrão para milestone atual/mais recente)
</context>

<process>
Ler e executar o workflow milestone-summary de @./.claude/framework/workflows/milestone-summary.md do início ao fim.
</process>

<success_criteria>
- Versão do milestone resolvida (de argumentos, STATE.md ou scan de arquivo)
- Todos os artefatos disponíveis lidos (ROADMAP, REQUIREMENTS, CONTEXT, SUMMARY, VERIFICATION, RESEARCH, RETROSPECTIVE)
- Documento de resumo escrito em `.planning/reports/MILESTONE_SUMMARY-v{version}.md`
- Todas as 7 seções geradas (Visão Geral, Arquitetura, Fases, Decisões, Requisitos, Dívida Técnica, Começando)
- Resumo apresentado inline ao usuário
- Q&A interativo oferecido
- STATE.md atualizado
</success_criteria>