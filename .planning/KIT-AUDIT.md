# KIT-MCP — Auditoria do Sistema

> Gerado em 2026-06-19 · Fonte de verdade: repositório `kit/` (v1.42.0) · MCP global 1 release atrás

## Resumo executivo

**Contagens reconciliadas (repo = fonte de verdade):**

| Recurso   | Repo (`kit/`) | MCP global | registry/pack.json | Veredito |
|-----------|---------------|------------|--------------------|----------|
| Agents    | **75**        | 73–74      | 73 (registry)      | Drift confirmado |
| Commands  | **94**        | 94         | 92 (soma packs)    | 2 não mapeados |
| Skills    | **100**       | 100        | 98 (soma packs)    | 2 não mapeadas |
| Packs     | **6**         | 6          | 6                  | OK |
| Workflows | **1**         | 1          | 1 (observability)  | Subutilizado |

> Verificado in loco: `ls kit/agents/*.md` = 75; `kit/commands/*.md` = 94; `kit/skills/*/SKILL.md` = 100; `kit/workflows/*.workflow.js` = 1. `kit/framework/VERSION` = **1.30.0** enquanto `package.json` = **1.42.0**.

**Conclusões principais:**

1. **A higiene de metadados é o calcanhar mais barato de consertar.** Versão divergente em 3 fontes (VERSION 1.30 / packs 1.39 / package.json 1.42), README auto-contraditório (75 vs 74 no mesmo arquivo), ~24 cross-links relativos quebrados e 4+ descrições de frontmatter truncadas no meio da frase — tudo capturável por um CI gate determinístico, não por novo agent.
2. **A suíte é profundíssima em Supabase B2B + SRE + Legacy, mas tem 3 buracos de cobertura de alto valor:** segurança de aplicação (tudo hoje é RLS/auth), testing de frontend/E2E (UI inteira materializada, zero testes de jornada) e billing/monetização (núcleo do B2B SaaS, existe só como exemplo de adapter).
3. **O kit ensina Dynamic Workflows (skill 329 linhas, gerador 538 linhas, 6 patterns) mas embarca só 1 workflow.** Isso é stance deliberada (o kit cresce pela *capacidade* de gerar workflows locais, não por embarcar nichos) — porém comandos flagship que JÁ orquestram multi-agente (`mapear-codebase`, auditores per-file) continuam como `Task()` serial sem schema/verify/resume.
4. **O controle de sobreposição é exemplar mas frágil:** os pares agent↔skill homônimos são arquitetura deliberada (skill=conhecimento, agent=materializa) e NÃO devem ser mesclados; porém a disciplina vive em prosa no corpo dos prompts, não como invariante verificável.
5. **A maioria das ideias de "linter como agent" não sobrevive à filosofia do kit:** checagem determinística pertence a `scripts/*.mjs` + `test/unit/`, não a um agent LLM. 8 das 19 ideias caíram por já estarem cobertas por gates existentes (`check-resource-frontmatter.mjs`, `regen-pack-registry.js --check`, `audit-skill-triggers.mjs`).

---

## Pontos de melhoria priorizados

Ordenado P0 → P2, deduplicado entre dimensões.

| Severidade | Dimensão | Achado | Recomendação |
|---|---|---|---|
| **P0** | Lacuna-cobertura | Testing frontend/E2E inexistente — UI pack tem designer + 3 auditores, zero agent de teste; `ui-auditor` só roda `playwright screenshot` (visual estático). Jornadas B2B (login, invite, org-switch, RBAC gate) não são testadas. | Criar agent E2E (Playwright) para o stack já assumido (Next.js+React+shadcn), reusando fixtures do `payload-capture-instrumenter`. Pack **supabase** (junto dos implementers + sibling `supabase-edge-fn-tester`), não ui. |
| **P0** | Lacuna-cobertura | Segurança de aplicação cross-cutting ausente — 100% da "segurança" é RLS/auth Supabase. Sem SAST/SSRF/injection em Edge Functions que fazem fetch a vendors, sem input validation, sem OWASP Top 10. | Criar `app-security-auditor` scored P0/P1/P2, núcleo em SSRF/injection/input-validation/OWASP (secret-scan e CVE como sinais auxiliares). Pack **observability** (stack-agnostic; supabase é "não usa? não instale"). |
| **P1** | Lacuna-cobertura | Billing/subscriptions sem cobertura — Stripe só como exemplo de adapter em `legacy-api-only-applications`. Falta subscription lifecycle, entitlement gating, webhook idempotente, dunning. É a forma de monetizar todo o B2B. | Criar `billing-implementer` (pesado/specialized) materializando subscriptions/plans/entitlements + RLS, webhook Stripe HMAC+dedup, gate via RBAC, dunning via pgmq. Pack **supabase**. |
| **P1** | Qualidade-consistência | ~24 cross-links relativos quebrados (3 padrões): `../kit/` em `auditor-consistencia-isolamento`/`detector-tenant-quente`, `../../../../kit/skills/` em `instrumentar-fase`, `../skills/X` skill→skill em 3 skills. | Corrigir os 24 links e adicionar teste CI que resolve todo link relativo `.md` e falha se o alvo não existir. |
| **P1** | Qualidade-consistência | Drift de versão em 3 fontes: `package.json`=1.42, `kit/framework/VERSION`=**1.30** (verificado), `registry.json`+packs=1.39. VERSION é lido por `check-update.js` → diagnóstico errado ao usuário. | Derivar VERSION e `pack.version` de fonte única (`package.json`) no release; bumpar para 1.42.0; teste que falha se divergirem. |
| **P1** | Qualidade-consistência | Descrições de frontmatter truncadas no meio da frase pelo teto de 200 bytes (`org-onboarding-implementer` …"despacha", `plan-checker` …"antes de", `supabase-column-privileges-writer`, `legacy-characterizer`). 18 agents em 195-200 bytes. | Reescrever as 4+ truncadas para frases completas ≤200 bytes (cortar "(pesado)" redundante com `cost_tier`), terminar com ponto. |
| **P1** | Qualidade-consistência | Sem validação automatizada de frontmatter — `frontmatter.cjs` só valida plan/summary/verification; teste só checa bloco morto. Por isso descrições truncadas e cores divergentes passaram. | Adicionar schema `agent` (required name/cost_tier/tier/description/tools/color; enums; `byteLength(description)≤200`) em CI sobre agents+commands+skills. |
| **P1** | Coesão-packs | Acoplamento cross-pack não declarado — `supabase-edge-fn-writer` linka 4 skills de **observability**; `supabase-edge-fn-tester` linka 4 de **legacy**. Instalar só `supabase` deixa esses `../skills/X` órfãos. Todos os packs têm requires/recommends vazios. | Adicionar `recommends:["observability","legacy"]` no `pack.json` do supabase (propagar ao registry). |
| **P1** | Coesão-packs | Cluster git/release inflado dentro do **core** (não-removível): `commit-pr-conductor` (depende de Notion/Obsidian) + `branch-pr`/`publicar`/`publicar-rapido`/`setup-notion`/`sync-main`/`entrar-discord`. Força todo usuário a carregar peso de release. | Extrair pack `git-release` (removable=true) com esses recursos + skill `release-engineering`; `recommends:["git-release"]` no core. |
| **P1** | Estático→dinâmico | `mapear-codebase` é Fanout-And-Synthesize hardcoded em prosa (4 `codebase-mapper` paralelos → 7 docs) rodando como `Task()` serial sem schema, verify adversarial ou barrier. | Gerar `kit/workflows/mapear-codebase.workflow.js` com COVERAGE_SCHEMA por doc + Verify adversarial (cético confere alucinação em CONCERNS.md) + Synthesize valida line-count. Command vira stub. |
| **P1** | Novos-agentes | Tuning de performance Postgres sem materializador — skill `multi-tenant-performance-scaling` é knowledge-only; nenhum agent roda EXPLAIN ANALYZE + `get_advisors(performance)` emitindo migration de indexes. | Criar `supabase-query-performance-tuner` (plan/advisor-driven, PERF-AUDIT.md + migration), delegando checks VOLATILE/partial-index ao `isolation-auditor`. |
| **P1** | Novos-agentes | RAG é o único domínio rico em skill (`supabase-pgvector-rag`, 255 linhas) **sem par implementer** — quebra o padrão skill+implementer de mfa/rbac/storage/realtime/oauth. | Criar `supabase-rag-implementer` (migration vector+HNSW, RPC `match_documents` security invoker+RLS, Edge Function embedding `Supabase.ai.Session`, chunking). |
| **P1** | Novos-agentes | Eval LLM contra rubrica inexistente — `ai-prompt-characterization` congela snapshot, `ai-mutation-tester` acha pontos cegos, `llm-as-dependency` é adapter; nenhum mede qualidade vs critério. Irônico para um framework de 75 agents. | Criar `llm-eval-harness-writer` (golden dataset + rubrica + LLM-as-judge temp=0/seed + score + gate CI). Pack **legacy** (trinca AI já vive lá). |
| **P1** | Sobreposição | Drift global×repo: `commit-pr-conductor` existe no repo (v1.42) mas MCP global pode atrasar 1 release; confunde roteamento de `/publicar`. | Republicar npm global p/ v1.42; nota em README/CLAUDE.md de que `kit/` é fonte de verdade; drift-guard de CI repo≠registry. |
| **P1** | Sobreposição | Duas skills RBAC com fronteira difusa: `supabase-custom-claims-rbac` vs `rbac-permissions-matrix-supabase` — `supabase-rbac-implementer` referencia AS DUAS sem critério de quando usar cada uma. | Bloco "Quando usar esta vs a outra" no topo de cada SKILL.md (matrix=modelagem; custom-claims=mecânica do Auth Hook+RLS). Já cross-referenciam tabela v1.25 — problema de doc. |
| **P2** | Qualidade-consistência | README auto-contraditório: linha 13 "75 agents" (correto), linha 288 "74 agents". | Atualizar README:288 → 75; estender `update-readme-counts.test.js` p/ todas as ocorrências. |
| **P2** | Qualidade-consistência | Convenção de cor inconsistente: 69/75 agents usam cores nomeadas, 6 usam hex (`designer-ui`, `nyquist-auditor`, `ui-auditor`, `ui-checker`, `ui-researcher`, `workflow-generator`). Nenhum schema documenta o set. | Escolher convenção única, converter os 6 outliers, documentar + validar em CI. |
| **P2** | Qualidade-consistência | Mistura de idioma: comandos PT / agents+skills EN, com 3 agents PT outliers (`auditor-consistencia-isolamento`, `detector-tenant-quente`, `validador-evolucao-schema`) — os 2 primeiros são justamente os de links quebrados. | Documentar convenção (comandos=PT, agents/skills=EN) em CONTRIBUTING; decidir/registrar exceção dos outliers PT. |
| **P2** | Qualidade-consistência | Anotações de versão inline `(vX.Y)` em 106 arquivos como ref stale-prone, nunca validadas. | Remover do corpo dos prompts (o cross-link já identifica o recurso) ou centralizar em índice gerado; no mínimo, não adicionar novas. |
| **P2** | Lacuna-cobertura | Acessibilidade não é cidadã de 1ª classe — só sub-bullets. **Refutado parcialmente**: `ui-critica-auditoria` JÁ tem D1 Accessibility scored + D4 touch 44px; `ui-anti-padroes-ia` marca Q01/Q04/Q07. | Aprofundar a11y como enriquecimento de `ui-critica-auditoria` D1 + `ui-auditor` (WCAG 2.2, axe-core), NÃO agent paralelo competindo pelo `/revisar-ui`. |
| **P2** | Lacuna-cobertura | Design de contrato de API (OpenAPI) sem agent — Edge Functions HTTP tratadas isoladamente, sem visão de API surface. Versionamento e webhooks assinados JÁ cobertos por skills existentes. | Criar `api-contract-designer` reescopado só para geração/auditoria de OpenAPI; delegar versionamento a `evolucao-schema-compativel` e webhooks às skills existentes. |
| **P2** | Lacuna-cobertura | Code review genérico ausente — `example-reviewer` é só template ("3 melhorias"). Sem reviewer language-agnostic por diff fora do fluxo de fases. | Promover code-reviewer real sobre `git diff` (correção/segurança/simplificação), distinto de `verifier` (objetivo de fase). |
| **P2** | Coesão-packs | Skills React/shadcn presas no pack **supabase** (`member-management-react-shadcn`, `org-switcher-react-pattern`, `permission-gate-react-pattern`) — lar natural é o pack ui. | Mover para ui OU `recommends:["ui"]` no supabase (decisão depende da promessa de auto-suficiência do supabase). |
| **P2** | Coesão-packs | `cost-workflow` agrupa 2 domínios sem overlap (telemetria de custo + gerador de workflows). Baixa coesão. | Dividir em pack `cost` + pack `workflows` (consolidando a workflow `auditar-observabilidade-cobertura` hoje em observability), OU renomear. |
| **P2** | Coesão-packs | Workflow Dynamic vive em **observability** enquanto o motor (`workflow-generator`+`dynamic-workflow-authoring`) vive em cost-workflow — capacidade espalhada, difícil descobrir. | Consolidar a workflow junto do motor OU `recommends` cruzado entre os packs. |
| **P2** | Coesão-packs | Órfãos de exemplo no core não-removível: `example-reviewer`, `example-greeting`, `example-skill` inflam o pack obrigatório. | Mover para pack `examples` opcional ou `kit/examples/` fora do registry de produção. |
| **P2** | Estático→dinâmico | `revisar` (cross-IA de planos) é Adversarial-Verification dependente de CLIs externas (Claude/Codex) — frágil, fora do harness. | Criar `revisar-plano.workflow.js` com `parallel()` de 3 verificadores céticos de lentes diversas + quórum majority, sem CLI externa. Manter `--codex` p/ cross-modelo real. |
| **P2** | Estático→dinâmico | Auditores cross-suite rodam serial por arquivo (`multi-tenant-isolation-auditor`, `lgpd-compliance-auditor`, `auditor-consistencia-isolamento`) — fanout per-item já provado no workflow de observability deixa qualidade/wall-clock na mesa. | Converter 1-2 de alto volume p/ Fanout+Verify adversarial por finding (reduz falso-positivo RLS/LGPD), reusando `opts.agentType` p/ não duplicar prompt. |
| **P2** | Novos-agentes | DR/backup readiness ausente em SRE — sem auditor RTO/RPO declarado-vs-testado nem restore-drill PITR. Escopo invade `prr-conductor` Axe 4 e skill `supabase-ci-cd`. | Criar `dr-readiness-auditor` reescopado ao núcleo DR (RTO/RPO + restore-drill PITR), cross-ref PRR Axe 4. Pack **supabase** (PITR é Supabase-específico). |
| **P2** | Estático→dinâmico | Patterns Tournament/Generate-Filter ensinados mas sem exemplar real embarcado — usuário nunca vê em ação. | Embarcar 1 exemplar Generate-And-Filter ou Tournament (ex.: priorização de backlog) como workflow de referência. |

---

## Novos agentes sugeridos (verificados)

Apenas os que sobreviveram à verificação (veredito keep/refine). 4 caíram para merge e 8 para drop (ver seção seguinte).

| Nome | Pack | costTier | Propósito | Por que vale |
|---|---|---|---|---|
| **billing-implementer** `keep` | supabase | pesado | Materializa billing multi-tenant Supabase+Stripe: subscriptions/plans/entitlements+RLS, webhook idempotente (HMAC+dedup), entitlement gate via RBAC, dunning via pgmq. | Nenhum agent/skill/command de billing no repo; Stripe só como exemplo de adapter. Elo faltante onboarding→RBAC→invite→CRM→**billing**; molde exato é `crm-pipeline-implementer`. Monetiza todo o B2B SaaS. |
| **supabase-rag-implementer** `keep` | supabase | medio | Migration vector(N)+HNSW, RPC `match_documents` (security invoker + RLS por tenant), Edge Function de embedding server-side, chunking 200-500 tokens. | RAG é o único domínio rico em skill SEM par implementer (mfa/rbac/storage/realtime/oauth todos têm). `storage-implementer` é o molde. Non-trivial: dim, security invoker, RLS anti-vazamento, embedding server-side. |
| **llm-eval-harness-writer** `keep` | legacy | pesado | Golden dataset + rubrica + runner LLM-as-judge (temp=0/seed) + score agregado + gate CI; mede qualidade vs critério e detecta regressão entre versões de prompt. | Os 3 vizinhos AI são ortogonais (characterization=snapshot, mutation=pontos cegos, llm-as-dependency=adapter). Arquétipo writer canônico; pack legacy já abriga a trinca AI. |
| **frontend-e2e-tester** `refine` | supabase | medio | Specs Playwright para jornadas B2B multi-tenant (login, invite-flow, org-switch, RBAC gate) reusando fixtures sanitizados. Handoff downstream dos implementers, espelhando `supabase-edge-fn-tester`. | Maior buraco do kit: UI B2B inteira materializada, zero testes de jornada. Precedente exato (writer não gera tests; handoff downstream). Refine: pack supabase (não ui), focar Playwright (não RTL), criar skill âncora. |
| **app-security-auditor** `refine` | observability | medio | SECURITY-AUDIT.md scored P0/P1/P2: SSRF/injection em handlers/Edge Functions com fetch, input validation, OWASP Top 10. Secret-scan/CVE como sinais auxiliares. | Toda "segurança" atual é RLS/auth ou races DDIA; zero app-layer. Padrão audit scored já canônico. Refine: pack observability (stack-agnostic), reescopar ao núcleo SSRF/injection/input/OWASP. |
| **supabase-query-performance-tuner** `refine` | supabase | medio | EXPLAIN (ANALYZE, BUFFERS) + `get_advisors(performance)`, PERF-AUDIT.md scored + migration de indexes pronta. | Kit tem auditor de isolamento e hot-tenant mas zero tuning acionável; skill é knowledge-only. MCP Supabase expõe `execute_sql`+`get_advisors` nativos. Refine: delegar checks VOLATILE/partial-index ao isolation-auditor. |
| **api-contract-designer** `refine` | supabase | medio | Gera/audita contrato OpenAPI unificado das Edge Functions HTTP (API surface hoje invisível): rotas, schemas, status codes. | Só a geração de OpenAPI é inédita. Refine: cortar versionamento (já é `evolucao-schema-compativel`) e webhooks (já em `evolution-go`/`streams-eventos-cdc`/`supabase-auth-hooks`). |
| **dr-readiness-auditor** `refine` | supabase | medio | DR-READINESS.md scored com RTO/RPO declarado-vs-testado + checklist restore-drill PITR Supabase; cross-ref PRR Axe 4. | Pack observability cobre postmortem/PRR/release mas nada de backup/DR; gap crítico de SRE. Refine: cortar from-scratch e backup (já cobertos), focar núcleo DR; pack supabase (PITR é Supabase-específico). |

---

## Ideias descartadas na verificação (drop/merge)

Transparência anti-duplicata — por que cada uma não vira agent novo.

- **ui-a11y-auditor** `merge` → `ui-critica-auditoria` + `ui-anti-padroes-ia` + `ui-auditor`. Premissa "a11y só sub-bullet" é falsa: D1 Accessibility já é scored (contrast/aria/keyboard/focus/semantic/skip-link) + D4 touch 44px. Aprofundar WCAG 2.2/axe-core como deepening de D1, não agent paralelo competindo pelo `/revisar-ui`.
- **rag-eval-conductor** `refine→merge na proposta`. Reescopado para avaliador de output LLM stack-agnostic (= `llm-eval-harness-writer`), saindo de cost-workflow para legacy; a parte de retrieval-metrics pgvector fica como concern Supabase-específico, não empacotada no mesmo agent.
- **supabase-backfill-writer** `merge` → skill `evolucao-schema-compativel`. Claim "ninguém escreve o backfill" é falso: a skill (L67-106) já entrega script idempotente (ctid batches, limit 10000, pg_sleep, verify); `validador-evolucao-schema` emite backfill+guard; `migration-writer` materializa. Sliver fino demais para agent standalone.
- **kit-overlap-linter** `drop` → `scripts/audit-skill-triggers.mjs`. Já tokeniza descrições e computa Jaccard pairwise (o check ">60% tokens"). Frontmatter via `check-resource-frontmatter.mjs`; drift via testes registry/manifest. Kit-meta tooling pertence a scripts+test, não a agent.
- **kit-consistency-linter** `drop` → `check-resource-frontmatter.mjs` + `update-readme-counts.js` + `mcp-version.test.js`. Premissa "só um teste de bloco morto" é falsa (~90 unit tests). Único gap real (cross-links `.md`) é script puro, não agent — linting determinístico viola o DNA (agents fazem julgamento; gates são scripts).
- **pack-cohesion-linter** `drop` → `regen-pack-registry.js --check` + `test/unit/packs.test.js`. Os 3 achados (drift/órfãos/coupling) já são gates determinísticos. Agent LLM seria pior: lento, custa tokens, não-reproduzível.
- **rbac-architect** `drop` → `supabase-rbac-implementer` (+ `b2b-saas-architect` a montante). O implementer NÃO é só materializador: Step 2 escolhe custom-claim vs alternativas, Verdict recomenda combinar matrix+claim, cobre authorize()/anti-escalation. A ambiguidade entre as 2 skills já está resolvida via tabela comparativa v1.25 cross-referenciada — problema de doc.
- **release-conductor** `drop` → `commit-pr-conductor`. Já é o conductor canônico de commit+PR+cross-link; `/publicar` e `/publicar-rapido` delegam via Task, `/branch-pr` encadeia antes. Seria wrapper fino + 4º lugar a manter ordem de cross-link já duplicada. Pressupõe pack `git-release` inexistente.
- **workflow-fit-scout** `drop`. Premissa "1 workflow embarcado = gap" é falsa: é stance deliberada (kit cresce pela capacidade de gerar workflows locais). Scout que prioriza commands do kit p/ embarcar conflita com o DNA; commands são dispatchers finos. Se houver nugget: hint opcional no Layer 0 do generator sobre commands DO USUÁRIO.
- **workflow-linter** `merge` → estender Layer 3.5 do `workflow-generator`. Gap real (os 5 pitfalls semânticos de SKILL.md:312-322 não são pegos), mas são heurísticas AST/grep — extensão do mesmo bloco Bash que já tem loop generate→validate→retry. Agent standalone quebraria o loop self-contained (75º agent num pack de 1).

---

## Quick wins (top 5: menor esforço / maior retorno)

1. **Sincronizar `kit/framework/VERSION` → 1.42.0** (e packs/registry). Uma linha; hoje `check-update.js` dá diagnóstico errado a todo usuário. Verificado: VERSION=1.30.0 vs package.json=1.42.0.
2. **Corrigir README:288 (74 → 75 agents).** Edit de 1 char; remove contradição com a própria linha 13.
3. **Corrigir os ~24 cross-links relativos quebrados** (3 padrões mecânicos: `../kit/`→`../`, `../../../../kit/skills/`→`../skills/`, skill→skill `../skills/X`→`../X`). Sed dirigido + teste CI que resolve links `.md`.
4. **Reescrever as 4+ descrições truncadas** para frases completas ≤200 bytes (cortar "(pesado)" redundante com `cost_tier`). Pega o sintoma; a causa (schema de validação) é o item seguinte.
5. **Adicionar `recommends:["observability","legacy"]` ao `pack.json` do supabase.** Edit de metadata; faz o instalador sugerir os packs companheiros cujas skills o supabase já linka — fecha os `../skills/X` órfãos sem mover código.

---

## Notas de método

- **Fontes:** introspecção via MCP `kit` (global, install npm) cruzada com o repositório `kit/` da branch `feat/v1.41-runtime-cost-packs` (HEAD 86bc2ef, v1.42.0). 5 dimensões auditadas: lacunas-cobertura, sobreposição-redundância, qualidade-consistência, coesão-packs, estático→dinâmico. 19 ideias de agent passaram por verificação adversarial (duplicata? valioso? não-trivial? cabe na filosofia? pack certo?).
- **Lag global × repo:** o MCP global atrasa ≈1 release. Inventário do MCP reportou 73 agents; o repo tem **75 arquivos** (`ls kit/agents/*.md` = 75, verificado), incluindo `commit-pr-conductor` (v1.42.0, commit 4657487). O header da própria tool MCP anuncia "74 agents", inconsistente com seu próprio `list-agents`. **Regra aplicada: repo = fonte de verdade.**
- **Gaps de mapeamento pack↔repo:** soma dos `pack.json` dá 92 commands e 98 skills, mas o repo tem 94 e 100 — indicando ~2 commands e ~2 skills presentes em `kit/` porém ausentes das listas `resources.*` de qualquer pack.json (gap de registro, não de arquivo).
- **Refutações registradas (anti-viés):** dois achados iniciais foram parcialmente refutados na verificação e rebaixados — "a11y é só sub-bullet" (D1 de `ui-critica-auditoria` já é scored) e "ninguém escreve backfill" (skill `evolucao-schema-compativel` já entrega o script). Mantidos no relatório como deepening/merge, não como gaps.
- **Filosofia de gates:** consistentemente, checagem determinística (frontmatter, contagens, links, drift) foi roteada para `scripts/*.mjs` + `test/unit/`, não para agents — alinhado ao DNA do kit (agents fazem julgamento; CI faz verificação reproduzível). Por isso 5 das ideias de "linter como agent" caíram.
