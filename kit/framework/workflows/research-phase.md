<purpose>
Pesquisa como implementar uma fase. Spawna phase-researcher com o contexto da fase.

Comando de pesquisa independente. Para a maioria dos workflows, use `/planejar-fase` que integra a pesquisa automaticamente.
</purpose>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- phase-researcher — Pesquisa abordagens técnicas para uma fase
</available_agent_types>

<process>

## Passo 0: Resolver Perfil de Modelo

@./.claude/framework/references/model-profile-resolution.md

Resolva o modelo para:
- `phase-researcher`

## Passo 1: Normalizar e Validar a Fase

@./.claude/framework/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${PHASE}")
```

Se `found` for false: Erro e encerre.

## Passo 2: Verificar Pesquisa Existente

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null || true
```

Se existir: Ofereça opções de atualizar/visualizar/pular.

## Passo 3: Coletar Contexto da Fase

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Extrair: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
AGENT_SKILLS_RESEARCHER=$(node "./.claude/framework/bin/tools.cjs" agent-skills researcher 2>/dev/null)
```

## Passo 4: Spawnar Pesquisador

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
Phase description: {description}
</additional_context>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="phase-researcher",
  model="{researcher_model}"
)
```

## Passo 5: Tratar Retorno

- `## RESEARCH COMPLETE` — Exibir resumo, oferecer: Planejar/Aprofundar/Revisar/Concluído
- `## CHECKPOINT REACHED` — Apresentar ao usuário, spawnar continuação
- `## RESEARCH INCONCLUSIVE` — Mostrar tentativas, oferecer: Adicionar contexto/Tentar modo diferente/Manual

</process>
