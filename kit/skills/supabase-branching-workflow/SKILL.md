---
name: supabase-branching-workflow
cost_tier: leve
description: Use ao adotar Supabase Branching — preview vs persistent branches, deploy DAG 7 steps (clone→migrate→deploy), GitHub integration com required check, custo Branching Compute Hours e
---

# Supabase — Branching Workflow

## Quando usar

Supabase Branching cria cópias **isoladas** do projeto Postgres + Edge Functions + Storage config para cada branch git — workflow tipo Vercel preview deployments, mas com schema/migrations versionados.

Trigger phrases:

- "preview branch Supabase", "persistent branch staging"
- "deploy DAG Supabase", "branching workflow"
- "GitHub integration Supabase", "automatic branching"
- "Dashboard branching alpha"
- "Branching Compute Hours custo", "custo branching Supabase"
- "preview ephemeral vs long-lived"
- "PR-driven Supabase workflow"

**Use Supabase Branching APENAS para:**

- Validar migrations + schema declarativo em PR antes do merge
- Isolar mudanças destrutivas (DROP COLUMN, ALTER TYPE) em preview
- QA team rodar smoke tests em staging persistente
- Validar deploy de Edge Functions com `[remotes]` block em `config.toml`

**NÃO use Supabase Branching para:**

- QA com dados reais de produção — branches são **dataless by design** (seed.sql é dados sintéticos)
- Replicar production traffic — preview branches têm compute Micro por default (não dimensionado para load)
- Substituir staging Supabase project separado quando precisar SLA/uptime
- Test environments sem expirar — preview branches são **ephemeral** (auto-delete em PR merge/close)

## Princípio canônico

**Preview branches:** ephemeral, criados em PR open, auto-pause em inatividade, **auto-delete em PR merge/close**.

**Persistent branches:** long-lived (staging/QA), NÃO auto-pause, requerem delete **manual** via Dashboard ou CLI.

Critério de escolha canônico:

- PR-driven dev workflow + features curtas (< 1 semana) → **preview**
- Staging compartilhada + features longas + manual control → **persistent**
- Mix possível: 1 persistent staging compartilhado + N ephemeral previews por PR

## ALERTA DE CUSTO — Branching Compute Hours

> **ATENÇÃO CANÔNICA — leia antes de habilitar branching em produção.**
>
> Cada branch Supabase (preview ou persistent) consome **Branching Compute Hours** independentes do projeto principal.
>
> - **Micro Compute size starts at $0.01344/h** (cobrança por hora de branch ativo)
> - **Branching Compute Hours FORA do Spend Cap** — Spend Cap do projeto NÃO protege contra este custo
> - **Compute Credits NÃO aplicam** a Branching Compute (FAQ pricing oficial)
> - **Billing aparece como "Branching Compute Hours"** no invoice (linha separada)
>
> ### Estimativa concreta
>
> - **10 PRs/mês × 24h média de vida útil** = 240h × $0.01344 = **~$3.23/mês adicional**
> - **30 PRs/mês × 72h média (PRs grandes)** = 2160h × $0.01344 = **~$29.03/mês adicional**
> - **Persistent staging branch 24/7** = 720h × $0.01344 = **~$9.67/mês adicional** (acumula continuamente)
>
> ### Atenção
>
> - Persistent branches **acumulam horas continuamente** (não pausam) — custo previsível por mês
> - Preview branches **auto-pausam** em inatividade — custo varia com atividade do PR
> - Branch creation pode levar até **30 minutos** (health check) — primeira hora já é cobrada
>
> ### Mitigações canônicas
>
> - Habilitar **"Supabase changes only" filter** (Pattern 3) — preview branch SÓ para PRs que tocam `supabase/`
> - Considerar **1 persistent staging** compartilhado em vez de N preview branches
> - Monitorar billing manualmente — **Spend Cap NÃO protege**, reforço

## Pattern 1: Preview vs Persistent Branches

Distinção operacional canônica (BRANCH-01):

| | Preview Branch | Persistent Branch |
|---|---|---|
| Ciclo de vida | Ephemeral (criado em PR open) | Long-lived (criado manualmente) |
| Auto-pause | Sim (inatividade) | NÃO |
| Auto-delete | Sim (PR merge/close) | NÃO (delete manual via Dashboard/CLI) |
| Caso de uso | PR-driven dev workflow | Staging/QA compartilhada |
| Custo (Branching Compute Hours) | Acumula durante PR vida útil | Acumula continuamente 24/7 |
| Trigger | GitHub PR webhook (automatic) | CLI ou Dashboard (manual) |
| Naming | Auto: `pr-<N>-<branch-name>` | User-defined (ex: `staging`, `qa`) |
| Health check inicial | Até 30 minutos | Até 30 minutos |

### Critério de escolha

**Use preview SE:**

- Equipe usa PR workflow disciplinado (features curtas, < 1 semana de PR aberto)
- Cada PR deve ter ambiente isolado para review
- Aceita custo proporcional a número de PRs ativos

**Use persistent SE:**

- Precisa staging compartilhado para QA team validar release
- Features longas (sprints multi-semana com PR aberto continuamente)
- Manual control sobre lifecycle (não querer auto-delete)

**Pode haver MIX (recomendação canônica para times maduros):**

- 1 persistent branch `staging` para QA team rodar smoke tests pós-merge para `main`
- N preview branches ephemeral, 1 por PR ativo, para review de mudanças

### CLI canônico

```bash
# criar persistent branch via CLI
supabase --experimental branches create staging --persistent

# listar branches do projeto
supabase --experimental branches list

# inspecionar branch específico
supabase --experimental branches get staging

# deletar branch
supabase --experimental branches delete staging

# atualizar persistent branch para latest main
supabase --experimental branches update staging
```

### Caveat — Health check pode levar 30 minutos

Branch creation aplica DAG (Pattern 2) — health check do Postgres pode demorar **até 30 minutos** dependendo de:

- Tamanho do schema migrado
- Número de migrations
- Tamanho do seed.sql

Durante este tempo, a primeira **hora de Branching Compute** já é cobrada (Pattern 5 — custo arrendondado a hora cheia inicial).

## Pattern 2: Deploy DAG — 7 steps canônicos

Cada branch (preview ou persistent) aplica um **DAG (Directed Acyclic Graph)** de 7 steps em ordem (BRANCH-02):

1. **clone** — clone do repositório git no contexto do branch Supabase
2. **pull** — pull das migrations (`supabase/migrations/`) e schema declarativo (`supabase/schemas/`)
3. **health** — health check do branch DB (espera até 30 min — Postgres ready + connection pooler ativo)
4. **configure** — aplica `config.toml` (incluindo `[remotes.<branch>]` block — cross-ref skill `supabase-config-toml-remotes` v1.27)
5. **migrate** — executa migrations em ordem cronológica (`supabase/migrations/*.sql`)
6. **seed** — aplica `supabase/seed.sql` (dataless by design — sem dados de produção)
7. **deploy** — deploy de Edge Functions e secrets (via `supabase functions deploy`)

### Diagrama ASCII

```
clone → pull → health → configure → migrate → seed → deploy
  ✓      ✓       ✓         ✓          ✓         ✓        ✓
                                       ↓ falha
                                    [seed: SKIPPED]
                                    [deploy: SKIPPED]
```

### Skip behavior canônico (anti-cascading failure)

**Falha em step N → todos steps N+1...7 são SKIPPED.**

Exemplo concreto:

- **migrate falha no step 5** (ex: migration com `DROP COLUMN` em coluna que tem FK)
- **seed (step 6) é SKIPPED** — sem aplicar seed.sql
- **deploy (step 7) é SKIPPED** — sem deploy de Edge Functions
- DAG status no Dashboard mostra: ✗ migrate (step 5), ⊘ seed (skipped), ⊘ deploy (skipped)

Este comportamento previne **cascading failures** — se schema falha, não aplicar Edge Functions que dependem do schema.

### Logs por step

Cada step tem stdout/stderr **próprio** acessível no Dashboard:

- **Settings → Integrations → GitHub → "View deployment logs"** (link no PR comment)
- Logs persistidos durante vida útil do branch
- Útil para debug: step 5 (migrate) tem stderr com SQL error específico

### Recovery pattern

**Sem rollback automático** — branch fica em estado "failed".

Para recovery:

1. Push **novo commit** no PR com migration corrigida
2. GitHub webhook → re-run DAG (steps 1-7 do zero)
3. Se step 5 (migrate) passa → step 6 (seed) e step 7 (deploy) executam

Se migration drift entre branches → ver skill `supabase-migration-repair` (v1.27, Phase 153) para `migration list/repair`.

### Caveat — Dataless by design

`seed.sql` aplicado no step 6 NÃO deve conter:

- Dados sensíveis de produção (PII, tokens, secrets)
- Snapshot real de tabelas grandes
- Dados com FKs para tabelas Auth (`auth.users`) — preview branches têm Auth schema separado

**Recomendação canônica:** seed.sql contém apenas:

- Dados de referência (ex: lista de países, categorias estáticas)
- Fixtures sintéticos pequenos para smoke tests
- Setup de roles + permissions iniciais (cross-ref skill `supabase-postgres-roles` v1.26)

Preview branches são para **dev workflow**, não para QA com dados reais — se precisar dados reais, use staging Supabase project separado.

## Pattern 3: GitHub Integration Setup

Setup canônico para preview branching automatizado via GitHub (BRANCH-03):

### Step 1: Authorize Supabase no GitHub

1. Dashboard → **Project Settings → Integrations → GitHub**
2. Clicar **"Authorize Supabase"** — OAuth flow do GitHub
3. Selecionar **organization** + **repos específicos** (princípio do least privilege — não autorizar todos os repos)

### Step 2: Working directory

Definir diretório raiz do projeto Supabase no repositório:

- **Monorepo single Supabase project:** `./`
- **Monorepo com Supabase em subdiretório:** `./supabase` ou `./apps/api/supabase`
- **Default:** `./` (raiz do repo)

Working directory deve conter `supabase/migrations/`, `supabase/schemas/`, `supabase/config.toml`.

### Step 3: Automatic branching toggle

- **ON (recomendado):** preview branch criado **automaticamente** quando PR é aberto
- **OFF:** branches criados apenas manualmente via CLI ou Dashboard

Recomendação: **ON** para workflow PR-driven canônico.

### Step 4: "Supabase changes only" filter

**Recomendação canônica para reduzir custo Branching Compute Hours:**

- **ON:** preview branch criado **APENAS** se o PR toca arquivos em `supabase/` (migrations, schemas, functions, config.toml)
- **OFF:** preview branch criado em **TODOS** os PRs (alto custo se time abre muitos PRs frontend-only)

Recomendação: **ON** em todos projetos com Spend Cap awareness (cross-ref Pattern 5).

### Step 5: Deploy to production toggle

- **ON:** quando PR é merged para `main`, mudanças são automaticamente push para production project Supabase
- **OFF:** merge não trigger deploy production (deploy manual via CLI ou outro workflow CI)

**Use com CAUTELA** — exige:

- Migrations bem testadas em preview branch
- Required check "Supabase Preview" gating merge (sem ✓ verde, sem merge)
- Política de rollback documentada (cross-ref skill `supabase-migration-repair` v1.27)

Recomendação inicial: **OFF** até equipe estabelecer disciplina de PR review.

### Workflow esperado após setup

```
Dev abre PR
  ↓
GitHub webhook → Supabase cria preview branch
  ↓
Deploy DAG roda (7 steps canônicos)
  ↓
Required check "Supabase Preview" reportado no PR
  ↓
Dev valida em preview (smoke tests, manual QA)
  ↓
Merge para main (se check ✓ verde)
  ↓
(se "deploy to production" ON) → push para production project Supabase
  ↓
Preview branch auto-delete (em PR merge ou close)
```

### Required check enforcement

GitHub branch protection rules:

1. Settings → Branches → Add rule para `main`
2. **Require status checks to pass before merging** — selecionar **"Supabase Preview"** como required
3. **Sem check ✓ verde → bloqueia merge** (gate canônico — DAG falha = merge bloqueado)

### Recomendação canônica

**Use GitHub integration em qualquer projeto sério.** Dashboard branching alpha (Pattern 4) tem limitações documentadas que tornam unsuitable para production workflow.

## Pattern 4: Dashboard Branching Alpha — Caveats canônicos

**Dashboard branching está em ALPHA — desencorajado para projetos sério. Use GitHub integration (Pattern 3).**

Caveats canônicos documentados (BRANCH-04):

### Caveat 1: Custom roles NÃO capturados

Branches criados via Dashboard alpha **NÃO capturam Postgres custom roles** definidos no DB principal.

- **Roles definidos em migrations** (`CREATE ROLE` em arquivo `.sql`) → aplicados pelo DAG step 5 (migrate) → presentes no branch
- **Roles criados via Dashboard SQL editor** ou diretamente no DB → **perdidos** no branch creation

Cross-ref skill `supabase-postgres-roles` v1.26: roles **DEVEM** ser definidos em migrations versionadas, nunca via Dashboard ad-hoc.

### Caveat 2: Merge só para `main`

Dashboard alpha aceita **merge só para `main`** — não suporta merge entre preview branches.

- Direção suportada: `preview → main` (1 sentido apenas)
- **NÃO suportado:** `preview-A → preview-B`, ou seja, não combinar 2 features em desenvolvimento via Dashboard

**Workaround:** combinar features via git workflow:

```
git checkout feature-B
git rebase feature-A    # ou git merge feature-A
git push --force-with-lease
# PR-B atualizado contém commits de A + B
```

### Caveat 3: Edge Functions sobrescritas no "update branch"

Clicar **"Update branch"** no Dashboard sobrescreve **TODAS** as Edge Functions no preview branch com versão atual de `main`.

- **Perda silenciosa** — sem confirmation prompt
- Mudanças in-flight em Edge Functions no preview são **perdidas**
- Deploy de edge functions via Dashboard alpha é **high-risk**

**Mitigação:** sempre commit Edge Functions em git antes de clicar "Update branch".

### Caveat 4: Delete de functions MANUAL em main

Se você **deleta** uma Edge Function em preview branch, no merge para `main` a deletion **NÃO é propagada automaticamente**.

- Edge Function continua existindo em produção mesmo após merge
- Você deve **manualmente** executar `supabase functions delete <name>` em main após merge

Cross-ref: GitHub integration (Pattern 3) propaga deletion via git diff — comportamento esperado em production workflow.

### Recomendação canônica explícita

- Para qualquer projeto em produção: **GitHub integration** (Pattern 3)
- Dashboard alpha aceitável APENAS para:
  - Experimentação solo (1 dev, sem time)
  - Prototipagem rápida (sem intenção de production)
  - Projetos sem migration history estável

### Tabela comparativa Dashboard alpha vs GitHub integration

| | Dashboard alpha | GitHub integration |
|---|---|---|
| Custom roles capturados | NÃO | SIM (via migrations) |
| Merge entre previews | NÃO | SIM (git workflow) |
| Edge functions safety | Sobrescreve silenciosamente | Versioned via git |
| Delete propagation | Manual em main | Automatic via merge |
| Required check enforcement | NÃO | SIM (branch protection rules) |
| Audit trail | Limited Dashboard logs | Full git history |
| Maturity | Alpha | Estável (recomendação canônica) |
| Recomendação | Experimentação solo | Produção |

## Pattern 5: Custo Branching Compute Hours

Branching tem custo **independente** do projeto principal — atenção canônica para evitar surpresas no invoice (BRANCH-05).

### Pricing oficial

- **Micro Compute size** (default para preview branches): **$0.01344/h**
- **Maior compute sizes** disponíveis para persistent branches via `supabase branches update --size <size>`
- Cobrança **por hora** (arredonda para hora cheia mesmo em branches curtos)

### Spend Cap canônico — caveat crítico

> **Branching Compute Hours são FORA do Spend Cap do projeto.**
>
> Mesmo com Spend Cap configurado em $0 (Pro plan), Branching Compute Hours **continuam sendo cobradas**.

Implicação: equipe que adota branching sem revisar billing pode receber invoice surpresa de $50-200/mês adicional em projetos com muitos PRs.

### Compute Credits NÃO aplicam

- Pro plan vem com **$10/mês de Compute Credits** que cobrem instance do projeto principal
- **Compute Credits NÃO aplicam a Branching Compute Hours** (FAQ pricing oficial)
- Cada hora de branch é cobrada **adicionalmente** ao plan base

### Linha de billing canônica

No invoice mensal Supabase, Branching Compute aparece como linha separada:

```
Pro Plan                              $25.00/mês
Compute (Project Main)                  $0.00 (covered by Compute Credits)
Branching Compute Hours        240h × $0.01344 = $3.23/mês
Database egress                        $0.00 (under threshold)
                                      -------
Total                                  $28.23/mês
```

### Mitigações canônicas

1. **"Supabase changes only" filter ON** (Pattern 3) — preview branch só para PRs com mudanças em `supabase/`
2. **1 persistent staging** compartilhado em vez de N preview branches (custo previsível)
3. **PR lifetime curto** — disciplina de team merge em < 1 semana reduz horas acumuladas
4. **Monitorar billing manualmente** — Spend Cap NÃO protege contra Branching Compute
5. **Documentar custo esperado** no onboarding do projeto — equipe sabe o trade-off

### Cálculo de capacity planning

Fórmula canônica:

```
Custo Branching Compute/mês = (N_PRs_ativos × duracao_media_horas × compute_size_hourly_rate)

Exemplo:
  20 PRs/mês × 48h média × $0.01344/h = $12.90/mês adicional
```

Para persistent branches:

```
Custo persistent branch/mês = (24h × 30 dias × compute_size_hourly_rate)

Exemplo (Micro 24/7):
  720h × $0.01344/h = $9.67/mês por branch persistent
```

## Anti-patterns

### Anti-pattern 1: Usar Dashboard branching alpha para projeto sério

**Errado:** Time de 5+ devs gerencia branches via Dashboard alpha em projeto production.

**Por quê:** custom roles não capturados + edge functions sobrescritas silenciosamente + merge só p/ main = surprise bugs em produção; sem audit trail confiável; sem required check enforcement.

**Certo:** GitHub integration (Pattern 3) — versionado, audit trail completo via git, branch protection rules enforced, deploy DAG transparente com logs por step.

### Anti-pattern 2: Ignorar Spend Cap caveat

**Errado:** Habilitar branching assumindo Spend Cap protege contra cost overrun.

**Por quê:** Branching Compute Hours são **FORA do Spend Cap** — projeto Pro plan com 30 PRs/mês de 72h média pode gerar **$29-100/mês adicional sem alert algum**. Compute Credits NÃO aplicam — cada hora é cobrança nova.

**Certo:**

- monitorar billing manualmente (Settings → Usage → Branching Compute Hours)
- "Supabase changes only" filter ON (Pattern 3 step 4)
- considerar persistent branch único compartilhado em vez de 1 preview/PR
- documentar custo no onboarding do time

### Anti-pattern 3: Tentar merge entre preview branches

**Errado:** Time tenta `preview-feature-A → preview-feature-B` via Dashboard branching.

**Por quê:** Dashboard NÃO suporta merge entre preview branches — só direção `preview → main`. Tentativa resulta em state inconsistente, schemas dessincronizados, ou silent no-op.

**Certo:** combinar features via git workflow:

```
# PR-A merges to main primeiro
git checkout main
git pull

# PR-B rebase on top
git checkout feature-B
git rebase main
git push --force-with-lease

# preview-B é recriado com mudanças de A + B
# merge to main
```

### Anti-pattern 4: Push direto na main sem preview branch

**Errado:** Dev pusha migration direto em `main` sem PR/preview branch — "vai dar certo, é só um ALTER TABLE".

**Por quê:** sem validação de DAG → migration falha em production → downtime + rollback complexo + possíveis dados perdidos. Especialmente perigoso para `DROP COLUMN`, `ALTER TYPE`, mudanças destrutivas.

**Certo:** SEMPRE PR + preview branch validado:

1. Migration em PR aberto
2. Preview branch DAG executa (step 5 migrate validado)
3. Required check "Supabase Preview" ✓ verde
4. Merge gated por required check + branch protection rule
5. (Se "deploy to production" ON) → automatic push para production

Cross-ref skill `evolucao-schema-compativel` (v1.22) — 3-step migration safe para mudanças destrutivas.

### Anti-pattern 5: Esperar persistent branch funcionar como production

**Errado:** Assumir persistent staging branch é "cópia de produção" para QA team.

**Por quê:** branches são **dataless by design** — `seed.sql` é dados sintéticos, não snapshot real. Auth.users separado, sem dados de prod, sem volume real, sem latência real.

**Certo:**

- persistent branches são para **schema/code validation**, NÃO para QA com dados reais
- Se precisar QA com dados reais → use staging Supabase project **separado** (não branching)
- Staging project separado tem SLA, dados reais via replicação, custo previsível Pro plan

### Anti-pattern 6: Criar persistent branch sem cleanup policy

**Errado:** Criar persistent branches ad-hoc sem documentar lifecycle ou owner.

**Por quê:** persistent branches não auto-pausam — acumulam Branching Compute Hours **24/7 indefinidamente**. 6 meses depois, ninguém sabe pra que serve o branch `qa-test-old`, mas continua sendo cobrado $9.67/mês × 6 = **$58 desperdiçados**.

**Certo:**

- documentar persistent branches em README ou onboarding doc
- definir owner por branch (Slack handle + função)
- review trimestral: `supabase --experimental branches list` + cleanup
- comment no Dashboard descrevendo propósito + data de criação

## Cross-suite integration (v1.27)

Esta skill é base para skills v1.27 (Phases 150-153):

- **supabase-config-toml-remotes** (Phase 150) — `[remotes]` block + branch-specific config + secrets per-branch
- **supabase-ci-cd-github-actions** (Phase 151) — 8 workflows canônicos GitHub Actions (preview deploy, prod deploy, migration gates)
- **supabase-pgtap-testing** (Phase 152) — testes pgTAP que rodam no DAG step 5/6
- **supabase-migration-repair** (Phase 153) — `migration list/repair` + rollback preview branch quando step migrate falha

Base para agents v1.27 (Phase 154):

- **supabase-branching-architect** — projeta strategy (preview-only vs preview + persistent staging mix)
- **supabase-cicd-pipeline-implementer** — materializa GitHub Actions workflows + Supabase integration config

Pattern de handoff cooperativo herdado v1.23-v1.26: **architect** projeta → **cicd-pipeline-implementer** materializa → **release-pipeline-auditor** (v1.10) audita hermeticidade do pipeline final. Nenhum agente descarta upstream — handoff cooperativo SQL (princípio canônico v1.23).

## Ver também

- [supabase-config-toml-remotes](../supabase-config-toml-remotes/SKILL.md) (v1.27, Phase 150) — `[remotes]` block + branch-specific config + secrets per-branch
- [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — 8 workflows canônicos GitHub Actions
- [supabase-pgtap-testing](../supabase-pgtap-testing/SKILL.md) (v1.27, Phase 152) — testes pgTAP integrados no DAG
- [supabase-migration-repair](../supabase-migration-repair/SKILL.md) (v1.27, Phase 153) — `migration list/repair` + rollback preview branch
- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — 5 blocos obrigatórios CREATE TABLE, naming canônico
- [supabase-declarative-schema](../supabase-declarative-schema/SKILL.md) — schema declarative workflow (`supabase/schemas/`)
- [evolucao-schema-compativel](../evolucao-schema-compativel/SKILL.md) (v1.22) — 3-step migration safe rolling upgrade (expand → migrate data → contract)
- [release-engineering](../release-engineering/SKILL.md) — deployment philosophy + self-service deploys
- [hermetic-builds](../hermetic-builds/SKILL.md) — pipeline reproducibility + isolation + provenance
- [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — caveat custom roles NÃO capturados em Dashboard alpha (Pattern 4 Caveat 1)
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions deploy no DAG step 7
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos branching workflow, preview branch, persistent branch, deploy DAG, Branching Compute Hours (será +10 termos em REL-04 v1.27)
- Doc oficial: [Supabase Branching](https://supabase.com/docs/guides/deployment/branching), [GitHub Integration](https://supabase.com/docs/guides/deployment/branching#github-integration), [Pricing](https://supabase.com/pricing)
