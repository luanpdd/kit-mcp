---
name: fluxos-trabalho
description: Gerencia fluxos de trabalho paralelos — listar, criar, alternar, status, progresso, concluir e retomar
---

# /fluxos-trabalho

Gerencia fluxos de trabalho paralelos para trabalho concurrent em milestones.

## Uso

`/fluxos-trabalho [subcomando] [argumentos]`

### Subcomandos

| Comando | Descrição |
|---------|-----------|
| `list` | Listar todos os fluxos com status |
| `create <nome>` | Criar um novo fluxo de trabalho |
| `status <nome>` | Status detalhado de um fluxo |
| `switch <nome>` | Definir fluxo ativo |
| `progress` | Resumo de progresso de todos os fluxos |
| `complete <nome>` | Arquivar um fluxo concluído |
| `resume <nome>` | Retomar trabalho em um fluxo |

## Passo 1: Analisar Subcomando

Analisar a entrada do usuário para determinar qual operação de fluxo executar.
Se nenhum subcomando for fornecido, padrão é `list`.

## Passo 2: Executar Operação

### list
Executar: `node "$TOOLS" workstream list --raw --cwd "$CWD"`
Exibir os fluxos em formato de tabela mostrando nome, status, fase atual e progresso.

### create
Executar: `node "$TOOLS" workstream create <nome> --raw --cwd "$CWD"`
Após criação, exibir o caminho do novo fluxo e sugerir próximos passos:
- `/novo-marco --ws <nome>` para configurar o milestone

### status
Executar: `node "$TOOLS" workstream status <nome> --raw --cwd "$CWD"`
Exibir detalhamento de fases e informações de estado.

### switch
Executar: `node "$TOOLS" workstream set <nome> --raw --cwd "$CWD"`
Também definir variável de ambiente `WORKSTREAM` para a sessão atual.

### progress
Executar: `node "$TOOLS" workstream progress --raw --cwd "$CWD"`
Exibir visão geral de progresso de todos os fluxos.

### complete
Executar: `node "$TOOLS" workstream complete <nome> --raw --cwd "$CWD"`
Arquivar o fluxo em milestones/.

### resume
Definir o fluxo como ativo e sugerir `/retomar-trabalho --ws <nome>`.

## Passo 3: Exibir Resultados

Formatar a saída JSON do tools em exibição legível por humanos.
Incluir a flag `${WS}` em qualquer sugestão de roteamento.
