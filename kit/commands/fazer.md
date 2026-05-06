---
name: fazer
description: Entrypoint canônico — roteia texto livre para o comando do framework correto. Use este quando estiver na dúvida.
argument-hint: "<descrição do que você quer fazer>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
**Entrypoint canônico do framework.** Quando você sabe o que quer mas não sabe qual `/*` executar, use `/fazer "descrição"`.

`/fazer` é um despachante inteligente — nunca faz o trabalho diretamente; combina a intenção com o melhor comando e transfere com confirmação.

## Árvore de decisão

| Sua intenção | Comando recomendado | Quando usar |
|---|---|---|
| Tarefa **trivial** (rename, ajuste pontual) | **`/rapido`** | Sem necessidade de plano formal; commit atômico, sem subagentes |
| Tarefa **rápida com garantias** (commit limpo, rastreamento de estado) | **`/expresso`** | Algo concreto mas pequeno; pula agentes opcionais mas mantém disciplina |
| Trabalho **estruturado** (multi-arquivo, requer planejamento) | **`/discutir-fase` → `/planejar-fase` → `/executar-fase`** | Fase real de milestone; usa agentes completos |
| **Tarefa Supabase** (DB/Auth/Realtime/Edge/Storage/RLS/migration) | **`/supabase <subcomando>`** | Roteia para agent especializado: arquiteto / migration / rls / edge / realtime / auth / storage / rag / cron / check |
| **Próximo passo** ambíguo no fluxo atual | **`/proximo`** | Avança no roadmap automaticamente |
| **Capturar ideia** sem agir agora | **`/nota`** ou **`/adicionar-tarefa`** | Salva pra depois sem interromper o foco |
| **Investigar bug** com método científico | **`/depurar`** | Hipótese → teste → fix com checkpoints |

## Detecção de intenção Supabase

Se a descrição do user menciona qualquer destes termos, considere rotear para `/supabase` em vez de `/discutir-fase` ou `/expresso`:

- **DB:** "migration", "RLS", "policy", "schema", "tabela Postgres", "supabase/migrations", "supabase/schemas"
- **Auth:** "Supabase auth", "Next.js auth", "@supabase/ssr", "magic link", "OAuth", "MFA TOTP"
- **Realtime:** "broadcast Supabase", "presence", "postgres_changes", "channel"
- **Edge Functions:** "Edge Function", "Deno + Supabase", "supabase/functions"
- **Storage:** "bucket", "signed URL", "upload Supabase"
- **AI/RAG:** "pgvector", "embeddings + Supabase", "RAG with permissions"
- **Background:** "pg_cron", "pgmq", "scheduled job Supabase"

Para contexto sobre o que cada subcomando faz, leia [`/supabase`](./supabase.md) ou as 11 skills em `kit/skills/supabase-*/`.

## Aliases (continuam funcionando)

`/rapido`, `/expresso`, `/proximo`, `/depurar`, `/discutir-fase`, `/planejar-fase`, `/executar-fase` — todos continuam executando direto, sem passar pelo `/fazer`. Use `/fazer` quando estiver em dúvida sobre qual escolher.
</objective>

<execution_context>
@./.claude/framework/workflows/do.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute o workflow do de @./.claude/framework/workflows/do.md do início ao fim.
Rotear a intenção do usuário para o melhor comando do framework e invocá-lo.
</process>