---
plan_id: 79.03
phase: 79-critical-security-fixes
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/publish.yml
  - .github/workflows/ci.yml
autonomous: true
requirements: [SEC-13-03, SEC-13-04]
must_haves:
  truths:
    - "publish workflow falha hard se package-lock.json divergir (npm ci sem fallback awk)"
    - "ci.yml smoke job também falha hard em lockfile drift (mesmo padrão npm ci || npm install removido)"
    - "publish workflow só chega em 'npm publish' se npm test, npm run test:integration, e npm audit --omit=dev --audit-level=high passarem"
    - "Audit de runtime deps falha CI/publish em CVEs HIGH ou CRITICAL"
  artifacts:
    - path: ".github/workflows/publish.yml"
      provides: "Install step strict (npm ci) + test/audit gates antes de publish"
      contains: "npm test"
    - path: ".github/workflows/ci.yml"
      provides: "Smoke install step strict (npm ci)"
  key_links:
    - from: ".github/workflows/publish.yml step Install"
      to: "lockfile drift error"
      via: "remoção do `|| npm install` fallback"
      pattern: "npm ci$"
    - from: ".github/workflows/publish.yml steps test+audit"
      to: ".github/workflows/publish.yml step Publish"
      via: "ordem: test → integration → audit → publish"
      pattern: "name: Publish to npm"
---

# Plan 79.03: CI + publish workflow hardening

<objective>
Tornar `npm ci` strict (sem fallback silencioso para `npm install`) em ambos workflows YAML, e adicionar gates obrigatórios de tests + integration tests + npm audit antes do step `npm publish` no publish workflow.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/79-critical-security-fixes/79-CONTEXT.md
@.planning/codebase/concerns.md
@D:\projetos\opensource\mcp\.github\workflows\publish.yml
@D:\projetos\opensource\mcp\.github\workflows\ci.yml

## State atual de publish.yml (89 linhas)

Linha 35-36 (vulnerável C3):
```yaml
      - name: Install
        run: npm ci || npm install
```

Linhas 47-55 (vulnerável C4 — pula tests/audit, vai direto pro publish):
```yaml
      - name: Smoke test
        run: |
          node bin/cli.js kit list-agents | head -5
          node bin/cli.js sync targets    | head -5
          node bin/cli.js gates list      | head -5

      - name: Publish to npm
        run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## State atual de ci.yml (linha 117 vulnerável C3 paralelo)

```yaml
      - name: Install
        run: npm ci || npm install
```

Em ci.yml também tem linha 73 que é OK manter — `npm install --no-audit --no-fund --silent` no audit job (não é install primário, é setup pra `npm pack`). Esta task NÃO toca essa linha.

## Scripts npm disponíveis (de package.json)

```
"test": "node test/run.mjs test/unit"
"test:integration": "node test/run.mjs test/integration"
"test:all": "node test/run.mjs test"
```

## Padrão de audit já existente em ci.yml linhas 55-68 (template)

```yaml
      - name: Audit — npm audit (high/critical CVEs in runtime deps) (REQ v1.6 SEC-04)
        shell: bash
        run: |
          set +e
          npm audit --omit=dev --audit-level=high
          STATUS=$?
          set -e
          if [ "$STATUS" -ne 0 ]; then
            echo "::error::npm audit found high/critical CVEs in runtime deps. Run \`npm audit\` locally and address before merging."
            exit 1
          fi
          echo "OK: no high/critical CVEs in runtime deps"
```

Use este padrão exato no publish.yml também (consistência de mensagem).
</context>

<tasks>

<task id="1" type="auto">
  <name>Task 1: Remover fallback `|| npm install` em ambos workflows (publish.yml + ci.yml)</name>

  <read_first>
    - D:\projetos\opensource\mcp\.github\workflows\publish.yml (todo arquivo — 89 linhas)
    - D:\projetos\opensource\mcp\.github\workflows\ci.yml (todo arquivo — 222 linhas)
    - D:\projetos\opensource\mcp\.planning\phases\79-critical-security-fixes\79-CONTEXT.md (decisão C3)
  </read_first>

  <action>
Modificar duas linhas (uma por arquivo) — substituições atômicas:

**1) Em `D:\projetos\opensource\mcp\.github\workflows\publish.yml` linha 36:**

De:
```yaml
        run: npm ci || npm install
```

Para:
```yaml
        run: npm ci
```

**2) Em `D:\projetos\opensource\mcp\.github\workflows\ci.yml` linha 117:**

De:
```yaml
        run: npm ci || npm install
```

Para:
```yaml
        run: npm ci
```

NÃO modificar linha 73 de ci.yml (`npm install --no-audit --no-fund --silent` é setup do audit job, não é install primário). NÃO modificar nenhuma outra linha. NÃO renomear o step "Install".

Justificativa do fix (preservar como comentário inline): adicionar comentário `# SEC-13-03: strict — fail hard on lockfile drift, no silent install fallback` ACIMA do `run: npm ci` em ambos arquivos.

**Resultado esperado em publish.yml linhas 35-37:**
```yaml
      - name: Install
        # SEC-13-03: strict — fail hard on lockfile drift, no silent install fallback
        run: npm ci
```

**Resultado esperado em ci.yml linhas 116-118:**
```yaml
      - name: Install
        # SEC-13-03: strict — fail hard on lockfile drift, no silent install fallback
        run: npm ci
```
  </action>

  <verify>
```bash
# Fallback removido em ambos
grep -c "npm ci || npm install" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -c "npm ci || npm install" D:/projetos/opensource/mcp/.github/workflows/ci.yml
# Comentário SEC-13-03 presente em ambos
grep -q "SEC-13-03" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -q "SEC-13-03" D:/projetos/opensource/mcp/.github/workflows/ci.yml
# YAML continua válido (parseável)
node -e "require('js-yaml').load(require('fs').readFileSync('D:/projetos/opensource/mcp/.github/workflows/publish.yml','utf8'))" 2>&1 || echo "yaml-check skipped (no js-yaml installed)"
```
  </verify>

  <acceptance_criteria>
    - `grep -c "npm ci || npm install" D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `0`
    - `grep -c "npm ci || npm install" D:/projetos/opensource/mcp/.github/workflows/ci.yml` retorna `0`
    - `grep -q "SEC-13-03" D:/projetos/opensource/mcp/.github/workflows/publish.yml` exit 0
    - `grep -q "SEC-13-03" D:/projetos/opensource/mcp/.github/workflows/ci.yml` exit 0
    - `grep -c "run: npm ci$" D:/projetos/opensource/mcp/.github/workflows/publish.yml` >= 1
    - `grep -c "run: npm ci$" D:/projetos/opensource/mcp/.github/workflows/ci.yml` >= 1
    - Linha 73 de ci.yml (`npm install --no-audit --no-fund --silent`) intacta — `grep -q "npm install --no-audit --no-fund --silent" D:/projetos/opensource/mcp/.github/workflows/ci.yml` exit 0
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Task 2: Inserir gates de test + audit antes do step "Publish to npm" em publish.yml</name>

  <read_first>
    - D:\projetos\opensource\mcp\.github\workflows\publish.yml (deve refletir mudança da Task 1, linhas 47-57 são área de inserção)
    - D:\projetos\opensource\mcp\.github\workflows\ci.yml linhas 55-68 (padrão de audit a copiar)
    - D:\projetos\opensource\mcp\package.json (confirmar nomes de scripts: test, test:integration)
    - D:\projetos\opensource\mcp\.planning\phases\79-critical-security-fixes\79-CONTEXT.md (decisão C4)
  </read_first>

  <action>
Em `D:\projetos\opensource\mcp\.github\workflows\publish.yml`, inserir 3 novos steps ENTRE o step "Smoke test" (que termina na linha 52) e o step "Publish to npm" (que começa na linha 54). A ordem deve ser:

1. Sanity (já existe — linha 38)
2. Smoke test (já existe — linha 48)
3. **NOVO** — Tests (unit) — `npm test`
4. **NOVO** — Tests (integration) — `npm run test:integration`
5. **NOVO** — Audit — `npm audit --omit=dev --audit-level=high` com mesmo padrão do ci.yml
6. Publish to npm (existente — linha 54)

Conteúdo exato a inserir (mantendo indentação 6-space dos steps existentes — confira `      - name:` no arquivo atual):

```yaml
      - name: Tests (unit)
        # SEC-13-04: never publish without unit tests passing — v1.12.1 race condition escaped exactly here
        run: npm test

      - name: Tests (integration)
        # SEC-13-04: never publish without integration tests passing
        run: npm run test:integration

      - name: Audit — npm audit (high/critical CVEs in runtime deps)
        # SEC-13-04: never publish if runtime deps have HIGH or CRITICAL CVEs
        shell: bash
        run: |
          set +e
          npm audit --omit=dev --audit-level=high
          STATUS=$?
          set -e
          if [ "$STATUS" -ne 0 ]; then
            echo "::error::npm audit found high/critical CVEs in runtime deps. Bump dep or wait for fix advisory before publishing."
            exit 1
          fi
          echo "OK: no high/critical CVEs in runtime deps"

```

Inserir esses 3 steps EXATAMENTE entre o final do step "Smoke test" (linha 52, após `node bin/cli.js gates list      | head -5`) e o início do step "Publish to npm" (linha 54, `      - name: Publish to npm`).

NÃO modificar o step "Publish to npm" em si. NÃO modificar o step "Extract notes from CHANGELOG" nem "Create GitHub Release". NÃO mudar o nome do step "Smoke test". NÃO inserir steps adicionais além desses 3.

Resultado final esperado: o arquivo publish.yml deve ter 6 steps após "Sanity": Smoke test → Tests (unit) → Tests (integration) → Audit → Publish → Extract notes → Create Release.
  </action>

  <verify>
```bash
# Os 3 novos steps existem
grep -c "name: Tests (unit)" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -c "name: Tests (integration)" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -c "name: Audit — npm audit" D:/projetos/opensource/mcp/.github/workflows/publish.yml
# REQ inline em todos
grep -c "SEC-13-04" D:/projetos/opensource/mcp/.github/workflows/publish.yml
# Comandos corretos
grep -q "run: npm test" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -q "run: npm run test:integration" D:/projetos/opensource/mcp/.github/workflows/publish.yml
grep -q "npm audit --omit=dev --audit-level=high" D:/projetos/opensource/mcp/.github/workflows/publish.yml
# Step Publish ainda existe (não foi destruído)
grep -q "name: Publish to npm" D:/projetos/opensource/mcp/.github/workflows/publish.yml
```
  </verify>

  <acceptance_criteria>
    - `grep -c "name: Tests (unit)" D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `1`
    - `grep -c "name: Tests (integration)" D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `1`
    - `grep -c "name: Audit — npm audit" D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `1`
    - `grep -c "SEC-13-04" D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `3` (3 steps com referência REQ)
    - `grep -q "run: npm test$" D:/projetos/opensource/mcp/.github/workflows/publish.yml` exit 0
    - `grep -q "run: npm run test:integration$" D:/projetos/opensource/mcp/.github/workflows/publish.yml` exit 0
    - `grep -q "npm audit --omit=dev --audit-level=high" D:/projetos/opensource/mcp/.github/workflows/publish.yml` exit 0
    - `grep -q "name: Publish to npm" D:/projetos/opensource/mcp/.github/workflows/publish.yml` exit 0 (step ainda intacto)
    - Ordem dos steps no arquivo: linha de "Tests (unit)" < linha de "Tests (integration)" < linha de "Audit — npm audit" < linha de "Publish to npm". Verifique com:
      `awk '/name: Tests \(unit\)/{u=NR}/name: Tests \(integration\)/{i=NR}/name: Audit — npm audit/{a=NR}/name: Publish to npm/{p=NR}END{print u<i&&i<a&&a<p?"ok":"BAD"}' D:/projetos/opensource/mcp/.github/workflows/publish.yml` retorna `ok`
  </acceptance_criteria>
</task>

<task id="3" type="auto">
  <name>Task 3: YAML lint local + regressão zero — npm test passa, npm run test:integration passa, npm audit não tem regressão NEW</name>

  <read_first>
    - D:\projetos\opensource\mcp\.github\workflows\publish.yml (deve ter 3 novos steps + npm ci strict)
    - D:\projetos\opensource\mcp\.github\workflows\ci.yml (deve ter npm ci strict)
    - D:\projetos\opensource\mcp\package.json (confirmar scripts test e test:integration)
  </read_first>

  <action>
Validar 4 coisas em sequência:

1. **YAML válido em publish.yml + ci.yml** — usar parser nativo Node se possível. Comando:

```bash
# Parsing dos dois YAMLs sem deps externas (usar Python YAML que vem no GitHub Runner — local: usar node + fallback)
node -e "
  const yaml = (() => { try { return require('js-yaml'); } catch { return null; } })();
  if (!yaml) { console.log('skip: js-yaml not available, falling back to syntax pre-check'); process.exit(0); }
  const fs = require('fs');
  for (const f of ['.github/workflows/publish.yml', '.github/workflows/ci.yml']) {
    try { yaml.load(fs.readFileSync(f, 'utf8')); console.log('OK: ' + f); }
    catch (e) { console.error('FAIL: ' + f + ' — ' + e.message); process.exit(1); }
  }
"
```

Se `js-yaml` não estiver instalado, fazer fallback: `node -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/publish.yml','utf8'); /* simples sanity: nenhum tab, indentação consistente */ if (/\t/.test(c)) { console.error('FAIL: tabs in publish.yml'); process.exit(1); } console.log('OK: no tabs');"` — verificar pelo menos que não há tabs e que indentação multi-line dos novos steps bate com o resto.

2. **`npm test` passa local:** `node test/run.mjs test/unit` em cwd=D:/projetos/opensource/mcp. Exit 0.

3. **`npm run test:integration` passa local:** `node test/run.mjs test/integration` em cwd=D:/projetos/opensource/mcp. Exit 0.

4. **`npm audit --omit=dev --audit-level=high` baseline check:** rodar e capturar output. Se HÁ vulnerabilidades HIGH ou CRITICAL no estado atual (concerns.md menciona 4 CVEs ativas via @modelcontextprotocol/sdk@1.29.0), ESTE PLAN NÃO BLOQUEIA — o objetivo é que o GATE CI exista; se ele já está vermelho ANTES do nosso fix, esse é um problema separado a ser endereçado em fase futura (concerns.md TOP 1 — bumper SDK).

Estratégia: rodar audit, capturar exit code. Se `>0`, registrar no SUMMARY que "audit gate is armed but currently failing — pre-existing CVE state, addressed separately in v1.14 dep bump (TOP-1 concern)". O plan ainda é considerado SUCESSO porque o gate ESTÁ no lugar — fechar o gate na v1.14 é trabalho subsequente.

Comando:
```bash
cd D:/projetos/opensource/mcp
npm audit --omit=dev --audit-level=high
echo "audit-exit=$?"
```

Capturar o `audit-exit` no SUMMARY.md (Task 3 não falha se audit-exit != 0 — só relatar; falha apenas se npm test ou npm run test:integration falharem).
  </action>

  <verify>
```bash
# YAML lint local (best-effort)
node -e "try{const y=require('js-yaml');const f=require('fs');y.load(f.readFileSync('.github/workflows/publish.yml','utf8'));y.load(f.readFileSync('.github/workflows/ci.yml','utf8'));console.log('YAML OK')}catch(e){console.error(e.message);process.exit(1)}"
# Tests
node test/run.mjs test/unit
node test/run.mjs test/integration
# Audit (relata, não bloqueia)
npm audit --omit=dev --audit-level=high; echo "exit=$?"
```
  </verify>

  <acceptance_criteria>
    - `node test/run.mjs test/unit` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - `node test/run.mjs test/integration` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - YAML parsing (via js-yaml ou tabs-check fallback) não acusa erro estrutural em publish.yml nem ci.yml
    - SUMMARY.md menciona audit baseline (output do `npm audit --omit=dev --audit-level=high` capturado, mesmo que falhando — gate está armado)
    - Plan considerado pass mesmo se audit local falhar (CVE existente é problema pré-existente, não regressão deste plan)
  </acceptance_criteria>
</task>

</tasks>

<verification>
Verificações gerais do plan:
- `grep -c "npm ci || npm install" .github/workflows/publish.yml` retorna 0
- `grep -c "npm ci || npm install" .github/workflows/ci.yml` retorna 0
- `grep -c "SEC-13-03" .github/workflows/{publish,ci}.yml` >= 2
- `grep -c "SEC-13-04" .github/workflows/publish.yml` retorna 3
- Os 3 novos steps existem em publish.yml: Tests (unit), Tests (integration), Audit — npm audit
- Ordem topológica: Tests → Audit → Publish (verificado por awk)
- `node test/run.mjs test/unit` exit 0
- `node test/run.mjs test/integration` exit 0
- YAML syntactically valid (no tabs, parses via js-yaml se disponível)
</verification>

<success_criteria>
- C3 fechado: `npm ci || npm install` removido de ambos publish.yml e ci.yml; lockfile drift falha hard
- C4 fechado: publish workflow agora exige `npm test` + `npm run test:integration` + `npm audit --omit=dev --audit-level=high` antes de `npm publish`
- Mesma mensagem de error no audit step que o ci.yml usa (consistência operacional)
- Cada step tem comentário REQ inline (SEC-13-03 ou SEC-13-04) para rastreabilidade
- Zero regressão: `npm test` + `npm run test:integration` passam local pré-merge
- Audit baseline capturado no SUMMARY (mesmo que ainda failing por CVEs pré-existentes — escalada explícita para v1.14)
</success_criteria>

<output>
After completion, create `.planning/phases/79-critical-security-fixes/79-03-SUMMARY.md` with:
- Diff resumido de publish.yml (linhas modificadas + 3 steps adicionados)
- Diff resumido de ci.yml (1 linha modificada)
- Output de `npm audit --omit=dev --audit-level=high` baseline (o que o gate vai ver no próximo push de tag)
- Confirmação que tests passam local
- Nota sobre CVE pré-existentes via @modelcontextprotocol/sdk se audit retornou >0 (escalada para v1.14)
</output>
</content>
</invoke>