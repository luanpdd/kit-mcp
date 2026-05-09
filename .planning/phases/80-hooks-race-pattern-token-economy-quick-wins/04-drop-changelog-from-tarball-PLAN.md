---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 04
plan_id: 80.04
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - test/integration/npm-pack-shape.test.js
autonomous: true
requirements:
  - PERF-13-03
must_haves:
  truths:
    - "CHANGELOG.md NÃO aparece no output de `npm pack --dry-run`"
    - "Tarball npm reduzido (estimativa: −79KB conforme auditoria)"
    - "Outros conteúdos (bin/, src/, kit/, gates/, README.md, LICENSE) continuam incluídos"
    - "GitHub releases continuam tendo CHANGELOG completo (não é removido do repo, apenas do publish)"
  artifacts:
    - path: "package.json"
      provides: "files[] sem CHANGELOG.md"
      contains: "files"
    - path: "test/integration/npm-pack-shape.test.js"
      provides: "Integration test PERF-13-03 validando shape do tarball publicado"
  key_links:
    - from: "package.json#files"
      to: "tarball npm"
      via: "convenção npm — files[] determina o que é incluído no publish"
      pattern: "\"files\":"
---

<objective>
Remover `CHANGELOG.md` do array `files[]` de `package.json` para que ele
não seja incluído no tarball npm publicado. CHANGELOG.md é (a) um
arquivo grande que cresce monotonicamente (atualmente 79KB), (b)
informação histórica que não é necessária em runtime, (c) já está
disponível em GitHub releases e no repositório git para quem precisa.

Manter no `files[]`: `bin/`, `src/`, `kit/`, `gates/`, `README.md`,
`LICENSE`. Remover: `CHANGELOG.md`.

Purpose: PERF-13-03 — diminuir o tamanho de cada `npm install` do
pacote em 79KB, e parar de versionar histórico no tarball que cresce
para sempre. Auditoria estima −79KB × cada install.

Output:
- package.json com files[] enxuto
- Integration test que faz `npm pack --dry-run` e verifica shape
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-CONTEXT.md

# Target principal
@package.json

# Test runner + estilo de testes integration
@test/run.mjs

# Interfaces:
# package.json linhas 13-21 atual:
#   "files": [
#     "bin/",
#     "src/",
#     "kit/",
#     "gates/",
#     "README.md",
#     "CHANGELOG.md",     ← REMOVER esta linha
#     "LICENSE"
#   ],
#
# Após edição:
#   "files": [
#     "bin/",
#     "src/",
#     "kit/",
#     "gates/",
#     "README.md",
#     "LICENSE"
#   ],
#
# Atenção à vírgula trailing — JSON não permite. Linha de "README.md"
# permanece com vírgula; "LICENSE" continua sem vírgula (era última,
# vai continuar sendo).
</context>

<tasks>

<task type="auto" id="1">
  <name>Tarefa 1: Remove CHANGELOG.md from package.json files[] array</name>
  <read_first>
    - package.json (linhas 13-21 — array files atual)
  </read_first>
  <files>package.json</files>
  <action>
  Editar `package.json` removendo a linha `"CHANGELOG.md"` do array
  `files[]`.

  Usar Edit tool com:

  **old_string:**
  ```
    "files": [
      "bin/",
      "src/",
      "kit/",
      "gates/",
      "README.md",
      "CHANGELOG.md",
      "LICENSE"
    ],
  ```

  **new_string:**
  ```
    "files": [
      "bin/",
      "src/",
      "kit/",
      "gates/",
      "README.md",
      "LICENSE"
    ],
  ```

  IMPORTANTE: a indentação no arquivo atual é 2 spaces. Verificar o
  arquivo lido antes para garantir match exato (Edit tool falha se não
  bater exato). Se a indentação for diferente do esperado, ajustar.

  NÃO bumpar version do package.json — esta mudança é shipped junto com
  o próximo release de v1.13 quando ele acontecer; bumpar version é
  responsabilidade do workflow de release, não desta phase.
  </action>
  <acceptance_criteria>
    CHANGELOG.md NÃO aparece em files[]:
    ```bash
    node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).files.join(','))"
    ```
    Output não deve conter "CHANGELOG".

    package.json continua sendo JSON válido:
    ```bash
    node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
    ```
    Exit code 0.

    files[] tem exatamente 6 entradas (perdeu uma das 7 originais):
    ```bash
    node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).files.length)"
    ```
    Output: `6`.

    `npm pack --dry-run` não menciona CHANGELOG no output:
    ```bash
    npm pack --dry-run 2>&1 | grep -c "CHANGELOG.md"
    ```
    Output: `0`.

    `npm pack --dry-run` AINDA menciona os outros incluídos:
    ```bash
    npm pack --dry-run 2>&1 | grep -E "(README\.md|LICENSE|package\.json)" | wc -l
    ```
    Output: ≥3.

    Suite continua verde:
    ```bash
    npm test
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>CHANGELOG.md removido de files[]; npm pack dry-run não inclui CHANGELOG; demais arquivos preservados; suite verde.</done>
</task>

<task type="auto" id="2">
  <name>Tarefa 2: Integration test validating npm pack shape</name>
  <read_first>
    - package.json (estado pós-Tarefa 1)
    - test/integration/cli-roundtrip.test.js (estilo de integration test existente)
  </read_first>
  <files>test/integration/npm-pack-shape.test.js</files>
  <action>
  Criar `test/integration/npm-pack-shape.test.js`:

  ```js
  // PERF-13-03: integration test validating that npm pack --dry-run produces
  // a tarball without CHANGELOG.md, while preserving all other expected
  // contents (bin/, src/, kit/, gates/, README.md, LICENSE, package.json).
  //
  // Why integration: this test invokes the actual `npm pack` binary so it
  // reflects what would land on registry.npmjs.org if we ran `npm publish`
  // right now. Anti-regression for v1.13+ — if anyone re-adds CHANGELOG.md
  // to files[], this test fails and forces the author to justify it.

  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { spawnSync } from 'node:child_process';
  import { readFile } from 'node:fs/promises';
  import path from 'node:path';
  import { fileURLToPath } from 'node:url';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, '..', '..');

  function npmPackDryRun() {
    // npm pack --dry-run --json produces machine-readable output with the
    // exact list of files that would be in the tarball.
    const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      throw new Error(`npm pack failed (exit ${result.status}): ${result.stderr}`);
    }
    // npm prints JSON to stdout — parse the FIRST top-level array.
    const parsed = JSON.parse(result.stdout);
    // Output is array of one object per package (npm pack supports workspaces).
    assert.ok(Array.isArray(parsed) && parsed.length >= 1, 'expected JSON array from npm pack');
    return parsed[0];
  }

  test('PERF-13-03: tarball does NOT include CHANGELOG.md', () => {
    const pkg = npmPackDryRun();
    const files = pkg.files.map((f) => f.path);
    const offenders = files.filter((p) => /CHANGELOG\.md$/i.test(p));
    assert.deepEqual(
      offenders,
      [],
      `Tarball includes banned files (PERF-13-03 regression): ${offenders.join(', ')}`,
    );
  });

  test('PERF-13-03: tarball still includes core surfaces (bin/, src/, kit/, gates/)', () => {
    const pkg = npmPackDryRun();
    const files = pkg.files.map((f) => f.path);

    const requiredPrefixes = ['bin/', 'src/', 'kit/', 'gates/'];
    for (const prefix of requiredPrefixes) {
      const matches = files.filter((p) => p.startsWith(prefix));
      assert.ok(
        matches.length > 0,
        `Tarball missing required prefix "${prefix}". Files: ${files.slice(0, 10).join(', ')}...`,
      );
    }
  });

  test('PERF-13-03: tarball includes README.md, LICENSE, package.json', () => {
    const pkg = npmPackDryRun();
    const files = pkg.files.map((f) => f.path);

    const required = ['README.md', 'LICENSE', 'package.json'];
    for (const rel of required) {
      assert.ok(
        files.includes(rel),
        `Tarball missing required file "${rel}". Files in root: ${files.filter((f) => !f.includes('/')).join(', ')}`,
      );
    }
  });

  test('PERF-13-03: package.json files[] does not contain CHANGELOG entry', async () => {
    // Defensive: even if npm pack changed semantics, the source of truth
    // (package.json) must not declare CHANGELOG.
    const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    assert.ok(Array.isArray(pkg.files), 'package.json must declare files[]');
    const offenders = pkg.files.filter((f) => /CHANGELOG/i.test(f));
    assert.deepEqual(
      offenders,
      [],
      `package.json files[] still references CHANGELOG: ${offenders.join(', ')}`,
    );
  });
  ```

  Notas para o executor:
  - Este test invoca `npm pack` real, que pode demorar 1-5s. Aceitável
    para integration suite.
  - No Windows, `spawnSync` precisa de `shell: true` para resolver `npm`
    do PATH (npm é um .cmd shim).
  - npm pack --dry-run --json output é estável desde npm 7+ (estamos em
    npm 10+ típico).
  </action>
  <acceptance_criteria>
    Arquivo existe:
    ```bash
    test -f test/integration/npm-pack-shape.test.js
    ```

    Test passa standalone:
    ```bash
    node --test test/integration/npm-pack-shape.test.js
    ```
    Exit code 0; output `# pass 4` (4 testes passaram).

    Suite de integration completa verde:
    ```bash
    npm run test:integration
    ```
    Exit code 0; total ≥71 testes (67 baseline + 4 desta tarefa).

    Suite unit + integration verde:
    ```bash
    npm run test:all
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>4 integration tests passam; suite all-green; npm pack agora tem shape esperado.</done>
</task>

</tasks>

<verification>
Para PERF-13-03 estar fechado:

1. `grep -c "CHANGELOG" package.json` retorna 0 (no array files; package.json em si pode mencionar mas não como entry).

   Mais preciso:
   ```bash
   node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));process.exit(p.files.includes('CHANGELOG.md')?1:0)"
   ```
   Exit 0.

2. `npm pack --dry-run 2>&1 | grep -c CHANGELOG.md` retorna 0.

3. `node --test test/integration/npm-pack-shape.test.js` exit 0 com 4 cases.

4. `npm run test:all` exit 0.

5. CHANGELOG.md em si NÃO foi deletado do filesystem (ainda existe no repo):
   ```bash
   test -f CHANGELOG.md
   ```
   Exit 0.
</verification>

<success_criteria>
- CHANGELOG.md removido de package.json files[]
- `npm pack --dry-run` não inclui CHANGELOG.md no tarball
- Demais conteúdos (bin/, src/, kit/, gates/, README.md, LICENSE, package.json) preservados no tarball
- 4 integration tests passando
- CHANGELOG.md ainda existe no repo (não foi deletado, apenas não publicado)
- Zero regressão em testes existentes
</success_criteria>

<output>
After completion, create `.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-04-SUMMARY.md` with:
- Diff de package.json (1 linha removida)
- Output de `npm pack --dry-run` antes vs depois (mostrar redução de tamanho)
- Output do test mostrando 4 cases passando
- Nota: CHANGELOG.md continua disponível no repositório git e em GitHub releases
</output>
