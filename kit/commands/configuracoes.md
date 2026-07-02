---
name: configuracoes
description: Configura os toggles de workflow framework e perfil de modelo
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Configuração interativa de agentes de workflow framework e perfil de modelo via prompt de múltiplas perguntas.

Roteia para o workflow settings que trata:
- Garantia de existência de configuração
- Leitura e análise das configurações atuais
- Prompt interativo com 5 perguntas (modelo, research, plan_check, verifier, branching)
- Mesclagem e escrita de configuração
- Exibição de confirmação com referências de comandos rápidos
</objective>

<execution_context>
@./.claude/framework/workflows/settings.md
</execution_context>

<process>
**Seguir o workflow settings** de `@./.claude/framework/workflows/settings.md`.

O workflow trata toda a lógica incluindo:
1. Criação de arquivo de config com padrões se ausente
2. Leitura da config atual
3. Apresentação interativa de configurações com pré-seleção
4. Análise de respostas e mesclagem de config
5. Escrita de arquivo
6. Exibição de confirmação
</process>
