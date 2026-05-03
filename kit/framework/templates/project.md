# Template PROJECT.md

Template para `.planning/PROJECT.md` — o documento de contexto do projeto em evolução.

<template>

```markdown
# [Nome do Projeto]

## O Que É

[Descrição precisa e atual — 2-3 frases. O que este produto faz e para quem é?
Use a linguagem e o enquadramento do usuário. Atualizar quando a realidade divergir desta descrição.]

## Valor Central

[A UMA coisa que mais importa. Se tudo mais falhar, isso deve funcionar.
Uma frase que orienta a priorização quando surgem trade-offs.]

## Requisitos

### Validados

<!-- Lançados e confirmados como valiosos. -->

(Nenhum ainda — lançar para validar)

### Ativos

<!-- Escopo atual. Construindo em direção a estes. -->

- [ ] [Requisito 1]
- [ ] [Requisito 2]
- [ ] [Requisito 3]

### Fora do Escopo

<!-- Limites explícitos. Inclui raciocínio para evitar re-adição. -->

- [Exclusão 1] — [por quê]
- [Exclusão 2] — [por quê]

## Contexto

[Informações de fundo que informam a implementação:
- Ambiente técnico ou ecossistema
- Trabalho anterior relevante ou experiência
- Temas de pesquisa com usuários ou feedback
- Problemas conhecidos a serem endereçados]

## Restrições

- **[Tipo]**: [O quê] — [Por quê]
- **[Tipo]**: [O quê] — [Por quê]

Tipos comuns: Stack de tecnologia, Prazo, Orçamento, Dependências, Compatibilidade, Performance, Segurança

## Decisões Chave

<!-- Decisões que restringem trabalho futuro. Adicionar ao longo do ciclo de vida do projeto. -->

| Decisão | Justificativa | Resultado |
|---------|---------------|-----------|
| [Escolha] | [Por quê] | [✓ Boa / ⚠️ Revisar / — Pendente] |

---
*Última atualização: [data] após [gatilho]*
```

</template>

<guidelines>

**O Que É:**
- Descrição precisa e atual do produto
- 2-3 frases capturando o que faz e para quem é
- Use as palavras e o enquadramento do usuário
- Atualizar quando o produto evoluir além desta descrição

**Valor Central:**
- A coisa mais importante
- Tudo mais pode falhar; isso não pode
- Orienta a priorização quando surgem trade-offs
- Raramente muda; se mudar, é uma virada significativa

**Requisitos — Validados:**
- Requisitos que foram lançados e se mostraram valiosos
- Formato: `- ✓ [Requisito] — [versão/fase]`
- Estes estão travados — alterá-los requer discussão explícita

**Requisitos — Ativos:**
- Escopo atual sendo construído
- São hipóteses até serem lançados e validados
- Mover para Validados quando lançados, Fora do Escopo se invalidados

**Requisitos — Fora do Escopo:**
- Limites explícitos sobre o que não estamos construindo
- Sempre incluir raciocínio (evita re-adição depois)
- Inclui: considerados e rejeitados, diferidos para o futuro, explicitamente excluídos

**Contexto:**
- Fundo que informa decisões de implementação
- Ambiente técnico, trabalho anterior, feedback de usuário
- Problemas conhecidos ou dívida técnica a ser endereçada
- Atualizar conforme novo contexto emerge

**Restrições:**
- Limites rígidos nas escolhas de implementação
- Stack tecnológico, prazo, orçamento, compatibilidade, dependências
- Incluir o "por quê" — restrições sem justificativa são questionadas

**Decisões Chave:**
- Escolhas significativas que afetam trabalho futuro
- Adicionar decisões conforme são tomadas ao longo do projeto
- Rastrear resultado quando conhecido:
  - ✓ Boa — decisão se mostrou correta
  - ⚠️ Revisar — decisão pode precisar de reconsideração
  - — Pendente — cedo demais para avaliar

**Última Atualização:**
- Sempre anotar quando e por que o documento foi atualizado
- Formato: `após Fase 2` ou `após milestone v1.0`
- Aciona revisão de se o conteúdo ainda está preciso

</guidelines>

<evolution>

PROJECT.md evolui ao longo do ciclo de vida do projeto.
Estas regras estão incorporadas no PROJECT.md gerado (seção ## Evolução)
e implementadas por workflows/transition.md e workflows/complete-milestone.md.

**Após cada transição de fase:**
1. Requisitos invalidados? → Mover para Fora do Escopo com motivo
2. Requisitos validados? → Mover para Validados com referência de fase
3. Novos requisitos emergiram? → Adicionar em Ativos
4. Decisões a registrar? → Adicionar em Decisões Chave
5. "O Que É" ainda está preciso? → Atualizar se divergiu

**Após cada milestone:**
1. Revisão completa de todas as seções
2. Verificação do Valor Central — ainda é a prioridade certa?
3. Auditoria de Fora do Escopo — os motivos ainda são válidos?
4. Atualizar Contexto com estado atual (usuários, feedback, métricas)

</evolution>

<brownfield>

Para codebases existentes:

1. **Mapear o codebase primeiro** via `/map-codebase`

2. **Inferir requisitos Validados** do código existente:
   - O que o codebase realmente faz?
   - Quais padrões estão estabelecidos?
   - O que está claramente funcionando e sendo utilizado?

3. **Coletar requisitos Ativos** do usuário:
   - Apresentar o estado atual inferido
   - Perguntar o que querem construir a seguir

4. **Inicializar:**
   - Validados = inferidos do código existente
   - Ativos = objetivos do usuário para este trabalho
   - Fora do Escopo = limites especificados pelo usuário
   - Contexto = inclui o estado atual do codebase

</brownfield>

<state_reference>

STATE.md referencia PROJECT.md:

```markdown
## Referência do Projeto

Ver: .planning/PROJECT.md (atualizado em [data])

**Valor central:** [Uma linha da seção Valor Central]
**Foco atual:** [Nome da fase atual]
```

Isso garante que Claude leia o contexto atual do PROJECT.md.

</state_reference>
