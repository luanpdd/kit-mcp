# Plano: Fase 127 — Patches Supabase agents existentes

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** RLS-08, RLS-09, RLS-10, MIGR-02, MIGR-03, MIGR-04, CMD-01, CMD-02 (8 REQs)

## Objetivo

Atualizar agents `supabase-rls-writer` (3 patches), `supabase-migration-writer` (3 patches), command `/supabase` (2 patches) — total 8 REQs.

## Tarefas

### Onda 1 — supabase-rls-writer.md (RLS-08, RLS-09, RLS-10)

1. **RLS-08** — frontmatter description expandida; tools adiciona Task; section "Por que existe" preserva ABORT user_metadata; section "Inputs esperados" adiciona `include_is_not_null_check`, `generate_view`, `upstream_intent` (v1.23)
2. **RLS-09** — Template per-user reescrito com 3 blocos (GRANTs, ENABLE RLS, 4 policies com IS NOT NULL) + nota de opt-out
3. **RLS-10** — Template view com `security_invoker=true` (Postgres 15+) + fallback pré-15 (revoke ou schema privado)
4. **Cooperative handoff section** — documenta como callers externos invocam este agent + Task() pseudo-code para handoff back ao hardener

### Onda 2 — supabase-migration-writer.md (MIGR-02, MIGR-03, MIGR-04)

1. **MIGR-02** — frontmatter + tools adiciona Task; section "Inputs esperados" adiciona `upstream_intent` com 3 blocos XML-like (alinhado com hardener Phase 126)
2. **Step 3 reescrito** — template canônico v1.23 com 5 blocos obrigatórios (BLOCO 1..5)
3. **Step 3.5 (MIGR-03)** — auto-chain cooperativo: invoca `supabase-rls-hardener` via Task() em CREATE TABLE; processa verdict GO/STRENGTHEN/REWRITE
4. **Step 7 (MIGR-04)** — Nota de divergências do draft upstream com template de output

### Onda 3 — kit/commands/supabase.md (CMD-01, CMD-02)

1. **CMD-01** — frontmatter description expandida; <objective> reescrito para "serviço de materialização (v1.23) que recebe planejamento e devolve código hardenado pronto; nunca bloqueia upstream"
2. **CMD-02** — Tabela de subcomandos: row `migration` ganha nota "auto-chain cooperativo com hardener em CREATE TABLE"; row novo `hardener` para dispatch direto
3. **Section "Serviço de materialização"** — pattern Python para outros agents invocarem o command
4. **Subcomando `migration` documentação** — explica que após writer produz SQL, agent invoca hardener automaticamente

## Arquivos modificados

- `kit/agents/supabase-rls-writer.md` — 4 patches editoriais
- `kit/agents/supabase-migration-writer.md` — 4 patches editoriais
- `kit/commands/supabase.md` — 4 patches editoriais

## Validação

- `grep -c "GRANT.*authenticated\|include_is_not_null_check\|security_invoker.*true\|upstream_intent" kit/agents/supabase-rls-writer.md` ≥ 4
- `grep -c "supabase-rls-hardener\|BLOCO [1-5]\|Nota de divergências" kit/agents/supabase-migration-writer.md` ≥ 5
- `grep -c "Serviço de materialização\|hardener\|materializ" kit/commands/supabase.md` ≥ 3

## Riscos

- **Risco baixo:** Patches aditivos. Estruturas existentes preservadas; comportamento default mantido (RLS-09 IS NOT NULL adicionado mas opt-out via parâmetro).
- **Mitigação:** Tags `(v1.23)` deixam claro o que é novo; cross-refs ativos garantem reading path coerente.
