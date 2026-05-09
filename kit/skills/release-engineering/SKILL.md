---
name: release-engineering
description: Use ao desenhar/auditar pipeline de release — deployment philosophy, self-service, policy enforcement, canary, rollback, branching strategy, release invariants. Cap 8 livro Google SRE.
---

# SRE — Release Engineering

## Quando usar

LLM carrega esta skill ao desenhar pipeline de deploy ou ao investigar release fragility. Trigger phrases:

- "release pipeline", "deploy pipeline"
- "canary release", "rollback"
- "branching strategy", "trunk-based development"
- "deployment philosophy"
- "policy enforcement"
- "release engineering"
- "cap 8 Google SRE"

## Regras absolutas

- **Release engineering é DISCIPLINA SEPARADA.** Cuida de "código no merge → bits em prod". Não é dev (que produz código), não é SRE clássico (que opera prod). É a ponte.
- **4 invariantes canônicos (cap 8):**
  1. **Self-service:** engineers deployam sozinhos via CLI/UI (sem aprovação manual SRE)
  2. **High velocity:** deploy ≥ 1×/dia (ideal: cada merge)
  3. **Hermetic builds:** input idêntico → output idêntico
  4. **Policy enforcement:** policies em ferramenta, não em humano
- **Trunk-based development > GitFlow.** Main sempre deployable. Feature flags para work in progress. Branches longos = harder rollback + merge hell.
- **Canary release OBRIGATÓRIO em prod.** 1% → 10% → 50% → 100% com SLO check em cada estágio. Bug detectado em 1% afeta < 1% dos users.
- **Rollback < 5 min, exercitado.** Schema migrations sempre forward-compatible OR reversible. Artefato N-1 preservado.
- **Config separada de código (12-factor).** Config versionada, audit-able, GitOps. ConfigMaps, env vars, feature flags. NUNCA hardcoded em image.
- **Continuous build + test + deploy.** Cada commit dispara pipeline. Deploy contínuo (push tag → prod) preferred a continuous delivery (deploy disponível mas manual).
- **Release pipeline tem audit trail.** Quem deployou, quando, qual commit, qual artefato. Auto-gerado via CI logs + tags + GitHub Releases.

## Patterns canônicos

### Pattern 1: 4 invariantes canônicos

```text
1. SELF-SERVICE
   ============
   ANTI: engineer abre ticket → SRE aprova → SRE deploya
   CERTO: engineer roda `gh workflow run deploy.yml` → workflow valida policies →
          deploy automático
   Implementação: GitHub Actions / GitLab CI / Argo CD com approval rules.

2. HIGH VELOCITY
   ==============
   Métrica DORA: deployment frequency
     Elite: multiple per day
     High: weekly
     Medium: monthly
     Low: < monthly (problem)
   Implementação: trunk-based + feature flags + small commits + CI fast.

3. HERMETIC BUILDS (skill separada)
   =================================
   Mesmo commit + lockfile → mesmo artefato. SLSA Level 3+.

4. POLICY ENFORCEMENT
   ===================
   Policies em ferramenta, não em humanos:
     - branch protection (no direct push to main)
     - required reviewers (≥ 1 ou ≥ 2 dependendo de criticality)
     - required CI checks (build + test + lint + security scan)
     - signed commits (GPG keys)
     - production deploy só de tagged releases
   Implementação: GitHub branch protection + CODEOWNERS + custom Actions.
```

### Pattern 2: Trunk-based development workflow

```text
Trunk-based (Google + Facebook + Netflix):

main (deployable)
  ├── feat/A (24-48h)  → merge → DELETE branch
  ├── feat/B (24-48h)  → merge → DELETE branch
  └── ...

Pré-requisitos:
  ✓ Feature flags para work in progress (incomplete features hidden)
  ✓ CI rápido (≤ 10min) — feedback fast
  ✓ Tests forte (> 80% coverage; flaky < 1%)
  ✓ Pair programming OU async PR review

vs GitFlow:
  - develop branch (3-7 dias)
  - release branch (1-3 dias)
  - hotfix branch (em incident)
  - main reflete prod
  PROBLEMS: merge hell, slow integration, branch divergence

Quando preferir GitFlow (raramente):
  - Long release cycles obrigatórios (regulamentação healthcare/finance)
  - Customers need múltiplas versões em paralelo (LTS branches)
```

### Pattern 3: Canary release pipeline canônico

```yaml
# GitHub Actions deploy.yml — canary release
name: Deploy

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  canary-1pct:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - run: ./scripts/deploy-canary.sh --percent 1
      - run: sleep 600  # observe por 10 min
      - run: ./scripts/check-slo.sh --window 10m --threshold 99.9
      # Se SLO falhar → workflow falha → human intervention

  canary-10pct:
    needs: canary-1pct
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/deploy-canary.sh --percent 10
      - run: sleep 600
      - run: ./scripts/check-slo.sh --window 10m --threshold 99.9

  canary-50pct:
    needs: canary-10pct
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/deploy-canary.sh --percent 50
      - run: sleep 600
      - run: ./scripts/check-slo.sh --window 10m --threshold 99.9

  full-rollout:
    needs: canary-50pct
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/deploy-full.sh
      - run: sleep 1800  # observe por 30 min
      - run: ./scripts/check-slo.sh --window 30m --threshold 99.9
```

**SLO check em cada stage:** burn rate ≤ baseline × 2 = OK; > 2 = abort + rollback.

### Pattern 4: Rollback canônico

```bash
# PT-BR: rollback workflow
# Pré-requisito: artefato N-1 preservado (image registry, S3, etc.)

# 1. Detectar problema (manual OR auto via SLO burn alert v1.9)
# 2. Identificar versão atual + anterior
CURRENT=$(kubectl get deployment app -o jsonpath='{.spec.template.spec.containers[0].image}')
PREVIOUS=$(./scripts/get-previous-deploy.sh app)

# 3. Rollback (1 comando)
kubectl set image deployment/app app="$PREVIOUS"

# 4. Verificar — SLO burn estabilizou?
./scripts/check-slo.sh --window 5m --threshold 99.9

# 5. Audit trail — registrar em incident
echo "Rollback de $CURRENT para $PREVIOUS at $(date)" >> .planning/incidents/<id>.md

# Target: rollback < 5 min, da decisão à observabilidade estabilizada
```

**Schema migration considerations:**
- ADD column nullable + default → forward-compatible (rollback OK)
- DROP column → NOT-rollback-able (forward-fix required)
- ALTER column NOT NULL com default → reversible se default preservado
- Sempre escrever migration UP + DOWN (mesmo que UP forward-only)

### Pattern 5: Configuration management (12-factor)

```text
12-factor app princípios canônicos:

I.    Codebase — single repo per app
II.   Dependencies — explicit (lockfile)
III.  Config — env vars OR ConfigMap (NÃO hardcoded)
IV.   Backing services — attached resources via env
V.    Build/Release/Run — strict separation
VI.   Processes — stateless
VII.  Port binding — self-contained
VIII. Concurrency — scale via process model
IX.   Disposability — fast startup + graceful shutdown
X.    Dev/prod parity — same code, same DB type, same OS
XI.   Logs — stdout/stderr (não files)
XII.  Admin processes — one-off scripts em mesmo env

Implementação Supabase:
  - Edge Function env vars: Deno.env.get('SUPABASE_URL') etc.
  - Secrets via supabase secrets set
  - Config NÃO commitado (tem .env.example, sem .env)
  - Migrations via supabase/migrations (versionado)
  - Feature flags via env OR Supabase row em config table
```

### Pattern 6: Branch protection + CODEOWNERS

```yaml
# .github/CODEOWNERS
# PT-BR: define quem revisa cada path

# Default — qualquer maintainer
*                                @luanpdd

# Critical paths — exigir aprovação SRE
/supabase/migrations/             @luanpdd @sre-team
/src/auth/                        @luanpdd @security-team
/.github/workflows/               @luanpdd @sre-team
/gates/                           @luanpdd

# UI changes — designer review
/src/components/                  @luanpdd @design-team
```

```text
GitHub branch protection rules para `main`:
  ✓ Require pull request before merging
  ✓ Require approvals: 1 (or 2 for critical)
  ✓ Dismiss stale reviews on push
  ✓ Require review from CODEOWNERS
  ✓ Require status checks: build, test, lint
  ✓ Require branches up to date
  ✓ Require signed commits
  ✓ Restrict who can push: empty (force PR)
  ✗ Allow force push: NEVER
  ✗ Allow deletions: NEVER
```

### Pattern 7: Audit trail canônico

```text
Cada release tem audit trail completo:

1. Commit message (what + why)
2. PR description (context + breaking changes + migrations)
3. PR reviewers (who approved)
4. CI logs (build provenance + test results)
5. Deploy logs (who triggered, when, which artifact)
6. GitHub Release (changelog + tagged commit)
7. Monitoring (SLO/golden signals during/after deploy)

Tools:
  - GitHub Releases — auto-generated changelog
  - Sentry/Datadog — track release_id em events
  - Slack/PagerDuty — notification em deploy
  - SLSA attestation — provenance signed
```

## Anti-patterns

### ANTI: aprovação humana manual em release

```text
ANTI: cada deploy → SRE checa, aprova, deploya manualmente.

PROBLEMA: SRE bottleneck. Deploys raros (1×/semana). Velocity colapsa.
          Toil para SRE.

CERTO: policies em ferramenta. Engineer self-deploys. SRE escreve
       guard rails (canary, SLO check), não aprovações ad-hoc.
```

### ANTI: deploy de branch local

```text
ANTI: dev faz `kubectl apply` da máquina dele.

PROBLEMA: drift entre git e prod. Sem audit trail. Sem CI check.
          Quando precisa rollback, "qual era a versão?".

CERTO: deploy SOMENTE de CI. Local push to prod proibido em
       branch protection. Pipeline valida + deploya + audit.
```

### ANTI: rollback "vai dar conta no forward-fix"

```text
ANTI: cultura "nunca rollback". Sempre forward-fix.

PROBLEMA: forward-fix sob pressão = mais bugs. Rollback nunca
          exercitado, quando precisa não funciona.

CERTO: rollback < 5min em qualquer release, exercitado mensalmente.
       Forward-fix é exception, não default.
```

### ANTI: schema migration NOT NULL sem default

```text
ANTI: ALTER TABLE orders ADD COLUMN priority INTEGER NOT NULL;

PROBLEMA: migration falha em rows existentes. Rollback custoso.
          Code novo + DB velho = error.

CERTO: ADD COLUMN priority INTEGER DEFAULT 0 NOT NULL;
       Forward-compatible (old code ignora; new code usa).
       Rollback de code OK porque DB tem default.
```

### ANTI: feature flag sem expiration

```text
ANTI: flags acumulam, nunca removidas. 50 flags em prod, 30 ativas.

PROBLEMA: cognitive load. Combinations untested. Flag Y desligado
          há 6 meses ainda no código (dead code).

CERTO: flags têm DATA DE EXPIRAÇÃO. Após launch + 30d safe → REMOVE
       flag (e código do branch perdedor). Cleanup é parte da
       feature, não opcional.
```

### ANTI: hotfix direct push em main

```text
ANTI: incident → dev pushar direto em main "pra ser rápido".

PROBLEMA: bypass branch protection. Sem review. Sem CI.
          Pode introduzir novo bug.

CERTO: hotfix ainda via PR (mesmo se rápido — 5min review). CI
       roda. Branch protection ativa. Audit trail preserved.
       "Rápido" não é desculpa pra atalhar safety.
```

## Verificação

1. Self-service deploy ativo (engineers deployam sozinhos)
2. Trunk-based OR justified GitFlow exception
3. Canary release pipeline (1% → 10% → 50% → 100% com SLO check)
4. Rollback testado mensalmente; < 5 min
5. Branch protection em main (no direct push, required PR + CI + reviewers)
6. CODEOWNERS para paths críticos
7. Lockfile commitado + frozen-install em CI
8. Build provenance via SLSA
9. Config 12-factor (env vars, GitOps)
10. Feature flags com expiration policy
11. Audit trail completo (commit + PR + CI + deploy + monitoring)

---

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — vocabulário (release pipeline, canary, rollback, etc.)
- [`hermetic-builds`](../hermetic-builds/SKILL.md) (v1.11) — fundação técnica
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 5 (Change Management)
- [`eliminating-toil`](../eliminating-toil/SKILL.md) (v1.10) — manual deployment é toil clássico
- [`release-pipeline-auditor`](../../agents/release-pipeline-auditor.md) (v1.11) — agent que audita
- [`/auditar-release`](../../commands/auditar-release.md) (v1.11) — comando
- [`/concluir-marco`](../../commands/concluir-marco.md) (framework + patch v1.11) — gate `release-pipeline-policy` opt-in

*Material-fonte: Site Reliability Engineering — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) — Cap 8: "Release Engineering". Plus 12-factor app (12factor.net), DORA metrics.*
