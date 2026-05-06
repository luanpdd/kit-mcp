# ROADMAP — kit-mcp v1.7

**Milestone:** v1.7 — perf+lean part 2 + UX naming canonical
**Numeração de fases:** continua de v1.6 (terminou em fase 21) → v1.7 começa em **Fase 22**
**Total de REQs cobertos:** 10 (PERF-W1/W2/W3 + PERF-S1 + TOK-D1/D2/D3 + UX-F1/F2/F3)
**Total de fases:** 3 (Fases 22-24)
**Criado:** 2026-05-06

---

## Visão geral do milestone

Continuar v1.6 com cuts mais profundos em workflows + sync stub-mode + dedup de boilerplate de agentes. Adicionar `/fazer` como entrypoint canônico que cobre os outros como aliases. Sem features novas; sem mudanças de API runtime.

---

## Phase 22: Workflow compaction (PERF-W1/W2/W3)

**Tipo:** Editorial — compactação de prompts grandes
**Por que primeiro:** Maior ganho absoluto de tokens (49+40+36 = 125 KB de input atual). Aplica playbook já validado em v1.6 no `planner.md`. Risco semântico: perder regra crítica — validação obrigatória via grep dos termos-chave após cada cut.

**REQs cobertos:** PERF-W1, PERF-W2, PERF-W3

**Critérios de sucesso:**
1. `wc -c kit/framework/workflows/discuss-phase.md` ≤ 35840
2. `wc -c kit/framework/workflows/new-project.md` ≤ 28672
3. `wc -c kit/framework/workflows/plan-phase.md` ≤ 26624
4. Termos-chave preservados em cada workflow (regras de questionamento, fluxo de fases, retorno estruturado)
5. Smoke test: invocar `/discutir-fase`, `/novo-projeto`, `/planejar-fase` em fixture sintético — checklist de output structurado bate com baseline

**Estimativa:** ~3h. Cada workflow é uma sessão dedicada de revisão+cut.

---

## Phase 23: Stub-only sync mode (PERF-S1)

**Tipo:** Mudança no core/kit.js — adição de opção
**Por que segundo:** Esforço M-G; ganho perceptível em `kit sync` que é rodado várias vezes em dev. Stable API: comportamento default muda de "lê content" pra "lê só frontmatter" em mode=reference, mas content continua disponível em mode=copy/action=get.

**REQs cobertos:** PERF-S1

**Critérios de sucesso:**
1. `listKit({ stubsOnly: true })` retorna kit sem `content`/`body`/`skillContent`, só metadata
2. `syncTo(target, { mode: 'reference' })` usa stubsOnly internamente — confirmado por benchmark <50ms para kit típico (vs ~300ms hoje)
3. `syncTo(target, { mode: 'copy' })` continua lendo content full — teste cobre
4. `mcp__kit__kit action=get` retorna content full — teste existente passa
5. `clearKitCache()` invalida ambos os modes (cached por hash de chaves)

**Estimativa:** ~2h. Cache key precisa diferenciar stubs vs full.

---

## Phase 24: Agent boilerplate dedup (TOK-D1/D2/D3) + `/fazer` canonical (UX-F1/F2/F3)

**Tipo:** Refactor estrutural + edição de docs
**Por que último:** Dedup de boilerplate é structural — cria `kit/agents/_shared/` e altera 12+ agents. Risco de quebrar projeção sync. `/fazer` canonical é decisão de naming sem código novo.

**REQs cobertos:** TOK-D1, TOK-D2, TOK-D3, UX-F1, UX-F2, UX-F3

**Critérios de sucesso:**
1. `kit/agents/_shared/output-style.md` e `frontmatter-rules.md` existem e são auto-contidos (válidos como prompts independentes)
2. 12+ agents reduzidos em ≥5 KB cada após substituir blocos repetidos por `@reference` ou link de leitura obrigatória
3. `kit sync claude-code` não projeta `_shared/` como agent independente (excluído via `kit.js` ou via filename pattern `_*`)
4. `/fazer` documenta árvore de decisão: trivial→`/rapido`, rápido-com-garantias→`/expresso`, estruturado→`/planejar-fase`
5. `/rapido`, `/expresso`, `/proximo` cada um tem seção "Quando usar" linkando de volta a `/fazer`
6. `kit ajuda` (CLI + slash) lista `/fazer` primeiro com tabela "se você quer X, use Y"

**Estimativa:** ~3h.

---

## Sequenciamento e ship strategy

| Patch | Fase | REQs | Cumulativo |
|---|---|---|---|
| 1.7.0 | 22 (Workflow compaction) | 3 | 3/10 |
| 1.7.1 | 23 (Stub-only sync) | 1 | 4/10 |
| 1.7.2 | 24 (Boilerplate dedup + naming) | 6 | 10/10 |

Cada fase shippable independentemente. Falha em fase posterior não invalida anteriores.

---

## Rastreabilidade

| Phase | REQ | Local | Validação |
|---|---|---|---|
| 22 | PERF-W1 | `kit/framework/workflows/discuss-phase.md` | `wc -c` + grep termos-chave |
| 22 | PERF-W2 | `kit/framework/workflows/new-project.md` | `wc -c` + grep |
| 22 | PERF-W3 | `kit/framework/workflows/plan-phase.md` | `wc -c` + grep |
| 23 | PERF-S1 | `src/core/kit.js`, `src/core/sync.js` | benchmark + testes existentes passam |
| 24 | TOK-D1 | `kit/agents/_shared/output-style.md` + 12 agents | `wc -c` |
| 24 | TOK-D2 | `kit/agents/_shared/frontmatter-rules.md` + agents | `wc -c` |
| 24 | TOK-D3 | `src/core/kit.js` ou pattern filter | sync ignora `_shared/` |
| 24 | UX-F1 | `kit/commands/fazer.md` | conteúdo da árvore de decisão |
| 24 | UX-F2 | `kit/commands/{rapido,expresso,proximo}.md` | seção "Quando usar" |
| 24 | UX-F3 | `kit/commands/ajuda.md` | tabela "se você quer X" |

Cobertura: 10/10 (100%).

---

## Pitfalls antecipados

1. **PERF-W1/W2/W3** — perder fluxo de checkpoint do questionamento. Validação: replay de fixture conhecido produz mesmo output structurado.
2. **PERF-S1** — cache key colidir entre full e stubs. Solução: chave separada (`${kitRoot}:full` vs `${kitRoot}:stubs`).
3. **TOK-D3** — `_shared/` projetado como agent quebra sync downstream. Validação: `kit sync` mostra agents sem `_shared` na lista.
4. **UX-F3** — quebra hábitos de quem aprendeu nomes específicos. Mitigação: aliases mantidos sem deprecation; mensagem "também disponível como X" no help.
