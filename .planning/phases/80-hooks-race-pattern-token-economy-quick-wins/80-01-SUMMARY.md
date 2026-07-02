---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 01
subsystem: infra
tags: [hooks, flush-before-exit, process-exit, stdout, stderr, race-condition, regression-test]

requires:
  - phase: kit/hooks/sidecar-tool-publisher.js fix v1.12.1 (commit 56b327f)
    provides: Pattern canônico de flush-before-exit para I/O assíncrono — adaptado aqui para stdout/stderr síncrono
provides:
  - 6 hooks com classificação SEC-13-05 explícita (categories A/C/E)
  - 4 hooks com fix de callback aplicado (workflow-guard, prompt-guard, context-monitor, post-apply-migration)
  - 2 hooks documentados como isentos com justificativa inline (statusline Cat C, check-update Cat E)
  - Regression test (3 cases) cobrindo flush JSON, payload >4KB, e static check de classificação
affects: [hooks futuros, taxonomia de I/O em hooks, padrão de exit determinístico]

tech-stack:
  added: []
  patterns:
    - "flush-before-exit callback form: process.stdout.write(payload, () => process.exit(0))"
    - "Taxonomia de hook exit: A (write+exit), B (exit-only), C (no-exit), D (TCP/HTTP), E (spawn-detached)"

key-files:
  created:
    - test/unit/hooks-flush-race.test.js
  modified:
    - kit/hooks/workflow-guard.js
    - kit/hooks/prompt-guard.js
    - kit/hooks/context-monitor.js
    - kit/hooks/post-apply-migration.js
    - kit/hooks/statusline.js
    - kit/hooks/check-update.js

key-decisions:
  - "Taxonomia em 5 categorias (A/B/C/D/E) inline em cada hook — força futuros editores a classificar antes de adicionar exit paths"
  - "post-apply-migration aplica callback APENAS no resumo final; writes intermediários (mirror/stub progress) NÃO precisam — process continua executando e event loop drena"
  - "statusline NÃO recebe fix — adicionar early-exit com callback poderia truncar saída quando o write excede o pipe buffer; Node já flush em natural termination"
  - "Test deploy estratégia: copiar hook para .claude/hooks/ em tmp project (sem package.json type:module) — mirror exato do deployment via kit sync"

patterns-established:
  - "Comentário SEC-13-05 obrigatório no top de cada hook que possa exit, com categoria justificada"
  - "process.stdout.write(JSON.stringify(output), () => process.exit(0)) — forma canônica para stdout síncrono"
  - "Static test em test/unit/hooks-flush-race.test.js valida que todos os 6 hooks declaram categoria — barreira contra regressão silenciosa"

requirements-completed: [SEC-13-05]

duration: 5min
completed: 2026-05-09
---

# Phase 80 Plan 01: Hooks Flush-Before-Exit Pattern Summary

**Aplicação do pattern v1.12.1 sidecar (callback antes de process.exit) a 4 hooks com bug latente de drop de payload em pipes lentos, plus taxonomia inline em 6 hooks e regression test de 3 cases.**

## Performance

- **Duração:** 5 min
- **Iniciado:** 2026-05-09T04:56:44Z
- **Concluído:** 2026-05-09T05:01:39Z
- **Tarefas:** 4
- **Arquivos modificados:** 7 (6 hooks + 1 test novo)

## Realizações

- **6 hooks classificados** com taxonomia SEC-13-05 (A/B/C/D/E) inline — qualquer editor futuro DEVE declarar a categoria antes de mexer
- **4 hooks Cat A com fix aplicado** (workflow-guard, prompt-guard, context-monitor, post-apply-migration) — `process.stdout.write(payload, () => process.exit(0))` substitui o exit implícito que dropava saída em CI/Windows/Git Bash
- **2 hooks documentados como isentos** (statusline Cat C, check-update Cat E) — justificativa inline impede que alguém "conserte" o que não está quebrado e introduza regressão
- **Regression test 3-case** integrado ao runner padrão (`node --test test/unit/hooks-flush-race.test.js`) cobrindo:
  - Flush correto em payload pequeno (3 iterações detectam flakiness)
  - Payload >4KB (excede pipe buffer típico, prova ausência de truncamento)
  - Static check: todos os 6 hooks declaram categoria (barreira anti-regressão)
- **Suite mantém zero regressão:** 133 unit + 71 integration, todos verdes

## Categorização SEC-13-05

| Hook                       | Categoria | Justificativa                                           | Fix aplicado          |
| -------------------------- | --------- | ------------------------------------------------------- | --------------------- |
| workflow-guard.js          | A         | stdout.write JSON warning + process.exit implícito      | sim (callback form)   |
| prompt-guard.js            | A         | stdout.write JSON warning + process.exit implícito      | sim (callback form)   |
| context-monitor.js         | A         | stdout.write JSON warning + process.exit implícito      | sim (callback form)   |
| post-apply-migration.js    | A         | stderr.write resumo final + process.exit explícito      | sim (callback form)   |
| statusline.js              | C         | termina natural sem process.exit; Node flush automático | NÃO (preservar)       |
| check-update.js            | E         | parent retorna após child.unref(); child usa fs sync    | NÃO (sem race)        |
| sidecar-tool-publisher.js  | D         | TCP/HTTP — recebeu fix v1.12.1 (commit 56b327f)         | já aplicado (v1.12.1) |

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: Classificar 6 hooks com SEC-13-05** — `5c26964` (feat)
2. **Tarefa 2: Cat A fix nos 3 stdout hooks** — `c439a04` (fix)
3. **Tarefa 3: post-apply-migration Cat A + statusline Cat C + check-update Cat E** — `f2d886f` (fix)
4. **Tarefa 4: Regression test SEC-13-05** — `32fb151` (test)

## Arquivos Criados/Modificados

- `kit/hooks/workflow-guard.js` — bump 1.30.0→1.30.1; add SEC-13-05 Cat A comment; trocar `process.stdout.write(JSON.stringify(output))` por callback form
- `kit/hooks/prompt-guard.js` — idem (mesmo pattern do warning JSON)
- `kit/hooks/context-monitor.js` — idem
- `kit/hooks/post-apply-migration.js` — bump 1.4.0→1.4.1; add SEC-13-05 Cat A comment; trocar resumo final stderr.write+exit pela forma callback com early return
- `kit/hooks/statusline.js` — add SEC-13-05 Cat C comment + justificativa inline (sem mudança runtime)
- `kit/hooks/check-update.js` — add SEC-13-05 Cat E comment + justificativa inline (sem mudança runtime)
- `test/unit/hooks-flush-race.test.js` — NOVO (3 test cases, 126 linhas)

## Decisões Tomadas

1. **Taxonomia inline obrigatória.** Em vez de documentar categorias só no SUMMARY (esquecível), forçar `// SEC-13-05: flush-before-exit category = X` no top de cada hook. O regression test #3 valida que TODOS declaram. Editores futuros não conseguem adicionar um exit path silenciosamente sem categorizar.

2. **post-apply-migration: fix APENAS no resumo final.** Os writes intermediários (linhas ~71/87/93/100 — mirror/stub progress) NÃO precisam de callback porque o processo continua executando após eles. O event loop drena o buffer naturalmente antes do próximo write. Aplicar callback em todos os intermediários seria over-engineering.

3. **statusline preservada como Cat C.** Plano original previa "apenas confirmar" — confirmei e adicionei comentário explicando POR QUE não converter para callback+exit (poderia truncar quando write > pipe buffer; Node flushes naturalmente). Justificativa inline é mais valiosa que silêncio.

4. **Test deploy strategy.** Spawn direto de `kit/hooks/workflow-guard.js` falha porque kit-mcp/package.json declara `type:module` enquanto os hooks usam CJS (`require`). Em produção, hooks são deployados em `.claude/hooks/` (sem parent type:module). O test mirrora isso copiando o hook para `tmp/.claude/hooks/` antes de spawnar. Esta divergência é artefato do test environment, não do contrato runtime.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Bloqueador] Test inicial falhava por ESM/CJS mismatch**
- **Encontrado durante:** Tarefa 4 (regression test)
- **Problema:** O test escrito conforme plano spawnava `kit/hooks/workflow-guard.js` diretamente. Falhou com `ReferenceError: require is not defined in ES module scope` porque kit-mcp/package.json declara `"type":"module"` mas os hooks usam CJS (`require`).
- **Correção:** Modifiquei `tmpProject()` para também criar `.claude/hooks/` no tmp dir e copiar o hook source para lá antes de spawnar. Isso mirrora exatamente o deployment de produção (hooks vão para fora do kit-mcp via `kit sync`). Adicionei comentário explicando a estratégia para o próximo leitor.
- **Arquivos modificados:** test/unit/hooks-flush-race.test.js (apenas — função helper alterada, sinais dos tests preservados)
- **Verificação:** 3 tests passam (flush, large payload, static check). Suite mantém 133 unit + 71 integration green.
- **Comitado em:** 32fb151 (parte do commit da Tarefa 4 — fix incorporado antes do commit)

---

**Total de desvios:** 1 corrigido automaticamente (Regra 3 — bloqueador no test setup)
**Impacto no plano:** Mínimo. A correção foi local ao test (não afetou o contrato dos hooks nem o pattern de fix). O plan original assumia que `node kit/hooks/workflow-guard.js` funcionaria diretamente, mas o package.json type:module bloqueava. A solução copy-to-deployed-location é mais correta semanticamente — testa o hook NA forma que ele será executado em produção.

## Problemas Encontrados

Nenhum problema bloqueante. Os warnings `LF will be replaced by CRLF` durante git add/commit são esperados em Windows e não afetam o conteúdo (Git autocrlf config; arquivos comitados com line endings normalizados).

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **80.02 (slim cap):** independente — pode rodar em paralelo (já está, conforme contexto do executor)
- **80.03 (dedup hooks block):** independente — pode rodar em paralelo
- **80.04 (drop CHANGELOG):** independente — pode rodar em paralelo
- **Hook deploy:** as 4 mudanças runtime (workflow-guard, prompt-guard, context-monitor, post-apply-migration) bumpam hook-version, então o `check-update.js` detectará `stale_hooks` e instruirá usuários a executar `/atualizar` no próximo SessionStart após o release que incluir esta phase. Sem ação manual aqui — o pipeline já está pronto.
- **Verification de produção:** o regression test cobre o pattern em workflow-guard como representante. Os outros 3 hooks Cat A usam o mesmo pattern textualmente. Confiança na correção estende-se por similaridade estrutural.

## Self-Check: PASSED

Verificações de existência e commit:

- ✅ kit/hooks/workflow-guard.js: FOUND, modificado (commit 5c26964 + c439a04)
- ✅ kit/hooks/prompt-guard.js: FOUND, modificado (commit 5c26964 + c439a04)
- ✅ kit/hooks/context-monitor.js: FOUND, modificado (commit 5c26964 + c439a04)
- ✅ kit/hooks/post-apply-migration.js: FOUND, modificado (commit 5c26964 + f2d886f)
- ✅ kit/hooks/statusline.js: FOUND, modificado (commit 5c26964 + f2d886f)
- ✅ kit/hooks/check-update.js: FOUND, modificado (commit 5c26964 + f2d886f)
- ✅ test/unit/hooks-flush-race.test.js: FOUND, criado (commit 32fb151)
- ✅ Commit 5c26964 (Tarefa 1): FOUND
- ✅ Commit c439a04 (Tarefa 2): FOUND
- ✅ Commit f2d886f (Tarefa 3): FOUND
- ✅ Commit 32fb151 (Tarefa 4): FOUND
- ✅ Suite verde: 133 unit + 71 integration tests passing
- ✅ sidecar-tool-publisher.js NÃO modificado (preservado fix v1.12.1)
- ✅ 7 ocorrências de `^// SEC-13-05:` em kit/hooks/ (6 categorias + 1 comentário extra em check-update)
- ✅ 3 ocorrências de `process.stdout.write(JSON.stringify(output), () =>` (workflow-guard, prompt-guard, context-monitor)

---
*Fase: 80-hooks-race-pattern-token-economy-quick-wins*
*Concluída: 2026-05-09*
