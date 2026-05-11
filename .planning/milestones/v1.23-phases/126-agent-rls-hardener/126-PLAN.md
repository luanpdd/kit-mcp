# Plano: Fase 126 — Agent novo `supabase-rls-hardener`

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04, HARDEN-05, HARDEN-06 (6 REQs)

## Objetivo

Criar agent canônico `kit/agents/supabase-rls-hardener.md` que recebe draft SQL via `Task()` upstream context + intent original e produz SQL final hardenado preservando intent. Base para handoff cooperativo em Phases 127-129.

## Tarefas

1. **HARDEN-01 (input format)** — frontmatter + seção "Inputs esperados" documentando `<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>` blocks
2. **HARDEN-02 (verdict GO)** — example "Verdict: GO — exemplo" mostrando draft já hardened passa direto
3. **HARDEN-03 (verdict STRENGTHEN)** — example com diff explícito mostrando ajustes mantendo intent
4. **HARDEN-04 (verdict REWRITE)** — example com confirmação obrigatória quando user_facing_caller=true; nunca silenciosa
5. **HARDEN-05 (event trigger validation)** — seção dedicada com query de detecção via `mcp__supabase__execute_sql` + patch SQL se trigger ausente
6. **HARDEN-06 (cross-suite invocação)** — tabela documentando 12 callers (8 v1.21 + 1 v1.22 + 3 framework core) com pattern `Task(subagent_type=supabase-rls-hardener, ...)`

## Arquivos criados

- `kit/agents/supabase-rls-hardener.md` — agent canonical (332 linhas)

## Validação

- `ls kit/agents/supabase-rls-hardener.md` retorna match
- `grep -c "Verdict:" kit/agents/supabase-rls-hardener.md` ≥ 4 (header + 3 verdicts canônicos)
- `grep -c "Task(subagent_type=supabase-rls-hardener" kit/agents/supabase-rls-hardener.md` ≥ 1 (pattern documentado)
- Tabela "Cross-suite invocação" lista 12 agents callers
- Seção "HARDEN-05" documenta query SQL `pg_event_trigger where evtname='ensure_rls'` + patch

## Riscos

- **Risco médio:** Agent novo é "canonical handoff target" — se contrato muda, todas as Phase 128/129 patches precisam ajustar
- **Mitigação:** Contrato versionado em frontmatter; input format estruturado (XML-like blocks) é estável; verdicts construtivos preservam intent
