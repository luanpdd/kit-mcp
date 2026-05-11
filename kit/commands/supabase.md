---
name: supabase
description: Orquestrador da Suíte Supabase — serviço de materialização (v1.23) que recebe planejamento/draft SQL de qualquer agent ou user e devolve código hardenado pronto. NUNCA bloqueia upstream — handoff cooperativo via Task(). Subcomandos arquiteto, migration, rls, hardener, edge, realtime, auth, storage, rag, cron, check com sinônimos PT/EN.
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
Orquestrador único da Suíte Supabase. **Serviço de materialização (v1.23):** recebe planejamento de qualquer agent ou input do user e devolve código hardenado pronto. **NUNCA bloqueia upstream** — agents externos passam draft via `Task()` para receber SQL final hardenado preservando intent.

Faz dispatch via `Task(subagent_type=supabase-...)` para o agent especializado correto. É o **único ponto de chain de agents Supabase** — agents permanecem função pura (anti-pitfall A10 de v1.8).

**Princípio canônico v1.23:** Agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream.

**Cria/Atualiza:** o que cada agent invocado cria/atualiza (migrations, schemas, functions, etc.) — com RLS auto-injetada no output via handoff cooperativo com `supabase-rls-hardener` em CREATE TABLE.

**Após:** o usuário tem o output do agent (plano, código, SQL hardenado, ou veredito GO/STRENGTHEN/REWRITE).
</objective>

<execution_context>
Skills consultadas pelos agents: `kit/skills/supabase-*/SKILL.md` + `kit/skills/_shared-supabase/glossary.md` (Phase 25).
Agents disponíveis: `kit/agents/supabase-*.md` (Phase 26) + `kit/agents/schema-checker.md` (existente).
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched |
|---|---|---|
| `arquiteto` | `architect`, `arch` | `supabase-architect` |
| `migration` | `migrar`, `migrate` | `supabase-migration-writer` (v1.23: auto-chain cooperativo com hardener em CREATE TABLE) |
| `rls` | — | `supabase-rls-writer` (v1.23: GRANTs + IS NOT NULL + views security_invoker) |
| `hardener` | `harden`, `endurecer` | `supabase-rls-hardener` (v1.23 canonical materializer — recebe draft via Task) |
| `column` | `coluna`, `col-priv` | `supabase-column-privileges-writer` (v1.24 canonical materializer column-level — recebe spec via Task) |
| `edge` | `edge-function`, `function`, `funcao` | `supabase-edge-fn-writer` |
| `realtime` | `tempo-real` | `supabase-realtime-implementer` |
| `auth` | `autenticacao`, `auth-ssr` | `supabase-auth-bootstrapper` |
| `storage` | `armazenamento` | `supabase-storage-implementer` |
| `rag` | `pgvector`, `embeddings` | `supabase-edge-fn-writer` com prompt sobre embeddings |
| `cron` | `queues`, `pgmq`, `background` | `supabase-edge-fn-writer` com prompt sobre `cron → pgmq → Edge` |
| `check` | `validar`, `validate` | `schema-checker` (validação pré-migration) |
| `help` | `ajuda`, `?` | exibe esta tabela inline |

**Detect `supabase/config.toml`:** se presente, extrai `project_id` (linha `project_id = "<ref>"`) e passa como contexto para o agent.
</context>

<process>

## 1. Parsear Subcomando

```bash
# PT-BR: extrair primeiro token de $ARGUMENTS como subcomando
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

## 2. Resolver Sinônimos

Mapear `SUBCMD` para agent name canônico:

```
arquiteto, architect, arch       → supabase-architect
migration, migrar, migrate       → supabase-migration-writer  (v1.23: auto-chain hardener em CREATE TABLE)
rls                              → supabase-rls-writer        (v1.23: GRANTs + IS NOT NULL + views security_invoker)
hardener, harden, endurecer      → supabase-rls-hardener      (v1.23 canonical materializer)
column, coluna, col-priv         → supabase-column-privileges-writer  (v1.24 canonical materializer column-level — feature AVANÇADA)
edge, edge-function, function, funcao → supabase-edge-fn-writer
realtime, tempo-real             → supabase-realtime-implementer
auth, autenticacao, auth-ssr     → supabase-auth-bootstrapper
storage, armazenamento           → supabase-storage-implementer
rag, pgvector, embeddings        → supabase-edge-fn-writer (com flag rag=true no prompt)
cron, queues, pgmq, background   → supabase-edge-fn-writer (com flag pattern=cron-pgmq no prompt)
check, validar, validate         → schema-checker
```

### Serviço de materialização (v1.23 — handoff cooperativo)

Quando agents externos (multi-tenant, debugger, planner, executor, audit-log, CRM, etc.) precisam produzir SQL/DDL, devem invocar `/supabase migration "<plano>"` ou `Task(subagent_type=supabase-rls-hardener, prompt=<draft+intent>)` ao invés de gerar SQL próprio. O command NÃO bloqueia — recebe planejamento, devolve código hardenado.

**Pattern de invocação:**

```python
# de outro agent (ex: multi-tenant-rls-writer)
result = Task(subagent_type="supabase-rls-hardener", prompt=f"""
<upstream_intent>
Source agent: multi-tenant-rls-writer
Original goal: criar policies hierárquicas org→dept→role para {table_name}
Constraints: helper functions já existem em schema private
</upstream_intent>

<draft_sql>
{draft_policies_sql}
</draft_sql>

<user_facing_caller>true</user_facing_caller>
""")
# result.verdict: GO | STRENGTHEN | REWRITE
# result.final_sql: SQL hardenado preservando intent
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  arquiteto / architect    → projetar schema + RLS + topology antes de implementar
  migration / migrar       → escrever migration SQL
  rls                      → gerar policies RLS para tabela
  edge                     → escrever Edge Function Deno
  realtime                 → configurar canais Realtime (RLS + trigger + client)
  auth                     → bootstrap Next.js v16 + Supabase Auth (SSR)
  storage                  → configurar Storage (bucket + RLS + client)
  rag                      → Edge Function com embeddings + pgvector
  cron                     → pattern cron → pgmq → Edge Function
  check                    → validar SQL antes de apply (schema-checker)

Uso: /supabase <subcomando> <args...>
Exemplo: /supabase arquiteto "app de chat com presence multi-room"
```

## 3. Detectar `supabase/config.toml`

```bash
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

Se presente, anexar `project_id=<value>` ao prompt do agent. Se ausente, agent funciona sem (offline ou pergunta ao user).

## 4. Dispatch

Invocar `Task(subagent_type=<agent_name>, prompt=<built_prompt>)`.

**Prompt construído:**

```
{ARGS}

{Se project_id detectado:}
project_id: {PROJECT_ID}

{Se subcomando rag/cron — flag de modo:}
mode: rag-embeddings   (ou cron-pgmq-edge)

{Para architect: tier upfront via AskUserQuestion}
{caller: pergunte ao user via AskUserQuestion sobre tier (Free/Pro/Team) e branches antes de produzir o plano — ver supabase-architect Step 1}
```

**Subcomando `arquiteto`:** antes de dispatch, faça `AskUserQuestion` perguntando tier (Free/Pro/Team/Enterprise) e se vai usar branches. Inclua resposta no prompt.

**Subcomando `check`:** dispatch para `schema-checker` (existente). O caller deve passar `migration_path` e `project_id` no `$ARGUMENTS` — exemplo: `/supabase check supabase/migrations/20260506_x.sql`.

**Subcomando `migration` (v1.23 — CMD-02):** após `supabase-migration-writer` produzir SQL inicial, o agent **AUTOMATICAMENTE** invoca `supabase-rls-hardener` via `Task()` para validar defense-in-depth em CREATE TABLE. Output final inclui verdict + RLS auto-injetada. Caller NÃO precisa invocar hardener separadamente — é parte do contrato do subcomando.

**Subcomando `hardener` (v1.23 novo):** dispatch direto para `supabase-rls-hardener`. Útil quando caller tem draft SQL pronto e quer apenas validação/hardening sem gerar SQL novo. Aceita input com bloco `<draft_sql>` no `$ARGUMENTS` ou via stdin.

**Subcomando `column` (v1.24 novo):** dispatch direto para `supabase-column-privileges-writer`. Recebe spec de table + colunas sensíveis + roles permitidos e produz REVOKE table-level + GRANT column-level. **Feature AVANÇADA** — apenas para casos com PII compliance (LGPD/GDPR), audit log payload, billing data, tokens raw. Para casos comuns (admin/user roles), prefira dedicated role table pattern (documentado em [`supabase-column-level-security`](../skills/supabase-column-level-security/SKILL.md)). Aceita input com bloco `<sensitive_columns>` e `<allowed_roles>` no `$ARGUMENTS`.

## 5. Output

Output do agent é o output do command. Sem post-processing — agent já formata estruturado.

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (10 subcomandos × seus sinônimos)
- [ ] `project_id` extraído de `supabase/config.toml` se presente
- [ ] Subcomando `arquiteto` faz `AskUserQuestion` upfront sobre tier + branches
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain de agents Supabase
- [ ] Subcomando inválido → mensagem clara com lista
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline
- [ ] Subcomando `check` → invoca `schema-checker` (existente)
- [ ] Args após subcomando passam transparentemente para o agent
</success_criteria>
