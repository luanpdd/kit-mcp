---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 03
plan_id: 80.03
type: execute
wave: 1
depends_on: []
files_modified:
  - kit/agents/planner.md
  - kit/agents/debugger.md
  - kit/agents/verifier.md
  - kit/agents/codebase-mapper.md
  - kit/agents/executor.md
  - kit/agents/project-researcher.md
  - kit/agents/ui-researcher.md
  - kit/agents/ui-auditor.md
  - kit/agents/roadmapper.md
  - kit/agents/research-synthesizer.md
  - kit/agents/phase-researcher.md
  - test/unit/agents-frontmatter-clean.test.js
autonomous: true
requirements:
  - PERF-13-02
must_haves:
  truths:
    - "Bloco `# hooks:` comentado-morto removido de todos os 11 agents listados"
    - "Frontmatter YAML continua válido (entre `---` no topo); description ainda parsea"
    - "Nenhum agent perde funcionalidade — comentários removidos eram dead code (hooks comentados)"
    - "Test de regressão valida que nenhum agent tem `# hooks:` comentado no frontmatter (anti-regressão futura)"
  artifacts:
    - path: "kit/agents/planner.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/debugger.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/verifier.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/codebase-mapper.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/executor.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/project-researcher.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/ui-researcher.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/ui-auditor.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/roadmapper.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/research-synthesizer.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "kit/agents/phase-researcher.md"
      provides: "Frontmatter sem bloco `# hooks:` morto"
    - path: "test/unit/agents-frontmatter-clean.test.js"
      provides: "Anti-regression test PERF-13-02"
  key_links:
    - from: "kit/agents/*.md"
      to: "frontmatter"
      via: "remoção determinística de linhas entre primeira `# hooks:` e antes do `---` final do frontmatter"
      pattern: "^# hooks:"
---

<objective>
Remover o bloco `# hooks:` comentado-morto do frontmatter YAML de 11 agents
do kit. O bloco é exatamente:

```yaml
# hooks:
#   PostToolUse:
#     - matcher: "Write|Edit"
#       hooks:
#         - type: command
#           command: "npx eslint --fix $FILE 2>/dev/null || true"
```

São 6 linhas idênticas em cada agent — totalizando 66 linhas mortas
distribuídas em 11 arquivos. Como cada agent é carregado como contexto
toda vez que é spawnado, este código morto custa tokens em todo `Task`
spawn. Auditoria estima ~880 tokens recuperáveis.

Purpose: PERF-13-02 — limpeza de drift acumulado em frontmatters. O bloco
foi adicionado historicamente como exemplo, mas nunca ativado (sintaxe
não é a esperada por hooks ativos do Claude Code; e mesmo se fosse,
estaria comentado). Manter comentado-morto é debt visual + custo de
tokens.

Output:
- 11 agents com bloco `# hooks:` removido (incluindo a linha em branco
  que pode existir antes/depois)
- Frontmatters continuam válidos
- Anti-regression test que falha se alguém reintroduzir `# hooks:`
  comentado em qualquer agent futuro
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-CONTEXT.md

# Sample dos 11 agents alvo — leitura direcionada apenas no frontmatter
@kit/agents/planner.md
@kit/agents/debugger.md

# Test runner
@test/run.mjs

# Interfaces:
# Os 11 agents alvo (lista exata, descoberta via `grep -l "^# hooks:" kit/agents/*.md`):
#   1. kit/agents/planner.md
#   2. kit/agents/debugger.md
#   3. kit/agents/verifier.md
#   4. kit/agents/codebase-mapper.md
#   5. kit/agents/executor.md
#   6. kit/agents/project-researcher.md
#   7. kit/agents/ui-researcher.md
#   8. kit/agents/ui-auditor.md
#   9. kit/agents/roadmapper.md
#   10. kit/agents/research-synthesizer.md
#   11. kit/agents/phase-researcher.md
#
# Pattern exato do bloco em planner.md (verificado por leitura):
#   # hooks:
#   #   PostToolUse:
#   #     - matcher: "Write|Edit"
#   #       hooks:
#   #         - type: command
#   #           command: "npx eslint --fix $FILE 2>/dev/null || true"
#
# 6 linhas literais, idênticas em todos os 11 agents.
# As linhas começam com:
#   # hooks:
#   #   PostToolUse:
#   #     - matcher:
#   #       hooks:
#   #         - type: command
#   #           command:
</context>

<tasks>

<task type="auto" id="1">
  <name>Tarefa 1: Strip # hooks: block from 11 agents via deterministic line-range removal</name>
  <read_first>
    - kit/agents/planner.md (verificar layout exato do bloco e linha de início/fim)
    - kit/agents/debugger.md (segundo sample para confirmar consistência)
    - kit/agents/verifier.md (terceiro sample)
    Run: `grep -n "^# hooks:" kit/agents/*.md` para descobrir a linha exata em cada arquivo.
  </read_first>
  <files>kit/agents/planner.md, kit/agents/debugger.md, kit/agents/verifier.md, kit/agents/codebase-mapper.md, kit/agents/executor.md, kit/agents/project-researcher.md, kit/agents/ui-researcher.md, kit/agents/ui-auditor.md, kit/agents/roadmapper.md, kit/agents/research-synthesizer.md, kit/agents/phase-researcher.md</files>
  <action>
  Para cada um dos 11 agents na lista de `files`, fazer **EXATAMENTE** a
  seguinte mudança via Edit tool:

  **Localizar (old_string):**
  ```
  # hooks:
  #   PostToolUse:
  #     - matcher: "Write|Edit"
  #       hooks:
  #         - type: command
  #           command: "npx eslint --fix $FILE 2>/dev/null || true"
  ---
  ```

  **Substituir por (new_string):**
  ```
  ---
  ```

  Isto:
  - Remove as 6 linhas do bloco morto
  - Mantém o `---` que fecha o frontmatter (terceira linha do frontmatter,
    que agora se torna a linha logo após `color:` ou último campo válido)

  IMPORTANTE: NÃO usar regex genérica nem find/replace de bash multilinha.
  Use a Edit tool com `old_string` e `new_string` exatamente como acima
  para cada arquivo individualmente — isso garante que o pattern bate
  exatamente uma vez por arquivo (a Edit tool falha se o pattern aparecer
  múltiplas vezes ou zero vezes).

  Se algum agent tiver o bloco em formato ligeiramente diferente (ex:
  espaços trailing, EOL diferente Windows vs Unix), a Edit tool falhará.
  Nesse caso, ler o arquivo individualmente, identificar o pattern real
  e fazer Edit ajustado para aquele arquivo específico. Não silenciosamente
  pular arquivos.

  NÃO modificar nenhuma outra parte dos arquivos. Apenas o bloco
  comentado-morto é alvo.
  </action>
  <acceptance_criteria>
    Pattern morto removido de TODOS os 11 arquivos:
    ```bash
    grep -l "^# hooks:" kit/agents/*.md | wc -l
    ```
    Deve retornar `0`.

    Linha específica do comando eslint não aparece mais:
    ```bash
    grep -l "npx eslint --fix \$FILE" kit/agents/*.md | wc -l
    ```
    Deve retornar `0`.

    Frontmatters continuam válidos — primeira linha de cada agent é `---`,
    e existe um segundo `---` antes do conteúdo (sem ter perdido o fechamento):
    ```bash
    for f in kit/agents/planner.md kit/agents/debugger.md kit/agents/verifier.md kit/agents/codebase-mapper.md kit/agents/executor.md kit/agents/project-researcher.md kit/agents/ui-researcher.md kit/agents/ui-auditor.md kit/agents/roadmapper.md kit/agents/research-synthesizer.md kit/agents/phase-researcher.md; do
      head -1 "$f" | grep -q "^---" || { echo "FAIL first line of $f is not ---"; exit 1; }
      head -25 "$f" | grep -c "^---" | grep -qv "^[01]$" || head -25 "$f" | grep -c "^---" | grep -q "^2$" || { echo "FAIL $f does not have 2 frontmatter delimiters in first 25 lines"; exit 1; }
    done
    echo "ALL OK"
    ```
    Output deve incluir `ALL OK`.

    Smoke do parser de kit (que lê esses agents):
    ```bash
    node bin/cli.js kit list-agents 2>&1 | grep -c "agent" 
    ```
    Deve retornar valor positivo (kit consegue listar agents — frontmatter
    YAML válido).

    Suite verde:
    ```bash
    npm test
    ```
    Exit code 0; nenhuma regressão em kit.test.js (que lê frontmatters).
  </acceptance_criteria>
  <done>11 agents sem bloco `# hooks:`; frontmatters válidos; kit list-agents funciona; suite verde.</done>
</task>

<task type="auto" id="2">
  <name>Tarefa 2: Anti-regression test ensuring # hooks: never returns to agent frontmatters</name>
  <read_first>
    - test/unit/replays-path-traversal.test.js (estilo)
    - kit/agents/planner.md (sample do estado pós-Tarefa 1 — frontmatter limpo)
  </read_first>
  <files>test/unit/agents-frontmatter-clean.test.js</files>
  <action>
  Criar `test/unit/agents-frontmatter-clean.test.js` com test estático que
  varre todos os agents e falha se algum tiver `# hooks:` comentado no
  frontmatter:

  ```js
  // PERF-13-02: anti-regression test for dead `# hooks:` block in agent
  // frontmatters. The block was historical example code (commented out)
  // that never activated. If anyone reintroduces it, this test fails and
  // forces them to either (a) activate it properly via a non-frontmatter
  // mechanism, or (b) not commit it at all.

  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { readFile, readdir } from 'node:fs/promises';
  import path from 'node:path';
  import { fileURLToPath } from 'node:url';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, '..', '..');
  const AGENTS_DIR = path.join(REPO_ROOT, 'kit', 'agents');

  // The 6 specific lines we're banning (the dead block from PERF-13-02).
  // We match `^# hooks:` as a sentinel — if anyone wants to add legitimate
  // `# hooks:` documentation in the body of an agent (not in the
  // frontmatter), they should use a different prefix or put it under a
  // properly-fenced code block.
  const BANNED_FRONTMATTER_PATTERN = /^# hooks:\s*$/m;

  async function listAgents() {
    const entries = await readdir(AGENTS_DIR);
    return entries.filter((e) => e.endsWith('.md')).map((e) => path.join(AGENTS_DIR, e));
  }

  function extractFrontmatter(content) {
    // Frontmatter is between the first two `---` lines, anchored at line start.
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? match[1] : null;
  }

  test('PERF-13-02: no agent has dead `# hooks:` block in frontmatter', async () => {
    const agentFiles = await listAgents();
    assert.ok(agentFiles.length >= 30, `expected ≥30 agents, got ${agentFiles.length}`);

    const offenders = [];
    for (const file of agentFiles) {
      const content = await readFile(file, 'utf8');
      const fm = extractFrontmatter(content);
      assert.ok(fm !== null, `${path.basename(file)}: no frontmatter delimiters found`);
      if (BANNED_FRONTMATTER_PATTERN.test(fm)) {
        offenders.push(path.basename(file));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Agents with dead "# hooks:" block in frontmatter (PERF-13-02 regression): ${offenders.join(', ')}`,
    );
  });

  test('PERF-13-02: no agent has banned eslint --fix command in frontmatter', async () => {
    // Specific second guard: the exact dead command should never appear in
    // any frontmatter, even if reformatted to a different shape.
    const agentFiles = await listAgents();
    const offenders = [];
    for (const file of agentFiles) {
      const content = await readFile(file, 'utf8');
      const fm = extractFrontmatter(content);
      if (!fm) continue;
      if (fm.includes('npx eslint --fix $FILE')) {
        offenders.push(path.basename(file));
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Agents with dead eslint command in frontmatter: ${offenders.join(', ')}`,
    );
  });

  test('PERF-13-02: every agent still has valid frontmatter (--- delimiters intact)', async () => {
    const agentFiles = await listAgents();
    for (const file of agentFiles) {
      const content = await readFile(file, 'utf8');
      const fm = extractFrontmatter(content);
      assert.ok(fm !== null, `${path.basename(file)}: missing frontmatter`);
      // Sanity: every agent must declare `name:` and `description:` in fm
      assert.ok(/^name:\s*\S/m.test(fm), `${path.basename(file)}: missing name field`);
      assert.ok(/^description:\s*\S/m.test(fm), `${path.basename(file)}: missing description field`);
    }
  });
  ```
  </action>
  <acceptance_criteria>
    Arquivo existe:
    ```bash
    test -f test/unit/agents-frontmatter-clean.test.js
    ```

    Test passa (deve passar PORQUE Tarefa 1 já removeu os blocos):
    ```bash
    node --test test/unit/agents-frontmatter-clean.test.js
    ```
    Exit code 0; output `# pass 3` (3 testes passaram).

    Suite completa verde:
    ```bash
    npm test
    ```
    Exit code 0; total ≥133 testes (120 baseline + 3 P80.01 + 7 P80.02 + 3 desta tarefa).
  </acceptance_criteria>
  <done>3 anti-regression tests passam; suite verde; pull request futuro que re-introduza `# hooks:` em agent fará o test falhar.</done>
</task>

</tasks>

<verification>
Para PERF-13-02 estar fechado:

1. `grep -l "^# hooks:" kit/agents/*.md | wc -l` retorna 0.
2. `grep -l "npx eslint --fix \$FILE" kit/agents/*.md | wc -l` retorna 0.
3. `node --test test/unit/agents-frontmatter-clean.test.js` exit 0.
4. Cada um dos 11 agents alvo ainda tem `name:` e `description:` no frontmatter.
5. `npm test` exit 0 sem regressão em kit.test.js.
</verification>

<success_criteria>
- 11 agents listados sem o bloco `# hooks:` morto no frontmatter
- Frontmatter YAML continua válido em cada um (delimitadores, name, description preservados)
- Test anti-regressão garante que ninguém re-introduza acidentalmente
- Zero regressão em testes existentes que lêem frontmatter (kit.test.js)
</success_criteria>

<output>
After completion, create `.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-03-SUMMARY.md` with:
- Lista exata dos 11 agents modificados
- Diff de tamanho (linhas removidas total: 11 × 6 = 66)
- Output do test mostrando 3 cases passando
- Confirmação que kit list-agents continua funcional
</output>
