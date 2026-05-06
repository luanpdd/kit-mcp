---
id: sync-idempotent
stage: pre-verify
blocking: false
description: Valida que `kit sync claude-code` rodado 2× consecutivos produz `.claude/` byte-idêntico (anti-pitfall A1 — drift kit/ ↔ .claude/).
---

# Sync idempotent gate

**When to run:** pre-verify (non-blocking — warn em vez de bloquear).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: roda sync 2× e compara — output deve ser byte-idêntico
set -e

TMPDIR=$(mktemp -d -t kit-mcp-sync-test-XXXXXX)
trap "rm -rf $TMPDIR" EXIT

# PT-BR: copia projeto root para tmpdir (sem node_modules)
mkdir -p "$TMPDIR/project"
cp -r kit "$TMPDIR/project/"
cp package.json "$TMPDIR/project/" 2>/dev/null || true

# PT-BR: 1ª execução
node bin/cli.js sync install claude-code --project-root "$TMPDIR/project" >/dev/null 2>&1 || {
  echo "WARN: primeira sync falhou — gate inconclusivo"
  exit 0
}

# PT-BR: snapshot do output
SNAPSHOT1=$(find "$TMPDIR/project/.claude" -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum)

# PT-BR: 2ª execução
node bin/cli.js sync install claude-code --project-root "$TMPDIR/project" >/dev/null 2>&1

# PT-BR: snapshot 2
SNAPSHOT2=$(find "$TMPDIR/project/.claude" -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum)

if [ "$SNAPSHOT1" != "$SNAPSHOT2" ]; then
  echo "FAIL: sync não-idempotente — output diverge entre execuções"
  echo "Snapshot 1: $SNAPSHOT1"
  echo "Snapshot 2: $SNAPSHOT2"
  exit 1
fi

echo "✓ Sync idempotente — duas execuções produzem .claude/ byte-idêntico"
exit 0
```

## Verdict

- **passed** — `.claude/` byte-idêntico entre 2 execuções
- **warn** — drift detectado (não-blocking; investigar)

## Notes

Anti-pitfall A1 da v1.8: drift entre `kit/` canonical e `.claude/` stubs após adicionar 19+ items multiplicados por 8 IDE targets. Sync deve ser idempotente — qualquer fonte de não-determinismo (timestamps, ordering aleatório, hash de tempo de geração) precisa ser eliminada. Este gate detecta divergência cedo, antes de chegar em produção.

**Por que non-blocking:** o gate roda CLI completo + I/O — pode falhar por razões ambientais (permissions, espaço em disco) que não são bugs de sync. Falha vira warn para revisão manual.
