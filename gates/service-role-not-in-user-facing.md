---
id: service-role-not-in-user-facing
stage: pre-verify
blocking: true
description: Detecta uso de SUPABASE_SERVICE_ROLE_KEY em Edge Functions com verify_jwt:true (user-facing). Service role bypassa RLS — uso em rota acessível a usuário desliga toda autorização. Skip se projeto não tem supabase/functions/.
---

# Service Role Not In User-Facing gate

**When to run:** pre-verify (blocking — anti-pitfall P0 multi-tenant).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: detecta uso de SUPABASE_SERVICE_ROLE_KEY em Edge Functions com verify_jwt:true.
# Anti-pitfall #2 multi-tenant: service role em rota user-facing = bypass total de RLS.
# Bash 3.2-portable (macOS default).
set -e

FUNCTIONS_DIR="supabase/functions"
CONFIG_FILE="supabase/config.toml"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "INFO: $FUNCTIONS_DIR não existe — projeto não usa Supabase Edge Functions. Gate skipped."
  exit 0
fi

# PT-BR: env vars que indicam uso de service role
SERVICE_ROLE_PATTERNS="SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|service_role_key|serviceRoleKey"

VIOLATIONS=0
VIOLATIONS_DETAIL=""

# PT-BR: iterar cada Edge Function (cada subdir em functions/)
FUNCTION_DIRS=$(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

if [ -z "$FUNCTION_DIRS" ]; then
  echo "INFO: nenhuma Edge Function em $FUNCTIONS_DIR — gate skipped."
  exit 0
fi

for fn_dir in $FUNCTION_DIRS; do
  fn_name=$(basename "$fn_dir")

  # PT-BR: skip _shared (não é Edge Function deployable)
  [ "$fn_name" = "_shared" ] && continue

  # PT-BR: descobrir verify_jwt setting da função (default: true se ausente)
  VERIFY_JWT="true"  # default Supabase
  if [ -f "$CONFIG_FILE" ]; then
    # PT-BR: parsing leve — procurar [functions.<name>] block + verify_jwt
    SECTION_VERIFY=$(awk -v fn="$fn_name" '
      $0 ~ "^\\[functions\\." fn "\\]" { in_section = 1; next }
      in_section && /^\[/ { in_section = 0 }
      in_section && /verify_jwt/ {
        gsub(/[ \t]/, "")
        split($0, a, "=")
        print a[2]
        exit
      }
    ' "$CONFIG_FILE" 2>/dev/null)

    if [ -n "$SECTION_VERIFY" ]; then
      VERIFY_JWT="$SECTION_VERIFY"
    fi
  fi

  # PT-BR: se verify_jwt=false (webhook/internal), skip — service role é OK aqui
  if [ "$VERIFY_JWT" = "false" ]; then
    continue
  fi

  # PT-BR: buscar uso de service role em arquivos .ts/.js da function
  SERVICE_ROLE_FILES=$(grep -rlE "$SERVICE_ROLE_PATTERNS" "$fn_dir" --include="*.ts" --include="*.js" --include="*.mjs" 2>/dev/null || true)

  if [ -n "$SERVICE_ROLE_FILES" ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
    VIOLATIONS_DETAIL="${VIOLATIONS_DETAIL}
  Edge Function '$fn_name' (verify_jwt=$VERIFY_JWT) usa service role:
$(echo "$SERVICE_ROLE_FILES" | sed 's/^/    /')"
  fi
done

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: nenhuma Edge Function user-facing (verify_jwt=true) usa SERVICE_ROLE_KEY."
  exit 0
else
  echo "FAIL: $VIOLATIONS Edge Function(s) user-facing usam SERVICE_ROLE_KEY:$VIOLATIONS_DETAIL"
  echo ""
  echo "Fix: use ANON_KEY com JWT do user para preservar RLS. Se realmente precisa de service role:"
  echo "  - Mover lógica privilegiada para Edge Function separada com verify_jwt=false (webhook ou cron-only)"
  echo "  - OU validar manualmente quem está chamando antes de usar service role (anti-pattern, mas explícito)"
  echo "Ref: kit/skills/_shared-multi-tenant/glossary.md (sub-seção super_admin) + kit/skills/supabase-rls-policies/SKILL.md"
  exit 1
fi
```

## Verdict

- **passed** — nenhum service role em Edge Function user-facing → continuar
- **block** — apresentar lista de Edge Functions violadoras + fix recomendado

## Notes

Edge Functions com `verify_jwt = false` (webhooks Evolution Go, Stripe, schedulers internos via pg_cron) podem usar service role legitimamente — gate skippa essas.

Detecção pode produzir falso-positivo se code referencia o nome da var em comentário ou string literal (ex: documentação dentro do code). Para suprimir, mover documentação para arquivo externo ou usar comentário JSDoc fora do regex match.

Para super-admin operations user-facing (impersonation, cross-tenant queries), pattern correto é:
1. Endpoint user-facing valida `super_admin: true` em JWT app_metadata
2. Endpoint chama segunda Edge Function interna (verify_jwt=false) que usa service role
3. Audit log obrigatório no caminho
