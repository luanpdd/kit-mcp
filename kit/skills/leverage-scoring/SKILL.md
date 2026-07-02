---
name: leverage-scoring
cost_tier: leve
description: Schema canônico de Finding (Impact/Effort/Risk/Confidence + file:line) e fórmula Leverage=(Impact/Effort)×Confidence para priorizar achados de auditoria numa fila única comparável.
---

# Leverage scoring — schema e priorização canônica de findings

Skill canônica que define **como qualquer auditor do kit pontua e cita uma finding**, para que
achados de suites diferentes (security, isolation, release, toil, observability) possam ser
**fundidos numa fila única comparável** pelo agent `advisor-auditor` (comando `/auditar`). Absorve a
disciplina de evidência + alavancagem do padrão [`shadcn/improve`](https://github.com/shadcn/improve).

## Quando usar

- Em **todo agent `*-auditor`** ao emitir findings — em vez de só um veredito `P0/P1/P2` local e
  não-comparável entre suites.
- No `advisor-auditor` / `/auditar` ao normalizar e ordenar findings cross-suite.
- Sempre que precisar decidir "o que vale a pena primeiro" com base em evidência, não em vibe.

## Schema de Finding (campos obrigatórios)

```yaml
- id: SEC-03                      # <prefixo-da-suite>-<n>
  title: "SQL montado com input do request"
  category: security             # correctness|security|performance|tests|tech-debt|deps|dx|docs|direction
  evidence: "src/api/search.ts:88"   # OBRIGATÓRIO — file:line; sem isto NÃO é finding
  impact: 5                      # 1-5 (severidade do problema OU valor da melhoria)
  effort: M                      # S|M|L (tamanho do fix)
  risk: M                        # S|M|L (risco do PRÓPRIO fix de regredir)
  confidence: HIGH               # HIGH|MEDIUM|LOW (força da evidência)
  leverage: 2.33                 # derivado — ver fórmula
  why: "Input não-parametrizado vira string SQL — injeção direta."
  fix: "Trocar concatenação por query parametrizada / prepared statement."
```

**Regra de ouro:** finding sem citação `file:line` verificável **não entra na tabela** — vira no
máximo uma observação na seção de rejeitados. Sem evidência, não é finding.

## Fórmula de alavancagem

```
Leverage = (Impact / EffortNum) × ConfidenceWeight
```

| Eixo | Valores | Mapeamento numérico |
|---|---|---|
| Impact | 1–5 | usa o número direto |
| Effort | S / M / L | 1 / 2 / 3 |
| Confidence | HIGH / MEDIUM / LOW | 1.0 / 0.7 / 0.4 |
| Risk | S / M / L | informativo — empata desempate e modula veredito, não entra no produto |

Ordene a tabela por **Leverage decrescente**. `Risk=L` rebaixa um empate (fix arriscado espera).

### Derivação do veredito P0/P1/P2 (a partir do leverage, não ad-hoc)

| Leverage | Veredito |
|---|---|
| ≥ 3.0 | **P0** — alta alavancagem, faça primeiro |
| 1.0 – 2.99 | **P1** |
| < 1.0 | **P2** — provavelmente "não vale a pena agora" |

Um `impact: 5` de segurança com `confidence: LOW` (Leverage `5/2 × 0.4 = 1.0`) cai para P1 de
propósito: severidade alta + evidência fraca ≠ urgência. Confiança modela urgência, não certeza.

## Seção "considerado e rejeitado" (obrigatória)

Todo relatório lista também o que foi **investigado e descartado**, para não re-reportar trabalho
fechado e dar confiança de cobertura:

```md
## Considerado e rejeitado
- `src/cache.ts:30` — `any` no parser — **by-design** (boundary de I/O documentado no ADR-04).
- `src/util/date.ts:12` — suspeita de off-by-one — **mal-atribuído** (a linha real é :19, já coberto por teste).
- Duplicação search/view — **duplicata** de SEC-03 (mesmo cluster).
```

Motivos canônicos: `by-design` · `mal-atribuído` · `duplicata` · `fora-de-escopo`.

## Exemplo de tabela priorizada

| # | id | Finding | Local | Impact | Effort | Conf | Leverage | Veredito |
|---|----|---------|-------|:---:|:---:|:---:|:---:|:---:|
| 1 | SEC-03 | SQL de input não-parametrizado | `src/api/search.ts:88` | 5 | M | HIGH | 2.50 | P1 |
| 2 | PERF-01 | N+1 no list render | `src/list.tsx:40` | 3 | S | HIGH | 3.00 | P0 |
| 3 | TOIL-02 | Deploy manual sem script | `Makefile` | 4 | M | MEDIUM | 1.40 | P1 |

> `PERF-01`: `(3/1)×1.0 = 3.00` → P0 mesmo com impacto menor, porque o fix é barato e a evidência forte.

## Relacionados

- [[agent-safety-hard-rules]] — disciplina read-only + masking de secret que estes relatórios seguem.
- Consumidor: o agent `advisor-auditor` (comando `/auditar`) funde os findings de N auditores neste
  schema numa única tabela cross-suite ordenada por leverage.
