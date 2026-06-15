---
id: resource-frontmatter
stage: pre-verify
blocking: true
description: Valida frontmatter de agents/skills — cost_tier válido, description ≤200 char e byte, sem reticências nem colon+espaço, e tools declaradas existentes.
---

# Resource frontmatter gate

**When to run:** pre-verify, antes de qualquer commit que toque `kit/agents/`, `kit/skills/` ou `kit/commands/`. Bloqueante.

Garante os invariantes de frontmatter de que o resto da toolchain depende: o seletor (description é o que o usuário vê), o pré-flight de custo (`cost_tier`), a agregação do `CLAUDE.md` e — crítico — o parser YAML do Claude Code, que quebra com `": "` em description não-aspada.

## Regras

1. **cost_tier** ∈ {`leve`, `medio`, `pesado`} — em todo agent e skill (campo NOVO, distinto de `tier:`).
2. **description ≤ 200 caracteres E ≤ 200 bytes (UTF-8)** — agents, skills e commands. Byte-limit garante o teto em qualquer locale (acentos PT-BR custam 2 bytes).
3. **Sem reticências** (`…`) na description — texto truncado esconde o outcome.
4. **Sem `": "`** (colon+espaço) em description não-aspada — quebra o parser YAML do frontmatter. A convenção do kit é `—`.
5. **tools** (agents): toda tool declarada é um built-in conhecido OU um padrão `mcp__*`.

## Check

```bash
#!/usr/bin/env bash
# Cross-platform: roda o checker em Node (sem dependência de awk/sed).
set -e
node scripts/check-resource-frontmatter.mjs
```

## Verdict

- **passed** — `exit 0`: todos os agents/skills/commands válidos.
- **block** — `exit 1`: ao menos uma violação (cada uma listada como `file — [rule] detail`).

## Notes

Enforçado em CI/release pelo teste `test/unit/resource-frontmatter.test.js` (importa a mesma função pura `checkResourceFrontmatter`) e por `node scripts/check-resource-frontmatter.mjs` no `prepublishOnly` — não depende de bash, então roda igual no Windows e no Linux. Complementa o gate `budget-description` (que cobre só o limite de 200 chars).
