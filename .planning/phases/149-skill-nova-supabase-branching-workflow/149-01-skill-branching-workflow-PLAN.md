---
plan_id: 149-01-skill-branching-workflow
phase: 149
wave: 1
depends_on: []
autonomous: true
requirements:
  - BRANCH-01
  - BRANCH-02
  - BRANCH-03
  - BRANCH-04
  - BRANCH-05
files_modified:
  - kit/skills/supabase-branching-workflow/SKILL.md
estimated_lines: 600
must_haves:
  - "Frontmatter YAML válido com name=supabase-branching-workflow + description trigger phrases + model"
  - "Seção 'Quando usar' com trigger phrases (preview branch, persistent branch, deploy DAG, branching Supabase, GitHub integration Supabase)"
  - "BRANCH-01: tabela ou seção comparando preview (ephemeral, auto-pause, auto-delete em PR merge/close) vs persistent (long-lived staging/QA, não auto-pause) com critério de escolha"
  - "BRANCH-02: deploy DAG 7 steps listados em ordem (clone → pull → health → configure → migrate → seed → deploy) + skip behavior em falha (migrate falha step 5 → seed step 6 skipped)"
  - "BRANCH-03: GitHub integration setup documentado (Authorize Supabase, working directory, automatic branching toggle, 'Supabase changes only' filter, deploy to production toggle)"
  - "BRANCH-04: Dashboard alpha caveats listados (custom roles não capturados, merge só p/ main não entre preview branches, edge functions sobrescritas no 'update branch', delete de functions manual em main)"
  - "BRANCH-05: bloco destacado de alerta de custo (Micro $0.01344/h + FORA do Spend Cap + Compute Credits NÃO aplicam + billing como 'Branching Compute Hours')"
  - "Seção 'Anti-patterns' com pelo menos 4 anti-patterns explícitos (Dashboard alpha para projeto sério, ignorar Spend Cap caveat, merge entre preview branches, push direto na main sem preview)"
  - "Seção 'Ver também' com cross-refs para supabase-migrations, supabase-declarative-schema, evolucao-schema-compativel, release-engineering, hermetic-builds"
  - "Tamanho mínimo 400 linhas (pattern v1.26)"
---

# Plano 149-01: Skill nova `supabase-branching-workflow`

## Objetivo

Criar skill canônica `kit/skills/supabase-branching-workflow/SKILL.md` cobrindo:
1. Preview vs persistent branches (BRANCH-01)
2. Deploy DAG 7 steps + skip behavior (BRANCH-02)
3. GitHub integration setup (BRANCH-03)
4. Dashboard alpha caveats (BRANCH-04)
5. Custo Branching Compute Hours (BRANCH-05)

Pattern canônico v1.26 (supabase-postgres-roles como referência estrutural). Conteúdo PT-BR (convenção v1.22+). Code blocks YAML/SQL EN com comentários PT-BR.

## Contexto upstream

- Material-fonte: 11 markdowns da doc oficial Supabase (já incorporados em REQUIREMENTS.md BRANCH-01..05)
- Skills cross-ref: supabase-migrations (v1.23), supabase-declarative-schema, evolucao-schema-compativel (v1.22), release-engineering, hermetic-builds
- Princípio canônico v1.23-v1.26: handoff cooperativo SQL (não BLOCK rígido)

## Tasks

<task id="149-01-T1" description="Criar diretório kit/skills/supabase-branching-workflow/ e SKILL.md vazio">
  <read_first>
    - kit/skills/supabase-postgres-roles/SKILL.md (pattern canônico v1.26)
    - kit/skills/supabase-migrations/SKILL.md (cross-ref que sera linkado)
  </read_first>
  <action>
    Criar diretório `kit/skills/supabase-branching-workflow/` se não existir.
    Inicializar arquivo `kit/skills/supabase-branching-workflow/SKILL.md` com frontmatter YAML:

    ```yaml
    ---
    name: supabase-branching-workflow
    description: Use ao adotar Supabase Branching — preview vs persistent branches, deploy DAG 7 steps (clone→pull→health→configure→migrate→seed→deploy), GitHub integration setup, Dashboard alpha caveats, custo Branching Compute Hours (FORA do Spend Cap). v1.27 incorpora 100% da doc oficial.
    ---
    ```

    Salvar arquivo. Output esperado: arquivo existe com frontmatter válido (3 linhas YAML + name + description).
  </action>
  <acceptance_criteria>
    - File exists: `test -f kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Frontmatter has name: `grep -q "^name: supabase-branching-workflow$" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Frontmatter has description with trigger phrase: `grep -q "preview vs persistent branches" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Frontmatter has Spend Cap caveat in description: `grep -q "FORA do Spend Cap" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T2" description="Adicionar seções 'Quando usar' e 'Princípio canônico' (intro + distinção)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T1)
    - kit/skills/supabase-postgres-roles/SKILL.md (referência estrutural lines 9-40)
  </read_first>
  <action>
    Adicionar após o frontmatter (após `---` fechamento) as seguintes seções em ordem:

    1. Título H1 `# Supabase — Branching Workflow`
    2. Seção `## Quando usar` listando trigger phrases:
       - "preview branch Supabase", "persistent branch staging"
       - "deploy DAG Supabase", "branching workflow"
       - "GitHub integration Supabase", "automatic branching"
       - "Dashboard branching alpha"
       - "Branching Compute Hours custo"
    3. Seção `## Princípio canônico` distinguindo:
       - Preview branches: ephemeral, criados em PR open, auto-pause inatividade, auto-delete em PR merge/close
       - Persistent branches: long-lived (staging/QA), NÃO auto-pause, requerem delete manual
       - Critério de escolha: PR-driven dev workflow → preview; staging compartilhada → persistent
    4. Bloco de alerta destacado `## ⚠ ALERTA DE CUSTO — Branching Compute Hours` (BRANCH-05) com:
       - Micro instance $0.01344/h
       - **FORA do Spend Cap** (repetir explicitamente)
       - Compute Credits NÃO aplicam
       - Billing aparece como "Branching Compute Hours" no invoice
       - Estimativa: 10 PRs/mês × 24h média = 240h × $0.01344 = ~$3.23/mês adicional
       - Atenção: persistent branches acumulam horas continuamente

    Tom: instrucional direto, repetir caveats explícitos, exemplos concretos.
  </action>
  <acceptance_criteria>
    - Section 'Quando usar' exists: `grep -q "^## Quando usar$" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Section 'Princípio canônico' exists: `grep -q "^## Princípio canônico$" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - BRANCH-05 cost alert section exists: `grep -q "ALERTA DE CUSTO" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Micro instance price documented: `grep -q "0.01344" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - 'FORA do Spend Cap' mentioned (BRANCH-05): `grep -c "FORA do Spend Cap" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 2 (frontmatter + body)
    - Compute Credits caveat present: `grep -q "Compute Credits NÃO aplicam" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T3" description="Adicionar seção 'Preview vs Persistent Branches' com tabela comparativa (BRANCH-01)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T2)
    - kit/skills/supabase-postgres-roles/SKILL.md (linhas 36-50 — exemplo de tabela canônica)
  </read_first>
  <action>
    Adicionar seção `## Pattern 1: Preview vs Persistent Branches` (BRANCH-01) com:

    1. Tabela comparativa markdown:

       | | Preview Branch | Persistent Branch |
       |---|---|---|
       | Ciclo de vida | Ephemeral (criado em PR open) | Long-lived (manual) |
       | Auto-pause | Sim (inatividade) | NÃO |
       | Auto-delete | Sim (PR merge/close) | NÃO (manual via Dashboard/CLI) |
       | Caso de uso | PR-driven dev | Staging/QA compartilhada |
       | Custo (Compute Hours) | Acumula durante PR vida útil | Acumula continuamente 24/7 |

    2. Critério de escolha (decisão canônica):
       - Use preview SE: equipe usa PR workflow + features curtas (< 1 semana lifetime)
       - Use persistent SE: precisa staging shared para QA team + features longas + manual control
       - Pode haver MIX: persistent staging + ephemeral preview per PR

    3. Exemplo CLI:
       ```bash
       # criar persistent branch via CLI
       supabase --experimental branches create staging --persistent
       # listar branches
       supabase --experimental branches list
       # deletar branch
       supabase --experimental branches delete <branch-name>
       ```

    4. Caveat: branch creation pode levar até 30 minutos para health check completion.
  </action>
  <acceptance_criteria>
    - Section 'Preview vs Persistent' (BRANCH-01) exists: `grep -q "Preview vs Persistent" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Comparison table has 'Auto-pause' row: `grep -q "Auto-pause" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Comparison table has 'auto-delete' caveat: `grep -qi "auto-delete" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - 'ephemeral' keyword present: `grep -qi "ephemeral" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - CLI example with --persistent flag: `grep -q -- "--persistent" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - 30min health check caveat: `grep -q "30 minutos" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T4" description="Adicionar seção 'Deploy DAG 7 steps' com skip behavior (BRANCH-02)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T3)
  </read_first>
  <action>
    Adicionar seção `## Pattern 2: Deploy DAG — 7 steps canônicos` (BRANCH-02) com:

    1. Lista numerada dos 7 steps em ordem:
       1. **clone** — clone do repositório no contexto do branch
       2. **pull** — pull das migrations e schema declarativo
       3. **health** — health check do branch DB (espera até 30 min)
       4. **configure** — aplica `config.toml` (incl. `[remotes]` block)
       5. **migrate** — executa migrations em ordem cronológica (`supabase/migrations/`)
       6. **seed** — aplica `supabase/seed.sql` (dataless by design — sem dados de produção)
       7. **deploy** — deploy de Edge Functions e secrets

    2. Skip behavior CANÔNICO (anti-cascading failure):
       - Falha em step N → todos steps N+1...7 são **skipped**
       - Exemplo: migrate falha em step 5 → seed (6) e deploy (7) são skipped
       - DAG status no Dashboard mostra step que falhou + steps skipped
       - Logs: cada step tem stdout/stderr próprio acessível no Dashboard

    3. Recovery pattern (cross-ref):
       - Reaplicar migration corrigida → re-run DAG (push novo commit no PR)
       - Migration drift → ver skill `supabase-migration-repair` (Phase 153)

    4. Diagrama ASCII opcional (Mermaid-style):
       ```
       clone → pull → health → configure → migrate → seed → deploy
                                              ↓ falha
                                           [seed: SKIPPED]
                                           [deploy: SKIPPED]
       ```

    5. Caveat dataless: seed.sql NÃO deve conter dados sensíveis de produção; preview branches são para dev workflow, não para QA com dados reais.
  </action>
  <acceptance_criteria>
    - Section 'Deploy DAG' (BRANCH-02) exists: `grep -q "Deploy DAG" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - All 7 step names present:
      - `grep -q "clone" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "pull" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "health" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "configure" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "migrate" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "seed" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "deploy" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Skip behavior documented: `grep -qi "skipped" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Example "migrate falha step 5 → seed skipped": `grep -q "step 5" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Dataless by design caveat: `grep -qi "dataless" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T5" description="Adicionar seção 'GitHub Integration Setup' (BRANCH-03)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T4)
  </read_first>
  <action>
    Adicionar seção `## Pattern 3: GitHub Integration Setup` (BRANCH-03) com:

    1. Lista de toggles + steps em ordem:
       - **Step 1: Authorize Supabase no GitHub** — Dashboard → Project Settings → Integrations → GitHub → Authorize
       - **Step 2: Working directory** — definir diretório raiz do projeto Supabase (default: `./` se monorepo, `./supabase` se sub-projeto)
       - **Step 3: Automatic branching toggle** — ON para preview branches automáticos em PRs
       - **Step 4: "Supabase changes only" filter** — ON para criar preview branch APENAS se PR toca `supabase/` (recomendação canônica — reduz custo Branching Compute Hours)
       - **Step 5: Deploy to production toggle** — ON para push automático em merge para `main` (use com CAUTELA — exige migrations bem testadas em preview)

    2. Workflow esperado após setup:
       ```
       Dev abre PR → GitHub webhook → Supabase cria preview branch
       → Deploy DAG roda (7 steps) → Required check "Supabase Preview" gates merge
       → Dev valida em preview → Merge para main → (se deploy to production ON) → push para production
       ```

    3. Required check enforcement:
       - GitHub branch protection rules: marcar "Supabase Preview" como required
       - Sem check ✅ verde → bloqueia merge (gate canônico)

    4. Recomendação canônica:
       - **Use GitHub integration em projetos sério** (não Dashboard alpha — ver BRANCH-04)
       - Dashboard branching alpha tem limitações documentadas que tornam unsuitable para production workflow
  </action>
  <acceptance_criteria>
    - Section 'GitHub Integration' (BRANCH-03) exists: `grep -q "GitHub Integration" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - All 5 toggle steps documented:
      - `grep -q "Authorize Supabase" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -qi "working directory" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -qi "automatic branching" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "Supabase changes only" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -qi "deploy to production" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Required check enforcement mentioned: `grep -qi "required check" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Branch protection rules referenced: `grep -qi "branch protection" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T6" description="Adicionar seção 'Dashboard Branching Alpha — Caveats' (BRANCH-04)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T5)
  </read_first>
  <action>
    Adicionar seção `## Pattern 4: Dashboard Branching Alpha — Caveats canônicos` (BRANCH-04) com:

    1. Header de WARNING destacado: "⚠ Dashboard branching está em ALPHA — desencorajado para projetos sério. Use GitHub integration (Pattern 3)."

    2. Lista numerada dos 4 caveats canônicos:
       1. **Custom roles NÃO capturados** — branches criados via Dashboard NÃO capturam Postgres custom roles (cross-ref skill `supabase-postgres-roles` v1.26). Roles definidos em migrations são aplicados pelo DAG, mas roles criados via Dashboard ou diretamente no DB são perdidos no branch creation.
       2. **Merge só para `main`** — Dashboard NÃO suporta merge entre preview branches (ex: preview-A → preview-B). Só direção suportada: preview → main. Se precisar combinar 2 features, faça via git merge no GitHub, não via Dashboard.
       3. **Edge Functions sobrescritas no "update branch"** — clicar "update branch" no Dashboard sobrescreve TODAS edge functions no preview branch com versão atual de main. Perda silenciosa — sem confirmation prompt. Deploy de edge functions via Dashboard alpha é high-risk.
       4. **Delete de functions MANUAL em main** — se você deleta uma edge function em preview branch, no merge para main a deletion NÃO é propagada automaticamente. Você deve manualmente `supabase functions delete <name>` em main após merge.

    3. Recomendação canônica explícita:
       - Para qualquer projeto em produção: **GitHub integration** (Pattern 3)
       - Dashboard alpha aceitável APENAS para: experimentação solo, prototipagem rápida, projetos sem migration history estável

    4. Tabela de comparação Dashboard alpha vs GitHub integration:

       | | Dashboard alpha | GitHub integration |
       |---|---|---|
       | Custom roles capturados | NÃO | SIM (via migrations) |
       | Merge entre previews | NÃO | SIM (git workflow) |
       | Edge functions safety | Sobrescreve silenciosamente | Versioned via git |
       | Delete propagation | Manual em main | Automatic via merge |
       | Maturity | Alpha | Estável |
       | Recomendação | Experimentação solo | Produção |
  </action>
  <acceptance_criteria>
    - Section 'Dashboard Branching Alpha' (BRANCH-04) exists: `grep -q "Dashboard Branching Alpha" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - All 4 caveats documented:
      - `grep -qi "custom roles" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "merge só para" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -q "sobrescritas" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - `grep -qi "delete de functions" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Alpha warning present: `grep -qi "alpha" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Recommendation canônica GitHub integration: `grep -q "GitHub integration" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T7" description="Adicionar seção 'Anti-patterns' com 4+ anti-patterns explícitos">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T6)
    - kit/skills/supabase-postgres-roles/SKILL.md (linhas 293-376 — pattern de Anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 4+ anti-patterns canônicos em formato Errado/Por quê/Certo:

    ### Anti-pattern 1: Usar Dashboard branching alpha para projeto sério
    - **Errado:** Time de 5+ devs gerencia branches via Dashboard alpha
    - **Por quê:** custom roles não capturados + edge functions sobrescritas silenciosamente + merge só p/ main = surprise bugs em produção
    - **Certo:** GitHub integration (Pattern 3) — versionado, audit trail, branch protection rules enforced

    ### Anti-pattern 2: Ignorar Spend Cap caveat
    - **Errado:** Habilitar branching assumindo Spend Cap protege contra cost overrun
    - **Por quê:** Branching Compute Hours são **FORA do Spend Cap** — projeto Pro plan com 30 PRs/mês pode gerar $40-100/mês adicional sem alert
    - **Certo:** monitorar billing manualmente, "Supabase changes only" filter ON, considerar persistent branch único compartilhado em vez de 1 preview/PR

    ### Anti-pattern 3: Tentar merge entre preview branches
    - **Errado:** preview-feature-A → preview-feature-B via Dashboard
    - **Por quê:** Dashboard NÃO suporta — só merge para main. Tentativa = state inconsistente
    - **Certo:** combinar features via git (PR-A merges to main → PR-B rebase on top → merge to main)

    ### Anti-pattern 4: Push direto na main sem preview branch
    - **Errado:** Dev pushca migration direto em main sem PR/preview
    - **Por quê:** sem validação de DAG → migration falha em production → downtime + rollback complexo
    - **Certo:** SEMPRE PR + preview branch validado (DAG ✅) + merge gated por required check

    ### Anti-pattern 5: Esperar persistent branch funcionar como production
    - **Errado:** assumir persistent staging branch é cópia de produção
    - **Por quê:** branches são **dataless by design** — seed.sql é dados sintéticos, não snapshot real
    - **Certo:** persistent branches são para schema/code validation, NÃO para QA com dados reais (use staging Supabase project separado se precisar dados reais)
  </action>
  <acceptance_criteria>
    - Section 'Anti-patterns' exists: `grep -q "^## Anti-patterns$" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - At least 4 anti-patterns: `grep -c "^### Anti-pattern" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 4
    - Errado/Por quê/Certo pattern present (pattern canônico v1.26): `grep -c "^\*\*Errado:\*\*" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 4
    - 'Por quê' explanation present: `grep -c "Por quê:" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 4
    - 'Certo' alternative present: `grep -c "^\*\*Certo:\*\*" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 4
  </acceptance_criteria>
</task>

<task id="149-01-T8" description="Adicionar seção 'Cross-suite integration (v1.27)' + 'Ver também' (cross-refs)">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado após T7)
    - kit/skills/supabase-postgres-roles/SKILL.md (linhas 377-393 — pattern de Ver também)
  </read_first>
  <action>
    Adicionar duas seções finais:

    1. Seção `## Cross-suite integration (v1.27)`:
       - Esta skill é base para skills v1.27 (Phases 150-153): `supabase-config-toml-remotes`, `supabase-ci-cd-github-actions`, `supabase-pgtap-testing`, `supabase-migration-repair`
       - Base para agents v1.27 (Phase 154): `supabase-branching-architect` (projeta strategy) + `supabase-cicd-pipeline-implementer` (materializa workflows)
       - Pattern de handoff cooperativo herdado v1.23-v1.26: architect projeta → cicd-pipeline-implementer materializa → release-pipeline-auditor (v1.10) audit hermeticidade

    2. Seção `## Ver também`:
       - [supabase-config-toml-remotes](../supabase-config-toml-remotes/SKILL.md) (v1.27, Phase 150) — `[remotes]` block + branch-specific config + secrets per-branch
       - [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — 8 workflows canônicos GitHub Actions
       - [supabase-migration-repair](../supabase-migration-repair/SKILL.md) (v1.27, Phase 153) — `migration list/repair` + rollback preview branch
       - [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — 5 blocos obrigatórios CREATE TABLE
       - [supabase-declarative-schema](../supabase-declarative-schema/SKILL.md) — schema declarative workflow
       - [evolucao-schema-compativel](../evolucao-schema-compativel/SKILL.md) (v1.22) — 3-step migration safe rolling upgrade
       - [release-engineering](../release-engineering/SKILL.md) — deployment philosophy
       - [hermetic-builds](../hermetic-builds/SKILL.md) — pipeline reproducibility
       - [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — caveat custom roles não capturados em Dashboard alpha
       - [glossário compartilhado](../_shared-supabase/glossary.md) — termos branching workflow, preview branch, persistent branch, deploy DAG, Branching Compute Hours (será +10 termos em REL-04 v1.27)
       - Doc oficial: [Supabase Branching](https://supabase.com/docs/guides/deployment/branching), [GitHub Integration](https://supabase.com/docs/guides/deployment/branching#github-integration), [Pricing](https://supabase.com/pricing)
  </action>
  <acceptance_criteria>
    - Section 'Cross-suite integration (v1.27)' exists: `grep -q "Cross-suite integration (v1.27)" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Section 'Ver também' exists: `grep -q "^## Ver também$" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Cross-ref to supabase-migrations: `grep -q "supabase-migrations" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Cross-ref to supabase-postgres-roles: `grep -q "supabase-postgres-roles" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Cross-ref to evolucao-schema-compativel: `grep -q "evolucao-schema-compativel" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Cross-ref to release-engineering: `grep -q "release-engineering" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Cross-ref to hermetic-builds: `grep -q "hermetic-builds" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Future skills referenced (Phase 150-153): `grep -q "supabase-config-toml-remotes" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Doc oficial link present: `grep -q "supabase.com/docs/guides/deployment/branching" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
  </acceptance_criteria>
</task>

<task id="149-01-T9" description="Validar tamanho mínimo e estrutura final do SKILL.md">
  <read_first>
    - kit/skills/supabase-branching-workflow/SKILL.md (estado completo após T1..T8)
  </read_first>
  <action>
    Validar o estado final do arquivo:

    1. Tamanho mínimo: `wc -l kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 400 linhas
    2. Frontmatter YAML válido (3 linhas no topo: `---` + 2 fields + `---`)
    3. Todas 5 seções principais presentes (Quando usar, Princípio canônico, Pattern 1-4, Anti-patterns, Cross-suite, Ver também)
    4. Todos 5 REQs cobertos (BRANCH-01..05)

    Se file < 400 linhas, expandir as seções com mais exemplos concretos, mais código YAML/SQL inline, mais caveats da doc oficial.

    Não criar arquivos extras — apenas validar e ajustar SKILL.md.
  </action>
  <acceptance_criteria>
    - Min size 400 lines: `test $(wc -l < kit/skills/supabase-branching-workflow/SKILL.md) -ge 400` retorna 0
    - Frontmatter closes properly: `grep -c "^---$" kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 2 (open + close)
    - All BRANCH-01..05 keywords present (final verification):
      - BRANCH-01 (preview vs persistent): `grep -q "Preview vs Persistent" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - BRANCH-02 (deploy DAG): `grep -q "Deploy DAG" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - BRANCH-03 (GitHub integration): `grep -q "GitHub Integration" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - BRANCH-04 (Dashboard alpha): `grep -q "Dashboard Branching Alpha" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
      - BRANCH-05 (Branching Compute Hours): `grep -q "Branching Compute Hours" kit/skills/supabase-branching-workflow/SKILL.md` retorna 0
    - Anti-patterns section has ≥ 4 entries: `grep -c "^### Anti-pattern " kit/skills/supabase-branching-workflow/SKILL.md` retorna ≥ 4
  </acceptance_criteria>
</task>

## Verificação de objetivo

Após T1..T9 completarem, executar verificação reversa:

1. **Existência:** `kit/skills/supabase-branching-workflow/SKILL.md` existe
2. **REQs cobertos:** 5/5 — BRANCH-01 (preview vs persistent), BRANCH-02 (deploy DAG 7 steps), BRANCH-03 (GitHub integration), BRANCH-04 (Dashboard alpha caveats), BRANCH-05 (Branching Compute Hours)
3. **Estrutura canônica v1.26:** frontmatter + Quando usar + Princípio canônico + Patterns + Anti-patterns + Cross-suite + Ver também
4. **Tamanho:** ≥ 400 linhas
5. **Anti-patterns:** ≥ 4 entries com pattern Errado/Por quê/Certo
6. **Tom canônico:** PT-BR instrucional direto, code blocks EN com comentários PT-BR, caveats explícitos repetidos (FORA do Spend Cap × 2+)

## Decisões canônicas registradas

- **Recomendação GitHub integration sobre Dashboard alpha** — explícita em T5 + T6 + Anti-pattern 1
- **Branching Compute Hours fora do Spend Cap** — repetido em frontmatter + T2 (bloco alerta) + Anti-pattern 2
- **Dataless by design** — registrado em T4 (deploy DAG step 6 seed) + Anti-pattern 5
- **Pattern de Anti-patterns Errado/Por quê/Certo** — herdado v1.26 (supabase-postgres-roles)
