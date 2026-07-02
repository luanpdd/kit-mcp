# Fase 124: Fundação RLS — Skill `supabase-rls-policies` + `supabase-migrations` patches - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — content-only com material-fonte no contexto do milestone)

<domain>
## Limite da Fase

Incorporar 100% da doc oficial Supabase RLS na skill `supabase-rls-policies` (7 patches editoriais: RLS-01..RLS-07) e atualizar skill `supabase-migrations` com template canônico de 5 blocos obrigatórios para CREATE TABLE (MIGR-01). Pure content update sem dependências.
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação editoriais foram feitas pelo Claude seguindo os success criteria do ROADMAP v1.23 Phase 124. Material-fonte é a documentação oficial Supabase Row Level Security fornecida no prompt do milestone original. Cobertura visada: 100% dos 7 patches RLS + 1 patch MIGR.

### Decisões de conteúdo
- Defense in depth narrative no topo da skill (antes das "Regras absolutas") para estabelecer mindset
- 5 blocos obrigatórios em supabase-migrations: CREATE TABLE → GRANT → ENABLE RLS → 4 policies → INDEX (ordem canônica)
- IS NOT NULL como REGRA #3 em supabase-rls-policies (junto com REGRA #1 user_metadata e REGRA #2 wrapper)
- Anti-patterns expandidos de 4 para 7 (adicionados #5 GRANT ausente, #6 view sem security_invoker, #7 null silent-fail)
- Performance recommendations dedicadas em seção própria (6 recommendations baseadas em benchmarks oficiais)
- Cross-ref ativo para `supabase-rls-defense-in-depth` (skill nova criada em Phase 125)
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `kit/skills/supabase-rls-policies/SKILL.md` — estrutura existente preservada (frontmatter, Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns, Ver também)
- `kit/skills/supabase-migrations/SKILL.md` — pattern de blocos no template "Criar tabela" preservado e expandido

### Padrões Estabelecidos
- Convenção PT-BR para narrative + EN para SQL code blocks (alinhado v1.8/v1.22)
- Anti-patterns numerados com Errado/Por quê/Certo structure
- Cross-refs ativos para outras skills da família supabase-*

### Pontos de Integração
- Phase 125 cria skill `supabase-rls-defense-in-depth` que esta phase referencia
- Phase 126 cria agent `supabase-rls-hardener` que usa estas skills como base
- Phase 127 patches agents `supabase-rls-writer` e `supabase-migration-writer` para emitir output conforme novos templates
</code_context>

<specifics>
## Ideias Específicas

- Manter REGRA #1 (user_metadata) como primeira regra absoluta — é o anti-pattern mais crítico de segurança
- Adicionar REGRA #3 (IS NOT NULL) como peer das duas regras existentes (não como nota lateral)
- Performance section com 6 recommendations + benchmarks oficiais citados (99.94%, 94.97%, etc.)
- Defense in depth narrative deve ser clara: RLS protege mesmo quando third-party tooling (Metabase, BI) acessa diretamente o banco
</specifics>

<deferred>
## Ideias Adiadas

- Nenhuma — escopo aderiu à definição da Phase 124 no ROADMAP
- Skill nova `supabase-rls-defense-in-depth` adiada para Phase 125 (próxima fase)
</deferred>
