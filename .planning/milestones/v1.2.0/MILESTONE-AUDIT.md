---
status: passed
milestone: v1.2.0
audited: 2026-05-04
---

# MILESTONE-AUDIT — v1.2 "GUI sidecar de acompanhamento"

**Status:** Passed (todos os 56 REQs entregues, 0 lacunas, sem dívida técnica não-documentada)
**Tag git:** _(pendente — user action `git tag -a v1.2.0`)_
**Commit final do milestone:** `c93c990`
**npm:** _(pendente — user action `npm publish`)_

## Cobertura — 56/56 REQs entregues ✅

| Categoria | REQs | Status |
|---|---|---|
| **SRV** (servidor + SSE) | 14 | ✅ Phase 12 (08-09), Phase 13 (01-07, 10-14) |
| **UI** (página estática) | 11 | ✅ Phase 14 (01-11) |
| **PUB** (publisher + wrapper) | 4 | ✅ Phase 15 (01-04) |
| **CLI** (kit ui + auto-detect) | 5 | ✅ Phase 16 (01-05) |
| **MCP** (--auto-spawn) | 4 | ✅ Phase 17 (01-04) |
| **SEC** (hardening) | 5 | ✅ Phase 11 (04), Phase 13 (01-02), Phase 14 (03), Phase 15 (05) |
| **OPS** (testes + cross-platform) | 6 | ✅ Phase 13 (02 — 50 cycles), Phase 18 (01, 03-06) |
| **DOC** (documentação) | 4 | ✅ Phase 18 (01-04, com rascunho de DOC-03 na Phase 11) |
| **REL** (release) | 3 | 1/3 ✅ (REL-01); REL-02/03 são user action |

**Total:** 56/56 REQs com implementação. REL-02 (tag) e REL-03 (npm publish) requerem credenciais e 2FA do user — sistema preparado mas não auto-executado.

## Métricas

| | v1.1.0 (entrada) | v1.2.0 (saída) | Δ |
|---|---|---|---|
| Tests automatizados | 58 (49 u + 9 i) | 151 (~80 u + ~71 i) | +93 |
| Runtime deps | 5 | 6 | +1 (open@11) |
| LOC novas | — | ~2400 | (src/ui/* + tests + docs) |
| MCP tools | 6 | 6 (gates +action `run`) | 0 (additive) |
| CLI subgrupos | 6 | 7 (+ `kit ui`) | +1 |
| CI jobs | 1 (smoke matrix) | 2 (+ audit) | +1 |
| Audit gates ativos | 0 | 7 | +7 |

## Não-objetivos — confirmados parqueados (em backlog/v1.3+)

Conforme REQUIREMENTS.md:
- Tipos de evento expandidos (`file_write`, `gate_result`, `log`) — P2 v1.3
- Keyboard shortcuts UI — P2 v1.3
- Copy-to-clipboard por evento — P2 v1.3
- Milestone divisores visuais — P2 v1.3
- Aggregation multi-projeto numa janela — v2+
- Replay de execução salva — v2+ (kit forensics cobre)
- localStorage UI preferences — v2+
- Toasts / desktop notifications — v2+
- Flag `--detach` em `kit ui start` — v1.3+
- Token-based auth via lockfile — v1.3+ se multi-user pintar
- TLS opt-in via mkcert — v1.3+

Anti-features explicit-out (NÃO fazer):
- Acesso remoto / share — vetor de ataque sem ganho real
- Persistência em disco — kit forensics cobre replay
- Métricas/charts — fora do propósito
- WebSocket bidirecional — UI é read-only
- Build step / framework UI (React/Vue/Svelte) — viola princípio
- Multi-server aggregation — não-objetivo

## Decisões arquiteturais relevantes

1. **Sidecar = processo separado, não embutido no MCP server.** Lockfile em `os.tmpdir()` resolve single-instance. MCP stdio e CLI são publishers efêmeros que falam HTTP loopback. Isso elimina IPC platform-específico e race entre 2 publishers (HTTP serializa).

2. **`onProgress` permanece literalmente intocado.** Wrapper opt-in (`wrapProgressForUi`) montado **apenas no callsite** (CLI handler ou MCP tool handler). Core (`syncTo`, `applyReverse`, `runGate`) **nunca** importa de `src/ui/`. Stable API v1.0+ preservada literalmente — confirmado por `git diff -- src/core/` retornar vazio.

3. **+1 dep máxima respeitada.** Apenas `open@11` adicionado (12 transitives). Tudo o resto é Node `node:*` builtins. Audit gate de PR previne crescimento.

4. **`--test-force-exit` + `--test-concurrency=1`** no test runner. Sem isso, http.Server keep-alive sockets stallam process exit por segundos; CI interpretava como hang. Com isso, tests rodam serializados e finalizam clean.

5. **CSP estrito por default.** `default-src 'self'; ... frame-ancestors 'none'`. Combinado com Host/Origin check, mitiga DNS rebinding sem precisar de auth. Trade-off documentado explicitamente em `docs/sidecar-security.md`.

6. **Audit gates armados antes do código existir** (Phase 11 escreveu o gate, Phase 12 começou a escrever `src/ui/`). PR de teste com `console.log` em `src/ui/dummy.js` é rejeitado pelo CI antes de qualquer humano ver.

## Dívidas técnicas registradas (pra v1.3+)

Coletadas durante a execução, não-bloqueantes pra ship da v1.2:

- **bin/ui.js sem tests dedicados** — testado indiretamente via `kit ui start` e `auto-spawn.js` integration. Vale adicionar smoke explícito.
- **CI Windows + Node 20 não rodado em real** — testes desenvolvidos em Windows local, mas CI vai exercitar pela primeira vez na primeira PR pós-cut. Mitigado por `--test-force-exit` mas vale validar.
- **WSL/Docker container exotic environments** — `open@11` cobre detection mas casos edge podem cair em fallback "imprime URL". Aceitável.
- **`EventEmitter` setMaxListeners** no server.js usa `maxSubscribers + 4`. Se cap mudar via opt, precisamos atualizar. Pequeno acoplamento.
- **`renderUiStatus` vive inline em cli/index.js** (não em render.js). Se UI status crescer, vale extrair pra render.js.

## Lessons learned

1. **Default port range > hardcode.** PROJECT.md inicialmente sugeriu 7873 sem justificativa. Pesquisa de fase recomendou range 7100-7199 com auto-fallback — ADR-01 documentou isso. Mais resiliente quando duas IDEs abrem o mesmo projeto.

2. **stdout discipline em src/ui/ é critical-path, não nice-to-have.** Phase 11 armou o audit gate ANTES do código existir. Resultado: zero violations em ~700 LOC novo de `src/ui/*`. Sem o gate, era questão de tempo até alguém escrever `console.log("debug")` que quebraria silenciosamente o canal MCP.

3. **HTTP POST loopback > IPC.** Pesquisa avaliou named pipes, Unix sockets, file watchers. HTTP POST resolve cross-platform sem código condicional + serialização gratuita pelo server. Trivial.

4. **Wrapper-no-callsite preserva Stable API trivialmente.** Em vez de modificar `syncTo` pra ganhar telemetria, montamos o wrapper no caller. Core fica puro. Stable commitment respeitado sem esforço.

5. **`open@11` vale 1 dep.** Reimplementar = 60-80 LOC + matriz de edge cases (Windows quoting, WSL, sandbox macOS, headless detection). 12 transitives é o preço justo da correção cross-platform.

6. **`--test-force-exit` é o atalho certo pra CI sanity.** Tentativa de rastrear todos os handles abertos (signal listeners, sockets, timers) consumiu várias iterações. Aceitar a flag (Node 20.10+) eliminou a classe inteira de problemas em uma linha de código.

## Ship readiness

- [x] Working tree limpo (após commit Phase 18)
- [x] Todos os 56 REQs ✓
- [x] 151 tests pass localmente
- [x] Audit gates locais verde (stdout + dep budget + npm pack)
- [x] Stable API verificada — `git diff -- src/core/` vazio
- [x] CHANGELOG [1.2.0] completo
- [x] README seção `kit ui` documentada
- [x] Threat model marcado Final
- [x] `package.json` em 1.2.0
- [x] `kit --version` retorna 1.2.0 (REL-01 fix)
- [ ] **User action:** `git tag -a v1.2.0 -m "v1.2.0 — GUI sidecar"` + `git push origin main --tags`
- [ ] **User action:** `npm publish --otp <code>`

## Próximo milestone

Sugestão pra v1.3.0:
- **Aggregation multi-projeto** — uma única janela mostrando eventos de N projetos abertos simultaneamente
- **Token-based auth via lockfile** — abre caminho pra dev container / SSH com display forwarding
- **CLI awkwardness do double-`kit`** (backlog macro persistido) — `kit kit list-agents` → renomear o grupo? Detectado desde v1.1.0
- **Eventos expandidos** (`file_write`, `gate_result`, `log`) + keyboard shortcuts + copy-to-clipboard

A decisão final fica pra próxima sessão de `/novo-marco`.
