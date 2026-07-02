---
phase: 83-core-filesystem-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/path-safety.js
  - src/mcp-server/index.js
  - test/unit/mcp-projectroot-guard.test.js
autonomous: true
requirements:
  - SEC-14-03

must_haves:
  truths:
    - "MCP handleSync com projectRoot=\\\\evil-host\\share retorna erro descritivo sem write em disco"
    - "MCP handleSync com projectRoot apontando para AppData ou diretório qualquer sem .git/ retorna erro"
    - "MCP handleSync com projectRoot=workspace contendo .git/ no próprio dir ou ancestral aceita e prossegue"
    - "MCP handleReverseSync (detect E apply) aplica o mesmo guard que handleSync"
    - "CLI continua aceitando qualquer dir (kit sync install <target> sem projectRoot) — Phase 79.01 gates.run guard preservado"
  artifacts:
    - path: "src/core/path-safety.js"
      provides: "validateProjectRoot(projectRoot) helper puro"
      exports: ["validateProjectRoot"]
    - path: "src/mcp-server/index.js"
      provides: "guard chamado em handleSync e handleReverseSync antes do dispatch"
      contains: "validateProjectRoot"
    - path: "test/unit/mcp-projectroot-guard.test.js"
      provides: "regressão SEC-14-03 — UNC, AppData, workspace válido, ancestor .git"
      contains: "SEC-14-03"
  key_links:
    - from: "src/mcp-server/index.js handleSync"
      to: "src/core/path-safety.js validateProjectRoot"
      via: "import + chamada antes de syncTo"
      pattern: "validateProjectRoot\\("
    - from: "src/mcp-server/index.js handleReverseSync"
      to: "src/core/path-safety.js validateProjectRoot"
      via: "import + chamada antes de detectReverse/applyReverse"
      pattern: "validateProjectRoot\\("
    - from: "test/unit/mcp-projectroot-guard.test.js"
      to: "src/mcp-server/index.js handleSync via createServer + tools/call dispatch"
      via: "padrão idêntico ao test/unit/mcp-gates-guard.test.js (server._requestHandlers)"
      pattern: "createServer|_requestHandlers"
---

<objective>
Fechar SEC-14-03 — handlers MCP `handleSync` e `handleReverseSync` aceitam `projectRoot` arbitrário do MCP message; atacante via MCP envia `projectRoot=\\evil-host\share` ou path do AppData, e o server escreve ali com permissões do user. Adicionar guard que valida projectRoot via heurística allowlist (path absoluto + diretório existente + contém `.git/` em si ou em ancestral) antes do dispatch para sync/reverse-sync.

Purpose: Bloquear o vetor de "MCP message escreve em diretório arbitrário do host" sem quebrar o caso legítimo (usuário aponta para um workspace de git). CLI continua aceitando qualquer dir (pattern Phase 79.01 — confiamos em quem invocou bin/cli.js explicitamente).

Output: Helper puro `validateProjectRoot()`, guard chamado em ambos handlers, 4 regression tests provando o gate funciona em UNC, AppData, workspace válido, e ancestral com `.git/`.
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
@src/mcp-server/index.js
@test/unit/mcp-gates-guard.test.js

<interfaces>
## Contratos extraídos da codebase

### src/mcp-server/index.js — handlers a modificar (linha 192-216)

```js
async function handleSync(args) {
  switch (args.action) {
    case 'targets': return listTargets();
    case 'status':  return statusOf(args.target, { projectRoot: args.projectRoot });
    case 'install':
      return withAutoSpawn(args, 'sync.install', (onProgress) =>
        syncTo(args.target, { projectRoot: args.projectRoot, mode: args.mode, dryRun: args.dryRun, onProgress }));
    case 'remove':  return removeFrom(args.target, { projectRoot: args.projectRoot });
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleReverseSync(args) {
  switch (args.action) {
    case 'detect': return detectReverse(args.target, { projectRoot: args.projectRoot });
    case 'apply':
      return withAutoSpawn(args, 'reverse-sync.apply', (onProgress) =>
        applyReverse(args.target, {
          projectRoot: args.projectRoot,
          strategy: args.strategy, only: args.only, dryRun: args.dryRun,
          onProgress,
        }));
    default: return { error: `Unknown action: ${args.action}` };
  }
}
```

### Pattern de teste a seguir — test/unit/mcp-gates-guard.test.js

```js
import { createServer } from '../../src/mcp-server/index.js';
const server = await createServer();
const handlers = server._requestHandlers;
if (!(handlers instanceof Map)) { console.log('skip: SDK internals changed'); return; }
const callHandler = handlers.get('tools/call');
const req = { method: 'tools/call', params: { name: 'sync', arguments: { action: 'install', target: 'claude-code', projectRoot: '\\\\evil-host\\share' } } };
const extra = { signal: new AbortController().signal, sendNotification: async () => {}, sendRequest: async () => ({}), requestId: 1, _meta: {} };
const result = await callHandler(req, extra);
const text = result?.content?.[0]?.text ?? '';
assert.match(text, /MCP sync requires projectRoot to be a git workspace/);
```

### Pattern de validação (do CONTEXT.md)

- Path absoluto E existe (fs.stat resolve) E contém `.git/` em si ou em qualquer ancestral até root
- Senão: erro descritivo `"MCP sync requires projectRoot to be a git workspace; got <projectRoot>"`
- CLI NÃO usa este guard — apenas MCP handlers o invocam
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Helper puro validateProjectRoot em src/core/path-safety.js</name>
  <files>src/core/path-safety.js</files>
  <action>
Criar novo arquivo `src/core/path-safety.js` com export único `validateProjectRoot(projectRoot)` async function.

Implementação:
1. `import path from 'node:path'` e `import fs from 'node:fs/promises'`.
2. Assinatura: `export async function validateProjectRoot(projectRoot)` — retorna `{ ok: true, resolvedPath }` ou `{ ok: false, reason }`. NÃO throw — caller decide como reportar (handlers MCP retornam `{ error }`, não throw).
3. Algoritmo:
   - Se `projectRoot` é null/undefined/'' → `{ ok: false, reason: 'projectRoot is required for MCP sync; pass an absolute path to a git workspace' }`. (Caller decide se usa cwd como fallback OU se rejeita — neste guard rejeitamos, MCP message DEVE explicitar.)
   - `const resolved = path.resolve(projectRoot)` — normaliza separadores.
   - Verifica path absoluto: se `path.isAbsolute(resolved)` é false (improvável após resolve, mas defensivo) → reject.
   - `await fs.stat(resolved)` — se throw (ENOENT, ENOTDIR para UNC indisponível, etc) → `{ ok: false, reason: 'projectRoot does not exist or is unreachable: <path>' }`.
   - Se stat retorna mas `!stat.isDirectory()` → `{ ok: false, reason: 'projectRoot must be a directory: <path>' }`.
   - Walk-up procurando `.git`: `let cur = resolved; while (true) { try { await fs.stat(path.join(cur, '.git')); return { ok: true, resolvedPath: resolved }; } catch {} const parent = path.dirname(cur); if (parent === cur) break; cur = parent; }`.
   - Se walk-up esgotou sem achar .git → `{ ok: false, reason: 'MCP sync requires projectRoot to be a git workspace; got <projectRoot>' }`.

POR QUÊ esse design (e não alternativas):
- Helper retorna `{ok, reason}` em vez de throw porque os handlers MCP padronizam erros como `{ error: <string> }` no envelope (linha 159 e 200 do index.js já retornam `{error: ...}`). Throw exigiria try/catch repetido em cada handler.
- Walk-up até root (em vez de só checar dir direto) cobre o caso edge documentado em CONTEXT.md: monorepo com `.git/` no parent. Não há custo extra: uma stat por nível, e workspaces típicos têm <8 níveis até root.
- `await fs.stat` em UNC `\\evil-host\share` com host inexistente vai timeoutar/EHOSTUNREACH em ms — Node trata como rejection (testado: retorna ENOENT no Windows com host fake). Suficiente para não escrever.
- POR QUÊ não checar contra os outputs de `git rev-parse --show-toplevel`: requer spawn child_process; mais lento e adiciona dependência de `git` no PATH para runtime do MCP. Heurística `.git/` cobre 99% dos casos sem child_process.

Implementar conforme D-decisão de CONTEXT.md `<decisions>` "SEC-14-03 (projectRoot validation)".
  </action>
  <verify>
    <automated>node -e "import('./src/core/path-safety.js').then(m => Promise.all([m.validateProjectRoot(process.cwd()), m.validateProjectRoot('\\\\\\\\evil-host\\\\share'), m.validateProjectRoot('')])).then(r => { console.log(JSON.stringify(r)); process.exit(r[0].ok && !r[1].ok && !r[2].ok ? 0 : 1); })"</automated>
  </verify>
  <done>
- `src/core/path-safety.js` existe com export `validateProjectRoot`.
- Comando de verify retorna exit 0 (cwd ok=true; UNC fake ok=false; vazio ok=false).
- Mensagem de erro para path sem .git contém literal "git workspace" (testes Task 3 dependem disso).
  </done>
</task>

<task type="auto">
  <name>Task 2: Aplicar guard em handleSync e handleReverseSync</name>
  <files>src/mcp-server/index.js</files>
  <action>
Modificar `src/mcp-server/index.js` para aplicar `validateProjectRoot` antes de qualquer dispatch que escreva.

Mudanças:
1. Adicionar import no topo (junto com os outros imports core):
   ```js
   import { validateProjectRoot } from '../core/path-safety.js';
   ```

2. Em `handleSync` (linha 192-202): adicionar guard nos cases que tocam disk (`install`, `remove`, e `status` por consistência — status só lê fs.access, mas defesa-em-profundidade não custa nada):
   ```js
   async function handleSync(args) {
     switch (args.action) {
       case 'targets': return listTargets();
       case 'status':
       case 'install':
       case 'remove': {
         // SEC-14-03: MCP message must specify a path inside a git workspace.
         // CLI bypasses this — bin/cli.js trusts the user who invoked it.
         const guard = await validateProjectRoot(args.projectRoot);
         if (!guard.ok) return { error: guard.reason };
         // continue with original dispatch using guard.resolvedPath
         if (args.action === 'status')  return statusOf(args.target, { projectRoot: guard.resolvedPath });
         if (args.action === 'install')
           return withAutoSpawn({ ...args, projectRoot: guard.resolvedPath }, 'sync.install', (onProgress) =>
             syncTo(args.target, { projectRoot: guard.resolvedPath, mode: args.mode, dryRun: args.dryRun, onProgress }));
         if (args.action === 'remove') return removeFrom(args.target, { projectRoot: guard.resolvedPath });
       }
       default: return { error: `Unknown action: ${args.action}` };
     }
   }
   ```

3. Em `handleReverseSync` (linha 204-216): mesmo pattern, mas para `detect` e `apply`:
   ```js
   async function handleReverseSync(args) {
     switch (args.action) {
       case 'detect':
       case 'apply': {
         // SEC-14-03: same guard as handleSync — MCP can write via reverse-sync apply.
         const guard = await validateProjectRoot(args.projectRoot);
         if (!guard.ok) return { error: guard.reason };
         if (args.action === 'detect') return detectReverse(args.target, { projectRoot: guard.resolvedPath });
         // action === 'apply'
         return withAutoSpawn({ ...args, projectRoot: guard.resolvedPath }, 'reverse-sync.apply', (onProgress) =>
           applyReverse(args.target, {
             projectRoot: guard.resolvedPath,
             strategy: args.strategy, only: args.only, dryRun: args.dryRun,
             onProgress,
           }));
       }
       default: return { error: `Unknown action: ${args.action}` };
     }
   }
   ```

Observações importantes:
- **Preserve a guard de Phase 79.01** em `handleGates` (linha 218-234) — NÃO MODIFICAR. Aquela guarda recusa `gates.run` via MCP por outro motivo (TTY/exec); SEC-14-03 é ortogonal e atua só em sync/reverse-sync.
- **NÃO adicionar guard em `handleForensics`** — ele aceita `projectRoot` (linha 237) mas só lê `.planning/` e escreve replays/learnings dentro dele. Risco menor + mudança de escopo. Phase 84 pode endossar.
- **NÃO adicionar guard em `handleInstall`** — usa `installMcp` que escreve em `~/.claude/`/`~/.cursor/` etc., não em `projectRoot` (que para install é apenas hint). Pattern existente preservado.
- Use `guard.resolvedPath` (path normalizado) em vez de `args.projectRoot` cru daqui pra baixo — defesa contra `..` slip ainda que validação tenha aceitado.
- POR QUÊ unificar todos os cases num único bloco de guard (e não checar antes do switch): preserva o case `targets` que NÃO usa projectRoot e deve continuar respondendo sem args. Centralizar o guard num bloco-cobertura mantém isso.

Implementar conforme D-decisão de CONTEXT.md `<decisions>` "Em src/mcp-server/index.js handlers handleSync e handleReverseSync".
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const src = fs.readFileSync('src/mcp-server/index.js','utf8'); const okHandleSync = /async function handleSync[\s\S]*?validateProjectRoot/.test(src); const okHandleReverse = /async function handleReverseSync[\s\S]*?validateProjectRoot/.test(src); const importOk = /import\s*\{\s*validateProjectRoot\s*\}\s*from\s*['\"]\.\.\/core\/path-safety/.test(src); console.log('handleSync ok:', okHandleSync, 'handleReverseSync ok:', okHandleReverse, 'import ok:', importOk); process.exit((okHandleSync && okHandleReverse && importOk) ? 0 : 1);"</automated>
  </verify>
  <done>
- Import `validateProjectRoot` presente.
- `handleSync` invoca `validateProjectRoot` antes de install/remove/status.
- `handleReverseSync` invoca `validateProjectRoot` antes de detect/apply.
- Phase 79.01 gates.run guard inalterado (`/MCP gates\.run requires interactive TTY/` ainda no source).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Regression tests SEC-14-03</name>
  <files>test/unit/mcp-projectroot-guard.test.js</files>
  <behavior>
- Teste 1 (UNC fake): MCP handleSync com `projectRoot=\\evil-host\share` retorna `error` contendo "git workspace" e NÃO invoca syncTo (verificável via assertion: o resultado não contém `.written` array, que `syncTo` retorna em sucesso).
- Teste 2 (AppData/path sem .git): MCP handleSync com `projectRoot` apontando para um tmpdir (sem .git/) retorna `error` contendo "git workspace".
- Teste 3 (workspace válido — happy path): MCP handleSync com `projectRoot` apontando para tmpdir contendo `.git/` PASSA pelo guard. (Não exigimos que syncTo finalize com sucesso — pode falhar por target=fake — mas o erro retornado NÃO pode ser o sentinel "git workspace"; tem que ser outro erro de syncTo, ou sucesso.)
- Teste 4 (ancestor .git — monorepo): MCP handleSync com `projectRoot=tmpdir/sub/sub2` onde `tmpdir/.git/` existe → guard aceita. Mesmo critério do Teste 3 sobre ausência do sentinel.
- Teste 5 (handleReverseSync detect): mesmo pattern do Teste 1 mas para `name: 'reverse-sync', arguments: { action: 'detect', target: 'claude-code', projectRoot: '\\\\evil-host\\share' }` — retorna error com "git workspace".
- Teste 6 (CLI NÃO afetado): import `validateProjectRoot` direto e prove via teste de unit que NÃO é chamado quando bin/cli.js executa — fazendo grep `import` em `src/cli/index.js` e assertando que `validateProjectRoot` NÃO está presente. (Defensive — Phase 79.01 stable API contract.)
  </behavior>
  <action>
Criar `test/unit/mcp-projectroot-guard.test.js` no mesmo padrão de `test/unit/mcp-gates-guard.test.js`:

1. Imports: `node:test`, `node:assert/strict`, `node:fs/promises`, `node:path`, `node:os`, `createServer` de `../../src/mcp-server/index.js`.

2. Setup `beforeEach`: `TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-pr-guard-'))`.
3. Cleanup `afterEach`: `await fs.rm(TMP, { recursive: true, force: true })`.

4. Helper local (não export):
   ```js
   async function callTool(name, args) {
     const server = await createServer();
     const handlers = server._requestHandlers;
     if (!(handlers instanceof Map)) return { skip: 'sdk-internals-changed' };
     const callHandler = handlers.get('tools/call');
     if (typeof callHandler !== 'function') return { skip: 'sdk-internals-changed' };
     const extra = { signal: new AbortController().signal, sendNotification: async () => {}, sendRequest: async () => ({}), requestId: 1, _meta: {} };
     const result = await callHandler({ method: 'tools/call', params: { name, arguments: args } }, extra);
     return { text: result?.content?.[0]?.text ?? '' };
   }
   ```

5. Os 6 testes conforme `<behavior>`. Para Tests 3 e 4 (happy path), criar `.git/` directory dentro de TMP via `fs.mkdir(path.join(TMP, '.git'), { recursive: true })`. Não precisamos de um repo de verdade — só do diretório `.git` para satisfazer o heurístico. Para Test 4 também criar `path.join(TMP, 'sub', 'sub2')` e usar como projectRoot.

6. Para Tests 3/4 (happy path), assertion principal: `assert.doesNotMatch(text, /git workspace/)`. O syncTo pode falhar com outro erro (target=claude-code não tem dirs criados ainda, ou KIT_MCP_KIT_ROOT inválido); aceitável — o que importa é que o GUARD passou. Use target=`claude-code` (id real do registry para evitar "Unknown target").

7. Para Test 6 (CLI não afetado): leia `src/cli/index.js` via `fs.readFile` e assert `assert.doesNotMatch(content, /validateProjectRoot/)`. Comentário no teste: "Phase 79.01 contract — CLI trusts the invoking user; only MCP transport gets the guard."

POR QUÊ esse padrão (e não chamar syncTo direto):
- Phase 79.01 estabeleceu o pattern em `mcp-gates-guard.test.js` — o guard só faz sentido testado via dispatcher real do MCP, porque é nesse layer que o args.projectRoot chega untrusted. Testar `validateProjectRoot` direto é insuficiente — não prova o wiring.
- Por outro lado, o test do helper puro também é útil (já está em Task 1 verify); este teste foca em integration através do dispatcher.
- POR QUÊ não criar git real (`git init`): adiciona dependência de `git` no PATH do CI (já temos, mas adiciona latência). `mkdir .git` é suficiente para o heurístico — exatamente o ponto da CONTEXT.md de chamar isso de "allowlist heurístico".
- POR QUÊ Test 6: documenta o contract por escrito + previne regressão se alguém em refactor futuro decidir importar `validateProjectRoot` em cli/index.js.
  </action>
  <verify>
    <automated>node --test test/unit/mcp-projectroot-guard.test.js 2>&1 | grep -E "^(ok|not ok|# pass|# fail)" | head -20</automated>
  </verify>
  <done>
- Arquivo `test/unit/mcp-projectroot-guard.test.js` existe com 6 testes.
- `node --test test/unit/mcp-projectroot-guard.test.js` retorna exit 0.
- Suite completa `node --test test/unit/ test/integration/` continua verde (222+ baseline + 6 novos = 228+).
  </done>
</task>

</tasks>

<verification>
Após todas as tasks:

1. **Helper puro:**
   ```bash
   node -e "import('./src/core/path-safety.js').then(m => m.validateProjectRoot(process.cwd())).then(r => console.log(r.ok))"
   ```
   Saída esperada: `true`.

2. **MCP handler bloqueia UNC:** Ver Task 3 verify (test 1).

3. **MCP handler aceita workspace .git:** Ver Task 3 verify (test 3).

4. **CLI inalterado:**
   ```bash
   node -e "const fs = require('fs'); console.log(/validateProjectRoot/.test(fs.readFileSync('src/cli/index.js','utf8')) ? 'FAIL: CLI imports guard' : 'OK')"
   ```

5. **Suite completa:**
   ```bash
   node --test test/unit/ test/integration/ 2>&1 | tail -10
   ```
   Saída esperada: `pass 228+, fail 0` (222 baseline + 6 novos deste plan).
</verification>

<success_criteria>
- SEC-14-03 fechado: MCP message com projectRoot hostil retorna erro descritivo, sem write em disco.
- 4 cenários de teste cobertos (UNC, sem-.git, com-.git direto, com-.git ancestral).
- handleReverseSync também guardado (atacante não consegue contornar via reverse-sync).
- CLI behavior preservado (kit sync install <target> sem projectRoot continua funcionando).
- Suite 222 baseline → 228+ verde.
</success_criteria>

<output>
After completion, create `.planning/phases/83-core-filesystem-hardening/83-01-projectroot-validation-SUMMARY.md`
</output>
