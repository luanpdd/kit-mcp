# Fase 128: Patches cross-suite v1.21 (handoff cooperativo em 8 implementers) - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — patches editoriais com pattern consistente para 8 agents)

<domain>
## Limite da Fase

Aplicar handoff cooperativo via `Task(subagent_type=supabase-rls-hardener)` em 8 agents implementers v1.21. Cada agent recebe section "Cooperative handoff to supabase-rls-hardener (v1.23)" antes de "Ver também" + cross-ref ativo para hardener no list "Ver também".
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern consistente cross-agent — section idêntica em estrutura, customizada por agent com `caller_name`, `original_goal`, `constraints` específicos do domínio.

### Decisões de design
- **Section template**: Pattern Python pseudo-code `Task(subagent_type="supabase-rls-hardener", prompt=f"""<upstream_intent>...""")` em cada agent
- **Constraints específicos por agent** preservam intent específico do domínio (multi-tenant: helper functions; audit-log: append-only; crm: lead dedup; org-onboarding: atomicity; invite: token security; super-admin: BYPASSRLS; evolution-go: tenant isolation; lgpd: pseudonymization)
- **user_facing_caller=true** em todos — REWRITE requer confirmação do user humano antes de aplicar
- **Princípio canônico v1.23** repetido em cada agent (proximity reading) para reforço: "agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta o outro"
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- Pattern Python pseudo-code estabelecido em Phase 126 (agent hardener) e Phase 127 (supabase-migration-writer)
- Estrutura `<upstream_intent>` + `<draft_sql>` + `<user_facing_caller>` consistente

### Padrões Estabelecidos
- Cada agent v1.21 já tem `supabase-migration-writer` em "Ver também" (cross-ref existente)
- v1.23 adiciona `supabase-rls-hardener` no topo do "Ver também" para destaque

### Pontos de Integração
- Phase 129 patches `auditor-consistencia-isolamento` (v1.22) com pattern similar
- Phase 130 release artifacts contém file-manifest regen
</code_context>

<specifics>
## Ideias Específicas

- Constraints específicas por agent preservam knowledge específico do domínio (não generic placeholder)
- Cross-ref para hardener fica em primeira posição de "Ver também" — sinaliza importância
- Nota explícita "NUNCA descarte intent upstream silenciosamente" em cada agent
</specifics>

<deferred>
## Ideias Adiadas

- Testes automatizados de handoff cooperativo (regression tests via grep ou similar) — defer para CI gates v1.24+
- Telemetria de qual agent invoca hardener mais frequentemente — defer para v2
</deferred>
