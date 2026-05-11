---
plan_id: 154-01-agents-architect-cicd
phase: 154
wave: 1
depends_on: [149, 150, 151, 152, 153]
autonomous: true
requirements:
  - ARCH-01
  - ARCH-02
  - ARCH-03
  - ARCH-04
  - ARCH-05
  - CICD-01
  - CICD-02
  - CICD-03
  - CICD-04
  - CICD-05
files_modified:
  - kit/agents/supabase-branching-architect.md
  - kit/agents/supabase-cicd-pipeline-implementer.md
estimated_lines: 900
must_haves:
  - "Agent 1: kit/agents/supabase-branching-architect.md — 350-500 linhas"
  - "Agent 1 frontmatter: name + description + version + model=sonnet + tools=Read+Write+Bash+AskUserQuestion+Task"
  - "Agent 1 ARCH-01: AskUserQuestion para GitHub integration vs Dashboard alpha (default GitHub)"
  - "Agent 1 ARCH-02: AskUserQuestion para persistent vs ephemeral mix"
  - "Agent 1 ARCH-03: AskUserQuestion para seed strategy (seed.sql vs custom ORM)"
  - "Agent 1 ARCH-04: AskUserQuestion para secret strategy (CLI direct vs dotenvx)"
  - "Agent 1 ARCH-05: produz BRANCHING-DESIGN.md + cross-suite handoff Task() para supabase-architect"
  - "Agent 1 verdicts GO/STRENGTHEN/REWRITE-com-confirmação"
  - "Agent 2: kit/agents/supabase-cicd-pipeline-implementer.md — 400-600 linhas"
  - "Agent 2 frontmatter: name + description + version + model=sonnet + tools=Read+Write+Edit+Bash+Task+AskUserQuestion"
  - "Agent 2 CICD-01: materializa 7-8 workflows GitHub Actions (.github/workflows/)"
  - "Agent 2 CICD-02: SECRETS-CHECKLIST.md com 6 secrets canônicos"
  - "Agent 2 CICD-03: cross-suite handoff Task() para supabase-migration-writer"
  - "Agent 2 CICD-04: cross-suite handoff Task() para release-pipeline-auditor"
  - "Agent 2 CICD-05: verdicts GO/STRENGTHEN/REWRITE-com-confirmação"
  - "Ambos agents PT-BR (convenção v1.22+)"
  - "Ambos agents seguem pattern canônico v1.26 (supabase-roles-implementer.md como referência)"
---

# Plano 154-01: Agents novos `supabase-branching-architect` + `supabase-cicd-pipeline-implementer`

## Objetivo

Criar 2 agents canônicos novos em `kit/agents/`:

1. **`supabase-branching-architect.md`** — Projeta estratégia branching ANTES do setup técnico. Coleta 4 decisões via AskUserQuestion (ARCH-01..04), produz BRANCHING-DESIGN.md, delega cross-suite para supabase-architect (ARCH-05).

2. **`supabase-cicd-pipeline-implementer.md`** — Recebe BRANCHING-DESIGN.md upstream e materializa 7-8 workflows GitHub Actions canônicos (CICD-01) + SECRETS-CHECKLIST.md (CICD-02). Cross-suite handoff para supabase-migration-writer (CICD-03) e release-pipeline-auditor (CICD-04). Verdicts canônicos v1.23 (CICD-05).

Pattern canônico v1.26 herdado (`supabase-roles-implementer.md` como referência estrutural — 355 linhas, frontmatter YAML + Mission + Inputs + Outputs + Verdicts + Cross-suite + Failure modes + Anti-patterns + Quality gates).

Princípio canônico v1.23 herdado: handoff cooperativo, NÃO descartar upstream. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação preservam intent.

## Contexto upstream

- Material-fonte ARCH-01..05: doc oficial Supabase + skill `supabase-branching-workflow` (Phase 149) + skill `supabase-config-toml-remotes` (Phase 150)
- Material-fonte CICD-01..05: skill `supabase-ci-cd-github-actions` (Phase 151) — 8 workflows canônicos
- Cross-suite targets: `supabase-architect` (v1.8), `supabase-migration-writer` (v1.23), `release-pipeline-auditor` (v1.10)
- Pattern de referência v1.26: `supabase-roles-implementer.md`

## Tasks

<task id="154-01-T1" description="Criar agent supabase-branching-architect.md (ARCH-01..05)">
  <read_first>
    - kit/agents/supabase-roles-implementer.md (pattern v1.26 — 355 linhas, REFERÊNCIA)
    - kit/agents/supabase-architect.md (cross-suite handoff target ARCH-05)
    - kit/skills/supabase-branching-workflow/SKILL.md (base de conhecimento Phase 149)
    - kit/skills/supabase-config-toml-remotes/SKILL.md (base de conhecimento Phase 150)
  </read_first>
  <action>
    Criar arquivo `kit/agents/supabase-branching-architect.md` com:

    **Frontmatter YAML:**
    ```yaml
    ---
    name: supabase-branching-architect
    description: Projeta estratégia branching Supabase ANTES do setup técnico. Coleta 4 decisões canônicas via AskUserQuestion (GitHub integration vs Dashboard alpha [default GitHub], persistent vs ephemeral mix, seed strategy seed.sql vs custom ORM, secret strategy CLI direct vs dotenvx). Produz BRANCHING-DESIGN.md com custo estimado Branching Compute Hours. Cross-suite handoff para supabase-architect (v1.8). Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (princípio canônico v1.23). v1.27 incorpora 100% da doc oficial.
    tools: Read, Write, Bash, AskUserQuestion, Task
    color: blue
    ---
    ```

    **Seções body (350-500 linhas):**

    1. **Mission statement** — Projetar estratégia branching, NÃO materializar workflows (delegado para `supabase-cicd-pipeline-implementer`)
    2. **Princípio canônico v1.23** — handoff cooperativo, intent original preservado
    3. **Distinção canônica** — branching-architect vs cicd-pipeline-implementer (architect projeta, implementer materializa)
    4. **Inputs esperados** — projeto Supabase existente (tier Free/Pro), git repo, GitHub access, intent original do user
    5. **Step 0 — Preflight** — detectar tier (Free vs Pro) + verificar git remote + verificar gh CLI
    6. **Step 1 — ARCH-01: AskUserQuestion GitHub integration vs Dashboard alpha** — default GitHub (Dashboard tem limitações)
    7. **Step 2 — ARCH-02: AskUserQuestion persistent vs ephemeral mix** — pode haver mix (1 persistent staging + N ephemeral previews)
    8. **Step 3 — ARCH-03: AskUserQuestion seed strategy** — seed.sql default vs custom ORM
    9. **Step 4 — ARCH-04: AskUserQuestion secret strategy** — CLI direct (`supabase secrets set`) vs dotenvx encrypted commits
    10. **Step 5 — ARCH-05: Produzir BRANCHING-DESIGN.md** — em `.planning/BRANCHING-DESIGN.md` com 4 decisões + recomendações + custo estimado
    11. **Step 6 — Cross-suite handoff** — Task() para supabase-architect com intent + design
    12. **Step 7 — Decide Verdict** — GO/STRENGTHEN/REWRITE-com-confirmação
    13. **Step 8 — Output canônico**
    14. **Verdict examples** — GO/STRENGTHEN/REWRITE com inputs/outputs
    15. **Cross-suite invocação** — tabela
    16. **Failure modes** — Spend Cap não considerado, Dashboard alpha sem cuidado, secrets per-branch ignorados
    17. **Anti-patterns prevenidos** — Dashboard alpha para projeto sério, ignorar Spend Cap caveat, assumir seed copia data production
    18. **Quality gates**
    19. **Quando NÃO invocar**
    20. **Ver também**
  </action>
  <acceptance_criteria>
    - File exists: `test -f kit/agents/supabase-branching-architect.md` retorna 0
    - Frontmatter name: `grep -q "^name: supabase-branching-architect$" kit/agents/supabase-branching-architect.md` retorna 0
    - Frontmatter tools includes AskUserQuestion: `grep -q "AskUserQuestion" kit/agents/supabase-branching-architect.md` retorna 0
    - ARCH-01 GitHub vs Dashboard mentioned: `grep -qi "dashboard alpha" kit/agents/supabase-branching-architect.md` retorna 0
    - ARCH-02 persistent vs ephemeral: `grep -qi "persistent" kit/agents/supabase-branching-architect.md` retorna 0
    - ARCH-03 seed strategy: `grep -qi "seed" kit/agents/supabase-branching-architect.md` retorna 0
    - ARCH-04 secret strategy: `grep -qi "dotenvx" kit/agents/supabase-branching-architect.md` retorna 0
    - ARCH-05 BRANCHING-DESIGN.md mentioned: `grep -q "BRANCHING-DESIGN.md" kit/agents/supabase-branching-architect.md` retorna 0
    - Cross-suite handoff supabase-architect: `grep -q "supabase-architect" kit/agents/supabase-branching-architect.md` retorna 0
    - Verdicts GO/STRENGTHEN/REWRITE present: 3 verdicts mencionados
    - Min size 350 lines: `test $(wc -l < kit/agents/supabase-branching-architect.md) -ge 350` retorna 0
  </acceptance_criteria>
</task>

<task id="154-01-T2" description="Criar agent supabase-cicd-pipeline-implementer.md (CICD-01..05)">
  <read_first>
    - kit/agents/supabase-roles-implementer.md (pattern v1.26 — REFERÊNCIA)
    - kit/agents/supabase-migration-writer.md (cross-suite handoff target CICD-03)
    - kit/agents/release-pipeline-auditor.md (cross-suite handoff target CICD-04)
    - kit/skills/supabase-ci-cd-github-actions/SKILL.md (8 workflows canônicos Phase 151)
    - kit/agents/supabase-branching-architect.md (T1 — upstream input)
  </read_first>
  <action>
    Criar arquivo `kit/agents/supabase-cicd-pipeline-implementer.md` com:

    **Frontmatter YAML:**
    ```yaml
    ---
    name: supabase-cicd-pipeline-implementer
    description: Canonical materializer pipeline CI/CD Supabase. Recebe BRANCHING-DESIGN.md de supabase-branching-architect (v1.27) ou user direto + materializa 7-8 workflows GitHub Actions canônicos (ci.yml, staging.yml, production.yml, generate-types.yml, database-tests.yml, functions-tests.yml, backup.yml com WARNING never to public repo 2×, notify-failure.yaml) + SECRETS-CHECKLIST.md com 6 secrets. Cross-suite handoff para supabase-migration-writer (v1.23) e release-pipeline-auditor (v1.10). Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (princípio canônico v1.23). v1.27 incorpora 100% da doc oficial.
    tools: Read, Write, Edit, Bash, Task, AskUserQuestion
    color: yellow
    ---
    ```

    **Seções body (400-600 linhas):**

    1. **Mission statement** — Materializar CI/CD pipeline (architect projeta, implementer materializa)
    2. **Princípio canônico v1.23** — handoff cooperativo
    3. **Distinção canônica** — implementer vs architect (responsabilidades)
    4. **Inputs esperados** — BRANCHING-DESIGN.md (do architect ou user direto), repo com `.github/workflows/`
    5. **Step 0 — Preflight** — detectar `.github/workflows/` dir + gh CLI + git remote
    6. **Step 1 — Validar BRANCHING-DESIGN.md** — schema validation (4 decisões registradas)
    7. **Step 2 — CICD-01: Materializar workflows GitHub Actions** — 7-8 arquivos em ordem
       - `.github/workflows/ci.yml`
       - `.github/workflows/staging.yml`
       - `.github/workflows/production.yml`
       - `.github/workflows/generate-types.yml`
       - `.github/workflows/database-tests.yml` (opcional — se pgTAP enabled)
       - `.github/workflows/functions-tests.yml` (opcional — se Edge Functions presentes)
       - `.github/workflows/backup.yml` (com WARNING never to public repo 2×)
       - `.github/workflows/notify-failure.yaml`
    8. **Step 3 — CICD-02: SECRETS-CHECKLIST.md** — 6 secrets canônicos:
       - `SUPABASE_ACCESS_TOKEN`
       - `PRODUCTION_PROJECT_ID`
       - `PRODUCTION_DB_PASSWORD`
       - `STAGING_PROJECT_ID`
       - `STAGING_DB_PASSWORD`
       - `SUPABASE_DB_URL`
    9. **Step 4 — CICD-03: Cross-suite handoff supabase-migration-writer** — Task() se workflows referenciam novas migrations
    10. **Step 5 — CICD-04: Cross-suite handoff release-pipeline-auditor** — Task() para audit hermeticidade
    11. **Step 6 — CICD-05: Decide Verdict** — GO/STRENGTHEN/REWRITE-com-confirmação
    12. **Step 7 — Output canônico**
    13. **Verdict examples** — GO/STRENGTHEN/REWRITE com inputs/outputs
    14. **Cross-suite invocação** — tabela
    15. **Failure modes** — repo público com backup (REWRITE bloqueia), secrets não configurados, schema drift staging vs production
    16. **Anti-patterns prevenidos** — backup em repo público, concurrent db push sem coordenação, secrets sem encryption
    17. **Quality gates** — 7-8 workflows criados, SECRETS-CHECKLIST.md presente, cross-suite handoffs invocados, WARNING never to public repo 2× no backup
    18. **Quando NÃO invocar**
    19. **Ver também**
  </action>
  <acceptance_criteria>
    - File exists: `test -f kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - Frontmatter name: `grep -q "^name: supabase-cicd-pipeline-implementer$" kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - Frontmatter tools includes Task: `grep -q "Task" kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - CICD-01 workflows mentioned (8 names): ci.yml, staging.yml, production.yml, generate-types.yml, database-tests.yml, functions-tests.yml, backup.yml, notify-failure.yaml
    - CICD-02 SECRETS-CHECKLIST.md mentioned: `grep -q "SECRETS-CHECKLIST" kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - CICD-02 6 secrets present: SUPABASE_ACCESS_TOKEN + PRODUCTION_PROJECT_ID + PRODUCTION_DB_PASSWORD + STAGING_PROJECT_ID + STAGING_DB_PASSWORD + SUPABASE_DB_URL
    - CICD-03 cross-suite handoff supabase-migration-writer: `grep -q "supabase-migration-writer" kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - CICD-04 cross-suite handoff release-pipeline-auditor: `grep -q "release-pipeline-auditor" kit/agents/supabase-cicd-pipeline-implementer.md` retorna 0
    - CICD-05 verdicts GO/STRENGTHEN/REWRITE present
    - Backup warning 2× present: `grep -c "Never backup" kit/agents/supabase-cicd-pipeline-implementer.md` retorna ≥ 2
    - Min size 400 lines: `test $(wc -l < kit/agents/supabase-cicd-pipeline-implementer.md) -ge 400` retorna 0
  </acceptance_criteria>
</task>

## Verificação de objetivo

Após T1..T2 completarem, executar verificação reversa:

1. **Existência:** 2 agents em `kit/agents/`
2. **REQs cobertos:** 10/10 — ARCH-01..05 + CICD-01..05
3. **Estrutura canônica v1.26:** frontmatter YAML + Mission + Inputs + Outputs + Verdicts + Cross-suite + Failure modes + Anti-patterns + Quality gates
4. **Tamanho:** branching-architect ≥ 350 linhas; cicd-pipeline-implementer ≥ 400 linhas
5. **Verdicts:** ambos com GO/STRENGTHEN/REWRITE-com-confirmação
6. **Cross-suite handoffs:** ARCH→supabase-architect, CICD→supabase-migration-writer, CICD→release-pipeline-auditor (3 total)
7. **Tom canônico:** PT-BR instrucional direto, code blocks EN com comentários PT-BR

## Decisões canônicas registradas

- **Princípio canônico v1.23** — handoff cooperativo, intent original preservado, ninguém descarta upstream
- **Pattern canônico v1.26** — `supabase-roles-implementer.md` como referência estrutural
- **Cross-suite handoffs explícitos** — Task() calls visíveis no agent body (3 handoffs)
- **GitHub integration default** sobre Dashboard alpha — explícito em ARCH-01
- **Backup WARNING repetido 2×** — anti-pattern crítico em CICD-01 backup.yml
