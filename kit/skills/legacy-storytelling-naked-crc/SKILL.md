---
name: legacy-storytelling-naked-crc
description: Use ao precisar entender codebase desconhecido antes de mudar (cap 16-17 Feathers) — telling the story + naked CRC sketches. Modernização 2026…
---

# Legacy — Storytelling & Naked CRC

## Quando usar

LLM carrega esta skill quando user precisa entender módulo/codebase desconhecido antes de fazer mudança. Trigger phrases:

- "não entendo esse módulo", "I don't understand this code"
- "explique o que esse módulo faz"
- "naked CRC", "telling the story"
- "mental model", "code comprehension"
- "cap 16 Feathers", "cap 17 Feathers"
- "esse codebase é novo pra mim, por onde começo?"
- "responsibility hot spots ainda não identificados"

## Regras absolutas

- **Storytelling em ≤ 5 frases.** Resumir em frases CURTAS força extração das responsabilidades essenciais. Se sua narrativa tem 3 parágrafos, você não entendeu — você só descreveu.
- **Naked CRC = 1 caixa por classe + responsabilidades em bullets + colaboradores em flecha.** Sem layout sofisticado. Papel/whiteboard. Pure pensamento.
- **Storytelling REVELA abstrações ausentes.** Quando você precisa repetir "depois ele faz X" 3 vezes na narrativa = abstração X é candidate a extract method/class.
- **Modernização 2026 — IA gera primeiro draft.** LLM lê módulo, produz storytelling em 30 segundos. Humano refina e valida. 5h de leitura → 30 min de revisão. Sem precedente em 2004.
- **IA NÃO substitui validação humana.** LLM pode alucinar relações. Story de IA é hipótese; humano confirma.
- **Story do AGENT vs story do CODE pode divergir.** Diferença = sinal interessante (talvez código mente sobre intenção via nomes ruins; talvez intenção evoluiu sem refactor).

## Patterns canônicos

### Pattern 1: Workflow de telling the story (cap 17 original)

```text
1. Escolher escopo: módulo ou diretório com ≤ 1500 linhas (mais que isso = quebrar em chunks)
2. Ler o "entrypoint" (api pública, main exports)
3. Em 1 frase, descrever o que o módulo FAZ (não como)
   Exemplo: "Esse módulo processa pedidos de checkout e envia para o gateway de pagamento."
4. Em 2-3 frases, descrever as responsabilidades principais
   Exemplo: "Valida o pedido contra business rules. Salva no DB com auditoria. Envia para o gateway com retry."
5. Em 1-2 frases finais, descrever os colaboradores principais
   Exemplo: "Usa OrderRepository para persistir, PaymentGateway para charge, AuditLog para track."
6. NUNCA exceder 5 frases totais
7. RE-LER o resumo. Está correto? Faz sentido para alguém que nunca viu o código?
```

### Pattern 2: Naked CRC sketch

CRC = Class-Responsibility-Collaborator. "Naked" = sem ferramenta, papel cru.

```text
Diagrama-tipo (ASCII):

┌─────────────────────────────┐
│ OrderService                │      Responsibilities:
│                             │      - Validates orders
│ Collaborators:              │  ←   - Persists to DB
│   - OrderValidator          │      - Triggers notifications
│   - OrderRepository         │      - Logs audit trail
│   - OrderNotifier           │
│   - AuditLogger             │
└─────────────────────────────┘

┌─────────────────────────────┐
│ OrderValidator              │      Responsibilities:
│                             │  ←   - Schema validation
│ Collaborators:              │      - Business rule check
│   - BusinessRulesEngine     │      - Customer reputation lookup
│   - CustomerService         │
└─────────────────────────────┘

[+ outros]
```

**Usar para:**
- Identificar classes que tem responsabilidades demais (responsibility hot spots → candidate a extract class)
- Identificar collaborators que não fazem sentido para a responsabilidade (potencial smell)
- Identificar abstrações ausentes (responsabilidade aparece em N classes = should be extracted)

### Pattern 3: IA gera primeiro draft (modernização 2026)

```text
Workflow modernizado:

1. Selecionar arquivo/módulo target
2. Pedir para LLM (próprio Claude rodando):

   "Leia este código e produza:
   - Story em 3-5 frases (o que faz, em portuguese, alto nível)
   - Lista de classes/funções principais com responsibilities
   - Lista de colaboradores externos (DBs, APIs, queues)
   - 'Responsibility hot spots' — classes/funções fazendo demais
   - Sugestões de extract class candidates"

3. LLM produz `STORYTELLING-<module>.md` em ≤ 1 min
4. Humano REVISA:
   - Story está correto? (cross-check com leitura aleatória)
   - Hot spots identificados são reais ou alucinados?
   - Sugestões fazem sentido?
5. Refinar story manualmente — versão final é HUMANA, IA é primeiro draft

Custo: ~5 min de LLM + 15-30 min de review = 30 min vs 4-8h de leitura cega.
```

### Pattern 4: Template canônico de `STORYTELLING-<module>.md`

```markdown
# STORYTELLING — <module> — <data>

## Story (≤ 5 frases)

<frase 1: o que faz, alto nível>
<frase 2-3: responsabilidades principais>
<frase 4-5: colaboradores chave>

## Inventário de classes/funções

| Nome | Linhas | Responsabilidade primária | Cluster |
|---|---|---|---|
| OrderService | 312 | Orquestrar checkout | core |
| OrderValidator | 87 | Validar pedido | validation |
| OrderRepository | 141 | Persistir orders | persistence |
| OrderNotifier | 64 | Enviar emails | side-effect |

## Naked CRC sketch

[diagrama ASCII como Pattern 2]

## Colaboradores externos

- **Database:** Postgres via Supabase client (via OrderRepository)
- **Payment gateway:** Stripe via StripeAdapter (via OrderService)
- **Email:** SMTP via OrderNotifier
- **Queue:** pgmq jobs para audit (via AuditLogger)

## Responsibility hot spots (classes fazendo demais)

1. **OrderService (312 linhas, 5 responsabilidades distintas)** — ver Pattern de extract class:
   - validation (move para `OrderValidator`?)
   - persistência (já em `OrderRepository`)
   - notification (move para `OrderNotifier`?)
   - audit (move para `OrderAuditor`?)
   - orchestration (mantém)

## Abstrações ausentes (sugestões)

- `OrderState` — atualmente representado como string solta; candidato a sum type/enum
- `Currency` — strings literais espalhados; candidate a value object

## Gotchas / surpresas

- `OrderService.processOrder` não checa `customer.creditScore` apesar de existir em CustomerService
- `OrderRepository.save` faz update silently se id existe (UPSERT) — não documentado
- Audit log usa table `audit_log_v2`, NÃO `audit_log` (deprecated)

## Próximas ações sugeridas

1. `/encontrar-seams src/orders/OrderService.ts` — quebrar deps para tests
2. `/caracterizar src/orders/OrderService.ts` — capturar comportamento atual
3. `/refactor-seguro src/orders/OrderService.ts` — chain canônico

---
*Gerado por: storytelling-analyst (IA primeiro draft) + revisão humana.*
*Material-fonte: Feathers cap 16-17 + modernização IA 2026.*
```

### Pattern 5: Quando NÃO fazer storytelling

```text
- Codebase < 200 linhas — leitura direta é mais rápida
- Você já trabalhou no módulo nas últimas 2 semanas — mental model fresco
- Mudança é trivial (typo, comment) — overhead > valor
- Você só vai LER (não modificar) — leia direto
```

### Pattern 6: Storytelling cross-suite

Storytelling consume e alimenta outras skills:

| Cross-skill | Como interage |
|---|---|
| `legacy-effect-analysis` | Story → effect sketch (story informa change point central) |
| `legacy-extract-class` | Hot spots → extract class candidates |
| `legacy-shotgun-surgery` | Colaboradores comuns em N classes → potencial extract |
| `legacy-monster-methods` | Class com 1 método de 200 linhas → identifica monster |
| `legacy-api-only-applications` | Colaborador "Stripe API" em adapter → confirmar pattern aplicado |
| `legacy-characterization-tests` | Hot spot → onde caracterizar prioritariamente |

## Anti-patterns

### ANTI: storytelling com 3 parágrafos

```text
ANTI: "Esse módulo é um monolito que processa orders. Ele tem
       OrderService que orquestra... [continua por 12 linhas]"

PROBLEMA: você só DESCREVEU código linha por linha. Não destilou
          essência. Não identificou abstrações. É leitura, não
          comprehension.

CERTO: 5 frases máximas. Forçar concisão extrai responsabilidades
       essenciais. Se 5 frases não cabem = módulo é grande demais
       para 1 storytelling; quebrar em chunks (1 sub-módulo por
       story).
```

### ANTI: trustar IA sem validação

```text
ANTI: LLM gera story → commit direto → use como base de decisão
      de refactor.

PROBLEMA: LLM pode alucinar relações ("OrderService usa Stripe"
          quando na verdade usa adapter genérico). Decisão errada
          baseada em story errada.

CERTO: IA = primeiro draft, sempre. Cross-check com leitura
       aleatória do código (5 spot-checks). Refinar story baseado
       no que está REALMENTE no código. Story final é humana.
```

### ANTI: CRC com 50 caixas

```text
ANTI: tentar fazer CRC de codebase inteiro (200 classes).

PROBLEMA: ilegível. Não entrega comprehension; entrega ansiedade.

CERTO: CRC de 1 módulo coeso (5-15 classes). Codebase grande =
       N módulos = N CRCs. Hierárquico se necessário (1 CRC
       agregado top-level + N CRCs detalhados por módulo).
```

### ANTI: storytelling sem ler o código

```text
ANTI: pedir para IA gerar story sem ler README/docs/code; usar
      como autoridade.

PROBLEMA: IA pode usar context training (versões anteriores do
          código, conventions diferentes). Story divorciada do
          código atual.

CERTO: IA recebe arquivo(s) específicos como input. Story é
       baseada NO QUE ESTÁ NO CÓDIGO, não em "o que LLM imagina
       que esse tipo de código faz".
```

## Verificação

1. Story em ≤ 5 frases
2. Inventário de classes/funções com linhas + responsabilidade primária
3. Naked CRC sketch (ASCII OK; whiteboard photo OK; ferramenta sofisticada NÃO)
4. Colaboradores externos identificados
5. Hot spots de responsabilidade marcados
6. (Modernização) IA gerou primeiro draft, humano revisou
7. Story serve como input para próximas skills (effect, extract, characterization)

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — story informa effect sketch
- [`legacy-extract-class`](../legacy-extract-class/SKILL.md) — hot spots → extract class
- [`legacy-shotgun-surgery`](../legacy-shotgun-surgery/SKILL.md) — duplicação aparece em CRC
- [`storytelling-analyst`](../../agents/storytelling-analyst.md) — agent que gera primeiro draft via LLM
- [`mapear-codebase`](../../commands/mapear-codebase.md) — comando framework v1.7+ para mapping; storytelling complementa com narrativa

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 16: "I Don't Understand the Code Well Enough to Change It" + Cap 17: "My Application Has No Structure".*
*Modernização (2026):* IA gera primeiro draft do storytelling; reduz 4-8h de leitura cega para 30 min de revisão informada.
