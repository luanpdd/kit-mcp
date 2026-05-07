---
phase: 39
plan: 06
title: Patch supabase-storage-implementer — saturation signal (gauge bucket size + counter quota)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/supabase-storage-implementer.md
requirements: [INT-SB-V2-04]
status: ready
---

# Plan 06 — Patch `kit/agents/supabase-storage-implementer.md`

## Goal

Estender o agente `supabase-storage-implementer` (v1.8) para que **uploads emitam saturation signal** — `gauge` de bucket size em bytes (% do quota plan) + `counter` de quota near-exhaustion events. Patch adiciona seção "Saturation signal" referenciando a skill `four-golden-signals` (v1.10 / Phase 36) e o agente `golden-signals-instrumenter` (v1.10 / Phase 37). Frontmatter (`description`, `tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-SB-V2-04**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/agents/supabase-storage-implementer.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `name`, `description`, `tools` (`Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql`), `color: orange` preservados byte-a-byte
- **Cross-ref Markdown ATIVO** — `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` + `[golden-signals-instrumenter](./golden-signals-instrumenter.md)`
- **Posicionamento canônico** — patch é nova seção `## Saturation signal — bucket size + quota` inserida **após** `## Observabilidade integrada` e **antes** de `## Ver também` (preserva ordem editorial existente)
- **Não modificar Steps existentes (0-8)** — toda lógica de geração de bucket + RLS + client code preservada
- **Não modificar bloco `## Observabilidade integrada`** — v1.8 já documenta span por upload/download + sampling + audit log; v1.10 adiciona o **4º signal** (saturation) que faltava
- **Atualizar `## Ver também`** — adicionar 2 entradas (skill + agent) ao final da lista existente
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes; usar code fences ts/sql consistentes

## Tasks

<task id="39-06-T1" name="Verificar estado e localizar âncoras de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-storage-implementer.md (frontmatter linhas 1-6 + localizar `## Observabilidade integrada` + `## Ver também` + final do arquivo)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 30-50 — capturar definição canônica de saturation)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual (`name: supabase-storage-implementer`, `tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql`, `color: orange`)
    2. Localizar âncora `## Observabilidade integrada` (esperada ~linha 237)
    3. Localizar âncora `## Ver também` (esperada ~linha 252)
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado
    - Ambas headings localizadas
    - Skill `four-golden-signals` confirmada existir
  </acceptance_criteria>
</task>

<task id="39-06-T2" name="Inserir nova seção ## Saturation signal — bucket size + quota">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-storage-implementer.md (foco em bloco `## Observabilidade integrada` + transição para `## Ver também`)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (snippet OTel ObservableGauge)
  </read_first>
  <action>
    Usar Edit para inserir, **imediatamente antes** da heading `## Ver também` e **após** o bloco completo `## Observabilidade integrada` (que termina com parágrafo "Output adicionado: seção `## Observability hooks`..."), a seguinte nova seção:

    ```markdown
    ## Saturation signal — bucket size + quota

    > Cross-ref canônico: [four-golden-signals](../skills/four-golden-signals/SKILL.md) (cap 6 do livro Google SRE — Monitoring Distributed Systems). Para retro-instrumentar storage existente com os 4 signals, delegar para [golden-signals-instrumenter](./golden-signals-instrumenter.md).

    Storage tem o **recurso mais escasso explícito**: o quota do plano (Free 1 GB, Pro 100 GB, Team 1 TB, etc.). Sem signal de saturation, time descobre quota exhaustion via incident (uploads falham silenciosamente em UX) — **anti-pattern clássico** de white-box monitoring sem detecção precoce. O bloco `## Observabilidade integrada` acima cobre Latency / Traffic / Errors (3 signals); este bloco completa com **Saturation** — o 4º signal canônico.

    ### Saturation = bucket size ÷ quota plan

    | Plano | Quota total | Threshold ALERT (yellow) | Threshold PAGE (red) |
    |---|---|---|---|
    | Free | 1 GB | 80% (800 MB) | 95% (950 MB) |
    | Pro | 100 GB | 80% (80 GB) | 95% (95 GB) |
    | Team | 1 TB | 80% (800 GB) | 95% (950 GB) |
    | Enterprise | custom | custom | custom |

    ### Signal 1 — Gauge: bucket size atual (bytes)

    `ObservableGauge` (push periódico via callback) mede tamanho real de cada bucket. Callback consulta `storage.objects` agregado:

    ```ts
    // PT-BR: 4º signal — saturation (gauge de bucket size em bytes)
    import { metrics } from 'npm:@opentelemetry/api@1.9.0'
    const meter = metrics.getMeter('supabase-storage')

    meter.createObservableGauge('storage_bucket_bytes', {
      description: 'Tamanho atual em bytes por bucket — saturation signal',
      unit: 'bytes',
    }).addCallback(async (result) => {
      // PT-BR: query agregada (rodar via service-role client em cron)
      const sizes = await supabaseAdmin.rpc('storage_bucket_sizes_bytes')
      // expected: [{ bucket_id: 'avatars', total_bytes: 12345678 }, ...]
      for (const row of sizes ?? []) {
        result.observe(row.total_bytes, { 'bucket.id': row.bucket_id })
      }
    })

    meter.createObservableGauge('storage_saturation_pct', {
      description: 'Saturation = bucket size / quota plan — % do quota usado',
      unit: '1',  // ratio (0..1)
    }).addCallback(async (result) => {
      const sizes = await supabaseAdmin.rpc('storage_bucket_sizes_bytes')
      const QUOTA_BYTES = Number(Deno.env.get('SUPABASE_PLAN_QUOTA_BYTES') ?? 1_000_000_000)  // default Free
      for (const row of sizes ?? []) {
        result.observe(row.total_bytes / QUOTA_BYTES, { 'bucket.id': row.bucket_id })
      }
    })
    ```

    SQL helper para o callback:

    ```sql
    -- PT-BR: function que retorna bytes por bucket — chamada por callback OTel
    create or replace function public.storage_bucket_sizes_bytes()
    returns table (bucket_id text, total_bytes bigint)
    language sql
    security definer
    set search_path = ''
    as $$
      select bucket_id, coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes
      from storage.objects
      group by bucket_id;
    $$;
    ```

    ### Signal 2 — Counter: quota near-exhaustion events

    `Counter` incrementa a cada upload que **detecta** approach a quota threshold (80%, 95%). Permite contar eventos críticos para alerting:

    ```ts
    // PT-BR: counter incrementado em cada upload
    const quotaWarnings = meter.createCounter('storage_quota_warnings_total', {
      description: 'Counter de eventos onde upload aproxima quota — alimentar alert SLO',
    })

    export async function uploadInstrumented(file: File, filename: string) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not authenticated')

      const path = `${user.id}/${filename}`

      // PT-BR: pre-check — saturation atual antes de upload
      const sizes = await supabaseAdmin.rpc('storage_bucket_sizes_bytes')
      const bucketSize = sizes?.find(s => s.bucket_id === '<bucket_name>')?.total_bytes ?? 0
      const QUOTA = Number(Deno.env.get('SUPABASE_PLAN_QUOTA_BYTES') ?? 1_000_000_000)
      const saturation = bucketSize / QUOTA

      if (saturation >= 0.95) {
        quotaWarnings.add(1, { 'bucket.id': '<bucket_name>', threshold: '95pct' })
      } else if (saturation >= 0.80) {
        quotaWarnings.add(1, { 'bucket.id': '<bucket_name>', threshold: '80pct' })
      }

      const { data, error } = await supabase.storage
        .from('<bucket_name>')
        .upload(path, file, { upsert: true })

      if (error) throw error
      return data.path
    }
    ```

    ### Cron schedule sugerido

    Saturation gauge não precisa rodar em cada request — agendar leitura via `pg_cron` (ou OTel SDK polling interval = 60s) é suficiente:

    ```sql
    -- PT-BR: refresh saturation cache a cada 60s para gauge OTel
    create materialized view if not exists obs.storage_saturation as
      select bucket_id, sum((metadata->>'size')::bigint) as total_bytes, now() as captured_at
      from storage.objects
      group by bucket_id;

    select cron.schedule(
      'refresh_storage_saturation',
      '* * * * *',  -- a cada 1 min
      $$ refresh materialized view concurrently obs.storage_saturation $$
    );
    ```

    ### Alert SLO sobre saturation

    Saturation alimenta SLO event-based — não threshold direto:

    ```yaml
    # PT-BR: SLO sobre quota — % de tempo em yellow ou worse
    slo:
      name: storage_quota_healthy
      target: 0.99            # 99% do tempo em < 80% quota
      window: 30d_sliding
      sli:
        type: event_based
        good_event:
          saturation_pct: { lt: 0.80 }
        bad_event:
          saturation_pct: { gte: 0.80 }
    ```

    ### Output do agent — adicionado ao SQL/código gerado

    Quando agent gera bucket privado novo, **sempre inclui**:
    1. Function SQL `storage_bucket_sizes_bytes()` (uma vez por projeto)
    2. Materialized view `obs.storage_saturation` + pg_cron refresh job
    3. Snippet OTel ObservableGauge no código client wrapper
    4. Counter `storage_quota_warnings_total` no upload wrapper
    5. SLO `storage_quota_healthy` em `.planning/slos/<bucket>.yaml`

    ### Anti-patterns prevenidos

    - Saturation = "% disco do servidor" → SEMPRE saturation = % quota plan (recurso correto)
    - Threshold direto em alerta CPU/memory para capacity → SEMPRE SLO event-based sobre saturation_pct
    - Polling de bucket size em cada request → SEMPRE materialized view + pg_cron refresh + OTel polling 60s
    - Plan quota hardcoded → SEMPRE env var `SUPABASE_PLAN_QUOTA_BYTES` (varia por plano, pode ser sobrescrita em test)
    ```

    Posicionamento exato: a nova seção entra entre o **fim** do bloco `## Observabilidade integrada` (após o último parágrafo "Output adicionado: seção `## Observability hooks`...") e a heading `## Ver também`.
  </action>
  <acceptance_criteria>
    - Heading `## Saturation signal — bucket size + quota` existe (count == 1)
    - Cross-refs Markdown literais `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` E `[golden-signals-instrumenter](./golden-signals-instrumenter.md)` presentes
    - Tabela "Saturation = bucket size ÷ quota plan" com 4 rows (Free/Pro/Team/Enterprise)
    - Snippet ts com `createObservableGauge('storage_bucket_bytes')` E `createObservableGauge('storage_saturation_pct')`
    - SQL function `storage_bucket_sizes_bytes()` com `security definer` + `set search_path = ''`
    - Snippet ts com `createCounter('storage_quota_warnings_total')`
    - Bloco "Cron schedule" com materialized view + pg_cron
    - Bloco "Alert SLO" YAML referenciando saturation_pct
    - Bloco "Output do agent" listando 5 itens (function, mv, gauge, counter, SLO)
    - Bloco "Anti-patterns prevenidos" com 4+ items
    - Heading `## Observabilidade integrada` preservada
    - Heading `## Ver também` preservada
  </acceptance_criteria>
</task>

<task id="39-06-T3" name="Atualizar ## Ver também (adicionar 2 entradas)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-storage-implementer.md (bloco `## Ver também` linhas ~252-259 — ler lista atual completa)
  </read_first>
  <action>
    Adicionar exatamente 2 novas entradas ao **fim** da lista existente em `## Ver também`:

    ```markdown
    - [four-golden-signals](../skills/four-golden-signals/SKILL.md) — 4 sinais canônicos (Latency, Traffic, Errors, Saturation) cap 6 livro Google SRE — saturation = bucket size / quota plan
    - [golden-signals-instrumenter](./golden-signals-instrumenter.md) — agent que retro-instrumenta storage existente com os 4 signals
    ```

    Posicionamento: imediatamente após a entrada existente `- [telemetry-sampling](...)` (última do bloco). Não reordenar nem substituir entries existentes.
  </action>
  <acceptance_criteria>
    - Lista `## Ver também` ganhou 2 entries no final
    - Entries pré-existentes preservadas
    - Markdown links literais válidos
  </acceptance_criteria>
</task>

<task id="39-06-T4" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-storage-implementer.md (re-leitura completa)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO
    head -6 kit/agents/supabase-storage-implementer.md
    # Esperado:
    # ---
    # name: supabase-storage-implementer
    # description: Configura Supabase Storage — buckets públicos vs privados, signed URLs, RLS sobre storage.objects com path multi-tenant, image transforms, alerta egress.
    # tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql
    # color: orange
    # ---

    # 2. Heading nova existe
    grep -c "^## Saturation signal" kit/agents/supabase-storage-implementer.md  # esperado: 1

    # 3. Cross-refs ATIVOS
    grep -c "\[four-golden-signals\](../skills/four-golden-signals/SKILL.md)" kit/agents/supabase-storage-implementer.md  # esperado: ≥1
    grep -c "\[golden-signals-instrumenter\](./golden-signals-instrumenter.md)" kit/agents/supabase-storage-implementer.md  # esperado: ≥1

    # 4. OTel APIs canônicas
    grep -c "createObservableGauge" kit/agents/supabase-storage-implementer.md  # esperado: ≥2
    grep -c "createCounter" kit/agents/supabase-storage-implementer.md          # esperado: ≥1

    # 5. Métricas canônicas
    grep -c "storage_bucket_bytes" kit/agents/supabase-storage-implementer.md          # esperado: ≥1
    grep -c "storage_saturation_pct" kit/agents/supabase-storage-implementer.md        # esperado: ≥1
    grep -c "storage_quota_warnings_total" kit/agents/supabase-storage-implementer.md  # esperado: ≥1

    # 6. SQL helper canônico
    grep -c "storage_bucket_sizes_bytes" kit/agents/supabase-storage-implementer.md  # esperado: ≥1
    grep -c "security definer" kit/agents/supabase-storage-implementer.md            # esperado: ≥1

    # 7. Tabela quota por plano
    grep -c "Free.*1 GB\|Pro.*100 GB" kit/agents/supabase-storage-implementer.md  # esperado: ≥1

    # 8. SLO YAML
    grep -c "storage_quota_healthy" kit/agents/supabase-storage-implementer.md  # esperado: ≥1

    # 9. Headings preservadas
    grep -c "^## Observabilidade integrada" kit/agents/supabase-storage-implementer.md  # esperado: 1
    grep -c "^## Ver também" kit/agents/supabase-storage-implementer.md                  # esperado: 1

    # 10. Diff puro de adição
    git diff --numstat kit/agents/supabase-storage-implementer.md
    # Esperado: insertions > 0; deletions ≤ 2 (apenas separador final)

    # 11. Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/agents/supabase-storage-implementer.md" ] && grep -q "Saturation signal" "$TMP/.claude/agents/supabase-storage-implementer.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `head -6` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^## Saturation signal"` == 1
    - 2 cross-refs Markdown ativos (skill + agent)
    - `createObservableGauge` ≥ 2× (bucket_bytes + saturation_pct)
    - `createCounter` ≥ 1× (quota_warnings)
    - 3 métricas canônicas presentes (bucket_bytes, saturation_pct, quota_warnings_total)
    - SQL function `storage_bucket_sizes_bytes()` com `security definer` presente
    - Tabela quota por plano presente (Free/Pro/Team minimo)
    - SLO YAML `storage_quota_healthy` presente
    - Smoke sync propaga
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico
- [ ] Heading `## Saturation signal — bucket size + quota` adicionada (entre `## Observabilidade integrada` e `## Ver também`)
- [ ] Tabela "Saturation = bucket size ÷ quota plan" com 4 plans (Free/Pro/Team/Enterprise) + thresholds 80/95%
- [ ] OTel `ObservableGauge` × 2 (storage_bucket_bytes + storage_saturation_pct)
- [ ] OTel `Counter` × 1 (storage_quota_warnings_total)
- [ ] SQL function `storage_bucket_sizes_bytes()` com `security definer` + `set search_path = ''`
- [ ] Materialized view `obs.storage_saturation` + pg_cron refresh
- [ ] SLO YAML `storage_quota_healthy` exemplificado
- [ ] Bloco "Output do agent" lista os 5 artefatos gerados (function, mv, gauge, counter, SLO)
- [ ] Anti-patterns explícitos (saturation ≠ disco; SLO event-based em vez de threshold direto; mv + cron em vez de polling per-request; env var em vez de hardcode)
- [ ] Cross-refs Markdown ativos (skill + agent)
- [ ] `## Ver também` ganhou 2 entries (sem reordenar existentes)
- [ ] Smoke sync valida
- [ ] Cobre INT-SB-V2-04 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.8 (anti-pitfall A2)
2. Storage agent agora cobre os **4 signals** (Latency + Traffic + Errors do bloco v1.9 + Saturation novo de v1.10)
3. Saturation = bucket size ÷ quota plan (não disco genérico) — recurso correto
4. SQL function canônica + materialized view + pg_cron — não polling per-request
5. Counter de quota near-exhaustion alimenta alert SLO event-based
6. Plan quota via env var (não hardcoded) — varia por tier e é testável
7. Cross-refs ATIVOS (skill canônica + agent retro-instrumenter)
8. `## Observabilidade integrada` preservada (Latency/Traffic/Errors v1.9 continuam)
9. Smoke sync valida descoberta em `.claude/agents/`

## Notes

- **Patch editorial substancial** — adiciona ~120 linhas de seção dedicada (a maior do milestone)
- v1.8 (`## Observabilidade integrada`) cobre 3 signals (latency/traffic/errors implícitos no span); v1.10 adiciona o **4º signal canônico** (saturation) que o livro SRE cap 6 prescreve
- Phase 41 vai criar gate `golden-signals-coverage` que regex-checa `histogram\|counter\|gauge\|saturation` em código tocado por fase — este patch garante que `gauge` + `counter` aparecem em todo storage tocado
- Storage é caso especial: saturation tem recurso ÚNICO claramente identificado (quota plan), diferente de Edge Function onde varia (db_pool / queue / concurrency)
