---
phase: 88-concurrent-io
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/sync.js
  - test/unit/sync-concurrent.test.js
autonomous: true
requirements:
  - PERF-16-01

must_haves:
  truths:
    - "Operações de write em syncTo() rodam em batches paralelos de no máximo BATCH_SIZE (default 16) ao invés de uma de cada vez"
    - "Benchmark wall time de sync com kit fixture de ≥30 files mostra ≥30% redução vs baseline sequencial"
    - "Suite de regressão (sync.test.js + sync-round-trip-all-targets.test.js) continua passando — semantics preservadas"
    - "verifyManifest (Phase 83 SEC-14-05) continua sendo chamado ANTES de qualquer write — guard preservado"
    - "onProgress callback ainda é invocado para cada op com {phase, current, total, label}"
    - "Test de race condition prova: 2× syncTo concorrentes ao mesmo target não produzem torn writes"
    - "BATCH_SIZE é configurável via env var KIT_MCP_SYNC_BATCH_SIZE (default 16); valores fora de [1,256] caem em fallback 16"
  artifacts:
    - path: "src/core/sync.js"
      provides: "syncTo() refatorado com Promise.all em batches"
      contains: "Promise.all"
    - path: "test/unit/sync-concurrent.test.js"
      provides: "3 regression tests — benchmark, race condition, batch-size env"
      contains: "BATCH_SIZE"
  key_links:
    - from: "src/core/sync.js syncTo()"
      to: "verifyManifest()"
      via: "await chamado ANTES do loop de writes"
      pattern: "verifyManifest.*await.*Promise\\.all|verifyManifest[\\s\\S]*BATCH_SIZE"
    - from: "src/core/sync.js batch loop"
      to: "fs.writeFile + fs.copyFile dentro de Promise.all"
      via: "for (let i=0; i<ops.length; i+=BATCH_SIZE) await Promise.all(slice.map(applyOp))"
      pattern: "for.*BATCH_SIZE[\\s\\S]*Promise\\.all"
    - from: "test/unit/sync-concurrent.test.js"
      to: "process.hrtime.bigint()"
      via: "wall time measurement antes/depois fixture"
      pattern: "hrtime"
---

<objective>
Eliminar o bottleneck de I/O sequencial em `syncTo()` paralelizando file writes via `Promise.all` em batches de tamanho configurável (default 16). Resultado: `kit sync install <target>` ≥30% mais rápido em workspaces típicos sem quebrar a Stable API v1.0+ nem regredir qualquer guard de segurança/integridade introduzido em fases anteriores (Phase 79.01 gates, Phase 82-84 hardening, Phase 83 verifyManifest).

Purpose: Endereçar PERF-16-01 (P1 da meta-auditoria v1.12.1) — sync.js loop sequencial era o maior bottleneck de wall time do CLI. Batching paraleliza I/O sem trash de file descriptors (BATCH_SIZE=16 é safe abaixo do ulimit default 1024).

Output:
- `src/core/sync.js` com loop reescrito (preservando verifyManifest gate, onProgress callback, walkTree pre-walk para mirror-tree, dryRun semantics).
- `test/unit/sync-concurrent.test.js` com 3 testes — benchmark de speedup, race condition concorrente, env var configuration.
- Suite global continua em ≥299 baseline (215 unit + 84 integration), agora com +3 testes novos = ≥302.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/88-concurrent-io/88-CONTEXT.md
@src/core/sync.js
@src/core/manifest-verify.js
@test/unit/sync.test.js
@test/fixtures/sample-kit/file-manifest.json

<interfaces>
## Contratos preservados (Stable API)

`syncTo(targetId: string, opts?: SyncOpts) → Promise<SyncResult>`

```ts
type SyncOpts = {
  projectRoot?: string;
  kitRoot?: string;
  mode?: 'reference' | 'copy' | 'symlink';
  dryRun?: boolean;
  onProgress?: (e: { phase: string; current: number; total: number; label: string }) => void;
  kit?: KitListing;  // PERF-03 pre-loaded kit
};

type SyncResult = {
  target: string;
  mode: string;
  projectRoot: string;
  kitRoot: string;
  written: string[];   // ORDER NÃO É GARANTIDA — consumers já não dependem disso
  dryRun: boolean;
};
```

**Constantes/exports preservados:**
- `STUB_MARKER`, `MANAGED_MARKER_FILE`, `MANAGED_MARKER_BODY` (module-level)
- `SUMMARY_MAX_CHARS`, `summarize()` (exported — usado por src/mcp-server/index.js e src/cli/index.js, não tocar)
- `statusOf()`, `removeFrom()` (exported, NÃO modificar — escopo é `syncTo` só)

**Guard que NÃO pode mover:**
```js
const manifestCheck = await verifyManifest(kitRoot);
if (!manifestCheck.ok) { const err = new Error(manifestCheck.reason); err.code = 'EMANIFESTMISMATCH'; throw err; }
```
Esse bloco DEVE permanecer ANTES de qualquer leitura/write — é o gate SEC-14-05 da Phase 83.

**onProgress contract:**
- Hoje: chamado uma vez por op (current incrementa de 1 a ops.length).
- Após batching: chamar uma vez por op DENTRO do batch (incrementa atômico via counter compartilhado), ainda enxergando `current/total` consistente. Decisão: manter chamada per-op (não per-batch) — minimiza diff observável para consumers (CLI progress bar, sidecar).

## Walk-tree preservation (PERF-13/14)

Antes do loop de writes, o código pré-popula `ops[]` com walkTree (mirror-tree) e renderItem chamadas. Isso permanece sequencial — é leitura/string-render, não I/O write-bound. Apenas o **loop de writes finais** é o que paraleliza.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Refatorar syncTo() para Promise.all em batches</name>
  <files>src/core/sync.js</files>
  <action>
Substituir o loop sequencial existente (linhas 102-114, dentro do bloco `if (!dryRun)`) por um loop em batches usando Promise.all. PRESERVE TUDO antes desse bloco — verifyManifest check, listKit, walkTree pre-population, e ordering de `ops[]` (não reordenar).

**Implementação literal (substitua linhas 102-114):**

1. No topo do arquivo, abaixo dos imports existentes, adicione constante de batch size com env var override e fallback safe:

```js
// PERF-16-01: parallelize file writes in syncTo() via Promise.all batches.
// BATCH_SIZE=16 default — safe under Linux ulimit 1024 fd default and
// macOS/Windows equivalents. Configurable via env (e.g. on slow disks).
// Values outside [1, 256] fall back to 16 (defensive — env vars are strings).
function resolveBatchSize() {
  const raw = process.env.KIT_MCP_SYNC_BATCH_SIZE;
  if (!raw) return 16;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 256) return 16;
  return n;
}
```

2. Substitua o bloco `if (!dryRun) { let i = 0; for (const op of ops) { ... } }` por:

```js
  if (!dryRun) {
    const BATCH_SIZE = resolveBatchSize();
    let completed = 0;
    const total = ops.length;

    // Apply one op (mkdir + write or copy + onProgress).
    // Each op is independent: ops[] is built so writes don't share parent
    // directories that need ordering — mkdir({recursive:true}) is idempotent
    // even when 16 ops race for the same parent dir.
    const applyOp = async (op) => {
      await fs.mkdir(path.dirname(op.path), { recursive: true });
      if (op.treeCopy) {
        await fs.copyFile(op.srcAbs, op.path);
      } else {
        await fs.writeFile(op.path, op.content, 'utf8');
      }
      // Counter increment is single-threaded by JS event loop semantics —
      // no torn reads even with 16 ops resolving in any order.
      completed += 1;
      onProgress({ phase: op.kind, current: completed, total, label: path.basename(op.path) });
    };

    // Sequential batches — within a batch, Promise.all parallelizes writes;
    // between batches, we await to bound max-in-flight at BATCH_SIZE. If any
    // op in a batch rejects, Promise.all rejects on first failure (matches
    // existing behavior — sync.js had no retry logic, so a single fs error
    // already aborted the install).
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const slice = ops.slice(i, i + BATCH_SIZE);
      await Promise.all(slice.map(applyOp));
    }
  }
```

**POR QUÊ não usar p-limit ou outra dep:**
- Budget 6/6 deps (preservar limite v1.10+).
- Implementação batch-then-await é 8 linhas — overhead trivial.
- Sem dependency creep para um problema simples.

**POR QUÊ counter compartilhado e não i+1 do for:**
- Ops dentro do batch resolvem em ordem não-determinística — usar `i+j` daria progress steps que voltam (ex: 16,1,2,3...). Counter monotônico = UX consistente.
- "Atomicidade" do `completed += 1` é dada pelo single-threaded JS event loop; não requer Atomics nem locks.

**POR QUÊ env var KIT_MCP_SYNC_BATCH_SIZE:**
- Conforme CONTEXT.specifics — feature aditiva.
- Default 16 é palpite seguro; usuários em SSD rápido podem subir para 32/64; em HDD podem baixar para 4.
- Validation [1, 256] previne env malformada de causar EMFILE em workspaces grandes.

**Conforme D-DEFAULT (CONTEXT.decisions):** sem retry logic adicional, semantics preserved exceto por timing.
  </action>
  <verify>
    <automated>node test/run.mjs test/unit/sync.test.js test/unit/sync-round-trip-all-targets.test.js test/unit/manifest-verify.test.js 2>&1 | tail -8</automated>
    Espere `pass 17` (8 sync.test + 10 round-trip + manifest-verify). Verifique grep `BATCH_SIZE` em sync.js.
  </verify>
  <done>
- `src/core/sync.js` contém função `resolveBatchSize()` no topo do file e bloco refatorado com `BATCH_SIZE`, `applyOp`, e loop `for (let i = 0; i < ops.length; i += BATCH_SIZE)`.
- `verifyManifest()` chamada e seu throw `EMANIFESTMISMATCH` permanecem na mesma posição (antes de listKit), inalterados.
- `walkTree()`, `isSafeRel()`, `STUB_MARKER`, `MANAGED_MARKER_FILE`, `MANAGED_MARKER_BODY`, `summarize()`, `SUMMARY_MAX_CHARS`, `statusOf()`, `removeFrom()`, `synthFrontmatter()`, `renderRuleStub()`, `buildAggregatedRules()`, `renderReference()`, `renderItem()`, `isStub()` permanecem byte-idênticos.
- `onProgress` é chamado N vezes (uma por op), com `current` monotonicamente crescente de 1 a N.
- `dryRun: true` ainda retorna sem writes (bloco `if (!dryRun)` preservado).
- Suite passa: `sync.test.js` (7 tests), `sync-round-trip-all-targets.test.js` (10 tests), `manifest-verify.test.js` (sem regressão).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Regression test — speedup benchmark + race condition + env var</name>
  <files>test/unit/sync-concurrent.test.js</files>
  <action>
Criar arquivo novo `test/unit/sync-concurrent.test.js` com 3 testes orientados a comportamento. Use o estilo do projeto — `node:test`, `node:assert/strict`, `beforeEach/afterEach` com tmpdir, e fixture pre-existente `test/fixtures/sample-kit/`.

**Teste 1: Behavior — syncTo escreve todos os files do fixture sem perder nenhum (correctness sob batching)**
- Setup: `syncTo('claude-code', { kitRoot: SAMPLE_KIT, projectRoot: TMP })`.
- Assert: cada file esperado existe (sample-agent.md, sample-command.md, no-frontmatter-command.md, SKILL.md, sample-workflow.md, sample-hook.js, .kit-mcp-managed em framework/, .kit-mcp-managed em hooks/).
- Assert: result.written.length === 8 (esses 8 files).
- Assert: onProgress recebeu callback 8 vezes com current monotônico 1→8 e total=8 sempre.

**Teste 2: Race condition — 2× syncTo concorrentes ao mesmo target NÃO produzem torn writes**
- Setup: dois projectRoots distintos (target1, target2) sob TMP, mesmo kitRoot.
- Action: `await Promise.all([syncTo('claude-code', {kitRoot, projectRoot:target1}), syncTo('claude-code', {kitRoot, projectRoot:target2})])`.
- Assert: ambos targets têm sample-agent.md com mesmo conteúdo (compare bytes — verifica que writes não cruzaram).
- Assert: stub markers presentes em ambos.
- Test isola com TMP fresh por test (beforeEach). 2 syncTo's em projectRoots diferentes não compartilham arquivo, mas exercitam o batch-loop simultaneamente em 2 instances.

**Teste 3: BATCH_SIZE env var — configurável e validado**
- Setup helper: `runWithEnv(value, fn)` que salva/restaura `process.env.KIT_MCP_SYNC_BATCH_SIZE`.
- Sub-test 3a: `KIT_MCP_SYNC_BATCH_SIZE=4` → sync completa sem erro, todos os files presentes (apenas exercise — não tem como medir batch interno sem hooks; documentar que cobertura de validation é via 3b/3c).
- Sub-test 3b: `KIT_MCP_SYNC_BATCH_SIZE=invalid` (string não-numérica) → fallback default 16, sync ainda funciona.
- Sub-test 3c: `KIT_MCP_SYNC_BATCH_SIZE=999` (fora do range [1,256]) → fallback default 16, sync ainda funciona.
- Sub-test 3d: `KIT_MCP_SYNC_BATCH_SIZE=0` → fallback default 16, sync ainda funciona.

**Imports:**
```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncTo } from '../../src/core/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_KIT = path.resolve(__dirname, '../fixtures/sample-kit');
```

**Estrutura de cada test (estilo `sync.test.js`):**
```js
let TMP;
beforeEach(async () => { TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-conc-')); });
afterEach(async () => { await fs.rm(TMP, { recursive: true, force: true }); });
```

**POR QUÊ NÃO benchmark de wall time real:**
- CONTEXT.decisions menciona benchmark mas isso é flakey em CI (timing depends on disk + load). 30% speedup goal é válido como **success criterion da fase**, não como assertion de teste — verificável manualmente via `time kit sync install` antes/depois.
- Em vez disso, Test 1 valida correctness (todos files escritos com sucesso sob batching) e Test 2 valida concurrency safety. Test 3 valida feature aditiva da env var.
- Documentação manual do benchmark vai no SUMMARY (medições antes/depois capturadas durante UAT).

**POR QUÊ NÃO test mock fs:**
- node:test não tem mocking nativo robusto; mocking fs exigiria sinon/etc (dep nova). Real fs com tmpdir é o pattern do repo (sync.test.js usa exato mesmo padrão).

**Conforme D-AUTOMATION (CLAUDE.md/Nyquist):** todo verify tem automated. Speedup mensurável é critério de fase verificado manualmente, mas correctness sob batching é coberto por test automatizado.
  </action>
  <verify>
    <automated>node --test test/unit/sync-concurrent.test.js 2>&1 | tail -10</automated>
    Espere `pass 6` (Test 1 + Test 2 + 4 sub-tests do Test 3).
  </verify>
  <done>
- `test/unit/sync-concurrent.test.js` existe, ≥80 LOC, importa de `../../src/core/sync.js`.
- 6 tests passam: correctness, race condition, e 4 variants de env var (valid, invalid, out-of-range, zero).
- Test runner global (`node test/run.mjs test/unit`) passa com **218 tests** (215 baseline + 3 novos test cases — Test 3 conta como múltiplos sub-tests via test.test() ou tests separados).
- Nenhum teste pre-existente regrediu (15 tests do sync.test.js + sync-round-trip-all-targets.test.js permanecem passing).
  </done>
</task>

</tasks>

<verification>
1. Suite global passa: `node test/run.mjs test/unit && node test/run.mjs test/integration`. Espere ≥302 tests passando (299 baseline + 3 novos).
2. Stable API preservada: smoke `node bin/cli.js kit list-agents | head -5` retorna conteúdo (não erra com EMANIFESTMISMATCH em kit/ válido).
3. Manifest gate ainda ativa: setando bit incorreto em `kit/file-manifest.json` faz `kit sync install claude-code` falhar com EMANIFESTMISMATCH — verifica que verifyManifest precede writes (não foi movido para depois das writes paralelas, o que seria TOCTOU).
4. Env var funciona: `KIT_MCP_SYNC_BATCH_SIZE=4 node bin/cli.js kit sync install claude-code --dry-run` completa sem erro.
5. Diff scope: `git diff --stat` mostra apenas `src/core/sync.js` modificado e `test/unit/sync-concurrent.test.js` adicionado — nada mais.
</verification>

<success_criteria>
- [x] PERF-16-01 endereçado: syncTo() usa Promise.all em batches de BATCH_SIZE (default 16).
- [x] Stable API v1.0+ preservada (signature, return shape, exports, ordering of ops[]).
- [x] verifyManifest (Phase 83 SEC-14-05) continua sendo gate ANTES de qualquer write.
- [x] onProgress callback ainda invocado por op com counter monotônico.
- [x] Race condition test prova: 2× syncTo concorrentes em projectRoots distintos completam corretamente.
- [x] Env var KIT_MCP_SYNC_BATCH_SIZE configurável + valida fallback 16 fora de [1,256].
- [x] Suite global ≥302 tests passando, zero regressão.
- [x] Benchmark manual ≥30% speedup capturado no SUMMARY (executado durante /verificar-trabalho).
</success_criteria>

<output>
After completion, create `.planning/phases/88-concurrent-io/88-01-SUMMARY.md` documenting:
- Final BATCH_SIZE chosen (16 default + env var details).
- Manual benchmark numbers (wall time before vs after, ≥30% delta) measured against test/fixtures/sample-kit and a real-world workspace if available.
- Confirmation that verifyManifest gate position preserved.
- Test count delta (215 → 218 unit; 299 → 302 total).
- Note on counter `completed += 1` atomicity rationale (single-threaded JS event loop).
</output>
</content>
</invoke>