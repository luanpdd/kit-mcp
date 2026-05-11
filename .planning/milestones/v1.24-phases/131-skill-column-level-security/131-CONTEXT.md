# Fase 131: Skill nova `supabase-column-level-security` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para execução (executado inline em modo autônomo, pattern herdado de v1.23)
**Modo:** Auto-gerado (discuss pulado — material-fonte completo no prompt do milestone)

<domain>
## Limite da Fase

Criar skill nova `kit/skills/supabase-column-level-security/SKILL.md` documentando 100% da documentação oficial Supabase Column Level Security — GRANT/REVOKE column-level, table-level vs column-level, wildcard restriction, considerações de impacto cross-operation, integração com RLS, dedicated role table pattern (recomendado), Studio dashboard reference, anti-patterns.
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Skill standalone que serve como base de conhecimento para agent `supabase-column-privileges-writer` (Phase 133) e Camada 8 de defense-in-depth (Phase 132).

### Decisões de conteúdo
- **Aviso explícito no topo "Quando usar (e quando NÃO usar)"** — alinhado com recomendação oficial Supabase ("we do not recommend using column-level privileges for most users")
- **4 caveats canônicos numerados** — wildcard `*`, cross-operation impact, dedicated role table como alternativa, Studio UI
- **4 patterns concretos** — UPDATE restricted columns, SELECT PII columns, audit log payload protegido, token raw service_role-only
- **Dedicated role table pattern detalhado** — recomendação oficial reproduzida com SQL completo + 5 vantagens vs column-level
- **Anti-patterns 4** — column-level sem revoke prévio, `SELECT *` esperando funcionar, column-level em vez de dedicated role, INSERT esquecendo DEFAULTs
- **Auditoria query SQL** — detectar tabelas com PII sem column privileges
- **Cross-refs ativos** para skills v1.23 (rls-policies, defense-in-depth) + agents v1.23/v1.24 (hardener, column-privileges-writer)
</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- Pattern de skill com frontmatter `name` + `description` (alinhado v1.23 skills)
- Estrutura "Quando usar" + "Princípio canônico" + "Caveats" + "Patterns" + "Anti-patterns" + "Ver também" (alinhado v1.23 skills)
- Pattern de cross-refs para skills/agents v1.23

### Padrões Estabelecidos
- Convenção PT-BR para narrative + EN para SQL code blocks
- Aviso `⚠` para caveats/regras críticas
- Cross-suite integration documentado no fim
</code_context>

<specifics>
## Ideias Específicas

- Skill começa com "Quando NÃO usar" — alinha com recomendação oficial
- Caveats #1 e #2 (wildcard + cross-operation) são os pontos onde devs erram mais
- Dedicated role table pattern é a recomendação canônica — destacada com SQL completo + vantagens
- Auditoria query SQL ajuda Detector 8 do hardener (Phase 134)
</specifics>

<deferred>
## Ideias Adiadas

- Encryption at rest (Supabase Vault) — v1.25
- Dynamic column masking via views — v1.25+
- pg_audit integration para column privilege changes — v2
- Migração retroativa de column-level em tabelas existentes — risco alto, defer
</deferred>
