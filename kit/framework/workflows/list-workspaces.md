<purpose>
Listar todos os workspaces framework encontrados em ~/workspaces/ com seu status.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

## 1. Configuração

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init list-workspaces)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analisar JSON para: `workspace_base`, `workspaces`, `workspace_count`.

## 2. Exibição

**Se `workspace_count` for 0:**

```
Nenhum workspace encontrado em ~/workspaces/

Crie um com:
  /novo-workspace --name meu-workspace --repos repo1,repo2
```

Concluído.

**Se workspaces existirem:**

Exibir uma tabela:

```
Workspaces framework (~/workspaces/)

| Nome | Repos | Estratégia | Projeto framework |
|------|-------|------------|-------------|
| feature-a | 3 | worktree | Sim |
| feature-b | 2 | clone | Não |

Gerenciar:
  cd ~/workspaces/<nome>         # Entrar em um workspace
  /remover-workspace <nome>      # Remover um workspace
```

Para cada workspace, mostrar:
- **Nome** — nome do diretório
- **Repos** — contagem dos dados de init
- **Estratégia** — do WORKSPACE.md
- **Projeto framework** — se `.planning/PROJECT.md` existe (Sim/Não)

</process>
