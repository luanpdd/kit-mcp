# Sidecar Threat Model — kit-mcp v1.2

> **Status:** Final (Phase 18, 2026-05-04). Todas as mitigações implementadas e testadas — referências aos REQs/tests abaixo.

Este documento descreve o modelo de ameaça do sidecar de acompanhamento (web localhost + SSE) introduzido em v1.2. Aqui estão os ataques que mitigamos, os que conscientemente aceitamos, e o que vem a seguir.

## Trust Boundary

- **Audiência:** desenvolvedor único, na própria máquina, num projeto que ele mesmo controla.
- **Rede:** bind exclusivo em `127.0.0.1` (loopback IPv4). Nunca `0.0.0.0`. Nunca `'localhost'` literal (resolve para `::1` em Windows e quebra a expectativa).
- **Vida útil:** efêmero — sobe quando user invoca `kit ui start` ou flag `--auto-spawn`, morre em SIGINT/SIGTERM ou após 30min idle.
- **Persistência:** zero. Ring buffer in-memory de 200 eventos; nenhum disk write além do lockfile temporário.

## Ataques Mitigados

### 1. DNS rebinding

**Vetor:** site malicioso (em outro browser tab) resolve um domínio público que faz rebind pra `127.0.0.1:7100`. Sem proteção, JS daquele site faria fetch ao sidecar e leria eventos contendo paths/projetos do dev.

**Mitigação:**
- Toda rota valida `Host` header. Aceita apenas `127.0.0.1:<port>` ou `localhost:<port>`. Qualquer outro → 403.
- Endpoints non-GET (`/publish`, `/shutdown`) também validam `Origin`.

### 2. Path leak em payloads

**Vetor:** evento de `onProgress` carrega path absoluto (`/home/user/projetos/cliente-x/...`). User screenshota a janela pra demo/blog → vaza estrutura interna, identidade do empregador, nome de cliente.

**Mitigação:**
- Helper central `redactPath(path, projectRoot)` aplicado uniformemente em `src/ui/wrapper.js`. Substitui `$HOME → ~` e `projectRoot → <project>` antes de publish.
- Smoke test snapshot valida ausência de `/home/`, `/Users/`, `C:\Users\` em payloads pré-send.

### 3. stdout poisoning (BREAK MCP protocol)

**Vetor:** `console.log` ou `process.stdout.write` dentro de `src/ui/` corrompe o canal stdio do MCP server. Cliente IDE (Claude Code, Cursor) fica esperando frames JSON-RPC, recebe lixo, desconecta sem dizer onde foi.

**Mitigação:**
- Audit gate de CI: `grep -rn 'console.log\|process.stdout.write' src/ui/` falha o PR antes de qualquer review humano.
- Logs do sidecar vão pra `stderr` ou pra arquivo `~/.kit-mcp/ui.log`.

### 4. SSE connection leak

**Vetor:** array de subscribers cresce ilimitado a cada reload do browser. Memória sobe; após N reloads, CPU spike.

**Mitigação:**
- Cleanup obrigatório em `req.on('close')`, `req.on('error')`, `res.on('close')` (todos os 3 pra confiabilidade cross-runtime).
- Cap de 32 conexões SSE simultâneas; conexão 33+ recebe 503.
- Test de regressão: 100 connect/disconnect → `subscribers.size === 0`.

### 5. Cross-Site Scripting (XSS) na UI

**Vetor:** payload de evento contém HTML/JS injetado por algum input do user; UI renderiza diretamente.

**Mitigação:**
- CSP estrito no HTML: `default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- Renderização via `textContent` / `createTextNode`, nunca `innerHTML` em conteúdo de evento.
- Schema validator em `/publish` rejeita payloads >64KB (cap de superfície).

## Ataques fora-de-escopo

### Man-in-the-middle / TLS

Não aplicável — comunicação é loopback. Adicionar TLS via mkcert seria possível em v1.3 mas não é prioridade.

### DoS local

User já confia no kit-mcp (instalou de propósito). Tools podem consumir CPU/disk; isso é design, não vulnerabilidade.

### Supply-chain attack

Dependências runtime são auditáveis: `@modelcontextprotocol/sdk`, `commander`, `chokidar`, `picocolors`, `@inquirer/prompts`, +1 nova (`open@11`). Audit gate de CI proíbe crescimento >+1 vs baseline.

## Trade-offs Aceitos Conscientemente

### Sem autenticação

Sidecar não requer token, password ou cookie. Razões:

- **Mitigação compensatória robusta:** bind 127.0.0.1 + Host/Origin check + CSP + path scrub cobrem os vetores realistas.
- **Ergonomia:** auth via token compartilhado pelo lockfile adiciona complexidade real (rotação, expiração, transporte do token pro browser via redirect ou query param).
- **Audiência limitada:** dev workstation single-user. Multi-user seria diferente.

Documentado pra que seja revisitável em v1.3+ se pintarem casos de uso multi-user (CI shared, dev container compartilhado).

### Sem TLS

Loopback não exige TLS. Browsers modernos avisam mas funcionam. Exigir TLS criaria fricção (mkcert install, root CA trust) sem ganho de segurança real em loopback.

### Persistência efêmera

Eventos somem ao restart. `kit forensics collect` continua sendo o caminho pra replay/análise pós-evento. Sidecar é **estritamente live**.

## Melhorias Futuras (v1.3+)

Lista prospectiva, sem timeline:

1. **Token-based auth via lockfile** — token gerado no start, escrito no lockfile, browser pega via redirect 302 inicial. Permite sidecar bind em `0.0.0.0` opcionalmente pra dev container.
2. **Opt-in TLS via mkcert** — flag `--tls` que gera cert local automaticamente.
3. **Rate limiting em /publish** — proteção contra publisher buggy que floods o bus.
4. **Sandbox da UI estática** — servir num iframe + worker pra reduzir blast radius de XSS hipotético.
5. **Audit log persistente** — opt-in pra debugar incidentes (~/.kit-mcp/ui-audit.log com rotation).

## Audit gates ativos

Esses gates rodam no CI em todo PR e são parte da política de segurança do projeto:

| Gate | Onde | O que checa | REQ | Test |
|---|---|---|---|---|
| stdout discipline | `.github/workflows/ci.yml` job `audit` | nenhum `console.log`/`process.stdout.write` em `src/ui/` | SEC-04 | gate falha PR antes do code review |
| stdout in production | `test/integration/ui-hardening.test.js` | sidecar real spawnado não escreve nada em stdout | SEC-04 (runtime) | OPS-05 |
| dep size | `.github/workflows/ci.yml` job `audit` | runtime deps ≤ baseline+1 (= 6) | (princípio do PROJECT.md) | gate falha PR |
| Host check | `test/integration/ui-server.test.js` | rotas rejeitam Host malicioso → 403 | SEC-01 | "Host header validation: rejects malicious Host" |
| Origin check | `test/integration/ui-server.test.js` | endpoints non-GET rejeitam Origin estrangeiro → 403 | SEC-02 | "Origin validation: rejects cross-origin POST" |
| CSP presente | `test/integration/ui-static.test.js` | HTML serve CSP estrito | SEC-03 | "served with strict CSP header" |
| Path redaction | `test/unit/ui-wrapper.test.js` | redactPath substitui $HOME e projectRoot uniformemente | SEC-05 | 5 tests cobrindo strings, objetos, arrays, regex specials |

Todos os 7 gates verde no momento do cut da v1.2.0 (commit `<cut hash>`).

## Hardening cobertos por test (Phase 18)

| Pitfall | Test |
|---|---|
| stale lockfile reclaim (Pitfall 4) | `test/integration/ui-hardening.test.js` "OPS-03: stale lockfile" |
| multi-publisher race (Pitfall 12) | `test/integration/ui-hardening.test.js` "OPS-04: 2 concurrent publishers" |
| stdout poisoning MCP (Pitfall 1) | `test/integration/ui-hardening.test.js` "OPS-05: bin/ui.js does not write to stdout" |
| connection leak (Pitfall 3) | `test/integration/ui-server.test.js` "Connection cleanup: 50 connect/disconnect cycles" |

---

**Última atualização:** 2026-05-04 (Phase 18 — versão final pre-cut).
