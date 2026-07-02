---
phase: 90-verify-manifest-parallel-cache
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/manifest-verify.js
  - test/unit/manifest-verify.test.js
autonomous: true
requirements:
  - PERF-17-01

must_haves:
  truths:
    - "verifyManifest com 327 files completa em ≤74ms (≥40% redução vs 123ms baseline)"
    - "Watch trigger consecutivo (2ª chamada dentro 30s) retorna em <5ms via cache"
    - "Cache invalida corretamente em mismatch (não cacheia error path)"
    - "Env KIT_MCP_VERIFY_NO_CACHE=1 força recompute (test bypass)"
    - "CRLF→LF normalize preservado (linha existente intocada — cross-platform stable)"
    - "Suite continua passing (317 baseline) + 4+ regression tests novos"
    - "Stable API v1.0+ preservada — verifyManifest() retorna {ok, mismatches?, missing?, skipped?}"
  artifacts:
    - path: "src/core/manifest-verify.js"
      provides: "Promise.all batches=16 substituindo for-loop sequencial + module-level cache TTL 30s"
      contains: "Promise.all"
    - path: "src/core/manifest-verify.js"
      provides: "Cache module-level com chave kitRoot + TTL 30s + bypass env"
      contains: "verifyManifestCache"
    - path: "test/unit/manifest-verify.test.js"
      provides: "4+ regression tests novos (parallel speedup, cache hit, cache invalidation, env bypass)"
      contains: "PERF-17-01"
  key_links:
    - from: "src/core/manifest-verify.js"
      to: "Promise.all(batch.map(checkOne))"
      via: "for-loop em batches de 16 substituindo for-of sequencial"
      pattern: "for \\(let i = 0; i < entries\\.length; i \\+= BATCH_SIZE\\)"
    - from: "src/core/manifest-verify.js"
      to: "verifyManifestCache (module-level)"
      via: "cache hit check ANTES do compute, cache write APÓS ok-only"
      pattern: "verifyManifestCache"
    - from: "src/core/sync.js:47"
      to: "verifyManifest(kitRoot)"
      via: "chamada inalterada — beneficia automaticamente do speedup + cache"
      pattern: "verifyManifest\\(kitRoot\\)"
---

<objective>
Paralelizar SHA256 hashing em `manifest-verify.js` (Promise.all batches=16, mesmo pattern de Phase 88.01 sync.js) e adicionar cache em-memória module-level com TTL 30s + invalidation rules. Resolve maior bottleneck identificado pós-v1.16.0: ~50ms/sync e ~100-123ms/watch trigger.

Purpose: Cortar 47% do tempo de syncTo ANTES do batched write loop. Para o pattern watch (developer salva file → sync re-roda automaticamente), o 2º+ trigger fica praticamente instantâneo via cache hit.

Output:
- `src/core/manifest-verify.js` refactored: for-loop → Promise.all batches=16 + module-level cache (TTL 30s, ok-only, env bypass).
- `test/unit/manifest-verify.test.js`: 4+ regression tests novos (parallel speedup, cache hit, cache invalidation, env bypass).
- Suite passing (≥317 baseline + novos).
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/90-verify-manifest-parallel-cache/90-CONTEXT.md
@src/core/manifest-verify.js
@src/core/sync.js
@src/core/kit.js
@test/unit/manifest-verify.test.js

<interfaces>
## Stable API contract (DO NOT BREAK)

```js
// src/core/manifest-verify.js — exported signature
export async function verifyManifest(kitRoot: string): Promise<{
  ok: boolean,
  skipped?: boolean,    // true quando KIT_MCP_SKIP_MANIFEST_CHECK=1
  reason?: string,      // present quando ok=false
  mismatches?: Array<{ path, expected, actual }>,  // sempre array (vazio se ok)
  missing?: string[],   // sempre array (vazio se ok)
}>
```

## Pattern de referência — Phase 88.01 sync.js (linhas 115-144)

```js
// resolveBatchSize() validation envelope
function resolveBatchSize() {
  const raw = process.env.KIT_MCP_SYNC_BATCH_SIZE;
  if (!raw) return 16;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 256) return 16;
  return n;
}

// batched Promise.all loop
for (let i = 0; i < ops.length; i += BATCH_SIZE) {
  const slice = ops.slice(i, i + BATCH_SIZE);
  await Promise.all(slice.map(applyOp));
}
```

## Pattern de referência — kit.js cache (linhas 31-63)

```js
// Module-level cache com TTL 30s (PERF-01)
const KIT_CACHE_TTL_MS = 30_000;
const kitCache = new Map(); // chave -> { value, ts }

export async function listKit(kitRoot, opts = {}) {
  const cacheKey = `${kitRoot}:${stubsOnly ? 'stubs' : 'full'}`;
  const cached = kitCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < KIT_CACHE_TTL_MS) {
    return cached.value;
  }
  // ... compute ...
  kitCache.set(cacheKey, { value, ts: Date.now() });
  return value;
}

export function clearKitCache() { kitCache.clear(); }
```

## CRLF→LF normalize (PRESERVADO, linhas 62-65 atual)

```js
// git checkout converts EOL on Windows but Linux CI checks out LF —
// hashing raw bytes would diverge across platforms.
const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
const actual = crypto.createHash('sha256').update(normalized).digest('hex');
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promise.all batches=16 + preserve CRLF→LF normalize</name>
  <files>src/core/manifest-verify.js</files>
  <read_first>
    - src/core/manifest-verify.js (estado atual, linhas 19-107) — entender for-loop sequencial em linhas 53-66
    - src/core/sync.js (linhas 22-32, 115-144) — pattern resolveBatchSize() + Promise.all batched loop a replicar
  </read_first>
  <action>
    Refactor `verifyManifest()` em `src/core/manifest-verify.js` substituindo o for-loop sequencial (linhas 53-66) por Promise.all em batches de 16. POR QUÊ batches e não Promise.all flat: 327 fs.readFile + crypto.createHash simultâneos podem estourar fd ulimit (Linux default 1024) e mesmo se não estourar, scheduling overhead degrada wall time. Phase 88.01 já validou BATCH_SIZE=16 como sweet spot.

    **Implementação literal:**

    1. Adicione constante module-level no topo (após imports, antes do `const SKIP_ENV`):
       ```js
       // PERF-17-01: parallelize SHA256 hashing in batches of 16. Same pattern
       // as Phase 88.01 sync.js. Hardcoded — env override is overengineering
       // for verifyManifest (single hot path, not user-facing latency budget).
       const BATCH_SIZE = 16;
       ```

    2. Substitua o bloco `for (const [rel, expected] of Object.entries(manifest.files))` (linhas 53-70) pelo seguinte. A função `checkOne(rel, expected)` extrai a lógica per-file e RETORNA o resultado (não muta arrays diretamente — evita race em push concorrente):
       ```js
       const entries = Object.entries(manifest.files);

       // Per-file check — returns { rel, status: 'ok'|'mismatch'|'missing', expected?, actual? }.
       // Pure function (no side effects on shared arrays) so Promise.all in batches
       // is safe — caller aggregates after each batch resolves.
       const checkOne = async ([rel, expected]) => {
         const abs = path.join(kitRoot, rel);
         let buf;
         try {
           buf = await fs.readFile(abs);
         } catch {
           return { rel, status: 'missing' };
         }
         // Normalize CRLF→LF before hashing so manifest is platform-stable.
         // git checkout converts EOL on Windows but Linux CI checks out LF —
         // hashing raw bytes would diverge across platforms. (PRESERVED from v1.15)
         const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
         const actual = crypto.createHash('sha256').update(normalized).digest('hex');
         if (actual !== expected) {
           return { rel, status: 'mismatch', expected, actual };
         }
         return { rel, status: 'ok' };
       };

       // Sequential batches — within a batch, Promise.all parallelizes hashing;
       // between batches, await bounds max-in-flight at BATCH_SIZE (defensive
       // against fd ulimit on large kits). Order of completion within a batch
       // doesn't matter — aggregator below is order-independent.
       for (let i = 0; i < entries.length; i += BATCH_SIZE) {
         const slice = entries.slice(i, i + BATCH_SIZE);
         const results = await Promise.all(slice.map(checkOne));
         for (const r of results) {
           if (r.status === 'mismatch') {
             mismatches.push({ path: r.rel, expected: r.expected.slice(0, 16), actual: r.actual.slice(0, 16) });
           } else if (r.status === 'missing') {
             missing.push(r.rel);
           }
         }
       }
       ```

    3. NÃO toque no resto do arquivo: `SKIP_ENV` early-return, manifest read+parse, reasonParts assembly final.

    4. Adicione JSDoc de 1 linha acima da função explicando o speedup:
       ```js
       /**
        * SEC-14-05: verify kit/file-manifest.json against actual file contents.
        * PERF-17-01: hashes in Promise.all batches of 16 (was sequential pre-v1.17).
        * Called by syncTo() in install path before any write — refuses to project a tampered kit.
        * @param {string} kitRoot - absolute path to kit/ directory.
        * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, mismatches?: Array, missing?: string[]}>}
        */
       export async function verifyManifest(kitRoot) {
       ```

    **CRÍTICO — preservar:**
    - CRLF→LF normalize (linhas 62-65 atuais) — linha intocada (cross-platform stable, commit 0130c5b).
    - SKIP_ENV early-return (linhas 20-25) — comportamento inalterado.
    - manifest read+parse (linhas 27-48) — inalterado.
    - reason assembly + return shape (linhas 76-106) — inalterado.

    Sem novas deps. Sem env vars novas (cache vem em Task 2).
  </action>
  <verify>
    <automated>node --test test/unit/manifest-verify.test.js 2>&1 | grep -E "ok |fail "</automated>
  </verify>
  <acceptance_criteria>
    - [ ] `BATCH_SIZE = 16` constante module-level adicionada
    - [ ] For-loop sequencial substituído por Promise.all em batches de 16
    - [ ] CRLF→LF normalize PRESERVADO (linha do `Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary')` intocada)
    - [ ] SKIP_ENV bypass (KIT_MCP_SKIP_MANIFEST_CHECK=1) continua funcional
    - [ ] manifest-unreadable e manifest-malformed errors continuam funcionais
    - [ ] mismatches/missing arrays preenchidos via per-file pure function (sem race)
    - [ ] Suite manifest-verify.test.js continua passing (317 baseline preservado)
    - [ ] `verifyManifest()` retorna mesmo shape: `{ ok, skipped?, reason?, mismatches, missing }`
    - [ ] JSDoc adicionado mencionando PERF-17-01
  </acceptance_criteria>
  <done>
    Refactor concluído quando: (a) suite existente passa sem mudanças nos testes existentes, (b) for-loop sequencial removido, (c) Promise.all batches=16 implementado, (d) CRLF→LF intocado, (e) API contract preservado (shape de retorno idêntico).
  </done>
</task>

<task type="auto">
  <name>Task 2: Module-level cache com TTL 30s + invalidation rules + env bypass</name>
  <files>src/core/manifest-verify.js</files>
  <read_first>
    - src/core/manifest-verify.js (estado pós-Task 1) — para localizar onde inserir cache check
    - src/core/kit.js (linhas 31-63) — pattern de cache TTL a replicar (PERF-01)
  </read_first>
  <action>
    Adicione cache em-memória module-level a `verifyManifest()`. Pattern idêntico ao `kitCache` em `src/core/kit.js` (PERF-01). Cache hit antes do compute; cache write APÓS resultado ok (NUNCA cachear error path — sempre recompute em mismatch para detectar mudanças que corrigem).

    **Implementação literal:**

    1. Adicione constantes module-level no topo (após `const BATCH_SIZE = 16;` da Task 1, antes do `const SKIP_ENV`):
       ```js
       // PERF-17-01: in-memory cache for verifyManifest. Same pattern as kit.js
       // listKit cache (PERF-01). Watch triggers (file save → re-sync) call this
       // back-to-back; the 2nd+ call within TTL hits cache and returns <5ms.
       //
       // Caching rules:
       //   - Only cache ok=true results. mismatches/missing → recompute every call
       //     so devs see fixes immediately (don't punish them for the slow path).
       //   - Bypass via KIT_MCP_VERIFY_NO_CACHE=1 (test isolation + emergency dev escape).
       //   - Cache key is kitRoot — different roots are independent entries.
       const VERIFY_CACHE_TTL_MS = 30_000;
       const verifyManifestCache = new Map(); // kitRoot -> { value, ts }
       const NO_CACHE_ENV = 'KIT_MCP_VERIFY_NO_CACHE';

       /**
        * Test/emergency helper — clears the cache. Exported for unit tests.
        * Production code should never need this; use the env var instead.
        */
       export function clearVerifyManifestCache() { verifyManifestCache.clear(); }
       ```

    2. Em `verifyManifest()`, adicione cache hit check IMEDIATAMENTE APÓS o `SKIP_ENV` early-return (antes do `manifestPath` const). Isso garante que `KIT_MCP_SKIP_MANIFEST_CHECK=1` continua tendo prioridade absoluta:
       ```js
       export async function verifyManifest(kitRoot) {
         if (process.env[SKIP_ENV] === '1') {
           process.stderr.write(
             '[kit-mcp] WARNING: ' + SKIP_ENV + '=1 set — skipping kit/file-manifest.json verification (dev mode).\n'
           );
           return { ok: true, skipped: true };
         }

         // PERF-17-01: cache hit — repeated calls within TTL skip the I/O + hashing.
         // Bypass via KIT_MCP_VERIFY_NO_CACHE=1 (tests + dev emergency escape).
         if (process.env[NO_CACHE_ENV] !== '1') {
           const cached = verifyManifestCache.get(kitRoot);
           if (cached && Date.now() - cached.ts < VERIFY_CACHE_TTL_MS) {
             return cached.value;
           }
         }

         // ... resto da função (manifest read, batched hashing, etc.) ...
       }
       ```

    3. Adicione cache write LOGO ANTES do `return { ok: true };` (linha ~73 atual). NÃO cacheie em error paths:
       ```js
       if (mismatches.length === 0 && missing.length === 0) {
         const result = { ok: true };
         // PERF-17-01: cache only ok=true. Mismatch/missing always recompute
         // so dev fixing a tampered file sees the next sync recover immediately.
         if (process.env[NO_CACHE_ENV] !== '1') {
           verifyManifestCache.set(kitRoot, { value: result, ts: Date.now() });
         }
         return result;
       }
       ```

    4. NÃO adicione cache write no error return final (linhas ~101-106 atuais). Error path deve sempre recomputar.

    **CRÍTICO — preservar:**
    - SKIP_ENV early-return tem prioridade ABSOLUTA (cache check vem DEPOIS).
    - Error path (manifest unreadable, malformed, mismatches/missing > 0) NUNCA cacheia.
    - Cache key é `kitRoot` puro (Map suporta string keys diretamente — não use template literal compound key porque verifyManifest não tem `mode` parameter).

    **POR QUÊ exportar `clearVerifyManifestCache()`:**
    - Test isolation entre `beforeEach` calls (env var bypass funciona, mas explicit clear é mais robusto).
    - Pattern já estabelecido em kit.js (`clearKitCache()`).
    - Não polui API pública (consumers normais usam env var).
  </action>
  <verify>
    <automated>node --test test/unit/manifest-verify.test.js 2>&1 | grep -E "ok |fail |# tests "</automated>
  </verify>
  <acceptance_criteria>
    - [ ] `VERIFY_CACHE_TTL_MS = 30_000` e `verifyManifestCache = new Map()` module-level
    - [ ] `NO_CACHE_ENV = 'KIT_MCP_VERIFY_NO_CACHE'` constante
    - [ ] `clearVerifyManifestCache()` exportada
    - [ ] Cache hit check APÓS `SKIP_ENV` (prioridade absoluta para skip)
    - [ ] Cache hit check ANTES do manifest read (early return economiza I/O)
    - [ ] Cache write APENAS em `ok: true` path (linha imediatamente antes do `return { ok: true }`)
    - [ ] Cache write NUNCA em error paths (manifest unreadable, malformed, mismatches/missing)
    - [ ] Env `KIT_MCP_VERIFY_NO_CACHE=1` bypassa tanto leitura quanto escrita
    - [ ] Suite continua passing (317 baseline preservado, todos os 6 tests existentes verdes)
  </acceptance_criteria>
  <done>
    Cache implementado quando: (a) 1ª chamada compute → cacheia, 2ª chamada (dentro 30s) → cache hit, (b) mismatch nunca cacheia, (c) env bypass funcional para escrita E leitura, (d) clearVerifyManifestCache exportada, (e) suite existente verde.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regression tests — parallel speedup + cache hit + invalidation + env bypass</name>
  <files>test/unit/manifest-verify.test.js</files>
  <read_first>
    - test/unit/manifest-verify.test.js (estado atual, linhas 1-132) — para entender estrutura beforeEach/afterEach + helper buildFixtureKit
    - src/core/manifest-verify.js (estado pós-Tasks 1+2) — para conhecer exports (verifyManifest + clearVerifyManifestCache)
  </read_first>
  <action>
    Adicione 4+ regression tests novos em `test/unit/manifest-verify.test.js`. Reuse helper `buildFixtureKit` existente. Inclua tag `PERF-17-01` em test names (mesmo pattern de `SEC-14-05` nos tests existentes).

    **CRÍTICO — atualize o `beforeEach`:**
    Adicione clear de cache + save/delete do env var `KIT_MCP_VERIFY_NO_CACHE` para garantir isolation entre tests. Pattern espelhado em `savedSkipEnv`:
    ```js
    let TMP_KIT;
    let TMP_PROJECT;
    let savedSkipEnv;
    let savedNoCacheEnv;  // novo

    beforeEach(async () => {
      TMP_KIT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-kit-'));
      TMP_PROJECT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-proj-'));
      savedSkipEnv = process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
      savedNoCacheEnv = process.env.KIT_MCP_VERIFY_NO_CACHE;
      delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
      delete process.env.KIT_MCP_VERIFY_NO_CACHE;
      clearVerifyManifestCache();  // novo — isolation entre tests
    });

    afterEach(async () => {
      await fs.rm(TMP_KIT, { recursive: true, force: true });
      await fs.rm(TMP_PROJECT, { recursive: true, force: true });
      if (savedSkipEnv !== undefined) process.env.KIT_MCP_SKIP_MANIFEST_CHECK = savedSkipEnv;
      else delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
      if (savedNoCacheEnv !== undefined) process.env.KIT_MCP_VERIFY_NO_CACHE = savedNoCacheEnv;
      else delete process.env.KIT_MCP_VERIFY_NO_CACHE;
      clearVerifyManifestCache();
    });
    ```
    Atualize import para incluir `clearVerifyManifestCache`:
    ```js
    import { verifyManifest, clearVerifyManifestCache } from '../../src/core/manifest-verify.js';
    ```

    **Test 1 — Parallel batched speedup (sanidade, não micro-benchmark):**
    O teste verifica que verifyManifest completa rapidamente em fixture com muitos files. NÃO faça assertion estrita de wall time (CI runners variam) — apenas sanity check + completude. Use 50-file fixture (scaling realístico para CI):
    ```js
    test('PERF-17-01: verifyManifest hashes 50 files via parallel batches', async () => {
      const files = {};
      for (let i = 0; i < 50; i++) {
        files[`agents/file-${i}.md`] = `# file ${i}\nconteudo ${i}\n`;
      }
      await buildFixtureKit(TMP_KIT, files);

      const t0 = Date.now();
      const r = await verifyManifest(TMP_KIT);
      const elapsed = Date.now() - t0;

      assert.equal(r.ok, true, 'expected ok=true with 50 intact files');
      // Generous bound — CI is slow. We're checking parallelization happened,
      // not measuring exact ms. Sequential 50 files would be > 200ms on slow disk;
      // batched=16 should easily fit under 500ms even on the worst CI runner.
      assert.ok(elapsed < 500, `expected < 500ms for 50 parallel files, got ${elapsed}ms`);
    });
    ```

    **Test 2 — Cache hit (2ª chamada consecutiva):**
    ```js
    test('PERF-17-01: 2nd consecutive call hits cache (TTL 30s, ok path)', async () => {
      await buildFixtureKit(TMP_KIT);

      // 1st call — full compute, primes cache
      const r1 = await verifyManifest(TMP_KIT);
      assert.equal(r1.ok, true);

      // Tamper a file — but DO NOT call clearVerifyManifestCache.
      // Cache should still serve stale ok=true result (TTL not expired).
      // This proves the cache is actually serving (not silently re-computing).
      await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

      const r2 = await verifyManifest(TMP_KIT);
      assert.equal(r2.ok, true, 'cache should serve stale ok=true within TTL');
    });
    ```

    **Test 3 — Cache invalidation: mismatch path NEVER caches:**
    ```js
    test('PERF-17-01: mismatch path is never cached (always recomputes)', async () => {
      await buildFixtureKit(TMP_KIT);
      // Tamper before first call
      await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

      // 1st call — mismatch, MUST NOT cache
      const r1 = await verifyManifest(TMP_KIT);
      assert.equal(r1.ok, false);

      // Fix the tamper — restore original content
      await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# foo\n', 'utf8');

      // 2nd call — must recompute (not serve cached r1). Should now be ok.
      const r2 = await verifyManifest(TMP_KIT);
      assert.equal(r2.ok, true, 'mismatch must not cache; 2nd call after fix should recompute and pass');
    });
    ```

    **Test 4 — Env bypass: KIT_MCP_VERIFY_NO_CACHE=1 forces recompute:**
    ```js
    test('PERF-17-01: KIT_MCP_VERIFY_NO_CACHE=1 forces recompute (read+write bypass)', async () => {
      await buildFixtureKit(TMP_KIT);

      // 1st call — primes cache
      const r1 = await verifyManifest(TMP_KIT);
      assert.equal(r1.ok, true);

      // Tamper file. Then set bypass env.
      await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');
      process.env.KIT_MCP_VERIFY_NO_CACHE = '1';

      // 2nd call with bypass — must recompute and detect tamper.
      const r2 = await verifyManifest(TMP_KIT);
      assert.equal(r2.ok, false, 'env bypass must skip cache and detect tamper');
      assert.match(r2.reason, /tampered/);
    });
    ```

    **Test 5 (BÔNUS) — CRLF→LF preservado:**
    Garantia explícita de que o normalize cross-platform não regrediu. Cria file com CRLF, manifest hash com LF, verify deve passar:
    ```js
    test('PERF-17-01: CRLF→LF normalize preserved (cross-platform stable)', async () => {
      // Manually build kit with CRLF content + LF-hashed manifest
      const lfContent = '# foo\nlinha 2\n';
      const crlfContent = '# foo\r\nlinha 2\r\n';
      const manifest = {
        version: 'test',
        timestamp: new Date().toISOString(),
        files: {
          'agents/foo.md': crypto.createHash('sha256').update(Buffer.from(lfContent)).digest('hex'),
        },
      };
      await fs.mkdir(path.join(TMP_KIT, 'agents'), { recursive: true });
      // Write file with CRLF — verify must normalize back to LF before hashing
      await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), crlfContent, 'utf8');
      await fs.writeFile(path.join(TMP_KIT, 'file-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

      const r = await verifyManifest(TMP_KIT);
      assert.equal(r.ok, true, 'CRLF file must hash equal to LF manifest after normalize');
    });
    ```

    **Coloque os 5 novos tests APÓS os 6 SEC-14-05 tests existentes (mesma file, append at end).**

    NÃO modifique os tests existentes (SEC-14-05 baseline preservado intocado).
  </action>
  <verify>
    <automated>node --test test/unit/manifest-verify.test.js 2>&1 | grep -E "# (pass|fail|tests) "</automated>
  </verify>
  <acceptance_criteria>
    - [ ] Import atualizado para incluir `clearVerifyManifestCache`
    - [ ] `beforeEach` adicionado save/clear de `KIT_MCP_VERIFY_NO_CACHE` + `clearVerifyManifestCache()`
    - [ ] `afterEach` restaura env var + clear cache
    - [ ] 5 novos tests adicionados (sanidade parallel, cache hit, mismatch invalidation, env bypass, CRLF→LF)
    - [ ] Todos os tests novos taggeados com `PERF-17-01:` no nome
    - [ ] Tests existentes (SEC-14-05) inalterados — estrutura beforeEach/afterEach preservada compatível
    - [ ] Suite total ≥ 317 + 5 novos = ≥322 passando
    - [ ] Zero flakiness — tests são determinísticos (sem timing-sensitive assertions)
  </acceptance_criteria>
  <done>
    Tests adicionados quando: (a) `node --test test/unit/manifest-verify.test.js` mostra ≥11 tests pass (6 SEC-14-05 + 5 PERF-17-01), (b) suite full (`npm test`) continua verde, (c) tests existentes inalterados, (d) env vars limpas em afterEach (sem state leak para outros tests).
  </done>
</task>

</tasks>

<verification>
**Suite-level checks após todas as tasks:**

1. `npm test` — full suite passing (≥317 baseline + 5 novos = ≥322)
2. `node --test test/unit/manifest-verify.test.js` — todos 11+ tests verdes
3. `node --test test/unit/sync.test.js` — sync.js (caller) inalterado, ainda passa
4. `node --test test/unit/sync-round-trip-all-targets.test.js` — E2E install path inalterado

**Spot-check manual de implementação:**

5. `grep -n "BATCH_SIZE = 16" src/core/manifest-verify.js` retorna 1 match
6. `grep -n "Promise.all" src/core/manifest-verify.js` retorna 1+ match
7. `grep -n "verifyManifestCache" src/core/manifest-verify.js` retorna 3+ matches (declaração, get, set)
8. `grep -n "KIT_MCP_VERIFY_NO_CACHE" src/core/manifest-verify.js` retorna 2+ matches (constante + checks)
9. `grep -n "replace(/\\\\r\\\\n/g, '\\\\n')" src/core/manifest-verify.js` retorna 1 match (CRLF→LF preserved)
10. `grep -n "PERF-17-01" test/unit/manifest-verify.test.js` retorna 5+ matches
</verification>

<success_criteria>
**Funcionais:**
- [ ] verifyManifest com 50+ files executa via Promise.all batches=16 (não for-loop sequencial)
- [ ] 2ª chamada consecutiva (dentro 30s) com mesmo kitRoot → cache hit (verificável: file tampered after 1st call still returns ok=true)
- [ ] mismatch path SEMPRE recomputa (não cacheia error)
- [ ] env `KIT_MCP_VERIFY_NO_CACHE=1` bypassa leitura E escrita do cache
- [ ] env `KIT_MCP_SKIP_MANIFEST_CHECK=1` continua tendo prioridade absoluta sobre cache
- [ ] CRLF→LF normalize preserved (test bonus garante)

**Qualidade:**
- [ ] Stable API v1.0+ inalterada — `verifyManifest()` retorna mesmo shape
- [ ] Phase 79.01 gates guard preservado (linha SKIP_ENV intocada)
- [ ] Phase 83 contract preservado (manifest format readout intocado)
- [ ] Zero novas dependências (budget 6/6 mantido)
- [ ] Zero novas env vars expostas ao usuário (NO_CACHE_ENV é interno test/dev)

**Performance esperada (não-bloqueante para suite, validado em meta-auditoria pós-fase):**
- verifyManifest 327 files: ≤74ms target (≥40% redução vs 123ms baseline)
- Cache hit: <5ms (Map.get + Date comparison)
</success_criteria>

<output>
After completion, create `.planning/phases/90-verify-manifest-parallel-cache/90-01-SUMMARY.md`
</output>
