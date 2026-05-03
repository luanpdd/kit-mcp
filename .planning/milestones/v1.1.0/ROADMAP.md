# ROADMAP.md — v1.1.0 "Feedback visual no terminal"

> Numeração contínua. Última fase entregue foi a v1.0.0/Fase 5. Próxima é Fase 6.

## Estratégia de execução

5 fases ordenadas. Fase 6 é a fundação (UI module + deps). Fase 7 troca o default de output. Fase 8 adiciona progress/spinner em ops longas/curtas. Fase 9 adiciona prompts interativos. Fase 10 é cut.

Cada fase: commit atômico + push pra main + CI valida. Cut só na Fase 10.

---

## Fase 6 — UI primitives + deps (S)

**REQ atendidos:** REQ-001, REQ-008 (parcial — tests dos primitivos)

**Trabalho:**

1. `npm install picocolors @inquirer/prompts` — adiciona deps em `package.json`.
2. Criar `src/core/ui.js` (~150-200 LOC) com:
   - `c` — wraps picocolors com helpers `c.green/red/yellow/dim/bold`
   - `icons = { check: '✓', cross: '✗', warn: '⚠', dot: '•', spinner: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'] }`
   - `spinner({ text })` — usa `process.stdout.isTTY` pra decidir animar ou linear
   - `progress({ total, label })` — barra `[━━━━░░░░░] 40% (8/20) {label}` ou texto linear em pipe
   - `select(opts)` — wrapper de `@inquirer/prompts/select`
   - `confirm(opts)` — wrapper de `@inquirer/prompts/confirm`
   - `summary({ title, rows, total, hint })` — renderiza painel multi-linha com cores
   - Respeita `NO_COLOR`, `FORCE_COLOR`, `process.stdout.isTTY`
3. `test/unit/ui.test.js` cobre os primitivos determinísticos.
4. README ganha seção "Dependencies" reconhecendo as 2 novas (já que pré-1.0 falava em 3 deps; agora vão ser 5).

**Arquivos tocados:**
- `package.json`
- `package-lock.json`
- `src/core/ui.js` (novo)
- `test/unit/ui.test.js` (novo)
- `README.md`

**Critério de saída:**
- `npm test` passa (37 + 4-5 novos = ~42 unit tests)
- `node -e "import('./src/core/ui.js').then(({summary}) => summary({title:'Test', rows:[['a',1]], total:1}))"` imprime painel colorido

---

## Fase 7 — `--json` flag global, default humano (S)

**REQ atendidos:** REQ-002, REQ-007 (summary integrado nos comandos)

**Trabalho:**

1. `bin/cli.js` ou `src/cli/index.js` adiciona option global `--json` em todos os subcomandos (Commander).
2. Cada subcomando tem fork:
   ```js
   if (opts.json) {
     console.log(JSON.stringify(result, null, 2));
   } else {
     renderHuman(result);
   }
   ```
3. `renderHuman` por subcomando — funções pequenas em `src/cli/render.js`:
   - `renderSyncResult(result)` → summary panel
   - `renderRemoveResult(result)` → summary
   - `renderListAgents(items)` → tabela
   - `renderInstallTargets(targets)` → tabela
   - etc
4. Test integration confirma `--json` ainda parsea; sem `--json` tem ANSI/cor.

**Arquivos tocados:**
- `bin/cli.js` ou `src/cli/index.js`
- `src/cli/render.js` (novo)
- `test/integration/cli-roundtrip.test.js` (estende)

**Critério de saída:**
- `kit list-agents` mostra tabela colorida; `kit list-agents --json | jq .` parses
- `kit sync install claude-code --project-root /tmp/x` mostra summary; com `--json` retorna estrutura atual

---

## Fase 8 — Progress + spinner em ops longas/curtas (M)

**REQ atendidos:** REQ-003, REQ-004

**Trabalho:**

1. `src/core/sync.js` `syncTo` aceita `onProgress({ phase, current, total, label })` opcional.
   - Emite `{ phase: 'agents', current: 5, total: 19, label: 'planner.md' }` em cada arquivo escrito
   - Mirror-tree caps emitem por arquivo copiado
2. `src/core/reverse-sync.js` `applyReverse` idem.
3. `src/core/failures.js` `collectFailures` idem (1 evento por arquivo lido).
4. `src/cli/render.js` cada subcomando que invoca essas funções:
   - Cria `progress({ total: estimated })` antes de chamar
   - Passa `onProgress: ({ current }) => p.tick({ label })` como callback
   - Chama `p.finish()` no final
5. Curtas (sem progress): wrap em `spinner()` antes da chamada, `succeed/fail` depois.

**Arquivos tocados:**
- `src/core/sync.js`, `reverse-sync.js`, `failures.js` (assinaturas)
- `src/cli/render.js`
- `test/integration/cli-roundtrip.test.js` (assert presença de `100%` no stdout pra ops longas)

**Critério de saída:**
- `kit sync install claude-code --project-root /tmp/big` mostra barra avançando 6 fases (rules, agents, commands, skills, framework, hooks)
- `kit list-agents` em pipe ainda funciona linearmente (`Loading kit...` e depois listagem)

---

## Fase 9 — Selectors + diff confirm (M)

**REQ atendidos:** REQ-005, REQ-006

**Trabalho:**

1. `src/cli/index.js` no comando `install write`:
   - Se `--target` ausente AND TTY AND não `--json` → chamar `select({ message, choices: listInstallTargets() })` e usar a escolha
   - Se non-TTY ou `--json` sem `--target` → erro descritivo
2. Idem em `sync install`.
3. `install write` antes de gravar:
   - Computar o diff (estado anterior do arquivo de config vs novo)
   - Renderizar visual com `c.dim` linhas removidas / `c.green` linhas adicionadas
   - `confirm({ message: 'Apply these changes?', default: false })`
   - Pular se `--yes` ou `--json`
4. Test integration: stdin closed sem --target → exit 1 com mensagem; `--yes` aplica direto.

**Arquivos tocados:**
- `src/cli/index.js`
- `src/mcp-server/install.js` (talvez extrair função `previewInstall(target, opts)` que retorna o diff antes de aplicar)
- `src/cli/render.js`
- `test/integration/cli-roundtrip.test.js`

**Critério de saída:**
- Local manual: `kit install write` (sem args) abre selector; depois mostra o JSON que vai gravar; `y` aplica
- CI continua passando com `--yes` em todos os smoke tests existentes

---

## Fase 10 — Cut da v1.1.0 (XS)

**REQ atendidos:** REQ-009, REQ-010

**Trabalho:**

1. README ganha seção "Visual feedback" com exemplo de summary panel + selector + spinner. Atualiza "Quick start" com exemplo do output novo.
2. README "Dependencies" reflete picocolors + @inquirer/prompts.
3. CHANGELOG entry `[1.1.0]` com:
   - 6 features novas (UI module, --json flag, progress, spinner, selectors, summary)
   - Migration note: programas que parsam stdout precisam de `--json` agora
   - Stable API addition: `--json` flag e `onProgress` callback signature passam a fazer parte do contrato 1.x
4. `npm version minor` (1.0.0 → 1.1.0) + `git push --follow-tags`
5. Verificar:
   - npm registry tem 1.1.0
   - GH Release v1.1.0 marcado Latest (criado pelo workflow auto)
   - `npm install -g @luanpdd/kit-mcp@latest && kit list-agents` mostra output novo

**Arquivos tocados:**
- `README.md`
- `CHANGELOG.md`
- `package.json` (via `npm version minor`)

**Critério de saída:**
- Cut completo, npm publicado, GH Release Latest, smoke test e2e passando

---

## Resumo executivo

| Fase | Esforço | Risco | REQ |
|---|---|---|---|
| 6. UI primitives + deps | S | nenhum (deps testadas) | 001, 008 (parcial) |
| 7. `--json` + render humano | S | baixo | 002, 007 |
| 8. Progress + spinner | M | médio (mexe em assinaturas core) | 003, 004 |
| 9. Selectors + confirm | M | médio (UX cuidadosa) | 005, 006 |
| 10. Cut | XS | baixo | 009, 010 |

**Ordem recomendada:** estritamente sequencial. Fase 7 depende de Fase 6 (usa primitives), Fases 8-9 dependem de Fase 7 (já tem render humano onde encaixar progress/prompts).

**Risco principal:** Fase 8 mexe em assinaturas de `syncTo` etc — adicionar callback opcional não quebra nada (default undefined = no-op), mas é mudança a ser comunicada na CHANGELOG como ADDITION ao Stable API contract.

**Estimativa de duração:** 1 sessão longa ou 3 sessões curtas (uma por fase do meio).

---

## Próximo passo

`/planejar-fase 6` ou rodar `/autonomo` pra encadear todas as 5 fases até a Fase 10 (cut). Recomendo este último, dado que escopo está bem delimitado e Stack decisions já foram resolvidas.
