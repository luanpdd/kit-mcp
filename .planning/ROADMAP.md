# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Concluídos

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- **v1.8.0 — Suíte Supabase (Phases 25-28)** — 11 skills + 7 agents + command `/supabase` + 5 audit gates + UUID cleanup. [Detalhes](./milestones/v1.8.0/ROADMAP.md)
- **v1.9.0 — Observabilidade (Phases 29-35)** — 11 skills + 5 agents + 6 commands + 3 audit gates + 11 patches em commands/agents existentes. Material-fonte: *Observability Engineering* (O'Reilly, 2022). [Detalhes](./milestones/v1.9/ROADMAP.md)
- **v1.10.0 — SRE Engagement (Phases 36-41)** — 6 skills + 4 agents + 6 commands + 3 audit gates + 9 patches em artefatos v1.8/v1.9 + framework flow. Material-fonte: *Site Reliability Engineering* (Beyer/Jones/Petoff/Murphy — Google/O'Reilly, 2016). 32 REQs entregues 2026-05-07. [Detalhes](./milestones/v1.10-ROADMAP.md)

## Em andamento

### v1.12 — Legacy Code Mastery & AI-Era Refactoring (Phases 48-78)

**Milestone:** v1.12 — Legacy Code Mastery & AI-Era Refactoring (5ª suíte do kit, derivada do livro Feathers 2004 + modernizações IA/Supabase 2026)
**Numeração de fases:** continua de v1.11 (terminará em fase 47) → v1.12 começa em **Fase 48**
**Total de REQs cobertos:** 38 (GLOS-LGC-01..02, SKFD-LGC-01..12, AGCORE-LGC-01..08, CMD-LGC-01..10, INT-LGC-01..04, INT-FW-LGC-01..02, GATE-LGC-01..03)
**Total de fases:** 31 (Fases 48-78)
**Estrutura:** 5 ondas (skills foundationais, skills+modernizações IA, agentes, comandos, gates+integrações)
**Status:** **17 fases concluídas (entregues out-of-band) · 14 pending**
**Criado:** 2026-05-08
**Material-fonte:** *Working Effectively with Legacy Code* — Michael Feathers (Prentice Hall, 2004). ISBN 978-0-13-117705-5.
[Detalhes](./milestones/v1.12-ROADMAP.md)

### v1.11 — SRE Resilience & Release Engineering (Phases 42-47)

**Milestone:** v1.11 — SRE Resilience & Release Engineering
**Numeração de fases:** continua de v1.10 (terminou em fase 41) → v1.11 começa em **Fase 42**
**Total de REQs cobertos:** 24 (GLOS2-01..03, SKFD-SRE2-01..05, AGCORE-SRE2-01..03, CMD-SRE2-01..04, INT-SRE-V2-01..02, INT-SB-V3-01, INT-OBS-V2-01, INT-FW-V3-01, QA-SRE2-01..04)
**Total de fases:** 6 (Fases 42-47)
**Estrutura:** 3 ondas conforme PROJECT.md
**Criado:** 2026-05-08

---

## Visão geral do milestone

Adicionar 2ª camada SRE ao kit derivada do livro do Google (*Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy — O'Reilly, 2016, ISBN 978-1-491-92912-4), completando a Suíte SRE iniciada na v1.10. Caps prioritários v1.11: **22 (*Addressing Cascading Failures*) + 8 (*Release Engineering*)** — mesmos critérios canônicos da v1.10 (PT-BR, code blocks EN com comentários PT-BR, content-only, zero deps novas). v1.11 é **content-only por design** — zero alterações em `src/core/`. Stable API v1.0+ preservada.

**Beneficiários principais:**
- Suíte SRE v1.10 (`prr-conductor` ganha checks Axe 4+5; `four-golden-signals` ganha contexto Saturation→cascading)
- Suíte Observabilidade v1.9 (`omm-auditor` Capacidade 1 Resilience consulta `cascading-failures-auditor`)
- Suíte Supabase v1.8 (`supabase-edge-fn-writer` ganha retry+deadline+load-shedding built-in)
- Fluxo framework (`/concluir-marco` ganha gate `release-pipeline-policy` opt-in)

**Material-fonte:** Caps 22 (Addressing Cascading Failures) e 8 (Release Engineering). Caps já cobertos em v1.10: 3, 4, 5, 6, 15, 32. Caps deferidos para v1.12+: 9 (Simplicity), 10-14 (Operações: Practical Alerting, On-Call, Troubleshooting, Emergency Response, Managing Incidents), 17-21 (DPE/Distributed Systems), 23 (Distributed Consensus), 25-26 (Data SRE), 27 (Reliable Product Launches). Workbook 2018 fica fora do escopo por decisão SSOT.

---

## Onda 1 — Núcleo SRE-2 (Phases 42-44)

> Glossary patch + 5 skills foundationais SKFD-SRE-2 + 3 agentes + 3 commands + extensão `/sre` orchestrator. Sem essa onda, INT/QA não compila.

### Phase 42: Skills foundationais SRE-2 — glossary patch + 5 SKFD

**Tipo:** Conteúdo editorial — patch em glossário existente + escrita de 5 skills canônicas (Markdown puro)
**Por que primeiro:** Patch em `_shared-sre/glossary.md` (v1.10) e 5 skills foundationais SKFD-SRE-2 são consultáveis standalone e referenciadas por todos agentes/comandos das fases seguintes. Sem vocabulário canônico estendido (cascading failure, retry storm, hermetic build, release pipeline, etc.) e definições de cascading-failures/load-shedding/retry-strategies/hermetic-builds/release-engineering, links morrem em `kit/agents/cascading-failures-auditor.md`, `kit/agents/load-shedding-instrumenter.md`, `kit/agents/release-pipeline-auditor.md` e nos commands. Sem dependências exceto contexto v1.10.

**Dependência:** Nenhuma (Phase 42 é a primeira do milestone v1.11).

**REQs cobertos (8):** GLOS2-01, GLOS2-02, GLOS2-03, SKFD-SRE2-01, SKFD-SRE2-02, SKFD-SRE2-03, SKFD-SRE2-04, SKFD-SRE2-05

**Critérios de sucesso:**
1. Patch em `kit/skills/_shared-sre/glossary.md` (v1.10) adiciona 3 blocos novos — vocabulário cap 22 (cascading failure, retry storm, thundering herd, load shedding, graceful degradation, circuit breaker, deadline propagation, kill switch, throttle, queue management, resource exhaustion CPU/memory/file descriptors/threads), vocabulário cap 8 (hermetic build, reproducible build, release pipeline, deployment policy, self-service deployment, build provenance, configuration management, branching strategy, release engineering invariants), e seção de anti-patterns explícitos cap 22+8 (retry sem jitter→retry storm, retry sem deadline→cascade amplification, thundering herd em recovery, deploy não-hermético, config drift, release pipeline manual, no-rollback culture); glossário continua NÃO listado em `listKit` (precedente v1.10 preservado)
2. As 5 skills SKFD-SRE-2 existem em `kit/skills/{cascading-failures,load-shedding-graceful-degradation,retry-strategies,hermetic-builds,release-engineering}/SKILL.md` com frontmatter válido (`name`, `description ≤ 200 chars`); cada uma é auto-contida — LLM gera workflow completo sem ler outra skill (cross-refs apenas em "Ver também" no fim)
3. Conteúdo conforme caps específicos: `cascading-failures` ↔ cap 22 main (triggers, loops de feedback, prevenção, testing, immediate response); `load-shedding-graceful-degradation` ↔ cap 22 sub (queue depth, drop policy, deadline propagation, degraded modes); `retry-strategies` ↔ cap 22 sub (jitter full/equal/decorrelated, exp backoff cap, retry budget, idempotency, when NOT to retry); `hermetic-builds` ↔ cap 8 sub (reproducibility, isolation, provenance, pinned versions, lockfiles, common pitfalls); `release-engineering` ↔ cap 8 main (deployment philosophy, build orchestration, versioning, branching, continuous build/test/deploy, configuration management, invariants)
4. Sync idempotente — `kit sync install claude-code --project-root <tmpdir>` rodado 2× produz `.claude/skills/{...}` byte-idêntico (excluindo timestamp regenerado por design)
5. CLAUDE.md gerado cresce ≤ +1.0 KB após Phase 42 (description budget enforcement — anti-pitfall A2 herdado de v1.8/v1.9/v1.10)

**Estimativa:** ~10-13h. Cada skill ~2-2.5h em média; glossário patch ~1.5h.

---

### Phase 43: Agentes core SRE-2 — 3 agentes

**Tipo:** Conteúdo editorial — agentes (Markdown com frontmatter complexo + tabela compatibilidade IDE)
**Por que segundo:** Com skills SKFD-SRE-2 da Phase 42 no lugar, agentes podem cross-referenciar via Markdown link. `cascading-failures-auditor` consome `cascading-failures` + `retry-strategies` + skills v1.10 (`four-golden-signals` saturation as early warning); `load-shedding-instrumenter` consome `load-shedding-graceful-degradation` + `retry-strategies` + base de `supabase-edge-fn-writer` v1.8; `release-pipeline-auditor` consome `hermetic-builds` + `release-engineering`.

**Dependência:** Phase 42 concluída (skills SKFD-SRE-2 existem para cross-reference).

**REQs cobertos (3):** AGCORE-SRE2-01, AGCORE-SRE2-02, AGCORE-SRE2-03

**Critérios de sucesso:**
1. Agente `kit/agents/cascading-failures-auditor.md` existe com tabela "Compatibilidade IDE", recebe código de serviço (ou diretório de Edge Functions) e retorna `.planning/CASCADING-AUDIT.md` priorizado P0/P1/P2 com sugestões de patches; detecta triggers via análise estática (regex sobre `setTimeout|AbortSignal|withTimeout|deadline`, ausência de jitter em retry, ausência de circuit breaker, dependências sem health check, queue sem limite, ausência de deadline propagation); cross-ref para `cascading-failures` + `retry-strategies` + `four-golden-signals`
2. Agente `kit/agents/load-shedding-instrumenter.md` existe com tabela "Compatibilidade IDE", aplica padrões de load shedding em código (queue depth gauge, drop policy oldest/newest/random/priority, deadline-aware request handler via `AbortSignal.timeout()`, server-side rate limit middleware); foca em Edge Functions / serviços HTTP; cross-ref para `load-shedding-graceful-degradation` + `retry-strategies`; produz patches via Edit
3. Agente `kit/agents/release-pipeline-auditor.md` existe com tabela "Compatibilidade IDE", audita CI/CD (`.github/workflows/*.yml`, `Dockerfile`, lockfiles `package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`/`deno.lock`) para hermeticidade (build sem network, deps pinadas, sem `npm install` sem `--frozen-lockfile`/`ci`), reprodutibilidade (lockfile commitado, sem timestamps em build), policy enforcement (signed commits via `actions/setup-node@v[4-9]`, branch protection sinalizada via README/config, required reviewers); produz `.planning/RELEASE-AUDIT.md` scored em 3 dimensões (hermeticidade, reprodutibilidade, policy enforcement); cross-ref para `hermetic-builds` + `release-engineering`
4. Smoke: invocar cada agente em fixture sintético — `cascading-failures-auditor` produz CASCADING-AUDIT.md priorizado; `load-shedding-instrumenter` aplica patches em Edge Function de teste; `release-pipeline-auditor` produz RELEASE-AUDIT.md scored
5. `description ≤ 200 chars` em todos os 3 agents (anti-pitfall A2 herdado de v1.8/v1.9/v1.10)
6. Sync idempotente — agentes byte-idênticos em 2× consecutivos (timestamp-stripped)

**Estimativa:** ~6-8h. `release-pipeline-auditor` é o mais complexo (parsing de YAML workflows + 3 dimensões de scoring); restante segue padrão maduro v1.10.

---

### Phase 44: Commands SRE-2 + extensão do orchestrator

**Tipo:** Conteúdo editorial — 3 commands com dispatch via Task() + patch no orchestrator existente
**Por que terceiro:** Com agentes da Phase 43, commands são apenas wrappers que invocam `Task(subagent_type=...)`. Patch em `/sre` (v1.10 orchestrator) adiciona 3 subcomandos novos (`cascading`, `load-shedding`, `release`) preservando os 5 subcomandos v1.10 existentes (`golden-signals`, `auditar-toil`, `postmortem`, `prr`, `risk-budget`). Frontmatter do `/sre` preservado byte-a-byte (anti-pitfall A2).

**Dependência:** Phase 43 concluída.

**REQs cobertos (4):** CMD-SRE2-01, CMD-SRE2-02, CMD-SRE2-03, CMD-SRE2-04

**Critérios de sucesso:**
1. Comando `kit/commands/auditar-cascading.md` existe — invoca `cascading-failures-auditor` via `Task(subagent_type=cascading-failures-auditor)`; aceita target opcional (`<service-path>` ou `--phase <number>`); gera `.planning/CASCADING-AUDIT.md` priorizado P0/P1/P2; `description ≤ 200 chars`
2. Comando `kit/commands/load-shedding.md` existe — invoca `load-shedding-instrumenter` via `Task(subagent_type=load-shedding-instrumenter)`; flags `--target <path>` (Edge Function path) ou `--phase <number>`; aplica patches via Edit; `description ≤ 200 chars`
3. Comando `kit/commands/auditar-release.md` existe — invoca `release-pipeline-auditor` via `Task(subagent_type=release-pipeline-auditor)`; gera `.planning/RELEASE-AUDIT.md` scored em hermeticidade + reprodutibilidade + policy enforcement; `description ≤ 200 chars`
4. Patch em `kit/commands/sre.md` (v1.10) adiciona 3 subcomandos novos (`cascading`, `load-shedding`, `release`) com sinônimos PT/EN — paridade com 5 subcomandos v1.10 existentes (`golden-signals`, `auditar-toil`/`audit-toil`, `postmortem`, `prr`, `risk-budget`/`budget`); dispatch via `Task(subagent_type=...)`; frontmatter `description` + `allowed-tools` byte-idêntico ao v1.10 preservado; case especial `risk-budget` v1.10 mantido como comando direto
5. Smoke: `kit sync install claude-code` lista 3 commands novos em `.claude/commands/` (`auditar-cascading`, `load-shedding`, `auditar-release`); orquestrador `/sre` lista 8 subcomandos no help (5 v1.10 + 3 v1.11)
6. Sync idempotente preservado em todos os artefatos

**Estimativa:** ~5-7h. Padrão maduro v1.8/v1.9/v1.10 — commands são wrappers diretos; orquestrador patch é cirúrgico.

---

## Onda 2 — Integração (Phases 45-46)

> Patches em camadas existentes (SRE v1.10 + Supabase v1.8 + Observabilidade v1.9 + framework). Separados em 2 fases para isolamento de dependências — Phase 45 toca artefatos das suítes técnicas; Phase 46 toca fluxo framework com cuidado byte-a-byte.

### Phase 45: Patches em Suítes existentes

**Tipo:** Patches editoriais — adicionar blocos `<sre_resilience_integration>` em artefatos das suítes anteriores
**Por que quarto:** Onda 1 (núcleo SRE-2) precisa estar consolidada para que cross-refs nas suítes existentes apontem para artefatos reais. 4 patches focados — cada um em um agente/skill canônico de suíte diferente.

**Dependência:** Phases 42-44 concluídas.

**REQs cobertos (4):** INT-SRE-V2-01, INT-SRE-V2-02, INT-SB-V3-01, INT-OBS-V2-01

**Critérios de sucesso:**
1. Patch em `kit/skills/four-golden-signals/SKILL.md` (v1.10) adiciona seção "Saturation as cascading failure trigger" cross-referenciando `cascading-failures` skill — saturation > threshold é early warning antes de cascade, com exemplo prático de threshold tuning (CPU > 80%, memory > 85%, queue depth > 90% capacity); frontmatter `description` + nome do skill inalterado (anti-pitfall A2)
2. Patch em `kit/agents/prr-conductor.md` (v1.10) — Axe 4 (Capacity Planning) ganha checks de cascading prevention (timeout configurado em todas chamadas downstream, retry com jitter, circuit breaker presente em deps críticas, queue depth instrumentada); Axe 5 (Change Management) ganha checks de hermeticidade (lockfile commitado, build reprodutível sem network calls, deploys policy-enforced); cross-refs Markdown ativos para `cascading-failures-auditor` (Axe 4) + `release-pipeline-auditor` (Axe 5); frontmatter `description` + `tools` byte-idêntico preservado
3. Patch em `kit/agents/supabase-edge-fn-writer.md` (Suíte Supabase + Observabilidade + SRE) — template Edge Function ganha retry-with-jitter wrapper (full jitter por default), deadline propagation via `AbortSignal.timeout(deadlineMs)`, server-side load shedding via queue depth check (drop request quando saturation > 95% via 503 + Retry-After); cross-refs Markdown ativos para `retry-strategies` + `load-shedding-graceful-degradation`; bloco `<observability_integration>` Suíte Obs + bloco "Four Golden Signals" Suíte SRE preservados byte-a-byte; frontmatter inalterado (anti-pitfall A2)
4. Patch em `kit/agents/omm-auditor.md` (Suíte Observabilidade) — Capacidade 1 (Resilience) consulta `cascading-failures-auditor` via cross-ref Markdown ativo; tabela 5-row mapeando severity de findings (P0 count, P1 count, P2 count) → score 1-5 (e.g., 0 P0/P1 + ≤ 3 P2 = score 5; ≥ 1 P0 = score ≤ 2); regra absoluta "score Cap 1 > 3 exige CASCADING-AUDIT.md fresco ≤ 30d" análoga à regra Cap 3 (TOIL-AUDIT.md) Suíte SRE; frontmatter inalterado; bloco existente "Capacidade 3 ↔ toil-auditor" Suíte SRE preservado byte-a-byte
5. Frontmatter (`description`, `tools`, `allowed-tools`) inalterado em todos os 4 artefatos (anti-pitfall A2 enforcement)
6. Smoke: rodar `gates/budget-description.mjs` Suíte Supabase e gate `obs-skills-frontmatter` Suíte Observabilidade em CI sintético — todos verde; sync 2× idempotente em todos os 4 artefatos patcheados

**Estimativa:** ~5-7h. 4 patches cirúrgicos × ~60-90min cada (cross-ref + 1-2 parágrafos + smoke).

---

### Phase 46: Patch em fluxo framework

**Tipo:** Patch editorial cirúrgico em comando do framework — adicionar gate opt-in no `/concluir-marco`
**Por que quinto:** Patch isolado em comando framework crítico (`/concluir-marco`) merece fase própria para preservar bytes existentes — bloco `<observability_integration>` Suíte Obs + bloco `<sre_integration>` Suíte SRE (gate PRR opt-in) precisam ser preservados byte-a-byte. Adicionar gate `release-pipeline-policy` paralelo ao PRR gate v1.10 sem regressão.

**Dependência:** Phases 42-45 concluídas (skill `release-engineering` + agente `release-pipeline-auditor` + command `auditar-release` existem).

**REQs cobertos (1):** INT-FW-V3-01

**Critérios de sucesso:**
1. Patch em `kit/commands/concluir-marco.md` (framework) adiciona gate `release-pipeline-policy` opt-in via flag `workflow.complete_milestone_release_gate=true` (default false, paralelo ao PRR gate v1.10 que usa `workflow.complete_milestone_prr_gate`); bloqueia `/concluir-marco` se `RELEASE-AUDIT.md` ausente OU status `failed` em qualquer das 3 dimensões (hermeticidade/reprodutibilidade/policy enforcement); cross-ref Markdown ativo para `release-pipeline-auditor` + skill `release-engineering`
2. Frontmatter (`description`, `allowed-tools`) inalterado byte-a-byte
3. Bloco `<observability_integration>` Suíte Obs preservado byte-a-byte (gate OMM regression)
4. Bloco `<sre_integration>` Suíte SRE preservado byte-a-byte (gate PRR opt-in + cross-refs SRE)
5. Novo gate é paralelo (não substitui) — usuários podem ativar PRR-only, release-only, ambos ou nenhum
6. Smoke: rodar `/concluir-marco` em fixture com `complete_milestone_release_gate=false` (default) → não invoca gate; rodar com `=true` sem `RELEASE-AUDIT.md` → bloqueia; rodar com `=true` + `RELEASE-AUDIT.md` status `passed` → não bloqueia
7. `gates/golden-signals-coverage.mjs` Suíte SRE + `gates/postmortem-template-required.mjs` Suíte SRE + `gates/prr-checklist-coverage.mjs` Suíte SRE continuam verde

**Estimativa:** ~2-3h. Patch cirúrgico — ~50 linhas adicionadas, byte-preservation crítica.

---

## Onda 3 — Gates e docs (Phase 47)

> 2 audit gates novos + README + CHANGELOG. Última fase do milestone.

### Phase 47: Gates QA + README + CHANGELOG

**Tipo:** 2 gates bash 3.2-portable + atualização editorial de docs externas
**Por que último:** Gates dependem de todos os artefatos das ondas anteriores existirem para validarem corretamente. README/CHANGELOG documentam o entregável final.

**Dependência:** Phases 42-46 concluídas.

**REQs cobertos (4):** QA-SRE2-01, QA-SRE2-02, QA-SRE2-03, QA-SRE2-04

**Critérios de sucesso:**
1. Gate `gates/cascading-failures-prevention.md` (blocking, pre-verify) — verifica código de serviço/Edge Function tocado em fase tem patterns de prevenção de cascading via regex inclusiva sobre 3 famílias (timeout: `setTimeout|AbortSignal|withTimeout|deadline`; backoff/jitter: `jitter|backoff|retry-after`; circuit breaker / fail-fast: `circuit.?breaker|fail.?fast`); skip gracefully em projetos content-only (sem código de runtime); bash 3.2-portable (sem bashisms 4+, sem `[[`, sem arrays associativos)
2. Gate `gates/release-pipeline-policy.md` (blocking, pre-conclude) — verifica `.github/workflows/*.yml` tem patterns de hermeticidade (`actions/setup-node@v[4-9]` com `cache:` configurado, lockfile commitado existe — `package-lock.json` OU `pnpm-lock.yaml` OU `yarn.lock` OU `deno.lock`, sem `npm install` desacompanhado de `--frozen-lockfile`/`ci`); verifica branch protection sinalizada via README ou config; skip gracefully em projetos sem CI (sem `.github/workflows/`); bash 3.2-portable
3. README ganha seção "SRE Resilience & Release Engineering" listando 5 skills + 3 agents + 3 commands + 2 gates com exemplo end-to-end (e.g., `/sre cascading <service>` para auditar prevention → `/sre load-shedding <target>` para aplrar patches → `/sre release` para auditar CI/CD → após hardening, `/sre prr` valida 6 axes incluindo Axe 4+5 patcheados); cita material-fonte (livro Google SRE 2016) caps 22 + 8
4. CHANGELOG ganha entrada `## [1.11.0] - 2026-MM-DD` documentando: SRE Resilience & Release Engineering layer (5 skills + 3 agents + 3 commands + 2 gates), integração com Suíte SRE (PRR Axe 4+5 patcheados, four-golden-signals saturation→cascading), Suíte Supabase (edge-fn-writer retry+deadline+load-shedding built-in), Suíte Observabilidade (omm-auditor Cap 1 Resilience consulta cascading-failures-auditor), framework (concluir-marco release gate opt-in paralelo a PRR gate)
5. Smoke: rodar 2 gates novos em CI sintético — ambos retornam exit 0 (pass) na codebase atual; falham corretamente em projetos sintéticos com gaps (cascading: serviço sem timeout → exit 1; release: workflow sem cache + sem lockfile → exit 1)
6. Sync idempotente preservado em todas as 6 fases (rodar 2× = byte-idêntico excluindo timestamps regenerados)
7. STATE.md, MILESTONES.md, ROADMAP.md atualizados; `wc -c CLAUDE.md` ≤ 14.5 KB total após v1.11 (anti-pitfall A2 herdado — CLAUDE.md inflation budget); `gates/deps-budget.mjs` continua verde (6/6 — zero deps novas em v1.11 — anti-pitfall A9 herdado)

**Estimativa:** ~4-6h. 2 gates ~1.5h cada; README ~1h; CHANGELOG ~30min.

---

## Resumo da cobertura de REQs

| Onda | Phase | REQs cobertos | Total |
|------|-------|---------------|-------|
| 1 — Núcleo SRE-2 | 42 | GLOS2-01, GLOS2-02, GLOS2-03, SKFD-SRE2-01, SKFD-SRE2-02, SKFD-SRE2-03, SKFD-SRE2-04, SKFD-SRE2-05 | 8 |
| 1 — Núcleo SRE-2 | 43 | AGCORE-SRE2-01, AGCORE-SRE2-02, AGCORE-SRE2-03 | 3 |
| 1 — Núcleo SRE-2 | 44 | CMD-SRE2-01, CMD-SRE2-02, CMD-SRE2-03, CMD-SRE2-04 | 4 |
| 2 — Integração | 45 | INT-SRE-V2-01, INT-SRE-V2-02, INT-SB-V3-01, INT-OBS-V2-01 | 4 |
| 2 — Integração | 46 | INT-FW-V3-01 | 1 |
| 3 — Gates e docs | 47 | QA-SRE2-01, QA-SRE2-02, QA-SRE2-03, QA-SRE2-04 | 4 |
| **Total** | **6 fases** | **24 REQs** | **24** |

**Cobertura:** 24/24 REQs (100%) — cada REQ mapeado para exatamente uma fase.

---

## Dependências entre fases

```
Phase 42 (skills foundationais SRE-2: glossary patch + 5 SKFD)
  ↓
Phase 43 (3 agentes core SRE-2)
  ↓
Phase 44 (3 commands + extensão /sre orchestrator)
  ↓
Phase 45 (4 patches em Suítes SRE + Supabase + Observabilidade)
  ↓
Phase 46 (1 patch em fluxo framework — /concluir-marco gate)
  ↓
Phase 47 (2 audit gates + README + CHANGELOG)
```

**Cadeia linear** — cada fase depende da anterior. Paralelização possível dentro de uma fase (ex.: Phase 42 escreve 5 skills em paralelo + glossary patch), mas fases não se sobrepõem.

---

## Total do milestone

- **6 fases** (42-47)
- **24 REQs** mapeados (100% cobertura)
- **3 ondas:** Núcleo SRE-2 (3 fases) + Integração (2 fases) + Gates/Docs (1 fase)
- **Estimativa:** ~32-44h efetivas (média ~38h)
- **Cadeia linear:** Phase 42 → 43 → 44 → 45 → 46 → 47
- **Stable API v1.0+ preservada** — content-only milestone, zero alterações em `src/core/`

## Próximo passo

User vai limpar contexto. Após retomada:

```
/discutir-fase 42   # primeira fase — skills foundationais SRE-2
# ou
/autonomo           # executar todas as 6 fases sequencialmente
```
