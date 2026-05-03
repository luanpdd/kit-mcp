# Template de Arquitetura

Template para `.planning/codebase/ARCHITECTURE.md` - captura a organização conceitual do código.

**Propósito:** Documentar como o código está organizado em nível conceitual. Complementa STRUCTURE.md (que mostra localizações físicas de arquivos).

---

## Template do Arquivo

```markdown
# Arquitetura

**Data da Análise:** [AAAA-MM-DD]

## Visão Geral do Padrão

**Geral:** [Nome do padrão: ex.: "CLI Monolítico", "API Serverless", "MVC Full-stack"]

**Características Chave:**
- [Característica 1: ex.: "Executável único"]
- [Característica 2: ex.: "Tratamento de requisições stateless"]
- [Característica 3: ex.: "Orientado a eventos"]

## Camadas

[Descreva as camadas conceituais e suas responsabilidades]

**[Nome da Camada]:**
- Propósito: [O que esta camada faz]
- Contém: [Tipos de código: ex.: "route handlers", "lógica de negócio"]
- Depende de: [O que usa: ex.: "apenas camada de dados"]
- Usado por: [O que o usa: ex.: "rotas da API"]

**[Nome da Camada]:**
- Propósito: [O que esta camada faz]
- Contém: [Tipos de código]
- Depende de: [O que usa]
- Usado por: [O que o usa]

## Fluxo de Dados

[Descreva o ciclo de vida típico de requisição/execução]

**[Nome do Fluxo] (ex.: "Requisição HTTP", "Comando CLI", "Processamento de Evento"):**

1. [Ponto de entrada: ex.: "Usuário executa comando"]
2. [Etapa de processamento: ex.: "Router corresponde ao caminho"]
3. [Etapa de processamento: ex.: "Controller valida entrada"]
4. [Etapa de processamento: ex.: "Service executa lógica"]
5. [Saída: ex.: "Resposta retornada"]

**Gerenciamento de Estado:**
- [Como o estado é tratado: ex.: "Stateless - sem estado persistente", "Banco por requisição", "Cache em memória"]

## Abstrações Chave

[Conceitos/padrões centrais usados em todo o codebase]

**[Nome da Abstração]:**
- Propósito: [O que representa]
- Exemplos: [ex.: "UserService, ProjectService"]
- Padrão: [ex.: "Singleton", "Factory", "Repository"]

**[Nome da Abstração]:**
- Propósito: [O que representa]
- Exemplos: [Exemplos concretos]
- Padrão: [Padrão usado]

## Pontos de Entrada

[Onde a execução começa]

**[Ponto de Entrada]:**
- Localização: [Breve: ex.: "src/index.ts", "API Gateway triggers"]
- Gatilhos: [O que o invoca: ex.: "invocação CLI", "requisição HTTP"]
- Responsabilidades: [O que faz: ex.: "Analisar args, rotear para comando"]

## Tratamento de Erros

**Estratégia:** [Como erros são tratados: ex.: "Exception bubbling para handler de nível superior", "Middleware de erro por rota"]

**Padrões:**
- [Padrão: ex.: "try/catch no nível do controller"]
- [Padrão: ex.: "Códigos de erro retornados ao usuário"]

## Preocupações Transversais

[Aspectos que afetam múltiplas camadas]

**Logging:**
- [Abordagem: ex.: "Winston logger, injetado por requisição"]

**Validação:**
- [Abordagem: ex.: "Schemas Zod no limite da API"]

**Autenticação:**
- [Abordagem: ex.: "Middleware JWT em rotas protegidas"]

---

*Análise de arquitetura: [data]*
*Atualizar quando padrões principais mudarem*
```

<good_examples>
```markdown
# Architecture

**Analysis Date:** 2025-01-20

## Pattern Overview

**Overall:** CLI Application with Plugin System

**Key Characteristics:**
- Single executable with subcommands
- Plugin-based extensibility
- File-based state (no database)
- Synchronous execution model

## Layers

**Command Layer:**
- Purpose: Parse user input and route to appropriate handler
- Contains: Command definitions, argument parsing, help text
- Location: `src/commands/*.ts`
- Depends on: Service layer for business logic
- Used by: CLI entry point (`src/index.ts`)

**Service Layer:**
- Purpose: Core business logic
- Contains: FileService, TemplateService, InstallService
- Location: `src/services/*.ts`
- Depends on: File system utilities, external tools
- Used by: Command handlers

## Error Handling

**Strategy:** Throw exceptions, catch at command level, log and exit

**Patterns:**
- Services throw Error with descriptive messages
- Command handlers catch, log error to stderr, exit(1)
- Validation errors shown before execution (fail fast)

---

*Architecture analysis: 2025-01-20*
*Update when major patterns change*
```
</good_examples>

<guidelines>
**O que pertence ao ARCHITECTURE.md:**
- Padrão arquitetural geral (monolito, microsserviços, em camadas, etc.)
- Camadas conceituais e seus relacionamentos
- Fluxo de dados / ciclo de vida da requisição
- Abstrações e padrões chave
- Pontos de entrada
- Estratégia de tratamento de erros
- Preocupações transversais (logging, auth, validação)

**O que NÃO pertence aqui:**
- Listas exaustivas de arquivos (isso é STRUCTURE.md)
- Escolhas tecnológicas (isso é STACK.md)
- Percurso linha a linha do código (diferir para leitura do código)
- Detalhes de implementação de funcionalidades específicas

**Caminhos de arquivo SÃO bem-vindos:**
Inclua caminhos de arquivo como exemplos concretos de abstrações. Use formatação backtick: `src/services/user.ts`. Isso torna o documento de arquitetura acionável para o Claude durante o planejamento.

**Ao preencher este template:**
- Ler os principais pontos de entrada (index, server, main)
- Identificar camadas lendo imports/dependências
- Rastrear uma execução típica de requisição/comando
- Notar padrões recorrentes (services, controllers, repositories)
- Manter descrições conceituais, não mecânicas

**Útil para planejamento de fases quando:**
- Adicionando novas funcionalidades (onde se encaixa nas camadas?)
- Refatorando (entendendo padrões atuais)
- Identificando onde adicionar código (qual camada trata X?)
- Entendendo dependências entre componentes
</guidelines>
