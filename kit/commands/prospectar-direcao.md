---
name: prospectar-direcao
description: Despacha o agent direction-prospector e encaminha DIRECTION.md com 4-6 sugestões de direção priorizadas por leverage — alimenta /novo-marco e /adicionar-backlog.
argument-hint: "[project_root] [--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
---

<objective>
Prospectar **para onde o projeto pode ir a seguir** quando o objetivo do próximo milestone está
"A definir" — em vez de adivinhar a direção, o agente lê os sinais do repositório (TODOs, débito,
gaps de cobertura, STATE.md, git log, dependências) e produz uma carteira de **4-6 sugestões de
direção** comparáveis, cada uma pontuada por leverage.

Invoca o agente [`direction-prospector`](../agents/direction-prospector.md) que aplica a skill
[`leverage-scoring`](../skills/leverage-scoring/SKILL.md) — cada sugestão carrega `evidence`
(`file:line` ou commit), `impact`, `effort`, `confidence` e o `leverage` derivado, ordenadas pela
fórmula `Leverage = (Impact / Effort) × Confidence`.

**Cria/Atualiza:**
- `DIRECTION.md` (default `.planning/DIRECTION.md`) — 4-6 sugestões priorizadas com evidência

**Após:** o user tem uma carteira acionável. Cada sugestão pode ser:
- **promovida a backlog** via `/adicionar-backlog "<sugestão>"` (estaciona em 999.x sem comprometer)
- **adotada como objetivo do milestone** via `/novo-marco "<sugestão>"` (vira o foco ativo)
</objective>

<context>
**Argumentos:**
- `[project_root]` — diretório raiz a prospectar (default: `.`)
- `--output PATH` — caminho do DIRECTION.md (default: `.planning/DIRECTION.md`)

**Exemplos:**
```
/prospectar-direcao                                  # raiz atual, output default
/prospectar-direcao .                                # explícito
/prospectar-direcao ./apps/web                       # sub-projeto monorepo
/prospectar-direcao . --output .planning/NEXT.md     # output custom
```

**Quando este comando é o caminho:**
- O milestone atual fechou e o próximo objetivo está **"A definir"** — você não sabe o que atacar
- `/novo-marco` foi disparado sem nome e você quer **candidatos com evidência** antes de comprometer
- Acúmulo de TODOs/débito/gaps e você quer uma **leitura priorizada** do que rende mais
- Antes de uma sessão de planejamento de roadmap, para ancorar a discussão em sinais reais

**Pré-requisitos:**
- `.planning/` existe (STATE.md, ROADMAP.md ajudam o sinal; o agente degrada se ausentes)
- Repositório git inicializado (git log é uma das fontes de sinal)
</context>

<process>

## 1. Parsear argumentos

```bash
PROJECT_ROOT=$(echo "$ARGUMENTS" | awk '{print $1}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

# se o primeiro token for uma flag, não é project_root
case "$PROJECT_ROOT" in
  --*) PROJECT_ROOT="" ;;
esac

[ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="."
[ -z "$OUTPUT_PATH" ]  && OUTPUT_PATH=".planning/DIRECTION.md"

if [ ! -d "$PROJECT_ROOT" ]; then
  echo "ERROR: project_root não encontrado: $PROJECT_ROOT"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Detectar sinais disponíveis

```bash
HAS_PLANNING=false
[ -d "$PROJECT_ROOT/.planning" ] && HAS_PLANNING=true

HAS_GIT=false
git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 && HAS_GIT=true

if [ "$HAS_PLANNING" = false ] && [ "$HAS_GIT" = false ]; then
  echo "WARN: sem .planning/ e sem git — sinal limitado. Sugestões terão confidence menor."
fi
```

## 3. Dispatch para `direction-prospector`

```text
Task(
  subagent_type="direction-prospector",
  prompt="
project_root: ${PROJECT_ROOT}
output_path: ${OUTPUT_PATH}

Aplicar skill leverage-scoring. Etapas:
1. Coletar sinais — STATE.md, ROADMAP.md (## Backlog), TODO/FIXME, git log recente,
   gaps de cobertura/observabilidade, dependências desatualizadas, débito técnico.
2. Agrupar sinais em 4-6 candidatos de direção distintos e não-sobrepostos.
3. Pontuar cada candidato no schema de Finding (category=direction):
   evidence (file:line OU commit), impact 1-5, effort S|M|L, confidence HIGH|MEDIUM|LOW.
4. Derivar leverage = (Impact / EffortNum) × ConfidenceWeight; ordenar decrescente.
5. Escrever ${OUTPUT_PATH} com:
   - Resumo (de onde vieram os sinais)
   - Tabela das 4-6 sugestões ordenada por leverage
   - Para cada sugestão: o pitch de 1 linha, evidência citável, e veredito (adotar agora / estacionar)
   - Seção 'considerado e rejeitado' (direções descartadas e por quê)
"
)
```

## 4. Apresentar a carteira e oferecer destino

Apresente as 4-6 sugestões em texto (sem AskUserQuestion — só o resumo abaixo). Para cada
sugestão, mostre `#`, título, leverage e veredito. Em seguida, ofereça os dois caminhos
explicitamente, deixando o user escolher por número:

```
═══════════════════════════════════════════════════════════
 framework ► PROSPECTAR-DIRECAO ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[tabela das 4-6 sugestões do direction-prospector, ordenada por leverage]

## O que fazer com cada sugestão

Cada linha da carteira pode seguir um de dois caminhos — escolha por número:

- **Estacionar no backlog** (não compromete o milestone, acumula contexto):
  ```
  /adicionar-backlog "<título da sugestão #N>"
  ```
- **Adotar como objetivo do próximo milestone** (vira o foco ativo):
  ```
  /novo-marco "<título da sugestão #N>"
  ```

Sugestão: estacione tudo que for `leverage < 1.0` (P2) e leve ao `/novo-marco` apenas a sugestão
de topo, ou as 2-3 de maior leverage que componham um milestone coerente.

## Validação obrigatória

A carteira é uma **leitura de sinais**, não uma decisão. Antes de `/novo-marco`:
- Confirme que a evidência citada (`file:line`/commit) ainda é válida
- Cheque se a sugestão de topo alinha com a intenção de produto (o agente vê código, não estratégia)
- `leverage` alto com `confidence: LOW` = sinal forte mas evidência fraca — investigue antes de adotar
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (project_root opcional, --output opcional, defaults sensíveis)
- [ ] Flag no primeiro token não é confundida com project_root
- [ ] Sinais detectados (.planning/, git) com degradação graciosa se ausentes
- [ ] `direction-prospector` invocado via Task com output_path encaminhado
- [ ] DIRECTION.md gerado com 4-6 sugestões priorizadas por leverage
- [ ] Carteira apresentada em texto (sem AskUserQuestion)
- [ ] Dois destinos oferecidos por número — `/adicionar-backlog` e `/novo-marco`
- [ ] Warning de validação manual antes de comprometer o milestone
- [ ] Cross-references com /novo-marco e /adicionar-backlog
</success_criteria>
</content>
</invoke>
