# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.23 — Reforço RLS Supabase + Handoff Cooperativo SQL (Phases 124–130)

> Gerado: 2026-05-10 | 7 phases | 1 skill + 1 agent + 5 patches + 10 cross-suite handoffs + 5 doc updates | 42 REQs (cobertura 100%)

**Criado:** 2026-05-10 via `/novo-marco v1.23` → roadmapper
**Milestone:** v1.23 (continuação numérica de v1.22 que terminou em Phase 123)
**Phase numbering:** Phase 124 → Phase 130 (7 phases sequenciais)
**Princípio canônico:** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta o outro — verdicts são GO/STRENGTHEN/REWRITE-com-confirmação, nunca BLOCK silencioso.

## Visão geral

v1.23 incorpora 100% da documentação oficial Supabase Row Level Security e introduz **handoff cooperativo SQL** — pattern onde agents externos (multi-tenant, debugger, planner, executor, etc.) planejam/sugerem estrutura SQL via `Task()` e agents Supabase materializam o output final hardenado preservando intent upstream. Resultado: todo SQL gerado pelo kit passa pela trilha de segurança da Suíte Supabase sem desperdiçar tokens de planejamento upstream.

**Contagem pré-v1.23:** 60 agents, 89 commands, 67 skills, 23 audit gates.
**Contagem pós-v1.23 esperada:** **61 agents** (+1: `supabase-rls-hardener`), 89 commands (inalterado), **68 skills** (+1: `supabase-rls-defense-in-depth`), 23 gates (inalterado).

**Distribuição de REQs:** 42 requisitos em 7 categorias (RLS-* / MIGR-* / CMD-* / DEFENSE-* / HARDEN-* / CROSS-* / DOC-*) mapeados 1:1 para 7 phases. Cobertura 42/42 (100%), 0 não-mapeados.

## Fases (7)

### Phase 124: Fundação RLS — Skill `supabase-rls-policies` + `supabase-migrations` patches

**Objetivo:** Incorporar 100% da doc oficial Supabase RLS na skill `supabase-rls-policies` (7 patches editoriais) e atualizar skill `supabase-migrations` com template canônico que inclui GRANT + ALTER ENABLE RLS + indices + 4 policies granulares como bloco obrigatório em CREATE TABLE. Pure content update sem deps.

**Dependências:** Nenhuma (fundação).

**Requisitos cobertos (8):**
- RLS-01 — GRANT SELECT/INSERT/UPDATE/DELETE antes de ENABLE RLS
- RLS-02 — padrão `auth.uid() IS NOT NULL AND auth.uid() = user_id`
- RLS-03 — views `security_invoker=true` (Postgres 15+)
- RLS-04 — `anon` Postgres role vs anonymous Auth user (`is_anonymous` JWT)
- RLS-05 — performance: minimize joins (IN), filtros redundantes client-side, security definer cache via `(select)`
- RLS-06 — `raw_app_meta_data` vs `raw_user_meta_data` + JWT freshness + cookie 4096 bytes
- RLS-07 — defense in depth narrative — RLS como camada vs third-party tooling
- MIGR-01 — template CREATE TABLE com GRANT + RLS + indices + 4 policies granulares

**Critérios de sucesso (4):**
1. `grep "GRANT.*authenticated" kit/skills/supabase-rls-policies/SKILL.md` retorna match documentando GRANT antes de ENABLE RLS (RLS-01 verificável)
2. `grep "IS NOT NULL" kit/skills/supabase-rls-policies/SKILL.md` retorna match com padrão anti silent-fail anônimo (RLS-02 verificável)
3. `grep "security_invoker" kit/skills/supabase-rls-policies/SKILL.md` retorna match documentando views Postgres 15+ (RLS-03 verificável)
4. `kit/skills/supabase-migrations/SKILL.md` exibe bloco template "CREATE TABLE com RLS obrigatório" com GRANT + ALTER ENABLE RLS + CREATE INDEX + 4 policies granulares no exemplo canônico (MIGR-01 verificável via diff vs versão pré-v1.23)

---

### Phase 125: Skill nova `supabase-rls-defense-in-depth` + glossário parcial

**Objetivo:** Criar skill nova `supabase-rls-defense-in-depth` documentando os 5 patterns de defense in depth (event trigger `rls_auto_enable()`, `BYPASSRLS` role privilege, service_role caveat, security definer functions, views `security_invoker=true`). Standalone — não modifica skills existentes. Atualização parcial do glossário compartilhado `_shared-supabase/glossary.md` com termos defense-in-depth/hardener/cooperative-handoff/event-trigger-rls-auto-enable/bypassrls/security_invoker.

**Dependências:** Nenhuma (standalone). Phase 124 não-bloqueante (skills independentes).

**Requisitos cobertos (6):**
- DEFENSE-01 — event trigger `rls_auto_enable()` (CREATE EVENT TRIGGER + função PLpgSQL)
- DEFENSE-02 — `BYPASSRLS` role privilege para tarefas admin
- DEFENSE-03 — service_role caveat (não bypassa RLS do user logged-in via client lib)
- DEFENSE-04 — security definer functions como bypass controlado para policies caras
- DEFENSE-05 — views `security_invoker=true` vs bypass default + revoke em pré-15
- DOC-04 (parcial) — glossário `_shared-supabase/glossary.md` com termos defense-in-depth/hardener/cooperative-handoff/event-trigger-rls-auto-enable/bypassrls/security_invoker

**Critérios de sucesso (4):**
1. Arquivo `kit/skills/supabase-rls-defense-in-depth/SKILL.md` existe com frontmatter v1.0+ válido (description ≤ 1024 chars, name, version)
2. `grep -c "rls_auto_enable\|BYPASSRLS\|service_role caveat\|security definer\|security_invoker" kit/skills/supabase-rls-defense-in-depth/SKILL.md` retorna ≥ 5 matches distintos (DEFENSE-01..05 verificáveis)
3. Glossário compartilhado `kit/skills/_shared-supabase/glossary.md` (criado se não existir) contém entradas PT-BR↔EN para 6 termos novos: defense-in-depth, hardener, cooperative-handoff, event-trigger-rls-auto-enable, bypassrls, security_invoker
4. Skill nova é descobrível via `kit list-skills | grep supabase-rls-defense-in-depth` (sincroniza para `.claude/skills/supabase-rls-defense-in-depth/`)

---

### Phase 126: Agent novo `supabase-rls-hardener` (canonical materializer)

**Objetivo:** Criar agent novo `supabase-rls-hardener` que recebe draft/plano SQL via `Task()` upstream context + intent original e produz SQL final hardenado preservando intent. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação. Invocável cross-suite por agents v1.21/v1.22/framework core. Valida instalação de event trigger `rls_auto_enable` em projetos novos.

**Dependências:** Phase 124 (referencia skill `supabase-rls-policies` patcheada) + Phase 125 (referencia skill `supabase-rls-defense-in-depth`).

**Requisitos cobertos (6):**
- HARDEN-01 — recebe draft/plano SQL via `Task()` + contexto upstream (intent + origem do caller)
- HARDEN-02 — verdict **GO** quando SQL já tem GRANT + RLS + indices + sem anti-patterns
- HARDEN-03 — verdict **STRENGTHEN** com diff explícito do que mudou e por quê
- HARDEN-04 — verdict **REWRITE** apenas com confirmação obrigatória do caller (nunca silenciosa)
- HARDEN-05 — valida instalação de event trigger `rls_auto_enable` em projetos novos e oferece patch se ausente
- HARDEN-06 — invocável cross-suite por agents v1.21/v1.22/framework core via `Task(subagent_type=supabase-rls-hardener)` documentado

**Critérios de sucesso (4):**
1. Arquivo `kit/agents/supabase-rls-hardener.md` existe com frontmatter válido (name, description ≤ 1024 chars, tools incluindo `mcp__supabase__*` opcionais para Phase HARDEN-05)
2. Output do agent documenta 3 verdicts canônicos: bloco "Verdict: GO", "Verdict: STRENGTHEN (diff)", "Verdict: REWRITE (requer confirmação)" — verificável via `grep -c "Verdict:" kit/agents/supabase-rls-hardener.md` retorna ≥ 3
3. Tabela "Cross-suite invocação" no agent lista ≥ 8 agents callers documentados (multi-tenant-rls-writer, audit-log-implementer, crm-pipeline-implementer, org-onboarding-implementer, invite-flow-implementer, super-admin-implementer, evolution-go-integrator, lgpd-compliance-auditor, planner, executor, debugger) com pattern `Task(subagent_type=supabase-rls-hardener)` (HARDEN-06 verificável)
4. Bloco "Auto-enable RLS event trigger validation" documenta query SQL para detectar trigger `rls_auto_enable` ausente + patch SQL para instalar (HARDEN-05 verificável)

---

### Phase 127: Patches agents Supabase existentes (writer + migration-writer + command)

**Objetivo:** Atualizar agents Supabase v1.8 existentes para emitir output hardenado: `supabase-rls-writer` emite GRANTs antes de ENABLE RLS + IS NOT NULL opcional + views security_invoker quando aplicável; `supabase-migration-writer` recebe draft via `Task()` upstream context + auto-chain cooperativo para hardener em CREATE TABLE + devolve SQL + nota de divergências; command `/supabase migration` exige RLS auto-injetada no output via handoff cooperativo.

**Dependências:** Phase 126 (auto-chain cooperativo para hardener referencia agent novo).

**Requisitos cobertos (8):**
- RLS-08 — `supabase-rls-writer` emite GRANTs antes de ENABLE RLS no output
- RLS-09 — `supabase-rls-writer` inclui `IS NOT NULL` check opcional (parametrizável)
- RLS-10 — `supabase-rls-writer` gera views `security_invoker=true` quando pattern aplicável detectado
- MIGR-02 — `supabase-migration-writer` recebe draft/planejamento SQL via `Task()` upstream context + intent original
- MIGR-03 — `supabase-migration-writer` em CREATE TABLE faz auto-chain cooperativo para `supabase-rls-writer` ou `supabase-rls-hardener`
- MIGR-04 — `supabase-migration-writer` devolve SQL hardenado + nota explícita de divergências quando intent upstream conflita
- CMD-01 — Command `/supabase` documentado como serviço de materialização (recebe planejamento, devolve código; nunca bloqueia upstream)
- CMD-02 — Subcomando `/supabase migration "<plano>"` exige RLS auto-injetada no output final (via handoff cooperativo com `supabase-rls-hardener`)

**Critérios de sucesso (5):**
1. `kit/agents/supabase-rls-writer.md` contém bloco "GRANT antes de ENABLE RLS" no template de output canônico — verificável via `grep -A 5 "GRANT.*authenticated" kit/agents/supabase-rls-writer.md` (RLS-08)
2. `kit/agents/supabase-rls-writer.md` documenta parâmetro de input `include_is_not_null_check: bool` (RLS-09 verificável)
3. `kit/agents/supabase-migration-writer.md` exibe seção "Handoff cooperativo upstream" com pattern `Task()` context handoff + auto-chain para hardener em CREATE TABLE — `grep -c "supabase-rls-hardener\|cooperative\|handoff" kit/agents/supabase-migration-writer.md` retorna ≥ 3 (MIGR-02, MIGR-03)
4. `kit/agents/supabase-migration-writer.md` documenta seção "Nota de divergências" obrigatória quando intent upstream conflita com hardening (MIGR-04 verificável)
5. `kit/commands/supabase.md` exibe bloco "Serviço de materialização — nunca bloqueia upstream" + subcomando `migration` documenta auto-injeção RLS via hardener (CMD-01, CMD-02 verificáveis)

---

### Phase 128: Patches cross-suite v1.21 (handoff cooperativo em 8 implementers)

**Objetivo:** Atualizar 8 agents implementers v1.21 (multi-tenant-rls-writer, audit-log-implementer, crm-pipeline-implementer, org-onboarding-implementer, invite-flow-implementer, super-admin-implementer, evolution-go-integrator, lgpd-compliance-auditor) com handoff cooperativo obrigatório — drafts SQL passam via `Task()` para `supabase-rls-hardener` antes de devolver output final. Cada agent ganha bloco "Cooperative handoff" documentando pattern.

**Dependências:** Phase 126 (handoff target) + Phase 127 (chain via supabase-migration-writer também patcheado).

**Requisitos cobertos (8):**
- CROSS-01 — `multi-tenant-rls-writer` com handoff cooperativo para `supabase-rls-hardener`
- CROSS-02 — `audit-log-implementer` com handoff cooperativo
- CROSS-03 — `crm-pipeline-implementer` com handoff cooperativo
- CROSS-04 — `org-onboarding-implementer` com handoff cooperativo
- CROSS-05 — `invite-flow-implementer` com handoff cooperativo
- CROSS-06 — `super-admin-implementer` com handoff cooperativo
- CROSS-07 — `evolution-go-integrator` com handoff cooperativo
- CROSS-08 — `lgpd-compliance-auditor` com handoff cooperativo

**Critérios de sucesso (3):**
1. Cada um dos 8 agents v1.21 alvos contém bloco "Cooperative handoff to supabase-rls-hardener" — verificável via batch grep `grep -l "supabase-rls-hardener" kit/agents/{multi-tenant-rls-writer,audit-log-implementer,crm-pipeline-implementer,org-onboarding-implementer,invite-flow-implementer,super-admin-implementer,evolution-go-integrator,lgpd-compliance-auditor}.md` retorna 8 matches
2. Cada bloco "Cooperative handoff" documenta o pattern `Task(subagent_type=supabase-rls-hardener, prompt=<draft+intent>)` explicitamente (não apenas referência textual)
3. Cada agent preserva intent original via "nota de upstream context" no output — nenhum agent descarta draft silenciosamente; conflitos viram diff explícito

---

### Phase 129: Patches cross-suite v1.22 + framework core (auditor + planner/executor/debugger)

**Objetivo:** Atualizar `auditor-consistencia-isolamento` (v1.22) com check de que migrations recentes passaram pelo `supabase-rls-hardener` (audit field em output) + atualizar framework core (`planner`, `executor`, `debugger`) para detectar SQL no plan/output e fazer handoff cooperativo para Supabase via `Task(subagent_type=supabase-rls-hardener)`.

**Dependências:** Phase 127 (supabase-migration-writer patches) + Phase 128 (cross-suite pattern estabelecido para v1.21; v1.22 + framework herdam mesmo padrão).

**Requisitos cobertos (2):**
- CROSS-09 — `auditor-consistencia-isolamento` (v1.22) valida que migrations recentes passaram pelo `supabase-rls-hardener` (audit field em output)
- CROSS-10 — Agents framework core (`planner` + `executor` + `debugger`) detectam SQL no plan/output e fazem handoff cooperativo para Supabase via `Task(subagent_type=supabase-rls-hardener)`

**Critérios de sucesso (3):**
1. `kit/agents/auditor-consistencia-isolamento.md` exibe campo "hardener_passed: bool" no template de audit output + seção "Validação RLS hardener" documentando o check (CROSS-09 verificável)
2. `kit/agents/planner.md`, `kit/agents/executor.md`, `kit/agents/debugger.md` cada um contém bloco "SQL auto-handoff cooperativo" com regex/heurística de detecção de SQL no plan/output + pattern `Task(subagent_type=supabase-rls-hardener)` para handoff (CROSS-10 verificável)
3. Pattern em framework core não bloqueia execução — detecção de SQL dispara handoff cooperativo mas se hardener responde STRENGTHEN/REWRITE, planner/executor/debugger absorvem o feedback sem aborto silencioso

---

### Phase 130: Release artifacts (AUTOGEN-COUNTS regen + file-manifest + CHANGELOG + glossário finalizado + MILESTONES)

**Objetivo:** Regenerar AUTOGEN-COUNTS no README (60→61 agents, 67→68 skills); regenerar file-manifest.json com novos artefatos; escrever CHANGELOG entry v1.23 documentando 9 entregáveis + princípio handoff cooperativo; finalizar glossário `_shared-supabase/glossary.md` (DOC-04 completo); atualizar MILESTONES.md pós-`/concluir-marco`; atualizar PROJECT.md/STATE.md refletindo v1.23 entregue.

**Dependências:** Todas as phases anteriores (124-129) — release artifacts dependem do conteúdo materializado.

**Requisitos cobertos (5):**
- DOC-01 — README.md AUTOGEN-COUNTS regenerado (60→61 agents, 67→68 skills; commands/gates inalterados)
- DOC-02 — file-manifest.json atualizado com novos artefatos (skill `supabase-rls-defense-in-depth` + agent `supabase-rls-hardener`)
- DOC-03 — CHANGELOG entry v1.23 documentando 9 entregáveis + princípio handoff cooperativo
- DOC-04 (completo) — Glossário `_shared-supabase/glossary.md` finalizado com todos os termos defense-in-depth/hardener/cooperative-handoff/event-trigger-rls-auto-enable/bypassrls/security_invoker (Phase 125 inicia, Phase 130 finaliza/valida)
- DOC-05 — MILESTONES.md atualizado pós-`/concluir-marco`; PROJECT.md/STATE.md refletem v1.23 entregue

**Critérios de sucesso (5):**
1. `grep -E "61 agents|68 skills" README.md` retorna matches no bloco AUTOGEN-COUNTS (DOC-01 verificável)
2. `kit/file-manifest.json` contém entradas SHA256 para `kit/skills/supabase-rls-defense-in-depth/SKILL.md` e `kit/agents/supabase-rls-hardener.md` (DOC-02 verificável via `node scripts/regen-manifest.js && git diff --exit-code kit/file-manifest.json` exit 0)
3. `CHANGELOG.md` contém section `## [v1.23.0] - 2026-05-10` com bullets cobrindo os 9 entregáveis canônicos + princípio handoff cooperativo (DOC-03 verificável)
4. `kit/skills/_shared-supabase/glossary.md` contém os 6 termos novos com entradas PT-BR↔EN completas, cross-refs ativos para skill defense-in-depth e agent hardener (DOC-04 completo)
5. `.planning/MILESTONES.md` ganha section v1.23 com 7-bullet key accomplishments; `.planning/PROJECT.md` move v1.23 para "Milestone Anterior" e introduz v1.24 (Column-Level Security) como próximo; `.planning/STATE.md` atualiza status para "Concluído" (DOC-05 verificável)

---

## Mapeamento REQ → Phase (cobertura 42/42)

| Categoria | REQs | Phase | Total |
|-----------|------|-------|-------|
| RLS-* (skill+writer) | RLS-01, RLS-02, RLS-03, RLS-04, RLS-05, RLS-06, RLS-07 | 124 | 7 |
| RLS-* (writer patches) | RLS-08, RLS-09, RLS-10 | 127 | 3 |
| MIGR-* (skill) | MIGR-01 | 124 | 1 |
| MIGR-* (agent) | MIGR-02, MIGR-03, MIGR-04 | 127 | 3 |
| CMD-* | CMD-01, CMD-02 | 127 | 2 |
| DEFENSE-* | DEFENSE-01, DEFENSE-02, DEFENSE-03, DEFENSE-04, DEFENSE-05 | 125 | 5 |
| HARDEN-* | HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04, HARDEN-05, HARDEN-06 | 126 | 6 |
| CROSS-* (v1.21) | CROSS-01, CROSS-02, CROSS-03, CROSS-04, CROSS-05, CROSS-06, CROSS-07, CROSS-08 | 128 | 8 |
| CROSS-* (v1.22 + core) | CROSS-09, CROSS-10 | 129 | 2 |
| DOC-* (parcial glossário) | DOC-04 (split) | 125 (inicia) | 1 split |
| DOC-* (release) | DOC-01, DOC-02, DOC-03, DOC-04 (finaliza), DOC-05 | 130 | 5 |
| **Total** | — | — | **42/42 mapeados, 0 não-mapeados** |

## Dependências entre phases

```
Phase 124 (skill rls-policies + skill migrations) ──────────┐
                                                            ├──> Phase 126 (agent hardener)
Phase 125 (skill defense-in-depth + glossário parcial) ─────┘            │
                                                                          ▼
                                                                Phase 127 (agents writer + migration-writer + command)
                                                                          │
                                                                          ▼
                                                                Phase 128 (cross-suite v1.21: 8 implementers)
                                                                          │
                                                                          ▼
                                                                Phase 129 (cross-suite v1.22 + framework core)
                                                                          │
                                                                          ▼
                                                                Phase 130 (release: AUTOGEN + manifest + CHANGELOG + MILESTONES)
```

**Caminho crítico:** 124 → 126 → 127 → 128 → 129 → 130 (6 fases sequenciais; Phase 125 paralelo ao 124).

**Paralelização possível:** Phase 124 e Phase 125 são independentes (skills standalone) — podem rodar em paralelo. Phases 128 e 129 podem ter overlap se 127 estiver completo (cross-suite patches são editoriais sem deps mútuas).

## Princípio de execução

Todas as 7 phases são **content-only** (zero alterações em `src/core/`). Stable API v1.0+ preservada. CI permanece verde sem ajustes em test suite (testes regex existentes em audit gates v1.13/v1.15/v1.20 são suficientes — não há gate novo em v1.23).

Cada phase produz commits atômicos seguindo a convenção do framework (`feat(REQ): descrição`, `docs(REQ): descrição`, etc.) com Co-Authored-By preservado.

## Próximo passo

```
/planejar-fase 124  (Skill supabase-rls-policies + supabase-migrations patches)
```

Ou para autonomous execution sequencial:

```
/autonomo  (executa 124→130 sem intervenção; recomendado dado content-only)
```

---
*Roadmap gerado: 2026-05-10 via `/novo-marco v1.23` → roadmapper*
*Cobertura: 42/42 REQs mapeados (100%), 0 não-mapeados*
*Phase numbering: 124..130 (continuação de v1.22 que terminou em 123)*
