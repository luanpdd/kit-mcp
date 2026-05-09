---
phase: 87-ci-matrix-expansion
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - test/unit/sync-round-trip-all-targets.test.js
autonomous: true
requirements:
  - DX-15-03

must_haves:
  truths:
    - "CI smoke job exercita os 8 IDEs (claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae) em vez de só claude-code"
    - "fail-fast: false está preservado para que falha em um target não cancele os outros 7"
    - "Sync round-trip step é parameterizado por matrix.target (não hardcode)"
    - "Mirror-tree safety step continua usando claude-code (único target com framework/hooks)"
    - "ci.yml continua sendo YAML válido (parse-able)"
    - "Suite local cresce em ≥1 regression test que valida round-trip install+remove para os 8 IDEs"
    - "Baseline 289 → ≥290 testes, 0 fails"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "CI workflow com matrix axis target expandido"
      contains: "target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]"
    - path: "test/unit/sync-round-trip-all-targets.test.js"
      provides: "Regression test cobrindo install+remove round-trip para os 8 IDEs"
      min_lines: 40
  key_links:
    - from: ".github/workflows/ci.yml (smoke job: 'Sync round-trip' step)"
      to: "src/core/registry.js (TARGETS map)"
      via: "${{ matrix.target }} resolves a registry ID"
      pattern: "matrix\\.target"
    - from: "test/unit/sync-round-trip-all-targets.test.js"
      to: "src/core/sync.js (syncTo + removeFrom)"
      via: "import + iteração sobre TARGETS keys"
      pattern: "import .* from '\\.\\./\\.\\./src/core/(sync|registry)\\.js'"
---

<objective>
Eliminar o gap de cobertura em CI onde apenas `claude-code` é exercitado em sync round-trip — outros 7 IDEs (cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae) regridem em silêncio se algum bug específico de target/OS aparecer. Adiciona matrix axis `target` ao smoke job e adiciona regression test local que cobre o mesmo round-trip para os 8 IDEs.

Purpose: Auditoria v1.13 (TOIL-AUDIT.md + CI/CD audit) explicitamente identificou: race condition v1.12.1 escapou exatamente porque os outros 7 IDEs não eram testados em CI. DX-15-03 fecha essa gap.

Output:
- `.github/workflows/ci.yml` com matrix axis `target` (8 IDEs) e `${{ matrix.target }}` substituindo hardcoded `claude-code` nos steps de sync round-trip e mirror-tree safety.
- `test/unit/sync-round-trip-all-targets.test.js` validando install + remove round-trip para os 8 IDEs locally (defesa em profundidade — não roda na CI matrix mas reproduz a logic).
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/87-ci-matrix-expansion/87-CONTEXT.md
@.github/workflows/ci.yml
@src/core/registry.js
@src/core/sync.js
@test/unit/registry.test.js

<interfaces>
## Registry IDs reais (8 IDEs — confirmado via run no registry.js)

ID exato (não confundir com label!):
- `claude-code` — rules CLAUDE.md, agents .claude/agents/, commands .claude/commands/, skills .claude/skills/, framework/hooks (mirror-tree)
- `cursor` — rules .cursor/rules/, agents .cursor/agents/ (sem commands/skills)
- `codex` — rules AGENTS.md, skills .codex/skills/ (sem agents/commands)
- `gemini-cli` — rules GEMINI.md, skills .gemini/skills/ (sem agents/commands) **NOTA: ID é `gemini-cli`, NÃO `gemini`**
- `copilot` — rules .github/copilot-instructions.md, agents .github/agents/, skills .github/skills/
- `windsurf` — rules .windsurf/rules/, agents .windsurf/agents/, skills .windsurf/skills/
- `antigravity` — rules .agents/rules/, agents .agents/agents/, skills .agents/workflows/
- `trae` — rules .trae/rules/, agents .trae/agents/ (sem commands/skills)

## API exports relevantes

```js
// src/core/registry.js
export const TARGETS = { 'claude-code': {...}, 'cursor': {...}, ... };
export function listTargets(): {id, label, capabilities}[];
export function getTarget(id): TargetSpec; // throws on unknown

// src/core/sync.js
export async function syncTo(targetId, opts): Promise<{target, mode, projectRoot, kitRoot, written, dryRun}>;
export async function removeFrom(targetId, opts): Promise<{target, projectRoot, removed}>;
export async function statusOf(targetId, opts): Promise<{target, projectRoot, checks}>;
```

## Step do CI atual (linhas 175-209) — referência para edição

Hardcoded `claude-code` aparece em 3 linhas dentro de smoke job (linhas 179, 190, 206). Linha 146 (CLI smoke `install dry-run claude-code`) é cli surface test, não sync round-trip — fica fora de escopo (preservar como sentinel para a CLI).

## Asserts claude-code-específicos (linhas 180-188 e 192-194) que NÃO são portáveis

```bash
test -f .ci-test/.claude/agents/example-reviewer.md   # path .claude/agents/ é claude-code only
test -f .ci-test/CLAUDE.md                             # CLAUDE.md é só claude-code (cursor=AGENTS.md, codex=AGENTS.md, gemini-cli=GEMINI.md...)
test -f .ci-test/.claude/framework/.kit-mcp-managed   # framework/hooks só existem em claude-code
```

Decisão: o step "Sync round-trip" novo NÃO tenta validar arquivos específicos por target (cada IDE tem layout diferente). Em vez disso, valida o contrato genérico:
1. `sync install <target>` exits 0
2. `sync status <target>` reporta ≥1 capability como `exists: true` (algo foi escrito)
3. `sync remove <target>` exits 0
4. Após remove, todos os capability checks reportam `exists: false` (limpeza completa)

O step "Mirror-tree safety" (linhas 197-209) é claude-code-specific por definição (framework/hooks só existem em claude-code). Esse step NÃO ganha matrix.target — fica restrito a runs onde target == 'claude-code' (via condicional `if: matrix.target == 'claude-code'`).

## YAML lint approach

`js-yaml` NÃO está disponível como dep transitiva (verificado: `require('js-yaml')` falha com MODULE_NOT_FOUND). Python NÃO está disponível na máquina local de dev. Mas em runners ubuntu-latest do GitHub Actions, `python3` + `pyyaml` vêm pré-instalados.

Para o regression test LOCAL, usar parsing minimal:
- ler ci.yml, fazer `String.prototype.includes()` em substrings esperadas: `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]` e `${{ matrix.target }}` (≥3 ocorrências esperadas — round-trip step).

Para validação YAML real (parse), confiar em GitHub Actions runtime — se o YAML é inválido, o smoke job nem inicia. Não introduzir runtime YAML parser.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verificar registry suporta os 8 IDEs (read-only)</name>
  <files>src/core/registry.js (read), test/unit/registry.test.js (read)</files>
  <read_first>
    - src/core/registry.js completo
    - test/unit/registry.test.js (já valida 8 IDEs incluindo `gemini-cli`)
  </read_first>
  <action>
    Esta task é read-only. Confirmar que `src/core/registry.js` exporta `TARGETS` com exatamente 8 IDs:
    `['claude-code', 'cursor', 'codex', 'gemini-cli', 'copilot', 'windsurf', 'antigravity', 'trae']`.

    Comando de verificação (uma única linha, output esperado: 8 linhas, uma por ID):
    ```bash
    node --input-type=module -e "import { TARGETS } from './src/core/registry.js'; for (const id of Object.keys(TARGETS)) console.log(id);"
    ```

    Output esperado contém exatamente: `claude-code`, `cursor`, `codex`, `gemini-cli`, `copilot`, `windsurf`, `antigravity`, `trae`.

    Se algum ID estiver ausente OU se houver IDs extras, ABORT esta fase imediatamente — registry não suporta a expansion. (Implementação esperada: tudo já está OK, baseline Phase 86 já tinha 8 IDEs. Isso é apenas guard explícito antes de mudar CI.)

    POR QUÊ esta task: Mudar ci.yml ANTES de verificar que registry suporta os 8 IDs causa CI falha permanente em targets faltantes. Esta task é a "gate" do plano.

    POR QUÊ não combinar com task 2: Separação de leitura (verify) e escrita (edit) facilita rollback se algo inesperado for detectado em registry.
  </read_first>
  <acceptance_criteria>
    - Output do comando contém exatamente os 8 IDs listados acima.
    - Nenhum ID extra (deve ser exatamente 8, não 9+).
    - Registry NÃO foi modificado nesta task.
  </acceptance_criteria>
  <verify>
    <automated>
      ```bash
      node --input-type=module -e "import { TARGETS } from './src/core/registry.js'; const ids = Object.keys(TARGETS).sort(); const expected = ['antigravity','claude-code','codex','copilot','cursor','gemini-cli','trae','windsurf']; const ok = ids.length === 8 && ids.every((id, i) => id === expected[i]); if (!ok) { console.error('FAIL: expected', expected, 'got', ids); process.exit(1); } console.log('OK: 8 IDs match');"
      ```
      Exit code 0 + output `OK: 8 IDs match`.
    </automated>
  </verify>
  <done>
    Registry confirmado com 8 IDs exatos. Sem mudanças no código. Pronto para task 2 expandir CI matrix.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Adicionar matrix axis `target` ao smoke job e parameterizar sync round-trip</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .github/workflows/ci.yml linhas 101-238 (smoke job inteiro)
    - Confirmar `fail-fast: false` já presente na linha 104 (preservar)
  </read_first>
  <behavior>
    Após edição, ci.yml DEVE:
    1. Linha do matrix incluir nova axis: `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]`. Ordem preserva claude-code first (run mais provável de pegar bugs primeiro com fail-fast já desabilitado).
    2. Step "Sync round-trip" (atual linhas 175-196): TODOS os hardcoded `claude-code` substituídos por `${{ matrix.target }}`. Asserts `test -f .ci-test/.claude/agents/example-reviewer.md` etc. REMOVIDOS — substituídos por contrato genérico (sync status reportar ≥1 exists antes do remove, todos exists=false depois).
    3. Step "Mirror-tree safety — preserves user files" (atual linhas 198-209): adicionar `if: matrix.target == 'claude-code'` no nível do step. Body do step inalterado (só claude-code tem framework/hooks).
    4. Step "CLI smoke" linha 146 (`install dry-run claude-code`): NÃO TOCAR — é teste de CLI surface, não de IDE coverage. Adicionar `if: matrix.target == 'claude-code'` ao step inteiro para evitar rodar 8 vezes (idempotente, mas desperdiça tempo).
    5. Steps "Audit — drift gate" e "Audit — v1.8 Supabase suite gates" e "MCP server boot" e "Tests (unit/integration)": adicionar `if: matrix.target == 'claude-code'` para evitar rodar 8 vezes — eles testam comportamento target-agnóstico.
    6. YAML continua válido: parsing via `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` em runners ubuntu-latest deve funcionar (não testável local sem Python).

    POR QUÊ adicionar `if: matrix.target == 'claude-code'` em vários steps: matrix axis multiplica TODOS os steps por 8. Sem o guard, 72 runs × ~10 steps cada = 720 step-executions. Para steps target-agnostic (audit, npm test, MCP server boot), 1 execução é suficiente — escolher claude-code como representante.

    POR QUÊ não usar `include:`/`exclude:` na matrix: `if:` em step-level é mais explícito e fácil de revisar em diff. `exclude:` removeria a run inteira (perderia o sync round-trip step).

    POR QUÊ preservar `fail-fast: false`: já está na linha 104. Decisão explícita do CONTEXT.md ("preservar fail-fast: false"). Se um target X falha, os outros 7 ainda rodam — sem isso, racing condition em um target cancelaria tudo e mascararia bugs em outros.

    Nova versão do step "Sync round-trip" (substituir linhas 175-196):

    ```yaml
          - name: Sync round-trip
            shell: bash
            run: |
              mkdir -p .ci-test
              node bin/cli.js sync install ${{ matrix.target }} --project-root .ci-test
              # Generic post-install assertion: sync status reports ≥1 capability as exists
              EXISTS_COUNT=$(node bin/cli.js sync status ${{ matrix.target }} --project-root .ci-test --json 2>/dev/null | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{ const r=JSON.parse(d); console.log(r.checks.filter(c=>c.exists).length); })")
              if [ "$EXISTS_COUNT" -lt 1 ]; then
                echo "::error::sync install ${{ matrix.target }} produced 0 capability artifacts — registry path resolution may be broken for this target"
                exit 1
              fi
              echo "OK: sync install ${{ matrix.target }} produced $EXISTS_COUNT capability artifact(s)"
              node bin/cli.js sync remove ${{ matrix.target }} --project-root .ci-test
              # Generic post-remove assertion: 0 capabilities remain
              REMAINING=$(node bin/cli.js sync status ${{ matrix.target }} --project-root .ci-test --json 2>/dev/null | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{ const r=JSON.parse(d); console.log(r.checks.filter(c=>c.exists).length); })")
              if [ "$REMAINING" -ne 0 ]; then
                echo "::error::sync remove ${{ matrix.target }} left $REMAINING capability artifact(s) behind"
                exit 1
              fi
              echo "OK: sync remove ${{ matrix.target }} cleaned up all artifacts"
              rm -rf .ci-test
    ```

    **Ressalva sobre `--json` flag em `sync status`**: Verificar se a flag existe. Se NÃO existe, fallback genérico:
    - Após install: `test -d .ci-test` (diretório raiz foi criado por syncTo). Cada target produz pelo menos `target.rules.path` (todos 8 têm rules).
    - Mas paths variam: claude-code=CLAUDE.md, cursor=.cursor/rules/, codex=AGENTS.md, etc. Solução: usar `find` para verificar que algo foi escrito em .ci-test:
    ```bash
    if [ -z "$(find .ci-test -mindepth 1 -type f 2>/dev/null)" ]; then
      echo "::error::sync install ${{ matrix.target }} wrote 0 files"
      exit 1
    fi
    ```
    - Após remove: target-aware. Para targets com agents/commands/skills (claude-code, cursor, copilot, windsurf, antigravity, trae): esses dirs devem ter `removed` stubs e ficar vazios ou inexistentes. Para targets só-rules (codex, gemini-cli): rules file (CLAUDE.md/AGENTS.md/GEMINI.md) NÃO é tocado por `removeFrom` (atual lógica em src/core/sync.js linhas 169-200 só remove agents/commands/skills/framework/hooks). **Isso é aceitable — rules file aggregated não tem STUB_MARKER per-item, é content-zero**. Mas o assert `0 capabilities remain` falharia.

    **Decisão arquitetural**: investigar `sync status` durante a edição. Se existe e tem `--json`, usar approach 1. Se não, usar approach `find` simples + skip post-remove assertion para targets sem agents/commands/skills (codex, gemini-cli, trae rules-only path):

    Approach final genérico (não depende de --json):
    ```yaml
          - name: Sync round-trip
            shell: bash
            run: |
              mkdir -p .ci-test
              node bin/cli.js sync install ${{ matrix.target }} --project-root .ci-test
              # Post-install: at least 1 file written under .ci-test
              FILES_AFTER_INSTALL=$(find .ci-test -type f 2>/dev/null | wc -l)
              if [ "$FILES_AFTER_INSTALL" -lt 1 ]; then
                echo "::error::sync install ${{ matrix.target }} wrote 0 files under .ci-test"
                exit 1
              fi
              echo "OK: sync install ${{ matrix.target }} wrote $FILES_AFTER_INSTALL file(s)"
              node bin/cli.js sync remove ${{ matrix.target }} --project-root .ci-test
              # Post-remove: STUB_MARKER files should be gone (rules aggregated stays — that's intentional)
              STUBS_LEFT=$(grep -rl 'kit-mcp:reference' .ci-test 2>/dev/null | grep -v '^.ci-test/CLAUDE.md$\|^.ci-test/AGENTS.md$\|^.ci-test/GEMINI.md$\|^.ci-test/.github/copilot-instructions.md$' | wc -l)
              if [ "$STUBS_LEFT" -ne 0 ]; then
                echo "::error::sync remove ${{ matrix.target }} left $STUBS_LEFT stub file(s) behind"
                grep -rl 'kit-mcp:reference' .ci-test 2>/dev/null
                exit 1
              fi
              echo "OK: sync remove ${{ matrix.target }} cleaned up agent/command/skill stubs"
              rm -rf .ci-test
    ```

    Nota: rules-aggregated files (CLAUDE.md, AGENTS.md, GEMINI.md, .github/copilot-instructions.md) podem ter o STUB_MARKER mas NÃO são removidos por `removeFrom` (decisão arquitetural antiga — single rules file, não per-stub). Os 4 paths excluídos do grep cobrem todos os targets com rules `mode: 'single'` (claude-code, codex, gemini-cli, copilot). Targets com rules `mode: 'multi'` (cursor, windsurf, antigravity, trae) escrevem rules per-agent — esses arquivos têm STUB_MARKER mas... também ficam? Ler src/core/sync.js removeFrom para confirmar: linhas 173-187 só removem entries em `agents/commands/skills` paths. Rules path NÃO está no loop. Então rules multi-file (cursor/.cursor/rules/, etc.) também ficam.

    Solução simplificada: após remove, count stubs em paths de capabilities (agents/commands/skills/framework/hooks ONLY), NÃO em rules path:
    ```bash
    # Construir lista de capability dirs para o target específico via registry inline
    STUBS_LEFT=$(node --input-type=module -e "
      import { getTarget } from './src/core/registry.js';
      import fs from 'node:fs';
      import path from 'node:path';
      const t = getTarget('${{ matrix.target }}');
      const root = '.ci-test';
      let count = 0;
      for (const cap of ['agents','commands','skills','framework','hooks']) {
        if (!t[cap]) continue;
        const dir = path.join(root, t[cap].path);
        try {
          const walk = (d) => { for (const e of fs.readdirSync(d, {withFileTypes:true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) { try { if (fs.readFileSync(p,'utf8').includes('kit-mcp:reference')) count++; } catch{} } } };
          if (fs.existsSync(dir)) walk(dir);
        } catch {}
      }
      console.log(count);
    " 2>/dev/null)
    ```
    Esse approach é registry-driven (cobre os 8 targets uniformemente sem hardcode de paths).

    POR QUÊ rules-aggregated não é removido por design: o arquivo rules é construído por aggregation (buildAggregatedRules em sync.js) e o usuário pode ter editado. Removê-lo seria destrutivo. Decisão arquitetural Phase 19+ — não muda agora.

    Nova versão do step "Mirror-tree safety" (manter linhas 198-209 inalteradas exceto adicionar `if`):
    ```yaml
          - name: Mirror-tree safety — preserves user files
            if: matrix.target == 'claude-code'
            shell: bash
            run: |
              # ... corpo inalterado
    ```

    Steps target-agnósticos que recebem `if: matrix.target == 'claude-code'`:
    - "Tests (unit)" linha 120
    - "Tests (integration)" linha 123
    - "Audit — drift gate" linhas 126-139
    - "CLI smoke" linhas 141-146
    - "Audit — v1.8 Supabase suite gates" linhas 148-173
    - "MCP server boot" linhas 211-237

    Steps que rodam para todos 8 targets (sem if):
    - `actions/checkout@v6` (linha 110) — needed always
    - `actions/setup-node@v6` (linhas 112-114) — needed always
    - "Install" linhas 116-118 — needed always (npm ci)
    - "Sync round-trip" — o único step que VARIA por target

    Isso reduz custo: 8 targets × 3 OS × 3 Node = 72 runs, mas só "Sync round-trip" repete 72×. Os outros steps rodam só em runs com target=='claude-code' (3 OS × 3 Node = 9 runs, igual ao baseline anterior). Total step-executions: ~9×7 (claude-code only steps) + 72×4 (always: checkout, setup-node, install, round-trip) = ~63 + 288 = 351 step-executions. Vs sem otimização: 72 × 11 = 792. Economia: ~55%.

    POR QUÊ matrix.target=='claude-code' como representante: claude-code tem o superset de capabilities (agents+commands+skills+framework+hooks). Audit e tests não dependem do target em si — testam invariantes do code base. Roda 1× é suficiente.
  </behavior>
  <implementation>
    Editar `.github/workflows/ci.yml` aplicando as mudanças descritas em `<behavior>`. Order:

    1. Adicionar `target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]` à matrix (linha após `node:` em ~107).
    2. Adicionar `if: matrix.target == 'claude-code'` aos steps target-agnósticos (Tests unit, Tests integration, Audit drift, CLI smoke, Supabase gates, MCP server boot, Mirror-tree safety).
    3. Reescrever step "Sync round-trip" (linhas 175-196) com o body registry-driven descrito em `<behavior>`.

    Validação local pós-edição:
    - Re-ler ci.yml para confirmar no editor.
    - Verificar que `claude-code` aparece nos lugares esperados (CLI smoke linha 146, Mirror-tree safety body, matrix array, `if:` conditionals) e NÃO aparece em "Sync round-trip" body (deve ser `${{ matrix.target }}`).
    - Verificar que `${{ matrix.target }}` aparece ≥3 vezes no Sync round-trip step.
    - Verificar que `target: [` aparece exatamente 1 vez (matrix definition).

    Não há lint local de YAML disponível (sem js-yaml, sem Python). Confiança: estrutura YAML preservada por edits cirúrgicos via Edit tool. Caso GitHub Actions rejeite YAML inválido, o smoke job falha imediatamente no checkout — feedback rápido.
  </implementation>
  <acceptance_criteria>
    - `grep -c "target: \[claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae\]" .github/workflows/ci.yml` retorna ≥1.
    - `grep -c '\${{ matrix.target }}' .github/workflows/ci.yml` retorna ≥3 (sync install, sync remove, sync status no Sync round-trip).
    - `grep -c "if: matrix.target == 'claude-code'" .github/workflows/ci.yml` retorna ≥6 (Tests unit, Tests integration, Audit drift, CLI smoke, Supabase gates, MCP server boot, Mirror-tree safety = pelo menos 6, idealmente 7).
    - Step "Sync round-trip" body NÃO contém literal `claude-code` (substituído por `${{ matrix.target }}`).
    - Diff line count: aproximadamente +30/-15 linhas (matrix axis + if conditionals + sync round-trip rewrite).
  </acceptance_criteria>
  <verify>
    <automated>
      ```bash
      # 1. Matrix axis presente
      grep -c "target: \[claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae\]" .github/workflows/ci.yml | grep -q "^[1-9]" || (echo "FAIL: matrix axis target missing or wrong"; exit 1)
      # 2. matrix.target reference count
      MT_COUNT=$(grep -c '\${{ matrix.target }}' .github/workflows/ci.yml)
      if [ "$MT_COUNT" -lt 3 ]; then echo "FAIL: matrix.target referenced $MT_COUNT times, expected >=3"; exit 1; fi
      # 3. if guards present
      IF_COUNT=$(grep -c "if: matrix.target == 'claude-code'" .github/workflows/ci.yml)
      if [ "$IF_COUNT" -lt 6 ]; then echo "FAIL: 'if: matrix.target == claude-code' present $IF_COUNT times, expected >=6"; exit 1; fi
      # 4. Sync round-trip step body must not contain literal 'claude-code' (only matrix.target)
      # Extract Sync round-trip step content (between "name: Sync round-trip" and the next step "name:")
      awk '/name: Sync round-trip/,/name: Mirror-tree safety/' .github/workflows/ci.yml | grep -q '\bclaude-code\b' && (echo "FAIL: Sync round-trip step still has hardcoded claude-code"; exit 1)
      echo "OK: ci.yml expansion sound (matrix axis, target refs, if guards, no hardcoded claude-code in round-trip)"
      ```
      Exit code 0 + final OK message.
    </automated>
  </verify>
  <done>
    ci.yml expandido para 8 targets via matrix axis, `${{ matrix.target }}` parameteriza Sync round-trip step, target-agnostic steps gated com `if:` para evitar repetição 8×, fail-fast: false preservado, claude-code-specific assertions (mirror-tree, CLAUDE.md path) removidas do generic round-trip step. YAML structure preservada por edits cirúrgicos.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Regression test — round-trip install+remove para os 8 IDEs</name>
  <files>test/unit/sync-round-trip-all-targets.test.js (novo)</files>
  <read_first>
    - test/unit/sync.test.js (verificar pattern de uso de syncTo + removeFrom + temp dirs)
    - test/unit/registry.test.js (já cobre presença dos 8 IDs — não duplicar)
    - src/core/sync.js linhas 22-117 (syncTo) e 169-201 (removeFrom)
    - test/fixtures/sample-kit/file-manifest.json (precisa para verifyManifest passar)
  </read_first>
  <behavior>
    Test file novo em `test/unit/sync-round-trip-all-targets.test.js` que valida o mesmo contrato que o CI smoke job vai exercitar, mas em test runner local (defesa em profundidade — pega regressão antes de PR ir pra CI).

    Cobertura:
    - **Test 1**: Para cada um dos 8 IDs (`claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae`), `syncTo(id, {projectRoot: tmp, kitRoot: sample})` retorna sem erro E escreve ≥1 arquivo no tmp. Skip mode=copy (default reference é suficiente; copy é coberto por sync.test.js).
    - **Test 2**: Após syncTo + removeFrom para os 8 IDs, ZERO arquivos com STUB_MARKER `kit-mcp:reference` permanecem em paths de capabilities (agents/commands/skills/framework/hooks). Rules aggregated files podem ficar (decisão arquitetural — não removidos por design).
    - **Test 3**: `getTarget(id)` para cada um dos 8 IDs retorna spec sem throw, e a spec tem ≥1 capability não-null entre rules/agents/commands/skills/framework/hooks (sanity check — registry coverage).

    Casos extremos relevantes:
    - codex e gemini-cli: rules-only + skills (sem agents/commands). Round-trip deve passar.
    - trae: rules + agents (sem skills/commands). Round-trip deve passar.
    - cursor: rules + agents (sem skills/commands). Round-trip deve passar.
    - claude-code: full coverage (rules + agents + commands + skills + framework + hooks).

    Setup:
    - Test usa `test/fixtures/sample-kit/` como kitRoot (já existe e tem file-manifest.json).
    - Cada test cria tmp dir via `fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-test-'))`.
    - Cleanup garantido em finally (fs.rm recursive).
    - Usar `node:test` + `node:assert/strict` (consistente com test/unit/*.test.js existentes).
  </behavior>
  <implementation>
    ```javascript
    // test/unit/sync-round-trip-all-targets.test.js
    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import { TARGETS, getTarget } from '../../src/core/registry.js';
    import { syncTo, removeFrom } from '../../src/core/sync.js';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const SAMPLE_KIT = path.resolve(__dirname, '../fixtures/sample-kit');

    const ALL_IDS = ['claude-code', 'cursor', 'codex', 'gemini-cli', 'copilot', 'windsurf', 'antigravity', 'trae'];

    async function withTmpDir(fn) {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rt-'));
      try { return await fn(tmp); }
      finally { await fs.rm(tmp, { recursive: true, force: true }); }
    }

    async function walkFiles(dir) {
      const out = [];
      async function visit(d) {
        let entries;
        try { entries = await fs.readdir(d, { withFileTypes: true }); }
        catch { return; }
        for (const e of entries) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) await visit(p);
          else if (e.isFile()) out.push(p);
        }
      }
      await visit(dir);
      return out;
    }

    async function countStubs(dir) {
      const files = await walkFiles(dir);
      let count = 0;
      for (const f of files) {
        try {
          const c = await fs.readFile(f, 'utf8');
          if (c.includes('kit-mcp:reference')) count++;
        } catch {}
      }
      return count;
    }

    test('all 8 targets — registry has every expected ID', () => {
      const ids = Object.keys(TARGETS).sort();
      assert.deepEqual(ids, [...ALL_IDS].sort(),
        `registry IDs mismatch: got ${ids.join(',')}, expected ${[...ALL_IDS].sort().join(',')}`);
    });

    test('all 8 targets — getTarget succeeds and exposes >=1 capability', () => {
      for (const id of ALL_IDS) {
        const t = getTarget(id);
        const caps = ['rules', 'agents', 'commands', 'skills', 'framework', 'hooks'];
        const present = caps.filter(c => !!t[c]);
        assert.ok(present.length >= 1, `target ${id} has zero capabilities`);
      }
    });

    for (const id of ALL_IDS) {
      test(`sync round-trip — ${id}: install writes >=1 file, remove cleans agent/command/skill stubs`, async () => {
        await withTmpDir(async (tmp) => {
          // Install
          const installResult = await syncTo(id, { projectRoot: tmp, kitRoot: SAMPLE_KIT, mode: 'reference' });
          assert.equal(installResult.target, id);
          const filesAfterInstall = await walkFiles(tmp);
          assert.ok(filesAfterInstall.length >= 1,
            `${id}: sync install wrote 0 files`);

          // Remove
          const removeResult = await removeFrom(id, { projectRoot: tmp });
          assert.equal(removeResult.target, id);

          // Post-remove: ZERO stubs in capability dirs (rules aggregated may stay — that's by design)
          const target = getTarget(id);
          let stubsInCaps = 0;
          for (const cap of ['agents', 'commands', 'skills', 'framework', 'hooks']) {
            if (!target[cap]) continue;
            const capDir = path.join(tmp, target[cap].path);
            stubsInCaps += await countStubs(capDir);
          }
          assert.equal(stubsInCaps, 0,
            `${id}: sync remove left ${stubsInCaps} stub file(s) under agents/commands/skills/framework/hooks`);
        });
      });
    }
    ```

    Verificar que o test runner pega o file (test/run.mjs varre test/unit/*.test.js automaticamente — confirmado pelo padrão dos 30 testes existentes).

    Edge case sample-kit fixture: cada target precisa de pelo menos 1 capability cujos paths existam em sample-kit. Verificação prévia:
    - `test/fixtures/sample-kit/agents/sample-agent.md` ✅ (cobre claude-code, cursor, copilot, windsurf, antigravity, trae)
    - `test/fixtures/sample-kit/commands/sample-command.md` ✅ (cobre claude-code; outros não têm commands)
    - `test/fixtures/sample-kit/skills/sample-skill/SKILL.md` ✅ (cobre claude-code, codex, gemini-cli, copilot, windsurf, antigravity)
    - `test/fixtures/sample-kit/framework/workflows/sample-workflow.md` ✅ (cobre claude-code framework)
    - `test/fixtures/sample-kit/hooks/sample-hook.js` ✅ (cobre claude-code hooks)

    Para targets com só rules (codex tem rules+skills, gemini-cli idem) — com agents=null, sync não escreve em .agents path. Mas rules aggregated (AGENTS.md, GEMINI.md) é gerado. PLUS skills sample existe. → ≥2 files written for codex/gemini-cli.

    Para trae (rules+agents): rules multi (1 stub per agent) + agents stub. ≥2 files.

    Todos os 8 targets têm ≥1 file written. Test 1 invariante satisfeita.

    Para test 2 (post-remove stubs in caps == 0):
    - claude-code: agents/commands/skills/framework/hooks all populated then cleaned. ✅
    - cursor: agents stub cleaned (no commands/skills). Rules multi (.cursor/rules/) NOT cleaned because rules path not in removeFrom loop — but rules path is not in `caps` list checked in test, OK.
    - codex: skills cleaned. Rules single AGENTS.md not in `caps`. ✅
    - gemini-cli: skills cleaned. Rules single GEMINI.md not in `caps`. ✅
    - copilot: agents+skills cleaned. Rules single .github/copilot-instructions.md not in `caps`. ✅
    - windsurf: agents+skills cleaned. Rules multi .windsurf/rules/ NOT cleaned but not in `caps`. ✅
    - antigravity: agents+skills (workflows path) cleaned. Rules multi .agents/rules/ NOT cleaned but not in `caps`. ✅
    - trae: agents cleaned (no skills). Rules multi .trae/rules/ NOT cleaned but not in `caps`. ✅

    Todos passam. Test confiável.

    POR QUÊ não testar mode=copy: sync.test.js já cobre copy mode para claude-code. Adicionar 8× copy mode aqui dobra runtime sem cobrir bug novo (logic de path resolution é a mesma; só renderItem muda).
  </implementation>
  <acceptance_criteria>
    - Arquivo `test/unit/sync-round-trip-all-targets.test.js` existe.
    - File compila e roda sem syntax errors: `node test/run.mjs test/unit/sync-round-trip-all-targets.test.js` exit code 0.
    - Total de testes adicionados: 10 (1 registry IDs + 1 capability sanity + 8 round-trips).
    - Todos 10 passam.
    - Suite total cresce de 289 → 299 testes (10 novos), 0 fails.
    - Tempo de execução do file < 30 segundos (8 round-trips em fixtures pequenas).
  </acceptance_criteria>
  <verify>
    <automated>
      ```bash
      # 1. File exists
      test -f test/unit/sync-round-trip-all-targets.test.js || (echo "FAIL: test file missing"; exit 1)
      # 2. Run only this file — must exit 0
      node test/run.mjs test/unit/sync-round-trip-all-targets.test.js || (echo "FAIL: new test file failed"; exit 1)
      # 3. Run full unit suite — must still pass
      node test/run.mjs test/unit || (echo "FAIL: full unit suite regression"; exit 1)
      # 4. Run full integration suite — must still pass (no integration changes expected)
      node test/run.mjs test/integration || (echo "FAIL: integration suite regression"; exit 1)
      echo "OK: regression tests pass; suite green"
      ```
      Exit code 0 + `OK: regression tests pass; suite green`.
    </automated>
  </verify>
  <done>
    Regression test file criado, 10 novos testes (8 round-trips + 2 sanity), todos pass. Suite cresce 289 → 299 sem regressão. Defesa em profundidade local-side espelha o que CI matrix exercita — bugs específicos por target podem ser pegos em pré-PR.
  </done>
</task>

</tasks>

<verification>
Após as 3 tarefas:

1. **ci.yml estrutural**:
   - `grep -c "target: \[claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae\]" .github/workflows/ci.yml` ≥ 1
   - `grep -c '\${{ matrix.target }}' .github/workflows/ci.yml` ≥ 3
   - `grep -c "if: matrix.target == 'claude-code'" .github/workflows/ci.yml` ≥ 6
   - `grep -c "fail-fast: false" .github/workflows/ci.yml` ≥ 1 (preservar)
   - Step "Sync round-trip" body NÃO contém literal `claude-code`.

2. **Regression test**:
   - File `test/unit/sync-round-trip-all-targets.test.js` existe.
   - 10 testes novos (1 registry coverage, 1 capability sanity, 8 round-trips por target).

3. **Suite global**:
   - `node test/run.mjs test/unit` exit 0
   - `node test/run.mjs test/integration` exit 0
   - Test count cresce de 289 → 299 (mínimo). 0 fails.

4. **Registry íntegro**:
   - Sem mudanças em `src/core/registry.js` (read-only nesta fase).
   - Sem mudanças em `src/core/sync.js`.

5. **Validação YAML**:
   - LOCAL: nenhum YAML lint disponível (sem js-yaml, sem Python). Confiar em edits cirúrgicos via Edit tool.
   - CI: GitHub Actions roda parser na primeira invocação do workflow. Se YAML quebrou, smoke job falha em todos os runs imediatamente — feedback rápido.

6. **Custo de CI**:
   - Pre-Phase 87: 9 runs (3 OS × 3 Node), ~10 steps cada = ~90 step-executions.
   - Post-Phase 87: 72 runs (3 OS × 3 Node × 8 targets), mas só "Sync round-trip" step roda em todos 72; outros steps gated com `if: matrix.target == 'claude-code'` rodam só em 9 runs. Total: ~9×7 (claude-code only) + 72×4 (always: checkout, setup-node, install, round-trip) = ~351 step-executions. Aumento ~3.9× vs baseline (esperado dado a expansão 8×). Otimizado.
</verification>

<success_criteria>
- DX-15-03 endereçado: CI matrix expandida de 1 → 8 targets, `${{ matrix.target }}` parametriza sync round-trip.
- `fail-fast: false` preservado para isolamento de falhas por target.
- Targets independentes: cada um dos 8 IDs (claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae) tem CI run próprio.
- 1+ regression test local (3 task entrega 10 testes adicionais — supera o "1+" mínimo).
- Suite continua passing: 289 → 299 testes, 0 fails.
- YAML válido (validado em runtime CI; estrutura preservada via edits cirúrgicos local).
- Step target-agnostic (Tests, Audits, MCP boot) gated com `if:` — custo CI cresce ~4× em vez de 8×.
- Mirror-tree safety step continua claude-code-only (gated com `if:` — semântica preservada porque framework/hooks só existem em claude-code).
- Hardcoded `claude-code` permanece intencional em: linha 146 (CLI smoke install dry-run — sentinel for CLI surface), Mirror-tree safety body — ambos justificados.
</success_criteria>

<output>
After completion, create `.planning/phases/87-ci-matrix-expansion/87-01-SUMMARY.md` documenting:
- DX-15-03 closed
- 4 hardcoded `claude-code` references analyzed: 3 substituídos (linhas 179, 190, 206 within Sync round-trip), 1 preserved with rationale (linha 146 CLI smoke = sentinel for CLI surface, NOT for IDE coverage).
- Step gating strategy: target-agnostic steps with `if: matrix.target == 'claude-code'` to avoid 8× repetition of Tests/Audits/MCP boot.
- 10 regression tests added in `test/unit/sync-round-trip-all-targets.test.js`.
- Test baseline 289 → 299, 0 fails.
- CI cost analysis: from ~90 step-executions to ~351 (~4×, optimized vs naïve 8× = ~720).
- Deferred for v1.16+: PR-mode CI subset (only Linux × 1 Node × 8 targets = 8 runs in PR; full matrix on main/tags).
</output>
