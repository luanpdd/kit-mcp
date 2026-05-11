# Fase 150 — SUMMARY

**Concluída:** 2026-05-11
**Plan:** 150-01-skill-config-toml-remotes
**Mode:** standard autonomous (1 plano, 1 wave)

## O que foi criado

### Arquivo novo

`kit/skills/supabase-config-toml-remotes/SKILL.md` — **807 linhas**

### REQs cobertos (5/5)

- **CFG-01** — `[remotes.<name>]` block referencing existing `project_id` (Pattern 1) — workflow canônico 3-step (criar branch → listar via `--experimental branches list` → adicionar bloco em config.toml) + exemplos TOML staging/production + CLI commands + caveat branch deletado + caveat `project_id` único por bloco
- **CFG-02** — Branch-specific configuration overrides (Pattern 2) — categorias canônicas db/api/db.seed/auth.external/auth.email.smtp/auth.sms/edge_runtime.secrets + tabela canônica de fields override-able + exemplos TOML por categoria + caveat merge behavior + caveat re-deploy required
- **CFG-03** — Secrets management per-branch (Pattern 3) — caveat canônico secrets NÃO herdam (destacado) + CLI commands (`set --env-file`, `set KEY=val`, `list`, `unset`) + workflow per-branch com `supabase link` + exemplo `.env.staging` + tabela distinção secrets vs `env()` em config.toml + recomendação dotenvx
- **CFG-04** — dotenvx pattern + `encrypted:` vs `env()` syntax (Pattern 4) — princípio dotenvx + tabela canônica file types (.env.keys/.env.local/.env.production/.env.preview/.env) + workflow canônico 5-step (install → gitignore → set → commit → CLI use) + sintaxe Option A `encrypted:<value>` + Option B `env(VAR_NAME)` + warning canônico `encrypted:` SÓ em designated secret fields + exemplo concreto falso silencioso
- **CFG-05** — 6 grupos de encrypted fields canônicos (Pattern 5) — todos 9 grupos expandidos listados:
  - Grupo 1: Studio (`studio.openai_api_key`)
  - Grupo 2: Database (`db.root_key`, `db.vault.*`)
  - Grupo 3: Auth Core (`auth.publishable_key`, `auth.secret_key`, `auth.jwt_secret`)
  - Grupo 4: Auth Email (`auth.email.smtp.pass`)
  - Grupo 5: Auth Captcha (`auth.captcha.secret`)
  - Grupo 6: Auth Hooks (6 hooks: mfa_verification, password_verification, custom_access_token, send_sms, send_email, before_user_created)
  - Grupo 7: Auth SMS (5 providers: twilio, twilio_verify, messagebird, textlocal, vonage)
  - Grupo 8: Auth External (`auth.external.<provider>.secret` para qualquer OAuth)
  - Grupo 9: Edge Runtime (`edge_runtime.secrets.*`)
  + exemplo TOML completo cobrindo todos os grupos + caveat lista pode evoluir com versões

## Estrutura canônica (pattern v1.26-v1.27)

1. Frontmatter YAML (name + description com trigger phrases)
2. `## Quando usar` — trigger phrases + use APENAS para / NÃO use para
3. `## Princípio canônico` — 3 princípios + distinção `env()` vs `encrypted:`
4. `## Pattern 1: [remotes] block` (CFG-01)
5. `## Pattern 2: Branch-specific overrides` (CFG-02)
6. `## Pattern 3: Secrets per-branch` (CFG-03)
7. `## Pattern 4: dotenvx + encrypted:/env()` (CFG-04)
8. `## Pattern 5: 6 grupos encrypted fields` (CFG-05)
9. `## Anti-patterns` — 6 anti-patterns formato Errado/Por quê/Certo
10. `## Cross-suite integration (v1.27)` — par-conjugado supabase-branching-workflow + skills futuras
11. `## Ver também` — 10 cross-refs (9 skills + glossário + doc oficial)

## Anti-patterns (6 — todos no formato Errado/Por quê/Certo)

1. Usar `encrypted:` em field não-designated (silent no-op + exposição encrypted payload)
2. Assumir secrets herdam entre branches (Edge Function `Deno.env.get` retorna undefined)
3. Commitar `.env.keys` no git (master key — vazou tudo)
4. Confundir `env()` vs `encrypted:` syntax (mistura é syntax inválida)
5. Reusar `project_id` entre `[remotes]` blocks (configs sobrescritas no DAG)
6. Esperar `env()` em config.toml resolver para secrets do projeto (build-time CLI vs runtime Edge Functions)

## Cross-refs

**Skills atuais referenciadas (5):**

- supabase-branching-workflow (v1.27, Phase 149) — pré-requisito conceitual
- supabase-migrations (v1.23)
- supabase-edge-functions
- supabase-auth-ssr
- supabase-custom-claims-rbac (v1.25) — Auth Hooks Grupo 6
- supabase-postgres-roles (v1.26) — `db.root_key`, `db.vault`

**Skills futuras v1.27 referenciadas (3):**

- supabase-ci-cd-github-actions (Phase 151)
- supabase-pgtap-testing (Phase 152)
- supabase-migration-repair (Phase 153)

**Outros:**

- glossário compartilhado (`_shared-supabase/glossary.md`)
- Doc oficial Supabase (4 links: Branching Config, Config Reference, dotenvx, Auth Hooks)

## Decisões canônicas registradas

- **`encrypted:` SÓ em designated secret fields** — repetido em Pattern 4 (warning destacado) + Pattern 5 (princípio) + Anti-pattern 1
- **Secrets NÃO herdam entre branches** — repetido em Princípio canônico + Pattern 3 (caveat destacado) + Anti-pattern 2
- **`.env.keys` SEMPRE gitignored** — Pattern 4 (workflow step 2) + Anti-pattern 3 com recovery procedure
- **`env()` é build-time CLI, NÃO runtime do projeto** — Pattern 3 (tabela distinção) + Anti-pattern 6
- **`project_id` único por `[remotes]` block** — Pattern 1 (caveat) + Anti-pattern 5
- **Pattern Errado/Por quê/Certo** — herdado v1.26 (supabase-postgres-roles)
- **Convenção PT-BR** (v1.22+) — texto PT-BR, code blocks TOML/bash EN com comentários PT-BR

## Validação de acceptance criteria

Todos os critérios das 10 tasks (T1..T10) validados:

- T1: frontmatter YAML válido + name + description com trigger phrases
- T2: seções `Quando usar`, `Princípio canônico` + distinção env()/encrypted: presentes
- T3: Pattern 1 `[remotes]` + exemplo staging + project_id documentado + CLI `branches list`
- T4: Pattern 2 com exemplos TOML para db/api/db.seed/auth.external/edge_runtime + tabela override-able + caveat merge
- T5: Pattern 3 com caveat NÃO herdam + CLI `secrets set` + workflow `link` per-branch
- T6: Pattern 4 com tabela file types + workflow dotenvx + sintaxe Option A/B + warning encrypted: só em designated
- T7: Pattern 5 com todos 6+ grupos canônicos listados (9 grupos expandidos) + exemplo TOML completo
- T8: 6 anti-patterns ≥ 4 com Errado/Por quê/Certo
- T9: Cross-suite integration + Ver também + cross-refs todos presentes + doc oficial 4 links
- T10: ≥ 500 linhas (807), frontmatter --- abre/fecha, todos CFG-01..05 cobertos

## Tamanho final

**807 linhas** (alvo 500-700, mínimo 500) — superou o target devido à exaustividade do Pattern 5 (9 grupos expandidos com tabelas detalhadas) e tabelas comparativas nos Patterns 3-4.
