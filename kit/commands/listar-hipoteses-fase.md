---
name: listar-hipoteses-fase
description: Mostra as hipóteses do Claude sobre a abordagem de uma fase antes do planejamento
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Analisar uma fase e apresentar as hipóteses do Claude sobre abordagem técnica, ordem de implementação, limites de escopo, áreas de risco e dependências.

Propósito: Ajudar usuários a ver o que o Claude pensa ANTES do planejamento começar — permitindo correção de curso cedo quando as hipóteses estão erradas.
Saída: Apenas saída conversacional (sem criação de arquivo) — termina com o prompt "O que você acha?"
</objective>

<execution_context>
@./.claude/framework/workflows/list-phase-assumptions.md
</execution_context>

<context>
Número da fase: $ARGUMENTS (obrigatório)

Estado do projeto e roadmap são carregados no workflow usando leituras específicas.
</context>

<process>
1. Validar argumento de número de fase (erro se ausente ou inválido)
2. Verificar se a fase existe no roadmap
3. Seguir o workflow list-phase-assumptions.md:
   - Analisar descrição do roadmap
   - Apresentar hipóteses sobre: abordagem técnica, ordem de implementação, escopo, riscos, dependências
   - Apresentar hipóteses claramente
   - Perguntar "O que você acha?"
4. Coletar feedback e oferecer próximos passos
</process>

<success_criteria>

- Fase validada contra o roadmap
- Hipóteses apresentadas em cinco áreas
- Usuário solicitado a dar feedback
- Usuário conhece próximos passos (discutir contexto, planejar fase ou corrigir hipóteses)
  </success_criteria>