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
