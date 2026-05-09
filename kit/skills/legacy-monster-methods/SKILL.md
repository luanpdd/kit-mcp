---
name: legacy-monster-methods
description: Use ao refatorar método > 100 linhas sem testes — scratch refactoring, single-goal editing, safe extraction (cap 22 Feathers). Padrões para domesticar bulleted vs snarled methods.
---

# Legacy — Monster Methods

## Quando usar

LLM carrega esta skill quando o user encontra método absurdamente longo (> 100 linhas) que precisa ser modificado. Trigger phrases:

- "esse método tem [N] linhas, preciso mudar"
- "monster method", "método monstro", "método gigante"
- "scratch refactoring", "refactor de rascunho"
- "single-goal editing", "edição com objetivo único"
- "extract method em método sem testes"
- "cap 22 Feathers"
- "bulleted method", "snarled method"

Carrega quando `legacy-characterization-tests` é insuficiente isoladamente — método é grande demais para enumerar inputs, mas precisa ser refatorado para ficar testável.

## Regras absolutas

- **Monster method = > 100 linhas OU > 5 níveis de aninhamento.** Pelo menos 1 dos dois. Heurística empírica do livro.
- **Distinguir bulleted vs snarled.** Bulleted = linhas longas mas planas (mais fácil). Snarled = nesting profundo, control flow complexo (mais difícil). Estratégias diferentes.
- **Scratch refactoring é DESCARTÁVEL.** Branch lixo, refactor estético para entender, depois `git checkout main` e descarte tudo. Só conhecimento adquirido viaja para a refatoração real.
- **Single-goal editing.** UMA mudança por commit/PR. Renomear OR extrair OR mover, NUNCA os 3 juntos. Cada commit é mecânico, isolado, revisável.
- **Extract method em monster sem teste = SAFE EXTRACTION.** Apenas levantar bloco contíguo + capturar variáveis usadas como parâmetros. SEM mover lógica entre escopos. SEM mudar comportamento. Lê → executa → escreve idênticamente antes/depois.
- **Compilação verde após CADA commit.** Passo grande demais = você não está fazendo single-goal. Quebre menor.
- **Não introduza tests "no meio" do refactor.** Refactor preserva comportamento → mesmo set de tests roda verde antes/durante/depois. Test novo significa novo comportamento (PR diferente).
- **Pequenos testes em método extraído saem GRÁTIS.** Após extract method, o método extraído é menor, tipicamente puro. Test acumulado durante refactor incremental.

## Patterns canônicos

### Pattern 1: Bulleted vs Snarled — diagnóstico

```text
BULLETED METHOD
===============
public function processOrder(order) {
  validateOrder(order)
  computeTotals(order)
  applyDiscounts(order)
  saveOrder(order)
  notifyCustomer(order)
  publishEvent(order)
  updateAnalytics(order)
  returnReceipt(order)
}
↑ 8 linhas, todas no mesmo nível. Cada linha é praticamente extract-method-ready.

SNARLED METHOD
==============
public function processOrder(order) {
  if (order != null) {
    if (order.items != null && order.items.length > 0) {
      var total = 0
      for (var item of order.items) {
        if (item.discount) {
          if (item.discount.type === 'percent') {
            total += item.price * (1 - item.discount.value / 100) * item.qty
          } else if (item.discount.type === 'fixed') {
            total += (item.price - item.discount.value) * item.qty
          } else {
            total += item.price * item.qty
          }
        } else {
          total += item.price * item.qty
        }
      }
      // ... mais 80 linhas com nesting similar
    }
  }
}
↑ control flow profundamente aninhado. Extract method não é trivial — variáveis cruzam scopes.
```

**Diagnóstico:**
- Conte linhas no mesmo nível de indentação. Se > 70% das linhas estão no nível 1-2 → BULLETED.
- Conte profundidade máxima de aninhamento. Se ≥ 5 → SNARLED.

**Estratégias divergem** — abaixo.

### Pattern 2: Scratch refactoring (cap 22)

Refactor descartável para ENTENDER o método antes de mudá-lo.

```text
1. Cria branch `scratch/<method-name>-explore`
2. Refatora à vontade — extract aleatório, rename especulativo,
   reformata estética. Goal: tornar legível para você.
3. Lê o resultado, entende o que método faz.
4. NÃO commita nem PR-a essa branch.
5. `git checkout main`. Volta ao código original intocado.
6. AGORA você tem mental model. Refatoração real começa com
   passos pequenos disciplinados (single-goal editing).
```

**Por que descartável:** scratch é estética + quebra contracts. Manter seria perigoso. Só conhecimento adquirido vai para a real.

**Quando vale o tempo:** método > 200 linhas + você nunca tinha mexido nele. < 100 linhas raramente vale (lê direto resolve).

### Pattern 3: Single-goal editing — atomic refactoring

Cada commit faz UMA coisa. Disciplina absoluta.

```text
✓ COMMIT 1: rename method (mecânico, IDE-assisted)
  - Antes: processOrder
  - Depois: processOrderLegacy
  - Diff: rename refactor automático

✓ COMMIT 2: extract method (mecânico)
  - Antes: linhas 42-58 inline em processOrderLegacy
  - Depois: extracted como computeTotals(items)
  - Diff: 17 linhas → 1 chamada

✓ COMMIT 3: extract method (mecânico)
  - Antes: linhas 60-85 inline
  - Depois: extracted como applyDiscounts(items, discounts)
  - Diff: 26 linhas → 1 chamada

✗ COMMIT NÃO-FEITO: extract + rename + add validation
  Múltiplos goals num commit = no single-goal. Difícil revisar.
```

**Princípio:** cada commit é REVERTIBLE individualmente. Se PR3 tem bug, revert PR3 só, não a sequência inteira.

### Pattern 4: Safe extraction em método sem testes

Extract method preservando comportamento sem ter test que valide.

```text
SAFE EXTRACTION CHECKLIST
=========================
□ Bloco a extrair é CONTÍGUO (sem control flow saindo do meio)
□ Variáveis lidas dentro do bloco mas declaradas fora → parâmetros
□ Variáveis ESCRITAS dentro do bloco mas usadas fora → return values
□ Bloco não tem `return`, `throw`, `break`, `continue` que afete escopo externo
  (se tem: extract não é seguro, escolha menor)
□ Type signatures preservadas (parâmetros e retorno bem-tipados)
□ Comportamento idêntico — antes do extract: lê X, computa Y, escreve Z;
  depois: chama método extraído que lê X, computa Y, escreve Z

PROCESSO MECÂNICO
=================
1. Selecionar bloco contíguo (10-30 linhas tipicamente)
2. Identificar variáveis lidas vs escritas no bloco
3. Lidas-mas-não-escritas → parâmetros (in)
4. Escritas-mas-usadas-fora → adicionar a return value (out)
5. IDE: extract method (Cmd+Opt+M no IntelliJ; "Refactor: Extract Function" no VS Code)
6. Compilar — verde?
7. Run smoke (qualquer comando manual que rodava antes) — comportamento idêntico?
8. Commit. Próximo bloco.
```

**Insight:** safe extraction é seguro mesmo SEM testes porque é PURELY MECHANICAL. IDE faz com 100% de fidelidade. Risco residual = bug do IDE (raríssimo) ou erro humano em copiar manualmente (não use cópia manual — use extract automation).

### Pattern 5: Domando bulleted method

Bulleted é fácil. Workflow:

```text
1. Cada linha do método é uma "frase" → cada uma vira método extraído.
   Antes: processOrder() com 30 linhas no nível 1
   Depois: processOrder() com 8 chamadas, cada uma para um helper

2. Após extract, helpers são MENORES → tests acumulam grátis:
   public computeTotals(order) {
     // 8 linhas — testável isolado agora
   }
   public applyDiscounts(order, codes) {
     // 12 linhas — testável isolado agora
   }

3. Tests acumulados cobrem comportamento UNIT:
   test('computeTotals — com 1 item', () => { ... })
   test('computeTotals — com items vazios', () => { ... })

4. processOrder() agora é orquestração — test acaba sendo
   integration tipo:
   test('processOrder — happy path orchestration', () => {
     processOrder(typicalOrder)
     expect(saved).toBeDefined()
     expect(notifications).toHaveLength(1)
   })

5. Iterativamente, código vira pirâmide de tests bem definida.
```

**Esforço típico:** método 100 linhas bulleted → 6-8 commits, 1-2 dias para refactor + 5-10 testes acumulados grátis.

### Pattern 6: Domando snarled method

Snarled é difícil. Estratégia: APLAINAR primeiro, depois extrair.

```text
PASSO 1 — Achatar via guard clauses (early return)
  Antes:                              Depois:
  if (order != null) {                if (order == null) return ERROR
    if (order.items != null) {        if (order.items == null) return ERROR
      if (order.items.length > 0) {   if (order.items.length === 0) return EMPTY
        // 80 linhas                  // 80 linhas (agora sem nesting)
      }
    }
  }
  ↑ 3 níveis viraram 0 níveis. Pure mechanical. Sem mudança comportamental.

PASSO 2 — Extract method em loop interno
  Antes:                              Depois:
  for (item of items) {               for (item of items) {
    if (item.discount) {                total += computeItemTotal(item)
      if (item.discount.type === 'percent') {  ↑ 1 chamada
        total += item.price * (1 - ...) * item.qty
      } else if (...) {
        ...
      }
    } else {
      total += item.price * item.qty
    }
  }

  function computeItemTotal(item) {
    if (!item.discount) return item.price * item.qty
    if (item.discount.type === 'percent')
      return item.price * (1 - item.discount.value / 100) * item.qty
    if (item.discount.type === 'fixed')
      return (item.price - item.discount.value) * item.qty
    return item.price * item.qty
  }
  ↑ Loop de 12 linhas → 3 linhas + função pura testável.

PASSO 3 — Iterar até nível máximo de aninhamento ≤ 2.

PASSO 4 — Tests no método extraído (puro, fácil de testar):
  test('computeItemTotal — sem desconto', ...)
  test('computeItemTotal — desconto percentual', ...)
  test('computeItemTotal — desconto fixo', ...)
  test('computeItemTotal — discount.type desconhecido', ...)
```

**Esforço típico:** método 150 linhas snarled → 12-20 commits, 3-7 dias para refactor + 15-25 testes acumulados.

### Pattern 7: Sequência canônica de tipos de single-goal commit

Em ordem do mais SEGURO ao mais ARRISCADO. Faça nessa ordem.

```text
SEGURO   ↓
======================================================
1. RENAME (variable, method, class, file)
   IDE-assisted, mecânico, comportamento idêntico

2. SAFE EXTRACTION (extract method/variable)
   Selecione bloco contíguo, IDE extract, sem mover lógica entre scopes

3. MOVE METHOD (entre classes)
   Apenas se método não usa state da origem (puro relativo à classe)

4. INTRODUCE PARAMETER OBJECT
   Agrupar parâmetros relacionados em DTO. Mecânico.

5. INVERT DEPENDENCY (constructor injection)
   New X() interno → recebe X externo. Quebra encapsulation, mas
   comportamento permanece (se default-arg usado).

6. CHANGE METHOD SIGNATURE
   Adicionar/remover parâmetro. Risk: callers podem passar wrong.

7. ALGORITHM REPLACEMENT
   Mudar IMPLEMENTAÇÃO mantendo contrato. Risk médio — characterization
   tests obrigatórios.

8. CONTRACT CHANGE
   Mudar pre-condition/post-condition. Risk alto — todos os callers
   precisam ser inspecionados.
   ↑ ARRISCADO
======================================================
```

Stop em #5 ou #6 para refactor "limpa-e-vai". #7 e #8 = mudança comportamental, exigem characterization completa.

### Pattern 8: Effort budget de monster method

| Tamanho | Tipo | Esforço de refactor | Output esperado |
|---|---|---|---|
| 100-150 linhas, bulleted | extract methods + acumular tests | 1-2 dias | 5-10 helpers + 5-10 tests |
| 100-150 linhas, snarled | flatten + extract | 3-5 dias | 5-10 helpers + 10-15 tests |
| 150-300 linhas, bulleted | extract class após methods | 3-7 dias | 5-10 helpers + nova classe + 10-15 tests |
| 150-300 linhas, snarled | scratch refactor + flatten + extract | 1-2 semanas | classe + 15-25 tests |
| > 300 linhas | só com aprovação stakeholder, alocação dedicada | 2-4 semanas | reescrever via sprout class? |

**Heurística:** método > 300 linhas raramente vale refactor incremental. Considere sprout class — encapsular comportamento NOVO em classe nova, deixar legado intocado, eventually deprecate.

### Pattern 9: Cobertura emergente

Refactor de monster method NÃO precisa de characterization completa upfront se você usa safe extraction (mecânica). Mas teste se acumula:

```text
PRE-REFACTOR (T0)
  Coverage: 0% (untested)
  Confiança: baixa

DURANTE REFACTOR (T1-Tn)
  Cada extract method → método extraído fica testável (puro/menor)
  Adicione 1-3 unit tests do extracted antes de seguir
  Coverage cresce 5-10% por extract

PÓS-REFACTOR (Tfinal)
  Original 100 linhas → 1 método orquestrador + 8 helpers
  Cobertura: 60-80% (helpers cobertos; orquestrador integration)
  Confiança: alta
```

**Sem essa disciplina:** refactor termina, código mais limpo, mas cobertura ainda 0%. Próxima mudança volta ao mesmo dilema.

## Anti-patterns

### ANTI: refactor monstro em 1 PR

```text
ANTI: PR de 1500 linhas — extracted 12 methods + renamed 8 variables
      + moved 3 fields + fixed 2 bugs + adicionou 25 tests.

PROBLEMA: PR não-revisável. Reviewer aprova "no fé". CI verde diz
          pouco — branch coverage caiu. Revert é all-or-nothing.

CERTO: 12-25 commits/PRs em sequência. Cada um single-goal,
       ≤ 100 linhas, mecânico, revertível, com proof of correctness
       (compila + roda).
```

### ANTI: misturar refactor + bug fix + feature

```text
ANTI: enquanto refatora, "ah esse if pode ser melhor", "esse loop
      podia usar reduce", "ah aqui tem um bug, conserto".

PROBLEMA: você quebrou single-goal em ~5 lugares. Reviewer não consegue
          identificar o que é refactor (preserva) vs bug fix (muda).
          Se algo quebra, bisect aponta para PR mas não isola causa.

CERTO: anote bugs encontrados num arquivo `BUGS-FOUND.md`. Não
       conserte agora. Após refactor terminar, faz PRs separados
       para cada fix com test do comportamento correto.
```

### ANTI: extract method + mover lógica

```text
ANTI: extract method, mas durante extraction "noto" que lógica é
      melhor em outro escopo, então move pra lá durante o extract.

PROBLEMA: comportamento mudou. Não é mais SAFE extraction. Você
          precisava de characterization mas pulou.

CERTO: 2 PRs sequenciais.
       PR1 — extract method (idêntico, no mesmo escopo)
       PR2 — move method (com test que valida em ambos os contextos)
```

### ANTI: scratch refactoring committed

```text
ANTI: scratch ficou bom, mantenho-o em PR.

PROBLEMA: scratch fez mudanças não-mecânicas (estéticas, especulativas).
          Sem characterization, não há prova de comportamento idêntico.
          Você acabou de fazer "edit and pray" disfarçado de refactor.

CERTO: scratch é descartável. SEMPRE. Real refactor recomeça do
       código original com passos disciplinados.
```

### ANTI: extract APENAS para mais legibilidade, sem reduzir tamanho

```text
ANTI: extract de 1 linha para método com nome descritivo "para ficar
      mais claro". Original tinha 200 linhas, agora tem 195 + 1 linha
      em método novo.

PROBLEMA: 5 minutos para reviewer entender a chamada extra. Tamanho
          do monster diminuiu 1%. Trade desfavorável.

CERTO: extract de 10-30 linhas mínimo. Bloco coeso e separável,
       não single statement. Linha solta com nome longo é
       refactoring teatral.
```

### ANTI: tentar testar tudo upfront

```text
ANTI: "vou characterize completo das 200 linhas em todos os 30
       inputs antes de tocar uma vírgula".

PROBLEMA: 200 linhas com 30 inputs = 1-2 semanas de characterization.
          Stakeholder cancela. Refactor nunca acontece. Status quo
          eterno.

CERTO: characterization MÍNIMA viável (5-10 inputs nos pontos óbvios).
       Refactor mecânico (safe extraction, rename) que PRESERVA
       comportamento. Acumula testes em helpers extraídos. Cobertura
       emerge organicamente.
```

## Verificação

Antes de declarar refactor de monster method completo:

1. **Tipo identificado** — bulleted vs snarled
2. **Tamanho original < 100 linhas após refactor** — se ainda > 100, refactor não terminou
3. **Cada commit é single-goal** — rename OR extract OR move, nunca múltiplos
4. **Compilação verde a cada commit** — passos pequenos, mecânicos
5. **Smoke run após cada commit** — comportamento preservado
6. **Tests acumulados nos helpers extraídos** — coverage cresceu de 0% para ≥ 50%
7. **Bugs encontrados anotados, NÃO consertados durante refactor** — fix em PRs separados
8. **Sem scratch committed** — só conhecimento adquirido viajou

## Limiar de "pronto para feature change pós-refactor"

```text
Linhas do método principal:           ≤ 100 (idealmente ≤ 50)
Profundidade máxima de aninhamento:   ≤ 3
Helpers extraídos:                    5-15 (cada ≤ 30 linhas)
Coverage do método principal:         ≥ 50%
Coverage dos helpers:                 ≥ 70%
Bugs encontrados:                     anotados em BUGS-FOUND.md
PRs:                                  cada single-goal, ≤ 100 linhas, revertíveis
```

Atingidos? Agora a feature change pode acontecer com confiança normal de TDD.

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (monster method, bulleted vs snarled, scratch, single-goal, safe extraction)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — para mudanças COMPORTAMENTAIS, characterization é obrigatório (não basta safe extraction)
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — break-deps é pré-requisito quando helpers extraídos têm I/O
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — sketch dentro do monster ajuda a escolher onde extrair
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — quando monster > 300 linhas, sprout class para novo comportamento sem refatorar
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate distingue safe extraction (livre) de behavioral change (requer characterization)

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 22: "I Need to Change a Monster Method and I Can't Write Tests for It".*
