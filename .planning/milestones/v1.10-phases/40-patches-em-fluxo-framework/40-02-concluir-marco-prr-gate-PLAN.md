---
phase: 40
plan: 02
title: Patch /concluir-marco — gate PRR opcional via workflow.complete_milestone_prr_gate
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/concluir-marco.md
requirements: [INT-FW-V2-02]
status: ready
---

# Plan 02 — Patch `kit/commands/concluir-marco.md`

## Goal

Adicionar bloco `<sre_integration>` ao comando `/concluir-marco` (v1.7 framework) que **introduz gate PRR opcional** controlado por `workflow.complete_milestone_prr_gate=true`. Quando ativo, o gate verifica que **toda feature production-bound** do milestone tem `PRR-REPORT.md` com status `passed` antes de permitir arquivar. Cobre cap 32 livro Google SRE (*Evolving SRE Engagement Model*) — PRR como Production gate evidence-based, não opinion-based. Frontmatter (`description`, `allowed-tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-FW-V2-02**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/commands/concluir-marco.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `type: prompt`, `name: concluir-marco`, `description: Arquiva milestone concluído e prepara para próxima versão`, `argument-hint: "<version>"`, `allowed-tools` (`Read, Write, Bash`) preservados byte-a-byte
- **Workflow `.claude/framework/workflows/complete-milestone.md` NÃO alterado** — patch é editorial no command em `kit/commands/`; lógica de execução (8 passos) continua intacta
- **Bloco `<observability_integration>` v1.9 PRESERVADO** — INT-FW-05 (OMM no-regression gate) continua funcional; novo bloco `<sre_integration>` é **adicionado** após `<observability_integration>`, não substitui
- **Default `false` para gate PRR** — `workflow.complete_milestone_prr_gate=false` por default (evita bloquear users existentes que não usam SRE Engagement v1.10); user explicitamente liga setando `true` em config (paridade com `workflow.complete_milestone_omm_gate=true` mas com default invertido — PRR é newer, opt-in até maturidade)
- **Cross-ref Markdown ATIVO** — `[production-readiness-review](../skills/production-readiness-review/SKILL.md)` + `[prr-conductor](../agents/prr-conductor.md)` + comando literal `/prr --service|--feature`
- **Posicionamento canônico** — bloco `<sre_integration>` inserido **após** o bloco `</observability_integration>` (linha ~154, fim do arquivo)
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes do command original

## Tasks

<task id="40-02-T1" name="Verificar estado e localizar âncora de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/concluir-marco.md (frontmatter linhas 1-10 + bloco `<observability_integration>` linhas 138-154 + final do arquivo)
    - D:/projetos/opensource/mcp/kit/commands/prr.md (verificar comando existe — confirmado)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 1-30 — confirmar nome canônico da skill v1.10/Phase 36)
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (linhas 1-10 — confirmar nome canônico do agent v1.10/Phase 37)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual byte-idêntico (`type: prompt`, `name: concluir-marco`, `description: Arquiva milestone concluído e prepara para próxima versão`, `argument-hint: "<version>"`, `allowed-tools: [Read, Write, Bash]`)
    2. Localizar âncora `</observability_integration>` (esperada linha ~154, fim do arquivo) — bloco `<sre_integration>` será inserido **imediatamente após** essa tag
    3. Confirmar paths de cross-ref: `kit/skills/production-readiness-review/SKILL.md` e `kit/agents/prr-conductor.md` existem
    4. Confirmar que `<observability_integration>` v1.9 referencia `workflow.complete_milestone_omm_gate` — novo flag `workflow.complete_milestone_prr_gate` segue mesmo padrão de naming
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado (5 campos preservados)
    - `</observability_integration>` localizada como última tag do arquivo
    - Skill `production-readiness-review` confirmada existir
    - Agent `prr-conductor` confirmado existir
    - Comando `/prr` confirmado existir em `kit/commands/prr.md`
    - Padrão de naming `workflow.complete_milestone_<gate>_gate` confirmado em `<observability_integration>` v1.9
  </acceptance_criteria>
</task>

<task id="40-02-T2" name="Adicionar bloco <sre_integration> com gate PRR opcional">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/concluir-marco.md (re-leitura final do arquivo)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** a linha `</observability_integration>` (última linha do arquivo), uma nova linha em branco e o seguinte bloco como **última seção** do arquivo:

    ```markdown
    <sre_integration>
    **PRR gate opcional para features production-bound (v1.10 — INT-FW-V2-02):**

    Quando `workflow.complete_milestone_prr_gate = true` (default `false` — opt-in até maturidade SRE Engagement do projeto), o workflow inclui passo PRR coverage check **antes de arquivar** o milestone:

    1. Listar features production-bound do milestone (heurística: features com Edge Functions deployed, features com SLO definido em `.planning/slos/`, features marcadas explicitamente `production: true` em ROADMAP.md ou em `.planning/phases/<N>-CONTEXT.md`)
    2. Para cada feature production-bound, procurar `.planning/prr/<feature-id>-PRR-REPORT.md` (cross-ref [prr-conductor](../agents/prr-conductor.md) — agent que produz o relatório scored em 6 axes do cap 32)
    3. Verificar status do PRR-REPORT.md:
       - Se ausente: BLOQUEAR conclusion — sugerir `/prr --feature "<descrição>"` ou `/sre prr --feature "..."` antes de re-rodar `/concluir-marco`
       - Se presente mas status `failed` (≥ 1 axe P0 reprovado): BLOQUEAR conclusion — listar axes P0 reprovados e exigir remediation
       - Se presente com status `passed`: incluir `PRR-REPORT.md` como anexo no `.planning/milestones/v<version>-MILESTONE.md` (audit trail)
    4. Quando todos os PRRs de features production-bound forem `passed`: prosseguir para passo 7 (commit + tag) do workflow `complete-milestone.md`

    **Distinção `passed` vs `failed`:**

    | Status | Definição | Resultado em /concluir-marco |
    |---|---|---|
    | `passed` | Todos os 6 axes scored ≥ 3/5 (cap 32 — System Architecture / Instrumentation / Emergency Response / Capacity Planning / Change Management / Performance) | Milestone arquivável (gate aprova) |
    | `passed-with-warnings` | 6/6 axes ≥ 3/5 mas ≥ 1 axe com action items P1 não resolvidos | Milestone arquivável; warnings explícitos no archive |
    | `failed` | ≥ 1 axe < 3/5 OU ≥ 1 action item P0 não resolvido | Gate BLOQUEIA — exige remediation antes de arquivar |

    **Default `false` por design:**

    `workflow.complete_milestone_prr_gate` default `false` (≠ `complete_milestone_omm_gate` que é `true`) — PRR Engagement Model do livro Google SRE assume **maturidade organizacional** (SRE team, on-call rotation, incident response). Para projetos em early stage / dogfooding, gate `false` é o correto. Quando o projeto atinge tier-1 (production-user-facing, paid tier, SLA contratual), user explicitamente liga setando `workflow.complete_milestone_prr_gate=true` no config.

    **Quando ligar gate:**

    - Projeto tem feature user-facing pagante (≥ 1 jornada crítica monetizada)
    - Projeto tem SLO definido em `.planning/slos/` com error budget tracking
    - Projeto tem on-call rotation documentada em runbook
    - Projeto tem postmortem culture estabelecida (≥ 1 postmortem blameless escrito em `.planning/postmortems/`)
    - **Pelo menos 2 dos 4 acima** = liga gate (sinal de production maturity)

    **Quando manter gate desligado:**

    - Projeto early stage / dogfooding interno (sem usuário pagante)
    - Solo developer side project sem on-call
    - Pesquisa / POC / experimento (não production-bound por design)
    - Equipe ainda construindo SRE muscle (PRR vira teatro se não há cultura de remediation)

    **Skill consultada:** [production-readiness-review](../skills/production-readiness-review/SKILL.md) (cap 32 livro Google SRE — *Evolving SRE Engagement Model* — define os 6 axes + 3 engagement models: Simple, Early Engagement, Frameworks/SRE Platform).

    **Gate executável:** `gates/prr-checklist-coverage.md` (criado em Phase 41 — QA-SRE-03). Workflow `.claude/framework/workflows/complete-milestone.md` consulta esse gate quando flag `true`.

    **Anti-patterns prevenidos:**

    - "Marcar feature como production-bound mas pular PRR" → gate exige PRR-REPORT.md presente
    - "PRR-REPORT.md gerado mas status `failed`" → gate exige `passed` (não basta existir)
    - "Auto-PRR pelo time dev" → cross-ref [prr-conductor](../agents/prr-conductor.md) reforça que `prr-conductor` agent é par externo (não o mesmo agent que escreveu a feature)
    - "Gate ligado em projeto early stage" → bloco "Quando ligar gate" exige ≥ 2 sinais de production maturity

    **REQ:** INT-FW-V2-02.
    </sre_integration>
    ```

    Posicionamento exato: 1 linha em branco após `</observability_integration>`, depois `<sre_integration>` + conteúdo + `</sre_integration>` como **última seção** do arquivo. Garantir que a sintaxe XML-like das tags casa com o padrão usado em `<observability_integration>` no mesmo arquivo.
  </action>
  <acceptance_criteria>
    - Bloco `<sre_integration>` existe com tag de abertura e fechamento (count == 1 cada)
    - Heading "PRR gate opcional para features production-bound" presente
    - Flag `workflow.complete_milestone_prr_gate` mencionado ≥ 2× (descrição + default)
    - Default `false` explicitado (≠ OMM gate que é `true`)
    - Tabela 3-row Status (`passed` / `passed-with-warnings` / `failed`) presente
    - 4 passos do gate (listar features → procurar PRR-REPORT.md → verificar status → arquivar) presentes
    - Cross-refs Markdown literais `[production-readiness-review](../skills/production-readiness-review/SKILL.md)` E `[prr-conductor](../agents/prr-conductor.md)` presentes
    - Comando literal `/prr --feature` ou `/sre prr --feature` mencionado ≥ 1×
    - Bloco "Quando ligar gate" com 4 condições + regra "≥ 2 dos 4" presente
    - Bloco "Quando manter gate desligado" com 4 contraindicações presente
    - "cap 32" referenciado ≥ 1× (livro Google SRE)
    - 4 anti-patterns prevenidos listados
    - Gate file `gates/prr-checklist-coverage.md` referenciado (Phase 41 — QA-SRE-03)
    - Frase "REQ: INT-FW-V2-02" presente como rodapé
    - Bloco `<observability_integration>` v1.9 (INT-FW-05) preservado byte-a-byte
    - Frontmatter byte-idêntico ao pré-patch
  </acceptance_criteria>
</task>

<task id="40-02-T3" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/concluir-marco.md (re-leitura completa pós-edit)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO (10 primeiras linhas)
    head -10 kit/commands/concluir-marco.md
    # Esperado byte-idêntico ao pré-patch:
    # ---
    # type: prompt
    # name: concluir-marco
    # description: Arquiva milestone concluído e prepara para próxima versão
    # argument-hint: "<version>"
    # allowed-tools:
    #   - Read
    #   - Write
    #   - Bash
    # ---

    # 2. Tag de abertura <sre_integration> existe exatamente 1×
    grep -c "^<sre_integration>$" kit/commands/concluir-marco.md  # esperado: 1

    # 3. Tag de fechamento </sre_integration> existe exatamente 1×
    grep -c "^</sre_integration>$" kit/commands/concluir-marco.md  # esperado: 1

    # 4. Bloco <observability_integration> v1.9 PRESERVADO
    grep -c "^<observability_integration>$" kit/commands/concluir-marco.md   # esperado: 1
    grep -c "^</observability_integration>$" kit/commands/concluir-marco.md  # esperado: 1
    grep -c "INT-FW-05" kit/commands/concluir-marco.md                       # esperado: ≥1 (preservado)
    grep -c "complete_milestone_omm_gate" kit/commands/concluir-marco.md     # esperado: ≥1 (preservado)

    # 5. Flag novo workflow.complete_milestone_prr_gate
    grep -c "workflow.complete_milestone_prr_gate" kit/commands/concluir-marco.md  # esperado: ≥2

    # 6. Cross-refs ATIVOS
    grep -c "\[production-readiness-review\](../skills/production-readiness-review/SKILL.md)" kit/commands/concluir-marco.md  # esperado: ≥1
    grep -c "\[prr-conductor\](../agents/prr-conductor.md)" kit/commands/concluir-marco.md                                    # esperado: ≥1

    # 7. Comando literal /prr mencionado
    grep -c "/prr --feature\|/sre prr --feature" kit/commands/concluir-marco.md  # esperado: ≥1

    # 8. Conteúdo canônico cap 32
    grep -c "cap 32" kit/commands/concluir-marco.md                  # esperado: ≥1
    grep -c "Evolving SRE Engagement Model" kit/commands/concluir-marco.md  # esperado: ≥1
    grep -c "production-bound" kit/commands/concluir-marco.md        # esperado: ≥3

    # 9. Status table 3-row
    grep -c "| \`passed\` |" kit/commands/concluir-marco.md             # esperado: ≥1
    grep -c "| \`passed-with-warnings\` |" kit/commands/concluir-marco.md  # esperado: ≥1
    grep -c "| \`failed\` |" kit/commands/concluir-marco.md             # esperado: ≥1

    # 10. Bloco "Quando ligar gate" com regra "≥ 2 dos 4"
    grep -c "Quando ligar gate" kit/commands/concluir-marco.md     # esperado: ≥1
    grep -c "≥ 2 dos 4\|2 dos 4" kit/commands/concluir-marco.md   # esperado: ≥1

    # 11. Gate file referenciado (Phase 41)
    grep -c "gates/prr-checklist-coverage.md\|prr-checklist-coverage" kit/commands/concluir-marco.md  # esperado: ≥1

    # 12. REQ-ID rodapé
    grep -c "INT-FW-V2-02" kit/commands/concluir-marco.md  # esperado: ≥1

    # 13. Diff puro de adição
    git diff --numstat kit/commands/concluir-marco.md
    # Esperado: insertions > 0; deletions == 0 (puro additive)

    # 14. Smoke sync — bloco propagado para .claude/commands/
    node bin/cli.js sync install claude-code --mode copy
    grep -c "<sre_integration>" .claude/commands/concluir-marco.md           # esperado: ≥1
    grep -c "complete_milestone_prr_gate" .claude/commands/concluir-marco.md  # esperado: ≥2
    grep -c "INT-FW-V2-02" .claude/commands/concluir-marco.md                # esperado: ≥1
    ```
  </action>
  <acceptance_criteria>
    - `head -10` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^<sre_integration>$"` == 1 e `</sre_integration>` == 1
    - Bloco v1.9 `<observability_integration>` preservado (count == 1 cada tag, INT-FW-05 e `complete_milestone_omm_gate` ainda presentes)
    - Flag `workflow.complete_milestone_prr_gate` mencionado ≥ 2×
    - 2 cross-refs Markdown ativos presentes (skill + agent)
    - `/prr --feature` ou `/sre prr --feature` mencionado ≥ 1×
    - Conteúdo canônico (cap 32, Evolving SRE Engagement Model, production-bound) presente
    - Status table 3-row (`passed` / `passed-with-warnings` / `failed`) presente
    - Bloco "Quando ligar gate" com regra "≥ 2 dos 4" presente
    - Gate file `prr-checklist-coverage` referenciado (Phase 41 — QA-SRE-03)
    - `INT-FW-V2-02` presente como rodapé do bloco
    - `git diff --numstat` mostra 0 deletions
    - Smoke sync propaga bloco para `.claude/commands/concluir-marco.md`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico (5 campos `type/name/description/argument-hint/allowed-tools`)
- [ ] Bloco `<sre_integration>` adicionado como **última seção** após `</observability_integration>`
- [ ] Flag `workflow.complete_milestone_prr_gate` documentado com default `false` (opt-in)
- [ ] 4 passos do gate documentados (listar production-bound features → procurar PRR-REPORT.md → verificar status → arquivar)
- [ ] Status table 3-row (`passed`, `passed-with-warnings`, `failed`) com regras de gate explícitas
- [ ] Bloco "Quando ligar gate" com 4 condições + regra "≥ 2 dos 4 = liga gate"
- [ ] Bloco "Quando manter gate desligado" com 4 contraindicações (early stage, solo, POC, sem cultura remediation)
- [ ] Cross-refs Markdown ATIVOS (skill `production-readiness-review` + agent `prr-conductor`)
- [ ] Comando `/prr --feature` ou `/sre prr --feature` literal presente
- [ ] Gate file `gates/prr-checklist-coverage.md` referenciado (Phase 41 — QA-SRE-03)
- [ ] 4 anti-patterns prevenidos listados
- [ ] Conteúdo canônico cap 32 livro Google SRE explicitado
- [ ] Bloco v1.9 `<observability_integration>` (INT-FW-05) preservado byte-a-byte
- [ ] Smoke sync valida bloco propagado para `.claude/commands/concluir-marco.md`
- [ ] Cobre INT-FW-V2-02 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.7+ (anti-pitfall A2)
2. Workflow `.claude/framework/workflows/complete-milestone.md` continua funcional sem alteração (patch é editorial no command, não toca lógica de 8 passos)
3. Default `false` para gate (≠ OMM gate que é `true`) — opt-in até maturidade SRE
4. Critério explícito ≥ 2 dos 4 sinais de production maturity para ligar gate (impede gate ligado prematuramente)
5. Status table 3-row deixa claro o que `passed` significa (≠ apenas "PRR-REPORT.md existe")
6. Cross-refs ATIVOS para skill (knowledge canônico cap 32) + agent (conductor que executa)
7. Comando `/prr` documentado como remediation path (não dead-end quando gate bloqueia)
8. Gate file Phase 41 (`prr-checklist-coverage`) referenciado para fechar loop
9. Smoke sync valida descoberta em `.claude/commands/`

## Notes

- **Patch editorial puro additive** — adiciona ~75 linhas (1 bloco `<sre_integration>` completo); zero linhas removidas/modificadas
- v1.9 (`<observability_integration>` OMM regression gate `complete_milestone_omm_gate=true`) e v1.10 (`<sre_integration>` PRR gate `complete_milestone_prr_gate=false`) coexistem: ambos são gates pré-arquivo, OMM mede observability maturity, PRR mede production readiness
- Default invertido (OMM `true` vs PRR `false`) é intencional — OMM existe há um milestone (v1.9 publicada), users já tiveram tempo de adaptar; PRR é newer (v1.10), opt-in até maturidade
- Padrão de naming `workflow.complete_milestone_<gate>_gate` consistente entre v1.9 (OMM) e v1.10 (PRR) — facilita descoberta
- Phase 41 cria gate executável `gates/prr-checklist-coverage.md` (QA-SRE-03) que verifica os 6 axes em PRR-REPORT.md — workflow `.claude/framework/workflows/complete-milestone.md` consulta esse gate quando flag `true`
- `prr-conductor` agent (Phase 37) gera `PRR-REPORT.md` em `.planning/prr/<feature-id>-PRR-REPORT.md` — handoff é file-based via path canônico
