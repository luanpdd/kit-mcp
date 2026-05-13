---
name: supabase-realtime
description: Use ao implementar Realtime — broadcast com private:true, naming scope:entity:id, RLS sobre realtime.messages, removeChannel cleanup, migrar de postgres_changes.
---

# Supabase — Realtime

## Quando usar

LLM carrega esta skill quando implementar features Realtime em Supabase (chat, presence, notifications, live dashboards). Trigger phrases:

- "Supabase Realtime", "broadcast", "presence"
- "subscrever a mudanças no banco em tempo real"
- "WebSocket Supabase"
- "migrar postgres_changes para broadcast"
- "RLS realtime.messages"
- "channel state", "removeChannel"

## Regras absolutas

- **Use `broadcast` por default** — `postgres_changes` é pattern legado (single-threaded, não escala). **Migrar para broadcast** em features novas.
- **`private: true`** em todos os canais novos — exige autenticação + RLS sobre `realtime.messages`. Default em produção 2026.
- **Naming canônico `scope:entity:id`** — ex: `room:messages:abc123`, `user:notifications:xyz789`, `org:announcements:org_42`.
- **Eventos em `entity_action`** — ex: `message_inserted`, `task_updated`, `presence_joined`.
- **`removeChannel` no cleanup obrigatório** — chamar `supabase.removeChannel(channel)` em `useEffect return` ou equivalente. Sem cleanup, memory leak + stale state (anti-pitfall B1).
- **State checking antes de subscribe** — `if (channel.state === 'joined') return;` evita double-subscribe.
- **RLS sobre `realtime.messages`** — SELECT (read) e INSERT (write) policies separadas, com index nas colunas usadas.
- **Use Presence com moderação** — apenas para online status / cursors colaborativos, não para listas de objects (use queries normais).
- Realtime tem **retry built-in** — log `status` no callback do `subscribe` mas não implementar retry manual.

## Patterns canônicos

### Subscribe via broadcast — client com cleanup

```ts
// PT-BR: subscrição típica em Client Component
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export function ChatRoom({ roomId }: { roomId: string }) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    const channel = supabase
      .channel(`room:messages:${roomId}`, { config: { private: true } })
      .on('broadcast', { event: 'message_inserted' }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as Message])
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('joined channel')
        if (status === 'CHANNEL_ERROR') console.error('channel error')
      })

    // PT-BR: cleanup obrigatório — sem isso, memory leak
    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  return <ul>{messages.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
}
```

### RLS sobre `realtime.messages`

```sql
-- PT-BR: SELECT policy permite ouvir broadcast em canal autenticado
-- Granular: SELECT = read, INSERT = write — duas policies separadas
create policy "auth_select_realtime_messages"
  on realtime.messages
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- PT-BR: INSERT policy permite enviar broadcast
create policy "auth_insert_realtime_messages"
  on realtime.messages
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

-- PT-BR: index obrigatório (extension é a coluna usada por broadcast)
create index if not exists realtime_messages_extension_idx
  on realtime.messages (extension);
```

### DB trigger via `realtime.broadcast_changes`

Para emitir broadcast quando linha de tabela muda (substitui `postgres_changes`):

```sql
-- PT-BR: trigger function emite broadcast no canal scope:entity:id
create or replace function public.notify_message_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'room:messages:' || new.room_id::text,    -- canal
    'message_inserted',                        -- event name
    'INSERT',                                  -- operation
    'messages',                                -- table
    'public',                                  -- schema
    new,                                       -- new row
    null                                       -- old row
  );
  return new;
end;
$$;

create trigger messages_broadcast_on_insert
  after insert on public.messages
  for each row
  execute function public.notify_message_insert();
```

### Presence — apenas para online status

```ts
// PT-BR: presence é sparingly — só para "quem está online"
const channel = supabase
  .channel(`room:${roomId}`, { config: { private: true } })
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    setOnlineUsers(Object.keys(state))
  })
  .subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return
    await channel.track({ user_id: userId, online_at: new Date().toISOString() })
  })

return () => {
  supabase.removeChannel(channel)
}
```

### Migrar de `postgres_changes` para `broadcast`

```ts
// ❌ PADRÃO LEGADO — postgres_changes
const channel = supabase
  .channel('messages_changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, callback)
  .subscribe()

// ✅ PADRÃO ATUAL — broadcast com trigger DB
// 1. Criar trigger SQL `realtime.broadcast_changes` (ver pattern acima)
// 2. Subscribe via broadcast no client:
const channel = supabase
  .channel(`room:messages:${roomId}`, { config: { private: true } })
  .on('broadcast', { event: 'message_inserted' }, callback)
  .subscribe()
```

### `realtime.send` vs `realtime.broadcast_changes` — qual usar

A doc oficial expõe **duas funções SQL** para emitir broadcast a partir do banco. Escolha por intent:

| Função | Quando usar | Payload |
|---|---|---|
| `realtime.broadcast_changes(topic, event, op, table, schema, new, old)` | **Espelhar mudança de tabela** — INSERT/UPDATE/DELETE. Payload já formatado com schema/table/op/record. | Auto a partir de `NEW`/`OLD` |
| `realtime.send(payload jsonb, event text, topic text, is_private bool)` | **Notificação custom / payload filtrado** — eventos sem mapeamento 1:1 a row change. Você define exatamente o que vai. | Manual |

```sql
-- PT-BR: notificação custom — só campos públicos, sem PII
create or replace function public.notify_message_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform realtime.send(
      jsonb_build_object(
        'message_id', new.id,
        'room_id', new.room_id,
        'created_at', new.created_at
        -- author_id intencionalmente omitido (PII)
      ),
      'message_created',                            -- event
      'room:' || new.room_id::text || ':activity',  -- topic
      true                                          -- is_private (default em prod)
    );
  end if;
  return null;
end;
$$;
```

> O flag `is_private` no `realtime.send` **deve casar** com o `private` config no client. Public message para channel private = não entrega.

### REST API — broadcast server-side (sem WebSocket)

Para enviar broadcast a partir de um servidor (Edge Function, backend Next.js API route, worker, cron), use o endpoint HTTP em vez de manter um WebSocket aberto:

```ts
// PT-BR: enviar broadcast via REST de um server — não precisa subscribe
const response = await fetch(
  `https://${PROJECT_REF}.supabase.co/realtime/v1/api/broadcast`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only key
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `room:messages:${roomId}`,
          event: 'message_inserted',
          payload: { id, text, user_id },
          private: true, // deve casar com o channel client-side
        },
      ],
    }),
  }
)
```

Tradeoff: HTTP add ~1 RTT por mensagem vs WebSocket persistente; mas elimina necessidade de manter conexão WS em serverless/edge functions.

### Broadcast Replay (v2.74.0+) — recuperar mensagens passadas

Disponível em `@supabase/supabase-js@2.74.0+`. Permite que clients **private** acessem broadcasts emitidos pelo DB (via `realtime.send`/`realtime.broadcast_changes`) **antes** de subscribar.

```ts
const channel = supabase.channel(`room:${roomId}`, {
  config: {
    private: true,
    broadcast: {
      replay: {
        since: Date.now() - 60_000, // últimos 60s (epoch ms)
        limit: 25,                  // máximo permitido pela spec
      },
    },
  },
})

channel.on('broadcast', { event: 'message_inserted' }, ({ payload, meta }) => {
  if (meta?.replayed) {
    // PT-BR: mensagem do passado — não tocar som de notificação
    appendMessage(payload, { historical: true })
  } else {
    appendMessage(payload, { historical: false })
  }
}).subscribe()
```

**Quando usar:** chat com histórico recente, dashboards com últimos N eventos, reconexão após network drop, page reload sem perder estado. **Limitação:** só mensagens emitidas pelo DB (`realtime.send`/`broadcast_changes`); mensagens enviadas via client `channel.send()` NÃO são replayed.

### Authorization — usar `realtime.topic()` e JWT claims em RLS

Em policies sobre `realtime.messages`, helpers:

- **`realtime.topic()`** — retorna o nome do canal que o cliente está tentando entrar. Use para matchear policy contra app data (ex: room_id no topic).
- **`current_setting('request.jwt.claims')::json`** — acessa claims do JWT do client. Permite checks tipo "só usuário com role X", "só email @empresa.com".

```sql
-- PT-BR: só membros da room podem ouvir broadcast daquela room
-- Topic pattern: room:messages:<room_id> — split_part extrai room_id (3º segmento)
create policy "room_members_can_listen"
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.user_id = (select auth.uid())
      and rm.room_id::text = split_part(realtime.topic(), ':', 3)
  )
);

-- PT-BR: claim-based — só usuários com role 'admin' podem broadcast em :admin topics
create policy "admin_role_can_broadcast_admin"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() like '%:admin:%'
  and (current_setting('request.jwt.claims')::json->>'user_role') = 'admin'
);
```

> RLS sobre `realtime.messages` é **avaliada na hora do JOIN do canal** (cache por sessão). Token refresh dispara reavaliação — ver "Custom JWT" abaixo.

### Custom JWT e refresh — `supabase.realtime.setAuth()`

Realtime mantém o token ativo do client em memória. Para tokens custom (assinados com seu JWT secret) ou refresh após expiração:

```ts
// PT-BR: setar token customizado ANTES de subscribar canais
supabase.realtime.setAuth(customSignedJwt)

const channel = supabase
  .channel('private-thing', { config: { private: true } })
  .on('broadcast', { event: 'x' }, callback)
  .subscribe()

// PT-BR: refresh quando token está perto de expirar
function onTokenRefreshed(newJwt: string) {
  supabase.realtime.setAuth(newJwt)
  // canais privados existentes mantêm conexão, mas RLS é reavaliada
}
```

**NUNCA** exponha `service_role` no client — ele bypassa RLS. Token refresh deve ser feito proativamente; sem refresh, conexão fecha quando JWT expira (TTL default 1h no Supabase Auth).

### Self-send e Ack — opções para teste e confirmação

```ts
const channel = supabase.channel('test-channel', {
  config: {
    private: true,
    broadcast: {
      self: true,   // PT-BR: receber as próprias broadcasts (default false) — útil em testes
      ack: true,    // PT-BR: confirmação do server (Promise resolve quando entregue)
    },
  },
})

channel.subscribe(async (status) => {
  if (status !== 'SUBSCRIBED') return
  const response = await channel.send({
    type: 'broadcast',
    event: 'test',
    payload: {},
  })
  // PT-BR: com ack:true, response indica 'ok' | 'error' | 'timed_out'
  console.log('delivery:', response)
})
```

Use `self:true` em **dev/test only** (loops em prod). Use `ack:true` quando latência matters e você precisa retry (ex: chat com "enviada/falhou").

### `replica identity full` — old record em UPDATE/DELETE (postgres_changes legacy)

Aplica-se apenas a **`postgres_changes`** legacy (broadcast com trigger não precisa disso — você passa `old` explicit). Por default Postgres só envia o **primary key** do row antigo em UPDATE/DELETE pelo replication slot. Para receber **todas** as colunas anteriores:

```sql
-- PT-BR: replica identity full faz logical replication carregar row inteiro
alter table public.messages replica identity full;
```

Custo: aumenta volume de WAL (toda coluna replicada). **DELETE com RLS não dispara para clients** — Postgres não consegue avaliar policies em rows que não existem mais; só PK aparece e mesmo assim sem auth check.

## Limits & quotas por plano

Limites canônicos da doc oficial — saber estes evita surpresa em prod:

| Métrica | Free | Pro | Pro no spend cap / Team | Enterprise |
|---|---|---|---|---|
| Concurrent connections | 200 | 500 | 10.000 | 10.000+ |
| Messages/sec | 100 | 500 | 2.500 | 2.500+ |
| Channel joins/sec | 100 | 500 | 2.500 | 2.500+ |
| Channels por connection | 100 | 100 | 100 | 100+ |
| Presence keys por objeto | 10 | 10 | 10 | 10+ |
| Presence msgs/sec | 20 | 50 | 1.000 | 1.000+ |
| Broadcast payload | 256 KB | 3 MB | 3 MB | 3+ MB |
| Postgres changes payload | 1 MB | 1 MB | 1 MB | 1+ MB |

**Pricing usage (pós-quota):** ~$2.50 / milhão de messages, ~$10 / mil peak connections (Pro). Quotas mensais: 2M msgs + 200 connections (Free), 5M msgs + 500 connections (Pro/Team).

## Error codes canônicos

Mensagens que aparecem em `subscribe(status, err)` callback ou em [Realtime Logs](https://supabase.com/dashboard/project/_/database/realtime-logs):

| Código | Significado | Fix |
|---|---|---|
| `too_many_connections` | Project bateu Concurrent Connections limit | Upgrade plan ou audit connection leak (cleanup faltando) |
| `too_many_joins` | Channel join rate excedido (joins/sec) | Throttle subscribes; usa 1 canal com vários filters em vez de N canais |
| `too_many_channels` | Channels por connection > 100 | Use 1 connection para N channels; nunca 1 connection por channel |
| `tenant_events` | Project excedeu Messages/sec | Reduza throughput ou upgrade plan; reconnect é automático quando baixa |
| `unauthorized` | RLS sobre `realtime.messages` negou; token inválido | Verifique policy + JWT válido + `private: true` casando com SQL `is_private` |
| `CHANNEL_ERROR` | Erro genérico — server-side issue | Veja Realtime Logs para detalhe; nunca silenciar este status |
| `TIMED_OUT` | WebSocket heartbeat não recebido (~30s) | Verifique network; em Node v18+ heartbeat custom pode ser necessário |

## Anti-patterns

### Anti-pattern 1: Canal sem `private: true`

**Errado:**
```ts
const channel = supabase.channel('messages')                  // canal público
  .on('broadcast', { event: 'msg' }, callback)
  .subscribe()
```

**Por quê:** canal público — qualquer cliente recebe payload sem RLS. Em produção isso vaza dados (broadcast pode incluir info sensível).

**Certo:**
```ts
const channel = supabase
  .channel(`room:messages:${roomId}`, { config: { private: true } })
  .on('broadcast', { event: 'message_inserted' }, callback)
  .subscribe()
```

### Anti-pattern 2: Subscribe sem `removeChannel` no cleanup

**Errado:**
```tsx
useEffect(() => {
  const channel = supabase.channel('...').subscribe()
  // ⚠ sem return — canal nunca limpo
}, [])
```

**Por quê:** memory leak. Em SPA com navegação, canais antigos continuam recebendo eventos — UI fica em estado inconsistente. WebSocket connections crescem indefinidamente.

**Certo:**
```tsx
useEffect(() => {
  const channel = supabase.channel('...').subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

### Anti-pattern 3: `postgres_changes` em features novas

**Errado:**
```ts
supabase.channel('changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, callback)
  .subscribe()
```

**Por quê:** `postgres_changes` é single-threaded em Realtime backend. Em escala (>100 connections, >1k events/sec), throughput cai drasticamente. Documentado em [Realtime Limits](https://supabase.com/docs/guides/realtime/limits).

**Certo:** trigger DB com `realtime.broadcast_changes` + subscribe via `broadcast` (ver pattern "Migrar" acima).

### Anti-pattern 4: Presence para listar objetos

**Errado:**
```ts
// ⚠ usar presence para listar tasks ativas
channel.on('presence', { event: 'sync' }, () => {
  const tasks = Object.values(channel.presenceState())
  setTasks(tasks)
})
```

**Por quê:** Presence é projetado para "quem está online" — state efêmero ligado a connection. Para listas de objetos, use query normal + broadcast quando muda. Presence inflado degrada toda a infraestrutura Realtime do projeto.

**Certo:** query SQL para `tasks` + broadcast em mudanças via trigger DB.

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS sobre `realtime.messages` (SELECT + INSERT separados)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — trigger functions com `set search_path = ''`
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — autenticação que habilita canais `private: true`
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions disparando broadcast via `realtime.send`
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN
