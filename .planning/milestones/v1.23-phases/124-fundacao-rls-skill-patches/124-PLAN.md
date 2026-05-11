# Plano: Fase 124 — Fundação RLS (Skill patches)

**Criado:** 2026-05-10
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** RLS-01, RLS-02, RLS-03, RLS-04, RLS-05, RLS-06, RLS-07, MIGR-01 (8 REQs)

## Objetivo

Incorporar 100% da documentação oficial Supabase RLS em `kit/skills/supabase-rls-policies/SKILL.md` (7 patches editoriais) e atualizar `kit/skills/supabase-migrations/SKILL.md` com template canônico de 5 blocos obrigatórios para CREATE TABLE.

## Tarefas

### Onda 1 — Patch supabase-rls-policies (paralelo, RLS-01..RLS-07)

1. **RLS-07** (defense in depth narrative) — adicionar seção "Defense in depth — RLS como camada (v1.23)" no topo, antes de "Regras absolutas"
2. **RLS-01** (GRANTs antes de ENABLE RLS) — adicionar regra absoluta + seção "Setup canônico — GRANTs + ENABLE RLS" com exemplo completo
3. **RLS-02** (IS NOT NULL anti silent-fail) — adicionar REGRA #3 + atualizar todos os patterns canônicos para incluir IS NOT NULL
4. **RLS-03** (views security_invoker=true) — adicionar seção dedicada "Views com `security_invoker=true` (Postgres 15+)" + anti-pattern #6
5. **RLS-04** (anon role vs anonymous Auth user) — adicionar seção "`anon` Postgres role vs anonymous Auth user (v1.23)"
6. **RLS-05** (performance recommendations) — adicionar seção "Performance — recomendações canônicas (v1.23)" com 6 recommendations
7. **RLS-06** (`app_metadata` vs `user_metadata` caveats) — adicionar seção "`app_metadata` vs `user_metadata` — caveats canônicos (v1.23)" com 3 caveats (JWT freshness, cookie 4096, NULL handling)

### Onda 2 — Patch supabase-migrations (MIGR-01)

1. **MIGR-01** (template 5 blocos obrigatórios) — atualizar frontmatter description + adicionar seção "Template canônico v1.23 — CREATE TABLE com 5 blocos obrigatórios" + atualizar example "Criar tabela com RLS" para usar os 5 blocos

## Arquivos modificados

- `kit/skills/supabase-rls-policies/SKILL.md` — reescrito completo (185 → 401 linhas, +116%)
- `kit/skills/supabase-migrations/SKILL.md` — frontmatter expandido + 2 seções editadas (Regras + Template + Pattern)

## Validação

- `grep -c "GRANT.*authenticated\|IS NOT NULL\|security_invoker\|raw_app_meta_data\|defense in depth" kit/skills/supabase-rls-policies/SKILL.md` ≥ 5 matches distintos
- `grep -A 2 "BLOCO 1: CREATE TABLE\|BLOCO 2: GRANTs\|BLOCO 3: ENABLE RLS\|BLOCO 4: 4 policies\|BLOCO 5: Index" kit/skills/supabase-migrations/SKILL.md` retorna os 5 blocos canônicos

## Riscos

- **Risco baixo:** Conteúdo aditivo + reformat. Skills existentes preservam estrutura — leitores antigos encontram conteúdo familiar + novidades documentadas com tag (v1.23).
- **Mitigação:** Cross-refs ativos para skill nova `supabase-rls-defense-in-depth` (Phase 125) garantem que conteúdo expandido em v1.23 tem onde respirar.
