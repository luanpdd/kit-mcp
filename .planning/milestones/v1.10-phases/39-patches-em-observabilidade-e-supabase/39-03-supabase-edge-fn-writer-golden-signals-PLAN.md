---
phase: 39
plan: 03
title: Patch supabase-edge-fn-writer — seção "Four Golden Signals" no template
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/supabase-edge-fn-writer.md
requirements: [INT-SB-V2-01]
status: ready
---

# Plan 03 — Patch `kit/agents/supabase-edge-fn-writer.md`

## Goal

Estender o agente `supabase-edge-fn-writer` (v1.8) para que **toda Edge Function gerada inclua os 4 Golden Signals** (Latency histogram, Traffic counter, Errors counter por `error.type`, Saturation gauge resource-specific) conforme cap 6 do livro Google SRE. O patch adiciona uma seção "Four Golden Signals" referenciando a skill `four-golden-signals` (v1.10 / Phase 36) e o agente `golden-signals-instrumenter` (v1.10 / Phase 37). Frontmatter (`description`, `tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-SB-V2-01**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/agents/supabase-edge-fn-writer.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `name`, `description`, `tools` (`Read, Write, Edit, Bash, Grep, Glob`), `color: cyan` preservados byte-a-byte
- **Cross-ref Markdown ATIVO** — `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` + `[golden-signals-instrumenter](./golden-signals-instrumenter.md)`
- **Posicionamento canônico** — patch é nova seção `## Four Golden Signals` inserida **após** `## Observabilidade integrada` e **antes** de `## Ver também` (preserva ordem editorial existente; v1.10 amplia v1.9 sem deslocar)
- **Não modificar bloco "## Observabilidade integrada"** — v1.9 já documenta OTel SDK + spans + propagation; v1.10 adiciona dimensão dos 4 signals como detalhe específico de instrumento
- **Não modificar steps existentes (0-10)** — toda lógica de geração de Edge Function preservada
- **Atualizar `## Ver também`** — adicionar 2 entradas (skill + agent) ao final da lista existente (não reescrever lista)
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes; usar code fences ts/sql consistentes

## Tasks

<task id="39-03-T1" name="Verificar estado e localizar âncoras de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-edge-fn-writer.md (frontmatter linhas 1-6 + localizar `## Observabilidade integrada` e `## Ver também`)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 35-100 — capturar tabela canônica + snippet OTel TypeScript)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual (`name: supabase-edge-fn-writer`, `tools: Read, Write, Edit, Bash, Grep, Glob`, `color: cyan`)
    2. Localizar âncora `## Observabilidade integrada` (esperada ~linha 182)
    3. Localizar âncora `## Ver também` (esperada ~linha 199)
  </action>
  <acceptance_criteria>
    - Frontmatter atual confirmado byte-a-byte
    - Ambas headings localizadas
    - Skill `four-golden-signals` confirmada existir
  </acceptance_criteria>
</task>

<task id="39-03-T2" name="Inserir nova seção ## Four Golden Signals">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-edge-fn-writer.md (linhas 180-205 — bloco "Observabilidade integrada" + transição para "Ver também")
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (snippet OTel canônico em TypeScript/Deno)
  </read_first>
  <action>
    Usar Edit para inserir, **imediatamente antes** da heading `## Ver também` (e **após** o bloco completo `## Observabilidade integrada`), a seguinte nova seção:

    ```markdown
    ## Four Golden Signals

    > Cross-ref canônico: [four-golden-signals](../skills/four-golden-signals/SKILL.md) (cap 6 do livro Google SRE — Monitoring Distributed Systems). Para retro-instrumentar Edge Function existente, delegar para [golden-signals-instrumenter](./golden-signals-instrumenter.md).

    Edge Function user-facing nasce com os 4 sinais dourados — não é addon. O bloco `## Observabilidade integrada` acima cobre OTel SDK + spans + propagation; este bloco especifica os **4 instrumentos canônicos** que o template gerado SEMPRE inclui:

    | Signal | Instrumento | Dimensão | Valor padrão |
    |---|---|---|---|
    | **Latency** | `meter.createHistogram('http_request_duration_ms')` com `explicitBucketBoundaries: [1,2,5,10,25,50,100,250,500,1000,2500,5000,10000,30000]` | `result=success\|error` (separar success de erro) | Bucketing exponencial captura long tail sem cardinality explosion |
    | **Traffic** | `meter.createCounter('http_requests_total')` | `endpoint`, `http_method` | Incrementado antes de processar request |
    | **Errors** | `meter.createCounter('http_errors_total')` | `error.type` enum (5-15 valores: `timeout\|validation\|auth\|rate_limit\|db\|provider_down\|...`) — **nunca** `error.message` (cardinalidade explode) | Incrementado em catch + path 4xx/5xx |
    | **Saturation** | `meter.createObservableGauge('saturation_pct')` com callback que lê estado real | resource-specific: `connection_pool` (pg) / `concurrency_limit` (Edge runtime) / `egress_bandwidth` / `cache_memory` | % do recurso mais escasso identificado ANTES de instrumentar |

    ### Snippet canônico — adicionado ao topo do `index.ts` gerado

    ```ts
    // PT-BR: 4 golden signals — instrumentação mínima universal
    import { metrics } from 'npm:@opentelemetry/api@1.9.0'
    const meter = metrics.getMeter('<function_name>')

    // 1. LATENCY — histogram bucketed exponencial
    const latencyHistogram = meter.createHistogram('http_request_duration_ms', {
      description: 'Edge function latency split by result (success vs error)',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] }
    })

    // 2. TRAFFIC — counter de requests recebidos
    const trafficCounter = meter.createCounter('http_requests_total', {
      description: 'Total HTTP requests received by edge function'
    })

    // 3. ERRORS — counter por error.type (NUNCA error.message — cardinalidade)
    const errorsCounter = meter.createCounter('http_errors_total', {
      description: 'Edge function errors by error.type enum'
    })

    // 4. SATURATION — gauge do recurso mais escasso (callback lê estado real)
    // PT-BR: para Edge Function default, saturation = concurrency_limit_used %
    // Substituir callback conforme recurso identificado (db pool, queue, cache)
    meter.createObservableGauge('saturation_pct', {
      description: 'Saturation of scarcest resource — function-specific'
    }).addCallback((result) => {
      // PT-BR: callback canônico — ler estado real (ex: SELECT count(*) FROM pg_stat_activity)
      // Aqui placeholder: 0 < value < 1
      result.observe(getSaturationPct())  // implementar conforme resource
    })
    ```

    ### Wrapping no handler

    ```ts
    Deno.serve(async (req: Request) => {
      const start = performance.now()
      const endpoint = new URL(req.url).pathname
      trafficCounter.add(1, { endpoint, http_method: req.method })

      try {
        const response = await handle(req)
        latencyHistogram.record(performance.now() - start, {
          endpoint,
          result: response.ok ? 'success' : 'error',
        })
        if (!response.ok) {
          errorsCounter.add(1, { endpoint, 'error.type': classifyError(response) })
        }
        return response
      } catch (err) {
        latencyHistogram.record(performance.now() - start, { endpoint, result: 'error' })
        errorsCounter.add(1, { endpoint, 'error.type': classifyError(err) })
        throw err
      }
    })

    // PT-BR: classifyError DEVE retornar enum fechado, não err.message
    function classifyError(e: unknown): string {
      if (e instanceof TimeoutError) return 'timeout'
      if (e instanceof ValidationError) return 'validation'
      if (e instanceof AuthError) return 'auth'
      // ... 5-15 valores no total
      return 'unknown'
    }
    ```

    ### Saturation por tipo de Edge Function

    | Tipo de função | Recurso mais escasso | Implementação típica |
    |---|---|---|
    | API simples (GET/POST com leitura DB) | `pg_pool` connections used | `select count(*) from pg_stat_activity where state = 'active'` |
    | RAG / embeddings | `concurrency_limit` (provider externo) | counter de requests in-flight |
    | Email / queue consumer (cron → pgmq) | `pgmq.queue_length` | `select msg_count from pgmq.metrics_<queue>` |
    | Storage I/O heavy (uploads grandes) | `egress_bandwidth` | bytes-out tracker em window |

    ### Anti-patterns prevenidos

    - `error.type = err.message` → SEMPRE enum fechado (5-15 valores)
    - Latency mistura success + error → SEMPRE `result` dimension separa
    - Mean latency em vez de histogram → SEMPRE histogram com percentis derivados em backend
    - Saturation genérico (CPU%) sem identificar recurso real → SEMPRE escolher recurso scarcest da função

    ```

    Posicionamento exato: a nova seção entra entre o **fim** do bloco `## Observabilidade integrada` (após o último parágrafo "ODD-compliant...") e a heading `## Ver também`.
  </action>
  <acceptance_criteria>
    - Heading `## Four Golden Signals` existe (count == 1)
    - Seção contém cross-ref Markdown literal `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` E `[golden-signals-instrumenter](./golden-signals-instrumenter.md)`
    - Seção contém tabela markdown com 4 rows (Latency / Traffic / Errors / Saturation)
    - Seção contém ts code fence com `createHistogram` + `createCounter` + `createObservableGauge` (3 instrumentos OTel)
    - Seção contém snippet de `Deno.serve` com handler instrumentado
    - Seção menciona literal `error.type` enum + warning "NUNCA error.message"
    - Seção contém tabela de saturation por tipo de Edge Function (4+ rows)
    - Heading `## Observabilidade integrada` preservada
    - Heading `## Ver também` preservada
  </acceptance_criteria>
</task>

<task id="39-03-T3" name="Atualizar ## Ver também (adicionar 2 entradas)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-edge-fn-writer.md (bloco `## Ver também` linhas ~199-208 — ler lista atual completa)
  </read_first>
  <action>
    Adicionar exatamente 2 novas entradas ao **fim** da lista existente em `## Ver também` (não substituir nem reordenar entries existentes):

    ```markdown
    - [four-golden-signals](../skills/four-golden-signals/SKILL.md) — 4 sinais canônicos (Latency, Traffic, Errors, Saturation) cap 6 livro Google SRE
    - [golden-signals-instrumenter](./golden-signals-instrumenter.md) — agent que retro-instrumenta Edge Functions existentes com os 4 signals
    ```

    Se a lista termina com `- [observability-driven-development](...)` (entrada existente), inserir as duas novas linhas IMEDIATAMENTE após essa entrada.
  </action>
  <acceptance_criteria>
    - Lista `## Ver também` ganhou 2 entries no final (cross-ref canônico)
    - Entries pré-existentes preservadas (count > 5 conforme arquivo original)
    - Markdown links literais válidos (relative paths corretos)
  </acceptance_criteria>
</task>

<task id="39-03-T4" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-edge-fn-writer.md (re-leitura completa)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO
    head -6 kit/agents/supabase-edge-fn-writer.md
    # Esperado:
    # ---
    # name: supabase-edge-fn-writer
    # description: Escreve Deno Edge Functions com imports versionados npm:/jsr:, env vars pre-populadas, file writes APENAS em /tmp, alerta cold start em bundle grande.
    # tools: Read, Write, Edit, Bash, Grep, Glob
    # color: cyan
    # ---

    # 2. Heading ## Four Golden Signals existe (única)
    grep -c "^## Four Golden Signals" kit/agents/supabase-edge-fn-writer.md  # esperado: 1

    # 3. Cross-refs ATIVOS
    grep -c "\[four-golden-signals\](../skills/four-golden-signals/SKILL.md)" kit/agents/supabase-edge-fn-writer.md  # esperado: ≥1
    grep -c "\[golden-signals-instrumenter\](./golden-signals-instrumenter.md)" kit/agents/supabase-edge-fn-writer.md  # esperado: ≥1

    # 4. Os 4 signals nominados literalmente
    grep -c "Latency" kit/agents/supabase-edge-fn-writer.md     # esperado: ≥3
    grep -c "Traffic" kit/agents/supabase-edge-fn-writer.md     # esperado: ≥2
    grep -c "Errors" kit/agents/supabase-edge-fn-writer.md      # esperado: ≥3
    grep -c "Saturation" kit/agents/supabase-edge-fn-writer.md  # esperado: ≥3

    # 5. OTel APIs canônicas presentes
    grep -c "createHistogram" kit/agents/supabase-edge-fn-writer.md       # esperado: ≥1
    grep -c "createCounter" kit/agents/supabase-edge-fn-writer.md         # esperado: ≥2
    grep -c "createObservableGauge" kit/agents/supabase-edge-fn-writer.md # esperado: ≥1

    # 6. Headings preservadas
    grep -c "^## Observabilidade integrada" kit/agents/supabase-edge-fn-writer.md  # esperado: 1
    grep -c "^## Ver também" kit/agents/supabase-edge-fn-writer.md                  # esperado: 1

    # 7. Anti-pattern explícito error.type vs error.message
    grep -c "NUNCA.*error\.message\|error\.type.*enum" kit/agents/supabase-edge-fn-writer.md  # esperado: ≥1

    # 8. Diff puro de adição
    git diff --numstat kit/agents/supabase-edge-fn-writer.md
    # Esperado: insertions > 0; deletions == 0 (ou ≤ 2 se Edit reescreveu separadores)

    # 9. Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/agents/supabase-edge-fn-writer.md" ] && grep -q "Four Golden Signals" "$TMP/.claude/agents/supabase-edge-fn-writer.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `head -6` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^## Four Golden Signals"` == 1
    - 2 cross-refs Markdown ativos presentes (four-golden-signals + golden-signals-instrumenter)
    - 4 signals nominados ≥ 2× cada
    - 3 OTel APIs (Histogram, Counter, ObservableGauge) literais presentes
    - Anti-pattern `error.type` vs `error.message` documentado
    - Smoke sync propaga
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico
- [ ] Heading `## Four Golden Signals` adicionada (entre `## Observabilidade integrada` e `## Ver também`)
- [ ] Tabela 4 signals (Latency / Traffic / Errors / Saturation) presente
- [ ] Snippet ts canônico com 3 OTel APIs (Histogram + Counter + ObservableGauge)
- [ ] Snippet de wrapper `Deno.serve` instrumentado
- [ ] Anti-pattern `error.message` → `error.type` enum documentado
- [ ] Tabela de saturation por tipo de Edge Function (RAG, queue consumer, etc.)
- [ ] Cross-refs Markdown ativos (skill + agent)
- [ ] `## Ver também` ganhou 2 entries (sem reordenar existentes)
- [ ] Smoke sync valida
- [ ] Cobre INT-SB-V2-01 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.8 (anti-pitfall A2)
2. Edge Function gerada SEMPRE inclui 4 signals (não é mais opcional)
3. Snippet OTel TypeScript pronto-para-copiar em template
4. `error.type` enum (não message) explícito — anti-pattern crítico de cardinalidade
5. Saturation resource-specific (4 tipos típicos de Edge Function tabulados)
6. Cross-refs ATIVOS (skill canônica + agent retro-instrumenter)
7. `## Observabilidade integrada` preservada (v1.9 OTel SDK + spans + propagation continua relevante)
8. Smoke sync valida descoberta em `.claude/agents/`

## Notes

- **Patch editorial substancial** — adiciona seção completa (~80-100 linhas) mas todas em adição, sem deletar v1.9
- v1.9 (`## Observabilidade integrada`) e v1.10 (`## Four Golden Signals`) coexistem: v1.9 cobre OTel SDK + spans + tracing; v1.10 cobre o **conjunto mínimo de 4 instrumentos métricos**
- Novos Edge Functions geradas após este patch já saem com os 4 signals — `golden-signals-instrumenter` (v1.10) é apenas para retro-instrumentação de funções legacy
- Phase 41 vai criar gate `golden-signals-coverage` que regex-checa `histogram\|counter\|gauge\|saturation` em código tocado por fase
