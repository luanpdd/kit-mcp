---
id: multi-tenant-rls-coverage
stage: pre-verify
blocking: true
description: Detecta CREATE TABLE em supabase/migrations/ sem ENABLE ROW LEVEL SECURITY no mesmo arquivo. Cross-tenant data leak silencioso é a falha #1 de apps multi-tenant Supabase. Skip se projeto não tem supabase/migrations/.
---

# Multi-Tenant RLS Coverage gate

**When to run:** pre-verify (blocking — multi-tenant phase não verifica até cobertura completa).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: detecta CREATE TABLE em supabase/migrations/ sem ENABLE ROW LEVEL SECURITY no mesmo arquivo.
# Anti-pitfall #1 multi-tenant: tabela nova sem RLS = cross-tenant leak silencioso (Postgres não aplica policies automaticamente).
# Bash 3.2-portable (macOS default).
set -e

MIGRATIONS_DIR="supabase/migrations"

# PT-BR: skip gracioso se projeto não tem migrations Supabase
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "INFO: $MIGRATIONS_DIR não existe — projeto não usa Supabase migrations. Gate skipped."
  exit 0
fi

# PT-BR: tabelas em schemas system não exigem RLS (auth, storage, realtime, vault, supabase_*)
SYSTEM_SCHEMA_PREFIXES="auth\\.|storage\\.|realtime\\.|vault\\.|supabase_|extensions\\."

# PT-BR: allowlist de tabelas que conscientemente não têm RLS (ex: lookup tables públicas)
ALLOWLIST_TABLES=(
  "public.permissions"  # catálogo global de permissions, leitura pública por design
)

is_allowlisted() {
  local table="$1"
  for at in "${ALLOWLIST_TABLES[@]}"; do
    [ "$table" = "$at" ] && return 0
  done
  return 1
}

VIOLATIONS=0
VIOLATIONS_DETAIL=""

# PT-BR: iterar migrations em ordem cronológica
MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
  echo "INFO: nenhum arquivo .sql em $MIGRATIONS_DIR — gate skipped."
  exit 0
fi

for f in $MIGRATION_FILES; do
  # PT-BR: extrair tabelas criadas via CREATE TABLE (case-insensitive, ignora IF NOT EXISTS)
  CREATED_TABLES=$(grep -iE "^create\s+table\s+(if\s+not\s+exists\s+)?[a-z_]+\." "$f" 2>/dev/null \
    | sed -E 's/.*create\s+table\s+(if\s+not\s+exists\s+)?([a-z_]+\.[a-z_]+).*/\2/i' \
    | grep -viE "$SYSTEM_SCHEMA_PREFIXES" || true)

  # PT-BR: extrair tabelas com RLS habilitada no MESMO arquivo
  RLS_TABLES=$(grep -iE "alter\s+table\s+[a-z_]+\.[a-z_]+\s+enable\s+row\s+level\s+security" "$f" 2>/dev/null \
    | sed -E 's/.*alter\s+table\s+([a-z_]+\.[a-z_]+)\s+enable.*/\1/i' || true)

  # PT-BR: para cada tabela criada, checar se RLS foi habilitada
  for table in $CREATED_TABLES; do
    [ -z "$table" ] && continue
    is_allowlisted "$table" && continue

    if ! echo "$RLS_TABLES" | grep -qFx "$table"; then
      VIOLATIONS=$((VIOLATIONS + 1))
      VIOLATIONS_DETAIL="${VIOLATIONS_DETAIL}
  $(basename "$f"): tabela '$table' criada sem ENABLE ROW LEVEL SECURITY"
    fi
  done
done

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: todas as tabelas em supabase/migrations/ têm RLS habilitada no mesmo arquivo de criação."
  exit 0
else
  echo "FAIL: $VIOLATIONS tabela(s) criada(s) sem ENABLE ROW LEVEL SECURITY:$VIOLATIONS_DETAIL"
  echo ""
  echo "Fix: adicione 'alter table <schema>.<table> enable row level security;' no MESMO arquivo de migration que criou a tabela."
  echo "Ref: kit/skills/multi-tenant-rls-hierarchy/SKILL.md (REGRA #1)"
  exit 1
fi
```

## Verdict

- **passed** — todas tabelas multi-tenant têm RLS habilitada → continuar
- **block** — apresentar tabela de violations + sugestão de fix; sem opção de skip (anti-pitfall P0 — cross-tenant leak)

## Notes

Este gate só checa **habilitação** de RLS — não checa se as policies cobrem todos os casos. Ver `multi-tenant-isolation-auditor` agent para análise completa de policies (requer MCP Supabase ativo para query a `pg_policies`).

Tabelas em schemas system (`auth.*`, `storage.*`, `realtime.*`, `vault.*`, `supabase_*`, `extensions.*`) são automaticamente skipped — Supabase já aplica RLS interno nelas.

Allowlist mínima: `public.permissions` (catálogo global de permissions, leitura pública por design — tem `to authenticated` em SELECT mas sem isolamento por tenant).
