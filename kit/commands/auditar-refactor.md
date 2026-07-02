---
name: auditar-refactor
description: Invoca refactor-safety-auditor — gate canônico antes de qualquer refactor. Coleta evidências (linhas, contrato externo, coverage, mutation) e retorna veredito GO/BLOCK/WARN/GO-OVERRIDE.
argument-hint: "<target_file> [--change-kind refactor|sprout|safe-extract|override] [--mode blocking|consultive] [--ticket REQ-N] [--reason \"...\"]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Auditar arquivo alvo de refactor ANTES da execução para decidir se safety net (characterization tests) é adequado. Invoca o agente [`refactor-safety-auditor`](../agents/refactor-safety-auditor.md) que aplica a skill [`pre-refactor-characterization`](../skills/pre-refactor-characterization/SKILL.md) — 3 critérios de risco canônicos (tamanho > 500 linhas, contrato externo, cobertura < 60%) + matriz de decisão.

**Cria/Atualiza:**
- `.planning/REFACTOR-SAFETY.md` — relatório com evidências, veredito, caminhos recomendados, audit trail

**Após:** o user tem decisão **objetiva** (não gut-feeling) sobre se refactor pode prosseguir. Se BLOCK, oferece 4 caminhos concretos. Se GO-OVERRIDE, registra ticket + reason para débito técnico.
</objective>

<context>
**Argumentos:**
- `<target_file>` — caminho do arquivo a auditar — OBRIGATÓRIO
- `--change-kind <kind>` — tipo da mudança (default: `refactor`):
  - `refactor` — mudança comportamental (gate roda completo)
  - `sprout` — adiciona via sprout method/class (legado intocado, gate libera com 100% no novo)
  - `safe-extract` — refactor mecânico (rename, IDE-extract bloco contíguo, sem mudar control flow)
  - `override` — bypass com justificativa (requer --ticket + --reason)
- `--mode blocking|consultive` — força modo do gate (default: lido de `.planning/config.json`)
- `--ticket REQ-N` — ticket linkado (obrigatório com --change-kind=override)
- `--reason "<texto>"` — justificativa (obrigatória com --change-kind=override)
- `--output PATH` — caminho do output (default: `.planning/REFACTOR-SAFETY.md`)

**Exemplos:**
```
/auditar-refactor src/orders/handler.ts                                  # default refactor
/auditar-refactor src/orders/handler.ts --change-kind sprout             # libera (sprout)
/auditar-refactor src/orders/handler.ts --change-kind safe-extract       # libera (mecânico)
/auditar-refactor src/orders/handler.ts \
  --change-kind override --ticket REQ-2026-Q2-1234 \
  --reason "hot fix de SEV1, char será adicionado em REQ-2026-Q2-1235"   # bypass com audit trail
/auditar-refactor src/orders/handler.ts --mode consultive                # warning em vez de block
```

**Fluxo típico:**
1. `/discutir-fase` detecta refactor intent → automaticamente invoca este comando
2. Veredito BLOCK → user escolhe um dos 4 caminhos (caracterizar, sprout, safe-extract, override)
3. Aplicar caminho + re-rodar este comando até veredito GO
4. Refactor executado com confiança

**Quando invocar manualmente:**
- Antes de planejar fase de refactor
- Antes de PR de refactor de arquivo grande
- Periodicamente em milestones para identificar gaps de coverage
- Como parte de `/auditar-marco` quando `workflow.audit_milestone_legacy_refactor=true`
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET_FILE=$(echo "$ARGUMENTS" | awk '{print $1}')
CHANGE_KIND=$(echo "$ARGUMENTS" | grep -oE -- '--change-kind [^ ]+' | awk '{print $2}')
MODE=$(echo "$ARGUMENTS" | grep -oE -- '--mode [^ ]+' | awk '{print $2}')
TICKET=$(echo "$ARGUMENTS" | grep -oE -- '--ticket [^ ]+' | awk '{print $2}')
REASON=$(echo "$ARGUMENTS" | grep -oE -- '--reason "[^"]+"' | sed 's/--reason "\(.*\)"/\1/')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$CHANGE_KIND" ] && CHANGE_KIND="refactor"
[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/REFACTOR-SAFETY.md"

if [ -z "$TARGET_FILE" ]; then
  echo "ERROR: target_file é obrigatório."
  echo "Uso: /auditar-refactor <target_file> [opções]"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: arquivo não encontrado: $TARGET_FILE"
  exit 1
fi

# PT-BR: validar override → exige ticket + reason
if [ "$CHANGE_KIND" = "override" ]; then
  if [ -z "$TICKET" ] || [ -z "$REASON" ]; then
    echo "ERROR: --change-kind=override requer --ticket REQ-N E --reason \"<texto>\"."
    echo "Sem audit trail, override é proibido."
    exit 1
  fi
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Detectar mode default via config + omm

```bash
# PT-BR: ler config para mode default
CONFIG_MODE=""
if [ -f ".planning/config.json" ] && command -v jq >/dev/null; then
  GATE_BLOCKING=$(jq -r '.workflow.legacy_refactor_gate_blocking // empty' .planning/config.json)
  if [ "$GATE_BLOCKING" = "true" ]; then
    CONFIG_MODE="blocking"
  elif [ "$GATE_BLOCKING" = "false" ]; then
    CONFIG_MODE="consultive"
  fi
fi

# PT-BR: integração com omm-auditor — Capacidade 1 (Resilience) calibra mode
if [ -z "$MODE" ] && [ -z "$CONFIG_MODE" ]; then
  if [ -f ".planning/OMM-REPORT.md" ]; then
    OMM_RESILIENCE=$(grep -oE 'Capacidade 1.*Resilience.*[0-9]/5' .planning/OMM-REPORT.md | grep -oE '[0-9]/5' | head -1 | sed 's|/5||')
    if [ -n "$OMM_RESILIENCE" ] && [ "$OMM_RESILIENCE" -ge 3 ]; then
      MODE="blocking"
    else
      MODE="consultive"
    fi
  fi
fi

[ -z "$MODE" ] && MODE="${CONFIG_MODE:-blocking}"
```

## 3. Dispatch para `refactor-safety-auditor`

```text
Task(
  subagent_type="refactor-safety-auditor",
  prompt="
target_file: ${TARGET_FILE}
change_kind: ${CHANGE_KIND}
output_path: ${OUTPUT_PATH}
mode: ${MODE}
${TICKET:+ticket: ${TICKET}}
${REASON:+reason: ${REASON}}

Aplicar skill pre-refactor-characterization. Etapas:
1. Preflight: detectar linguagem, validar input
2. Coletar evidências:
   - line count + heurística de aninhamento
   - external contract (path patterns, content markers, cross-package refs)
   - coverage atual (line coverage como proxy)
   - characterization tests existentes
   - mutation kill score (se disponível)
3. Aplicar matriz de decisão (3 critérios canônicos)
4. Determinar caminho recomendado (caracterizar/sprout/safe-extract/override)
5. Escrever REFACTOR-SAFETY.md com evidências, veredito, paths, audit trail
6. Output curto para caller (veredito + custo + próximos passos)
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-REFACTOR ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do refactor-safety-auditor]

## Decision matrix referência

| Veredito | Significado | Próxima ação |
|---|---|---|
| **GO** | Safety net adequado | Refactor pode prosseguir |
| **GO-OVERRIDE** | Bypass com audit trail | Refactor pode prosseguir, débito documentado em ticket |
| **WARN** | Risco médio | Considere `/caracterizar --gap-fill` antes; ou prosseguir + monitor |
| **BLOCK** | Risco alto sem safety net | Escolha um dos 4 caminhos abaixo |

## Caminhos quando BLOCK (em ordem de preferência)

1. **Caracterizar primeiro** (recomendado para refactor real)
   ```
   /caracterizar <file>
   ```
   Custo: 8-16h. Cobertura behavioral ≥ 70%. Gate retorna GO após.

2. **Sprout/Wrap** (não toca legado, ADICIONA comportamento)
   ```
   /refactor-seguro --mode=sprout <file>
   ```
   Custo: 0.5-4h. Legado intocado, novo testado isolado.

3. **Safe extraction** (mecânico — rename, IDE-extract)
   ```
   /refactor-seguro --mode=safe-extract <file>
   ```
   Custo: 1-2h. Apenas refactor sem mudança comportamental.

4. **Override** (último recurso, audit trail)
   ```
   /refactor-seguro --mode=override --ticket REQ-N --reason "<texto>" <file>
   ```
   Custo: 0h refactor + custo do débito. Aprovação humana obrigatória.

## Cross-suite

- **/instrumentar-fase** (v1.9) — durante refactor com BLOCK→GO via override, instrumentar para detecção precoce de regressão via golden signals
- **/burn-rate-status** (v1.9) — refactor pode regredir SLO; monitor budget pós-deploy
- **/prr** (v1.10) — Production Readiness Review Axe 5 (Change Management) consume veredito deste gate
- **/postmortem** (v1.10) — postmortems de regression em refactor sem char referenciam essa auditoria como lesson learned
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target_file obrigatório, --change-kind=override exige ticket + reason)
- [ ] Mode resolvido: argument explícito > config.json > omm-auditor (Capacidade 1) > default blocking
- [ ] `refactor-safety-auditor` invocado via `Task(subagent_type=...)` com prompt completo (6 etapas)
- [ ] `.planning/REFACTOR-SAFETY.md` criado pelo agent
- [ ] Output forwarded transparentemente
- [ ] Decision matrix exibida para referência
- [ ] 4 caminhos oferecidos quando BLOCK (com comandos prontos para copy-paste)
- [ ] Cross-references com Suíte Observabilidade + SRE
</success_criteria>
