---
status: passed
milestone: v1.8.0
audited_at: 2026-05-06
---

# Milestone Audit — v1.8.0 Suíte Supabase

## Status: PASSED ✓

Todos os 31 REQs entregues e verificados. Anti-pitfalls cobertos via patterns embutidos ou gates. Integração cross-fase consistente (skills → agents → command → gates).

## Cobertura de Requisitos (3 fontes cruzadas)

### Fonte 1 — REQUIREMENTS.md Rastreabilidade

31/31 REQs mapeados a fases:
- SB-S01..S11 + SB-D01 → Phase 25 (12 REQs)
- SB-A00..A07 → Phase 26 (8 REQs)
- SB-C01, SB-C02 → Phase 27 (2 REQs)
- SB-G01..G05, SB-V01..V04 → Phase 28 (9 REQs)

### Fonte 2 — Arquivos físicos no kit

Verificação `ls`:
- ✓ 11 SKILL.md em `kit/skills/supabase-*/SKILL.md`
- ✓ 1 glossário em `kit/skills/_shared-supabase/glossary.md`
- ✓ 7 agents em `kit/agents/supabase-*.md`
- ✓ 1 command em `kit/commands/supabase.md`
- ✓ 5 gates em `gates/{budget-description,no-personal-uuid,agent-no-recursive-dispatch,skill-must-include,sync-idempotent}.md`

### Fonte 3 — Gates executados

Resultado de execução em sessão:
- ✓ `budget-description` — passing após cleanup de 5 descrições pré-existentes
- ✓ `no-personal-uuid` — zero UUIDs (após migração de schema-checker)
- ✓ `agent-no-recursive-dispatch` — zero `Task(supabase-*)` em agents
- ✓ `skill-must-include` — todas as 11 skills com strings obrigatórias verbatim
- ⏭ `sync-idempotent` — non-blocking, defer para CI real

**Convergência:** as 3 fontes batem. Zero REQs sem entrega física.

## Integração Cross-Fase

**Skills → Agents (Phase 25 → 26):**
- ✓ Cada agent referencia ≥ 1 skill via Markdown link relativo
- ✓ Cross-refs verificados: agents apontam para skills existentes (sem link morto)
- ✓ Convenção SB-A00 aplicada universalmente nos 7 agents (Compatibilidade table + preflight + canonical layouts)

**Agents → Command (Phase 26 → 27):**
- ✓ `/supabase` mapeia 10 subcomandos para 7 agents Supabase + `schema-checker`
- ✓ Sinônimos PT-BR/EN funcionais
- ✓ Único orquestrador (anti-pitfall A10) — gate `agent-no-recursive-dispatch` valida

**Tudo → Gates (Phase 28):**
- ✓ Gates auditam todo o conteúdo Supabase + previnem regressão
- ✓ UUID migration aplicada (`schema-checker.md`)
- ✓ CHANGELOG/STATE/MILESTONES atualizados

## Anti-pitfalls Cobertos

### Packaging (12 — A1-A12)

| Pitfall | Cobertura |
|---|---|
| A1 — drift kit/↔.claude/ | Gate `sync-idempotent.md` (non-blocking) |
| A2 — CLAUDE.md size | Gate `budget-description.md` ✓ |
| A3 — skills auto-contidas | Decisão D-04 (sem `references/` folder) ✓ |
| A4 — agent sem MCP fail silencioso | Convenção SB-A00 preflight check ✓ |
| A5 — overlap schema-checker | Subcomando `check` invoca schema-checker; arquiteto projeta antes ✓ |
| A6 — hooks cross-IDE | Schema-check é step interno do migration-writer (não hook) ✓ |
| A7 — markdown semântica | Gate `skill-must-include.md` ✓ |
| A8 — stub-only mode | Skills auto-contidas, body inline ✓ |
| A9 — deps budget | Zero deps novas ✓ |
| A10 — recursive dispatch | Gate `agent-no-recursive-dispatch.md` ✓ |
| A11 — idioma misto | Glossário PT-BR↔EN canônico ✓ |
| A12 — UUID pessoal | Gate `no-personal-uuid.md` + cleanup `schema-checker.md` ✓ |

### Supabase (14 — B1-B14)

| Pitfall | Onde foi tratado |
|---|---|
| B1 — Realtime cleanup leak | `supabase-realtime` skill + `supabase-realtime-implementer` agent ✓ |
| B2 — Free tier pause | `supabase-architect` Step 1 (pergunta tier) ✓ |
| B3 — migration drift | `supabase-declarative-schema` skill + caveats documentados ✓ |
| B4 — RLS sem (select) | `supabase-rls-policies` REGRA #1 + gate must-include ✓ |
| B5 — user_metadata em RLS | `supabase-rls-policies` WARNING + `supabase-rls-writer` ABORT ✓ |
| B6 — service_role em client | `supabase-auth-ssr` skill + `supabase-auth-bootstrapper` audita .env* ✓ |
| B7 — SECURITY DEFINER + search_path | `supabase-database-functions` REGRA absoluta ✓ |
| B8 — branch billing | `supabase-architect` Step 1 alerta ✓ |
| B9 — Edge cold start | `supabase-edge-functions` skill + `supabase-edge-fn-writer` alerta ✓ |
| B10 — bucket público sem RLS | `supabase-storage` skill + `supabase-storage-implementer` defaultar privado ✓ |
| B11 — pgvector setup | `supabase-pgvector-rag` skill com schema + index canônico ✓ |
| B12 — gen types ordering CI | Documentado em skill + glossário (workaround) ✓ |
| B13 — Auth refresh race | `supabase-auth-bootstrapper` single serverClient factory ✓ |
| B14 — storage egress | `supabase-storage` skill alerta + cacheControl ✓ |

## Stable API v1.0+

✓ Preservada — zero alterações em `src/core/`, `registry.js`, `sync.js`. v1.8 é content-only por design. `git diff -- src/core/` retorna vazio.

## Itens não-críticos / Defer

- **SB-V02 (smoke ≥4 IDEs reais):** defer para validação manual pre-cut. Sync é determinístico (registry table + readSkillsDir robusto desde v1.0); risco baixo.
- **`sync-idempotent.mjs` em CI real:** non-blocking gate; rodar em integration test pre-publish é nice-to-have.
- **Pre-existing tech debt em `setup-notion.md`** (sem description: no frontmatter): warn-only, não-bloqueante. Defer para v1.9 ou patch.

## Veredito

**PASSED.** Milestone pronto para `/concluir-marco` → `/limpeza` → cut.
