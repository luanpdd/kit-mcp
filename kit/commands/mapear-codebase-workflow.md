---
name: mapear-codebase-workflow
description: Variante Dynamic Workflows do mapeamento de codebase — 4 mappers paralelos + synthesizer consolidando os 7 docs de .planning/codebase/. PoC para comparar contra /mapear-codebase.
argument-hint: "[opcional: área específica para mapear, ex: 'api' ou 'auth'] [--output-dir .planning/codebase]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Workflow
---

# mapear-codebase-workflow

> **PoC — Dynamic Workflows (Opus 4.8+).** Mesma intenção do [`/mapear-codebase`](./mapear-codebase.md) mas executa via `Workflow()`: 4 mappers paralelos (1 por área de foco do agent [`codebase-mapper`](../agents/codebase-mapper.md)) + synthesizer final que verifica os 7 documentos, recupera falha parcial via highlights e roda secret scan.

> Use este comando para **comparar** wall-clock e qualidade dos documentos contra a versão tradicional orquestrada em prosa.

<objective>
Roda o script `mapear-codebase.workflow.js` registrado em `.claude/workflows/`, que substitui o fanout hardcoded do command tradicional por um harness com schema por mapper, barrier explícito e consolidação verificada.

**Por que existe (PoC):**
- A versão tradicional orquestra 4 `Task()` em prosa — sem schema de retorno, sem recuperação de falha parcial, sem verificação consolidada.
- Esta versão tem 1 contexto por área de foco (mapper pequeno, foco preservado) + synthesizer que verifica os 7 docs no disco, reescreve docs degradados a partir dos highlights e roda o secret scan antes de qualquer commit.
- Mesmos templates canônicos do agent `codebase-mapper` — só a topologia muda.

**Output:** mesma pasta `.planning/codebase/` com os 7 documentos da versão tradicional (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS), permitindo `diff` direto.
</objective>

<context>
**Argumentos:**
- Área de foco opcional (idêntica ao command original) — orienta os mappers a priorizar um subsistema
- `--output-dir PATH` (default `.planning/codebase`)

**Pré-requisitos:**
- Claude Code Max / Team / Enterprise (Dynamic Workflows em research preview)
- `Workflow` tool habilitada na sessão
- Codebase não-trivial (≥ 5 arquivos de código — o workflow aborta sozinho abaixo disso)

**Quando usar PoC ao invés do original:**
- Codebase grande onde o mapeamento tradicional toma > 10min ou perde foco
- Você quer confirmação estruturada por mapper (schema) e verificação consolidada dos 7 docs
- Você está validando Dynamic Workflows no kit-mcp antes de migrar outros orquestradores
</context>

<process>

## 1. Parsear argumentos

```bash
OUTPUT_DIR=$(echo "$ARGUMENTS" | grep -oE -- '--output-dir [^ ]+' | awk '{print $2}')
FOCUS_AREA=$(echo "$ARGUMENTS" | sed 's/--output-dir [^ ]*//' | xargs)

[ -z "$OUTPUT_DIR" ] && OUTPUT_DIR=".planning/codebase"
# FOCUS_AREA vazio = mapear a codebase inteira
```

## 2. Disparar o Workflow

```text
Workflow(
  name: "mapear-codebase",
  args: {
    projectRoot: ".",
    focusArea: "${FOCUS_AREA}",   // omitir se vazio
    outputDir: "${OUTPUT_DIR}"
  }
)
```

Acompanhe o progresso ao vivo em `/workflows` (CLI/Desktop/VS Code). Cada área de foco aparece como um chip no phase `Fanout`; a consolidação roda em `Synthesize`.

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► MAPEAR-CODEBASE-WORKFLOW
═══════════════════════════════════════════════════════════

Status:        <GREEN|YELLOW|RED>
Mappers:       <mappersCompleted>/<mappersTotal>
Output:        ${OUTPUT_DIR}/

Documentos (7 esperados):
  STACK.md         <linhas> (<ok|degraded|missing>)
  INTEGRATIONS.md  <linhas> (<ok|degraded|missing>)
  ARCHITECTURE.md  <linhas> (<ok|degraded|missing>)
  STRUCTURE.md     <linhas> (<ok|degraded|missing>)
  CONVENTIONS.md   <linhas> (<ok|degraded|missing>)
  TESTING.md       <linhas> (<ok|degraded|missing>)
  CONCERNS.md      <linhas> (<ok|degraded|missing>)

Secret scan:   <limpo | ALERTA em [arquivos]>
```

**Se `secretsSuspected=true`:** NÃO commitar — revisar os arquivos listados e remover credenciais antes de qualquer git add (mesmo protocolo do fluxo tradicional).

**Se limpo:** commitar o mapa:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: mapear base de código existente" --files ${OUTPUT_DIR}/*.md
```

**Próximo passo:** tipicamente `/novo-projeto` (brownfield) ou `/planejar-fase` — mesmo roteamento do command tradicional.

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (área de foco opcional + `--output-dir` com default)
- [ ] `Workflow(name: "mapear-codebase", args: ...)` invocado
- [ ] 7 documentos em `${OUTPUT_DIR}/` com mesma estrutura de templates do command original
- [ ] Status por documento reportado (ok/degraded/missing) + status agregado GREEN/YELLOW/RED
- [ ] Secret scan reportado antes de oferecer commit
- [ ] Commit oferecido apenas com scan limpo; próximos passos apresentados
</success_criteria>
