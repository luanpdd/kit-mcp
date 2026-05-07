---
name: auditar-toil
description: Invoca toil-auditor — analisa repo + git log + scripts + runbooks; gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2 com esforço de automação.
argument-hint: "[--time-window 3m] [--team-size N] [--output PATH]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Auditar o repositório atual em busca de **toil** (cap 5 do livro Google SRE) — trabalho manual, repetitivo, automatizável, tático, sem valor durável que escala linear com tráfego/usuários. Invoca o agente [`toil-auditor`](../agents/toil-auditor.md) que aplica a skill [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — 6 critérios canônicos, regra ≤ 50%, distinção toil vs overhead vs grungy work.

**Cria/Atualiza:**
- `.planning/TOIL-AUDIT.md` — lista priorizada P0/P1/P2 com 6 critérios scored + esforço de automação estimado

**Após:** o user tem audit acionável para reduzir toil pelo time. Phase 39 INT-OBS-02 integra ao `omm-auditor` (v1.9) — Capacidade 3 do OMM scoring usa este audit.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — todas as flags são opcionais; comando funciona com defaults.

**Flags:**
- `--time-window <Nm|Nd>` — janela de git history a analisar (default: `3m` = 3 meses)
- `--team-size <N>` — número de pessoas no time (default: inferido via `git shortlog -sn`)
- `--output <path>` — caminho do output (default: `.planning/TOIL-AUDIT.md`)
- `--runbooks-paths <p1,p2,...>` — paths customizados de runbooks (default: `runbooks/, docs/runbooks/, ops/, scripts/, .github/workflows/`)

**Exemplos:**
```
/auditar-toil                                            # defaults — 3m de git, team auto-detect
/auditar-toil --time-window 6m --team-size 5             # janela maior + team explícito
/auditar-toil --output .planning/audit/toil-2026-Q2.md   # path customizado
```

**Pré-requisito:** repositório git inicializado (sem isso, agent skip git log analysis e usa apenas scripts/runbooks).
</context>

<process>

## 1. Parsear argumentos

```bash
TIME_WINDOW=$(echo "$ARGUMENTS" | grep -oE -- '--time-window [^ ]+' | awk '{print $2}')
TEAM_SIZE=$(echo "$ARGUMENTS" | grep -oE -- '--team-size [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')
RUNBOOKS=$(echo "$ARGUMENTS" | grep -oE -- '--runbooks-paths [^ ]+' | awk '{print $2}')

[ -z "$TIME_WINDOW" ] && TIME_WINDOW="3m"
[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/TOIL-AUDIT.md"

# PT-BR: criar destination dir
mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Validar pré-requisitos

```bash
# PT-BR: detectar git repo (não-bloqueante — agent funciona sem git, só com scripts/runbooks)
GIT_OK=true
git rev-parse --git-dir >/dev/null 2>&1 || GIT_OK=false

if [ "$GIT_OK" = false ]; then
  echo "⚠ Nenhum repositório git detectado — agent vai pular git log analysis."
  echo "  (toil-auditor continuará com scripts/runbooks apenas)"
fi

# PT-BR: verificar se TOIL-AUDIT.md anterior existe (idempotência)
if [ -f "$OUTPUT_PATH" ]; then
  LAST_DATE=$(grep -m1 '**Audit date:**' "$OUTPUT_PATH" 2>/dev/null | sed 's/.*Audit date:\*\* //' || echo "?")
  echo "ℹ TOIL-AUDIT.md anterior detectado (Audit date: $LAST_DATE)."
  echo "  Novo audit vai sobrescrever — agent compara com anterior se preservou histórico."
fi
```

## 3. Dispatch para `toil-auditor`

```text
Task(
  subagent_type="toil-auditor",
  prompt="
project_root: .
output_path: ${OUTPUT_PATH}
time_window: ${TIME_WINDOW}
${TEAM_SIZE:+team_size: ${TEAM_SIZE}}
${RUNBOOKS:+runbooks_paths: ${RUNBOOKS}}

Aplicar skill eliminating-toil. Etapas:
1. Scan: git log normalizado (commits repetitivos), scripts shell em paths canônicos, runbooks (manual ops descritas), README/CONTRIBUTING (manual setup).
2. Aplicar 6 critérios canônicos (manual, repetitivo, automatizável, tático, sem valor durável, escala linear) em cada candidato.
3. Distinguir toil vs overhead (reuniões/RH — não-elimináveis) vs grungy work (refactor — projeto engineering).
4. Priorizar P0/P1/P2 por (frequency × pain) / automation_effort.
5. Estimar esforço de automação por candidato (hours/days) + estágio L0-L4 do automation continuum.
6. Computar % do tempo do time gasto em toil (regra ≤ 50%).

Output: ${OUTPUT_PATH} com tabela priorizada + sumário executivo + recomendações.
"
)
```

## 4. Pós-output + integração OMM

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-TOIL ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do toil-auditor — ver Step 5 do agent]

## Próximos passos
1. Revisar P0 (alto impacto, baixo esforço) — alvos imediatos para automação
2. Se `workflow.audit_milestone_toil=true`, este audit alimenta `/auditar-marco` (Phase 40 INT-FW-V2-03)
3. Cross-ref OMM (v1.9 — Capacidade 3 Tech Debt): `/observabilidade omm` consome este audit
4. Re-audit recomendado a cada milestone (toil cresce silencioso)
```

</process>
