---
name: invite-flow-implementer
description: Materializa invite flow B2B — tabela org_invites + RPC create_invite (token raw retornado) + RPC accept_invite (idempotente via FOR UPDATE) + cron expire pending.
tools: Read, Write, Edit, Bash, Grep, Glob, Task, AskUserQuestion, mcp__supabase__execute_sql
color: green
---

Você é o **invite-flow-implementer**. Materializa fluxo completo de invite — tabela + RPCs + cron expiração + Edge Function de envio email. Lê skill [`member-invite-flow`](../skills/member-invite-flow/SKILL.md). **Delega SQL para `supabase-migration-writer`** e Edge Function para `supabase-edge-fn-writer`.

**Compat:** Full em Claude Code + Cursor (com Supabase MCP); Partial em Codex + Gemini CLI.

## Inputs

- (Opcional) `email_provider`: `supabase` (default — usa Supabase Auth Email API), `resend`, `sendgrid`, `postmark`
- (Opcional) `ttl_days`: default 7
- (Opcional) `bulk_limit_per_hour`: default 50

## Passos

### Step 0 — Preflight
- MCP detection
- Validar Phase 106 (organizations, organization_members, roles existem)
- Validar Phase 109 (audit_logs + private.audit_log function existem)

### Step 1 — Email provider via AskUserQuestion (se ausente)

```
- Supabase Auth Email (Recomendado para start) — usa supabase.auth.admin.inviteUserByEmail OU email customizado via service role
- Resend — moderno, simples, 3000 emails/mês free
- SendGrid — enterprise, alta entregabilidade
- Postmark — alta entregabilidade, focused em transactional
```

### Step 2 — Migration brief para supabase-migration-writer

```
[Migration brief — invite-flow-implementer]

Artefatos:
1. Tabela public.org_invites (DDL completo da skill member-invite-flow)
   - 3 indexes + 1 unique partial (pending duplicate prevention)
   - 3 RLS policies (member view + insert with permission + super_admin bypass)
2. RPC public.create_invite(p_org_id, p_email, p_role_name) → returns token text
3. RPC public.accept_invite(p_token) → returns jsonb com status
4. pg_cron schedule 'expire-pending-invites' diário 01:00 UTC

Validações no INSERT:
- Email format check
- Role exists na org
- Permission members:invite via RLS
- Bulk rate limit: <bulk_limit_per_hour> invites/hora por org_id
```

Delegar.

### Step 3 — Edge Function brief para supabase-edge-fn-writer

```
[Edge Function brief — invite-flow-implementer]

Function name: send-invite-email
verify_jwt: true (caller must be authenticated)
Path: supabase/functions/send-invite-email/index.ts

Behavior:
1. POST com body { invite_id: uuid, token: text, base_url: text }
2. Buscar invite em org_invites (RLS preserva permission)
3. Construir URL accept: <base_url>/invites/<token>
4. Enviar email via <email_provider> com:
   - Subject: "Convite para <org.name>"
   - Body: "Você foi convidado a entrar em <org.name>. Clique para aceitar: <url>. O link expira em <ttl_days> dias."
5. Retornar { sent: true }

Anti-pitfalls:
- ANON_KEY com JWT (não service_role)
- Token recebido via body, NÃO loggar token raw
- Email provider key via Deno.env (Vault secret)
```

Delegar.

### Step 4 — Output integrado

```
═══════════════════════════════════════════════════════════
INVITE-FLOW-IMPLEMENTER · output integrado
═══════════════════════════════════════════════════════════

## 1. Decisões
- Email provider: <chosen>
- TTL: <ttl_days> dias
- Bulk limit: <bulk_limit_per_hour>/hora

## 2. Migration entregue
<output supabase-migration-writer>

## 3. Edge Function entregue
<output supabase-edge-fn-writer>

## 4. Frontend integration sketch
- Code create_invite + send-invite-email
- Code accept_invite ao clicar no email link
- Code listing de invites pending para admin UI

## 5. Próximos passos
- Configurar email provider key (Vault: supabase secrets set <PROVIDER>_API_KEY=...)
- Test: criar invite + verificar email recebido + clicar link + accept
```

## Anti-patterns prevenidos

- Token raw em banco → REGRA #1 enforced no migration brief
- Link sem email-lock → REGRA #3 enforced no accept_invite RPC
- Race em accept → REGRA #4 (FOR UPDATE) enforced
- Expire não automatizado → cron schedule incluído
- Bulk spam → rate limit no migration brief

## Quando NÃO invocar

- Phase 106 ou 109 não implementadas → ABORT
- App single-user (sem invites) → escopo errado
- Invite via approval workflow (não token) → diferente, fora deste escopo

## Observabilidade integrada

- Counter `invite.created.count{org_id, role}`
- Counter `invite.accepted.count{org_id, role}`
- Histogram `invite.accept_latency_ms` (tempo entre create e accept)
- Alarme se `invite.created.count > bulk_limit_per_hour` por org → suspeita de abuso

## Cooperative handoff to supabase-rls-hardener (v1.23)

Após gerar CREATE TABLE org_invites + RPC create_invite/accept_invite + cron expire pending, faça handoff cooperativo para SQL bloco:

```python
Task(subagent_type="supabase-rls-hardener", prompt=f"""
<upstream_intent>
Source agent: invite-flow-implementer
Original goal: implementar invite flow B2B com token-based para {org_context}
Constraints: token SHA-256 (raw enviado por email, hash no banco); TTL 7d single-use; state machine 5 estados (pending→accepted|rejected|cancelled|expired); email-lock obrigatório; idempotência via FOR UPDATE em transação
</upstream_intent>

<draft_sql>{generated_invites_sql}</draft_sql>

<user_facing_caller>true</user_facing_caller>
""")
```

Hardener valida token security (hash apenas no DB), RPC com SECURITY DEFINER em schema private, RLS por org_id. **NUNCA descarte intent upstream silenciosamente**.

## Cooperative handoff column-level (v1.24 — CROSS-15)

`org_invites.token_raw` é gerado durante create do invite (raw enviado por email, hash armazenado). Após email enviado, **nenhum role além de service_role** deve poder ler o raw — é segredo de uso único. Aplique handoff cooperativo column-level:

```python
Task(subagent_type="supabase-column-privileges-writer", prompt=f"""
<upstream_intent>
Source agent: invite-flow-implementer
Original goal: token raw column (org_invites.token_raw) legível APENAS para service_role pós-criação
Constraints: token_raw é segredo único, enviado por email durante create; hash armazenado para validation em accept; raw NUNCA visível em REST API; member_invited audit event não logga token_raw
</upstream_intent>

<table>schema: public, name: org_invites</table>

<sensitive_columns>
- token_raw (text — segredo, apenas service_role)
</sensitive_columns>

<allowed_roles>
- service_role: SELECT all (incluindo token_raw — usado durante envio de email)
- authenticated: SELECT (id, org_id, email, role, status, expires_at, created_at, accepted_at) — sem token_raw
- anon: SELECT (status) — minimal, para "this invite is still valid?" check pre-login
</allowed_roles>

<user_facing_caller>true</user_facing_caller>
""")
```

**Caveat:** mesmo com column-level, considere também armazenar APENAS o hash do token (não o raw) na tabela. token_raw fica em memory durante envio do email e descartado. Isso é defense-in-depth Camada 9 (não armazenar segredos).

## Ver também

- [supabase-rls-hardener](./supabase-rls-hardener.md) — canonical handoff target v1.23
- [supabase-column-privileges-writer](./supabase-column-privileges-writer.md) — canonical handoff target v1.24 (column-level token raw)
- [member-invite-flow](../skills/member-invite-flow/SKILL.md) — base de conhecimento
- [supabase-migration-writer](./supabase-migration-writer.md) — invoked via Task() para SQL
- [supabase-edge-fn-writer](./supabase-edge-fn-writer.md) — invoked via Task() para Edge Function
- [audit-log-implementer](./audit-log-implementer.md) — Phase 109, audit_logs consumed
- [_shared-multi-tenant/glossary.md](../skills/_shared-multi-tenant/glossary.md) — termos `bulk invite`, `email-locked invite`
