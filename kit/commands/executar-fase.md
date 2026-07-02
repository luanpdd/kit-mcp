---
name: executar-fase
description: Executa todos os planos de uma fase com paralelização por ondas
argument-hint: "<phase-number> [--wave N] [--gaps-only] [--interactive] [modelo]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---
<objective>
Executa todos os planos de uma fase usando execução paralela por ondas.

O orquestrador se mantém enxuto: descobrir planos, analisar dependências, agrupar em ondas, invocar subagentes, coletar resultados. Cada subagente carrega o contexto completo de execute-plan e cuida do seu próprio plano.

Filtro de onda opcional:
- `--wave N` executa apenas a Onda `N` para controle de ritmo, gestão de cota ou lançamento em etapas
- verificação/conclusão da fase ainda ocorre apenas quando não há planos incompletos restantes após a onda selecionada terminar

Regra de tratamento de flags:
- As flags opcionais documentadas abaixo são comportamentos disponíveis, não comportamentos ativos implícitos
- Uma flag está ativa apenas quando seu token literal aparece em `$ARGUMENTS`
- Se uma flag documentada estiver ausente de `$ARGUMENTS`, trate-a como inativa

Orçamento de contexto: ~15% orquestrador, 100% fresco por subagente.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-phase.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Fase: $ARGUMENTS

**Flags opcionais disponíveis (somente documentação — não automaticamente ativas):**
- `--wave N` — Executar apenas a Onda `N` na fase. Use quando quiser controlar o ritmo da execução ou ficar dentro dos limites de uso.
- `--gaps-only` — Executar apenas planos de fechamento de lacunas (planos com `gap_closure: true` no frontmatter). Use após verify-work criar planos de correção.
- `--interactive` — Executar planos sequencialmente inline (sem subagentes) com checkpoints de usuário entre tarefas. Menor uso de tokens, estilo programação em par. Melhor para fases pequenas, correções de bugs e lacunas de verificação.
- `[modelo]` — token de modelo no fim (`opus|sonnet|haiku|inherit` ou id do runtime, ex.: `/executar-fase 3 --wave 1 haiku`). Força o modelo do executor só nesta execução — override de prioridade máxima sobre o perfil. Absorvido do `execute <plano> <modelo>` do `improve`.

**Flags ativas devem ser derivadas de `$ARGUMENTS`:**
- `--wave N` está ativa somente se o token literal `--wave` estiver presente em `$ARGUMENTS`
- `--gaps-only` está ativa somente se o token literal `--gaps-only` estiver presente em `$ARGUMENTS`
- `--interactive` está ativa somente se o token literal `--interactive` estiver presente em `$ARGUMENTS`
- Se nenhum desses tokens aparecer, executar o fluxo padrão de execução completa da fase sem filtragem específica de flag
- Não inferir que uma flag está ativa apenas porque está documentada neste prompt

Arquivos de contexto são resolvidos dentro do workflow via `tools init execute-phase` e blocos `<files_to_read>` por subagente.
</context>

<process>
Execute o workflow execute-phase de @./.claude/framework/workflows/execute-phase.md do início ao fim.
Preserve todos os checkpoints do workflow (execução de ondas, tratamento de checkpoints, verificação, atualizações de estado, roteamento).
</process>