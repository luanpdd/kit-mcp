---
name: ui-critica-auditoria
description: Use ao revisar UI implementada — critica (Nielsen 10 heuristicas + carga cognitiva /8 + tells-IA pass/fail) + auditoria (a11y/perf/theming/responsive P0-P3). Produz REVISAO-UI.md scored.
---

# UI — Crítica & Auditoria

## Quando usar

LLM carrega esta skill quando:

- "Audite design / revise UI / está bom?"
- "Está pronto para ship?"
- "Score this design / quão ruim é o tell de IA?"
- Antes de release de feature visível
- Em PR de mudança visual significativa

**NÃO use em:**
- Work-in-progress (vai pontuar mal porque incompleto, não porque ruim)
- Componente isolado fora de página real
- Code-only review (precisa ver rendered)

## Regras absolutas

**REGRA #1 (duas passadas independentes):** Rode **crítica** (LLM + heurísticas, subjetivo) E **auditoria** (5 dimensões, determinístico) **separadamente**. Não bias um pelo outro. Findings convergentes têm peso 2×.

**REGRA #2 (P0-P3 severity definida):**
- **P0** — Bloqueia release (a11y crítica, tell-IA deal-breaker, UX quebrado)
- **P1** — Resolver neste sprint (gaps notáveis, tell parcial)
- **P2** — Próximo ciclo (refinamento)
- **P3** — Polimento (nice-to-have)

**REGRA #3 (score antes da opinião):** Heuristic scores são numéricos (0-4), prioridade de fixes é opinião. Cliente pode discordar de prioridade, não de score.

**REGRA #4 (route, don't fix):** Auditoria documenta, não corrige. Findings vão para:
- a11y, contrast → `ui-cor-estrategia` + endurecer phase
- tells de IA → `ui-anti-padroes-ia` patches
- Performance → otimizar phase
- Typography → `ui-tipografia` refactor

## Passada Crítica — Nielsen 10 (0-4 cada)

| # | Heurística | Como medir |
|---|-----------|------------|
| 1 | Visibility of system status | Loading states? Optimistic UI? Toast feedback? |
| 2 | Match with real world | Vocabulário do domínio? Ícones reconhecíveis? Locale-aware? |
| 3 | User control & freedom | Undo? Cancel em modais? Botão back claro? Confirm em destrutivo? |
| 4 | Consistency & standards | Mesmo padrão de botão em todas telas? CTAs consistentes? |
| 5 | Error prevention | Validation inline? Confirm em destrutivo? Disable em estado inválido? |
| 6 | Recognition over recall | Labels visíveis vs precisar lembrar? Recent items? Autocomplete? |
| 7 | Flexibility & efficiency | Keyboard shortcuts? Power-user paths? Bulk actions? |
| 8 | Aesthetic & minimalist | Algo na tela não é essencial? Card aninhado? Decoração gratuita? |
| 9 | Help users recognize errors | Mensagem específica + recovery action? Não "Something went wrong" genérico? |
| 10 | Help & documentation | Inline help em fields complexos? Empty state ensina? Onboarding presente? |

**Scoring:**
- 4 — Excelente, supera expectativa
- 3 — Bom, alguns gaps menores
- 2 — Cumprido parcialmente, gaps notáveis
- 1 — Falha na maioria dos cenários
- 0 — Ausente / quebrado

## Passada Crítica — Carga cognitiva (/8)

Conte falhas. Para cada uma, +1 ao counter:

1. Mais de 7±2 elementos competindo por atenção em viewport inicial?
2. Hierarquia visual ambígua (qual é a ação primária)?
3. Vocabulary mismatch (jargão técnico em UI consumer)?
4. Decisões prematuras pedidas (escolha de plano antes de ver valor)?
5. Estado escondido (qual aba está ativa? qual filtro aplicado?)?
6. Confirmação ausente em destrutivo, ou excessiva em trivial?
7. Loading sem progress signal em > 1s waits?
8. Layout shift visível durante load (CLS > 0.1)?

Score: 0-2 falhas = bom, 3-4 = preocupante, 5+ = redesign.

## Passada Crítica — Verdict de Tells-IA (pass/fail)

Rode o detector da skill [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md). Verdict:

- **PASS** — zero P0, ≤ 2 P1 com justificativa em DESIGN.md
- **MARGINAL** — 1 P0 OU > 2 P1
- **FAIL** — ≥ 2 P0 OU padrão sistêmico de tells

Liste os tells específicos: `verdict: FAIL · gradiente-roxo · italic-serif-hero · card-aninhado`.

## Passada Auditoria — 5 dimensões (0-4 cada)

### D1 Accessibility (0-4)

Check:
- [ ] WCAG AA contrast pass para foreground/background pairs (`npx pa11y`)
- [ ] Todo input tem `<label>` ou `aria-label`
- [ ] Botão de ícone sem texto tem `aria-label`
- [ ] Keyboard nav: Tab order lógico, focus visible
- [ ] Semantic HTML (`<button>` não `<div onClick>`)
- [ ] Skip-to-content em layouts longos

### D2 Performance (0-4)

Check:
- [ ] LCP < 2.5s (Lighthouse mobile)
- [ ] CLS < 0.1
- [ ] Bundle JS first-load < 200KB gzipped
- [ ] Imagens com `loading="lazy"` e dimensions
- [ ] Sem layout-thrashing animations (height/width transitions)
- [ ] Lighthouse Perf score ≥ 90

### D3 Theming (0-4)

Check:
- [ ] Zero HEX/RGB hard-coded em components (use tokens)
- [ ] Dark mode covered (se declarado em MARCA.md)
- [ ] Tokens semânticos não nomes de cor (`--primary`, não `--blue-500`)
- [ ] Sem `!important` em styles
- [ ] CSS custom properties consistentes entre `:root` e `.dark`

### D4 Responsive (0-4)

Check:
- [ ] Breakpoints: mobile (375), tablet (768), desktop (1024+) todos testados
- [ ] Touch targets ≥ 44×44 em mobile
- [ ] Horizontal scroll só em data tables (nunca em layout)
- [ ] Texto reflow em narrow (não cortado, não overflow)
- [ ] Hover-only interactions têm equivalente touch

### D5 Anti-patterns (0-4)

Rode o detector da [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md). Score:
- 4 = zero P0/P1
- 3 = 1 P1 documentado
- 2 = 2-3 P1 OU 1 P0 documentado
- 1 = ≥ 2 P0
- 0 = sistêmico

## Output — REVISAO-UI.md

```markdown
# Revisão de UI — {nome da feature/página}

**Revisado:** {data}
**Revisor:** designer-ui (kit)
**Registro:** {marca | produto}
**Baseline:** {DESIGN.md path | abstract defaults}

---

## TL;DR

**Verdict tells-IA:** {PASS | MARGINAL | FAIL} — {tells}
**Crítica total:** {soma dos 10 Nielsen}/40
**Carga cognitiva:** {N}/8 falhas
**Auditoria total:** {soma das 5 dimensões}/20

**Recomendação:** {SHIP | FIX-P0-PRIMEIRO | REWORK}

---

## Passada Crítica

### Nielsen Heuristics

| # | Heurística | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | {0-4} | {linha resumo} |
| 2 | Match with real world | {0-4} | … |
| 3 | User control | {0-4} | … |
| … | … | … | … |

**Subtotal:** {N}/40

### Falhas de Carga Cognitiva: {N}/8

{lista de falhas com referência arquivo:linha}

### Tells-IA detectados

{cole output do detector se houver hits}

---

## Passada Auditoria

| Dimensão | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| Accessibility | {0-4} | … | … | … | … |
| Performance | {0-4} | … | … | … | … |
| Theming | {0-4} | … | … | … | … |
| Responsive | {0-4} | … | … | … | … |
| Anti-patterns | {0-4} | … | … | … | … |

**Subtotal:** {N}/20

---

## Top 5 Priority Issues

1. **[P0]** {issue} — `{file:line}` — {fix opinion (route para qual skill)}
2. **[P0]** … — … — …
3. **[P1]** … — … — …
4. **[P1]** … — … — …
5. **[P2]** … — … — …

---

## Perguntas Provocativas

(Questões "vale responder antes de shippar")

1. {ex: "Esta tela funciona em mobile com 1 mão? Você testou?"}
2. {ex: "O empty state ensina o usuário ou só diz 'No data'?"}
3. {ex: "Qual é a UMA ação que esta página existe para promover?"}

---

## Routing

- P0/P1 a11y → `ui-cor-estrategia` + endurecer phase
- P0/P1 tells → `ui-anti-padroes-ia` patches inline
- Performance → otimizar phase
- Typography → `ui-tipografia` audit
- Layout → `ui-ritmo-espacial` audit
```

## Anti-patterns DESTA skill

### Anti-pattern 1: review em WIP

**Errado:** rodar audit em página com placeholders, lorem ipsum, estados não implementados.

**Por quê:** "incomplete work scores badly because it is not done, not because it is bad". Cliente acha que tem problema de design quando é só falta acabar.

**Certo:** audit apenas em features completas. Para WIP use `ui-anti-padroes-ia` detector preventivo + checklist visual sem score.

### Anti-pattern 2: misturar crítica e auditoria

**Errado:** rodar Nielsen + dimensões juntos, score combinado.

**Por quê:** REGRA #1 — bias mútuo. LLM sabendo que tem tell-IA ajusta Nielsen down. Detector sabendo que Nielsen está alto sub-conta.

**Certo:** dois reviews separados, mesclar findings no REVISAO-UI.md no fim.

### Anti-pattern 3: prioridade sem evidência

**Errado:** "Priority 1: fix the gradient" sem citar arquivo, sem dizer por quê P0.

**Por quê:** Não acionável. Outro dev não sabe onde fixar nem se realmente é P0.

**Certo:** "**[P0]** Hero gradiente roxo (`Hero.tsx:42-48`) — T01 tell-IA, ship blocker. Fix: replace `bg-gradient-to-br from-purple-500 to-pink-500` with `bg-primary` per DESIGN.md > Cores > Destaque."

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — feeds verdict de tells-IA + D5
- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — baseline para audit
- [ui-cor-estrategia](../ui-cor-estrategia/SKILL.md) — fixes para D1/D3
- [ui-tipografia](../ui-tipografia/SKILL.md) — fixes para typography findings
- [ui-ritmo-espacial](../ui-ritmo-espacial/SKILL.md) — fixes para D4 responsive
- [ui-motion-funcional](../ui-motion-funcional/SKILL.md) — motion review
- Nielsen 10 heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
