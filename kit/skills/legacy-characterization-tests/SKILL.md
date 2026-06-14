---
name: legacy-characterization-tests
cost_tier: leve
description: Gera suite de characterization tests (cap 13 Feathers) para refactor seguro de codigo legado sem testes — captura comportamento atual como golden snapshot, oracle imutavel antes de qualquer mudanca.
---

# Legacy — Characterization Tests

## Quando usar

LLM carrega esta skill quando o user vai modificar código sem suite de testes adequada e o objetivo é refactor (não bug fix). Trigger phrases:

- "refatorar [arquivo grande]", "extract method de", "quebrar essa classe"
- "esse arquivo não tem testes", "como começo testando isso?"
- "preservar comportamento", "snapshot test", "golden master"
- "cap 13 Feathers", "characterization test"
- "código legado", "legacy code", "edit and pray"
- arquivo > 500 linhas que será modificado
- arquivo com contrato externo (webhook, API, integração) sendo modificado

Carrega antes de planejar/executar refactor. **Bloqueia execução** até characterization existir.

## Regras absolutas

- **Legacy code = código sem testes** (definição Feathers, não emocional). Idade não importa. Estética não importa. **Cobertura comportamental** importa.
- **Characterize first, refactor second.** Sempre. Sem exceção. Pular esse passo é "edit and pray" — o modo default que o livro existe para combater.
- **Capture o que o código FAZ, não o que DEVERIA fazer.** Se há bug, o teste preserva o bug. Bug fix é commit separado, depois do refactor, com seu próprio teste.
- **Mínimo de 5-10 inputs cobrindo grupos de equivalência** — null/vazio, válido típico, válido extremo, inválido recoverable, inválido fatal. Menos que isso = baseline frágil.
- **Behavioral coverage ≥ 70-80% antes de qualquer extract/move/rename**. Coverage % de linha NÃO É proxy de safety — verifique branches via mutation testing.
- **Golden master/snapshot é decisão, não copy-paste.** Leia output capturado linha por linha antes de salvar. Bugs conhecidos viram comentários inline (`// BUG #X: deveria Y, é Z`). PII/secrets/UUIDs locais → redact deterministic (hash, mask).
- **Vermelho em characterization test = regressão até prova ao contrário.** Nunca "atualize o expected" sem investigar e documentar a mudança comportamental no commit.
- **Bug fix dentro de refactor PR = veto.** Misturar invalida o oracle e torna PR não-revisável. Single-goal editing (cap 22) — uma intenção por commit.

## Patterns canônicos

### Pattern 1: Workflow de characterization (cap 13)

```text
1. Identificar o método/classe/arquivo a refatorar
2. Inventariar entradas e saídas:
   - Inputs: parâmetros + globals lidos + I/O (DB read, API call)
   - Outputs: return + parâmetros mutados + I/O (DB write, log, API call)
3. Para cada grupo de equivalência (5+ inputs):
   a. Construir input ("arrange")
   b. Executar código real ("act") — sem mocks ainda; isole I/O com seam mínimo se necessário
   c. Capturar output completo ("snapshot")
   d. REVISAR output linha por linha — marcar bugs conhecidos como comments
   e. Salvar como `expected.txt` ou `__snapshots__/foo.test.ts.snap`
4. Escrever teste:
   - Arrange = mesmo input
   - Act = mesmo código
   - Assert = output igual ao salvo (deep equal OR snapshot match)
5. Rodar suite — TODOS verdes → BASELINE estabelecido
6. Refactor pode começar
```

### Pattern 2: Grupos de equivalência canônicos

Cobertura mínima — pelo menos 1 caso por grupo:

| Grupo | Definição | Exemplo (função `parseOrder(input)`) |
|---|---|---|
| **Empty** | Input ausente/zero/vazio | `parseOrder(null)`, `parseOrder({})` |
| **Typical valid** | Caso comum esperado | `parseOrder({ id: 'O123', items: [...] })` |
| **Boundary valid** | Limites superiores/inferiores válidos | `parseOrder({ ..., items: [singleItem] })`, `parseOrder({ ..., items: [maxItems_x_50] })` |
| **Recoverable invalid** | Erro que código trata graceful | `parseOrder({ id: 'O123', items: 'malformed' })` — espera-se exceção tipada |
| **Fatal invalid** | Erro que código não trata (vai propagar/crashar) | `parseOrder(undefined)` — espera-se NPE/crash |
| **Side-effect heavy** | Input que dispara muitos side effects (logs, DB writes) | Ordem grande que escreve em audit log + cache + queue |
| **Edge case histórico** | Cases conhecidos que já causaram bugs (consultar git log/issues) | Input com encoding UTF-16, timestamp negativo |

### Pattern 3: Snapshot tooling por linguagem

| Linguagem | Framework | Snapshot syntax |
|---|---|---|
| **JavaScript/TypeScript** | Jest, Vitest | `expect(output).toMatchSnapshot()` ou `toMatchInlineSnapshot()` |
| **Python** | pytest + pytest-snapshot OR syrupy | `snapshot.assert_match(output)` ou `assert output == snapshot` |
| **Java** | JUnit + ApprovalTests | `Approvals.verify(output)` |
| **Ruby** | RSpec + rspec-snapshot | `expect(output).to match_snapshot('foo_bar')` |
| **Go** | go-cmp + cupaloy/snaps | `cupaloy.SnapshotT(t, output)` |
| **C#** | Verify, Snapshooter | `await Verifier.Verify(output)` |
| **Rust** | insta | `insta::assert_yaml_snapshot!(output)` |

**Anti-tooling:** evitar diff visual cru (eyeballed) — snapshot framework gera diff legível e atualiza expected via flag (`--updateSnapshot` no Jest, `--snapshot-update` em pytest). Sem framework, refactor de "atualizar oracle" vira manual e propenso a erro.

### Pattern 4: Captura de outputs com side effects

Quando código tem side effects (DB writes, HTTP calls, logs), o snapshot deve incluir **todos** os efeitos observáveis, não só return. Estratégia:

```ts
// PT-BR: capturar return + lista canônica de efeitos
async function characterize_placeOrder() {
  const sideEffects = {
    dbWrites: [] as Array<{ table: string, op: string, row: any }>,
    httpCalls: [] as Array<{ url: string, method: string, body: any }>,
    logs: [] as Array<{ level: string, msg: string, fields: any }>,
    queueMsgs: [] as Array<{ queue: string, payload: any }>,
  }

  // Wire fakes que populam sideEffects ao invés de fazer real I/O
  const db = makeFakeDb(sideEffects.dbWrites)
  const http = makeFakeHttp(sideEffects.httpCalls)
  const log = makeFakeLogger(sideEffects.logs)
  const queue = makeFakeQueue(sideEffects.queueMsgs)

  const input = { customerId: 'C-42', items: [{ sku: 'SKU-1', qty: 2 }] }
  const result = await placeOrder(input, { db, http, log, queue })

  return {
    return: result,
    sideEffects,
  }
  // ↑ ESSE objeto é o que vira snapshot
}

// Test
test('placeOrder — typical valid input', async () => {
  const captured = await characterize_placeOrder()
  expect(captured).toMatchSnapshot()
})
```

Snapshot resultante captura return E efeitos, ambos congelados.

### Pattern 5: Determinismo — eliminar non-determinism antes de capturar

Datas, UUIDs, random, nanos — todos não-determinísticos por default. Capture-os como dependência injetada:

```ts
// PT-BR: dependências injetadas tornam snapshot reproduzível
const fakeClock = () => new Date('2024-01-15T10:00:00Z')  // congelado
const fakeUuid = (() => { let n = 0; return () => `uuid-${++n}` })()  // determinístico
const fakeRandom = (() => { let n = 0; return () => (n++ % 1000) / 1000 })()  // ciclico

const result = await placeOrder(input, {
  ...realDeps,
  clock: fakeClock,
  uuidGen: fakeUuid,
  random: fakeRandom,
})
```

Sem isso, cada run produz snapshot diferente → "flaky tests" → ninguém confia → suite ignorada.

### Pattern 6: Sanitização para snapshot

Output cru pode incluir dados sensíveis ou voláteis. Sanitize ANTES de salvar:

```ts
function sanitizeForSnapshot(o: any): any {
  return JSON.parse(
    JSON.stringify(o, (key, value) => {
      if (key === 'apiKey' || key === 'password' || key === 'token') return '***REDACTED***'
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return '<TIMESTAMP>'
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/.test(value)) return '<UUID>'
      return value
    })
  )
}
```

Aplicar **antes** de `expect(...).toMatchSnapshot()`. Documentar quais campos foram sanitized para que reviewer entenda.

### Pattern 7: Behavioral coverage check (mutation testing)

Coverage de linha NÃO É proxy de safety. Para confirmar que characterization realmente cobre comportamento:

```bash
# JavaScript/TypeScript
npx stryker run

# Python
mutmut run
mutmut results

# Java
mvn pitest:mutationCoverage

# Métrica desejada: ≥ 70% de mutants killed
# Survived mutants = comportamento NÃO observado pelos tests = ponto cego
```

Survived mutant tipicamente indica que falta um observation point. Adicione um test que exercita o branch correspondente.

### Pattern 8: Effort budget para characterization

Dados empíricos baseados em arquivos típicos:

| Tamanho do alvo | Inputs a gerar | Esforço típico | Cobertura esperada |
|---|---|---|---|
| Método 20-50 linhas, 1-3 branches | 5-7 inputs | 1-2h | 80-90% behavioral |
| Método 50-150 linhas, 3-7 branches | 8-12 inputs | 3-6h | 70-85% behavioral |
| Método 150+ linhas (monster) | 15-25 inputs | 1-3 dias | 60-75% behavioral (exigir cap 22 antes) |
| Classe inteira 300-500 linhas | 20-40 inputs | 2-5 dias | 65-80% behavioral |
| Arquivo > 500 linhas | proibido refatorar sem split first | depende | exigir extract class antes |

**Não negocie cobertura para baixo "para ganhar tempo".** Cobertura insuficiente = false sense of safety, pior que ausência total.

## Anti-patterns

### ANTI: testar o "comportamento esperado"

```text
ANTI: "Vou escrever um teste do que o método deveria fazer e refatorar
       até passar".

PROBLEMA: o método tem bugs. Teste-do-esperado falha imediato porque o
          estado atual É buggy. Você não consegue rodar nem 1 verde.
          Frustrado, "ajusta" expected para o atual — perdeu o ponto
          inteiro do exercício.

CERTO: characterize first. Capture o que o código faz HOJE, com bugs.
       Refactor preserva isso. Bug fix vem depois, em commit separado.
```

### ANTI: 1 teste cobrindo "happy path"

```text
ANTI: "Adicionei 1 test do caso comum, vai dar".

PROBLEMA: branches raras (null, vazio, edge case) são exatamente onde
          regressão se esconde. Refactor "verde" no test de happy path
          mas quebra null handling silencioso → bug em prod no primeiro
          input null real (1% do tráfego, mas existe).

CERTO: 5+ inputs cobrindo grupos canônicos de equivalência. 1h a mais
       de teste = N horas a menos de incident.
```

### ANTI: snapshot sem revisão

```text
ANTI: rodar code → toMatchSnapshot() → CI verde → commit. "Funcionou".

PROBLEMA: snapshot pode incluir bug, PII, secret, UUID local. CI
          "verde" só significa "snapshot está consistente com captura
          anterior" — não que o conteúdo está certo.

CERTO: ler snapshot inteiro antes de commit. Marcar bugs com comments,
       redact PII com sanitize fn, verificar que não há secrets. Commit
       de snapshot é decisão de produto, não automation.
```

### ANTI: mocks excessivos = teste de mock, não de código

```text
ANTI: tudo mockado — DB, HTTP, log, queue, clock, random. Test passa.

PROBLEMA: você testou que o método chama os mocks na ordem certa, não
          que o método produz output correto para entrada real. Refactor
          que muda ORDEM de chamadas (igualmente correto) quebra mock
          assertion mas é regressão zero.

CERTO: minimize mocks. Use fakes que coletam side effects observáveis
       (lista, counter), assert sobre o STATE final dos fakes, não
       sobre sequência de invocações. Snapshot do state pós-execução
       é mais resiliente que assertion de invocation order.
```

### ANTI: pular characterization "porque o método é simples"

```text
ANTI: "esse método tem 30 linhas, é óbvio o que faz, vou refatorar
       direto".

PROBLEMA: 30 linhas têm ~5-10 branches implícitas (early return, &&
          short-circuit, exceções, type coercion). Cada branch é uma
          assumption não-verificada. "Óbvio" é ilusão de quem escreveu
          o código original — você está lendo, é diferente.

CERTO: SEMPRE characterize, mesmo métodos curtos. 30 linhas → 5 inputs
       → 30 minutos. Custo trivial. Benefício: zero "wait, eu não sabia
       que isso retornava undefined em X". Descobre-se durante captura,
       não em prod.
```

### ANTI: characterization em fase de bug fix

```text
ANTI: "Estou consertando bug X, vou aproveitar e characterize tudo
       enquanto estou aqui".

PROBLEMA: scope creep. PR vira inrevisável (bug fix + 50 testes novos
          + redesenho mental). Linha entre "preservei comportamento" e
          "modifiquei comportamento" desaparece.

CERTO: bug fix é bug fix. Escreva 1 teste do COMPORTAMENTO CORRETO
       (TDD agora, porque você está mudando intenção). Characterize é
       fase prévia ao refactor — separa em PR/sprint próprio.
```

## Verificação

Antes de iniciar refactor de código legado:

1. **Inventário completo de inputs/outputs** — todos os parâmetros, globals lidos, I/O capturados
2. **5+ inputs cobrindo grupos de equivalência** — empty, typical, boundary, invalid recoverable, invalid fatal
3. **Snapshots revisados linha por linha** — bugs marcados, PII/secrets redacted
4. **Determinismo garantido** — clock/uuid/random injetáveis, fakes substituem em teste
5. **Side effects capturados** — DB writes, HTTP calls, logs, queue msgs incluídos no snapshot
6. **Suite verde** — todos characterization tests rodam OK no main branch
7. **Behavioral coverage medida** — mutation testing rodado, ≥ 70% mutants killed
8. **Documentação no PR** — link para snapshots, lista de bugs preservados, fonte do oracle

## Limiar de "pronto para refactor"

```text
Total inputs cobertos:               ≥ 5  (mínimo); 10+ recomendado
Behavioral coverage (mutation kill): ≥ 70%
Branches conhecidas testadas:        100% (todas as branches do código que será tocado)
Side effects capturados:             100% (zero side effect "esquecido")
Snapshots revisados:                 100% (cada arquivo lido por humano)
Bugs documentados como TODO:         lista no PR
Determinismo:                        OK em 10 runs consecutivos sem flaky
```

Se algum item < limiar → não inicie refactor. Volte para characterization.

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário canônico
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — quando characterization requer quebrar dependência primeiro
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — quais inputs escolher? effect sketch identifica
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — método > 100 linhas? characterization tem trato especial
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — alternativa quando characterization é caro demais (sprout side-steps)
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate auto-trigger que bloqueia refactor sem characterization
- [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — refactor pode regredir SLO; characterization protege
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 5 (Change Management) verifica characterization antes de aceitar mudança em prod

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 13: "I Need to Make a Change, But I Don't Know What Tests to Write" + Cap 23: "How Do I Know That I'm Not Breaking Anything?".*
