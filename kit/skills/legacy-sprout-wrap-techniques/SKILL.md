---
name: legacy-sprout-wrap-techniques
description: Use ao adicionar comportamento a código legado SEM tempo para colocar tudo sob test harness — Sprout Method, Sprout Class, Wrap Method, Wrap Class (cap 6 Feathers). Atalho seguro quando characterization custa demais.
---

# Legacy — Sprout / Wrap Techniques

## Quando usar

LLM carrega esta skill quando o user precisa adicionar comportamento a código legado e (a) o código alvo é grande/complexo demais para characterization completa AGORA, e (b) tempo está apertado. Trigger phrases:

- "adicionar feature em código sem testes"
- "não tenho tempo para refatorar tudo, mas preciso mudar"
- "sprout method", "sprout class", "wrap method", "wrap class"
- "cap 6 Feathers", "I don't have much time"
- "como adicionar nova lógica sem mexer no monstro?"
- "decoração / wrapper", "extract para método novo"

Carrega como alternativa pragmática a `legacy-characterization-tests` quando custo de characterization completa é proibitivo.

## Regras absolutas

- **Sprout/wrap NÃO substitui characterization para REFACTOR.** Aplica apenas quando você está ADICIONANDO comportamento. Refactor de código existente sem tests = sempre characterize first.
- **A nova lógica DEVE ser testável isoladamente.** O ponto inteiro do sprout é levantar comportamento para classe/método novo testável. Se a nova lógica continua amarrada ao legado, o sprout falhou.
- **Conexão ao legado é 1 linha (sprout) ou rename + 1 linha (wrap).** Mudança no código legado é mínima e mecânica. Reviewer consegue verificar visualmente que comportamento existente foi preservado.
- **Sprout é preferível a wrap.** Wrap muda a interface (rename original), aumenta surface de mudança. Sprout só ADICIONA, não modifica. Reach for sprout primeiro; wrap se sprout não couber.
- **Não tente "limpar enquanto está aqui".** Boy scout rule **nesta versão** = adicione novo limpo, não modifique velho. Misturar = single-goal violation.
- **Documente débito técnico criado.** Sprout/wrap explicitamente DEIXAM código legado untested. Crie ticket/TODO para characterization futura. Sem doc = débito invisível.

## Patterns canônicos

### Pattern 1: Sprout Method — quando preferir

Adicione comportamento novo coeso, separável do legado, em método novo testável. Conecte por 1 linha.

```ts
// Cenário: precisamos adicionar "auditoria de tentativa de fraude"
// no método legado processOrder() que tem 200 linhas e zero testes.

// ANTES — método legado intocado
class OrderProcessor {
  processOrder(order: Order): Result {
    // 200 linhas de lógica legada e não-testada
    // ...
    return result
  }
}

// DEPOIS — sprout method (NOVO, testado isolado)
class OrderProcessor {
  processOrder(order: Order): Result {
    // 200 linhas de lógica legada e não-testada (intocadas)

    // ↓ INSERÇÃO ÚNICA — 1 linha — chama sprout testável
    auditFraudAttempt(order, this.fraudLogger)

    // ...resto das 200 linhas legadas (intocadas)
    return result
  }
}

// Sprout method — fora da classe legada (preferred), com test próprio
export function auditFraudAttempt(order: Order, logger: FraudLogger): void {
  if (order.amount > 10000 && order.country !== order.cardCountry) {
    logger.flag(order.id, 'high-value-cross-border', { amount: order.amount })
  }
  if (order.attempts > 3) {
    logger.flag(order.id, 'retry-spike', { attempts: order.attempts })
  }
}

// Test isolado
test('auditFraudAttempt — high value cross-border', () => {
  const logger = new FakeFraudLogger()
  auditFraudAttempt(
    { id: 'O1', amount: 15000, country: 'BR', cardCountry: 'US', attempts: 1 },
    logger,
  )
  expect(logger.flags).toEqual([{ id: 'O1', reason: 'high-value-cross-border', meta: { amount: 15000 } }])
})
```

**Por que funciona:** o método legado de 200 linhas continua untested, mas a NOVA lógica de fraud audit está completamente coberta. Refactor futuro do legado vai herdar o sprout intacto.

**Quando preferir:** lógica nova é coesa, ≤ 30-50 linhas, e pode receber dados via parâmetros (não precisa de side effects do legado).

### Pattern 2: Sprout Class — quando sprout method cresce

Lógica nova é grande (> 30 linhas) ou tem múltiplos métodos coesos. Promova para classe nova com test harness próprio.

```ts
// Cenário: fraud audit cresceu — agora precisa de retry detection,
// velocity checks, blacklist lookup, scoring. Vira módulo coeso.

// Sprout CLASS (não mais método solto)
export class FraudAuditor {
  constructor(
    private logger: FraudLogger,
    private blacklist: BlacklistService,
    private clock: () => Date = () => new Date(),
  ) {}

  audit(order: Order): FraudAuditResult {
    const flags: string[] = []

    if (this.isHighValueCrossBorder(order)) flags.push('high-value-cross-border')
    if (this.isRetrySpike(order)) flags.push('retry-spike')
    if (this.isBlacklisted(order)) flags.push('blacklisted-customer')

    flags.forEach(f => this.logger.flag(order.id, f, { ts: this.clock() }))

    return {
      score: this.computeScore(flags),
      flags,
    }
  }

  private isHighValueCrossBorder(o: Order): boolean { /* ... */ }
  private isRetrySpike(o: Order): boolean { /* ... */ }
  private isBlacklisted(o: Order): boolean { /* ... */ }
  private computeScore(flags: string[]): number { /* ... */ }
}

// Conexão ao legado — apenas 2 linhas
class OrderProcessor {
  private fraudAuditor = new FraudAuditor(this.logger, this.blacklistSvc)

  processOrder(order: Order): Result {
    // ... legado intocado ...
    const fraudResult = this.fraudAuditor.audit(order)  // ← conexão
    if (fraudResult.score > 80) throw new FraudError(fraudResult.flags)
    // ... legado intocado ...
  }
}
```

**Quando preferir:** múltiplos behaviors relacionados, dependências múltiplas (clock, blacklist, logger), suite de testes própria justifica a classe.

### Pattern 3: Wrap Method — quando precisa MODIFICAR pré/pós condição

Sprout só adiciona comportamento DURANTE. Quando a mudança é "antes" ou "depois" de TODO o método existente, wrap é mais limpo.

```ts
// Cenário: precisamos enviar notificação para auditoria DEPOIS que
// processOrder() roda, com sucesso ou erro.

// PASSO 1 — rename mecânico (refactor IDE-assisted, zero risco)
class OrderProcessor {
  processOrderLegacy(order: Order): Result {  // ← renamed
    // 200 linhas de lógica legada — intocadas
  }
}

// PASSO 2 — novo método com nome original, wrappando o legado
class OrderProcessor {
  processOrder(order: Order): Result {
    // pré-condição NOVA (testável)
    this.notifyAuditStart(order)

    let result: Result
    try {
      result = this.processOrderLegacy(order)  // ← chamada ao legado
      this.notifyAuditSuccess(order, result)   // pós-condição NOVA
    } catch (e) {
      this.notifyAuditFailure(order, e)        // pós-condição NOVA
      throw e
    }
    return result
  }

  processOrderLegacy(order: Order): Result {
    // 200 linhas de lógica legada — intocadas
  }

  // sprout methods auxiliares (testáveis)
  private notifyAuditStart(o: Order) { /* ... */ }
  private notifyAuditSuccess(o: Order, r: Result) { /* ... */ }
  private notifyAuditFailure(o: Order, e: Error) { /* ... */ }
}

// Test do wrap (não testa o legado)
test('processOrder — notifies start and success on happy path', () => {
  const proc = makeProcessor({ legacyResult: { id: 'O1' } })  // fake do legacy
  proc.processOrder({ id: 'O1' })
  expect(proc.notifications).toEqual([
    { kind: 'start', orderId: 'O1' },
    { kind: 'success', orderId: 'O1' },
  ])
})
```

**Quando preferir:** mudança é estruturalmente "before/after" todo o legado, OR você precisa interceptar exception flow.

**Trade-off:** clientes externos chamando o método podem precisar de aviso (versionamento, deprecation) se a mudança comportamental afeta contrato. Sprout method não tem esse problema.

### Pattern 4: Wrap Class — wrap method em escala de classe

Decorator pattern aplicado pragmaticamente. Toda a classe ganha comportamento adicional sem modificar a original.

```ts
// Cenário: precisamos adicionar caching transparente a TODOS os métodos
// de PostgresOrderRepository (que não tem testes).

// ANTES — classe legada
class PostgresOrderRepository implements OrderRepository {
  findById(id: string): Order { /* DB query */ }
  save(order: Order): void { /* DB write */ }
  findRecent(n: number): Order[] { /* DB query */ }
}

// DEPOIS — wrap class (NOVA, testada)
class CachedOrderRepository implements OrderRepository {
  constructor(
    private inner: OrderRepository,  // ← legado vai aqui
    private cache: Cache,
  ) {}

  findById(id: string): Order {
    const cached = this.cache.get(`order:${id}`)
    if (cached) return cached
    const order = this.inner.findById(id)  // delega ao legado
    this.cache.set(`order:${id}`, order, 60_000)
    return order
  }

  save(order: Order): void {
    this.inner.save(order)
    this.cache.invalidate(`order:${order.id}`)
  }

  findRecent(n: number): Order[] {
    return this.inner.findRecent(n)  // sem cache (mais difícil)
  }
}

// Em produção
const repo = new CachedOrderRepository(new PostgresOrderRepository(db), cache)

// Em teste — testa CachedOrderRepository com fake inner
test('CachedOrderRepository — cache hit avoids inner call', () => {
  const inner = new FakeOrderRepository()
  inner.save({ id: 'O1' } as Order)
  const cached = new CachedOrderRepository(inner, new InMemoryCache())
  cached.findById('O1')
  cached.findById('O1')
  expect(inner.findByIdCallCount).toBe(1)  // segundo veio do cache
})
```

**Quando preferir:** comportamento atravessa todos/maioria dos métodos da classe (caching, logging, audit, retry), e clientes esperam mesma interface.

### Pattern 5: Decision tree — qual técnica?

```text
Você está ADICIONANDO comportamento (não modificando)?
├─ Não → use legacy-characterization-tests + legacy-seams-and-test-harness
└─ Sim →
   Comportamento novo é coeso e separável?
   ├─ Sim →
   │  Tamanho do comportamento novo?
   │  ├─ ≤ 30 linhas, 1 responsabilidade → SPROUT METHOD
   │  ├─ > 30 linhas OU múltiplas responsabilidades → SPROUT CLASS
   │  └─ Atravessa N métodos da classe legada → WRAP CLASS
   └─ Não, é uma transformação no fluxo existente →
      Mudança é "antes/depois" do método inteiro?
      ├─ Sim → WRAP METHOD
      └─ Não → essa mudança REQUER characterization. Volte ao caminho normal.
```

### Pattern 6: Effort budget de sprout/wrap

| Técnica | Custo típico | Cobertura criada | Cobertura herdada |
|---|---|---|---|
| **Sprout Method** | 30 min - 2h | 100% do novo | 0% do legado |
| **Sprout Class** | 2-6h | 100% do novo | 0% do legado |
| **Wrap Method** | 1-3h | 100% do wrap (novo + delegação) | 0% do legado interior |
| **Wrap Class** | 4-8h | 100% do wrapper | 0% do delegado |

Versus characterization completa do legado (semanas), sprout/wrap entrega 100% do novo em horas. Trade-off: legado continua untested.

### Pattern 7: Documentar débito explicit

Sempre que aplicar sprout/wrap, criar TODO/ticket para characterization futura:

```ts
// PT-BR: comentário canônico no ponto de inserção do sprout
class OrderProcessor {
  processOrder(order: Order): Result {
    // ... legado intocado ...

    // [legacy-debt #issue-1234] sprout — auditFraudAttempt testado isolado;
    // método circundante (processOrder) ainda untested. Characterization
    // completa enquanto refactor maior em Q3/2026.
    auditFraudAttempt(order, this.fraudLogger)

    // ... legado intocado ...
  }
}
```

**Sem doc, débito é invisível** — equipe esquece, próxima pessoa pensa que "está testado". Doc + ticket cria responsabilidade explícita.

## Anti-patterns

### ANTI: sprout que mexe no legado "só um pouquinho"

```text
ANTI: "vou inserir o sprout, e já que estou aqui, ajusto essa
       variável local para passar para o sprout".

PROBLEMA: cada edição no legado é risco. Você não tem teste para detectar
          regressão. "Ajustar variável" pode quebrar branch raro.

CERTO: passe APENAS o que está em escopo no ponto de inserção. Se
       precisa de mais, aceite que o sprout não cabe ali — escolha
       outro ponto de inserção OU technique diferente.
```

### ANTI: sprout que faz I/O direto

```text
ANTI: function auditFraudAttempt(order) {
        fetch('https://internal-fraud-api/...', {...})  // ← I/O dentro
        log.warn(...)                                    // ← I/O dentro
      }

PROBLEMA: sprout vira intestável. Você criou o problema do legado
          numa nova localização.

CERTO: dependências passadas via parameter ou constructor injection:
       function auditFraudAttempt(order, logger, fraudApi) { ... }
       Em produção: chama com reais. Em teste: chama com fakes.
```

### ANTI: wrap method esquecendo error path

```text
ANTI: function processOrder(o) {
        notifyStart(o)
        const r = processOrderLegacy(o)
        notifySuccess(o, r)
        return r
      }
       — sem try/catch.

PROBLEMA: quando legacy throw, notifyStart já rodou mas notifyFailure
          NÃO. Comportamento parcial. Auditoria fica incoerente.

CERTO: wrap method SEMPRE tem try/finally explícito quando
       pré-condição roda I/O ou tem efeito observável:
       try { r = legacy(o); notifySuccess(o, r); return r }
       catch (e) { notifyFailure(o, e); throw e }
```

### ANTI: sprout class mas pré/pós condição vai para sprout

```text
ANTI: SproutFraudAuditor.audit() retorna result E também imprime log
      com timestamp da chamada.

PROBLEMA: pré/pós-condição cross-cuts. Reviewer não vê em uma chamada
          o que muda. Hidden side effects.

CERTO: pré/pós são responsabilidades do CALLER (legacy). Sprout faz
       UMA coisa, retorna resultado puro, caller decide o que fazer
       (incluindo logar). Mantém sprout testável sem mocks de log.
```

### ANTI: usar wrap class quando sprout method bastaria

```text
ANTI: criar ClassWrapperOrderProcessor para adicionar audit em UM
      método.

PROBLEMA: surface change desproporcional. Outros 9 métodos da classe
          ganham wrap inútil. Imports espalhados precisam mudar.

CERTO: comece pequeno. Sprout method primeiro. Promove a sprout class
       quando comportamento cresce. Promove a wrap class quando
       atravessa N métodos. Não comece com wrap class.
```

### ANTI: pular ticket de débito técnico

```text
ANTI: aplica sprout, sem comment, sem ticket. "Vou lembrar de testar
       o legado depois".

PROBLEMA: 6 meses depois, ninguém sabe que processOrder() ainda é
          untested. Próxima pessoa edita legado direto, regression
          slips, incident.

CERTO: comment canônico no sprout point + ticket linkado. Sem isso,
       débito é invisível e a chance de characterization futura cai
       para perto de zero.
```

## Verificação

Antes de aprovar PR com sprout/wrap:

1. **Técnica certa para a mudança** — sprout (add) vs wrap (transform pre/post)
2. **Escopo da mudança no legado é mínimo** — sprout: 1 linha; wrap: rename + chamada
3. **Sprout/wrap testa isolado** — fakes para todas dependências, sem I/O real
4. **Coverage do novo comportamento** — 100%, não 80% (é código novo, sem desculpa)
5. **Error path coberto em wrap** — try/catch explícito quando aplicável
6. **TODO/ticket de débito criado** — comment canônico + linked issue
7. **Reviewer pode verificar legado intacto** — diff do legado é apenas rename ou 1 inserção

## Limiar de "sprout/wrap apropriado"

```text
Comportamento ADICIONADO:    sim (não modificado)
Lógica nova testável isolada: sim (DI injected, sem I/O direto)
Conexão ao legado:           ≤ 1-2 linhas em sprout, rename+1 em wrap
Cobertura do novo:           100%
Custo de characterization completa: documentado como > 5× custo do sprout
Débito técnico:              ticket criado, comment canônico no código
```

Se algum critério falha → sprout/wrap não é o caminho certo. Escolha outro.

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário canônico (sprout method/class, wrap method/class)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — para refactor (não adicionar), characterization é mandatório
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — sprout class testável requer DI; técnicas do cap 25 dão a base
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — escolha do ponto de inserção do sprout informada por effect sketch
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — em monster method, sprout cria pé-de-cabra para refactor incremental
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate libera sprout/wrap se cobertura do NOVO = 100%, mesmo sem characterization do legado

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 6: "I Don't Have Much Time and I Have to Change It".*
