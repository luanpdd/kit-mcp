---
name: custo-hoje
description: Custo Claude Code do dia corrente (USD + tokens por modelo) via MCP tool cost-today.
argument-hint: "[--tz <IANA>] [--refresh-pricing] [--persist]"
allowed-tools:
  - mcp__kit__cost-today
---

<objective>
Exibir o custo USD + tokens consumidos com Claude Code **no dia atual**, agregado por modelo, lendo os JSONLs de `~/.claude/projects/`. Wrapper PT-BR do MCP tool `cost-today` (Phase 172). Default timezone UTC (paridade com `ccusage`); override via `--tz`.

**Lê:** JSONLs descobertos via `CLAUDE_CONFIG_DIR` (multi-account) → `XDG_CONFIG_HOME/claude` → `~/.claude` (POSIX) / `%APPDATA%/claude` (Windows), filtrando `projects/<slug>/*.jsonl`.

**Cria/Atualiza:** nada por default. Com `--persist`, grava snapshot em `.planning/costs/<ts>-cost-today.json` (gitignored).

**Após:** o user vê tabela compacta `total_usd` + breakdown `by_model` + flags de qualidade (`unknown_models`, `pricing_staleness_days`).

**Disambiguation:** este comando é sobre **USD/tokens reais gastos** — NÃO sobre error budget de SLO (use `/burn-rate-status` para isso). Ver skill [`cost-tracking`](../skills/cost-tracking/SKILL.md) para detalhes.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — todos opcionais.

**Flags:**
- `--tz <IANA>` — timezone do "dia". Default: `UTC` (paridade ccusage). Exemplo: `--tz America/Sao_Paulo`.
- `--refresh-pricing` — opt-in fallback `models.dev` para modelos não cobertos pelo snapshot embedded. Side-effect: HTTP fetch + cache em `~/.kit-mcp/pricing-cache.json` (TTL 24h). NÃO use por padrão.
- `--persist` — grava snapshot do output em `.planning/costs/`.

**Cross-reference:** comando ↔ MCP tool. A SSOT do shape de output e do pipeline parser→dedup→price é a skill [`cost-tracking`](../skills/cost-tracking/SKILL.md) + os módulos em `src/core/cost/`. Este comando é apenas o wrapper PT-BR de invocação no Claude Code.
</context>

<process>

## 1. Parsear argumentos

```bash
TZ=$(echo "$ARGUMENTS" | grep -oE -- '--tz [^ ]+' | awk '{print $2}')
REFRESH=$(echo "$ARGUMENTS" | grep -oE -- '--refresh-pricing' | head -1)
PERSIST=$(echo "$ARGUMENTS" | grep -oE -- '--persist' | head -1)
```

## 2. Invocar MCP tool cost-today

Chame o tool `cost-today` com:

```json
{
  "tz": "<TZ ou omitir para UTC>",
  "refresh_pricing": <true se --refresh-pricing, senão omitir>,
  "persist": <true se --persist, senão omitir>
}
```

## 3. Renderizar resultado human-friendly

Apresentar:

```text
═══════════════════════════════════════════════════════════
 kit-mcp ▸ COST-TODAY ▸ <date> (<tz>)
═══════════════════════════════════════════════════════════
 Total: $<total_usd> | <entry_count> entries | pricing snapshot age: <pricing_staleness_days>d

 Por modelo:
 - <model>: $<usd> (<input_tokens> in / <output_tokens> out / <cache_read_tokens> cache_read)
 ...

 Qualidade:
 - dedup: <deduped_count> descartadas
 - skipped (messageId/requestId null): <skipped_entry_count>
 - parse errors: <parse_error_count>
 - unknown_models: <list ou "none">

 [Se pricing_warning presente:] AVISO: <pricing_warning>
 [Se persisted_to presente:] Snapshot salvo: <persisted_to>
═══════════════════════════════════════════════════════════
```

## 4. Sugerir próximas ações

- Se `unknown_models[]` não vazio → sugerir `--refresh-pricing` na próxima call OU `npm run regen-pricing` (manual M5).
- Se `pricing_staleness_days > 30` → sugerir refresh do snapshot.
- Se `total_usd > $5` no dia → sugerir `/custo-sessao` ou `/custo-fase <id>` para drill-down.

</process>

<success_criteria>
- [ ] Argumentos parseados (`--tz`, `--refresh-pricing`, `--persist`)
- [ ] MCP tool `cost-today` invocado com args canônicos
- [ ] Output do tool renderizado em tabela human-friendly PT-BR
- [ ] `unknown_models` exibidos quando não vazio (NUNCA omitir silencioso)
- [ ] `pricing_staleness_days` + `pricing_warning` (se presente) exibidos
- [ ] `persisted_to` exibido quando `--persist`
- [ ] Sugestões contextuais de drill-down (sessão/fase) quando custo alto
- [ ] Skill `cost-tracking` cross-referenced no objective
</success_criteria>
