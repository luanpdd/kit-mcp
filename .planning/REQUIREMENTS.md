# REQUIREMENTS — kit-mcp v1.6

**Milestone:** v1.6 — perf+lean (interno)
**Aberto em:** 2026-05-05
**Status:** Definindo

> Origem: auditoria de codebase 2026-05-05 (4 agentes Explore paralelos). Bundle v1.5.3 entregou 4 quick-wins; este milestone endereça os 16 restantes.
> Sem features novas. Stable API v1.0+ preservada — campos só são removidos de outputs MCP onde "remoção de campo opcional" é compatível.

---

## Requisitos do Milestone v1.6

### Performance

- [ ] **PERF-01**: `listKit()` retorna do cache em chamadas repetidas dentro de uma janela de 30s, sem re-ler 60+ arquivos `.md` do disco. (`src/core/kit.js`)
- [ ] **PERF-02**: Regex de frontmatter (`/^---\r?\n([\s\S]*?)\r?\n---/`) é compilado uma única vez no top-level do módulo, não em cada loop de `readMdDir`. (`src/core/kit.js`)
- [ ] **PERF-03**: `syncTo()` e `detectReverse()` aceitam um `kit` pré-carregado como parâmetro opcional, evitando dois walks completos quando chamados sequencialmente. (`src/core/sync.js`, `src/core/reverse-sync.js`)
- [ ] **PERF-04**: `acquireLockOrReclaim()` aplica timeout local de 500 ms ao `healthzProbe` injetado, evitando que startup do sidecar trave esperando um sidecar morto. (`src/ui/lockfile.js`)
- [ ] **PERF-05**: `GET /state` aceita `?offset=N&limit=M` e retorna ring buffer paginado quando solicitado, mantendo o comportamento default (ring inteiro) para compatibilidade. (`src/ui/server.js`)

### Segurança

- [ ] **SEC-01**: `acquireLockOrReclaim()` re-prova staleness após `releaseLock()` e antes de `acquireLock()` no caminho de retry, fechando a janela TOCTOU em alta contenção. (`src/ui/lockfile.js`)
- [ ] **SEC-02**: `walkTree()` em `src/core/sync.js` rejeita entradas cujo `path.normalize()` contém `..` ou caminho absoluto, prevenindo escrita fora do `projectRoot` em mode=copy. (`src/core/sync.js`)
- [ ] **SEC-03**: `redactPath()` normaliza casing e separadores antes de aplicar regex, garantindo que `C:\Users\foo` e `c:/users/foo` sejam ambos redatados em Windows. (`src/ui/wrapper.js`)
- [ ] **SEC-04**: CI executa `npm audit --audit-level=high --omit=dev` em todo push, falhando o build em CVEs Alto+ na única dep runtime (`open@11`). (`.github/workflows/ci.yml`)

### Infraestrutura

- [ ] **INF-01**: `package.json` declara `prepublishOnly` que roda `npm test && npm run test:integration && node bin/cli.js kit list-agents | head -1`, garantindo smoke local antes de qualquer `npm publish`. (`package.json`)
- [ ] **INF-02**: Repo inclui `.npmignore` explícito (ou seção `files` no `package.json` é declaração canônica) listando o que vai pro tarball — não dependendo de defaults npm. (`.npmignore` ou `package.json`)
- [ ] **INF-03**: Matriz CI inclui Node 24 (LTS atual) além de 20 e 22. (`.github/workflows/ci.yml`)
- [ ] **INF-04**: Mensagem do gate de deps-budget reflete o count real de runtime deps (atualmente 1 — `open@11`), não a baseline obsoleta de "5". (`.github/workflows/ci.yml`)

### Tokens

- [ ] **TOK-01**: `kit/agents/planner.md` reduzido de ~53 KB para ≤ 35 KB sem perder regras críticas — remover redundância em `<philosophy>` / `<scope_estimation>` / `<task_breakdown>`. (`kit/agents/planner.md`)
- [ ] **TOK-02**: `CLAUDE.md` projetado por `kit sync` retorna apenas summaries (name + 1-line desc) na lista de agents/commands/skills, com link pro path do kit. Reduz ~5 KB no carregamento inicial. (`src/core/sync.js`, gerador de CLAUDE.md)
- [ ] **TOK-03**: Headers recursivos consolidados em agents grandes (`planner.md` de 72 → ≤ 25 headers `##`/`###`), substituindo aninhamento por blocos enxutos. (multiple agents)

---

## Requisitos Futuros (adiados)

- Multi-source tabs no sidecar (eventos com campo `source` identificando terminal/IDE) — escopo de v1.7+
- Always-on do sidecar via OS service (Task Scheduler / systemd-user) — escopo de v1.7+
- Aggregation cross-projeto numa janela só — escopo de v1.7+

## Fora do Escopo

- Reescrita de `src/core/` — milestone explicitamente preserva Stable API v1.0+
- Migração para framework de teste externo — atual `node:test` zero-dep é princípio de produto
- Sidecar autenticado / multi-user — fora do threat model atual (localhost-only, single-user)

## Rastreabilidade

(preenchida pelo roadmap em ROADMAP.md)
