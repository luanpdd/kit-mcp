---
phase: 83-core-filesystem-hardening
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - kit/file-manifest.json
  - src/core/manifest-verify.js
  - src/core/sync.js
  - test/unit/manifest-verify.test.js
autonomous: true
requirements:
  - SEC-14-05

must_haves:
  truths:
    - "verifyManifest(kitRoot) lê kit/file-manifest.json e valida SHA256 de cada arquivo listado"
    - "syncTo() chama verifyManifest no início do path de install (não no path de remove); throw em mismatch"
    - "Mismatch error message lista até 3 arquivos divergentes com path relativo"
    - "process.env.KIT_MCP_SKIP_MANIFEST_CHECK === '1' skipa a verificação e emite warn em stderr"
    - "kit/file-manifest.json regenerado no início do plan refletindo realidade atual (221 entries → 328+ entries; 40 hashes corrigidos; 107 arquivos novos adicionados)"
    - "kit sync install em workspace com manifest válido continua funcionando sem regressão"
  artifacts:
    - path: "src/core/manifest-verify.js"
      provides: "verifyManifest(kitRoot) helper puro retornando {ok, mismatches}"
      exports: ["verifyManifest"]
    - path: "src/core/sync.js"
      provides: "syncTo invoca verifyManifest no caminho de install antes de qualquer write"
      contains: "verifyManifest"
    - path: "kit/file-manifest.json"
      provides: "manifest atualizado com hashes de TODOS os arquivos shipped (não apenas os de v1.4.0)"
      contains: "version"
    - path: "test/unit/manifest-verify.test.js"
      provides: "regressão SEC-14-05 — manifest válido aceito; tampered → reject; env var skip + warn"
      contains: "SEC-14-05"
  key_links:
    - from: "src/core/sync.js syncTo"
      to: "src/core/manifest-verify.js verifyManifest"
      via: "import + chamada antes do loop de writes"
      pattern: "verifyManifest\\("
    - from: "src/core/manifest-verify.js"
      to: "kit/file-manifest.json"
      via: "fs.readFile + JSON.parse + sha256 cada files entry"
      pattern: "createHash.*sha256"
    - from: "test/unit/manifest-verify.test.js"
      to: "src/core/manifest-verify.js + src/core/sync.js"
      via: "fixture kit dirs + verifyManifest direto + syncTo end-to-end"
      pattern: "verifyManifest|syncTo"
---

<objective>
Fechar SEC-14-05 — `kit/file-manifest.json` tem SHA256 hashes mas NENHUM código em `src/` lê. Reverse-sync.apply --strategy=overwrite pode reescrever `kit/agents/executor.md` adversarialmente; próximo `kit sync install` propaga o agent malicioso para todas as IDEs sem detecção.

**Estado atual descoberto na investigação pré-planejamento:** o manifest está PROFUNDAMENTE stale — 221 entries listados, mas:
- 40 hashes não batem (arquivos editados desde v1.4.0).
- 107 arquivos no disco em `kit/` que NÃO estão no manifest (novos agents/commands/skills da v1.5+v1.6+v1.7+v1.8+v1.9+v1.10+v1.11+v1.12+v1.13+v1.14).
- Categoria de mismatches: 19 agents, 11 commands, 4 framework, 6 hooks.

Isso É a prova da vulnerabilidade existir — o manifest foi escrito uma vez (v1.4.0, 2026-05-05) e nunca mais regenerado; `src/` nunca leu, então drift inteiro do kit silenciosamente "OK". Implementar o leitor + regenerar de uma só vez fecha o gap.

Purpose: Defesa contra tampering pós-publicação. Atacante que conseguir editar `kit/agents/executor.md` (ou via reverse-sync apply) antes de `kit sync install` será detectado se o manifest foi também não-tampered. Manifest é shipped junto com kit/; se atacante edita ambos, isso é um vetor diferente (assinatura de pacote npm cobre — out of scope).

Output: Helper `verifyManifest()` puro, chamada em `syncTo` no install path, env var opt-out, manifest regenerado, 5 regression tests.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/83-core-filesystem-hardening/83-CONTEXT.md
@src/core/sync.js
@kit/file-manifest.json
@test/unit/sync.test.js

<interfaces>
## Contratos extraídos da codebase

### kit/file-manifest.json — schema atual

```json
{
  "version": "1.4.0",
  "timestamp": "2026-05-05T05:44:24.485Z",
  "files": {
    "agents/advisor-researcher.md": "63ce6018f06ff91aa15ec2720772e3cc86a7ea35df81ea70b688b484fb1ae5cf",
    ...
  }
}
```

Path keys são **relativos a `kitRoot`** (NÃO incluem o prefixo `kit/`). Hashes são SHA256 hex lowercase.

### src/core/sync.js syncTo — onde injetar (linha 21-103)

```js
export async function syncTo(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = resolveKitRoot(opts.kitRoot);
  const mode        = opts.mode ?? 'reference';
  const dryRun      = !!opts.dryRun;
  // INJEÇÃO AQUI — verifyManifest(kitRoot)
  ...
  const kit  = opts.kit ?? await listKit(kitRoot, { stubsOnly: mode === 'reference' });
```

`removeFrom` (linha 156) e `statusOf` (linha 142) NÃO chamam — apenas install path.

### src/core/sync.js já importa fs/path

```js
import path from 'node:path';
import fs from 'node:fs/promises';
```

`crypto` NÃO está importado — `verifyManifest.js` deve importar `node:crypto`.

### Pattern de teste — test/unit/sync.test.js

Usa `FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit')` para kitRoot e `TMP = await fs.mkdtemp(...)` para projectRoot. Pattern de cleanup já estabelecido.

### Estado atual do manifest (medição feita pré-planejamento)

```
manifest entries: 221
mismatches (hash drift): 40
files on disk NOT in manifest: 107
mismatches by category: { agents: 19, commands: 11, framework: 4, hooks: 6 }
```

Total real esperado pós-regen: 221 + 107 = ~328 entries (alinhado com CHANGELOG "kit/agents 47 + kit/commands 87 + kit/skills 49 + kit/framework 134" do concerns.md, descontando arquivos não-shipped).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Regenerar kit/file-manifest.json refletindo estado atual do kit/</name>
  <files>kit/file-manifest.json</files>
  <action>
Cuidado especial documentado em CONTEXT.md: o manifest está stale; precisamos regenerá-lo ANTES de implementar o verifier, senão os testes vão falhar pelo motivo errado.

Algoritmo de regeneração (rodar inline via `node -e`):

```js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pkg = require('./package.json');

const kitRoot = path.resolve('kit');
const out = { version: pkg.version, timestamp: new Date().toISOString(), files: {} };

function walk(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries.sort((a,b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, rel);
    else if (e.isFile()) {
      // Skip the manifest itself
      if (rel === 'file-manifest.json') continue;
      const buf = fs.readFileSync(abs);
      out.files[rel] = crypto.createHash('sha256').update(buf).digest('hex');
    }
  }
}

walk(kitRoot);
fs.writeFileSync(
  path.join(kitRoot, 'file-manifest.json'),
  JSON.stringify(out, null, 2) + '\n',
  'utf8'
);
console.log('Manifest regenerated:', Object.keys(out.files).length, 'files, version', out.version);
```

Decisões importantes:

1. **`version` field do manifest:** use `package.json` version (atualmente 1.13.x; pós-v1.14 publish vai virar 1.14.0). Antes era hard-coded "1.4.0" — bug. Lendo de package.json mantém manifest sincronizado com a release que o gerou.
2. **Skipar o próprio manifest:** se incluímos `file-manifest.json` na lista, qualquer regen muda o hash de si mesmo — loop. Explícito para claridade.
3. **Ordenação:** sort by `name` em cada nível para determinismo (importante para diff entre regenerações).
4. **`\n` trailing:** convenção JSON do projeto; padroniza com newline para evitar lint warning.
5. **POR QUÊ não criar script permanente em `scripts/regen-manifest.cjs`:** out of scope para esta phase. CONTEXT.md `<deferred>` tem "Manifest auto-regen em prepublishOnly script" como DRIFT-15-XX.

Após rodar: `git diff kit/file-manifest.json` deve mostrar 40+ hashes alterados e 107+ entries adicionados. Verificar via `node -e "const m = require('./kit/file-manifest.json'); console.log('entries:', Object.keys(m.files).length, 'version:', m.version)"`.

POR QUÊ regenerar ANTES do verifier (Task 2): se implementarmos Task 2 primeiro, syncTo via verifyManifest vai THROW em todo workspace de teste com kit drift, quebrando 222 testes baseline. Regenerar primeiro é prerequisito não-opcional.
  </action>
  <verify>
    <automated>node -e "const m = require('./kit/file-manifest.json'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const entries = Object.entries(m.files); let mismatches = 0; let missing = 0; for (const [rel, expected] of entries) { try { const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join('kit', rel))).digest('hex'); if (actual !== expected) mismatches++; } catch { missing++; } } console.log('entries:', entries.length, 'mismatches:', mismatches, 'missing:', missing, 'version:', m.version); process.exit((mismatches === 0 && missing === 0 && entries.length > 220) ? 0 : 1);"</automated>
  </verify>
  <done>
- `kit/file-manifest.json` regenerado.
- `entries` count reflete realidade (>= 280, provavelmente ~328).
- `mismatches` = 0 e `missing` = 0 quando comparado ao kit/ atual.
- `version` field reflete `package.json` (não mais hard-coded "1.4.0").
- Comando de verify retorna exit 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Helper verifyManifest em src/core/manifest-verify.js</name>
  <files>src/core/manifest-verify.js</files>
  <action>
Criar novo arquivo `src/core/manifest-verify.js`:

```js
// SEC-14-05: verify kit/file-manifest.json against actual file contents.
// Called by syncTo() in install path, before any write — refuses to project
// a tampered kit. Opt-out via KIT_MCP_SKIP_MANIFEST_CHECK=1 (warn on stderr).
//
// Manifest format (kit/file-manifest.json):
//   { version, timestamp, files: { "<rel-to-kitRoot>": "<sha256-hex>", ... } }
//
// Returns:
//   { ok: true } when all listed files exist + match.
//   { ok: false, reason, mismatches, missing } otherwise.

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SKIP_ENV = 'KIT_MCP_SKIP_MANIFEST_CHECK';

export async function verifyManifest(kitRoot) {
  if (process.env[SKIP_ENV] === '1') {
    process.stderr.write(
      '[kit-mcp] WARNING: ' + SKIP_ENV + '=1 set — skipping kit/file-manifest.json verification (dev mode).\n'
    );
    return { ok: true, skipped: true };
  }

  const manifestPath = path.join(kitRoot, 'file-manifest.json');
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      reason: 'kit manifest unreadable at ' + manifestPath + ': ' + e.message,
      mismatches: [],
      missing: [],
    };
  }

  if (!manifest.files || typeof manifest.files !== 'object') {
    return {
      ok: false,
      reason: 'kit manifest malformed at ' + manifestPath + ': missing \\'files\\' object',
      mismatches: [],
      missing: [],
    };
  }

  const mismatches = [];
  const missing = [];

  for (const [rel, expected] of Object.entries(manifest.files)) {
    const abs = path.join(kitRoot, rel);
    let buf;
    try {
      buf = await fs.readFile(abs);
    } catch {
      missing.push(rel);
      continue;
    }
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    if (actual !== expected) {
      mismatches.push({ path: rel, expected: expected.slice(0, 16), actual: actual.slice(0, 16) });
    }
  }

  if (mismatches.length === 0 && missing.length === 0) {
    return { ok: true };
  }

  // Build a concise reason — first 3 mismatches, plus counts.
  const sample = mismatches.slice(0, 3).map(m => m.path + ' (expected ' + m.expected + ', got ' + m.actual + ')').join('; ');
  const missingSample = missing.slice(0, 3).join(', ');
  const reasonParts = [];
  if (mismatches.length > 0) {
    reasonParts.push(mismatches.length + ' file(s) tampered: ' + sample + (mismatches.length > 3 ? ', +' + (mismatches.length - 3) + ' more' : ''));
  }
  if (missing.length > 0) {
    reasonParts.push(missing.length + ' file(s) missing: ' + missingSample + (missing.length > 3 ? ', +' + (missing.length - 3) + ' more' : ''));
  }
  reasonParts.push('set ' + SKIP_ENV + '=1 to bypass (dev only)');

  return {
    ok: false,
    reason: 'kit manifest mismatch — ' + reasonParts.join('; '),
    mismatches,
    missing,
  };
}
```

Decisões importantes:

1. **`{ok, reason, mismatches, missing}` shape** (não throw): consistente com `validateProjectRoot` (Plan 01). syncTo decide se `throw new Error(reason)` ou retorna error.
2. **Fail-closed em manifest absent ou corrompido:** atacante que apaga manifest poderia bypassar a check. Mantemos rigoroso.
3. **NÃO check de "extras":** seria muito ruidoso com `.smoketest-watch/` (concerns.md HIGH issue) e arquivos dev locais. Out of scope.
4. **Hash truncado para 16 chars no error message:** SHA256 inteiro é 64 chars, ocupa muito espaço em UI/log. 16 chars é mais que suficiente para humano discernir mismatches únicos.
5. **`sample.slice(0, 3)`:** prevenção de log spam. CONTEXT.md `<decisions>` "throw error com mensagem listando primeiros 3 mismatches".
6. **Warn vai para stderr (não stdout):** stdout do MCP server é JSON-RPC; misturar warn corromperia o protocol. Pattern correto.
7. **POR QUÊ NÃO `Promise.all` paralelo nas leituras de arquivo:** SHA256 de 328 arquivos pequenos (~600KB total) é IO-bound; fast enough sequencial (~50ms). CONTEXT.md `<code_context>` menciona "considerar cache" mas é "premature optimization se for rápido o suficiente".

Implementar conforme CONTEXT.md `<decisions>` "SEC-14-05 (manifest verification)".
  </action>
  <verify>
    <automated>node -e "import('./src/core/manifest-verify.js').then(m => m.verifyManifest('kit')).then(r => { console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 1); })"</automated>
  </verify>
  <done>
- `src/core/manifest-verify.js` existe com export `verifyManifest`.
- Comando de verify retorna `{ "ok": true }` (manifest acabou de ser regenerado em Task 1).
- Mensagem de erro para manifest tampered contém "kit manifest mismatch" (testes Task 4 dependem disso).
  </done>
</task>

<task type="auto">
  <name>Task 3: Chamar verifyManifest em syncTo no install path</name>
  <files>src/core/sync.js</files>
  <action>
Modificar apenas o início de `syncTo` em `src/core/sync.js` (linhas 21-32).

Mudanças:

1. Adicionar import junto aos existentes (linha 12-15):
   ```js
   import { verifyManifest } from './manifest-verify.js';
   ```

2. Inserir guard logo após resolver `kitRoot` e `dryRun` (entre linhas 26 e 28, antes do `onProgress` ou junto com ele — qualquer ordem antes do `const kit = ...`):
   ```js
   export async function syncTo(targetId, opts = {}) {
     const target      = getTarget(targetId);
     const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
     const kitRoot     = resolveKitRoot(opts.kitRoot);
     const mode        = opts.mode ?? 'reference';
     const dryRun      = !!opts.dryRun;
     const onProgress  = opts.onProgress ?? (() => {});

     // SEC-14-05: verify kit integrity before projecting. Refuses tampered kit/.
     // Opt-out via KIT_MCP_SKIP_MANIFEST_CHECK=1 (handled inside verifyManifest).
     const manifestCheck = await verifyManifest(kitRoot);
     if (!manifestCheck.ok) {
       const err = new Error(manifestCheck.reason);
       err.code = 'EMANIFESTMISMATCH';
       throw err;
     }

     // PERF-03: accept a pre-loaded kit ...
     const kit = opts.kit ?? await listKit(kitRoot, { stubsOnly: mode === 'reference' });
     ...
   }
   ```

POR QUÊ throw (não return error):
- syncTo retorna `{ target, mode, projectRoot, kitRoot, written, dryRun }` em sucesso. Adicionar `error` field ao shape mudaria API pública. Throw mantém o shape limpo.
- Pattern já existe em walkTree (linha 127): `const err = new Error(...); err.code = 'EUNSAFEPATH'; throw err;`. Replico.
- CLI captura via Commander error handling padrão (vai para stderr + exit 1). MCP captura via try/catch no wrapper handler do `src/mcp-server/index.js:303-309`, retornando como `{error, stack}` no envelope (Phase 84 vai sanitizar isso depois).

POR QUÊ guard SÓ em syncTo (não em removeFrom, statusOf, applyReverse):
- `removeFrom` apaga arquivos LOCAIS no projectRoot (stubs gerados pelo sync); não lê kit/ content.
- `statusOf` lê apenas paths exists/não.
- `applyReverse` ESCREVE em kit/ (oposto direção). É EXATAMENTE onde tampering pode ser INTRODUZIDO. Mas verificar manifest ANTES de apply seria contraproducente — verificaríamos contra estado pre-tamper. Defesa correta para apply é regenerar manifest pós-apply ou signed approval; out of scope para esta phase.
- `detectReverse` é read-only.

POR QUÊ NÃO em CLI separately (kit list/list-agents):
- CONTEXT.md menciona "opcionalmente em src/cli/index.js (kit list/list-agents)". CONSIDEREI; rejeitei. `kit list-agents` lê apenas frontmatter via `listKit` → arquivos individuais. Custo de check de manifest ~50ms a cada list ≠ benefício real. Manter sync-only mantém o blast radius do check minimizado.

Implementar conforme CONTEXT.md `<decisions>` "Chamar em src/core/sync.js no início de syncTo() (path de install, não de remove)".
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const src = fs.readFileSync('src/core/sync.js','utf8'); const importOk = /import\s*\{\s*verifyManifest\s*\}\s*from\s*['\"]\.\/manifest-verify/.test(src); const callOk = /verifyManifest\s*\(\s*kitRoot\s*\)/.test(src); const throwOk = /EMANIFESTMISMATCH/.test(src); console.log('import:', importOk, 'call:', callOk, 'throw:', throwOk); process.exit((importOk && callOk && throwOk) ? 0 : 1);"</automated>
  </verify>
  <done>
- Import `verifyManifest` presente em `src/core/sync.js`.
- Chamada `verifyManifest(kitRoot)` antes do listKit / loop de writes.
- Throw com `err.code = 'EMANIFESTMISMATCH'` em caso de mismatch.
- Suite existente `node --test test/unit/sync.test.js` continua passando (precisa que test/fixtures/sample-kit tenha um manifest válido OU que o teste use KIT_MCP_SKIP_MANIFEST_CHECK=1; ver Task 4 para o handling correto).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Regression tests SEC-14-05 + handling do skip env var em testes existentes</name>
  <files>test/unit/manifest-verify.test.js</files>
  <behavior>
- Teste 1 (manifest válido aceito): cria fixture kit/ com 2-3 arquivos + manifest.json gerado in-place; `verifyManifest(fixtureRoot)` retorna `{ok: true}`.
- Teste 2 (mismatch detectado — tampering): mesmo fixture; modifica 1 arquivo SEM regenerar manifest; `verifyManifest` retorna `{ok: false}` com `reason` contendo "manifest mismatch" e o path do arquivo tampered.
- Teste 3 (missing file detectado): fixture com manifest listando arquivo X; X é apagado do disk; `verifyManifest` retorna `{ok: false}` com `reason` contendo "missing".
- Teste 4 (env var skip + warn em stderr): seta `process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1'`, captura stderr, chama `verifyManifest(fixtureWithBadManifest)`; retorna `{ok: true, skipped: true}` MESMO com tampering, e stderr capturado contém "WARNING".
- Teste 5 (E2E via syncTo — kit válido funciona): chama `syncTo('claude-code', { kitRoot: validFixture, projectRoot: tmpDir })`; resolve sem throw e retorna shape esperado (`written.length > 0`).
- Teste 6 (E2E via syncTo — kit tampered throws): mesmo cenário mas com fixture tampered; assert.rejects com `err.code === 'EMANIFESTMISMATCH'`.
  </behavior>
  <action>
Criar `test/unit/manifest-verify.test.js`:

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import { verifyManifest } from '../../src/core/manifest-verify.js';
import { syncTo } from '../../src/core/sync.js';

let TMP_KIT;
let TMP_PROJECT;
let savedSkipEnv;

beforeEach(async () => {
  TMP_KIT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-kit-'));
  TMP_PROJECT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-proj-'));
  savedSkipEnv = process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
});

afterEach(async () => {
  await fs.rm(TMP_KIT, { recursive: true, force: true });
  await fs.rm(TMP_PROJECT, { recursive: true, force: true });
  if (savedSkipEnv !== undefined) process.env.KIT_MCP_SKIP_MANIFEST_CHECK = savedSkipEnv;
  else delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
});

// Helper: build a minimal valid kit fixture with a fresh manifest.
async function buildFixtureKit(kitRoot, files = { 'agents/foo.md': '# foo\n', 'commands/bar.md': '# bar\n' }) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(kitRoot, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  const manifest = { version: 'test', timestamp: new Date().toISOString(), files: {} };
  for (const [rel, content] of Object.entries(files)) {
    manifest.files[rel] = crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');
  }
  await fs.writeFile(path.join(kitRoot, 'file-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

test('SEC-14-05: verifyManifest accepts intact kit', async () => {
  await buildFixtureKit(TMP_KIT);
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, true);
});

test('SEC-14-05: verifyManifest detects tampered file', async () => {
  await buildFixtureKit(TMP_KIT);
  // Tamper without updating manifest
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, false);
  assert.match(r.reason, /kit manifest mismatch/);
  assert.match(r.reason, /agents\/foo\.md/);
});

test('SEC-14-05: verifyManifest detects missing file', async () => {
  await buildFixtureKit(TMP_KIT);
  await fs.rm(path.join(TMP_KIT, 'agents/foo.md'));
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing/);
  assert.match(r.reason, /agents\/foo\.md/);
});

test('SEC-14-05: KIT_MCP_SKIP_MANIFEST_CHECK=1 bypasses with stderr warn', async () => {
  await buildFixtureKit(TMP_KIT);
  // Tamper so verification would normally fail
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

  process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

  // Capture stderr
  const origWrite = process.stderr.write.bind(process.stderr);
  const captured = [];
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };

  let r;
  try {
    r = await verifyManifest(TMP_KIT);
  } finally {
    process.stderr.write = origWrite;
  }

  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.ok(captured.some(s => /WARNING/.test(s) && /KIT_MCP_SKIP_MANIFEST_CHECK/.test(s)),
    'expected stderr WARNING about skip env var, got: ' + JSON.stringify(captured));
});

test('SEC-14-05 E2E: syncTo passes when kit manifest is intact', async () => {
  // Build a fixture sufficient for the registry's claude-code target requirements.
  // The target reads agents/, commands/, skills/ (each with SKILL.md), framework/, hooks/.
  // For this E2E we only need the syncTo not to throw on manifest check.
  // Sample-kit fixture is too elaborate; build a minimal kit and skip the registry capabilities
  // that require non-existent dirs by using KIT_MCP_KIT_ROOT trick:
  await buildFixtureKit(TMP_KIT, {
    'agents/foo.md': '---\nname: foo\ndescription: Test agent\n---\n# foo\n',
    'commands/bar.md': '---\ndescription: Test command\n---\n# bar\n',
    'skills/baz/SKILL.md': '---\nname: baz\ndescription: Test skill\n---\n# baz\n',
  });
  const r = await syncTo('claude-code', { kitRoot: TMP_KIT, projectRoot: TMP_PROJECT });
  assert.ok(r.written.length > 0, 'syncTo should have written files; got ' + JSON.stringify(r));
});

test('SEC-14-05 E2E: syncTo throws EMANIFESTMISMATCH when kit is tampered', async () => {
  await buildFixtureKit(TMP_KIT, {
    'agents/foo.md': '---\nname: foo\ndescription: Test agent\n---\n# foo\n',
    'commands/bar.md': '---\ndescription: Test command\n---\n# bar\n',
    'skills/baz/SKILL.md': '---\nname: baz\ndescription: Test skill\n---\n# baz\n',
  });
  // Tamper after manifest is built
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# evil\n', 'utf8');

  await assert.rejects(
    () => syncTo('claude-code', { kitRoot: TMP_KIT, projectRoot: TMP_PROJECT }),
    (err) => {
      assert.equal(err.code, 'EMANIFESTMISMATCH');
      assert.match(err.message, /kit manifest mismatch/);
      return true;
    }
  );
});
```

**Crítico — manuseio do test/unit/sync.test.js existente:**

O fixture `test/fixtures/sample-kit` precisa de um manifest válido para que os testes `sync.test.js` (que chamam `syncTo` com este fixture) continuem passando após Task 3 ser deployada.

Duas opções:

**Opção A — Gerar manifest no fixture:** rodar inline antes/depois (escolher). Esta é a abordagem mais limpa. Adicionar passo no Task 4: rodar regen on `test/fixtures/sample-kit/` igual ao Task 1 (mas sobre fixture). Manifest fica commitado junto.

**Opção B — Setar `KIT_MCP_SKIP_MANIFEST_CHECK=1` em sync.test.js setup:** modifica testes existentes; mais invasivo.

**Escolha: A.** Mais correto (testa todo o fluxo incluindo manifest verify). Adicionar como sub-step desta task:

```bash
node -e "
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const kitRoot = path.resolve('test/fixtures/sample-kit');
const out = { version: 'fixture', timestamp: new Date().toISOString(), files: {} };
function walk(dir, prefix='') {
  for (const e of fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    const rel = prefix ? prefix+'/'+e.name : e.name;
    if (e.isDirectory()) walk(abs, rel);
    else if (e.isFile() && rel !== 'file-manifest.json') {
      out.files[rel] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    }
  }
}
walk(kitRoot);
fs.writeFileSync(path.join(kitRoot, 'file-manifest.json'), JSON.stringify(out, null, 2)+'\n');
console.log('fixture manifest:', Object.keys(out.files).length, 'files');
"
```

Adicionar ao git stage. Os testes `sync.test.js` agora rodam com manifest válido — zero regression.

POR QUÊ não usar `KIT_MCP_SKIP_MANIFEST_CHECK=1` no test setup geral:
- Esconderia regressions reais — se algum dia o sample-kit ficar stale, queremos saber.
- Skip env é "usuário sabe o que está fazendo" (dev workflow), não "CI bypass blanket".

Implementar conforme CONTEXT.md `<specifics>` "Test pattern manifest: integration test cria temp kit/ dir com manifest, modifica 1 arquivo, chama syncTo, assert error".
  </action>
  <verify>
    <automated>node --test test/unit/manifest-verify.test.js test/unit/sync.test.js 2>&1 | grep -E "^(ok|not ok|# pass|# fail)" | head -20</automated>
  </verify>
  <done>
- Arquivo `test/unit/manifest-verify.test.js` existe com 6 testes.
- `test/fixtures/sample-kit/file-manifest.json` regenerado e commitado.
- `node --test test/unit/manifest-verify.test.js` retorna exit 0 — todos passam.
- `node --test test/unit/sync.test.js` continua passando (zero regression no sample-kit).
- Suite completa `node --test test/unit/ test/integration/` continua verde (222 baseline + 6 novos = 228+).
  </done>
</task>

</tasks>

<verification>
Após todas as tasks:

1. **Manifest principal regenerado:**
   ```bash
   node -e "const m = require('./kit/file-manifest.json'); console.log('entries:', Object.keys(m.files).length, 'version:', m.version)"
   ```
   Saída esperada: entries >= 280, version = package.json version.

2. **verifyManifest funciona em kit/ real:**
   ```bash
   node -e "import('./src/core/manifest-verify.js').then(m => m.verifyManifest('kit')).then(r => console.log(r.ok))"
   ```
   Saída esperada: `true`.

3. **Skip env var:**
   ```bash
   KIT_MCP_SKIP_MANIFEST_CHECK=1 node -e "import('./src/core/manifest-verify.js').then(m => m.verifyManifest('/nonexistent')).then(r => console.log(r.skipped, r.ok))"
   ```
   Saída esperada: `true true` (em stdout) + WARNING em stderr.

4. **syncTo throws em tampered kit:**
   Coberto pelos testes unitários (Task 4 Test 6).

5. **Suite completa:**
   ```bash
   node --test test/unit/ test/integration/ 2>&1 | tail -10
   ```
   Saída esperada: 228+ pass (222 baseline + 6 novos), 0 fail.

6. **Fixture manifest commitado:**
   ```bash
   git status --short test/fixtures/sample-kit/file-manifest.json
   ```
   Deve estar tracked (não untracked) — incluir no commit.
</verification>

<success_criteria>
- SEC-14-05 fechado: manifest verify roda em syncTo install path, throws em mismatch, opt-out via env var.
- Manifest principal `kit/file-manifest.json` regenerado e refletindo realidade (40 hashes corrigidos + 107 entries adicionados).
- Manifest do fixture `test/fixtures/sample-kit/file-manifest.json` regenerado para evitar regressão em sync.test.js.
- 6 testes novos provando: válido aceito; tamper detectado; missing detectado; env var skip + warn; E2E sucesso; E2E throw.
- Suite 222 baseline → 228+ verde.
- API pública preservada: `kit sync install` em workspace legítimo continua funcionando sem mudança visível ao user.
</success_criteria>

<output>
After completion, create `.planning/phases/83-core-filesystem-hardening/83-03-manifest-verify-SUMMARY.md`
</output>
