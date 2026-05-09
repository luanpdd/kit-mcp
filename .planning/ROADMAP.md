# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.14 — Web/Core Security Hardening (Fases 82-84)

**Milestone:** v1.14 — Web/Core Security Hardening (continuação direta da v1.13 — fecha as 6 issues HIGH adiadas)
**Numeração de fases:** continua de v1.13 (último concluído: Fase 81) → v1.14 começa em **Fase 82**
**Total de fases:** 3 (Fases 82-84)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** mesmas auditorias da v1.13 — `.planning/codebase/concerns.md`, `.planning/PRR-REPORT.md`. Itens HIGH explicitamente deferidos de v1.13 conforme `.planning/milestones/v1.13-MILESTONE-AUDIT.md` "Tech Debt".
[Detalhes](./milestones/v1.14-ROADMAP.md)

### Phase 82: Web Surface Hardening

**Goal:** Fechar 2 vulnerabilidades HIGH na surface web do UI sidecar — CSP `'unsafe-inline'` + payloads SSE sem escape (XSS reflexivo) e `/shutdown` + `/publish` sem autenticação (CSRF same-origin via coworker em máquina compartilhada).
**Plans:** 2 plans (wave 1 + wave 2)

Plans:
- [x] 82-01-ui-server-hardening-PLAN.md — CSP estrito (sha256 hash), requireAuth middleware, token no lockfile, regression tests
- [x] 82-02-token-propagation-PLAN.md — auto-spawn → browser via ?t=, client.js + sidecar-tool-publisher.js anexam Bearer token


**Escopo:**
- `src/ui/server.js` — remover `'unsafe-inline'` do `script-src`, mover JS embutido no index.html para arquivo self-hosted, escape HTML obrigatório em todo conteúdo SSE renderizado (`textContent` em vez de `innerHTML`).
- `src/ui/server.js` + `src/ui/lockfile.js` — adicionar token random (`crypto.randomBytes(32).hex`) ao lockfile; exigir `Authorization: Bearer <token>` em `POST /publish` e `POST /shutdown`. Browser recebe via query param `?t=<token>`.

**Critérios de sucesso:**
- `grep "'unsafe-inline'" src/ui/server.js` retorna 0 matches.
- Payload SSE com `<img src=x onerror=...>` é renderizado como texto literal no UI, não como HTML executável.
- `curl -X POST http://127.0.0.1:7100/shutdown` (sem token) retorna 401.
- Lockfile tem campo `token` populado por random crypto.
- Suite de testes existente continua passando.

### Phase 83: Core Filesystem Hardening

**Goal:** Fechar 3 vulnerabilidades HIGH na surface core de filesystem — reverse-sync.apply confia em `projectRoot` arbitrário do MCP (atacante escreve em paths do AppData), gate-runner usa `os.tmpdir()` com filename predictable (symlink TOCTOU em multi-user box), file-manifest.json shipped mas nunca verificado em sync (reverse-sync pode reescrever agents silenciosamente).

**Depends on:** Phase 82

**Escopo:**
- `src/core/sync.js` + `src/core/reverse-sync.js` — em `handleSync` e `handleReverseSync` (callers MCP), validar que `projectRoot` é um diretório existente contendo `.git/` (allowlist heurístico) ou recusar `projectRoot` via MCP e usar `process.cwd()`.
- `src/core/gate-runner.js:137-138` — substituir `path.join(os.tmpdir(), \`kit-gate-${Date.now()}-${Math.random()}.sh\`)` por `fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'))` (cria dir único per-run com permissão 0700) + write script dentro dele + cleanup com rmdir recursive.
- `src/core/sync.js` (sync install path) + opcionalmente `src/cli/index.js` (kit list/list-agents) — verificar `kit/file-manifest.json` SHA256 contra arquivos reais; falhar com erro descritivo se mismatch (opt-in via env var `KIT_MCP_SKIP_MANIFEST_CHECK=1` para dev workflow).

**Critérios de sucesso:**
- `handleSync` com `projectRoot=\\evil-host\share` retorna erro descritivo sem write.
- `gate-runner` cria diretório tmp com permissão 0700, executa script dentro, faz cleanup.
- `kit sync install` em workspace com manifest reescrito retorna erro `manifest mismatch: <file>` antes de copiar.
- Suite de testes existente continua passando + 3+ regression tests novos.

### Phase 84: MCP Error Sanitization

**Goal:** Fechar 1 vulnerabilidade HIGH onde error envelopes do MCP server vazam stack traces, paths absolutos, e potencialmente fragmentos do `ANTHROPIC_API_KEY` quando reflect.js falha em chamadas Anthropic.

**Depends on:** Phase 82

**Escopo:**
- `src/mcp-server/index.js:281-285` (handler de exception) — substituir serialização de `e.stack` por código de erro estável + `e.message` sanitizado; logar stack completo em stderr (server-side log).
- `src/core/reflect.js:63-69, 156-179` — em error path da chamada Anthropic, redact tokens conhecidos (`/sk-ant-[A-Za-z0-9_-]+/`, `/x-api-key:.*/`) do `errBody` antes de re-throw. Recordar `payload` em replays apenas após scrub.
- Adicionar helper `sanitizeMcpError(e)` em `src/mcp-server/index.js` (ou novo `src/core/error-redaction.js`) reusável por todos os handlers.

**Critérios de sucesso:**
- MCP error envelope nunca contém path absoluto do filesystem do user (regex `/[A-Z]:[\\\\\\/]/i` no payload final retorna 0 matches em test).
- MCP error envelope nunca contém `e.stack` serializado.
- `reflect()` com Anthropic 401 (chave inválida) retorna error envelope SEM `sk-ant-...` no message.
- Stack completo continua em stderr (verificado via spawn + capture).
- Suite de testes existente continua passando + 4+ regression tests novos.



<details>
<summary>✅ Concluídos</summary>

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- v1.8.0 — Suíte Supabase (Phases 25-28)
- v1.9.0 — Observabilidade (Phases 29-35)
- v1.10.0 — SRE Engagement (Phases 36-41)
- v1.11.0 — SRE Resilience & Release Engineering (Phases 42-47)
- v1.12 — Legacy Code Mastery & AI-Era Refactoring (Phases 48-78) — entregue out-of-band
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — entregue 2026-05-09. 11 REQs (SEC-13-01..05, PERF-13-01..03, DRIFT-13-01..03), 33 testes novos, 210 baseline final. Origem: meta-auditoria com 12 agentes paralelos sobre v1.12.1. [Detalhes](./milestones/v1.13-ROADMAP.md) · [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)

</details>
