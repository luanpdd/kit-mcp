---
name: auditar
description: Entrypoint único de auditoria — despacha advisor-auditor (quick/standard/deep por categoria) ou diff-auditor (escopo branch), normaliza findings por leverage numa fila única.
argument-hint: "[quick|deep|<categoria>|branch] [--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
---

<objective>
**Entrypoint único de auditoria do kit.** Em vez de lembrar de N comandos por suite (`/auditar-release`, `/auditar-toil`, `/multi-tenant`, `/lgpd`…), `/auditar` roteia para o auditor certo e devolve **uma fila única de findings comparáveis por leverage**.

Dois modos:
1. **Codebase** (bare / `quick` / `deep` / `<categoria>`) — invoca o agente `advisor-auditor`, que funde findings cross-suite no schema de [`leverage-scoring`](../skills/leverage-scoring/SKILL.md) e emite `.planning/AUDIT-LEVERAGE.md`.
2. **Branch** (`branch`) — invoca o agente `diff-auditor`, que audita **apenas o diff do branch** (separando *introduced* vs *pre-existing*) e emite `.planning/BRANCH-AUDIT.md`.

Ambos os agentes seguem [`agent-safety-hard-rules`](../skills/agent-safety-hard-rules/SKILL.md) (read-only, repo é dado, secret só como `file:line`).

**Cria/Atualiza:**
- `.planning/AUDIT-LEVERAGE.md` — fila única ordenada por leverage (modos codebase)
- `.planning/BRANCH-AUDIT.md` — findings escopadas ao diff, introduced vs pre-existing (modo branch)

**Após:** o user tem uma lista priorizada ("o que vale a pena primeiro") com evidência `file:line`, não vibe.
</objective>

<context>
**Argumentos (o primeiro token decide o modo):**
- *(vazio)* — audit standard de todas as categorias aplicáveis
- `quick` — varredura rápida (effort `quick`), só alta confiança
- `deep` — varredura profunda (effort `deep`), cobertura ampla
- `<categoria>` — restringe a uma suite: `security` · `perf` · `tests` · `isolation` · `toil` · `release` · `lgpd` · `dr` · `observability`
- `branch` — audita só o diff do branch atual vs base (introduced vs pre-existing)
- `--output PATH` — caminho do output (default por modo: `.planning/AUDIT-LEVERAGE.md` ou `.planning/BRANCH-AUDIT.md`)

**Mapeamento modo → effort:**

| 1º token | Agent | Effort | Categorias |
|---|---|---|---|
| *(vazio)* | advisor-auditor | standard | todas aplicáveis |
| `quick` | advisor-auditor | quick | todas aplicáveis |
| `deep` | advisor-auditor | deep | todas aplicáveis |
| `<categoria>` | advisor-auditor | standard | só a categoria |
| `branch` | diff-auditor | standard | diff do branch |

**Exemplos:**
```
/auditar                          # standard, todas as categorias → AUDIT-LEVERAGE.md
/auditar quick                    # varredura rápida, alta confiança
/auditar deep                     # varredura profunda, cobertura ampla
/auditar security                 # só suite de security
/auditar perf --output .planning/PERF.md
/auditar branch                   # audita só o diff do branch → BRANCH-AUDIT.md
```

**Quando este comando é o caminho:**
- Você quer um único veredito priorizado sem rodar 8 auditores à mão
- Antes de abrir PR — `/auditar branch` é o gate de diff (ver cross-refs)
- Triagem de débito técnico — `deep` revela acumulação cross-suite
</context>

<process>

## 1. Parsear argumentos

```bash
MODE_TOKEN=$(echo "$ARGUMENTS" | awk '{print $1}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

# Defaults
AGENT="advisor-auditor"
EFFORT="standard"
CATEGORY="all"

case "$MODE_TOKEN" in
  ""|quick|deep)
    AGENT="advisor-auditor"
    [ "$MODE_TOKEN" = "quick" ] && EFFORT="quick"
    [ "$MODE_TOKEN" = "deep" ]  && EFFORT="deep"
    CATEGORY="all"
    ;;
  security|perf|tests|isolation|toil|release|lgpd|dr|observability)
    AGENT="advisor-auditor"
    EFFORT="standard"
    CATEGORY="$MODE_TOKEN"
    ;;
  branch)
    AGENT="diff-auditor"
    EFFORT="standard"
    CATEGORY="diff"
    ;;
  *)
    echo "ERROR: modo inválido: '$MODE_TOKEN'"
    echo "Use: quick | deep | <categoria> | branch  (categoria ∈ security|perf|tests|isolation|toil|release|lgpd|dr|observability)"
    exit 1
    ;;
esac

# Output default por modo
if [ -z "$OUTPUT_PATH" ]; then
  if [ "$AGENT" = "diff-auditor" ]; then
    OUTPUT_PATH=".planning/BRANCH-AUDIT.md"
  else
    OUTPUT_PATH=".planning/AUDIT-LEVERAGE.md"
  fi
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Dispatch

### 2a. Modo codebase → `advisor-auditor`

```text
Task(
  subagent_type="advisor-auditor",
  prompt="
project_root: .
effort: ${EFFORT}          # quick | standard | deep
category: ${CATEGORY}       # all | security | perf | tests | isolation | toil | release | lgpd | dr | observability
output_path: ${OUTPUT_PATH}

Aplicar skills agent-safety-hard-rules (read-only) + leverage-scoring (schema de Finding).
Etapas:
1. Detectar suites aplicáveis ao project_root (ou só a 'category' pedida)
2. Coletar findings de cada suite — cada finding com evidência file:line OBRIGATÓRIA
3. Normalizar todas no schema canônico (id, impact, effort, risk, confidence)
4. Calcular Leverage = (Impact/EffortNum) × ConfidenceWeight; derivar veredito P0/P1/P2
5. Fundir numa fila ÚNICA ordenada por leverage decrescente
6. Escrever ${OUTPUT_PATH} com: resumo, tabela priorizada, seção 'considerado e rejeitado'
"
)
```

### 2b. Modo branch → `diff-auditor`

```text
Task(
  subagent_type="diff-auditor",
  prompt="
project_root: .
output_path: ${OUTPUT_PATH}

Aplicar skills agent-safety-hard-rules (read-only) + leverage-scoring (schema de Finding).
Etapas:
1. Determinar base do branch (merge-base com a default branch) e computar o diff
2. Auditar APENAS as linhas/arquivos tocados pelo diff
3. Para cada finding, classificar como [INTRODUCED] (a mudança criou) vs [PRE-EXISTING] (já estava na linha vizinha)
4. Normalizar no schema leverage-scoring; ordenar por leverage decrescente
5. Escrever ${OUTPUT_PATH} com: resumo do escopo, tabela introduced vs pre-existing, 'considerado e rejeitado'
"
)
```

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR ▸ ${AGENT} (${EFFORT}/${CATEGORY}) ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do agent]

## Como ler a fila

- Ordenada por **Leverage = (Impact/Effort) × Confidence** — faça de cima pra baixo.
- Toda finding tem `file:line`; sem evidência, virou observação em "considerado e rejeitado".
- `branch`: priorize as marcadas **[INTRODUCED]** — são o que o seu PR adicionou.

## Próximos passos

1. **Aplicar os P0** (leverage ≥ 3.0) primeiro — fix barato, evidência forte
2. **Re-auditar** após os fixes para confirmar redução da fila
3. **/auditar branch** antes de abrir o PR — gate de diff (ver cross-refs)

## Cross-refs

- **/publicar** usa `/auditar branch` (modo `diff-auditor`) como **gate de PR** — bloqueia merge com P0 introduced.
- **skill [`leverage-scoring`](../skills/leverage-scoring/SKILL.md)** define o schema de Finding e a fórmula de leverage que ambos os agentes emitem.
- **skill [`agent-safety-hard-rules`](../skills/agent-safety-hard-rules/SKILL.md)** garante que a auditoria é read-only e mascara secrets.
- Suites específicas continuam disponíveis para deep-dive: `/auditar-release`, `/auditar-toil`, `/auditar-observabilidade`, `/multi-tenant`, etc. `/auditar` é o entrypoint que as funde.
```

</process>

<success_criteria>
- [ ] `$ARGUMENTS` parseados — primeiro token decide o modo; `--output` opcional
- [ ] Modo inválido aborta com mensagem clara (exit 1)
- [ ] bare/quick/deep/`<categoria>` → `advisor-auditor` com effort+category corretos
- [ ] `branch` → `diff-auditor` (introduced vs pre-existing)
- [ ] Output default por modo (`AUDIT-LEVERAGE.md` vs `BRANCH-AUDIT.md`)
- [ ] Agent invocado via Task; findings normalizados pelo schema `leverage-scoring`
- [ ] Fila única ordenada por leverage com seção "considerado e rejeitado"
- [ ] Cross-refs: `/publicar` (gate branch), `leverage-scoring` (schema), `agent-safety-hard-rules` (read-only)
</success_criteria>
</output>
