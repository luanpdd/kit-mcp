# PROJECT.md — kit-mcp

> Bootstrap inicial em 2026-05-03 a partir do histórico de releases. Contexto consolidado da sessão de restauração + fix-up + 0.5.0.
> Última atualização: 2026-05-05 — abertura de v1.6.0.

## Milestone Atual: v1.6 perf+lean (interno — saúde de codebase)

**Objetivo:** Endereçar 16 itens identificados pela auditoria de codebase (executada após v1.5.3) que ficaram fora do bundle quick-win. Foco: tornar o servidor mais barato de rodar, mais seguro, com release pipeline mais robusto e prompts mais enxutos.

**Funcionalidades alvo (todas internas, zero superfície de API nova):**
- **Performance** — listKit caching, compilação top-level de regex, reuso de kit em sync/reverse-sync, healthz probe com timeout local, paginação opcional em /state
- **Segurança** — TOCTOU em acquireLockOrReclaim, normalização de path em walkTree, redactPath case-insensitive (Windows), audit periódico de open@11
- **Infra** — `prepublishOnly` script, `.npmignore` explícito, Node 24 na matriz CI, mensagem do deps-budget gate sincronizada com count real
- **Tokens** — compactar `planner.md` (53 KB → ~30 KB), lazy-load CLAUDE.md gerado, consolidar headers recursivos em agents grandes

**Decisões de stack:**
- Continua zero deps novas. Otimização interna sem ampliar superfície.
- Sem mudanças de API runtime (`Stable API v1.0+` preservada). Reduções em outputs de tool MCP são "remoções de campo opcional" — clientes ainda funcionam.
- Roadmap começa em **Phase 19** (continuando de v1.2 que terminou em Phase 18; v1.3-v1.5.x foram patches ad-hoc fora do framework).

**Contrato preservado:** Quem usa kit-mcp em produção (sync/reverse-sync/MCP via npx ou global) não percebe nada além de menor latência e menor consumo de tokens. CI permanece 6/6 verde, smoke tests inalterados.

## Visão de uma frase

kit-mcp é um MCP server que distribui o fluxo de trabalho pessoal do mantenedor (agents, slash-commands, framework de planejamento brownfield em PT-BR, hooks) e sincroniza esse kit no layout nativo de qualquer IDE compatível (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae).

## Por que existe

- O conteúdo de `.claude/agents/`, `.claude/commands/` e `.claude/skills/` é poderoso mas amarrado ao Claude Code.
- O mesmo conteúdo precisa também viver como `AGENTS.md` para Codex, `GEMINI.md` para Gemini, `.cursor/rules/` para Cursor, etc.
- Manter cópias paralelas drift imediatamente.
- kit-mcp guarda a fonte canônica em um único lugar (`kit/`) e projeta para cada IDE através de um registry table único (`src/core/registry.js`).

## Stack

- **Runtime**: Node.js ≥ 20, ESM puro, sem build step.
- **Deps de runtime**: `@modelcontextprotocol/sdk`, `commander`, `chokidar`.
- **Distribuição**: npm (`@luanpdd/kit-mcp`, scoped, public).
- **CI**: GitHub Actions, smoke tests em Ubuntu/macOS/Windows × Node 20/22.

## Arquitetura

```
CLI ↔ src/core/  (pure runtime: registry, kit, sync, gates, forensics, watch, reverse-sync)
       ↑       
MCP server (stdio) — exposes 6 action-dispatch tools (kit, sync, reverse-sync, gates, forensics, install)
       ↑
.mcp.json registration → IDE invoca o server quando abre o projeto
```

Sync grava stubs markdown-reference por padrão (`.claude/agents/foo.md` aponta de volta para `kit/agents/foo.md`). Mirror-tree para framework + hooks (cópia direta da subtree).

## Princípios de produto

1. **Single canonical source.** `kit/` é a verdade. Tudo em `.claude/` (e equivalentes) é regenerável.
2. **Add-an-IDE = uma entrada na tabela.** O TARGETS dict em `registry.js` é o único lugar onde IDEs são descritas.
3. **Pre-1.0 SemVer permissivo.** Mudanças comportamentais são minor bumps; correções são patch.
4. **Pacote pequeno, dependências mínimas.** Nada de build steps, frameworks de teste pesados, ou polifills.

## Restrições

- **Sem 2FA bypass nas chaves npm além do necessário pra publicação automática.**
- **Não embarcar conteúdo de terceiros** (Anthropic Cowork skills, Notion IDs privados, URLs de repos privados).
- **Cross-platform sempre.** Windows, macOS e Linux têm que funcionar igual.

## Evolução

Este documento evolui nas transições de fase e limites de milestone.

**Após cada transição de fase** (via `/transicao`):
1. Requisitos invalidados? → Mover para Fora do Escopo com motivo
2. Requisitos validados? → Mover para Validados com referência de fase
3. Novos requisitos surgiram? → Adicionar em Ativos
4. Decisões a registrar? → Adicionar em Decisões-chave
5. "O Que É" ainda está preciso? → Atualizar se driftar

**Após cada milestone** (via `/concluir-marco`):
1. Revisão completa de todas as seções
2. Verificação do Valor Central — ainda é a prioridade certa?
3. Auditar Fora do Escopo — motivos ainda são válidos?
4. Atualizar Contexto com estado atual
