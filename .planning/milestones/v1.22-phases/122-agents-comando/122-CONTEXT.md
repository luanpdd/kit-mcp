# Fase 122: Agents de Auditoria + Comando `/dados-distribuidos` — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

3 agents especializados + 1 comando orquestrador da Suíte DDIA Foundations v1.22:

1. **`auditor-consistencia-isolamento`** — agent que escaneia migrations + RPCs + Edge Functions e detecta os 6 anti-patterns canônicos de race condition (lost update via SELECT-then-UPDATE sem `FOR UPDATE`, write skew via trigger sem materializar predicate, clock skew via `now()`/`clock_timestamp()` em expiração, race em UNIQUE check em nível de app, write cross-tenant sem lock, handler sem idempotência). Produz `AUDITORIA-CONSISTENCIA.md` priorizado P0/P1/P2 com findings linkados a `arquivo:linha` + sugestão de fix referenciando skill canônica.

2. **`detector-tenant-quente`** — agent que consulta logs Supabase via `mcp__supabase__execute_sql` (queries dos últimos 30 dias agrupadas por `org_id`), identifica outliers usando thresholds da skill TENANT (>3× P50 = WARN, >10× P50 = CRITICAL) e produz `AUDITORIA-TENANT-QUENTE.md` com top 5 tenants quentes + métricas (queries/min, storage GB, conexões) + estratégia de mitigação sugerida (cross-ref ATIVO para skill `tenant-quente-mitigacao`).

3. **`validador-evolucao-schema`** — agent que recebe SQL de migration via stdin/argument, detecta 4 breaks canônicos de schema evolution (NOT NULL adicionado em coluna existente, column dropped, type narrowed `varchar(255)→varchar(50)`, default mudado em coluna em uso). Produz veredito GO/NO-GO/NEEDS-REVIEW com sugestão de migration segura (3-step) quando NO-GO. Invocável standalone OU automaticamente por `supabase-migration-writer` (v1.8) via cross-suite handoff.

4. **`/dados-distribuidos`** — comando orquestrador único da Suíte DDIA Foundations v1.22. Recebe um subcomando + args, faz dispatch via `Task(subagent_type=<ddia-agent>)` para o agent especializado correto. 4 subcomandos canônicos (`auditar-consistencia`, `auditar-tenant-quente`, `validar-evolucao-schema`, `implementar-cdc`) com sinônimos PT/EN. É o **único ponto de chain de agents da Suíte DDIA Foundations** — agents permanecem função pura (anti-pitfall A10 v1.8 herdado).

REQs cobertos: SUITE-01, SUITE-02, AGENTE-01..06 = 8 REQs total.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via `workflow.skip_discuss=true`. Decisões guiadas por:
- Pattern do `kit/agents/multi-tenant-isolation-auditor.md` (v1.21) como template estrutural canônico para agents de auditoria — frontmatter PT-BR, "Por que existe", "Inputs esperados", "Passos" numerados com SQL/grep real, "Anti-patterns prevenidos", "Quando NÃO invocar", "Ver também" com cross-refs ATIVOS.
- Pattern do `kit/agents/toil-auditor.md` (v1.10) como template estrutural para agent de análise/detecção (`detector-tenant-quente`) — Step 0 Preflight, Step 1 Scan, Step 2 Classify, Step 3 Prioritize, Step 4 Quantify, Step 5 Write report.
- Pattern do `kit/agents/schema-checker.md` (v1.8) como template estrutural para agent validador (`validador-evolucao-schema`) — recebe SQL via input, devolve veredito GO/NO-GO/NEEDS-REVIEW com reasoning estruturado.
- Pattern do `kit/commands/multi-tenant.md` (v1.21) como template estrutural para comando orquestrador — frontmatter `allowed-tools` + `argument-hint`, seções `<objective>`, `<execution_context>`, `<context>`, `<process>`, `<success_criteria>`, tabela de subcomandos com sinônimos, dispatch via `Task(subagent_type=...)`.

### Decisões cristalizadas pela pesquisa (vinculantes)

**Agent `auditor-consistencia-isolamento`:**
- 6 detectores numerados, cada um com: padrão detectado (SQL exemplo), heurística de detecção (grep/regex pattern), severidade (P0 ou P1), fix sugerido referenciando skill canônica via Markdown link relativo.
- Severidades canônicas: P0 = vulnerabilidade explorável em concorrência alta (lost update, clock skew em auth, race em UNIQUE app-level); P1 = vulnerabilidade em condições específicas (write skew, write cross-tenant, duplicate processing).
- Output `AUDITORIA-CONSISTENCIA.md` no diretório invocado (default `.planning/AUDITORIA-CONSISTENCIA.md`) com sumário (severidade × count × skill referenciada) + findings detalhados (`F-NN [Pn] descrição`) com `arquivo:linha` + fix actionable.
- Cross-suite: detecta problema mas NÃO escreve fix — delega para `supabase-migration-writer` (v1.8) ou `supabase-edge-fn-writer` (v1.8) via Task() handoff. Pattern v1.21 herdado.

**Agent `detector-tenant-quente`:**
- 3 métricas canônicas via SQL real: (1) queries/min via `pg_stat_statements` agrupado por extracção de `org_id` da query (`application_name` ou parâmetro), (2) storage GB via `pg_total_relation_size` somado por `org_id` (assume tabelas com coluna `org_id`), (3) conexões ativas via `pg_stat_activity` agrupado por `application_name` que carrega `tenant_id`.
- Thresholds canônicos da skill `tenant-quente-mitigacao`: WARN ≥ 3× P50 do conjunto de tenants, CRITICAL ≥ 10× P50.
- Output `AUDITORIA-TENANT-QUENTE.md` com sumário (tenants ativos, P50/P99 baseline) + top 5 tenants quentes (`org_id`, métricas, threshold cruzado, estratégia sugerida da skill).
- Modo offline-fallback: se MCP Supabase indisponível, agent declara modo offline e pula coleta de métricas live (entrega checklist baseado apenas em sinais estáticos como tabelas grandes em migrations).

**Agent `validador-evolucao-schema`:**
- 4 detectores de breaks canônicos com regex/AST pattern:
  - **NOT NULL added em coluna existente:** regex `ALTER TABLE.*ALTER COLUMN.*SET NOT NULL` em coluna que NÃO tem `ADD COLUMN` no mesmo arquivo.
  - **Column dropped:** regex `ALTER TABLE.*DROP COLUMN`.
  - **Type narrowed:** regex `ALTER TABLE.*ALTER COLUMN.*TYPE` com tipo destino menor (varchar(N) → varchar(M) onde M < N) ou tipos incompatíveis (text → varchar com limite).
  - **Default changed em coluna em uso:** regex `ALTER TABLE.*ALTER COLUMN.*SET DEFAULT` em coluna que já existe (NÃO recém-criada no mesmo arquivo).
- Veredito canônico: GO (zero breaks), NEEDS-REVIEW (warnings sem mitigação clara), NO-GO (≥1 break crítico). Quando NO-GO, agent retorna 3-step migration safe sugerida (ADD nullable → backfill → SET NOT NULL etc.) com SQL real.
- Cross-suite: invocável standalone via Task() OU automaticamente por `supabase-migration-writer` (v1.8) ANTES de escrever migration — handoff bidirecional documentado.

**Comando `/dados-distribuidos`:**
- 4 subcomandos canônicos:
  - `auditar-consistencia` (sinônimos: `consistencia`, `audit-consistency`) → dispatch `auditor-consistencia-isolamento`
  - `auditar-tenant-quente` (sinônimos: `tenant-quente`, `hot-tenant`, `audit-tenant`) → dispatch `detector-tenant-quente`
  - `validar-evolucao-schema` (sinônimos: `validar-schema`, `validate-schema`, `evolution-check`) → dispatch `validador-evolucao-schema`
  - `implementar-cdc` (sinônimos: `cdc`, `cdc-pipeline`, `streams`) → carrega skill `streams-eventos-cdc` + delega para `supabase-edge-fn-writer` (v1.8) via Task() handoff
- Sinônimos globais para o comando: `dados-distribuidos`, `ddia`, `dados`, `consistencia`, `replicacao`, `streams` (todos roteiam para este orquestrador).
- Fallback amigável: subcomando inexistente → mensagem com lista de subcomandos válidos + exemplo de uso.
- Detect `supabase/config.toml`: se presente, extrai `project_id` e passa como contexto para o agent (mesmo pattern de `/multi-tenant` v1.21).

</decisions>

<code_context>
## Insights do Código Existente

- `kit/agents/multi-tenant-isolation-auditor.md` (v1.21) — template estrutural canônico para agent auditor (frontmatter, "Por que existe", "Inputs", "Passos", "Anti-patterns prevenidos", "Quando NÃO invocar", "Ver também")
- `kit/agents/toil-auditor.md` (v1.10) — template estrutural para agent de análise classificadora (Preflight → Scan → Classify → Prioritize → Quantify → Write)
- `kit/agents/schema-checker.md` (v1.8) — template estrutural para agent validador (recebe input → consulta schema → veredito GO/NO-GO/NEEDS-REVIEW)
- `kit/commands/multi-tenant.md` (v1.21) — template estrutural para comando orquestrador da suíte (subcomandos com sinônimos, dispatch via `Task()`)
- `kit/skills/postgres-isolamento-concorrencia/SKILL.md` (v1.22 Phase 120) — skill canônica para `auditor-consistencia-isolamento` Detectores 1-2-5
- `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md` (v1.22 Phase 120) — skill canônica para `auditor-consistencia-isolamento` Detector 3 (clock skew)
- `kit/skills/escolha-modelo-consistencia/SKILL.md` (v1.22 Phase 121) — skill canônica para `auditor-consistencia-isolamento` Detector 4 (UNIQUE app-level)
- `kit/skills/streams-eventos-cdc/SKILL.md` (v1.22 Phase 121) — skill canônica para `auditor-consistencia-isolamento` Detector 6 (idempotência) + `/dados-distribuidos implementar-cdc`
- `kit/skills/tenant-quente-mitigacao/SKILL.md` (v1.22 Phase 119) — skill canônica para `detector-tenant-quente` (thresholds 3×/10× + estratégias)
- `kit/skills/evolucao-schema-compativel/SKILL.md` (v1.22 Phase 117) — skill canônica para `validador-evolucao-schema` (3-step migration pattern)
- `kit/agents/supabase-migration-writer.md` (v1.8) — agent destino do cross-suite handoff (escreve migration corrigida)
- `kit/agents/supabase-edge-fn-writer.md` (v1.8) — agent destino do cross-suite handoff (escreve Edge Function corrigida)
- `.planning/ROADMAP.md` linhas 176-202 — definição completa da Phase 122 com REQs SUITE-01, SUITE-02, AGENTE-01..06

</code_context>

<specifics>
## Ideias Específicas

- **Anchor narrativo `auditor-consistencia-isolamento`:** o exemplo "incremento de contador sem `FOR UPDATE`" é canônico para B2B SaaS — usage counters por tenant (mensagens enviadas, leads criados) frequentemente sofrem lost update silencioso até cliente reportar billing errado.
- **Anchor narrativo `detector-tenant-quente`:** o exemplo "1 tenant gera 80% das queries" é canônico — outlier real de produção em multi-tenant compartilhado, drives cost overrun + noisy neighbor degradation.
- **Anchor narrativo `validador-evolucao-schema`:** o exemplo "migration adicionou NOT NULL sem backfill" é o break #1 mais comum em cresimento de equipe — dev novo não conhece padrão 3-step, deploy quebra produção.
- **Decision tree `/dados-distribuidos help`:** ASCII inline mostrando os 4 subcomandos com 1-line descrição cada + exemplo de invocação.

</specifics>

<deferred>
## Ideias Adiadas

- Agent `replication-lag-monitor` (auto-monitorar lag de read replicas Supavisor): defer para v1.23+. Skill `consistencia-leitura-replica` v1.22 documenta o problema; agent monitor seria complemento mas precisa integração com OTel collector v1.9 (cross-suite mais complexo).
- Agent `event-sourcing-validator` (validar invariantes de tabela `events` append-only): defer — REVOKE DELETE/UPDATE pattern já documentado em `streams-eventos-cdc` v1.22 + `audit-log-multi-tenant` v1.21. Validador automático seria gate, não agent.
- Subcomando `/dados-distribuidos rebalancear-particoes` (auto-resharding por hash de `org_id`): defer para v1.23 — exige conhecimento profundo do projeto e isso é mais agent-de-implementação que skill.
- Cross-suite handoff bidirecional automático (agent v1.8 invoca v1.22 sem comando explícito): defer para v1.23 cross-suite release artifacts (Phase 123 patches em `supabase-migration-writer` v1.8 que adicionam invocação opt-in para `validador-evolucao-schema`).

</deferred>
</content>
