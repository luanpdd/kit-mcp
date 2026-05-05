# ROADMAP — kit-mcp v1.6

**Milestone:** v1.6 — perf+lean (interno)
**Numeração de fases:** continua de v1.2 (que terminou em fase 18) → v1.6 começa em **Fase 19**
**Total de REQs cobertos:** 16 (PERF 5 + SEC 4 + INF 4 + TOK 3)
**Total de fases:** 3 (Fases 19–21)
**Criado:** 2026-05-05

---

## Visão geral do milestone

Endereçar 16 itens de auditoria (perf + segurança + infra + tokens) que ficaram fora do bundle quick-win 1.5.3. Sem features novas; sem mudanças de API runtime. Princípio de ordenamento: **risk-monotonic** — quick-wins primeiro (Fase 19), hardening de segurança e perf médio depois (Fase 20), refactor de tokens (que tem mais blast radius cognitivo) por último (Fase 21).

Cada fase pode ser shipped independentemente como patch (1.6.0, 1.6.1, 1.6.2). Encerrar o milestone com um minor bump (v1.6.0) consolidado.

---

## Phase 19: Quick wins (perf + infra + token-trim)

**Tipo:** Mudanças mecânicas, baixo risco, alto ROI
**Por que primeiro:** Todas P (≤30 min cada), zero blast radius, validáveis com testes existentes ou triviais novos. Liberam latência e tokens imediatamente.

**REQs cobertos:**
- **PERF-01** — listKit cache TTL 30s
- **PERF-02** — regex frontmatter top-level
- **PERF-03** — sync/reverse-sync aceitam kit pré-carregado
- **SEC-04** — npm audit no CI
- **INF-02** — `.npmignore` explícito
- **INF-03** — Node 24 na matriz CI
- **INF-04** — mensagem deps-budget sincronizada

> **Nota de escopo:** TOK-03 (consolidar headers do planner.md) movido para Fase 21 — fica ao lado de TOK-01 que reescreve o mesmo arquivo. Evita o trabalho de consolidar headers ser refeito durante a compactação 53→35 KB.

**Critérios de sucesso:**
1. `mcp__kit__kit list-agents` chamado 5× consecutivos lê disco apenas 1× (verificável por `fs.readFile` count)
2. CI roda em Node 20+22+24 e passa em todos
3. CI falha em CVE Alto+ injetada via fixture (test the test)
4. Tarball `npm pack` contém apenas o que está em `files`/`.npmignore`
5. `wc -l kit/agents/planner.md` ≤ 800 linhas (era 1373)

**Estimativa:** ~3h de execução real com pause-points entre REQs.

---

## Phase 20: Hardening (segurança + perf médio + infra)

**Tipo:** Mudanças que tocam caminhos críticos (lockfile, walkTree) e exigem testes novos cuidadosos
**Por que segundo:** Esforço M, risco "Médio" pelo agente de auditoria. Não bloqueante para users em uso normal, mas fecha vetores defensivos.

**REQs cobertos:**
- **PERF-04** — healthz probe timeout 500ms
- **PERF-05** — `/state` paginação opcional
- **SEC-01** — TOCTOU re-probe em acquireLockOrReclaim
- **SEC-02** — walkTree path normalize + reject `..`
- **SEC-03** — redactPath case-insensitive (Windows)
- **INF-01** — `prepublishOnly` script

**Critérios de sucesso:**
1. Teste de regressão simulando race lockfile passa (acquireLockOrReclaim em 50 chamadas paralelas, 0 false-positives de "ELIVE")
2. Teste de path traversal: `walkTree` com fixture contendo `../../etc/passwd` rejeita com erro claro
3. Test fixture Windows-style path `C:\Users\foo` é redatado mesmo em sysetm Linux/macOS (case-insensitive match)
4. `/state?offset=100&limit=50` retorna 50 events do índice 100; `/state` (sem query) retorna ring inteiro (compat)
5. `npm publish --dry-run` aciona `prepublishOnly` e fica vermelho se algum teste falhar

**Estimativa:** ~4h. Cada REQ tem teste novo dedicado.

---

## Phase 21: Token economy refactor (planner + CLAUDE.md)

**Tipo:** Refactor de prompt engineering com validação semântica (não só wc -c)
**Por que terceiro:** Esforço M-G, mas risco real é "perdi regra crítica do agent". Precisa de pareamento entre redução e amostragem comportamental do agent.

**REQs cobertos:**
- **TOK-01** — planner.md ≤ 35 KB (de 53 KB)
- **TOK-02** — CLAUDE.md gerado: summaries em vez de descrições inteiras
- **TOK-03** — consolidar headers em planner.md (72 → ≤ 25), feito junto da compactação

**Critérios de sucesso:**
1. `wc -c kit/agents/planner.md` ≤ 35840 (35 KB)
2. Prompt do planner ainda contém: regras de scope_estimation, philosophy mínima (1 parágrafo), critérios de quality, ordenação interface-primeiro
3. Smoke test conversacional: invocar planner em fixture sintética → roteia para output válido (compatível com `<task>` schema)
4. `CLAUDE.md` gerado por `kit sync claude-code --dry-run` é ≥ 5 KB menor que baseline v1.5.3
5. Sync para outras IDEs (cursor, codex) ainda compila listas válidas — diff só em densidade, não em estrutura

**Estimativa:** ~3h. Loop de redução + validação semântica.

---

## Sequenciamento e ship strategy

| Patch | Fase | REQs | Cumulativo |
|---|---|---|---|
| 1.6.0 | 19 (Quick wins) | 8 | 8/16 |
| 1.6.1 | 20 (Hardening) | 6 | 14/16 |
| 1.6.2 | 21 (Token refactor) | 2 | 16/16 |
| 1.6.3 | (folga p/ followups) | — | — |

Cada patch é shippable e tem CHANGELOG dedicado. Se algo der errado em Phase 21, Phase 19+20 já estão na main como 1.6.0+1.6.1.

---

## Rastreabilidade

| Phase | REQ | Local de mudança | Tipo de validação |
|---|---|---|---|
| 19 | PERF-01 | `src/core/kit.js` | unit test (cache hit/miss) |
| 19 | PERF-02 | `src/core/kit.js` | unit test (regex constant) |
| 19 | PERF-03 | `src/core/sync.js`, `src/core/reverse-sync.js` | unit test (passing kit param) |
| 19 | SEC-04 | `.github/workflows/ci.yml` | CI run |
| 19 | INF-02 | `.npmignore` ou `package.json` | `npm pack` inspect |
| 19 | INF-03 | `.github/workflows/ci.yml` | CI matrix |
| 19 | INF-04 | `.github/workflows/ci.yml` | grep test |
| 19 | TOK-03 | `kit/agents/planner.md` | `wc -l` + smoke conversational |
| 20 | PERF-04 | `src/ui/lockfile.js` | unit test (timeout) |
| 20 | PERF-05 | `src/ui/server.js` | integration test (offset+limit) |
| 20 | SEC-01 | `src/ui/lockfile.js` | concurrency test |
| 20 | SEC-02 | `src/core/sync.js` | unit test (path traversal fixture) |
| 20 | SEC-03 | `src/ui/wrapper.js` | unit test (Windows-style paths) |
| 20 | INF-01 | `package.json` | `npm publish --dry-run` |
| 21 | TOK-01 | `kit/agents/planner.md` | `wc -c` + smoke |
| 21 | TOK-02 | `src/core/sync.js` | snapshot diff |

Cobertura: 16/16 (100%).

---

## Pitfalls antecipados

1. **PERF-01 (cache)** — invalidação. Decisão: TTL absoluto 30s, sem invalidação por mudança de file. Quem editar `kit/` durante uma session aceita 30s de stale. Tests cobrem TTL respect.
2. **TOK-03 (headers)** — perda de hierarquia visual em agents enormes. Decisão: substituir por bullets ou tabelas, não eliminar conteúdo.
3. **TOK-01 (planner)** — redução de 18 KB é grande. Validação semântica obrigatória: amostragem do planner em fixtures conhecidas antes de aprovar.
4. **SEC-02 (walkTree)** — path traversal pode ter casos edge em Windows (UNC, drive letters). Test fixtures cobrem ambos.
