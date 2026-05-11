# Plano: Fase 125 — Skill `supabase-rls-defense-in-depth` + glossário parcial

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** DEFENSE-01, DEFENSE-02, DEFENSE-03, DEFENSE-04, DEFENSE-05, DOC-04 (parcial — 6 termos novos no glossário; finalização cross-ref ativos em Phase 130) — 6 REQs

## Objetivo

Criar skill `kit/skills/supabase-rls-defense-in-depth/SKILL.md` documentando 5 patterns canônicos de defense in depth + adicionar 6 termos novos ao glossário compartilhado `kit/skills/_shared-supabase/glossary.md`.

## Tarefas

### Onda 1 — Skill nova (paralelo, DEFENSE-01..DEFENSE-05)

1. **Criar dir + frontmatter** — `kit/skills/supabase-rls-defense-in-depth/SKILL.md` com `name` + `description` + trigger phrases
2. **DEFENSE-01** (event trigger `rls_auto_enable`) — função PLpgSQL + event trigger + caveats + auditoria query
3. **DEFENSE-02** (BYPASSRLS role privilege) — criação de custom role + comparativa com service_role
4. **DEFENSE-03** (service_role caveat) — admin client vs user client em Edge Functions (código TypeScript)
5. **DEFENSE-04** (SECURITY DEFINER functions) — regras absolutas + example schema `private` + padrão de uso em policy
6. **DEFENSE-05** (views security_invoker) — Postgres 15+ syntax + fallback pré-15 + auditoria query

### Onda 2 — Glossário compartilhado (DOC-04 parcial)

1. **Adicionar 6 termos** na seção "Authorization e Auth" do glossário:
   - defense-in-depth
   - hardener
   - cooperative-handoff
   - event-trigger-rls-auto-enable
   - bypassrls
   - security_invoker

Finalização do DOC-04 (cross-refs ativos para artefatos materializados) será em Phase 130.

## Arquivos criados/modificados

- `kit/skills/supabase-rls-defense-in-depth/SKILL.md` — criado (411 linhas)
- `kit/skills/_shared-supabase/glossary.md` — expandido com 6 termos na seção Authorization e Auth

## Validação

- `ls kit/skills/supabase-rls-defense-in-depth/SKILL.md` retorna match
- `grep -c "rls_auto_enable\|BYPASSRLS\|service_role caveat\|security definer\|security_invoker" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 5
- `grep -c "defense-in-depth\|hardener\|cooperative-handoff\|event-trigger-rls-auto-enable\|bypassrls\|security_invoker" kit/skills/_shared-supabase/glossary.md` ≥ 6

## Riscos

- **Risco baixo:** Skill nova standalone + adições ao glossário. Conteúdo aditivo, sem breaking changes.
- **Mitigação:** Cross-refs ativos para supabase-rls-policies (Phase 124) e supabase-migrations (Phase 124) garantem coherent reading path.
