# Template de Resumo de Pesquisa

Template para `.planning/research/SUMMARY.md` — resumo executivo da pesquisa do projeto com implicações para o roadmap.

<template>

```markdown
# Resumo da Pesquisa do Projeto

**Projeto:** [nome do PROJECT.md]
**Domínio:** [tipo de domínio inferido]
**Pesquisado:** [data]
**Confiança:** [HIGH/MEDIUM/LOW]

## Resumo Executivo

[Visão geral dos resultados da pesquisa em 2-3 parágrafos]

- Que tipo de produto é este e como especialistas constroem
- A abordagem recomendada com base na pesquisa
- Riscos principais e como mitigá-los

## Principais Descobertas

### Stack Recomendado

[Resumo do STACK.md — 1-2 parágrafos]

**Tecnologias core:**
- [Tecnologia]: [propósito] — [por que recomendada]
- [Tecnologia]: [propósito] — [por que recomendada]
- [Tecnologia]: [propósito] — [por que recomendada]

### Funcionalidades Esperadas

[Resumo do FEATURES.md]

**Deve ter (requisitos básicos):**
- [Funcionalidade] — usuários esperam isto
- [Funcionalidade] — usuários esperam isto

**Deveria ter (competitivo):**
- [Funcionalidade] — diferencial
- [Funcionalidade] — diferencial

**Adiar (v2+):**
- [Funcionalidade] — não essencial para lançamento

### Abordagem de Arquitetura

[Resumo do ARCHITECTURE.md — 1 parágrafo]

**Componentes principais:**
1. [Componente] — [responsabilidade]
2. [Componente] — [responsabilidade]
3. [Componente] — [responsabilidade]

### Armadilhas Críticas

[Top 3-5 do PITFALLS.md]

1. **[Armadilha]** — [como evitar]
2. **[Armadilha]** — [como evitar]
3. **[Armadilha]** — [como evitar]

## Implicações para o Roadmap

Com base na pesquisa, estrutura de fases sugerida:

### Fase 1: [Nome]
**Justificativa:** [por que vem primeiro com base na pesquisa]
**Entrega:** [o que esta fase produz]
**Aborda:** [funcionalidades do FEATURES.md]
**Evita:** [armadilha do PITFALLS.md]

### Fase 2: [Nome]
**Justificativa:** [por que esta ordem]
**Entrega:** [o que esta fase produz]
**Usa:** [elementos de stack do STACK.md]
**Implementa:** [componente de arquitetura]

### Fase 3: [Nome]
**Justificativa:** [por que esta ordem]
**Entrega:** [o que esta fase produz]

[Continue para fases sugeridas...]

### Justificativa do Ordenamento das Fases

- [Por que esta ordem com base nas dependências descobertas]
- [Por que este agrupamento com base nos padrões de arquitetura]
- [Como isto evita armadilhas da pesquisa]

### Flags de Pesquisa

Fases que provavelmente precisarão de pesquisa mais aprofundada durante o planejamento:
- **Fase [X]:** [razão — ex.: "integração complexa, precisa de pesquisa de API"]
- **Fase [Y]:** [razão — ex.: "domínio de nicho, documentação escassa"]

Fases com padrões padrão (pular fase de pesquisa):
- **Fase [X]:** [razão — ex.: "bem documentado, padrões estabelecidos"]

## Avaliação de Confiança

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [razão] |
| Funcionalidades | [HIGH/MEDIUM/LOW] | [razão] |
| Arquitetura | [HIGH/MEDIUM/LOW] | [razão] |
| Armadilhas | [HIGH/MEDIUM/LOW] | [razão] |

**Confiança geral:** [HIGH/MEDIUM/LOW]

### Lacunas a Abordar

[Quaisquer áreas onde a pesquisa foi inconclusiva ou precisa de validação durante a implementação]

- [Lacuna]: [como tratar durante o planejamento/execução]
- [Lacuna]: [como tratar durante o planejamento/execução]

## Fontes

### Primárias (confiança HIGH)
- [ID de biblioteca Context7] — [tópicos]
- [URL de documentação oficial] — [o que foi verificado]

### Secundárias (confiança MEDIUM)
- [Fonte] — [descoberta]

### Terciárias (confiança LOW)
- [Fonte] — [descoberta, precisa de validação]

---
*Pesquisa concluída: [data]*
*Pronto para roadmap: sim*
```

</template>

<guidelines>

**Resumo Executivo:**
- Escreva para quem vai ler apenas esta seção
- Inclua a recomendação principal e o risco principal
- Máximo de 2-3 parágrafos

**Principais Descobertas:**
- Resuma, não duplique documentos completos
- Vincule a documentos detalhados (STACK.md, FEATURES.md, etc.)
- Foque no que importa para decisões do roadmap

**Implicações para o Roadmap:**
- Esta é a seção mais importante
- Informa diretamente a criação do roadmap
- Seja explícito sobre sugestões de fases e justificativa
- Inclua flags de pesquisa para cada fase sugerida

**Avaliação de Confiança:**
- Seja honesto sobre incerteza
- Indique lacunas que precisam de resolução durante o planejamento
- HIGH = verificado com fontes oficiais
- MEDIUM = consenso da comunidade, múltiplas fontes concordam
- LOW = fonte única ou inferência

**Integração com a criação do roadmap:**
- Este arquivo é carregado como contexto durante a criação do roadmap
- Sugestões de fases aqui se tornam ponto de partida para o roadmap
- Flags de pesquisa informam o planejamento de fases

</guidelines>
