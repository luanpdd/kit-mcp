# Pré-flight de subagentes (consciência de custo)

> Protocolo canônico antes de qualquer fan-out de `Task()`. Referenciado pelos
> orquestradores (executor, planner) e implementers que disparam subagents.
> Existe porque um único comando do usuário pode disparar N subagents — e o
> usuário paga por N. A transparência tem que vir ANTES do gasto, não só no
> rodapé `/custo-sessao` depois.

## Quando aplicar

Antes de disparar `Task(subagent_type=…)` — sobretudo quando vai disparar **2 ou
mais** subagents, ou **1 subagent de `cost_tier: pesado`** (que pode encadear os
seus próprios subagents). Para um único subagent `leve`/`medio`, o pré-flight é
opcional.

## Como ler o modo (workflow.cost_awareness)

Resolva o modo da config do projeto (default `resumo` se ausente):

```bash
COST_AWARENESS=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.cost_awareness 2>/dev/null || echo "resumo")
```

- **silencioso** — não mostra nada; dispara direto (comportamento legado). O custo
  ainda aparece depois via o rodapé `/custo-sessao` do hook de atribuição.
- **resumo** (default) — mostra a lista de subagents + tier e **segue** sem pedir OK.
- **confirmar** — mostra a lista e **aguarda confirmação** do usuário antes de disparar.

## O que mostrar (resumo / confirmar)

Antes do fan-out, liste em uma tabela compacta:

| Subagent (`subagent_type`) | cost_tier | por quê |
|---|---|---|
| `<nome>` | leve\|medio\|pesado | o que ele entrega |

- O `cost_tier` está no frontmatter de cada agent (e na MCP tool `kit` action=list-agents).
- Some os tiers num sinal agregado: ex. "3 subagents — 1 pesado + 2 medio".
- Quando útil, materialize o tier em USD aproximado com a MCP tool **`cost-estimate`**
  (passa o brief que você mandaria ao subagent) e cite o range `[low, high]`.
- Em **confirmar**, termine com uma pergunta objetiva ("Disparar estes N subagents? [s/N]")
  e só prossiga com o "sim".

## Princípio

Pré-flight não é burocracia — é evitar que o usuário acione "1 agent" e pague por 10
sem saber. Em `resumo`/`confirmar`, o fan-out vira escolha consciente; em `silencioso`,
o comportamento é o de sempre. Nunca aborte por causa do pré-flight — ele informa, não bloqueia (exceto o "não" explícito no modo `confirmar`).
