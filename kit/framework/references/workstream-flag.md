# Flag de Workstream (`--ws`)

## Visão Geral

O flag `--ws <nome>` escopa as operações do framework para um workstream específico, permitindo
trabalho paralelo em marcos por múltiplas instâncias do Claude Code no mesmo código.

## Prioridade de Resolução

1. Flag `--ws <nome>` (explícito, maior prioridade)
2. Variável de ambiente `WORKSTREAM` (por instância)
3. Arquivo `.planning/active-workstream` (compartilhado, último escritor vence)
4. `null` — modo flat (sem workstreams)

## Propagação de Roteamento

Todos os comandos de roteamento de workflow incluem `${WS}` que:
- Expande para `--ws <nome>` quando um workstream está ativo
- Expande para string vazia no modo flat (compatível com versões anteriores)

Isso garante que o escopo do workstream seja encadeado automaticamente pelo workflow:
`novo-marco → discutir-fase → planejar-fase → executar-fase → transition`

## Estrutura de Diretório

```
.planning/
├── PROJECT.md          # Compartilhado
├── config.json         # Compartilhado
├── milestones/         # Compartilhado
├── codebase/           # Compartilhado
├── active-workstream   # Aponta para ws atual
└── workstreams/
    ├── feature-a/      # Workstream A
    │   ├── STATE.md
    │   ├── ROADMAP.md
    │   ├── REQUIREMENTS.md
    │   └── phases/
    └── feature-b/      # Workstream B
        ├── STATE.md
        ├── ROADMAP.md
        ├── REQUIREMENTS.md
        └── phases/
```

## Uso do CLI

```bash
# Todos os comandos tools aceitam --ws
node tools.cjs state json --ws feature-a
node tools.cjs find-phase 3 --ws feature-b

# CRUD de workstream
node tools.cjs workstream create <nome>
node tools.cjs workstream list
node tools.cjs workstream status <nome>
node tools.cjs workstream complete <nome>
```
