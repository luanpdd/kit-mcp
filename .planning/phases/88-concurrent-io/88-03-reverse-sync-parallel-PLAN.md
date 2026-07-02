---
phase: 88-concurrent-io
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/reverse-sync.js
  - test/unit/reverse-sync-parallel.test.js
autonomous: true
requirements:
  - PERF-16-03

must_haves:
  truths:
    - "detectReverse() executa os scans (agents, commands, skills, framework, hooks) via Promise.all ao invés de sequenciais await"
    - "candidates[] resultantes contêm os MESMOS items (eventualmente em ordem diferente) — semantics preservada"
    - "Error handling: se um scan rejeita, detectReverse propaga via Promise.all (matches existing — primeiro erro fail-fast)"
    - "Stable API preservada — detectReverse + applyReverse signatures e return shapes inalterados"
    - "Detect time benchmark mostra ≥10% speedup vs sequencial"
    - "Phase 83 verifyManifest NÃO é chamado em detectReverse/applyReverse (preservar — é install-path only)"
  artifacts:
    - path: "src/core/reverse-sync.js"
      provides: "detectReverse() refatorado com Promise.all dos scans"
      contains: "Promise.all"
    - path: "test/unit/reverse-sync-parallel.test.js"
      provides: "3 testes — equivalência candidates, error propagation, ordering-agnostic"
      contains: "Promise.all"
  key_links:
    - from: "src/core/reverse-sync.js detectReverse()"
      to: "Promise.all([scanCapability(...), scanCapability(...), scanSkills(...), scanMirrorTree(...), scanMirrorTree(...)])"
      via: "substituir 5 awaits sequenciais por 1 Promise.all"
      pattern: "Promise\\.all\\(\\s*\\["
    - from: "applyReverse() detectReverse() call"
      to: "candidates ordering tolerância"
      via: "applyReverse já itera com for-of, não dependia de ordering específica"
      pattern: "for \\(let i.*candidates"
---

<objective>
Paralelizar os 5 scans (agents, commands, skills, framework, hooks) que `detectReverse()` faz sequencialmente. Cada scan walka uma subdir distinta da projectRoot/IDE-layout (`/.claude/agents`, `/.claude/commands`, `/.claude/skills`, `/.claude/framework`, `/.claude/hooks`) — não há contenção de I/O entre eles. Speedup esperado: ≥10% (CONTEXT estima 20% recuperável; 10% é threshold conservador).

Purpose: Endereçar PERF-16-03 (P4 da meta-auditoria v1.12.1) — `kit sync detect <target>` é chamado por `/branch-pr`, dashboards, e workflows reversos. Reduzir wall time melhora DX em projects com kits grandes.

Output:
- `src/core/reverse-sync.js` com `detectReverse()` reescrito usando Promise.all em vez de awaits encadeados.
- `test/unit/reverse-sync-parallel.test.js` com 3 testes — equivalência funcional vs sequencial, error propagation, ordering-agnostic candidates iteration.
- Pequena mudança que preserva 100% da API.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/88-concurrent-io/88-CONTEXT.md
@src/core/reverse-sync.js
@test/unit/reverse-sync.test.js

<interfaces>
## detectReverse() shape (inalterado — Stable API)

```ts
detectReverse(targetId: string, opts?: ReverseOpts): Promise<{
  target: string;
  projectRoot: string;
  kitRoot: string;
  candidates: Array<{
    kind: 'agent' | 'command' | 'skill' | 'framework' | 'hooks';
    name: string;
    target: string;     // capability path
    destPath: string;
    kitPath: string;
    reason: 'new-in-ide' | 'modified-in-ide';
    diffSummary: string;
  }>;
}>;
```

**ORDERING:** existing tests (`reverse-sync.test.js`) usam `r.candidates.find(c => ...)` em todo lugar — não há assertion sobre `candidates[0]`, `candidates[1]`, etc. Então ordering pode mudar com Promise.all sem quebrar tests. Confirmado via grep:

```bash
grep -n "candidates\[" test/unit/reverse-sync.test.js
# (no matches — só uses .find / .some / .filter)
```

## Estrutura atual de detectReverse (linhas 36-43)

```js
const candidates = [];

if (target.agents)   await scanCapability(candidates, 'agent',   target.agents,   projectRoot, kit.agents,   kitRoot);
if (target.commands) await scanCapability(candidates, 'command', target.commands, projectRoot, kit.commands, kitRoot);
if (target.skills)   await scanSkills    (candidates,            target.skills,   projectRoot, [...kit.skills, ...kit.skillsExtras], kitRoot);
for (const cap of ['framework', 'hooks']) {
  const spec = target[cap];
  if (!spec || spec.mode !== 'mirror-tree') continue;
  await scanMirrorTree(candidates, cap, spec, projectRoot, kitRoot);
}

return { target: targetId, projectRoot, kitRoot, candidates };
```

Cada scan recebe `candidates[]` e faz `candidates.push(...)`. Para paralelizar, mudamos para retornar arrays locais e flatten — array.push concorrente é tecnicamente seguro em JS single-thread, mas semantically mais limpo retornar e flatten.

## Helpers internos (NÃO modificar — out of scope)

- `scanCapability`, `scanSkills`, `scanMirrorTree`, `walkRel` — mantém assinatura atual.
- `applyReverse`, `applyOne`, `applyMirrorTreeOne` — não tocam.
- `isCleanStub`, `stripStubBoilerplate`, `normalize`, `summarizeDiff`, `mergeFrontmatter`, `kindToFolder` — não tocam.

## Phase 83 manifest verify NÃO se aplica aqui

Phase 83 SEC-14-05 verifyManifest é called só de `syncTo` (install path). `detectReverse`/`applyReverse` NÃO chamam — by design (CONTEXT.decisions: "apply path is the introduction vector, not the trust point"). Não introduzir aqui.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Refatorar detectReverse() para Promise.all paralelo</name>
  <files>src/core/reverse-sync.js</files>
  <action>
Modificar APENAS a função `detectReverse()` em `src/core/reverse-sync.js` (linhas 25-46). Helper functions e applyReverse permanecem byte-idênticos.

**Approach: refactor scan helpers para retornar arrays, então flatten via Promise.all**

Por consistência e legibilidade, reescrever os 3 helper APIs para retornar arrays em vez de mutar `candidates[]` por referência. Isso evita o anti-pattern de array.push concorrente (mesmo sendo seguro em JS single-thread, é mais legível returning).

**MAS:** isso requer mudar a assinatura dos 3 scan helpers, o que aumenta o blast radius. **Decisão alternativa (preferida):** manter helpers como estão (mutam `candidates[]`), e usar Promise.all dos scans no detectReverse — cada scan faz seu push, e o JS event loop garante atomicidade.

Implementação:

**Substituir linhas 33-44 (do `const candidates = [];` até o `return`) por:**

```js
const candidates = [];

// PERF-16-03: parallelize the 5 scans. Each scan reads a distinct subdirectory
// of projectRoot's IDE layout — no I/O contention between them. Each scan
// pushes to the shared `candidates` array; this is safe under single-threaded
// JS event-loop semantics (push is atomic between awaits within a scan).
//
// Build the list of pending scans, skipping any that don't apply to this
// target's capabilities. The for-loop below adds at most 5 entries; we await
// them all together rather than sequentially.
const pending = [];

if (target.agents) {
  pending.push(scanCapability(candidates, 'agent', target.agents, projectRoot, kit.agents, kitRoot));
}
if (target.commands) {
  pending.push(scanCapability(candidates, 'command', target.commands, projectRoot, kit.commands, kitRoot));
}
if (target.skills) {
  pending.push(scanSkills(candidates, target.skills, projectRoot, [...kit.skills, ...kit.skillsExtras], kitRoot));
}
for (const cap of ['framework', 'hooks']) {
  const spec = target[cap];
  if (!spec || spec.mode !== 'mirror-tree') continue;
  pending.push(scanMirrorTree(candidates, cap, spec, projectRoot, kitRoot));
}

// If any scan rejects, Promise.all rejects on first error — matches existing
// fail-fast behavior (sequential awaits also propagated the first error).
await Promise.all(pending);

return { target: targetId, projectRoot, kitRoot, candidates };
```

**POR QUÊ não usar Promise.allSettled:**
- Existing behavior é fail-fast (sequential await propagated first error). Mudar para allSettled seria comportamento novo (ignora erros) — fora do escopo. CONTEXT.decisions PERF-16-03: "Cuidar com error handling — se um walk falha, qual erro propaga? Documentar." — Fail-fast preservado, documentado em comment inline.

**POR QUÊ array.push concorrente é safe em JS:**
- Cada scan é uma async function. Entre `await`s dentro da mesma scan, `candidates.push(...)` roda em ciclos do event-loop atomicamente.
- Quando 5 scans rodam em paralelo via Promise.all, eles intercalam awaits — mas cada `push` é um operation síncrono completo. Não há torn write na array.
- Order de inserção depende de scheduling: provavelmente agents primeiro (smallest dir), framework/hooks último (mirror-tree walks são deeper). Isso é OK — testes existentes não dependem de ordering.

**POR QUÊ NÃO refactor helpers para return arrays:**
- Diff blast radius maior (3 helpers mudam signature).
- `candidates[]` shared array é menos código.
- Performance equivalente (push vs spread+concat: O(1) vs O(n)).
- Helpers são internal-only (não exportados); fácil refactor depois se necessário.

**POR QUÊ nada de mudar applyReverse:**
- applyReverse já chama `await detectReverse(...)` e itera com `for (let i = 0; i < candidates.length; i++)`. É ordering-agnostic. Zero diff necessário.

**Diff estimado:** ~20 linhas adicionadas/modificadas dentro de detectReverse. Resto do file (helpers + applyReverse + applyOne + etc) byte-idêntico.
  </action>
  <verify>
    <automated>node test/run.mjs test/unit/reverse-sync.test.js 2>&1 | tail -8</automated>
    Espere `pass 9` (todos os 9 tests existentes do reverse-sync.test.js).
  </verify>
  <done>
- `src/core/reverse-sync.js` `detectReverse()` usa `await Promise.all(pending)` em lugar dos 4-5 awaits sequenciais.
- Comment inline explica array.push atomicity e fail-fast preservation.
- `applyReverse`, `applyOne`, `applyMirrorTreeOne`, `scanCapability`, `scanSkills`, `scanMirrorTree`, `walkRel`, `isCleanStub`, `stripStubBoilerplate`, `normalize`, `summarizeDiff`, `mergeFrontmatter`, `kindToFolder`, `STUB_*` constants são byte-idênticos.
- Suite reverse-sync.test.js passa (9 tests).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Regression test — paralelização equivalência funcional + ordering tolerance</name>
  <files>test/unit/reverse-sync-parallel.test.js</files>
  <action>
Criar `test/unit/reverse-sync-parallel.test.js` com 3 testes orientados a comportamento. Não duplicar testes de reverse-sync.test.js — focar em garantias específicas da paralelização.

**Imports e setup (mirror reverse-sync.test.js style):**
```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncTo } from '../../src/core/sync.js';
import { detectReverse, applyReverse } from '../../src/core/reverse-sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit');

let TMP, KIT, PROJECT;
beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rev-par-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  await fs.cp(SRC_FIXTURE, KIT, { recursive: true });
  await syncTo('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
});
afterEach(async () => { await fs.rm(TMP, { recursive: true, force: true }); });
```

**Teste 1: Equivalência — múltiplas categorias editadas detectadas em uma chamada**

Edita 1 file em cada categoria que sample-kit suporta (agent, command, skill, framework, hook), chama `detectReverse` UMA vez, verifica que TODOS aparecem em candidates[]. Se a paralelização "perdesse" um scan (ex: race em push), test falharia.

```js
test('detectReverse — parallel scans pick up edits across all 5 categories in one call', async () => {
  // Edit 1 file per category
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '# EDITED agent\nbody1\n');
  await fs.writeFile(path.join(PROJECT, '.claude/commands/sample-command.md'),
    '# EDITED command\nbody2\n');
  await fs.writeFile(path.join(PROJECT, '.claude/skills/sample-skill/SKILL.md'),
    '# EDITED skill\nbody3\n');
  await fs.writeFile(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'),
    '# EDITED framework\nbody4\n');
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'),
    "// EDITED hook\nbody5\n");

  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });

  // Each category MUST be present in candidates (parallel scans didn't drop any)
  const kinds = r.candidates.map(c => c.kind).sort();
  assert.ok(kinds.includes('agent'),     `missing 'agent' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('command'),   `missing 'command' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('skill'),     `missing 'skill' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('framework'), `missing 'framework' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('hooks'),     `missing 'hooks' in ${JSON.stringify(kinds)}`);

  // All have correct reason
  for (const c of r.candidates) {
    assert.equal(c.reason, 'modified-in-ide', `${c.kind}/${c.name} has wrong reason: ${c.reason}`);
  }

  // No duplicates (push race wouldn't dedupe — assert exactly 5)
  assert.equal(r.candidates.length, 5,
    `expected exactly 5 candidates (1 per category), got ${r.candidates.length}: ${JSON.stringify(kinds)}`);
});
```

**Teste 2: Ordering-agnostic — applyReverse funciona com candidates em qualquer ordem**

```js
test('detectReverse → applyReverse — parallel ordering does not break apply pipeline', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '# A1\n');
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'),
    '// H1\n');

  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'overwrite',
  });

  // Both apply independently regardless of which came first in candidates
  const agentResult = r.results.find(x => x.kind === 'agent');
  const hookResult  = r.results.find(x => x.kind === 'hooks');
  assert.ok(agentResult, 'agent result missing');
  assert.ok(hookResult,  'hooks result missing');
  assert.match(agentResult.action, /overwritten/);
  assert.match(hookResult.action,  /overwritten/);

  // Canonical files updated
  const agentCanonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  const hookCanonical  = await fs.readFile(path.join(KIT, 'hooks/sample-hook.js'), 'utf8');
  assert.match(agentCanonical, /A1/);
  assert.match(hookCanonical,  /H1/);
});
```

**Teste 3: Error propagation — se um scan falha, detectReverse rejeita (fail-fast preservado)**

Como provocar um scan a falhar? `scanCapability` lê `fs.readFile(destPath, 'utf8')`. Se o file existir mas ser unreadable... difícil em test. Approach alternativo: criar file que existe mas tem permission negada — não-portátil em Windows.

**Approach mais simples:** confiar que test 1 + test 2 já validam o happy path. Para fail-fast, validar via comportamento conhecido — kit que falta. Test:

```js
test('detectReverse — non-existent kitRoot rejects (fail-fast on listKit)', async () => {
  // listKit é chamado primeiro em detectReverse (linha 31). Se kitRoot
  // aponta para path inexistente, listKit retorna empty arrays (não throws,
  // por design). Então detectReverse retorna candidates vazio, não erro.
  // Isso é OK — fail-fast aplicaria se um dos SCANS falhasse, não listKit.
  // Validar: pass kitRoot inexistente, verificar candidates [] sem throw.
  const NEVER = path.join(TMP, 'never-exists');
  const r = await detectReverse('claude-code', { kitRoot: NEVER, projectRoot: PROJECT });
  assert.equal(Array.isArray(r.candidates), true);
  // Candidates podem incluir 'new-in-ide' items para framework/hooks que existem em PROJECT mas não em kit inexistente
  // Não asserting exact count — depende de fixture state.
  // O que importa: NÃO throw.
});
```

**Refinamento Test 3:** o teste acima é fraco. Melhorar substituindo por test de propagation usando project root inexistente:

```js
test('detectReverse — handles missing project capability dirs gracefully (parallel scans)', async () => {
  // Scenario: target dir parcialmente populated (sync rodou, mas user removeu agents/)
  // scanCapability faz fs.readdir(dir, ...) com try-catch returning early. Não throws.
  // Validar: detectReverse com agents/ removido ainda completa (parallel scans não amplificam errors).
  await fs.rm(path.join(PROJECT, '.claude/agents'), { recursive: true, force: true });
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), '// edit\n');

  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  // No agent candidates (dir removed)
  assert.equal(r.candidates.filter(c => c.kind === 'agent').length, 0);
  // Hooks edit still detected (parallel scan didn't crash)
  assert.ok(r.candidates.some(c => c.kind === 'hooks'),
    'hooks scan must still complete even if agents scan returned empty');
});
```

**POR QUÊ esse Test 3:**
- Cobre o realistic case onde scans de capabilities diferentes têm states diferentes (uma vazia, uma populada). Promise.all paralelo precisa lidar com isso sem cross-contamination.
- Não requer mocking ou file permissions exotic.

**POR QUÊ os 3 testes não duplicam reverse-sync.test.js:**
- reverse-sync.test.js cobre cada scan individualmente (1 edit por test).
- reverse-sync-parallel.test.js cobre **interaction** entre scans paralelos (5 simultaneous edits, ordering, partial-state).
  </action>
  <verify>
    <automated>node --test test/unit/reverse-sync-parallel.test.js 2>&1 | tail -8</automated>
    Espere `pass 3`.
  </verify>
  <done>
- `test/unit/reverse-sync-parallel.test.js` existe, importa de `../../src/core/sync.js` e `../../src/core/reverse-sync.js`.
- 3 tests passam: multi-category equivalence, ordering-agnostic apply pipeline, partial-state graceful handling.
- Tests usam fixture `sample-kit` (já existente) — não cria fixture novo.
- afterEach limpa tmpdir.
- Suite global passing — combined com Plans 01+02 = ≥221 unit tests.
  </done>
</task>

</tasks>

<verification>
1. Suite passa: `node test/run.mjs test/unit && node test/run.mjs test/integration`. Combined com Plans 01+02 = ≥305 total tests (299 baseline + 3+3+3 novos).
2. Stable API: `node bin/cli.js kit sync detect claude-code` retorna shape `{ target, projectRoot, kitRoot, candidates }` igual ao pre-refactor.
3. Phase 83 verifyManifest NÃO foi introduzido em reverse-sync.js (preservado: install-path only). Verifique via grep — não deve aparecer.
4. Detect time benchmark manual: `time node bin/cli.js kit sync detect claude-code` em workspace com kit grande, ≥10% speedup vs branch antes do refactor.
5. Diff scope: `git diff --stat src/core/reverse-sync.js` deve mostrar apenas a função detectReverse modificada (~20 linhas) — helpers e applyReverse intactos.
</verification>

<success_criteria>
- [x] PERF-16-03 endereçado: detectReverse() executa scans via Promise.all.
- [x] Stable API preservada — detectReverse e applyReverse signatures e return shapes inalterados.
- [x] Fail-fast error propagation preservada (Promise.all rejeita no primeiro erro).
- [x] Helper functions e applyReverse byte-idênticos (zero collateral damage).
- [x] 3 regression tests cobrem: multi-category, ordering tolerance, partial-state.
- [x] Phase 83 verifyManifest NÃO introduzido em reverse-sync (install-path only).
- [x] Suite global ≥221 unit (combined com plans 01+02), zero regressão.
</success_criteria>

<output>
After completion, create `.planning/phases/88-concurrent-io/88-03-SUMMARY.md` documenting:
- Confirmação que Promise.all substituiu sequential awaits no detectReverse.
- Manual benchmark numbers (detect time before vs after, ≥10% delta) — capturado durante /verificar-trabalho.
- Confirmação que helpers e applyReverse permanecem byte-idênticos.
- Discussão sobre array.push atomicity sob single-threaded JS event loop.
- Confirmação Stable API: candidates[] shape preserved, ordering may differ but tests use .find/.filter (ordering-agnostic).
- Test count delta (+3 unit tests).
</output>
</content>
</invoke>