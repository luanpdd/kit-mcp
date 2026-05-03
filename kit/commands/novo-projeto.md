---
name: novo-projeto
description: Inicializa um novo projeto com coleta profunda de contexto e PROJECT.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<context>
**Flags:**
- `--auto` — Modo automático. Após perguntas de configuração, executa pesquisa → requisitos → roadmap sem mais interação. Espera documento de ideia via referência @.
</context>

<objective>
Inicializar um novo projeto através do fluxo unificado: questionamento → pesquisa (opcional) → requisitos → roadmap.

**Cria:**
- `.planning/PROJECT.md` — contexto do projeto
- `.planning/config.json` — preferências de workflow
- `.planning/research/` — pesquisa de domínio (opcional)
- `.planning/REQUIREMENTS.md` — requisitos com escopo
- `.planning/ROADMAP.md` — estrutura de fases
- `.planning/STATE.md` — memória do projeto

**Após este comando:** Execute `/planejar-fase 1` para iniciar a execução.
</objective>

<execution_context>
@./.claude/framework/workflows/new-project.md
@./.claude/framework/references/questioning.md
@./.claude/framework/references/ui-brand.md
@./.claude/framework/templates/project.md
@./.claude/framework/templates/requirements.md
</execution_context>

<process>
Execute o workflow new-project de @./.claude/framework/workflows/new-project.md do início ao fim.
Preserve todos os checkpoints do workflow (validação, aprovações, commits, roteamento).
</process>