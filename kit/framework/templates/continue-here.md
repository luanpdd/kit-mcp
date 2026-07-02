# Template Continue-Here

Copie e preencha esta estrutura para `.planning/phases/XX-name/.continue-here.md`:

```yaml
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: 2025-01-15T14:30:00Z
---
```

```markdown
<current_state>
[Onde exatamente estamos? Qual é o contexto imediato?]
</current_state>

<completed_work>
[O que foi feito nesta sessão - seja específico]

- Tarefa 1: [nome] - Concluída
- Tarefa 2: [nome] - Concluída
- Tarefa 3: [nome] - Em andamento, [o que foi feito nela]
</completed_work>

<remaining_work>
[O que falta nesta fase]

- Tarefa 3: [nome] - [o que falta fazer]
- Tarefa 4: [nome] - Não iniciada
- Tarefa 5: [nome] - Não iniciada
</remaining_work>

<decisions_made>
[Decisões chave e por que — para que a próxima sessão não reabra o debate]

- Decidiu usar [X] porque [motivo]
- Escolheu [abordagem] em vez de [alternativa] porque [motivo]
</decisions_made>

<blockers>
[Qualquer coisa travada ou aguardando fatores externos]

- [Bloqueio 1]: [status/contorno]
</blockers>

<context>
[Estado mental, "vibe", qualquer coisa que ajude a retomar suavemente]

[O que você estava pensando? Qual era o plano?
Este é o contexto "retomar exatamente de onde parou".]
</context>

<next_action>
[A primeira coisa a fazer ao retomar]

Começar com: [ação específica]
</next_action>
```

<yaml_fields>
Frontmatter YAML obrigatório:

- `phase`: Nome do diretório (ex.: `02-authentication`)
- `task`: Número da tarefa atual
- `total_tasks`: Quantas tarefas na fase
- `status`: `in_progress`, `blocked`, `almost_done`
- `last_updated`: Timestamp ISO
</yaml_fields>

<guidelines>
- Seja específico o suficiente para que uma instância fresca do Claude entenda imediatamente
- Inclua POR QUE as decisões foram tomadas, não apenas o quê
- O `<next_action>` deve ser acionável sem ler mais nada
- Este arquivo é DELETADO após o retorno — não é armazenamento permanente
</guidelines>
