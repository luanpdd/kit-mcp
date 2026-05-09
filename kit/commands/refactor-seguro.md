---
name: refactor-seguro
description: Orquestrador de refactor seguro — chain canônico encontrar-seams → caracterizar → auditar-refactor → executar. Suporta modos --mode=full|sprout|safe-extract|override. Substitui edit-and-pray por cover-and-modify.
argument-hint: "<target_file> [--mode full|sprout|safe-extract|override] [--ticket REQ-N] [--reason \"...\"] [--skip-seams] [--skip-characterize]"
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
Orquestrar fluxo canônico de refactor seguro em código legado: (1) identificar seams + quebrar deps; (2) caracterizar comportamento; (3) auditar safety net; (4) executar refactor com cover-and-modify. Substitui o pattern edit-and-pray (cap 1 Feathers) por cover-and-modify, baseado em characterization tests como oracle.

**Chain padrão (`--mode=full`):**

```
seam-finder → legacy-characterizer → refactor-safety-auditor → executor
   (se necessário)    (sempre)              (gate)               (refactor real)
```

**Modos alternativos** (atalhos quando mudança não justifica chain completo):
- `--mode=sprout` — usa `legacy-sprout-wrap-techniques`; legado intocado, comportamento adicionado em sprout testado isoladamente
- `--mode=safe-extract` — refactor mecânico (rename, IDE-extract bloco contíguo); checklist signed-off + sem characterization
- `--mode=override` — bypass com audit trail (--ticket + --reason obrigatórios)

**Cria/Atualiza:**
- Em modo full: `.planning/SEAM-ANALYSIS.md`, `tests/characterization/<file_stem>/`, `.planning/REFACTOR-SAFETY.md`
- Em modo sprout: novo módulo + tests
- Em modo safe-extract: refactor commit + checklist em `.planning/SAFE-EXTRACT-<file>.md`
- Em modo override: `.planning/REFACTOR-SAFETY.md` com audit trail

**Após:** o user terminou refactor com confiança proporcional ao nível de safety net adotado.
</objective>

<context>
**Argumentos:**
- `<target_file>` — caminho do arquivo a refatorar — OBRIGATÓRIO
- `--mode <full|sprout|safe-extract|override>` — modo do orquestrador (default: `full`)
- `--ticket REQ-N` — ticket linkado (obrigatório com `--mode=override`)
- `--reason "<texto>"` — justificativa (obrigatória com `--mode=override`)
- `--skip-seams` — pular seam-finder (assume deps já controláveis)
- `--skip-characterize` — pular caracterizar (assume safety net já existe)
- `--symbol <name>` — escopo limitado a símbolo específico
- `--feature-description "<texto>"` — em mode=sprout, descreve feature a adicionar

**Modos detalhados:**

```
--mode=full (default)
=====================
1. /encontrar-seams <file>            (se necessário, deps externas presentes)
2. Aplicar técnicas de break-deps     (commits 1-N, manual ou via executor)
3. /caracterizar <file>                (gera safety net)
4. /auditar-refactor <file>           (gate retorna GO)
5. Refactor real                      (cover-and-modify, suite verde a cada commit)
6. Re-rodar suite final                (regressão = 0)

--mode=sprout
=============
1. AskUserQuestion para feature description
2. Aplicar legacy-sprout-wrap-techniques
3. Gerar sprout method/class testável
4. Conectar ao legado em 1-2 linhas
5. Tests do sprout (100% cobertura no novo)
6. PR criado com TODO de débito técnico (legado ainda untested)

--mode=safe-extract
====================
1. Validar checklist canônico:
   - Bloco a extrair é CONTÍGUO?
   - Sem control flow saindo do meio (return/throw/break)?
   - Variáveis lidas/escritas mapeadas?
   - Sem mover lógica entre escopos?
2. Aplicar refactor IDE-assisted
3. Compilação verde + smoke run
4. PR com SAFE-EXTRACT-<file>.md como artefato

--mode=override
================
1. Validar --ticket E --reason
2. Auditoria do refactor-safety-auditor com flag override
3. Audit trail registrado em REFACTOR-SAFETY.md
4. Refactor pode prosseguir SEM characterization
5. Débito técnico documentado no ticket
```

**Exemplos:**
```
/refactor-seguro src/orders/handler.ts                                # full chain (recomendado)
/refactor-seguro src/orders/handler.ts --mode=sprout                  # adicionar feature sem tocar legado
/refactor-seguro src/orders/handler.ts --mode=safe-extract            # rename/extract mecânico
/refactor-seguro src/orders/handler.ts --mode=override \
  --ticket REQ-2026-Q2-1234 --reason "hot fix SEV1, char em REQ-...1235"
/refactor-seguro src/orders/handler.ts --skip-seams                   # deps já testáveis
/refactor-seguro src/orders/handler.ts --symbol processOrder          # método específico
```

**Quando este comando é o caminho certo:**
- Você vai modificar arquivo > 200 linhas com cobertura < 60%
- Webhook/API/Edge Function precisa refactor (contrato externo)
- Equipe quer disciplina cover-and-modify em vez de edit-and-pray
- `/discutir-fase` ou `/planejar-fase` detectaram refactor intent

**Quando NÃO é o caminho:**
- Bug fix → use TDD direto (escrever test do comportamento correto, depois fix)
- Feature nova em código novo → use `/discutir-fase` + `/planejar-fase` normais
- Arquivo trivial → refactor inline sem ceremonial
</context>

<process>

## 1. Parsear argumentos + validações

```bash
TARGET_FILE=$(echo "$ARGUMENTS" | awk '{print $1}')
MODE=$(echo "$ARGUMENTS" | grep -oE -- '--mode[= ][^ ]+' | sed 's/--mode[= ]//')
TICKET=$(echo "$ARGUMENTS" | grep -oE -- '--ticket [^ ]+' | awk '{print $2}')
REASON=$(echo "$ARGUMENTS" | grep -oE -- '--reason "[^"]+"' | sed 's/--reason "\(.*\)"/\1/')
SYMBOL=$(echo "$ARGUMENTS" | grep -oE -- '--symbol [^ ]+' | awk '{print $2}')
FEATURE_DESC=$(echo "$ARGUMENTS" | grep -oE -- '--feature-description "[^"]+"' | sed 's/--feature-description "\(.*\)"/\1/')
SKIP_SEAMS=false
SKIP_CHAR=false

echo "$ARGUMENTS" | grep -qE -- '--skip-seams'        && SKIP_SEAMS=true
echo "$ARGUMENTS" | grep -qE -- '--skip-characterize' && SKIP_CHAR=true

[ -z "$MODE" ] && MODE="full"

if [ -z "$TARGET_FILE" ]; then
  echo "ERROR: target_file é obrigatório."
  echo "Uso: /refactor-seguro <target_file> [opções]"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: arquivo não encontrado: $TARGET_FILE"
  exit 1
fi

# PT-BR: validações por mode
case "$MODE" in
  full|sprout|safe-extract|override) ;;
  *)
    echo "ERROR: --mode inválido: $MODE"
    echo "Valores válidos: full, sprout, safe-extract, override"
    exit 1
    ;;
esac

if [ "$MODE" = "override" ]; then
  if [ -z "$TICKET" ] || [ -z "$REASON" ]; then
    echo "ERROR: --mode=override requer --ticket REQ-N E --reason \"<texto>\"."
    exit 1
  fi
fi
```

## 2. Roteamento por mode

### Mode=full (default chain)

```text
Step 1 — Seam analysis (skip se --skip-seams)
  /encontrar-seams ${TARGET_FILE} ${SYMBOL:+--symbol $SYMBOL}
  → produz .planning/SEAM-ANALYSIS.md
  → user aplica técnicas (commits 1-N)

Step 2 — Verificar suite verde após break-deps
  Run test suite, abort se vermelho

Step 3 — Characterization (skip se --skip-characterize)
  /caracterizar ${TARGET_FILE} ${SYMBOL:+--symbol $SYMBOL}
  → produz tests/characterization/<file_stem>/
  → user revisa snapshots manualmente
  → user commita como `chore: characterize <file_stem>`

Step 4 — Audit do safety net
  /auditar-refactor ${TARGET_FILE} --change-kind=refactor
  → produz .planning/REFACTOR-SAFETY.md com veredito GO/WARN/BLOCK
  → SE BLOCK ainda → loop de volta para step 3 (com --gap-fill)
  → SE GO → prossegue

Step 5 — Refactor real
  Delegar para executor OR prompt user para refactor manual
  Após cada commit: rodar suite (verde)
  Após cada commit: characterization tests (verdes — comportamento preservado)

Step 6 — Verificação final
  Suite verde
  Characterization VERDE (regressão = 0)
  Mutation kill ≥ 70% (validar safety net)
  PR pode ser aberto
```

### Mode=sprout

```text
Step 1 — Coletar feature description
  Se $FEATURE_DESC vazio → AskUserQuestion:
    "Descreva a feature a ser adicionada (será encapsulada em sprout):"

Step 2 — Aplicar legacy-sprout-wrap-techniques
  Decision: sprout method vs sprout class vs wrap method vs wrap class
    - feature ≤ 30 linhas, 1 responsabilidade → sprout method
    - feature > 30 linhas OR multi-responsibility → sprout class
    - feature transforma input/output do legado inteiro → wrap method
    - feature atravessa N métodos da classe → wrap class

Step 3 — Gerar sprout
  Criar arquivo novo (sprout module) com lógica testável
  DI explícita para qualquer dep

Step 4 — Conectar ao legado em 1-2 linhas
  Inserir chamada ao sprout no legado
  Comment canônico: [legacy-debt #issue-N] sprout — <descrição>

Step 5 — Tests do sprout (100% cobertura)
  Escrever 5+ tests cobrindo grupos de equivalência
  Mutation testing no sprout (não no legado)

Step 6 — PR
  Diff esperado: arquivo novo + 1-2 linhas no legado
  README/CHANGELOG atualizado se aplicável
  Ticket de débito técnico criado se ainda não existia
```

### Mode=safe-extract

```text
Step 1 — Validar checklist canônico
  AskUserQuestion ou inline-confirm:
    □ Bloco a extrair é CONTÍGUO?           (não pode ter return/throw/break/continue saindo)
    □ Variáveis lidas dentro mas declaradas fora → parâmetros (in)?
    □ Variáveis escritas dentro mas usadas fora → return values (out)?
    □ NÃO move lógica entre escopos? (sem move method)
    □ NÃO muda control flow? (sem inverter ifs, sem early return novo)
    □ NÃO modifica sintaxe além de extract/rename?
  Qualquer NÃO → veto, voltar para mode=full

Step 2 — Identificar refactor IDE-assisted
  Se Cursor/VS Code/IntelliJ disponível → usar Refactor → Extract Function/Method/Variable
  Caso contrário → manual mas mecânico

Step 3 — Aplicar refactor (commits single-goal)
  Após cada commit: compilação verde
  Após cada commit: smoke run (qualquer comando que rodava antes)

Step 4 — Output checklist signed-off
  Escrever .planning/SAFE-EXTRACT-<file_stem>.md com:
    - Checklist canônico (todos os itens marcados)
    - Lista de commits (cada um single-goal)
    - Validação de comportamento (smoke verde)
```

### Mode=override

```text
Step 1 — Validar --ticket E --reason (já feito acima)

Step 2 — Auditar com flag override
  /auditar-refactor ${TARGET_FILE} \
    --change-kind=override \
    --ticket ${TICKET} \
    --reason "${REASON}"
  → audit trail registrado em REFACTOR-SAFETY.md

Step 3 — Refactor pode prosseguir
  Output:
    ⚠ MODE=OVERRIDE — refactor sem characterization
    Ticket: ${TICKET}
    Reason: ${REASON}
    Audit trail: .planning/REFACTOR-SAFETY.md
    
    Você aceitou o débito técnico. Refactor pode iniciar AGORA.
    Lembre-se: regressão silenciosa em prod é responsabilidade do owner do ticket.
```

## 3. Output canônico

```
═══════════════════════════════════════════════════════════
 framework ► REFACTOR-SEGURO ▸ ${TARGET_FILE} (mode: ${MODE})
═══════════════════════════════════════════════════════════

[output específico do mode escolhido]

## Sumário do que foi feito

| Step | Ação | Output |
|---|---|---|
| 1 | Seam analysis | .planning/SEAM-ANALYSIS.md |
| 2 | Characterization | tests/characterization/<file_stem>/ |
| 3 | Safety audit | .planning/REFACTOR-SAFETY.md (veredito: GO) |
| 4 | Refactor | <commits sequenciais> |
| 5 | Verificação final | suite verde, mutation kill ≥ 70% |

## Cross-suite

- **/instrumentar-fase** (v1.9) — adicionar instrumentação para detectar regressão precoce em prod via golden signals
- **/burn-rate-status** (v1.9) — monitor SLO budget pós-deploy do refactor
- **/prr** (v1.10) — PRR Axe 5 (Change Management) — invoque após refactor para validar production-readiness
- **/postmortem** (v1.10) — pronto para usar se algo regredir em prod (audit trail completo via REFACTOR-SAFETY.md)
- **/concluir-marco** — gate `legacy-refactor-safety` (opt-in) bloqueia close se há refactors com mode=override sem ticket close
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target_file obrigatório, --mode opcional com 4 valores)
- [ ] Validações por mode aplicadas (override → ticket + reason; safe-extract → checklist)
- [ ] Mode=full executa chain canônico (seam-finder → characterizer → safety-auditor → refactor)
- [ ] Mode=sprout aplica legacy-sprout-wrap-techniques + AskUserQuestion para feature
- [ ] Mode=safe-extract valida checklist + commits single-goal
- [ ] Mode=override registra audit trail completo via refactor-safety-auditor
- [ ] Steps 1-5 e cross-suite documentados no output
- [ ] Each sub-comando invocado via syntax canônica (`/encontrar-seams`, `/caracterizar`, `/auditar-refactor`)
</success_criteria>
