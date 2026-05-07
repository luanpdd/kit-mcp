---
phase: 40
plan: 03
title: Patch /auditar-marco — invocar /auditar-toil quando workflow.audit_milestone_toil=true
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/auditar-marco.md
requirements: [INT-FW-V2-03]
status: ready
---

# Plan 03 — Patch `kit/commands/auditar-marco.md`

## Goal

Adicionar bloco `<sre_integration>` ao comando `/auditar-marco` (v1.7 framework) que **invoca `/auditar-toil` automaticamente** quando `workflow.audit_milestone_toil=true` (default `true`). O `TOIL-AUDIT.md` resultante alimenta scoring de **OMM Capacidade 3 — Complexidade / Tech Debt** do `omm-auditor` (já integrado em Phase 39 / INT-OBS-02). Cobre cap 5 livro Google SRE (*Eliminating Toil*) — regra ≤ 50% de toil pelo time / fechamento do loop `auditar-marco → auditar-toil → omm-auditor`. Frontmatter (`description`, `allowed-tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-FW-V2-03**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/commands/auditar-marco.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `name: auditar-marco`, `description: Audita a conclusão do milestone contra a intenção original antes de arquivar`, `argument-hint: "[version]"`, `allowed-tools` (`Read, Glob, Grep, Bash, Task, Write`) preservados byte-a-byte (note: este command tem `Task` no allowed-tools, ≠ `concluir-marco`)
- **Workflow `.claude/framework/workflows/audit-milestone.md` NÃO alterado** — patch é editorial no command em `kit/commands/`; lógica de execução continua intacta
- **Bloco `<observability_integration>` v1.9 PRESERVADO** — INT-FW-04 (OMM scoring via `/auditar-observabilidade`) continua funcional; novo bloco `<sre_integration>` é **adicionado** após `<observability_integration>`, não substitui
- **Default `true` para gate Toil** — `workflow.audit_milestone_toil=true` por default (paridade com `workflow.audit_milestone_omm=true` — toil audit é não-bloqueante, sempre vale rodar)
- **Loop fechado entre comandos** — `/auditar-marco` → invoca `/auditar-toil` → `toil-auditor` agent gera `TOIL-AUDIT.md` → `omm-auditor` (já integrado em Phase 39 INT-OBS-02) consulta esse arquivo para scorar Capacidade 3 → score volta para `MILESTONE-AUDIT.md` como anexo
- **Cross-ref Markdown ATIVO** — `[eliminating-toil](../skills/eliminating-toil/SKILL.md)` + `[toil-auditor](../agents/toil-auditor.md)` + `[omm-auditor](../agents/omm-auditor.md)` + comando literal `/auditar-toil`
- **Posicionamento canônico** — bloco `<sre_integration>` inserido **após** o bloco `</observability_integration>` (linha ~57, fim do arquivo)
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes do command original

## Tasks

<task id="40-03-T1" name="Verificar estado e localizar âncora de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/auditar-marco.md (frontmatter linhas 1-12 + bloco `<observability_integration>` linhas 38-57 + final do arquivo)
    - D:/projetos/opensource/mcp/kit/commands/auditar-toil.md (verificar comando existe — confirmado)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 1-30 — confirmar nome canônico da skill v1.10/Phase 36)
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (linhas 1-10 — confirmar nome canônico do agent v1.10/Phase 37)
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (linhas 1-30 — confirmar que Phase 39 INT-OBS-02 já patcheou Capacidade 3 com cross-ref para toil-auditor + leitura de `.planning/TOIL-AUDIT.md`)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual byte-idêntico (`name: auditar-marco`, `description: Audita a conclusão do milestone contra a intenção original antes de arquivar`, `argument-hint: "[version]"`, `allowed-tools: [Read, Glob, Grep, Bash, Task, Write]`)
    2. Localizar âncora `</observability_integration>` (esperada linha ~57, fim do arquivo) — bloco `<sre_integration>` será inserido **imediatamente após** essa tag
    3. Confirmar paths de cross-ref: `kit/skills/eliminating-toil/SKILL.md`, `kit/agents/toil-auditor.md`, `kit/agents/omm-auditor.md` existem
    4. Confirmar que `omm-auditor.md` tem patch v1.10 INT-OBS-02 (Phase 39 Plan 02) — Step 0 com check de `.planning/TOIL-AUDIT.md`, Step 1 com tabela 5-row Capacidade 3, Step 4 com exemplo OMM-REPORT.md `### Capacidade 3 — Complexidade / Tech Debt`
    5. Confirmar padrão de naming `workflow.audit_milestone_<thing>` em `<observability_integration>` v1.9 (uses `audit_milestone_omm`) — novo flag `workflow.audit_milestone_toil` segue mesmo padrão
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado (4 campos preservados, incluindo `Task` em allowed-tools)
    - `</observability_integration>` localizada como última tag do arquivo
    - Skill `eliminating-toil` confirmada existir
    - Agents `toil-auditor` e `omm-auditor` confirmados existir
    - Comando `/auditar-toil` confirmado existir em `kit/commands/auditar-toil.md`
    - Patch v1.10 INT-OBS-02 em `omm-auditor.md` confirmado (loop fechado pré-validado)
  </acceptance_criteria>
</task>

<task id="40-03-T2" name="Adicionar bloco <sre_integration> com invocação /auditar-toil">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/auditar-marco.md (re-leitura final do arquivo)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** a linha `</observability_integration>` (última linha do arquivo), uma nova linha em branco e o seguinte bloco como **última seção** do arquivo:

    ```markdown
    <sre_integration>
    **Toil scoring auto-invocação (v1.10 — INT-FW-V2-03):**

    Quando `workflow.audit_milestone_toil = true` (default), o workflow inclui passo Toil audit auto-invocação **antes** do passo de OMM scoring (que já existe via `<observability_integration>` v1.9 — INT-FW-04):

    ```text
    Skill(skill="framework:auditar-toil")
    ```

    O comando `/auditar-toil` invoca o agente [toil-auditor](../agents/toil-auditor.md) que analisa `git log` recente (≤ 90 dias) + scripts shell em `scripts/` + comandos manuais documentados em README/runbooks/`.planning/runbooks/` + tarefas repetitivas em `.planning/phases/*/SUMMARY.md`. O agent classifica candidatos a automação (P0/P1/P2 por esforço × frequência) e produz `.planning/TOIL-AUDIT.md` na raiz do `.planning/`. Cap 5 do livro Google SRE (*Eliminating Toil*) define toil canonicamente: **manual + repetitivo + automatizável + tático + sem valor durável + escala linear com tráfego/team**.

    **Loop fechado canônico:**

    ```text
    /auditar-marco
      ↓
    Step A: invoca /auditar-toil   ← gera .planning/TOIL-AUDIT.md (este patch — INT-FW-V2-03)
      ↓
    Step B: invoca /auditar-observabilidade   ← OMM scoring v1.9 (INT-FW-04)
      ↓
    omm-auditor consulta .planning/TOIL-AUDIT.md   ← Capacidade 3 — Complexidade / Tech Debt (Phase 39 INT-OBS-02)
      ↓
    OMM-REPORT.md inclui Capacidade 3 score derivado de % toil pelo time
      ↓
    MILESTONE-AUDIT.md inclui OMM-REPORT.md + TOIL-AUDIT.md como anexos
    ```

    **Por que rodar `/auditar-toil` ANTES de `/auditar-observabilidade`:**

    O agent `omm-auditor` (Capacidade 3 patcheada em Phase 39 / INT-OBS-02) tem regra absoluta:

    > "score Capacidade 3 > 3 exige TOIL-AUDIT.md fresco ≤ 30 dias com `% toil < 30%`"

    Se TOIL-AUDIT.md ausente ou stale (> 30d), `omm-auditor` delega geração via `Task(subagent_type=toil-auditor)` ad-hoc — duplicação. Auto-invocar `/auditar-toil` em `/auditar-marco` evita essa duplicação ao garantir que `omm-auditor` encontre TOIL-AUDIT.md fresco.

    **Tabela de score Capacidade 3 (consumida por omm-auditor):**

    | % toil pelo time | OMM Capacidade 3 score | Implicação |
    |---|---|---|
    | < 15% | 5 | Excelente — automação madura |
    | 15-30% | 4 | Bom — abaixo regra ≤ 50% cap 5 com folga |
    | 30-50% | 3 | Aceitável — no limite (regra ≤ 50%) |
    | 50-60% | 2 | Risco — acima limite cap 5; team queimando ciclos em toil |
    | > 60% | 1 | Crítico — toil-driven team; scaling linear vai quebrar |

    Cross-ref ativo: tabela acima é replicada em [omm-auditor](../agents/omm-auditor.md) (Step 1 — patcheado em Phase 39 / INT-OBS-02).

    **Output esperado:**

    `.planning/TOIL-AUDIT.md` contém:

    1. % toil pelo time (estimado a partir de git log + scripts shell + runbooks manuais documentados)
    2. Lista de candidatos a automação P0/P1/P2 com:
       - Comando/processo manual identificado
       - Frequência (× por sprint/mês)
       - Esforço estimado de automação (S/M/L)
       - ROI = Frequência × Tempo Manual / Esforço Automação
    3. Sugestões de automação concretas (pg_cron job, hook PostToolUse, kit-mcp command, GitHub Action)
    4. Anti-toil-by-design: action items para `/discutir-fase` capturar toil prevenção upfront em fases futuras

    **Quando desligar gate:**

    - Solo developer side project (toil = você mesmo, audit é overhead)
    - Projeto ≤ 30 dias (sem volume git suficiente para detectar padrões repetitivos)
    - Repo somente bibliotecário sem ops (kit-mcp content-only sem deploy)

    Para esses casos: `workflow.audit_milestone_toil = false`. Para projetos team-based com ops/deploy, **manter `true`**.

    **Skill consultada:** [eliminating-toil](../skills/eliminating-toil/SKILL.md) (cap 5 livro Google SRE — *Eliminating Toil* — define toil canonicamente, regra ≤ 50%, padrões de automação, distinção toil vs overhead vs grungy work).

    **Anti-patterns prevenidos:**

    - "Skipar audit toil porque está OK há tempo" → trabalho cresce, toil cresce com ele; audit obrigatório por milestone
    - "TOIL-AUDIT.md gerado mas ignorado" → omm-auditor Capacidade 3 consome o arquivo; ignorar o relatório = score Cap 3 deteriora visivelmente
    - "Toil = features pequenas" → toil é manual + repetitivo + automatizável (ortogonal a tamanho); 5min × 50× por sprint = 4h por sprint
    - "Toil ≠ overhead" → overhead inclui meetings, planning, code review (necessário, não automatizável); toil é só o automatizable

    **REQ:** INT-FW-V2-03.
    </sre_integration>
    ```

    Posicionamento exato: 1 linha em branco após `</observability_integration>`, depois `<sre_integration>` + conteúdo + `</sre_integration>` como **última seção** do arquivo. Garantir que a sintaxe XML-like das tags casa com o padrão usado em `<observability_integration>` no mesmo arquivo, e que a chamada `Skill(skill="framework:auditar-toil")` segue paridade com a chamada `Skill(skill="framework:auditar-observabilidade")` v1.9 INT-FW-04.
  </action>
  <acceptance_criteria>
    - Bloco `<sre_integration>` existe com tag de abertura e fechamento (count == 1 cada)
    - Heading "Toil scoring auto-invocação" presente
    - Flag `workflow.audit_milestone_toil` mencionado ≥ 2× (descrição + default)
    - Default `true` explicitado (paridade com OMM gate v1.9)
    - Chamada literal `Skill(skill="framework:auditar-toil")` presente
    - Bloco "Loop fechado canônico" com 4 etapas (auditar-marco → auditar-toil → auditar-observabilidade → omm-auditor consulta TOIL-AUDIT.md → MILESTONE-AUDIT.md inclui anexos) presente
    - Bloco "Por que rodar /auditar-toil ANTES de /auditar-observabilidade" com regra "TOIL-AUDIT.md fresco ≤ 30d" presente
    - Tabela 5-row de score Capacidade 3 (< 15% / 15-30% / 30-50% / 50-60% / > 60%) presente — replicada em paridade com `omm-auditor.md` Phase 39 patch
    - Cross-refs Markdown literais `[eliminating-toil](../skills/eliminating-toil/SKILL.md)` E `[toil-auditor](../agents/toil-auditor.md)` E `[omm-auditor](../agents/omm-auditor.md)` presentes
    - Output esperado de `TOIL-AUDIT.md` documentado (4 itens — % toil, candidatos P0/P1/P2 com ROI, sugestões, anti-toil-by-design)
    - Bloco "Quando desligar gate" com 3 contraindicações (solo, ≤ 30 dias, repo bibliotecário sem ops) presente
    - Conteúdo canônico cap 5 (definição toil, regra ≤ 50%, distinção toil vs overhead) explicitado
    - 4 anti-patterns prevenidos listados
    - Frase "REQ: INT-FW-V2-03" presente como rodapé
    - Bloco `<observability_integration>` v1.9 (INT-FW-04 + `audit_milestone_omm` flag) preservado byte-a-byte
    - Frontmatter byte-idêntico ao pré-patch (incluindo `Task` em allowed-tools)
  </acceptance_criteria>
</task>

<task id="40-03-T3" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/auditar-marco.md (re-leitura completa pós-edit)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO (12 primeiras linhas — note allowed-tools tem 6 entries incluindo Task)
    head -12 kit/commands/auditar-marco.md
    # Esperado byte-idêntico ao pré-patch:
    # ---
    # name: auditar-marco
    # description: Audita a conclusão do milestone contra a intenção original antes de arquivar
    # argument-hint: "[version]"
    # allowed-tools:
    #   - Read
    #   - Glob
    #   - Grep
    #   - Bash
    #   - Task
    #   - Write
    # ---

    # 2. Tag de abertura <sre_integration> existe exatamente 1×
    grep -c "^<sre_integration>$" kit/commands/auditar-marco.md  # esperado: 1

    # 3. Tag de fechamento </sre_integration> existe exatamente 1×
    grep -c "^</sre_integration>$" kit/commands/auditar-marco.md  # esperado: 1

    # 4. Bloco <observability_integration> v1.9 PRESERVADO
    grep -c "^<observability_integration>$" kit/commands/auditar-marco.md   # esperado: 1
    grep -c "^</observability_integration>$" kit/commands/auditar-marco.md  # esperado: 1
    grep -c "INT-FW-04" kit/commands/auditar-marco.md                       # esperado: ≥1 (preservado)
    grep -c "audit_milestone_omm" kit/commands/auditar-marco.md             # esperado: ≥1 (preservado)
    grep -c "framework:auditar-observabilidade" kit/commands/auditar-marco.md  # esperado: ≥1 (preservado)

    # 5. Flag novo workflow.audit_milestone_toil
    grep -c "workflow.audit_milestone_toil" kit/commands/auditar-marco.md  # esperado: ≥2

    # 6. Chamada Skill(skill="framework:auditar-toil")
    grep -c "framework:auditar-toil" kit/commands/auditar-marco.md  # esperado: ≥1

    # 7. Cross-refs ATIVOS (3 — skill + 2 agents)
    grep -c "\[eliminating-toil\](../skills/eliminating-toil/SKILL.md)" kit/commands/auditar-marco.md  # esperado: ≥1
    grep -c "\[toil-auditor\](../agents/toil-auditor.md)" kit/commands/auditar-marco.md                # esperado: ≥1
    grep -c "\[omm-auditor\](../agents/omm-auditor.md)" kit/commands/auditar-marco.md                  # esperado: ≥1

    # 8. Conteúdo canônico cap 5
    grep -c "cap 5" kit/commands/auditar-marco.md                # esperado: ≥1
    grep -c "Eliminating Toil" kit/commands/auditar-marco.md     # esperado: ≥1
    grep -c "≤ 50%\|< 50%" kit/commands/auditar-marco.md         # esperado: ≥1

    # 9. Score table 5-row Capacidade 3
    grep -c "| < 15% |" kit/commands/auditar-marco.md       # esperado: ≥1
    grep -c "| 15-30% |" kit/commands/auditar-marco.md      # esperado: ≥1
    grep -c "| 30-50% |" kit/commands/auditar-marco.md      # esperado: ≥1
    grep -c "| 50-60% |" kit/commands/auditar-marco.md      # esperado: ≥1
    grep -c "| > 60% |" kit/commands/auditar-marco.md       # esperado: ≥1

    # 10. Loop canônico — 4 etapas
    grep -c "Loop fechado canônico" kit/commands/auditar-marco.md   # esperado: ≥1
    grep -c "TOIL-AUDIT.md" kit/commands/auditar-marco.md           # esperado: ≥4

    # 11. Regra fresh ≤ 30 dias (paridade com omm-auditor Phase 39)
    grep -c "≤ 30 dias\|≤ 30d\|fresco ≤ 30" kit/commands/auditar-marco.md  # esperado: ≥1

    # 12. Bloco "Quando desligar gate"
    grep -c "Quando desligar gate" kit/commands/auditar-marco.md  # esperado: ≥1

    # 13. REQ-ID rodapé
    grep -c "INT-FW-V2-03" kit/commands/auditar-marco.md  # esperado: ≥1

    # 14. Diff puro de adição
    git diff --numstat kit/commands/auditar-marco.md
    # Esperado: insertions > 0; deletions == 0 (puro additive)

    # 15. Smoke sync — bloco propagado para .claude/commands/
    node bin/cli.js sync install claude-code --mode copy
    grep -c "<sre_integration>" .claude/commands/auditar-marco.md       # esperado: ≥1
    grep -c "audit_milestone_toil" .claude/commands/auditar-marco.md    # esperado: ≥2
    grep -c "framework:auditar-toil" .claude/commands/auditar-marco.md  # esperado: ≥1
    grep -c "INT-FW-V2-03" .claude/commands/auditar-marco.md            # esperado: ≥1
    ```
  </action>
  <acceptance_criteria>
    - `head -12` mostra frontmatter byte-idêntico ao pré-patch (incluindo `Task` em allowed-tools)
    - `grep -c "^<sre_integration>$"` == 1 e `</sre_integration>` == 1
    - Bloco v1.9 `<observability_integration>` preservado (count == 1 cada tag, INT-FW-04, `audit_milestone_omm`, `framework:auditar-observabilidade` ainda presentes)
    - Flag `workflow.audit_milestone_toil` mencionado ≥ 2×
    - Chamada `framework:auditar-toil` literal presente
    - 3 cross-refs Markdown ativos presentes (skill + 2 agents)
    - Conteúdo canônico (cap 5, Eliminating Toil, regra ≤ 50%) presente
    - Score table 5-row Capacidade 3 presente (paridade com `omm-auditor.md` Phase 39)
    - Loop canônico 4 etapas presente
    - `TOIL-AUDIT.md` mencionado ≥ 4× (loop + tabela + output esperado)
    - Regra "fresco ≤ 30 dias" presente (paridade com `omm-auditor.md` Phase 39)
    - Bloco "Quando desligar gate" com 3 contraindicações presente
    - 4 anti-patterns prevenidos listados
    - `INT-FW-V2-03` presente como rodapé do bloco
    - `git diff --numstat` mostra 0 deletions
    - Smoke sync propaga bloco para `.claude/commands/auditar-marco.md`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico (4 campos `name/description/argument-hint/allowed-tools` com 6 entries incluindo `Task`)
- [ ] Bloco `<sre_integration>` adicionado como **última seção** após `</observability_integration>`
- [ ] Flag `workflow.audit_milestone_toil` documentado com default `true` (paridade com `audit_milestone_omm`)
- [ ] Chamada `Skill(skill="framework:auditar-toil")` literal presente (paridade com chamada `framework:auditar-observabilidade` v1.9)
- [ ] Loop fechado canônico documentado (4 etapas: auditar-marco → auditar-toil → auditar-observabilidade → omm-auditor consulta TOIL-AUDIT.md)
- [ ] "Por que rodar /auditar-toil ANTES" explicitado (regra TOIL-AUDIT.md fresco ≤ 30d em `omm-auditor.md` Phase 39)
- [ ] Score table 5-row Capacidade 3 presente — replicada em paridade com `omm-auditor.md` (Phase 39 / INT-OBS-02)
- [ ] Output esperado de `TOIL-AUDIT.md` documentado (4 itens estruturados)
- [ ] Bloco "Quando desligar gate" com 3 contraindicações (solo, ≤ 30 dias, repo bibliotecário)
- [ ] Cross-refs Markdown ATIVOS (skill `eliminating-toil` + agent `toil-auditor` + agent `omm-auditor`)
- [ ] 4 anti-patterns prevenidos listados (skip / ignorar relatório / toil = pequeno / toil ≠ overhead)
- [ ] Conteúdo canônico cap 5 livro Google SRE explicitado
- [ ] Bloco v1.9 `<observability_integration>` (INT-FW-04 + `audit_milestone_omm` flag + chamada `framework:auditar-observabilidade`) preservado byte-a-byte
- [ ] Smoke sync valida bloco propagado para `.claude/commands/auditar-marco.md`
- [ ] Cobre INT-FW-V2-03 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.7+ com `Task` em allowed-tools (anti-pitfall A2)
2. Workflow `.claude/framework/workflows/audit-milestone.md` continua funcional sem alteração (patch é editorial no command, não toca lógica de orquestração)
3. Default `true` para gate (paridade com `audit_milestone_omm=true`) — toil audit é não-bloqueante, sempre vale rodar
4. Loop fechado entre comandos: `/auditar-marco` → `/auditar-toil` → `omm-auditor` consome TOIL-AUDIT.md → score Cap 3 → MILESTONE-AUDIT.md inclui anexos
5. Score table 5-row Capacidade 3 em paridade com `omm-auditor.md` Phase 39 — single source of truth replicada para descoberta cross-command
6. Regra "TOIL-AUDIT.md fresco ≤ 30d" reforça que `omm-auditor` espera artefato fresco — auto-invocação em `/auditar-marco` evita stale
7. 3 contraindicações explícitas para desligar gate (impede gate ligado em projetos sem volume git suficiente)
8. 4 anti-patterns prevenidos
9. Cross-refs ATIVOS para skill (knowledge canônico cap 5) + 2 agents (toil-auditor produz TOIL-AUDIT.md, omm-auditor consome)
10. Smoke sync valida descoberta em `.claude/commands/`

## Notes

- **Patch editorial puro additive** — adiciona ~95 linhas (1 bloco `<sre_integration>` completo); zero linhas removidas/modificadas
- v1.9 (`<observability_integration>` OMM auto-invocação `audit_milestone_omm=true`) e v1.10 (`<sre_integration>` Toil auto-invocação `audit_milestone_toil=true`) coexistem: ordem canônica = `auditar-toil` ANTES de `auditar-observabilidade` (toil-auditor produz TOIL-AUDIT.md → omm-auditor lê para Cap 3)
- Ordem ANTES é importante porque `omm-auditor` (patcheado em Phase 39 INT-OBS-02) tem regra absoluta: score Cap 3 > 3 exige TOIL-AUDIT.md fresco ≤ 30d. Se TOIL-AUDIT.md ausente, omm-auditor delega Task — duplicação evitável
- Score table 5-row Cap 3 é replicada deste arquivo + `omm-auditor.md` Step 1 (Phase 39 / INT-OBS-02) — single source of truth distribuída para discovery cross-command (paridade arquitetural com `four-golden-signals` skill que tem tabelas replicadas em `golden-signals-instrumenter` agent + edge-fn-writer agent — consistente com Phase 36-39)
- Padrão de naming `workflow.audit_milestone_<thing>` consistente entre v1.9 (OMM) e v1.10 (Toil) — facilita descoberta e config
- `toil-auditor` agent (Phase 37) gera `.planning/TOIL-AUDIT.md` na raiz — handoff é file-based via path canônico (≠ PRR-REPORT.md que é em `.planning/prr/<feature-id>-PRR-REPORT.md`)
- Loop completo: `/auditar-marco` (este patch INT-FW-V2-03) + `omm-auditor.md` patch v1.10 (Phase 39 INT-OBS-02) + `toil-auditor.md` agent (Phase 37 AGCORE-SRE-02) + `eliminating-toil` skill (Phase 36 SKFD-SRE-03) — 4 artefatos formando workflow cap 5 SRE coeso
