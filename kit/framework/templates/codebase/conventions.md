# Template de Convenções de Código

Template para `.planning/codebase/CONVENTIONS.md` - captura estilo e padrões de código.

**Propósito:** Documentar como o código é escrito neste codebase. Guia prescritivo para o Claude corresponder ao estilo existente.

---

## Template do Arquivo

```markdown
# Convenções de Código

**Data da Análise:** [AAAA-MM-DD]

## Padrões de Nomenclatura

**Arquivos:**
- [Padrão: ex.: "kebab-case para todos os arquivos"]
- [Arquivos de teste: ex.: "*.test.ts junto ao source"]
- [Componentes: ex.: "PascalCase.tsx para componentes React"]

**Funções:**
- [Padrão: ex.: "camelCase para todas as funções"]
- [Async: ex.: "sem prefixo especial para funções async"]
- [Handlers: ex.: "handleNomeDoEvento para event handlers"]

**Variáveis:**
- [Padrão: ex.: "camelCase para variáveis"]
- [Constantes: ex.: "UPPER_SNAKE_CASE para constantes"]
- [Privadas: ex.: "_prefixo para membros privados" ou "sem prefixo"]

**Tipos:**
- [Interfaces: ex.: "PascalCase, sem prefixo I"]
- [Types: ex.: "PascalCase para type aliases"]
- [Enums: ex.: "PascalCase para nome do enum, UPPER_CASE para valores"]

## Estilo de Código

**Formatação:**
- [Ferramenta: ex.: "Prettier com config em .prettierrc"]
- [Comprimento de linha: ex.: "100 caracteres no máximo"]
- [Aspas: ex.: "aspas simples para strings"]
- [Ponto e vírgula: ex.: "obrigatório" ou "omitido"]

**Linting:**
- [Ferramenta: ex.: "ESLint com eslint.config.js"]
- [Regras: ex.: "extends airbnb-base, sem console em produção"]
- [Executar: ex.: "npm run lint"]

## Organização de Imports

**Ordem:**
1. [ex.: "Pacotes externos (react, express, etc.)"]
2. [ex.: "Módulos internos (@/lib, @/components)"]
3. [ex.: "Imports relativos (., ..)"]
4. [ex.: "Type imports (import type {})"]

**Agrupamento:**
- [Linhas em branco: ex.: "linha em branco entre grupos"]
- [Ordenação: ex.: "alfabética dentro de cada grupo"]

**Path Aliases:**
- [Aliases usados: ex.: "@/ para src/, @components/ para src/components/"]

## Tratamento de Erros

**Padrões:**
- [Estratégia: ex.: "lançar errors, capturar nos limites"]
- [Erros customizados: ex.: "estender classe Error, nomeados *Error"]
- [Async: ex.: "usar try/catch, sem cadeias .catch()"]

**Tipos de Erro:**
- [Quando lançar: ex.: "entrada inválida, dependências faltando"]
- [Quando retornar: ex.: "falhas esperadas retornam Result<T, E>"]
- [Logging: ex.: "logar error com contexto antes de lançar"]

## Logging

**Framework:**
- [Ferramenta: ex.: "console.log, pino, winston"]
- [Níveis: ex.: "debug, info, warn, error"]

**Padrões:**
- [Formato: ex.: "logging estruturado com objeto de contexto"]
- [Quando: ex.: "logar transições de estado, chamadas externas"]
- [Onde: ex.: "logar nos limites de serviço, não em utils"]

## Comentários

**Quando Comentar:**
- [ex.: "explicar por quê, não o quê"]
- [ex.: "documentar lógica de negócio, algoritmos, casos extremos"]
- [ex.: "evitar comentários óbvios como // incrementar contador"]

**JSDoc/TSDoc:**
- [Uso: ex.: "obrigatório para APIs públicas, opcional para internas"]
- [Formato: ex.: "usar tags @param, @returns, @throws"]

**Comentários TODO:**
- [Padrão: ex.: "// TODO(username): descrição"]
- [Rastreamento: ex.: "link para número do issue se disponível"]

## Design de Funções

**Tamanho:**
- [ex.: "manter abaixo de 50 linhas, extrair helpers"]

**Parâmetros:**
- [ex.: "máximo 3 parâmetros, usar objeto para mais"]
- [ex.: "desestruturar objetos na lista de parâmetros"]

**Valores de Retorno:**
- [ex.: "returns explícitos, sem undefined implícito"]
- [ex.: "retornar cedo para cláusulas de guarda"]

## Design de Módulos

**Exports:**
- [ex.: "named exports preferidos, default exports para componentes React"]
- [ex.: "exportar de index.ts para API pública"]

**Barrel Files:**
- [ex.: "usar index.ts para re-exportar API pública"]
- [ex.: "evitar dependências circulares"]

---

*Análise de convenções: [data]*
*Atualizar quando padrões mudarem*
```

<good_examples>
```markdown
# Coding Conventions

**Analysis Date:** 2025-01-20

## Naming Patterns

**Files:**
- kebab-case for all files (command-handler.ts, user-service.ts)
- *.test.ts alongside source files
- index.ts for barrel exports

**Functions:**
- camelCase for all functions
- No special prefix for async functions
- handleEventName for event handlers (handleClick, handleSubmit)

## Code Style

**Formatting:**
- Prettier with .prettierrc
- 100 character line length
- Single quotes for strings
- Semicolons required
- 2 space indentation

---

*Convention analysis: 2025-01-20*
*Update when patterns change*
```
</good_examples>

<guidelines>
**O que pertence ao CONVENTIONS.md:**
- Padrões de nomenclatura observados no codebase
- Regras de formatação (config Prettier, regras de linting)
- Padrões de organização de imports
- Estratégia de tratamento de erros
- Abordagem de logging
- Convenções de comentários
- Padrões de design de funções e módulos

**O que NÃO pertence aqui:**
- Decisões de arquitetura (isso é ARCHITECTURE.md)
- Escolhas tecnológicas (isso é STACK.md)
- Padrões de teste (isso é TESTING.md)
- Organização de arquivos (isso é STRUCTURE.md)

**Ao preencher este template:**
- Verificar .prettierrc, .eslintrc ou arquivos de config similares
- Examinar 5-10 arquivos fonte representativos para padrões
- Procurar consistência: se 80%+ segue um padrão, documentar
- Ser prescritivo: "Use X" não "Às vezes Y é usado"
- Notar desvios: "Código legado usa Y, novo código deve usar X"
- Manter abaixo de ~150 linhas no total

**Útil para planejamento de fases quando:**
- Escrevendo novo código (corresponder ao estilo existente)
- Adicionando funcionalidades (seguir padrões de nomenclatura)
- Refatorando (aplicar convenções consistentes)
- Revisão de código (verificar contra padrões documentados)
- Integração (entender expectativas de estilo)

**Abordagem de análise:**
- Escanear diretório src/ para padrões de nomenclatura de arquivos
- Verificar scripts do package.json para comandos lint/format
- Ler 5-10 arquivos para identificar nomenclatura de funções, tratamento de erros
- Procurar arquivos de config (.prettierrc, eslint.config.js)
- Notar padrões em imports, comentários, assinaturas de funções
</guidelines>
