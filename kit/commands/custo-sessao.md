---
name: custo-sessao
description: Custo Claude Code de uma sessão (auto-deduz a ativa ou aceita session_id explícito) via MCP tool cost-session.
argument-hint: "[<session_id>] [--refresh-pricing] [--persist]"
allowed-tools:
  - mcp__kit__cost-session
---

<objective>
Exibir o custo USD + tokens consumidos com Claude Code **na sessão atual** (ou em uma sessão específica), agregado por modelo, lendo o JSONL correspondente. Wrapper PT-BR do MCP tool `cost-session` (Phase 172).

**Auto-dedução:** sem argumentos, busca o arquivo JSONL com `mtime` mais recente cujo idle ≤ 30min — assume que é a sessão ativa em curso. Útil para statusline / on-the-fly check.

**Lê:** o arquivo JSONL da sessão (`~/.claude/projects/<slug>/<sessionId>.jsonl`).

**Cria/Atualiza:** nada por default. Com `--persist`, grava em `.planning/costs/<ts>-cost-session.json`.

**Após:** o user vê `session_id`, `started_at`, `last_activity_at`, `total_usd`, breakdown `by_model` e flags de qualidade.

**Disambiguation:** sobre **USD/tokens reais da sessão de chat Claude**. NÃO é métricas internas do MCP server (use `metrics-snapshot` para isso). Ver skill [`cost-tracking`](../skills/cost-tracking/SKILL.md).
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional.

- `<session_id>` — UUID da sessão. Omita para auto-deduzir.
- `--refresh-pricing` — opt-in models.dev fallback. Side-effects de rede + cache.
- `--persist` — salva snapshot em `.planning/costs/`.

**Cross-reference:** SSOT do shape e do auto-deduz é a skill [`cost-tracking`](../skills/cost-tracking/SKILL.md). Algoritmo de auto-dedução: arquivo JSONL com mtime mais recente cujo `now - mtime ≤ max_idle_ms` (default 30min).
</context>

<process>

## 1. Parsear argumentos

```bash
SESSION_ID=$(echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++) if($i !~ /^--/) {print $i; exit}}')
REFRESH=$(echo "$ARGUMENTS" | grep -oE -- '--refresh-pricing' | head -1)
PERSIST=$(echo "$ARGUMENTS" | grep -oE -- '--persist' | head -1)
```

## 2. Invocar MCP tool cost-session

Chame `cost-session` com:

```json
{
  "session_id": "<id ou omitir para auto-deduzir>",
  "refresh_pricing": <true se --refresh-pricing, senão omitir>,
  "persist": <true se --persist, senão omitir>
}
```

## 3. Renderizar resultado

```text
═══════════════════════════════════════════════════════════
 kit-mcp ▸ COST-SESSION ▸ <session_id>
═══════════════════════════════════════════════════════════
 Iniciada: <started_at>
 Última atividade: <last_activity_at>
 Source: <source_file>

 Total: $<total_usd> | <entry_count> entries | pricing snapshot age: <pricing_staleness_days>d

 Por modelo:
 - <model>: $<usd> (<input_tokens> in / <output_tokens> out / <cache_read_tokens> cache_read)
 ...

 Qualidade:
 - dedup: <deduped_count>
 - skipped: <skipped_entry_count>
 - parse errors: <parse_error_count>
 - unknown_models: <list ou "none">

 [Se pricing_warning:] AVISO: <pricing_warning>
 [Se persisted_to:] Snapshot salvo: <persisted_to>
═══════════════════════════════════════════════════════════
```

**Edge case sem sessão ativa:** se o tool retornar `error: 'no_active_session'` ou shape vazio com `entry_count: 0`, informar:

```text
Nenhuma sessão ativa detectada (nenhum JSONL com atividade < 30min).
Use /custo-hoje para o dia inteiro ou /custo-sessao <session_id> para uma sessão específica.
```

## 4. Sugerir próximas ações

- Se sessão ativa custa > $1 → sugerir `/custo-hoje` para ver agregado do dia.
- Se `unknown_models[]` não vazio → sugerir `--refresh-pricing`.
- Se quiser histórico → mencionar `--persist`.

</process>

<success_criteria>
- [ ] Argumentos parseados (`session_id` opcional, `--refresh-pricing`, `--persist`)
- [ ] MCP tool `cost-session` invocado
- [ ] Auto-dedução respeitada quando sem `session_id`
- [ ] Output renderizado human-friendly PT-BR
- [ ] Edge case "no_active_session" tratado com mensagem clara
- [ ] `unknown_models` + `pricing_staleness_days` + `pricing_warning` exibidos quando relevantes
- [ ] Skill `cost-tracking` cross-referenced
</success_criteria>
