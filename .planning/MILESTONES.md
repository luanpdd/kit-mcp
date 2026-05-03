# MILESTONES.md — Histórico de releases

> Reconstruído a partir do CHANGELOG e dos commits. Fonte canônica das versões está em `CHANGELOG.md`.

## Concluídos

### v0.1.x — Foundation (2026-05-03)
- v0.1.0: Initial release. 5 MCP tools, 8 IDE targets, registry table, markdown-reference projection.
- v0.1.1–0.1.6: Polishes (`--via npx`/`local`/`global`, CI, npm provenance, README, badges, reverse-sync, watch, gate runner, forensics reflect).

### v0.2.0 — Cleanup falho (2026-05-03)
- Removeu por engano o kit pessoal achando ser third-party. **Deprecated retroativamente** — não usar.

### v0.2.1 — Patch da v0.2.0 (2026-05-03)
- Mantém o erro da v0.2.0. Não usar.

### v0.3.0 — Workflow restaurado (2026-05-03)
- 19 agents, 60 commands, framework, hooks restaurados de `069349c^`.
- Skills da Anthropic Cowork excluídas conscientemente.
- Trynux/IEP-Advocacia/Notion ID hardcoded → env vars (`KIT_NOTION_PARENT_PAGE_ID`, `OBSIDIAN_VAULT_REPO`).

### v0.4.0 — Docs alinhados (2026-05-03)
- README reescrito: kit bundled é caminho default; `--kit-root` é escape hatch.
- BUG: import morto `DEFAULT_KIT_ROOT` em `src/mcp-server/index.js` quebrava boot via `npx`. **Deprecated**.

### v0.4.1 — Fix MCP boot (2026-05-03)
- Removido import morto.
- Adicionado boot test ao CI.

### v0.5.0 — Mirror-tree sync (2026-05-03)
- Nova capability `framework` e `hooks` no registry: cópia recursiva de `kit/framework/` e `kit/hooks/` para `.claude/framework/` e `.claude/hooks/`.
- Marker `.kit-mcp-managed` na raiz pra `sync remove` seguro.
- CI cobre projection + safety (preserva user files sem marker).
- **Resolve a regressão estrutural** que fazia commands tipo `/novo-marco` aparecerem na IDE mas falharem em runtime ao tentar ler templates.

## Em andamento

(nada — encerrar planejamento de v1.x abaixo)

## Backlog macro (não-priorizado)

- **HTTP transport** para IDEs que não falam stdio MCP.
- **forensics reflect com diff visual** em vez de full content.
- **`kit gates run --all`** agregando vereditos de todas as gates de um stage.
- **Dependabot config** para `chokidar` e `@modelcontextprotocol/sdk`.
- **`kit sync watch` exposto via MCP** (challenge: long-running tool).
- **Tests além de smoke** — unit/integration para kit.js, sync.js, reverse-sync.js, gate-runner.js.
- **Skill da `inserir-fase` com description quebrada** (mostra `<!-- kit-mcp:reference -->` em vez do real description). Bug de parsing do frontmatter quando há linha em branco antes do conteúdo.
- **GitHub Releases page** ainda mostra `v0.2.0 — cleanup` como Latest. Criar Release object pra v0.5.0.
- **Documentação site** (a partir do README + CHANGELOG).
- **Reverse-sync para framework/hooks** — atualmente só agents/commands/skills.
