# Architecture Decision Record — kit-mcp v1.2

> Decisões trade-off do milestone v1.2 (GUI sidecar). Cada entry no formato Status/Context/Decision/Consequences. Atualizar quando uma decisão for revisitada.

---

## ADR-01: Faixa de portas do sidecar — 7100-7199 com auto-fallback

**Status:** Accepted (2026-05-04)

**Context:**
Sidecar HTTP precisa de uma porta TCP em localhost. Hardcode é frágil (colide com outros dev servers). Pesquisa indicou a faixa **7100-7199** como livre de colisão conhecida com Vite (5173), webpack (8080), Next (3000), Storybook (6006), e a maioria dos dev tools populares de 2026. PROJECT.md inicialmente sugeriu 7873 sem justificativa.

**Decision:**
Sidecar tenta a primeira porta livre na faixa **7100-7199** via `net.createServer().listen(0)` retry-loop. Se todas as 100 portas estiverem ocupadas (caso patológico), aborta com erro claro indicando o conflito.

**Consequences:**
- Multi-projeto simultâneo OK (cada projectRoot acha sua própria porta na faixa).
- README precisa documentar a faixa pra usuários abrirem firewall localmente se necessário.
- Pequena complexidade extra vs hardcode, mas evita classe inteira de bugs.

---

## ADR-02: Lockfile em `os.tmpdir()` keyed por sha1(projectRoot), via `O_EXCL`

**Status:** Accepted (2026-05-04)

**Context:**
Sidecar é single-instance per-projectRoot. Precisa de lockfile pra evitar 2 servers tentando bind na mesma porta. Opções avaliadas:
1. `<projectRoot>/.kit-mcp/sidecar.lock` — inspecionável, mas precisa update no `.gitignore`
2. `os.tmpdir()/kit-mcp-ui-<hash>.lock` — OS limpa sozinho, sem alteração no repo

**Decision:**
Lockfile mora em `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock`. Criação via `fs.openSync(path, 'wx')` (atomic exclusive-create — falha se arquivo já existe). Conteúdo JSON: `{pid, port, version, startedAt}`.

Stale detection em 2 camadas:
1. `process.kill(pid, 0)` (signal 0 — só checa, não envia) → ESRCH/EPERM = processo morto = unlink + retry
2. HTTP probe em `/healthz` na porta declarada → fail = unlink + retry

**Consequences:**
- Não polui o repo do user.
- OS faz cleanup eventual em reboots.
- Stale recovery resiliente a `kill -9` (que pula handlers).
- Hash do projectRoot evita colisão entre projetos diferentes na mesma máquina.

---

## ADR-03: Idle shutdown 30min default, flag `--idle-ms`

**Status:** Accepted (2026-05-04)

**Context:**
Sidecar pode ficar rodando indefinidamente se ninguém matar manualmente. Pesquisa avaliou 3 opções:
1. **5min agressivo** — recicla porta rápido, hostil pra workflow (user minimizou aba? sidecar morre)
2. **30min** — equilíbrio entre liberar porta e respeitar workflow real
3. **Sem timeout** — exige `kit ui stop` manual; lockfile órfão se user esquecer

**Decision:**
**30min default**. Sidecar mata sozinho após 30min sem eventos novos E sem clientes SSE conectados. Flag `--idle-ms <ms>` permite customização: `0` desabilita timeout completamente.

**Consequences:**
- User que minimiza aba e volta em 20min ainda tem sidecar.
- User que esquece e fecha terminal tem cleanup automático.
- Configurável pra cenários que querem comportamento diferente.

---

## ADR-04: `kit ui start` foreground default

**Status:** Accepted (2026-05-04)

**Context:**
Default de `kit ui start` foreground vs detached. Foreground = Unix-idiomático (Ctrl+C mata). Detached = não mata ao fechar terminal mas exige `kit ui stop` manual. Detached em Windows tem semântica complicada (`windowsHide`, `unref`, orphans).

**Decision:**
**Foreground default** em todas as plataformas. Flag `--detach` parqueada pra v1.3 quando houver casos concretos de uso.

**Consequences:**
- Comportamento consistente cross-platform.
- Usuário que quer detached usa `kit ui start &` (Unix) ou `start /B` (Windows) explicitamente.
- Sem complicação de orphans no MVP.

---

## ADR-05: `--auto-spawn` MCP em 3 tools (sync, reverse-sync, gates run)

**Status:** Accepted (2026-05-04)

**Context:**
Quais tools MCP recebem flag opcional `autoSpawn: boolean` que abre sidecar automaticamente quando invocada? Tools triviais (list-*, search, get) terminam em <500ms — spawn de browser é overhead injustificável.

**Decision:**
`autoSpawn` aplicado em:
- `sync` (install/watch) — emite progress, tipicamente >5s
- `reverse-sync apply` — emite progress
- `gates run` — pode encadear vários gates

`autoSpawn` **explicit-out** (NÃO disponível) em:
- `list-*`, `search`, `get` — tools de leitura triviais
- `forensics` — ainda sem progress wiring (parqueado pra v1.3)
- `install` — interativo, já usa `kit ui` se quiser feedback

**Consequences:**
- 3 tools ganham campo opcional novo no inputSchema (additive Stable API).
- Documentação MCP precisa explicar quando usar `autoSpawn=true`.
- Cliente que não passa o campo continua com comportamento idêntico ao v1.1.

---

## ADR-06: Sem autenticação no v1.2 — mitigação compensatória

**Status:** Accepted with conscious trade-off (2026-05-04)

**Context:**
Sidecar bind em localhost normalmente é considerado seguro, mas há vetores reais:
1. **DNS rebinding** — site malicioso resolve domínio público que rebinds pra 127.0.0.1
2. **Path leak** — payloads de progress podem vazar `/home/user/...` em screenshots
3. **stdout poisoning** — sidecar logando em stdout corrompe canal MCP JSON-RPC

Auth (token-based, lockfile-shared) seria ideal mas adiciona complexidade significativa: distribuir token pro browser, rotacionar, headers customizados.

**Decision:**
**v1.2 ship sem auth**, com mitigação compensatória:
- Bind 127.0.0.1 literal (nunca 'localhost', nunca '0.0.0.0')
- Validação `Host` header em todas rotas — accept apenas `127.0.0.1:port` ou `localhost:port`
- Validação `Origin` em endpoints non-GET
- CSP estrito no HTML: `default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- Path scrubbing central (`redactPath`) aplicado a TODO payload antes de publish
- Audit gate de CI proíbe `console.log`/`process.stdout.write` em `src/ui/`

**Consequences:**
- Trade-off documentado explicitamente em `docs/sidecar-security.md` (threat model).
- v1.3+ pode adicionar token-via-lockfile sem quebrar API (additive).
- Escopo do v1.2 fica fechável.
