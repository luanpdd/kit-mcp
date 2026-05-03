<purpose>
Gera um contrato de design UI (UI-SPEC.md) para fases frontend. Orquestra ui-researcher e ui-checker com um loop de revisão. Inserido entre discuss-phase e plan-phase no ciclo de vida.

UI-SPEC.md bloqueia espaçamento, tipografia, cor, copywriting e decisões do sistema de design antes que o planejador crie tarefas. Isso evita a dívida de design causada por decisões de estilo ad-hoc durante a execução.
</purpose>

<required_reading>
@./.claude/framework/references/ui-brand.md
</required_reading>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- ui-researcher — Pesquisa abordagens UI/UX
- ui-checker — Revisa qualidade de implementação UI
</available_agent_types>

<process>

## 1. Inicializar

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI=$(node "./.claude/framework/bin/tools.cjs" agent-skills ui-researcher 2>/dev/null)
AGENT_SKILLS_UI_CHECKER=$(node "./.claude/framework/bin/tools.cjs" agent-skills ui-checker 2>/dev/null)
```

Analise o JSON para: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`.

**Caminhos de arquivo:** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`.

Resolva os modelos dos agentes UI:

```bash
UI_RESEARCHER_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model ui-researcher --raw)
UI_CHECKER_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model ui-checker --raw)
```

Verifique o config:

```bash
UI_ENABLED=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**Se `UI_ENABLED` for `false`:**
```
Fase UI desabilitada no config. Habilite via /configuracoes.
```
Encerre o workflow.

**Se `planning_exists` for false:** Erro — execute `/novo-projeto` primeiro.

## 2. Analisar e Validar a Fase

Extraia o número da fase de $ARGUMENTS. Se não fornecido, detecte a próxima fase não planejada.

```bash
PHASE_INFO=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${PHASE}")
```

**Se `found` for false:** Erro com fases disponíveis.

## 3. Verificar Pré-requisitos

**Se `has_context` for false:**
```
CONTEXT.md não encontrado para a Fase {N}.
Recomendado: execute /discutir-fase {N} primeiro para capturar preferências de design.
Continuando sem decisões do usuário — o pesquisador UI fará todas as perguntas.
```
Continue (não bloqueante).

**Se `has_research` for false:**
```
RESEARCH.md não encontrado para a Fase {N}.
Nota: decisões de stack (biblioteca de componentes, abordagem de estilo) serão perguntadas durante a pesquisa UI.
```
Continue (não bloqueante).

## 4. Verificar UI-SPEC Existente

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**Se existir:** Use AskUserQuestion:
- header: "UI-SPEC Existente"
- question: "UI-SPEC.md já existe para a Fase {N}. O que você quer fazer?"
- options:
  - "Atualizar — re-executar pesquisador com o existente como linha de base"
  - "Visualizar — exibir UI-SPEC atual e encerrar"
  - "Pular — manter UI-SPEC atual, prosseguir para verificação"

Se "Visualizar": exibir conteúdo do arquivo, encerrar.
Se "Pular": prosseguir para o passo 7 (verificador).
Se "Atualizar": continuar para o passo 5.

## 5. Spawnar ui-researcher

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► CONTRATO DE DESIGN UI — FASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI researcher...
```

Construa o prompt:

```markdown
Read ./.claude/agents/ui-researcher.md for instructions.

<objective>
Create UI design contract for Phase {phase_number}: {phase_name}
Answer: "What visual and interaction contracts does this phase need?"
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /discuss-phase)
- {research_path} (Technical Research — stack decisions)
</files_to_read>

${AGENT_SKILLS_UI}

<output>
Write to: {phase_dir}/{padded_phase}-UI-SPEC.md
Template: ./.claude/framework/templates/UI-SPEC.md
</output>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omita caminhos de arquivo nulos de `<files_to_read>`.

```
Task(
  prompt=ui_research_prompt,
  subagent_type="ui-researcher",
  model="{UI_RESEARCHER_MODEL}",
  description="UI Design Contract Phase {N}"
)
```

## 6. Tratar Retorno do Pesquisador

**Se `## UI-SPEC COMPLETE`:**
Exiba confirmação. Continue para o passo 7.

**Se `## UI-SPEC BLOCKED`:**
Exiba detalhes do bloqueador e opções. Encerre o workflow.

## 7. Spawnar ui-checker

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► VERIFICANDO UI-SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI checker...
```

Construa o prompt:

```markdown
Read ./.claude/agents/ui-checker.md for instructions.

<objective>
Validate UI design contract for Phase {phase_number}: {phase_name}
Check all 6 dimensions. Return APPROVED or BLOCKED.
</objective>

<files_to_read>
- {phase_dir}/{padded_phase}-UI-SPEC.md (UI Design Contract — PRIMARY INPUT)
- {context_path} (USER DECISIONS — check compliance)
- {research_path} (Technical Research — check stack alignment)
</files_to_read>

${AGENT_SKILLS_UI_CHECKER}

<config>
ui_safety_gate: {ui_safety_gate config value}
</config>
```

```
Task(
  prompt=ui_checker_prompt,
  subagent_type="ui-checker",
  model="{UI_CHECKER_MODEL}",
  description="Verify UI-SPEC Phase {N}"
)
```

## 8. Tratar Retorno do Verificador

**Se `## UI-SPEC VERIFIED`:**
Exiba os resultados das dimensões. Prossiga para o passo 10.

**Se `## ISSUES FOUND`:**
Exiba os problemas bloqueantes. Prossiga para o passo 9.

## 9. Loop de Revisão (Máx. 2 Iterações)

Rastreie `revision_count` (começa em 0).

**Se `revision_count` < 2:**
- Incremente `revision_count`
- Re-spawne ui-researcher com contexto de revisão:

```markdown
<revision>
O verificador UI encontrou problemas com o UI-SPEC.md atual.

### Problemas a Corrigir
{cole os problemas bloqueantes do retorno do verificador}

Leia o UI-SPEC.md existente, corrija APENAS os problemas listados, re-escreva o arquivo.
NÃO refaça perguntas ao usuário que já foram respondidas.
</revision>
```

- Após o retorno do pesquisador → re-spawne o verificador (passo 7)

**Se `revision_count` >= 2:**
```
Máximo de iterações de revisão atingido. Problemas restantes:

{listar problemas restantes}

Opções:
1. Forçar aprovação — prosseguir com UI-SPEC atual (FLAGs tornam-se aceitas)
2. Editar manualmente — abrir UI-SPEC.md no editor, re-executar /fase-ui
3. Abandonar — sair sem aprovar
```

Use AskUserQuestion para a escolha.

## 10. Apresentar Status Final

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► UI-SPEC PRONTA ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Fase {N}: {Nome}** — Contrato de design UI aprovado

Dimensões: 6/6 aprovadas
{Se houver FLAGs: "Recomendações: {N} (não bloqueantes)"}

───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**Planejar Fase {N}** — o planejador usará UI-SPEC.md como contexto de design

`/planejar-fase {N}`

<sub>/clear primeiro → contexto limpo</sub>

───────────────────────────────────────────────────────────────
```

## 11. Commit (se configurado)

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): contrato de design UI" --files "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

## 12. Atualizar Estado

```bash
node "./.claude/framework/bin/tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} UI-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

</process>

<success_criteria>
- [ ] Config verificado (encerrar se ui_phase desabilitado)
- [ ] Fase validada contra o roadmap
- [ ] Pré-requisitos verificados (CONTEXT.md, RESEARCH.md — avisos não bloqueantes)
- [ ] UI-SPEC existente tratada (atualizar/visualizar/pular)
- [ ] ui-researcher spawnado com contexto e caminhos de arquivo corretos
- [ ] UI-SPEC.md criada no local correto
- [ ] ui-checker spawnado com UI-SPEC.md
- [ ] Todas as 6 dimensões avaliadas
- [ ] Loop de revisão se BLOCKED (máx. 2 iterações)
- [ ] Status final exibido com próximos passos
- [ ] UI-SPEC.md commitada (se commit_docs habilitado)
- [ ] Estado atualizado
</success_criteria>
