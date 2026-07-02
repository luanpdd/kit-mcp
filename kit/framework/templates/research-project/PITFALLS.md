# Template de Pesquisa de Armadilhas

Template para `.planning/research/PITFALLS.md` — erros comuns a evitar no domínio do projeto.

<template>

```markdown
# Pesquisa de Armadilhas

**Domínio:** [tipo de domínio]
**Pesquisado:** [data]
**Confiança:** [HIGH/MEDIUM/LOW]

## Armadilhas Críticas

### Armadilha 1: [Nome]

**O que dá errado:**
[Descrição do modo de falha]

**Por que acontece:**
[Causa raiz — por que desenvolvedores cometem este erro]

**Como evitar:**
[Estratégia específica de prevenção]

**Sinais de alerta:**
[Como detectar isso cedo antes que se torne um problema]

**Fase para abordar:**
[Qual fase do roadmap deve prevenir isto]

---

### Armadilha 2: [Nome]

**O que dá errado:**
[Descrição do modo de falha]

**Por que acontece:**
[Causa raiz — por que desenvolvedores cometem este erro]

**Como evitar:**
[Estratégia específica de prevenção]

**Sinais de alerta:**
[Como detectar isso cedo antes que se torne um problema]

**Fase para abordar:**
[Qual fase do roadmap deve prevenir isto]

---

### Armadilha 3: [Nome]

**O que dá errado:**
[Descrição do modo de falha]

**Por que acontece:**
[Causa raiz — por que desenvolvedores cometem este erro]

**Como evitar:**
[Estratégia específica de prevenção]

**Sinais de alerta:**
[Como detectar isso cedo antes que se torne um problema]

**Fase para abordar:**
[Qual fase do roadmap deve prevenir isto]

---

[Continue para todas as armadilhas críticas...]

## Padrões de Dívida Técnica

Atalhos que parecem razoáveis mas criam problemas a longo prazo.

| Atalho | Benefício Imediato | Custo a Longo Prazo | Quando É Aceitável |
|--------|--------------------|---------------------|--------------------|
| [atalho] | [benefício] | [custo] | [condições, ou "nunca"] |
| [atalho] | [benefício] | [custo] | [condições, ou "nunca"] |
| [atalho] | [benefício] | [custo] | [condições, ou "nunca"] |

## Armadilhas de Integração

Erros comuns ao conectar a serviços externos.

| Integração | Erro Comum | Abordagem Correta |
|------------|------------|-------------------|
| [serviço] | [o que as pessoas fazem errado] | [o que fazer em vez disso] |
| [serviço] | [o que as pessoas fazem errado] | [o que fazer em vez disso] |
| [serviço] | [o que as pessoas fazem errado] | [o que fazer em vez disso] |

## Armadilhas de Performance

Padrões que funcionam em pequena escala mas falham com o crescimento do uso.

| Armadilha | Sintomas | Prevenção | Quando Quebra |
|-----------|----------|-----------|---------------|
| [armadilha] | [como perceber] | [como evitar] | [limite de escala] |
| [armadilha] | [como perceber] | [como evitar] | [limite de escala] |
| [armadilha] | [como perceber] | [como evitar] | [limite de escala] |

## Erros de Segurança

Problemas de segurança específicos do domínio além da segurança web geral.

| Erro | Risco | Prevenção |
|------|-------|-----------|
| [erro] | [o que poderia acontecer] | [como evitar] |
| [erro] | [o que poderia acontecer] | [como evitar] |
| [erro] | [o que poderia acontecer] | [como evitar] |

## Armadilhas de UX

Erros comuns de experiência do usuário neste domínio.

| Armadilha | Impacto no Usuário | Melhor Abordagem |
|-----------|-------------------|------------------|
| [armadilha] | [como os usuários sofrem] | [o que fazer em vez disso] |
| [armadilha] | [como os usuários sofrem] | [o que fazer em vez disso] |
| [armadilha] | [como os usuários sofrem] | [o que fazer em vez disso] |

## Checklist "Parece Pronto Mas Não Está"

Coisas que parecem completas mas estão faltando peças críticas.

- [ ] **[Funcionalidade]:** Frequentemente falta [coisa] — verificar [checagem]
- [ ] **[Funcionalidade]:** Frequentemente falta [coisa] — verificar [checagem]
- [ ] **[Funcionalidade]:** Frequentemente falta [coisa] — verificar [checagem]
- [ ] **[Funcionalidade]:** Frequentemente falta [coisa] — verificar [checagem]

## Estratégias de Recuperação

Quando armadilhas ocorrem apesar da prevenção, como se recuperar.

| Armadilha | Custo de Recuperação | Passos de Recuperação |
|-----------|----------------------|----------------------|
| [armadilha] | LOW/MEDIUM/HIGH | [o que fazer] |
| [armadilha] | LOW/MEDIUM/HIGH | [o que fazer] |
| [armadilha] | LOW/MEDIUM/HIGH | [o que fazer] |

## Mapeamento de Armadilhas por Fase

Como as fases do roadmap devem abordar estas armadilhas.

| Armadilha | Fase de Prevenção | Verificação |
|-----------|-------------------|-------------|
| [armadilha] | Fase [X] | [como verificar se a prevenção funcionou] |
| [armadilha] | Fase [X] | [como verificar se a prevenção funcionou] |
| [armadilha] | Fase [X] | [como verificar se a prevenção funcionou] |

## Fontes

- [Post-mortems referenciados]
- [Discussões da comunidade]
- [Documentação oficial de "armadilhas"]
- [Experiência pessoal / problemas conhecidos]

---
*Pesquisa de armadilhas para: [domínio]*
*Pesquisado: [data]*
```

</template>

<guidelines>

**Armadilhas Críticas:**
- Foque em problemas específicos do domínio, não em erros genéricos
- Inclua sinais de alerta — detecção precoce evita desastres
- Vincule a fases específicas — torna as armadilhas acionáveis

**Dívida Técnica:**
- Seja realista — alguns atalhos são aceitáveis
- Indique quando atalhos são "nunca aceitáveis" vs. "apenas no MVP"
- Inclua o custo a longo prazo para informar decisões de trade-off

**Armadilhas de Performance:**
- Inclua limites de escala ("quebra com 10k usuários")
- Foque no que é relevante para a escala esperada deste projeto
- Não super-otimize para escala hipotética

**Erros de Segurança:**
- Além das básicas do OWASP — problemas específicos do domínio
- Exemplo: Plataformas comunitárias têm preocupações de segurança diferentes de e-commerce
- Inclua nível de risco para priorizar

**"Parece Pronto Mas Não Está":**
- Formato de checklist para verificação durante a execução
- Comum em demos vs. produção
- Previne problemas de "funciona na minha máquina"

**Mapeamento de Armadilhas por Fase:**
- Crítico para a criação do roadmap
- Cada armadilha deve mapear para uma fase que a previne
- Informa o ordenamento de fases e critérios de sucesso

</guidelines>
