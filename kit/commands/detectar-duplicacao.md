---
name: detectar-duplicacao
description: Invoca shotgun-surgery-detector — detecta duplicação sintática (jscpd/regex) + semântica (embeddings) cross-codebase, prioriza por size × frequency × extract feasibility.
argument-hint: "<root_dir> [--threshold 0.85] [--min-cluster-size 3] [--mode syntactic|semantic|both] [--provider openai|pgvector|auto]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
  - mcp__supabase__execute_sql
---

<objective>
Detectar **shotgun surgery** (mesma mudança/lógica espalhada em N lugares) cross-codebase via:
1. **Detecção sintática** — Feathers cap 21 original; jscpd/regex/AST
2. **Detecção semântica** — modernização 2026; embeddings + cosine similarity

Invoca o agente [`shotgun-surgery-detector`](../agents/shotgun-surgery-detector.md) que aplica a skill [`legacy-shotgun-surgery`](../skills/legacy-shotgun-surgery/SKILL.md). Output: clusters priorizados por (size × frequency × extract feasibility).

**Cria/Atualiza:**
- `.planning/SHOTGUN-SURGERY.md` — clusters detectados, top 10 priorizados, sugestões extract

**Após:** o user tem lista acionável de candidates a extract method/class para reduzir change points. PR sequence canônica: extract first → modify second.
</objective>

<context>
**Argumentos:**
- `<root_dir>` — diretório raiz a analisar (default: `.`)
- `--threshold 0.85` — cosine similarity mínima para semantic cluster (default: 0.85)
- `--min-cluster-size 3` — Rule of 3 (default: 3)
- `--min-block-lines 10` — tamanho mínimo de bloco para análise (default: 10)
- `--mode syntactic|semantic|both` — modo (default: `both`)
- `--provider openai|pgvector|auto` — embedding provider (default: auto-detect)
- `--output PATH` — caminho do output (default: `.planning/SHOTGUN-SURGERY.md`)

**Exemplos:**
```
/detectar-duplicacao src/                                              # both modes, defaults
/detectar-duplicacao . --mode=syntactic                                # só Feathers original (sem custo IA)
/detectar-duplicacao src/ --threshold 0.90                              # mais conservador
/detectar-duplicacao src/ --min-cluster-size 5                         # só clusters grandes
/detectar-duplicacao src/ --provider=pgvector                          # forçar self-hosted
```

**Pré-requisitos:**
- jscpd disponível para sintática (`npm install -g jscpd` se não)
- OPENAI_API_KEY OR pgvector setup para semântica (auto-detect)
- Node.js 20+ no path para chamadas embeddings

**Quando este comando é o caminho:**
- Você sente "estou mudando isso em N lugares" — use detector pra confirmar/quantificar
- Refactor proposto inclui extract method/class — detector confirma 3+ ocorrências
- Code review onde reviewer suspeita de DRY violations
- Pré-requisito para `/legacy refactor` quando shotgun é a real causa raiz
</context>

<process>

## 1. Parsear argumentos

```bash
ROOT_DIR=$(echo "$ARGUMENTS" | awk '{print $1}')
THRESHOLD=$(echo "$ARGUMENTS" | grep -oE -- '--threshold [0-9.]+' | awk '{print $2}')
MIN_CLUSTER=$(echo "$ARGUMENTS" | grep -oE -- '--min-cluster-size [0-9]+' | awk '{print $2}')
MIN_BLOCK=$(echo "$ARGUMENTS" | grep -oE -- '--min-block-lines [0-9]+' | awk '{print $2}')
MODE=$(echo "$ARGUMENTS" | grep -oE -- '--mode[= ][^ ]+' | sed 's/--mode[= ]//')
PROVIDER=$(echo "$ARGUMENTS" | grep -oE -- '--provider[= ][^ ]+' | sed 's/--provider[= ]//')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$ROOT_DIR" ]     && ROOT_DIR="."
[ -z "$THRESHOLD" ]    && THRESHOLD="0.85"
[ -z "$MIN_CLUSTER" ]  && MIN_CLUSTER=3
[ -z "$MIN_BLOCK" ]    && MIN_BLOCK=10
[ -z "$MODE" ]         && MODE="both"
[ -z "$PROVIDER" ]     && PROVIDER="auto"
[ -z "$OUTPUT_PATH" ]  && OUTPUT_PATH=".planning/SHOTGUN-SURGERY.md"

if [ ! -d "$ROOT_DIR" ]; then
  echo "ERROR: root_dir não encontrado: $ROOT_DIR"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Detectar capabilities

```bash
HAS_JSCPD=false
command -v npx >/dev/null && npx jscpd --version >/dev/null 2>&1 && HAS_JSCPD=true

HAS_OPENAI=false
[ -n "$OPENAI_API_KEY" ] && HAS_OPENAI=true

HAS_PGVECTOR=false
if command -v psql >/dev/null && psql -tc "select 1 from pg_extension where extname='vector'" 2>/dev/null | grep -q 1; then
  HAS_PGVECTOR=true
fi

# adjust mode if needed
if [ "$MODE" = "both" ] || [ "$MODE" = "semantic" ]; then
  if [ "$HAS_OPENAI" = false ] && [ "$HAS_PGVECTOR" = false ]; then
    echo "WARN: nenhum embedding provider disponível. Mode forçado para 'syntactic'."
    MODE="syntactic"
  fi
fi
```

## 3. Dispatch para `shotgun-surgery-detector`

```text
Task(
  subagent_type="shotgun-surgery-detector",
  prompt="
root_dir: ${ROOT_DIR}
threshold: ${THRESHOLD}
min_cluster_size: ${MIN_CLUSTER}
min_block_lines: ${MIN_BLOCK}
mode: ${MODE}
embedding_provider: ${PROVIDER}
output_path: ${OUTPUT_PATH}

Aplicar skill legacy-shotgun-surgery. Etapas:
1. Detecção sintática (sempre roda) — jscpd com min-lines + min-tokens
2. Detecção semântica (se mode=semantic|both) — embeddings + cosine similarity
3. Merge clusters (sintático + semântico); marker [SYNTACTIC] / [SEMANTIC] / [BOTH]
4. Priorização canônica — score = (cluster_size × avg_block_lines × frequency_factor) / extract_feasibility
5. Filter: cross-cutting noise (test files etc)
6. Escrever .planning/SHOTGUN-SURGERY.md com:
   - Resumo (X clusters totais)
   - Top 10 priorizados com diff visual
   - Sugestões de extract com nome canônico
   - Esforço estimado por cluster
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► DETECTAR-DUPLICACAO ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do shotgun-surgery-detector]

## ⚠ Validação obrigatória

Cada cluster — especialmente semantic — precisa de **revisão humana**:
- Falsos positivos comuns: 2 funções com nomes/comments similares mas implementações diferentes
- Variations entre ocorrências podem ser INTENCIONAIS (rounding diferente, encoding diferente)
- Extract uniformiza → mudança comportamental possível

NÃO auto-extract. Cluster aprovado por humano vira PR.

## Próximos passos por cluster aprovado

1. **Caracterizar cada ocorrência** (capturar comportamento atual):
   ```bash
   /caracterizar <file-da-ocorrencia-1>
   /caracterizar <file-da-ocorrencia-2>
   ...
   ```
2. **Validar outputs idênticos** OU documentar diferenças intencionais
3. **Escolher nome canônico** (resonates com TODAS as N localizações)
4. **Extract para 1 lugar** (criar utility/módulo compartilhado)
5. **Substituir cada ocorrência** (1 commit por substituição, revertível)
6. **Re-rodar detector** após PRs para verificar redução de clusters

## Custo (modo semantic)

- ~$<cost>/run com OpenAI text-embedding-3-small
- $0 com pgvector self-hosted
- 0 com mode=syntactic only

## Cross-suite

- **/storytelling** (v1.12) — story dos módulos identifica clusters mais provável
- **/caracterizar** (v1.12) — characterize cada ocorrência ANTES de extract
- **/legacy refactor** (v1.12) — chain canônico para extract
- **/auditar-marco** — rerodar shotgun detector trimestral revela acumulação de débito
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (root_dir opcional, defaults sensíveis)
- [ ] Capabilities detectadas (jscpd, OpenAI, pgvector)
- [ ] Mode degraded se provider de embedding indisponível
- [ ] `shotgun-surgery-detector` invocado via Task
- [ ] Output forwarded transparentemente
- [ ] Warning de validação manual obrigatória
- [ ] Próximos passos: characterize → validate → extract → substituir → re-detect
- [ ] Cross-references com /storytelling, /caracterizar, /legacy refactor
</success_criteria>
