# Fase 150: Skill nova `supabase-config-toml-remotes` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar skill canônica nova `supabase-config-toml-remotes` em `kit/skills/supabase-config-toml-remotes/SKILL.md` cobrindo:
- `[remotes.<name>]` block referencing existing `project_id` (obtido via `supabase --experimental branches list`)
- Branch-specific configuration overrides (db.pool_size, api.max_rows, db.seed.sql_paths, auth.external.*, edge_runtime.secrets)
- Secret management per-branch (secrets NÃO herdam entre branches; `supabase secrets set --env-file`)
- dotenvx pattern (.env.keys decryption + .env.preview encrypted; `encrypted:` vs `env()` syntax)
- 6 grupos de encrypted fields canônicos (Studio, Database, Auth Core/Email/Captcha/Hooks/SMS/External, Edge Runtime)

Entregar 5 REQs: CFG-01..05 da REQUIREMENTS.md.

Conteúdo PT-BR. Code blocks TOML/bash EN com comentários PT-BR. Material-fonte: doc oficial Supabase Configuration (Branching).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado por configuração. Pattern canônico v1.26 (supabase-postgres-roles) como referência estrutural. Conteúdo derivado 100% da doc oficial fornecida no /novo-marco.

</decisions>

<code_context>
## Insights do Código Existente

Skills cross-ref:
- supabase-branching-workflow (Phase 149) — pré-requisito conceitual
- supabase-migrations — secrets em migrations
- supabase-edge-functions — env vars em Edge Functions
- supabase-auth-ssr — auth secrets

</code_context>

<specifics>
## Ideias Específicas

- Listar **todos os 6 grupos** de encrypted fields da doc oficial (não resumir)
- Warning: `encrypted:` só funciona em "designated secret fields"; uso em outros fields silenciosamente falha
- dotenvx é opcional mas elegante — apresentar como recomendação avançada
- Secret per-branch é caveat sutil — não herdam silenciosamente

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
