---
name: novo-marco
description: Inicia um novo ciclo de milestone — atualiza PROJECT.md e encaminha para requisitos
argument-hint: "[nome do milestone, ex: 'v1.1 Notificações']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Iniciar um novo milestone: questionamento → pesquisa (opcional) → requisitos → roadmap.

Equivalente brownfield do novo-projeto. O projeto existe, PROJECT.md tem histórico. Reúne "o que vem a seguir", atualiza PROJECT.md, então executa o ciclo requisitos → roadmap.

**Cria/Atualiza:**
- `.planning/PROJECT.md` — atualizado com novos objetivos do milestone
- `.planning/research/` — pesquisa de domínio (opcional, apenas para NOVOS recursos)
- `.planning/REQUIREMENTS.md` — requisitos com escopo para este milestone
- `.planning/ROADMAP.md` — estrutura de fases (continua numeração)
- `.planning/STATE.md` — reiniciado para novo milestone

**Após:** `/planejar-fase [N]` para iniciar a execução.
</objective>

<execution_context>
@./.claude/framework/workflows/new-milestone.md
@./.claude/framework/references/questioning.md
@./.claude/framework/references/ui-brand.md
@./.claude/framework/templates/project.md
@./.claude/framework/templates/requirements.md
</execution_context>

<context>
Nome do milestone: $ARGUMENTS (opcional - solicitará se não fornecido)

Arquivos de contexto do projeto e milestone são resolvidos dentro do workflow (`init new-milestone`) e delegados via blocos `<files_to_read>` onde subagentes são usados.
</context>

<process>
Execute o workflow new-milestone de @./.claude/framework/workflows/new-milestone.md do início ao fim.
Preserve todos os checkpoints do workflow (validação, questionamento, pesquisa, requisitos, aprovação do roadmap, commits).
</process>