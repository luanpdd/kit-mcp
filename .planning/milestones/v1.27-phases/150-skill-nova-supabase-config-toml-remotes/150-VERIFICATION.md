---
phase: 150
status: passed
verified_at: 2026-05-11
verifier: autonomous-mode
---

# Verification: Phase 150 — Skill nova `supabase-config-toml-remotes`

## Status: PASSED

## Goal-backward check

**Objetivo da fase:** Criar skill canônica `supabase-config-toml-remotes` cobrindo CFG-01..05.

## must_haves verificados (12/12)

| # | must_have | Verificação | Status |
|---|-----------|-------------|--------|
| 1 | Frontmatter YAML válido com name=supabase-config-toml-remotes | `grep -q "^name: supabase-config-toml-remotes$"` | PASS |
| 2 | Seção "Quando usar" com trigger phrases | trigger phrases (remotes/branch-specific/secrets/dotenvx/encrypted) presentes | PASS |
| 3 | Seção "Princípio canônico" (3 princípios + distinção env/encrypted) | seção presente com 3 princípios + tabela comparativa | PASS |
| 4 | CFG-01: Pattern 1 `[remotes.<name>]` + project_id via `branches list` | Pattern 1 com workflow 3-step + exemplos TOML staging/production | PASS |
| 5 | CFG-02: Pattern 2 branch-specific overrides | Pattern 2 com 7 categorias canônicas + tabela override-able | PASS |
| 6 | CFG-03: Pattern 3 secrets per-branch + caveat NÃO herdam | Pattern 3 com caveat destacado + workflow `link` per-branch | PASS |
| 7 | CFG-04: Pattern 4 dotenvx + encrypted:/env() syntax | Pattern 4 com tabela file types + workflow 5-step + warning canônico | PASS |
| 8 | CFG-05: Pattern 5 6 grupos encrypted fields listados completamente | Pattern 5 com 9 grupos expandidos + exemplo TOML completo | PASS |
| 9 | ≥ 4 anti-patterns Errado/Por quê/Certo | 6 anti-patterns documentados | PASS |
| 10 | Cross-suite integration (v1.27) | seção presente linkando supabase-branching-workflow + skills futuras | PASS |
| 11 | Ver também com cross-refs canônicos | 10 cross-refs (9 skills + glossário + doc oficial 4 links) | PASS |
| 12 | Tamanho mínimo 500 linhas | 807 linhas | PASS |

## REQs cobertos (5/5)

- CFG-01: `[remotes.<name>]` block + project_id via `--experimental branches list` (Pattern 1)
- CFG-02: Branch-specific overrides (db, api, db.seed, auth.external.*, auth.email.smtp, auth.sms, edge_runtime.secrets) (Pattern 2)
- CFG-03: Secrets per-branch + caveat NÃO herdam (Pattern 3)
- CFG-04: dotenvx pattern + `encrypted:` vs `env()` syntax + warning designated fields (Pattern 4)
- CFG-05: 6 grupos canônicos (Studio + Database + Auth Core/Email/Captcha/Hooks/SMS/External + Edge Runtime) — 9 grupos expandidos listados (Pattern 5)

## Encrypted fields validados (Pattern 5)

Todos os fields canônicos da doc oficial cobertos:

- Studio: `studio.openai_api_key`
- Database: `db.root_key`, `db.vault.*`
- Auth Core: `auth.publishable_key`, `auth.secret_key`, `auth.jwt_secret`
- Auth Email: `auth.email.smtp.pass`
- Auth Captcha: `auth.captcha.secret`
- Auth Hooks (6): `auth.hook.mfa_verification_attempt.secrets`, `auth.hook.password_verification_attempt.secrets`, `auth.hook.custom_access_token.secrets`, `auth.hook.send_sms.secrets`, `auth.hook.send_email.secrets`, `auth.hook.before_user_created.secrets`
- Auth SMS (5): `auth.sms.twilio.auth_token`, `auth.sms.twilio_verify.auth_token`, `auth.sms.messagebird.access_key`, `auth.sms.textlocal.api_key`, `auth.sms.vonage.api_secret`
- Auth External: `auth.external.<provider>.secret`
- Edge Runtime: `edge_runtime.secrets.*`

## Anti-patterns validados (6)

1. Usar `encrypted:` em field não-designated
2. Assumir secrets herdam entre branches
3. Commitar `.env.keys` no git
4. Confundir `env()` vs `encrypted:` syntax
5. Reusar `project_id` entre `[remotes]` blocks
6. Esperar `env()` em config.toml resolver para secrets do projeto

## Artefatos

- `kit/skills/supabase-config-toml-remotes/SKILL.md` (807 linhas)
- `.planning/phases/150-skill-nova-supabase-config-toml-remotes/150-01-skill-config-toml-remotes-PLAN.md`
- `.planning/phases/150-skill-nova-supabase-config-toml-remotes/150-SUMMARY.md`

## Próximo

Phase 151 — Skill `supabase-ci-cd-github-actions` (8 workflows GitHub Actions)
