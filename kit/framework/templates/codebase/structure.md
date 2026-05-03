# Template de Estrutura

Template para `.planning/codebase/STRUCTURE.md` - captura a organização física dos arquivos.

**Propósito:** Documentar onde as coisas fisicamente vivem no codebase. Responde "onde coloco X?"

---

## Template do Arquivo

```markdown
# Estrutura do Codebase

**Data da Análise:** [AAAA-MM-DD]

## Estrutura de Diretórios

[Árvore ASCII com box-drawing dos diretórios de nível superior com propósito — use caracteres ├── └── │ apenas para estrutura de árvore]

```
[raiz-do-projeto]/
├── [dir]/          # [Propósito]
├── [dir]/          # [Propósito]
├── [dir]/          # [Propósito]
└── [arquivo]       # [Propósito]
```

## Propósitos dos Diretórios

**[Nome do Diretório]:**
- Propósito: [O que vive aqui]
- Contém: [Tipos de arquivos: ex.: "arquivos fonte *.ts", "diretórios de componentes"]
- Arquivos chave: [Arquivos importantes neste diretório]
- Subdiretórios: [Se aninhados, descrever estrutura]

**[Nome do Diretório]:**
- Propósito: [O que vive aqui]
- Contém: [Tipos de arquivos]
- Arquivos chave: [Arquivos importantes]
- Subdiretórios: [Estrutura]

## Localizações de Arquivos Chave

**Pontos de Entrada:**
- [Caminho]: [Propósito: ex.: "ponto de entrada CLI"]
- [Caminho]: [Propósito: ex.: "inicialização do servidor"]

**Configuração:**
- [Caminho]: [Propósito: ex.: "config TypeScript"]
- [Caminho]: [Propósito: ex.: "configuração de build"]
- [Caminho]: [Propósito: ex.: "variáveis de ambiente"]

**Lógica Core:**
- [Caminho]: [Propósito: ex.: "services de negócio"]
- [Caminho]: [Propósito: ex.: "models de banco de dados"]
- [Caminho]: [Propósito: ex.: "rotas da API"]

**Testes:**
- [Caminho]: [Propósito: ex.: "testes unitários"]
- [Caminho]: [Propósito: ex.: "fixtures de teste"]

**Documentação:**
- [Caminho]: [Propósito: ex.: "docs voltadas ao usuário"]
- [Caminho]: [Propósito: ex.: "guia do desenvolvedor"]

## Convenções de Nomenclatura

**Arquivos:**
- [Padrão]: [Exemplo: ex.: "kebab-case.ts para módulos"]
- [Padrão]: [Exemplo: ex.: "PascalCase.tsx para componentes React"]
- [Padrão]: [Exemplo: ex.: "*.test.ts para arquivos de teste"]

**Diretórios:**
- [Padrão]: [Exemplo: ex.: "kebab-case para diretórios de funcionalidade"]
- [Padrão]: [Exemplo: ex.: "nomes no plural para coleções"]

**Padrões Especiais:**
- [Padrão]: [Exemplo: ex.: "index.ts para exports de diretório"]
- [Padrão]: [Exemplo: ex.: "__tests__ para diretórios de teste"]

## Onde Adicionar Novo Código

**Nova Funcionalidade:**
- Código principal: [Caminho do diretório]
- Testes: [Caminho do diretório]
- Config se necessário: [Caminho do diretório]

**Novo Componente/Módulo:**
- Implementação: [Caminho do diretório]
- Tipos: [Caminho do diretório]
- Testes: [Caminho do diretório]

**Nova Rota/Comando:**
- Definição: [Caminho do diretório]
- Handler: [Caminho do diretório]
- Testes: [Caminho do diretório]

**Utilitários:**
- Helpers compartilhados: [Caminho do diretório]
- Definições de tipos: [Caminho do diretório]

## Diretórios Especiais

[Quaisquer diretórios com significado especial ou geração]

**[Diretório]:**
- Propósito: [ex.: "Código gerado", "Saída de build"]
- Fonte: [ex.: "Auto-gerado por X", "Artefatos de build"]
- Comitado: [Sim/Não — no .gitignore?]

---

*Análise de estrutura: [data]*
*Atualizar quando a estrutura de diretórios mudar*
```

<good_examples>
```markdown
# Codebase Structure

**Analysis Date:** 2025-01-20

## Directory Layout

```
framework/
├── bin/                # Executable entry points
├── commands/           # Slash command definitions
│   └── framework/           # framework-specific commands
├── framework/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates
│   └── workflows/     # Multi-step procedures
├── src/               # Source code (if applicable)
├── tests/             # Test files
├── package.json       # Project manifest
└── README.md          # User documentation
```

## Directory Purposes

**commands/**
- Purpose: Slash command definitions for Claude Code
- Contains: *.md files (one per command)
- Key files: new-project.md, plan-phase.md, execute-plan.md
- Subdirectories: None (flat structure)

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/{command-name}.md`
- Tests: `tests/commands/{command-name}.test.js`
- Documentation: Update `README.md` with new command

---

*Structure analysis: 2025-01-20*
*Update when directory structure changes*
```
</good_examples>

<guidelines>
**O que pertence ao STRUCTURE.md:**
- Layout de diretórios (árvore ASCII para visualização de estrutura)
- Propósito de cada diretório
- Localizações de arquivos chave (pontos de entrada, configs, lógica core)
- Convenções de nomenclatura
- Onde adicionar novo código (por tipo)
- Diretórios especiais/gerados

**O que NÃO pertence aqui:**
- Arquitetura conceitual (isso é ARCHITECTURE.md)
- Stack tecnológico (isso é STACK.md)
- Detalhes de implementação de código (diferir para leitura do código)
- Todos os arquivos individuais (focar em diretórios e arquivos chave)

**Ao preencher este template:**
- Usar `tree -L 2` ou similar para visualizar estrutura
- Identificar diretórios de nível superior e seus propósitos
- Notar padrões de nomenclatura observando arquivos existentes
- Localizar pontos de entrada, configs e áreas de lógica principal
- Manter árvore de diretórios concisa (máximo 2-3 níveis)

**Formato de árvore (caracteres ASCII box-drawing apenas para estrutura):**
```
root/
├── dir1/           # Propósito
│   ├── subdir/    # Propósito
│   └── file.ts    # Propósito
├── dir2/          # Propósito
└── file.ts        # Propósito
```

**Útil para planejamento de fases quando:**
- Adicionando novas funcionalidades (onde os arquivos devem ir?)
- Entendendo organização do projeto
- Encontrando onde vive lógica específica
- Seguindo convenções existentes
</guidelines>
