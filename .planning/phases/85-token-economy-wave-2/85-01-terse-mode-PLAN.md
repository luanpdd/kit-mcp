---
phase: 85-token-economy-wave-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp-server/index.js
  - src/cli/index.js
  - test/unit/terse-mode.test.js
autonomous: true
requirements:
  - PERF-15-01

must_haves:
  truths:
    - "kit list-agents/list-commands/list-skills aceitam terse:true e retornam apenas {kind, name} (sem description)"
    - "CLI kit kit list-agents --terse produz mesmo payload reduzido que MCP terse=true"
    - "Default behavior (sem terse) inalterado — backward-compat preservada"
    - "Payload terse mensurado em corpus real é >=40% menor que default"
  artifacts:
    - path: "src/mcp-server/index.js"
      provides: "handleKit aceita args.terse; slim() variant terse retorna {kind, name}"
      contains: "args.terse"
    - path: "src/cli/index.js"
      provides: "list-agents/list-commands/list-skills aceitam --terse flag"
      contains: "--terse"
    - path: "test/unit/terse-mode.test.js"
      provides: "4 regression tests cobrindo MCP+CLI parity, shape, redução >=40%"
      min_lines: 80
  key_links:
    - from: "src/mcp-server/index.js"
      to: "slim() vs slimTerse() helper"
      via: "args.terse===true seleciona variant"
      pattern: "args\\.terse"
    - from: "src/cli/index.js"
      to: "src/mcp-server/index.js (paridade comportamental)"
      via: "ambos usam mesma slim()/slimTerse() helper OU CLI inline com mesma forma"
      pattern: "kind:\\s*x\\.kind,\\s*name:\\s*x\\.name"
---

<objective>
Adicionar suporte a parâmetro `terse: true` em `kit` action=list-agents/list-commands/list-skills (MCP) e flag `--terse` (CLI) que retornam apenas `{kind, name}` por item — sem `description`. Stable API v1.0+ preservada (default=false → comportamento atual com slim() cap 80).

Purpose: MCP clients que só precisam descobrir nomes (não descrições) recebem ~40-50% menos payload — economiza ~25 KB de descriptions por listagem em corpus full v1.14.

Output: Dois arquivos `src/` modificados (aditivo), arquivo de teste novo com 4 regressions, suite passando (273+ esperado).
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/85-token-economy-wave-2/85-CONTEXT.md
@src/mcp-server/index.js
@src/cli/index.js
@src/core/sync.js
@test/unit/slim-cap.test.js

<interfaces>
# Tipos/contratos em uso (extraídos via grep)

## src/core/sync.js (já existe — não tocar, só importar)
- `summarize(text)` → string, cap 80 chars (PERF-13-01)
- `SUMMARY_MAX_CHARS = 80` (constante exportada)

## src/core/kit.js (já existe — não tocar, só usar)
- `listKit()` → `{ agents, commands, skills, skillsExtras }` cada item tem `{kind, name, description, ...}`
- `findItem(kit, kind, name)` → item ou undefined

## src/mcp-server/index.js — slim() atual (linha ~300)
```js
function slim(x) {
  // PERF-13-01: trunca via summarize() (cap 80)
  return { kind: x.kind, name: x.name, description: summarize(x.description) };
}
```

## src/mcp-server/index.js — handleKit atual (linha ~153)
```js
async function handleKit(args) {
  const kit = await listKit();
  switch (args.action) {
    case 'list-agents':   return kit.agents.map(slim);
    case 'list-commands': return kit.commands.map(slim);
    case 'list-skills':   return [...kit.skills, ...kit.skillsExtras].map(slim);
    case 'get': { ... }
    case 'search': return searchKit(kit, args.query ?? '');
  }
}
```

## src/mcp-server/index.js — TOOLS[0] inputSchema (linha ~38)
```js
{
  name: 'kit',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list-agents', 'list-commands', 'list-skills', 'get', 'search'] },
      kind:   { type: 'string', enum: ['agent', 'command', 'skill'], description: 'For action=get' },
      name:   { type: 'string', description: 'For action=get' },
      query:  { type: 'string', description: 'For action=search' },
    },
    required: ['action'],
  },
}
```

## src/cli/index.js — slim() local (linha 150) + 3 commands (linhas 159-170)
```js
function slim(x) {
  return { kind: x.kind, name: x.name, description: summarize(x.description) };
}
kit.command('list-agents').action(async () => {
  const k = await withSpinner('Loading kit...', () => listKit());
  out(k.agents.map(slim), v => render.renderKitList(v, 'agent'));
});
// list-commands e list-skills idênticos em estrutura
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar terse mode ao MCP server (handleKit + schema)</name>
  <files>src/mcp-server/index.js</files>
  <read_first>
    Ler `src/mcp-server/index.js` linhas 34-167 (TOOLS[0] kit schema + handleKit) e linhas 300-307 (slim helper) para confirmar estrutura.
  </read_first>
  <action>
    Em `src/mcp-server/index.js`:

    **1. Adicionar `terse` ao schema do tool `kit` (TOOLS[0].inputSchema.properties)** — linha ~40-46:
    ```js
    properties: {
      action: { type: 'string', enum: ['list-agents', 'list-commands', 'list-skills', 'get', 'search'] },
      kind:   { type: 'string', enum: ['agent', 'command', 'skill'], description: 'For action=get' },
      name:   { type: 'string', description: 'For action=get' },
      query:  { type: 'string', description: 'For action=search' },
      terse:  { type: 'boolean', description: 'For action=list-*: omit description, return only {kind, name}. Default false (PERF-15-01).' },
    },
    ```
    Action enum NÃO muda — `terse` é flag aditiva (mesma surface, menos payload). Manter `required: ['action']` — terse default false.

    **2. Adicionar `slimTerse(x)` helper logo após `slim(x)` (linha ~307)**:
    ```js
    // PERF-15-01: terse variant — omits description entirely. Used when MCP client
    // only needs name discovery (e.g. populating UI lists, validating slug references).
    // Default action=list-* still returns description capped via slim()/summarize().
    function slimTerse(x) {
      return { kind: x.kind, name: x.name };
    }
    ```

    **3. Modificar `handleKit` (linha ~153) para selecionar variant baseado em `args.terse`**:
    ```js
    async function handleKit(args) {
      const kit = await listKit();
      // PERF-15-01: terse mode skips description payload entirely. Backward-compat:
      // args.terse undefined/false preserves slim()+summarize() cap-80 behavior.
      const variant = args.terse === true ? slimTerse : slim;
      switch (args.action) {
        case 'list-agents':   return kit.agents.map(variant);
        case 'list-commands': return kit.commands.map(variant);
        case 'list-skills':   return [...kit.skills, ...kit.skillsExtras].map(variant);
        case 'get': {
          const item = findItem(kit, args.kind, args.name);
          if (!item) return { error: `Not found: ${args.kind}/${args.name}` };
          return { kind: item.kind, name: item.name, absPath: item.absPath, content: item.content ?? item.skillContent };
        }
        case 'search': return searchKit(kit, args.query ?? '');
        default: return { error: `Unknown action: ${args.action}` };
      }
    }
    ```

    NOTA — POR QUÊ não tool variant separado (ex: `list-agents-terse`):
    Tool variant adiciona 3 enum values ao schema (cliente vê 8 actions em vez de 5). Param aditivo é menos surface, menos churn no schema, e composável (ex: futuro `verbose` flag adicional sem multiplicação). CONTEXT.md decision explícita.

    NOTA — POR QUÊ não export do slimTerse:
    `slim()` original também não é exportado — ambos são internos ao módulo. Reuso entre MCP/CLI feito por copy de helper (mesmo pattern do `slim` em cli/index.js linha 150).
  </action>
  <verify>
    <automated>
      node -e "import('./src/mcp-server/index.js').then(m => console.log('module loads ok'))"
    </automated>
    Schema válido (sem syntax error); module importa; handleKit retorna shape correto via inspeção manual.
  </verify>
  <done>
    - `src/mcp-server/index.js` tem `terse: { type: 'boolean', ... }` no TOOLS[0].inputSchema.properties
    - `slimTerse(x)` helper existe e retorna `{kind, name}` (zero description)
    - `handleKit` seleciona `slimTerse` quando `args.terse === true`, senão usa `slim` (default)
    - Action enum inalterado (5 values: list-agents, list-commands, list-skills, get, search)
    - Module ainda carrega sem erro (sintax check via `node -e`)
  </done>
</task>

<task type="auto">
  <name>Task 2: Adicionar --terse flag ao CLI + 4 regression tests</name>
  <files>src/cli/index.js, test/unit/terse-mode.test.js</files>
  <read_first>
    Ler `src/cli/index.js` linhas 150-170 (slim helper + 3 list commands) e `test/unit/slim-cap.test.js` integral para padrão de teste.
  </read_first>
  <action>
    **PARTE A — `src/cli/index.js`:**

    **1. Adicionar `slimTerse(x)` helper logo após `slim(x)` (linha ~155)** — paridade exata com mcp-server:
    ```js
    // PERF-15-01: terse variant — paridade com mcp-server slimTerse. CLI flag --terse
    // controla seleção. Mantém o mesmo shape {kind, name} para programmatic consumers
    // que parseiam --json output (consistência cross-surface).
    function slimTerse(x) {
      return { kind: x.kind, name: x.name };
    }
    ```

    **2. Modificar os 3 commands (linhas ~159-170) para aceitar `--terse`**:
    ```js
    kit.command('list-agents')
      .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
      .action(async (opts) => {
        const k = await withSpinner('Loading kit...', () => listKit());
        const variant = opts.terse ? slimTerse : slim;
        out(k.agents.map(variant), v => render.renderKitList(v, 'agent'));
      });
    kit.command('list-commands')
      .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
      .action(async (opts) => {
        const k = await withSpinner('Loading kit...', () => listKit());
        const variant = opts.terse ? slimTerse : slim;
        out(k.commands.map(variant), v => render.renderKitList(v, 'command'));
      });
    kit.command('list-skills')
      .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
      .action(async (opts) => {
        const k = await withSpinner('Loading kit...', () => listKit());
        const variant = opts.terse ? slimTerse : slim;
        out([...k.skills, ...k.skillsExtras].map(variant), v => render.renderKitList(v, 'skill'));
      });
    ```

    NOTA — POR QUÊ não tocar render.renderKitList:
    Renderer é human-readable (color panels). Receber items sem description só significa coluna vazia/omitida na render. `--terse` é primariamente para `--json` mode (programmatic). Render permanece tolerante a description ausente (`x.description ?? ''`). Se renderer já trata description ausente (verificar via Read antes de mexer), zero mudança em render. Caso renderer crashe com description undefined, adicione fallback `description: x.description ?? ''` no slimTerse — mas inspecione primeiro; teste atual de slim já passou com strings vazias então provavelmente OK.

    **PARTE B — `test/unit/terse-mode.test.js` (NOVO arquivo):**

    Criar com 4 testes (espelhando padrão de `test/unit/slim-cap.test.js`):

    ```js
    // PERF-15-01: regression test for terse mode in list-agents/list-commands/list-skills.
    // Validates payload reduction (>=40%), shape correctness (no description field),
    // backward-compat (default still returns description), and CLI/MCP parity.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { spawnSync } from 'node:child_process';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import { listKit } from '../../src/core/kit.js';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const REPO = path.resolve(__dirname, '..', '..');
    const CLI = path.join(REPO, 'bin', 'cli.js');

    test('PERF-15-01: terse shape is {kind, name} only (no description)', async () => {
      const kit = await listKit();
      // Espelha slimTerse() — não importa internal helper (não exportado por design),
      // valida o contrato observável.
      const terse = kit.agents.map(x => ({ kind: x.kind, name: x.name }));
      for (const item of terse) {
        assert.equal(typeof item.kind, 'string');
        assert.equal(typeof item.name, 'string');
        assert.equal(Object.keys(item).length, 2, `expected 2 keys, got ${Object.keys(item).join(',')}`);
        assert.ok(!('description' in item), 'terse must not include description');
      }
    });

    test('PERF-15-01: real corpus shows >=40% reduction in JSON payload (terse vs default)', async () => {
      const kit = await listKit();
      const items = [...kit.agents, ...kit.commands, ...kit.skills, ...kit.skillsExtras];
      assert.ok(items.length > 30, `expected >=30 items, got ${items.length}`);

      // Default (post-PERF-13-01): {kind, name, description: summarize(...)}
      const { summarize } = await import('../../src/core/sync.js');
      const defaultPayload = items.map(x => ({ kind: x.kind, name: x.name, description: summarize(x.description) }));
      // Terse: {kind, name}
      const tersePayload = items.map(x => ({ kind: x.kind, name: x.name }));

      const defaultBytes = Buffer.byteLength(JSON.stringify(defaultPayload), 'utf8');
      const terseBytes   = Buffer.byteLength(JSON.stringify(tersePayload),   'utf8');
      const reductionPct = ((defaultBytes - terseBytes) / defaultBytes) * 100;

      assert.ok(
        reductionPct >= 40,
        `PERF-15-01 acceptance: expected >=40% reduction; got ${reductionPct.toFixed(1)}% (default=${defaultBytes} terse=${terseBytes})`,
      );
      console.log(`[PERF-15-01] reduction: ${reductionPct.toFixed(1)}% (${defaultBytes} -> ${terseBytes} bytes across ${items.length} items)`);
    });

    test('PERF-15-01: CLI --terse flag produces same shape as MCP terse=true', () => {
      // Smoke spawn — `kit kit list-agents --terse --json` returns array of {kind, name}.
      const r = spawnSync(process.execPath, [CLI, 'kit', 'list-agents', '--terse', '--json'], {
        encoding: 'utf8',
        cwd: REPO,
      });
      assert.equal(r.status, 0, `CLI exited ${r.status}: stderr=${r.stderr}`);
      const items = JSON.parse(r.stdout);
      assert.ok(Array.isArray(items) && items.length > 0, 'expected non-empty array');
      for (const item of items) {
        assert.equal(Object.keys(item).length, 2, `terse item must have 2 keys, got: ${Object.keys(item).join(',')}`);
        assert.ok('kind' in item && 'name' in item, 'must have kind+name');
        assert.ok(!('description' in item), 'terse CLI must not include description');
      }
    });

    test('PERF-15-01: CLI without --terse keeps backward-compat (description present)', () => {
      // Default behavior — slim() with summarize() cap 80. description field present.
      const r = spawnSync(process.execPath, [CLI, 'kit', 'list-agents', '--json'], {
        encoding: 'utf8',
        cwd: REPO,
      });
      assert.equal(r.status, 0, `CLI exited ${r.status}: stderr=${r.stderr}`);
      const items = JSON.parse(r.stdout);
      assert.ok(items.length > 0);
      const sample = items[0];
      assert.ok('description' in sample, 'default mode must include description (backward-compat)');
      assert.ok('kind' in sample && 'name' in sample);
    });
    ```

    NOTA — POR QUÊ não testar handleKit() diretamente:
    `handleKit` não é exportado de mcp-server/index.js (apenas `createServer` e `startStdio`). Spawning um stdio MCP server num teste tem overhead. CLI spawn cobre o caminho equivalente — `kit kit list-agents --terse` chama o mesmo `listKit()` + `slimTerse()` que MCP via paridade dos helpers. Para verificação manual MCP, usuário pode rodar `node bin/mcp.js` e enviar JSON-RPC `tools/call` — não é teste automatizado.

    NOTA — POR QUÊ spawnSync e não import direto do CLI:
    CLI é entry-point com side effect `program.parseAsync(process.argv)` na linha 709. Importar como módulo dispara parsing. Spawn isola test; mesmo padrão de `test/integration/cli-roundtrip.test.js`.
  </action>
  <verify>
    <automated>
      node --test test/unit/terse-mode.test.js
    </automated>
    4 testes passam; >=40% reduction comprovada em corpus real; backward-compat verificada via CLI roundtrip.
  </verify>
  <done>
    - `src/cli/index.js` tem `slimTerse()` helper (paridade exata com mcp-server)
    - 3 commands (`list-agents`, `list-commands`, `list-skills`) têm `--terse` option e selecionam variant
    - `test/unit/terse-mode.test.js` existe com 4 testes:
      1. terse shape é exatamente `{kind, name}` (sem description)
      2. corpus real demonstra >=40% redução (PERF-15-01 acceptance)
      3. CLI `--terse --json` produz shape correto (paridade)
      4. CLI sem `--terse` mantém description (backward-compat)
    - `node --test test/unit/terse-mode.test.js` passa 4/4
    - Suite total continua 273+ tests passando (sem regressão)
  </done>
</task>

</tasks>

<verification>
**Final phase-level checks (Plan 1):**

1. **Schema/module health:**
   ```
   node -e "import('./src/mcp-server/index.js').then(m => console.log('mcp ok')); import('./src/cli/index.js').catch(() => console.log('cli ok (entry-point side effect)'))"
   ```

2. **Terse mode regression suite:**
   ```
   node --test test/unit/terse-mode.test.js
   ```
   Espera: 4/4 pass.

3. **Full suite (sem regressão):**
   ```
   node --test test/unit/*.test.js test/integration/*.test.js
   ```
   Espera: 273 baseline + 4 novos = 277+ pass, 0 fail (2 skipped pre-existing OK).

4. **CLI smoke direto (paridade visual):**
   ```
   node bin/cli.js kit list-agents --terse --json | head -3
   node bin/cli.js kit list-agents --json | head -3
   ```
   Espera: primeiro output sem `"description"`, segundo com `"description": "<<=80 chars>>"`.

5. **MCP smoke (manual — opcional):** start `node bin/mcp.js`, send `{"method":"tools/call","params":{"name":"kit","arguments":{"action":"list-agents","terse":true}}}` via stdio — payload deve não conter `"description"`.
</verification>

<success_criteria>
- `terse: true` é flag aditiva no schema MCP (default false → comportamento atual)
- `--terse` é flag aditiva no CLI (default ausente → comportamento atual)
- Payload terse é >=40% menor que default em corpus real (kit-mcp v1.14, ~30+ items)
- CLI e MCP retornam shape idêntico `{kind, name}` (paridade cross-surface)
- 4 regression tests novos em `test/unit/terse-mode.test.js` todos passam
- Suite full continua passando (273 baseline → 277+ esperado, 0 fails)
- Stable API v1.0+ preservada (zero breaking — flag aditiva)
- Budget 6/6 deps mantido (zero novas deps)
</success_criteria>

<output>
After completion, create `.planning/phases/85-token-economy-wave-2/85-01-SUMMARY.md` documenting:
- Mudanças exatas (schema diff, helper adicionado, commands modificados)
- Resultado da medição PERF-15-01 (% redução em corpus real)
- Suite count (antes/depois)
- Edge cases descobertos (renderKitList behavior com description ausente, etc)
</output>
</content>
</invoke>