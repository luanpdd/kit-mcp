---
plan_id: 79.02
phase: 79-critical-security-fixes
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/replays.js
autonomous: true
requirements: [SEC-13-02]
must_haves:
  truths:
    - "loadReplay('../etc/passwd') retorna erro 'invalid replay id' sem tentar ler arquivo"
    - "annotateReplay com id contendo path traversal retorna mesmo erro sem ler/escrever"
    - "recordReplay com payload.phase|plan|agent contendo caracteres maliciosos rejeita o slug"
    - "IDs válidos (regex /^[A-Za-z0-9_.-]+$/) continuam funcionando idêntico"
  artifacts:
    - path: "src/core/replays.js"
      provides: "validateReplayId() helper + chamadas em loadReplay/annotateReplay/recordReplay"
      contains: "invalid replay id"
  key_links:
    - from: "loadReplay/annotateReplay/recordReplay"
      to: "validateReplayId helper"
      via: "throw early antes de path.join + readFile/writeFile"
      pattern: "validateReplayId"
---

# Plan 79.02: replays.js path traversal hardening

<objective>
Validar `replayId` em loadReplay/annotateReplay e o slug derivado em recordReplay com regex allowlist + path.resolve assertion, rejeitando inputs maliciosos com erro descritivo estável antes de qualquer I/O em disco.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/79-critical-security-fixes/79-CONTEXT.md
@.planning/codebase/concerns.md
@D:\projetos\opensource\mcp\src\core\replays.js
@D:\projetos\opensource\mcp\src\mcp-server\index.js

## Surface vulnerável atual (extraída de src/core/replays.js)

Três callers usam `id` (ou slug derivado) em path.join sem sanitização:

**loadReplay (linhas 51-56):**
```js
export async function loadReplay(id, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const file = path.join(projectRoot, REPLAY_DIR_REL, `${id}.json`);
  const raw  = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}
```

**annotateReplay (linhas 58-65):**
```js
export async function annotateReplay(id, outcome, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const file = path.join(projectRoot, REPLAY_DIR_REL, `${id}.json`);
  const r = JSON.parse(await fs.readFile(file, 'utf8'));
  r.outcome = { ...(r.outcome ?? {}), ...outcome, annotated_at: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(r, null, 2), 'utf8');
  return r;
}
```

**recordReplay (linhas 20-33) — slug construído de payload:**
```js
const ts   = new Date().toISOString().replace(/[:.]/g, '-');
const slug = [payload.phase, payload.plan, payload.agent].filter(Boolean).join('-') || 'unknown';
const id   = `${ts}-${slug}`;
const file = path.join(dir, `${id}.json`);
```

`payload.phase`, `payload.plan`, `payload.agent` vêm de input MCP — também precisam ser validados (atacante envia `payload.phase = "../../../etc/passwd"` → arquivo escrito fora do replay dir).

## Surface MCP (lembre — atacante chega via mcp-server/index.js handleForensics linhas 226-228)

```js
case 'load-replay':     return loadReplay(args.replayId, { projectRoot });
case 'annotate-replay': return annotateReplay(args.replayId, args.outcome, { projectRoot });
case 'record-replay':   return recordReplay(args.payload, { projectRoot });
```

`args.replayId` e `args.payload.{phase,plan,agent}` são MCP-controlled.

## REPLAY_DIR_REL constant (linha 18)

```js
const REPLAY_DIR_REL = path.join('.planning', 'replays');
```

Após `path.resolve(projectRoot, REPLAY_DIR_REL)`, qualquer path final que NÃO comece com esse prefix indica traversal.
</context>

<tasks>

<task id="1" type="auto">
  <name>Task 1: Adicionar helper validateReplayId() e aplicar em loadReplay + annotateReplay + recordReplay</name>

  <read_first>
    - D:\projetos\opensource\mcp\src\core\replays.js (todo arquivo — 65 LOC)
    - D:\projetos\opensource\mcp\src\mcp-server\index.js (linhas 213-235 — handleForensics, para entender quem chama)
    - D:\projetos\opensource\mcp\.planning\phases\79-critical-security-fixes\79-CONTEXT.md (decisão de implementação C2)
  </read_first>

  <action>
Em `D:\projetos\opensource\mcp\src\core\replays.js`, adicionar helper `validateReplayId()` no topo (após imports, antes de `recordReplay`) e chamar em todos os 3 pontos de entrada. O patch completo:

1. **Adicionar helper imediatamente após linha 18 (após `const REPLAY_DIR_REL = ...`):**

```js
// SEC-13-02: replayId path traversal guard. The MCP forensics tool exposes
// load-replay/annotate-replay/record-replay actions; without sanitization,
// a malicious replayId like '../../../etc/passwd' would read/write files
// outside .planning/replays/.
//
// Strategy: allowlist regex (no slashes, no '..', no NUL) + post-resolve assertion
// that the final path stays inside REPLAY_DIR_REL.
const REPLAY_ID_RE = /^[A-Za-z0-9_.-]+$/;

function validateReplayId(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('invalid replay id: must be a non-empty string');
  }
  if (id === '.' || id === '..' || id.includes('..')) {
    throw new Error('invalid replay id: traversal sequences not allowed');
  }
  if (!REPLAY_ID_RE.test(id)) {
    throw new Error(`invalid replay id: only [A-Za-z0-9_.-] allowed, got ${JSON.stringify(id)}`);
  }
  return id;
}

function assertPathInside(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  // Ensure resolved is base or a child of base (handle trailing-sep edge case).
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('invalid replay id: resolved path escapes replay directory');
  }
  return resolved;
}
```

2. **Modificar `recordReplay` (linhas 20-33):** validar cada componente do slug ANTES de juntar. Substituir o bloco do slug:

```js
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  // SEC-13-02: validate each slug component independently before concat
  const slugParts = [payload.phase, payload.plan, payload.agent].filter(Boolean);
  for (const part of slugParts) {
    validateReplayId(String(part));
  }
  const slug = slugParts.join('-') || 'unknown';
  const id   = `${ts}-${slug}`;
  // Re-validate the full id (defense in depth — ts is well-formed but cheap to check)
  validateReplayId(id);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);
```

3. **Modificar `loadReplay` (linhas 51-56):** validar `id` ANTES de path.join, e assertar prefix após resolve:

```js
export async function loadReplay(id, opts = {}) {
  validateReplayId(id);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);
  const raw  = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}
```

4. **Modificar `annotateReplay` (linhas 58-65):** mesmo pattern:

```js
export async function annotateReplay(id, outcome, opts = {}) {
  validateReplayId(id);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);
  const r = JSON.parse(await fs.readFile(file, 'utf8'));
  r.outcome = { ...(r.outcome ?? {}), ...outcome, annotated_at: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(r, null, 2), 'utf8');
  return r;
}
```

NÃO modificar `listReplays` — ela só faz `readdir` do dir, não usa `id` controlado por usuário.
NÃO modificar `REPLAY_DIR_REL` constant.
NÃO modificar mcp-server/index.js — os errors propagam naturalmente via `try/catch` do `setRequestHandler` na linha 280-285 (já vira `{ error, stack }` JSON).

Mensagens de erro estáveis (clientes MCP podem matchá-las):
- `invalid replay id: must be a non-empty string`
- `invalid replay id: traversal sequences not allowed`
- `invalid replay id: only [A-Za-z0-9_.-] allowed, got "<input>"`
- `invalid replay id: resolved path escapes replay directory`
  </action>

  <verify>
```bash
grep -q "function validateReplayId" D:/projetos/opensource/mcp/src/core/replays.js
grep -q "function assertPathInside" D:/projetos/opensource/mcp/src/core/replays.js
grep -c "validateReplayId(" D:/projetos/opensource/mcp/src/core/replays.js
grep -q "REPLAY_ID_RE" D:/projetos/opensource/mcp/src/core/replays.js
grep -q "SEC-13-02" D:/projetos/opensource/mcp/src/core/replays.js
```
Esperado: primeiros 2 grep exit 0. `grep -c` retorna >= 4 (definição + uso em recordReplay 2x + loadReplay + annotateReplay = 5 calls, ou 4 se a re-validation defense-in-depth for omitida → mínimo 4). `REPLAY_ID_RE` e `SEC-13-02` exit 0.
  </verify>

  <acceptance_criteria>
    - `grep -q "function validateReplayId" D:/projetos/opensource/mcp/src/core/replays.js` exit 0
    - `grep -q "function assertPathInside" D:/projetos/opensource/mcp/src/core/replays.js` exit 0
    - `grep -q "REPLAY_ID_RE = /\^\[A-Za-z0-9_.-\]+\$/" D:/projetos/opensource/mcp/src/core/replays.js` exit 0
    - `grep -c "validateReplayId(" D:/projetos/opensource/mcp/src/core/replays.js` retorna número >= 4 (definição + 3+ usos)
    - `grep -q "SEC-13-02" D:/projetos/opensource/mcp/src/core/replays.js` exit 0 (referência REQ inline)
    - `node -e "import('./src/core/replays.js').then(m => console.log(typeof m.loadReplay))"` cwd=D:/projetos/opensource/mcp output `function`
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Task 2: Test unitário para path traversal + verificar regressão zero em tests existentes</name>

  <read_first>
    - D:\projetos\opensource\mcp\src\core\replays.js (deve refletir mudança da Task 1)
    - D:\projetos\opensource\mcp\test\unit\kit.test.js (referência de estilo dos testes existentes — usa node:test)
    - D:\projetos\opensource\mcp\test\run.mjs (test runner — entender interface)
  </read_first>

  <action>
Criar `D:\projetos\opensource\mcp\test\unit\replays-path-traversal.test.mjs` com o seguinte conteúdo (use node:test, sem deps externas):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadReplay, annotateReplay, recordReplay } from '../../src/core/replays.js';

async function tmpProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-replay-test-'));
  await mkdir(path.join(root, '.planning', 'replays'), { recursive: true });
  return root;
}

test('SEC-13-02: loadReplay rejects traversal id', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      loadReplay('../etc/passwd', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('..', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('foo/bar', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('foo\\bar', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('', { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: annotateReplay rejects traversal id', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      annotateReplay('../etc/passwd', { status: 'pwned' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      annotateReplay('..', { status: 'pwned' }, { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: recordReplay rejects malicious slug components', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      recordReplay({ phase: '../../../etc', plan: '01', agent: 'pwn' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      recordReplay({ phase: '79', plan: '..', agent: 'planner' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      recordReplay({ phase: '79', plan: '01', agent: 'pwn/payload' }, { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: valid replayId continues to work', async () => {
  const root = await tmpProject();
  try {
    // record a replay first (valid components)
    const rec = await recordReplay(
      { phase: '79', plan: '01', agent: 'planner', prompt: 'test' },
      { projectRoot: root }
    );
    assert.ok(rec.id);
    assert.ok(rec.file);

    // load with the returned id
    const loaded = await loadReplay(rec.id, { projectRoot: root });
    assert.equal(loaded.id, rec.id);
    assert.equal(loaded.phase, '79');

    // annotate with the same id
    const annotated = await annotateReplay(
      rec.id,
      { status: 'success', notes: 'ok' },
      { projectRoot: root }
    );
    assert.equal(annotated.outcome.status, 'success');
    assert.ok(annotated.outcome.annotated_at);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Em seguida, rodar a suite completa:
1. `node test/run.mjs test/unit` (deve incluir o novo arquivo automaticamente — runner faz scan)
2. `node test/run.mjs test/integration` (zero regressão)

Se o test runner não pegar arquivos `.mjs` automaticamente (pegava só `.test.js`), inspecionar `D:\projetos\opensource\mcp\test\run.mjs` e renomear o arquivo de teste para extensão `.test.js` (com sintaxe ESM compatível — `package.json` tem `"type": "module"`).
  </action>

  <verify>
```bash
# Teste novo existe
ls D:/projetos/opensource/mcp/test/unit/replays-path-traversal.test.*
# Suite passa
node test/run.mjs test/unit
node test/run.mjs test/integration
# Test específico encontrado
grep -l "SEC-13-02" D:/projetos/opensource/mcp/test/unit/*
```
  </verify>

  <acceptance_criteria>
    - Arquivo `D:\projetos\opensource\mcp\test\unit\replays-path-traversal.test.mjs` existe (ou `.test.js` se runner não suportar `.mjs`)
    - `node test/run.mjs test/unit` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - `node test/run.mjs test/integration` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - Output do test runner para test/unit menciona "SEC-13-02" pelo menos 4 vezes (4 testes do arquivo) — ou contagem de testes total aumentou em 4 vs baseline pré-Task1
    - `grep -l "SEC-13-02" D:/projetos/opensource/mcp/test/unit/*` retorna pelo menos 1 match (test file referencia REQ)
    - Test passa no Windows (paths backslash) — incluído via assertion `loadReplay('foo\\\\bar', ...)` no test
  </acceptance_criteria>
</task>

</tasks>

<verification>
Verificações gerais do plan:
- `grep -q "function validateReplayId" src/core/replays.js` retorna 0
- `grep -q "REPLAY_ID_RE" src/core/replays.js` retorna 0
- `grep -c "validateReplayId(" src/core/replays.js` >= 4 (definição + ≥3 usos)
- Arquivo de teste replays-path-traversal existe em test/unit
- `node test/run.mjs test/unit` exit 0 (incluindo 4 novos testes)
- `node test/run.mjs test/integration` exit 0 (zero regressão)
- Cenários cobertos: '../etc/passwd', '..', 'foo/bar', 'foo\\bar', '', slug components maliciosos, valid id continua funcionando
</verification>

<success_criteria>
- C2 fechado: loadReplay/annotateReplay/recordReplay rejeitam IDs maliciosos com mensagem estável "invalid replay id" antes de qualquer I/O
- Defense in depth: regex allowlist + path.resolve assertion + componente-por-componente em recordReplay
- Stable API preservada: IDs válidos (matching regex) funcionam idêntico — confirmado por test "valid replayId continues to work"
- Zero regressão: suite test/unit + test/integration passa
- 4 testes novos adicionados, todos referenciando SEC-13-02 inline
</success_criteria>

<output>
After completion, create `.planning/phases/79-critical-security-fixes/79-02-SUMMARY.md` with:
- O que mudou em src/core/replays.js (helpers adicionados, callers protegidos)
- Test cases adicionados e qual cenário cada um cobre
- Confirmação que IDs válidos continuam funcionando
- Mensagens de erro exatas para futura referência de clientes MCP
</output>
</content>
</invoke>