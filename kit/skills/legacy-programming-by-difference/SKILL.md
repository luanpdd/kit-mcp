---
name: legacy-programming-by-difference
description: Use ao adicionar comportamento variante a código legado via subclassing/composition (cap 8 Feathers) — ponte temporária quando refactor estrutural ainda não cabe. Modernização 2026…
---

# Legacy — Programming by Difference

## Quando usar

LLM carrega esta skill quando user precisa adicionar comportamento que coexiste com o existente (não substitui). Trigger phrases:

- "adicionar variante de [feature]"
- "feature flag para [behavior]"
- "comportamento alternativo para subset de users"
- "A/B test entre comportamentos"
- "programming by difference", "cap 8 Feathers"
- "subclass para mudar UMA coisa"

Carrega como atalho TDD em legacy quando refactor estrutural maior ainda não vale o custo.

## Regras absolutas

- **Programming by difference é PONTE TEMPORÁRIA**, não solução final. Funciona enquanto # variantes ≤ 3-4. Acima disso, refactor para strategy pattern ou similar.
- **Subclass-and-override** para herança; **composition** para frameworks/libs anti-herança. Padrão escolhido pela situação, não preferência teórica.
- **Cada variante é testada isoladamente.** Subclass tem suite própria. Composição tem fakes próprios.
- **Variants NÃO compartilham state mutável.** Estado é encapsulado dentro de cada variante. Compartilhamento via construtor (DI), nunca via globals.
- **Não bifurque o teste de cada variante.** Suite de characterization da base + suite de testes específicos da variante. Variante NÃO deve replicar tests da base.
- **Modernização 2026 — feature flags + A/B testing são aplicação direta.** GrowthBook, LaunchDarkly, Optimizely, Statsig — cada flag/variant é programming-by-difference em larga escala.

## Patterns canônicos

### Pattern 1: Subclass-and-override para variante simples

```ts
// ANTES — comportamento único
class CheckoutFlow {
  computeShipping(order: Order): number {
    return order.weightKg * 5  // R$ 5/kg flat
  }
}

// DEPOIS — variante regional via subclass (cap 8 original)
class CheckoutFlow {
  computeShipping(order: Order): number {
    return order.weightKg * 5
  }
}

class CheckoutFlowNorthRegion extends CheckoutFlow {
  override computeShipping(order: Order): number {
    return order.weightKg * 8  // norte: frete maior
  }
}

// Em tests
test('CheckoutFlowNorthRegion — shipping factor', () => {
  const flow = new CheckoutFlowNorthRegion()
  expect(flow.computeShipping({ weightKg: 2 } as Order)).toBe(16)
})
```

### Pattern 2: Composition variant (modernização — feature flags)

```ts
// Modernização 2026 — variant via DI (mais flexível que herança)
interface ShippingCalculator {
  compute(order: Order): number
}

class FlatShippingCalc implements ShippingCalculator {
  compute(order: Order): number { return order.weightKg * 5 }
}

class NorthShippingCalc implements ShippingCalculator {
  compute(order: Order): number { return order.weightKg * 8 }
}

class TieredShippingCalc implements ShippingCalculator {
  compute(order: Order): number {
    if (order.weightKg < 1) return 5
    if (order.weightKg < 5) return 12
    return order.weightKg * 4
  }
}

class CheckoutFlow {
  constructor(private shipping: ShippingCalculator = new FlatShippingCalc()) {}
  computeTotal(order: Order): number {
    return order.subtotal + this.shipping.compute(order)
  }
}

// Em produção — feature flag escolhe a variant
function getShippingCalcForUser(user: User): ShippingCalculator {
  const variant = featureFlags.getVariant('shipping-strategy', user.id)
  switch (variant) {
    case 'flat': return new FlatShippingCalc()
    case 'north': return new NorthShippingCalc()
    case 'tiered': return new TieredShippingCalc()
    default: return new FlatShippingCalc()
  }
}

const flow = new CheckoutFlow(getShippingCalcForUser(user))
```

**Modernização explícita:** programming-by-difference em 2004 = subclass-and-override; em 2026 = composition + feature flag service. Mesma essência (variante isolada, comportamento testado isolado), tooling diferente.

### Pattern 3: Quando preferir herança vs composição

```text
HERANÇA (subclass-and-override)
================================
- Variante TEMPORÁRIA (vai ser removida em < 6 meses)
- Variante muda UMA coisa específica
- Classe base já tem método virtual/protected acessível
- Você tem confiança que a refatoração estrutural virá depois

COMPOSIÇÃO (DI)
================
- Variante PERMANENTE (parte do design)
- Múltiplas variantes (3+) coexistem
- Variantes podem ser combinadas (ortogonais)
- Classe base não tem métodos override-friendly
- Aplicação moderna com feature flags
```

### Pattern 4: TDD em legacy via programming-by-difference

Workflow canônico para inserir feature em código legacy sem testes:

```text
1. Identificar onde a NEW feature mudaria comportamento
2. Criar SUBCLASS (TestableLegacyClass extends LegacyClass)
3. Override método relevante; nova lógica é puramente NA SUBCLASSE
4. Test da SUBCLASS isolada (cap 8 — TDD by difference)
5. Em produção, feature flag escolhe Legacy ou TestableLegacy
6. Quando feature provada, EVOLVE — mover lógica para classe base com flag

Trade-off: legado segue untested no caminho default; mas NEW feature
é totalmente coberta no caminho variant.
```

### Pattern 5: A/B test como programming-by-difference

```text
Cenário moderno: testar 2 algoritmos de recomendação.

VARIANT A (atual): TF-IDF
VARIANT B (novo):  Embedding similarity

Implementação:
  interface Recommender { recommend(user, items): Recommendation[] }
  class TFIDFRecommender implements Recommender { ... }
  class EmbeddingRecommender implements Recommender { ... }

  // Service layer
  class FeedService {
    constructor(private recommender: Recommender) {}
    getFeed(user: User): Recommendation[] { return this.recommender.recommend(user, ...) }
  }

  // Selector
  function getRecommender(user: User): Recommender {
    return featureFlags.getBoolean('use-embedding-recommender', user.id)
      ? new EmbeddingRecommender()
      : new TFIDFRecommender()
  }

  // Cada variant tem TESTES PRÓPRIOS isolados.
  // Service layer testado uma vez com fake recommender.
  // A/B test em prod compara métricas (CTR, dwell-time).
```

## Anti-patterns

### ANTI: subclassing uma vez = bom; subclassing 5 vezes = god hierarchy

```text
ANTI: criar TenantA extends Base, TenantB extends Base, ... 8 subclasses
      cada uma overriding 2-3 métodos.

PROBLEMA: hierarquia explode. Mudança na base afeta 8 subclasses.
          Combinações (TenantA + featureX) ficam impossíveis sem
          multiple inheritance.

CERTO: composition. Tenant é DTO/config, não subclass. Variantes
       comportamentais são strategies injetadas. Combinações
       ficam ortogonais.
```

### ANTI: variant compartilha state mutável com base

```text
ANTI: SubClass.method() faz this.parentField = newValue (mutating
      shared field).

PROBLEMA: state compartilhado quebra isolamento. Test variant
          afeta state. Concurrent uso vira corrupção.

CERTO: variant tem state PRÓPRIO (fields novos na subclass) ou
       recebe via DI. Base não é tocada.
```

### ANTI: programming-by-difference como solução final

```text
ANTI: depois de 1 ano, ainda tem 5 subclasses managing 5 user
      segments. Nenhuma refatoração estrutural.

PROBLEMA: ponte virou ponto fixo. Hierarquia frágil. Onboarding
          de 6º segment vira sprint inteira.

CERTO: programming-by-difference é PONTE. Após 3-6 meses, refatorar
       para strategy pattern, plugin architecture, ou similar.
       Hierarquia ≤ 3 subclasses; mais que isso = sinal de refactor.
```

### ANTI: feature flag sem deprecation

```text
ANTI: feature flag X criada há 2 anos, ainda em prod, ambos paths
      mantidos.

PROBLEMA: dead code maintenance dobrada. Bugs no path desligado
          escapam meses. Quem leu por último = X-2-anos-atrás.

CERTO: feature flags têm DATA DE EXPIRAÇÃO. Após launch full +
       30 dias safe, REMOVE flag (e variante perdedora). Cleanup
       é parte da feature, não opcional.
```

## Verificação

1. Subclass/variant testada isoladamente
2. Base class continua funcionando para usos default (compilação verde)
3. Variant não modifica state da base
4. Feature flag/seletor documentado se aplicável
5. Critério de remoção do flag/variant documentado (data ou métrica)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (subclass-and-override, programming-by-difference)
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — sprout method é caso especial (variant via composição)
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — subclass-and-override é Pattern 3 lá
- [`legacy-extract-class`](../legacy-extract-class/SKILL.md) — quando 5+ variantes virou hierarquia, refactor para strategy pattern via extract class
- [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — A/B test consume SLO events para validar variant superior

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 8: "How Do I Add a Feature?".*
*Modernização (2026):* Feature flags + A/B testing tooling como aplicação direta de programming-by-difference em escala.
