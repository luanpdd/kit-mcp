# Fase 129: Patches cross-suite v1.22 + framework core - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — patches editoriais com escopo bem-definido)

<domain>
## Limite da Fase

Atualizar `auditor-consistencia-isolamento` (v1.22) com Detector 7 (CROSS-09: valida que migrations passaram pelo hardener) + atualizar `planner`/`executor`/`debugger` (framework core) com SQL auto-handoff cooperativo (CROSS-10: detectam SQL e fazem handoff via Task() para Supabase).
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern de handoff cooperativo já estabelecido em Phase 128. Phase 129 estende para 1 v1.22 agent + 3 framework core agents.

### Decisões de design
- **CROSS-09 (auditor-consistencia-isolamento)** — adiciona "Detector 7 — Migration sem hardener cooperativo (v1.23)" como Camada 7 de defense-in-depth + query bash para detectar migrations sem trace de hardener + output enriquecido com field `hardener_passed: bool`
- **CROSS-10 (framework core)** — section `<sql_auto_handoff_cooperativo>` no fim de cada (planner, executor, debugger) com heurística regex de detecção de SQL + pattern Task() pseudo-code customizado por agent
- **Planner**: injeta tarefa final no PLAN.md quando detecta SQL
- **Executor**: invoca hardener ANTES de aplicar SQL; pausa em REWRITE com user_facing_caller=true
- **Debugger**: invoca hardener ANTES de propor fix SQL; absorve verdict como evidence no DEBUG.md
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- Pattern `<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>` consistente em Phases 126-128
- auditor-consistencia-isolamento já tem section "Cross-suite invocation pattern (v1.21 herdado)" — Detector 7 é extensão natural
- Framework core agents têm estrutura XML-like (`<role>`, `<process>`, `<success_criteria>`) — section `<sql_auto_handoff_cooperativo>` segue mesmo padrão

### Padrões Estabelecidos
- "Princípio canônico v1.23" repetido em cada section para proximity reading
- Heurística regex como mecanismo de detecção (não exige parsing AST complexo)

### Pontos de Integração
- Phase 130 release artifacts captura novos hashes de file-manifest.json
- CHANGELOG v1.23 documenta o pattern para usuários adopt em projetos consumidores
</code_context>

<specifics>
## Ideias Específicas

- Detector 7 do auditor consulta git log para detectar migrations sem trace de hardener
- Framework core agents usam regex heurística (não AST) para detectar SQL
- Verdict REWRITE com user_facing_caller=true pausa execução — não bypass silencioso
</specifics>

<deferred>
## Ideias Adiadas

- Auto-fix retroativo de migrations sem hardener trace — risco alto, defer para v1.24+
- AST parsing para detecção SQL mais robusta (lidar com SQL embutido em strings) — defer
- CI gate failing build se SQL no PR sem trace de hardener — defer para v1.24+
</deferred>
