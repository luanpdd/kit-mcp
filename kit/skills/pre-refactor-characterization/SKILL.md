---
name: pre-refactor-characterization
cost_tier: leve
description: Gate de safety para refactor — bloqueia ate characterization tests cobrirem ≥ 70% comportamental. Gatilho — arquivo > 500 linhas, contrato externo (webhook, Edge Functions) ou cobertura < 60%.
---

# Legacy — Pre-Refactor Characterization Gate

## Quando usar

Esta skill é o **gate de safety** que dispara antes de qualquer refactor de risco. Carrega automaticamente quando:

- User pede para "refatorar" / "extrair" / "limpar" / "reorganizar" arquivo
- Arquivo alvo tem > 500 linhas
- Arquivo alvo tem contrato externo (webhook handler, API pública, edge function consumida por terceiros, integração)
- Arquivo alvo tem cobertura de teste atual < 60%
- Plano de fase contém `task.kind = refactor` em arquivo legado
- User menciona "esse código não tem testes mas preciso mudar"

Trigger phrases canônicas:
- "refatorar [arquivo]", "extract method de", "quebrar essa classe"
- "reorganizar esse módulo", "limpar essa função grande"
- "preciso modificar [arquivo grande]", "split de [monolítico]"
- "esse webhook não tem testes mas vou refatorar"
- "pre-refactor", "characterization gate"

## Regras absolutas

- **Refactor de risco SEM characterization = veto.** Skill bloqueia até cobertura comportamental ≥ 70% ou justificativa explícita de exceção.
- **3 critérios de risco — qualquer 1 dispara gate:**
  1. Arquivo > 500 linhas
  2. Contrato externo (webhook, API pública, integração externa, edge function consumida por terceiros)
  3. Cobertura atual < 60% E mudança não é pure mechanical (rename/safe extraction sem mover lógica)
- **Safe extraction (rename, IDE-extracted contiguous block) é PERMITIDA sem characterization** — é mecânica, comportamento idêntico (cap 22). Só refactor com mudança comportamental requer characterization.
- **3 modos de exceção, todos rastreáveis:**
  - `--mode=sprout` — não refatora, adiciona via sprout/wrap (skill `legacy-sprout-wrap-techniques`); novo código tem 100% de cobertura, legado fica intocado
  - `--mode=safe-extract` — apenas refactor mecânico (rename, extract contiguous block via IDE); requer assinatura `safe-extraction-checklist` validada
  - `--mode=override --reason "..."` — bypass com justificativa textual + ticket linkado para débito; aprovação humana obrigatória, audit trail
- **Bypass via memory/preferences é proibido.** Gate é audit-trail; cada exceção fica no PR/commit, não em config silenciosa.
- **Gate é CONSULTIVO em projetos < 50% maturity OMM.** Mostra warning + recomendação, não bloqueia se workflow.legacy_refactor_gate_blocking = false. Default = blocking quando integração com `omm-auditor` mostra Capacidade 1 (Resilience) ≥ 3.

## Patterns canônicos

### Pattern 1: Decisão do gate

```text
ENTRADA: file_path + change_kind (refactor | sprout | bug-fix | feature)

SE change_kind != refactor → PASS (gate só roda em refactor)
SE change_kind == refactor →
  Coletar evidências:
    - line_count = wc -l <file>
    - has_external_contract = file matches /webhook|edge-function|public-api/ OR caller é fora do repo
    - current_coverage = parse coverage report
    - has_existing_characterization = check tests/characterization/<file>/

  Aplicar critérios:
    risco_alto = line_count > 500 OR has_external_contract
    risco_medio = line_count > 200 OR current_coverage < 60%

  SE risco_alto AND NOT has_existing_characterization →
    BLOCK: "characterization tests requeridos antes de refactor.
            Inicie via /caracterizar <file> ou aplique --mode=sprout."

  SE risco_medio AND current_coverage < 70% →
    WARN: "behavioral coverage baixa. Recomendado /caracterizar antes.
           Use --mode=safe-extract se mudança é mecânica."

  SE characterization existe E coverage ≥ 70% →
    PASS: "safety net adequado. Refactor pode prosseguir."
```

### Pattern 2: Coleta de evidências canônicas

```bash
# PT-BR: critérios determinísticos
FILE="$1"
LINES=$(wc -l < "$FILE" 2>/dev/null || echo 0)
EXTERNAL_CONTRACT=false

# heurística de contrato externo
if echo "$FILE" | grep -qE "(webhook|edge.?function|api/v[0-9]|public/|integration/)" ; then
  EXTERNAL_CONTRACT=true
fi

# verificar referências externas (consumido por outro repo via package import)
if grep -rn "from ['\"]\\.\\./.*$(basename $FILE .ts)" --include="*.ts" --include="*.js" "$(git rev-parse --show-toplevel)" >/dev/null 2>&1; then
  CROSS_PACKAGE_REF=true
fi

# tentar parser cobertura comum
COV_FILE_PCT=""
if [ -f "coverage/coverage-summary.json" ]; then
  COV_FILE_PCT=$(jq -r ".\"$(realpath $FILE)\".lines.pct // empty" coverage/coverage-summary.json)
fi

# verificar characterization tests existentes
HAS_CHAR=false
if [ -d "tests/characterization/$(dirname $FILE | sed 's|^src/||')" ] || \
   [ -d "test/characterization/$(dirname $FILE | sed 's|^src/||')" ]; then
  HAS_CHAR=true
fi
```

### Pattern 3: Workflow recomendado pós-bloqueio

Quando gate bloqueia, oferecer caminho concreto:

```text
═══════════════════════════════════════════════════════════
PRE-REFACTOR-CHARACTERIZATION · BLOCK
file: src/orders/handler.ts (724 lines, has external contract)
current coverage: 12% (line)
characterization status: ABSENT
═══════════════════════════════════════════════════════════

Refactor de arquivo grande com contrato externo SEM characterization
tests é "edit and pray" (cap 1 Feathers). Para prosseguir:

Caminho 1 — Caracterizar primeiro (recomendado para refactor real)
  /caracterizar src/orders/handler.ts
  └─ gera characterization tests cobrindo 5+ inputs por equiv group
  └─ leva 4-12h dependendo do tamanho
  └─ resultado: cobertura comportamental ≥ 70% → gate passa

Caminho 2 — Mudança via sprout (não toca legado)
  /refactor-seguro --mode=sprout src/orders/handler.ts
  └─ adiciona comportamento novo em sprout method/class testado
  └─ legado intocado → não há regressão possível
  └─ leva 30 min - 4h dependendo da feature

Caminho 3 — Apenas safe extraction (rename, extract contiguous block)
  /refactor-seguro --mode=safe-extract src/orders/handler.ts
  └─ apenas refactor mecânico (IDE-assisted)
  └─ proibido mover lógica entre escopos OR mudar control flow
  └─ requer checklist assinado

Caminho 4 — Override com justificativa (audit trail)
  /refactor-seguro --mode=override --reason "<texto>" --ticket REQ-N
  └─ requer aprovação humana + ticket linkado
  └─ débito técnico documentado
  └─ usado apenas em casos genuinamente excepcionais
```

### Pattern 4: Integração com fluxos do framework

| Workflow | Ponto de integração | Ação |
|---|---|---|
| `/discutir-fase` | discovery — questionário detecta refactor intent | Pergunta sobre arquivo alvo + sugere /caracterizar antes |
| `/planejar-fase` | gate de plano — `plan-checker` lê tasks | Bloqueia plano se task.kind=refactor + arquivo > 500 linhas + sem characterization linkada |
| `/executar-fase` | pre-task — antes de cada modificação no executor | Dispatch para `refactor-safety-auditor` antes de modificar arquivo flagged |
| `verifier` | pós-execution — análise reversa | Verifica characterization rodaram VERDE pós-refactor (snapshot diff = 0) |
| `nyquist-auditor` | retroativo — fase concluída | Lista refactors sem characterization → priority gap |
| `/auditar-marco` | gate milestone — opt-in `workflow.audit_milestone_legacy_refactor` | Lista refactors sem char no milestone → block close |
| `/forense` | pós-incidente | Postmortem de regression em refactor consume essa skill |

### Pattern 5: Heurística de "contrato externo"

Sinais que indicam arquivo é contrato (mais rigoroso que código interno):

```text
PATH PATTERNS
=============
- supabase/functions/<name>/index.ts          (edge function)
- src/api/v[0-9]/                              (versioned public API)
- src/handlers/webhooks/                       (webhook handlers)
- src/integrations/<vendor>/                   (third-party integrations)
- *Controller.ts, *Handler.ts                  (HTTP entry points)
- pages/api/                                   (Next.js API routes)

CONTENT MARKERS
===============
- exports a HTTP handler (Deno.serve, app.post, app.get)
- contains schema validation for external input (zod, joi, ajv)
- imports a webhook signature validator (Stripe, GitHub, etc.)
- has a OpenAPI/JSDoc @api comment
- referenced by a public consumer (other team, other repo, other client)

DOCUMENT MARKERS
================
- README/CONTRIBUTING references this file as "API contract"
- File name in CHANGELOG with breaking-change history
- Existence of CONTRACT.md OR API.md adjacent
```

Match em **qualquer** marker = contrato externo. Critério mais rigoroso porque consumer breakage é pior que internal regression.

### Pattern 6: Behavioral coverage vs line coverage

Gate consume **behavioral coverage**, não line coverage. Diferença:

```text
LINE COVERAGE 90%
==================
ALL_LINES = 100
LINES_HIT = 90
→ "90% covered" — mas pode ser inútil:

function foo(x) {
  if (x > 0) {                  // ← linha hit
    return doSomething(x)        // ← linha hit
  }                              // ← linha hit
  return null                    // ← linha hit
}

test('foo — happy path', () => {
  foo(5)  // hit todas as linhas! 100% line coverage!
  // ↑ MAS NENHUM ASSERTION sobre output. Bug em doSomething passa.
})

BEHAVIORAL COVERAGE 70%
========================
Critério: % de mutants killed em mutation testing
function foo(x) {
  if (x > 0) {                   // mutant: x >= 0 → killed se test cobre x=0
    return doSomething(x)         // mutant: doSomething(0) → killed se assertion checa output
  }
  return null                     // mutant: return undefined → killed se test asserta null
}

→ apenas tests com assertions reais sobre output matam mutants
→ 70% mutant kill = "70% das alterações comportamentais detectadas"
→ proxy de safety muito mais robusto
```

**Default tooling do gate:**
- Stryker (JS/TS) — `npx stryker run`
- Mutmut (Python) — `mutmut run && mutmut results`
- Pitest (Java) — `mvn pitest:mutationCoverage`

Sem mutation testing rodado, gate aceita line coverage ≥ 80% como proxy temporário (com warning para configurar mutation testing).

### Pattern 7: Captura de "payload real" para snapshot

Para refactor de webhook/edge function, characterization mais valiosa usa payloads REAIS de produção:

```text
WORKFLOW DE CAPTURA
====================
1. Adicionar log dedicado em produção que captura payload (sanitized) por N dias.
2. Sample 50-200 payloads cobrindo distribuição real de inputs.
3. Sanitize PII (CPF, email, nome, telefone) via post-processing deterministic.
4. Salvar em tests/characterization/<handler>/fixtures/payload-NN.json
5. Test gerado por handler + payload → output (sanitized) → snapshot.

PRINCÍPIO DE CAPTURA
=====================
- Sample é REAL DISTRIBUTION, não sintético.
- Inclui edge cases observados em prod (encoding raro, payloads malformados, retries).
- Sanitização é REVERSIBLE em ambiente de debug, NÃO em snapshot commit.
- 50 payloads reais > 500 sintéticos (cobertura de combinations naturalmente correta).

INSTRUMENTAÇÃO MÍNIMA (Edge Function exemplo Deno)
====================================================
import { logger } from '../_shared/logger.ts'

Deno.serve(async (req) => {
  const payload = await req.json()

  // PT-BR: log dedicado para characterization — only enable when CAPTURE_PAYLOADS=true
  if (Deno.env.get('CAPTURE_PAYLOADS') === 'true') {
    logger.info('payload-capture', {
      sanitized: sanitizePayload(payload),  // remove PII
      timestamp: new Date().toISOString(),
      handler: 'process-orders',
    })
  }

  // ... lógica existente ...
})
```

**Após N dias** (sugestão: 7-14), extrair logs, transformar em fixtures, escrever characterization tests usando-os. Skill `observability-driven-development` (v1.9) referenciada para boa instrumentação.

### Pattern 8: Frontmatter do CONTEXT.md (integração com /discutir-fase)

`/discutir-fase` (v1.9) injeta seção `<refactor_safety>` em CONTEXT.md quando detecta refactor intent:

```markdown
<refactor_safety>
  <file_path>src/orders/handler.ts</file_path>
  <line_count>724</line_count>
  <has_external_contract>true</has_external_contract>
  <current_coverage_pct>12</current_coverage_pct>
  <characterization_status>absent</characterization_status>
  <gate_decision>BLOCK</gate_decision>
  <recommended_path>caminho_1_caracterizar</recommended_path>
  <effort_estimate>8-16h</effort_estimate>
  <risk_acknowledgment>
    User reconhece que sem characterization, refactor é "edit and pray".
  </risk_acknowledgment>
</refactor_safety>
```

`plan-checker` consume essa seção para decidir aprovação do plano.

## Anti-patterns

### ANTI: bypass silencioso "porque é simples"

```text
ANTI: developer "sabe que pode" mudar arquivo grande sem char tests
      "porque a mudança é só renomear uma variável".

PROBLEMA: rename é mecânico → permitido. Mas "é só renomear" muitas
          vezes vira "renomear + ajustar tipo + atualizar caller +
          fix bug encontrado" — agora não é mais safe extraction.
          Sem gate, transição é invisível.

CERTO: --mode=safe-extract com checklist assinado. Cada item é veto:
       "movi lógica entre escopos? não". "mudei control flow? não".
       Self-audit explícito força disciplina single-goal.
```

### ANTI: characterization "para ganhar tempo"

```text
ANTI: developer escreve 2 testes happy-path e marca characterization
      como "feita". Coverage 25%. Gate ainda BLOCK mas dev gambiarra
      coverage report.

PROBLEMA: gate bypass virtual. Próxima regressão silenciosa em prod.

CERTO: gate VERIFICA mutation testing (não só line coverage).
       Survived mutants ≥ 30% = falha. Workaround é caro: precisa
       de tests reais. Aligns incentive com safety.
```

### ANTI: override sem ticket

```text
ANTI: --mode=override --reason "tô com pressa, depois faço".

PROBLEMA: débito invisível. "Depois" nunca chega. Hot path do legado
          fica untested forever.

CERTO: gate exige --ticket REQ-N (linkado a issue real). Issue
       contém nome do dev, prazo, plano. Audit trail força
       compliance ou documenta porque não.
```

### ANTI: gate aplicado uniformemente sem maturity

```text
ANTI: projeto greenfield 1 mês de idade, gate bloqueia toda
      tentativa de refactor. Equipe vira a 100% characterization.
      Velocidade colapsa.

PROBLEMA: gate calibrado para legacy code maduro, aplicado em
          contexto greenfield, vira fricção.

CERTO: workflow.legacy_refactor_gate_blocking = false em projetos
       jovens. Gate vira CONSULTIVO (warning + recomendação).
       Bloqueia apenas quando OMM Capacidade 1 ≥ 3 (resiliência
       já estabelecida) — sinal de que projeto cresceu o suficiente
       para precisar de safety net.
```

### ANTI: characterization de TUDO antes de qualquer mudança

```text
ANTI: equipe interpreta gate como "tem que ter 100% cobertura
      de TODA a codebase antes de qualquer refactor".

PROBLEMA: total inviável. Gate vira motivo para nunca refatorar.
          Codebase deteriora.

CERTO: gate é PER-FILE para arquivos sendo TOCADOS. Aplica APENAS
       no escopo da mudança atual. Resto da codebase pode estar
       0% — não bloqueia. Refactor incremental cresce cobertura
       organicamente, file by file.
```

## Verificação

Antes de gate liberar refactor:

1. **Critérios coletados** — line count, contrato externo, cobertura atual
2. **Decisão correta para evidências** — BLOCK / WARN / PASS conforme matriz
3. **Caminhos oferecidos quando BLOCK** — 4 opções (caracterizar, sprout, safe-extract, override)
4. **Override tem ticket linkado** — sem ticket = inválido
5. **Mutation testing rodado** — não basta line coverage
6. **Snapshots revisados** se characterization presente — não automaticamente confiados
7. **CONTEXT.md tem seção `<refactor_safety>`** se via `/discutir-fase`
8. **Audit trail no PR** — decisão do gate registrada no commit/PR

## Configuração do gate

```toml
# .planning/config.json (ou planning-config equivalent)
[workflow]
legacy_refactor_gate_blocking = true  # default em projetos com OMM ≥ 3
legacy_refactor_min_lines = 500       # threshold de "arquivo grande"
legacy_refactor_min_coverage_pct = 70 # threshold para gate passar
legacy_refactor_external_paths = [    # patterns de contrato externo
  "supabase/functions/**",
  "src/api/**",
  "src/handlers/webhooks/**",
  "pages/api/**",
]
legacy_refactor_mutation_required = true  # mutation testing obrigatório?
```

Defaults respeitam maturity do projeto via `omm-auditor` integration:
- Capacidade 1 (Resilience) < 3 → blocking = false (consultivo)
- Capacidade 1 (Resilience) ≥ 3 → blocking = true (default)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário canônico
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — caminho 1 (caracterizar primeiro)
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — caminho 2 (sprout/wrap, não toca legado)
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — caminho 3 (safe extraction em método grande)
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — pré-requisito quando dependências bloqueiam characterization
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — quais inputs cobrir? sketch identifica inflection points
- [`refactor-safety-auditor`](../../agents/refactor-safety-auditor.md) — agent que executa esse gate em runtime
- [`observability-driven-development`](../observability-driven-development/SKILL.md) (v1.9) — instrumentação para captura de payloads reais
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 5 (Change Management) consume status do gate

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 1: "Changing Software" + Cap 13: "Characterization Tests" + Cap 23: "How Do I Know That I'm Not Breaking Anything?".*
