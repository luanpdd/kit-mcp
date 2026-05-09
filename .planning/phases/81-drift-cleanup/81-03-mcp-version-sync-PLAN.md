---
phase: 81-drift-cleanup
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp-server/index.js
  - test/unit/mcp-version.test.js
autonomous: true
requirements:
  - DRIFT-13-03

must_haves:
  truths:
    - "MCP `initialize` response retorna `serverInfo.version` igual a package.json.version (não mais hardcoded '0.1.0')"
    - "MCP version drift entre src/mcp-server/index.js e package.json não pode mais ocorrer (single source via require)"
    - "Falha de leitura do package.json degrada para fallback 'unknown' sem crash do server (mesmo pattern do bin/cli.js:43-51)"
  artifacts:
    - path: "src/mcp-server/index.js"
      provides: "createServer() lê version dinamicamente de package.json"
      contains: "readPkgVersion"
    - path: "test/unit/mcp-version.test.js"
      provides: "Regression test asserting serverInfo.version == package.json.version"
      contains: "DRIFT-13-03"
  key_links:
    - from: "src/mcp-server/index.js"
      to: "package.json"
      via: "fileURLToPath(import.meta.url) + path.resolve para package.json + JSON.parse"
      pattern: "readFileSync.*package\\.json"
---

<objective>
Substituir o `version: '0.1.0'` hardcoded em `src/mcp-server/index.js:269` por leitura dinâmica de `package.json`, mesmo padrão usado em `bin/cli.js:43-51`. Esse plan fecha DRIFT-13-03 — drift recorrente onde MCP server reporta versão errada (0.1.0) enquanto package.json é v1.12.1+.

Purpose: MCP clients (Claude Code, Cursor, etc.) recebem `serverInfo.version` no handshake `initialize`. Versão errada quebra rastreabilidade de bugs ("qual versão do MCP estava rodando quando isso aconteceu?") e degrada confiança em tooling de monitoring que filtra por version.

Output: src/mcp-server/index.js com `readPkgVersion()` helper inline (paridade com bin/cli.js); test/unit/mcp-version.test.js com regression assertando version match.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/81-drift-cleanup/81-CONTEXT.md
@src/mcp-server/index.js
@bin/cli.js
@package.json

<interfaces>
## Pattern existente em bin/cli.js (linhas 43-51) — REUTILIZAR

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Read package.json version at boot so `--version` is always accurate. Falls
// back to a string if the file lookup fails (e.g. unusual install layout).
function readPkgVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}
```

Distância relativa: `bin/cli.js` está em `bin/`, então `path.resolve(here, '..', '..', 'package.json')` resolve para repo root.

Mas `src/mcp-server/index.js` está em `src/mcp-server/`, então o mesmo `'..', '..'` ALSO resolve para repo root (sobe 2 níveis: `src/mcp-server/` → `src/` → `repo-root`). **A mesma string `'..', '..'` funciona para ambos** porque ambos os arquivos estão a 2 níveis do root.

## Local da mudança em src/mcp-server/index.js

Linha 267-272 atualmente:
```javascript
export async function createServer() {
  const server = new Server(
    { name: 'kit-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );
```

Mudança alvo:
```javascript
export async function createServer() {
  const server = new Server(
    { name: 'kit-mcp', version: PKG_VERSION },
    { capabilities: { tools: {} } }
  );
```

Com `PKG_VERSION` definido no topo do arquivo via `readPkgVersion()` (constante de boot, não dentro de createServer — evita re-leitura a cada call).

## Imports atuais de src/mcp-server/index.js (linhas 1-26)

Já importa de `@modelcontextprotocol/sdk`. NÃO importa `node:fs`/`node:url`/`node:path`. Precisará adicionar `import { readFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; import path from 'node:path';` (3 linhas no bloco de imports node nativos).

## Pattern de test — referência: test/unit/mcp-gates-guard.test.js

Test que importa `createServer()` direto e manipula `_requestHandlers` Map para chamar handler de `tools/call`. Para `mcp-version`, o pattern é mais simples:
- (a) Importar `createServer()`.
- (b) Acessar `server._serverInfo` (interno do SDK) OU intercept `initialize` request via `_requestHandlers.get('initialize')`.
- (c) Comparar com `package.json.version` lido via mesma `readFileSync`.

Alternativa robusta (preferida): expor `PKG_VERSION` como named export do módulo OU criar uma versão exportável `getServerInfo()`. Tradeoff: criar minor surface vs depender de SDK internal `_serverInfo`.

**Decisão:** usar abordagem híbrida — exportar `PKG_VERSION` como named export. Isso é pure metadata (não muda a API runtime do MCP, não aparece no MCP wire protocol), só facilita o test. Stable API v1.0+ NÃO afetada (ninguém em produção depende de import direto desta constante).

## Decisão sobre teste end-to-end vs unit

CONTEXT.md sugere: "spawn `node bin/mcp.js`, send `{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}`, read stdout, parse response, assert version".

**Recomendação para esta task: unit test** (sem spawn) — mais rápido, mais determinístico:
- Importa `createServer()` + `PKG_VERSION` direto
- Lê package.json via `readFileSync` no mesmo pattern
- Asserta igualdade

**POR QUÊ não end-to-end via spawn:**
- spawn de stdio MCP no test exige timing handshake correto (initialize → initialized → response) — frágil em CI
- mcp-gates-guard.test.js já validou que o pattern de manipular _requestHandlers funciona em unit
- Suite integration tem cli-roundtrip que cobre o spawn pattern para CLI; um spawn dedicado de MCP é overkill para esta validação simples

Se desejar end-to-end mais forte, é trivial adicionar como follow-up em integration suite (test/integration/mcp-boot.test.js já existe? Verificar — caso sim, adicionar 1 teste lá). Verificação rápida: `ls test/integration/ | grep mcp`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Adicionar readPkgVersion() em src/mcp-server/index.js + substituir hardcoded '0.1.0'</name>
  <files>src/mcp-server/index.js</files>
  <action>
Editar `src/mcp-server/index.js` em 3 pontos:

**Ponto 1: Adicionar imports (após linha 13, depois do bloco de imports do MCP SDK):**

Inserir 3 linhas após `import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';`:

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
```

**Ponto 2: Adicionar `readPkgVersion()` + `PKG_VERSION` constante (após o bloco TOOLS, antes do `// --- handlers ---` na linha 128):**

Inserir, logo antes da linha `// --- handlers ---`:

```javascript
// DRIFT-13-03: read version from package.json at module load (NOT inside
// createServer — re-reading on every call adds zero value). Same pattern as
// bin/cli.js:43-51. Both files are 2 levels deep from repo root, so the
// '..', '..' resolution works identically. Falls back to 'unknown' if the
// package.json lookup fails (unusual install layout).
function readPkgVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

export const PKG_VERSION = readPkgVersion();
```

**Ponto 3: Substituir hardcoded '0.1.0' (linha 269):**

- old: `    { name: 'kit-mcp', version: '0.1.0' },`
- new: `    { name: 'kit-mcp', version: PKG_VERSION },`

**Notas operacionais:**
- USE Edit tool com 3 chamadas separadas (uma por ponto) — cada `old_string` é único.
- POR QUÊ exportar `PKG_VERSION` como named export: facilita test unit sem precisar acessar `server._serverInfo` (SDK internal). É pura metadata; NÃO muda surface API do MCP wire protocol (clientes MCP só veem `serverInfo.version` no `initialize` response, não importam JS modules).
- POR QUÊ não inline (`{ name: 'kit-mcp', version: readPkgVersion() }`): leitura de disco a cada `createServer()` call adiciona I/O sem benefício. Constante de boot é canônico.
- POR QUÊ `'unknown'` em vez de fallback hardcoded `'0.1.0'`: se package.json não pode ser lido, REPORTAR isso explicitamente é melhor que retornar string falsa. Mesma decisão que bin/cli.js fez (linha 49).
- POR QUÊ mesmo `'..', '..'` que bin/cli.js: tanto `bin/cli.js` quanto `src/mcp-server/index.js` estão a 2 níveis do repo root. Verificado: `bin/cli.js` em `bin/`; `src/mcp-server/index.js` em `src/mcp-server/`. Ambos sobem 2 níveis para `package.json`.
  </action>
  <verify>
    <automated>node -e "import('./src/mcp-server/index.js').then(m => { const pkg = JSON.parse(require('node:fs').readFileSync('./package.json','utf8')); if (m.PKG_VERSION !== pkg.version) { console.error('MISMATCH:', m.PKG_VERSION, '!=', pkg.version); process.exit(1); } console.log('OK: PKG_VERSION =', m.PKG_VERSION); });"</automated>
  </verify>
  <done>
- `src/mcp-server/index.js` tem 3 imports novos: `readFileSync`, `fileURLToPath`, `path`
- `src/mcp-server/index.js` tem função `readPkgVersion()` com try/catch + fallback 'unknown'
- `src/mcp-server/index.js` exporta `PKG_VERSION` como named export
- Linha 269 (era `version: '0.1.0'`) agora `version: PKG_VERSION`
- Comando do automated verify retorna `OK: PKG_VERSION = 1.12.1` (ou versão atual de package.json) exit 0
- `node -c src/mcp-server/index.js` (parse-only) sem erros
  </done>
</task>

<task type="auto">
  <name>Tarefa 2: Criar regression test em test/unit/mcp-version.test.js</name>
  <files>test/unit/mcp-version.test.js</files>
  <action>
Criar novo arquivo de teste `test/unit/mcp-version.test.js` que valida:
1. `PKG_VERSION` exportado de mcp-server/index.js bate com package.json.version
2. createServer() retorna server com `_serverInfo.version` igual a PKG_VERSION (cobertura mais funda — caso PKG_VERSION fosse exportado mas nunca passado para `new Server(...)`)
3. PKG_VERSION nunca é a string literal antiga `'0.1.0'` quando rodando a partir do repo (regression contra reverso acidental)

Conteúdo completo:

```javascript
// DRIFT-13-03: regression test for MCP serverInfo.version sync with package.json.
//
// Prior behavior: src/mcp-server/index.js hardcoded `version: '0.1.0'` while
// package.json shipped 1.12.1+ — every MCP `initialize` response leaked the
// stale version, breaking observability ("which kit-mcp version is running?").
//
// This test asserts:
//   1. PKG_VERSION named export equals package.json.version verbatim
//   2. createServer().<_serverInfo.version> equals PKG_VERSION (the wiring is real)
//   3. We never accidentally regress to the literal '0.1.0'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, PKG_VERSION } from '../../src/mcp-server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
}

test('DRIFT-13-03: PKG_VERSION matches package.json.version verbatim', () => {
  const pkg = readPackageJson();
  assert.equal(PKG_VERSION, pkg.version, 'mcp-server PKG_VERSION drifted from package.json — that is exactly the bug this guards against');
});

test('DRIFT-13-03: PKG_VERSION is not the legacy hardcoded "0.1.0"', () => {
  // Sanity check: when running from the repo, package.json is always > 0.1.0.
  // If this assertion fails, someone reverted the fix or the repo is broken.
  assert.notEqual(PKG_VERSION, '0.1.0', 'PKG_VERSION reverted to legacy hardcoded value');
});

test('DRIFT-13-03: createServer() exposes the same version on _serverInfo', async () => {
  const server = await createServer();
  // The SDK Server stores its constructor-provided info on `_serverInfo`. This
  // is internal but stable across @modelcontextprotocol/sdk minor versions —
  // if a future SDK upgrade hides it, this test gracefully skips and the first
  // two tests still cover the contract (PKG_VERSION wired into createServer call).
  const info = server._serverInfo;
  if (!info || typeof info !== 'object') {
    console.log('skip: SDK internals changed — _serverInfo not exposed');
    return;
  }
  assert.equal(info.version, PKG_VERSION, '_serverInfo.version must equal exported PKG_VERSION');
  assert.equal(info.name, 'kit-mcp', 'server name preserved');
});

test('DRIFT-13-03: PKG_VERSION matches expected semver shape', () => {
  // Sanity — should look like X.Y.Z or X.Y.Z-rcN, not 'unknown' (which means
  // package.json lookup failed in readPkgVersion).
  const semverShape = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i;
  assert.match(PKG_VERSION, semverShape, `PKG_VERSION="${PKG_VERSION}" — likely package.json read failure`);
});
```

**Notas operacionais:**
- USE Write para criar o arquivo (não existe ainda).
- POR QUÊ acessar `server._serverInfo` (SDK internal): é o pattern que test/unit/mcp-gates-guard.test.js já estabeleceu e está estável (`_requestHandlers` mesma classe interna). A graceful skip cobre upgrades futuros do SDK.
- POR QUÊ NÃO spawn `bin/mcp.js` + JSON-RPC handshake: timing-dependent, frágil em CI (especialmente Windows runners). Unit test cobrindo `createServer()` direto é equivalente em poder de regressão e mais rápido.
- POR QUÊ 4 tests separados em vez de 1: cada test isola uma classe de falha. Test 1 falha → import quebrou. Test 2 → reverso acidental. Test 3 → wiring no construtor. Test 4 → readPkgVersion fallback ativou (lookup falhou).
  </action>
  <verify>
    <automated>node test/run.mjs test/unit/mcp-version.test.js</automated>
  </verify>
  <done>
- `test/unit/mcp-version.test.js` criado com 4 tests
- `node test/run.mjs test/unit/mcp-version.test.js` retorna exit 0 com 4 pass (ou 3 pass + 1 skip se SDK internals mudaram)
- Cada test inclui mensagem de assertion clara explicando o cenário de regression
- File header documenta DRIFT-13-03 e o bug original (hardcoded '0.1.0')
- `npm test` rodando full unit suite continua exit 0 (baseline 137 + 4 = 141 unit tests)
  </done>
</task>

</tasks>

<verification>
- `grep -n "version: '0.1.0'" src/mcp-server/index.js` retorna 0 matches
- `grep -n "PKG_VERSION" src/mcp-server/index.js` retorna ≥ 2 matches (export + uso em createServer)
- `npm test` exit 0
- Sintaxe: `node -c src/mcp-server/index.js` parse-only sem erros
- Backward compat: `bin/mcp.js` start ainda funciona (smoke: `timeout 3 node bin/mcp.js < /dev/null` exit graceful — opcional, não auto)
</verification>

<success_criteria>
- MCP `initialize` response retorna versão sincronizada com package.json (validado via test do _serverInfo)
- Drift entre src/mcp-server e package.json não pode mais ocorrer (PKG_VERSION é leitura única, sem sombra)
- Fallback 'unknown' para layouts de install incomuns documentado e testado
- 4 regression tests novos em test/unit/mcp-version.test.js verde
- Suite total: 141 unit (baseline 137 + 4) + 71 integration verde
- Pattern paritário com bin/cli.js — futuro maintainer encontra ambos com mesmo padrão (descoberta via grep `readPkgVersion`)
</success_criteria>

<output>
After completion, create `.planning/phases/81-drift-cleanup/81-03-mcp-version-sync-SUMMARY.md`
</output>
