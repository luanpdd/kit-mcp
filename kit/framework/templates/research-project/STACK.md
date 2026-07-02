# Template de Pesquisa de Stack

Template para `.planning/research/STACK.md` — tecnologias recomendadas para o domínio do projeto.

<template>

```markdown
# Pesquisa de Stack

**Domínio:** [tipo de domínio]
**Pesquisado:** [data]
**Confiança:** [HIGH/MEDIUM/LOW]

## Stack Recomendado

### Tecnologias Core

| Tecnologia | Versão | Propósito | Por Que Recomendada |
|------------|--------|-----------|---------------------|
| [nome] | [versão] | [o que faz] | [por que especialistas usam para este domínio] |
| [nome] | [versão] | [o que faz] | [por que especialistas usam para este domínio] |
| [nome] | [versão] | [o que faz] | [por que especialistas usam para este domínio] |

### Bibliotecas de Suporte

| Biblioteca | Versão | Propósito | Quando Usar |
|------------|--------|-----------|-------------|
| [nome] | [versão] | [o que faz] | [caso de uso específico] |
| [nome] | [versão] | [o que faz] | [caso de uso específico] |
| [nome] | [versão] | [o que faz] | [caso de uso específico] |

### Ferramentas de Desenvolvimento

| Ferramenta | Propósito | Notas |
|------------|-----------|-------|
| [nome] | [o que faz] | [dicas de configuração] |
| [nome] | [o que faz] | [dicas de configuração] |

## Instalação

```bash
# Core
npm install [pacotes]

# Suporte
npm install [pacotes]

# Dependências de desenvolvimento
npm install -D [pacotes]
```

## Alternativas Consideradas

| Recomendado | Alternativa | Quando Usar a Alternativa |
|-------------|-------------|---------------------------|
| [nossa escolha] | [outra opção] | [condições onde a alternativa é melhor] |
| [nossa escolha] | [outra opção] | [condições onde a alternativa é melhor] |

## O Que NÃO Usar

| Evitar | Por Que | Usar Em Vez Disso |
|--------|---------|-------------------|
| [tecnologia] | [problema específico] | [alternativa recomendada] |
| [tecnologia] | [problema específico] | [alternativa recomendada] |

## Variantes de Stack por Condição

**Se [condição]:**
- Usar [variação]
- Porque [razão]

**Se [condição]:**
- Usar [variação]
- Porque [razão]

## Compatibilidade de Versões

| Pacote A | Compatível Com | Notas |
|----------|----------------|-------|
| [pacote@versão] | [pacote@versão] | [notas de compatibilidade] |

## Fontes

- [ID de biblioteca Context7] — [tópicos pesquisados]
- [URL de documentação oficial] — [o que foi verificado]
- [Outra fonte] — [nível de confiança]

---
*Pesquisa de stack para: [domínio]*
*Pesquisado: [data]*
```

</template>

<guidelines>

**Tecnologias Core:**
- Inclua números de versão específicos
- Explique por que esta é a escolha padrão, não apenas o que faz
- Foque em tecnologias que afetam decisões de arquitetura

**Bibliotecas de Suporte:**
- Inclua bibliotecas comumente necessárias para este domínio
- Indique quando cada uma é necessária (nem todos os projetos precisam de todas)

**Alternativas:**
- Não apenas dispense alternativas
- Explique quando as alternativas fazem sentido
- Ajuda o usuário a tomar decisões informadas caso discorde

**O Que NÃO Usar:**
- Alerte ativamente contra escolhas desatualizadas ou problemáticas
- Explique o problema específico, não apenas "é antigo"
- Forneça a alternativa recomendada

**Compatibilidade de Versões:**
- Anote problemas conhecidos de compatibilidade
- Crítico para evitar tempo de depuração mais tarde

</guidelines>
