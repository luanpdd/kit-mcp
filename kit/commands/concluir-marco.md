---
type: prompt
name: concluir-marco
description: Arquiva milestone concluído e prepara para próxima versão
argument-hint: "<version>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Marcar milestone {{version}} como completo, arquivar em milestones/ e atualizar ROADMAP.md e REQUIREMENTS.md.

Propósito: Criar registro histórico da versão entregue, arquivar artefatos do milestone (roadmap + requisitos) e preparar para o próximo milestone.
Saída: Milestone arquivado (roadmap + requisitos), PROJECT.md evoluído, tag git criado.
</objective>

<execution_context>
**Carregar estes arquivos AGORA (antes de prosseguir):**

- @./.claude/framework/workflows/complete-milestone.md (workflow principal)
- @./.claude/framework/templates/milestone-archive.md (template de arquivo)
  </execution_context>

<context>
**Arquivos do projeto:**
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`

**Entrada do usuário:**

- Versão: {{version}} (ex: "1.0", "1.1", "2.0")
  </context>

<process>

**Seguir o workflow complete-milestone.md:**

0. **Verificar auditoria:**

   - Procurar `.planning/v{{version}}-MILESTONE-AUDIT.md`
   - Se ausente ou desatualizado: recomendar `/auditar-marco` primeiro
   - Se status da auditoria for `gaps_found`: recomendar `/planejar-lacunas` primeiro
   - Se status da auditoria for `passed`: prosseguir para o passo 1

   ```markdown
   ## Verificação Pré-voo

   {Se não houver v{{version}}-MILESTONE-AUDIT.md:}
   ⚠ Nenhuma auditoria de milestone encontrada. Execute `/auditar-marco` primeiro para verificar
   cobertura de requisitos, integração entre fases e fluxos E2E.

   {Se a auditoria tiver lacunas:}
   ⚠ Auditoria de milestone encontrou lacunas. Execute `/planejar-lacunas` para criar
   fases que fechem as lacunas, ou prossiga assim mesmo para aceitar como dívida técnica.

   {Se a auditoria passou:}
   ✓ Auditoria de milestone aprovada. Prosseguindo com a conclusão.
   ```

1. **Verificar prontidão:**

   - Checar se todas as fases do milestone têm planos concluídos (SUMMARY.md existe)
   - Apresentar escopo e estatísticas do milestone
   - Aguardar confirmação

2. **Coletar estatísticas:**

   - Contar fases, planos, tarefas
   - Calcular intervalo git, alterações de arquivo, LOC
   - Extrair cronograma do git log
   - Apresentar resumo, confirmar

3. **Extrair realizações:**

   - Ler todos os arquivos SUMMARY.md das fases no intervalo do milestone
   - Extrair 4-6 realizações principais
   - Apresentar para aprovação

4. **Arquivar milestone:**

   - Criar `.planning/milestones/v{{version}}-ROADMAP.md`
   - Extrair detalhes completos das fases do ROADMAP.md
   - Preencher template milestone-archive.md
   - Atualizar ROADMAP.md para resumo de uma linha com link

5. **Arquivar requisitos:**

   - Criar `.planning/milestones/v{{version}}-REQUIREMENTS.md`
   - Marcar todos os requisitos v1 como completos (checkboxes marcados)
   - Registrar resultados dos requisitos (validado, ajustado, descartado)
   - Deletar `.planning/REQUIREMENTS.md` (novo será criado para o próximo milestone)

6. **Atualizar PROJECT.md:**

   - Adicionar seção "Estado Atual" com versão entregue
   - Adicionar seção "Objetivos do Próximo Milestone"
   - Arquivar conteúdo anterior em `<details>` (se v1.1+)

7. **Commit e tag:**

   - Stagear: MILESTONES.md, PROJECT.md, ROADMAP.md, STATE.md, arquivos de arquivo
   - Commit: `chore: archive v{{version}} milestone`
   - Tag: `git tag -a v{{version}} -m "[resumo do milestone]"`
   - Perguntar sobre push da tag

8. **Oferecer próximos passos:**
   - `/novo-marco` — iniciar próximo milestone (questionamento → pesquisa → requisitos → roadmap)

</process>

<success_criteria>

- Milestone arquivado em `.planning/milestones/v{{version}}-ROADMAP.md`
- Requisitos arquivados em `.planning/milestones/v{{version}}-REQUIREMENTS.md`
- `.planning/REQUIREMENTS.md` deletado (novo para próximo milestone)
- ROADMAP.md colapsado para entrada de uma linha
- PROJECT.md atualizado com estado atual
- Tag git v{{version}} criado
- Commit bem-sucedido
- Usuário conhece os próximos passos (incluindo necessidade de novos requisitos)
  </success_criteria>

<critical_rules>

- **Carregar workflow primeiro:** Ler complete-milestone.md antes de executar
- **Verificar conclusão:** Todas as fases devem ter arquivos SUMMARY.md
- **Confirmação do usuário:** Aguardar aprovação nos checkpoints de verificação
- **Arquivar antes de deletar:** Sempre criar arquivos de arquivo antes de atualizar/deletar originais
- **Resumo de uma linha:** Milestone colapsado no ROADMAP.md deve ser uma única linha com link
- **Eficiência de contexto:** Arquivo mantém ROADMAP.md e REQUIREMENTS.md com tamanho constante por milestone
- **Novos requisitos:** Próximo milestone começa com `/novo-marco` que inclui definição de requisitos
  </critical_rules>

<observability_integration>
**OMM no-regression gate (v1.9 — INT-FW-05):**

Quando `workflow.complete_milestone_omm_gate = true` (default), o workflow inclui passo OMM regression check antes de arquivar:

1. Procurar `.planning/OMM-REPORT.md` atual. Se ausente: rodar `/auditar-observabilidade` primeiro.
2. Comparar scores das 5 capacidades com `.planning/milestones/<previous>/OMM-REPORT.md`.
3. Se alguma capacidade regrediu E `workflow.omm_no_regression = true`: BLOQUEAR conclusion.
4. Se regression detectada mas `workflow.omm_no_regression = false`: WARN explícito; user decide entre aceitar ou pausar.
5. OMM-REPORT.md final é arquivado em `.planning/milestones/v<version>/OMM-REPORT.md`.

Gate executável: `gates/omm-no-regression.md`.

Skill consultada: [`observability-maturity-model`](../skills/observability-maturity-model/SKILL.md).

**REQ:** INT-FW-05.
</observability_integration>

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