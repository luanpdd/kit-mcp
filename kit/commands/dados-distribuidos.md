---
name: dados-distribuidos
description: Orquestrador da Suíte DDIA Foundations — dispatch para agents (auditor-consistencia-isolamento, detector-tenant-quente, validador-evolucao-schema) com sinônimos PT/EN (ddia, dados, consistencia, replicacao, streams).
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte DDIA Foundations v1.22. Recebe um subcomando + args, faz dispatch via `Task(subagent_type=<ddia-agent>)` para o agent especializado correto. É o **único ponto de chain de agents da Suíte DDIA Foundations** — agents permanecem função pura (anti-pitfall A10 v1.8 herdado).

**Cross-Suite Invocation Pattern (herdado v1.21):** Agents da Suíte DDIA Foundations v1.22 **delegam para agents da Suíte Supabase v1.8 + Multi-Tenant v1.21** quando precisam materializar SQL, Edge Functions, RLS policies, audit logs. Padrão canônico:

- `auditor-consistencia-isolamento` → delega fix migration para `supabase-migration-writer` (v1.8) OU fix Edge Function para `supabase-edge-fn-writer` (v1.8)
- `detector-tenant-quente` → delega partitioning/dedicated schema para `supabase-migration-writer` (v1.8) + `b2b-saas-architect` (v1.21)
- `validador-evolucao-schema` → handoff bidirecional com `supabase-migration-writer` (v1.8 — invoca este validador ANTES de escrever migration arriscada)
- Subcomando `implementar-cdc` → carrega skill `streams-eventos-cdc` (v1.22) + delega Edge Function CDC para `supabase-edge-fn-writer` (v1.8)

**Cria/Atualiza:** o que cada agent invocado cria/atualiza (skills consultadas, audits gerados, vereditos retornados).

**Após:** o usuário tem o output do agent (audit report, veredito GO/NO-GO, ou Edge Function CDC scaffold).
</objective>

<execution_context>
Skills consultadas pelos agents (Suíte DDIA Foundations v1.22): `kit/skills/{evolucao-schema-compativel,consistencia-leitura-replica,tenant-quente-mitigacao,postgres-isolamento-concorrencia,armadilhas-sistemas-distribuidos,escolha-modelo-consistencia,streams-eventos-cdc}/SKILL.md` + `kit/skills/_shared-dados-distribuidos/glossary.md`.

Agents disponíveis (Suíte DDIA Foundations v1.22): `kit/agents/{auditor-consistencia-isolamento,detector-tenant-quente,validador-evolucao-schema}.md`.

Agents Suíte Supabase v1.8 invocados via cross-suite delegation: `supabase-migration-writer`, `supabase-edge-fn-writer`, `supabase-architect`.

Agents Suíte Multi-Tenant v1.21 invocados via cross-suite delegation: `b2b-saas-architect`, `multi-tenant-rls-writer`, `audit-log-implementer`.
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched | Skill carregada |
|---|---|---|---|
| `auditar-consistencia` | `consistencia`, `audit-consistency`, `auditar-race` | `auditor-consistencia-isolamento` | `postgres-isolamento-concorrencia`, `armadilhas-sistemas-distribuidos`, `escolha-modelo-consistencia`, `streams-eventos-cdc` |
| `auditar-tenant-quente` | `tenant-quente`, `hot-tenant`, `audit-tenant`, `tenant` | `detector-tenant-quente` | `tenant-quente-mitigacao` |
| `validar-evolucao-schema` | `validar-schema`, `validate-schema`, `evolution-check`, `validar-evolucao` | `validador-evolucao-schema` | `evolucao-schema-compativel` |
| `implementar-cdc` | `cdc`, `cdc-pipeline`, `streams`, `event-streaming` | (cross-suite) `supabase-edge-fn-writer` (v1.8) | `streams-eventos-cdc` (skill v1.22 carregada como contexto) |
| `help` | `ajuda`, `?` | exibe esta tabela inline | — |

**Aliases globais para o nome da suíte:** `dados-distribuidos`, `ddia`, `dados`, `consistencia`, `replicacao`, `streams` (todos roteiam para este orquestrador via `/dados-distribuidos`).

**Skills relacionadas (Suíte DDIA Foundations v1.22):**

| Skill | Capítulo DDIA | Quando usar |
|---|---|---|
| [`evolucao-schema-compativel`](../skills/evolucao-schema-compativel/SKILL.md) | Ch 4 (Encoding and Evolution) | Migrations com ALTER (NOT NULL, DROP, type narrow, default) |
| [`consistencia-leitura-replica`](../skills/consistencia-leitura-replica/SKILL.md) | Ch 5 (Replication) | Read replicas Supavisor, read-after-write, monotonic reads |
| [`tenant-quente-mitigacao`](../skills/tenant-quente-mitigacao/SKILL.md) | Ch 6 (Partitioning) | Multi-tenant skew, hot tenant, partitioning hash(org_id) |
| [`postgres-isolamento-concorrencia`](../skills/postgres-isolamento-concorrencia/SKILL.md) | Ch 7 (Transactions) | Lost update, write skew, isolation level Postgres |
| [`armadilhas-sistemas-distribuidos`](../skills/armadilhas-sistemas-distribuidos/SKILL.md) | Ch 8 (Distributed Systems Trouble) | Clock skew, network failure, partial failure |
| [`escolha-modelo-consistencia`](../skills/escolha-modelo-consistencia/SKILL.md) | Ch 9 (Consistency and Consensus) | Linearizabilidade, causal, eventual; uniqueness; CAP/PACELC |
| [`streams-eventos-cdc`](../skills/streams-eventos-cdc/SKILL.md) | Ch 11 (Stream Processing) | CDC, event sourcing, pgmq exactly-once, stream joins |

**Detect `supabase/config.toml`:** se presente, extrai `project_id` e passa como contexto para o agent (mesmo pattern de `/multi-tenant` v1.21 + `/supabase` v1.8).
</context>

<process>

## 1. Parsear Subcomando

```bash
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

## 2. Resolver Sinônimos

Mapear `SUBCMD` para agent name canônico:

```text
auditar-consistencia, consistencia, audit-consistency, auditar-race  → auditor-consistencia-isolamento
auditar-tenant-quente, tenant-quente, hot-tenant, audit-tenant, tenant → detector-tenant-quente
validar-evolucao-schema, validar-schema, validate-schema, validar-evolucao, evolution-check → validador-evolucao-schema
implementar-cdc, cdc, cdc-pipeline, streams, event-streaming         → cross-suite: supabase-edge-fn-writer (v1.8)
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair (fallback amigável).

```text
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  auditar-consistencia / consistencia       → audita race conditions (6 detectores: lost update, write skew,
                                                clock skew, UNIQUE app, cross-tenant lock, idempotência)
  auditar-tenant-quente / tenant-quente     → detecta outliers de tenant (queries/min, storage, conexões)
                                                via mcp__supabase__execute_sql; thresholds 3×/10× P50
  validar-evolucao-schema / validar-schema  → valida migration SQL — veredito GO/NO-GO/NEEDS-REVIEW
                                                + sugestão de migration safe quando NO-GO
  implementar-cdc / cdc                     → scaffold de Edge Function CDC (wal2json + Realtime broadcast,
                                                pglogical → Kafka, ou trigger-based) via supabase-edge-fn-writer
  help / ajuda / ?                          → exibe esta tabela

Uso: /dados-distribuidos <subcomando> <args...>

Exemplos:
  /dados-distribuidos auditar-consistencia "auditar supabase/migrations/ + supabase/functions/"
  /dados-distribuidos auditar-tenant-quente "últimos 30 dias, top 5 tenants"
  /dados-distribuidos validar-evolucao-schema supabase/migrations/20260510_add_priority.sql
  /dados-distribuidos implementar-cdc "CDC para tabela leads via wal2json + Realtime broadcast"
  /dados-distribuidos help

Aliases para o comando: /dados-distribuidos, /ddia, /dados, /consistencia, /replicacao, /streams
```

## 3. Detectar `supabase/config.toml`

```bash
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

Se presente, anexar `project_id=<value>` ao prompt do agent. Se ausente, agent funciona sem (modo offline para `auditar-tenant-quente`).

## 4. Dispatch

Invocar `Task(subagent_type=<agent_name>, prompt=<built_prompt>)`.

**Prompt construído (template canônico):**

```text
{ARGS}

{Se project_id detectado:}
project_id: {PROJECT_ID}

{Skill de contexto (carregada conforme subcomando):}
Skill canônica: kit/skills/<skill-name>/SKILL.md
```

### Subcomando-específico

**`auditar-consistencia`:** dispatch para `auditor-consistencia-isolamento`. Agent funciona offline (filesystem-only via Read/Grep/Glob). Sem necessidade de pre-question.

**`auditar-tenant-quente`:** dispatch para `detector-tenant-quente`. Agent requer MCP Supabase ativo para coleta live. Se MCP indisponível, agent declara modo offline-fallback (heurísticas estáticas apenas) — caller é avisado.

**`validar-evolucao-schema`:** dispatch para `validador-evolucao-schema`. Args devem incluir `migration_path` (arquivo `.sql`) OU `migration_sql` (SQL inline). Agent retorna veredito estruturado (GO/NO-GO/NEEDS-REVIEW) + sugestão de migration safe quando NO-GO.

**`implementar-cdc` (cross-suite):**

```text
Esta é uma operação cross-suite — DDIA Foundations v1.22 → Supabase v1.8.

Passos:
1. Carregar skill kit/skills/streams-eventos-cdc/SKILL.md como contexto canônico
2. AskUserQuestion para escolher abordagem CDC:
   - Opção 1: wal2json + Supabase Realtime broadcast (zero infra, baixa latência)
   - Opção 2: pglogical → Kafka externo (warehousing, alta robustez)
   - Opção 3: Trigger-based (custom logic, baixo throughput)
3. Dispatch via Task(subagent_type="supabase-edge-fn-writer", prompt=<built>) com:
   - Contexto: abordagem escolhida
   - Skill: streams-eventos-cdc (referência canônica)
   - Tabela alvo: <args fornecidos>
4. Agent v1.8 escreve Edge Function Deno conforme abordagem (com idempotência via processed_events table)
```

## 5. Output

Output do agent é o output do command. Sem post-processing — agent já formata estruturado (audit report, veredito, ou Edge Function code).

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (4 subcomandos × seus sinônimos)
- [ ] `project_id` extraído de `supabase/config.toml` se presente
- [ ] Subcomando `implementar-cdc` faz `AskUserQuestion` upfront sobre abordagem CDC (3 opções)
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain de agents da Suíte DDIA Foundations
- [ ] Subcomando inválido → mensagem clara com lista (fallback amigável)
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline
- [ ] Args após subcomando passam transparentemente para o agent
- [ ] Cross-suite invocation documentada (agents v1.22 → agents v1.8 + v1.21)
- [ ] Tabela de skills relacionadas (7 skills) com link ATIVO para SKILL.md
</success_criteria>
