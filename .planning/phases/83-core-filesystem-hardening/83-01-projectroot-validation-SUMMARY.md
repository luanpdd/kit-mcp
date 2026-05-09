---
phase: 83-core-filesystem-hardening
plan: 01
subsystem: security
tags: [mcp, projectRoot, path-safety, sec-14-03, allowlist, walk-up, git-workspace]

# Grafo de dependências
requires:
  - phase: 79-mcp-shell-exec-removal
    provides: "guard pattern for MCP transport (Phase 79.01 gates.run sentinel)"
  - phase: 82-web-surface-hardening
    provides: "baseline 222 testes verde antes do plan iniciar"
provides:
  - "validateProjectRoot helper (puro, async, retorna {ok, resolvedPath} ou {ok:false, reason})"
  - "guard SEC-14-03 ativo em handleSync e handleReverseSync"
  - "sentinel uniforme 'MCP sync requires projectRoot to be a git workspace' em todas reject branches"
  - "regression test pattern para guards de transport MCP (6 cases — UNC, AppData-equiv, .git/ direto, .git/ ancestor, reverse-sync, CLI contract)"
affects:
  - "Phase 83.02 (gate-runner tmpdir) — co-deploy, mesma fase"
  - "Phase 83.03 (manifest verification) — co-deploy, mesma fase"
  - "Phase 84 (MCP error sanitization) — pode endossar guard em handleForensics se decidir alargar surface"

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - "MCP transport guard pattern (handler-level check antes de dispatch)"
    - "Sentinel-uniform error envelopes (uma string que MCP clients matcham via regex única)"
    - "Walk-up filesystem heurístico (vs spawn git rev-parse) — sem dependência de PATH em runtime"
    - "CLI/MCP trust asymmetry (CLI trusts caller, MCP transport never trusts)"

key-files:
  created:
    - "src/core/path-safety.js"
    - "test/unit/mcp-projectroot-guard.test.js"
  modified:
    - "src/mcp-server/index.js"

key-decisions:
  - "Helper retorna {ok, reason} em vez de throw — alinhado com error envelope shape de outros handlers MCP"
  - "Walk-up até root para .git/ (vs check só do diretório direto) — cobre monorepo com workspace nested"
  - "Heurística mkdir .git em vez de git init real — suficiente para o threat model, sem dependência de git no PATH em runtime"
  - "Sentinel uniforme em todas branches de rejeição — MCP clients precisam de uma única regex"
  - "CLI NÃO recebe o guard — preserva contract Phase 79.01 + stable API v1.0+"

patterns-established:
  - "MCP transport-level guards: validar args untrusted antes de qualquer dispatch que toque disk"
  - "Helper puro retorna discriminated union {ok:true,...}|{ok:false,reason} em vez de throw quando caller já tem error envelope shape"
  - "Test pattern para guards: dispatcher real (server._requestHandlers Map) + happy/sad cases via tmpdir + mkdir .git"

requirements-completed:
  - SEC-14-03

# Métricas
duration: 4.6 min
completed: 2026-05-09
---

# Phase 83 Plan 01: ProjectRoot Validation Summary

**MCP handlers handleSync e handleReverseSync agora bloqueiam projectRoot fora de git workspace (UNC fake host, AppData arbitrário) via helper puro com walk-up `.git/` heurístico — fechando vetor SEC-14-03 de write-anywhere.**

## Performance

- **Duração:** 4.6 min
- **Iniciado:** 2026-05-09T10:48:32Z
- **Concluído:** 2026-05-09T10:53:08Z
- **Tarefas:** 3 / 3
- **Arquivos modificados:** 3 (2 criados + 1 editado)

## Realizações

- **Vetor SEC-14-03 fechado:** atacante via MCP envia `projectRoot=\\evil-host\share` ou path do AppData → server retorna `{ error: "MCP sync requires projectRoot to be a git workspace; ..." }` SEM tocar disco.
- **Cobertura simétrica:** mesmo guard aplicado em `handleSync` (status/install/remove) e `handleReverseSync` (detect/apply). `targets` continua exempto — não usa projectRoot.
- **CLI inalterado:** stable API v1.0+ preservada — `kit sync install <target>` continua aceitando qualquer dir (mesma trust model da Phase 79.01).
- **6 regression tests SEC-14-03:** UNC fake host + tmpdir sem `.git/` + tmpdir com `.git/` raiz + nested com `.git/` em ancestor + reverse-sync mirror + CLI contract grep.
- **Sentinel-uniform error envelopes:** todas as 6 branches de rejeição agora carregam o literal `"MCP sync requires projectRoot to be a git workspace"` — MCP clients matcham com 1 regex.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente (`--no-verify` por convenção do parallel execution context):

1. **Tarefa 1: Helper puro `validateProjectRoot`** — `1f9a09d` (feat)
2. **Tarefa 2: Aplicar guard em `handleSync` + `handleReverseSync`** — `5ebc150` (feat)
3. **Tarefa 3: Regression tests SEC-14-03 + sentinel uniformity** — `5f74477` (test)

_Tarefa 3 absorveu a correção [Rule 1 - Bug] da uniformidade do sentinel — ver "Desvios do Plano"._

## Arquivos Criados/Modificados

- `src/core/path-safety.js` (criado, 110 linhas) — helper puro com export `validateProjectRoot(projectRoot)` retornando `{ok, resolvedPath}` ou `{ok:false, reason}`. Constante `SENTINEL` no topo do módulo garante que toda rejeição contém a frase canônica.
- `src/mcp-server/index.js` (editado, +29/-8) — import do helper + guard inline em `handleSync` e `handleReverseSync` antes do dispatch. `guard.resolvedPath` (não `args.projectRoot` cru) é o que flui pra baixo, defesa contra `..` slip mesmo após `path.resolve`. Phase 79.01 gates.run guard intocado.
- `test/unit/mcp-projectroot-guard.test.js` (criado, 158 linhas) — 6 testes via `server._requestHandlers` Map dispatch, mesmo pattern de `mcp-gates-guard.test.js`.

## Decisões Tomadas

- **`{ok, reason}` discriminated union (vs throw):** Os handlers MCP padronizam erro como `{ error: <string> }`. Throw exigiria try/catch repetido em cada handler; helper puro retornando `{ok}` é mais limpo e o caller decide se traduz para envelope MCP, exit code CLI, ou outra coisa.
- **Walk-up até root (vs só diretório direto):** Cobre o caso edge documentado em CONTEXT.md — monorepo com `.git/` no parent. Custo: stat por nível, max ~8 níveis em workspaces típicos.
- **`fs.stat` em vez de `git rev-parse --show-toplevel`:** Sem dependência de `git` no PATH em runtime do MCP, sem spawn latency em cada tool call, sem risco de git ler config influenciado pelo cwd. Heurística `.git/` cobre 99% dos casos sem child_process.
- **Sentinel uniforme em todas branches:** MCP clients precisam de UMA regex pra detectar refusal. Antes da Tarefa 3 só a branch "no .git" carregava a frase; UNC paths bouncing pela existência tinham mensagem diferente. Após a fix, qualquer rejeição contém `"MCP sync requires projectRoot to be a git workspace"`.
- **CLI sem guard:** Phase 79.01 estabeleceu trust asymmetry (CLI confia em quem invocou bin/cli.js; MCP transport nunca confia em args). Test 6 grep-defende esse contract.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Rule 1 - Bug] Sentinel não-uniforme entre branches do helper**

- **Encontrado durante:** Tarefa 3 (RED do TDD) — testes 1 e 5 falharam com o helper original.
- **Problema:** O design original tinha 4 mensagens de rejeição distintas. Apenas a branch "walk-up esgotou sem achar `.git/`" continha o literal `"git workspace"`. UNC paths fake (`\\evil-host\share`) falhavam ANTES — na branch de existência (`fs.stat → ENOENT`) — então a mensagem era `"projectRoot does not exist or is unreachable"` sem o sentinel. O plano (linha 113 do `<interfaces>` + linha 246-247 das tasks) afirmava expressamente que MCP clients matcham `/git workspace/` como sentinel — a implementação inicial quebrou essa promessa para 3 das 4 branches.
- **Correção:** Extraída constante `SENTINEL = 'MCP sync requires projectRoot to be a git workspace'` no topo de `src/core/path-safety.js`. Todas as 4 branches de rejeição (empty/null, non-string, não-absoluto, stat fail, não-diretório, sem `.git/`) agora prefixam o reason com `SENTINEL + '; ...'`. Comportamento inalterado (ainda `ok:false`, ainda bloqueia o dispatch) — só o wire format ficou uniforme.
- **Arquivos modificados:** `src/core/path-safety.js` (uma constante + 6 reasons reformulados).
- **Verificação:** Re-run dos 6 testes — todos GREEN. Helper-direct invocation (Task 1 verify command) continua passando.
- **Comitado em:** `5f74477` (junto com os testes — TDD natural).

---

**Total de desvios:** 1 corrigido automaticamente (Regra 1 - bug de wire-format consistency)
**Impacto no plano:** Correção necessária para correção contractual — o plano explicitamente documentava a sentinel uniforme. Sem expansão de escopo. Implementação inicial subentregava o que o plan especificava.

## Problemas Encontrados

Nenhum. Os comandos de verify do plano executaram limpos depois da correção [Rule 1] na Tarefa 3. Suite green.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Mudança puramente runtime de validação de input MCP.

## Prontidão para Próxima Fase

- **Phase 83.02 + 83.03 co-deploy:** este plan e os 2 paralelos (gate-runner tmpdir + manifest verification) compartilham a fase 83. Suite combinada 155 unit + 83 integration = 238 verde após todos os 3 commits dos paralelos chegarem (`6a6a276` 83.02, `1d1876e` + `56718ee` 83.03, mais os 3 deste plan).
- **Phase 84 (MCP error sanitization):** poderia opcionalmente alargar o guard pattern para `handleForensics` (que aceita `projectRoot` mas só lê `.planning/`). Decisão deferida ao próprio Phase 84.
- **Stable API v1.0+:** preservado. CLI surface inalterado. `kit-mcp` package consumers que apontam projectRoot legítimo (workspace de git) continuam funcionando sem mudança.

## Self-Check: PASSED

- ✅ `src/core/path-safety.js` existe (FOUND)
- ✅ `src/mcp-server/index.js` existe (FOUND, modificado)
- ✅ `test/unit/mcp-projectroot-guard.test.js` existe (FOUND)
- ✅ Commit `1f9a09d` (Task 1) presente em git log
- ✅ Commit `5ebc150` (Task 2) presente em git log
- ✅ Commit `5f74477` (Task 3) presente em git log

---
*Fase: 83-core-filesystem-hardening*
*Plan: 01*
*Concluído: 2026-05-09*
