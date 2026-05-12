---
name: legacy-effect-analysis
description: Use ao decidir quais testes escrever em código sem testes — effect sketch (cap 11-12 Feathers) rastreia propagação de efeitos do change point para inflection/pinch points onde 1 teste cob…
---

# Legacy — Effect Analysis

## Quando usar

LLM carrega esta skill quando user precisa decidir QUAIS testes escrever em código legado. Trigger phrases:

- "que tests preciso escrever para essa mudança?"
- "como sei que cobri tudo?"
- "effect sketch", "rastrear efeitos"
- "cap 11 Feathers", "cap 12 Feathers"
- "inflection point", "pinch point", "ponto de interceptação"
- "muitas mudanças na mesma área"
- "efeito propaga", "ripple effect"

Carrega entre `legacy-seams-and-test-harness` (já tenho seam) e `legacy-characterization-tests` (vou escrever quais testes?). Resposta: testes nos pinch points.

## Regras absolutas

- **Effect = qualquer mudança observável após chamar o código.** 4 vetores: return value, parâmetros mutados, globals/state estático, side effects via colaborador (DB, HTTP, FS, log, queue).
- **Effect sketch SEMPRE em papel/whiteboard primeiro.** Diagramar à mão, não em ferramenta. Velocidade > formato. Goal é entender, não documentar.
- **Inflection point = funil estreito.** Lugar onde N caminhos convergem antes de divergir. 1 teste lá cobre N branches a montante. Foque tempo de teste aqui.
- **Pinch point é definido pelo problema, não pela arquitetura.** "É onde os efeitos da minha mudança convergem", pode ou não coincidir com camadas/módulos.
- **Effect-narrowing precede characterization.** Se sketch tem 30 efeitos, primeiro reduza superfície (encapsular variáveis, eliminar globals). Depois characterize a fronteira reduzida.
- **Shotgun surgery = mesmo change espalhado em N lugares.** Effect sketch detecta. Resposta canônica: extrair para 1 lugar antes de mudar (cap 21 — Single Responsibility Principle aplicado retroativamente).
- **Não confunda effect com call graph.** Call graph mostra QUEM chama QUEM. Effect sketch mostra O QUE MUDA. Função pode ser chamada 100 vezes e mudar nada (pure); função chamada 1 vez pode mudar 50 coisas.

## Patterns canônicos

### Pattern 1: 4 vetores de propagação de efeito

```text
1. RETURN VALUE
   foo() retorna X → callers usam X em decisões/cálculos
   Trace: grep callers de foo() + grep usos do resultado

2. MUTATED PARAMETERS (output params)
   foo(list) faz list.push(x) → caller continua a usar list mutada
   Trace: parâmetros não-primitivos (objetos, arrays, ponteiros)

3. GLOBAL / STATIC STATE
   foo() faz globalCounter++ ou Foo.lastResult = X
   Trace: writes em variáveis fora do escopo da função

4. SIDE EFFECTS VIA COLLABORATOR
   foo() chama db.save(), http.post(), log.warn(), fs.writeFile()
   Trace: identificar colaboradores injetados/globais e verificar writes
```

**Heurística:** se um vetor é vazio, ótimo (efeito mais contido). Se múltiplos, sketch é necessário antes de qualquer change.

### Pattern 2: Workflow de effect sketch (cap 11)

```text
1. DESENHAR change point
   Caixa central com nome do método/variável que vai mudar.

2. ENUMERAR EFEITOS DIRETOS (1 nível)
   Setas saindo da caixa central para tudo que MUDA quando aquele
   change point muda:
   - retorno (caixa "return")
   - cada parâmetro mutado
   - cada global escrito
   - cada side effect

3. ENUMERAR EFEITOS DERIVADOS (2 níveis)
   Para cada efeito direto, perguntar: "quem usa isso?"
   - return é consumido por callers — desenhe callers
   - parâmetros mutados — quem inspeciona estado?
   - globals — todos os leitores
   - side effects — todos os observadores (queue consumers, DB readers)

4. CONTINUE até bordas naturais
   - Outro processo/serviço (effect cruza process boundary)
   - Caller que não inspeciona resultado
   - Side effect terminal (log persistido, sem ler de volta)

5. IDENTIFICAR INFLECTION POINTS
   Pontos onde múltiplas setas convergem ou divergem.
   Inflection point é "o gargalo" — testar ali cobre subgrafos inteiros.

6. PRIORIZAR TESTES
   Test escrito num inflection point cobre N efeitos a montante.
   1 teste em pinch point > 10 testes em folhas.
```

### Pattern 3: Exemplo concreto — sketch de OrderProcessor.processOrder()

```text
                        ┌──────────────────┐
                        │ Order.discount   │ ← change point (mudando lógica)
                        └────────┬─────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                         ▼
  Order.totalCents        OrderEvent.payload         AuditLog.entry
        │                        │                         │
        ▼                        ▼                         ▼
   PaymentRequest.amount    EventBus.publish         AuditDB.write
        │                        │                         │
        ▼                        ▼                         ▼
   Stripe.charge        QueueConsumers (3 svcs)     ComplianceReader
        │
        ▼
   bank ledger
```

**Inflection point óbvio:** `Order.totalCents` — TODOS os efeitos no payment side passam por essa propriedade.

**Estratégia de testes:**
- 1 test que asserta `Order.totalCents` para 5+ inputs (boundary, typical, etc.) → cobre subárvore Stripe inteira sem precisar mockar Stripe
- 1 test que asserta `OrderEvent.payload` shape → cobre EventBus side
- 1 test que asserta `AuditLog.entry` shape → cobre Audit side

3 testes de 5 minutos cada cobrem 15+ pontos de propagação. Sem sketch, escreveria 15 testes em 5 lugares diferentes.

### Pattern 4: Heurísticas para encontrar inflection points

| Sintoma no sketch | Provável inflection |
|---|---|
| Várias setas convergem em 1 nó antes de irradiar | Esse nó (estado intermediário) |
| Bordas de processo (call externo) | Antes da borda (assertar mensagem enviada) |
| Pontos de serialização/desserialização | Bem ali — congele forma serializada |
| Persistência (DB write) | Snapshot do row escrito |
| Eventos publicados em queue/bus | Snapshot do event payload |
| Function purity (sem side effect) | Return value direto |

### Pattern 5: Effect-narrowing (cap 12)

Quando sketch tem 20+ efeitos, primeiro REDUZA antes de testar. Técnicas:

| Técnica | Reduz | Trade-off |
|---|---|---|
| **Encapsular variável global** | Globals viram fields → menos vetor 3 (state) | Caller pode precisar passar instância |
| **Imutabilidade no parâmetro** | Mutated params viram return values → menos vetor 2 | Allocation a cada call |
| **Extract method para state mutation** | Side effect concentrado em 1 método (pinch criado) | + 1 método na classe |
| **Replace temp with query** | Variável local → método; reduz dispersão | Computação repetida |
| **Move method (fora de classe X para Y)** | Effect sai do escopo de X → menos efeito a rastrear em X | Pode quebrar outros sketches |

**Princípio:** narrowing é PRECEDENTE a refactor. Faça-o com características de "pure mechanical" — pequena, reversível, comportamento idêntico.

### Pattern 6: 4 perguntas canônicas antes de change

```text
1. "Que efeitos esse change tem?"
   → desenhe sketch (vetores 1-4)

2. "Onde converge antes de divergir?"
   → inflection point(s)

3. "O que preciso testar para SENSE essas convergências?"
   → 1 test por inflection (input variado), assertando estado intermediário

4. "Quais são as bordas naturais?"
   → onde termina o sketch; depois disso é território de outras teams/serviços
```

### Pattern 7: Detect shotgun surgery via sketch

Se ao desenhar sketch para mudança X, você encontra que X aparece em N lugares idênticos espalhados:

```text
                       (mudança X)
                            │
       ┌───────┬────────┬───┴───┬────────┬───────┐
       ▼       ▼        ▼       ▼        ▼       ▼
   FileA    FileB    FileC   FileD    FileE   FileF
   linha    linha    linha   linha    linha   linha
   42       189      67      23       104     56
```

**Sintoma:** mesma lógica copiada em N pontos.
**Resposta:** ANTES de mudar, extrair para função/classe única (cap 21). Depois, mudança vira UM ponto. Effect sketch original com 6 setas vira 1 seta para 1 ponto.

### Pattern 8: Effect sketch tooling

Não precisa de ferramenta sofisticada. Em ordem de preferência:

1. **Papel + caneta** (sempre primeiro — velocidade)
2. **Whiteboard físico** (se mais que 1 pessoa)
3. **Whiteboard digital** (Excalidraw, Miro) — quando precisa salvar/compartilhar
4. **Texto ASCII em PR description** (quando vira artefato persistente)
5. **Mermaid graph** (last resort — overhead de syntax > benefit visual)

**Anti-tooling:** UML "official", Visio, ferramentas que exigem layout perfeito. Sketch é descartável e iterativo.

### Pattern 9: Heurística de cobertura via inflection

Para mudança em legacy code, cobertura mínima = 1 test por inflection point.

```text
N inflection points identificados via sketch
× 5+ inputs cobrindo grupos de equivalência (ver legacy-characterization-tests Pattern 2)
= N × 5 testes mínimos para refactor

Se muito alto (50+), considere effect-narrowing primeiro.
Se muito baixo (1 inflection × 5 inputs = 5), provavelmente sketch
incompleto — verifique se cobriu todos os 4 vetores.
```

## Anti-patterns

### ANTI: pular sketch "porque é óbvio"

```text
ANTI: "esse método tem 50 linhas, eu vejo o que ele faz, vou testar
       direto".

PROBLEMA: efeitos não-óbvios são exatamente os que escapam:
          - mutação de parâmetro objeto que caller depende
          - side effect via dependency injetada (parece pure mas não é)
          - global lido condicionalmente em caminho raro
          Bug em prod 3 semanas depois pelos efeitos não-vistos.

CERTO: SEMPRE 5 minutos de sketch. Mesmo método "óbvio" → desenhe,
       confirme, então teste. 5 min poupam horas.
```

### ANTI: testar todas as folhas do sketch

```text
ANTI: 30 setas no sketch → 30 testes (1 por folha).

PROBLEMA: massive test suite, slow CI, alto custo de manutenção,
          tests redundantes (várias folhas testam mesma branch a
          montante). Sinal de "test theatre" — looks safe but isn't.

CERTO: 1 teste por inflection point. Se inflection cobre 10 folhas,
       teste lá. Folhas só ganham teste próprio se há comportamento
       distinto (folha = inflection menor naquele contexto).
```

### ANTI: testar APENAS na superfície (1 nível de sketch)

```text
ANTI: testar só `processOrder` retorno, sem verificar side effects.

PROBLEMA: side effects são tipicamente onde regressão escapa.
          processOrder pode retornar valor correto MAS escrever no
          DB errado, publicar event errado, logar PII. Test verde
          mascara breakage.

CERTO: percorrer sketch completo. Side effect significativo
       (DB write, event publish, log) recebe assertion no test
       relevante. Use fakes que coletam side effects, asserte sobre
       state final do fake.
```

### ANTI: confundir call graph com effect sketch

```text
ANTI: "fiz um call graph IDE-generated, isso é meu effect sketch".

PROBLEMA: call graph mostra "fooCallsBar". Não mostra que `bar`
          modifica global lido por `baz` que retorna decisão para
          `qux`. Effect path passa por chamadas + state, não só
          chamadas.

CERTO: sketch tem que ser feito por pessoa, lendo código, perguntando
       "o que muda?". Call graph é input ao sketch, não substituto.
```

### ANTI: change com sketch não-validado

```text
ANTI: desenhei sketch, achei 3 inflection points, escrevi tests,
      mudei código. Sketch não foi validado contra o código real
      por outra pessoa.

PROBLEMA: effect omitido (vetor 4 — side effect via colaborador raro)
          significa teste ausente significa regressão escapa.

CERTO: sketch validado por 2ª pessoa OU validado contra mutation
       testing. Mutants survived = pontos não-cobertos = potencial
       gap no sketch original.
```

### ANTI: shotgun surgery sem extract first

```text
ANTI: "mesma lógica em 6 lugares, vou alterar todos os 6".

PROBLEMA: 6 chances de errar. PR de 600 linhas. Test exigiria 6×
          characterization. Próxima mudança = mesma cirurgia.

CERTO: extract first (cap 21). PR1 — extrair para função única,
       cada chamada vira call para a função. PR2 — alterar a função.
       Sketch original encolhe de 6 setas → 1 seta. Tests também.
```

## Verificação

Antes de declarar effect analysis completa:

1. **Sketch desenhado** — papel/whiteboard com change point central + 4 vetores explorados
2. **Todos os 4 vetores considerados** — return, mutated params, globals, side effects via collaborator
3. **Pelo menos 1 inflection point identificado** — se não, sketch incompleto OU change é trivial demais
4. **Effect-narrowing aplicado** se sketch tem > 15 efeitos
5. **Plano de testes derivado do sketch** — N testes em inflection points, NÃO em folhas
6. **Sketch validado** — 2ª pessoa OR mutation testing pós-implementação
7. **Bordas naturais identificadas** — onde para de rastrear (process boundary, terminal side effect)

## Limiar de "pronto para testar/refatorar"

```text
Sketch desenhado:                       sim
Vetores 1-4 enumerados:                 todos cobertos
Inflection points identificados:        ≥ 1 (1-3 típico)
Plano de testes mapeado para sketch:    sim (1 teste por inflection)
Cobertura esperada com tests planejados: ≥ 70% behavioral
Effect-narrowing aplicado:              se necessário
```

Se algum item incompleto → não inicie testes/refactor. Volte ao sketch.

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (effect sketch, inflection point, pinch point, shotgun surgery)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — characterization rodada NOS inflection points achados aqui
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — break-deps em inflection points = test harness mínimo
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — monster method tem sketch interno (em uma única função)
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — sprout point ideal = inflection point pré-existente
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — gate exige effect sketch para refactor de arquivos grandes/críticos

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 11: "I Need to Make a Change. What Methods Should I Test?" + Cap 12: "I Need to Make Many Changes in One Area" + Cap 16: "I Don't Understand the Code Well Enough to Change It".*
