# REQUIREMENTS — kit-mcp v1.7

**Milestone:** v1.7 — perf+lean part 2 + UX naming canonical
**Aberto em:** 2026-05-06
**Status:** Definindo

> Continuação direta de v1.6. Onda 1 (kit doctor + upgrade-check + gates cache) já entregue em v1.6.1. Esta milestone aborda Onda 2 do plano de melhorias.

---

## Requisitos do Milestone v1.7

### Performance — workflow + sync slim

- [ ] **PERF-W1**: `discuss-phase.md` compactado de ~49 KB para ≤ 35 KB sem perder regras críticas — remover redundância prosa, consolidar headers. (`kit/framework/workflows/discuss-phase.md`)
- [ ] **PERF-W2**: `new-project.md` compactado de ~40 KB para ≤ 28 KB. (`kit/framework/workflows/new-project.md`)
- [ ] **PERF-W3**: `plan-phase.md` compactado de ~36 KB para ≤ 26 KB. (`kit/framework/workflows/plan-phase.md`)
- [ ] **PERF-S1**: `listKit({ stubsOnly: true })` lê apenas frontmatter, pulando body parse. Usado por `syncTo` em mode=reference (default). Stable API: full read continua disponível pra mode=copy e action=get. (`src/core/kit.js`, `src/core/sync.js`)

### Tokens — agent boilerplate dedup

- [ ] **TOK-D1**: Extrair `<output_style>` (caveman + boundary PLAN.md) pra `kit/agents/_shared/output-style.md`. Agents importam via `@reference`. Atualmente repetido em 12+ agents. (`kit/agents/*.md`, `kit/agents/_shared/output-style.md`)
- [ ] **TOK-D2**: Extrair regras comuns de frontmatter validation pra `kit/agents/_shared/frontmatter-rules.md`. (`kit/agents/*.md`, `kit/agents/_shared/frontmatter-rules.md`)
- [ ] **TOK-D3**: Sync respeita `_shared/` — não projeta esses arquivos como agents independentes; resolução de `@reference` acontece no consumidor (Claude Code). (`src/core/sync.js`, `src/core/kit.js`)

### UX — naming canonical

- [ ] **UX-F1**: `/fazer` é o entrypoint canônico com árvore de decisão documentada (rotaria pra `/rapido` em trivial, `/expresso` em rápido-com-garantias, `/planejar-fase` em estruturado). (`kit/commands/fazer.md`)
- [ ] **UX-F2**: `/rapido`, `/expresso`, `/proximo` permanecem com seus próprios `.md` mas com seção "Quando usar" linkando de volta a `/fazer`. Não-quebra: usuários que conhecem os nomes específicos continuam funcionando. (`kit/commands/{rapido,expresso,proximo}.md`)
- [ ] **UX-F3**: Help do `kit ajuda` (e equivalente CLI) destaca `/fazer` como entrada recomendada, com tabela "se você quer X, use Y". (`kit/commands/ajuda.md`, possivelmente `src/cli/index.js`)

---

## Requisitos Futuros (adiados)

- U2 active command panel no sidecar (precisa decisão de UI)
- U5 permission-less autonomous trust mode (precisa coordenação com Claude Code permissions API)
- Multi-source tabs no sidecar (cross-IDE, multi-project aggregation)

## Fora do Escopo

- Reescrita de `src/core/` — Stable API v1.0+ preservada
- Migração de framework de teste (`node:test` zero-dep continua sendo princípio)
- Sidecar autenticado / multi-user (fora do threat model atual)

## Rastreabilidade

(preenchida pelo roadmap em ROADMAP.md)
