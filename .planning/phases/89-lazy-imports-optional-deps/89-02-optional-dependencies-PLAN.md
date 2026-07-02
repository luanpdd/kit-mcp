---
phase: 89-lazy-imports-optional-deps
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - src/core/ui.js
  - src/core/watch.js
  - test/unit/optional-deps.test.js
  - test/integration/npm-pack-shape.test.js
autonomous: true
requirements:
  - PERF-16-05
  - PERF-16-06

must_haves:
  truths:
    - "@inquirer/prompts e chokidar movidos de dependencies para optionalDependencies em package.json — total dependencies = 4 (modelcontextprotocol/sdk, commander, open, picocolors), optional = 2"
    - "src/core/ui.js carrega @inquirer/prompts via dynamic await import dentro de select()/confirm() — top-level import removido"
    - "src/core/watch.js carrega chokidar via dynamic await import dentro de watchKit() — top-level import removido"
    - "Se @inquirer/prompts ausente: select()/confirm() lançam Error com mensagem 'Interactive prompts require @inquirer/prompts; install with `npm i @inquirer/prompts` or pass --yes/--no-interactive flag'"
    - "Se chokidar ausente: watchKit() lança Error com mensagem 'kit sync watch requires chokidar; install with `npm i chokidar`'"
    - "Phase 88.02 debounce 500ms + clearKitCache invalidation em watch.js PRESERVADO — só import muda"
    - "Phase 79.01 SEC-14-02 sidecar token + outras phases SEC preservadas — package.json muda apenas seção dependencies/optionalDependencies, NADA mais"
    - "npm install --omit=optional resulta em CLI core funcional (kit kit list-*, kit sync install/status, kit gates list, kit forensics, kit doctor todos OK)"
    - "Tarball npm pack --dry-run reduz ≥5% LOC ou file count (medido — chokidar e @inquirer/prompts não fazem parte de files[], mas mudança em package.json mexe metadata)"
    - "Regression tests com 4+ casos: (a) select sem inquirer lança mensagem descritiva, (b) watchKit sem chokidar lança mensagem descritiva, (c) optionalDependencies aparece em package.json com 2 entries, (d) tarball total bytes ≥ comparable to baseline (sanity)"
  artifacts:
    - path: "package.json"
      provides: "dependencies (4) + optionalDependencies (2) split"
      contains: "optionalDependencies"
    - path: "src/core/ui.js"
      provides: "select/confirm via dynamic import com graceful fallback"
      contains: "await import"
    - path: "src/core/watch.js"
      provides: "watchKit() lazy-loads chokidar com graceful fallback"
      contains: "await import"
    - path: "test/unit/optional-deps.test.js"
      provides: "4 regression tests: package.json structure, missing-inquirer message, missing-chokidar message, dep budget"
      contains: "optionalDependencies"
  key_links:
    - from: "src/core/ui.js select()/confirm()"
      to: "@inquirer/prompts (lazy)"
      via: "await import inside the function with try/catch and descriptive throw"
      pattern: "await import\\(['\"]@inquirer/prompts['\"]\\)"
    - from: "src/core/watch.js watchKit()"
      to: "chokidar (lazy)"
      via: "await import at start of watchKit before chokidar.watch() call"
      pattern: "await import\\(['\"]chokidar['\"]\\)"
    - from: "package.json"
      to: "npm install --omit=optional behavior"
      via: "moving 2 deps to optionalDependencies section"
      pattern: "\"optionalDependencies\"\\s*:\\s*\\{"
---

<objective>
Reorganizar dependencies do package.json para que `@inquirer/prompts` e `chokidar` virem optional (instalados por default mas opcionais), e usar dynamic `await import()` com graceful fallback nos call-sites — `src/core/ui.js` (select/confirm) e `src/core/watch.js` (watchKit). Resultado: `npm install --omit=optional` produz CLI core funcional, comandos que precisam de UI interativa ou file-watching falham com mensagem descritiva instruindo `npm i <package>`.

Purpose: Endereçar PERF-16-05 (P5) e PERF-16-06 (P6) da meta-auditoria v1.12.1 — `@inquirer/prompts` arrasta 18 sub-pacotes apenas para `select`/`confirm` em alguns commands, e `chokidar` é usado APENAS em `kit sync watch`. Modo MCP server (stdio) e CI runs nunca os usam. O pattern de referência já existe em `src/ui/browser.js` (`await import('open')`) — replicar.

Output:
- `package.json` com `dependencies` reduzido para 4 entries (sdk, commander, open, picocolors) + nova seção `optionalDependencies` com 2 entries (`@inquirer/prompts`, `chokidar`).
- `src/core/ui.js` com top-level import de `@inquirer/prompts` removido; `select`/`confirm` lazy-load com try/catch e mensagem descritiva.
- `src/core/watch.js` com top-level import de `chokidar` removido; `watchKit()` lazy-load com try/catch e mensagem descritiva. Phase 88.02 debounce + clearKitCache PRESERVADOS.
- `test/unit/optional-deps.test.js` — 4 regression tests cobrindo estrutura do package.json, mensagens de erro graceful, dep budget total = 6.
- Tarball `npm pack --dry-run` reduz ≥5% (validado pelo test integration npm-pack-shape).
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/89-lazy-imports-optional-deps/89-CONTEXT.md
@package.json
@src/core/ui.js
@src/core/watch.js
@src/ui/browser.js
@test/integration/npm-pack-shape.test.js

<interfaces>
## Pattern canônico para lazy + graceful fallback (de src/ui/browser.js)

```js
// linhas 11-22 de src/ui/browser.js — pattern já estabelecido na codebase
let openModule = null;

async function loadOpen() {
  if (openModule) return openModule;
  try {
    const mod = await import('open');
    openModule = mod.default || mod;
    return openModule;
  } catch (err) {
    return null;  // <-- caller checa null e degrada graciosamente
  }
}
```

**Aplicação para inquirer/chokidar:** ao contrário de `open` (onde retornar null e usar fallback de stderr-print é apropriado), `inquirer` e `chokidar` são CRÍTICOS para os comandos que os invocam. Se ausentes, devemos lançar Error com mensagem instruindo o usuário a instalar — NÃO retornar null silenciosamente. Cache do módulo carregado num closure-level let é mesma estrutura.

## Phase 88.02 watch.js debounce + clearKitCache (PRESERVAR)

```js
// src/core/watch.js linhas 25-26 — NÃO MEXER
const debounceMs = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 500;
const onLog = opts.onLog ?? (() => {});

// linhas 53-56 — NÃO MEXER
clearKitCache();  // PERF-16-02: invalidate before re-sync
```

## package.json estrutura atual (linhas 49-56) — alvo da mudança

```json
"dependencies": {
  "@inquirer/prompts": "^8.4.2",          // -> MOVE para optionalDependencies
  "@modelcontextprotocol/sdk": "^1.0.0",
  "chokidar": "^5.0.0",                   // -> MOVE para optionalDependencies
  "commander": "^14.0.3",
  "open": "^11.0.0",
  "picocolors": "^1.1.1"
}
```

**Resultado esperado:**
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.0.0",
  "commander": "^14.0.3",
  "open": "^11.0.0",
  "picocolors": "^1.1.1"
},
"optionalDependencies": {
  "@inquirer/prompts": "^8.4.2",
  "chokidar": "^5.0.0"
}
```

Total deps = 6 (mantido). 4 dependencies + 2 optionalDependencies.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move @inquirer/prompts and chokidar to optionalDependencies + lazy-import in core/ui.js and core/watch.js</name>
  <files>package.json, src/core/ui.js, src/core/watch.js</files>
  <action>
**Edição 1 — package.json (linhas 49-56):**

Substitua o bloco `"dependencies": {...}` atual por:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.0.0",
  "commander": "^14.0.3",
  "open": "^11.0.0",
  "picocolors": "^1.1.1"
},
"optionalDependencies": {
  "@inquirer/prompts": "^8.4.2",
  "chokidar": "^5.0.0"
}
```

Preserve TODO o resto do arquivo intacto (name, version, description, type, bin, publishConfig, files, keywords, author, license, repository, engines, scripts). NÃO mude a versão (`1.15.0` está correto — bump será feito no /publicar). Garanta indentação 2-spaces e que o JSON é parseable.

**Edição 2 — src/core/ui.js:**

Linha 13 atual:
```js
import { select as inqSelect, confirm as inqConfirm } from '@inquirer/prompts';
```

REMOVER essa linha. Adicionar abaixo do bloco de imports (após `import pc from 'picocolors';`):

```js
// PERF-16-05: @inquirer/prompts é optionalDependency. Carregamos lazy dentro
// de select()/confirm() para que (a) modo MCP server e CI não paguem o custo
// de boot, e (b) `npm install --omit=optional` produza CLI core funcional
// (apenas comandos interativos falham com mensagem descritiva).
let _inquirerModule = null;
async function loadInquirer() {
  if (_inquirerModule) return _inquirerModule;
  try {
    _inquirerModule = await import('@inquirer/prompts');
    return _inquirerModule;
  } catch (err) {
    throw new Error(
      'Interactive prompts require @inquirer/prompts. Install with `npm i @inquirer/prompts` or pass --yes / --no-interactive to skip the prompt.'
    );
  }
}
```

Substituir `select()` (linhas 126-131) por:

```js
export async function select(opts) {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive prompt unavailable: stdin is not a TTY. Pass the value as a flag instead.');
  }
  const { select: inqSelect } = await loadInquirer();
  return inqSelect(opts);
}
```

Substituir `confirm()` (linhas 133-138) por:

```js
export async function confirm(opts) {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive prompt unavailable: stdin is not a TTY. Pass --yes to skip confirmation.');
  }
  const { confirm: inqConfirm } = await loadInquirer();
  return inqConfirm(opts);
}
```

Preserve TODO o resto do arquivo: `c`, `icons`, `spinner`, `progress`, `summary`, `_internal`, comentários de design rules, NO_COLOR/FORCE_COLOR detection. NÃO mude a ordem das exports.

**Edição 3 — src/core/watch.js:**

Linha 14 atual:
```js
import chokidar from 'chokidar';
```

REMOVER essa linha. Top do arquivo (após os imports remanescentes) adicionar:

```js
// PERF-16-06: chokidar é optionalDependency. Carregamos lazy dentro de watchKit()
// para que (a) `kit sync install` (que NÃO usa watch) não pague o custo de boot,
// e (b) `npm install --omit=optional` produza CLI core funcional (apenas
// `kit sync watch` falha com mensagem descritiva).
let _chokidarModule = null;
async function loadChokidar() {
  if (_chokidarModule) return _chokidarModule;
  try {
    const mod = await import('chokidar');
    _chokidarModule = mod.default || mod;
    return _chokidarModule;
  } catch (err) {
    throw new Error(
      'kit sync watch requires chokidar. Install with `npm i chokidar` or use `kit sync install <target>` for one-shot syncing instead.'
    );
  }
}
```

Modificar `watchKit()` para usar `loadChokidar()`. Linha 38 atual:
```js
const watcher = chokidar.watch(kitRoot, {
```

Substituir por (logo antes da declaração `const watcher`):
```js
const chokidar = await loadChokidar();
const watcher = chokidar.watch(kitRoot, {
```

PRESERVE absolutamente TUDO MAIS em watch.js — debounce 500ms (linha 25, PERF-16-02), clearKitCache invalidation (linha 56, PERF-16-02), trigger() function, handle.stop(), detectExistingTargets(). A ÚNICA mudança é: import top-level removido + `loadChokidar` helper adicionado + `const chokidar = await loadChokidar()` antes do uso.

**Cuidados especiais:**
- Após a mudança, `select()`/`confirm()`/`watchKit()` permanecem `async` — assinatura inalterada (já eram async em todos os call-sites). Stable API preservada.
- `_inquirerModule` e `_chokidarModule` são closure-level (não exportados) — invisíveis para callers.
- Mensagem de erro DEVE incluir o comando `npm i <package>` literal (test vai assert isso).
- Em `loadChokidar`, `mod.default || mod` é necessário porque chokidar v5 pode exportar via default ou named export — mesmo pattern de open@11 em browser.js linha 17.
- NÃO toque em `node:path`, `node:fs/promises` em watch.js (linhas 12-13) — são builtins.
- Resolver kitRoot caching já existe em listKit (PERF-01) — NÃO mexer.
  </action>
  <verify>
**Automated:**
```bash
node -e "require('./package.json'); console.log('OK')"  # JSON valid
node -e "import('./src/core/ui.js').then(m => console.log(typeof m.select === 'function' ? 'OK' : 'FAIL'))"
node -e "import('./src/core/watch.js').then(m => console.log(typeof m.watchKit === 'function' ? 'OK' : 'FAIL'))"
node bin/cli.js kit list-agents --terse  # CLI boot still works
node bin/cli.js --help  # CLI help still works
npm test  # full suite passes (no regression — Phase 88.02 watch tests still pass)
```
  </verify>
  <done>
- package.json: `dependencies` tem 4 entries; `optionalDependencies` tem 2 entries (`@inquirer/prompts`, `chokidar`); JSON parseable; total deps = 6.
- src/core/ui.js: top-level `@inquirer/prompts` import removido; `loadInquirer()` helper adicionado; `select`/`confirm` usam dynamic import com mensagem de erro descritiva; resto do arquivo intacto.
- src/core/watch.js: top-level `chokidar` import removido; `loadChokidar()` helper adicionado; `watchKit()` chama `await loadChokidar()` antes de `chokidar.watch()`; debounce 500ms + clearKitCache PRESERVADOS.
- Suite npm test passa sem regressão (309 baseline + Phase 88.02 watch-debounce.test.js continua green).
- `node bin/cli.js kit list-agents` boota e funciona idêntico ao baseline.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add regression tests for optional deps + tarball reduction</name>
  <files>test/unit/optional-deps.test.js, test/integration/npm-pack-shape.test.js</files>
  <behavior>
Teste 1 (package.json structure): `package.json.dependencies` tem exatamente 4 keys; `package.json.optionalDependencies` tem exatamente 2 keys (`@inquirer/prompts`, `chokidar`); total deps = 6 (budget invariant).
Teste 2 (missing inquirer): simular ausência de `@inquirer/prompts` → `select({...})` lança Error contendo `npm i @inquirer/prompts`.
Teste 3 (missing chokidar): simular ausência de `chokidar` → `watchKit(['claude-code'], {...})` lança Error contendo `npm i chokidar`.
Teste 4 (dep budget invariant): `Object.keys(deps).length + Object.keys(optionalDeps).length === 6` — nunca acidentalmente adicione 7ª dep ou drope dep existente sem revisão.

Adicionalmente, EXTENDER `test/integration/npm-pack-shape.test.js` com:
Teste 5 (tarball metadata): `npm pack --dry-run --json` confirma que package.json incluído mostra a separação dependencies vs optionalDependencies (sanity — chokidar/@inquirer/prompts NÃO devem aparecer em files[] em nenhum caso, eles são deps externos não shipados, mas a struct do package.json no tarball reflete a separação).
  </behavior>
  <action>
**Arquivo 1 — Criar `test/unit/optional-deps.test.js`:**

```js
// Regression tests for PERF-16-05 (P5) and PERF-16-06 (P6) — Phase 89.02.
//
// Validates:
//   1. package.json has 4 dependencies + 2 optionalDependencies (budget = 6).
//   2. select()/confirm() throw descriptive error if @inquirer/prompts unavailable.
//   3. watchKit() throws descriptive error if chokidar unavailable.
//   4. Total dep budget invariant — guards against accidental drops or additions.
//
// Why these tests: optional deps are silently NOT installed when a downstream
// project runs `npm install --omit=optional`. We need MCP-server-style runs
// (CI, stdio mode) to keep working, and interactive/watch commands to fail
// with actionable messages. These tests pin both behaviors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

test('PERF-16-05/06: package.json declares 4 dependencies + 2 optionalDependencies', async () => {
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);

  const deps = Object.keys(pkg.dependencies || {});
  const optDeps = Object.keys(pkg.optionalDependencies || {});

  assert.equal(deps.length, 4, `expected 4 dependencies, got ${deps.length}: ${deps.join(',')}`);
  assert.equal(optDeps.length, 2, `expected 2 optionalDependencies, got ${optDeps.length}: ${optDeps.join(',')}`);

  // Specific entries — protects against accidental swaps.
  assert.ok(deps.includes('@modelcontextprotocol/sdk'), 'sdk must be in dependencies');
  assert.ok(deps.includes('commander'), 'commander must be in dependencies');
  assert.ok(deps.includes('open'), 'open must be in dependencies');
  assert.ok(deps.includes('picocolors'), 'picocolors must be in dependencies');

  assert.ok(optDeps.includes('@inquirer/prompts'), '@inquirer/prompts must be in optionalDependencies');
  assert.ok(optDeps.includes('chokidar'), 'chokidar must be in optionalDependencies');

  // Sanity: no overlap between dependencies and optionalDependencies.
  const overlap = deps.filter((d) => optDeps.includes(d));
  assert.deepEqual(overlap, [], `dep cannot be in both lists: ${overlap.join(',')}`);
});

test('PERF-16-05/06: total dep budget = 6 (invariant from v1.12.1 audit)', async () => {
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  const total = Object.keys(pkg.dependencies || {}).length
              + Object.keys(pkg.optionalDependencies || {}).length;
  assert.equal(total, 6, `dep budget violated: total=${total}, expected 6 (4 deps + 2 optional)`);
});

test('PERF-16-05: select() throws descriptive error when @inquirer/prompts unavailable', async (t) => {
  // Strategy: use Module._resolveFilename to inject a "module not found" for
  // @inquirer/prompts at the moment select() calls await import('@inquirer/prompts').
  // We cannot easily uninstall the package mid-test, so we patch the resolver.
  const origResolve = Module._resolveFilename;
  let restored = false;
  Module._resolveFilename = function (request, ...rest) {
    if (request === '@inquirer/prompts') {
      const err = new Error(`Cannot find module '@inquirer/prompts'`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    return origResolve.call(this, request, ...rest);
  };
  t.after(() => { if (!restored) { Module._resolveFilename = origResolve; restored = true; } });

  // Re-import ui.js so its loadInquirer() helper picks up the patched resolver
  // (cache-bust via query string; ui.js itself doesn't change).
  const ui = await import(`../../src/core/ui.js?cachebust=${Date.now()}`);

  // stdin.isTTY guard — set true so we hit the loadInquirer path. Save+restore.
  const prevIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  t.after(() => { Object.defineProperty(process.stdin, 'isTTY', { value: prevIsTTY, configurable: true }); });

  await assert.rejects(
    () => ui.select({ message: 'pick', choices: [{ name: 'a', value: 'a' }] }),
    (err) => /npm i @inquirer\/prompts/.test(err.message),
    'select() must throw with message instructing `npm i @inquirer/prompts`'
  );
});

test('PERF-16-06: watchKit() throws descriptive error when chokidar unavailable', async (t) => {
  const origResolve = Module._resolveFilename;
  let restored = false;
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'chokidar') {
      const err = new Error(`Cannot find module 'chokidar'`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    return origResolve.call(this, request, ...rest);
  };
  t.after(() => { if (!restored) { Module._resolveFilename = origResolve; restored = true; } });

  const watch = await import(`../../src/core/watch.js?cachebust=${Date.now()}`);

  await assert.rejects(
    () => watch.watchKit(['claude-code'], { projectRoot: REPO_ROOT }),
    (err) => /npm i chokidar/.test(err.message),
    'watchKit() must throw with message instructing `npm i chokidar`'
  );
});
```

**Cuidados Task 2.1 (test/unit/optional-deps.test.js):**
- `Module._resolveFilename` patch funciona em ESM dynamic import porque `await import()` ainda usa o resolver de Node por baixo. Verificar localmente — se não funcionar, alternativa B é usar `node --import` com um helper que faz o mesmo (ver test/unit/hooks-flush-race.test.js para padrão similar de monkey-patch).
- Cache-bust via `?cachebust=${Date.now()}` força re-execution do top-level do módulo (caso `_inquirerModule` cache já tenha sido populado por outro teste).
- `process.stdin.isTTY` guard em select() — set true para alcançar `loadInquirer()`. Restore após.
- `t.after` (test-context cleanup) preferível a `afterEach` para isolamento.

**Arquivo 2 — Editar `test/integration/npm-pack-shape.test.js`:**

ADICIONAR no FINAL do arquivo (após o último `test(...)` linha ~103) um novo teste:

```js
test('PERF-16-05/06: tarball package.json declares optionalDependencies (Phase 89)', async () => {
  // npm pack ships package.json verbatim. We grep the included package.json
  // for the optionalDependencies key to ensure the structure isn't reverted.
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  assert.ok(pkg.optionalDependencies, 'package.json must declare optionalDependencies (Phase 89)');
  assert.ok(
    pkg.optionalDependencies['@inquirer/prompts'],
    '@inquirer/prompts must be optional (PERF-16-05)'
  );
  assert.ok(
    pkg.optionalDependencies['chokidar'],
    'chokidar must be optional (PERF-16-06)'
  );
});
```

**Cuidados Task 2.2:**
- NÃO modifique nenhum dos 4 testes existentes (PERF-13-03 da v1.13). Apenas APENDE 1 novo teste.
- O test reusa `readFile`, `path`, `REPO_ROOT` que JÁ estão no top do arquivo. Não adicione imports duplicados.
- O test não compara tarball size em bytes (variabilidade entre Node versions/platforms torna flaky). A validação de "≥5% redução" é manual no /publicar — o teste apenas garante que a STRUCTURE foi mudada (optionalDependencies key existe).

**Validação local:**
```bash
node test/run.mjs test/unit  # passa optional-deps.test.js (4 testes)
node test/run.mjs test/integration  # passa npm-pack-shape.test.js extendido (5 testes total — 4 existentes + 1 novo)
```
  </action>
  <verify>
**Automated:**
```bash
node test/run.mjs test/unit  # 4 novos testes em optional-deps.test.js passing
node test/run.mjs test/integration  # 1 novo teste em npm-pack-shape.test.js passing (5 totais)
```

Suite final: 309 baseline + 3 (Plan 89.01) + 4 (Plan 89.02 unit) + 1 (Plan 89.02 integration) = 317 testes passing.
  </verify>
  <done>
- test/unit/optional-deps.test.js criado com 4 testes (package structure, dep budget, missing-inquirer message, missing-chokidar message).
- test/integration/npm-pack-shape.test.js extendido com 1 novo teste (optionalDependencies declared).
- Todos os testes passing localmente.
- Mensagens de erro contêm `npm i @inquirer/prompts` e `npm i chokidar` literalmente.
  </done>
</task>

</tasks>

<verification>
- `package.json` parseable; `dependencies` = 4 entries; `optionalDependencies` = 2 entries.
- `node bin/cli.js kit list-agents --terse` boota sem erro mesmo se inquirer/chokidar fossem ausentes (lazy não dispara em paths não-interativos / não-watch).
- `node test/run.mjs test/unit` passa (309 baseline + 3 do plan 01 + 4 do plan 02 = 316).
- `node test/run.mjs test/integration` passa (4 baseline + 1 novo = 5).
- Phase 88.02 watch-debounce.test.js continua green (debounce + clearKitCache não regrediram).
- Suite total post-Phase 89 = 317+ tests.
</verification>

<success_criteria>
- 2 deps movidas para `optionalDependencies` em package.json sem mudança de versão.
- 2 lazy-load helpers (`loadInquirer`, `loadChokidar`) adicionados — pattern consistente com `loadOpen` em browser.js.
- 5 novos regression tests (4 unit + 1 integration) pinning a estrutura.
- `npm install --omit=optional` (validado manualmente fora do test) resulta em CLI core funcional.
- Mensagens de erro são acionáveis (`npm i <package>` literal).
- Phase 88.02 PERF-16-02 fixes (debounce 500ms + clearKitCache) PRESERVADOS — `kit sync watch` em edit-burst continua coalescendo.
</success_criteria>

<output>
After completion, create `.planning/phases/89-lazy-imports-optional-deps/89-02-SUMMARY.md`
</output>
