# SUMMARY — Phase 127: Patches Supabase agents existentes

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 8/8 (RLS-08, RLS-09, RLS-10, MIGR-02, MIGR-03, MIGR-04, CMD-01, CMD-02)
**Commits:** 1 atomic

## O que foi feito

Aplicados 12 patches editoriais em 3 artefatos da Suíte Supabase v1.8 existentes (`supabase-rls-writer`, `supabase-migration-writer`, `/supabase` command). Agents recebem draft upstream via `Task()` (handoff cooperativo), emitem GRANTs antes de ENABLE RLS, incluem IS NOT NULL opcional, geram views com `security_invoker=true`, fazem auto-chain cooperativo para `supabase-rls-hardener` em CREATE TABLE, e devolvem nota de divergências quando intent upstream conflita com hardening obrigatório.

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| RLS-08 | `supabase-rls-writer` template per-user reescrito com BLOCO 1 GRANTs antes de ENABLE RLS | `grep -c "BLOCO 1.*GRANT\|grant select on" kit/agents/supabase-rls-writer.md` ≥ 2 |
| RLS-09 | `supabase-rls-writer` input `include_is_not_null_check` (default true) + IS NOT NULL em todos templates per-user | `grep -c "is_not_null\|IS NOT NULL\|include_is_not_null_check" kit/agents/supabase-rls-writer.md` ≥ 3 |
| RLS-10 | `supabase-rls-writer` Template view com `security_invoker=true` (Postgres 15+) + fallback pré-15 | `grep -c "security_invoker.*true\|generate_view" kit/agents/supabase-rls-writer.md` ≥ 2 |
| MIGR-02 | `supabase-migration-writer` aceita `upstream_intent` no input via Task() handoff cooperativo | `grep -c "upstream_intent" kit/agents/supabase-migration-writer.md` ≥ 2 |
| MIGR-03 | `supabase-migration-writer` Step 3.5 auto-chain para `supabase-rls-hardener` em CREATE TABLE | `grep -c "supabase-rls-hardener\|Task(subagent_type=\"supabase-rls-hardener\"" kit/agents/supabase-migration-writer.md` ≥ 2 |
| MIGR-04 | `supabase-migration-writer` Step 7 Nota de divergências do draft upstream | `grep -c "Nota de divergências\|divergência" kit/agents/supabase-migration-writer.md` ≥ 2 |
| CMD-01 | `/supabase` <objective> + frontmatter: "Serviço de materialização (v1.23) — nunca bloqueia upstream" | `grep -c "Serviço de materialização\|nunca bloqueia\|materializ" kit/commands/supabase.md` ≥ 3 |
| CMD-02 | `/supabase migration` documenta auto-chain cooperativo; subcomando novo `hardener` | `grep -c "auto-chain cooperativo\|hardener.*subcomando\|hardener.*dispatch" kit/commands/supabase.md` ≥ 2 |

## Métricas

- **Arquivos modificados**: 3 (`supabase-rls-writer.md`, `supabase-migration-writer.md`, `supabase.md`)
- **Patches editoriais aplicados**: 12 (4 por arquivo)
- **Estrutura preservada**: 100% (frontmatter, sections, anti-patterns; novidades v1.23 marcadas)
- **Cross-refs adicionados**: 5+ para skills/agents v1.23 (rls-policies, defense-in-depth, hardener)
- **Pattern Task() pseudo-code documentado**: 3 instances (1 por arquivo)

## Counts atualizados

- Agents/commands/skills/gates: **inalterados** (patches editoriais em artefatos existentes)
- Subcomando novo `hardener` no `/supabase` command — não conta como novo command separado

## Próxima fase

Phase 128: Patches cross-suite v1.21 — 8 agents implementers ganham handoff cooperativo para `supabase-rls-hardener` ou `supabase-migration-writer` via `Task()`.
