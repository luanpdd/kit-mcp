---
name: legacy-seams-and-test-harness
description: Use ao identificar pontos de extensão (seams) em código não-testável e aplicar uma das ~24 dependency-breaking techniques (cap 25 Feathers) para colocar código sob test harness.
---

# Legacy — Seams & Test Harness

## Quando usar

LLM carrega esta skill ao tentar testar código que tem dependências incontroláveis (DB real, HTTP, clock, FS, framework objects). Trigger phrases:

- "como testar essa função sem rodar [DB/HTTP]?"
- "quebrar dependência de", "injetar fake", "mock essa classe"
- "extract interface", "subclass and override"
- "seam", "test harness"
- "construtor faz I/O", "singleton bloqueia teste"
- "cap 25 Feathers", "dependency-breaking"
- "esse código não é testável"

Carrega antes de characterization tests (que podem requerer break-dep primeiro).

## Regras absolutas

- **Seam = lugar onde se altera comportamento sem editar lá.** Sem seam, código está fundido — substituição em teste é impossível sem cirurgia invasiva.
- **3 tipos de seam, em ordem de preferência: object > link > preprocessing.** Object (polimorfismo) é o mais comum em código moderno. Link (linker substitution) para código procedural. Preprocessing (macros C/C++) é último recurso.
- **Toda seam tem enabling point.** Mecanismo CONCRETO que ativa substituição: subclasse, interface, build flag, parameter. Sem enabling point, "seam" é só wishful thinking.
- **Pequenas mudanças primeiro, sempre.** Antes de "redesenhar para testabilidade", aplique a técnica MAIS LOCAL que destrava 1 teste. Cap 25 lista ~24 técnicas — escolha a menor.
- **Não introduza interfaces especulativas.** "Vou criar `IRepository` para o caso de mudar de DB" sem esse caso real = over-engineering. Extract Interface APENAS quando precisa de seam para teste.
- **Subclass and override é seguro.** Default em OO. Funciona em qualquer linguagem com herança virtual. Use quando técnica mais "pura" exige refactor caro.
- **Static setter para singleton tem trade-off.** Quebra encapsulation, exige teardown, não é thread-safe. Aplique apenas quando alternativas custam dias de trabalho.
- **Preserve compilação a cada commit.** Cada técnica do cap 25 é mecânica e pequena. Se compilation/test quebra entre commits, você está fazendo passos grandes demais.

## Patterns canônicos

### Pattern 1: 3 tipos de seam

```text
TIPO 1 — OBJECT SEAM (preferred)
================================
Local: chamada de método polimórfico, construtor recebe interface
Enabling point: classe substituível (interface, subclass, duck typing)
Exemplo:
  class Order {
    constructor(private repo: OrderRepository) {} // ← seam
    save() { this.repo.persist(this) }
  }
  // Em teste: passa FakeOrderRepository

TIPO 2 — LINK SEAM
==================
Local: chamada estática, função externa, biblioteca dinâmica
Enabling point: classpath/library path/loader substitution
Exemplo (Node):
  // production: require('./real-db')
  // test: require('./fake-db') via jest mock
Exemplo (Java):
  // production: log4j-1.2.17.jar no classpath
  // test: log4j-test.jar (no-op) no test classpath

TIPO 3 — PREPROCESSING SEAM
===========================
Local: macros, conditional compilation
Enabling point: build flag (-D), #ifdef
Exemplo (C/C++):
  #ifdef TESTING
  #define HTTP_GET fake_http_get
  #else
  #define HTTP_GET real_http_get
  #endif
Raríssimo fora de C/C++/legacy embedded.
```

### Pattern 2: Decision tree de técnica do cap 25

```text
Dependency está bloqueando teste. Que técnica aplicar?

A linguagem suporta polimorfismo (OO)?
├─ Sim →
│  ├─ A dependência é uma classe e eu posso modificar a CLASSE CONSUMIDORA?
│  │  ├─ Sim → PARAMETERIZE CONSTRUCTOR (default-arg para retro-compat)
│  │  │       OR PARAMETERIZE METHOD (se uso é local a 1 método)
│  │  └─ Não → Posso modificar a SUPERCLASSE ou criar uma?
│  │           ├─ Sim → SUBCLASS AND OVERRIDE METHOD
│  │           │       (criar TestableFoo extends Foo, override método)
│  │           └─ Não → EXTRACT INTERFACE (se classe original aceitar)
│  ├─ A dependência é um SINGLETON / global?
│  │  ├─ Sim → INTRODUCE STATIC SETTER (com teardown obrigatório)
│  │  │       OR ENCAPSULATE GLOBAL REFERENCES (proxy method)
│  ├─ A dependência é tipo de framework (HttpServletRequest, Context)?
│  │  ├─ Sim → ADAPT PARAMETER (envolver em interface menor)
│  ├─ Construtor da classe é caro/quebrado?
│  │  ├─ Sim → EXPOSE STATIC METHOD (testar lógica sem instanciar)
│  └─ Método não pode ser overridden (final/sealed/private)?
│     ├─ Sim → EXTRACT AND OVERRIDE METHOD (extrair para método protected, então override)
└─ Não (C, COBOL, código procedural) →
   ├─ Função é direta (extern void foo())? → LINK SEAM (link com fake)
   ├─ Função é ponteiro? → REPLACE FUNCTION POINTER (apontar para fake em teste)
   └─ Função é macro? → DEFINITION COMPLETION (override em test config)
```

### Pattern 3: Subclass and Override (a técnica universal)

```ts
// Antes — não testável: chama API real no método
class PaymentProcessor {
  process(order: Order): PaymentResult {
    const apiResult = fetch('https://api.stripe.com/charges', {  // ← bloqueia teste
      method: 'POST',
      body: JSON.stringify({ amount: order.total }),
    })
    return parseStripeResponse(apiResult)
  }
}

// Depois — extrair chamada para método protected, subclassificar em teste
class PaymentProcessor {
  process(order: Order): PaymentResult {
    const apiResult = this.callStripe(order)  // ← seam
    return parseStripeResponse(apiResult)
  }

  protected callStripe(order: Order): StripeResponse {
    return fetch('https://api.stripe.com/charges', {
      method: 'POST',
      body: JSON.stringify({ amount: order.total }),
    })
  }
}

// Em teste
class TestablePaymentProcessor extends PaymentProcessor {
  protected callStripe(order: Order): StripeResponse {
    return { id: 'ch_fake_123', status: 'succeeded' }  // ← fake
  }
}

test('process — typical order', () => {
  const proc = new TestablePaymentProcessor()
  const result = proc.process({ total: 100 })
  expect(result.status).toBe('succeeded')
})
```

**Por que é universal:** funciona em qualquer linguagem OO sem refactor estrutural. Não muda assinatura pública. Outras chamadas (de produção) continuam intactas.

### Pattern 4: Extract Interface (quando subclass não cabe)

```ts
// Antes — classe concreta acoplada
class OrderService {
  constructor(private db: PostgresClient) {}  // ← acoplado a Postgres
  save(order: Order) { this.db.execute('INSERT INTO orders ...') }
}

// Depois — extrair interface mínima
interface OrderRepository {
  save(order: Order): void
}

class PostgresOrderRepository implements OrderRepository {
  constructor(private db: PostgresClient) {}
  save(order: Order) { this.db.execute('INSERT INTO orders ...') }
}

class OrderService {
  constructor(private repo: OrderRepository) {}  // ← agora interface
  save(order: Order) { this.repo.save(order) }
}

// Em teste
class FakeOrderRepository implements OrderRepository {
  saved: Order[] = []
  save(order: Order) { this.saved.push(order) }
}

test('OrderService.save', () => {
  const repo = new FakeOrderRepository()
  const svc = new OrderService(repo)
  svc.save({ id: 'O1' })
  expect(repo.saved).toHaveLength(1)
})
```

**Quando preferir:** quando há múltiplas implementações de fato (Postgres + Mongo + memória) ou interface terá uso real além de teste. Não introduza interface só por teste — overhead.

### Pattern 5: Parameterize Constructor / Method

```ts
// Antes — dependência criada dentro
class EmailNotifier {
  notify(user: User, msg: string) {
    const sender = new SmtpSender()  // ← criado interno, intestável
    sender.send(user.email, msg)
  }
}

// Depois (parameterize METHOD se uso é local)
class EmailNotifier {
  notify(user: User, msg: string, sender: Sender = new SmtpSender()) {
    sender.send(user.email, msg)
  }
}
// Em teste: notifier.notify(user, msg, fakeSender)

// Depois (parameterize CONSTRUCTOR se sender é usado em N métodos)
class EmailNotifier {
  constructor(private sender: Sender = new SmtpSender()) {}
  notify(user: User, msg: string) { this.sender.send(user.email, msg) }
  notifyBatch(users: User[], msg: string) { users.forEach(u => this.sender.send(u.email, msg)) }
}
// Em teste: new EmailNotifier(fakeSender)
```

**Default-arg preserva retro-compat:** chamadores antigos continuam funcionando sem mudança.

### Pattern 6: Adapt Parameter (frameworks complexos)

```java
// Antes — depende de HttpServletRequest (impossível instanciar em teste)
public class LoginHandler {
    public void handle(HttpServletRequest req) {  // ← Servlet API, complexa
        String user = req.getParameter("user");
        String pass = req.getParameter("pass");
        // ... lógica
    }
}

// Depois — interface mínima específica do que o método usa
interface LoginParams {
    String getUser();
    String getPass();
}

public class LoginHandler {
    public void handle(LoginParams params) {  // ← interface enxuta
        String user = params.getUser();
        String pass = params.getPass();
        // ... lógica
    }
}

// Adapter para produção
public class ServletLoginParams implements LoginParams {
    private final HttpServletRequest req;
    public ServletLoginParams(HttpServletRequest req) { this.req = req; }
    public String getUser() { return req.getParameter("user"); }
    public String getPass() { return req.getParameter("pass"); }
}

// Em teste
LoginParams params = new LoginParams() {
    public String getUser() { return "alice"; }
    public String getPass() { return "secret123"; }
};
handler.handle(params);
```

**Insight:** `HttpServletRequest` tem 50+ métodos; você usa 2. `LoginParams` expõe só os 2 → trivial fakear.

### Pattern 7: Encapsulate Global References

```ts
// Antes — global direto
class ReportGenerator {
  generate(): Report {
    const config = globalConfig.get('report')  // ← global, untestable
    return new Report(config)
  }
}

// Depois — encapsulado em método protected
class ReportGenerator {
  generate(): Report {
    const config = this.getConfig('report')  // ← seam
    return new Report(config)
  }
  protected getConfig(key: string): any {
    return globalConfig.get(key)
  }
}

// Em teste — subclass and override
class TestableReportGenerator extends ReportGenerator {
  protected getConfig(key: string): any {
    return { format: 'json', detail: 'minimal' }  // fixo em teste
  }
}
```

**Combina técnicas:** encapsulate + subclass-and-override → 2 minutos de refactor, 0 risco.

### Pattern 8: Test harness layout canônico

```text
project/
├── src/
│   └── domain/
│       ├── PaymentProcessor.ts       ← código de produção
│       └── OrderService.ts
├── test/
│   ├── fakes/                        ← fakes reusáveis entre testes
│   │   ├── FakePaymentGateway.ts
│   │   ├── FakeOrderRepository.ts
│   │   ├── FakeClock.ts
│   │   ├── FakeLogger.ts
│   │   └── FakeQueue.ts
│   ├── characterization/             ← snapshots imutáveis (cap 13)
│   │   ├── PaymentProcessor/
│   │   │   ├── typical-order.snap
│   │   │   ├── boundary-large-order.snap
│   │   │   └── invalid-card.snap
│   │   └── OrderService/
│   ├── unit/                         ← testes pós-characterization
│   └── helpers/
│       └── makeTestableProcessor.ts  ← factory para processor com fakes
└── package.json
```

**Princípio:** fakes em diretório próprio, reusados entre tests. Snapshots em diretório próprio, separados de unit tests pós-refactor. Sem fakes em-line.

### Pattern 9: Effort budget para break-deps

| Técnica | Quando preferir | Esforço típico | Reversibilidade |
|---|---|---|---|
| **Subclass and Override Method** | Default em OO; método já é virtual | 15-30 min | Trivial (só apagar subclass) |
| **Extract and Override Method** | Método final/sealed/inline | 30-60 min | Fácil |
| **Parameterize Method** | Dependência usada em 1 método; default-arg viável | 15-30 min | Trivial |
| **Parameterize Constructor** | Dependência usada em N métodos; default no constructor | 30-90 min | Médio (todos new sites) |
| **Extract Interface** | Múltiplas implementações faz sentido | 1-3 horas | Médio |
| **Adapt Parameter** | Framework type complexo; interface mínima cabe | 30-60 min | Fácil |
| **Encapsulate Global References** | Global usado em 1-3 lugares | 30-60 min | Trivial |
| **Introduce Static Setter** | Singleton legacy, cirurgia maior intransitável | 60-120 min | Difícil (thread-safety risk) |
| **Expose Static Method** | Construtor problemático; método pode ser puro | 30-60 min | Trivial |
| **Break Out Method Object** | Método monstro com muitas locals | 2-4 horas | Difícil (maior surface change) |

**Heurística:** se técnica escolhida custa > 4h, há outra técnica mais barata. Pause, escolha de novo.

## Anti-patterns

### ANTI: redesign massivo "para testabilidade"

```text
ANTI: "esse código não é testável, vou redesenhar a arquitetura inteira
       para hexagonal antes de qualquer test".

PROBLEMA: redesign massivo = mudança grande sem safety net (justamente
          porque não há testes). Você fez exatamente o que queria evitar
          — edit and pray em escala épica. Resultado típico: mudança
          cancelada após 2 semanas, código pior do que começou.

CERTO: pequenas técnicas locais (cap 25). Subclass and override em 30
       min destrava 1 teste. Acumule 10 destes = test harness funcional
       sem refactor estrutural. Refactor maior, se realmente for
       necessário, vem DEPOIS com tests no lugar.
```

### ANTI: extract interface especulativo

```text
ANTI: "Vou criar IPaymentRepository para o caso de adicionar Stripe
       depois". Sem caso real, sem teste demandando.

PROBLEMA: interface vazia espalhada pelo código. Cognitive load para
          leitores ("é apenas o repo concreto, why a interface?").
          Refactor real (quando finalmente vem) requer mudar 30 imports
          desnecessariamente.

CERTO: extract interface APENAS quando: (a) há fake/mock real demandando
       em teste; OR (b) segunda implementação real está sendo escrita
       AGORA. YAGNI aplicado.
```

### ANTI: introduce static setter sem teardown

```text
ANTI: TestSetUp() { Foo.setInstance(fake); } // ← sem TearDown

PROBLEMA: próximo test que NÃO seta singleton recebe o fake do anterior.
          Test order matters. CI passa local, falha em ordem random.
          Worst kind of flaky.

CERTO: SEMPRE teardown explicit:
  TestTearDown() { Foo.setInstance(null); }  // OR original
  ou afterEach(() => { Foo.setInstance(originalSingleton); });
       Documentar contrato no setter: "test-only; teardown obrigatório".
```

### ANTI: criar fake "completo" replicando a real

```text
ANTI: FakePostgresClient implementa TODAS as queries possíveis com
      lógica SQL parser embutido. 800 linhas de fake.

PROBLEMA: fake virou outro produto. Mantenance dobrada. Bug no fake
          masquerades real bugs. Convergência fake-real é asintótica
          mas nunca chega.

CERTO: fake mínimo — só os métodos que ESTE teste exercita, com
       comportamento mais simples possível. `FakeRepo.save` apenas
       guarda em array, `FakeRepo.findById` faz lookup linear. 30
       linhas. Se outro test precisa mais, adiciona naquele test, não
       no fake global.
```

### ANTI: testar via static-mock all-the-things

```text
ANTI: jest.mock(...) cobrindo todo módulo real, sem injetar nada.

PROBLEMA: implícito. Reviewer não sabe o que está mockado vs real.
          Test passa por motivos errados. Refactor que muda APENAS
          import path quebra todos os mocks (sem mudança real).

CERTO: parameterize constructor/method (DI manual). Dependência
       explícita na assinatura. Test é claro sobre o que substitui.
       Refactor de implementação não quebra test (quebra só se
       interface muda — que é o ponto).
```

### ANTI: subclass-override em método PRIVATE

```text
ANTI: tentar override de método privado em teste — não compila / não
      executa override. "Vou usar reflection".

PROBLEMA: reflection burla encapsulation, frágil, geralmente proibido
          por linter / scanner de seg.

CERTO: extract and override — extrair lógica para método PROTECTED,
       então override em subclass de teste. 5 min de trabalho. Outra
       opção: parameterize method para passar comportamento como
       function/strategy.
```

## Verificação

Antes de declarar dependency-breaking completo:

1. **Seam identificado** — tipo (object/link/preprocessing) + enabling point concreto documentado
2. **Técnica do cap 25 escolhida** — com rationale (por que essa, não as outras)
3. **Compilação verde a cada commit** — passos pequenos e mecânicos
4. **Esforço respeita budget** — se técnica passou de 4h, reescolha
5. **Sem interface especulativa** — toda interface tem fake real demandando AGORA
6. **Static setter (se usado) tem teardown** — em afterEach/finally
7. **Fakes mínimos** — só métodos exercitados pelo teste atual
8. **Test compilou e rodou verde** — fim do exercício, harness funcional

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário canônico (seam, fake, sensing, separation)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — característica AFTER break-deps; juntos formam fluxo completo
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — qual seam? effect sketch identifica
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — alternativa quando break-dep custa mais que sprout/wrap
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — monster method requer break-dep ANTES de extract method seguro
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate consume seam analysis para liberar refactor

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 3: "Sensing and Separation" + Cap 4: "The Seam Model" + Cap 9-10: "I Can't Get This Class/Method Into a Test Harness" + Cap 25: "Dependency-Breaking Techniques" (catálogo).*
