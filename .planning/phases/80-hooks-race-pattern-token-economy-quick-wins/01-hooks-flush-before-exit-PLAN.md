---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 01
plan_id: 80.01
type: execute
wave: 1
depends_on: []
files_modified:
  - kit/hooks/workflow-guard.js
  - kit/hooks/prompt-guard.js
  - kit/hooks/context-monitor.js
  - kit/hooks/post-apply-migration.js
  - kit/hooks/statusline.js
  - kit/hooks/check-update.js
  - test/unit/hooks-flush-race.test.js
autonomous: true
requirements:
  - SEC-13-05
must_haves:
  truths:
    - "Hooks que escrevem em stdout/stderr antes de exit não perdem a saída quando o processo é encerrado"
    - "Cada hook ou (a) recebe fix explícito de flush antes de exit, ou (b) é documentado como não-aplicável com justificativa"
    - "Regression test confirma que pelo menos um hook representativo sobrevive ao encerramento mid-flush"
  artifacts:
    - path: "kit/hooks/workflow-guard.js"
      provides: "Hook PreToolUse com flush garantido antes de process.exit"
    - path: "kit/hooks/prompt-guard.js"
      provides: "Hook PreToolUse com flush garantido antes de process.exit"
    - path: "kit/hooks/context-monitor.js"
      provides: "Hook PostToolUse com flush garantido antes de process.exit"
    - path: "kit/hooks/post-apply-migration.js"
      provides: "Hook PostToolUse com flush garantido antes de process.exit"
    - path: "kit/hooks/statusline.js"
      provides: "Statusline com flush explícito (callback de stdout.write)"
    - path: "kit/hooks/check-update.js"
      provides: "Inspeção documentada — sem mudança se inaplicável"
    - path: "test/unit/hooks-flush-race.test.js"
      provides: "Regression test SEC-13-05 simulando processo killed mid-flush"
      contains: "spawn"
  key_links:
    - from: "kit/hooks/*.js"
      to: "process.exit"
      via: "callback de stdout.write/stderr.write OU await flush antes do exit"
      pattern: "process\\.stdout\\.write\\([^)]+,\\s*\\(\\)\\s*=>"
---

<objective>
Aplicar fix de flush-before-exit aos 6 hooks que ainda têm a mesma classe de
bug latente que motivou o fix v1.12.1 em `sidecar-tool-publisher.js`. O fix
v1.12.1 lidou especificamente com I/O TCP assíncrono; os 6 hooks aqui usam
apenas stdout/stderr/fs sync. A classe do bug é a mesma (saída pode ser
descartada se `process.exit` for chamado antes do buffer ser drenado), mas a
remediação adequada para stdout síncrono é diferente: usar a forma
`process.stdout.write(payload, () => process.exit(0))` em vez de aguardar
eventos de socket TCP.

Purpose: fechar SEC-13-05 — eliminar a janela de drop de eventos quando o
processo do hook é encerrado abruptamente (timeout, SIGTERM do parent,
windowsHide com pipe gargalando). Quando um hook deveria emitir
additionalContext (warning de contexto, advisory de prompt injection, aviso
de workflow), a perda silenciosa do payload é equivalente ao hook nunca ter
sido invocado — o que viola a contract de defesa-em-profundidade.

Output:
- 6 hooks editados (ou explicitamente isentados com comentário justificando)
- 1 regression test simulando kill mid-flush em hook representativo
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-CONTEXT.md

# Pattern canônico do fix v1.12.1 (commit 56b327f) — releitura obrigatória
@kit/hooks/sidecar-tool-publisher.js

# Os 6 hooks alvo
@kit/hooks/workflow-guard.js
@kit/hooks/prompt-guard.js
@kit/hooks/context-monitor.js
@kit/hooks/post-apply-migration.js
@kit/hooks/statusline.js
@kit/hooks/check-update.js

# Test runner + pattern de teste regressivo da Phase 79 para inspiração
@test/run.mjs
@test/unit/replays-path-traversal.test.js

# Interfaces:
# Pattern canônico do fix v1.12.1 (sidecar-tool-publisher.js linhas 161-187):
#   const req = http.request({...}, (res) => {
#     res.resume();
#     res.on('end', resolve);
#     res.on('close', resolve);          // <- duplo listener, cobre abort
#   });
#   ...publish(port, event).then(() => process.exit(0));   // <- exit DEPOIS do flush
#
# Para hooks que escrevem APENAS stdout/stderr síncrono (não TCP):
#   process.stdout.write(JSON.stringify(output), () => process.exit(0));
#   process.stderr.write(`...\n`, () => process.exit(0));
#
# A forma com callback garante que o write entrou no kernel buffer antes do
# exit. Sem callback, em pipes lentos (CI/Windows/Git Bash), exit pode ocorrer
# enquanto o buffer ainda está em userspace.
</context>

<tasks>

<task type="auto" id="1">
  <name>Tarefa 1: Inspect each hook and classify (TCP / stdout-write+exit / no-exit / spawn-detached)</name>
  <read_first>
    - kit/hooks/workflow-guard.js (linhas 78-93)
    - kit/hooks/prompt-guard.js (linhas 78-95)
    - kit/hooks/context-monitor.js (linhas 144-155)
    - kit/hooks/post-apply-migration.js (linhas 106-119)
    - kit/hooks/statusline.js (linhas 109-119)
    - kit/hooks/check-update.js (todo o arquivo — usa spawn detached)
    - kit/hooks/sidecar-tool-publisher.js (linhas 161-187 — pattern v1.12.1 canônico)
  </read_first>
  <files>kit/hooks/workflow-guard.js, kit/hooks/prompt-guard.js, kit/hooks/context-monitor.js, kit/hooks/post-apply-migration.js, kit/hooks/statusline.js, kit/hooks/check-update.js</files>
  <action>
  Não modifique código nesta tarefa — apenas classifique e documente. Crie
  um arquivo temporário de planejamento mental (não commitado) classificando
  cada um dos 6 hooks em UMA destas 4 categorias:

  **Categoria A (stdout-write + immediate exit):** hook chama
  `process.stdout.write(...)` ou `process.stderr.write(...)` na saída do
  caminho feliz e em seguida `process.exit(0)` (explícito ou implícito por
  fim do callback). Fix: trocar para forma com callback
  `process.stdout.write(x, () => process.exit(0))`.

  **Categoria B (apenas process.exit, sem write):** caminhos de early-exit
  que não escrevem nada (apenas `process.exit(0)` sem write antes). Estes
  NÃO precisam de fix — não há buffer para drenar.

  **Categoria C (sem process.exit):** hook que termina naturalmente sem
  chamar process.exit. Fix: garantir que último write seja com callback ou
  permitir o término natural (que já flush). statusline.js cai aqui.

  **Categoria D (TCP/HTTP assíncrono):** já recebeu fix v1.12.1 — pular.
  Apenas sidecar-tool-publisher.js cai aqui (não está no scope desta tarefa).

  **Categoria E (spawn detached child):** check-update.js — o hook pai
  retorna imediatamente após `child.unref()`. O child writeará via
  `fs.writeFileSync` (sync). Não há race no parent. Documentar como
  isento com comentário inline.

  Classificação esperada (verifique você mesmo lendo o código):
  - workflow-guard.js: A no caminho com warning (linha 89), B nos early-exits
  - prompt-guard.js: A no caminho com warning (linha 91), B nos early-exits
  - context-monitor.js: A no caminho com warning (linha 151), B nos early-exits
  - post-apply-migration.js: A nos process.stderr.write das linhas 71/87/92/100/112, A no exit final (linha 115)
  - statusline.js: C — não chama process.exit, escreve uma vez na linha 112 ou 114 e termina natural
  - check-update.js: E — spawn detached, nada a fazer no parent

  Output desta tarefa: comentário em forma de comment block no INÍCIO de cada
  hook documentando a categoria, ex:
    // SEC-13-05: flush-before-exit category = A (stdout.write + immediate exit)
    // Fix applied: process.stdout.write(payload, () => process.exit(0)) below.
  Para Categoria B/C/E, comente:
    // SEC-13-05: flush-before-exit category = B (no buffered write before exit) — no fix needed
    // SEC-13-05: flush-before-exit category = C (no process.exit, natural termination flushes) — no fix needed
    // SEC-13-05: flush-before-exit category = E (parent returns after spawn unref; child uses sync fs writes) — no fix needed
  </action>
  <acceptance_criteria>
    Cada um dos 6 hooks DEVE conter exatamente uma linha começando com
    `// SEC-13-05: flush-before-exit category =` no top do arquivo (após o
    shebang e o `// hook-version:`). Verificar:

    ```bash
    grep -c "^// SEC-13-05: flush-before-exit category =" kit/hooks/workflow-guard.js kit/hooks/prompt-guard.js kit/hooks/context-monitor.js kit/hooks/post-apply-migration.js kit/hooks/statusline.js kit/hooks/check-update.js
    ```
    Deve retornar 6 linhas, cada uma com `:1` no final (uma ocorrência por
    arquivo).

    Adicionalmente, exit code 0 e cada categoria documentada deve ser uma
    de: A, B, C, ou E. Verificar:

    ```bash
    grep -hE "^// SEC-13-05: flush-before-exit category = [ABCE]" kit/hooks/workflow-guard.js kit/hooks/prompt-guard.js kit/hooks/context-monitor.js kit/hooks/post-apply-migration.js kit/hooks/statusline.js kit/hooks/check-update.js | wc -l
    ```
    Deve retornar exatamente 6.
  </acceptance_criteria>
  <done>Cada hook tem comentário SEC-13-05 declarando sua categoria; classificação consistente com análise de código.</done>
</task>

<task type="auto" id="2">
  <name>Tarefa 2: Apply Categoria A fix to workflow-guard.js, prompt-guard.js, context-monitor.js</name>
  <read_first>
    - kit/hooks/workflow-guard.js (linhas 78-93 atual; alvo: linha 89)
    - kit/hooks/prompt-guard.js (linhas 78-95 atual; alvo: linha 91)
    - kit/hooks/context-monitor.js (linhas 144-155 atual; alvo: linha 151)
  </read_first>
  <files>kit/hooks/workflow-guard.js, kit/hooks/prompt-guard.js, kit/hooks/context-monitor.js</files>
  <action>
  Em cada um dos 3 hooks, localizar a linha que chama
  `process.stdout.write(JSON.stringify(output));` e substituir pela forma
  com callback que aguarda flush antes do exit:

  **kit/hooks/workflow-guard.js** — substituir bloco final (a partir da
  linha 88 atual) por:
  ```js
      // SEC-13-05: aguardar flush do stdout antes de retornar implicitamente.
      // Sem o callback, em pipes lentos o JSON pode ser dropado quando o
      // process termina antes do kernel drenar o buffer.
      process.stdout.write(JSON.stringify(output), () => {
        process.exit(0);
      });
  ```
  Note: o hook atualmente NÃO chama `process.exit(0)` após o write — o
  process termina naturalmente quando o callback do `'end'` event do stdin
  retorna. Adicionar exit explícito dentro do callback de write garante que
  (a) o write completou, (b) o exit é determinístico.

  **kit/hooks/prompt-guard.js** — mesma substituição na linha equivalente
  (linha 91 atual).

  **kit/hooks/context-monitor.js** — mesma substituição na linha equivalente
  (linha 151 atual).

  NÃO modificar os early-exits que retornam sem write (Categoria B) — esses
  permanecem `process.exit(0)` sem mudança.

  Bump do `// hook-version:` em cada um dos 3 arquivos: de `1.30.0` para
  `1.30.1` (signaling de mudança que deve disparar `stale_hooks` no
  check-update.js para forçar `/atualizar`).
  </action>
  <acceptance_criteria>
    Para cada um dos 3 arquivos, verificar:

    ```bash
    grep -E "process\.stdout\.write\(JSON\.stringify\(output\),\s*\(\)\s*=>" kit/hooks/workflow-guard.js kit/hooks/prompt-guard.js kit/hooks/context-monitor.js
    ```
    Deve retornar 3 linhas (uma por arquivo).

    ```bash
    grep -E "^// hook-version: 1\.30\.1" kit/hooks/workflow-guard.js kit/hooks/prompt-guard.js kit/hooks/context-monitor.js
    ```
    Deve retornar 3 linhas (uma por arquivo).

    Smoke: cada hook ainda parsea como JS válido.
    ```bash
    node -c kit/hooks/workflow-guard.js && node -c kit/hooks/prompt-guard.js && node -c kit/hooks/context-monitor.js
    ```
    Exit code 0.

    Suite de testes existente continua verde (zero regressão):
    ```bash
    npm test
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>3 hooks Categoria A com fix de callback aplicado; hook-version bumped; node -c passa; suite verde.</done>
</task>

<task type="auto" id="3">
  <name>Tarefa 3: Apply Categoria A fix to post-apply-migration.js + Categoria C confirmation for statusline.js + Categoria E doc for check-update.js</name>
  <read_first>
    - kit/hooks/post-apply-migration.js (linhas 106-119 — bloco final + linha 115 onde está process.exit(0))
    - kit/hooks/statusline.js (linhas 109-119 — termina natural sem process.exit)
    - kit/hooks/check-update.js (linhas 108-114 — spawn().unref())
  </read_first>
  <files>kit/hooks/post-apply-migration.js, kit/hooks/statusline.js, kit/hooks/check-update.js</files>
  <action>
  **kit/hooks/post-apply-migration.js (Categoria A):**
  Localizar o `process.exit(0)` final no caminho feliz (linha 115 atual,
  após o bloco que escreve o resumo via `process.stderr.write` na linha
  112). Substituir o bloco a partir da linha 107 (`if (mirroredPath || stubPath) {`)
  até linha 115 (`process.exit(0);`) por:
  ```js
      // SEC-13-05: aguardar flush do stderr antes do exit. Sem callback, o
      // resumo final pode ser dropado em pipes lentos (CI/Windows).
      if (mirroredPath || stubPath) {
        const lines = ['[post-apply-migration] resumo:'];
        if (mirroredPath) lines.push(`  • SQL: ${path.relative(projectRoot, mirroredPath)}`);
        if (stubPath)     lines.push(`  • Stub: ${path.relative(vault, stubPath)}`);
        lines.push('  → cofre Obsidian: edite o stub e commite quando puder.');
        process.stderr.write(lines.join('\n') + '\n', () => process.exit(0));
        return;
      }

      process.exit(0);
  ```
  Os outros `process.stderr.write` (linhas 71, 87, 92, 100) são
  intermediários — o process continua executando após eles, então o flush
  acontece naturalmente quando o event loop processa o write antes do
  próximo. Não modificar esses.

  Bump do `// hook-version:` de `1.4.0` para `1.4.1`.

  **kit/hooks/statusline.js (Categoria C — apenas confirmação):**
  Inspecionar linhas 109-119 (caminho feliz com process.stdout.write).
  Statusline NÃO chama process.exit. O process termina natural quando o
  callback de `'end'` do stdin retorna — Node já espera o flush do stdout
  antes de terminar nesse caso. NÃO modificar comportamento.

  Apenas adicionar comentário inline ANTES do bloco `if (task) {` na linha
  111 atual:
  ```js
      // SEC-13-05: statusline termina naturalmente após este write — Node
      // garante o flush antes do process exit quando não há process.exit
      // explícito. NÃO converter para process.stdout.write(x, callback) +
      // process.exit() — isso introduziria um early-exit que poderia
      // truncar saída em casos onde o write é maior que o buffer do pipe.
  ```

  **kit/hooks/check-update.js (Categoria E — apenas confirmação):**
  Inspecionar linhas 108-114 (spawn detached + unref). O parent process
  termina imediatamente após unref; o child usa `fs.writeFileSync` (sync,
  flushed antes de retornar). Não há race no parent.

  Adicionar comentário inline ANTES da chamada `spawn(...)` na linha 45:
  ```js
  // SEC-13-05: parent process retorna imediatamente após child.unref() —
  // não há buffered I/O no parent. Child usa fs.writeFileSync (sync), sem
  // race. Categoria E na taxonomia da Phase 80.
  ```

  NÃO bumpar hook-version de statusline.js nem check-update.js — o
  comportamento runtime não mudou (apenas comentário).
  </action>
  <acceptance_criteria>
    **post-apply-migration.js:**
    ```bash
    grep -c "process\.stderr\.write(lines\.join.*=> process\.exit(0))" kit/hooks/post-apply-migration.js
    ```
    Deve retornar `1`.

    ```bash
    grep -E "^// hook-version: 1\.4\.1" kit/hooks/post-apply-migration.js
    ```
    Deve retornar 1 linha.

    **statusline.js:**
    ```bash
    grep -c "SEC-13-05: statusline termina naturalmente" kit/hooks/statusline.js
    ```
    Deve retornar `1`.

    Confirmar que NÃO há process.exit() introduzido:
    ```bash
    grep -c "process\.exit" kit/hooks/statusline.js
    ```
    Deve retornar `0`.

    **check-update.js:**
    ```bash
    grep -c "SEC-13-05: parent process retorna imediatamente" kit/hooks/check-update.js
    ```
    Deve retornar `1`.

    Smoke parse:
    ```bash
    node -c kit/hooks/post-apply-migration.js && node -c kit/hooks/statusline.js && node -c kit/hooks/check-update.js
    ```
    Exit code 0.

    Suite continua verde:
    ```bash
    npm test
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>post-apply-migration recebeu fix Cat A; statusline e check-update receberam apenas comentários documentais; node -c passa em todos; suite verde.</done>
</task>

<task type="auto" id="4">
  <name>Tarefa 4: Regression test simulating kill mid-flush on workflow-guard hook</name>
  <read_first>
    - kit/hooks/workflow-guard.js (já editado na Tarefa 2)
    - kit/hooks/sidecar-tool-publisher.js (pattern de referência)
    - test/run.mjs (test runner)
    - test/unit/replays-path-traversal.test.js (estilo de test da Phase 79)
  </read_first>
  <files>test/unit/hooks-flush-race.test.js</files>
  <action>
  Criar arquivo NOVO `test/unit/hooks-flush-race.test.js` com test de
  regressão SEC-13-05. O test escolhe `workflow-guard.js` como hook
  representativo (Categoria A) e valida que:

  (a) o JSON de output chega completo no stdout do child process
  (b) mesmo com payload grande (>4KB) que excede um buffer de pipe típico
  (c) o exit code é 0

  Estratégia (sem mocks de TCP — o hook não usa TCP):
  1. Spawn `node kit/hooks/workflow-guard.js` como child process
  2. Escrever envelope JSON no stdin do child contendo um cenário que
     dispara o warning (Write para arquivo fora de .planning/, com config
     habilitando workflow_guard)
  3. Capturar o stdout completo do child até o `'end'` event do stream
  4. Asserir que o stdout começa com `{"hookSpecificOutput":` e termina
     com `}` (JSON completo, não truncado)
  5. Asserir exit code 0
  6. Repetir 3 vezes para detectar flakiness

  Setup: criar projeto temporário em tmpdir com `.planning/config.json`
  contendo `{"hooks":{"workflow_guard":true}}` — isso é necessário para
  que o hook chegue ao caminho que escreve warning.

  Código completo do arquivo (substituir todo o conteúdo se já existir):

  ```js
  // SEC-13-05: regression test for hook flush-before-exit fix.
  // Pattern v1.12.1 (sidecar-tool-publisher) addressed TCP I/O. The 6 hooks
  // touched in Phase 80 use stdout/stderr only — fix is process.stdout.write
  // with callback before process.exit. This test validates that the JSON
  // payload arrives complete and not truncated, even for a payload that
  // exceeds typical pipe buffer sizes.

  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
  import { tmpdir } from 'node:os';
  import path from 'node:path';
  import { spawn } from 'node:child_process';
  import { fileURLToPath } from 'node:url';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, '..', '..');
  const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'workflow-guard.js');

  async function tmpProject() {
    const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-hook-flush-test-'));
    await mkdir(path.join(root, '.planning'), { recursive: true });
    await writeFile(
      path.join(root, '.planning', 'config.json'),
      JSON.stringify({ hooks: { workflow_guard: true } }),
      'utf8',
    );
    return root;
  }

  function runHook(envelope) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [HOOK_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
      child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(JSON.stringify(envelope));
    });
  }

  test('SEC-13-05: workflow-guard flushes JSON payload before exit', async () => {
    const root = await tmpProject();
    try {
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: path.join(root, 'src', 'foo.ts'), content: 'x'.repeat(50) },
        cwd: root,
        session_id: 'flush-test-1',
      };

      // Run 3 times to detect flakiness (race conditions are intermittent)
      for (let i = 0; i < 3; i++) {
        const { code, stdout } = await runHook(envelope);
        assert.equal(code, 0, `iteration ${i}: expected exit 0, got ${code}`);
        assert.ok(stdout.startsWith('{"hookSpecificOutput":'), `iteration ${i}: stdout did not start with expected JSON prefix; got: ${stdout.slice(0, 80)}`);
        assert.ok(stdout.trim().endsWith('}'), `iteration ${i}: stdout did not end with closing brace; got tail: ${stdout.slice(-80)}`);
        // Validate JSON parses cleanly
        const parsed = JSON.parse(stdout);
        assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
        assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string');
        assert.ok(parsed.hookSpecificOutput.additionalContext.length > 100);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('SEC-13-05: workflow-guard handles large file_path without truncation', async () => {
    const root = await tmpProject();
    try {
      // Build a file_path that, when interpolated into the warning message,
      // pushes the JSON payload above 4KB (typical pipe buffer threshold).
      const longSegment = 'a'.repeat(200);
      const longPath = path.join(root, longSegment, longSegment, longSegment, longSegment, longSegment, 'file.ts');
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: longPath, content: 'x' },
        cwd: root,
        session_id: 'flush-test-large',
      };

      const { code, stdout } = await runHook(envelope);
      assert.equal(code, 0);
      // Must be valid JSON — proves no truncation
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('SEC-13-05: hooks flush-before-exit pattern documented in all 6 hooks', async () => {
    // Static check: every Phase 80 hook MUST declare its category in a
    // top-of-file comment. Prevents silent regression where someone adds
    // a new write+exit path without categorizing.
    const fs = await import('node:fs/promises');
    const targets = [
      'kit/hooks/workflow-guard.js',
      'kit/hooks/prompt-guard.js',
      'kit/hooks/context-monitor.js',
      'kit/hooks/post-apply-migration.js',
      'kit/hooks/statusline.js',
      'kit/hooks/check-update.js',
    ];
    for (const rel of targets) {
      const content = await fs.readFile(path.join(REPO_ROOT, rel), 'utf8');
      const match = content.match(/^\/\/ SEC-13-05: flush-before-exit category = ([ABCE])/m);
      assert.ok(match, `${rel}: missing SEC-13-05 category comment`);
      assert.ok(['A', 'B', 'C', 'E'].includes(match[1]), `${rel}: invalid category ${match[1]}`);
    }
  });
  ```

  IMPORTANTE: este test só pode rodar APÓS as Tarefas 1, 2, 3 terem
  alterado os hooks (instala os comentários SEC-13-05 e o callback de
  flush). Se o test falhar com "missing SEC-13-05 category comment", isso
  é diagnóstico de Tarefa 1 incompleta.
  </action>
  <acceptance_criteria>
    Arquivo existe:
    ```bash
    test -f test/unit/hooks-flush-race.test.js
    ```

    Test passa:
    ```bash
    node --test test/unit/hooks-flush-race.test.js
    ```
    Exit code 0; output contém `# pass 3` (3 testes passaram).

    Test é integrado ao test runner padrão:
    ```bash
    npm test 2>&1 | grep -c "hooks-flush-race"
    ```
    Deve retornar valor ≥1 (referência ao test no output do runner).

    Suite completa verde:
    ```bash
    npm test
    ```
    Exit code 0; total de testes ≥123 (120 baseline + 3 novos da Phase 80).
  </acceptance_criteria>
  <done>Arquivo de regression test criado; 3 testes passam; suite verde com 3 testes a mais que o baseline da Phase 79.</done>
</task>

</tasks>

<verification>
Para SEC-13-05 estar fechado, todos os 4 critérios DEVEM ser verdade:

1. `grep -c "^// SEC-13-05:" kit/hooks/*.js` retorna 7 (6 hooks + sidecar referenciado).
2. `node --test test/unit/hooks-flush-race.test.js` exit code 0.
3. `npm test` exit code 0 com ≥123 testes.
4. `grep -rE "process\.stdout\.write\(JSON.*=> process\.exit\(0\)\)" kit/hooks/` retorna ≥3 ocorrências (workflow-guard, prompt-guard, context-monitor).
</verification>

<success_criteria>
- Cada um dos 6 hooks declara explicitamente sua categoria SEC-13-05 (A/B/C/E)
- 3 hooks Categoria A (workflow-guard, prompt-guard, context-monitor) têm fix de callback aplicado
- 1 hook Categoria A (post-apply-migration) tem fix de callback no caminho feliz
- 2 hooks Categoria C/E (statusline, check-update) têm justificativa documentada
- Regression test SEC-13-05 (3 cases) integrado e verde
- Suite de testes mantém zero regressão (≥120 unit baseline + 3 novos = ≥123)
- Hook-versions bumped onde comportamento runtime mudou (workflow-guard 1.30.0→1.30.1, prompt-guard 1.30.0→1.30.1, context-monitor 1.30.0→1.30.1, post-apply-migration 1.4.0→1.4.1)
</success_criteria>

<output>
After completion, create `.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-01-SUMMARY.md` with:
- Categoria de cada hook + justificativa
- Diff resumido das mudanças
- Output do test run mostrando 3 cases passando
- Lista de hook-versions bumped
</output>
