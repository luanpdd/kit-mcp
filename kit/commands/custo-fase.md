---
name: custo-fase
description: Custo Claude Code correlacionado com uma fase do framework (.planning/phases/<id>-*/) via MCP tool cost-phase. Cruza SPEC.md mtime + STATE.md completed_at + git log para inferir janela.
argument-hint: "<phase_id> [--refresh-pricing] [--persist]"
allowed-tools:
  - mcp__kit__cost-phase
---

<objective>
Exibir o custo USD + tokens consumidos com Claude Code **durante a janela temporal de uma fase do framework kit-mcp**. Wrapper PT-BR do MCP tool `cost-phase` (Phase 172) — diferencial vs `ccusage` puro: contexto de workflow.

**Inferência de janela temporal:**
- `started_at` ← mtime do arquivo SPEC.md em `.planning/phases/<phase_id>-*/`.
- `ended_at` ← `completed_at` de `.planning/STATE.md` (se a fase foi concluída) OU `null` se ainda ativa.
- Cross-ref com `git log --since/--until` para apertar bordas.

**`correlation_confidence`:**
- `high`: SPEC.md mtime + completed_at + commits no intervalo (3/3 sinais).
- `medium`: 2/3 sinais.
- `low`: apenas mtime do dir OU detecção de rebase recente (reflog) que invalidaria bordas.
- `unknown`: fase não encontrada em `.planning/phases/`.

**Lê:** `.planning/phases/<id>-*/SPEC.md`, `.planning/STATE.md`, `git log`, JSONLs do Claude Code.

**Cria/Atualiza:** nada por default. Com `--persist`, grava em `.planning/costs/<ts>-cost-phase.json`.

**Após:** o user vê custo da fase + `correlation_confidence` + `correlation_signals` para auditar a confiança no número.

**Disambiguation:** sobre **USD/tokens reais da fase**, não sobre métricas de progresso da fase. Para progresso → ver STATE.md direto. Para custo financeiro → este comando. Ver skill [`cost-tracking`](../skills/cost-tracking/SKILL.md).
</objective>

<context>
**Argumentos:** `$ARGUMENTS`.

- `<phase_id>` — **obrigatório**. ID da fase (ex: `172`). Sem o ID, o comando emite erro e sugere `/listar-fases`.
- `--refresh-pricing` — opt-in models.dev fallback.
- `--persist` — salva snapshot.

**Cross-reference:** SSOT do algoritmo de correlação é `src/core/cost/aggregate-phase.js` + skill [`cost-tracking`](../skills/cost-tracking/SKILL.md). Confidence levels documentados no SPEC 172.
</context>

<process>

## 1. Parsear argumentos

```bash
PHASE_ID=$(echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++) if($i !~ /^--/) {print $i; exit}}')
REFRESH=$(echo "$ARGUMENTS" | grep -oE -- '--refresh-pricing' | head -1)
PERSIST=$(echo "$ARGUMENTS" | grep -oE -- '--persist' | head -1)

if [ -z "$PHASE_ID" ]; then
  echo "Uso: /custo-fase <phase_id> [--refresh-pricing] [--persist]"
  echo "Exemplo: /custo-fase 172"
  exit 1
fi
```

## 2. Invocar MCP tool cost-phase

Chame `cost-phase` com:

```json
{
  "phase_id": "<PHASE_ID>",
  "refresh_pricing": <true se --refresh-pricing, senão omitir>,
  "persist": <true se --persist, senão omitir>
}
```

## 3. Renderizar resultado

```text
═══════════════════════════════════════════════════════════
 kit-mcp ▸ COST-PHASE ▸ phase=<phase_id> (<phase_slug>)
═══════════════════════════════════════════════════════════
 Janela inferida:
   started_at: <started_at>
   ended_at:   <ended_at ou "ativa">
   is_active:  <true|false>

 Correlation confidence: **<correlation_confidence>**
   signals: spec_mtime=<bool> | completed_at=<bool> | git_log=<bool>

 Total: $<total_usd> | <entry_count> entries | pricing snapshot age: <pricing_staleness_days>d

 Por modelo:
 - <model>: $<usd> (<in> in / <out> out / <cache> cache_read)
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

### Edge case: confidence=unknown

Se o tool retornar `correlation_confidence: "unknown"` (fase não encontrada):

```text
Fase <phase_id> não encontrada em .planning/phases/.
Verifique o ID (sem padding zero, ex: "172" não "00172") e o slug do diretório.
Reason: <reason>
```

### Edge case: confidence=low

Se `correlation_confidence: "low"`, **destacar** no output:

```text
ATENÇÃO: confidence=low — janela inferida apenas pelo mtime do diretório,
sem SPEC.md timestamp confiável nem completed_at em STATE.md. Trate o
número como estimativa de ordem de grandeza, NÃO como auditoria contábil.
```

## 4. Sugerir próximas ações

- Se `correlation_confidence` for `high` e custo > $X → ROI / scope review.
- Se `unknown_models[]` não vazio → `--refresh-pricing`.
- Se `is_active=true` e custo alto → considerar drill-down via `/custo-sessao` para a sessão corrente.

</process>

<success_criteria>
- [ ] `phase_id` obrigatório validado (erro claro se ausente)
- [ ] MCP tool `cost-phase` invocado com `phase_id` correto
- [ ] `correlation_confidence` SEMPRE exibido (canônico para auditoria)
- [ ] `correlation_signals` (spec_mtime / completed_at / git_log) detalhados
- [ ] Edge case `unknown` tratado com mensagem clara apontando para verificação do ID
- [ ] Edge case `low` destacado com ATENÇÃO sobre confiabilidade do número
- [ ] `unknown_models` + `pricing_staleness_days` + `pricing_warning` exibidos
- [ ] Skill `cost-tracking` cross-referenced
</success_criteria>
