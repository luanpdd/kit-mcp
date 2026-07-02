---
name: perfil-usuario
description: Gera perfil comportamental do desenvolvedor e cria artefatos descobríveis pelo Claude
argument-hint: "[--questionnaire] [--refresh]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
Gerar um perfil comportamental do desenvolvedor a partir de análise de sessão (ou questionário) e produzir artefatos (USER-PROFILE.md, /preferencias-dev, seção CLAUDE.md) que personalizam as respostas do Claude.

Encaminha para o workflow profile-user que orquestra o fluxo completo: gate de consentimento, análise de sessão ou fallback de questionário, geração de perfil, exibição de resultados e seleção de artefatos.
</objective>

<execution_context>
@./.claude/framework/workflows/profile-user.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Flags de $ARGUMENTS:
- `--questionnaire` -- Pular análise de sessão completamente, usar apenas questionário
- `--refresh` -- Reconstruir perfil mesmo quando existe, fazer backup do perfil antigo, mostrar diff de dimensão
</context>

<process>
Execute o workflow profile-user do início ao fim.

O workflow cuida de toda a lógica, incluindo:
1. Inicialização e detecção de perfil existente
2. Gate de consentimento antes da análise de sessão
3. Escaneamento de sessão e verificações de suficiência de dados
4. Análise de sessão (agente profiler) ou fallback de questionário
5. Resolução de divisão entre projetos
6. Escrita do perfil em USER-PROFILE.md
7. Exibição de resultado com card de relatório e destaques
8. Seleção de artefato (preferencias-dev, seções CLAUDE.md)
9. Geração sequencial de artefatos
10. Resumo com diff de atualização (se aplicável)
</process>