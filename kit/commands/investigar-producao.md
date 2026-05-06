---
name: investigar-producao
description: Lança Core Analysis Loop guiado em incidente real — agente incident-investigator usa MCP Supabase, mantém estado em .planning/investigations/, retoma entre resets de contexto.
argument-hint: "<sintoma em texto livre> [--id <investigation_id>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Lança o agente [`incident-investigator`](../agents/incident-investigator.md) para aplicar o [Core Analysis Loop](../skills/core-analysis-loop/SKILL.md) sobre um incidente. Estado iterativo de hipóteses fica em `.planning/investigations/<id>.md` — permite retomar entre resets de contexto (precedente: `/depurar`).

**Cria/Atualiza:**
- `.planning/investigations/<investigation_id>.md` — trilha de hipóteses validadas/refutadas

**Após:** root cause documentado + action items + estado salvo para próxima sessão.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — texto livre do sintoma + flags opcionais.

**Flags:**
- `--id <investigation_id>` — retoma investigação existente (pula criação de novo arquivo)
- `--time-window <Nh|Nd>` — janela de busca (default: 1h)

**Exemplos:**
```
/investigar-producao "checkout SLO burn rate = 8 às 14:32"
/investigar-producao --id incident-2026-05-06-1432-checkout-burn  # retomar
/investigar-producao "tenant acme reportou erros 5xx" --time-window 6h
```

**Pré-requisito (Full mode):** projeto Supabase configurado, `mcp__supabase__*` disponível.
</context>

<process>

## 1. Parsear argumentos

```bash
INV_ID=$(echo "$ARGUMENTS" | grep -oE -- '--id [^ ]+' | awk '{print $2}')
TIME_WINDOW=$(echo "$ARGUMENTS" | grep -oE -- '--time-window [^ ]+' | awk '{print $2}')
SYMPTOM=$(echo "$ARGUMENTS" | sed -E 's/--(id|time-window) [^ ]+//g' | xargs)

[ -z "$TIME_WINDOW" ] && TIME_WINDOW="1h"
```

## 2. Validar pré-requisitos

```bash
mkdir -p .planning/investigations

# PT-BR: se --id fornecido, validar arquivo existe
if [ -n "$INV_ID" ]; then
  INV_FILE=".planning/investigations/${INV_ID}.md"
  if [ ! -f "$INV_FILE" ]; then
    echo "Investigation $INV_ID não existe. Liste com: ls .planning/investigations/"
    exit 1
  fi
  echo "Retomando investigação: $INV_ID"
fi

# PT-BR: se SYMPTOM vazio + sem --id → erro
if [ -z "$SYMPTOM" ] && [ -z "$INV_ID" ]; then
  echo "Erro: forneça sintoma OU --id <investigation_id>"
  echo "Exemplos:"
  echo "  /investigar-producao \"checkout SLO burn rate = 8\""
  echo "  /investigar-producao --id incident-2026-05-06-1432-foo"
  exit 1
fi
```

## 3. Detectar `supabase/config.toml`

```bash
PROJECT_ID=""
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

## 4. Listar investigações em aberto (UX)

Antes de lançar agente, mostrar contexto de investigações ativas:

```bash
ls -t .planning/investigations/*.md 2>/dev/null | head -5 | while read f; do
  ID=$(basename "$f" .md)
  STARTED=$(grep '**Started:**' "$f" | head -1 | sed 's/.*Started:\*\* //')
  STATUS=$(grep -E '^## (Root Cause|Status:)' "$f" | head -1)
  printf "  %s — %s — %s\n" "$ID" "$STARTED" "$STATUS"
done
```

## 5. Dispatch para `incident-investigator`

```text
Task(
  subagent_type="incident-investigator",
  prompt="
${SYMPTOM:-(retomando $INV_ID)}

${INV_ID:+investigation_id: $INV_ID}
${PROJECT_ID:+project_id: $PROJECT_ID}
time_window: ${TIME_WINDOW}

Aplicar Core Analysis Loop até root cause OU lacuna intransponível.
Salvar estado iterativo em .planning/investigations/{id}.md.
Documentar todas as hipóteses (validated/refuted/inconclusive) com query + resultado citado.
"
)
```

## 6. Após retorno do agente

Apresentar resumo curto + caminho do arquivo de estado:

```
═══════════════════════════════════════════════════════════
 framework ► INVESTIGAR-PRODUCAO ▸ ${INV_ID}
═══════════════════════════════════════════════════════════

[output do agente — ver agente incident-investigator Step 7]

## Estado salvo
.planning/investigations/${INV_ID}.md

## Próximos passos
- Action items listados no Root Cause acima
- Para abrir loop separado (ex.: "por que tenant acelerou?"):
  /investigar-producao "<novo sintoma>"
- Para retomar mais tarde:
  /investigar-producao --id ${INV_ID}
```

## 7. Pause AskUserQuestion (opcional)

Se agente reportou status `INCONCLUSIVE` ou `gaps_found`, perguntar via AskUserQuestion:

- header: "Próximo?"
- question: "Investigation incompleta. O que fazer?"
- options:
  - "Continuar com hipótese específica" — pede texto livre da hipótese
  - "Pausar — retomar depois" — sai mantendo state
  - "Fechar como inconclusiva" — marca arquivo como `## Status: INCONCLUSIVE` e sai

</process>

<success_criteria>
- [ ] Sintoma + investigation_id (novo ou existente) parseados corretamente
- [ ] Arquivo `.planning/investigations/<id>.md` criado/atualizado
- [ ] `mcp__supabase__*` invocados em ≥ 1 hipótese (Full mode); ou modo offline declarado
- [ ] Cada hipótese documentada com Query + Resultado citado
- [ ] Root cause tem 4 dimensões (WHO/WHERE/WHEN/WHAT) OU status INCONCLUSIVE explícito
- [ ] Action items concretos listados
- [ ] Estado retomável: `/investigar-producao --id <id>` recarrega trilha
</success_criteria>
