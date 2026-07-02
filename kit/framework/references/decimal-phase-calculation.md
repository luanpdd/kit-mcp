# Cálculo de Fase Decimal

Calcule o próximo número de fase decimal para inserções urgentes.

## Usando tools

```bash
# Obter a próxima fase decimal após a fase 6
node "./.claude/framework/bin/tools.cjs" phase next-decimal 6
```

Saída:
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.1",
  "existing": []
}
```

Com decimais existentes:
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.3",
  "existing": ["06.1", "06.2"]
}
```

## Extrair Valores

```bash
DECIMAL_PHASE=$(node "./.claude/framework/bin/tools.cjs" phase next-decimal "${AFTER_PHASE}" --pick next)
BASE_PHASE=$(node "./.claude/framework/bin/tools.cjs" phase next-decimal "${AFTER_PHASE}" --pick base_phase)
```

Ou com o flag --raw:
```bash
DECIMAL_PHASE=$(node "./.claude/framework/bin/tools.cjs" phase next-decimal "${AFTER_PHASE}" --raw)
# Retorna apenas: 06.1
```

## Exemplos

| Fases Existentes | Próxima Fase |
|------------------|--------------|
| 06 apenas | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |
| 06, 06.1, 06.3 (lacuna) | 06.4 |

## Nomenclatura de Diretório

Diretórios de fase decimal usam o número decimal completo:

```bash
SLUG=$(node "./.claude/framework/bin/tools.cjs" generate-slug "$DESCRIPTION" --raw)
PHASE_DIR=".planning/phases/${DECIMAL_PHASE}-${SLUG}"
mkdir -p "$PHASE_DIR"
```

Exemplo: `.planning/phases/06.1-corrigir-bug-critico-auth/`
