# Template de Pesquisa de Funcionalidades

Template para `.planning/research/FEATURES.md` — panorama de funcionalidades para o domínio do projeto.

<template>

```markdown
# Pesquisa de Funcionalidades

**Domínio:** [tipo de domínio]
**Pesquisado:** [data]
**Confiança:** [HIGH/MEDIUM/LOW]

## Panorama de Funcionalidades

### Requisitos Básicos (Usuários Esperam Estes)

Funcionalidades que os usuários presumem existir. Faltar estas = produto parece incompleto.

| Funcionalidade | Por Que É Esperada | Complexidade | Notas |
|----------------|--------------------|--------------|-------|
| [funcionalidade] | [expectativa do usuário] | LOW/MEDIUM/HIGH | [notas de implementação] |
| [funcionalidade] | [expectativa do usuário] | LOW/MEDIUM/HIGH | [notas de implementação] |
| [funcionalidade] | [expectativa do usuário] | LOW/MEDIUM/HIGH | [notas de implementação] |

### Diferenciais (Vantagem Competitiva)

Funcionalidades que destacam o produto. Não obrigatórias, mas valiosas.

| Funcionalidade | Proposta de Valor | Complexidade | Notas |
|----------------|-------------------|--------------|-------|
| [funcionalidade] | [por que importa] | LOW/MEDIUM/HIGH | [notas de implementação] |
| [funcionalidade] | [por que importa] | LOW/MEDIUM/HIGH | [notas de implementação] |
| [funcionalidade] | [por que importa] | LOW/MEDIUM/HIGH | [notas de implementação] |

### Anti-Funcionalidades (Comumente Pedidas, Frequentemente Problemáticas)

Funcionalidades que parecem boas mas criam problemas.

| Funcionalidade | Por Que É Pedida | Por Que É Problemática | Alternativa |
|----------------|------------------|------------------------|-------------|
| [funcionalidade] | [apelo superficial] | [problemas reais] | [melhor abordagem] |
| [funcionalidade] | [apelo superficial] | [problemas reais] | [melhor abordagem] |

## Dependências de Funcionalidades

```
[Funcionalidade A]
    └──requer──> [Funcionalidade B]
                     └──requer──> [Funcionalidade C]

[Funcionalidade D] ──melhora──> [Funcionalidade A]

[Funcionalidade E] ──conflita──> [Funcionalidade F]
```

### Notas de Dependência

- **[Funcionalidade A] requer [Funcionalidade B]:** [por que a dependência existe]
- **[Funcionalidade D] melhora [Funcionalidade A]:** [como funcionam juntas]
- **[Funcionalidade E] conflita com [Funcionalidade F]:** [por que são incompatíveis]

## Definição de MVP

### Lançar Com (v1)

Produto mínimo viável — o que é necessário para validar o conceito.

- [ ] [Funcionalidade] — [por que é essencial]
- [ ] [Funcionalidade] — [por que é essencial]
- [ ] [Funcionalidade] — [por que é essencial]

### Adicionar Após Validação (v1.x)

Funcionalidades a adicionar depois que o core estiver funcionando.

- [ ] [Funcionalidade] — [gatilho para adicionar]
- [ ] [Funcionalidade] — [gatilho para adicionar]

### Consideração Futura (v2+)

Funcionalidades a adiar até que o product-market fit seja estabelecido.

- [ ] [Funcionalidade] — [por que adiar]
- [ ] [Funcionalidade] — [por que adiar]

## Matriz de Priorização de Funcionalidades

| Funcionalidade | Valor para o Usuário | Custo de Implementação | Prioridade |
|----------------|----------------------|------------------------|------------|
| [funcionalidade] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |
| [funcionalidade] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |
| [funcionalidade] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |

**Chave de prioridade:**
- P1: Obrigatório para lançamento
- P2: Deve ter, adicionar quando possível
- P3: Seria bom ter, consideração futura

## Análise de Funcionalidades dos Concorrentes

| Funcionalidade | Concorrente A | Concorrente B | Nossa Abordagem |
|----------------|---------------|---------------|-----------------|
| [funcionalidade] | [como fazem] | [como fazem] | [nosso plano] |
| [funcionalidade] | [como fazem] | [como fazem] | [nosso plano] |

## Fontes

- [Produtos concorrentes analisados]
- [Pesquisa de usuário ou fontes de feedback]
- [Padrões do setor referenciados]

---
*Pesquisa de funcionalidades para: [domínio]*
*Pesquisado: [data]*
```

</template>

<guidelines>

**Requisitos Básicos:**
- Estes são inegociáveis para o lançamento
- Usuários não dão crédito por tê-los, mas penalizam por faltarem
- Exemplo: Uma plataforma comunitária sem perfis de usuário está quebrada

**Diferenciais:**
- Aqui é onde você compete
- Deve se alinhar com o Valor Central do PROJECT.md
- Não tente se diferenciar em tudo

**Anti-Funcionalidades:**
- Previne scope creep documentando o que parece bom mas não é
- Inclua a abordagem alternativa
- Exemplo: "Tudo em tempo real" frequentemente cria complexidade sem valor

**Dependências de Funcionalidades:**
- Crítico para ordenamento de fases do roadmap
- Se A requer B, B deve estar em uma fase anterior
- Conflitos informam o que NÃO combinar na mesma fase

**Definição de MVP:**
- Seja implacável sobre o que é verdadeiramente mínimo
- "Seria bom ter" não é MVP
- Lance com menos, valide, depois expanda

</guidelines>
