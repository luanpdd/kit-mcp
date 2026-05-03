---
name: autonomo
description: Executa todas as fases restantes de forma autônoma — discutir→planejar→executar por fase
argument-hint: "[--from N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---
<objective>
Executa todas as fases restantes do milestone de forma autônoma. Para cada fase: discutir → planejar → executar. Pausa apenas para decisões do usuário (aceitação de área cinzenta, bloqueadores, solicitações de validação).

Usa descoberta de fases do ROADMAP.md e invocações Skill() flat para cada comando de fase. Após todas as fases concluírem: auditoria de milestone → concluir → limpeza.

**Cria/Atualiza:**
- `.planning/STATE.md` — atualizado após cada fase
- `.planning/ROADMAP.md` — progresso atualizado após cada fase
- Artefatos de fase — CONTEXT.md, PLANOs, SUMMARYs por fase

**Após:** O milestone está completo e limpo.
</objective>

<execution_context>
@./.claude/framework/workflows/autonomous.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Flag opcional: `--from N` — começar da fase N em vez da primeira fase incompleta.

Contexto do projeto, lista de fases e estado são resolvidos dentro do workflow usando comandos init (`tools.cjs init milestone-op`, `tools.cjs roadmap analyze`). Sem carregamento prévio de contexto necessário.
</context>

<process>
Execute o workflow autonomous de @./.claude/framework/workflows/autonomous.md do início ao fim.
Preserve todos os checkpoints do workflow (descoberta de fases, execução por fase, tratamento de bloqueadores, exibição de progresso).
</process>