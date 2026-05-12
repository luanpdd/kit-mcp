---
name: whatsapp-conversation-state-machine
description: Use ao modelar conversação WhatsApp como state machine xstate v5 + persistência em PG…
---

# WhatsApp Conversation State Machine — xstate v5 + Postgres

## Quando usar

LLM carrega esta skill ao modelar fluxo de conversação WhatsApp em B2B (atendimento, vendas, automação). Trigger phrases:

- "WhatsApp conversation state", "fluxo conversa whatsapp"
- "xstate v5 conversation", "state machine xstate"
- "conversation persisted Postgres"
- "conversation handoff bot human"
- "WhatsApp opt-in opt-out flow"

## Regras absolutas

**REGRA #1 (state persistido em PG, não em memória):** State da conversa **SEMPRE** persistido em `conversations.state` (JSONB). Memória in-process = state perdido em restart de Edge Function ou cold start. Conversa multi-turn quebra.

**REGRA #2 (state machine declarativo via xstate v5):** Use `setup({...}).createMachine({...})` do xstate v5 para definir transições explicitamente. Substitui `if/else` espalhados por regras de transição auditáveis.

**REGRA #3 (transições registradas em audit_log):** Toda transição de state emite evento `custom_conversation_transition` em `audit_logs` com `from_state`, `to_state`, `trigger_message_id`, `org_id`.

**REGRA #4 (timeout para abandono):** Conversa em estado intermediário (`waiting_user_reply`) por > 24h transiciona automaticamente para `abandoned` via `pg_cron`. Reset a partir de nova mensagem do user.

**REGRA #5 (handoff bot→human explícito):** Transition `bot_handling` → `human_handoff` é evento explícito (palavra-chave do user, escalação automática, ou button click). Marca `assigned_to_user_id` no conversation. Bot para de responder.

## Patterns canônicos

### Tabela `conversations`

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_phone text not null,
  contact_name text,
  state text not null default 'started'
    check (state in (
      'started',           -- primeira mensagem inbound recebida
      'opted_in',          -- user explicitamente opt-in para automação
      'engaged',           -- user respondeu pelo menos 1×
      'bot_handling',      -- bot está processando
      'waiting_user_reply',-- bot enviou pergunta, espera resposta
      'human_handoff',     -- atendente humano assumiu
      'action_taken',      -- conversa gerou ação (lead criado, agendamento, etc.)
      'abandoned',         -- timeout 24h sem resposta
      'closed'             -- conversa explicitamente encerrada
    )),
  state_data jsonb default '{}'::jsonb,  -- xstate context (variables, accumulated data)
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  lead_id uuid,  -- FK lazy para leads (criado on action_taken)
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (org_id, contact_phone, started_at)
);

create index conversations_org_phone_idx on public.conversations (org_id, contact_phone);
create index conversations_state_idx on public.conversations (state) where state in ('waiting_user_reply', 'bot_handling');
create index conversations_assigned_idx on public.conversations (assigned_to_user_id) where assigned_to_user_id is not null;
```

### State machine em xstate v5 (Edge Function)

```typescript
// supabase/functions/whatsapp-process/conversation-machine.ts
import { setup, createActor } from 'jsr:xstate@5'

export const conversationMachine = setup({
  types: {
    context: {} as {
      orgId: string
      contactPhone: string
      contactName?: string
      lastMessageContent?: string
      collectedFields: Record<string, string>
    },
    events: {} as
      | { type: 'INBOUND_MESSAGE'; content: string }
      | { type: 'OPT_IN_KEYWORD' }
      | { type: 'OPT_OUT_KEYWORD' }
      | { type: 'BOT_REPLIED'; question?: string }
      | { type: 'USER_REPLIED'; content: string }
      | { type: 'HUMAN_HANDOFF_REQUESTED'; reason?: string }
      | { type: 'ACTION_TAKEN'; actionType: string; leadId?: string }
      | { type: 'TIMEOUT_24H' }
      | { type: 'CLOSE' }
  },
  guards: {
    isOptInKeyword: ({ event }) => {
      if (event.type !== 'INBOUND_MESSAGE') return false
      return /^(sim|aceito|comecar|start|opt-in)$/i.test(event.content.trim())
    },
    isOptOutKeyword: ({ event }) => {
      if (event.type !== 'INBOUND_MESSAGE') return false
      return /^(nao|sair|stop|opt-out|cancelar)$/i.test(event.content.trim())
    },
    isHandoffKeyword: ({ event }) => {
      if (event.type !== 'INBOUND_MESSAGE') return false
      return /(atendente|humano|falar com pessoa|human)/i.test(event.content)
    }
  }
}).createMachine({
  id: 'conversation',
  initial: 'started',
  context: ({ input }) => input,
  states: {
    started: {
      on: {
        INBOUND_MESSAGE: [
          { guard: 'isOptInKeyword', target: 'opted_in' },
          { guard: 'isHandoffKeyword', target: 'human_handoff' },
          { target: 'engaged' }
        ]
      }
    },
    opted_in: {
      on: {
        BOT_REPLIED: { target: 'waiting_user_reply' }
      }
    },
    engaged: {
      on: {
        BOT_REPLIED: { target: 'waiting_user_reply' },
        HUMAN_HANDOFF_REQUESTED: { target: 'human_handoff' }
      }
    },
    waiting_user_reply: {
      on: {
        USER_REPLIED: { target: 'bot_handling' },
        TIMEOUT_24H: { target: 'abandoned' },
        HUMAN_HANDOFF_REQUESTED: { target: 'human_handoff' }
      }
    },
    bot_handling: {
      on: {
        BOT_REPLIED: { target: 'waiting_user_reply' },
        ACTION_TAKEN: { target: 'action_taken' },
        HUMAN_HANDOFF_REQUESTED: { target: 'human_handoff' }
      }
    },
    human_handoff: {
      on: {
        ACTION_TAKEN: { target: 'action_taken' },
        CLOSE: { target: 'closed' }
      }
    },
    action_taken: {
      on: {
        INBOUND_MESSAGE: { target: 'engaged' },
        CLOSE: { target: 'closed' }
      }
    },
    abandoned: {
      on: {
        INBOUND_MESSAGE: { target: 'engaged' }  // re-engaja
      }
    },
    closed: {
      type: 'final'
    }
  }
})
```

### Persistência — load + transition + save

```typescript
// PT-BR: hydrate state machine do PG, processa evento, persiste novo state
async function processConversationEvent(orgId: string, contactPhone: string, event: ConversationEvent) {
  // 1. Load existing conversation
  const { data: conv } = await admin
    .from('conversations')
    .select('*')
    .eq('org_id', orgId)
    .eq('contact_phone', contactPhone)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  // 2. Hydrate xstate actor com state persistido
  const actor = createActor(conversationMachine, {
    input: { orgId, contactPhone, contactName: conv?.contact_name, collectedFields: conv?.state_data || {} },
    snapshot: conv ? { value: conv.state, context: conv.state_data, status: 'active' } : undefined
  })
  actor.start()

  // 3. Send event
  actor.send(event)

  // 4. Get new state
  const snapshot = actor.getSnapshot()
  const newState = snapshot.value as string

  // 5. Persist (REGRA #1)
  await admin.from('conversations').upsert({
    id: conv?.id,
    org_id: orgId,
    contact_phone: contactPhone,
    state: newState,
    state_data: snapshot.context,
    last_message_at: new Date().toISOString()
  })

  // 6. Audit transition (REGRA #3)
  if (conv?.state !== newState) {
    await admin.rpc('audit_log', {
      p_event_type: 'custom_conversation_transition',
      p_tenant_id: orgId,
      p_payload: {
        from_state: conv?.state,
        to_state: newState,
        contact_phone: contactPhone
      }
    })
  }

  return snapshot
}
```

### Cron timeout 24h (REGRA #4)

```sql
select cron.schedule(
  'conversation-timeout-24h',
  '*/30 * * * *',  -- a cada 30min
  $$
    update public.conversations
    set state = 'abandoned',
        last_message_at = now()
    where state = 'waiting_user_reply'
      and last_message_at < now() - interval '24 hours';
  $$
);
```

## Anti-patterns

### Anti-pattern 1: State em variável global da Edge Function

**Errado:**
```typescript
const conversationStates = new Map<string, string>()  // in-memory
```

**Por quê:** Edge Function reinicia (cold start) → Map vazio → conversa perdida.

**Certo:** REGRA #1 — `conversations.state` em PG, hydrate xstate actor com snapshot.

### Anti-pattern 2: if/else aninhado em vez de state machine

**Errado:**
```typescript
if (conv.state === 'started') {
  if (msg.includes('sim')) { ... }
  else if (msg.includes('atendente')) { ... }
  // 50 lines of nested ifs
}
```

**Por quê:** transições implícitas, hard to audit, bug silencioso quando adiciona novo estado.

**Certo:** REGRA #2 — xstate `setup({...}).createMachine({...})` declarativo.

### Anti-pattern 3: Sem timeout para abandono

**Errado:**
```sql
-- Nenhum cron — conversas em waiting_user_reply ficam para sempre
```

**Por quê:** dashboards lotados de conversas "abertas" que na verdade abandonadas. Métricas de conversion erradas.

**Certo:** REGRA #4 — pg_cron 30min checa timeout 24h.

## Ver também

- [evolution-go-whatsapp-integration](../evolution-go-whatsapp-integration/SKILL.md) — sibling, webhook handler integra com state machine
- [crm-lead-pipeline-patterns](../crm-lead-pipeline-patterns/SKILL.md) — Phase 113, conversa.action_taken → lead criado
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — eventos `custom_conversation_transition`
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pg_cron timeout 24h
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `conversation state machine`
- [xstate v5 docs](https://stately.ai/docs/xstate) — biblioteca canônica
