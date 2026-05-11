---
plan_id: 150-01-skill-config-toml-remotes
phase: 150
wave: 1
depends_on: []
autonomous: true
requirements:
  - CFG-01
  - CFG-02
  - CFG-03
  - CFG-04
  - CFG-05
files_modified:
  - kit/skills/supabase-config-toml-remotes/SKILL.md
estimated_lines: 600
must_haves:
  - "Frontmatter YAML válido com name=supabase-config-toml-remotes + description trigger phrases (remotes block, branch-specific config, secrets per-branch, dotenvx, encrypted fields)"
  - "Seção 'Quando usar' com trigger phrases (remotes block Supabase, branch-specific config.toml, secrets per-branch Supabase, dotenvx Supabase, encrypted fields)"
  - "Seção 'Princípio canônico' (config.toml como source of truth + dotenvx para secrets git-tracked + secrets NÃO herdam entre branches)"
  - "CFG-01: Pattern 1 — `[remotes.<name>]` block referencing existing project_id (obtido via `supabase --experimental branches list`), com exemplo staging/production em TOML"
  - "CFG-02: Pattern 2 — branch-specific configuration overrides (db.port, db.pool_size, api.max_rows, api.schemas, auth.external.*, edge_runtime.secrets) com exemplos TOML"
  - "CFG-03: Pattern 3 — secret management per-branch (`supabase secrets set --env-file ./supabase/.env`), caveat canônico secrets NÃO herdam entre branches"
  - "CFG-04: Pattern 4 — dotenvx pattern (.env.keys + .env.preview encrypted), `encrypted:<value>` vs `env(VAR_NAME)` syntax, tabela de file types (.env.keys, .env.local, .env.production, .env.preview, .env), warning canônico encrypted: só funciona em designated secret fields"
  - "CFG-05: Pattern 5 — 6 grupos de encrypted fields canônicos LISTADOS COMPLETAMENTE (Studio openai_api_key; Database root_key + vault; Auth Core publishable_key/secret_key/jwt_secret; Auth Email smtp.pass; Auth Captcha secret; Auth Hooks 6 secrets; Auth SMS 5 secrets twilio/messagebird/textlocal/vonage; Auth External *.secret; Edge Runtime secrets.*)"
  - "Seção 'Anti-patterns' com pelo menos 4 anti-patterns no formato Errado/Por quê/Certo (encrypted: em field não-designated, assumir secrets herdam entre branches, commitar .env.keys no git, confundir env() vs encrypted: syntax)"
  - "Seção 'Cross-suite integration (v1.27)' linkando supabase-branching-workflow (Phase 149) + skills futuras v1.27 (Phase 151-153)"
  - "Seção 'Ver também' com cross-refs para supabase-branching-workflow, supabase-migrations, supabase-edge-functions, supabase-auth-ssr, glossário compartilhado + doc oficial"
  - "Tamanho mínimo 500 linhas (pattern v1.26-v1.27)"
---

# Plano 150-01: Skill nova `supabase-config-toml-remotes`

## Objetivo

Criar skill canônica `kit/skills/supabase-config-toml-remotes/SKILL.md` cobrindo:
1. `[remotes.<name>]` block referencing existing project_id (CFG-01)
2. Branch-specific configuration overrides (CFG-02)
3. Secrets management per-branch — caveat de não-herança (CFG-03)
4. dotenvx pattern + `encrypted:` vs `env()` syntax (CFG-04)
5. 6 grupos de encrypted fields canônicos LISTADOS completamente (CFG-05)

Pattern canônico v1.26-v1.27 (supabase-postgres-roles + supabase-branching-workflow como referência estrutural). Conteúdo PT-BR (convenção v1.22+). Code blocks TOML/bash EN com comentários PT-BR.

## Contexto upstream

- Material-fonte: doc oficial Supabase Branching Configuration (já incorporada em REQUIREMENTS.md CFG-01..05)
- Skill pré-requisito conceitual: `supabase-branching-workflow` (Phase 149) — `[remotes]` referenciado no Pattern 2 (Deploy DAG step 4 configure)
- Skills cross-ref existentes: supabase-migrations (v1.23), supabase-edge-functions, supabase-auth-ssr
- Princípio canônico v1.23-v1.26: handoff cooperativo SQL (não BLOCK rígido)

## Tasks

<task id="150-01-T1" description="Criar diretório kit/skills/supabase-config-toml-remotes/ e SKILL.md com frontmatter">
  <read_first>
    - kit/skills/supabase-postgres-roles/SKILL.md (pattern canônico v1.26)
    - kit/skills/supabase-branching-workflow/SKILL.md (pattern v1.27)
  </read_first>
  <action>
    Criar diretório `kit/skills/supabase-config-toml-remotes/` se não existir.
    Inicializar arquivo `kit/skills/supabase-config-toml-remotes/SKILL.md` com frontmatter YAML:

    ```yaml
    ---
    name: supabase-config-toml-remotes
    description: Use ao configurar Supabase para branching — `[remotes.<name>]` block + branch-specific overrides + secrets per-branch (NÃO herdam) + dotenvx pattern (.env.keys + .env.preview encrypted) + 6 grupos de encrypted fields canônicos (Studio/Database/Auth Core/Email/Captcha/Hooks/SMS/External + Edge Runtime). v1.27 incorpora 100% da doc oficial.
    ---
    ```

    Salvar arquivo. Output esperado: arquivo existe com frontmatter válido.
  </action>
  <acceptance_criteria>
    - File exists
    - Frontmatter has name=supabase-config-toml-remotes
    - Frontmatter has description com trigger phrases (remotes, branch-specific, secrets per-branch, dotenvx, encrypted)
  </acceptance_criteria>
</task>

<task id="150-01-T2" description="Adicionar seções 'Quando usar' e 'Princípio canônico'">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T1)
    - kit/skills/supabase-branching-workflow/SKILL.md (linhas 7-46 — pattern Quando usar + Princípio canônico)
  </read_first>
  <action>
    Adicionar após o frontmatter:

    1. Título H1 `# Supabase — Config TOML & Remotes`
    2. Seção `## Quando usar` listando trigger phrases:
       - "remotes block Supabase", "[remotes] config.toml"
       - "branch-specific config Supabase", "config.toml staging override"
       - "secrets per-branch Supabase", "supabase secrets set"
       - "dotenvx Supabase", ".env.keys .env.preview"
       - "encrypted: Supabase config", "env() vs encrypted: syntax"
       - "Supabase encrypted fields", "auth.hook secrets encrypted"
    3. Seção `## Princípio canônico` com 3 princípios:
       - **config.toml é source of truth** — `[remotes.<branch>]` block declara overrides versionados em git
       - **dotenvx para secrets git-tracked** — `.env.keys` (decryption key, gitignored) + `.env.preview`/`.env.production` (encrypted values, committed)
       - **Secrets NÃO herdam entre branches** — cada branch tem credenciais únicas; reset manual via `supabase secrets set --env-file` por branch
    4. Distinção canônica `env()` vs `encrypted:`:
       - `env(VAR_NAME)` — resolve para variável de ambiente em runtime (qualquer field non-secret)
       - `encrypted:<value>` — decripta usando `.env.keys` (APENAS em designated secret fields — uso em outros é silent no-op)
  </action>
  <acceptance_criteria>
    - Section 'Quando usar' exists
    - Section 'Princípio canônico' exists
    - 3 princípios canônicos documentados
    - Distinção env() vs encrypted: presente
  </acceptance_criteria>
</task>

<task id="150-01-T3" description="Adicionar Pattern 1: [remotes] block (CFG-01)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T2)
  </read_first>
  <action>
    Adicionar seção `## Pattern 1: [remotes] block — referenciar branch existente` (CFG-01) com:

    1. Pré-requisito: branch já criado via `supabase --experimental branches create --persistent` ou via PR (preview branch).

    2. Workflow canônico:
       - Step 1: criar persistent branch via CLI
       - Step 2: obter `project_id` via `supabase --experimental branches list` (coluna BRANCH PROJECT ID)
       - Step 3: adicionar bloco `[remotes.<name>]` no `supabase/config.toml`

    3. Exemplo TOML completo (staging):
       ```toml
       [remotes.staging]
       project_id = "your-project-ref"

       [remotes.staging.db.seed]
       enabled = true
       sql_paths = ["./seeds/staging.sql"]
       ```

    4. Exemplo TOML production:
       ```toml
       [remotes.production]
       project_id = "prod-project-ref"

       [remotes.production.db.seed]
       enabled = false  # production não aplica seeds
       ```

    5. CLI commands relacionados:
       ```bash
       # listar branches do projeto
       supabase --experimental branches list

       # output esperado:
       # BRANCH NAME    PROJECT ID         STATUS
       # main           main-project-ref   active
       # staging        staging-project-ref active
       # pr-42-feature  pr42-project-ref   active
       ```

    6. Caveat: `project_id` deve ser de branch EXISTENTE — se branch foi deletado, o bloco `[remotes]` continua válido mas operações falham silenciosamente.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 1' com '[remotes]' presente
    - Exemplo TOML `[remotes.staging]` presente
    - Exemplo `project_id` documentado
    - CLI `supabase --experimental branches list` mencionado
  </acceptance_criteria>
</task>

<task id="150-01-T4" description="Adicionar Pattern 2: branch-specific overrides (CFG-02)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T3)
  </read_first>
  <action>
    Adicionar seção `## Pattern 2: Branch-specific configuration overrides` (CFG-02) com:

    1. Princípio: config base aplica a TODOS os branches; `[remotes.<name>.<section>]` aplica override APENAS no branch nomeado.

    2. Categorias de fields disponíveis (lista canônica):

       **db (database):**
       ```toml
       [remotes.staging.db]
       port = 54322
       pool_size = 25  # default 15
       ```

       **api (PostgREST):**
       ```toml
       [remotes.staging.api]
       port = 54321
       max_rows = 1000  # default 1000 em produção
       schemas = ["public", "extensions"]
       ```

       **db.seed:**
       ```toml
       [remotes.staging.db.seed]
       enabled = true
       sql_paths = ["./seeds/staging.sql"]
       ```

       **auth.external.* (OAuth providers):**
       ```toml
       [remotes.staging.auth.external.github]
       enabled = true
       client_id = "env(STAGING_GITHUB_CLIENT_ID)"
       secret = "env(STAGING_GITHUB_SECRET)"
       ```

       **edge_runtime.secrets:**
       ```toml
       [remotes.staging.edge_runtime.secrets]
       SENDGRID_API_KEY = "env(STAGING_SENDGRID_API_KEY)"
       ```

    3. Tabela de fields override-able (lista canônica):

       | Section | Fields | Caso de uso típico |
       |---------|--------|---------------------|
       | db | port, pool_size | Tuning pool size per ambiente |
       | api | port, max_rows, schemas | Diferenciar response limits |
       | db.seed | enabled, sql_paths | Seeds diferentes por branch |
       | auth.external.* | client_id, secret, redirect_uri | OAuth keys per ambiente |
       | edge_runtime.secrets | * (custom) | API keys per branch |

    4. Caveat: overrides são **merge** com config base — `[remotes.staging.db]` com `pool_size = 25` NÃO sobrescreve `[db]` global, apenas o field específico.

    5. Caveat: alterações em `config.toml` precisam ser pushed para o branch (deploy DAG step 4 configure re-aplica).
  </action>
  <acceptance_criteria>
    - Section 'Pattern 2' com 'overrides' presente
    - Exemplos TOML para db, api, auth.external, edge_runtime
    - Tabela de fields override-able
    - Caveat merge behavior documentado
  </acceptance_criteria>
</task>

<task id="150-01-T5" description="Adicionar Pattern 3: secrets per-branch + caveat não-herança (CFG-03)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T4)
  </read_first>
  <action>
    Adicionar seção `## Pattern 3: Secrets management per-branch` (CFG-03) com:

    1. Caveat canônico destacado:
       > **Secrets NÃO herdam entre branches.** Criar persistent branch `staging` NÃO copia secrets do `main`. Cada branch precisa ter secrets setados separadamente.

    2. CLI canônico:
       ```bash
       # Set secrets a partir de .env file
       supabase secrets set --env-file ./supabase/.env

       # Set secret individual
       supabase secrets set SMTP_HOST=smtp.example.com

       # Listar secrets do branch atual
       supabase secrets list

       # Remover secret
       supabase secrets unset SMTP_HOST
       ```

    3. Workflow per-branch:
       ```bash
       # criar staging branch
       supabase --experimental branches create staging --persistent

       # link CLI para o branch staging
       supabase link --project-ref <staging-project-ref>

       # setar secrets do staging
       supabase secrets set --env-file ./supabase/.env.staging

       # voltar para main
       supabase link --project-ref <main-project-ref>
       ```

    4. Exemplo `.env.staging` (gitignored se não usa dotenvx; encrypted se usa):
       ```bash
       SMTP_HOST=smtp.staging.example.com
       SMTP_USER=staging-user
       SMTP_PASS=staging-pass
       SENDGRID_API_KEY=SG.staging.xxx
       ```

    5. Caveat secrets vs config.toml `env()`:
       - Secrets via `supabase secrets set` → disponíveis como env vars em **Edge Functions** (acessado via `Deno.env.get("SMTP_HOST")`)
       - `config.toml` com `env(SMTP_HOST)` → resolve para env var local do CLI (não dos secrets do projeto)
       - **NÃO confundir** — secrets são runtime do projeto; `env()` em config.toml é build-time do CLI

    6. Recomendação canônica: usar **dotenvx pattern** (Pattern 4) para versionar secrets encrypted em git em vez de gerenciar `.env.staging` separadamente.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 3' com 'secrets' + 'per-branch' presente
    - Caveat NÃO herdam destacado
    - CLI `supabase secrets set` documentado
    - Workflow per-branch com `supabase link` documentado
  </acceptance_criteria>
</task>

<task id="150-01-T6" description="Adicionar Pattern 4: dotenvx + encrypted:/env() syntax (CFG-04)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T5)
  </read_first>
  <action>
    Adicionar seção `## Pattern 4: dotenvx pattern + `encrypted:` vs `env()` syntax` (CFG-04) com:

    1. Princípio dotenvx:
       - Encrypted values podem ser committed em git (`.env.preview`, `.env.production`)
       - Decryption key (`.env.keys`) NUNCA é committed
       - Permite versionar secrets sem expor — git history rastreia mudanças sem PII

    2. Tabela canônica de file types:

       | File | Env | gitignore | Encrypted |
       |------|-----|-----------|-----------|
       | `.env.keys` | All | **YES** (NUNCA committar) | No |
       | `.env.local` | Local | YES | No |
       | `.env.production` | Prod | No | YES (committed encrypted) |
       | `.env.preview` | Branches preview | No | YES (committed encrypted) |
       | `.env` | Any | Maybe | YES |

    3. Workflow canônico dotenvx:
       ```bash
       # 1. instalar dotenvx
       npm install -D @dotenvx/dotenvx

       # 2. setar secret encrypted no arquivo .env.preview
       npx @dotenvx/dotenvx set SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "ghs_xxx" -f supabase/.env.preview

       # 3. set decryption key (gera .env.keys)
       # (gerado automaticamente pelo dotenvx set)

       # 4. usar com supabase CLI (carregar via --env-file)
       npx supabase secrets set --env-file supabase/.env.keys
       # ou em workflow CI:
       # npx @dotenvx/dotenvx run -- supabase secrets set --env-file supabase/.env.preview
       ```

    4. Sintaxes em `config.toml`:

       **Option A: encrypted: directly em designated secret field:**
       ```toml
       [auth.external.github]
       enabled = true
       client_id = "Iv1.xxxxx"
       secret = "encrypted:LSiME...payload-encrypted...=="
       ```

       **Option B: env() para resolver via env var (qualquer field):**
       ```toml
       [auth.external.github]
       enabled = true
       client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
       secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
       ```

    5. **Warning canônico destacado:**
       > **`encrypted:` syntax SÓ funciona em designated secret fields** (Pattern 5 — 6 grupos). Em outros campos não decripta silenciosamente — o valor literal `"encrypted:LSiME..."` é usado como string, expondo o payload encrypted como se fosse plaintext.

    6. Quando usar qual:
       - **`encrypted:`** — quando quer versionar o secret encrypted em git (workflow dotenvx); aplicar APENAS em fields designados
       - **`env()`** — quando secrets vivem em env vars do CI/local; works em qualquer field; flexibilidade ao custo de não versionar em git
  </action>
  <acceptance_criteria>
    - Section 'Pattern 4' com 'dotenvx' presente
    - Tabela de file types (.env.keys gitignored)
    - Exemplos `encrypted:<value>` e `env(VAR_NAME)`
    - Warning encrypted: só em designated fields documentado
  </acceptance_criteria>
</task>

<task id="150-01-T7" description="Adicionar Pattern 5: 6 grupos de encrypted fields canônicos LISTADOS (CFG-05)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T6)
  </read_first>
  <action>
    Adicionar seção `## Pattern 5: 6 grupos de encrypted fields canônicos` (CFG-05) com:

    1. Princípio: apenas estes fields aceitam `encrypted:<value>` syntax — qualquer outro é silent no-op.

    2. Lista canônica COMPLETA dos 6 grupos:

       ### Grupo 1: Studio
       - `studio.openai_api_key`

       ### Grupo 2: Database
       - `db.root_key`
       - `db.vault.*` (todas subkeys)

       ### Grupo 3: Auth Core
       - `auth.publishable_key`
       - `auth.secret_key`
       - `auth.jwt_secret`

       ### Grupo 4: Auth Email
       - `auth.email.smtp.pass`

       ### Grupo 5: Auth Captcha
       - `auth.captcha.secret`

       ### Grupo 6: Auth Hooks
       - `auth.hook.mfa_verification_attempt.secrets`
       - `auth.hook.password_verification_attempt.secrets`
       - `auth.hook.custom_access_token.secrets`
       - `auth.hook.send_sms.secrets`
       - `auth.hook.send_email.secrets`
       - `auth.hook.before_user_created.secrets`

       ### Grupo 7: Auth SMS providers
       - `auth.sms.twilio.auth_token`
       - `auth.sms.twilio_verify.auth_token`
       - `auth.sms.messagebird.access_key`
       - `auth.sms.textlocal.api_key`
       - `auth.sms.vonage.api_secret`

       ### Grupo 8: Auth External providers
       - `auth.external.<provider>.secret` (qualquer provider: github, google, facebook, apple, twitter, discord, etc.)

       ### Grupo 9: Edge Runtime
       - `edge_runtime.secrets.*` (todas subkeys)

       _Nota: documentação Supabase agrupa estes como **6 grupos lógicos** (Studio, Database, Auth Core/Email/Captcha/Hooks/SMS/External, Edge Runtime) — apresentamos expandido para máxima clareza._

    3. Exemplo TOML cobrindo múltiplos grupos:
       ```toml
       # Studio (Grupo 1)
       [studio]
       openai_api_key = "encrypted:LSi...studio-key-encrypted...=="

       # Auth Core (Grupo 3)
       [auth]
       jwt_secret = "encrypted:LSi...jwt-secret-encrypted...=="

       # Auth Email (Grupo 4)
       [auth.email.smtp]
       host = "smtp.example.com"
       port = 587
       user = "noreply@example.com"
       pass = "encrypted:LSi...smtp-pass-encrypted...=="

       # Auth Hook (Grupo 6)
       [auth.hook.custom_access_token]
       enabled = true
       uri = "pg-functions://postgres/auth/custom_access_token_hook"
       secrets = "encrypted:LSi...hook-secret-encrypted...=="

       # Auth SMS (Grupo 7)
       [auth.sms.twilio]
       enabled = true
       account_sid = "ACxxxxxxxxxxxx"
       message_service_sid = "MGxxxxxxxxxxxx"
       auth_token = "encrypted:LSi...twilio-token-encrypted...=="

       # Auth External (Grupo 8)
       [auth.external.github]
       enabled = true
       client_id = "Iv1.xxxxxxx"
       secret = "encrypted:LSi...github-secret-encrypted...=="

       # Edge Runtime (Grupo 9)
       [edge_runtime.secrets]
       OPENAI_API_KEY = "encrypted:LSi...openai-edge-encrypted...=="
       SENDGRID_API_KEY = "encrypted:LSi...sendgrid-encrypted...=="
       ```

    4. Caveat: lista pode evoluir com versões do Supabase CLI — consultar doc oficial para refresh periódico (`supabase --version` para alinhamento).
  </action>
  <acceptance_criteria>
    - Section 'Pattern 5' com '6 grupos' presente
    - Todos 6+ grupos listados (Studio, Database, Auth Core, Email, Captcha, Hooks, SMS, External, Edge Runtime)
    - `studio.openai_api_key` presente
    - `db.root_key` e `db.vault` presentes
    - `auth.jwt_secret` presente
    - `auth.email.smtp.pass` presente
    - `auth.captcha.secret` presente
    - 6 auth.hook.* secrets listados
    - 5 auth.sms.* providers listados
    - `auth.external.*.secret` mencionado
    - `edge_runtime.secrets.*` mencionado
    - Exemplo TOML completo presente
  </acceptance_criteria>
</task>

<task id="150-01-T8" description="Adicionar Anti-patterns (≥ 4 com formato Errado/Por quê/Certo)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T7)
    - kit/skills/supabase-postgres-roles/SKILL.md (linhas 293-376 — pattern Anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 4+ anti-patterns:

    ### Anti-pattern 1: Usar `encrypted:` em field não-designated
    - **Errado:** colocar `encrypted:LSi...payload..==` em `auth.email.smtp.host` (não é designated secret field)
    - **Por quê:** valor literal é usado como string — SMTP host fica "encrypted:LSi...==" e SMTP connection falha (provavelmente lookup de host falha silenciosamente)
    - **Certo:** consultar Pattern 5 — usar `encrypted:` APENAS nos 6 grupos canônicos; para outros fields, usar `env(VAR_NAME)` se precisa secret

    ### Anti-pattern 2: Assumir secrets herdam entre branches
    - **Errado:** criar `staging` branch e assumir que SENDGRID_API_KEY do main está disponível
    - **Por quê:** secrets são per-branch — staging tem env vars vazias até `supabase secrets set` rodar separadamente; Edge Functions retornam undefined em `Deno.env.get("SENDGRID_API_KEY")`
    - **Certo:** rodar `supabase secrets set --env-file` para CADA branch (main + staging + production); documentar no onboarding do projeto

    ### Anti-pattern 3: Commitar `.env.keys` no git
    - **Errado:** `.env.keys` aparece em `git status` e dev faz `git add` distraído
    - **Por quê:** `.env.keys` é a chave de decryption — com ela, qualquer um decripta `.env.preview`/`.env.production` e tem acesso a TODOS os secrets encrypted; equivalente a vazar password master
    - **Certo:**
      ```bash
      # adicionar SEMPRE ao .gitignore
      echo ".env.keys" >> .gitignore
      git add .gitignore
      git commit -m "chore: gitignore dotenvx decryption key"
      ```
      Se foi committed por engano: `git filter-repo` para limpar history + rotacionar TODOS os secrets imediatamente.

    ### Anti-pattern 4: Confundir `env()` vs `encrypted:` syntax
    - **Errado:**
      ```toml
      [auth.external.github]
      secret = "encrypted:env(GITHUB_SECRET)"  # syntax inválida — mistura prefixos
      ```
    - **Por quê:** Supabase CLI parser não combina os dois — valor literal é usado, OAuth falha
    - **Certo:** escolher UM:
      - `secret = "env(GITHUB_SECRET)"` — para resolver via env var
      - `secret = "encrypted:LSi...payload..=="` — para decriptar via .env.keys

    ### Anti-pattern 5: Reusar `project_id` entre branches
    - **Errado:**
      ```toml
      [remotes.staging]
      project_id = "main-project-ref"  # mesmo ref do main

      [remotes.production]
      project_id = "main-project-ref"
      ```
    - **Por quê:** `[remotes.<name>]` deve apontar para branch DEDICADO criado via `supabase --experimental branches create`; usar mesmo `project_id` para múltiplos `[remotes]` causa configs sobrescritas no DAG step 4 configure
    - **Certo:** criar branch por ambiente + obter `project_id` único via `supabase --experimental branches list`:
      ```toml
      [remotes.staging]
      project_id = "staging-dedicated-ref"

      [remotes.production]
      project_id = "production-dedicated-ref"
      ```

    ### Anti-pattern 6: Esperar `env()` em config.toml resolver para secrets do projeto
    - **Errado:** colocar `secret = "env(SENDGRID_API_KEY)"` em `config.toml` esperando que o secret setado via `supabase secrets set SENDGRID_API_KEY=xxx` seja resolvido
    - **Por quê:** `env()` em config.toml resolve para env var **do CLI local** (build-time), NÃO para secrets do projeto Supabase (runtime das Edge Functions)
    - **Certo:**
      - Para secrets de Edge Functions runtime: `supabase secrets set` + `Deno.env.get("SENDGRID_API_KEY")` no código
      - Para config.toml build-time: setar env var no shell antes de rodar CLI (`SENDGRID_API_KEY=xxx supabase db push`)
  </action>
  <acceptance_criteria>
    - Section 'Anti-patterns' exists
    - ≥ 4 anti-patterns (testar via grep "^### Anti-pattern")
    - Cada anti-pattern com Errado/Por quê/Certo
    - Anti-pattern 1: encrypted em field não-designated
    - Anti-pattern 2: assumir secrets herdam
    - Anti-pattern 3: commitar .env.keys
    - Anti-pattern 4: confundir env() vs encrypted:
  </acceptance_criteria>
</task>

<task id="150-01-T9" description="Adicionar Cross-suite integration + Ver também (cross-refs)">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado após T8)
    - kit/skills/supabase-branching-workflow/SKILL.md (linhas 514-545 — pattern Cross-suite + Ver também)
  </read_first>
  <action>
    Adicionar duas seções finais:

    1. Seção `## Cross-suite integration (v1.27)`:
       - Esta skill é par-conjugado com `supabase-branching-workflow` (Phase 149) — branching workflow descreve **quando** branches são criados; config-toml-remotes descreve **como** configurar.
       - Cross-ref com Deploy DAG (Phase 149 Pattern 2 step 4 configure): `[remotes.<branch>]` block é lido neste step.
       - Cross-ref com skill `supabase-ci-cd-github-actions` (Phase 151) — workflows que exportam env vars + rodam `supabase db push` com `--env-file`.
       - Cross-ref com skill `supabase-migration-repair` (Phase 153) — quando migration drift detectado, `[remotes.<branch>]` ajuda re-aplicar.
       - Base para agent `supabase-cicd-pipeline-implementer` (Phase 154) — materializa `[remotes.<branch>]` blocks na config.

    2. Seção `## Ver também`:
       - [supabase-branching-workflow](../supabase-branching-workflow/SKILL.md) (v1.27, Phase 149) — pré-requisito conceitual; Deploy DAG step 4 configure aplica `[remotes]`
       - [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — workflows GitHub Actions com `--env-file` + `supabase secrets set`
       - [supabase-pgtap-testing](../supabase-pgtap-testing/SKILL.md) (v1.27, Phase 152) — testes que rodam em remote branches via `--db-url` derivada de `[remotes.<branch>]`
       - [supabase-migration-repair](../supabase-migration-repair/SKILL.md) (v1.27, Phase 153) — `migration repair` per `[remotes.<branch>]`
       - [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — migrations aplicadas no branch via `supabase db push --linked`
       - [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — `Deno.env.get()` lê secrets setados via `supabase secrets set --env-file`
       - [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — `auth.external.*.secret` encrypted fields usados no auth flow
       - [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) (v1.25) — `auth.hook.custom_access_token.secrets` é Auth Hook (Grupo 6)
       - [glossário compartilhado](../_shared-supabase/glossary.md) — termos `[remotes]`, encrypted:, env(), dotenvx, .env.keys, .env.preview, designated secret fields
       - Doc oficial: [Branching Configuration](https://supabase.com/docs/guides/deployment/branching#configuration), [Config Reference](https://supabase.com/docs/guides/local-development/cli/config), [dotenvx](https://dotenvx.com/)
  </action>
  <acceptance_criteria>
    - Section 'Cross-suite integration (v1.27)' exists
    - Section 'Ver também' exists
    - Cross-ref supabase-branching-workflow presente
    - Cross-ref supabase-migrations presente
    - Cross-ref supabase-edge-functions presente
    - Cross-ref supabase-auth-ssr presente
    - Cross-ref glossário compartilhado presente
    - Doc oficial link presente
  </acceptance_criteria>
</task>

<task id="150-01-T10" description="Validar tamanho mínimo e estrutura final">
  <read_first>
    - kit/skills/supabase-config-toml-remotes/SKILL.md (estado completo após T1..T9)
  </read_first>
  <action>
    Validar estado final:
    1. Tamanho ≥ 500 linhas
    2. Frontmatter YAML válido (--- abre/fecha)
    3. Todas seções principais (Quando usar, Princípio canônico, Patterns 1-5, Anti-patterns, Cross-suite, Ver também)
    4. Todos 5 REQs cobertos (CFG-01..05)
    5. ≥ 4 anti-patterns Errado/Por quê/Certo

    Se < 500 linhas, expandir com mais exemplos TOML inline, mais caveats da doc oficial, mais detalhes em Pattern 5 (encrypted fields).
  </action>
  <acceptance_criteria>
    - File ≥ 500 linhas (target 500-700)
    - Frontmatter --- (open + close) presente
    - Todos 6+ grupos encrypted fields listados (Pattern 5)
    - 5 REQs cobertos (CFG-01..05)
    - ≥ 4 anti-patterns
  </acceptance_criteria>
</task>

## Verificação de objetivo

Após T1..T10 completarem, executar verificação reversa:

1. **Existência:** `kit/skills/supabase-config-toml-remotes/SKILL.md` existe
2. **REQs cobertos:** 5/5 — CFG-01 (`[remotes]` block), CFG-02 (branch-specific overrides), CFG-03 (secrets per-branch + caveat não-herança), CFG-04 (dotenvx + encrypted:/env()), CFG-05 (6 grupos encrypted fields)
3. **Estrutura canônica v1.26-v1.27:** frontmatter + Quando usar + Princípio canônico + Patterns 1-5 + Anti-patterns + Cross-suite + Ver também
4. **Tamanho:** ≥ 500 linhas (target 500-700)
5. **Anti-patterns:** ≥ 4 entries com pattern Errado/Por quê/Certo
6. **6 grupos encrypted fields:** todos listados (Studio + Database + Auth Core + Email + Captcha + Hooks + SMS + External + Edge Runtime — expandido)
7. **Tom canônico:** PT-BR instrucional direto, code blocks TOML/bash EN com comentários PT-BR, caveats explícitos repetidos (encrypted: só em designated fields × 2+, secrets NÃO herdam × 2+)

## Decisões canônicas registradas

- **`encrypted:` syntax SÓ em designated secret fields** — repetido em Pattern 4 + Pattern 5 + Anti-pattern 1
- **Secrets NÃO herdam entre branches** — repetido em Princípio canônico + Pattern 3 + Anti-pattern 2
- **`.env.keys` SEMPRE gitignored** — Pattern 4 + Anti-pattern 3
- **Pattern de Anti-patterns Errado/Por quê/Certo** — herdado v1.26 (supabase-postgres-roles)
- **Convenção PT-BR** (v1.22+) — texto PT-BR, code blocks TOML/bash EN com comentários PT-BR
