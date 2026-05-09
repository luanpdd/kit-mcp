---
name: legacy-shotgun-surgery
description: Use ao detectar mesma mudança espalhada em N lugares (cap 21 Feathers) — extract before modify para reduzir change point. Modernização 2026 — semantic search via embeddings detecta duplicação semântica que regex não pega.
---

# Legacy — Shotgun Surgery

## Quando usar

LLM carrega esta skill quando user descobre que uma mudança requer edição em múltiplos pontos do codebase. Trigger phrases:

- "tenho que mudar isso em 5 lugares"
- "shotgun surgery", "cirurgia espalhada"
- "duplicação de código", "code duplication"
- "extrair função", "extract method para reduzir duplicação"
- "esses 3 lugares fazem a mesma coisa"
- "cap 21 Feathers"
- "semantic duplication", "duplicação semântica"

## Regras absolutas

- **Extract first, modify second.** Antes de mudar, EXTRAIR para 1 lugar. Depois mudar 1 lugar. Reduz N change points para 1.
- **Detectar duplicação tem 2 níveis:**
  - **Sintática (regex):** mesmo identifier, mesma estrutura. Detect via grep/AST.
  - **Semântica (embeddings — modernização 2026):** intenção igual, implementação diferente. Detect via embedding similarity.
- **Threshold canônico:** 3+ ocorrências da MESMA lógica = candidato. 2 ocorrências = "regra do dois" (DRY); 3 = sinal forte; 4+ = veto-extract-imediato.
- **Effect-narrowing precede modify.** Mudar em 5 lugares ÉE shotgun surgery. Mudar em 1 lugar não é. Pré-trabalho: extract.
- **Modernização semantic search:** modelos de embedding pequenos (`text-embedding-3-small` da OpenAI, `bge-small-en` open) custam < $0.01 para projeto inteiro. Threshold típico 0.85 cosine similarity = duplicação semântica forte.
- **Não extract se única ocorrência é "candidata".** Extract sob demanda. Sem 3 ocorrências reais, abstração é especulativa (YAGNI).
- **Extract preserves comportamento.** Cada chamada deve ter resultado IDÊNTICO ao código inline original. Bug preservation aplicável (veja skill characterization).

## Patterns canônicos

### Pattern 1: Detecção sintática (Feathers original cap 21)

```bash
# PT-BR: padrões sintáticos canônicos

# Functions/methods com nome similar
grep -rE "function (compute|calc)Total" --include="*.ts" .
grep -rE "(compute|calc)Total" --include="*.ts" -A 5 .

# Bloco de código repetido (heurística)
# Usar `jscpd` (Copy/Paste Detector) ou `simian` para JS/TS/Python
npx jscpd --min-lines 5 --threshold 0 --reporters json src/

# AST-level (mais preciso) — usar `tree-sitter` queries
# Rust/JS — encontrar all calls com mesmo padrão
ast-grep --pattern 'orderTotal($O) + shippingCost($O) + tax($O)' src/

# git log — quando mesma mudança aparece em múltiplos commits
git log --since=6.months --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20
# arquivos co-modificados juntos = candidatos a shotgun
```

### Pattern 2: Detecção semântica (modernização 2026 via embeddings)

```ts
// PT-BR: workflow de detecção semântica de duplicação
// (sem precedente em 2004 — embedding APIs maduras só em 2023+)

import { OpenAI } from 'openai'

const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

async function detectSemanticDuplicates(codeBlocks: CodeBlock[]) {
  // Step 1: gerar embedding por bloco
  const embeddings = await Promise.all(
    codeBlocks.map(async (block) => ({
      block,
      embedding: (await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: extractIntent(block),  // function signature + comments + body summary
      })).data[0].embedding,
    }))
  )

  // Step 2: clusterizar por similaridade
  const clusters: CodeBlock[][] = []
  for (const item of embeddings) {
    let assigned = false
    for (const cluster of clusters) {
      const sim = cosineSim(item.embedding, cluster[0].embedding)
      if (sim >= 0.85) {  // threshold canônico
        cluster.push(item.block)
        assigned = true
        break
      }
    }
    if (!assigned) clusters.push([item.block])
  }

  // Step 3: filtrar clusters com 3+ membros (regra do três)
  return clusters.filter(c => c.length >= 3)
}

function extractIntent(block: CodeBlock): string {
  // intent = function signature + leading comment + first 3 lines of body
  return [
    block.signature,
    block.leadingComment ?? '',
    block.body.slice(0, 3).join('\n'),
  ].join('\n')
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] ** 2
    nb += b[i] ** 2
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
```

**Insight:** semantic search detecta:
- `computeTotalCents` em arquivo A
- `calc_total_in_cents` em arquivo B
- `getOrderTotalInPennies` em arquivo C
- 3 implementações diferentes mas mesma intenção. Regex puro não pega.

**Custo:** 1000 blocos × text-embedding-3-small ≈ $0.02. Praticamente grátis.

**Cross-suite:** `pgvector` self-hosted (skill `supabase-pgvector-rag` v1.8) pode hospedar embeddings sem dep externa.

### Pattern 3: Workflow extract-before-modify

```text
1. Detectar shotgun surgery (sintática OR semântica)
2. CONFIRMAR comportamento idêntico via characterization tests
   - Capturar output de CADA ocorrência com mesmo input
   - Outputs devem ser idênticos (ou docs explicar diferenças intencionais)
3. EXTRACT — criar função/classe única
   - Nome canônico (busca consenso: pelo menos 1 dos N nomes existentes está OK)
   - Localização canônica (módulo de utils, ou domain layer adequada)
4. SUBSTITUIR cada ocorrência por chamada
   - 1 commit por substituição
   - Tests verdes a cada commit
5. AGORA mudança é em 1 lugar
6. Modify
```

### Pattern 4: Heurística de "vale extract?"

Trade-off entre custo de extract e benefício futuro:

| Ocorrências | Tamanho cada | Vale extract? |
|---|---|---|
| 2 | 5 linhas | NÃO — Rule of 2 (DRY pode ser violado uma vez) |
| 2 | 30+ linhas | TALVEZ — depende de churn esperado |
| 3 | 5+ linhas | SIM — Rule of 3 |
| 3+ | 10+ linhas | SIM forte |
| N | 1-2 linhas | TALVEZ — ganho marginal vs noise de função tiny |
| N | 50+ linhas | SIM máximo (extract para classe própria) |

### Pattern 5: Naming canônico

Função extraída precisa de nome que "ressoa" com TODAS as ocorrências originais. Estratégia:

```text
1. Listar os N nomes (ou comments) das ocorrências:
   - "computeTotalCents"
   - "calcOrderTotal"
   - "getCartTotalInCents"

2. Encontrar o COMUM SEMÂNTICO:
   - "Total" presente em todos
   - "Cents" / "Cents" / "InCents" — variantes
   - Order/Cart — contexto chamador, não nome interno

3. Nome canônico: `computeOrderTotalCents` (verb + entity + unit explicit)

4. Documentar deprecation comments nas N localizações que usavam nomes diferentes.
```

### Pattern 6: Cross-module shotgun (mais difícil)

Quando duplicação está em camadas diferentes (e.g., 1 backend + 2 frontends):

```text
- Não extract para "shared module" sem pensar em deploy/release coupling
- Considerar: API contract centralizada (OpenAPI) + geração de types
- Considerar: SDK comum (TypeScript types compartilhados via package)
- Última resort: aceitar duplicação cross-stack (custo de unificação > benefício)
```

## Anti-patterns

### ANTI: extract sem characterization

```text
ANTI: detectou duplicação, extract direto, push.

PROBLEMA: as 3 ocorrências podem ter VARIAÇÕES sutis (1 retorna em
          rounding diferente, outra trata null diferentemente). Sem
          characterization, extract uniformiza E quebra a variante.

CERTO: characterize cada ocorrência ANTES de extract. Outputs
       idênticos? extract OK. Outputs diferentes? document, decide se
       quer uniformizar (com aceite de mudança comportamental) OR
       deixe múltiplas (porque diferenças são intencionais).
```

### ANTI: nome que só funciona em 1 das N localizações

```text
ANTI: extracted como "calcCartTotal" — mas era usado em 3 contextos:
      Cart, Order, Quote.

PROBLEMA: callers de Order chamando calcCartTotal lê estranho. Reviewer
          confundido. Refactor seguinte (rename) gera mais churn.

CERTO: nome neutro / contextualizado por parâmetro. `calcTotal(items)`
       em vez de `calcCartTotal()`. Caller informa contexto via input,
       extracted function é generic.
```

### ANTI: detectar via line-level diff sem AST

```text
ANTI: jscpd com min-tokens 5. Reporta 200 "duplicações" — maioria
      false positives (assertions de testes, imports, boilerplate).

PROBLEMA: signal/noise ruim. Equipe ignora reports.

CERTO: min-lines ≥ 10 + min-tokens ≥ 50 + ignore tests/. AST-based
       (ast-grep, semgrep) é melhor — pega "função com mesma estrutura"
       não "linhas idênticas".
```

### ANTI: semantic search sem revisão humana

```text
ANTI: embedding similarity > 0.85 → automatically suggest extract.

PROBLEMA: false positives. 2 funções com nomes/comentários similares
          mas implementações diferentes (`fetchUser` em backend vs
          `fetchUser` em frontend service worker — completamente
          diferentes mas embeddings 0.88).

CERTO: semantic search é PRIMEIRA passada. Cluster proposto vai para
       review humano. Aceita/rejeita por cluster. Extract somente
       após aprovação.
```

### ANTI: extract para "future-proofing" speculative

```text
ANTI: "essa função vai ser usada em mais lugares no futuro, vou
       extract agora".

PROBLEMA: YAGNI. Abstração premature gera função vazia /
          parametrizada demais. Quando o "futuro" chega, abstração
          não cabe.

CERTO: 3 usos REAIS = extract. Antes disso, código inline com TODO
       é melhor (aceita duplicação temporária; extract quando 3º uso
       aparece).
```

## Verificação

1. Detecção rodada (sintática + semântica se IA disponível)
2. Clusters com 3+ ocorrências reportados
3. Cada cluster validado por humano (não auto-extract)
4. Characterization de cada ocorrência ANTES de extract
5. Outputs idênticos confirmados (OR diferenças documentadas)
6. Nome canônico escolhido (resonates com todas N localizações)
7. 1 commit por substituição (revertível individual)
8. Tests verdes a cada commit

---

## Ver também

- [`_shared-legacy/glossary.md`](../_shared-legacy/glossary.md) — vocabulário (shotgun surgery, effect-narrowing)
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — sketch detecta shotgun (mesma mudança em N lugares)
- [`legacy-extract-class`](../legacy-extract-class/SKILL.md) — quando shotgun é cluster grande, extract class em vez de extract method
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — extract method canônico (precursor de extract class)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — characterize ANTES de extract para confirmar comportamento idêntico
- [`supabase-pgvector-rag`](../supabase-pgvector-rag/SKILL.md) (v1.8) — pgvector self-hosted para embeddings sem dep externa
- [`shotgun-surgery-detector`](../../agents/shotgun-surgery-detector.md) — agent que automatiza detecção semântica

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004 — Cap 21: "I'm Changing the Same Code All Over the Place".*
*Modernização (2026):* Detecção semântica via embeddings (text-embedding-3-small ou pgvector) — sem precedente em 2004; ML maduro só após 2018.
