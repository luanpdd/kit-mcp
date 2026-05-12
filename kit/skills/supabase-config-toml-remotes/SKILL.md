---
name: supabase-config-toml-remotes
description: Use ao configurar Supabase para branching — `[remotes.<name>]` block + branch-specific overrides + secrets per-branch (NÃO herdam) + dotenvx pattern (.env.keys + .env.preview encrypted) + 6…
---

# Supabase — Config TOML & Remotes

## Quando usar

Branching Supabase exige configuração per-branch via `supabase/config.toml` — blocos `[remotes.<name>]` declaram **overrides versionados em git** que o Deploy DAG step 4 (configure) aplica em cada branch.

Esta skill é par-conjugado com `supabase-branching-workflow` (Phase 149) — branching workflow descreve **quando** branches são criados; esta skill descreve **como** configurar.

Trigger phrases:

- "remotes block Supabase", "[remotes] config.toml"
- "branch-specific config Supabase", "config.toml staging override"
- "secrets per-branch Supabase", "supabase secrets set"
- "dotenvx Supabase", ".env.keys .env.preview"
- "encrypted: Supabase config", "env() vs encrypted: syntax"
- "Supabase encrypted fields", "auth.hook secrets encrypted"
- "designated secret fields"
- "branch project_id Supabase"

**Use APENAS para:**

- Configurar persistent branches (staging, QA, production) via `[remotes.<branch>]` block
- Materializar overrides per-ambiente (db.pool_size, api.max_rows, auth.external.*, edge_runtime.secrets)
- Gerenciar secrets per-branch via `supabase secrets set --env-file`
- Versionar secrets encrypted em git via dotenvx pattern (.env.keys + .env.preview/.env.production)

**NÃO use para:**

- Substituir secret vault corporativo (Vault, AWS Secrets Manager) — dotenvx é git-tracked encrypted; vault corporativo tem audit trail + rotation policies
- Gerenciar secrets de runtime de Edge Functions sem `supabase secrets set` — `env()` em config.toml é build-time do CLI, não runtime do projeto
- Versionar a chave de decryption (`.env.keys`) — NUNCA committar; é equivalente a vazar password master
- Apontar `[remotes.<name>]` para branch deletado — operações falham silenciosamente

## Princípio canônico

Três princípios canônicos:

1. **`config.toml` é source of truth versionado.** `[remotes.<branch>]` block declara overrides explícitos commitados em git — Deploy DAG step 4 (configure) re-aplica em cada deploy. Sem deriva entre o que está em git e o que está no branch.

2. **dotenvx para secrets git-tracked.** `.env.keys` (decryption key, **SEMPRE gitignored**) + `.env.preview`/`.env.production` (encrypted values, committed em git). Permite versionar secrets sem expor — git history rastreia mudanças de secrets sem PII em plaintext.

3. **Secrets NÃO herdam entre branches.** Cada branch tem credenciais únicas; criar persistent branch `staging` NÃO copia secrets do `main`. Reset manual via `supabase secrets set --env-file` para CADA branch — incluindo o branch `main` original.

### Distinção canônica `env()` vs `encrypted:`

| | `env(VAR_NAME)` | `encrypted:<value>` |
|---|---|---|
| Resolução | Runtime CLI (build-time) | Decryption via `.env.keys` |
| Onde funciona | **Qualquer** field em config.toml | **APENAS** designated secret fields (Pattern 5) |
| Workflow | Setar env var no shell antes do CLI | Encriptar via `dotenvx set`, committed em git |
| Caveat | Resolve para env var **local** do CLI, NÃO para secrets do projeto Supabase (runtime das Edge Functions) | Em field **não-designated** é silent no-op (literal string usada como valor) |
| Caso de uso | Secrets em env vars do CI (GitHub Actions) | Secrets versionados encrypted em git via dotenvx |

## Pattern 1: `[remotes]` block — referenciar branch existente (CFG-01)

`[remotes.<name>]` em `config.toml` declara que **este bloco se aplica APENAS ao branch nomeado** identificado pelo `project_id`.

### Pré-requisito

Branch já criado (persistent via CLI ou preview via PR webhook):

```bash
# criar persistent branch via CLI
supabase --experimental branches create staging --persistent

# (preview branches são criados automaticamente via GitHub PR — cross-ref skill supabase-branching-workflow Pattern 3)
```

### Workflow canônico

**Step 1: Obter `project_id` do branch:**

```bash
supabase --experimental branches list

# output esperado:
# BRANCH NAME    BRANCH PROJECT ID         STATUS
# main           main-project-ref          active
# staging        staging-dedicated-ref     active
# pr-42-feature  pr42-feature-ref          active
```

**Step 2: Adicionar `[remotes.<branch>]` block no `supabase/config.toml`:**

```toml
[remotes.staging]
project_id = "staging-dedicated-ref"

[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]
```

**Step 3: Commitar `config.toml` em git → Deploy DAG step 4 (configure) aplica overrides no branch.**

### Exemplo TOML — múltiplos branches

```toml
# bloco base — aplica a TODOS os branches (incluindo main)
[db]
port = 54322
pool_size = 15

[api]
port = 54321
max_rows = 1000

# branch staging — overrides específicos
[remotes.staging]
project_id = "staging-dedicated-ref"

[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]

# branch production — sem seeds em produção
[remotes.production]
project_id = "production-dedicated-ref"

[remotes.production.db.seed]
enabled = false
```

### Caveat — branch deletado

`project_id` deve ser de branch **existente**. Se branch foi deletado:

- Bloco `[remotes.<branch>]` continua válido sintaticamente
- CLI rejeita commands com erro `branch not found`
- DAG step 4 (configure) silenciosamente skip o branch deletado

**Mitigação:** revisão trimestral — `supabase --experimental branches list` + remover blocos `[remotes.<deleted>]` correspondentes.

### Caveat — `project_id` único por bloco

Cada `[remotes.<name>]` deve apontar para **branch dedicado** criado especificamente. NÃO reutilizar `project_id` do `main` para `staging` (cross-ref Anti-pattern 5).

## Pattern 2: Branch-specific configuration overrides (CFG-02)

Princípio: config base (sem `[remotes...]` prefix) aplica a TODOS os branches; `[remotes.<name>.<section>]` aplica override APENAS no branch nomeado.

### Categorias de fields override-able (canônicas)

**db (database tuning):**

```toml
[db]
port = 54322
pool_size = 15  # default

# staging override
[remotes.staging.db]
port = 54322  # mesma porta — só pool_size muda
pool_size = 25
```

**api (PostgREST):**

```toml
[api]
port = 54321
max_rows = 1000
schemas = ["public"]

# staging quer ver schema extensions para debug
[remotes.staging.api]
max_rows = 5000  # debug — limite maior
schemas = ["public", "extensions"]
```

**db.seed:**

```toml
# default — sem seed
[db.seed]
enabled = false
sql_paths = []

# staging — seed sintético para QA
[remotes.staging.db.seed]
enabled = true
sql_paths = ["./seeds/staging.sql"]

# preview — seed minimal para smoke tests
[remotes.preview.db.seed]
enabled = true
sql_paths = ["./seeds/preview-smoke.sql"]
```

**auth.external.* (OAuth providers):**

```toml
# production GitHub OAuth
[auth.external.github]
enabled = true
client_id = "Iv1.production-app-id"
secret = "encrypted:LSi...prod-github-secret-encrypted...=="

# staging GitHub OAuth — app diferente
[remotes.staging.auth.external.github]
enabled = true
client_id = "Iv1.staging-app-id"
secret = "encrypted:LSi...staging-github-secret-encrypted...=="
redirect_uri = "https://staging.example.com/auth/callback"
```

**edge_runtime.secrets:**

```toml
[edge_runtime.secrets]
SENDGRID_API_KEY = "encrypted:LSi...prod-sendgrid-encrypted...=="

# staging — SendGrid sandbox
[remotes.staging.edge_runtime.secrets]
SENDGRID_API_KEY = "encrypted:LSi...staging-sendgrid-encrypted...=="
SENDGRID_SANDBOX_MODE = "env(STAGING_SENDGRID_SANDBOX_MODE)"
```

### Tabela canônica de fields override-able

| Section | Fields | Caso de uso típico |
|---------|--------|---------------------|
| `db` | `port`, `pool_size` | Tuning pool size per ambiente (staging menor) |
| `api` | `port`, `max_rows`, `schemas` | Diferenciar response limits + schemas expostos |
| `db.seed` | `enabled`, `sql_paths` | Seeds diferentes por branch |
| `auth.external.<provider>` | `enabled`, `client_id`, `secret`, `redirect_uri` | OAuth keys per ambiente |
| `auth.email.smtp` | `host`, `port`, `user`, `pass` | SMTP staging vs produção |
| `auth.sms.<provider>` | `account_sid`, `auth_token`, etc. | SMS provider keys per ambiente |
| `edge_runtime.secrets.<KEY>` | custom env vars | API keys per branch (SendGrid, Stripe, OpenAI) |
| `studio.openai_api_key` | string | Key diferente para staging studio (lower limits) |

### Caveat — merge behavior

`[remotes.staging.db]` com `pool_size = 25` NÃO sobrescreve `[db]` global completamente — apenas o field específico (`pool_size`). Outros fields do `[db]` global (port, etc.) continuam aplicados.

```toml
# config base
[db]
port = 54322
pool_size = 15
shadow_port = 54320

# staging override — apenas pool_size muda
[remotes.staging.db]
pool_size = 25
# resultado em staging: port=54322, pool_size=25, shadow_port=54320 (mantidos da base)
```

### Caveat — re-deploy required

Alterações em `config.toml` precisam ser pushed para o branch — Deploy DAG step 4 (configure) só roda em novo deploy (push novo commit no PR ou re-run via Dashboard).

## Pattern 3: Secrets management per-branch (CFG-03)

### Caveat canônico — secrets NÃO herdam

> **Secrets NÃO herdam entre branches.** Criar persistent branch `staging` NÃO copia secrets do `main`. Cada branch precisa ter secrets setados separadamente.

Implicação prática:

- `Deno.env.get("SENDGRID_API_KEY")` em Edge Function no branch staging retorna `undefined` até `supabase secrets set` ser executado para o staging
- Esse comportamento é silent — sem warning no DAG, sem alert do CLI

### CLI canônico

```bash
# Set secrets a partir de .env file (recomendação canônica)
supabase secrets set --env-file ./supabase/.env

# Set secret individual
supabase secrets set SMTP_HOST=smtp.example.com

# Listar secrets do branch atual
supabase secrets list

# Remover secret
supabase secrets unset SMTP_HOST
```

### Workflow per-branch canônico

```bash
# 1. criar staging branch
supabase --experimental branches create staging --persistent

# 2. obter project_id do staging
supabase --experimental branches list | grep staging
# output: staging   staging-dedicated-ref   active

# 3. link CLI para o branch staging
supabase link --project-ref staging-dedicated-ref

# 4. setar secrets DO STAGING (arquivo dedicado)
supabase secrets set --env-file ./supabase/.env.staging

# 5. validar — listar secrets do staging
supabase secrets list

# 6. voltar para main quando terminar
supabase link --project-ref main-project-ref
```

### Exemplo `.env.staging`

```bash
# .env.staging — secrets específicos do branch staging
# Gitignored se não usa dotenvx (Pattern 4); encrypted se usa.
SMTP_HOST=smtp.staging.example.com
SMTP_USER=staging-user
SMTP_PASS=staging-pass
SENDGRID_API_KEY=SG.staging-api-key
OPENAI_API_KEY=sk-staging-openai-key
STRIPE_SECRET_KEY=sk_test_staging_stripe
```

### Caveat — secrets vs config.toml `env()`

Distinção CRÍTICA — fonte de confusão comum:

| | `supabase secrets set` | `env()` em config.toml |
|---|---|---|
| Resolvido | Runtime das **Edge Functions** | Build-time do **CLI local** |
| Acesso | `Deno.env.get("KEY")` no código Deno | Substituição literal no `config.toml` pré-deploy |
| Storage | Supabase backend (per-branch) | Env var do shell que rodou o CLI |
| Lifecycle | Persistido no branch | Volátil (só durante invocação do CLI) |

Exemplo concreto:

```bash
# Setar secret no branch (runtime Edge Function)
supabase secrets set SENDGRID_API_KEY=sk-real-key
# → Deno.env.get("SENDGRID_API_KEY") em Edge Function retorna "sk-real-key"

# Setar env var local (build-time config.toml)
export SENDGRID_API_KEY=sk-different-key
supabase db push
# → config.toml com env(SENDGRID_API_KEY) resolve para "sk-different-key" (do shell)
# → Edge Function ainda retorna "sk-real-key" (do supabase secrets set anterior)
```

### Recomendação canônica

Usar **dotenvx pattern** (Pattern 4) para versionar secrets encrypted em git em vez de gerenciar `.env.staging` separadamente em cada máquina.

## Pattern 4: dotenvx pattern + `encrypted:` vs `env()` syntax (CFG-04)

### Princípio dotenvx

dotenvx ([dotenvx.com](https://dotenvx.com/)) é uma evolução de `dotenv` que permite **encryption symmetric** de valores no arquivo `.env`:

- Encrypted values podem ser committed em git (`.env.preview`, `.env.production`)
- Decryption key (`.env.keys`) **NUNCA é committed** — gitignored sempre
- Permite versionar secrets sem expor — git history rastreia mudanças de secrets sem PII em plaintext

### Tabela canônica de file types (dotenvx convenção)

| File | Env | gitignore | Encrypted | Caso de uso |
|------|-----|-----------|-----------|-------------|
| `.env.keys` | All | **YES** (NUNCA committar) | No (key plaintext) | Decryption master key |
| `.env.local` | Local dev | YES | No (plaintext OK local) | Overrides de dev individual |
| `.env.production` | Production | No (committed) | YES | Secrets de produção encrypted |
| `.env.preview` | Branches preview | No (committed) | YES | Secrets de preview branches encrypted |
| `.env` | Any (fallback) | Maybe | YES | Default file (custom) |

**Atenção canônica:** `.env.keys` em `.gitignore` é obrigação canônica — sem isso, o pattern dotenvx é equivalente a commitar secrets plaintext.

### Workflow canônico dotenvx

```bash
# 1. instalar dotenvx (devDependency)
npm install -D @dotenvx/dotenvx

# 2. adicionar .env.keys ao .gitignore (BLOQUEANTE — fazer ANTES de qualquer set)
echo ".env.keys" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore dotenvx decryption key"

# 3. encrypted set — gera .env.keys automaticamente na primeira vez
npx @dotenvx/dotenvx set SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "ghs_real_secret" -f supabase/.env.preview
# Output:
#   set SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET (encrypted) (.env.preview)
#   wrote new public-private encryption keys to .env.keys

# 4. commitar .env.preview (encrypted) + verificar .env.keys NÃO foi committed
git status
#   modified:   supabase/.env.preview
# (.env.keys NÃO deve aparecer)
git add supabase/.env.preview
git commit -m "feat: add encrypted GitHub OAuth secret for preview"

# 5. usar com supabase CLI (carregar via --env-file)
npx supabase secrets set --env-file supabase/.env.keys
# ou em workflow CI (decripta + roda CLI):
npx @dotenvx/dotenvx run -- supabase secrets set --env-file supabase/.env.preview
```

### Sintaxes em `config.toml`

**Option A: `encrypted:<value>` directly em designated secret field:**

```toml
[auth.external.github]
enabled = true
client_id = "Iv1.app-id-public"
# secret é designated secret field (Pattern 5 Grupo 8) — encrypted: é decriptado via .env.keys
secret = "encrypted:LSiME...github-secret-encrypted-payload...=="
```

**Option B: `env(VAR_NAME)` para resolver via env var (qualquer field):**

```toml
[auth.external.github]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
```

### Warning canônico — `encrypted:` é restrito

> **`encrypted:` syntax SÓ funciona em designated secret fields** (Pattern 5 — 6 grupos canônicos). Em outros campos não decripta silenciosamente — o valor literal `"encrypted:LSiME..."` é usado como string, expondo o payload encrypted como se fosse plaintext.

Exemplo concreto do falso silencioso:

```toml
# ERRADO — auth.email.smtp.host NÃO é designated secret field
[auth.email.smtp]
host = "encrypted:LSi...wrong...=="  # ← silent no-op
# resultado: SMTP tenta conectar em host literal "encrypted:LSi...wrong...==" → DNS fail

# CERTO — auth.email.smtp.pass É designated (Pattern 5 Grupo 4)
[auth.email.smtp]
host = "smtp.example.com"  # plain
pass = "encrypted:LSi...correct-pass...==" # ← decriptado
```

### Quando usar qual

- **`encrypted:`** — quando quer versionar o secret **encrypted em git** (workflow dotenvx); aplicar APENAS em fields designados (Pattern 5)
- **`env()`** — quando secrets vivem em env vars do CI/local; works em **qualquer field**; flexibilidade ao custo de não versionar em git (rotação via update env var no CI)

Recomendação canônica para teams maduros: `encrypted:` em produção (auditável via git history) + `env()` em dev local (volátil).

## Pattern 5: 6 grupos de encrypted fields canônicos (CFG-05)

Princípio: apenas estes fields aceitam `encrypted:<value>` syntax — qualquer outro field é **silent no-op** (cross-ref Pattern 4 Warning).

### Lista canônica COMPLETA dos 6 grupos lógicos

A documentação Supabase agrupa estes como **6 grupos lógicos** (Studio, Database, Auth Core/Email/Captcha/Hooks/SMS/External, Edge Runtime) — apresentamos expandido para máxima clareza por subcategoria.

### Grupo 1: Studio

| Field | Caso de uso |
|-------|-------------|
| `studio.openai_api_key` | Studio AI features (SQL suggestions, schema generation) |

### Grupo 2: Database

| Field | Caso de uso |
|-------|-------------|
| `db.root_key` | Root key para encryption-at-rest (Vault) |
| `db.vault.*` (todas subkeys) | Supabase Vault — encryption keys gerenciadas |

### Grupo 3: Auth Core

| Field | Caso de uso |
|-------|-------------|
| `auth.publishable_key` | API publishable key (substitui anon key v2) |
| `auth.secret_key` | API secret key (substitui service_role key v2) |
| `auth.jwt_secret` | JWT signing secret (HS256) |

### Grupo 4: Auth Email

| Field | Caso de uso |
|-------|-------------|
| `auth.email.smtp.pass` | Password do SMTP server (SendGrid, AWS SES, Mailgun, etc.) |

### Grupo 5: Auth Captcha

| Field | Caso de uso |
|-------|-------------|
| `auth.captcha.secret` | hCaptcha ou Turnstile secret key |

### Grupo 6: Auth Hooks

Todos os 6 Auth Hooks (cross-ref skill `supabase-custom-claims-rbac` v1.25):

| Field | Caso de uso |
|-------|-------------|
| `auth.hook.mfa_verification_attempt.secrets` | Custom MFA verification hook |
| `auth.hook.password_verification_attempt.secrets` | Custom password verification hook |
| `auth.hook.custom_access_token.secrets` | Custom Access Token Auth Hook (RBAC v1.25) |
| `auth.hook.send_sms.secrets` | Custom SMS sender hook |
| `auth.hook.send_email.secrets` | Custom email sender hook |
| `auth.hook.before_user_created.secrets` | Hook para validar/rejeitar signup |

### Grupo 7: Auth SMS providers

5 providers SMS canônicos:

| Field | Caso de uso |
|-------|-------------|
| `auth.sms.twilio.auth_token` | Twilio SMS provider |
| `auth.sms.twilio_verify.auth_token` | Twilio Verify (MFA) |
| `auth.sms.messagebird.access_key` | MessageBird provider |
| `auth.sms.textlocal.api_key` | Textlocal (UK provider) |
| `auth.sms.vonage.api_secret` | Vonage (ex-Nexmo) |

### Grupo 8: Auth External providers

| Field | Caso de uso |
|-------|-------------|
| `auth.external.<provider>.secret` | Qualquer OAuth provider — github, google, facebook, apple, twitter, discord, gitlab, bitbucket, azure, linkedin, notion, slack, spotify, twitch, kakao, keycloak, workos, zoom, figma, fly |

### Grupo 9: Edge Runtime

| Field | Caso de uso |
|-------|-------------|
| `edge_runtime.secrets.*` (todas subkeys) | Env vars custom para Edge Functions (SENDGRID, STRIPE, OPENAI, etc.) |

### Exemplo TOML completo cobrindo múltiplos grupos

```toml
# Grupo 1: Studio
[studio]
openai_api_key = "encrypted:LSi...studio-key-encrypted...=="

# Grupo 2: Database (Vault)
[db.vault]
secret_master_key = "encrypted:LSi...vault-master-encrypted...=="

# Grupo 3: Auth Core
[auth]
jwt_secret = "encrypted:LSi...jwt-secret-encrypted...=="
secret_key = "encrypted:LSi...secret-key-encrypted...=="

# Grupo 4: Auth Email
[auth.email.smtp]
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "encrypted:LSi...smtp-pass-encrypted...=="

# Grupo 5: Auth Captcha
[auth.captcha]
enabled = true
provider = "hcaptcha"
secret = "encrypted:LSi...captcha-secret-encrypted...=="

# Grupo 6: Auth Hooks
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/auth/custom_access_token_hook"
secrets = "encrypted:LSi...hook-secret-encrypted...=="

[auth.hook.send_email]
enabled = true
uri = "https://example.com/auth/send-email-hook"
secrets = "encrypted:LSi...email-hook-secret-encrypted...=="

# Grupo 7: Auth SMS (Twilio)
[auth.sms.twilio]
enabled = true
account_sid = "ACxxxxxxxxxxxx"
message_service_sid = "MGxxxxxxxxxxxx"
auth_token = "encrypted:LSi...twilio-token-encrypted...=="

# Grupo 8: Auth External (GitHub OAuth)
[auth.external.github]
enabled = true
client_id = "Iv1.xxxxxxx"
secret = "encrypted:LSi...github-secret-encrypted...=="

# Grupo 9: Edge Runtime
[edge_runtime.secrets]
OPENAI_API_KEY = "encrypted:LSi...openai-edge-encrypted...=="
SENDGRID_API_KEY = "encrypted:LSi...sendgrid-edge-encrypted...=="
STRIPE_SECRET_KEY = "encrypted:LSi...stripe-edge-encrypted...=="
```

### Caveat — lista pode evoluir com versões do CLI

A lista de designated secret fields pode evoluir com novas versões do Supabase CLI (novos providers OAuth, novos Auth Hooks, etc.). Para refresh periódico:

```bash
# verificar versão do CLI
supabase --version

# consultar doc oficial:
# https://supabase.com/docs/guides/local-development/cli/config
```

**Recomendação canônica:** review trimestral da lista vs doc oficial — Supabase publica updates regularmente.

## Anti-patterns

### Anti-pattern 1: Usar `encrypted:` em field não-designated

**Errado:**

```toml
[auth.email.smtp]
host = "encrypted:LSi...wrong-host...=="  # smtp.host NÃO é designated
port = 587
```

**Por quê:** valor literal é usado como string — SMTP tenta conectar em host literal `"encrypted:LSi...=="`, DNS lookup falha silenciosamente, emails não são enviados, sem erro claro no log.

**Certo:** consultar Pattern 5 — usar `encrypted:` APENAS nos grupos canônicos. Para `auth.email.smtp.host` use plaintext (não é secret) ou `env(SMTP_HOST)`:

```toml
[auth.email.smtp]
host = "smtp.sendgrid.net"  # plaintext OK (não é secret)
port = 587
user = "apikey"
pass = "encrypted:LSi...correct-pass...=="  # designated secret field
```

### Anti-pattern 2: Assumir secrets herdam entre branches

**Errado:** criar `staging` branch e assumir que `SENDGRID_API_KEY` do `main` está disponível.

```bash
supabase --experimental branches create staging --persistent
# (assume erradamente que secrets do main foram copiados)

# Edge Function no staging — falha
const apiKey = Deno.env.get("SENDGRID_API_KEY");  // undefined
```

**Por quê:** secrets são **per-branch** — staging tem env vars vazias até `supabase secrets set` rodar separadamente; Edge Functions retornam `undefined`; código quebra sem erro claro no DAG.

**Certo:** rodar `supabase secrets set --env-file` para **CADA branch** (main + staging + preview + production):

```bash
# para cada branch
for branch in main staging production; do
  supabase link --project-ref "${branch}-project-ref"
  supabase secrets set --env-file "./supabase/.env.${branch}"
done
```

Documentar workflow no onboarding do projeto.

### Anti-pattern 3: Commitar `.env.keys` no git

**Errado:** `.env.keys` aparece em `git status` e dev faz `git add` distraído:

```bash
git status
# Changes not staged for commit:
#   modified:   supabase/.env.preview
#   modified:   .env.keys           ← BLOQUEANTE
git add .
git commit -m "feat: add preview secrets"  # vazou a chave master
git push
```

**Por quê:** `.env.keys` é a chave de **decryption master** — com ela, qualquer um decripta `.env.preview`/`.env.production` e tem acesso a TODOS os secrets encrypted; equivalente a vazar password master + todos os tokens OAuth + todas as API keys de uma vez.

**Certo:**

```bash
# adicionar SEMPRE ao .gitignore — ANTES de qualquer set
echo ".env.keys" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore dotenvx decryption key"
```

Se foi committed por engano:

1. `git filter-repo` (ou BFG) para limpar history
2. **Rotacionar TODOS os secrets encrypted imediatamente** — sem confiar que ninguém viu antes
3. Re-encrypt valores em `.env.preview`/`.env.production` com nova `.env.keys`
4. Force-push branches afetados
5. Notificar team + auditar acessos

### Anti-pattern 4: Confundir `env()` vs `encrypted:` syntax

**Errado:** tentar combinar os dois prefixos:

```toml
[auth.external.github]
secret = "encrypted:env(GITHUB_SECRET)"  # syntax inválida — mistura prefixos
```

**Por quê:** Supabase CLI parser não combina os dois — valor literal `"encrypted:env(GITHUB_SECRET)"` é usado como string, OAuth callback falha com `invalid client_secret`.

**Certo:** escolher UM:

```toml
# Option A: env() resolve via env var
[auth.external.github]
secret = "env(GITHUB_SECRET)"

# Option B: encrypted: via dotenvx decryption
[auth.external.github]
secret = "encrypted:LSi...payload-encrypted...=="
```

Nunca combinar.

### Anti-pattern 5: Reusar `project_id` entre `[remotes]` blocks

**Errado:**

```toml
[remotes.staging]
project_id = "main-project-ref"  # ← mesmo ref do main

[remotes.production]
project_id = "main-project-ref"  # ← mesmo ref do main
```

**Por quê:** `[remotes.<name>]` deve apontar para branch **DEDICADO** criado via `supabase --experimental branches create`; usar mesmo `project_id` para múltiplos `[remotes]` causa configs sobrescritas no DAG step 4 (configure) — última definição vence, comportamento imprevisível.

**Certo:** criar branch por ambiente + obter `project_id` único:

```bash
supabase --experimental branches create staging --persistent
supabase --experimental branches create production --persistent
supabase --experimental branches list
# BRANCH NAME    BRANCH PROJECT ID
# main           main-project-ref
# staging        staging-dedicated-ref
# production     production-dedicated-ref
```

```toml
[remotes.staging]
project_id = "staging-dedicated-ref"

[remotes.production]
project_id = "production-dedicated-ref"
```

### Anti-pattern 6: Esperar `env()` em config.toml resolver para secrets do projeto

**Errado:** setar secret via `supabase secrets set` e esperar que `config.toml` com `env()` resolva:

```bash
# setar secret no projeto (runtime Edge Functions)
supabase secrets set SENDGRID_API_KEY=sk-real-key

# config.toml
[edge_runtime.secrets]
# expecta erradamente que o secret do projeto seja resolvido
SENDGRID_API_KEY = "env(SENDGRID_API_KEY)"
```

**Por quê:** `env()` em config.toml resolve para env var **do CLI local** (build-time), **NÃO para secrets do projeto Supabase** (runtime das Edge Functions). Se o shell que roda o CLI não tem `SENDGRID_API_KEY` exportado, resolve para string vazia → config quebrada.

**Certo:**

- **Para secrets de Edge Functions runtime:** `supabase secrets set` + `Deno.env.get("SENDGRID_API_KEY")` no código Deno
- **Para config.toml build-time:** setar env var no shell antes de rodar CLI:

```bash
export SENDGRID_API_KEY=sk-build-time-key
supabase db push
# config.toml com env(SENDGRID_API_KEY) resolve para "sk-build-time-key"
```

Em workflow CI (GitHub Actions): expor secret no env do step:

```yaml
- name: Push to Supabase
  env:
    SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
  run: supabase db push
```

## Cross-suite integration (v1.27)

Esta skill é par-conjugado com `supabase-branching-workflow` (Phase 149) — branching workflow descreve **quando** branches são criados; config-toml-remotes descreve **como** configurar.

Cross-refs canônicas com outras skills v1.27 (Phases 150-153):

- **supabase-branching-workflow** (Phase 149) — Deploy DAG step 4 (configure) lê `[remotes.<branch>]` block desta skill
- **supabase-ci-cd-github-actions** (Phase 151, futura) — 8 workflows GitHub Actions que exportam env vars + rodam `supabase db push` com `--env-file` (cross-ref Pattern 3 + Pattern 4)
- **supabase-pgtap-testing** (Phase 152, futura) — testes pgTAP que rodam em remote branches via `--db-url` derivada de `[remotes.<branch>]`
- **supabase-migration-repair** (Phase 153, futura) — `migration repair` per `[remotes.<branch>]` quando drift detectado

Base para agent novo v1.27:

- **supabase-cicd-pipeline-implementer** (Phase 154, futura) — recebe spec via `Task()` e materializa `[remotes.<branch>]` blocks na config + GitHub Actions workflows com dotenvx integration

Pattern de handoff cooperativo herdado v1.23-v1.26: **architect** projeta strategy → **cicd-pipeline-implementer** materializa → **release-pipeline-auditor** (v1.10) audita hermeticidade. Nenhum agente descarta upstream — handoff cooperativo SQL (princípio canônico v1.23).

## Ver também

- [supabase-branching-workflow](../supabase-branching-workflow/SKILL.md) (v1.27, Phase 149) — pré-requisito conceitual; Deploy DAG step 4 (configure) aplica `[remotes]`
- [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — workflows GitHub Actions com `--env-file` + `supabase secrets set`
- [supabase-pgtap-testing](../supabase-pgtap-testing/SKILL.md) (v1.27, Phase 152) — testes que rodam em remote branches via `--db-url`
- [supabase-migration-repair](../supabase-migration-repair/SKILL.md) (v1.27, Phase 153) — `migration repair` per `[remotes.<branch>]`
- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — migrations aplicadas no branch via `supabase db push --linked`
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — `Deno.env.get()` lê secrets setados via `supabase secrets set --env-file`
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — `auth.external.*.secret` encrypted fields usados no auth flow
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) (v1.25) — `auth.hook.custom_access_token.secrets` é Auth Hook (Grupo 6)
- [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — cross-ref para system access via secrets DB (`db.root_key`, `db.vault`)
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos `[remotes]`, encrypted:, env(), dotenvx, .env.keys, .env.preview, designated secret fields, branch project_id
- Doc oficial: [Branching Configuration](https://supabase.com/docs/guides/deployment/branching#configuration), [Config Reference](https://supabase.com/docs/guides/local-development/cli/config), [dotenvx](https://dotenvx.com/), [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
