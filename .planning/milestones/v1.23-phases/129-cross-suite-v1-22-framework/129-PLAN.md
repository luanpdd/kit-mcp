# Plano: Fase 129 — Patches cross-suite v1.22 + framework core

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** CROSS-09, CROSS-10 (2 REQs)

## Objetivo

Atualizar `auditor-consistencia-isolamento` (v1.22) com Detector 7 (valida migrations passaram pelo hardener) + atualizar `planner`/`executor`/`debugger` (framework core) com SQL auto-handoff cooperativo via Task().

## Tarefas

### Onda 1 — auditor-consistencia-isolamento (CROSS-09)

1. Adicionar section "Validação de RLS hardener cooperativo (v1.23 — CROSS-09)" após "Observabilidade integrada"
2. Definir "Detector 7 — Migration sem hardener cooperativo" com query bash de detecção
3. Documentar output enriquecido com field `hardener_passed: bool`
4. Adicionar `supabase-rls-hardener` + `supabase-rls-defense-in-depth` em "Ver também"

### Onda 2 — framework core (CROSS-10)

1. **planner.md** — adicionar `<sql_auto_handoff_cooperativo>` section após `<success_criteria>` com:
   - Heurística regex de detecção de SQL
   - Injeção automática de tarefa final no PLAN.md
   - Pattern Python pseudo-code Task() hardener

2. **executor.md** — adicionar `<sql_auto_handoff_cooperativo>` section após `<completion_format>` com:
   - Invocação ANTES de aplicar SQL
   - Processamento de verdict (GO direto, STRENGTHEN aplica diff, REWRITE pausa+confirmação)
   - Registro em SUMMARY.md "## RLS Hardener Trace"

3. **debugger.md** — adicionar `<sql_auto_handoff_cooperativo>` section após `<success_criteria>` com:
   - Heurística de hipótese mention (RLS, policy, auth.uid, etc.)
   - Validação de fix proposto ANTES de aplicar
   - Evidence adicionada no DEBUG.md com verdict + diff

## Arquivos modificados

- `kit/agents/auditor-consistencia-isolamento.md` — 2 patches (Detector 7 + "Ver também")
- `kit/agents/planner.md` — 1 section nova
- `kit/agents/executor.md` — 1 section nova
- `kit/agents/debugger.md` — 1 section nova

## Validação

```bash
# CROSS-09: auditor v1.22 com hardener trace validation
grep -c "hardener_passed\|Detector 7\|supabase-rls-hardener" kit/agents/auditor-consistencia-isolamento.md
# Esperado: ≥ 3

# CROSS-10: framework core agents com SQL auto-handoff
grep -l "sql_auto_handoff_cooperativo\|supabase-rls-hardener" kit/agents/{planner,executor,debugger}.md
# Esperado: 3 files

# Heurística regex documentada em todos
grep -c "regex.*create.*table\|create.*policy" kit/agents/{planner,executor,debugger}.md
# Esperado: ≥ 1 cada
```

## Riscos

- **Risco baixo:** Patches aditivos. Framework core agents preservam estrutura XML-like.
- **Mitigação:** Section delimitada com tag `<sql_auto_handoff_cooperativo>` (não conflita com estrutura existente).
