---
phase: 127
status: passed
verified_at: 2026-05-11
must_haves_total: 8
must_haves_verified: 8
must_haves_unverified: 0
---

# VERIFICATION — Phase 127: Patches Supabase agents existentes

## Status: ✅ PASSED (8/8 must-haves verificados)

## Must-haves

### RLS-08: `supabase-rls-writer` emite GRANTs antes de ENABLE RLS no output gerado

✅ Verificado.

Evidência: template "Template per-user (v1.23 — com GRANTs + IS NOT NULL)" reescrito com 3 blocos: BLOCO 1 (GRANTs) → BLOCO 2 (ENABLE RLS) → BLOCO 3 (4 policies granulares). Frontmatter description expandida para "GRANTs antes de ENABLE RLS (v1.23)".

### RLS-09: `supabase-rls-writer` inclui `IS NOT NULL` check opcional no output (parametrizável)

✅ Verificado.

Evidência: section "Inputs esperados" adiciona `include_is_not_null_check` (default `true` em v1.23+). Template per-user mostra padrão `(select auth.uid()) is not null and (select auth.uid()) = user_id` em todas as 4 policies. Nota explícita: "IS NOT NULL é opcional via input `include_is_not_null_check`. Default `true`. Caller pode opt-out se intent é `null = user_id → false silenciosamente` (raro, mas legítimo)."

### RLS-10: `supabase-rls-writer` gera views com `security_invoker=true` quando aplicável

✅ Verificado.

Evidência: section "Template view com `security_invoker=true` (RLS-10, v1.23)" — gera view com flag para Postgres 15+ ou fallback (revoke acesso de roles expostos, ou mover para schema privado) em pré-15. Input opcional `generate_view: true` ou detecção via `access_pattern` mencionando "view"/"materialized view".

### MIGR-02: `supabase-migration-writer` recebe draft via `Task()` upstream context + intent original

✅ Verificado.

Evidência: tools adiciona `Task` no frontmatter; section "Inputs esperados" adiciona bloco `upstream_intent` com 3 elements XML-like (`<upstream_intent>`, `<draft_sql>`, `<user_facing_caller>`). Nota: "Quando `upstream_intent` está presente, preserve intent original e devolva SQL hardenado + nota de divergências (se houver). NUNCA descarte draft upstream silenciosamente."

### MIGR-03: `supabase-migration-writer` em CREATE TABLE auto-chain cooperativo para hardener

✅ Verificado.

Evidência: Step 3.5 dedicado "Auto-chain cooperativo para `supabase-rls-hardener` (v1.23 — MIGR-03)" com pattern Python pseudo-code:
```python
hardener_result = Task(
  subagent_type="supabase-rls-hardener",
  prompt=f"<upstream_intent>... <draft_sql>... <user_facing_caller>..."
)
# Process verdict: GO | STRENGTHEN | REWRITE
```

### MIGR-04: `supabase-migration-writer` devolve SQL hardenado + nota de divergências

✅ Verificado.

Evidência: Step 7 dedicado "Nota de divergências (v1.23 — MIGR-04)" com template de output bem-definido. Output mostra exemplo concreto com caller (multi-tenant-rls-writer) enviando draft com `for all to authenticated`, sem GRANTs, sem IS NOT NULL → migration final ajusta + documenta divergência + confirma intent preservado.

### CMD-01: Command `/supabase` documentado como serviço de materialização

✅ Verificado.

Evidência: frontmatter description expandida para "serviço de materialização (v1.23) que recebe planejamento/draft SQL de qualquer agent ou user e devolve código hardenado pronto. NUNCA bloqueia upstream — handoff cooperativo via Task()". `<objective>` reescrito com Princípio canônico v1.23 explícito.

### CMD-02: Subcomando `/supabase migration "<plano>"` exige RLS auto-injetada no output final

✅ Verificado.

Evidência: tabela de subcomandos: row `migration` documenta "v1.23: auto-chain cooperativo com hardener em CREATE TABLE"; row novo `hardener` para dispatch direto ao `supabase-rls-hardener`. Section "Subcomando `migration` (v1.23 — CMD-02)" explica: "após `supabase-migration-writer` produzir SQL inicial, o agent AUTOMATICAMENTE invoca `supabase-rls-hardener` via Task() para validar defense-in-depth em CREATE TABLE. Output final inclui verdict + RLS auto-injetada. Caller NÃO precisa invocar hardener separadamente — é parte do contrato do subcomando."

## Verificação automatizada (grep checks)

Todos os grep checks dos success criteria do ROADMAP Phase 127 passam:

```bash
# RLS-08, RLS-09, RLS-10 — supabase-rls-writer
grep -c "GRANT.*authenticated\|grant select.*authenticated\|grant select.*service_role\|IS NOT NULL\|is not null\|security_invoker.*true\|include_is_not_null_check\|generate_view\|upstream_intent" kit/agents/supabase-rls-writer.md
# Esperado: ≥ 10 (encontrado: múltiplos matches distintos)

# MIGR-02, MIGR-03, MIGR-04 — supabase-migration-writer
grep -c "supabase-rls-hardener\|BLOCO [1-5]\|Nota de divergências\|upstream_intent\|cooperative" kit/agents/supabase-migration-writer.md
# Esperado: ≥ 10 (encontrado)

# CMD-01, CMD-02 — /supabase command
grep -c "Serviço de materialização\|hardener\|auto-chain cooperativo\|materializ\|nunca bloqueia" kit/commands/supabase.md
# Esperado: ≥ 5 (encontrado)
```

## Cobertura

8/8 must-haves verificados (100%). Sem human-verification pendente. Sem gaps.

## Notas

- Patches aditivos: comportamento default v1.23 preservado para callers existentes (IS NOT NULL adicionado mas opt-out via parâmetro)
- Subcomando novo `hardener` no `/supabase` é dispatch direto — não muda agent count (61 mantido)
- Cross-refs ativos garantem reading path Phase 124 → 125 → 126 → 127
- Phase 128 vai usar este pattern em 8 agents v1.21 cross-suite
