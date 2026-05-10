# Fase 118: Consistência Leitura Réplica - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento (autonomo workflow content-only)
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Materializar 1 skill da Suíte DDIA Foundations v1.22 cobrindo problemas de replication lag (DDIA Ch 5):

1. Skill `kit/skills/consistencia-leitura-replica/SKILL.md` — 3 problemas canônicos DDIA Ch 5 (read-after-write, monotonic reads, consistent prefix reads) + 3 soluções para Supabase + Supavisor read replica routing + padrão "ler o próprio broadcast" Realtime.

REQs cobertos: LEITURA-01..04 (4 critérios — 3 problemas, 3 soluções, Supavisor routing, broadcast pattern).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via workflow.skip_discuss=true. Decisões guiadas por:
- Pattern do `kit/skills/multi-tenant-performance-scaling/SKILL.md` (v1.21) como template estrutural (frontmatter + Quando usar + Regras absolutas + Patterns canônicos + Anti-patterns + Ver também).
- Material-fonte DDIA Ch 5 linhas 6855-7073 (Reading your own writes, Monotonic reads, Consistent prefix reads) e 8079-8150 (summary).
- Convenção PT-BR de naming v1.22 documentada em `_shared-dados-distribuidos/glossary.md` seção (i): nome do diretório PT-BR (`consistencia-leitura-replica`), frontmatter PT-BR, headings PT-BR, code blocks SQL/TS em EN com comentários PT-BR.

### Decisões cristalizadas pela pesquisa (vinculantes)
- Cross-refs ATIVOS para `_shared-dados-distribuidos/glossary.md` (Phase 117 — termos `read-after-write consistency`, `monotonic reads`, `consistent prefix reads`, `replication lag`, `leader-follower replication`).
- Cross-ref ATIVO para `supabase-realtime/SKILL.md` (v1.8) no padrão "ler o próprio broadcast".
- Cross-ref ATIVO para `multi-tenant-performance-scaling/SKILL.md` (v1.21) na seção Supavisor (porta 6543 vs 5432).
- Padrão `pg_last_wal_replay_lsn()` documentado com SQL completo.
- Tabela canônica de portas Supavisor (6543 transaction / 5432 session/líder).

</decisions>

<code_context>
## Insights do Código Existente

- `kit/skills/multi-tenant-performance-scaling/SKILL.md` (v1.21) — template estrutural canônico (REGRA #1..#5, patterns, anti-patterns, ver também).
- `kit/skills/_shared-dados-distribuidos/glossary.md` (v1.22) — termos canônicos PT-BR ↔ EN para cross-ref sem duplicação.
- `kit/skills/supabase-realtime/SKILL.md` (v1.8) — broadcast com `private:true`, naming `scope:entity:id`, payload pattern.
- `kit/skills/multi-tenant-performance-scaling/SKILL.md` (v1.21) — Supavisor connection string canônica (porta 6543).
- DDIA Ch 5 linhas 6858-7048 (Reading your own writes / Monotonic reads / Consistent prefix reads) — fonte autoritativa.
- `tools.cjs commit` — pattern de commit atômico já usado nas phases 116 e 117.

</code_context>

<specifics>
## Ideias Específicas

Padrão "ler o próprio broadcast" é a aplicação prática do livro DDIA Ch 5 ao stack Supabase: client confia em `payload.record` enviado via Realtime broadcast em vez de fazer SELECT subsequente que pode atingir réplica stale. Este padrão é a tradução pragmática de "consistent prefix reads requires snapshot isolation" (DDIA p. 159) para o contexto event-driven onde o próprio publisher é a fonte canônica do evento.

Cenário canônico documentado: client A INSERT → server emite broadcast → client B recebe → client B faz SELECT — pode receber dado stale (réplica não replicou ainda). Mitigação: trustar o payload broadcast.

</specifics>

<deferred>
## Ideias Adiadas

- Implementação real de `lastWriteTimestamp` em `@supabase/supabase-js` client (depende de Supabase SDK feature) — documentar pseudo-code apenas.
- Integração com `pgpool-II` ou `pgbouncer` standalone (Supabase usa Supavisor, fora do escopo).
- Routing automatico read-replica via `pooler.read.*` (futuro Supabase feature, mencionado na tabela mas sem código).

</deferred>
