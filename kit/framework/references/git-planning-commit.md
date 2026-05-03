# Commit de Planejamento Git

Commite artefatos de planejamento usando o CLI tools, que verifica automaticamente a configuração `commit_docs` e o status do gitignore.

## Commit via CLI

Sempre use `tools.cjs commit` para arquivos `.planning/` — ele trata `commit_docs` e verificações do gitignore automaticamente:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs({scope}): {descrição}" --files .planning/STATE.md .planning/ROADMAP.md
```

O CLI retornará `skipped` (com motivo) se `commit_docs` for `false` ou `.planning/` estiver no gitignore. Não são necessárias verificações condicionais manuais.

## Emenda do Commit Anterior

Para incorporar alterações de arquivos `.planning/` no commit anterior:

```bash
node "./.claude/framework/bin/tools.cjs" commit "" --files .planning/codebase/*.md --amend
```

## Padrões de Mensagem de Commit

| Comando | Escopo | Exemplo |
|---------|--------|---------|
| planejar-fase | fase | `docs(phase-03): create authentication plans` |
| executar-fase | fase | `docs(phase-03): complete authentication phase` |
| novo-marco | marco | `docs: start milestone v1.1` |
| remover-fase | chore | `chore: remove phase 17 (dashboard)` |
| inserir-fase | fase | `docs: insert phase 16.1 (critical fix)` |
| adicionar-fase | fase | `docs: add phase 07 (settings page)` |

## Quando Pular

- `commit_docs: false` no config
- `.planning/` está no gitignore
- Nenhuma alteração a commitar (verifique com `git status --porcelain .planning/`)
