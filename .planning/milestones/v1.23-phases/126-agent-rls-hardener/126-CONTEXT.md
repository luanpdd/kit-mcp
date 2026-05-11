# Fase 126: Agent novo `supabase-rls-hardener` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — agent canonical com contrato bem definido no ROADMAP)

<domain>
## Limite da Fase

Criar agent novo `kit/agents/supabase-rls-hardener.md` — canonical materializer que recebe draft SQL via `Task()` upstream context + intent original e produz SQL final hardenado preservando intent. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação. Invocável cross-suite por agents v1.21/v1.22/framework core. Valida instalação de event trigger `rls_auto_enable` em projetos novos.
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Agent é o "canonical handoff target" para Phase 128/129. Contrato bem definido no ROADMAP success criteria + REQs HARDEN-01..06.

### Decisões de design
- **Verdicts construtivos** (não BLOCK): GO (passa direto), STRENGTHEN (ajusta com diff), REWRITE (anti-pattern crítico + confirmação obrigatória se user_facing_caller=true)
- **Input format estruturado** com `<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>` para preservar contexto upstream
- **7-item checklist defense-in-depth** (C1..C7) explicitamente listado no output — leitor humano pode auditar
- **Cross-suite invocação tabela** lista 12 callers documentados (8 v1.21 + 1 v1.22 + 3 framework core)
- **HARDEN-05 (event trigger validation)** integrado como Step opcional usando `mcp__supabase__execute_sql`
- **Anti-patterns prevenidos** documenta 10 anti-patterns canônicos vinculados a skill `supabase-rls-policies`
- **Observability integrada** com span structured (caller, verdict, checklist counts, anti_patterns_detected)

### Tools utilizados
- Read/Write/Edit/Bash/Grep/Glob — standard agent tools
- Task — para handoff back ao caller se REWRITE precisa confirmação
- mcp__supabase__execute_sql + list_tables — para HARDEN-05 (validar event trigger live mode)
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- Estrutura de agent ao estilo `kit/agents/supabase-rls-writer.md` (existing) — frontmatter + sections (Por que existe, Inputs, Passos, Output, Anti-patterns, Ver também, Observabilidade)
- Skill `supabase-rls-defense-in-depth` (Phase 125) — fornece os 5 patterns que o hardener valida
- Skill `supabase-rls-policies` (Phase 124) — fornece anti-patterns canônicos
- Skill `supabase-migrations` (Phase 124) — fornece template 5 blocos obrigatórios

### Padrões Estabelecidos
- Convenção PT-BR para narrative + EN para SQL code blocks
- Output format com header `═══` seguido de section markers (## Verdict, ## Diff, ## Notas)
- Cross-suite invocation tabela documenta cada caller

### Pontos de Integração
- Phase 127 patches agents Supabase existentes (rls-writer, migration-writer, command) para invocar este hardener
- Phase 128 patches cross-suite v1.21 (8 implementers) para invocar este hardener
- Phase 129 patches framework core (planner/executor/debugger) para invocar este hardener
- Agent é cross-ref ativo desde supabase-rls-policies (linha "Cooperative handoff" — Phase 124)
- Agent é cross-ref ativo desde supabase-rls-defense-in-depth (linha "Cross-suite handoff cooperativo" — Phase 125)
</code_context>

<specifics>
## Ideias Específicas

- Hardener é "agent canonical" — todas as outras phases dependem dele para handoff cooperativo
- Verdicts são construtivos, não binários (GO/BLOCK não capturam a riqueza necessária)
- REWRITE com user_facing_caller=true exige confirmação humana — não silenciar mudanças significativas
- Output sempre repete `upstream_intent` para confirmar entendimento ao caller
</specifics>

<deferred>
## Ideias Adiadas

- Telemetria de cooperative handoff (% de drafts upstream que vão GO vs STRENGTHEN vs REWRITE) — deferred para v2 (após v1.23 estabilizar)
- Burn rate alerting integrado com hardener (alertar quando taxa de REWRITE sobe) — v2
- Migração automática de policies existentes não-hardenadas via hardener — risco alto, defer
</deferred>
