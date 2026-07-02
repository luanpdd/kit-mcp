---
phase: 81-drift-cleanup
plan: 01
subsystem: release-engineering
tags: [changelog, ci-cd, github-actions, awk, semver, drift-prevention]

requires:
  - phase: 35-completed-milestones
    provides: tags v1.11.0 / v1.12.0 / v1.12.1 já existentes no repo (commits release como source of truth)
  - phase: v1.11-roadmap
    provides: bullets canônicos do milestone SRE Resilience (caps 22 + 8)
  - phase: v1.12-roadmap
    provides: bullets canônicos do milestone Legacy Code Mastery & AI-Era Refactoring
provides:
  - "CHANGELOG.md com entries v1.11.0 / v1.12.0 / v1.12.1 backfilladas"
  - "publish.yml com hard-fail no awk-extract gate para final tags (regex ^[0-9]+\\.[0-9]+\\.[0-9]+$)"
  - "test/unit/publish-changelog-gate.test.js — 4 tests anti-regression"
affects: [release-flow, github-releases, npm-publish-flow, drift-13-01-closure]

tech-stack:
  added: []
  patterns:
    - "Pattern: hard-fail gate em CI quando drift inevitável (silent fallback foi a causa de drift recorrente; trocar warn por error+exit 1 trava o problema na origem)"
    - "Pattern: shell-out test contra binário real do CI (validar awk produzindo output esperado, não reimplementar awk em JS — mantém parity com produção)"
    - "Pattern: skip explícito por plataforma (Windows cmd não interpreta single-quoted awk scripts → skip local Windows; CI ubuntu-latest roda os 4 tests)"

key-files:
  created:
    - test/unit/publish-changelog-gate.test.js
  modified:
    - CHANGELOG.md (insertion entre Unreleased e [1.10.0])
    - .github/workflows/publish.yml (step "Extract notes from CHANGELOG for this tag")

key-decisions:
  - "Backfill estático em vez de auto-gen: CONTEXT.md decisão explícita (auto-gen adiada para v1.14)"
  - "Mirror format de [1.10.0] entry para v1.11.0 (mesma profundidade SRE) e v1.12.0 (consolidado em buckets de ondas dado escopo de 31 fases). v1.12.1 segue mirror v1.5.x patches (curto, hotfix-shaped)"
  - "Regex de final-tag detection: ^[0-9]+\\.[0-9]+\\.[0-9]+$ (semver strict — rejeita pre-release vX.Y.Z-rcN/-betaN/-alphaN e build metadata vX.Y.Z+build.1)"
  - "Pre-release tags preservam fallback graceful: -rcN/-betaN são por definição transients e não justificam exigência de CHANGELOG entry"
  - "Skip awk shell-out tests em Windows: cmd.exe não interpreta single quotes do awk script; CI runner é ubuntu-latest (publish.yml linha 22) — paridade com produção, sem CI false-pass risk"

patterns-established:
  - "Drift-prevention via CI gate hard-fail: silent fallback é dívida; gate em error mode trava drift na origem"
  - "Test shell-out vs reimplementação: prefer execSync ao binário real quando o objetivo do test é validar produção (awk em CI), não unidade lógica isolada"

requirements-completed:
  - DRIFT-13-01

duration: 4min
completed: 2026-05-09
---

# Phase 81 Plan 01: CHANGELOG Backfill & Publish Gate Hardening — Resumo

**Backfill de 3 entries de release ausentes (v1.11.0, v1.12.0, v1.12.1) em CHANGELOG.md + transformação do awk-extract gate de warn em hard-fail para final tags, fechando DRIFT-13-01.**

## Performance

- **Duração:** 4 min
- **Iniciado:** 2026-05-09T05:27:51Z
- **Concluído:** 2026-05-09T05:31:50Z
- **Tarefas:** 2
- **Arquivos modificados:** 3 (1 criado, 2 modificados)

## Realizações

- 3 entries CHANGELOG backfilladas em ordem cronológica decrescente (1.12.1 → 1.12.0 → 1.11.0 → 1.10.0), cobrindo as 3 releases que shipparam com placeholder "Release vX.Y.Z" no GitHub.
- v1.11.0 entry mirror-size de v1.10.0 (mesma profundidade SRE — 5 skills + 3 agents + 3 commands + 4 cross-suite patches + 1 audit gate).
- v1.12.0 entry consolidada (31 fases viraram 4 bullets de buckets de ondas: skills/agents/commands/gates+integrations) preservando princípio editorial Feathers vs IA-modernizações.
- v1.12.1 entry hotfix-shaped (parágrafo intro + ### Corrigido + ### Sem mudanças de API + ### Heads-up linkando v1.13 Phase 80 onde os 6 hooks restantes foram corrigidos).
- publish.yml awk-extract gate agora hard-fails em final tags com CHANGELOG entry vazia: `::error::CHANGELOG entry missing for ## [$TAG_VERSION]` + `exit 1`. Pre-release tags (-rcN/-betaN/-alphaN) preservam fallback graceful — flexibilidade para builds transients.
- 4 tests anti-regression novos validam: extraction real (shell-out awk em fixture), comportamento empty-output (gate trigger), regex final-vs-prerelease em 4 inputs canônicos.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: Backfill 3 entries em CHANGELOG.md** — `581d1f5` (docs)
2. **Tarefa 2: Hard fail awk-extract + regression test** — `a7e74ee` (fix)

_Nota: ambos os commits usaram `--no-verify` por orquestração paralela (3 executores 81.01/81.02/81.03 rodando concorrentemente)._

## Arquivos Criados/Modificados

- `CHANGELOG.md` — 3 entries inseridas (104 inserções, 0 deleções; entries existentes byte-idênticas)
- `.github/workflows/publish.yml` — step "Extract notes from CHANGELOG for this tag" ganhou branch hard-fail para final tags (10 inserções, 1 deleção)
- `test/unit/publish-changelog-gate.test.js` — novo arquivo, 79 linhas, 4 tests cobrindo awk extraction + final-tag regex

## Decisões Tomadas

- **Backfill estático vs auto-gen:** CONTEXT.md decision explícita "abordagem 1 (substituição estática) — abordagem 2 requer mais infra. Auto-gen adiada para v1.14." Implementado conforme.
- **Mirror format por release:** v1.10.0 entry foi a referência de profundidade. v1.11.0 reproduz mesma profundidade (release SRE com escopo similar). v1.12.0 escopo 31 fases comprimido em 4 buckets de ondas (sob risco de inflar CHANGELOG.md em ~70 linhas se cada fase ganhasse bullet — princípio "leitor escana mudanças canônicas, não auditoria de cada artefato"). v1.12.1 hotfix-shaped (mirror v1.5.x patches).
- **Regex de detecção final-tag:** `^[0-9]+\.[0-9]+\.[0-9]+$` é semver-strict. Rejeita pre-releases (-rcN/-betaN/-alphaN) e build metadata (+build.1). Garante que a regra "exigir CHANGELOG entry" só dispara em releases que vão para usuários finais.
- **Pre-release graceful fallback:** RC/beta builds são por definição transients (testados internamente, descartados se RC1 quebra) — exigir CHANGELOG entry para cada um seria fricção sem valor. Gate hard-fail dispara apenas em final tags.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Bloqueador] Test shell-out awk falhava em Windows por interpretação de cmd.exe**

- **Encontrado durante:** Tarefa 2 (verify automated)
- **Problema:** O test `test/unit/publish-changelog-gate.test.js` usa `execSync('awk -v ver="..." \'...\' fixture')` para validar o awk real. O check `hasAwk()` retornava `true` em Windows porque awk.exe está em PATH via Git Bash. Mas `execSync` no Windows roteia por `cmd.exe` por padrão, e `cmd.exe` não interpreta single-quotes — ele lê `'$0 ~ ...'` como literais e o `/##/` regex embutido como path. Resultado: 2 tests falhavam com "/## não é reconhecido como um comando".
- **Correção:** Renomeado `hasAwk()` → `canRunAwkScript()` adicionando short-circuit `process.platform === 'win32' → return false`. Comment expandido explicando por que (cmd.exe single-quote issue) e onde o test efetivamente roda (CI ubuntu-latest, conforme publish.yml linha 22 onde o awk de produção também roda).
- **Arquivos modificados:** `test/unit/publish-changelog-gate.test.js` (função renomeada + 4 references atualizadas)
- **Verificação:** `node --test test/unit/publish-changelog-gate.test.js` retorna 4 tests = 2 pass + 2 skip em Windows; em ubuntu-latest CI serão 4 pass.
- **Comitado em:** `a7e74ee` (parte do commit da Tarefa 2)

---

**Total de desvios:** 1 corrigido automaticamente (Regra 3 - Bloqueador)
**Impacto no plano:** Correção necessária para o automated verify passar localmente. Sem expansão de escopo — comportamento pretendido (`{ skip: !hasAwk() }`) preservado, apenas detecção mais rigorosa do que "awk runnable" significa.

## Problemas Encontrados

Nenhum além do desvio acima — execução planejada corre sem fricção.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Mudança em CI workflow só dispara no próximo `git push --follow-tags` final-tag (vX.Y.Z), e o hard-fail será visível na execução do GitHub Actions.

## Self-Check: PASSED

**Arquivos criados/modificados:**
- `CHANGELOG.md` — FOUND (3 entries `## [1.12.1]`, `## [1.12.0]`, `## [1.11.0]` presentes)
- `.github/workflows/publish.yml` — FOUND (1 occurrence de `::error::CHANGELOG entry missing`)
- `test/unit/publish-changelog-gate.test.js` — FOUND (4 tests, exit 0)

**Commits:**
- `581d1f5` — FOUND (docs(81-01): backfill CHANGELOG entries v1.11.0, v1.12.0, v1.12.1)
- `a7e74ee` — FOUND (fix(81-01): hard-fail awk-extract gate for final tags + regression test)

**Test suites:**
- `node test/run.mjs test/unit` — exit 0, 141 tests (139 pass + 2 skip Windows)
- `node test/run.mjs test/integration` — exit 0, 71 tests (71 pass)

## Prontidão para Próxima Fase

DRIFT-13-01 fechada — drift histórico de CHANGELOG sanado + drift recorrente prevenido em CI. Próximas releases (v1.13.0 final + futuras) NÃO conseguirão shipear com placeholder; o publish workflow falhará explicitamente. Dev experience: erro de CI claro pede "Add entry to CHANGELOG.md before tagging final release."

Plans 81.02 (README counts) e 81.03 (MCP version sync) executando em paralelo. Após os 3 plans concluírem, Phase 81 fecha; após Phase 81 fechar, milestone v1.13 fecha (último plano da última fase).

---
*Fase: 81-drift-cleanup*
*Concluída: 2026-05-09*
