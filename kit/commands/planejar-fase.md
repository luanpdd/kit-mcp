---
name: planejar-fase
description: Cria plano detalhado da fase (PLAN.md) com loop de verificação
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text]"
agent: planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---
<objective>
Criar prompts de fase executáveis (arquivos PLAN.md) para uma fase do roadmap com pesquisa e verificação integradas.

**Fluxo padrão:** Pesquisa (se necessário) → Planejar → Verificar → Concluído

**Papel do orquestrador:** Analisar argumentos, validar fase, pesquisar domínio (a menos que pulado), invocar planner, verificar com plan-checker, iterar até aprovação ou máximo de iterações, apresentar resultados.
</objective>

<execution_context>
@./.claude/framework/workflows/plan-phase.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Número da fase: $ARGUMENTS (opcional — auto-detecta a próxima fase não planejada se omitido)

**Flags:**
- `--research` — Forçar re-pesquisa mesmo que RESEARCH.md exista
- `--skip-research` — Pular pesquisa, ir direto para planejamento
- `--gaps` — Modo de fechamento de lacunas (lê VERIFICATION.md, pula pesquisa)
- `--skip-verify` — Pular loop de verificação
- `--prd <file>` — Usar um arquivo PRD/critérios de aceite em vez de discutir-fase. Analisa requisitos em CONTEXT.md automaticamente. Pula discutir-fase completamente.
- `--reviews` — Replanejar incorporando feedback de revisão cross-AI do REVIEWS.md (produzido por `/revisar`)
- `--text` — Usar listas numeradas em texto simples em vez de menus TUI (necessário para sessões remotas `/rc`)

Normalizar entrada da fase no passo 2 antes de qualquer pesquisa de diretório.
</context>

<process>
Execute o workflow plan-phase de @./.claude/framework/workflows/plan-phase.md do início ao fim.
Preserve todos os checkpoints do workflow (validação, pesquisa, planejamento, loop de verificação, roteamento).
</process>

<observability_integration>
**Integração com ODD plan-checker gate (v1.9):**

Quando `workflow.observability_plan_gate = true` (default para fases voltadas ao usuário), o `plan-checker` invocado neste workflow inclui uma checagem extra:

1. Lê `<observability>` section do CONTEXT.md (criado por `/discutir-fase` ou `/instrumentar-fase`)
2. Verifica que as 4 perguntas pré-PR estão respondidas (consulta skill [`observability-driven-development`](../skills/observability-driven-development/SKILL.md)):
   - Faz o que esperei? → INSTRUMENTATION.md tem `result.success` documentado?
   - Compara à versão anterior? → `build_id` em todo span planejado?
   - Usuários estão usando? → identidade (`user.id`/`tenant_id`/`customer.tier`) presente?
   - Anomalias emergem? → `error.type` enum + `branch_taken` planejados?
3. Se alguma pergunta ausente: VERIFICATION.md status = `gaps_found`, sugerindo invocar `/instrumentar-fase` para gerar INSTRUMENTATION.md.

**Fases de infraestrutura pura** (skip discuss already detectou): pula gate silenciosamente.

**Quando há observability gate enabled e gap encontrado:** o user pode (a) `/instrumentar-fase` antes de prosseguir; ou (b) editar manualmente CONTEXT.md `<observability>` section; ou (c) override via `--skip-observability-gate`.

**REQ:** INT-FW-02.
</observability_integration>
