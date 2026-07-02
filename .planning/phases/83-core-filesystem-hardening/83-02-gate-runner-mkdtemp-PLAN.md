---
phase: 83-core-filesystem-hardening
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/gate-runner.js
  - test/unit/gate-runner-tmpdir.test.js
autonomous: true
requirements:
  - SEC-14-04

must_haves:
  truths:
    - "gate-runner cria diretório tmp único per-run via fs.mkdtemp (nome random crypto-safe)"
    - "Script é escrito DENTRO do diretório único, não no /tmp pelado"
    - "Symlink TOCTOU não funciona — atacante não pode pré-criar diretório com nome predicted (mkdtemp gera random)"
    - "Cleanup recursive em finally — diretório removido mesmo se script ou spawn der erro"
    - "Suite de gates existente continua passando (verdict mapping, exit codes, manual gates inalterados)"
  artifacts:
    - path: "src/core/gate-runner.js"
      provides: "execScript() usa mkdtemp + cleanup recursive em vez de Date.now+Math.random"
      contains: "mkdtemp"
    - path: "test/unit/gate-runner-tmpdir.test.js"
      provides: "regressão SEC-14-04 — symlink TOCTOU + cleanup error path + name não-predictable"
      contains: "SEC-14-04"
  key_links:
    - from: "src/core/gate-runner.js execScript"
      to: "node:fs/promises mkdtemp + rm"
      via: "fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-')) + fs.rm({recursive,force}) em finally"
      pattern: "mkdtemp.*kit-gate"
    - from: "test/unit/gate-runner-tmpdir.test.js"
      to: "src/core/gate-runner.js runGate"
      via: "exec real de gate fixture e inspeção de tmpdir/lifecycle"
      pattern: "runGate.*shell-pass"
---

<objective>
Fechar SEC-14-04 — `gate-runner.js:137-138` usa `path.join(os.tmpdir(), \`kit-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.sh\`)` para o script tmp do gate. `Math.random()` não-crypto + filename baseado em timestamp+rand parcial torna o path predictable; em multi-user `/tmp` (Linux/macOS shared CI runners), atacante pré-cria symlink no path predicted apontando para arquivo arbitrário ANTES do `fs.writeFile`. `writeFile mode 0o700` aplica só a NOVOS arquivos; symlink já existente não é sobrescrito (na maioria das semânticas de `writeFile`, escreve no target do link). `spawn(bash, [tmp])` então executa o conteúdo do target.

Substituir por `fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'))` (diretório único per-run com nome random crypto-safe + permissão 0700 derivada da umask), escrever o script DENTRO, e fazer cleanup recursive em finally.

Purpose: Fecha o vetor symlink-TOCTOU em filesystems compartilhados sem mudar a interface pública de `runGate` ou o behavior dos verdict mappings.

Output: `execScript` reescrito, diretório-único safe, cleanup garantido, 3 regression tests provando o gate.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/83-core-filesystem-hardening/83-CONTEXT.md
@src/core/gate-runner.js
@test/unit/gates.test.js

<interfaces>
## Contratos extraídos da codebase

### src/core/gate-runner.js execScript — bloco a substituir (linhas 134-156)

```js
async function execScript(script, cwd) {
  // Write to a temp file and run with bash. We don't try to inline -c because
  // the scripts can be multiline and contain quoting we'd have to escape.
  const tmp = path.join(os.tmpdir(), `kit-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`);
  await fs.writeFile(tmp, script, { encoding: 'utf8', mode: 0o700 });
  try {
    const child = spawn('bash', [tmp], { cwd, env: process.env });
    const stdout = [], stderrOut = [];
    child.stdout.on('data', (b) => stdout.push(b));
    child.stderr.on('data', (b) => stderrOut.push(b));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', (e) => reject(new Error(`failed to spawn bash: ${e.message}. Install Git Bash or WSL on Windows.`)));
      child.on('close', resolve);
    });
    return {
      exitCode: exitCode ?? -1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderrOut).toString('utf8'),
    };
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}
```

### Pattern de teste — test/unit/gates.test.js (já existe, fixture pattern)

Cria gates fixture em `TMP_GATES = await fs.mkdtemp(...)`, escreve `shell-pass.md` etc., chama `runGate(id, { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} })`. Padrão de cleanup já estabelecido.

### Phase 79.01 guard preservado

`src/mcp-server/index.js handleGates` (linha 218-234) já recusa `gates.run` via MCP. Esta phase NÃO toca aquele guard — só muda HOW o tmp file é criado quando a CLI legítima invoca `runGate` via `bin/cli.js → kit gates run <id>`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Substituir execScript por mkdtemp + cleanup recursive</name>
  <files>src/core/gate-runner.js</files>
  <action>
Reescrever apenas a função `execScript` (linhas 134-156 do arquivo atual). Imports no topo (`import fs from 'node:fs/promises'`, `import os`, `import path`, `spawn`) já estão presentes — não adicionar nada.

Nova implementação:

```js
async function execScript(script, cwd) {
  // SEC-14-04: use mkdtemp for crypto-safe random directory naming, write the
  // script INSIDE it, then cleanup recursive. Date.now()+Math.random() filenames
  // are predictable in multi-user /tmp — attacker can pre-create a symlink at
  // the predicted path before fs.writeFile and `spawn(bash, [tmp])` would
  // execute the symlink target. mkdtemp uses the OS-level mkdtemp(3) syscall
  // (POSIX) / equivalent (Windows) which atomically creates a directory with
  // a random suffix and returns the actual path. The new dir gets 0700 from
  // process umask on POSIX (umask 022 → 0700; default Node runtime). Even if
  // umask is permissive, the script file inside is written with mode 0o700.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'));
  const tmp = path.join(dir, 'gate.sh');
  await fs.writeFile(tmp, script, { encoding: 'utf8', mode: 0o700 });
  try {
    const child = spawn('bash', [tmp], { cwd, env: process.env });
    const stdout = [], stderrOut = [];
    child.stdout.on('data', (b) => stdout.push(b));
    child.stderr.on('data', (b) => stderrOut.push(b));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', (e) => reject(new Error(`failed to spawn bash: ${e.message}. Install Git Bash or WSL on Windows.`)));
      child.on('close', resolve);
    });
    return {
      exitCode: exitCode ?? -1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderrOut).toString('utf8'),
    };
  } finally {
    // Recursive cleanup — even if spawn errored above, the dir gets removed.
    // force:true swallows ENOENT (e.g. if script self-deleted). recursive:true
    // walks the dir; even if the gate body wrote temp files inside cwd, cwd is
    // separate from `dir` so we won't blast user files.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
```

POR QUÊ esse design (ver CONTEXT.md `<decisions>` "SEC-14-04"):
- **mkdtemp em vez de path.join+writeFile:** `mkdtemp(3)` é atomic — kernel garante que o dir é NOVO (EEXIST se atacante venceu a corrida, em cujo caso mkdtemp retry com novo random suffix internamente). Atacante NÃO PODE pré-criar dir com nome `kit-gate-XXXXXX` porque os 6 últimos chars são random crypto-safe (Node delega para libc mkdtemp ou equivalente Windows que usa CryptGenRandom).
- **Script DENTRO do dir único, não no /tmp pelado:** mesmo que algo crie symlink dentro do dir mkdtemp depois (improvável — só o user owner tem acesso por 0700), `gate.sh` é a primeira coisa escrita e mkdtemp acabou de criar o dir limpo. Janela de race fechada.
- **Cleanup recursive:** se gate body criar arquivos dentro do `cwd` (que é `projectRoot`, não `dir`), não removemos. Se gate body criar arquivos dentro de `dir` (improvável — gate scripts não conhecem `dir`), removemos juntos. force:true cobre cleanup-on-error.
- **POR QUÊ não usar `os.tmpdir()` direto sem prefixo:** prefixo `kit-gate-` permite ao user identificar leftovers se cleanup falhar (debug). Sem prefixo, dir aleatório no /tmp é confuso.
- **POR QUÊ não fechar com `await rmdir(dir)`:** `rmdir` falha se dir não vazio; gate scripts podem (improvável) criar arquivos dentro. `rm({recursive,force})` é o pattern Node 14+ para "garbage cleanup".
- **POR QUÊ NÃO usar `os.tmpdir()` substitute como `process.cwd()`:** mudaria semântica — gate é tipicamente fora-de-projeto, e mistura com cwd é exatamente o que NÃO queremos.

Não tocar nada além de `execScript`. Toda a lógica de `runShellGate`, `runManualGate`, `mapVerdict`, `parseGateBody`, etc., permanece literal.

Implementar conforme CONTEXT.md `<decisions>` "SEC-14-04 (gate-runner tmpdir)".
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const src = fs.readFileSync('src/core/gate-runner.js','utf8'); const usesMkdtemp = /fs\.mkdtemp\(path\.join\(os\.tmpdir\(\),\s*['\"]kit-gate-['\"]\)\)/.test(src); const removesTmpFile = /Date\.now\(\)|Math\.random\(\)/.test(src); const recursiveCleanup = /fs\.rm\([^)]+recursive[^)]+\)/.test(src); console.log('mkdtemp:', usesMkdtemp, 'no Date/Random:', !removesTmpFile, 'recursive cleanup:', recursiveCleanup); process.exit((usesMkdtemp && !removesTmpFile && recursiveCleanup) ? 0 : 1);"</automated>
  </verify>
  <done>
- `fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'))` presente em `execScript`.
- Strings `Date.now()` e `Math.random()` REMOVIDAS de gate-runner.js (substituídas pelo mkdtemp).
- `fs.rm` com `recursive: true, force: true` em finally.
- Suite existente `node --test test/unit/gates.test.js` continua passando (verdict mapping, exit codes inalterados).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests SEC-14-04 — directory lifecycle + cleanup</name>
  <files>test/unit/gate-runner-tmpdir.test.js</files>
  <behavior>
- Teste 1 (cleanup happy path): roda `runGate('shell-pass', ...)`, snapshota `os.tmpdir()` antes/depois, assert que NÃO sobraram dirs `kit-gate-*` após o gate completar com exit 0.
- Teste 2 (cleanup em error path): roda gate cujo script é `exit 42` (warn ou block depending on blocking flag); after exit não-zero, assert mesma propriedade — dir limpo.
- Teste 3 (random nome — não-predictable): inspecionar a invocação real é difícil (mkdtemp run inside execScript); em vez disso, assert por inspeção do source que `kit-gate-` é prefix-só (não inclui Date.now ou Math.random como nome). Já coberto por Task 1 verify, mas aqui asserta também sob test runner para detecção de regressão futura.
- Teste 4 (concurrent runs não colidem): roda DOIS `runGate('shell-pass', ...)` em paralelo (Promise.all); ambos terminam exit 0; assert que ambos retornaram independentemente. Prova que mkdtemp gera names únicos mesmo no mesmo timestamp.
  </behavior>
  <action>
Criar `test/unit/gate-runner-tmpdir.test.js`:

1. Imports: `node:test`, `node:assert/strict`, `node:fs/promises`, `node:path`, `node:os`, `node:fs` (sync para readdirSync), `runGate` de `../../src/core/gate-runner.js`.

2. Setup `beforeEach`: criar `TMP_GATES = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-tmpdir-test-'))` e escrever:
   - `shell-pass.md`: `---\nid: shell-pass\nstage: pre-verify\nblocking: true\n---\n## Check\n\`\`\`bash\nexit 0\n\`\`\`\n`
   - `shell-fail.md`: igual com `exit 42` (blocking:true → verdict=block).

3. Cleanup `afterEach`: `await fs.rm(TMP_GATES, ...)`.

4. Helper que conta dirs `kit-gate-*` em os.tmpdir():
   ```js
   function countKitGateDirs() {
     const sync = require('node:fs');
     return sync.readdirSync(os.tmpdir()).filter(n => /^kit-gate-/.test(n)).length;
   }
   ```
   (Use `import fs from 'node:fs'` no topo + readdirSync; ou via dynamic import. Padronize com pattern existente — `gates.test.js` usa import-only.)

5. **Teste 1 (cleanup happy path):**
   ```js
   test('SEC-14-04: cleanup removes tmp dir after passed gate', async () => {
     const before = countKitGateDirs();
     const r = await runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
     assert.equal(r.verdict, 'passed');
     const after = countKitGateDirs();
     assert.equal(after, before, `expected no leftover kit-gate dirs; before=${before}, after=${after}`);
   });
   ```

6. **Teste 2 (cleanup em error path):**
   ```js
   test('SEC-14-04: cleanup removes tmp dir after failing gate', async () => {
     const before = countKitGateDirs();
     const r = await runGate('shell-fail', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
     assert.equal(r.verdict, 'block');
     assert.equal(r.exitCode, 42);
     const after = countKitGateDirs();
     assert.equal(after, before, 'cleanup must run even on non-zero exit');
   });
   ```

7. **Teste 3 (predictability — source-grep):**
   ```js
   test('SEC-14-04: gate-runner source uses mkdtemp, not Date.now+Math.random', async () => {
     const src = await fs.readFile(new URL('../../src/core/gate-runner.js', import.meta.url), 'utf8');
     assert.match(src, /fs\.mkdtemp\(path\.join\(os\.tmpdir\(\),\s*['"]kit-gate-['"]\)\)/, 'must use mkdtemp with kit-gate- prefix');
     // Within the execScript function specifically (avoid false positives from comments elsewhere)
     const execScriptBlock = src.match(/async function execScript[\s\S]*?\n\}\s*\n/)?.[0] ?? '';
     assert.doesNotMatch(execScriptBlock, /Date\.now\(\)/, 'execScript must NOT use Date.now() for tmp naming');
     assert.doesNotMatch(execScriptBlock, /Math\.random\(\)/, 'execScript must NOT use Math.random() for tmp naming');
   });
   ```

8. **Teste 4 (concurrent runs):**
   ```js
   test('SEC-14-04: concurrent gate runs do not collide on tmp dir', async () => {
     const before = countKitGateDirs();
     const [a, b] = await Promise.all([
       runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} }),
       runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} }),
     ]);
     assert.equal(a.verdict, 'passed');
     assert.equal(b.verdict, 'passed');
     const after = countKitGateDirs();
     assert.equal(after, before, 'both runs must have cleaned up their tmp dirs');
   });
   ```

POR QUÊ esses 4 testes:
- Teste 1+2 cobrem o lifecycle inteiro (success + failure path), provando que finally executou.
- Teste 3 é uma source-grep — protege contra reverter o fix no futuro. Source-grep é defensa forte porque manifest.json não cobre src/ (apenas kit/).
- Teste 4 prova a propriedade fundamental do mkdtemp: dois processos (ou nesse caso, duas async chains) no mesmo ms NÃO colidem. Se voltássemos a Date.now+Math.random, este teste poderia flakar (pequeno risco mas existente). Com mkdtemp é estatisticamente impossível flakar.

Test pattern (CONTEXT.md `<specifics>`) sugere "spawn shell que tenta criar symlink no /tmp matching pattern, then trigger gate-runner — assert symlink target NÃO foi executado". REJEITADO porque:
- Em Windows o teste seria skippable (sem symlinks por padrão).
- Em Linux/macOS o teste é frágil — depende do timing race.
- Os 4 testes acima provam a MESMA propriedade (path não-predictable + cleanup robusto) sem a fragilidade. Source-grep + concurrency-test é defensa estrutural; symlink-attack é defensa por demonstração.

Implementar conforme CONTEXT.md `<specifics>` "Test pattern gate-runner".
  </action>
  <verify>
    <automated>node --test test/unit/gate-runner-tmpdir.test.js 2>&1 | grep -E "^(ok|not ok|# pass|# fail)" | head -20</automated>
  </verify>
  <done>
- Arquivo `test/unit/gate-runner-tmpdir.test.js` existe com 4 testes.
- `node --test test/unit/gate-runner-tmpdir.test.js` retorna exit 0 — todos passam.
- Suite existente `node --test test/unit/gates.test.js` continua passando (zero regression).
  </done>
</task>

</tasks>

<verification>
Após todas as tasks:

1. **Source verifica mkdtemp:**
   ```bash
   grep -n "mkdtemp\|Date.now\|Math.random" src/core/gate-runner.js
   ```
   Saída esperada: linha com `fs.mkdtemp`; **zero ocorrências** de `Date.now` e `Math.random` em `execScript`.

2. **Suite testa cleanup:**
   ```bash
   node --test test/unit/gate-runner-tmpdir.test.js
   ```
   Saída esperada: `pass 4, fail 0`.

3. **Suite existente preservada:**
   ```bash
   node --test test/unit/gates.test.js
   ```
   Saída esperada: pass count = baseline (sem regressão de behavior).

4. **Suite completa:**
   ```bash
   node --test test/unit/ test/integration/ 2>&1 | tail -5
   ```
   Saída esperada: 226+ pass, 0 fail (222 baseline + 4 novos deste plan).
</verification>

<success_criteria>
- SEC-14-04 fechado: gate-runner usa mkdtemp (random crypto-safe), script dentro de dir único, cleanup recursive em finally.
- Symlink TOCTOU vector eliminado (atacante não consegue prever o nome do dir).
- Concurrent runs não colidem (provado por test 4).
- Suite 222 baseline → 226 verde.
- Source-grep gate (test 3) previne regressão futura.
</success_criteria>

<output>
After completion, create `.planning/phases/83-core-filesystem-hardening/83-02-gate-runner-mkdtemp-SUMMARY.md`
</output>
