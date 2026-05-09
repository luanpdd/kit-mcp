---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 02
plan_id: 80.02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp-server/index.js
  - src/cli/index.js
  - test/unit/slim-cap.test.js
autonomous: true
requirements:
  - PERF-13-01
must_haves:
  truths:
    - "Listing de tools via MCP retorna descrições truncadas em ≤80 chars com sufixo ellipsis"
    - "Comportamento idêntico ao summarize() de src/core/sync.js:261 (single source of truth do cap)"
    - "Listing de kit via CLI (kit list-agents/commands/skills) também aplica cap (consistência cross-surface)"
    - "Redução de payload mensurável em pelo menos 10% em corpus do próprio kit-mcp"
  artifacts:
    - path: "src/mcp-server/index.js"
      provides: "slim() aplica SUMMARY_MAX_CHARS=80 em description"
      contains: "summarize"
    - path: "src/cli/index.js"
      provides: "slim() aplica SUMMARY_MAX_CHARS=80 em description (mesma fonte)"
      contains: "summarize"
    - path: "test/unit/slim-cap.test.js"
      provides: "Regression test PERF-13-01 medindo redução real e correctness do cap"
  key_links:
    - from: "src/mcp-server/index.js"
      to: "src/core/sync.js#summarize"
      via: "import shared helper (não duplicar SUMMARY_MAX_CHARS)"
      pattern: "import.*summarize.*from.*sync"
    - from: "src/cli/index.js"
      to: "src/core/sync.js#summarize"
      via: "mesmo import compartilhado"
      pattern: "import.*summarize.*from.*sync"
---

<objective>
Eliminar duplicação de descrições completas em respostas de `list-agents`,
`list-commands`, `list-skills` (tanto via MCP server quanto via CLI). A
descrição completa já vive no arquivo de cada item em `kit/`; reservá-la
em cada resposta de listing duplica tokens em toda sessão Claude Code.

O helper `summarize()` em `src/core/sync.js:261` já implementa o cap
correto (SUMMARY_MAX_CHARS=80 + sufixo `…`). Esta tarefa apenas:
1. Exporta `summarize` de `sync.js` (atualmente é função-módulo privada)
2. Aplica em `slim()` de `src/mcp-server/index.js:257` e
   `src/cli/index.js:150`
3. Mede e valida a redução

Purpose: PERF-13-01 — reduzir ≥10% no payload de descrição de listings.
Auditoria estima 30k tokens/sessão recuperáveis; este plan captura o
componente single-largest (T1).

Output:
- summarize() exportado de sync.js
- slim() em ambos os surfaces (MCP + CLI) usando summarize()
- Test de unit medindo redução real em corpus do kit-mcp + correctness do cap
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-CONTEXT.md

# Targets de modificação
@src/mcp-server/index.js
@src/cli/index.js

# Referência canônica do cap (já implementada)
@src/core/sync.js

# Test runner
@test/run.mjs
@test/unit/replays-path-traversal.test.js

# Interfaces:
# Em src/core/sync.js linha 260-266 já existe:
#   const SUMMARY_MAX_CHARS = 80;
#   function summarize(desc) {
#     if (!desc) return '';
#     const flat = desc.replace(/\s+/g, ' ').trim();
#     if (flat.length <= SUMMARY_MAX_CHARS) return flat;
#     return flat.slice(0, SUMMARY_MAX_CHARS - 1) + '…';
#   }
#
# Em src/mcp-server/index.js linha 257-261:
#   function slim(x) {
#     return { kind: x.kind, name: x.name, description: x.description };
#   }
# Callsites: linhas 133-135 (case 'list-agents', 'list-commands', 'list-skills')
#
# Em src/cli/index.js linha 150-152:
#   function slim(x) {
#     return { kind: x.kind, name: x.name, description: x.description };
#   }
# Callsites: linhas 158, 162, 166

# CRÍTICO: o `summarize()` atual em sync.js NÃO é exportado. A primeira
# tarefa precisa exportá-lo (e SUMMARY_MAX_CHARS) para reuso em mcp-server
# e cli. Não duplicar a constante — reusar.
</context>

<tasks>

<task type="auto" id="1">
  <name>Tarefa 1: Export summarize() and SUMMARY_MAX_CHARS from src/core/sync.js</name>
  <read_first>
    - src/core/sync.js (linhas 256-267 — definição de SUMMARY_MAX_CHARS e summarize)
    - src/core/sync.js (top do arquivo — verificar exports atuais)
  </read_first>
  <files>src/core/sync.js</files>
  <action>
  Modificar `src/core/sync.js` para exportar `summarize` e `SUMMARY_MAX_CHARS`:

  1. Localizar a linha 260 atual (`const SUMMARY_MAX_CHARS = 80;`).
  2. Trocar para `export const SUMMARY_MAX_CHARS = 80;`
  3. Localizar a linha 261 atual (`function summarize(desc) {`).
  4. Trocar para `export function summarize(desc) {`

  NÃO modificar o corpo da função — comportamento runtime DEVE ser
  idêntico (zero regressão em quem já consome internamente).

  Verificar que callsites internos em sync.js (procurar `summarize(`) ainda
  funcionam — referências locais a função exportada continuam válidas em
  ESM.
  </action>
  <acceptance_criteria>
    ```bash
    grep -E "^export const SUMMARY_MAX_CHARS = 80" src/core/sync.js
    ```
    Deve retornar 1 linha.

    ```bash
    grep -E "^export function summarize\(desc\)" src/core/sync.js
    ```
    Deve retornar 1 linha.

    Smoke parse:
    ```bash
    node -c src/core/sync.js
    ```
    Exit code 0.

    Suite continua verde (zero regressão em sync):
    ```bash
    npm test
    ```
    Exit code 0; testes de sync (`test/unit/sync.test.js`) ainda passam.
  </acceptance_criteria>
  <done>summarize e SUMMARY_MAX_CHARS exportados; sync.js parsea; sync.test.js continua verde.</done>
</task>

<task type="auto" id="2">
  <name>Tarefa 2: Apply summarize() in slim() of src/mcp-server/index.js</name>
  <read_first>
    - src/mcp-server/index.js (linhas 1-30 — imports atuais; verificar se sync.js já é importado)
    - src/mcp-server/index.js (linhas 130-140 — callsites de slim em case list-*)
    - src/mcp-server/index.js (linhas 255-261 — definição atual de slim)
  </read_first>
  <files>src/mcp-server/index.js</files>
  <action>
  1. **Adicionar import:** no top do arquivo (junto com outros imports
     `from '../core/...'`), adicionar:
     ```js
     import { summarize } from '../core/sync.js';
     ```
     Se já houver outro import de `'../core/sync.js'`, ADICIONAR
     `summarize` à lista named — não criar import duplicado.

  2. **Modificar slim()** (linha 257-261 atual):
     ```js
     function slim(x) {
       // PERF-13-01 (TOK-02): truncar description em SUMMARY_MAX_CHARS via
       // summarize() compartilhado de src/core/sync.js — descrição completa
       // vive no arquivo de cada item em kit/ (acessível via kit get/action=get).
       // absPath omitted by design — list-* tools are AI-consumed in tight context budgets.
       return { kind: x.kind, name: x.name, description: summarize(x.description) };
     }
     ```

  NÃO modificar nenhum outro lugar do arquivo. Os callsites em linhas
  133-135 (`kit.agents.map(slim)` etc.) continuam idênticos — só o que
  `slim` retorna mudou.
  </action>
  <acceptance_criteria>
    Import existe:
    ```bash
    grep -E "^import \{[^}]*summarize[^}]*\} from ['\"](\\.\\./)?core/sync\\.(js|mjs)['\"]" src/mcp-server/index.js
    ```
    Deve retornar 1 linha.

    slim() chama summarize:
    ```bash
    grep -E "description:\s*summarize\(x\.description\)" src/mcp-server/index.js
    ```
    Deve retornar 1 linha.

    Smoke parse:
    ```bash
    node -c src/mcp-server/index.js
    ```
    Exit code 0.

    Smoke runtime — bootear MCP server e listar tools:
    ```bash
    timeout 5 node bin/cli.js kit list-agents 2>&1 | head -3
    ```
    Output válido (nomes de agents listados, sem erro de import).

    Suite verde:
    ```bash
    npm test
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>slim() em mcp-server aplica summarize; import correto; smoke runtime passa; suite verde.</done>
</task>

<task type="auto" id="3">
  <name>Tarefa 3: Apply summarize() in slim() of src/cli/index.js</name>
  <read_first>
    - src/cli/index.js (linhas 1-30 — imports atuais)
    - src/cli/index.js (linhas 145-170 — slim e seus callsites)
  </read_first>
  <files>src/cli/index.js</files>
  <action>
  Mesmas mudanças da Tarefa 2 mas em `src/cli/index.js`:

  1. **Adicionar import** (top do arquivo):
     ```js
     import { summarize } from '../core/sync.js';
     ```
     Se já houver import de `'../core/sync.js'`, adicionar `summarize` à
     named list existente.

  2. **Modificar slim()** (linha 150-152 atual):
     ```js
     function slim(x) {
       // PERF-13-01: cap description ao SUMMARY_MAX_CHARS shared helper.
       return { kind: x.kind, name: x.name, description: summarize(x.description) };
     }
     ```

  Razão para aplicar também na CLI: consistência cross-surface — CLI usa o
  mesmo `slim()` localmente; sem o cap, `kit list-agents` exibiria
  descrições longas no terminal enquanto o MCP server retornaria curtas.
  Comportamento divergente em surfaces seria armadilha para o usuário.

  NÃO modificar outras partes do arquivo. Os callsites em 158, 162, 166
  continuam idênticos.
  </action>
  <acceptance_criteria>
    Import existe:
    ```bash
    grep -E "^import \{[^}]*summarize[^}]*\} from ['\"](\\.\\./)?core/sync\\.(js|mjs)['\"]" src/cli/index.js
    ```
    Deve retornar 1 linha.

    slim() chama summarize:
    ```bash
    grep -E "description:\s*summarize\(x\.description\)" src/cli/index.js
    ```
    Deve retornar 1 linha.

    Smoke parse:
    ```bash
    node -c src/cli/index.js
    ```
    Exit code 0.

    Smoke runtime — listar agents e validar truncamento:
    ```bash
    node bin/cli.js kit list-agents --json 2>&1 | head -1
    ```
    Output JSON válido sem erro de import.

    Suite verde:
    ```bash
    npm test
    ```
    Exit code 0.
  </acceptance_criteria>
  <done>slim() em CLI aplica summarize; smoke runtime passa; suite verde.</done>
</task>

<task type="auto" id="4">
  <name>Tarefa 4: Unit test for cap correctness + payload reduction measurement</name>
  <read_first>
    - src/core/sync.js (linhas 256-267 — summarize agora exportado)
    - src/mcp-server/index.js (slim agora cappado)
    - test/unit/sync.test.js (estilo de tests do sync — não quebrar nada)
  </read_first>
  <files>test/unit/slim-cap.test.js</files>
  <action>
  Criar `test/unit/slim-cap.test.js` validando:

  (a) **Correctness do cap:**
      - description vazia → `''`
      - description ≤80 chars → retornada inteira (apenas trim de whitespace)
      - description >80 chars → truncada em 79 chars + sufixo `…` (total 80)
      - description com whitespace múltiplo → colapsa para single-space
      - description com \n e \t → colapsa para space

  (b) **Redução real medida em corpus do kit-mcp:**
      Carregar agents reais via `listKit()` de src/core/sync.js, computar
      bytes totais com e sem cap, asserir redução ≥10%.

  Código completo do arquivo:

  ```js
  // PERF-13-01: regression test for slim() cap.
  // Validates correctness of the SUMMARY_MAX_CHARS cap and measures the
  // real-world reduction in description payload for the kit-mcp's own corpus.

  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { summarize, SUMMARY_MAX_CHARS } from '../../src/core/sync.js';
  import { listKit } from '../../src/core/sync.js';

  test('PERF-13-01: summarize cap is exactly 80', () => {
    assert.equal(SUMMARY_MAX_CHARS, 80);
  });

  test('PERF-13-01: empty description returns empty string', () => {
    assert.equal(summarize(''), '');
    assert.equal(summarize(null), '');
    assert.equal(summarize(undefined), '');
  });

  test('PERF-13-01: short description returned verbatim (after trim)', () => {
    assert.equal(summarize('short desc'), 'short desc');
    assert.equal(summarize('exactly eighty chars padded out to test boundary aaaaaaaaaaaaaaaaaa'.slice(0, 80)), 'exactly eighty chars padded out to test boundary aaaaaaaaaaaaaaaaaa'.slice(0, 80));
  });

  test('PERF-13-01: long description truncated to 80 chars with ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = summarize(long);
    assert.equal(out.length, 80, `expected 80 chars, got ${out.length}`);
    assert.ok(out.endsWith('…'), `expected ellipsis suffix, got "${out.slice(-3)}"`);
    assert.equal(out, 'a'.repeat(79) + '…');
  });

  test('PERF-13-01: whitespace collapsed to single space', () => {
    assert.equal(summarize('foo   bar\n\tbaz'), 'foo bar baz');
    assert.equal(summarize('  leading and trailing  '), 'leading and trailing');
  });

  test('PERF-13-01: realistic agent description gets capped', () => {
    // Mirror real shape from kit/agents/planner.md frontmatter:
    const realisticDesc = 'Cria planos de fase executáveis com decomposição de tarefas, análise de dependências e verificação orientada a objetivos. Acionado pelo orquestrador /planejar-fase.';
    const out = summarize(realisticDesc);
    assert.ok(out.length <= 80, `expected ≤80 chars, got ${out.length}`);
    assert.ok(out.endsWith('…'), `expected ellipsis, got tail "${out.slice(-3)}"`);
  });

  test('PERF-13-01: real kit-mcp corpus shows ≥10% reduction in description bytes', async () => {
    // Load the actual kit-mcp agents/commands/skills and measure how much
    // shorter the capped descriptions are vs. the originals.
    const kit = await listKit();
    const items = [...kit.agents, ...kit.commands, ...kit.skills, ...kit.skillsExtras];
    assert.ok(items.length > 30, `expected ≥30 items in corpus, got ${items.length}`);

    let originalBytes = 0;
    let cappedBytes = 0;
    for (const item of items) {
      const orig = item.description || '';
      const capped = summarize(orig);
      originalBytes += Buffer.byteLength(orig, 'utf8');
      cappedBytes += Buffer.byteLength(capped, 'utf8');
    }

    assert.ok(originalBytes > 0, 'corpus has zero description bytes — listKit broken?');
    const reductionPct = ((originalBytes - cappedBytes) / originalBytes) * 100;

    // Audit estimate: ≥10%. Real corpus may show much more.
    assert.ok(
      reductionPct >= 10,
      `PERF-13-01 acceptance: expected ≥10% reduction; got ${reductionPct.toFixed(1)}% (orig=${originalBytes} capped=${cappedBytes})`,
    );

    // Diagnostic line printed via test reporter (visible in --reporter spec)
    console.log(`[PERF-13-01] reduction: ${reductionPct.toFixed(1)}% (${originalBytes} → ${cappedBytes} bytes across ${items.length} items)`);
  });
  ```
  </action>
  <acceptance_criteria>
    Arquivo existe:
    ```bash
    test -f test/unit/slim-cap.test.js
    ```

    Test passa:
    ```bash
    node --test test/unit/slim-cap.test.js
    ```
    Exit code 0; output contém `# pass 7` (7 testes passaram).

    Output do test mostra a redução real medida:
    ```bash
    node --test test/unit/slim-cap.test.js 2>&1 | grep "PERF-13-01.*reduction"
    ```
    Deve mostrar `reduction: XX.X% (...)` com XX.X ≥10.0.

    Suite completa verde:
    ```bash
    npm test
    ```
    Exit code 0; total ≥130 testes (120 baseline + 3 da Phase 80 plan 01 + 7 desta tarefa).
  </acceptance_criteria>
  <done>7 tests passam; redução medida ≥10% no corpus real; suite verde.</done>
</task>

</tasks>

<verification>
Para PERF-13-01 estar fechado:

1. `grep -E "^export function summarize" src/core/sync.js` retorna 1.
2. `grep -E "summarize\(x\.description\)" src/mcp-server/index.js src/cli/index.js` retorna 2.
3. `node --test test/unit/slim-cap.test.js` exit 0.
4. Output do test imprime `[PERF-13-01] reduction: XX.X%` com XX.X ≥ 10.0.
5. `npm test` exit 0 sem regressão em sync.test.js, kit.test.js.
</verification>

<success_criteria>
- summarize() exportado de src/core/sync.js (single source of truth do cap)
- slim() em src/mcp-server/index.js aplica summarize na description
- slim() em src/cli/index.js aplica summarize na description (consistência cross-surface)
- Test mede redução real em corpus do kit-mcp e exige ≥10%
- 7 testes adicionais passando; zero regressão em testes existentes
</success_criteria>

<output>
After completion, create `.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-02-SUMMARY.md` with:
- Diff resumido em sync.js, mcp-server/index.js, cli/index.js
- Output do test mostrando redução real medida (% e bytes)
- Confirmação de zero regressão em testes pré-existentes
</output>
