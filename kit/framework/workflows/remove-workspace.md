<purpose>
Remove um workspace framework, limpando git worktrees e excluindo o diretório do workspace.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

## 1. Configuração

Extraia o nome do workspace de $ARGUMENTS.

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init remove-workspace "$WORKSPACE_NAME")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analise o JSON para: `workspace_name`, `workspace_path`, `has_manifest`, `strategy`, `repos`, `repo_count`, `dirty_repos`, `has_dirty_repos`.

**Se nenhum nome de workspace fornecido:**

Primeiro execute `/listar-workspaces` para mostrar os workspaces disponíveis, depois pergunte:

Use AskUserQuestion:
- header: "Remover Workspace"
- question: "Qual workspace você quer remover?"
- requireAnswer: true

Execute init novamente com o nome fornecido.

## 2. Verificações de Segurança

**Se `has_dirty_repos` for true:**

```
Não é possível remover o workspace "$WORKSPACE_NAME" — os seguintes repositórios têm mudanças não commitadas:

  - repo1
  - repo2

Faça commit ou stash das mudanças nesses repositórios antes de remover o workspace:
  cd $WORKSPACE_PATH/repo1
  git stash   # ou git commit
```

Encerre. NÃO prossiga.

## 3. Confirmar Remoção

Use AskUserQuestion:
- header: "Confirmar Remoção"
- question: "Remover o workspace '$WORKSPACE_NAME' em $WORKSPACE_PATH? Isso excluirá todos os arquivos no diretório do workspace. Digite o nome do workspace para confirmar:"
- requireAnswer: true

**Se a resposta não corresponder a `$WORKSPACE_NAME`:** Encerre com "Remoção cancelada."

## 4. Limpar Worktrees

**Se a estratégia for `worktree`:**

Para cada repositório no workspace:

```bash
cd "$SOURCE_REPO_PATH"
git worktree remove "$WORKSPACE_PATH/$REPO_NAME" 2>&1 || true
```

Se `git worktree remove` falhar, avise mas continue:
```
Aviso: Não foi possível remover o worktree de $REPO_NAME — o repositório fonte pode ter sido movido ou excluído.
```

## 5. Excluir Diretório do Workspace

```bash
rm -rf "$WORKSPACE_PATH"
```

## 6. Relatório

```
Workspace "$WORKSPACE_NAME" removido.

  Caminho: $WORKSPACE_PATH (excluído)
  Repositórios: $REPO_COUNT worktrees limpos
```

</process>
