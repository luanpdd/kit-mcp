---
phase: 81-drift-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CHANGELOG.md
  - .github/workflows/publish.yml
autonomous: true
requirements:
  - DRIFT-13-01

must_haves:
  truths:
    - "CHANGELOG.md tem seção `## [1.11.0]` com bullets cobrindo SRE Resilience milestone (caps 22 + 8)"
    - "CHANGELOG.md tem seção `## [1.12.0]` resumindo Legacy Code Mastery & AI-Era Refactoring (Fases 48-78)"
    - "CHANGELOG.md tem seção `## [1.12.1]` com entry curta de hotfix (race condition sidecar)"
    - "Próximo `git tag v*` push falha workflow se CHANGELOG entry correspondente estiver vazia (final tags só)"
    - "Pre-release tags (`-rcN`, `-betaN`) ainda caem em fallback de release notes graceful"
  artifacts:
    - path: "CHANGELOG.md"
      provides: "Backfill de 3 entries de release"
      contains: "## [1.11.0], ## [1.12.0], ## [1.12.1]"
    - path: ".github/workflows/publish.yml"
      provides: "Hard fail no awk-extract step para final tags"
      contains: "::error::CHANGELOG entry missing"
  key_links:
    - from: ".github/workflows/publish.yml"
      to: "CHANGELOG.md"
      via: "awk extracts entry; vazio + final tag → exit 1"
      pattern: "if \\[ ! -s \\\"\\$NOTES_FILE\\\" \\]"
---

<objective>
Backfill 3 entries ausentes em CHANGELOG.md (v1.11.0, v1.12.0, v1.12.1) e transformar o awk-extract gate de warning silencioso em hard fail para final tags. Esse plan fecha DRIFT-13-01 — a fonte primária de drift recorrente em CHANGELOG, que foi identificada quando 3 releases consecutivas caíram em fallback "Release vX.Y.Z" silencioso no GitHub release.

Purpose: Rastreabilidade de release. Quem instala via npm precisa saber o que mudou — sem CHANGELOG, GitHub releases viram strings genéricas. Esse plan tanto backfill historicamente o gap quanto previne recorrência via gate em CI.

Output: 3 entries novas em CHANGELOG.md mirror-format do entry [1.10.0] existente; publish.yml com `exit 1` quando final-tag não tem entry.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/81-drift-cleanup/81-CONTEXT.md
@CHANGELOG.md
@.planning/milestones/v1.11-ROADMAP.md
@.planning/milestones/v1.12-ROADMAP.md
@.github/workflows/publish.yml

<interfaces>
## Pattern existente do CHANGELOG.md

Estrutura canônica de entry (mirror v1.10.0 em CHANGELOG.md:9-93):

```markdown
## [X.Y.Z] - YYYY-MM-DD

[Parágrafo introdutório curto: o que é o milestone, fonte/livro/contexto, escopo amplo]

### Adicionado — [bucket descritivo]

[Bullets: artefato canônico → 1-3 linhas explicativas]

### Mudado — [se aplicável]

### Sem mudanças de API runtime

[Single-line statement preservando stable API v1.0+]

### Tests

[Contagem unit + integration ou frase curta]

### Detalhes

`.planning/milestones/vX.Y.Z/` (após `/concluir-marco`).
```

## v1.11.0 — fonte (.planning/milestones/v1.11-ROADMAP.md)

- Material-fonte: *Site Reliability Engineering* — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) caps 22 + 8
- 24 REQs em 6 fases (42-47), 3 ondas
- Onda 1: 5 skills SRE-2 + glossary patch + 3 agents + 3 commands + /sre patch
- Onda 2: 4 cross-suite patches (golden-signals/prr-conductor/supabase-edge-fn-writer/omm-auditor)
- Onda 3: 1 audit gate (release-pipeline-policy)
- Content-only milestone — zero src/core/ changes

## v1.12.0 — fonte (.planning/milestones/v1.12-ROADMAP.md)

- Material-fonte: *Working Effectively with Legacy Code* — Michael Feathers (Prentice Hall, 2004)
- 38 REQs em 31 fases (48-78), 5 ondas — entrega out-of-band consolidada
- Onda 1 (7 skills foundationais): characterization, seams, sprout-wrap, effect-analysis, monster-methods, pre-refactor-characterization
- Onda 2 (6 skills modernizações IA): extract-class, programming-by-difference, api-only-applications, shotgun-surgery, storytelling-naked-crc, ai-prompt-characterization
- Onda 3 (8 agents): 3 clássicos (legacy-characterizer, seam-finder, refactor-safety-auditor) + 5 modernizações IA/Supabase
- Onda 4 (10 commands): 5 clássicos + 5 modernizações + /legacy orchestrator
- Onda 5 (3 audit gates novos + integration patches em 4 suítes existentes)
- Princípio editorial: cada artefato marca explicitamente "Feathers original (2004)" vs "extensão IA/Supabase (2026)"

## v1.12.1 — fonte (git log v1.12.0..v1.12.1)

- Hotfix de 1 commit: 56b327f "fix(sidecar): hook race condition — process.exit before TCP flush dropped events"
- Release commit: b00738f "release: v1.12.1 — fix sidecar hook race condition (events now reach UI)"
- Mirror size de v1.5.x patches: parágrafo introdutório + ### Corrigido + ### Sem mudanças de API
- ESCOPO: apenas `kit/hooks/sidecar-tool-publisher.js` recebeu o fix; outros 6 hooks com bug latente foram endereçados em v1.13 Phase 80

## Pattern atual do publish.yml (linhas 82-99)

```yaml
- name: Extract notes from CHANGELOG for this tag
  id: notes
  run: |
    TAG_VERSION="${GITHUB_REF_NAME#v}"
    NOTES_FILE="$RUNNER_TEMP/release-notes-${TAG_VERSION}.md"
    awk -v ver="${TAG_VERSION}" '
      $0 ~ "^## [[]" ver "[]]" { found=1; next }
      found && /^## \[/ { exit }
      found { print }
    ' CHANGELOG.md > "$NOTES_FILE"
    if [ ! -s "$NOTES_FILE" ]; then
      echo "::warning::No CHANGELOG entry found for ## [$TAG_VERSION] — falling back to tag-derived notes"
      echo "Release v${TAG_VERSION}." > "$NOTES_FILE"
    fi
    echo "notes_file=$NOTES_FILE" >> "$GITHUB_OUTPUT"
```

## Final tag vs pre-release detection

Final tag: `vX.Y.Z` (3 segments numéricos). Pre-release: `vX.Y.Z-rcN`, `vX.Y.Z-betaN`, `vX.Y.Z-alphaN`. Bash regex sólido:

```bash
if [[ "$TAG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IS_FINAL=true
else
  IS_FINAL=false
fi
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Backfill 3 entries em CHANGELOG.md (v1.11.0, v1.12.0, v1.12.1)</name>
  <files>CHANGELOG.md</files>
  <action>
Editar CHANGELOG.md inserindo 3 entries NOVAS entre `## [Unreleased]` (linha 7) e `## [1.10.0] - 2026-05-07` (linha 9). Ordem cronológica decrescente: 1.12.1 primeiro, depois 1.12.0, depois 1.11.0. Cada entry segue mirror-format de [1.10.0]: H2 com versão+data, parágrafo introdutório, ### sections de buckets descritivos, ### Sem mudanças de API runtime (ou similar), ### Tests, ### Detalhes trailing.

**Entry [1.12.1] - 2026-05-08** (curta, mirror v1.5.x):

```markdown
## [1.12.1] - 2026-05-08

Hotfix patch — corrige race condition no hook `sidecar-tool-publisher.js` que dropava `tool_invocation` events antes do TCP flush completar, causando UI sidecar não receber a maioria dos eventos quando `process.exit(0)` era chamado imediatamente após `socket.write`.

### Corrigido

- **Hook `sidecar-tool-publisher.js` race condition** ([kit/hooks/sidecar-tool-publisher.js](kit/hooks/sidecar-tool-publisher.js), commit 56b327f) — antes: `socket.write(payload); process.exit(0)` causava o processo terminar antes do kernel TCP buffer flusher completar (especialmente em payloads > 1 KB ou com IDEs múltiplas competindo no mesmo socket). Resultado: eventos chegavam parcialmente ou não chegavam à UI sidecar. Fix: `await new Promise(resolve => socket.end(payload, resolve))` + `socket.on('close', () => process.exit(0))` — exit só acontece após TCP graceful close. Não afeta hot path performance — `process.exit` continua imediato em modo `--no-ui`.

### Sem mudanças de API

Patch isolado em 1 arquivo de hook. Stable API v1.0+ preservada. CLI/MCP/sync inalterados.

### Heads-up

Esse fix v1.12.1 cobre APENAS `sidecar-tool-publisher.js`. 6 outros hooks (`workflow-guard.js`, `prompt-guard.js`, `context-monitor.js`, `post-apply-migration.js`, `statusline.js`, `check-update.js`) tinham o mesmo padrão `process.exit` antes de TCP flush — endereçados separadamente na v1.13 Phase 80.
```

**Entry [1.12.0] - 2026-05-08** (resumida — 31 fases viram 5 bullets de buckets):

```markdown
## [1.12.0] - 2026-05-08

Milestone v1.12 — Suíte Legacy Code Mastery & AI-Era Refactoring: incorpora técnicas de *Working Effectively with Legacy Code* (Michael Feathers, Prentice Hall, 2004) ao kit-mcp, modernizadas para a era IA/Supabase (2026). 38 REQs em 31 fases (Phases 48-78), distribuídos em 5 ondas. Princípio editorial: cada artefato marca explicitamente "Feathers original (2004)" vs "extensão IA/Supabase (2026)" — leitor sempre distingue livro vs modernização.

### Adicionado — 13 skills foundationais + modernizações IA (Ondas 1-2, Phases 48-60)

- 7 skills clássicas Feathers: `_shared-legacy/glossary`, `legacy-characterization-tests`, `legacy-seams-and-test-harness`, `legacy-sprout-wrap-techniques`, `legacy-effect-analysis`, `legacy-monster-methods`, `pre-refactor-characterization` (auto-trigger gate skill).
- 6 skills modernizações IA/Supabase sem precedente em 2004: `legacy-extract-class`, `legacy-programming-by-difference`, `legacy-api-only-applications` (Edge Functions wrappando Stripe/OpenAI/etc como caso paradigmático), `legacy-shotgun-surgery` (detecção via embeddings), `legacy-storytelling-naked-crc` (LLM produz primeiro draft do storytelling), `ai-prompt-characterization` (prompts como código legacy testável com `temperature=0` + seed fixo).

### Adicionado — 8 agents (Onda 3, Phases 61-68)

- 3 clássicos: `legacy-characterizer` (gera characterization tests com 7 grupos canônicos), `seam-finder` (decision tree por linguagem para 24 técnicas do cap 25), `refactor-safety-auditor` (gate runtime canônico — REFACTOR-SAFETY.md).
- 5 modernizações: `payload-capture-instrumenter` (instrumenta Edge Function via `mcp__supabase__get_logs`), `storytelling-analyst` (LLM gera mental model + CRC sketch), `shotgun-surgery-detector` (detecção semântica via `text-embedding-3-small` + pgvector clustering), `ai-mutation-tester` (LLM-generated mutants comportamentais), `observability-coverage-auditor` (audita Edge Functions × 4 golden signals × SLO × characterization).

### Adicionado — 10 commands (Onda 4, Phases 69-78)

- 5 clássicos: `/caracterizar`, `/encontrar-seams`, `/auditar-refactor`, `/refactor-seguro`, `/legacy <subcomando>` (5ª suíte da família após `/supabase`, `/observabilidade`, `/sre`, `/sre-resilience`).
- 5 modernizações: `/capturar-payloads`, `/caracterizar-prompt`, `/storytelling`, `/detectar-duplicacao`, `/auditar-observabilidade-cobertura` (entrega explícita do user request `/observability-audit` mencionado).

### Adicionado — 3 audit gates + 7 cross-suite integration patches (Onda 5, Phases 79-87)

- Gates: `legacy-refactor-safety` (auto-trigger pré-refactor de arquivo > 500 linhas OR contrato externo), `ai-prompt-stability` (consultive — prompts em produção têm characterization linkados), `observability-coverage` (opt-in threshold ≥ X% Edge Functions com golden signals + SLO + burn alert).
- Integration patches em 4 suítes: Observabilidade (omm-auditor Cap 1 consume legacy coverage), Supabase (supabase-edge-fn-writer ganha API-only adapter pattern), SRE (prr-conductor Axe 5 consome REFACTOR-SAFETY.md), e patches em planner/executor/verifier/forense para awareness de legacy.
- Skill nova `llm-as-dependency` cobrindo fakear OpenAI/Anthropic clients + deterministic test mode + modo offline em CI.

### Sem mudanças de API runtime

v1.12 é **content-only por design** — zero alterações em `src/core/`, `registry.js`, `sync.js`. Stable API v1.0+ preservada. Deps budget 6/6 mantido. Conteúdo PT-BR alinhado com v1.8/v1.9/v1.10/v1.11.

### Tests

Tests existentes (133 unit + 71 integration acumulados de v1.10) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`).

### Detalhes

`.planning/milestones/v1.12-ROADMAP.md`. Modernizações canônicas sem precedente em 2004 documentadas: LLMs como dependência testável, embeddings para semantic duplicate detection, IA como ferramenta de comprehension, Supabase Edge Functions como API-only application paradigmático, mutation testing com LLM-generated mutants comportamentais.
```

**Entry [1.11.0] - 2026-05-08** (mirror-size v1.10.0):

```markdown
## [1.11.0] - 2026-05-08

Milestone v1.11 — Suíte SRE Resilience & Release Engineering: 2ª camada SRE derivada do livro Google SRE — caps **22 (Addressing Cascading Failures)** + **8 (Release Engineering)** — completando a Suíte SRE iniciada na v1.10. 24 REQs em 6 fases (Phases 42-47), distribuídos em 3 ondas: Núcleo SRE-2 (Phases 42-44), Integração com suítes existentes (Phases 45-46), Gates QA + docs (Phase 47). v1.11 é content-only por design — zero alterações em `src/core/`. Stable API v1.0+ preservada.

### Adicionado — 5 skills SRE-2 foundationais + glossary patch (Phase 42)

- Patch em `_shared-sre/glossary.md` — 3 blocos novos (vocabulário cap 22, vocabulário cap 8, anti-patterns explícitos sobre cascading e release).
- `cascading-failures` — cap 22 main: 7 triggers canônicos (server overload, resource exhaustion, service unavailability, etc.), positive feedback loops, prevent vs detect vs treat, server slow start, prevention via load shedding.
- `load-shedding-graceful-degradation` — cap 22 sub: concurrency limits, queue bounds, deadline-aware processing, rate limit por client, slow start.
- `retry-strategies` — cap 22 sub: exponential backoff + jitter, retry budget, deadline propagation (não retry quando deadline excedido), idempotency keys.
- `hermetic-builds` — cap 8 sub: build reproducibility via lockfiles + pinned base images, no-cache para release builds, attestations (SLSA framework).
- `release-engineering` — cap 8 main: release pipeline policy (4 stages — build, test, canary, rollout), feature flags como controle ortogonal a release, semver discipline, release tag como contract.

### Adicionado — 3 agents core SRE-2 (Phase 43)

- `cascading-failures-auditor` — analisa código para 7 triggers; gera `CASCADING-AUDIT.md` priorizado P0/P1/P2 com remediation por trigger.
- `load-shedding-instrumenter` — aplica patches de load shedding (concurrency limit, queue bound, deadline-aware processing, rate limit, slow start) em código de Edge Function ou serviço.
- `release-pipeline-auditor` — audita CI/CD em 3 dimensões (hermeticidade, reprodutibilidade, policy enforcement); scored 30 pts; gera `RELEASE-AUDIT.md`.

### Adicionado — 3 commands SRE-2 + extensão do `/sre` orchestrator (Phase 44)

- `/auditar-cascading`, `/load-shedding`, `/auditar-release` — invocam respectivos agents.
- Patch em `kit/commands/sre.md` — 3 subcomandos novos (`cascading`, `load-shedding`, `release`); 8 subcomandos totais (5 v1.10 + 3 v1.11).

### Adicionado — 4 cross-suite patches (Phase 45)

- `four-golden-signals/SKILL.md` ganha seção "Saturation as cascading failure trigger" com tabela threshold canônica (Saturation > 80% sustained → trigger #4 do cap 22).
- `prr-conductor.md` — Axe 4 (Capacity Planning) ganha 3 itens (cascading prevention, load shedding, game day); Axe 5 (Change Management) ganha 3 itens (hermetic build, release pipeline policy, release via tag).
- `supabase-edge-fn-writer.md` — bloco "v1.11 Adicional SRE Resilience" com 5 patterns built-in (timeout, retry+jitter, deadline propagation, load shedding, idempotency key) — Edge Function template ganha cascading-prevention by default.
- `omm-auditor.md` — Capacidade 1 (Resilience) consulta `CASCADING-AUDIT.md`; mapping P0/P1 count → score; regra absoluta "score Cap 1 > 3 exige CASCADING-AUDIT.md fresco ≤ 30d".

### Adicionado — patch em `/concluir-marco` (Phase 46)

- Bloco `<sre_resilience_integration>` com gate `release-pipeline-policy` opt-in (paralelo ao PRR gate v1.10); thresholds ROBUST/ADEQUATE/FRAGILE/BROKEN; toggle via flag `workflow.complete_milestone_release_pipeline_gate`.

### Adicionado — 1 audit gate (Phase 47)

- `gates/release-pipeline-policy.md` — audit gate parsing `RELEASE-AUDIT.md` score; default opt-in; threshold configurável via `workflow.release_pipeline_policy_threshold` (default ADEQUATE).

### Sem mudanças de API runtime

v1.11 é content-only por design — zero alterações em `src/core/`, `registry.js`, `sync.js`, ou no MCP server. Stable API v1.0+ totalmente preservada. CI passa sem mudança em `.github/workflows/`. Deps budget mantido em 6/6 (zero deps novas — todo o conteúdo é Markdown).

### Tests

Tests existentes (115 unit + 67 integration acumulados de v1.7) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`).

### Detalhes

`.planning/milestones/v1.11-ROADMAP.md`. Material-fonte: *Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016). ISBN 978-1-491-92912-4. Caps 22 + 8. Plus: SLSA framework, 12-factor app, DORA metrics.
```

**Notas operacionais:**
- USE a ferramenta Edit (não Write) para inserir as 3 entries — preserva o resto do CHANGELOG byte-a-byte.
- A inserção é entre linha 7 (`## [Unreleased]` + linha em branco linha 8) e linha 9 (`## [1.10.0]`). Insira EXATAMENTE: linha em branco → entry 1.12.1 → linha em branco → entry 1.12.0 → linha em branco → entry 1.11.0 → linha em branco. Final result: 1.12.1 antes 1.12.0 antes 1.11.0 antes 1.10.0 (ordem cronológica decrescente).
- POR QUÊ não auto-gen via script: CONTEXT.md decisão explícita "abordagem 1 (substituição estática)". Auto-gen adiada para v1.14.
  </action>
  <verify>
    <automated>node -e "const md = require('node:fs').readFileSync('CHANGELOG.md','utf8'); const v = ['## [1.11.0]','## [1.12.0]','## [1.12.1]']; const missing = v.filter(s => !md.includes(s)); if (missing.length) { console.error('MISSING:', missing); process.exit(1); } console.log('OK: 3 entries present');"</automated>
  </verify>
  <done>
- CHANGELOG.md tem `## [1.11.0] - 2026-05-08` com ≥ 6 ### sections
- CHANGELOG.md tem `## [1.12.0] - 2026-05-08` com ≥ 5 ### sections
- CHANGELOG.md tem `## [1.12.1] - 2026-05-08` com ≥ 2 ### sections
- Ordem cronológica decrescente preservada (1.12.1 ANTES de 1.12.0 ANTES de 1.11.0 ANTES de 1.10.0)
- Mirror format do entry [1.10.0] respeitado em cada (parágrafo intro, ### Adicionado/Mudado, ### Sem mudanças de API, ### Tests, ### Detalhes)
- Bullets cobrem milestones reais: v1.11 caps 22+8 do livro Google SRE; v1.12 Feathers 2004 + modernizações IA/2026; v1.12.1 hotfix sidecar
- Comando do automated verify retorna `OK: 3 entries present` exit 0
  </done>
</task>

<task type="auto">
  <name>Tarefa 2: Hard fail no awk-extract para final tags + criar regression test</name>
  <files>.github/workflows/publish.yml, test/unit/publish-changelog-gate.test.js</files>
  <action>
**Parte A — Editar `.github/workflows/publish.yml` (linhas 82-99):**

Substituir o bloco da step "Extract notes from CHANGELOG for this tag" para:
1. Detectar se a tag é final (regex `^[0-9]+\.[0-9]+\.[0-9]+$`) ou pre-release (`-rcN`/`-betaN`/`-alphaN`).
2. Se final + arquivo notes vazio → `echo "::error::CHANGELOG entry missing for ## [$TAG_VERSION]. Add entry to CHANGELOG.md before tagging final release."; exit 1`.
3. Se pre-release + arquivo notes vazio → manter warning + fallback "Release v${TAG_VERSION}." (comportamento atual preservado para RC/beta).

Conteúdo final esperado para a step (substituir linhas 82-103 do publish.yml por):

```yaml
      - name: Extract notes from CHANGELOG for this tag
        id: notes
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          NOTES_FILE="$RUNNER_TEMP/release-notes-${TAG_VERSION}.md"
          # Awk extracts the body between this version's heading and the next ## [ heading.
          # Note: ver passes only the version string; we wrap with [[] and []] (bracket
          # classes that match a literal `[` and `]`) so the heading regex doesn't
          # collapse `[1.5.2]` into a char-class of digits-and-dots (the v1.5.2-and-prior bug).
          awk -v ver="${TAG_VERSION}" '
            $0 ~ "^## [[]" ver "[]]" { found=1; next }
            found && /^## \[/ { exit }
            found { print }
          ' CHANGELOG.md > "$NOTES_FILE"
          if [ ! -s "$NOTES_FILE" ]; then
            # DRIFT-13-01: hard fail for final tags (vX.Y.Z) — silent fallback caused 3
            # consecutive releases (v1.11.0/v1.12.0/v1.12.1) to ship with placeholder notes.
            # Pre-release tags (-rcN/-betaN/-alphaN) keep the graceful fallback since
            # those are by definition transient and may not warrant a CHANGELOG entry.
            if [[ "$TAG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              echo "::error::CHANGELOG entry missing for ## [$TAG_VERSION]. Add entry to CHANGELOG.md before tagging final release. Pre-release tags (vX.Y.Z-rcN) bypass this check."
              exit 1
            fi
            echo "::warning::No CHANGELOG entry found for ## [$TAG_VERSION] (pre-release) — falling back to tag-derived notes"
            echo "Release v${TAG_VERSION}." > "$NOTES_FILE"
          fi
          echo "notes_file=$NOTES_FILE" >> "$GITHUB_OUTPUT"
          echo "--- notes preview ---"
          head -30 "$NOTES_FILE"
```

Importante: **manter exatamente** a indentação YAML (6 spaces para `- name:`, 8 spaces para `id:`/`run:`, etc.) e o `head -30 "$NOTES_FILE"` ao final (comportamento de log atual preservado).

**Parte B — Criar `test/unit/publish-changelog-gate.test.js`:**

Test que valida o regex de detecção final-vs-prerelease + simula awk extraction sobre fixture pequeno de CHANGELOG.md. Mirror pattern de `test/unit/mcp-gates-guard.test.js` mas em escopo unit (sem spawn). Usa fs.readFile em fixture inline + bash `awk` shell-out via `child_process.execSync`.

```javascript
// DRIFT-13-01: regression test for the awk-extract gate in publish.yml.
//
// The publish workflow must hard-fail when a final tag (vX.Y.Z) lacks a
// matching CHANGELOG entry. Pre-release tags (vX.Y.Z-rcN/-betaN/-alphaN)
// must still fall back gracefully. Tests both branches against a synthetic
// CHANGELOG fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// On Windows runners, awk may not exist. Skip gracefully — the production
// awk runs on ubuntu-latest in CI, which always has it.
function hasAwk() {
  try { execSync('awk --version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const FIXTURE_CHANGELOG = `# Changelog

## [Unreleased]

## [1.13.0] - 2026-06-01

Test entry for 1.13.

### Adicionado
- Item A

## [1.12.1] - 2026-05-08

Hotfix.

### Corrigido
- Bug fix
`;

function runAwkExtract(version, changelogContent) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-changelog-'));
  const cl = path.join(tmp, 'CHANGELOG.md');
  fs.writeFileSync(cl, changelogContent);
  try {
    const cmd = `awk -v ver="${version}" '$0 ~ "^## [[]" ver "[]]" { found=1; next } found && /^## \\[/ { exit } found { print }' "${cl}"`;
    const out = execSync(cmd, { encoding: 'utf8' });
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('DRIFT-13-01: awk extracts present version body', { skip: !hasAwk() }, () => {
  const out = runAwkExtract('1.13.0', FIXTURE_CHANGELOG);
  assert.match(out, /Test entry for 1.13/);
  assert.match(out, /Item A/);
  assert.doesNotMatch(out, /Bug fix/, 'must stop at next ## [');
});

test('DRIFT-13-01: awk returns empty for missing version', { skip: !hasAwk() }, () => {
  const out = runAwkExtract('99.99.99', FIXTURE_CHANGELOG);
  assert.equal(out.trim(), '', 'empty output triggers gate fallback in workflow');
});

test('DRIFT-13-01: final-tag regex matches semver vX.Y.Z', () => {
  const finalRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  assert.ok(finalRegex.test('1.12.1'));
  assert.ok(finalRegex.test('2.0.0'));
  assert.ok(finalRegex.test('0.1.0'));
});

test('DRIFT-13-01: final-tag regex rejects pre-release tags', () => {
  const finalRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  assert.ok(!finalRegex.test('1.12.1-rc1'), 'rc must not match final');
  assert.ok(!finalRegex.test('1.12.1-beta2'));
  assert.ok(!finalRegex.test('1.12.1-alpha'));
  assert.ok(!finalRegex.test('1.12.1+build.1'));
});
```

**Notas operacionais:**
- USE Edit no publish.yml (preserva header + outras steps byte-a-byte).
- USE Write no novo arquivo de test.
- POR QUÊ shell-out vs reimplementar awk em JS: o objetivo do test é validar que o awk REAL produz o output esperado (mesmo binário que CI usa). Reimplementar em JS daria false-pass se a regex bash fosse alterada incorretamente.
- POR QUÊ `{ skip: !hasAwk() }`: dev local Windows sem WSL não tem awk; test passa cleanly mas CI ubuntu-latest sempre tem. CI publish runner: ubuntu-latest (linha 22 do publish.yml).
  </action>
  <verify>
    <automated>node test/run.mjs test/unit/publish-changelog-gate.test.js</automated>
  </verify>
  <done>
- `.github/workflows/publish.yml` step "Extract notes from CHANGELOG" tem branch hard-fail para final tags
- Regex `^[0-9]+\.[0-9]+\.[0-9]+$` detecta final tags corretamente (vX.Y.Z) e rejeita pre-release (vX.Y.Z-rcN, -betaN, -alphaN, +build)
- Pre-release tags ainda caem em fallback graceful "Release v${TAG_VERSION}." (comportamento preservado para RC/beta)
- Mensagem de erro inclui "CHANGELOG entry missing for ## [$TAG_VERSION]" + "Add entry to CHANGELOG.md before tagging final release"
- Indentação YAML preservada (6/8 spaces); `head -30` no final preservado
- Novo test file `test/unit/publish-changelog-gate.test.js` criado com 4 tests cobrindo: present version extract, missing version empty, final-tag regex match, pre-release regex reject
- `node test/run.mjs test/unit/publish-changelog-gate.test.js` retorna exit 0 com 4 tests pass (ou 2 pass + 2 skip em Windows sem awk)
  </done>
</task>

</tasks>

<verification>
- CHANGELOG.md `grep -E "^## \[1\.(11|12|12\.1)\]"` retorna 3 matches
- `.github/workflows/publish.yml` `grep "::error::CHANGELOG entry missing"` retorna 1 match
- `npm test` continua exit 0 (test/unit baseline 133 + 4 new tests = 137)
- Visualmente: nenhum byte modificado em entries existentes [1.10.0] e anteriores
</verification>

<success_criteria>
- 3 entries faltantes adicionadas a CHANGELOG.md em ordem cronológica decrescente, com bullets coerentes derivados de v1.11-ROADMAP.md / v1.12-ROADMAP.md / git log
- Próxima `git push --follow-tags` em final tag SEM CHANGELOG entry causa workflow falhar com erro claro (testado localmente via fixture, validado em CI no próximo release real)
- Pre-release tags (vX.Y.Z-rcN) preservam fallback graceful — flexibilidade para RC/beta builds
- Suite de testes baseline + 4 novos tests verde (137 unit total)
- Zero regression em CHANGELOG existente (entries anteriores byte-idênticas)
</success_criteria>

<output>
After completion, create `.planning/phases/81-drift-cleanup/81-01-changelog-backfill-SUMMARY.md`
</output>
