# Fase 127: Patches agents Supabase existentes - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo)
**Modo:** Auto-gerado (discuss pulado — patches editoriais com escopo bem-definido)

<domain>
## Limite da Fase

Aplicar patches em 3 artefatos da Suíte Supabase v1.8 existentes:
- `kit/agents/supabase-rls-writer.md` (RLS-08, RLS-09, RLS-10) — emite GRANTs, IS NOT NULL opcional, views security_invoker
- `kit/agents/supabase-migration-writer.md` (MIGR-02, MIGR-03, MIGR-04) — recebe draft upstream, auto-chain cooperativo com hardener, nota de divergências
- `kit/commands/supabase.md` (CMD-01, CMD-02) — serviço de materialização, RLS auto-injetada via hardener
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Patches editoriais aditivos. Estrutura existente preservada (frontmatter, sections, anti-patterns); novidades v1.23 marcadas explicitamente com `(v1.23)` no texto.

### Decisões de design
- **RLS-09 (IS NOT NULL opcional)** — parâmetro de input `include_is_not_null_check` (default `true` em v1.23+). Caller pode opt-out se intent é silencioso.
- **RLS-10 (views security_invoker)** — só gera se caller pediu `generate_view: true` OU `access_pattern` menciona "view"; não invasivo.
- **MIGR-03 (auto-chain cooperativo)** — Step 3.5 dedicado em supabase-migration-writer documentando pattern Python pseudo-code de invocação ao hardener.
- **MIGR-04 (nota de divergências)** — Step 7 separado com template de output bem-definido.
- **CMD-01 (serviço de materialização)** — descrito no frontmatter description + section dedicada "Serviço de materialização (v1.23 — handoff cooperativo)" no <context>.
- **CMD-02 (RLS auto-injetada)** — subcomando `migration` documentado como contratualmente auto-chain com hardener; subcomando novo `hardener` para dispatch direto.
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `kit/agents/supabase-rls-writer.md` — estrutura preservada
- `kit/agents/supabase-migration-writer.md` — Step 3 (Escrever migration) expandido para template 5 blocos; Step 3.5 (auto-chain) novo; Step 7 (Nota de divergências) novo
- `kit/commands/supabase.md` — tabela de subcomandos preservada + 1 row novo (hardener)

### Padrões Estabelecidos
- Tags `(v1.23)` para marcar adições editoriais (compat com pattern do PROJECT.md / glossário)
- Pattern Python pseudo-code para invocação Task() (alinhado com agent hardener Phase 126)
- Cross-refs ativos para skill `supabase-rls-policies` v1.23 e agent `supabase-rls-hardener` Phase 126

### Pontos de Integração
- Phase 128 patches 8 agents v1.21 que invocam estes agents Supabase via Task()
- Phase 129 patches framework core que invocam estes agents
- Phase 130 release artifacts contém AUTOGEN-COUNTS regen (commands inalterado: 89; mas subcomando hardener é novo)
</code_context>

<specifics>
## Ideias Específicas

- Frontmatter description expandida para destacar mudanças v1.23 (alinhamento com discoverability)
- Princípio canônico explícito no inicio de cada agent: "agents externos pensam; você materializa preservando intent"
- Section "Cooperative handoff (v1.23)" dedicada em supabase-rls-writer documentando pattern para callers
</specifics>

<deferred>
## Ideias Adiadas

- Telemetria de quantos drafts upstream chegam por agent caller — defer para v2
- Refactoring de pattern Python pseudo-code para template helper compartilhado — risco de divergência, defer
</deferred>
