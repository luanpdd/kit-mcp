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

### v1.0.0 — Estabilização para 1.0 (2026-05-03) 🎉 First stable
- 12/12 REQs entregues em 5 fases (tooling, parser, reverse-sync, tests, cut).
- Tests: 42 automatizados (37 unit + 5 integration) via `node:test`, zero deps.
- CI: 6/6 combinações verdes (Ubuntu/macOS/Windows × Node 20/22) em todo push.
- Reverse-sync simétrico: detect/apply para framework + hooks (mirror-tree).
- Parser fixes coordenados: stub reorder + HTML-comment skip + YAML quoting.
- publish.yml cria GitHub Release object automaticamente em todo `v*`.
- Stable API commitment: TARGETS, MCP actions, CLI surface, core exports, stub format, marker semantics.
- Detalhes: `.planning/milestones/v1.0.0/`.

### v1.2.0 — GUI sidecar de acompanhamento (2026-05-04) 🪟 Live process viewer
- 56/56 REQs entregues em 8 fases (lock arquitetural, fundações, servidor HTTP+SSE, UI estática, publisher+wrapper, CLI integration, MCP auto-spawn, hardening+release).
- Sidecar web localhost (porta 7100-7199) com SSE; abre via `kit ui start` ou `autoSpawn:true` em tools MCP de sync/reverse-sync/gates.
- Stable API v1.0+ preservada — apenas adições. `src/core/` literalmente intocado (`git diff` vazio).
- 1 dep nova: `open@11` (única; budget atingido em 6/6).
- Tests: 151 (49 u + 9 i baseline → ~80 u + ~71 i = 151). +93 vs v1.1.
- 7 audit gates ativos no CI: stdout discipline em `src/ui/`, dep budget, npm pack UI assets, Host check, Origin check, CSP shape, path redaction.
- Threat model finalizado em `docs/sidecar-security.md`: bind 127.0.0.1, CSP estrito, path scrubbing central, sem auth (mitigado).
- Bug pré-existente corrigido: `kit --version` agora lê de `package.json` (era hardcoded 1.0.0).
- Ship readiness: working tree clean, todos os tests verde, REL-02 (tag) e REL-03 (npm publish) requerem user action.
- Detalhes: `.planning/milestones/v1.2.0/`.

### v1.1.0 — Feedback visual no terminal (2026-05-03) 🎨 Visual UX
- 10/10 REQs entregues em 5 fases (UI primitives, --json flag, progress, selectors, cut).
- `src/core/ui.js` (~167 LOC) — color/icons/spinner/progress/select/confirm/summary, respeita NO_COLOR + isTTY.
- Default output muda de JSON para human-readable; `--json` global flag preserva v1.0.
- Progress bar em ops longas (sync install, reverse-sync apply); spinner em curtas (kit list-*, sync targets).
- Selector interativo em `install write` e `sync install` quando target ausente em TTY.
- `install write` sempre faz dry-run + preview + confirm (`--yes`/`--json` bypass).
- Tests +16 (49 unit + 9 integration = 58 total).
- Deps adicionadas: picocolors, @inquirer/prompts (selectivamente importado).
- Stable API additions: --json semantics, onProgress callback signature, non-TTY error fallback.
- Detalhes: `.planning/milestones/v1.1.0/`.

## Em andamento

(nada — milestone v1.2.0 concluído e arquivado em 2026-05-04, pendente apenas tag/publish via user action)

## Backlog macro (não-priorizado)

- **CLI awkwardness do double-`kit`**: `kit kit list-agents`, `kit kit search`, `kit kit get` — o grupo "kit" repete o nome do binário. Considerar achatar (alias top-level: `kit list-agents` direto, mantendo `kit kit ...` como compatibilidade) ou renomear o grupo (`kit browse list-agents`?). Detectado em smoke da v1.1.0.
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
