# Fase 117: Glossário Compartilhado + Evolução de Schema Compatível (Ch 4) — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

Fundação da Suíte DDIA Foundations v1.22 (8ª suíte do kit-mcp), derivada de *Designing Data-Intensive Applications* (Martin Kleppmann, O'Reilly 2017, ISBN 978-1-449-37332-0). Cobre o capítulo 4 (Encoding & Evolution) + estabelece o vocabulário canônico PT-BR ↔ EN sobre o qual as 5 phases seguintes (118-121) se apoiam.

Dois deliverables únicos:

1. **`kit/skills/_shared-dados-distribuidos/glossary.md`** — referência compartilhada (não-skill, sem `description:` triggerável; não aparece em `listKit`). ≥15 termos canônicos PT-BR ↔ EN cobrindo replicação, isolamento, partitioning, consensus, streams. Cross-ref ATIVO para `_shared-supabase` e `_shared-multi-tenant` — não duplica termos. Inclui seção da convenção PT-BR de naming (a partir de v1.22).

2. **`kit/skills/evolucao-schema-compativel/SKILL.md`** — skill triggerável que documenta o padrão 3-passos para Postgres (add nullable → backfill batches → enforce NOT NULL) + análogos Avro/Protobuf de schema evolution (rename via view, alargamento, mudança de default) + rolling upgrade client-side com JWT/session compat + contratos API com versionamento de payload.

REQs cobertos: SUITE-03, EVOLUCAO-01, EVOLUCAO-02, EVOLUCAO-03, EVOLUCAO-04 (5 REQs).

Restrição: content-only milestone. Zero alterações em `src/core/`. Stable API v1.0+ preservada.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via `workflow.skip_discuss=true`. Decisões guiadas por:
- Pattern do `_shared-multi-tenant/glossary.md` (v1.21) como template estrutural para o novo glossário
- Pattern do `multi-tenant-rls-hierarchy/SKILL.md` (v1.21) como template estrutural para a skill `evolucao-schema-compativel`
- Pattern do `116-CONTEXT.md` + `116-01-PLAN.md` como template para os artefatos de framework

### Decisões cristalizadas (vinculantes)
- **Convenção de naming PT-BR (v1.22+):** novos artefatos PT-BR (`evolucao-schema-compativel`, `_shared-dados-distribuidos`); termos técnicos canônicos preservados (write skew, lost update, MVCC, RLS, CDC, snapshot isolation); artefatos pré-v1.22 NÃO renomeados retroativamente.
- **Convenção de conteúdo:** PT-BR em texto narrativo + headings + frontmatter description. Code blocks SQL/TS em EN com comentários PT-BR (precedente v1.8 → v1.21).
- **Cross-ref ATIVO:** glossário e skill linkam (não duplicam) termos já definidos em `_shared-supabase/glossary.md` (v1.8) e `_shared-multi-tenant/glossary.md` (v1.21).
- **Material-fonte:** DDIA capítulo 4 completo (linhas 4835-6133 de `.claude/ddia-extracted.txt`) para schema evolution + summaries dos capítulos 5/7/8/9/11 para termos do glossário.

### Específico desta phase
- Skill `evolucao-schema-compativel` traduz princípios genéricos do livro (Avro/Protobuf/Thrift) para Postgres específico — o livro fala de sistemas distribuídos em geral, sua aplicação a Postgres + Supabase Edge Functions é onde a skill agrega valor.
- Glossário inclui seção (e) "Convenção de naming PT-BR" para servir de referência canônica para as 5 phases seguintes — uma única fonte da verdade.

</decisions>

<code_context>
## Insights do Código Existente

- `kit/skills/_shared-supabase/glossary.md` (v1.8) — define termos `RLS`, `STABLE`, `pgmq`, `pg_cron`, `wal2json` etc. — cross-link, não duplicar.
- `kit/skills/_shared-multi-tenant/glossary.md` (v1.21) — define termos `tenant`, `org_id`, `audit log`, `super_admin`, `RBAC` etc. — cross-link, não duplicar.
- `kit/skills/multi-tenant-rls-hierarchy/SKILL.md` (v1.21) — template canônico de skill com 6 REGRAs absolutas, 4-5 patterns canônicos com SQL completo, 5 anti-patterns com Errado/Por quê/Certo, "Ver também" final.
- `kit/skills/_shared-multi-tenant/glossary.md` seção (e) — pattern Cross-Suite Invocation introduzido em v1.21; v1.22 herda esse padrão.
- `tools.cjs commit` (`.claude/framework/bin/tools.cjs`) — pattern de commit atômico já usado nas 11 phases v1.21.

</code_context>

<specifics>
## Ideias Específicas

- A convenção PT-BR é nova v1.22 — documentar EXPLICITAMENTE no glossário com exemplo PT-BR (`evolucao-schema-compativel`) vs EN preservado (`multi-tenant-rls-hierarchy`).
- Padrão 3-passos (add nullable → backfill → enforce NOT NULL) é a aplicação prática direta de "rolling upgrade" do livro DDIA Ch 4 para Postgres — citar a relação no contexto da skill.
- Análogos Avro → Postgres: rename com alias = `CREATE OR REPLACE VIEW`; alargamento de tipo = seguro; estreitamento = inseguro (precisa 3-passos com nova coluna).

</specifics>

<deferred>
## Ideias Adiadas

- Patches em skills existentes (v1.8/v1.21) que cross-referenciam `evolucao-schema-compativel` — tratados em Phase 123 (cross-suite integration).
- Agent `validador-evolucao-schema` que consome esta skill — Phase 122.
- Seção do README.md mencionando a Suíte DDIA — `/concluir-marco` final.
- Regen AUTOGEN-COUNTS + file-manifest.json — `/concluir-marco` final.

</deferred>
