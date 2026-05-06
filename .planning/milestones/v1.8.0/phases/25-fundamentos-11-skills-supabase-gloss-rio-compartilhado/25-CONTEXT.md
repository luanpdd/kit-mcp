# Fase 25: Fundamentos — 11 skills Supabase + glossário compartilhado - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Smart discuss em modo autônomo (auto-decisões baseadas na pesquisa em `.planning/research/`)

<domain>
## Limite da Fase

Produzir 11 SKILL.md canônicas em `kit/skills/supabase-*/SKILL.md` + glossário PT-BR↔EN em `kit/skills/_shared-supabase/glossary.md`. Cada SKILL.md é auto-contida, segue must-include strings testáveis via gate, e cobre o material-fonte dos 7 guias oficiais Supabase fornecidos pelo user + lacunas identificadas pela pesquisa (Storage, pgvector/RAG, Cron+Queues).

**Fora do escopo:** agents Supabase (Phase 26), command `/supabase` (Phase 27), audit gates + cleanup (Phase 28).

</domain>

<decisions>
## Decisões de Implementação

### Estilo de code blocks (auto-decisão: híbrido)
- **D-01:** Code blocks em **EN literal** (preserva autoridade canônica Supabase) com **comentários inline em PT-BR** explicando o porquê. Ex: `-- (select auth.uid()) — wrapper obrigatório evita 1000× degradação`. Nunca traduzir nomes de funções/operadores Postgres ou identificadores Supabase.
- **D-02:** Output esperado dos code blocks é code que dev pode copiar e colar em projeto Supabase real sem editar (autoridade canônica). Comentários PT-BR ao redor são pedagógicos.

### Estrutura interna do SKILL.md (auto-decisão: template fixo)
- **D-03:** Cada SKILL.md segue template fixo com 6 seções nessa ordem: (1) frontmatter `name`/`description ≤ 200 chars`, (2) `## Quando usar` (trigger phrases para LLM), (3) `## Regras absolutas` (must-include rules — DO/NEVER), (4) `## Patterns canônicos` (code blocks com explicação), (5) `## Anti-patterns` (errado → certo com código), (6) `## Ver também` (Markdown links relativos para skills relacionadas).
- **D-04:** Skills SEM `references/` folder — auto-contidas para preservar stub-only mode (anti-pitfall A8). Toda expertise vai no SKILL.md. Skills longas (> 500 linhas) são aceitáveis se body é necessário; descrição no frontmatter ≤ 200 chars permanece curta.
- **D-05:** Tom autoritativo — LLM lê e age. Não é tutorial de aprendizado para humano. Frases como "**Sempre** faça X" e "**Nunca** faça Y" em maiúscula. Justificativas curtas (1 frase).

### Profundidade de anti-patterns (auto-decisão: regras + exemplo problemático + fix)
- **D-06:** Cada anti-pattern em `## Anti-patterns` segue formato tripla: (1) **Errado:** code block mostrando o problema, (2) **Por quê:** 1-2 frases explicando o impacto, (3) **Certo:** code block com fix.
- **D-07:** Anti-patterns críticos cobertos por **gate `skill-must-include`**: `(select auth.uid())` em rls-policies, `set search_path = ''` em database-functions, `getAll`/`setAll` + `NEVER use auth-helpers-nextjs` em auth-ssr, `npm:`/`jsr:` (sem bare specifiers) em edge-functions, `private: true` em realtime, etc.

### Escopo do glossário _shared-supabase (auto-decisão: termos + comandos CLI + patterns canônicos)
- **D-08:** `kit/skills/_shared-supabase/glossary.md` contém 3 seções: (a) **Termos PT-BR↔EN** (RLS, broadcast, postgres_changes, schemas, db diff, search_path, etc.), (b) **Comandos CLI canônicos** (supabase db diff -f, supabase db reset, supabase functions deploy, supabase gen types, etc.), (c) **Patterns canônicos consolidados** (cron→pgmq→Edge Function, RAG with permissions, multi-tenant path isolation, etc.).
- **D-09:** Glossário NÃO é skill (não tem `description:` triggerável; arquivo de referência puro). NÃO é listado em `listKit`. Cross-referenciado pelas 11 skills via Markdown link relativo `[glossário](../_shared-supabase/glossary.md)`.

### Discrição do Claude
- Detalhes de exemplos específicos em cada SKILL.md (qual table de exemplo usar, quais nomes de columns, etc.) — Claude escolhe o que é mais ilustrativo dos patterns Supabase canônicos
- Ordem das seções dentro de "Patterns canônicos" — Claude organiza do mais comum ao mais avançado
- Quantidade exata de anti-patterns por skill — Claude decide com base em quantos são críticos para o domínio (rls-policies tem 6+; postgres-style tem 2-3)
- Tabela de tamanhos exatos por skill (kbytes) — variável conforme domínio, mas description sempre ≤ 200 chars

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

### Material-fonte oficial Supabase (fornecido pelo user)
- 7 guias oficiais embutidos no CLAUDE.md do projeto: Realtime AI Assistant Guide · Bootstrap Next.js v16 + Supabase Auth (SSR) · Writing Edge Functions · Declarative Database Schema · RLS policies · Database Functions · Migrations · Postgres Style Guide
- Verbatim no início do `D:/projetos/opensource/mcp/CLAUDE.md` — agentes leem como ground truth

### Pesquisa do milestone (`.planning/research/`)
- `.planning/research/STACK.md` — componentes Supabase 2026 + versões verificadas (CLI v2.98.2, MCP server v0.8.1, pgmq Postgres 15.6.1.143+, pg_net v0.10.0, Branching 2.0)
- `.planning/research/FEATURES.md` — features esperadas + matriz table-stakes/differentiator + 8 anti-features documentadas
- `.planning/research/ARCHITECTURE.md` — 8 decisões arquiteturais + build order + tabela compatibilidade IDE
- `.planning/research/PITFALLS.md` — 26 pitfalls (12 packaging A1-A12 + 14 Supabase B1-B14) com sintoma/causa/prevenção/responsável
- `.planning/research/SUMMARY.md` — síntese das 4 dimensões + recomendação de escopo expandido

### Roadmap + requisitos
- `.planning/PROJECT.md` — milestone v1.8 specification
- `.planning/REQUIREMENTS.md` §SB-S01..SB-S11 + SB-D01 (12 REQs cobertos por esta fase)
- `.planning/ROADMAP.md` §Phase 25 — critérios de sucesso e anti-pitfalls cobertos

### Precedentes no kit-mcp
- `D:/projetos/opensource/mcp/kit/skills/example-skill/SKILL.md` — template mínimo de skill (formato frontmatter + estrutura básica)
- `D:/projetos/opensource/mcp/kit/agents/schema-checker.md` — precedente de uso de tools `mcp__supabase__*` (com UUID hardcoded a migrar na Phase 28 — para Phase 25 não-relevante)

### Fontes oficiais Supabase para validação online (durante implementação)
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — pitfall B4
- [Database Advisors lint 0011](https://supabase.com/docs/guides/database/database-advisors) — pitfall B7
- [Splinter linter 0015](https://supabase.github.io/splinter/0015_rls_references_user_metadata/) — pitfall B5
- [pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) — skill SB-S10
- [Storage Buckets Fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) — skill SB-S09
- [Cron + Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — skill SB-S11

</canonical_refs>

<code_context>
## Insights de Código Existente

### Ativos Reutilizáveis
- `kit/skills/example-skill/SKILL.md` — template de skill (frontmatter + sections) — usar como ponto de partida
- 7 guias Supabase no `CLAUDE.md` — material-fonte literal para extrair patterns

### Padrões Estabelecidos
- Skills no kit usam frontmatter YAML com `name:` + `description:` (≤ 200 chars enforce na Phase 28)
- Skills auto-contidas (anti-pitfall A8 — stub-only sync mode preserva expertise)
- `_shared/` directory já existe como precedent em v1.7 (`kit/agents/_shared/output-style.md`)
- Naming flat com prefixo (sem subárvore) — `kit/skills/example-skill/`, futuro `kit/skills/supabase-*/`

### Pontos de Integração
- `src/core/kit.js` `listSkills()` lê `kit/skills/*/SKILL.md` automaticamente — novas skills aparecem no listKit sem mudança de código
- `src/core/sync.js` projeta skills para 8 IDE targets em layouts nativos — testado em todos os 8 desde v1.0
- `gates/skill-must-include.mjs` (a criar na Phase 28) lerá `gates/lib/supabase-must-include.json` para validar strings obrigatórias por skill

</code_context>

<specifics>
## Ideias Específicas

- **Material-fonte:** os 7 guias oficiais Supabase no `CLAUDE.md` do projeto são autoridade canônica. Skills devem ser **fiéis ao conteúdo** desses guias mas adaptadas para formato de SKILL.md (PT-BR narrative + code blocks EN com comentários PT-BR pedagógicos).
- **Não inventar patterns** — se o material-fonte ou docs Supabase oficiais não documentam, não documentar como pattern canônico (anti-pitfall A11 idioma misto + fonte canônica).
- **Skills críticas para anti-pitfalls de segurança** (B5 user_metadata, B6 service_role, B7 search_path) ganham WARNING explícito em maiúscula no topo da seção `## Regras absolutas`.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — discussão ficou dentro do escopo da fase. Skills extras (auth-mfa, multi-tenant, branches, fts, frontends extras) já estão em "Requisitos Futuros" do REQUIREMENTS.md para v1.9+.

</deferred>

---

*Fase: 25-fundamentos-11-skills-supabase-gloss-rio-compartilhado*
*Contexto coletado: 2026-05-06*
