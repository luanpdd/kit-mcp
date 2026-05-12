---
name: legacy
description: Orquestrador da Suíte Legacy Code (Feathers) — dispatch para agents (legacy-characterizer, seam-finder, refactor-safety-auditor) com sinônimos PT/EN.
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte Legacy Code — quarta suíte da família após [`/supabase`](./supabase.md) (v1.8), [`/observabilidade`](./observabilidade.md) (v1.9) e [`/sre`](./sre.md) (v1.10). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para o agent correto. **Único ponto de chain de agents legacy** (anti-pitfall A10 mantido — agents permanecem função pura).

**Subcomandos cobrem capítulos do livro Feathers:**
- `caracterizar` — characterization tests (cap 13 + 23)
- `encontrar-seams` — dependency-breaking via cap 25
- `auditar-refactor` — gate canônico pre-refactor (cap 1 — cover-and-modify)
- `refactor` — orquestrador completo de refactor (chain de tudo acima + execução)

**Cria/Atualiza:** o que cada agent invocado cria (characterization tests, SEAM-ANALYSIS.md, REFACTOR-SAFETY.md).

**Após:** o usuário tem o output do agent (suite de tests + análise de seams + veredito do gate + execução de refactor).
</objective>

<execution_context>
Skills consultadas pelos agents: [`kit/skills/legacy-characterization-tests/SKILL.md`](../skills/legacy-characterization-tests/SKILL.md), [`kit/skills/legacy-seams-and-test-harness/SKILL.md`](../skills/legacy-seams-and-test-harness/SKILL.md), [`kit/skills/legacy-sprout-wrap-techniques/SKILL.md`](../skills/legacy-sprout-wrap-techniques/SKILL.md), [`kit/skills/legacy-effect-analysis/SKILL.md`](../skills/legacy-effect-analysis/SKILL.md), [`kit/skills/legacy-monster-methods/SKILL.md`](../skills/legacy-monster-methods/SKILL.md), [`kit/skills/pre-refactor-characterization/SKILL.md`](../skills/pre-refactor-characterization/SKILL.md) + glossário em [`kit/skills/_shared-legacy/glossary.md`](../skills/_shared-legacy/glossary.md).

Agents disponíveis:
- [`legacy-characterizer`](../agents/legacy-characterizer.md) — gera characterization tests
- [`seam-finder`](../agents/seam-finder.md) — analisa seams + recomenda dependency-breaking
- [`refactor-safety-auditor`](../agents/refactor-safety-auditor.md) — gate canônico (BLOCK/WARN/GO/GO-OVERRIDE)
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Comando subjacente | Cap livro |
|---|---|---|---|
| `caracterizar` | `characterize`, `char`, `gen-tests` | `/caracterizar` | 13 + 23 |
| `encontrar-seams` | `find-seams`, `seams`, `break-deps` | `/encontrar-seams` | 25 |
| `auditar-refactor` | `audit-refactor`, `audit`, `gate` | `/auditar-refactor` | 1 + 13 |
| `refactor` | `refactor-seguro`, `refactor-safe`, `refator` | `/refactor-seguro` | (chain — todos) |
| `capturar-payloads` | `capture`, `capture-payloads` | `/capturar-payloads` | (modernização) |
| `caracterizar-prompt` | `char-prompt`, `prompt-char` | `/caracterizar-prompt` | (modernização) |
| `storytelling` | `story`, `story-do-codigo` | `/storytelling` | 16-17 (modernização IA) |
| `detectar-duplicacao` | `dup`, `shotgun`, `detect-duplicates` | `/detectar-duplicacao` | 21 (modernização IA) |
| `audit-coverage` | `cobertura`, `coverage-audit` | `/auditar-observabilidade-cobertura` | (modernização cross-suite) |
| `help` | `ajuda`, `?` | exibe esta tabela inline | — |

**Roteamento de flags por subcomando:**

- `caracterizar <target_file>` — flags `--symbol --min-inputs --gap-fill --fixtures-dir --no-mutation`
- `encontrar-seams <target_file>` — flags `--symbol --prefer --output`
- `auditar-refactor <target_file>` — flags `--change-kind --mode --ticket --reason`
- `refactor <target_file>` — flags `--mode (full|sprout|safe-extract|override) --ticket --reason --skip-seams --skip-characterize --symbol`

**Exemplos:**

```
/legacy caracterizar src/orders/handler.ts                  # characterization tests
/legacy seams supabase/functions/webhook/index.ts           # análise de seams
/legacy auditar-refactor src/api/v1/orders.ts               # gate antes de PR de refactor
/legacy refactor src/orders/handler.ts                      # chain completo
/legacy refactor src/orders/handler.ts --mode=sprout        # adicionar feature sem tocar legado
/legacy help                                                 # exibe tabela de subcomandos
```

**Quando este orquestrador é o caminho:**
- User quer dispatch único para legacy concerns
- Equipe usa também outras suítes (/sre, /supabase) e prefere namespace consistente
- Workflow integrado quer "legacy refactor" como capability nomeada
</context>

<process>

## 1. Parsear subcomando

```bash
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

```
LEGACY SUITE — orquestrador

Subcomandos:
  caracterizar       gen characterization tests (cap 13 + 23)
                     sinônimos: characterize, char, gen-tests
                     uso: /legacy caracterizar <file> [opções]

  encontrar-seams    análise de dependency-breaking (cap 25)
                     sinônimos: find-seams, seams, break-deps
                     uso: /legacy seams <file> [opções]

  auditar-refactor   gate canônico antes de refactor
                     sinônimos: audit-refactor, audit, gate
                     uso: /legacy gate <file> [opções]

  refactor           chain completo (seams → char → audit → execução)
                     sinônimos: refactor-seguro, refactor-safe, refator
                     uso: /legacy refactor <file> [--mode=full|sprout|safe-extract|override]

Workflow recomendado:
  1. /legacy auditar-refactor <file>       (descobrir veredito do gate)
  2. SE BLOCK: /legacy refactor <file>     (chain completo) OR --mode=sprout
  3. SE GO: refactor manual com confiança

Material-fonte: Working Effectively with Legacy Code — Feathers, 2004
                ISBN 978-0-13-117705-5
```

## 2. Resolver sinônimos para subcomando canônico

```text
caracterizar, characterize, char, gen-tests   → /caracterizar
encontrar-seams, find-seams, seams, break-deps → /encontrar-seams
auditar-refactor, audit-refactor, audit, gate → /auditar-refactor
refactor, refactor-seguro, refactor-safe, refator → /refactor-seguro
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  caracterizar      → gen characterization tests
  encontrar-seams   → análise de dependency-breaking
  auditar-refactor  → gate pre-refactor
  refactor          → chain completo (seams + char + audit + exec)

Uso: /legacy <subcomando> <args...>
Exemplo: /legacy refactor src/orders/handler.ts
```

## 3. Dispatch — caminhos por subcomando

### 3a. `caracterizar` → `/caracterizar` (que invoca `legacy-characterizer`)

```text
Comando equivalente:
  /caracterizar ${ARGS}

Não há agent direto — orquestrador delega para o comando file.
Em IDEs sem support a slash-command-routing, dispatch direto:

Task(
  subagent_type="legacy-characterizer",
  prompt="
${ARGS}

Aplicar skill legacy-characterization-tests. Gerar characterization tests cobrindo 7 grupos canônicos de equivalência. Output: tests/characterization/<file_stem>/ + warning de revisão obrigatória dos snapshots.
"
)
```

### 3b. `encontrar-seams` → `/encontrar-seams` (que invoca `seam-finder`)

```text
Comando equivalente:
  /encontrar-seams ${ARGS}

Dispatch direto:
Task(
  subagent_type="seam-finder",
  prompt="
${ARGS}

Aplicar skill legacy-seams-and-test-harness. Mapear deps bloqueantes, identificar tipos de seam disponíveis, recomendar técnica do cap 25 com menor custo. Output: .planning/SEAM-ANALYSIS.md.
"
)
```

### 3c. `auditar-refactor` → `/auditar-refactor` (que invoca `refactor-safety-auditor`)

```text
Comando equivalente:
  /auditar-refactor ${ARGS}

Dispatch direto:
Task(
  subagent_type="refactor-safety-auditor",
  prompt="
${ARGS}

Aplicar skill pre-refactor-characterization. Coletar evidências (linhas, contrato externo, coverage, mutation kill). Aplicar matriz de decisão (3 critérios canônicos). Output: .planning/REFACTOR-SAFETY.md com veredito GO/BLOCK/WARN/GO-OVERRIDE.
"
)
```

### 3d. `refactor` → `/refactor-seguro` (orquestrador interno)

```text
Comando equivalente:
  /refactor-seguro ${ARGS}

Não dispatch direto para agent — refactor-seguro é ele próprio orquestrador
que chama os 3 agents em sequência conforme mode escolhido.

Re-encaminhar via:
  /refactor-seguro ${ARGS}
```

## 4. Sugestões de chains comuns (pós-output)

Após dispatch, orquestrador pode sugerir chains comuns:

| Subcomando rodado | Chain natural |
|---|---|
| `caracterizar` | `/legacy auditar-refactor <same>` (verificar se gate libera) |
| `encontrar-seams` | aplicar técnicas + `/legacy caracterizar <same>` (após break-deps) |
| `auditar-refactor` (BLOCK) | `/legacy refactor <same> --mode=full` OR `--mode=sprout` |
| `auditar-refactor` (GO) | refactor manual + suite verde após cada commit |
| `refactor` (concluído) | `/instrumentar-fase` (v1.9) + `/prr <same>` (v1.10) |

## 5. Cross-suite — links para outras suítes

```
═══════════════════════════════════════════════════════════
 LEGACY SUITE · cross-references com outras suítes
═══════════════════════════════════════════════════════════

Suíte Observabilidade (v1.9):
  /instrumentar-fase   — bundle telemetria com refactor (ODD)
  /burn-rate-status    — monitor SLO durante refactor
  /investigar-producao — Core Analysis Loop se regression em prod

Suíte SRE (v1.10):
  /prr                 — Production Readiness Review pós-refactor
  /golden-signals      — instrumentar 4 signals em código refatorado
  /postmortem          — após incident pós-refactor

Suíte Supabase (v1.8):
  /supabase edge       — supabase-edge-fn-writer já gera código testável
  /supabase architect  — design considera testabilidade upfront

Fluxo Framework:
  /discutir-fase       — detecta refactor intent + sugere /legacy automaticamente
  /planejar-fase       — plan-checker bloqueia plano se task=refactor sem char
  /executar-fase       — executor invoca refactor-safety-auditor antes de tocar arquivo flagged
  /auditar-marco       — gate legacy-refactor-safety opt-in
  /forense             — postmortems pós-refactor consultam REFACTOR-SAFETY.md
```

</process>

<success_criteria>
- [ ] Subcomando resolvido (4 subcomandos × seus sinônimos)
- [ ] Dispatch via comando-arquivo direto OR via Task(subagent_type=...) — único ponto de chain (anti-pitfall A10)
- [ ] Subcomando inválido → mensagem clara com lista de 4 subcomandos válidos
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline com 5 linhas (4 + help)
- [ ] Args após subcomando passam transparentemente para o agent/comando
- [ ] Sugestões de chains comuns na tabela final (5 chains documentadas)
- [ ] Cross-references com Suítes Observabilidade, SRE, Supabase + fluxo framework
</success_criteria>
