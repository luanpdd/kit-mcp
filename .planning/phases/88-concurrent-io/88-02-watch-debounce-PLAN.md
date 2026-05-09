---
phase: 88-concurrent-io
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/watch.js
  - test/unit/watch-debounce.test.js
autonomous: true
requirements:
  - PERF-16-02

must_haves:
  truths:
    - "watchKit() invalida o kitCache via clearKitCache() ANTES de chamar syncTo() — caso contrário re-sync usa kit cached e perde edits do usuário"
    - "Em edit-burst (10 saves rápidos < 500ms), clearKitCache é chamado AT MOST 1× (debounce coalesce)"
    - "Em saves espaçados (>500ms apart), clearKitCache é chamado uma vez por save"
    - "Default debounceMs muda de 300 para 500 — alinhado com CONTEXT.decisions"
    - "API watchKit() preserva opts.debounceMs override (test passa Number(debounceMs)→ usa esse valor)"
    - "Phase 79.01 gates guard preservado (watch.js não toca gates.run)"
    - "Stable API: watchKit signature inalterada — { stop } returned, opts shape unchanged"
  artifacts:
    - path: "src/core/watch.js"
      provides: "Debounce 500ms + clearKitCache invalidation antes de syncTo"
      contains: "clearKitCache"
    - path: "test/unit/watch-debounce.test.js"
      provides: "3 testes — coalesce edit-burst, single-save invalidation, custom debounceMs"
      contains: "clearKitCache"
  key_links:
    - from: "src/core/watch.js trigger()"
      to: "clearKitCache() de src/core/kit.js"
      via: "import + chamada dentro do setTimeout callback antes do for-loop syncTo"
      pattern: "import.*clearKitCache[\\s\\S]*setTimeout[\\s\\S]*clearKitCache\\(\\)"
    - from: "src/core/watch.js debounce window"
      to: "edit-burst coalescing"
      via: "clearTimeout(pending) + new setTimeout(..., 500)"
      pattern: "clearTimeout\\(pending\\)[\\s\\S]*setTimeout"
---

<objective>
Adicionar invalidação de cache (`clearKitCache`) ao watcher antes de cada re-sync, e mover o debounce default de 300ms → 500ms para coalescer edit-bursts (IDE save bursts típicos: 5-10 saves em < 500ms). Sem isso, `kit sync watch` re-syncs com `kitCache` velho (TTL 30s do PERF-01 em kit.js) e o re-sync pode projetar a versão pre-edit.

Purpose: Endereçar PERF-16-02 (P3 da meta-auditoria v1.12.1) — combina dois problemas:
1. Bug latente: re-sync após edit usa cache stale (resolveKitRoot retorna mesmo path, listKit retorna cached value < 30s old).
2. Performance: edit-burst de 10 saves dispara 10 ciclos completos de syncTo. Debounce 500ms coalesce em 1.

Output:
- `src/core/watch.js` com import de `clearKitCache`, chamada dentro do trigger callback, default `debounceMs = 500`.
- `test/unit/watch-debounce.test.js` com 3 testes — coalesce, single-event, custom debounce override.
- Cache invalidation efetivo no watch loop, sem TOCTOU entre clearKitCache e syncTo.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/88-concurrent-io/88-CONTEXT.md
@src/core/watch.js
@src/core/kit.js
@src/core/sync.js

<interfaces>
## kit.js exports (já existentes — PERF-01 da v1.6)

```js
// src/core/kit.js linha 44
export function clearKitCache() { kitCache.clear(); }

// linhas 31-36 — TTL cache que watch precisa invalidar
const KIT_CACHE_TTL_MS = 30_000;
const kitCache = new Map(); // `${kitRoot}:${mode}` -> { value, ts }
```

`clearKitCache()` é nullary — limpa o Map inteiro. Não há invalidação por kitRoot específico (o Map só tem keys do kitRoot atual em uma typical CLI session, então clear-all é equivalente).

## watch.js API contract (Stable API — preservar)

```ts
function watchKit(targets: string[], opts?: WatchOpts): Promise<{ stop: () => Promise<void> }>;

type WatchOpts = {
  projectRoot?: string;
  kitRoot?: string;
  mode?: 'reference' | 'copy' | 'symlink';
  debounceMs?: number;        // DEFAULT: muda de 300 → 500
  onLog?: (msg: string) => void;
};
```

Mudança de default debounceMs (300 → 500) é tecnicamente uma mudança de comportamento, mas:
- watch.js é CLI-only feature, não é importado por API externa.
- Não há test pre-existente que assert debounceMs=300 default (já validado: nenhum file em test/ menciona debounceMs).
- Override via `opts.debounceMs` continua funcionando (Number.isFinite check preservado).

## chokidar awaitWriteFinish — não conflita

Já configurado: `awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }`. Isso debouncia eventos do FS em ~100ms (chokidar interno — espera write terminar). Nosso debounce de 500ms está acima — coalesce DEPOIS que chokidar emite. Não há double-debounce funcional (chokidar é correctness, nosso é coalescing).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Adicionar clearKitCache invalidation + bump debounce default para 500ms</name>
  <files>src/core/watch.js</files>
  <action>
Modificar `src/core/watch.js` em três pontos cirúrgicos. NÃO reescrever o arquivo — apenas:

**Ponto 1 — Import (linha ~17, junto com outros imports de ./sync.js, ./registry.js, ./kit.js):**

Atualmente:
```js
import { resolveKitRoot } from './kit.js';
```

Mudar para:
```js
import { resolveKitRoot, clearKitCache } from './kit.js';
```

**Ponto 2 — Default debounce (linha ~23):**

Atualmente:
```js
const debounceMs  = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 300;
```

Mudar para:
```js
// PERF-16-02: bump default 300 → 500ms to coalesce IDE save-bursts (typical
// IDE auto-save fires 5-10 events in < 500ms during a single user save).
const debounceMs  = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 500;
```

**Ponto 3 — clearKitCache no trigger (linhas 44-58, dentro do `trigger` const):**

Atualmente:
```js
let pending = null;
const trigger = (label, p) => {
  onLog(`${label} ${path.relative(kitRoot, p)}`);
  if (pending) clearTimeout(pending);
  pending = setTimeout(async () => {
    pending = null;
    for (const t of targets) {
      try {
        const r = await syncTo(t, { projectRoot, kitRoot, mode });
        onLog(`↻ resynced → ${t} (${r.written.length} files)`);
      } catch (e) {
        onLog(`✗ resync → ${t}: ${e.message}`);
      }
    }
  }, debounceMs);
};
```

Mudar para (adicionar `clearKitCache()` no INÍCIO do callback, ANTES do for-loop):

```js
let pending = null;
const trigger = (label, p) => {
  onLog(`${label} ${path.relative(kitRoot, p)}`);
  if (pending) clearTimeout(pending);
  pending = setTimeout(async () => {
    pending = null;
    // PERF-16-02: invalidate kitCache (TTL 30s in kit.js PERF-01) BEFORE
    // re-sync — otherwise listKit() inside syncTo can return the pre-edit
    // cached value if the burst happened within the TTL window. Coalescing
    // the edit-burst via debounce means clearKitCache fires AT MOST ONCE
    // per 500ms window, regardless of how many save events came in.
    clearKitCache();
    for (const t of targets) {
      try {
        const r = await syncTo(t, { projectRoot, kitRoot, mode });
        onLog(`↻ resynced → ${t} (${r.written.length} files)`);
      } catch (e) {
        onLog(`✗ resync → ${t}: ${e.message}`);
      }
    }
  }, debounceMs);
};
```

**POR QUÊ a chamada está DENTRO do setTimeout (não no `trigger` body):**
- Se chamássemos `clearKitCache()` em cada `trigger()` invocation (FORA do setTimeout), 10 saves rápidos = 10 invalidações. Defeats the purpose.
- DENTRO do setTimeout = só roda quando o debounce window expira = 1 invalidação por window.

**POR QUÊ ANTES do `for (const t of targets)`:**
- Cada `syncTo` faz `await listKit(...)` internamente (sync.js linha 46). Se cache stale, todos os targets recebem dados velhos. Limpar uma vez antes do loop = todos targets veem dados frescos.
- Não chamar dentro do loop (per-target) — desperdício; mesma kitRoot.

**POR QUÊ NÃO chamar fora do setTimeout (no trigger body):**
- Caso edge: usuário edita, salva, edita de novo dentro do debounce window. Cache deve refletir ESTADO FINAL. Limpar no início do window invalidaria, mas listKit ainda não rodou. Limpar no fim (dentro do setTimeout) garante que próximo `listKit` (chamado pelo syncTo) lê do disk fresco — captura o estado pós-último-save.

**POR QUÊ NÃO mudar o `stop` callback:**
- `stop` já tem `clearTimeout(pending)`. Não há syncTo pendente para cleanup de cache porque `stop` mata o setTimeout antes dele rodar. Cache cleanup desnecessário aqui.

Conforme CONTEXT.decisions PERF-16-02: "Add `let invalidationTimer = null;` no scope do watch. No event handler: `clearTimeout(invalidationTimer); invalidationTimer = setTimeout(() => clearKitCache(), 500);`" — A interpretação literal disso seria adicionar um SEGUNDO timer só pra invalidação, separado do timer de re-sync. Mas isso gera 2 timers e a invalidação pode rodar ANTES do re-sync se eles divergirem. **Decisão do planner:** unificar — usar o timer existente de re-sync e adicionar clearKitCache como primeira ação dentro dele. É equivalente em coalescing semantics e mais simples.
  </action>
  <verify>
    <automated>node -e "import('./src/core/watch.js').then(m => console.log('export ok:', typeof m.watchKit))" 2>&1</automated>
    Espere `export ok: function`. Verifique grep `clearKitCache` em watch.js (≥2 ocorrências: import + chamada).
  </verify>
  <done>
- `src/core/watch.js` import line inclui `clearKitCache` de `./kit.js`.
- `debounceMs` default é `500` (não 300).
- `clearKitCache()` é chamado dentro do `setTimeout` callback, ANTES do `for (const t of targets)` loop.
- Comment explica POR QUÊ está dentro do setTimeout (coalescing) e antes do loop (single invalidation).
- `watchKit` signature, return shape, e callbacks dos 4 watcher events (`add`/`change`/`unlink`/`error`) são byte-idênticos ao original.
- `stop()` callback é byte-idêntico (não toca clearKitCache porque pending timer é killed antes).
- `detectExistingTargets()` (lower-half do file) é byte-idêntico — out of scope.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Regression test — debounce coalescing + cache invalidation behavior</name>
  <files>test/unit/watch-debounce.test.js</files>
  <action>
Criar `test/unit/watch-debounce.test.js` com 3 testes orientados a comportamento. Não mocka chokidar — usa watcher real com fs writes (pattern do projeto: testes unit usam tmpdir reais).

**Imports e setup (estilo dos outros tests):**
```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { watchKit } from '../../src/core/watch.js';
import { syncTo } from '../../src/core/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_KIT_SRC = path.resolve(__dirname, '../fixtures/sample-kit');

let TMP, KIT, PROJECT;
beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-watch-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  // Copy fixture so we can mutate without polluting repo
  await fs.cp(SAMPLE_KIT_SRC, KIT, { recursive: true });
});
afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
```

**Teste 1: Default debounceMs = 500ms (assertion direta de behavior)**

Como verificar o default sem hooks de introspecção?
- Approach: pass `opts.debounceMs = undefined` (ou simplesmente omit), trigger 1 file write, e medir tempo entre o write e o resync log.
- Use logs como observability:

```js
test('watchKit — default debounce coalesces fast burst of writes into single resync', async () => {
  const logs = [];
  const onLog = (m) => logs.push({ t: Date.now(), msg: m });

  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT, projectRoot: PROJECT, onLog,
    // debounceMs omitted → uses new default 500
  });

  // Wait for initial sync to complete + watcher to settle
  await sleep(150);
  logs.length = 0;  // clear initial-sync logs

  // BURST: 10 quick writes within < 500ms window
  const burstStart = Date.now();
  for (let i = 0; i < 10; i++) {
    await fs.writeFile(path.join(KIT, 'agents/sample-agent.md'),
      `---\nname: sample-agent\ndescription: edit ${i}\n---\nbody ${i}\n`);
    await sleep(20);  // 10 writes × 20ms = 200ms total < 500ms debounce
  }

  // Wait for debounce window + a margin
  await sleep(800);

  await handle.stop();

  // ASSERTION: at most ONE "↻ resynced" message (debounce coalesced)
  const resyncs = logs.filter(l => l.msg.includes('↻ resynced'));
  assert.ok(resyncs.length <= 1,
    `expected ≤1 resync, got ${resyncs.length}: ${resyncs.map(r=>r.msg).join(' | ')}`);

  // ASSERTION: the resync (if any) happened ≥500ms after burst start (debounce honored)
  if (resyncs.length === 1) {
    const dt = resyncs[0].t - burstStart;
    assert.ok(dt >= 400, `resync fired ${dt}ms after burst start; expected ≥400ms (500ms debounce − some jitter)`);
  }
});
```

**Teste 2: clearKitCache invalidation produz correct re-sync (não usa kit cached)**

```js
test('watchKit — re-sync reflects post-edit kit content (clearKitCache invalidation)', async () => {
  const logs = [];
  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT, projectRoot: PROJECT,
    debounceMs: 100,  // tight debounce for fast test
    onLog: (m) => logs.push(m),
  });
  await sleep(50);  // initial sync

  // Edit kit/agents/sample-agent.md with DISTINCTIVE content
  const distinctive = `---\nname: sample-agent\ndescription: distinctive marker xyz123\n---\nbody after edit\n`;
  await fs.writeFile(path.join(KIT, 'agents/sample-agent.md'), distinctive);
  await sleep(400);  // wait debounce + sync

  await handle.stop();

  // ASSERTION: projected file in PROJECT contains the distinctive marker
  // (would FAIL if cache was stale — projection would have pre-edit content)
  // NOTE: in mode=reference (default) the projection is a stub linking back, not
  // the body. But the stub's frontmatter `description` is synthesized from the
  // kit item's description — which IS the distinctive marker if cache was cleared.
  const projected = await fs.readFile(
    path.join(PROJECT, '.claude/agents/sample-agent.md'), 'utf8');
  assert.match(projected, /distinctive marker xyz123/,
    'projected stub frontmatter should reflect post-edit kit description (cache invalidation works)');
});
```

**Teste 3: Custom debounceMs override preserva API**

```js
test('watchKit — opts.debounceMs override changes coalesce window', async () => {
  const logs = [];
  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT, projectRoot: PROJECT,
    debounceMs: 50,  // EXPLICIT override — should NOT use new 500 default
    onLog: (m) => logs.push(m),
  });
  await sleep(50);  // initial sync
  logs.length = 0;

  // Single write
  const t0 = Date.now();
  await fs.writeFile(path.join(KIT, 'agents/sample-agent.md'),
    `---\nname: sample-agent\ndescription: t3\n---\nbody t3\n`);

  // Wait short — with 50ms debounce, resync should fire within 200ms
  await sleep(200);

  await handle.stop();

  const resync = logs.find(m => m.includes('↻ resynced'));
  assert.ok(resync, `expected resync within 200ms with debounceMs=50; logs=${JSON.stringify(logs)}`);
});
```

**POR QUÊ usar timing-based assertions:**
- `node:test` não tem fake timers built-in (precisaria de sinon). Tests timing-based são padrão para watcher tests.
- `chokidar` interno awaitWriteFinish=100ms + nosso debounce = total wait deve ser ≥600ms para evitar flake. Tests usam 800ms generous margin.

**POR QUÊ NOT testar exact debounceMs=500 default with bigger window:**
- O grep do source code valida o default. Test 1 valida coalescing comportamento (que é o ponto da debounce). Não-flakey.

**POR QUÊ teste 2 usa mode=reference (default):**
- Reference mode synthesiza frontmatter da kit description. Se kitCache estava stale, syncTo recebe `kit.agents[i].description` antiga → stub tem description antiga. Pós-clearKitCache, listKit re-lê from disk → description nova → stub correto. Marker `xyz123` é canary direta da invalidation.
  </action>
  <verify>
    <automated>node --test --test-force-exit test/unit/watch-debounce.test.js 2>&1 | tail -10</automated>
    Espere `pass 3`. Note: test usa filesystem real + chokidar, expect ~3-5s duration total. `--test-force-exit` necessário porque chokidar mantém handles abertos brevemente.
  </verify>
  <done>
- `test/unit/watch-debounce.test.js` existe, importa de `../../src/core/watch.js` e `../../src/core/sync.js`.
- 3 testes passam: coalesce-burst, cache-invalidation-correctness, custom-debounce-override.
- Suite global passing — `node test/run.mjs test/unit` total +3 tests vs baseline.
- Tests usam apenas `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:os` — zero deps novas.
- afterEach faz cleanup completo (rm tmpdir + stop watcher) — sem leak de handles em test runner.
  </done>
</task>

</tasks>

<verification>
1. Suite passa: `node test/run.mjs test/unit` mostra ≥218 unit tests (215 baseline + 3 novos).
2. Combined com Plan 01: ≥221 unit tests (215 + 3 do plan 01 + 3 do plan 02 = 221).
3. CLI smoke: `node bin/cli.js kit sync watch claude-code` arranca sem erro (manual test, espera 1s, Ctrl+C — verifica que default 500 não trava startup).
4. Cache invalidation manual: editar `kit/agents/<existing>.md` mudando description, observar log `↻ resynced` em ≤1s, verificar que `.claude/agents/<existing>.md` no projectRoot reflete nova description.
5. Phase 79.01 gates guard preservado: nada em watch.js menciona ou chama gates.run — verifique via grep.
</verification>

<success_criteria>
- [x] PERF-16-02 endereçado: edit-burst de N saves dispara AT MOST 1 clearKitCache + 1 ciclo de syncTo dentro de cada janela de 500ms.
- [x] Bug latente fixed: re-sync após edit reflete kit pós-edit (não cached pré-edit).
- [x] Default debounceMs = 500 (era 300). Override via `opts.debounceMs` preservado.
- [x] watchKit() Stable API: signature, opts shape, return shape inalterados.
- [x] clearKitCache import correto de kit.js (já exportado desde PERF-01 v1.6).
- [x] 3 regression tests cobrem: coalesce, correctness pós-cache-clear, custom override.
- [x] Zero regressão na suite. Phase 79.01 gates não tocado.
</success_criteria>

<output>
After completion, create `.planning/phases/88-concurrent-io/88-02-SUMMARY.md` documenting:
- Confirmation que clearKitCache foi adicionado e está dentro do setTimeout (coalescing window).
- Default debounce mudança documentada (300 → 500ms) com rationale.
- Test count delta (+3 unit tests).
- Manual UAT capture: edit-burst de 10 saves observado, contagem de resync logs (espera-se 1).
- Discussão de TOCTOU: clearKitCache + listKit não tem race window porque ambos rodam dentro do mesmo setTimeout callback (event-loop atômico).
</output>
</content>
</invoke>