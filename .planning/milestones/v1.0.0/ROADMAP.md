# ROADMAP.md — v1.0.0 "Estabilização para 1.0"

> Numeração contínua (não reseta) — última fase entregue foi a v0.5.0. Próxima é Fase 1.

## Estratégia de execução

Quatro fases ordenadas por dependência e blast radius. Fase 1 é quick wins independentes (XS), Fase 2 é o fix do parser (XS, mas precisa de teste), Fase 3 é a expansão do reverse-sync (S), Fase 4 é a infraestrutura de testes (M, maior peça), Fase 5 é o cut.

Cada fase termina com commit atômico + (em fase aplicável) push pra main. CI roda em todo push.

---

## Fase 1 — Débitos de tooling (XS)

**REQ atendidos:** REQ-009, REQ-010

**Trabalho:**
1. Criar `.github/dependabot.yml` com group npm weekly
2. Executar `gh release create v0.5.0 --notes-from-tag --latest` (notas extraídas do CHANGELOG do `[0.5.0]`)

**Arquivos tocados:**
- `.github/dependabot.yml` (novo)

**Critério de saída:**
- `gh release list` mostra v0.5.0 como Latest
- Dependabot aparece habilitado em /settings/security_analysis (verificar manualmente)

**Não toca código de runtime.** Risco zero.

---

## Fase 2 — Bug fix: parser de frontmatter (XS)

**REQ atendidos:** REQ-008

**Trabalho:**
1. Editar `src/core/kit.js:firstNonEmptyLine` para pular linhas começando com `<!--`
2. Re-rodar local: `node bin/cli.js kit list-commands | grep inserir-fase` deve mostrar a descrição correta
3. Adicionar fixture e test (mesma fase, antes do commit, mas test só passa depois da Fase 4 onde o runner é configurado — então deixa pra lá esse teste, gravar no plano de Fase 4)

**Arquivos tocados:**
- `src/core/kit.js`

**Critério de saída:**
- Skill `inserir-fase` (e qualquer outro com mesma estrutura) mostra description correta
- CLAUDE.md regerado tem o texto certo no autocomplete listing

---

## Fase 3 — Reverse-sync para framework e hooks (S)

**REQ atendidos:** REQ-005, REQ-006, REQ-007

**Trabalho:**
1. Em `src/core/reverse-sync.js`:
   - `detectReverse`: além dos kinds atuais, walkear `<projectRoot>/<spec.path>` para `framework` e `hooks` (os mirror-tree caps), comparar conteúdo byte-a-byte com `<kitRoot>/<spec.source>/<rel>`. Skip `.kit-mcp-managed`.
   - `applyReverse`: cada candidato `kind: 'framework'|'hooks'` aplica `overwrite` (cópia direta), `skip` (não-op), `merge` cai pra overwrite com warn no resultado, `rename` escreve `kit/<source>/<rel>.from-<ide>`.
2. Atualizar handlers MCP em `src/mcp-server/index.js` (não precisa mudar nada — o handler já delega para detect/apply)
3. README: seção "kit reverse-sync ..." ganha exemplo cobrindo framework

**Arquivos tocados:**
- `src/core/reverse-sync.js`
- `README.md`

**Critério de saída:**
- Smoke local: editar um arquivo em `.claude/framework/`, rodar `kit reverse-sync detect claude-code` → arquivo aparece no resultado, rodar `kit reverse-sync apply --strategy overwrite` → mudança volta pra `kit/framework/`
- (Tests de regressão são gravados na Fase 4)

---

## Fase 4 — Infraestrutura de testes (M)

**REQ atendidos:** REQ-001, REQ-002, REQ-003, REQ-004

**Trabalho:**

**4.1. Setup runner**
- `package.json`: adicionar `"test": "node --test test/**/*.test.js"` e `"test:integration": "node --test test/integration/**/*.test.js"`
- Criar diretório `test/` e `test/fixtures/sample-kit/` (mini-kit com 1 agent, 1 command, 1 skill, 1 framework file, 1 hook)
- README: renomear "Smoke tests" → "Tests" e adicionar exemplo de `npm test`

**4.2. Tests unit**
- `test/kit.test.js` — frontmatter parser (incluindo o fix da Fase 2), listKit, searchKit, findItem
- `test/sync.test.js` — todos os modos, marker, walkTree, removeFrom safety
- `test/reverse-sync.test.js` — detect/apply para todas as kinds (incluindo framework/hooks da Fase 3)
- `test/gate-runner.test.js` — verdict mapping
- `test/registry.test.js` — listTargets, getTarget

**4.3. Test integration**
- `test/integration/cli-roundtrip.test.js` — spawn `bin/cli.js`, sync install → edit → reverse-sync → remove

**4.4. CI**
- `.github/workflows/ci.yml`: novo step "Tests" que roda `npm test` antes do "CLI smoke"
- Job continua passando em 6/6 combinações

**Arquivos tocados:**
- `package.json`
- `test/**/*` (novos)
- `.github/workflows/ci.yml`
- `README.md`

**Critério de saída:**
- `npm test` local passa com ≥ 30 asserts em < 5s
- `npm run test:integration` passa em < 10s
- CI verde em 6/6 combinações com tempo total < 90s

---

## Fase 5 — Cut da v1.0.0 (XS)

**REQ atendidos:** REQ-011, REQ-012

**Trabalho:**
1. `.github/workflows/publish.yml`: adicionar step `gh release create v$VERSION --notes-from-tag --latest` após `npm publish`. Usa `GITHUB_TOKEN` (já disponível no env de Actions).
2. CHANGELOG entry `[1.0.0]` com seção "Stable API commitment" descrevendo o contrato:
   - `TARGETS` table format em `registry.js`
   - MCP tool action names + argument shape
   - CLI subcommand names + flag surface
   - `core/*.js` module exports (named, ESM)
3. `npm version major` (1.0.0) + `git push --follow-tags`
4. Verificar:
   - npm registry mostra 1.0.0 como latest
   - GitHub Releases mostra 1.0.0 como Latest (criada pelo workflow novo)

**Arquivos tocados:**
- `.github/workflows/publish.yml`
- `CHANGELOG.md`
- `package.json` (via `npm version major`)

**Critério de saída:**
- `npm view @luanpdd/kit-mcp version` retorna `1.0.0`
- `gh release list` mostra v1.0.0 como Latest
- CI verde no push da release

---

## Resumo executivo

| Fase | Esforço | Risco | REQ |
|---|---|---|---|
| 1. Débitos tooling | XS | nenhum | 009, 010 |
| 2. Parser fix | XS | baixo | 008 |
| 3. Reverse-sync framework/hooks | S | baixo | 005, 006, 007 |
| 4. Tests | M | médio (descobre bugs) | 001, 002, 003, 004 |
| 5. Cut 1.0.0 | XS | baixo | 011, 012 |

**Ordem recomendada:** estritamente sequencial. A Fase 4 valida tudo das fases 2 e 3.

**Estimativa de duração total:** 1 sessão longa ou 2-3 sessões curtas se quebrar.

---

## Próximo passo

`/planejar-fase 1` — gera `PHASE-1-PLAN.md` detalhado com tasks executáveis.
