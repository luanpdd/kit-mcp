---
name: novo-workspace
description: Cria um workspace isolado com cópias de repos e .planning/ independente
argument-hint: "--name <name> [--repos repo1,repo2] [--path /target] [--strategy worktree|clone] [--branch name] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<context>
**Flags:**
- `--name` (obrigatório) — Nome do workspace
- `--repos` — Caminhos ou nomes de repos separados por vírgula. Se omitido, seleção interativa dos repos git filhos no cwd
- `--path` — Diretório de destino. Padrão: `~/workspaces/<name>`
- `--strategy` — `worktree` (padrão, leve) ou `clone` (totalmente independente)
- `--branch` — Branch para fazer checkout. Padrão: `workspace/<name>`
- `--auto` — Pular perguntas interativas, usar padrões
</context>

<objective>
Criar um diretório de workspace físico contendo cópias dos repos git especificados (como worktrees ou clones) com um diretório `.planning/` independente para sessões framework isoladas.

**Casos de uso:**
- Orquestração multi-repo: trabalhar em um subconjunto de repos em paralelo com estado framework isolado
- Isolamento de feature branch: criar um worktree do repo atual com seu próprio `.planning/`

**Cria:**
- `<path>/WORKSPACE.md` — manifesto do workspace
- `<path>/.planning/` — diretório de planejamento independente
- `<path>/<repo>/` — git worktree ou clone para cada repo especificado

**Após este comando:** `cd` no workspace e execute `/novo-projeto` para inicializar o framework.
</objective>

<execution_context>
@./.claude/framework/workflows/new-workspace.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<process>
Execute o workflow new-workspace de @./.claude/framework/workflows/new-workspace.md do início ao fim.
Preserve todos os checkpoints do workflow (validação, aprovações, commits, roteamento).
</process>