# TOIL-AUDIT — kit-mcp — 2026-05-09

**Janela analisada:** últimos 3 meses (275 commits) · **team_size:** 1 mantenedor (luanpdd / `Luan Oliveira dos Santos`) · **Versão atual:** v1.12.1

---

## Métrica agregada

- **Toil estimado:** 6.5 horas-pessoa/semana (~16% do tempo do mantenedor full-time, ~33% se part-time 20h)
- **Status vs ≤ 50% rule:** **YELLOW** (assumindo work part-time 20h/sem) ou **GREEN** (full-time 40h/sem)
- **Top 3 áreas:**
  1. **Doc maintenance drift** (CHANGELOG/README/file-manifest desincronizados com kit/) — risco de confiança publicada
  2. **Manual smoketest em 8 IDEs** — CI testa só `claude-code`; outros 7 IDEs validados a olho
  3. **Triage de bug reports** sem template + sem CONTRIBUTING.md — toda issue cai no inbox como wildcard
- **Estágio médio de automação atual:** **L1.5** (release pipeline já está em L4 / sync já está em L3 / mas docs e manifests estão em L0)

### Sinal canônico de toil drift no projeto

- `kit/file-manifest.json` lista **20 agents** mas filesystem tem **47** (27 missing, +135%)
- Listagem **62 commands** vs **87** reais (25 missing, +40%)
- Listagem **1 skill** vs **49** reais (48 missing, +4800%)
- `README.md` repete "19 agents / 60 commands" em **5 lugares diferentes** (linhas 31, 33, 178, 179, 242, 243, 630)
- `CHANGELOG.md` última entry é `[1.10.0]` (2026-05-07) — **v1.11.0 e v1.12.0 e v1.12.1 não têm entry**
- `src/mcp-server/index.js:265` tem hardcoded `version: '0.1.0'` enquanto `package.json` aponta `1.12.1`

Esses são sintomas clássicos de "manual update múltiplo" não centralizado.

---

## Itens identificados (resumo)

| # | Item | Frequência | Hours/week | Pain (1-5) | Effort | Score | Priority | Stage atual → alvo |
|---|------|------------|------------|------------|--------|-------|----------|---------------------|
| 1 | Atualizar CHANGELOG manualmente a cada release | 0.7×/sem (3 releases/mês) | 0.4 h | 4 | S (1d) | 2.8 | **P0** | L0 → L3 |
| 2 | Atualizar contagens hardcoded em README ("19 agents", etc) | 0.7×/sem (cada release com novo agent) | 0.3 h | 5 | S (0.5d) | 7.0 | **P0** | L0 → L4 |
| 3 | Manter `kit/file-manifest.json` sincronizado | 1×/sem (novos agents/commands) | 0.5 h | 4 | S (0.5d) | 8.0 | **P0** | L0 → L4 (ou DELETE se morto) |
| 4 | Smoketest manual de sync nos 8 IDEs após release | 0.7×/sem (cada release) | 1.5 h | 4 | M (3d) | 1.4 | **P0** | L0 → L3 |
| 5 | Triage manual de issues GitHub (sem template) | 0.5×/sem | 0.7 h | 3 | S (1d) | 1.0 | **P0** | L0 → L2 |
| 6 | Bump `version` hardcoded em `src/mcp-server/index.js:265` | 0.7×/sem (cada release) | 0.05 h | 1 | S (0.5h) | 1.4 | **P1** | L0 → L4 |
| 7 | Manter `agent-list` em `CLAUDE.md` (auto-gen "edit `kit/`; rerun `kit sync <target>`" — verificar se realmente roda) | 1×/sem | 0.3 h | 2 | S (1d) | 0.6 | **P1** | L1 (parcial) → L4 |
| 8 | Reproduzir hook race condition bugs sem teste automatizado | 0.1×/sem (raro mas alto impacto — v1.12.1 foi assim) | 1.5 h | 5 | M (4d) | 0.19 | **P1** | L0 → L2 |
| 9 | Criar git tag + push após `npm version` | 0.7×/sem | 0.05 h | 1 | S (0.5h, já é L4) | 0.7 | linha de base | L4 (já automatizado) |
| 10 | Cross-link entre `Suíte Supabase v1.8` / `Observabilidade v1.9` / `SRE v1.10` / `Legacy v1.12` em README | 0.25×/sem (quando milestone fecha) | 0.5 h | 3 | M (2d) | 0.19 | **P1** | L0 → L3 |
| 11 | Validar prepublishOnly antes de tag (esquecer = npm reject) | 0.7×/sem | 0.1 h | 2 | S (já é L3) | linha de base | linha de base | L3 (já automatizado em `prepublishOnly`) |
| 12 | Verificar coerência entre número de agents/commands documentados em diferentes seções do README | 0.25×/sem | 0.5 h | 2 | S (subset de #2) | (cobre por #2) | duplicado | — |
| 13 | Documentar mudanças aditivas a `Compatibility table` por agent (8 IDEs × N agents) | 0.5×/sem (novos agents) | 0.3 h | 2 | M (3d) | 0.33 | **P2** | L0 → L2 |

**Total bruto:** ~6.5 h/sem (sem contar overhead/grungy). Com automation P0 + P1 → estimado redução para **~1.0 h/sem** (84% redução).

---

## P0 — automatizar agora

### Item 1: Atualizar CHANGELOG manualmente a cada release

**Por que é toil:**
- ✅ Manual (escrita prosa em PT-BR a cada release)
- ✅ Repetitiva (já feito 3× só nos últimos 3 meses; 22 entries históricas)
- ✅ Automatizável (commits seguem convencional commit; conventional-changelog ou git-cliff geram entry)
- ✅ Tática (reativa ao tag push)
- ✅ Sem valor durável (cada entry só serve para o release específico)
- ✅ Escala linear (mais features → mais entries → mais tempo)

**Evidence:**
- 22 commits matching `^(release|chore.*bump|docs.*CHANGELOG)` em 3 meses
- `CHANGELOG.md` última entry [1.10.0] (2026-05-07) — **v1.11 e v1.12 não foram adicionadas** = literalmente quebrou neste momento
- `git log --pretty=format:"%H" -- CHANGELOG.md` mostra 22 updates (cada release exige edit)
- `.github/workflows/publish.yml` linha 60-79 já lê CHANGELOG via `awk` para criar GitHub Release; **se entry está vazio, release sai com "Release v1.12.1." genérico** (degradação silenciosa)

**Automação proposta:**
1. Adicionar `git-cliff` (ou conventional-changelog-cli) como devDependency
2. Comando `npm run changelog` que gera nova entry [Unreleased] → [vX.Y.Z] a partir dos commits desde a última tag
3. Adicionar step em `publish.yml` que valida que `## [{tag_version}]` existe no CHANGELOG **antes** de publicar (extender o sanity check da linha 38-46)
4. Adicionar pre-commit hook `npm run changelog --check` que roda antes do `npm version`

**Esforço:** 1 dia (S). git-cliff requer config TOML + ajuste de mapeamento commit type → seção; conventional-changelog é mais turn-key mas menos custom.

**Owner:** @luanpdd

**Stage:** L0 (totalmente manual) → L3 (gera draft + humano revisa antes de tag)

---

### Item 2: Atualizar contagens hardcoded em README

**Por que é toil:**
- ✅ Manual (várias linhas espalhadas pelo README)
- ✅ Repetitiva (toda vez que adiciona agent/command/skill)
- ✅ Automatizável (`ls kit/agents | wc -l` substitui placeholder)
- ✅ Tática (reativa)
- ✅ Sem valor durável (a contagem certa é sempre `find . | wc`)
- ✅ Escala linear (ASCII tree em README com 19 agents listed → reescrever tudo a cada novo)

**Evidence:**
- Líneas no README com counts desatualizados: **31, 33, 178, 179, 242, 243, 630** (7 lugares em 1 arquivo)
- Counts atuais hardcoded "19 agents / 60 commands / 1 skill" vs reality "47 agents / 87 commands / 49 skills" (drift de 147% em agents, 45% em commands, 4800% em skills)
- README claim "single example skill (replace with your own)" linha 37 é **factualmente falso** desde v1.8.0 (Suíte Supabase trouxe 11 skills) — drift acumulado por 4 milestones

**Automação proposta:**
1. Criar `bin/cli.js stats` que imprime JSON `{agents: 47, commands: 87, skills: 49, gates: 20, ides: 8}`
2. Substituir hardcoded counts em README por placeholders `<!-- KIT_AGENTS_COUNT -->47<!-- /KIT_AGENTS_COUNT -->`
3. Script `npm run docs:sync` que faz `sed` nesses placeholders a partir do output `kit stats --json`
4. Adicionar gate `gates/readme-counts-fresh.md` (similar ao `budget-description.md`) — bloca PR se README count divergente do filesystem
5. Tornar essa step de sync parte de pre-commit + CI

**Esforço:** 0.5 dia (S). É um sed wrapper.

**Owner:** @luanpdd

**Stage:** L0 → L4 (totalmente automatizado, gate bloqueia drift)

---

### Item 3: Manter `kit/file-manifest.json` sincronizado

**Por que é toil:**
- ✅ Manual (atualmente NÃO é mantido; está stale)
- ✅ Repetitiva (sempre que arquivo do kit muda)
- ✅ Automatizável (script de sha256 walk)
- ✅ Tática
- ✅ Sem valor durável (manifest derivado, não authored)
- ✅ Escala linear (mais arquivos → mais hashes)

**Evidence:**
- `kit/file-manifest.json` timestamp `2026-05-05T05:44:24.485Z` (4 dias atrás), version `1.4.0`
- **Zero references no source** (`grep -r "file-manifest" src/ bin/` = empty) — **manifest pode estar morto**
- Manifest tem 20/47 agents, 62/87 commands, 1/49 skills — drift severo
- Última atualização foi 4 commits atrás (`feat(framework): v1.4.0 — velocity improvements`)
- Não há gate que valide manifest vs filesystem

**Decision tree:**
1. **SE manifest é usado por `sync` ou outra runtime:** automatizar via script `npm run manifest:gen` no `prepublishOnly`. Adicionar gate `gates/manifest-fresh.md` no CI.
2. **SE manifest é morto:** REMOVER (deletar arquivo + adicionar `kit/file-manifest.json` ao `.npmignore`).

**Investigation needed (~30min):**
```bash
grep -rn "file-manifest" "D:/projetos/opensource/mcp/src" "D:/projetos/opensource/mcp/bin" "D:/projetos/opensource/mcp/test"
# Empty output confirmed — likely orphan artifact from a deprecated feature
```

**Automação proposta (case 1 — útil):**
- `bin/cli.js manifest gen` que walk `kit/` e calcula sha256 → escreve `kit/file-manifest.json`
- `npm run manifest:check` retorna 0 se em sync, 1 se drift
- Adicionar à `prepublishOnly`: `npm run manifest:check`

**Automação proposta (case 2 — morto):**
- `git rm kit/file-manifest.json`
- 1 commit, 0 risco

**Esforço:** 0.5 dia (S) — sendo case 2, é 5 minutos.

**Owner:** @luanpdd

**Stage:** L0 → L4 (case 1) ou DELETE (case 2)

---

### Item 4: Smoketest manual de sync nos 8 IDEs

**Por que é toil:**
- ✅ Manual (humano abre cada IDE e clica)
- ✅ Repetitiva (toda release importante)
- ✅ Automatizável (CLI já cobre `sync install <target>` para qualquer target)
- ✅ Tática (validar antes de cut)
- ✅ Sem valor durável
- ✅ Escala linear (cada novo IDE no registry = mais um smoketest manual)

**Evidence:**
- `.github/workflows/ci.yml` linha 130 só faz `node bin/cli.js install dry-run claude-code` — outros 7 IDEs **nunca testados em CI**
- Linha 163, 174, 190 reforça padrão: tudo é `claude-code --project-root`
- `test/integration/cli-roundtrip.test.js` tem 5 tests, **todos** apontam para `claude-code`
- `src/core/registry.js` define 8 targets (claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae) — 7 deles têm zero cobertura runtime
- README celebra "**8 IDEs**" como diferencial — sub-test = 12.5% (1/8)
- Hook race condition v1.12.1 escapou justamente porque cobertura runtime é fraca para non-claude-code paths

**Automação proposta:**
1. Refactor `cli-roundtrip.test.js` para `for (target of TARGETS)` rodar o sync round-trip
2. Adicionar fixtures por target — esperado em `test/fixtures/expected/<target>/`
3. Cada target valida: install cria arquivos esperados → reverse-sync detect retorna stub → remove restaura limpo
4. CI roda matrix 8 targets × 3 OS × 3 Node = 72 combos (do atual 9 = 9× cobertura)
5. Reduzir matrix custom em CI se virar lento (e.g. só Linux para non-claude-code targets)

**Esforço:** 3 dias (M). Cada target tem layout próprio (`.cursor/rules/*.mdc`, `.codex/AGENTS.md`, `.gemini/GEMINI.md`) — fixtures expected são chatos mas mecânicos.

**Owner:** @luanpdd

**Stage:** L0 (manual ad-hoc para non-claude-code) → L3 (CI cobre os 8)

**Bônus:** detecta regressões cross-IDE como o `version: '0.1.0'` hardcoded.

---

### Item 5: Triage de bug reports

**Por que é toil:**
- ✅ Manual (mantenedor lê, classifica, pede repro)
- ✅ Repetitiva (cada bug similar exige perguntas similares)
- ✅ Parcialmente automatizável (template captura version, IDE, repro steps)
- ✅ Tática
- ✅ Sem valor durável
- ✅ Escala linear (mais users → mais bugs)

**Evidence:**
- Não há `.github/ISSUE_TEMPLATE/` no repo
- Não há `CONTRIBUTING.md`
- `release v1.12.1 — fix sidecar hook race condition (events now reach UI)` indica que esse bug chegou em prod e teve que ser triado manualmente
- Sem template, repro de race condition exige back-and-forth manual no thread

**Automação proposta:**
1. Criar `.github/ISSUE_TEMPLATE/bug.yml` com fields: kit-mcp version, IDE/target, OS, Node version, repro steps, expected vs actual, output of `kit doctor` (já existe!)
2. Criar `.github/ISSUE_TEMPLATE/feature.yml` para sugestões
3. Criar `CONTRIBUTING.md` curto (5 mins de leitura) explicando: kit/ vs framework/, como adicionar agent/skill, como rodar tests, anti-pitfalls
4. Adicionar GitHub Action que comenta pedindo `kit doctor` se issue não tiver

**Esforço:** 1 dia (S)

**Owner:** @luanpdd

**Stage:** L0 → L2 (template captura 80% do contexto upfront)

---

## P1 — escalonar próximo trimestre

### Item 6: Bump `version: '0.1.0'` em `src/mcp-server/index.js:265`

**Evidence:** linha 265 hardcoded mesmo após v1.12.1. Discrepância de **12 versões** entre source e package.json.

**Automação:** trocar por `import { readFileSync } from 'node:fs'; const pkg = JSON.parse(readFileSync(...))` — mesmo padrão de `bin/cli.js:43-51`.

**Esforço:** 0.5 hora.

**Stage:** L0 → L4 (1 commit, evergreen)

---

### Item 7: `CLAUDE.md` "Auto-gen. Edit `kit/`; rerun `kit sync <target>`"

**Evidence:** `CLAUDE.md` linha 2 declara auto-gen, mas o quando o agent/command muda nome, descrição não atualiza automaticamente — só com sync explícito. Precisa validar que `kit sync` realmente regenera CLAUDE.md.

**Automação:** já é L1 (sync regenera). Falta watch mode automático ou pre-commit hook.

**Esforço:** 1 dia.

**Stage:** L1 (parcial — exige sync manual) → L4 (file watcher + auto-sync)

---

### Item 8: Hook race condition repro sem test automatizado

**Por que é P1 e não P0:** infrequente (raro), mas quando acontece, é caro (v1.12.1 = patch release fast). É candidato a investimento em **test infrastructure** (grungy work) — não é toil clássico, mas a ausência dele força repro manual quando manifestar.

**Evidence:** v1.12.1 fix tinha de ser feito a cabeça, sem test de regressão para garantir não voltar.

**Automação:** test em `test/integration/sidecar-publish-flush.test.js` que valida ordem `request → response.end → process.exit`. Pode usar mock TCP server que conta bytes.

**Esforço:** 4 dias (M) — mock servidor + race detector + edge cases.

**Stage:** L0 → L2 (test cobre, mas não previne).

**Note:** parcialmente **grungy work** (cria asset durável) — borderline toil/grungy.

---

### Item 10: Cross-link entre suítes em README

**Evidence:** 4 milestones (Supabase v1.8, Observabilidade v1.9, SRE v1.10, Legacy v1.12) cada uma com seção própria. Cross-refs (e.g. "Supabase suite (v1.8) integra com Observability suite (v1.9)") são editados manualmente em prosa.

**Automação:** YAML `kit/suites.yml` declarativo + jinja-like rendering em CI para gerar seção README.

**Esforço:** 2 dias (M).

**Stage:** L0 → L3.

---

## P2 — documentar, monitorar

### Item 13: Compatibility tables por agent (8 IDEs × 47 agents)

**Score baixo:** scope grande (376 cells) mas mudança rara. Documentar agora, automatizar quando atingir 60+ agents.

---

## Não-toil identificado (categorizar separadamente)

### Overhead (não-eliminável)

- **Stand-up consigo mesmo:** 0 h/sem (1-pessoa team — não tem)
- **Code review:** 0 h/sem (Dependabot abre PRs ✅; não há reviewer humano além do mantenedor)
- **PR triage do Dependabot:** 0.2 h/sem — Dependabot já agrupa minor/patch (ver `.github/dependabot.yml` linha 9-13). Toil eliminado proativamente em config.

### Grungy work (asset durável)

- **Refactor de `src/core/sync.js`** quando acomodar 9º IDE — projeto engineering, não toil
- **Docs `Releasing (maintainers)`** — README linha 546-578 é asset permanente; quando atualiza é overhead, não toil
- **Test infrastructure para hook race conditions** (cruza com Item 8) — borderline; tratamos como P1 grungy
- **Migração de `version: '0.1.0'` para auto-pull** (Item 6) — patch único, depois é evergreen

### Project work (planejado, não-tático)

- **Suíte Legacy v1.12** (Feathers + AI) — milestone planejado, não toil
- **Roadmap aberto** (HTTP transport, sync watch via MCP) — features, não toil

---

## Cron jobs / automação JÁ existente (linha de base)

- ✅ **`publish.yml`** (GitHub Action) — push tag `v*` → CI roda smoke + publica em npm com provenance + cria GitHub Release (Item 9 = L4) — **excelente**
- ✅ **`ci.yml` matrix 3 OS × 3 Node = 9 combos** — boa base, falta target matrix (Item 4)
- ✅ **`prepublishOnly`** roda unit + integration antes de `npm publish` (Item 11 = L3)
- ✅ **CI gates** rodando os 4 v1.8 Supabase gates + npm-audit gate (linhas 132-157) — automação exemplar
- ✅ **Sanity check** package.json version vs tag (publish.yml linhas 38-46) — bloqueia mismatch
- ✅ **Dependabot** weekly em npm + github-actions com agrupamento minor/patch — **6 deps budget já sendo monitorada**
- ✅ **`gates/sync-idempotent.md`** existe — falta CI dispatch (atualmente non-blocking warn)

---

## Próximos passos (ordem sugerida)

| Ordem | Ação | Effort | Quando |
|-------|------|--------|--------|
| 1 | Item 6 (bump hardcoded version) | 0.5h | hoje, antes de qualquer outra coisa |
| 2 | Item 3 (decidir se manifest é morto ou usar) | 0.5d | semana 1 |
| 3 | Item 2 (counts em README) | 0.5d | semana 1 |
| 4 | Item 1 (CHANGELOG automation) | 1d | semana 1 |
| 5 | Item 5 (issue templates + CONTRIBUTING) | 1d | semana 2 |
| 6 | Item 4 (CI matrix 8 IDEs) | 3d | semana 2-3 |
| 7 | Re-audit em 90d | — | 2026-08-09 |

**Phase 39 INT-OBS-02 cross-ref:** `omm-auditor` Capacidade 3 (Complexidade/Tech Debt) consome `toil_pct = 16-33%` — score Cap 3 = **3-4** ("30-50%" → 3 / "15-30%" → 4) na tabela canônica do agent.

**Phase 40 INT-FW-V2-03 cross-ref:** `/auditar-marco --milestone v1.12` invocará `/auditar-toil` automaticamente quando `workflow.audit_milestone_toil=true`. Re-audit a cada milestone fechado mantém pulse.

---

## Apêndice A — Métricas de drift detectadas

```
DRIFT REPORT
============
file-manifest.json:
  agents listed:    20 / 47 ( 43% coverage)
  commands listed:  62 / 87 ( 71% coverage)
  skills listed:     1 / 49 (  2% coverage)
  last update: 4 commits ago (2026-05-05)

CHANGELOG.md:
  last entry:       [1.10.0] (2026-05-07)
  current version:  1.12.1
  missing entries:  v1.11.0, v1.12.0, v1.12.1 (3 releases)

README.md hardcoded counts:
  "19 agents":  6 occurrences   (real: 47, drift +147%)
  "60 commands": 4 occurrences  (real: 87, drift +45%)
  "single example skill": 1     (real: 49 skills shipped)

src/mcp-server/index.js:
  hardcoded version: '0.1.0'    (package.json: 1.12.1, drift -12 versions)

CI test coverage:
  IDEs in test:     1 / 8 (claude-code only)
  IDEs in registry: 8

GitHub repo gaps:
  ISSUE_TEMPLATE/:  missing
  CONTRIBUTING.md:  missing
  CODE_OF_CONDUCT:  missing
```

---

## Apêndice B — Top 30 commit normalization (evidence base)

```
   5  docs(phase-N): complete phase execution
   4  docs(N): contexto auto-gerado
   3  vN.N.N
   2  docs: define milestone vN.N requirements (N REQs)
   2  docs: create milestone vN.N roadmap (N phases, N REQs, N ondas)
   2  docs(N): contexto auto-gerado (discuss pulado)
   2  archive: milestone vN.N.N concluído (N/N REQs)
```

275 commits / 90d = **3 commits/day** (1 mantenedor, alto volume) — toil em mantenedor solo é particularmente penalizante porque não há fallback.
