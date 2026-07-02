<purpose>
Auditoria visual retroativa de 6 pilares do código frontend implementado. Comando independente que funciona em qualquer projeto — gerenciado pelo framework ou não. Produz UI-REVIEW.md pontuado com descobertas acionáveis.
</purpose>

<required_reading>
@./.claude/framework/references/ui-brand.md
</required_reading>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- ui-auditor — Audita UI contra requisitos de design
</available_agent_types>

<process>

## 0. Inicializar

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI_REVIEWER=$(node "./.claude/framework/bin/tools.cjs" agent-skills ui-reviewer 2>/dev/null)
```

Analise: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`.

```bash
UI_AUDITOR_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model ui-auditor --raw)
```

Exiba o banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUDITORIA UI — FASE {N}: {nome}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. Detectar Estado de Entrada

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-UI-REVIEW.md 2>/dev/null | head -1)
```

**Se `SUMMARY_FILES` vazio:** Encerre — "Fase {N} não executada. Execute /executar-fase {N} primeiro."

**Se `UI_REVIEW_FILE` não vazio:** Use AskUserQuestion:
- header: "Revisão UI Existente"
- question: "UI-REVIEW.md já existe para a Fase {N}."
- options:
  - "Re-auditar — executar nova auditoria"
  - "Visualizar — exibir revisão atual e encerrar"

Se "Visualizar": exibir arquivo, encerrar.
Se "Re-auditar": continuar.

## 2. Coletar Caminhos de Contexto

Construa a lista de arquivos para o auditor:
- Todos os arquivos SUMMARY.md no diretório da fase
- Todos os arquivos PLAN.md no diretório da fase
- UI-SPEC.md (se existir — linha de base da auditoria)
- CONTEXT.md (se existir — decisões bloqueadas)

## 3. Spawnar ui-auditor

```
◆ Spawning UI auditor...
```

Construa o prompt:

```markdown
Read ./.claude/agents/ui-auditor.md for instructions.

<objective>
Conduct 6-pillar visual audit of Phase {phase_number}: {phase_name}
{If UI-SPEC exists: "Audit against UI-SPEC.md design contract."}
{If no UI-SPEC: "Audit against abstract 6-pillar standards."}
</objective>

<files_to_read>
- {summary_paths} (Execution summaries)
- {plan_paths} (Execution plans — what was intended)
- {ui_spec_path} (UI Design Contract — audit baseline, if exists)
- {context_path} (User decisions, if exists)
</files_to_read>

${AGENT_SKILLS_UI_REVIEWER}

<config>
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omita caminhos de arquivo nulos.

```
Task(
  prompt=ui_audit_prompt,
  subagent_type="ui-auditor",
  model="{UI_AUDITOR_MODEL}",
  description="UI Audit Phase {N}"
)
```

## 4. Tratar Retorno

**Se `## UI REVIEW COMPLETE`:**

Exiba o resumo de pontuação:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUDITORIA UI CONCLUÍDA ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Fase {N}: {Nome}** — Geral: {pontuação}/24

| Pilar | Pontuação |
|-------|-----------|
| Copywriting | {N}/4 |
| Visuais | {N}/4 |
| Cor | {N}/4 |
| Tipografia | {N}/4 |
| Espaçamento | {N}/4 |
| Design de Experiência | {N}/4 |

Principais correções:
1. {correção}
2. {correção}
3. {correção}

Revisão completa: {caminho para UI-REVIEW.md}

───────────────────────────────────────────────────────────────

## ▶ Próximo

- `/verificar-trabalho {N}` — testes UAT
- `/planejar-fase {N+1}` — planejar próxima fase

<sub>/clear primeiro → contexto limpo</sub>

───────────────────────────────────────────────────────────────
```

## 5. Commit (se configurado)

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): revisão de auditoria UI" --files "${PHASE_DIR}/${PADDED_PHASE}-UI-REVIEW.md"
```

</process>

<success_criteria>
- [ ] Fase validada
- [ ] Arquivos SUMMARY.md encontrados (execução concluída)
- [ ] Revisão existente tratada (re-auditar/visualizar)
- [ ] ui-auditor spawnado com contexto correto
- [ ] UI-REVIEW.md criado no diretório da fase
- [ ] Resumo de pontuação exibido ao usuário
- [ ] Próximos passos apresentados
</success_criteria>
