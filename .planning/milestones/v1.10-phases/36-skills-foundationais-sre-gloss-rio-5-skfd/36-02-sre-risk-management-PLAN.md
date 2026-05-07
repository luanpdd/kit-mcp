---
phase: 36
plan: 02
title: Skill sre-risk-management — risk continuum + 99.99% wisdom (cap 3)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/sre-risk-management/SKILL.md
requirements: [SKFD-SRE-01]
status: ready
---

# Plan 02 — Skill `sre-risk-management/SKILL.md`

## Goal

Criar `kit/skills/sre-risk-management/SKILL.md` documentando o capítulo 3 do livro Google SRE — *Embracing Risk*: continuum risk × innovation, sabedoria 99.99% (usuário em 99% smartphone NÃO distingue 99.99% vs 99.999%), error budget como balanço explícito, princípio "as reliable as needs to be, no more". Skill auto-contida — LLM gera workflow completo sem precisar ler outra skill (cross-refs apenas em "Ver também").

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name` (slug exato) + `description ≤ 200 chars` (anti-pitfall A2 — CLAUDE.md inflation budget)
- **NÃO criar pasta `references/`** dentro de `sre-risk-management/` (anti-pitfall A8 — só `SKILL.md`)
- 5 seções canônicas: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- Code blocks em EN literal, comentários inline em PT-BR (precedente D-01 das suítes anteriores)
- Cross-refs apenas em `## Ver também` no fim — corpo da skill deve ser auto-suficiente

## Tasks

<task id="36-02-T1" name="Frontmatter + Quando usar">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (precedente direto — SLO target ≤ 99.95% argumento)
    - D:/projetos/opensource/mcp/kit/skills/observability-driven-development/SKILL.md (linhas 1-30 — shape de frontmatter + Quando usar)
  </read_first>
  <action>
    Escrever frontmatter + seção `## Quando usar`:

    ```markdown
    ---
    name: sre-risk-management
    description: Use ao escolher SLO target — risk continuum, error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more", sabedoria 99.99%.
    ---

    # SRE — Risk Management

    ## Quando usar

    LLM carrega esta skill ao definir SLO target, debater "qual disponibilidade precisamos?", ou justificar trade-off entre velocidade de release e estabilidade. Trigger phrases:

    - "SLO target", "qual disponibilidade?"
    - "99.9% vs 99.99%", "quantos noves?"
    - "error budget", "risk budget"
    - "risk continuum"
    - "as reliable as needs to be"
    - "sabedoria 99.99%", "smartphone dilui SLO"
    - "embracing risk", "Google SRE cap 3"
    ```

    A `description` deve ter exatamente este texto (verificar ≤ 200 chars com `(Get-Item ... | %{ ($_.description).Length })`).
  </action>
  <acceptance_criteria>
    - Arquivo `kit/skills/sre-risk-management/SKILL.md` existe
    - Linha 1 é `---`, frontmatter contém `name: sre-risk-management` e `description: ...`
    - Tamanho de `description` ≤ 200 chars
    - Header `# SRE — Risk Management` presente
    - Seção `## Quando usar` contém pelo menos 5 trigger phrases (incluindo "risk continuum", "99.9% vs 99.99%", "error budget", "smartphone dilui")
  </acceptance_criteria>
</task>

<task id="36-02-T2" name="Regras absolutas — 7 princípios canônicos cap 3">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 19-28 — shape de "Regras absolutas")
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção Risk e Reliability — após Plan 01 T2)
  </read_first>
  <action>
    Adicionar seção `## Regras absolutas` com 7 bullets, cada um com regra concisa + 1 frase de justificativa:

    ```markdown
    ## Regras absolutas

    - **100% disponibilidade NÃO é o objetivo** — custo cresce não-linearmente acima de 99.95%; benefício marginal cai a zero porque outros componentes (ISP do usuário, smartphone, ar do ambiente) já têm < 99.99% de disponibilidade. Esforço além disso é desperdício.
    - **"As reliable as needs to be, no more"** — disponibilidade é decisão de produto, não de engenharia. Pergunta: "qual nível o usuário percebe como aceitável e está disposto a pagar?" — não "qual o máximo que conseguimos?".
    - **Sabedoria 99.99%** — smartphone tem ~99% de disponibilidade (sinal cai, bateria acaba, app trava). Usuário em 99% smartphone NÃO distingue serviço 99.99% vs 99.999% — ambos parecem "sempre funcionando" no contexto dele.
    - **Error budget é balanço explícito risk × innovation** — `(1 - SLO_target) × total_events` é orçamento de "bad" que pode ser gasto em deploys arriscados, experimentos, refactors. Se budget esgota, freeze releases até regenerar.
    - **Target ≤ 99.95% para SLO real** — 99.99% = 4.3 min de tolerância em 30d; sem tempo de reagir antes do budget esgotar; alerts viram zero-level. Para 99.99%+, use métricas/dashboards informativos, NÃO SLO acionável.
    - **SLI deve refletir customer perception** — meça o que o usuário sente ("checkout completou em < 800ms"), não estado interno ("threads ativas"). Risk é sobre consequência do customer, não engenharia.
    - **Diferentes tiers, diferentes targets** — `customer.tier='enterprise'` pode ter SLO 99.95%; `tier='free'` pode ter 99.5%. Risk é gradual; tratar todos clientes como tier-1 desperdiça budget.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Regras absolutas` existe
    - Contém 7 bullets (`- **...** — ...`)
    - Contém literalmente: `100% disponibilidade NÃO é o objetivo`, `As reliable as needs to be, no more`, `Sabedoria 99.99%`, `Error budget é balanço explícito`, `Target ≤ 99.95%`, `customer perception`, `Diferentes tiers`
  </acceptance_criteria>
</task>

<task id="36-02-T3" name="Patterns canônicos — risk continuum tabela + budget consumption + tier-based">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 30-170 — shape de "Patterns canônicos")
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção c — pattern risk continuum)
  </read_first>
  <action>
    Adicionar seção `## Patterns canônicos` com 4 sub-patterns:

    **`### Pattern: risk continuum como decisão explícita`** — tabela autoritativa (a mesma do glossário Plan 01 T4 mas com prosa adicional de **quando usar cada target**):

    | Target | Tolerância 30d | User-perceptible? | Recomendação | Custo relativo |
    |---|---|---|---|---|
    | 99% | 7.2 h | Sim (notável) | Tier free, beta features, internal tools | 1× |
    | 99.5% | 3.6 h | Notável em paths críticos | Tier free de produção | 2× |
    | 99.9% | 43.2 min | Aceitável para maior parte de UX | Tier paid default | 5× |
    | 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical | 10× |
    | 99.99% | 4.3 min | Imperceptível em smartphone | Apenas se justificado por user perception (raro) | 50×+ |
    | 99.999% | 26 s | NÃO perceptível | NUNCA para serviço user-facing | 100×+ |

    Justificativa em prosa (parágrafo após tabela): "Cada nove adicional **multiplica custo** mas **divide benefício marginal**. Cliente final (humano em smartphone com ISP residencial ~99%) tem disponibilidade no canal de comunicação inferior à do seu serviço 99.99%. Essa é a sabedoria 99.99%."

    **`### Pattern: error budget como decisão de release`** — bloco de código YAML + prosa:

    ```yaml
    # PT-BR: SLO documenta target + política de budget
    slo:
      name: checkout_success
      target: 0.999          # 99.9% — escolha explícita no risk continuum
      window: 30d_sliding

    # PT-BR: política de budget — o que fazer quando queima
    budget_policy:
      green:                 # > 50% restante
        action: "Releases livres; experimentos OK"
      yellow:                # 10-50% restante
        action: "Aumentar canary % menor; review extra de PRs riscados"
      red:                   # < 10% restante
        action: "Freeze de features; foco em stability; postmortems revisitados"
      exhausted:             # 0%
        action: "Freeze total; rollback de releases recentes; SEV1 incident review"
    ```

    Prosa: "Budget esgotado **não é punição** — é sinal de que o time gastou risk em demais releases arriscadas e precisa pausar para investir em stability. Restaurar budget = entregar trabalho que reduz erro, não pular o reset."

    **`### Pattern: target diferenciado por customer.tier`** — exemplo SQL + razão:

    ```sql
    -- PT-BR: SLO compliance por tier — diferentes targets, diferentes alarmes
    select
      customer_tier,
      count(*) as total,
      count(*) filter (where result_success = true and duration_ms < 800) as good,
      count(*) filter (where result_success = true and duration_ms < 800)::float / count(*) as compliance,
      case customer_tier
        when 'enterprise' then 0.9995    -- PT-BR: 99.95% — paga por SLO rigoroso
        when 'pro' then 0.999            -- PT-BR: 99.9%
        when 'free' then 0.995           -- PT-BR: 99.5% — best effort
      end as target,
      case
        when count(*) filter (where result_success = true and duration_ms < 800)::float / count(*) >= (
          case customer_tier
            when 'enterprise' then 0.9995
            when 'pro' then 0.999
            when 'free' then 0.995
          end
        ) then 'IN_BUDGET'
        else 'OUT_OF_BUDGET'
      end as status
    from observability.events
    where service = 'orders-api' and timestamp > now() - interval '30 days'
    group by customer_tier;
    ```

    **`### Pattern: justificar 99.99%+ excepcional`** — checklist canônico para quando target alto se justifica (raro):

    ```text
    Para SLO ≥ 99.99%, o time DEVE responder afirmativamente a TODAS as perguntas:

    1. User percebe diretamente a falha? (não apenas erro 500 — UX colapsa, dados perdidos)
       Ex: trading platform de high-frequency, controle de fluxo industrial, healthcare critical

    2. Custo de outage > 10× custo de engineering p/ atingir target?
       (calcular: 4.3 min outage por mês × revenue/min impactado)

    3. Sistema componentes downstream também são ≥ 99.99%?
       (cliente em ISP 99% — investir aqui é desperdício; trocar de ISP/CDN primeiro)

    4. Time tem cultura para sustentar (canary obrigatório, rollback < 60s, on-call < 30s page)?
       (sem isso, 99.99% é aspiracional — real será 99.5%)

    Se QUALQUER resposta = NÃO → use 99.95% ou menos. Justificar em SLO.md comentário inline.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Patterns canônicos` existe
    - Contém 4 sub-patterns: `### Pattern: risk continuum`, `### Pattern: error budget como decisão de release`, `### Pattern: target diferenciado por customer.tier`, `### Pattern: justificar 99.99%+ excepcional`
    - Tabela de risk continuum lista 6 targets (99% até 99.999%)
    - YAML budget policy contém os 4 estados: `green`, `yellow`, `red`, `exhausted`
    - SQL exemplo usa `customer_tier` e `case` para 3 tiers (enterprise/pro/free)
    - Checklist 99.99%+ enumera 4 perguntas
  </acceptance_criteria>
</task>

<task id="36-02-T4" name="Anti-patterns — 5 anti-patterns canônicos de risk">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 172-249 — shape de Anti-patterns)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção d — anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 5 sub-anti-patterns, cada um seguindo padrão `ANTI / PROBLEMA / CERTO`:

    **`### ANTI: pursuit of 100% availability`** — perseguir 100% como meta → custo infinito; benefício marginal zero (downstream tem < 99.99%); time burns out. CERTO: aceitar imperfeição como design — error budget existe para ser gasto.

    **`### ANTI: SLO 99.99% sem justificativa`** — definir 99.99% por default → 4.3 min de tolerância 30d; alerts disparam após budget esgotar (zero-level); comportamentos perversos (esconder outages para preservar number); time-pressure compulsiva. CERTO: ≤ 99.95% por default; 99.99%+ exige passar checklist de 4 perguntas (ver Patterns acima).

    **`### ANTI: SLO global "site availability"`** — 1 SLO genérico cobre tudo → falha em /admin não importa; falha em /checkout = catastrófico; alerts confusos. CERTO: 1 SLO por jornada crítica do user (`checkout_success`, `login_success`, `search_p95`); cada um com target apropriado ao seu risk.

    **`### ANTI: budget como score de "performance"`** — celebrar "atingimos SLO 99.99% este mês!" → vira métrica de vaidade; budget intacto significa **subutilização** (não shippamos suficientes deploys arriscados/experimentos); leadership pressiona por mais features sem reconhecer trade-off. CERTO: budget é orçamento — gastá-lo é OK e esperado; KPI é "shippamos N deploys de valor sem queimar budget", não "budget alto".

    **`### ANTI: SLA == SLO`** — usar SLA do contrato (99.9%) como SLO interno → 0 margem; primeira anomalia quebra contrato; sem buffer para reagir. CERTO: SLO interno mais rígido que SLA externo (e.g., SLA 99.9% → SLO interno 99.95% — margem 5×).

    Cada bloco usa o shape:

    ```markdown
    ### ANTI: <nome>

    \`\`\`text
    ANTI: <comportamento concreto>

    PROBLEMA: <consequência sistêmica>

    CERTO: <ação substituta>
    \`\`\`
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Anti-patterns` existe
    - Contém 5 sub-anti-patterns: `### ANTI: pursuit of 100% availability`, `### ANTI: SLO 99.99% sem justificativa`, `### ANTI: SLO global`, `### ANTI: budget como score`, `### ANTI: SLA == SLO`
    - Cada sub-anti-pattern contém literalmente as 3 palavras-âncora `ANTI:`, `PROBLEMA:`, `CERTO:` em fence ```text
  </acceptance_criteria>
</task>

<task id="36-02-T5" name="Verificação + Ver também + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 251-275 — shape Verificação + Ver também + footer)
  </read_first>
  <action>
    Adicionar seção `## Verificação` (checklist objetivo de readiness) + `## Ver também` (cross-refs) + footer.

    **`## Verificação`** — antes de marcar SLO como produção-pronto:

    ```markdown
    ## Verificação

    Antes de marcar SLO target como decidido:

    1. **Target justificado por customer perception** — não "queremos 99.99%" mas "usuário em smartphone percebe falha acima de X%"
    2. **Target ≤ 99.95%** OU passou checklist de 99.99%+ (ver Pattern: justificar 99.99%+ excepcional)
    3. **Tier-aware** — diferentes targets para `customer.tier` quando aplicável (enterprise/pro/free)
    4. **Budget policy documentada** — 4 estados (green/yellow/red/exhausted) com ações claras
    5. **Owner nomeado** — SLO sem dono = sem ação = sem valor
    6. **SLI customer-facing** — mede o que cliente sente, não estado interno
    7. **SLA externo > SLO interno** — margem entre compromisso comercial e meta interna
    ```

    **`## Ver também`** — cross-refs:

    ```markdown
    ## Ver também

    - [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos risk continuum, error budget, MTTR/MTBF
    - [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — definir SLO event-based com sliding window
    - [`burn-rate-alerting`](../burn-rate-alerting/SKILL.md) (v1.9) — alertas predictive sobre error budget
    - [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Performance" usa risk continuum
    - [`blameless-postmortems`](../blameless-postmortems/SKILL.md) — postmortem documenta budget consumido
    ```

    **Footer:**

    ```markdown
    ---

    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 3: "Embracing Risk".*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Verificação` contém checklist de 7 itens
    - Seção `## Ver também` lista exatamente 5 cross-refs Markdown relativos: glossary, event-based-slos, burn-rate-alerting, production-readiness-review, blameless-postmortems
    - Footer cita literalmente `Cap 3: "Embracing Risk"`
    - Arquivo total ≤ 12 KB (skill auto-contida, não denso como glossário)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/sre-risk-management/SKILL.md` existe
- [ ] Frontmatter válido com `name: sre-risk-management` e `description ≤ 200 chars`
- [ ] 6 seções presentes: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- [ ] Cobre cap 3 do livro: risk continuum, 99.99% wisdom, error budget, "as reliable as needs to be, no more"
- [ ] Auto-contida — LLM gera workflow sem precisar abrir outra skill (cross-refs apenas em "Ver também")
- [ ] Cobre SKFD-SRE-01 (risk continuum + 99.99% wisdom + error budget como balanço explícito + "as reliable as needs to be, no more")

## Must-haves (goal-backward)

1. Skill `sre-risk-management/SKILL.md` existe com frontmatter triggerável (`description ≤ 200 chars`)
2. Documenta cap 3 do livro Google SRE (risk continuum + 99.99% wisdom)
3. Auto-contida — não depende de leitura de outra skill para LLM gerar conteúdo coerente
4. Tem tabela de risk continuum com pelo menos 5 targets e custo relativo
5. Anti-patterns explícitos sobre pursuit of 100%, 99.99% sem justificativa, SLA==SLO

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Skill é referenciada em Phase 39 patch INT-OBS-01: `event-based-slos` ganha bloco "Risk continuum" cross-ref → essa skill aterrissa em Phase 36, patch só toca em Phase 39
- Tamanho esperado ~8-12 KB (similar a `event-based-slos/SKILL.md`)
