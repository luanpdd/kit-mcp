---
name: supabase-cron-queues
description: Use ao orquestrar background jobs — pg_cron + pgmq + pg_net pattern cron → pgmq → Edge Function. Sem dep externa. Postgres 15.6.1.143+.
---

# Supabase — Cron + Queues (background jobs)

## Quando usar

LLM carrega esta skill quando implementar background jobs, scheduled tasks ou queues em Supabase **sem dependência externa** (Inngest, Trigger.dev, etc.). Trigger phrases:

- "pg_cron", "supabase cron job"
- "pgmq", "Postgres Message Queue"
- "pg_net", "HTTP from database"
- "background job Supabase"
- "scheduled task Supabase"

## Regras absolutas

- **Extensions necessárias:**
  - **`pg_cron`** — jobs scheduled (cron syntax)
  - **`pgmq`** — Postgres Message Queue (requer Postgres **15.6.1.143+**)
  - **`pg_net`** — HTTP requests do banco (recomendado v0.10.0+)
- **Pattern canônico:** **`cron → pgmq → Edge Function`** — `pg_cron` enfileira mensagens em `pgmq`, Edge Function consome (via cron ou polling).
- **Jobs `pg_cron` curtos** (< 10 min) — jobs longos bloqueiam scheduler. Para jobs longos, enfileire em `pgmq` e processe via Edge Function.
- **`pgmq.send`** para enfileirar; **`pgmq.read` + `pgmq.archive`** para consumir. Visibility timeout previne double processing.
- **`pg_net` é async** — `net.http_post` retorna `request_id`, response chega em `net._http_response`. Não bloqueia caller.
- **Idempotência** — Edge Function consumer deve ser idempotente (mesma mensagem pode ser entregue 2× em retry).
- **Cleanup** — sem `pgmq.archive` ou `pgmq.delete`, mensagem reaparece após visibility timeout (re-processed).

## Patterns canônicos

### Setup das extensions + criar fila

```sql
-- PT-BR: habilitar extensions (uma vez por projeto)
create extension if not exists pg_cron;
create extension if not exists pgmq;
create extension if not exists pg_net;

-- PT-BR: criar fila pgmq
select pgmq.create('email_jobs');

-- PT-BR: opcional — criar fila com retention customizado
-- select pgmq.create_partitioned('large_jobs');
```

### Pattern canônico — `cron → pgmq → Edge Function`

```sql
-- PT-BR: 1. cron job a cada 5 min enfileira pendências em pgmq
select cron.schedule(
  'enqueue-pending-emails',
  '*/5 * * * *',                    -- a cada 5 min
  $$
  insert into pgmq.q_email_jobs (message)
  select jsonb_build_object(
    'user_id', id,
    'kind', 'reminder',
    'enqueued_at', now()
  )
  from public.users
  where pending_email = true
  limit 1000;                       -- batch limitado
  $$
);

-- PT-BR: 2. cron job a cada minuto despara processamento via Edge Function
select cron.schedule(
  'process-email-queue',
  '*/1 * * * *',                    -- a cada minuto
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/process-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.functions_token', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Edge Function consumer — pgmq.read + archive

```ts
// supabase/functions/process-emails/index.ts
// PT-BR: consume da fila pgmq, processa, archive
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SECRET_KEYS')!
  )

  // PT-BR: pegar até 10 mensagens com visibility timeout 30s
  const { data: msgs, error } = await supabase.rpc('pgmq_read', {
    queue_name: 'email_jobs',
    vt: 30,                           // visibility timeout em segundos
    qty: 10,                          // máximo por chamada
  })

  if (error || !msgs?.length) {
    return new Response('no jobs', { status: 200 })
  }

  for (const m of msgs) {
    try {
      // PT-BR: processar mensagem (idempotente!)
      await sendEmail(m.message.user_id, m.message.kind)

      // PT-BR: archive remove da fila e move para arquivo
      await supabase.rpc('pgmq_archive', {
        queue_name: 'email_jobs',
        msg_id: m.msg_id,
      })
    } catch (err) {
      // PT-BR: erro — não archive; visibility timeout expira e mensagem reaparece
      console.error('processing error', m.msg_id, err)
    }
  }

  return new Response(`processed ${msgs.length}`)
})
```

### Job cron simples — sem queue (cuidado: < 10 min)

```sql
-- PT-BR: ok para tarefas leves e rápidas (cleanup, agregação)
select cron.schedule(
  'cleanup-old-sessions',
  '0 3 * * *',                       -- 3am diário
  $$
  delete from public.sessions where expires_at < now() - interval '30 days';
  $$
);
```

### Listar e remover jobs cron

```sql
-- PT-BR: listar todos os jobs
select * from cron.job;

-- PT-BR: remover job
select cron.unschedule('process-email-queue');
```

### `pg_net.http_post` async

```sql
-- PT-BR: dispara HTTP request, retorna request_id imediatamente
select net.http_post(
  url := 'https://api.example.com/webhook',
  headers := jsonb_build_object('Authorization', 'Bearer xxx'),
  body := jsonb_build_object('event', 'task_completed'),
  timeout_milliseconds := 5000
);

-- PT-BR: response chega em net._http_response (consultar depois)
select * from net._http_response order by created desc limit 10;
```

## Anti-patterns

### Anti-pattern 1: Job cron longo (> 10 min)

**Errado:**
```sql
select cron.schedule(
  'heavy-batch-process',
  '0 * * * *',
  $$ select pg_sleep(900); ... $$    -- ⚠ 15 min em pg_cron
);
```

**Por quê:** `pg_cron` worker bloqueia outros jobs enquanto roda. Se job > 10 min ou trava, scheduler atrasa cascata. Em retry após failure, pode trancar inteiramente.

**Certo:** cron enfileira; Edge Function processa pesado:
```sql
-- cron: leve (só enfileira)
select cron.schedule('enqueue-heavy', '0 * * * *', $$
  insert into pgmq.q_heavy_jobs (message) select ...;
$$);
-- Edge Function: pesado (consome com timeout próprio)
```

### Anti-pattern 2: HTTP síncrono direto de pg_cron

**Errado:**
```sql
select cron.schedule('call-api', '*/1 * * * *', $$
  -- ⚠ pg_net é async, mas user pode tentar sync com loops
  select net.http_get('https://api.example.com/long');
$$);
```

**Por quê:** HTTP requests podem demorar segundos a minutos. Se response demora, próxima execução do cron empilha. Em alta latência, scheduler fica trancado.

**Certo:** enfileire em pgmq + Edge Function processa:
```sql
-- cron: enfileira
insert into pgmq.q_api_calls (message) values ('{"endpoint": "/long"}');
-- Edge Function: chama API com timeout próprio + archive
```

### Anti-pattern 3: `pgmq.read` sem `archive` ou `delete`

**Errado:**
```ts
const { data: msgs } = await supabase.rpc('pgmq_read', { queue_name: 'jobs', vt: 30, qty: 10 })
for (const m of msgs) {
  await processJob(m.message)
  // ⚠ esqueceu pgmq_archive
}
```

**Por quê:** após visibility timeout (30s), mensagem reaparece — mesmo job rodado novamente. Em loop, leva a re-processing infinito.

**Certo:**
```ts
for (const m of msgs) {
  try {
    await processJob(m.message)
    await supabase.rpc('pgmq_archive', { queue_name: 'jobs', msg_id: m.msg_id })
  } catch (err) {
    // PT-BR: NÃO archive; mensagem retorna após vt para retry
  }
}
```

### Anti-pattern 4: Edge Function não-idempotente

**Errado:**
```ts
async function processJob(msg) {
  await sendEmail(msg.user_id)              // ⚠ envia email mesmo se já enviado
  await chargeCard(msg.amount)              // ⚠ cobra mesmo se já cobrado
}
```

**Por quê:** retries entregam mesma mensagem 2×+. Sem idempotência, side effects duplicam — usuário recebe 2 emails ou é cobrado 2×.

**Certo:** rastreie estado:
```ts
async function processJob(msg) {
  const { data: existing } = await supabase
    .from('email_log')
    .select('id')
    .eq('msg_id', msg.id)
    .single()
  if (existing) return                     // já processado
  await sendEmail(msg.user_id)
  await supabase.from('email_log').insert({ msg_id: msg.id })
}
```

## Padrões Exactly-Once em pgmq (v1.22+)

> Background jobs em pgmq tendem a duplicate processing em retry/timeout. Padrão canônico (DDIA Ch 11):
> 1. **Dedup table** com `unique(event_id)` — INSERT antes do processamento; falha = já processado.
> 2. **Idempotency key** no handler — mesmo input → mesmo output (sem efeitos colaterais).
> 3. **Transactional outbox** — write DB + event em mesma transação atomic; processador async lê outbox e publica.
>
> Detalhes completos em [`streams-eventos-cdc`](../streams-eventos-cdc/SKILL.md) (v1.22).

## Ver também

- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions consumindo pgmq
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — funções com `set search_path = ''` chamadas em cron
- [supabase-migrations](../supabase-migrations/SKILL.md) — extensions criadas em migrations
- [glossário](../_shared-supabase/glossary.md) — pg_cron, pgmq, pg_net
