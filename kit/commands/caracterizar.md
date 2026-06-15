---
name: caracterizar
description: Invoca legacy-characterizer — gera characterization tests (cap 13 Feathers) que congelam o comportamento atual como golden snapshots antes de refatorar código legado sem testes.
argument-hint: "<target_file> [--symbol <name>] [--min-inputs N] [--gap-fill] [--fixtures-dir <path>] [--no-mutation]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Caracterizar arquivo de código legado (sem testes) gerando suite de characterization tests que congelam comportamento atual como oracle imutável durante refactor. Invoca o agente [`legacy-characterizer`](../agents/legacy-characterizer.md) que aplica a skill [`legacy-characterization-tests`](../skills/legacy-characterization-tests/SKILL.md) — 7 grupos canônicos de equivalência (empty/typical/boundary-low/boundary-up/recoverable-invalid/fatal-invalid/side-effect-heavy), golden snapshots com sanitização de PII, validação behavioral via mutation testing.

**Cria/Atualiza:**
- `tests/characterization/<file_stem>/` — suite de testes + snapshots + fakes auxiliares
- `tests/characterization/<file_stem>/README.md` — anotações de bugs preservados, fonte do oracle

**Após:** o user tem safety net que detecta regressão imediata em refactor. Gate `refactor-safety-auditor` muda de BLOCK → GO. Refactor pode prosseguir com `cover-and-modify` em vez de `edit-and-pray`.
</objective>

<context>
**Argumentos:**
- `<target_file>` — caminho do arquivo a caracterizar (relativo ao project root) — OBRIGATÓRIO
- `--symbol <name>` — caracterizar apenas símbolo específico (default: todos os exports)
- `--min-inputs N` — número mínimo de inputs (default: 8)
- `--gap-fill` — modo gap-fill: caracterizar APENAS o que falta para atingir 70% behavioral coverage (não recriar o que existe)
- `--fixtures-dir <path>` — diretório de payloads reais capturados (substitui inputs sintéticos por reais)
- `--no-mutation` — skip mutation testing após geração (default: roda se ferramenta detectada)
- `--output-dir <path>` — diretório base de output (default: `tests/characterization/<file_stem>/`)

**Exemplos:**
```
/caracterizar src/orders/handler.ts                        # caracterização completa, defaults
/caracterizar src/orders/handler.ts --symbol processOrder  # só um método
/caracterizar src/orders/handler.ts --gap-fill             # só preenche lacunas (re-rodar pós-refactor)
/caracterizar supabase/functions/webhook/index.ts \
  --fixtures-dir .planning/captured-payloads/webhook        # usa payloads reais
```

**Pré-requisitos:**
- Arquivo deve compilar/parsear no projeto atual
- Test framework instalado (Vitest, Jest, pytest, JUnit, go-test, etc.)
- (Recomendado) ferramenta de mutation testing instalada — Stryker (JS/TS), mutmut (Py), Pitest (Java)
- (Opcional) coverage tool com summary acessível (Istanbul/c8 para JS, coverage.py, JaCoCo)

**Quando este comando é o caminho certo:**
- Arquivo > 200 linhas com cobertura < 60% e mudança comportamental planejada
- Webhook/edge function/API pública sendo modificada
- Gate `refactor-safety-auditor` retornou BLOCK
- Refactor de monster method (cap 22) iniciando

**Quando NÃO é o caminho:**
- Arquivo trivial (< 50 linhas, sem branches significativas) — testes diretos sem ceremonial
- Mudança é apenas adicionar comportamento (sprout/wrap) — usar `/refactor-seguro --mode=sprout`
- Mudança é apenas mecânica (rename, extract-contiguous-block) — usar `/refactor-seguro --mode=safe-extract`
- Bug fix com TDD — TDD test do COMPORTAMENTO CORRETO é o caminho, não characterization
</context>

<process>

## 1. Parsear argumentos

```bash
# PT-BR: extrair primeiro positional como target_file
TARGET_FILE=$(echo "$ARGUMENTS" | awk '{print $1}')
SYMBOL=$(echo "$ARGUMENTS" | grep -oE -- '--symbol [^ ]+' | awk '{print $2}')
MIN_INPUTS=$(echo "$ARGUMENTS" | grep -oE -- '--min-inputs [0-9]+' | awk '{print $2}')
FIXTURES_DIR=$(echo "$ARGUMENTS" | grep -oE -- '--fixtures-dir [^ ]+' | awk '{print $2}')
OUTPUT_DIR=$(echo "$ARGUMENTS" | grep -oE -- '--output-dir [^ ]+' | awk '{print $2}')
GAP_FILL=false
NO_MUTATION=false

echo "$ARGUMENTS" | grep -qE -- '--gap-fill'     && GAP_FILL=true
echo "$ARGUMENTS" | grep -qE -- '--no-mutation'  && NO_MUTATION=true

[ -z "$MIN_INPUTS" ] && MIN_INPUTS=8

if [ -z "$TARGET_FILE" ]; then
  echo "ERROR: target_file é obrigatório."
  echo "Uso: /caracterizar <target_file> [opções]"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: arquivo não encontrado: $TARGET_FILE"
  exit 1
fi
```

## 2. Validar pré-requisitos

```bash
# PT-BR: detectar test framework + alertar se ausente
FRAMEWORK_OK=false
case "$TARGET_FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs)
    if [ -f "package.json" ]; then
      jq -re '.devDependencies | (.vitest // .jest)' package.json >/dev/null 2>&1 && FRAMEWORK_OK=true
    fi
    ;;
  *.py)
    pip show pytest >/dev/null 2>&1 && FRAMEWORK_OK=true
    ;;
  *.java)
    [ -f pom.xml ] || [ -f build.gradle ] && FRAMEWORK_OK=true
    ;;
  *.go)
    [ -f go.mod ] && FRAMEWORK_OK=true
    ;;
esac

if [ "$FRAMEWORK_OK" = false ]; then
  echo "⚠ Test framework não detectado. Agent pode gerar testes mas execução exigirá setup."
fi

# PT-BR: avisar se gap-fill mas não há characterization existente
if [ "$GAP_FILL" = true ]; then
  STEM=$(basename "$TARGET_FILE" | sed 's/\.[^.]*$//')
  if ! find tests test __tests__ -path "*characterization*$STEM*" 2>/dev/null | head -1 | grep -q .; then
    echo "⚠ --gap-fill solicitado mas nenhum characterization existente encontrado."
    echo "  Caindo em modo full-characterization."
    GAP_FILL=false
  fi
fi
```

## 3. Dispatch para `legacy-characterizer`

```text
Task(
  subagent_type="legacy-characterizer",
  prompt="
target_file: ${TARGET_FILE}
${SYMBOL:+target_symbol: ${SYMBOL}}
min_inputs: ${MIN_INPUTS}
${FIXTURES_DIR:+payload_fixtures_dir: ${FIXTURES_DIR}}
${OUTPUT_DIR:+output_dir: ${OUTPUT_DIR}}
mutation_check: $([ "$NO_MUTATION" = true ] && echo false || echo true)
mode: $([ "$GAP_FILL" = true ] && echo gap-fill || echo full)

Aplicar skill legacy-characterization-tests. Etapas canônicas:
1. Análise estática: identificar exports, parâmetros, deps de I/O, side effects, branches
2. Aplicar 7 grupos de equivalência canônicos (ou substituir por payloads reais se fixtures-dir fornecido)
3. Construir fakes mínimos para deps de I/O (DB, HTTP, FS, clock, random, UUID)
4. Executar código real com cada input + fakes; capturar return + sideEffects
5. Sanitizar (PII, secrets, UUIDs voláteis) antes de salvar como snapshot
6. Imprimir warning de revisão obrigatória dos snapshots
7. Validar cobertura behavioral via mutation testing (Stryker/mutmut/Pitest)
8. Output: tests/characterization/<file_stem>/ + README.md

Modo gap-fill (se aplicável): caracterizar APENAS branches/paths não cobertos pela suite existente; NÃO recriar tests existentes.
"
)
```

## 4. Pós-output: revisão obrigatória + integração com gate

Após o agent completar:

```
═══════════════════════════════════════════════════════════
 framework ► CARACTERIZAR ▸ tests/characterization/<file_stem>/
═══════════════════════════════════════════════════════════

[output do legacy-characterizer]

## ⚠ REVISÃO MANUAL OBRIGATÓRIA dos snapshots

Localização: tests/characterization/<file_stem>/__snapshots__/

Steps antes de commit:
  1. Ler cada snapshot linha por linha
  2. Marcar bugs conhecidos como comments inline (// BUG #X: ...)
  3. Verificar redaction de PII/secrets adicional
  4. Confirmar zero secrets/UUIDs locais expostos

Não commitar como `chore: characterize <file>` sem revisão.

## Próximos passos

1. **Revisar snapshots** — manualmente, todos os arquivos em __snapshots__/
2. **Rodar suite** — verificar todos verdes:
   - JS/TS: `npm test -- tests/characterization/<file_stem>`
   - Python: `pytest tests/characterization/<file_stem>`
   - Java: `mvn test -Dtest='Characterization*'`
3. **Commit** — `chore: characterize <file_stem>` (PR separado, NÃO misturar com refactor)
4. **Re-auditar gate** — `/auditar-refactor <file>` deve agora retornar GO
5. **Iniciar refactor** — `/refactor-seguro <file>` (ou diretamente PR de refactor)

## Cross-suite

- Para sprout/wrap em vez de full characterization: `/refactor-seguro --mode=sprout <file>`
- Para safe-extract em vez de behavioral change: `/refactor-seguro --mode=safe-extract <file>`
- Para SLO protection durante refactor: `/instrumentar-fase` (v1.9 — captura behavioral diff)
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target_file obrigatório, 7 flags opcionais)
- [ ] Pré-requisitos validados (framework de teste detectado; warning se não)
- [ ] `legacy-characterizer` invocado via `Task(subagent_type=...)` com prompt completo (8 etapas)
- [ ] `tests/characterization/<file_stem>/` criado com tests + snapshots + fakes + README
- [ ] Output forwarded transparentemente do agent
- [ ] Warning de revisão manual emitido (snapshots NÃO são committed automaticamente)
- [ ] Próximos passos sugeridos: revisar, rodar, commitar, re-auditar gate, iniciar refactor
- [ ] Modo gap-fill respeitado se solicitado e characterization existente encontrada
</success_criteria>
