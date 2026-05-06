# ROADMAP — kit-mcp v1.8

**Milestone:** v1.8 — Suíte Supabase
**Numeração de fases:** continua de v1.7 (terminou em fase 24) → v1.8 começa em **Fase 25**
**Total de REQs cobertos:** 31 (SB-S01..S11 + SB-D01 + SB-A00..A07 + SB-C01..C02 + SB-G01..G05 + SB-V01..V04)
**Total de fases:** 4 (Fases 25-28)
**Criado:** 2026-05-06

---

## Visão geral do milestone

Adicionar uma camada completa de expertise Supabase ao kit (11 skills + 7 agents + 1 command + 5 audit gates) para que consumidores do `@luanpdd/kit-mcp` tenham apoio canônico ao construir/manter backends Supabase — Postgres/DB, Auth, Realtime, Edge Functions, RLS, Migrations, Storage, pgvector/RAG, Cron+Queues. v1.8 é **content-only por design** — zero alterações em `src/core/`, registry, sync ou MCP server runtime. Stable API v1.0+ preservada. Material-fonte: 7 guias oficiais Supabase fornecidos pelo user + 4 dimensões de pesquisa em `.planning/research/`.

---

## Phase 25: Fundamentos — 11 skills Supabase + glossário compartilhado

**Tipo:** Conteúdo editorial — escrita de skills canônicas (Markdown puro)
**Por que primeiro:** Skills são consultáveis standalone e referenciadas pelos agents da Phase 26 via Markdown link relativo. Fixar antes evita links mortos e revisão dupla. Sem dependências.

**REQs cobertos:** SB-S01, SB-S02, SB-S03, SB-S04, SB-S05, SB-S06, SB-S07, SB-S08, SB-S09, SB-S10, SB-S11, SB-D01 (12 REQs)

**Critérios de sucesso:**
1. As 11 skills existem em `kit/skills/supabase-*/SKILL.md` com frontmatter válido (`name`, `description ≤ 200 chars`)
2. Glossário em `kit/skills/_shared-supabase/glossary.md` documenta termos PT-BR ↔ EN; NÃO listado como skill em `listKit`
3. Cada SKILL.md é **auto-contida** — LLM consegue gerar workflow completo sem ler outra skill (cross-refs apenas em "Ver também" no fim)
4. Skills críticas contêm strings obrigatórias (validável via gate na Phase 28):
   - `supabase-rls-policies` inclui `(select auth.uid())` e `WARNING user_metadata`
   - `supabase-database-functions` inclui `set search_path = ''`
   - `supabase-auth-ssr` inclui `getAll`, `setAll`, `NEVER use auth-helpers`
   - `supabase-realtime` inclui `broadcast`, `private: true`, e migração de `postgres_changes`
   - `supabase-edge-functions` inclui `npm:`, `jsr:`, `Deno.serve`
5. `kit sync claude-code --project-root <tmpdir>` rodado 2× consecutivos produz `.claude/skills/supabase-*` byte-idêntico (idempotência — anti-pitfall A1)
6. CLAUDE.md gerado cresce ≤ +1.5 KB após Phase 25 (description budget enforcement — anti-pitfall A2)

**Anti-pitfalls cobertos:** A1 (drift kit/↔.claude/ — sync idempotente), A2 (CLAUDE.md size — description ≤ 200 chars), A3 (skills auto-contidas), A8 (full body em targets `single`-mode), A11 (idioma misto — glossário canônico), B4 (RLS sem `(select)` — REGRA #1 absoluta), B5 (`user_metadata` em RLS — WARNING absoluto + privilege escalation explicado), B7 (`SECURITY DEFINER` sem `search_path = ''` — REGRA absoluta)

**Estimativa:** ~12-16h. Cada skill ~1-1.5h em média; pgvector-rag e cron-queues podem precisar de pesquisa adicional durante /planejar-fase.

---

## Phase 26: 7 agents Supabase + convenção universal

**Tipo:** Conteúdo editorial — escrita de agents (Markdown com frontmatter complexo + lógica de prompt)
**Por que segundo:** Com skills da Phase 25 no lugar, agents podem cross-referenciar via Markdown link sem dead-end. Agents fazem o trabalho ativo; skills são a base de conhecimento que eles consultam.

**Dependência:** Phase 25 concluída (links Markdown apontam para skills).

**REQs cobertos:** SB-A00, SB-A01, SB-A02, SB-A03, SB-A04, SB-A05, SB-A06, SB-A07 (8 REQs)

**Critérios de sucesso:**
1. Os 7 agents existem em `kit/agents/supabase-*.md` com frontmatter válido (`name`, `description ≤ 200 chars`, `tools` listando NOMES CANÔNICOS `mcp__supabase__*` — zero UUIDs)
2. Cada agent inclui no topo (convenção SB-A00): tabela "Compatibilidade" por IDE, preflight detection MCP no Step 0 (declara MODO OFFLINE explicitamente se MCP indisponível — anti-pitfall A4), detecção de layout no boot, output em layout canônico do CLI Supabase
3. Zero `Task(subagent_type=supabase-...)` em qualquer agent Supabase — orquestração só via `/supabase` command na Phase 27 (anti-pitfall A10)
4. `supabase-rls-writer` ABORTA explicitamente se detecta `user_metadata` em policy de autorização (anti-pitfall B5)
5. `supabase-realtime-implementer` sempre gera código com `useEffect return` ou equivalente para `removeChannel` (anti-pitfall B1)
6. `supabase-auth-bootstrapper` audita `.env*` files para `NEXT_PUBLIC_*SERVICE*` (anti-pitfall B6) + scaffolda single serverClient factory (anti-pitfall B13)
7. `supabase-architect` NÃO escreve código — apenas projeta schema + RLS + topologia realtime; delega execução para outros agents
8. Smoke test: invocar cada agent em fixture sintético (Claude Code, com Supabase MCP) — produz output coerente

**Anti-pitfalls cobertos:** A4 (preflight MCP + modo offline explícito — NUNCA finge sucesso), A5 (overlap com `schema-checker` — contrato disjunto: checker valida SQL existente, architect projeta antes), A6 (schema-check é step interno do `migration-writer`, NÃO hook — funciona cross-IDE), A10 (zero recursive dispatch entre agents Supabase), A12 (zero UUIDs hardcoded — todos `mcp__supabase__*`), B1 (Realtime cleanup obrigatório), B6 (audit `.env*` para service_role leak), B13 (single serverClient factory — não múltiplos clients em layouts)

**Estimativa:** ~10-12h. Architect e migration-writer são os mais complexos (pesquisa adicional durante /planejar-fase para storage-implementer).

---

## Phase 27: Command `/supabase` orquestrador único

**Tipo:** Conteúdo editorial — escrita de command com dispatch via `Task`
**Por que terceiro:** Command faz dispatch via `Task(subagent_type=...)` para os 7 agents da Phase 26. Sem agents prontos, command não tem o que invocar.

**Dependência:** Phase 26 concluída (agents existentes para dispatch).

**REQs cobertos:** SB-C01, SB-C02 (2 REQs)

**Critérios de sucesso:**
1. `kit/commands/supabase.md` existe com frontmatter válido (`name`, `description ≤ 200 chars`, `argument-hint`, `allowed-tools` inclui `Task` e `AskUserQuestion`)
2. Aceita 9+ subcomandos com sinônimos PT-BR/EN: `arquiteto|architect`, `migration|migrar`, `rls`, `edge`, `realtime`, `auth`, `storage`, `rag`, `cron`, `check`
3. Cada subcomando dispatch via `Task(subagent_type=supabase-...)` para o agent correto. Subcomando `check` invoca `schema-checker` existente (anti-pitfall A5)
4. Detecta `supabase/config.toml` para passar `project_id` como contexto opcional aos agents
5. É o ÚNICO ponto de chain de agents Supabase — agents da Phase 26 permanecem função pura (anti-pitfall A10 — orquestração centralizada)
6. `supabase arquiteto` (subcomando architect) pergunta upfront "Free ou Pro?" — gera GitHub Action de heartbeat se Free (anti-pitfall B2 — Free tier pause após 7 dias inativos)
7. `supabase arquiteto` alerta sobre custo de preview branches abertas + gera workflow de cleanup automático ao merge (anti-pitfall B8 — branch billing fora do Spend Cap)
8. Smoke test: cada subcomando invocado em fixture produz dispatch correto

**Anti-pitfalls cobertos:** A10 (orquestração centralizada — único ponto de chain), A5 (subcomando `check` invoca `schema-checker` quando user precisa validar SQL existente; `arquiteto` quando precisa designar antes), B2 (Free tier heartbeat), B8 (branch billing alert + cleanup workflow)

**Estimativa:** ~3-4h. Padrão maduro com precedente direto em `/fluxos-trabalho` + `/depurar` + `/fazer`.

---

## Phase 28: Validação cross-IDE + 5 audit gates + cleanup

**Tipo:** Validação E2E + scripts de gate JS puro + cleanup oportunístico
**Por que último:** Cross-IDE smoke + cleanup do `schema-checker.md` UUID + audit gates são "verificação", não construção. Rodam contra o produto montado nas Phases 25-27.

**Dependência:** Phases 25, 26, 27 concluídas (gates auditam todo conteúdo Supabase + smoke testa fluxo E2E).

**REQs cobertos:** SB-G01, SB-G02, SB-G03, SB-G04, SB-G05, SB-V01, SB-V02, SB-V03, SB-V04 (9 REQs)

**Critérios de sucesso:**
1. **5 audit gates** existem em `gates/` e rodam verde no CI (zero deps novas; JS puro; ~50-100 LOC cada):
   - `budget-description.mjs` — `description ≤ 200 chars` em todo agent/command/skill (anti-pitfall A2)
   - `no-personal-uuid.mjs` — zero UUIDs `[0-9a-f]{8}-[0-9a-f]{4}-...` em frontmatter `tools:` ou body (anti-pitfall A12)
   - `agent-no-recursive-dispatch.mjs` — zero `Task(subagent_type=supabase-...)` em `kit/agents/supabase-*.md` (anti-pitfall A10)
   - `skill-must-include.mjs` — strings obrigatórias por skill (mapping em `gates/lib/supabase-must-include.json` — anti-pitfall A7)
   - `sync-idempotent.mjs` — `kit sync claude-code` rodado 2× = byte-idêntico (anti-pitfall A1)
2. Sync para 8 IDE targets (claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae) — cada um produz arquivos esperados em layout nativo sem erros (SB-V01)
3. Smoke real em ≥4 IDEs (Claude Code + Cursor + Codex + Gemini) invocando `supabase-rls-writer` em projeto teste — verificação manual de coerência (live mode em Claude Code/Cursor com MCP; offline mode nos demais — SB-V02)
4. **Migrar `kit/agents/schema-checker.md`** de `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql`/`__list_tables` para `mcp__supabase__execute_sql`/`__list_tables` (SB-V03 — anti-pitfall A12)
5. CHANGELOG.md tem seção `## [1.8.0]` documentando: Suíte Supabase (11 skills, 7 agents, command `/supabase`), 5 audit gates novos, schema-checker UUID migration, breaking interno (SB-V04)
6. STATE.md, MILESTONES.md atualizados; PR/branch ready para cut
7. `wc -c CLAUDE.md` ≤ 12.5 KB total após v1.8 (anti-pitfall A2 — CLAUDE.md inflation budget)
8. `gates/deps-budget.mjs` continua verde (6/6 — zero deps novas em v1.8 — anti-pitfall A9)

**Anti-pitfalls cobertos:** A1 (`sync-idempotent.mjs`), A2 (`budget-description.mjs` + CLAUDE.md ≤ 12.5 KB), A7 (`skill-must-include.mjs`), A9 (`deps-budget.mjs` permanece verde — zero deps novas), A12 (`no-personal-uuid.mjs` + cleanup `schema-checker.md`), B3 (smoke real em branch Supabase com workflow `pull → edit → diff → review → apply` — manual, pre-release)

**Estimativa:** ~6-8h. Gates são curtos mas precisam de testes; smoke cross-IDE é tempo de setup × 4 IDEs.

---

## Sequenciamento e ship strategy

| Patch | Fase | REQs | Cumulativo |
|---|---|---|---|
| 1.8.0 | 25 (Skills + glossário) | 12 | 12/31 |
| 1.8.0 | 26 (Agents) | 8 | 20/31 |
| 1.8.0 | 27 (Command `/supabase`) | 2 | 22/31 |
| 1.8.0 | 28 (Gates + validação + cleanup) | 9 | 31/31 |

**Ship strategy:** Todas as 4 fases sob v1.8.0 (single minor bump). Cada fase é commit atômico com testes verde, mas release é único após Phase 28 concluir.

**Por que não shippar fase a fase:**
- v1.8 é content-only — sem tags intermediárias agrega valor (skills sem agents = expertise sem worker; agents sem command = workers sem entry point).
- Phase 28 valida cross-IDE — sem ela, suíte pode quebrar silenciosamente em IDEs sem MCP.

---

## Rastreabilidade

| Phase | REQ | Local | Validação |
|---|---|---|---|
| 25 | SB-S01 | `kit/skills/supabase-realtime/SKILL.md` | gate `skill-must-include` (broadcast, private:true, migration de postgres_changes) |
| 25 | SB-S02 | `kit/skills/supabase-auth-ssr/SKILL.md` | gate `skill-must-include` (getAll, setAll, NEVER auth-helpers) |
| 25 | SB-S03 | `kit/skills/supabase-edge-functions/SKILL.md` | gate `skill-must-include` (npm:, jsr:, Deno.serve) |
| 25 | SB-S04 | `kit/skills/supabase-declarative-schema/SKILL.md` | gate `skill-must-include` (supabase stop, db diff -f, caveats) |
| 25 | SB-S05 | `kit/skills/supabase-rls-policies/SKILL.md` | gate `skill-must-include` ((select auth.uid()), WARNING user_metadata) |
| 25 | SB-S06 | `kit/skills/supabase-database-functions/SKILL.md` | gate `skill-must-include` (set search_path = '', SECURITY INVOKER) |
| 25 | SB-S07 | `kit/skills/supabase-migrations/SKILL.md` | gate `skill-must-include` (YYYYMMDDHHmmss, RLS obrigatório) |
| 25 | SB-S08 | `kit/skills/supabase-postgres-style/SKILL.md` | gate `skill-must-include` (snake_case, ISO 8601) |
| 25 | SB-S09 | `kit/skills/supabase-storage/SKILL.md` | gate `skill-must-include` (signed URL, RLS storage.objects, multi-tenant path) |
| 25 | SB-S10 | `kit/skills/supabase-pgvector-rag/SKILL.md` | gate `skill-must-include` (HNSW, IVFFlat, <=>, RAG with permissions) |
| 25 | SB-S11 | `kit/skills/supabase-cron-queues/SKILL.md` | gate `skill-must-include` (pg_cron, pgmq, pg_net, cron→pgmq→Edge) |
| 25 | SB-D01 | `kit/skills/_shared-supabase/glossary.md` | exists; NÃO listado em listKit |
| 26 | SB-A00 | Convenção universal (todos `kit/agents/supabase-*.md`) | grep "Compatibilidade", "MODO OFFLINE", "mcp__supabase__" em cada |
| 26 | SB-A01 | `kit/agents/supabase-architect.md` | smoke: produz schema + RLS plan; NÃO escreve código |
| 26 | SB-A02 | `kit/agents/supabase-migration-writer.md` | smoke: gera migration com RLS + style guide |
| 26 | SB-A03 | `kit/agents/supabase-rls-writer.md` | smoke: ABORTA quando policy referencia user_metadata |
| 26 | SB-A04 | `kit/agents/supabase-edge-fn-writer.md` | smoke: gera Edge Function com npm:/jsr: + env vars |
| 26 | SB-A05 | `kit/agents/supabase-realtime-implementer.md` | smoke: gera channel com cleanup obrigatório |
| 26 | SB-A06 | `kit/agents/supabase-auth-bootstrapper.md` | smoke: bootstrap Next.js + audita .env* |
| 26 | SB-A07 | `kit/agents/supabase-storage-implementer.md` | smoke: configura bucket + RLS + signed URLs |
| 27 | SB-C01 | `kit/commands/supabase.md` | frontmatter + 9+ subcomandos com sinônimos |
| 27 | SB-C02 | `kit/commands/supabase.md` body | grep `Task(subagent_type=supabase-...)` para cada subcomando |
| 28 | SB-G01 | `gates/budget-description.mjs` | CI run verde |
| 28 | SB-G02 | `gates/no-personal-uuid.mjs` | CI run verde |
| 28 | SB-G03 | `gates/agent-no-recursive-dispatch.mjs` | CI run verde |
| 28 | SB-G04 | `gates/skill-must-include.mjs` + `gates/lib/supabase-must-include.json` | CI run verde |
| 28 | SB-G05 | `gates/sync-idempotent.mjs` | CI run verde |
| 28 | SB-V01 | sync 8 IDE targets | smoke sem erros em cada |
| 28 | SB-V02 | smoke ≥4 IDEs reais | manual verification |
| 28 | SB-V03 | `kit/agents/schema-checker.md` migrado | grep `mcp__supabase__` (sem UUID) |
| 28 | SB-V04 | CHANGELOG.md, STATE.md, MILESTONES.md | seção `## [1.8.0]` documenta tudo |

**Cobertura:** 31/31 (100%).

---

## Pitfalls antecipados

1. **Phase 25 — drift kit/ ↔ .claude/** (anti-pitfall A1): primeiro milestone com 12+ items adicionados de uma vez. Mitigação: gate `sync-idempotent.mjs` na Phase 28 + regra "rodar sync após cada edit em skill".
2. **Phase 25 — CLAUDE.md inflation** (anti-pitfall A2): cluster `supabase-*` adiciona 19+ entradas. Mitigação: description budget 200 chars enforced via gate; cluster alfabético natural agrupa sem categoria custom.
3. **Phase 25 — skills com cross-references quebrando stub-only mode** (anti-pitfall A8): v1.7 introduziu sync stubs-only que perde body. Mitigação: skills `supabase-*` em modo `full` para targets `single` (CLAUDE.md/AGENTS.md/etc com tudo inline).
4. **Phase 26 — agents fingem sucesso sem MCP** (anti-pitfall A4): preflight check no Step 0 + declaração explícita "MODO OFFLINE" no output.
5. **Phase 26 — UUID pessoal em frontmatter** (anti-pitfall A12): gate `no-personal-uuid.mjs` na Phase 28 detecta + tabela canônica de tools `mcp__supabase__*` em toda doc.
6. **Phase 26 — recursive dispatch entre agents** (anti-pitfall A10): gate `agent-no-recursive-dispatch.mjs` na Phase 28; regra documentada na convenção SB-A00.
7. **Phase 27 — overlap entre `/supabase check` e agent `schema-checker`**: contrato de input/output disjunto documentado — `check` valida SQL existente; `arquiteto` projeta antes.
8. **Phase 28 — schema-checker UUID migration**: breaking interno (qualquer instalador anterior tinha UUID que não funcionava — agora funciona). Documentar no CHANGELOG como fix.
9. **Phase 28 — smoke cross-IDE em IDEs sem MCP**: agents devem operar em modo offline (gerar SQL/código para aplicação manual) sem fingir sucesso. Validação manual obrigatória pre-release.

---

## Decisões arquiteturais (de `.planning/research/ARCHITECTURE.md`)

1. **Estrutura de skills:** flat `kit/skills/supabase-*/SKILL.md` (não subárvore — quebraria `readSkillsDir`)
2. **Tools dos agents:** MCP-first com fallback offline gracioso; nomes canônicos `mcp__supabase__*`
3. **Comando `/supabase`:** único command com 9+ subcomandos (espelha `/fluxos-trabalho` para roteamento + `/depurar` para Task dispatch)
4. **Cross-references:** Markdown link relativo (não `@-include` — quebraria lazy-load)
5. **Output dos agents:** layouts canônicos Supabase (`supabase/migrations/`, `supabase/schemas/`, `supabase/functions/<name>/`)
6. **Naming:** flat `supabase-*` cross-cutting prefix (estabelece precedent para futuras suítes `stripe-*`, `vercel-*`)
7. **Sync targets sem MCP:** tabela "Compatibilidade" no topo de cada skill/agent (honestidade explícita; nunca bloqueia)
8. **CLAUDE.md generation:** NÃO modificar `buildAggregatedRules` — cluster alfabético natural agrupa os 19+ `supabase-*`. v1.8 fica content-only por princípio.
