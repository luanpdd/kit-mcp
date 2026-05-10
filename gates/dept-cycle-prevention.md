---
id: dept-cycle-prevention
stage: pre-verify
blocking: true
description: Detecta tabela departments (ou similar) com parent_id FK self-referencial mas sem trigger anti-cycle. Loop circular em dept hierarchy esgota connection pool via WITH RECURSIVE infinito. Skip se projeto não tem supabase/migrations/.
---

# Department Cycle Prevention gate

**When to run:** pre-verify (blocking — anti-pitfall P0 multi-tenant hierarchy).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: detecta departments com parent_id self-referencial sem trigger anti-cycle.
# Anti-pitfall #3 multi-tenant: dept hierarchy com loop circular (A.parent=B, B.parent=A) → WITH RECURSIVE infinito → connection pool exhaustion.
# Bash 3.2-portable (macOS default).
set -e

MIGRATIONS_DIR="supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "INFO: $MIGRATIONS_DIR não existe — projeto não usa Supabase migrations. Gate skipped."
  exit 0
fi

# PT-BR: nomes comuns de tabelas hierárquicas (departments + variantes)
HIERARCHY_TABLE_PATTERNS="departments|teams|groups|categories|nodes|tree"

VIOLATIONS=0
VIOLATIONS_DETAIL=""

# PT-BR: iterar migrations em ordem cronológica
MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
  echo "INFO: nenhum arquivo .sql em $MIGRATIONS_DIR — gate skipped."
  exit 0
fi

# PT-BR: encontrar tabelas com parent_id auto-referencial (heurística: parent_id + REFERENCES <self>)
SELF_REF_TABLES=""

for f in $MIGRATION_FILES; do
  # PT-BR: detecta padrão "parent_id ... references public.<table>(id)" onde <table> bate com nome da tabela sendo criada
  # (case-insensitive, multi-line awk porque DDL pode ter quebras de linha)
  TABLES_IN_FILE=$(awk '
    BEGIN { in_create = 0; current_table = "" }
    /create[ \t]+table[ \t]+(if[ \t]+not[ \t]+exists[ \t]+)?[a-z_]+\.[a-z_]+/ {
      in_create = 1
      match($0, /create[ \t]+table[ \t]+(if[ \t]+not[ \t]+exists[ \t]+)?([a-z_]+\.[a-z_]+)/)
      if (RSTART > 0) {
        # extrair só o último match group (table name)
        s = substr($0, RSTART, RLENGTH)
        n = split(s, parts, /[ \t]+/)
        current_table = parts[n]
      }
      next
    }
    in_create && /parent_id[ \t]+uuid[ \t]+references[ \t]+([a-z_]+\.[a-z_]+)/ {
      match($0, /references[ \t]+([a-z_]+\.[a-z_]+)/)
      if (RSTART > 0) {
        ref_table = substr($0, RSTART + 11, RLENGTH - 11)
        gsub(/[ \t]/, "", ref_table)
        if (ref_table == current_table) {
          print current_table
        }
      }
    }
    /;[ \t]*$/ && in_create { in_create = 0; current_table = "" }
  ' "$f" 2>/dev/null)

  if [ -n "$TABLES_IN_FILE" ]; then
    SELF_REF_TABLES="$SELF_REF_TABLES
$TABLES_IN_FILE"
  fi
done

# PT-BR: filtrar entries vazias
SELF_REF_TABLES=$(echo "$SELF_REF_TABLES" | grep -v "^$" | sort -u)

if [ -z "$SELF_REF_TABLES" ]; then
  echo "INFO: nenhuma tabela com parent_id self-referencial detectada — gate skipped."
  exit 0
fi

# PT-BR: para cada tabela self-ref, verificar se há trigger ou function anti-cycle
for table in $SELF_REF_TABLES; do
  # PT-BR: extrair só nome da tabela (sem schema)
  table_name=$(echo "$table" | awk -F. '{print $2}')

  # PT-BR: heurística: procurar trigger com nome contendo cycle/loop/recursion + tabela
  CYCLE_GUARD_FOUND=0
  for f in $MIGRATION_FILES; do
    if grep -iE "(create[ \t]+(or[ \t]+replace[ \t]+)?(function|trigger))[ \t]+[a-z_]*(cycle|loop|recurs|hierarchy_check|anti_cycle)" "$f" 2>/dev/null \
       | grep -iqE "$table_name|$(echo "$table" | tr '.' '_')"; then
      CYCLE_GUARD_FOUND=1
      break
    fi

    # PT-BR: pattern alternativo: trigger genérico que menciona a tabela e WITH RECURSIVE em corpo
    if grep -iqE "create[ \t]+trigger.*on[ \t]+$table" "$f" 2>/dev/null \
       && grep -iqE "with[ \t]+recursive.*parent_id" "$f" 2>/dev/null; then
      CYCLE_GUARD_FOUND=1
      break
    fi
  done

  if [ "$CYCLE_GUARD_FOUND" -eq 0 ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
    VIOLATIONS_DETAIL="${VIOLATIONS_DETAIL}
  Tabela '$table' tem parent_id self-referencial mas sem trigger anti-cycle detectado"
  fi
done

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: todas as tabelas hierárquicas têm proteção anti-cycle."
  exit 0
else
  echo "FAIL: $VIOLATIONS tabela(s) hierárquica(s) sem trigger anti-cycle:$VIOLATIONS_DETAIL"
  echo ""
  echo "Fix: adicionar trigger BEFORE INSERT/UPDATE que detecta cycle via WITH RECURSIVE:"
  cat << 'EOF'

  create or replace function private.check_no_dept_cycle()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    cycle_detected boolean;
  begin
    if new.parent_id is null then return new; end if;

    with recursive ancestors as (
      select id, parent_id, 1 as depth from public.departments where id = new.parent_id
      union all
      select d.id, d.parent_id, a.depth + 1
      from public.departments d
      join ancestors a on d.id = a.parent_id
      where a.depth < 10  -- max 10 níveis
    )
    select exists (select 1 from ancestors where id = new.id) into cycle_detected;

    if cycle_detected then
      raise exception 'department hierarchy cycle detected: % cannot be parent of %',
        new.parent_id, new.id;
    end if;

    return new;
  end;
  $$;

  create trigger check_no_dept_cycle_trigger
    before insert or update of parent_id on public.departments
    for each row execute function private.check_no_dept_cycle();

EOF
  echo "Ref: kit/skills/_shared-multi-tenant/glossary.md (Department Hierarchy)"
  exit 1
fi
```

## Verdict

- **passed** — todas tabelas hierárquicas têm proteção anti-cycle → continuar
- **block** — apresentar tabelas violadoras + DDL pronto do trigger anti-cycle

## Notes

Detecção é heurística baseada em naming (`parent_id` + `references <self_table>`). Pode produzir:
- **Falso-negativo** se a coluna se chamar `parent` em vez de `parent_id`, ou referenciar tabela diferente (não self-ref)
- **Falso-positivo** se o nome do trigger não contém palavras-chave (`cycle`, `loop`, `recurs`, `anti_cycle`) — neste caso, renomear o trigger ou estender a allowlist do gate

Tabelas hierárquicas tipicamente afetadas: `departments`, `teams`, `groups`, `categories`, `nodes`, `tree`.

Limit recursivo padrão sugerido: 10 níveis. Hierarquia mais profunda que isso indica modelagem questionável (Linear/Notion suportam até 5 níveis).
