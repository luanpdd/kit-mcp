# Fase 149: Skill nova `supabase-branching-workflow` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar skill canônica nova `supabase-branching-workflow` em `kit/skills/supabase-branching-workflow/SKILL.md` cobrindo:
- Diferença preview (ephemeral, auto-pause, auto-delete em PR merge/close) vs persistent branches (long-lived staging/QA)
- Deploy DAG 7 steps (clone → pull → health → configure → migrate → seed → deploy) + skip behavior em falha de parent
- GitHub integration setup (Authorize Supabase, working directory, automatic branching, "Supabase changes only" filter, deploy to production toggle)
- Dashboard branching alpha caveats (custom roles não capturados, merge só p/ main, edge functions sobrescritas no update, delete manual em main)
- Custo Branching Compute Hours (Micro $0.01344/h, **fora do Spend Cap**, Compute Credits NÃO aplicam, billing como "Branching Compute Hours")

Entregar 5 REQs: BRANCH-01..05 da REQUIREMENTS.md.

Conteúdo PT-BR (convenção v1.22+). Code blocks YAML/SQL EN com comentários PT-BR. Material-fonte: 11 markdowns da doc oficial Supabase fornecidos no /novo-marco.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário. Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código para guiar decisões.

Pattern canônico herdado (v1.26 supabase-postgres-roles):
- Frontmatter YAML válido (name, description, version, when_to_use, model)
- Estrutura: Quando usar → Pattern canônico → Decisões canônicas → Anti-patterns → Cross-refs
- Tom: instrucional direto, exemplos concretos, anti-patterns explícitos

</decisions>

<code_context>
## Insights do Código Existente

Skills relacionadas que serão cross-ref:
- `kit/skills/supabase-migrations/SKILL.md` (v1.23) — migrations workflow
- `kit/skills/supabase-declarative-schema/SKILL.md` (v1.x) — schema management
- `kit/skills/evolucao-schema-compativel/SKILL.md` (v1.22) — 3-step migration safe
- `kit/skills/release-engineering/SKILL.md` — deployment philosophy
- `kit/skills/hermetic-builds/SKILL.md` — pipeline reproducibility

Contexto da base de código será coletado durante a pesquisa do plan-phase.

</code_context>

<specifics>
## Ideias Específicas

- Skill deve emitir aviso de custo Branching Compute Hours em **bloco destacado** (>>> ou !! ou similar) — não inline
- Warning sobre Compute Credits NÃO aplicarem é canônico da doc oficial (FAQ pricing)
- "Fora do Spend Cap" deve ser repetido explicitamente — surpresa de billing é alto risco
- Dashboard alpha caveats devem desencorajar uso para projects sério; recomendação canônica é GitHub integration

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
