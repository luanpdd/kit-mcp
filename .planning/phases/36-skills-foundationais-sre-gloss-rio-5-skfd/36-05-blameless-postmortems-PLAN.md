---
phase: 36
plan: 05
title: Skill blameless-postmortems — template + cultura + Wheel of Misfortune (cap 15)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/blameless-postmortems/SKILL.md
requirements: [SKFD-SRE-04]
status: ready
---

# Plan 05 — Skill `blameless-postmortems/SKILL.md`

## Goal

Criar `kit/skills/blameless-postmortems/SKILL.md` documentando o capítulo 15 do livro Google SRE — *Postmortem Culture: Learning from Failure*. Template canônico (9 seções: Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC), cultura blameless (foco em sistema/processo, NÃO em pessoas), princípio "no postmortem left unreviewed", Wheel of Misfortune para training. Skill é base para Phase 37 agente `postmortem-writer` e Phase 38 comando `/postmortem`.

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: blameless-postmortems` + `description ≤ 200 chars` (anti-pitfall A2)
- **NÃO criar pasta `references/`** (anti-pitfall A8)
- 5 seções canônicas: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- Template canônico completo dentro da skill (não apenas referência ao glossário) — auto-contida

## Tasks

<task id="36-05-T1" name="Frontmatter + Quando usar">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/observability-driven-development/SKILL.md (linhas 1-20 — shape de frontmatter + Quando usar)
    - D:/projetos/opensource/mcp/kit/skills/core-analysis-loop/SKILL.md (precedente — investigação que termina em postmortem)
  </read_first>
  <action>
    Escrever frontmatter + `## Quando usar`:

    ```markdown
    ---
    name: blameless-postmortems
    description: Use após incident SEV1/SEV2 — template canônico (9 seções), cultura blameless (foco em sistema, não pessoas), no postmortem left unreviewed, Wheel of Misfortune.
    ---

    # SRE — Blameless Postmortems

    ## Quando usar

    LLM carrega esta skill ao escrever postmortem após incident, revisar postmortem de par, ou conduzir Wheel of Misfortune. Trigger phrases:

    - "postmortem", "post-mortem"
    - "incident review"
    - "blameless", "sem culpa"
    - "root cause analysis", "5 whys"
    - "Wheel of Misfortune"
    - "lessons learned"
    - "Google SRE cap 15"
    - "no postmortem left unreviewed"
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Diretório `kit/skills/blameless-postmortems/` criado
    - Arquivo `kit/skills/blameless-postmortems/SKILL.md` existe
    - Frontmatter válido com `name: blameless-postmortems` e `description` ≤ 200 chars
    - Seção `## Quando usar` contém pelo menos 5 trigger phrases incluindo "postmortem", "blameless", "Wheel of Misfortune", "no postmortem left unreviewed"
  </acceptance_criteria>
</task>

<task id="36-05-T2" name="Regras absolutas — 8 princípios canônicos da cultura blameless">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção Postmortem — após Plan 01 T2)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 19-28 — shape Regras absolutas)
  </read_first>
  <action>
    Adicionar seção `## Regras absolutas` com 8 bullets:

    ```markdown
    ## Regras absolutas

    - **Foco em sistema/processo, NÃO em pessoas** — root cause é "ausência de canary release" ou "RPS limit não documentado", NÃO "Maria fez deploy errado". Pessoas são parte do sistema. Se Maria errou, pergunte: "que processo permitiu o erro chegar a prod?".
    - **Trigger postmortem para SEV1/SEV2 + near-miss notáveis** — todo incident customer-facing com impacto ≥ 1 min de SLO burn ou ≥ 1 user reportado. Near-miss (incident detectado antes de impacto) também: oportunidade de aprender sem custo.
    - **"No postmortem left unreviewed"** — todo postmortem revisado por par sênior antes de arquivar. Sem revisão, postmortem mente (involuntariamente — autor está perto demais).
    - **Action items SMART com owner nomeado** — Specific, Measurable, Assignable, Realistic, Time-bound. "Melhorar monitoring" NÃO é SMART. "Adicionar alert SLO burn rate em /api/v1/orders por @bob até 2026-05-15" É SMART.
    - **Timeline em UTC** — não "horário local Brasília" ou ambíguo. Times distribuídos compõem timeline e UTC é o único timezone universal. Sempre `HH:MM UTC`.
    - **Quantificar impact** — usuários afetados (número/percentual), revenue impact, SLO budget consumido. Sem quantificação, severity é subjetivo.
    - **Lições generalizáveis, não específicas** — "Adicionar alert para essa query específica" é local. "Adicionar alert SLO em todas as queries de write em paths críticos" é generalizável.
    - **Wheel of Misfortune trimestral** — exercício de role-play onde uma pessoa narra um incident histórico e o time pratica response (sem dados reais expostos a stress real). Treina muscle memory para SEV1.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Regras absolutas` contém 8 bullets
    - Contém literalmente: `Foco em sistema/processo, NÃO em pessoas`, `SEV1/SEV2`, `No postmortem left unreviewed`, `SMART`, `UTC`, `Quantificar impact`, `Lições generalizáveis`, `Wheel of Misfortune`
  </acceptance_criteria>
</task>

<task id="36-05-T3" name="Patterns canônicos — template completo + 5 whys + Wheel of Misfortune">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção b — template postmortem; subseção c — pattern timeline UTC)
    - D:/projetos/opensource/mcp/kit/skills/core-analysis-loop/SKILL.md (precedente — Core Analysis Loop alimenta postmortem com root cause)
  </read_first>
  <action>
    Adicionar seção `## Patterns canônicos` com 5 sub-patterns:

    **`### Pattern: template canônico de postmortem (9 seções)`** — bloco de código Markdown completo:

    ````markdown
    ```markdown
    # Postmortem: <incident-id> — <título-curto>

    **Data do incident:** YYYY-MM-DD
    **Autores:** <nomes>
    **Status:** Draft | Reviewed | Final
    **Severidade:** SEV1 | SEV2 | SEV3
    **Tempo até detecção:** XX min (entre trigger e alerta)
    **Tempo até resolução:** XX min (entre alerta e SLO restored)

    ## Summary

    1-2 parágrafos: o que aconteceu, quem foi afetado, como foi resolvido.
    Escrito para audiência não-técnica (executivos, customer success, support).

    ## Impact

    - Usuários afetados: XX% (X de Y usuários ativos no período)
    - Duração: HH:MM (de HH:MM UTC a HH:MM UTC)
    - SLO budget consumido: X% do budget mensal
    - Revenue impact: $X (estimado por # de transações falhadas × ticket médio)
    - Serviços downstream impactados: <lista>
    - Customer support tickets gerados: X
    - Reputação/marca: <impacto qualitativo, se houver>

    ## Root Causes

    Condição mais profunda que, removida, previne recorrência.
    NÃO é "deploy do fulano" ou "código tinha bug" — é a condição sistêmica que
    permitiu o bug chegar a prod (ausência de canary, ausência de SLO alert,
    teste não cobria o caso).

    Use **5 Whys** para chegar lá. Pode haver múltiplas root causes (separadas
    em subseções `### Root Cause 1`, `### Root Cause 2`).

    ## Trigger

    Evento que iniciou a falha (deploy X às HH:MM UTC, config change Y, traffic
    spike Z, dependency outage W). Trigger ≠ Root Cause — trigger é o "quando";
    root cause é o "porquê o trigger virou incident".

    ## Resolution

    Passos tomados para recuperar serviço, em ordem cronológica com horários UTC:

    - HH:MM UTC — <ação>
    - HH:MM UTC — <ação>

    Inclui rollbacks, hotfixes, scaling decisions, manual interventions.

    ## Detection

    Como descobrimos: alerta SLO burn rate? cliente reportou? monitoramento
    interno? heartbeat?

    Tempo de detecção (gap entre trigger e detecção). Se > 5 min, action item
    para reduzir.

    ## Action Items

    | # | Action (SMART) | Owner | Priority | Due |
    |---|----------------|-------|----------|-----|
    | 1 | Adicionar SLO burn rate alert em /api/v1/orders/{id} | @bob | P0 | 2026-05-15 |
    | 2 | Documentar RPS limit por tier em runbook do orders-service | @alice | P1 | 2026-05-22 |
    | 3 | Implementar canary release em CI para todos os Edge Functions | @platform | P1 | 2026-06-01 |

    ## Lessons Learned

    Insights generalizáveis. Estrutura recomendada:

    ### O que fizemos bem
    - <coisa que funcionou — reforçar>

    ### Onde podemos melhorar
    - <gap identificado, generalizável a outros sistemas>

    ### Foi lucky?
    - <foi sorte que detectamos rápido? que não escalou? — capturar para fix proativo>

    ## Timeline (UTC)

    - 14:23 — <evento>
    - 14:27 — <evento>
    - 14:33 — <evento>
    - 14:42 — <evento>
    - 15:25 — Incident resolvido

    ## Supporting evidence

    - Link para incident channel #inc-2026-05-06-01
    - Link para SLO dashboard
    - Link para investigation .planning/investigations/<id>.md (de incident-investigator v1.9)
    - Screenshots/queries de chave
    ```
    ````

    **`### Pattern: 5 whys para encontrar root cause`** — exemplo passo a passo:

    ```text
    Sintoma: SLO burn rate de checkout_success disparou às 14:31 UTC.

    Why 1: Por que o burn rate disparou?
    → Porque taxa de erro em /api/v1/orders saltou de 0.05% para 8%.

    Why 2: Por que a taxa de erro saltou?
    → Porque deploy v2.3.0 introduziu N+1 query.

    Why 3: Por que o deploy v2.3.0 chegou a prod com N+1?
    → Porque o teste de carga não cobria carrinhos com > 10 itens.

    Why 4: Por que o teste de carga não cobria > 10 itens?
    → Porque o teste foi escrito antes do feature de "bulk add to cart" e não foi atualizado.

    Why 5: Por que o teste não foi atualizado quando bulk add foi mergeado?
    → Porque não há gate de CI que exige re-rodar load test ao mudar paths críticos.

    ROOT CAUSE: ausência de gate de CI obrigando re-rodar load test em mudanças de paths críticos.
    ACTION ITEM: implementar gate `load-test-required-for-critical-paths` no CI.
    ```

    **`### Pattern: revisão por par sênior ("no postmortem left unreviewed")`** — checklist:

    ```markdown
    Reviewer pergunta autor:

    1. **Root cause é sistêmico, não pessoal?** — se cita pessoa, redirecionar para processo
    2. **Action items são SMART?** — owner nomeado, due date, mensurável
    3. **Timeline em UTC?** — sem ambiguidade timezone
    4. **Impact quantificado?** — # usuários, duração, revenue
    5. **Lessons generalizáveis?** — aplicáveis a outros serviços/incidents
    6. **Detection time razoável?** — < 5 min ideal; se > 5, action item para reduzir
    7. **Algo "lucky" capturado?** — foi sorte? Como remover dependência de sorte?
    8. **5 whys aplicado?** — ou parou em "deploy ruim" sem ir mais fundo?
    ```

    **`### Pattern: Wheel of Misfortune (training canônico)`**:

    ```text
    Frequência: trimestral (1× por quarter)
    Duração: 60-90 min
    Participantes: time on-call + interessados (4-8 pessoas idealmente)

    Setup:
    1. Facilitator escolhe um postmortem REAL de incident passado (>3 meses,
       para não ter risco emocional fresco) — pode ser de outro time/empresa.
    2. Facilitator narra timeline progressivamente, parando em pontos-chave.
    3. Em cada parada, time discute: "O que vocês fariam agora? Por quê?"
    4. Comparar respostas com decisão real do incident.
    5. Discutir: "Quais decisões foram boas? Quais foram piores em retrospecto?"

    Resultado:
    - Time pratica response sem stress real
    - Identifica gaps de conhecimento (nem todos sabem sobre runbook X)
    - Cria muscle memory para próximo SEV1
    - Materializa lições do postmortem original em ação prática

    Anti-objetivo:
    NÃO é "humilhar quem tomou decisão errada no incident original".
    É blameless training — focar em sistema/processo de decisão.
    ```

    **`### Pattern: postmortem chain — `/forense` → `/postmortem`** (ponte com framework):

    ```text
    Fluxo natural após incident:

    1. Detecção: alerta SLO burn rate dispara → on-call ack → Slack channel #inc-NN
    2. Mitigation: rollback ou hotfix → SLO restored → incident closed
    3. /forense (framework v1.10): Core Analysis Loop sobre logs/git/state →
       gera .planning/investigations/<id>.md com hipóteses validadas e root cause
    4. /postmortem --from-investigation <id> (Phase 38):
       postmortem-writer (Phase 37) consome <id>.md e gera template preenchido
       em .planning/postmortems/<id>.md
    5. Reviewer lê draft e exige fixes (no postmortem left unreviewed)
    6. Final marked + archived em milestone correspondente
    7. Action items P0 viram phases inseridas no roadmap próximo (`/inserir-fase`)
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Patterns canônicos` contém 5 sub-patterns: `### Pattern: template canônico de postmortem`, `### Pattern: 5 whys`, `### Pattern: revisão por par sênior`, `### Pattern: Wheel of Misfortune`, `### Pattern: postmortem chain`
    - Template canônico contém os 9 headers literais: `## Summary`, `## Impact`, `## Root Causes`, `## Trigger`, `## Resolution`, `## Detection`, `## Action Items`, `## Lessons Learned`, `## Timeline (UTC)`
    - Pattern 5 whys mostra 5 perguntas "Why" sequenciais até chegar a root cause sistêmico
    - Checklist de revisão lista 8 perguntas
    - Wheel of Misfortune especifica frequência trimestral, duração 60-90 min, 4-8 participantes
    - Pattern de chain `/forense` → `/postmortem` documenta fluxo de 7 passos
  </acceptance_criteria>
</task>

<task id="36-05-T4" name="Anti-patterns — 6 anti-patterns canônicos de postmortem">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção d — anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 6 sub-anti-patterns no shape `ANTI / PROBLEMA / CERTO`:

    **`### ANTI: blame culture`** — postmortem nomeia "fulano fez deploy errado", "@maria não testou direito" → engineers escondem incidents próximos ao limite; psychological safety colapsa; replicação garantida; team rotation aumenta. CERTO: foco em sistema/processo (ausência de canary, ausência de rollback automatizado); pessoas são parte do sistema, NÃO o root cause; revisão por par sênior antes de arquivar.

    **`### ANTI: action items vagos`** — "Melhorar monitoring", "Revisitar processo de deploy", "Investigar mais" → sem owner, sem due date, sem critério de "feito"; ficam pendentes para sempre; mesma falha repete em 6 meses. CERTO: SMART (Specific, Measurable, Assignable, Realistic, Time-bound) — "Bob adiciona SLO burn alert em /api/v1/orders até 2026-05-15".

    **`### ANTI: postmortem left unreviewed`** — autor escreve, ninguém revisa, vai direto pro arquivo → autor está perto demais (mente involuntariamente sobre próprio papel); root cause errado; lições não-generalizáveis; mesma falha repete porque ação errada foi tomada. CERTO: revisor sênior aplica checklist (8 perguntas — ver Pattern); só depois `Final` status.

    **`### ANTI: postmortem só para SEV1`** — só investigar incident que pagou on-call → near-misses ignorados (oportunidade de aprender sem custo); SEV3s acumulam até virar SEV1; tendências invisíveis. CERTO: SEV1/SEV2 mandatório; SEV3 opcional mas encorajado; near-miss notável (detection rápida evitou impacto) é candidato a postmortem leve (Summary + Impact + Lessons Learned).

    **`### ANTI: timeline ambígua`** — "Por volta das 14h", "After lunch", "Em horário de pico" → reviewers de outros timezones perdem contexto; reconstrução em > 30 dias impossível; análise estatística (MTTR distribution) impossível. CERTO: sempre `HH:MM UTC` no formato 24h; cada evento na timeline com timestamp.

    **`### ANTI: copy-paste de postmortem template sem investigation`** — abrir template, preencher campos genéricos, "Resolution: investigamos e resolvemos" → root cause errado documentado; action items irrelevantes; falha equivalente em 3 meses. CERTO: postmortem nasce de investigation real (Core Analysis Loop, `/forense`, ou logs/state); preencher com EVIDÊNCIAS, não impressões.

    Cada bloco usa shape:

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
    - Seção `## Anti-patterns` contém 6 sub-anti-patterns: `### ANTI: blame culture`, `### ANTI: action items vagos`, `### ANTI: postmortem left unreviewed`, `### ANTI: postmortem só para SEV1`, `### ANTI: timeline ambígua`, `### ANTI: copy-paste de postmortem template sem investigation`
    - Cada um contém literalmente as 3 palavras-âncora `ANTI:`, `PROBLEMA:`, `CERTO:`
  </acceptance_criteria>
</task>

<task id="36-05-T5" name="Verificação + Ver também + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 251-275 — shape Verificação + Ver também + footer)
  </read_first>
  <action>
    Adicionar seções finais.

    **`## Verificação`**:

    ```markdown
    ## Verificação

    Antes de marcar postmortem como `Final`:

    1. **9 seções canônicas presentes** — Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC
    2. **Root cause sistêmico** — não nomeia pessoa; passou pelo 5 whys
    3. **Action items SMART** — Specific, Measurable, Assignable (owner @user), Realistic, Time-bound (due date)
    4. **Timeline em UTC** — sem timezone ambíguo
    5. **Impact quantificado** — # usuários, duração HH:MM, SLO budget consumido, revenue
    6. **Lições generalizáveis** — aplicáveis a outros serviços/incidents
    7. **Reviewed por par sênior** — checklist 8 perguntas aplicado
    8. **Supporting evidence linkada** — investigation, dashboards, queries
    9. **Action items P0 escalonados** — viraram phases ou tasks no roadmap próximo
    ```

    **`## Ver também`**:

    ```markdown
    ## Ver também

    - [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos postmortem, blameless, root cause, Wheel of Misfortune
    - [`core-analysis-loop`](../core-analysis-loop/SKILL.md) (v1.9) — Core Analysis Loop alimenta investigation que vira postmortem
    - [`sre-risk-management`](../sre-risk-management/SKILL.md) — postmortem documenta budget consumido
    - [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Emergency Response" exige postmortem culture
    - [`eliminating-toil`](../eliminating-toil/SKILL.md) — toil-induced incidents geram postmortems
    ```

    **Footer:**

    ```markdown
    ---

    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 15: "Postmortem Culture: Learning from Failure".*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Verificação` contém checklist de 9 itens (1 por seção do template + reviews + supporting evidence + escalation)
    - Seção `## Ver também` lista exatamente 5 cross-refs Markdown relativos
    - Footer cita literalmente `Cap 15: "Postmortem Culture"`
    - Arquivo total ≤ 16 KB (denso pelo template completo)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/blameless-postmortems/SKILL.md` existe
- [ ] Frontmatter válido (`name: blameless-postmortems`, `description ≤ 200 chars`)
- [ ] 6 seções presentes
- [ ] Cobre cap 15: template 9 seções + cultura blameless + no postmortem left unreviewed + Wheel of Misfortune
- [ ] Auto-contida — template canônico inteiro inline (não apenas referência ao glossário)
- [ ] Cobre SKFD-SRE-04 integralmente

## Must-haves (goal-backward)

1. Skill `blameless-postmortems/SKILL.md` existe com frontmatter triggerável
2. Template canônico com 9 seções inline (Summary/Impact/Root Causes/Trigger/Resolution/Detection/Action Items/Lessons Learned/Timeline UTC)
3. Cultura blameless documentada explicitamente — foco em sistema/processo, NÃO pessoas
4. Wheel of Misfortune documentada (frequência, duração, participantes, processo)
5. Pattern de chain `/forense` → `/postmortem` documentado — base para `postmortem-writer` Phase 37 e gate `postmortem-template-required` Phase 41

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Skill é base para Phase 37 agente `postmortem-writer` (gera postmortem do template aqui), Phase 38 comando `/postmortem`, Phase 40 patch INT-FW-V2-01 (`/forense` → `/postmortem` chain), Phase 41 gate `postmortem-template-required`
- Tamanho esperado ~14-16 KB (denso pelo template completo)
