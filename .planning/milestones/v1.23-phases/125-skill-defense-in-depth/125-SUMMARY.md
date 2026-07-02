# SUMMARY — Phase 125: Defense in Depth Skill + Glossário Parcial

**Concluído:** 2026-05-11
**Status:** ✅ Completed
**REQs entregues:** 6/6 (DEFENSE-01..DEFENSE-05, DOC-04 parcial)
**Commits:** 1 atomic

## O que foi feito

Criada skill nova `kit/skills/supabase-rls-defense-in-depth/SKILL.md` (411 linhas) documentando 5 patterns canônicos de defense in depth para RLS Supabase, derivada 100% da documentação oficial. Adicionados 6 termos novos ao glossário compartilhado `kit/skills/_shared-supabase/glossary.md` para suportar cross-refs das próximas phases.

## Mudanças por REQ

| REQ | Mudança | Verificação |
|-----|---------|-------------|
| DEFENSE-01 | Seção "DEFENSE-01: Event trigger `rls_auto_enable()` como default" com função PLpgSQL + caveats + auditoria query | `grep -A 30 "rls_auto_enable\(\)" kit/skills/supabase-rls-defense-in-depth/SKILL.md` retorna função completa |
| DEFENSE-02 | Seção "DEFENSE-02: `BYPASSRLS` role privilege para tarefas admin" + tabela comparativa service_role vs custom role | `grep -c "BYPASSRLS\|bypassrls" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 4 |
| DEFENSE-03 | Seção "DEFENSE-03: `service_role` caveat" + código TypeScript Edge Function com admin client + user client separados | `grep -c "persistSession: false\|service_role caveat" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 2 |
| DEFENSE-04 | Seção "DEFENSE-04: `SECURITY DEFINER` functions" com 4 regras absolutas + example concreto + padrão policy | `grep -c "SECURITY DEFINER\|security definer" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 5 |
| DEFENSE-05 | Seção "DEFENSE-05: Views com `security_invoker=true`" + Postgres 15+ + fallback pré-15 + auditoria query | `grep -c "security_invoker = true\|security_invoker=true" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 2 |
| DOC-04 (parcial) | 6 termos novos no glossário `_shared-supabase/glossary.md` (defense-in-depth, hardener, cooperative-handoff, event-trigger-rls-auto-enable, bypassrls, security_invoker) | `grep -c "(v1\.23)" kit/skills/_shared-supabase/glossary.md` ≥ 6 |

## Métricas

- **Skill nova criada**: `kit/skills/supabase-rls-defense-in-depth/SKILL.md` (411 linhas)
- **Glossário expandido**: +6 termos na seção "Authorization e Auth" (com tag `(v1.23)`)
- **Camadas de defense-in-depth documentadas**: 6 camadas (policy + auto-enable + GRANT + bypass controlado + security_invoker + service_role caveat)
- **Auditoria queries SQL**: 2 queries para detectar gaps (tabelas sem RLS + views sem security_invoker)
- **Checklist final**: 7 items para validação em produção

## Counts atualizados

- Skills antes de Phase 125: 67 → após: 68 (+1: `supabase-rls-defense-in-depth`)
- Agents/commands/gates: inalterados

## Próxima fase

Phase 126: Agent novo `supabase-rls-hardener` — usa esta skill como conhecimento base para aplicar verdicts GO/STRENGTHEN/REWRITE-com-confirmação em drafts SQL upstream.
