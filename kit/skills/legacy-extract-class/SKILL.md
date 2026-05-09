---
name: legacy-extract-class
description: Use ao identificar classes "muito grandes" (cap 20 Feathers) com responsibility hot spots — extract class para separar responsabilidades. Aplicado a domain classes Supabase (OrderService → OrderValidator + Repository + Notifier).
---

# Legacy — Extract Class

## Quando usar

LLM carrega esta skill quando uma classe ultrapassa thresholds de tamanho/complexidade ou tem múltiplas responsabilidades distintas. Trigger phrases:

- "essa classe é grande demais", "this class is too big"
- "extract class", "extrair classe", "split class"
- "responsibility hot spot", "single responsibility"
- "cap 20 Feathers"
- "OrderService faz validação, persistência E notificação"
- arquivo de classe > 300 linhas com múltiplos métodos públicos não-relacionados

## Regras absolutas

- **Heurísticas de "classe muito grande":** > 300 linhas; > 10 fields; > 12 métodos públicos; > 3 responsabilidades distintas (hot spots). Pelo menos 2 dos 4 = candidato.
- **Extract class != extract method.** Extract method move bloco contíguo dentro da mesma classe; extract class move responsabilidade INTEIRA para classe nova com state próprio.
- **Identifique o "hot spot" primeiro.** Cluster de fields + métodos que se referenciam mais entre si do que com o resto da classe = unidade extraível.
- **Compilação verde a cada commit.** Pequenos passos: (1) criar classe nova vazia; (2) mover 1 field; (3) ajustar callers; (4) repetir.
- **Não introduza herança especulativa.** Extract class produz composição (classe original tem field do tipo extraído); herança só se faz parte do design intencional.
- **Aplicação canônica em Supabase domain classes:** `OrderService` que faz validação + persistência + notificação + audit → extract para `OrderValidator`, `OrderRepository`, `OrderNotifier`, `OrderAuditor` (modernização: SRP em layer de domínio).

## Patterns canônicos

### Pattern 1: Detecção de hot spots

```text
Para cada field e método da classe alvo:
  Crie matriz de coupling — quem usa quem.
  Cluster fields/métodos que SE REFERENCIAM mais.
  Cluster com 2+ fields E 3+ métodos = hot spot extraível.

Exemplo — OrderService 450 linhas:
  Cluster A (validação):
    fields: validators[], strictMode
    methods: validate, validateField, addCustomValidator
  Cluster B (persistência):
    fields: db, cache
    methods: save, findById, findRecent
  Cluster C (notificação):
    fields: notifier, templateEngine
    methods: notifyCustomer, formatNotification

  → 3 hot spots → 3 extract class candidatos.
```

### Pattern 2: Workflow de extract class

```text
1. Criar classe nova vazia com nome descritivo
   class OrderValidator {}

2. Mover 1 field (e seus referentes diretos)
   - Mover field
   - Adicionar field correspondente na classe original APONTANDO para nova
   - Ajustar todos os usos (this.X → this.validator.X)
   - Compilar verde

3. Mover 1 método relacionado
   - Mover método (com edits triviais para acessar fields da classe nova)
   - Atualizar callers
   - Compilar verde

4. Repetir para cada field/método do hot spot
5. Adicionar test harness para classe nova (agora menor → fácil testar)
6. (Opcional) extract interface se existem múltiplas implementações
```

### Pattern 3: Aplicação canônica Supabase

```ts
// ANTES — OrderService 450 linhas, 4 responsabilidades
class OrderService {
  constructor(private db: SupabaseClient, private notifier: SmtpClient) {}

  // validation
  validate(order: Order): ValidationResult { /* 80 linhas */ }
  validateField(field: string, value: any) { /* ... */ }

  // persistence
  async save(order: Order) { await this.db.from('orders').insert(...) }
  async findById(id: string) { return this.db.from('orders').select().eq('id', id) }

  // notification
  async notifyCustomer(order: Order) { /* template + smtp send */ }

  // audit
  async logAudit(action: string, order: Order) { /* db audit_log insert */ }

  // orchestration (entrypoint)
  async place(order: Order): Promise<Result> {
    const v = this.validate(order)
    if (!v.ok) return { error: v.errors }
    await this.save(order)
    await this.notifyCustomer(order)
    await this.logAudit('placed', order)
    return { ok: true }
  }
}

// DEPOIS — 4 classes coesas + orquestrador enxuto
class OrderValidator { validate(order: Order): ValidationResult { /* 60 linhas */ } }

class OrderRepository {
  constructor(private db: SupabaseClient) {}
  async save(order: Order) { /* ... */ }
  async findById(id: string) { /* ... */ }
}

class OrderNotifier {
  constructor(private smtp: SmtpClient) {}
  async notifyCustomer(order: Order) { /* ... */ }
}

class OrderAuditor {
  constructor(private db: SupabaseClient) {}
  async log(action: string, order: Order) { /* ... */ }
}

class OrderService {
  constructor(
    private validator = new OrderValidator(),
    private repo: OrderRepository,
    private notifier: OrderNotifier,
    private auditor: OrderAuditor,
  ) {}

  async place(order: Order): Promise<Result> {
    const v = this.validator.validate(order)
    if (!v.ok) return { error: v.errors }
    await this.repo.save(order)
    await this.notifier.notifyCustomer(order)
    await this.auditor.log('placed', order)
    return { ok: true }
  }
}
// OrderService final: ~25 linhas. Cada classe extraída testável isolada.
```

### Pattern 4: Effort budget

| Tamanho classe | Hot spots típicos | Esforço extract class | Output |
|---|---|---|---|
| 300-500 linhas | 2-3 | 1-2 dias | classe principal + 2-3 extracted classes |
| 500-1000 linhas | 3-5 | 3-7 dias | classe principal + 3-5 extracted; tests acumulados |
| > 1000 linhas | 5+ | 1-3 semanas (pode requerer scratch refactoring antes) | considere extract interface se múltiplas implementações |

## Anti-patterns

### ANTI: extract class antes de characterization

```text
ANTI: identificou hot spots e move tudo de uma vez.

PROBLEMA: extract class MOVE state e métodos. Sem characterization,
          regressão silenciosa em ordem de chamadas, side effects,
          state compartilhado.

CERTO: characterize primeiro (cap 13). Snapshots da classe ANTES.
       Extract incremental. Snapshots devem continuar verdes a cada
       commit (comportamento idêntico).
```

### ANTI: extract class sem hot spot real

```text
ANTI: "vou extrair Helper class só pra reduzir linhas".

PROBLEMA: classe nova sem coesão. Helper recebe métodos
          arbitrários. Reviewer não consegue justificar a divisão.
          Resultado: god class virou god class + helper class.

CERTO: hot spot REAL = cluster de fields + métodos com forte coupling
       interno. Sem cluster, não extract — refactor outro
       (extract method, eliminar dead code).
```

## Verificação

1. Hot spots identificados via matriz de coupling
2. Compilação verde a cada commit
3. Extracted classes têm coesão alta (fields + métodos relacionam-se)
4. Classe original encolheu significativamente (≥ 30%)
5. Tests acumulados nas classes extraídas (≥ 60% coverage)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário canônico
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — characterize ANTES de extract class
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — extract method é precursor; extract class lida com classe inteira
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — sketch identifica hot spots antes do extract
- [`legacy-shotgun-surgery`](../legacy-shotgun-surgery/SKILL.md) — duplicação cross-class detecta candidatos a extract class
- [`supabase-architect`](../../agents/supabase-architect.md) (v1.8) — referencia extract class quando design domain inicial cresce além do esperado

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 20: "This Class Is Too Big and I Don't Want It to Get Any Bigger".*
*Modernização (2026):* Aplicação canônica em domain classes Supabase com SRP retroativo.
