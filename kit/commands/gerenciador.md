---
name: gerenciador
description: Central de comando interativa para gerenciar múltiplas fases em um terminal
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
Central de comando em terminal único para gerenciar um milestone. Mostra um painel de todas as fases com indicadores visuais de status, recomenda as próximas ações ideais e despacha trabalho — discussão roda inline, planejamento/execução roda como agentes em segundo plano.

Projetado para usuários avançados que querem paralelizar trabalho entre fases em um terminal: discutir uma fase enquanto outra planeja ou executa em segundo plano.

**Cria/Atualiza:**
- Nenhum arquivo criado diretamente — despacha para comandos do framework existentes via Skill() e agentes Task em segundo plano.
- Lê `.planning/STATE.md`, `.planning/ROADMAP.md`, diretórios de fase para status.

**Após:** Usuário sai quando terminar de gerenciar, ou todas as fases concluem e o ciclo de vida do milestone é sugerido.
</objective>

<execution_context>
@./.claude/framework/workflows/manager.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Sem argumentos necessários. Requer um milestone ativo com ROADMAP.md e STATE.md.

Contexto do projeto, lista de fases, dependências e recomendações são resolvidos dentro do workflow usando `tools.cjs init manager`. Sem carregamento prévio de contexto necessário.
</context>

<process>
Execute o workflow manager de @./.claude/framework/workflows/manager.md do início ao fim.
Manter o loop de atualização do painel até que o usuário saia ou todas as fases concluam.
</process>