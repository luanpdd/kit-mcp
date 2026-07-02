---
name: auditar-marco
description: Audita a conclusão do milestone contra a intenção original antes de arquivar
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---
<objective>
Verificar se o milestone alcançou sua definição de pronto. Checar cobertura de requisitos, integração entre fases e fluxos de ponta a ponta.

**Este comando É o orquestrador.** Lê os arquivos VERIFICATION.md existentes (fases já verificadas durante o executar-fase), agrega dívidas técnicas e lacunas adiadas, então invoca o verificador de integração para a fiação entre fases.
</objective>

<execution_context>
@./.claude/framework/workflows/audit-milestone.md
</execution_context>

<context>
Versão: $ARGUMENTS (opcional — padrão para o milestone atual)

Arquivos principais de planejamento são resolvidos no workflow (`init milestone-op`) e carregados apenas quando necessário.

**Trabalho Concluído:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
Execute o workflow audit-milestone de @./.claude/framework/workflows/audit-milestone.md do início ao fim.
Preserve todos os checkpoints do workflow (determinação de escopo, leitura de verificações, checagem de integração, cobertura de requisitos, roteamento).
</process>

<observability_integration>
**OMM scoring (v1.9 — INT-FW-04):**

Quando `workflow.audit_milestone_omm = true` (default), o workflow inclui passo OMM scoring:

```text
Skill(skill="framework:auditar-observabilidade")
```

O comando `/auditar-observabilidade` invoca o agente [`omm-auditor`](../agents/omm-auditor.md) que pontua as 5 capacidades (resiliência, qualidade, complexidade, cadência, comportamento) contra o marco anterior. O OMM-REPORT.md gerado é incluído como anexo no MILESTONE-AUDIT.md.

Resultado de regression OMM:
- **0 regressions:** audit aprovado
- **1+ regressions, blocking=false:** warn explícito; audit aprovado com nota
- **1+ regressions, blocking=true (`workflow.omm_no_regression=true`):** audit fail → user escolha entre fix lacunas ou aceitar

Skill consultada: [`observability-maturity-model`](../skills/observability-maturity-model/SKILL.md).

**REQ:** INT-FW-04.
</observability_integration>

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

<legacy_refactor_integration>
**Legacy refactor safety audit (opt-in):**

Quando `workflow.audit_milestone_legacy_refactor = true` (default: false em projetos < 50% OMM maturity, true acima), o workflow inclui passo de auditoria de refactor safety:

```text
Para cada arquivo modificado por tasks com kind=refactor no milestone:
  Task(
    subagent_type="refactor-safety-auditor",
    prompt="
target_file: <file>
change_kind: refactor
mode: blocking
output_path: .planning/REFACTOR-SAFETY-<file_stem>.md

Aplicar skill pre-refactor-characterization. Validar retroativamente que safety net foi aplicado.
"
  )
```

**Critérios de aprovação:**
- Cada refactor de risco no milestone tem characterization tests linkados E pass verde
- Cada `--mode=override` tem ticket linkado válido (ainda aberto OR resolvido com follow-up)
- Mutation kill score ≥ 70% nos arquivos refatorados (warning se line cov OK mas mutation baixo)

**Resultado de regression:**
- 0 refactors sem char → audit aprovado
- 1+ refactors sem char e sem override → audit fail; bloqueia close de milestone até resolução
- 1+ overrides com tickets ainda abertos > 90 dias → warning explícito (débito técnico envelhecido)

Skill canônica: [`pre-refactor-characterization`](../skills/pre-refactor-characterization/SKILL.md)
Cross-ref ativo: `omm-auditor` Capacidade 1 (Resilience) score consulta REFACTOR-SAFETY summaries para fator "% refactors com safety net"; baixa adequação reduz score.

**Quando desligar gate:**
- Projeto greenfield com < 3 meses de idade (legacy code não existe ainda)
- Solo dev side project sem stakes de produção (audit é overhead)
- Toda codebase é < 50% código não-trivial (a maior parte é config/markdown/tests)

Para esses casos: `workflow.audit_milestone_legacy_refactor = false`. Para projetos com stakes de produção e equipe ≥ 2 pessoas, **manter `true`**.

**REQ:** INT-LEGACY-FW-01.
</legacy_refactor_integration>