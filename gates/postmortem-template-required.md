---
id: postmortem-template-required
stage: pre-conclude
blocking: true
description: Bloqueia /concluir-marco se há investigação em .planning/investigations/ sem postmortem correspondente em .planning/postmortems/. "No postmortem left unreviewed" (cap 15).
---

# Postmortem template required gate

**When to run:** pre-conclude (blocking — milestone NÃO arquiva até cada incident ter postmortem blameless).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que cada investigação em .planning/investigations/ tem postmortem em .planning/postmortems/.
# Match por basename (sem extensão .md). Investigations com Status: INCONCLUSIVE são exceção.
# Bash 3.2-portable (macOS default).
set -e

INV_DIR=".planning/investigations"
PM_DIR=".planning/postmortems"

# PT-BR: se não há investigations, gate passa com INFO
if [ ! -d "$INV_DIR" ]; then
  echo "INFO: $INV_DIR não existe — projeto sem incidents registrados. Gate skipped."
  exit 0
fi

# PT-BR: listar investigations (single-file *.md OR subdir com STATE.md)
INVESTIGATIONS=""

# PT-BR: pattern A — .planning/investigations/<id>.md (single file)
SINGLE_FILES=$(find "$INV_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null || true)
if [ -n "$SINGLE_FILES" ]; then
  INVESTIGATIONS="$INVESTIGATIONS
$SINGLE_FILES"
fi

# PT-BR: pattern B — .planning/investigations/<id>/STATE.md (subdir state)
SUBDIR_STATES=$(find "$INV_DIR" -mindepth 2 -maxdepth 2 -type f -name "STATE.md" 2>/dev/null || true)
if [ -n "$SUBDIR_STATES" ]; then
  INVESTIGATIONS="$INVESTIGATIONS
$SUBDIR_STATES"
fi

# PT-BR: filtrar linhas vazias
INVESTIGATIONS=$(echo "$INVESTIGATIONS" | grep -v "^$" || true)

if [ -z "$INVESTIGATIONS" ]; then
  echo "INFO: $INV_DIR vazio — sem incidents registrados. Gate skipped."
  exit 0
fi

# PT-BR: para cada investigation, extrair <id> e checar postmortem correspondente
MISSING=0
MISSING_LIST=""
OLDIFS="$IFS"
IFS='
'
for inv_path in $INVESTIGATIONS; do
  [ -z "$inv_path" ] && continue
  [ ! -f "$inv_path" ] && continue

  # PT-BR: extrair <id> — basename sem .md OU dirname se for STATE.md em subdir
  base=$(basename "$inv_path")
  if [ "$base" = "STATE.md" ]; then
    # pattern B — id é o nome do subdir parent
    id=$(basename "$(dirname "$inv_path")")
  else
    # pattern A — id é basename sem .md
    id="${base%.md}"
  fi

  # PT-BR: se investigation tem Status: INCONCLUSIVE (sem root cause), pular
  if grep -qiE "^Status:.*INCONCLUSIVE|^.*Status.*INCONCLUSIVE" "$inv_path" 2>/dev/null; then
    echo "INFO: investigation '$id' marcada INCONCLUSIVE — sem root cause, postmortem não exigido."
    continue
  fi

  # PT-BR: postmortem esperado em .planning/postmortems/<id>.md
  pm_path="$PM_DIR/$id.md"
  if [ ! -f "$pm_path" ]; then
    MISSING=$((MISSING + 1))
    MISSING_LIST="$MISSING_LIST $id"
  fi
done
IFS="$OLDIFS"

if [ "$MISSING" -eq 0 ]; then
  echo "PASS: todas as investigações têm postmortem correspondente em $PM_DIR/"
  exit 0
else
  echo "FAIL: $MISSING investigação(ões) sem postmortem em $PM_DIR/:$MISSING_LIST"
  echo "Sugestão: rodar /postmortem --from-investigation <id> para cada item ausente."
  echo "Cross-ref: kit/skills/blameless-postmortems/SKILL.md + kit/agents/postmortem-writer.md"
  echo "Princípio canônico: 'No postmortem left unreviewed' (cap 15 livro Google SRE)."
  exit 1
fi
```

## Verdict

- **passed** — todas investigations têm postmortem correspondente OR investigations marcadas INCONCLUSIVE OR diretório `.planning/investigations/` ausente
- **block** — pelo menos 1 investigation sem postmortem em `.planning/postmortems/`

## Why

O livro Google SRE (cap 15 — *Postmortem Culture: Learning from Failure*) define como princípio canônico **"no postmortem left unreviewed"**: cada incident significativo (registrado como investigação via `/forense` + `incident-investigator` v1.9) deve gerar postmortem blameless documentando *o que aprendemos* e *o que mudaremos*.

Sem este gate, milestones arquivam com investigations órfãs — root cause foi diagnosticado mas aprendizado organizacional perdeu-se (anti-pattern hero culture: "fixei o bug, vamos seguir"). Gate força a chain canônica entre v1.9 (Core Analysis Loop diagnostica) e v1.10 (postmortem documenta).

Cross-ref agent canônico: [`postmortem-writer`](../kit/agents/postmortem-writer.md) (Phase 37 / AGCORE-SRE-03). Skill: [`blameless-postmortems`](../kit/skills/blameless-postmortems/SKILL.md) (Phase 36 / SKFD-SRE-04). Comando: `/postmortem --from-investigation <id>` (Phase 38 / CMD-SRE-03). Chain documentado em `kit/commands/forense.md` bloco `<sre_integration>` (Plan 40-01 / INT-FW-V2-01).

## REQ

QA-SRE-02.

## Configuração

Gate é **blocking** por default (cultura SRE blameless é não-negociável uma vez instituída). Para tornar warn-only durante adoption inicial:

```bash
node ./.claude/framework/bin/tools.cjs config-set workflow.postmortem_required_warn true
```

(Nota: implementação do toggle warn-only é deferida — gate atual lê apenas presença/ausência de pares investigation↔postmortem, não consulta config.)
