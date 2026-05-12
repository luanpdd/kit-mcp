# kit-mcp

[![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Um kit de **agentes, comandos e skills** prontos para Claude Code, Cursor, Codex, Gemini CLI, Windsurf e outros — destilado da documentação oficial do Supabase, livros canônicos de engenharia, e técnicas comprovadas de orquestração agêntica.
>
> Entregue como **MCP server**. Você usa direto via `npx`, sem instalar nada.

<!-- AUTOGEN-COUNTS-START -->
**Bundled workflow:** 66 agents · 89 commands · 76 skills · 23 gates
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

Pronto. Na próxima sessão, o IDE faz `npx` e expõe os 7 tools do kit-mcp. Nada instalado globalmente, sem `npm install`.

### Registrar automaticamente

```bash
npx -y @luanpdd/kit-mcp install claude-code
# ou: cursor, codex, gemini-cli, windsurf, antigravity, copilot, trae
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
│  (IDE host)  │  stdin/stdout │  7 tools         │   JSON-RPC
└──────────────┘ ◀──────────── └──────────────────┘
```

- **`kit sync`** projeta o conteúdo no formato nativo do IDE — funciona offline e o IDE só precisa dos arquivos.
- **`kit-mcp` (MCP server)** roda como subprocess do IDE e expõe 7 tools (`kit`, `sync`, `gates`, `forensics`, `install`, `metrics-snapshot`, `reverse-sync`).

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
├── agents/      66 agents executáveis (planner, executor, debugger, supabase-rls-hardener, …)
├── commands/    89 slash-commands (/discutir-fase, /planejar-fase, /executar-fase, …)
├── skills/      76 skills consultáveis (supabase-rls-policies, structured-events, legacy-characterization-tests, …)
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
