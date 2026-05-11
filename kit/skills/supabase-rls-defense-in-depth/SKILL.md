---
name: supabase-rls-defense-in-depth
description: Use ao desenhar defense-in-depth RLS em Supabase — event trigger rls_auto_enable (default projetos novos), BYPASSRLS role privilege, service_role caveat, security definer functions como bypass controlado, views security_invoker=true. Camada de proteção contra esquecimento humano e third-party tooling acessando DB diretamente. v1.23 incorpora a doc oficial RLS.
---

# Supabase — RLS Defense in Depth

## Quando usar

LLM carrega esta skill quando precisar desenhar **camadas de defesa** RLS além das policies básicas. Trigger phrases:

- "defense in depth RLS", "camadas de defesa Postgres"
- "auto-enable RLS em todas tabelas novas", "event trigger ensure RLS"
- "BYPASSRLS role privilege", "alter role bypassrls"
- "security definer function bypassa RLS"
- "service_role bypassa RLS", "service_role caveat"
- "view security_invoker", "view bypass RLS"
- "como proteger contra third-party tools acessando DB direto"

## Princípio canônico

**Defense in depth** = múltiplas camadas independentes de proteção. Para RLS em Supabase:

1. **Camada 1 — Policy explícita por tabela** (skill `supabase-rls-policies`) — sempre granular, sempre `(select auth.uid())`, sempre `IS NOT NULL`, sempre indices.
2. **Camada 2 — Auto-enable RLS via event trigger** (DEFENSE-01) — garante que toda tabela nova nasce com RLS habilitado, mesmo se developer esquecer.
3. **Camada 3 — GRANT explícito** (skill `supabase-rls-policies`) — sem `grant select to authenticated`, queries falham com "permission denied" antes mesmo de chegar nas policies.
4. **Camada 4 — Bypass controlado** — `BYPASSRLS` role, `security definer` functions em schema `private` (DEFENSE-02, DEFENSE-04). Nunca em schema exposto.
5. **Camada 5 — Views com `security_invoker=true`** (DEFENSE-05, Postgres 15+) — views respeitam RLS do role chamador, não do criador.
6. **Camada 6 — Service role caveat** (DEFENSE-03) — entender que service_role bypassa RLS mas só no servidor; nunca expor ao cliente.
7. **Camada 7 — Cooperative handoff via supabase-rls-hardener** (v1.23) — todo SQL gerado pelo kit passa pelo hardener canonical antes do output final. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação. Princípio canônico: agents externos pensam/planejam; agents Supabase materializam/hardenam.
8. **Camada 8 — Column-Level Privileges** (v1.24) — `GRANT/REVOKE (col1, col2) ON TABLE` para restringir colunas sensíveis (PII, audit payload, billing, tokens). Feature AVANÇADA — usar apenas quando RLS + dedicated role table não cobrem o caso. Cross-ref skill [`supabase-column-level-security`](../supabase-column-level-security/SKILL.md).
9. **Camada 9 — Auth Hooks - Custom Claims** (v1.25) — `Custom Access Token Auth Hook` (função PG `custom_access_token_hook(event jsonb)`) injeta `user_role` no JWT durante geração do token. RLS policies consultam o claim direto via `auth.jwt() ->> 'user_role'` ou via `authorize()` function — zero-JOIN, type-safe via enum, composable. Alternativa moderna a dedicated role table com JOIN custoso em policies. Caveat JWT freshness (eventually consistent). Cross-ref skill [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md).

Razão: RLS é a primeira linha, mas humanos esquecem. Third-party tooling (Metabase, dbt, ferramentas BI conectadas via JDBC, scripts) bypassam toda a lógica da camada de aplicação — só RLS no banco protege. Defense in depth aplica princípio de **proteção sobreposta** para resiliência.

## DEFENSE-01: Event trigger `rls_auto_enable()` como default

Em projetos novos, instale event trigger que ativa RLS automaticamente quando uma tabela é criada em schema exposto. Protege contra esquecimento humano.

### Função PLpgSQL + Event Trigger

```sql
create or replace function rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    -- só atua em schemas configurados; pula sistema
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog','information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (system schema or not in enforced list)', cmd.object_identity;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function rls_auto_enable();
```

### Caveats e limitações

- **Aplica-se a tabelas criadas após o trigger ser instalado** — tabelas pré-existentes precisam de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` manual ou script de migração.
- **Schemas filtrados** — só atua em schemas listados explicitamente (`public` por default). Para incluir mais schemas, edite a lista. Para projetos multi-tenant em schemas separados por org, adicione `('public', 'org_*')` ou similar.
- **Não cria policies** — apenas habilita RLS. Sem policies, tabela fica bloqueada para roles não-bypass — comportamento desejado (failsafe).
- **Não dispara em `CREATE TABLE IF NOT EXISTS` quando tabela já existe** — comportamento padrão Postgres event triggers.
- **Trigger é `SECURITY DEFINER`** — roda como o owner do trigger (geralmente `postgres`). Garante permissão para `ALTER TABLE`.

### Auditoria — listar tabelas sem RLS

Para validar que defense-in-depth está aplicado:

```sql
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = pg_tables.schemaname
      and c.relname = pg_tables.tablename
      and c.relrowsecurity = true
  );
```

Se retorna ≥ 1 row, há tabelas sem RLS — gap de defense-in-depth.

## DEFENSE-02: `BYPASSRLS` role privilege para tarefas admin

Para tarefas administrativas internas (jobs noturnos, migrations, scripts de manutenção), crie role com privilégio `BYPASSRLS` ao invés de usar `service_role`:

```sql
-- criar role interno
create role admin_internal with login password '<strong_pw>';
alter role admin_internal with bypassrls;

-- conceder permissões necessárias
grant all on all tables in schema public to admin_internal;
grant all on all sequences in schema public to admin_internal;
```

**Quando usar:**

- Scripts de manutenção que rodam dentro do banco (não via API)
- Jobs `pg_cron` que precisam acessar dados cross-tenant
- Migrations que populam dados em massa ignorando policies
- DBAs investigando incidents em production

**Quando NÃO usar:**

- Edge Functions — use `SUPABASE_SERVICE_ROLE_KEY` direto (já tem BYPASSRLS implícito)
- Backend customizado conectado via JDBC — use service_role role do Supabase
- Qualquer role que receba requisição de cliente

**Comparação com service_role:**

| | `service_role` (Supabase API key) | Custom role `BYPASSRLS` |
|---|---|---|
| Escopo | API key — usado em Authorization header | Postgres role — login direto |
| Auditoria | Logs do Supabase API | Postgres audit log (pg_audit) |
| Revoke | Rotacionar key via dashboard | `revoke bypassrls from <role>` |
| Granularidade | Tudo-ou-nada | Pode escopar GRANT a tabelas específicas |

## DEFENSE-03: `service_role` caveat — não bypassa RLS do user logged-in

**Caveat crítico:** quando você usa o SDK Supabase com `SUPABASE_SERVICE_ROLE_KEY`, mas a sessão ainda tem `Authorization: Bearer <user_jwt>` set, **o RLS do user é aplicado** — o service_role bypass é **overridden**.

```js
// errado — service_role mas com sessão user ainda ativa
const supabase = createClient(URL, SERVICE_ROLE_KEY)
supabase.auth.setSession({ access_token: userJwt, refresh_token: userRefresh })
// agora .from('tasks').select() aplica RLS do user, não bypass

// certo — service_role limpo
const supabase = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
// agora .from('tasks').select() bypassa RLS
```

**Como Supabase decide:** se a request tem JWT válido em Authorization header, Supabase deriva o `role` (anon/authenticated) e aplica RLS. Service_role só bypassa se NÃO há JWT user OU se você usa o pattern admin client com `persistSession: false`.

**Aplicação:** Edge Functions que precisam fazer trabalho cross-tenant **devem** usar admin client separado (não o client da sessão do user que disparou a função):

```ts
// edge function
import { createClient } from 'npm:@supabase/supabase-js'

Deno.serve(async (req) => {
  // admin client — bypassa RLS porque sem session
  const adminDb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // user client — respeita RLS (para audit log do que user PODE fazer)
  const userDb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  // exemplo: validar com userDb (RLS aplicado) que user pode acessar org
  const { data: orgCheck } = await userDb.from('organizations').select('id').eq('id', orgId).single()
  if (!orgCheck) return new Response('Forbidden', { status: 403 })

  // executar mutation cross-tenant com adminDb (bypass RLS)
  const { data } = await adminDb.from('audit_log').insert({ ... })
  return new Response(JSON.stringify(data))
})
```

## DEFENSE-04: `SECURITY DEFINER` functions como bypass controlado

Funções `SECURITY DEFINER` rodam com permissões do owner (geralmente `postgres`, que tem `BYPASSRLS`). Use para encapsular lógica admin/cross-tenant que precisa bypassar RLS.

### Regras absolutas

1. **NUNCA em schema exposto** (`public`) — atacante poderia chamar a função com input arbitrário via REST API. Sempre em schema `private`, `internal`, ou similar **não-exposto** em API settings.
2. **Sempre `SET search_path = ''`** — evita schema injection (atacante criando função homônima em outro schema).
3. **Validar inputs** — função `SECURITY DEFINER` é alta autoridade; valide tudo (uuid format, range, ownership) antes de fazer trabalho.
4. **Auditar invocações** — log quem chamou + o quê + quando.

### Example: cross-tenant analytics aggregation

```sql
-- schema private (NÃO exposto via API)
create schema if not exists private;

create or replace function private.org_analytics_summary(org_id_arg uuid)
returns table(metric text, value bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- validar input (uuid format, ownership do caller, etc.)
  if org_id_arg is null then
    raise exception 'org_id_arg required';
  end if;

  -- validar que caller pode acessar essa org
  -- (mesmo bypassando RLS, regras de negócio aplicam)
  if not exists (
    select 1 from public.organization_members
    where org_id = org_id_arg and user_id = auth.uid()
  ) then
    raise exception 'access denied to org %', org_id_arg;
  end if;

  -- audit log
  insert into public.audit_log (event, user_id, org_id, payload)
  values ('analytics_summary_query', auth.uid(), org_id_arg, jsonb_build_object('ts', now()));

  -- query bypass RLS
  return query
  select 'total_tasks' as metric, count(*)::bigint as value
  from public.tasks
  where org_id = org_id_arg
  union all
  select 'total_members', count(*)::bigint
  from public.organization_members
  where org_id = org_id_arg;
end;
$$;

-- expor via RPC (RLS check feito DENTRO da função, não via policy)
grant execute on function private.org_analytics_summary(uuid) to authenticated;
```

**Padrão de uso em policy:** funções `SECURITY DEFINER` podem ser chamadas em policies para fazer JOIN performant sem aplicar RLS recursivamente:

```sql
-- ver supabase-rls-policies Performance section #5
create function private.has_good_role()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.roles_table
    where (select auth.uid()) = user_id and role = 'good_role'
  );
end;
$$;

create policy "rls_test_select"
on public.test_table for select
to authenticated
using ((select private.has_good_role()));
```

## DEFENSE-05: Views com `security_invoker=true` (Postgres 15+)

Por padrão, views são criadas como `SECURITY DEFINER` — rodam com permissões do criador (geralmente `postgres`). Resultado: **views bypassam RLS** das tabelas subjacentes. Atacante pode contornar policies acessando a view ao invés da tabela.

### Postgres 15+: `security_invoker=true`

```sql
-- view respeita RLS do role chamador (anon ou authenticated)
create view public.user_active_tasks
with (security_invoker = true)
as
select id, title, status, created_at
from public.tasks
where status = 'active';
```

Agora `select * from user_active_tasks` aplica policies de `public.tasks` baseadas no `auth.uid()` do caller.

### Postgres < 15: revoke ou schema privado

Em versões anteriores, `security_invoker` não está disponível. Mitigação:

```sql
-- alternativa 1: revoke acesso de roles expostos
revoke select on public.legacy_view from anon, authenticated;
grant select on public.legacy_view to service_role;  -- apenas backend

-- alternativa 2: mover view para schema privado (não exposto via API)
drop view if exists public.legacy_view;
create view private.legacy_view as ...;
-- não conceder a anon/authenticated; expor via RPC se necessário
```

### Auditoria — encontrar views vulneráveis

```sql
-- views sem security_invoker em schemas expostos (Postgres 15+)
select schemaname, viewname
from pg_views v
where schemaname = 'public'
  and not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = v.schemaname
      and c.relname = v.viewname
      and c.reloptions::text like '%security_invoker=true%'
  );
```

## DEFENSE-06 (v1.24): Column-Level Privileges para PII/audit/billing/tokens

Em tabelas com colunas sensíveis (PII em compliance LGPD/GDPR, audit log payload, billing data, tokens raw), aplique column-level privileges como **Camada 8** de defense-in-depth.

### Quando aplicar

Use o checklist da skill [`supabase-column-level-security`](../supabase-column-level-security/SKILL.md):

- **PII compliance:** SSN, CPF, salary, medical info
- **Audit log sanitization:** `audit_log.payload` jsonb (legível só por security_admin role)
- **Billing data:** `credit_card_token`, `bank_account`
- **Tokens raw:** `org_invites.token_raw` (apenas service_role pós-create)

### Pattern canônico

```sql
-- 1. REVOKE table-level (perde acesso a TODAS colunas)
revoke select on table public.audit_log from authenticated;

-- 2. GRANT column-level apenas em colunas não-sensíveis
grant select (id, event_type, user_id, org_id, occurred_at)
  on table public.audit_log to authenticated;

-- 3. service_role ou security_admin role mantém acesso total
grant select on table public.audit_log to service_role;
```

### Caveat crítico — Wildcard `*` restriction

Com column privileges, **`SELECT *` falha** — clientes devem listar colunas explicitamente:

```js
// ❌ FALHA — wildcard expansion bate em colunas sem permission
const { data } = supabase.from('audit_log').select()

// ✅ OK — colunas explicitamente listadas
const { data } = supabase.from('audit_log').select('id, event_type, user_id, org_id, occurred_at')
```

### Auditoria — detectar tabelas com PII sem column-level

```sql
-- detectar colunas potencialmente sensíveis sem column-level GRANT/REVOKE
select c.table_schema, c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and (
    c.column_name ilike any (array[
      '%email%', '%phone%', '%ssn%', '%cpf%', '%token%',
      '%password%', '%credit_card%', '%bank_account%', '%salary%'
    ])
  )
  and not exists (
    select 1 from information_schema.column_privileges p
    where p.table_schema = c.table_schema
      and p.table_name = c.table_name
      and p.column_name = c.column_name
  );
```

Cross-ref auditoria sistemática em agent [`supabase-rls-hardener`](../../agents/supabase-rls-hardener.md) Detector 8 (v1.24) — invoca [`supabase-column-privileges-writer`](../../agents/supabase-column-privileges-writer.md) cooperativamente quando detecta gap.

## Resumo — checklist defense-in-depth (8 itens, v1.24)

Use este checklist ao validar projetos Supabase em produção:

- [ ] **DEFENSE-01:** Event trigger `rls_auto_enable` instalado em `ddl_command_end` cobrindo `CREATE TABLE` em schema `public`.
- [ ] **DEFENSE-02:** Roles admin internos usam `BYPASSRLS` privilege ao invés de service_role API key em scripts/cron jobs.
- [ ] **DEFENSE-03:** Edge Functions cross-tenant usam admin client separado (`persistSession: false`) ao invés de service_role com sessão user ativa.
- [ ] **DEFENSE-04:** Lógica admin/cross-tenant encapsulada em funções `SECURITY DEFINER` em schema `private` (não-exposto), com `SET search_path = ''` + input validation + audit log.
- [ ] **DEFENSE-05:** Views em Postgres 15+ usam `with (security_invoker = true)`; em versões anteriores, revoke acesso de `anon`/`authenticated` ou mover para schema privado.
- [ ] **GRANT explícito** antes de ENABLE RLS em todas tabelas — sem `grant select to authenticated`, queries falham antes mesmo da policy.
- [ ] **Cooperative handoff** — qualquer agent/skill/command produzindo SQL passa pelo `supabase-rls-hardener` (v1.23) antes do output final.
- [ ] **DEFENSE-06 (v1.24):** Column-Level Privileges em tabelas com PII/audit payload/billing/tokens — REVOKE table-level + GRANT column-level granular; clientes listam colunas explicitamente (não `select *`).
- [ ] **DEFENSE-07 (v1.25):** RBAC via Custom Access Token Auth Hook — `user_role` injetado no JWT durante geração do token; RLS policies consultam claim via `authorize()` function ao invés de JOIN em user_roles; `supabase_auth_admin` tem GRANT EXECUTE no hook + GRANT ALL em user_roles; revogação de role força logout via `auth.admin.signOut()` para invalidação imediata.

## Cross-suite handoff cooperativo (v1.23)

Esta skill é base para o agent `supabase-rls-hardener` (criado em Phase 126 do v1.23) — que recebe draft SQL via `Task()` upstream context, valida os 6 itens do checklist defense-in-depth acima, e devolve verdict GO/STRENGTHEN/REWRITE-com-confirmação.

Princípio canônico v1.23: **agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream**. Esta skill consolida o conhecimento que o hardener aplica.

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — Camada 1 (policies granulares + IS NOT NULL + GRANT) + Performance recommendations
- [supabase-migrations](../supabase-migrations/SKILL.md) — Template canônico v1.23 com 5 blocos obrigatórios (incluindo GRANT + ENABLE RLS + policies + index)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — funções `SECURITY INVOKER` (default seguro) vs `SECURITY DEFINER` (com justificativa)
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos defense-in-depth, hardener, cooperative-handoff, event-trigger-rls-auto-enable, bypassrls, security_invoker
