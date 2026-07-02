---
name: pesquisar-fase
description: Pesquisa como implementar uma fase (standalone — geralmente use /planejar-fase)
argument-hint: "[fase]"
allowed-tools:
  - Read
  - Bash
  - Task
---

<objective>
Pesquisa como implementar uma fase. Invoca o agente phase-researcher com o contexto da fase.

**Nota:** Este é um comando de pesquisa standalone. Para a maioria dos fluxos, use `/planejar-fase` que integra a pesquisa automaticamente.

**Use este comando quando:**
- Você quer pesquisar sem planejar ainda
- Você quer re-pesquisar após o planejamento estar completo
- Você precisa investigar antes de decidir se uma fase é viável

**Papel do orquestrador:** Analisar fase, validar contra o roadmap, verificar pesquisa existente, reunir contexto, invocar agente pesquisador, apresentar resultados.

**Por que subagente:** Pesquisa consome contexto rapidamente (WebSearch, consultas Context7, verificação de fontes). Contexto fresco de 200k para investigação. Contexto principal fica enxuto para interação com o usuário.
</objective>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- phase-researcher — Pesquisa abordagens técnicas para uma fase
</available_agent_types>

<context>
Número da fase: $ARGUMENTS (obrigatório)

Normalizar entrada da fase no passo 1 antes de qualquer busca de diretório.
</context>

<process>

## 0. Inicializar Contexto

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair do JSON de init: `phase_dir`, `phase_number`, `phase_name`, `phase_found`, `commit_docs`, `has_research`, `state_path`, `requirements_path`, `context_path`, `research_path`.

Resolver modelo do pesquisador:
```bash
RESEARCHER_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model phase-researcher --raw)
```

## 1. Validar Fase

```bash
PHASE_INFO=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${phase_number}")
```

**Se `found` for false:** Erro e sair. **Se `found` for true:** Extrair `phase_number`, `phase_name`, `goal` do JSON.

## 2. Verificar Pesquisa Existente

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

**Se existir:** Oferecer: 1) Atualizar pesquisa, 2) Ver existente, 3) Pular. Aguardar resposta.

**Se não existir:** Continuar.

## 3. Reunir Contexto da Fase

Usar caminhos do INIT (não colocar conteúdo de arquivos inline no contexto do orquestrador):
- `requirements_path`
- `context_path`
- `state_path`

Apresentar resumo com descrição da fase e quais arquivos o pesquisador vai carregar.

## 4. Invocar Agente phase-researcher

Modos de pesquisa: ecosystem (padrão), feasibility, implementation, comparison.

```markdown
<research_type>
Pesquisa de Fase — investigando COMO implementar uma fase específica bem.
</research_type>

<key_insight>
A questão NÃO é "qual biblioteca devo usar?"

A questão é: "O que eu não sei que não sei?"

Para esta fase, descobrir:
- Qual é o padrão de arquitetura estabelecido?
- Quais bibliotecas formam o stack padrão?
- Quais problemas as pessoas comumente encontram?
- Qual é o SOTA vs o que o treinamento do Claude acha que é SOTA?
- O que NÃO deve ser feito manualmente?
</key_insight>

<objective>
Pesquisar abordagem de implementação para Fase {phase_number}: {phase_name}
Modo: ecosystem
</objective>

<files_to_read>
- {requirements_path} (Requisitos)
- {context_path} (Contexto da fase do discutir-fase, se existir)
- {state_path} (Decisões e bloqueadores anteriores do projeto)
</files_to_read>

<additional_context>
**Descrição da fase:** {phase_description}
</additional_context>

<downstream_consumer>
Seu RESEARCH.md será carregado pelo `/planejar-fase` que usa seções específicas:
- `## Standard Stack` → Planos usam essas bibliotecas
- `## Architecture Patterns` → Estrutura de tarefas segue esses padrões
- `## Don't Hand-Roll` → Tarefas NUNCA constroem soluções customizadas para problemas listados
- `## Common Pitfalls` → Etapas de verificação checam por esses problemas
- `## Code Examples` → Ações de tarefas referenciam esses padrões

Seja prescritivo, não exploratório. "Use X" não "Considere X ou Y."
</downstream_consumer>

<quality_gate>
Antes de declarar completo, verificar:
- [ ] Todos os domínios investigados (não apenas alguns)
- [ ] Afirmações negativas verificadas com documentação oficial
- [ ] Múltiplas fontes para afirmações críticas
- [ ] Níveis de confiança atribuídos honestamente
- [ ] Nomes de seções correspondem ao que o planejar-fase espera
</quality_gate>

<output>
Escrever em: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="phase-researcher",
  model="{researcher_model}",
  description="Pesquisar Fase {phase}"
)
```

## 5. Tratar Retorno do Agente

**`## RESEARCH COMPLETE`:** Exibir resumo, oferecer: Planejar fase, Aprofundar, Revisar completo, Concluído.

**`## CHECKPOINT REACHED`:** Apresentar ao usuário, obter resposta, invocar continuação.

**`## RESEARCH INCONCLUSIVE`:** Mostrar o que foi tentado, oferecer: Adicionar contexto, Tentar modo diferente, Manual.

## 6. Invocar Agente de Continuação

```markdown
<objective>
Continuar pesquisa para Fase {phase_number}: {phase_name}
</objective>

<prior_state>
<files_to_read>
- .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md (Pesquisa existente)
</files_to_read>
</prior_state>

<checkpoint_response>
**Tipo:** {checkpoint_type}
**Resposta:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="phase-researcher",
  model="{researcher_model}",
  description="Continuar pesquisa Fase {phase}"
)
```

</process>

<success_criteria>
- [ ] Fase validada contra o roadmap
- [ ] Pesquisa existente verificada
- [ ] phase-researcher invocado com contexto
- [ ] Checkpoints tratados corretamente
- [ ] Usuário sabe os próximos passos
</success_criteria>
