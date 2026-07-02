---
name: cost-tracking
cost_tier: leve
description: Use ao perguntar quanto Claude Code custou — USD/tokens por sessão/fase/bloco 5h. Cobre cost-today/session/blocks/phase/estimate. NÃO é error budget (SLO) — é dinheiro real.
---

# kit-mcp — Cost Tracking (Claude Code USD + tokens)

## Quando usar

LLM carrega esta skill quando o user pergunta sobre **dinheiro/tokens gastos com Claude Code**. Trigger phrases:

- "custo", "cost", "USD", "dólares", "gasto", "gastei", "spent"
- "tokens", "token usage", "consumo de tokens"
- "pricing", "billing", "fatura"
- "budget" (no sentido financeiro, NÃO error budget)
- "ROI", "retorno", "vale a pena essa fase"
- "ccusage", "rastrear custo Claude"
- "quanto a sessão custou", "custo do dia", "custo da fase"
- "estimar custo de prompt", "estimate cost"
- "blocks 5h", "janela de 5 horas"

## Disambiguation — leia ANTES de chamar

Esta skill é sobre **USD/tokens gastos pelo user com a API Claude**. Três skills/comandos parecem similares no nome mas resolvem problemas diferentes — não confundir:

| Skill / Tool | Mede o quê | Quando usar |
|---|---|---|
| **`cost-tracking`** (esta) | **USD reais gastos com Claude API** (snapshot LiteLLM pricing) | "Quanto gastei hoje?" / "Custo da fase 172?" |
| `burn-rate-status` (cmd) | **Error budget SLO** queimando (ratio de erros vs target de disponibilidade) | "Meu SLO está estourando?" / "Page on-call?" |
| `risk-budget` (skill SRE) | **Risco SRE** acumulado (mudanças vs budget de error tolerance) | "Posso fazer release hoje sem queimar budget?" |
| `metrics-snapshot` (tool) | **Golden signals** do próprio kit-mcp server (latency p99, errors, traffic) | "MCP server está saudável?" |

**Regra mnemônica:** se a pergunta tem "$", "USD", "tokens", "fatura" → `cost-tracking`. Se tem "SLO", "5xx", "error rate", "on-call" → `burn-rate-status` ou `risk-budget`.

## Regras absolutas

- **Modelo desconhecido NUNCA retorna `$0` silencioso** — entra em `unknown_models[]` com `usd: null`. Mostra esses modelos ao user para que ele saiba o que NÃO foi precificado.
- **Pricing tem staleness** — `pricing_staleness_days` no output. Se > 30d, há `pricing_warning`. Refresh manual via `npm run regen-pricing` (M5) ou GH Action semanal.
- **Naming kebab-case** — `cost-today`, NÃO `cost_today`. Consistente com `metrics-snapshot`, `reverse-sync`.
- **`cost-estimate` é heurística** — chars/4 ± 30%, sem tokenizer real na v1.37.0. O `disclaimer` no output explicita isso. NÃO citar valor exato para o user; sempre apresentar `[low, high]` ou avisar do range.
- **`cost-phase` é correlação, não medição direta** — usa janela temporal inferida (mtime de SPEC.md + STATE.md.completed_at + git log). O campo `correlation_confidence` (high/medium/low/unknown) gradua a confiança. NUNCA reportar `cost-phase` como número exato sem dizer a confidence.
- **`persist:true` é opt-in** — default off. Quando ligado, grava `.planning/costs/<ts>.json` (gitignored). Útil para histórico, ruim para CI ruidoso.
- **`refresh_pricing:true` é opt-in com side-effects** — fetch http models.dev + cache em `~/.kit-mcp/pricing-cache.json` TTL 24h. NÃO ligar por padrão (latência + risco rede + pollution de cache).
- **Timezone default é UTC** — paridade com `ccusage`. Override via `tz` se o user quer "meu dia" local (ex: `tz: "America/Sao_Paulo"`).
- **Blocks são janelas de 5h sliding com gap-detection** — gap > 5h entre entries inicia novo bloco. Útil para ver "sessão de trabalho A" vs "sessão B" do mesmo dia.

## Map de intents → tool

| Intent do user | Tool | Arguments mínimos |
|---|---|---|
| "Quanto gastei hoje?" / "Custo do dia" | `cost-today` | `{}` (default UTC) |
| "E em São Paulo?" | `cost-today` | `{ tz: "America/Sao_Paulo" }` |
| "Custo desta sessão" / "Sessão atual" | `cost-session` | `{}` (auto-deduz) |
| "Custo de uma sessão específica" | `cost-session` | `{ session_id: "uuid-..." }` |
| "Custo da última semana em blocos" | `cost-blocks` | `{}` |
| "Custo da fase 172" / "Quanto a Phase X gastou" | `cost-phase` | `{ phase_id: "172" }` |
| "Estima o custo desse prompt antes" | `cost-estimate` | `{ text: "..." }` |
| "Estima para opus 4" | `cost-estimate` | `{ text: "...", model: "claude-opus-4-5" }` |
| "Salva um snapshot do custo de hoje" | `cost-today` | `{ persist: true }` |

## Shape canônico do output (todas as tools)

```js
{
  total_usd: number | null,            // null se 100% unknown_models
  by_model: {
    "<model>": { usd, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, entry_count },
    ...
  },
  entry_count: number,
  deduped_count: number,               // entries descartadas pelo dedup 3-níveis
  skipped_entry_count: number,         // messageId/requestId null
  parse_error_count: number,           // linhas JSONL corrompidas
  unknown_models: string[],            // modelos não no snapshot — NUNCA pricing $0 silencioso
  pricing_source: 'snapshot' | 'mixed' | 'fallback-modelsdev' | 'unknown',
  pricing_staleness_days: number,      // idade do snapshot em dias
  pricing_warning?: string,            // presente se staleness > 30d
  // campos específicos:
  date?: "YYYY-MM-DD",                 // cost-today
  tz?: string,                         // cost-today
  session_id?: string,                 // cost-session
  started_at?: ISO,                    // cost-session/phase
  last_activity_at?: ISO,              // cost-session
  source_file?: string,                // cost-session
  blocks?: [...],                      // cost-blocks
  phase_id?: string,                   // cost-phase
  phase_slug?: string,                 // cost-phase
  correlation_confidence?: 'high'|'medium'|'low'|'unknown',  // cost-phase
  estimated_input_tokens?: number,     // cost-estimate
  estimated_output_tokens?: number,    // cost-estimate
  estimated_usd?: number,              // cost-estimate
  estimated_usd_range?: [low, high],   // cost-estimate
  disclaimer?: string,                 // cost-estimate
}
```

## Exemplos canônicos

### Exemplo: custo do dia atual em UTC

```js
// MCP call
{ name: 'cost-today', arguments: {} }
// Output (typical)
{
  date: "2026-06-05",
  tz: "UTC",
  total_usd: 0.42,
  by_model: {
    "claude-sonnet-4-5": { usd: 0.38, input_tokens: 120000, output_tokens: 12000, cache_creation_tokens: 0, cache_read_tokens: 5000, entry_count: 18 },
    "claude-haiku-4-5":  { usd: 0.04, input_tokens:  40000, output_tokens:  3000, cache_creation_tokens: 0, cache_read_tokens:    0, entry_count:  6 }
  },
  entry_count: 24,
  deduped_count: 2,
  skipped_entry_count: 0,
  parse_error_count: 0,
  unknown_models: [],
  pricing_source: "snapshot",
  pricing_staleness_days: 3
}
```

### Exemplo: custo da sessão ativa (auto-deduzida)

```js
{ name: 'cost-session', arguments: {} }
// → busca JSONL mais recente com mtime < 30min, deriva session_id, agrega
```

### Exemplo: custo de uma fase do framework

```js
{ name: 'cost-phase', arguments: { phase_id: "172" } }
// Output:
{
  phase_id: "172",
  phase_slug: "cost-tracking",
  started_at: "2026-06-04T10:00:00.000Z",
  ended_at: null,                          // ainda ativa
  is_active: true,
  correlation_confidence: "medium",        // SPEC.md mtime + git log, sem completed_at ainda
  correlation_signals: { spec_mtime: true, completed_at: false, git_log: true },
  total_usd: 1.83,
  by_model: { ... },
  entry_count: 145,
  ...
}
```

### Exemplo: estimar custo antes de mandar prompt

```js
{ name: 'cost-estimate', arguments: { text: "Analise esse codebase...", model: "claude-opus-4-5" } }
// Output:
{
  model: "claude-opus-4-5",
  text_length: 2400,
  estimated_input_tokens: 600,
  estimated_output_tokens: 1800,
  estimated_usd: 0.099,
  estimated_usd_range: [0.069, 0.129],
  disclaimer: "heuristic_chars_div_4_±30pct",
  pricing_source: "snapshot",
  pricing_staleness_days: 3,
  unknown_models: []
}
// Apresentar ao user: "estimativa entre $0.07 e $0.13 (±30% heurística chars/4)"
```

### Exemplo: persistir snapshot do dia para histórico

```js
{ name: 'cost-today', arguments: { persist: true } }
// → grava .planning/costs/2026-06-05T...-cost-today.json e retorna o mesmo shape + persisted_to: "<file>"
```

## Anti-patterns

### ANTI: confundir com error budget (burn-rate)

```text
ANTI: user diz "estou queimando budget" e LLM chama cost-today.

PROBLEMA: "queimar budget" no jargão SRE = error budget de SLO (ratio de
          erros vs target de disponibilidade). cost-tracking é USD reais.
          Resposta fica sem sentido — user perguntou sobre disponibilidade
          do serviço, recebeu fatura de Claude.

CERTO: verificar contexto: o user fala de SLO/disponibilidade/5xx/on-call?
       → burn-rate-status. Fala de dinheiro/Claude/sessão/dia/fase? →
       cost-tracking. Em dúvida, perguntar.
```

### ANTI: reportar `cost-estimate` como valor exato

```text
ANTI: "Vai custar $0.099" sem mencionar range nem heurística.

PROBLEMA: chars/4 diverge ~30% em PT-BR (multibyte) e em prompts com
          muito código (tokens densos). Quando o user manda o prompt de
          fato, fatura vem 30% maior — user pergunta por que mentimos.

CERTO: SEMPRE apresentar `[low, high]` ou faixa: "estimativa $0.07–$0.13
       (heurística ±30%)". Citar o disclaimer literal.
```

### ANTI: cost-phase como número de auditoria contábil

```text
ANTI: "A Phase 172 custou exatamente $4.21" sem mostrar confidence.

PROBLEMA: cost-phase usa janela inferida (mtime/STATE/git log). Se a
          fase tem commits intercalados de OUTRAS fases ou rebase
          recente, a janela está borrada. Apresentar como verdade
          contábil leva a decisão errada de scope.

CERTO: sempre incluir `correlation_confidence` na resposta. "$4.21 com
       confidence=medium (faltou completed_at em STATE.md)" — user
       sabe que é estimativa, não auditoria.
```

### ANTI: modelo desconhecido sumir do output

```text
ANTI: filtrar entries de modelo unknown antes de retornar.

PROBLEMA: user faz pergunta "quanto gastei hoje?", LLM retorna $0.20
          (só sonnet). Mas o user também usou claude-opus-4-9 (futuro
          modelo não no snapshot) — sumiu silencioso. Decisão de
          continuar usando opus errada porque "tá barato".

CERTO: `unknown_models: ["claude-opus-4-9"]` no output. Mencionar ao
       user: "$0.20 + 1 modelo não precificado (claude-opus-4-9) —
       refresh snapshot ou use refresh_pricing:true".
```

### ANTI: ligar `refresh_pricing:true` por padrão

```text
ANTI: passar refresh_pricing: true em toda call para "garantir frescor".

PROBLEMA: faz HTTP fetch para models.dev em cada call → latência +200ms
          a +2s; pollui ~/.kit-mcp/pricing-cache.json com fetches
          redundantes; se rede cai, tool fica lenta/falha; rate limit
          em models.dev se muitos users.

CERTO: deixar default false. Ligar SÓ quando `unknown_models[]` aparece
       no output e o user pede explicitamente "tente buscar pricing
       desse modelo". Cache TTL 24h cobre o caso comum.
```

## Limitações conhecidas (debt v1.37.0)

- **LiteLLM lag-behind oficial** — snapshot pode estar dias atrás da pricing oficial Anthropic quando lançam modelo novo. `pricing_staleness_days` + `pricing_warning` sinalizam, mas não eliminam o gap.
- **Tokenizer real ausente em `cost-estimate`** — chars/4 + 30% range é heurística. v1.38.0 deve trazer tiktoken/anthropic-tokenizer real.
- **`correlation_confidence` heurística inicial** — `cost-phase` usa 3 sinais binários (SPEC.md mtime, STATE.md completed_at, git log no dir). Iteração com sinais ricos (PR linkage, commit message tagging) fica em v1.37.1.
- **Multi-account sem UI** — `config_dirs[]` aceita lista (cobertura estrutural), mas não há comando "switch account". Para multi-conta hoje: passe `config_dirs: ["dir1", "dir2"]`.
- **Sem suporte a Codex/Gemini/Copilot na v1.37.0** — apenas Claude (Anthropic) via JSONL do Claude Code.
- **Statusline P50 < 50ms só com warm cache** — cold start hits filesystem + parse. Documentado, não eliminado.

## Verificação antes de responder ao user

1. Output da tool foi precificado? (`pricing_source !== 'unknown'` para a maioria dos entries)
2. Tem modelos desconhecidos? Se sim, mencionar ao user.
3. `pricing_staleness_days > 30`? Avisar: "pricing snapshot tem N dias — pode estar desatualizado".
4. Se `cost-phase`, sempre citar `correlation_confidence`.
5. Se `cost-estimate`, sempre apresentar range, não valor único.
6. Se `total_usd === null`, todos os modelos eram unknown — não falar "$0", falar "não consegui precificar".

## Cross-references

- `metrics-snapshot` (tool MCP) — golden signals do kit-mcp server. Diferente de cost-tracking (esta é dinheiro Claude API; aquela é saúde do MCP server).
- `burn-rate-status` (slash command) — SLO error budget burn (dual-window). NÃO é financeiro.
- `risk-budget` (skill SRE) — risk budget de mudanças vs error tolerance. NÃO é financeiro.
- `four-golden-signals` (skill) — Latency/Traffic/Errors/Saturation para serviços user-facing. Pattern de instrumentação, não cost-tracking.
- Golden test paridade: `test/integration/cost-paridade-ccusage.test.js` valida delta ≤ 0.5% vs `ccusage` (Rust CLI).

---

*Material-fonte: ccusage (Rust CLI, ryoppippi/ccusage v3+) — paridade numérica auditável. Pricing: LiteLLM `model_prices_and_context_window.json` snapshot embedded at build time.*
