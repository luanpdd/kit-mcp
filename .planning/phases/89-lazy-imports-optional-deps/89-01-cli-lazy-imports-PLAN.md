---
phase: 89-lazy-imports-optional-deps
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/cli/index.js
  - test/unit/cli-cold-start.test.js
autonomous: true
requirements:
  - PERF-16-04

must_haves:
  truths:
    - "Top-level imports de UI sidecar (createServer, wrapProgressForUi, openBrowser) saem de src/cli/index.js — substituídos por dynamic await import() dentro dos handlers que usam"
    - "kit kit list-agents --terse cold start ≥30% mais rápido vs baseline pré-fase (medido via spawnSync com 3 runs e median)"
    - "kit ui start, kit ui open continuam funcionais — dynamic import resolve na primeira invocação do subcommand"
    - "withProgress() lazy-loads wrapProgressForUi APENAS quando uma sidecar lockfile for detectada (caso contrário passthroughWrapper é usado e wrapper.js nem é carregado)"
    - "Imports core que TODO subcommand usa preservados eager — commander, picocolors (via core/ui.js c+icons+spinner+progress), node:fs/path/url"
    - "Nenhuma regressão funcional — todos os 309 testes baseline continuam passing"
    - "Phase 80.02 / 85.01 slim cap em cli/index.js preservado — slim() e slimTerse() inalterados"
  artifacts:
    - path: "src/cli/index.js"
      provides: "CLI entrypoint com lazy imports de UI sidecar"
      contains: "await import"
    - path: "test/unit/cli-cold-start.test.js"
      provides: "Regression test medindo cold start de kit kit list-agents --terse vs threshold absoluto"
      contains: "spawnSync"
  key_links:
    - from: "src/cli/index.js subcommand handlers (ui.start, ui.open, install.write)"
      to: "lazy-loaded modules (../ui/server.js, ../ui/browser.js, ../ui/wrapper.js)"
      via: "await import() dentro do .action() handler"
      pattern: "await import\\(['\"]\\.\\./ui/"
    - from: "src/cli/index.js withProgress()"
      to: "wrapProgressForUi (lazy)"
      via: "await import inside maybeWrapForUi when sidecar lockfile detected"
      pattern: "readLock[\\s\\S]*await import\\(['\"]\\.\\./ui/wrapper"
---

<objective>
Substituir top-level imports de UI sidecar (`createServer` de `src/ui/server.js`, `wrapProgressForUi` de `src/ui/wrapper.js`, `openBrowser` de `src/ui/browser.js`) em `src/cli/index.js` por dynamic `await import()` dentro dos subcommand handlers que efetivamente usam. O objetivo é reduzir o cold start de comandos não-UI (ex: `kit kit list-agents --terse`) em ≥30%, já que esses comandos pagam hoje o custo de carregar 867 LOC de módulos UI (server 547, wrapper 129, lockfile 191) que NUNCA são executados.

Purpose: Endereçar PERF-16-04 (P2 da meta-auditoria v1.12.1) — `kit kit list-agents` paga ~100-200ms cold start carregando o stack UI eagerly, mesmo quando nem precisa de sidecar. Pattern de referência já existe em `src/ui/browser.js` (`await import('open')`) — replicar para o boundary cli↔ui.

Output:
- `src/cli/index.js` com top-level imports `../ui/server.js`, `../ui/wrapper.js`, `../ui/browser.js` removidos. Cada um substituído por dynamic `await import()` dentro do handler do subcommand que usa.
- `test/unit/cli-cold-start.test.js` — regression test que mede `kit kit list-agents --terse` cold start time via `spawnSync` (3 runs, median) e assert vs baseline absoluto registrado em comentário (com margem para flakes de CI).
- `kit ui start`, `kit ui stop`, `kit ui status`, `kit ui open`, `install write` continuam funcionais.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/89-lazy-imports-optional-deps/89-CONTEXT.md
@src/cli/index.js
@src/ui/browser.js
@src/ui/server.js
@src/ui/wrapper.js
@src/ui/lockfile.js

<interfaces>
## Top-level imports atuais em src/cli/index.js (linhas 15-39)

```js
// SEMPRE usado (todo subcommand) — MANTER eager:
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listKit, searchKit, findItem } from '../core/kit.js';
import { listTargets } from '../core/registry.js';
import { syncTo, statusOf, removeFrom, summarize } from '../core/sync.js';
import { watchKit, detectExistingTargets } from '../core/watch.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
import { reflect } from '../core/reflect.js';
import { listReplays, loadReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from '../mcp-server/install.js';
import * as render from './render.js';
import { c, icons, spinner, progress, select, confirm } from '../core/ui.js';
import { checkUpgrade, getLocalVersion } from './upgrade-check.js';
import http from 'node:http';            // builtin — barato; usado por postShutdown/getHealthz
import fs from 'node:fs';                // builtin — barato; usado por doctor
import os from 'node:os';                // builtin — barato; usado por doctor

// LAZY (só usado em subcomandos UI/install/withProgress) — MOVER para dynamic await import():
import { createServer } from '../ui/server.js';                       // só em `kit ui start` (linha 410)
import { readLock, lockPathFor } from '../ui/lockfile.js';            // 547 LOC stack — usado em maybeWrapForUi (todo withProgress chama!), ui.start, ui.stop, ui.status, ui.open, doctor (linhas 547-562)
import { wrapProgressForUi } from '../ui/wrapper.js';                 // só dentro de maybeWrapForUi quando lockfile presente (linha 134)
import { openBrowser } from '../ui/browser.js';                       // só em ui.start (linha 425) e ui.open (linha 483)
```

## Constraint: maybeWrapForUi() é chamado por TODO withProgress()

`withProgress` (linha 96) é usado em `sync install` (linha 211) e `reverse-sync apply` (linha 259). Cada chamada invoca `maybeWrapForUi` (linha 124) que faz `readLock(root)` (linha 131). Se NÃO houver lockfile (caso comum — usuário não rodou `kit ui start`), retorna `passthroughWrapper` SEM precisar de wrapper.js.

**Estratégia:** mover `readLock`/`lockPathFor` (lockfile.js, 191 LOC) para lazy via dynamic import DENTRO de maybeWrapForUi. Se lockfile.js for muito hot (chamado em sync/reverse-sync que SÃO comandos comuns), mantenha lockfile.js eager e mova apenas wrapper.js + server.js + browser.js. Decisão: lockfile.js é 191 LOC sem deps externas pesadas — manter eager. Apenas wrapper.js (129 LOC, importa kit/hooks/sidecar-tool-publisher transitively) + server.js (547 LOC) + browser.js (78 LOC, lazy-loads `open` package) precisam ser lazy.

## Sidecar-detection guard (boundary onde lazy import deve acontecer)

```js
// src/cli/index.js linha 124-135 — MUDAR
function maybeWrapForUi(onProgress, { tool, projectRoot } = {}) {
  const globalOpts = program.opts();
  if (globalOpts.ui === false || process.env.KIT_MCP_NO_UI === '1') {
    return passthroughWrapper(onProgress);
  }
  const root = projectRoot || process.cwd();
  if (!readLock(root)) {
    return passthroughWrapper(onProgress);  // <-- early return, NÃO precisa de wrapper.js
  }
  return wrapProgressForUi(onProgress, { projectRoot: root, tool: tool ?? null });
}
```

Conversão: `maybeWrapForUi` precisa virar `async`, e os call-sites em `withProgress` precisam `await maybeWrapForUi(...)`. `withProgress` JÁ é async, então a mudança é transparente para subcomandos.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move UI sidecar imports to lazy dynamic in src/cli/index.js</name>
  <files>src/cli/index.js</files>
  <action>
Edição cirúrgica em src/cli/index.js. NÃO toque em outras linhas. Preserve TODO o comportamento existente (slim cap PERF-13-01, terse PERF-15-01, sidecar lockfile token SEC-14-02, doctor diagnostics, `--no-ui` opt-out).

**Mudança 1 — Remover top-level imports (linhas 32, 34, 35):**
- Remover `import { createServer } from '../ui/server.js';`
- Remover `import { wrapProgressForUi } from '../ui/wrapper.js';`
- Remover `import { openBrowser } from '../ui/browser.js';`
- MANTER `import { readLock, lockPathFor } from '../ui/lockfile.js';` (linha 33) — lockfile.js é leve (191 LOC, sem deps externas) e é chamado em maybeWrapForUi por TODO withProgress (sync/reverse-sync são paths comuns).

**Mudança 2 — Tornar maybeWrapForUi async + lazy import wrapper:**
- Em `maybeWrapForUi(onProgress, { tool, projectRoot })` (linha 124): adicionar `async` na declaração da função.
- ANTES da linha `return wrapProgressForUi(...)` (linha 134), adicionar:
  ```js
  const { wrapProgressForUi } = await import('../ui/wrapper.js');
  ```
- Em `withProgress` (linha 96-120): mudar `const wrapper = maybeWrapForUi(onProgress, ...)` (linha 109) para `const wrapper = await maybeWrapForUi(onProgress, ...)`.
- POR QUÊ: lazy import só dispara quando o sidecar JÁ está rodando (lockfile presente). Caso comum (sem sidecar) → passthroughWrapper retornado early, wrapper.js nunca carrega.

**Mudança 3 — Lazy import createServer em ui.start handler:**
- Em `ui.command('start').action(async (opts) => {...})` (linha 406-438): substituir uso direto de `createServer` (linha 410) por dynamic import no início do handler:
  ```js
  const { createServer } = await import('../ui/server.js');
  const srv = createServer({ projectRoot, idleMs });
  ```

**Mudança 4 — Lazy import openBrowser em ui.start e ui.open:**
- Em `ui.command('start').action(...)` (linha 406-438): logo antes da chamada `await openBrowser(url);` (linha 425), adicionar:
  ```js
  const { openBrowser } = await import('../ui/browser.js');
  ```
- Em `ui.command('open').action(...)` (linha 477-488): logo antes de `const r = await openBrowser(url, { force: true });` (linha 483), adicionar:
  ```js
  const { openBrowser } = await import('../ui/browser.js');
  ```

**Cuidados especiais:**
- NÃO mude imports de commander, picocolors-via-core/ui.js (`c, icons, spinner, progress, select, confirm` linha 31) — Plan 89.02 fará select/confirm lazy DENTRO de core/ui.js (transparente para o CLI).
- NÃO mude `readLock`/`lockPathFor` — manter eager (lockfile.js é leve e é hot).
- NÃO mude `node:http`, `node:fs`, `node:os` — são builtins e os subcomandos que os usam (postShutdown, getHealthz, doctor) são raros, mas o custo de import é zero (já no Node runtime).
- NÃO toque em `slim()`, `slimTerse()`, `out()`, `withSpinner()`, `passthroughWrapper()`, `runDoctorChecks()`.
- Preserve `program.parseAsync(process.argv);` na última linha (725).

**Conferência final antes de salvar:**
- Top de cli/index.js: 3 imports menos (linhas 32, 34, 35 removidas).
- maybeWrapForUi assinatura: `async function maybeWrapForUi(...)`.
- withProgress: `await maybeWrapForUi(...)`.
- ui.start handler: 2 dynamic imports (server, browser).
- ui.open handler: 1 dynamic import (browser).
- install.write: NÃO mexa — não usa createServer/wrapProgressForUi/openBrowser.
  </action>
  <verify>
**Automated:**
```bash
node bin/cli.js --help                     # boot succeeds — no top-level error from missing module
node bin/cli.js kit list-agents --terse    # core path works
grep -n "^import.*ui/server\|^import.*ui/wrapper\|^import.*ui/browser" src/cli/index.js  # should output NOTHING (3 lazy imports removed from top)
grep -c "await import('../ui/" src/cli/index.js  # should output ≥4 (wrapper, server, browser×2)
```
Smoke test integration: `npm test` — full suite must pass (309 baseline + 1 new from Task 2 = 310).
  </verify>
  <done>
- 3 top-level UI sidecar imports removidos de src/cli/index.js.
- maybeWrapForUi async; withProgress await maybeWrapForUi.
- ui.start lazy-loads createServer + openBrowser dentro do handler.
- ui.open lazy-loads openBrowser dentro do handler.
- `node bin/cli.js --help` boota sem erro.
- `node bin/cli.js kit list-agents --terse` funciona idêntico ao baseline.
- Suite de 309 testes continua green (sem regressão).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add cold-start regression test for CLI list-agents --terse</name>
  <files>test/unit/cli-cold-start.test.js</files>
  <behavior>
Teste 1: `kit kit list-agents --terse` cold start (median de 3 spawns) deve completar dentro de threshold absoluto (e.g. < 700ms em CI razoável; baseline pre-fase é ~1000-1200ms — após lazy ≥30% redução).
Teste 2: A saída de `kit kit list-agents --terse` continua sendo JSON válido com items `{kind, name}` (semântica preservada — terse mode da Phase 85.01).
Teste 3: `kit kit list-agents` (não-terse) também executa sem regressão de schema (descricao slim cap PERF-13-01 preservada).
  </behavior>
  <action>
Criar `test/unit/cli-cold-start.test.js` seguindo style de `test/unit/watch-debounce.test.js` e `test/integration/npm-pack-shape.test.js` (cross-platform spawnSync com shell true em win32).

**Estrutura:**
```js
// PERF-16-04 regression: ensure CLI cold start for non-UI commands stays
// fast after lazy-loading UI sidecar imports. Baseline pre-Phase 89: ~1000ms.
// Target: ≥30% faster (≤700ms median on a typical dev machine).
//
// CI margin: this test is timing-based and may flake on slow runners.
// We assert vs an absolute ceiling (1500ms) to catch ONLY full regressions
// where the lazy imports are accidentally re-eager-ified. The 30% improvement
// claim is validated manually via /publicar / benchmark.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(REPO_ROOT, 'bin/cli.js');

function runCLI(args, timeoutMs = 5000) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1' },
  });
  const dt = Date.now() - t0;
  if (r.status !== 0) {
    throw new Error(`CLI exit ${r.status}: ${r.stderr?.slice(0, 500)}`);
  }
  return { stdout: r.stdout, stderr: r.stderr, dt };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

test('PERF-16-04: kit list-agents --terse cold start within absolute ceiling', () => {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    runs.push(runCLI(['kit', 'list-agents', '--terse', '--json']).dt);
  }
  const med = median(runs);
  // Absolute ceiling — catches accidental re-eager-ification of UI imports.
  // Pre-Phase 89 baseline: ~1000ms. Post-lazy target: ≤700ms typical.
  // Ceiling 1500ms allows for slow CI without false positives.
  assert.ok(
    med < 1500,
    `cold start regression: median ${med}ms across 3 runs (ceiling 1500ms). runs=${runs.join(',')}`
  );
});

test('PERF-16-04: kit list-agents --terse output is valid JSON with {kind, name}', () => {
  const { stdout } = runCLI(['kit', 'list-agents', '--terse', '--json']);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed), 'list-agents --terse --json must return an array');
  assert.ok(parsed.length > 0, 'kit must have at least one agent');
  for (const item of parsed) {
    assert.equal(typeof item.kind, 'string', 'each item has kind');
    assert.equal(typeof item.name, 'string', 'each item has name');
    assert.equal(item.description, undefined, 'terse mode omits description (PERF-15-01)');
  }
});

test('PERF-16-04: kit list-agents (non-terse) still includes capped description', () => {
  const { stdout } = runCLI(['kit', 'list-agents', '--json']);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed) && parsed.length > 0);
  // Non-terse mode includes description (slim cap from PERF-13-01).
  const first = parsed[0];
  assert.equal(typeof first.description, 'string', 'non-terse mode includes description');
});
```

**Cuidados:**
- `KIT_MCP_NO_UI=1` no env → previne lockfile lookup mesmo se um sidecar do dev estiver rodando.
- `CI=1` no env → ativa heurística headless em browser.js (defesa em profundidade, mas com lazy NÃO deve nem carregar).
- `NO_COLOR=1` → output limpo para JSON.parse.
- `--json` é flag GLOBAL (definido em `program.option('--json', ...)` linha 58), e vem ANTES dos comandos. CHECAR cli/index.js: o pattern usado em `kit list-agents --json` é `kit kit list-agents --terse --json` (subcommand args + flag). Comparar com `cli-roundtrip.test.js` para confirmar formato cross-platform.
- timeout 5s é defensivo — se cold start passar de 5s, é bug grave (não flake).

**Validação local antes de salvar:**
- Executar `node test/run.mjs test/unit` — todos os 3 testes do arquivo passam.
- Verificar que cold-start runs[] tem variação razoável (< 200ms entre runs).
  </action>
  <verify>
**Automated:**
```bash
node test/run.mjs test/unit
# expectativa: 3 novos testes em cli-cold-start.test.js passing; suite total = 309+3 = 312 passing
```
  </verify>
  <done>
- test/unit/cli-cold-start.test.js criado com 3 testes (cold-start ceiling, terse schema, non-terse schema).
- Todos os 3 testes passam localmente.
- Suite total agora = 309 baseline + 3 novos (Plan 89.01 contribuição) = 312.
- Comentário no arquivo documenta baseline pre-Phase 89 (~1000ms) vs target post-lazy (≤700ms median).
  </done>
</task>

</tasks>

<verification>
- `node bin/cli.js --help` boota sem erro de módulo.
- `node bin/cli.js kit list-agents --terse --json` produz JSON válido.
- `kit ui start --no-open` ainda funciona (lazy import de server.js resolve).
- `kit ui open` ainda funciona (lazy import de browser.js resolve).
- Suite `npm test` passa com ≥312 testes (309 baseline + 3 novos).
</verification>

<success_criteria>
- 3 top-level imports removidos de cli/index.js (server, wrapper, browser).
- 4+ pontos de dynamic `await import('../ui/...')` adicionados.
- 3 novos regression tests em test/unit/cli-cold-start.test.js.
- `kit kit list-agents --terse` cold start median ≤1500ms (ceiling), em prática ≥30% mais rápido (validado manualmente via benchmark fora dos testes).
- Zero regressão funcional — todos os subcomandos `kit ui *`, `kit sync install`, `kit reverse-sync apply` continuam idênticos.
</success_criteria>

<output>
After completion, create `.planning/phases/89-lazy-imports-optional-deps/89-01-SUMMARY.md`
</output>
