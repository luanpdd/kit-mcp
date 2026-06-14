---
name: supabase-auth-hooks
cost_tier: leve
description: Implementa Auth Hooks Supabase (custom access token, send email/SMS, before user created, MFA e password verification) com grants corretos ao supabase_auth_admin e verificacao Standard Webhooks.
---

# Supabase — Auth Hooks

## Quando usar

LLM carrega esta skill quando implementar **Auth Hooks** no Supabase — endpoints que interceptam e modificam o fluxo padrão de autenticação em pontos de execução específicos.

Trigger phrases:

- "auth hook Supabase", "custom access token hook"
- "send email hook", "send sms hook"
- "before user created hook", "MFA verification hook"
- "password verification hook"
- "Postgres function hook", "HTTP hook Supabase"
- `custom_access_token_hook`, `supabase_auth_admin`
- "como bloquear signup por domínio", "como customizar email de auth"
- "hook para rate-limit de login", "Standard Webhooks Supabase"

## Princípio canônico

Auth Hooks são **endpoints síncronos** que o Supabase Auth invoca em pontos específicos do fluxo de autenticação. O hook recebe um payload JSON, pode modificar o comportamento e retorna um JSON de resposta. Erros retornados pelo hook **bloqueiam** a operação de auth correspondente.

**6 hooks disponíveis:**

| Hook | Disponibilidade | Quando é invocado |
|------|----------------|-------------------|
| Before User Created | Free / Pro | Antes de criar novo usuário |
| Custom Access Token | Free / Pro | Antes de emitir JWT (login + refresh) |
| Send SMS | Free / Pro | Quando Supabase Auth precisa enviar SMS (OTP, MFA) |
| Send Email | Free / Pro | Quando Supabase Auth precisa enviar email (confirmação, magic link) |
| MFA Verification | Teams / Enterprise | Ao verificar código MFA |
| Password Verification | Teams / Enterprise | Ao verificar senha de login |

**2 tipos de hook:**

| Tipo | URI | Quando usar |
|------|-----|-------------|
| **Postgres function** | `pg-functions://postgres/public/<nome_fn>` | Lógica simples, acesso direto ao DB, sem I/O externo |
| **HTTP endpoint** | URL HTTPS | Lógica complexa, chamada a APIs externas, Edge Functions |

## Modelo de segurança — Postgres Function Hook

A função hook roda com o Postgres role `supabase_auth_admin` — precisa de grants explícitos:

```sql
-- OBRIGATÓRIO: grants para supabase_auth_admin
grant usage on schema public to supabase_auth_admin;

grant execute
  on function public.minha_funcao_hook
  to supabase_auth_admin;

-- OBRIGATÓRIO: revogar de roles públicos
revoke execute
  on function public.minha_funcao_hook
  from authenticated, anon, public;
```

**Por quê não usar `security definer`:** prefira grants explícitos — `security definer` faz a função rodar com privilégios do owner (geralmente `postgres`) o que é mais amplo do que necessário. Grants são o mínimo necessário e mais auditáveis.

**Exceção:** se a função precisar acessar tabelas ou schemas que `supabase_auth_admin` não tem permissão, use `security definer` com `set search_path = ''` para evitar injeção via search_path:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
-- security definer apenas se necessário para acesso a schema restrito
-- set search_path = ''  -- anti-injeção de schema
as $$
  -- implementação
$$;
```

## Modelo de segurança — HTTP Hook

Hooks HTTP seguem a especificação **Standard Webhooks** para autenticidade das requisições:

```ts
// Headers enviados pelo Supabase Auth em cada chamada HTTP ao hook
// webhook-id: <uuid único por chamada>
// webhook-timestamp: <unix timestamp em segundos>
// webhook-signature: v1=<assinatura HMAC-SHA256 base64>
```

**Verificar assinatura com a lib `standardwebhooks`:**

```ts
// deno / Edge Function
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!
// formato do secret configurado no Supabase: v1,whsec_<base64-secret>

Deno.serve(async (req) => {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  const wh = new Webhook(secret)

  try {
    // lança erro se assinatura inválida
    const event = wh.verify(payload, headers)
    // processar evento verificado
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // assinatura inválida → rejeitar
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Assinatura inválida' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**Formato do secret:** Supabase gera um secret no formato `v1,whsec_<base64>` — usar exatamente este formato ao instanciar `new Webhook(secret)`.

## Configuração — Dashboard e config.toml

**Via Dashboard (produção):**

1. Acessar `Authentication > Hooks` no Dashboard
2. Selecionar o tipo de hook (ex: "Custom Access Token")
3. Escolher tipo: Postgres function ou HTTP
4. Para Postgres: selecionar a função no dropdown
5. Para HTTP: digitar a URL + configurar o secret
6. Salvar

**Via `config.toml` (desenvolvimento local):**

```toml
# supabase/config.toml

# Custom Access Token Hook (Postgres function)
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"

# Custom Access Token Hook (HTTP — Edge Function local)
[auth.hook.custom_access_token]
enabled = true
uri = "http://localhost:54321/functions/v1/custom-access-token-hook"
secrets = "v1,whsec_dGVzdHNlY3JldA=="

# Send Email Hook
[auth.hook.send_email]
enabled = true
uri = "http://localhost:54321/functions/v1/send-email-hook"
secrets = "v1,whsec_dGVzdHNlY3JldA=="

# Send SMS Hook
[auth.hook.send_sms]
enabled = true
uri = "http://localhost:54321/functions/v1/send-sms-hook"
secrets = "v1,whsec_dGVzdHNlY3JldA=="

# Before User Created Hook
[auth.hook.before_user_created]
enabled = true
uri = "pg-functions://postgres/public/before_user_created_hook"

# MFA Verification Hook (apenas Teams/Enterprise)
[auth.hook.mfa_verification_attempt]
enabled = true
uri = "pg-functions://postgres/public/mfa_verification_hook"

# Password Verification Hook (apenas Teams/Enterprise)
[auth.hook.password_verification_attempt]
enabled = true
uri = "pg-functions://postgres/public/password_verification_hook"
```

## Error Handling — Status Codes e Retry

**Formato de erro retornado pelo hook:**

```json
{
  "error": {
    "http_code": 403,
    "message": "Domínio de email não permitido"
  }
}
```

**Comportamento por status code:**

| Status code retornado pelo hook | Comportamento do Supabase Auth |
|---------------------------------|-------------------------------|
| `200` / `202` / `204` | Sucesso — continua o fluxo de auth |
| `400` | Falha permanente — converte em `500` para o cliente (não retry) |
| `403` | Falha permanente — converte em `500` para o cliente (não retry) |
| `429` | Rate-limit — **retry** automático (usar header `Retry-After`) |
| `503` | Serviço indisponível — **retry** automático |

**Respostas retry-able:**

```ts
// Hook que sinaliza rate-limit com retry
return new Response(
  JSON.stringify({ error: { http_code: 429, message: 'Muitas tentativas' } }),
  {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',  // Supabase Auth vai retentar após 60 segundos
    },
  }
)
```

**Regra:** TODAS as respostas de hook (sucesso ou erro) devem ter header `Content-Type: application/json`.

## Hook 1 — Custom Access Token

Invocado antes de cada emissão de JWT (login inicial + refresh). Permite injetar claims customizados.

**Input:**
```json
{
  "user_id": "uuid-do-usuario",
  "claims": {
    "aal": "aal1",
    "sub": "uuid-do-usuario",
    "email": "usuario@empresa.com",
    "role": "authenticated",
    "exp": 1704067200,
    "iat": 1704063600,
    "iss": "https://proj.supabase.co/auth/v1",
    "session_id": "uuid-da-sessao",
    "amr": [{"method": "password", "timestamp": 1704063600}]
  },
  "authentication_method": "password"
}
```

**Output (modificar claims):**
```json
{
  "claims": {
    "aal": "aal1",
    "sub": "uuid-do-usuario",
    "email": "usuario@empresa.com",
    "role": "authenticated",
    "exp": 1704067200,
    "iat": 1704063600,
    "iss": "https://proj.supabase.co/auth/v1",
    "session_id": "uuid-da-sessao",
    "amr": [{"method": "password", "timestamp": 1704063600}],
    "user_role": "admin",
    "org_id": "uuid-da-org"
  }
}
```

**Implementação Postgres canônica (ver skill `supabase-custom-claims-rbac` para pattern completo):**

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    select role into user_role
    from public.user_roles
    where user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    claims := jsonb_set(
      claims,
      '{user_role}',
      case when user_role is not null then to_jsonb(user_role) else 'null'::jsonb end
    );

    return jsonb_set(event, '{claims}', claims);
  end;
$$;

-- grants obrigatórios
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant all on table public.user_roles to supabase_auth_admin;
```

**Usos canônicos do Custom Access Token hook:**

- Reduzir tamanho do JWT (omitir claims não necessários)
- Adicionar claim `user_role`, `org_id`, `plan` ao JWT
- Restringir login por tipo de autenticação (`authentication_method`)
- Adicionar claim `is_admin` baseado em SSO provider

```sql
-- restringir acesso por método de autenticação (ex: SSO apenas para admins)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    auth_method text;
  begin
    auth_method := event->>'authentication_method';
    claims := event->'claims';

    -- adicionar claim que indica se login foi via SSO
    claims := jsonb_set(claims, '{via_sso}', to_jsonb(auth_method = 'sso/saml'));

    return jsonb_set(event, '{claims}', claims);
  end;
$$;
```

## Hook 2 — Before User Created

Invocado antes de criar um novo usuário. Retornar `error` **rejeita** o signup.

**Input:**
```json
{
  "user": {
    "id": "uuid-gerado",
    "email": "novo@dominio.com",
    "phone": "",
    "app_metadata": {},
    "user_metadata": {"nome": "João"},
    "identities": [],
    "created_at": "2026-05-19T00:00:00Z",
    "updated_at": "2026-05-19T00:00:00Z"
  }
}
```

**Bloquear domínios descartáveis:**

```sql
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    email_address text;
    email_domain  text;
    dominio_bloqueado bool;
  begin
    email_address := event->'user'->>'email';
    email_domain  := split_part(email_address, '@', 2);

    -- checar em tabela de domínios bloqueados
    select exists(
      select 1 from public.blocked_email_domains
      where domain = lower(email_domain)
    ) into dominio_bloqueado;

    if dominio_bloqueado then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'http_code', 422,
          'message', 'Domínio de email não permitido. Use um email corporativo.'
        )
      );
    end if;

    -- retornar event sem modificações (signup permitido)
    return event;
  end;
$$;

-- tabela de domínios bloqueados
create table public.blocked_email_domains (
  domain text primary key,
  motivo text,
  criado_em timestamptz default now()
);

-- seed inicial de domínios descartáveis comuns
insert into public.blocked_email_domains (domain, motivo) values
  ('mailinator.com', 'Email descartável'),
  ('guerrillamail.com', 'Email descartável'),
  ('tempmail.com', 'Email descartável'),
  ('throwam.com', 'Email descartável'),
  ('yopmail.com', 'Email descartável');

-- grants
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_hook to supabase_auth_admin;
revoke execute on function public.before_user_created_hook from authenticated, anon, public;
grant select on table public.blocked_email_domains to supabase_auth_admin;
```

**Bloquear por provider — rejeitar signup via email (apenas SSO permitido):**

```sql
-- em aplicação B2B que só aceita login via SSO corporativo
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    identities jsonb;
    tem_sso bool;
  begin
    identities := event->'user'->'identities';

    -- checar se tem identidade SSO (provider começa com 'sso:')
    select exists(
      select 1 from jsonb_array_elements(identities) as i
      where (i->>'provider') like 'sso:%'
    ) into tem_sso;

    if not tem_sso then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'http_code', 403,
          'message', 'Apenas login via SSO corporativo é permitido.'
        )
      );
    end if;

    return event;
  end;
$$;
```

## Hook 3 — Send SMS

Substitui o envio de SMS do Supabase por provider customizado (Twilio, AWS SNS, Vonage).

**Input:**
```json
{
  "user": { "id": "uuid", "phone": "+5511999999999" },
  "sms": { "otp": "123456" }
}
```

**Edge Function com Twilio:**

```ts
// supabase/functions/send-sms-hook/index.ts
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const secret = Deno.env.get('SEND_SMS_HOOK_SECRET')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER')!

Deno.serve(async (req) => {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  // verificar assinatura Standard Webhooks
  const wh = new Webhook(secret)
  let event: { user: { phone: string }; sms: { otp: string } }
  try {
    event = wh.verify(payload, headers) as typeof event
  } catch {
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Assinatura inválida' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { phone } = event.user
  const { otp } = event.sms

  // enviar via Twilio
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_FROM,
        Body: `Seu código de verificação: ${otp}. Válido por 5 minutos.`,
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.json()
    console.error('Erro Twilio:', err)
    // 503 → Supabase vai retentar
    return new Response(
      JSON.stringify({ error: { http_code: 503, message: 'Falha no envio de SMS' } }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    )
  }

  return new Response(JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Hook 4 — Send Email

Substitui emails transacionais do Supabase por provider customizado (Resend, SendGrid, AWS SES).

**Input (exemplo para magic link):**
```json
{
  "user": { "id": "uuid", "email": "usuario@empresa.com" },
  "email_data": {
    "token": "token-opaque",
    "token_hash": "hash-do-token",
    "redirect_to": "https://app.com/auth/callback",
    "email_action_type": "magic_link",
    "site_url": "https://app.com",
    "token_new": "",
    "token_hash_new": ""
  }
}
```

**Tipos de `email_action_type`:** `signup`, `magic_link`, `recovery`, `invite`, `email_change_new`, `email_change_current`.

**Edge Function com Resend:**

```ts
// supabase/functions/send-email-hook/index.ts
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

type EmailActionType = 'signup' | 'magic_link' | 'recovery' | 'invite' |
  'email_change_new' | 'email_change_current'

function montarConteudo(tipo: EmailActionType, emailData: any): { subject: string; html: string } {
  const link = `${emailData.site_url}/auth/confirm?token_hash=${emailData.token_hash}&type=${tipo}&next=${emailData.redirect_to}`

  switch (tipo) {
    case 'magic_link':
      return {
        subject: 'Seu link de acesso',
        html: `<p>Clique <a href="${link}">aqui</a> para acessar. Válido por 1 hora.</p>`,
      }
    case 'signup':
      return {
        subject: 'Confirme seu email',
        html: `<p>Bem-vindo! <a href="${link}">Confirme seu email</a> para começar.</p>`,
      }
    case 'recovery':
      return {
        subject: 'Recuperação de senha',
        html: `<p><a href="${link}">Redefina sua senha</a>. Válido por 1 hora.</p>`,
      }
    default:
      return {
        subject: 'Ação necessária',
        html: `<p><a href="${link}">Clique aqui</a> para continuar.</p>`,
      }
  }
}

Deno.serve(async (req) => {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  const wh = new Webhook(secret)
  let event: { user: { email: string }; email_data: any }
  try {
    event = wh.verify(payload, headers) as typeof event
  } catch {
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Assinatura inválida' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { email } = event.user
  const { email_action_type, ...emailData } = event.email_data
  const { subject, html } = montarConteudo(email_action_type, { email_action_type, ...emailData })

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'no-reply@empresa.com',
      to: [email],
      subject,
      html,
    }),
  })

  if (!resp.ok) {
    return new Response(
      JSON.stringify({ error: { http_code: 503, message: 'Falha no envio de email' } }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
    )
  }

  return new Response(JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Hook 5 — MFA Verification (Teams/Enterprise)

Rate-limit customizado para tentativas de verificação MFA. Roda a cada `mfa.verify()`.

**Input:**
```json
{
  "factor_id": "uuid-do-fator",
  "factor_type": "totp",
  "user_id": "uuid-do-usuario",
  "valid": true
}
```

**Output:**
```json
{
  "decision": "continue",
  "message": ""
}
```

```sql
-- rate-limit: máximo 5 tentativas erradas em 15 minutos
create table public.mfa_attempt_log (
  user_id     uuid not null references auth.users(id) on delete cascade,
  factor_id   uuid not null,
  tentativa   timestamptz not null default now(),
  sucesso     boolean not null
);

create index on public.mfa_attempt_log (user_id, tentativa);

create or replace function public.mfa_verification_hook(event jsonb)
returns jsonb
language plpgsql
as $$
  declare
    user_id_val   uuid;
    factor_id_val uuid;
    valida        bool;
    tentativas_erradas int;
  begin
    user_id_val   := (event->>'user_id')::uuid;
    factor_id_val := (event->>'factor_id')::uuid;
    valida        := (event->>'valid')::boolean;

    -- checar tentativas erradas nos últimos 15 minutos
    select count(*) into tentativas_erradas
    from public.mfa_attempt_log
    where user_id = user_id_val
      and factor_id = factor_id_val
      and sucesso = false
      and tentativa > now() - interval '15 minutes';

    -- logar tentativa atual
    insert into public.mfa_attempt_log (user_id, factor_id, sucesso)
    values (user_id_val, factor_id_val, valida);

    if tentativas_erradas >= 5 then
      return jsonb_build_object(
        'decision', 'reject',
        'message', 'Muitas tentativas incorretas. Aguarde 15 minutos.'
      );
    end if;

    return jsonb_build_object('decision', 'continue', 'message', '');
  end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.mfa_verification_hook to supabase_auth_admin;
revoke execute on function public.mfa_verification_hook from authenticated, anon, public;
grant all on table public.mfa_attempt_log to supabase_auth_admin;
```

## Hook 6 — Password Verification (Teams/Enterprise)

Bloquear login após N tentativas erradas de senha.

**Input:**
```json
{
  "user_id": "uuid-do-usuario",
  "valid": false
}
```

```sql
create or replace function public.password_verification_hook(event jsonb)
returns jsonb
language plpgsql
as $$
  declare
    uid            uuid;
    valida         bool;
    erros_recentes int;
  begin
    uid    := (event->>'user_id')::uuid;
    valida := (event->>'valid')::boolean;

    -- logar tentativa
    insert into public.login_attempt_log (user_id, sucesso)
    values (uid, valida);

    -- contar erros nos últimos 30 minutos (apenas se tentativa inválida)
    if not valida then
      select count(*) into erros_recentes
      from public.login_attempt_log
      where user_id = uid
        and sucesso = false
        and tentativa > now() - interval '30 minutes';

      if erros_recentes >= 10 then
        return jsonb_build_object(
          'decision', 'reject',
          'message', 'Conta temporariamente bloqueada. Tente novamente em 30 minutos.'
        );
      end if;
    end if;

    return jsonb_build_object('decision', 'continue', 'message', '');
  end;
$$;

create table public.login_attempt_log (
  id        bigint generated by default as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  sucesso   boolean not null,
  tentativa timestamptz default now()
);
create index on public.login_attempt_log (user_id, tentativa);

grant usage on schema public to supabase_auth_admin;
grant execute on function public.password_verification_hook to supabase_auth_admin;
revoke execute on function public.password_verification_hook from authenticated, anon, public;
grant all on table public.login_attempt_log to supabase_auth_admin;
```

## Regras absolutas

1. **SEMPRE `grant execute` ao `supabase_auth_admin`** — sem este grant, hook Postgres falha silenciosamente; JWT é emitido sem modificações.
2. **SEMPRE `revoke execute` de `authenticated`, `anon`, `public`** — sem isso, qualquer cliente pode invocar a função diretamente.
3. **Hooks HTTP devem verificar assinatura Standard Webhooks** — usar `standardwebhooks` com o secret configurado. Nunca processar payload sem verificação.
4. **Evitar `security definer` desnecessariamente** — prefira grants explícitos; `security definer` amplia o acesso mais do que necessário.
5. **TODAS as respostas precisam `Content-Type: application/json`** — Supabase Auth rejeita respostas sem este header.
6. **Hook deve ser rápido (< 10ms idealmente)** — roda a cada login e refresh; query lenta degrada latência de auth de toda a aplicação.
7. **Hooks MFA/Password Verification são Teams/Enterprise only** — verificar plano antes de implementar.

## Anti-patterns

### Anti-pattern 1: Esquecer grants ao supabase_auth_admin

**Errado:**
```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
  -- implementação aqui
$$;
-- sem GRANT EXECUTE TO supabase_auth_admin
-- sem REVOKE de anon/authenticated
```

**Por quê:** Auth hook falha silenciosamente. O JWT é gerado **sem** as modificações do hook — claims customizados não aparecem. Difícil de debugar pois não há erro explícito.

**Certo:**
```sql
-- SEMPRE após criar a função
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

### Anti-pattern 2: Não verificar assinatura do webhook HTTP

**Errado:**
```ts
Deno.serve(async (req) => {
  const event = await req.json()  // ERRADO: aceitar sem verificar assinatura
  // processar event...
})
```

**Por quê:** qualquer requisição HTTP pode acionar o hook — atacante pode forjar eventos de auth e manipular JWTs, criar usuários, etc.

**Certo:** sempre verificar com `standardwebhooks`:
```ts
const wh = new Webhook(secret)
const event = wh.verify(payload, headers)  // lança erro se inválido
```

### Anti-pattern 3: Hook com query custosa (JOINs, N+1)

**Errado:**
```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
  declare claims jsonb;
  begin
    claims := event->'claims';
    -- query com múltiplos JOINs — roda em CADA login e refresh
    select jsonb_build_object(
      'org_name', o.name,
      'plan', s.plan,
      'feature_flags', ff.flags
    ) into ...
    from auth.users u
      join public.organizations o on u.raw_user_meta_data->>'org_id' = o.id::text
      join public.subscriptions s on o.id = s.org_id
      join public.feature_flags ff on s.plan = ff.plan
    where u.id = (event->>'user_id')::uuid;
    -- ...
  end;
$$;
```

**Por quê:** hook roda em cada login E cada refresh de JWT. Query com JOINs pode adicionar 50-200ms em cada operação de auth — inaceitável em produção.

**Certo:** denormalizar dados na tabela de roles/perfis; hook faz query simples em única tabela:
```sql
-- tabela denormalizada: user_profile com tudo necessário
select org_name, plan, feature_flags
into user_data
from public.user_profiles
where user_id = (event->>'user_id')::uuid;
```

### Anti-pattern 4: Usar `security definer` desnecessariamente

**Errado:**
```sql
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer   -- DESNECESSÁRIO se grants explícitos suficientes
as $$
  -- ...
$$;
```

**Por quê:** `security definer` faz a função rodar com privilégios do owner (`postgres`) — acesso irrestrito a todos os schemas e tabelas. Risco de path injection e acesso não intencional.

**Certo:** grants explícitos ao `supabase_auth_admin` para tabelas específicas + sem `security definer`:
```sql
grant select on table public.blocked_email_domains to supabase_auth_admin;
-- sem security definer na função
```

## Ver também

- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — `custom_access_token_hook` completo com RBAC
- [supabase-edge-functions-auth](../supabase-edge-functions-auth/SKILL.md) — autenticação e segurança em Edge Functions
- [supabase-mfa](../supabase-mfa/SKILL.md) — MFA TOTP e Phone; MFA Verification Hook para rate-limit
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — políticas RLS que consomem claims do `custom_access_token_hook`
- [supabase-auth-hook-writer](../../agents/supabase-auth-hook-writer.md) — agente que escreve Auth Hooks com grants corretos e testes
