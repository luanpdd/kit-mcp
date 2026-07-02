# kit-mcp

[![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Um kit de **agentes, comandos e skills** prontos para Claude Code, Cursor, Codex, Windsurf, Antigravity e outros — destilado da documentação oficial do Supabase, livros canônicos de engenharia, e técnicas comprovadas de orquestração agêntica.
>
> Entregue como **MCP server**, **modular**: instale só os **packs** que você usa (Supabase, Observabilidade, Legacy, UI…) — o resto não entra no seu projeto. Use direto via `npx`, sem instalar nada.

<!-- AUTOGEN-COUNTS-START -->
**Bundled workflow:** 86 agents · 99 commands · 103 skills · 24 gates
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

## Content Packs — instale só o que você usa (v1.39+)

O kit é dividido em **packs autossuficientes** (cada um traz tudo que precisa — sem dependência
entre packs). A base (`core`) é sempre instalada; o resto é opcional. Não usa Supabase? Não instale
o pack `supabase` e nenhum recurso Supabase é projetado no seu `.claude/`.

| Pack | O que é |
|---|---|
| `core` | **Obrigatório.** Framework de fases (discutir→planejar→executar→verificar), debugging, mapeamento. |
| `supabase` | Mundo Supabase completo: schema/RLS/migrations/Edge Functions/Auth/Storage/Realtime + B2B multi-tenant + auditoria de dados distribuídos. |
| `observability` | OpenTelemetry, golden signals, SLO/burn-rate, toil, postmortem, PRR. |
| `legacy` | Characterization tests, seams, refactor seguro, duplicação (Feathers). |
| `ui` | Fluência de design para IA: UI-SPEC, auditoria visual, designer. |
| `cost-workflow` | Cost tracking (USD/tokens) + gerador de Dynamic Workflows. |

### Ver os packs disponíveis

```bash
npx -y @luanpdd/kit-mcp pack list                 # catálogo: cada pack + nº de agents/skills/commands
npx -y @luanpdd/kit-mcp pack info supabase        # detalhe de um pack (o que instala, deps, removível)
```

### Instalar — escolher os packs

```bash
# sem --packs = kit inteiro (padrão, sem breaking change):
npx -y @luanpdd/kit-mcp sync install claude-code

# só a base + os packs que você quer (ex.: tudo MENOS Supabase):
npx -y @luanpdd/kit-mcp sync install claude-code --packs core,observability,legacy,ui,cost-workflow

# só o essencial Supabase:
npx -y @luanpdd/kit-mcp sync install claude-code --packs core,supabase
```

### Trocar os packs depois (incremental, v1.41+)

`add`/`remove`/`store` ajustam a seleção sem reinstalar tudo. A seleção fica gravada num lockfile por
IDE (`<stateDir>/.kit-mcp-packs.json`), então re-syncs e upgrades preservam o que você escolheu.

```bash
npx -y @luanpdd/kit-mcp pack add observability legacy   # adiciona e re-sincroniza
npx -y @luanpdd/kit-mcp pack remove supabase            # apaga só os arquivos exclusivos do pack
npx -y @luanpdd/kit-mcp pack store                       # loja interativa (checkbox; core travado)
npx -y @luanpdd/kit-mcp pack doctor                      # quais packs estão instalados por IDE
```

`remove` é seguro: só apaga arquivos que ainda são stubs gerados pelo kit (arquivos que você editou à
mão são preservados) e nunca remove `core`. Vale para qualquer IDE (`cursor`, `codex`, `windsurf`,
`antigravity`, `copilot`, `trae`) — `add`/`remove` iteram sobre todos os IDEs já instalados.

> O router (`kit-router`) e o `CLAUDE.md` agregado são gerados *bundle-aware*: só citam os domínios
> e recursos dos packs que você instalou — sem rotear para `/supabase` ou agents ausentes.

### Consciência de uso e custo (v1.40+)

Cada agent/skill declara **`cost_tier: leve | medio | pesado`** no frontmatter — você vê o peso no
seletor da IDE **antes** de acionar (ex.: `executor` é `pesado` porque encadeia subagentes). As
descriptions seguem o padrão *outcome-first* (o que entrega + quando usar + sinal de custo). Para o
gasto real em USD/tokens, use o pack `cost-workflow`: `npx -y @luanpdd/kit-mcp cost today`.

**Em runtime (v1.41+):** o `cost_tier` aparece nas listagens (`kit kit list-agents`, MCP tool `kit`)
e no `CLAUDE.md` agregado; os orquestradores fazem **pré-flight** antes de disparar subagentes em
massa (listam quem vão chamar + o tier), controlado pelo toggle `workflow.cost_awareness`
(`silencioso | resumo | confirmar`) em `/configuracoes`; e o rodapé de atribuição sugere
`/custo-sessao` quando o turno usou recursos `medio`/`pesado`.

---

## Comandos diários

| Comando | Para quê |
|---|---|
| `kit-mcp logs --follow` | Ver tool calls do servidor em tempo real (JSONL em `~/.kit-mcp/logs/`); `--tail <n>` ajusta o backlog |
| `kit-mcp status` | p50/p95/p99 + error rate + sidecar status |
| `kit-mcp doctor` | Diagnóstico completo (versão, sidecar, hooks, IDE config, log dir) |
| `kit-mcp inspect` | TUI live mostrando request/response do MCP |
| `kit-mcp replay list` · `replay show <id>` | Inspecionar payloads de agents gravados |

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

**Sem output no terminal ao rodar `kit-mcp`?** Não é bug. A spec MCP proíbe stdout fora do JSON-RPC. Use `kit-mcp logs --follow` ou o sidecar UI (porta auto-pick na faixa 7100-7199, impressa no stderr ao iniciar).

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
├── agents/      86 agents executáveis (planner, executor, debugger, supabase-rls-hardener, …) — cada um com cost_tier
├── commands/    99 slash-commands (/discutir-fase, /planejar-fase, /executar-fase, …)
├── skills/      103 skills consultáveis (supabase-rls-policies, supabase-edge-functions-auth, …) — cada uma com cost_tier
├── packs/       manifestos dos Content Packs (core, supabase, observability, legacy, ui, cost-workflow)
├── framework/   workflows e templates que os agents delegam
└── hooks/       PostToolUse hooks (sidecar-tool-publisher, etc)
```

### Contribuindo

- Issues e PRs: [github.com/luanpdd/kit-mcp](https://github.com/luanpdd/kit-mcp)
- Skills/agents são markdown puro com frontmatter YAML — editar e abrir PR
- Antes de mexer em código `src/`, leia o `.planning/` (workflow framework)

### Quando NÃO usar

- Você não usa Claude Code/Cursor/Codex (ou similar) nem trabalha com agents — provavelmente outro kit serve melhor
- Você quer um framework genérico tipo LangChain — kit-mcp é opinionated e em PT-BR

> **Não usa Supabase?** Ainda serve: instale `--packs core,observability,legacy,ui,cost-workflow` e
> nenhum recurso Supabase entra. O pack `supabase` é opcional, não o produto inteiro.

---

## Licença

[MIT](LICENSE) — use, modifique, fork à vontade.

---

**Criado por [Luan PDD](https://github.com/luanpdd)** — engenharia, curadoria de conteúdo e direção do projeto.

Inspirado pelo [vinilana/dotcontext](https://github.com/vinilana/dotcontext).
