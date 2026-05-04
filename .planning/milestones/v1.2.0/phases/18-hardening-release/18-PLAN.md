# Phase 18: Hardening + cross-platform smoke + release 1.2.0 — PLAN

**Tipo:** Final phase — tests + docs + version bump + tag prep
**REQs cobertos:** OPS-01..06, DOC-01..04, REL-01..03 (12 REQs)
**Dependências:** Phases 11-17 (todo o milestone)

## Componentes

### Hardening tests — `test/integration/ui-hardening.test.js` (3 tests)

- **OPS-03** stale lockfile (dead pid) é reclamável via `acquireLockOrReclaim`
- **OPS-04** 2 publishers concorrentes (Promise.all) ambos succeed; eventos chegam
- **OPS-05** bin/ui.js spawnado real → stdout vazio (validação rigorosa do REQ SEC-04 em runtime, não só pelo grep do CI)

### CI gate adicional — `npm pack` validation (OPS-06)

Step novo no job `audit`: roda `npm pack --dry-run --json`, verifica que 10 arquivos críticos do v1.2 estão no tarball:
- src/ui/static/index.html
- src/ui/{server, client, wrapper, browser, auto-spawn, lockfile, port, events}.js
- bin/ui.js

Falha com mensagem clara se algum estiver missing.

### REL-01 — fix `kit --version` bug

Pre-existing bug: `--version` retorna string hardcoded "1.0.0" mesmo nas versões 1.1.0 e 1.2.0. Corrigir lendo de package.json em runtime via `readFileSync` + `JSON.parse`. Fallback "unknown" se algo der errado (instalação anormal).

Test atualizado em cli-ui.test.js: pin = `pkg.version` (lido em test-time).

### REL-01 — version bump

`package.json`: 1.1.0 → 1.2.0
`package-lock.json`: regenerado automaticamente (já feito quando adicionei open@11)

### Docs

**DOC-01** — README seção "kit ui" no CLI reference, com:
- 3 exemplos curtos (start/stop/status)
- Auto-spawn explicado
- Opt-out (`--no-ui` / `KIT_MCP_NO_UI`)
- Security model resumido com link pro threat model
- First-run quirks (firewall popup, WSL, headless)

**DOC-02** — CHANGELOG entry [1.2.0] estruturado por Phase 11-18, Stable API additions, Migration, Threat model resumido.

**DOC-03** — `docs/sidecar-security.md` final:
- Status: Final (era Rascunho)
- Audit gates table com link pra cada test
- Hardening covered by tests table (OPS-03, OPS-04, OPS-05, +SSE leak)

**DOC-04** — Migration note in CHANGELOG: "v1.1 → v1.2: usuários não precisam fazer nada. Sidecar é opt-in."

### REL-02 / REL-03

Não executados nesta fase. **User action required:**
1. Verificar que tudo está committed e working tree limpo
2. `git tag v1.2.0` e push pra origin
3. publish.yml workflow detecta o tag e auto-cria GitHub Release
4. `npm publish` (com 2FA OTP) pra postar `@luanpdd/kit-mcp@1.2.0` Latest

Phase 18 prepara tudo até o cut.

## Critérios de sucesso (observáveis)

1. `npm run test:all` → 151+ tests pass (148 antes + 3 hardening)
2. `node bin/cli.js --version` exibe `1.2.0` (não mais hardcoded)
3. `npm pack --dry-run --json` mostra 10 arquivos críticos UI presentes
4. README seção `kit ui ...` presente
5. CHANGELOG [1.2.0] entry presente
6. Threat model marcado "Final"
7. Stable API verificada: src/core/ intocado em Phases 11-18
8. Audit gates ainda passando: stdout discipline + dep budget
9. Working tree clean após commit final, pronto pra tag
