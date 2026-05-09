---
name: storytelling
description: Invoca storytelling-analyst — IA gera mental model de codebase desconhecido (story 5 frases + inventário + naked CRC + responsibility hot spots + extract candidates). Modernização cap 16-17 Feathers para era IA.
argument-hint: "<target_dir_or_file> [--depth deep|shallow] [--include-tests] [--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
---

<objective>
Gerar **mental model de codebase desconhecido** via IA — story em 5 frases + inventário de classes/funções + naked CRC sketch + responsibility hot spots + extract candidates priorizados. Invoca o agente [`storytelling-analyst`](../agents/storytelling-analyst.md) que aplica a skill [`legacy-storytelling-naked-crc`](../skills/legacy-storytelling-naked-crc/SKILL.md) — caps 16-17 do livro Feathers + modernização IA primeiro draft.

**Cria/Atualiza:**
- `.planning/storytelling/<module-slug>.md` — relatório com story + inventário + CRC + hot spots

**Após:** o user reduz tempo de comprehension de codebase desconhecido de 4-8h (leitura cega manual) para 30 min (revisão informada de IA primeiro draft). Pré-requisito recomendado para `/encontrar-seams` ou `/refactor-seguro` em código novo.
</objective>

<context>
**Argumentos:**
- `<target_dir_or_file>` — diretório ou arquivo a analisar — OBRIGATÓRIO
- `--depth deep|shallow` — `shallow` = só story + inventário; `deep` = + CRC + hot spots + extract candidates (default: deep)
- `--include-tests` — incluir tests no scope (default: false; distinção comportamento prod vs harness)
- `--max-lines N` — limite de leitura (default: 1500; agent quebra em chunks se maior)
- `--output PATH` — caminho do output (default: `.planning/storytelling/<slug>.md`)

**Exemplos:**
```
/storytelling src/orders/                                       # diretório completo
/storytelling src/orders/OrderService.ts                        # arquivo específico
/storytelling src/orders/ --depth=shallow                       # rápido — só story + inventário
/storytelling src/orders/ --include-tests                       # incluir tests no scope
/storytelling supabase/functions/process-payments/              # Edge Function module
```

**Quando este comando é o caminho:**
- Você herdou módulo desconhecido (onboarding, transferência, post-acquisition)
- Vai modificar código que não conhece
- Pré-requisito de `/encontrar-seams` ou `/refactor-seguro`
- Precisa identificar candidates de extract class antes de planejar refactor
- Code review onde reviewer não conhece o módulo

**Quando NÃO é o caminho:**
- Codebase < 200 linhas — leitura direta é mais rápida
- Você já trabalhou no módulo nas últimas 2 semanas — mental model fresco
- Mudança trivial (typo, comment) — overhead > valor
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET=$(echo "$ARGUMENTS" | awk '{print $1}')
DEPTH=$(echo "$ARGUMENTS" | grep -oE -- '--depth[= ][^ ]+' | sed 's/--depth[= ]//')
MAX_LINES=$(echo "$ARGUMENTS" | grep -oE -- '--max-lines [0-9]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')
INCLUDE_TESTS=false
echo "$ARGUMENTS" | grep -qE -- '--include-tests' && INCLUDE_TESTS=true

[ -z "$DEPTH" ]     && DEPTH="deep"
[ -z "$MAX_LINES" ] && MAX_LINES=1500

if [ -z "$TARGET" ]; then
  echo "ERROR: target obrigatório (arquivo ou diretório)"
  exit 1
fi

if [ ! -e "$TARGET" ]; then
  echo "ERROR: target não encontrado: $TARGET"
  exit 1
fi

# auto-output path
if [ -z "$OUTPUT_PATH" ]; then
  SLUG=$(basename "$(realpath "$TARGET")" | sed 's/[^a-zA-Z0-9]/-/g')
  OUTPUT_PATH=".planning/storytelling/${SLUG}.md"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Detectar tamanho

```bash
if [ -f "$TARGET" ]; then
  TOTAL_LINES=$(wc -l < "$TARGET")
elif [ -d "$TARGET" ]; then
  TOTAL_LINES=$(find "$TARGET" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" -o -name "*.java" -o -name "*.go" \) ! -path "*node_modules*" -exec cat {} + 2>/dev/null | wc -l)
fi

if [ "$TOTAL_LINES" -gt "$MAX_LINES" ]; then
  echo "ℹ Target tem $TOTAL_LINES linhas (> $MAX_LINES). Agent vai chunkar análise."
fi
```

## 3. Dispatch para `storytelling-analyst`

```text
Task(
  subagent_type="storytelling-analyst",
  prompt="
target: ${TARGET}
depth: ${DEPTH}
output_path: ${OUTPUT_PATH}
max_lines: ${MAX_LINES}
include_tests: ${INCLUDE_TESTS}

Aplicar skill legacy-storytelling-naked-crc. Etapas:
1. Inventário inicial (listar files + classes/funções top-level)
2. Leitura + síntese — produzir story em ≤ 5 frases
3. Inventário canônico (tabela com responsabilidade primária + cluster)
4. (depth=deep) Naked CRC sketch ASCII
5. (depth=deep) Responsibility hot spots — classes fazendo > 3 coisas distintas
6. (depth=deep) Abstrações ausentes (sugestões)
7. (depth=deep) Extract class candidates priorizados
8. Gotchas / surpresas
9. Próximas ações sugeridas (effect sketch, /caracterizar, /refactor-seguro)
10. Output: .planning/storytelling/<slug>.md

PRINCÍPIO: você É a IA primeiro draft. Não busque perfeição — busque utilidade. Seja honesto sobre incertezas.
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► STORYTELLING ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do storytelling-analyst]

## ⚠ Validação obrigatória

Esta análise é PRIMEIRA PASSADA por IA. Erros possíveis:
- Relações alucinadas (LLM "viu" colaborador que não existe)
- Hot spots inflated (cluster coeso marcado como hot spot)
- Sugestões fora de escopo (extract candidate com 2-week effort marcado como 3h)

Cross-check OBRIGATÓRIO antes de basear decisões:
1. **Spot-check 3-5 funções aleatórias** contra inventário (existem? responsabilidade descrita está correta?)
2. **Confirmar colaboradores** existem (grep no codebase pelos nomes mencionados)
3. **Validar hot spots** contra leitura humana (são realmente "fazendo demais"?)
4. **Refinar story** se necessário; versão final em ${OUTPUT_PATH} é HUMANA, IA é primeiro draft

## Próximos passos

1. Validar story (5-15 min)
2. Se vai modificar: `/encontrar-seams ${TARGET}` (se arquivo) ou `/storytelling <sub-target>` (refinar para sub-módulo)
3. Se vai refactorar: `/refactor-seguro ${TARGET}` (chain canônico)
4. Se vai extrair: revisar extract candidates — `/legacy refactor` por candidate
5. Se há shotgun surgery em outros módulos relacionados: `/detectar-duplicacao src/`

## Cross-suite

- **/encontrar-seams** (v1.12) — story informa onde existem deps externas
- **/caracterizar** (v1.12) — story prioriza qual hot spot caracterizar primeiro
- **/refactor-seguro** (v1.12) — chain canônico após storytelling
- **/detectar-duplicacao** (v1.12) — shotgun across módulos relacionados
- **/mapear-codebase** (framework v1.7+) — comando análogo mais geral; storytelling complementa com narrativa
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target obrigatório)
- [ ] Tamanho detectado e chunking ativado se necessário
- [ ] `storytelling-analyst` invocado via Task com depth resolvido
- [ ] Output forwarded transparentemente
- [ ] Warning de validação manual obrigatória emitido
- [ ] Próximos passos sugerem encontrar-seams, caracterizar, refactor-seguro
- [ ] Cross-references com /detectar-duplicacao, /mapear-codebase, /caracterizar
</success_criteria>
