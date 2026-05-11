# Fase 125: Skill nova `supabase-rls-defense-in-depth` + glossário parcial - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — skill standalone documentando 5 patterns canônicos)

<domain>
## Limite da Fase

Criar skill nova `supabase-rls-defense-in-depth` documentando os 5 patterns de defense in depth (event trigger `rls_auto_enable()`, `BYPASSRLS` role privilege, service_role caveat, security definer functions, views `security_invoker=true`). Standalone — não modifica skills existentes. Atualização parcial do glossário compartilhado `_shared-supabase/glossary.md` com 6 termos novos.
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Material-fonte: documentação oficial Supabase RLS fornecida no prompt do milestone original (seções "Auto-enable RLS for new tables", "Bypassing Row Level Security", "Views", "Use security definer functions").

### Decisões de conteúdo
- Skill começa com "Princípio canônico" articulando 6 camadas de defense-in-depth
- DEFENSE-01 (event trigger) tem SQL completo + caveats + auditoria query "tabelas sem RLS"
- DEFENSE-02 (BYPASSRLS) tem tabela comparativa service_role vs custom role
- DEFENSE-03 (service_role caveat) tem código TypeScript Edge Function mostrando admin client + user client separados
- DEFENSE-04 (SECURITY DEFINER) tem regras absolutas + example concreto + padrão de uso em policy
- DEFENSE-05 (security_invoker views) tem solução Postgres 15+ + fallback pré-15 + auditoria query
- Checklist defense-in-depth de 7 items para validação de projetos em produção
- Cross-suite handoff cooperativo (v1.23) documentado como base para o agent `supabase-rls-hardener` (Phase 126)
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `kit/skills/_shared-supabase/glossary.md` — existente, expandido com 6 termos novos na seção "Authorization e Auth"
- Pattern de skill com frontmatter `name` + `description` (sem `version`) — alinhado com supabase-rls-policies, supabase-migrations, etc.

### Padrões Estabelecidos
- Convenção PT-BR para narrative + EN para SQL code blocks
- Cross-refs ativos para skills relacionadas em "Ver também"
- Trigger phrases em "Quando usar" para LLM auto-load

### Pontos de Integração
- Skill nova é referenciada por supabase-rls-policies (cross-ref linha "Bypassing RLS")
- Skill nova será consumida pelo agent supabase-rls-hardener (Phase 126)
- 6 termos novos no glossário compartilhado serão referenciados por:
  - Phase 126: agent hardener
  - Phase 127: patches agents Supabase existentes
  - Phase 128: cross-suite v1.21 handoff cooperativo
</code_context>

<specifics>
## Ideias Específicas

- Defense in depth como narrativa de **camadas sobrepostas** (não substitutas)
- Tabela comparativa service_role vs custom BYPASSRLS role para ajudar decision
- Auditoria queries para detectar gaps (tabelas sem RLS, views vulneráveis)
- Checklist final de 7 items para review em produção
</specifics>

<deferred>
## Ideias Adiadas

- Skill standalone para Column-Level Security — Phase 124 v1.24 (próximo marco parqueado)
- Tooling automatizado para auditar defense-in-depth gaps — v1.24+
</deferred>
