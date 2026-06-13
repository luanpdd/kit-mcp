# kit-mcp

[![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Um kit de **agentes, comandos e skills** prontos para Claude Code, Cursor, Codex, Windsurf, Antigravity e outros — destilado da documentação oficial do Supabase, livros canônicos de engenharia, e técnicas comprovadas de orquestração agêntica.
>
> Entregue como **MCP server**. Você usa direto via `npx`, sem instalar nada.

<!-- AUTOGEN-COUNTS-START -->
**Bundled workflow:** 74 agents · 94 commands · 100 skills · 23 gates
<!-- AUTOGEN-COUNTS-END -->

---

## O que é

Quando você usa LLMs em projetos reais, o problema raramente é o modelo — é o **contexto**. Skills, agents e slash-commands são o jeito moderno de injetar processo, padrões canônicos e guard-rails no Claude Code (e similares) sem reescrever cada prompt.

`kit-mcp` é um **kit curado** que materializa isso em três fontes de verdade:

- **Documentação oficial do Supabase** — RLS, branching, Edge Functions, migrations, pgTAP, Custom Claims, Postgres Roles, Storage, Realtime, Cron, pgvector e todas as outras camadas, com anti-pitfalls explícitos.
- **Livros canônicos** — *Working Effectively with Legacy Code* (Feathers), *Designing Data-Intensive Applications* (Kleppmann), *Observability Engineering* (Majors/Fong-Jones/Miranda) e *Google SRE Book* viraram skills aplicáveis (characterization tests, consistency models, golden signals, eliminating toil).
- **Técnicas de harness agêntico** — orquestração via slash-commands (`/discutir-fase`, `/planejar-fase`, `/executar-fase`), handoff cooperativo entre agents, gates de pre-verify, replay determinístico, observabilidade do próprio fluxo agêntico.

Tudo escrito em **PT-BR**, com tabelas, fluxogramas, exemplos rodáveis e referências cruzadas.

---

## Instalar (sem instalar)

Adicione ao `.mcp.json` do seu projeto (ou config global do IDE):

```json
{
  "mcpServers": {
    "kit-mcp": {
      "command": "npx",
      "args": ["-y", "@luanpdd/kit-mcp"]
    }
  }
}
```

Pronto. Na próxima sessão, o IDE faz `npx` e expõe as 14 tools do kit-mcp. Nada instalado globalmente, sem `npm install`.

### Registrar automaticamente

```bash
npx -y @luanpdd/kit-mcp install claude-code
# ou: cursor, codex, windsurf, antigravity, copilot, trae
```

### Projetar skills/agents/commands para o IDE ler

```bash
npx -y @luanpdd/kit-mcp sync claude-code
```

Isso escreve markdown em `.claude/agents/`, `.claude/skills/`, etc. O IDE lê do disco — não precisa do server vivo.

### Fluxo completo de primeiro uso

```bash
npx -y @luanpdd/kit-mcp init
# 1. registra MCP server no IDE
# 2. projeta o kit
# 3. roda diagnóstico
# 4. confirma: "✓ Claude Code agora vê N skills, M agents, K commands"
```

---

## Comandos diários

| Comando | Para quê |
|---|---|
| `kit-mcp logs --tail --follow` | Ver tool calls do servidor em tempo real (JSONL em `~/.kit-mcp/logs/`) |
| `kit-mcp status` | p50/p95/p99 + error rate + sidecar status |
| `kit-mcp doctor` | Diagnóstico completo (versão, sidecar, hooks, IDE config, log dir) |
| `kit-mcp inspect` | TUI live mostrando request/response do MCP |
| `kit-mcp replay list \| show <id>` | Inspecionar payloads de agents gravados |

---

## Cost tracking (v1.37+)

Suíte de telemetria de **custo USD/tokens** consumidos pelo Claude Code, inspirada no
[`ccusage`](https://github.com/ryoppippi/ccusage) com paridade numérica auditável
(delta ≤ 0.5% vs ccusage em fixture golden). Diferencial: integração nativa com
as fases do framework (`cost-phase` correlaciona usage com `.planning/phases/<n>/`).

### 5 MCP tools

| Tool | O que faz |
|---|---|
| `cost-today` | Custo do dia corrente (default UTC; `--tz` override) |
| `cost-session` | Custo de uma sessão (`session_id` explícito ou auto-deduzido) |
| `cost-blocks` | Janelas de 5h com gap-detection (compatível com ccusage `blocks`) |
| `cost-phase` | Custo correlacionado a uma fase do framework + `correlation_confidence` |
| `cost-estimate` | Estimativa prévia (heurística `chars/4 ± 30%`, sem tokenizer real) |

Todas retornam o shape canônico com `total_usd`, `by_model`, `entry_count`,
`deduped_count`, `unknown_models`, `pricing_source` e `pricing_staleness_days`.

### CLI `kit cost`

```bash
kit cost today                          # tabela human-friendly
kit cost today --json                   # raw output do tool
kit cost session --transcript <path>    # sessão de um transcript
kit cost blocks --since 2026-06-01      # janelas 5h dos últimos N dias
kit cost phase --phase 172              # custo correlacionado à fase 172
kit cost estimate "prompt de exemplo"   # estimativa ex-ante
kit cost statusline                     # contrato statusline Claude Code
kit cost refresh-pricing                # refresca snapshot LiteLLM (manual)
```

### Statusline (Claude Code)

Adicione ao `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y @luanpdd/kit-mcp cost statusline"
  }
}
```

Output default compact: `$0.42 sess | $1.20 day | $0.18 5h`.
Override via `KIT_MCP_STATUSLINE_FORMAT=verbose|json`.
Bench: cold P50 ~148ms, warm P50 < 1ms (cache em `os.tmpdir()`).

### Skill `cost-tracking`

Auto-trigger por keywords (`custo`, `cost`, `gasto`, `tokens`, `usd`, `quanto gastei`).
A skill tem bloco de disambiguation explícito vs `burn-rate-status` (SLO error budget)
e `risk-budget` (SRE risk) para evitar colisão de intent.

### Pricing snapshot

Snapshot embedded do [LiteLLM](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)
em `src/core/cost/pricing-snapshot.json` (refresh weekly via GitHub Action,
sempre PR aberto para review humano — nunca auto-merge).

**Limitação conhecida:** o snapshot LiteLLM tem lag-behind oficial de 2-4 semanas
para modelos recém-lançados. Tools retornam `pricing_staleness_days` + warning
se > 30 dias. Modelo desconhecido NUNCA retorna `$0` silencioso — sempre `usd: null`
+ entrada em `unknown_models[]`.

### Persistência opt-in

Use `--persist` (CLI) ou `persist: true` (MCP tool) para gravar o output em
`.planning/costs/<ts>-<tool>.json` (gitignored, dev-only).

### Sem novas runtime deps

Tudo offline-safe, zero deps adicionados em runtime (`ccusage` está em `devDependencies`
apenas para o golden test de paridade). Preserva o budget de 6 deps enforçado em CI.

---

## O que a comunidade precisa saber

### Dois fluxos diferentes, mesma origem

```
┌─────────────┐  kit sync     ┌──────────────────┐
│ kit/        │ ──────────▶   │ .claude/agents/  │   IDE lê do disco
│ (npm pkg)   │  (offline,    │ .claude/skills/  │   na inicialização
│             │   one-shot)   │ .claude/commands/│
└─────────────┘               └──────────────────┘

┌──────────────┐  spawns       ┌──────────────────┐
│ Claude Code  │ ────────────▶ │ kit-mcp (stdio)  │   tools live via
│  (IDE host)  │  stdin/stdout │  14 tools        │   JSON-RPC
└──────────────┘ ◀──────────── └──────────────────┘
```

- **`kit sync`** projeta o conteúdo no formato nativo do IDE — funciona offline e o IDE só precisa dos arquivos.
- **`kit-mcp` (MCP server)** roda como subprocess do IDE e expõe 14 tools (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`, `metrics-snapshot`, `auto-install`, `ack-restart`, `cost-today`, `cost-session`, `cost-blocks`, `cost-phase`, `cost-estimate`).

**Sem output no terminal ao rodar `kit-mcp`?** Não é bug. A spec MCP proíbe stdout fora do JSON-RPC. Use `kit-mcp logs --follow` ou o sidecar UI em `http://localhost:7878`.

### Stable API v1.0+ desde v1.13

16 releases sem breaking changes na superfície MCP. Sua config `.mcp.json` continua funcionando.

### Princípio canônico do handoff cooperativo (v1.23+)

Agents não-Supabase **planejam**, agents Supabase **materializam/hardenam**, ninguém descarta upstream. `BLOCK` rígido é anti-pattern — verdicts são `GO` / `STRENGTHEN` / `REWRITE com confirmação`.

### Defense-in-depth em 10 camadas (Supabase)

RLS + Column-Level + Custom Claims + Postgres Roles + Audit Log + LGPD + Super-admin + Realtime auth + Branching + CI/CD. Cada camada documentada com pattern canônico e anti-patterns.

### Convenção PT-BR

Skills, agents e commands são em PT-BR. Termos técnicos canônicos (RLS, SLO, characterization tests) ficam em EN para preservar busca e referências.

### Configuração via env vars

| Var | Default | O que faz |
|---|---|---|
| `KIT_MCP_NO_UI` | unset | `=1` desabilita sidecar UI auto-spawn |
| `KIT_MCP_LOG_DIR` | `~/.kit-mcp/logs` | Override do log dir |
| `KIT_MCP_LOG_RETENTION_DAYS` | `7` | Retention (0 = forever) |
| `KIT_MCP_INSPECT` | unset | `=1` anexa args/result aos eventos log |
| `KIT_MCP_NOTIFY` | unset | `=1` OS notification em cada tool call |

### Estrutura do kit

```
kit/
├── agents/      67 agents executáveis (planner, executor, debugger, supabase-rls-hardener, supabase-edge-fn-tester, …)
├── commands/    89 slash-commands (/discutir-fase, /planejar-fase, /executar-fase, …)
├── skills/      81 skills consultáveis (supabase-rls-policies, supabase-edge-functions-auth, supabase-edge-runtime-builtins, …)
├── framework/   workflows e templates que os agents delegam
└── hooks/       PostToolUse hooks (sidecar-tool-publisher, etc)
```

### Contribuindo

- Issues e PRs: [github.com/luanpdd/kit-mcp](https://github.com/luanpdd/kit-mcp)
- Skills/agents são markdown puro com frontmatter YAML — editar e abrir PR
- Antes de mexer em código `src/`, leia o `.planning/` (workflow framework)

### Quando NÃO usar

- Você não usa Supabase, Claude Code/Cursor, nem trabalha com agents — provavelmente outro kit serve melhor
- Você quer um framework genérico tipo LangChain — kit-mcp é opinionated, em PT-BR, focado no fluxo Supabase + agêntico

---

## Licença

[MIT](LICENSE) — use, modifique, fork à vontade.

---

**Criado por [Luan PDD](https://github.com/luanpdd)** — engenharia, curadoria de conteúdo e direção do projeto.

Inspirado pelo [vinilana/dotcontext](https://github.com/vinilana/dotcontext).
