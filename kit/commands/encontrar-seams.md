---
name: encontrar-seams
description: Invoca seam-finder — analisa código para identificar seams (object/link/preprocessing) e recomenda técnica do cap 25 Feathers para quebrar dependências bloqueantes. Pré-requisito quando deps externas impedem characterization.
argument-hint: "<target_file> [--symbol <name>] [--prefer object|link|preprocessing] [--output PATH]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Analisar código alvo para identificar **seams** (lugares onde se pode alterar comportamento sem editar lá) e recomendar **técnica do catálogo cap 25 Feathers** para quebrar dependências bloqueantes (DB real, HTTP, framework objects, singletons, clocks). Invoca o agente [`seam-finder`](../agents/seam-finder.md) que aplica a skill [`legacy-seams-and-test-harness`](../skills/legacy-seams-and-test-harness/SKILL.md) — decision tree por linguagem, prioridade pelo MENOR custo + MAIOR reversibilidade.

**Cria/Atualiza:**
- `.planning/SEAM-ANALYSIS.md` — relatório com deps bloqueantes, técnicas recomendadas, sequência canônica de commits

**Após:** o user tem plano mecânico para tornar código testável antes de invocar `/caracterizar`. Tipicamente 5-30 minutos por dep bloqueante; sequência de pequenos commits revertíveis.
</objective>

<context>
**Argumentos:**
- `<target_file>` — caminho do arquivo a analisar (relativo ao project root) — OBRIGATÓRIO
- `--symbol <name>` — analisar apenas símbolo específico (default: arquivo inteiro)
- `--prefer object|link|preprocessing` — preferência de tipo de seam (default: object)
- `--output PATH` — caminho do output (default: `.planning/SEAM-ANALYSIS.md`)

**Exemplos:**
```
/encontrar-seams src/orders/OrderService.ts                        # análise completa
/encontrar-seams src/orders/OrderService.ts --symbol charge        # método específico
/encontrar-seams src/legacy/Client.cpp --prefer link               # forçar link seam (C++ legado)
```

**Quando este comando é o caminho certo:**
- `/caracterizar` falhou porque deps externas impedem isolamento
- Construtor faz I/O direto (cria conexão DB no constructor)
- Usar singleton/global hardcoded no método a testar
- Framework type complexo (HttpServletRequest, Express.Request) bloqueando teste
- Código procedural (C, COBOL, Go) onde polimorfismo não está disponível

**Quando NÃO é o caminho:**
- Código já é testável (deps injetadas via DI) → usar `/caracterizar` direto
- Código é puro (sem I/O) → não precisa break-dep
- Mudança é safe-extraction (rename, IDE-extract) → usar `/refactor-seguro --mode=safe-extract`
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET_FILE=$(echo "$ARGUMENTS" | awk '{print $1}')
SYMBOL=$(echo "$ARGUMENTS" | grep -oE -- '--symbol [^ ]+' | awk '{print $2}')
PREFER=$(echo "$ARGUMENTS" | grep -oE -- '--prefer [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/SEAM-ANALYSIS.md"
[ -z "$PREFER" ]      && PREFER="object"

if [ -z "$TARGET_FILE" ]; then
  echo "ERROR: target_file é obrigatório."
  echo "Uso: /encontrar-seams <target_file> [opções]"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: arquivo não encontrado: $TARGET_FILE"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Dispatch para `seam-finder`

```text
Task(
  subagent_type="seam-finder",
  prompt="
target_file: ${TARGET_FILE}
${SYMBOL:+target_symbol: ${SYMBOL}}
output_path: ${OUTPUT_PATH}
prefer_technique: ${PREFER}

Aplicar skill legacy-seams-and-test-harness. Etapas:
1. Detectar linguagem + paradigma (OO vs procedural)
2. Mapear deps externas (network/DB/FS/clock/random/UUID/global/framework-type/construtor-caro)
3. Identificar tipos de seam disponíveis (object/link/preprocessing)
4. Aplicar decision tree do cap 25 escolhendo técnica de menor custo + maior reversibilidade
5. Gerar SEAM-ANALYSIS.md com:
   - tabela de deps bloqueantes
   - técnica recomendada por dep com custo + reversibilidade
   - exemplo ANTES/DEPOIS por técnica
   - sequência canônica de commits (mais seguro → mais arriscado)
6. Output curto para caller: lista de N deps + custo total estimado
"
)
```

## 3. Pós-output: integração com fluxo

```
═══════════════════════════════════════════════════════════
 framework ► ENCONTRAR-SEAMS ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do seam-finder]

## Próximos passos

1. **Aplicar técnicas** — seguir sequência canônica em ${OUTPUT_PATH}
   Cada commit é single-goal, mecânico, revertível
2. **Rodar suite após cada commit** — compilação verde + tests verdes
3. **/caracterizar <file>** — após break-deps complete, characterization fica viável
4. **/auditar-refactor <file>** — gate deve retornar GO ou WARN agora (não mais BLOCK)

## Cross-suite

- Em projetos Supabase com Edge Functions: `supabase-edge-fn-writer` (v1.8) já segue patterns testáveis
- Para skills de SOLID/DI: ver também `supabase-architect` (v1.8) — schema design considera testabilidade similarmente
- Para mudança em código que afeta SLOs: `/instrumentar-fase` (v1.9) durante refactor preserva visibility
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target_file obrigatório)
- [ ] `seam-finder` invocado via `Task(subagent_type=...)` com prompt completo (6 etapas)
- [ ] `.planning/SEAM-ANALYSIS.md` criado pelo agent com deps + técnicas + sequência de commits
- [ ] Output forwarded transparentemente do agent
- [ ] Próximos passos sugeridos: aplicar técnicas, rodar suite, /caracterizar, /auditar-refactor
- [ ] Cross-references com Suíte Supabase (v1.8) e Observabilidade (v1.9) onde aplicável
</success_criteria>
