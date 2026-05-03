<trigger>
Use este workflow quando:
- Iniciando uma nova sessão em um projeto existente
- Usuário diz "continuar", "o que vem depois", "onde paramos", "retomar"
- Qualquer operação de planejamento quando .planning/ já existe
- Usuário retorna após um período afastado do projeto
</trigger>

<purpose>
Restaurar instantaneamente o contexto completo do projeto para que "Onde paramos?" tenha uma resposta imediata e completa.
</purpose>

<required_reading>
@./.claude/framework/references/continuation-format.md
</required_reading>

<process>

<step name="initialize">
Carregue todo o contexto em uma única chamada:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init resume)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analise o JSON para: `state_exists`, `roadmap_exists`, `project_exists`, `planning_exists`, `has_interrupted_agent`, `interrupted_agent_id`, `commit_docs`.

**Se `state_exists` for true:** Prossiga para load_state
**Se `state_exists` for false mas `roadmap_exists` ou `project_exists` for true:** Ofereça reconstruir o STATE.md
**Se `planning_exists` for false:** Este é um novo projeto — roteie para /novo-projeto
</step>

<step name="load_state">

Leia e analise STATE.md, depois PROJECT.md:

```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

**Do STATE.md extraia:**

- **Referência do Projeto**: Valor central e foco atual
- **Posição Atual**: Fase X de Y, Plano A de B, Status
- **Progresso**: Barra de progresso visual
- **Decisões Recentes**: Decisões-chave que afetam o trabalho atual
- **Todos Pendentes**: Ideias capturadas durante as sessões
- **Bloqueadores/Preocupações**: Problemas carregados para frente
- **Continuidade de Sessão**: Onde paramos, quaisquer arquivos de retomada

**Do PROJECT.md extraia:**

- **O Que É**: Descrição atual e precisa
- **Requisitos**: Validados, Ativos, Fora do Escopo
- **Decisões-Chave**: Log completo de decisões com resultados
- **Restrições**: Limites rígidos de implementação

</step>

<step name="check_incomplete_work">
Procure trabalho incompleto que precisa de atenção:

```bash
# Verificar handoff estruturado (preferido — legível por máquina)
cat .planning/HANDOFF.json 2>/dev/null || true

# Verificar arquivos continue-here (retomada no meio do plano)
ls .planning/phases/*/.continue-here*.md 2>/dev/null || true

# Verificar planos sem resumos (execução incompleta)
for plan in .planning/phases/*/*-PLAN.md; do
  [ -e "$plan" ] || continue
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incompleto: $plan"
done 2>/dev/null || true

# Verificar agentes interrompidos (use has_interrupted_agent e interrupted_agent_id do init)
if [ "$has_interrupted_agent" = "true" ]; then
  echo "Agente interrompido: $interrupted_agent_id"
fi
```

**Se HANDOFF.json existir:**

- Esta é a fonte primária de retomada — dados estruturados do `/pausar-trabalho`
- Analise `status`, `phase`, `plan`, `task`, `total_tasks`, `next_action`
- Verifique `blockers` e `human_actions_pending` — apresente-os imediatamente
- Verifique `completed_tasks` para itens `in_progress` — estes precisam de atenção primeiro
- Valide `uncommitted_files` contra `git status` — sinalize divergências
- Use `context_notes` para restaurar o modelo mental
- Sinalize: "Handoff estruturado encontrado — retomando da tarefa {tarefa}/{total_tarefas}"
- **Após retomada bem-sucedida, exclua o HANDOFF.json** (é um artefato de uso único)

**Se arquivo .continue-here existir (fallback):**

- Este é um ponto de retomada no meio do plano
- Leia o arquivo para contexto específico de retomada
- Sinalize: "Checkpoint de meio de plano encontrado"

**Se PLAN sem SUMMARY existir:**

- A execução foi iniciada mas não concluída
- Sinalize: "Execução de plano incompleta encontrada"

**Se agente interrompido encontrado:**

- Um subagente foi spawnado mas a sessão terminou antes da conclusão
- Leia agent-history.json para detalhes da tarefa
- Sinalize: "Agente interrompido encontrado"
</step>

<step name="present_status">
Apresente o status completo do projeto ao usuário:

```
╔══════════════════════════════════════════════════════════════╗
║  STATUS DO PROJETO                                            ║
╠══════════════════════════════════════════════════════════════╣
║  Construindo: [frase do PROJECT.md "O Que É"]                 ║
║                                                               ║
║  Fase: [X] de [Y] - [Nome da fase]                           ║
║  Plano: [A] de [B] - [Status]                                ║
║  Progresso: [██████░░░░] XX%                                 ║
║                                                               ║
║  Última atividade: [data] - [o que aconteceu]                ║
╚══════════════════════════════════════════════════════════════╝

[Se trabalho incompleto encontrado:]
⚠️  Trabalho incompleto detectado:
    - [arquivo .continue-here ou plano incompleto]

[Se agente interrompido encontrado:]
⚠️  Agente interrompido detectado:
    ID do Agente: [id]
    Tarefa: [descrição da tarefa do agent-history.json]
    Interrompido em: [timestamp]

    Retome com: ferramenta Task (parâmetro resume com ID do agente)

[Se todos pendentes existirem:]
📋 [N] todos pendentes — /verificar-tarefas para revisar

[Se bloqueadores existirem:]
⚠️  Preocupações carregadas:
    - [bloqueador 1]
    - [bloqueador 2]

[Se o alinhamento não for ✓:]
⚠️  Alinhamento breve: [status] - [avaliação]
```

</step>

<step name="determine_next_action">
Com base no estado do projeto, determine a próxima ação mais lógica:

**Se agente interrompido existir:**
→ Primária: Retomar agente interrompido (ferramenta Task com parâmetro resume)
→ Opção: Começar do zero (abandonar trabalho do agente)

**Se HANDOFF.json existir:**
→ Primária: Retomar do handoff estruturado (prioridade mais alta — contexto específico de tarefa/bloqueador)
→ Opção: Descartar handoff e reavaliação a partir dos arquivos

**Se arquivo .continue-here existir:**
→ Fallback: Retomar do checkpoint
→ Opção: Começar do zero no plano atual

**Se plano incompleto (PLAN sem SUMMARY):**
→ Primária: Concluir o plano incompleto
→ Opção: Abandonar e seguir em frente

**Se fase em progresso, todos os planos concluídos:**
→ Primária: Avançar para a próxima fase (via workflow de transição interno)
→ Opção: Revisar o trabalho concluído

**Se fase pronta para planejar:**
→ Verifique se CONTEXT.md existe para esta fase:

- Se CONTEXT.md ausente:
  → Primária: Discutir a visão da fase (como o usuário imagina que funcionará)
  → Secundária: Planejar diretamente (pular coleta de contexto)
- Se CONTEXT.md existir:
  → Primária: Planejar a fase
  → Opção: Revisar o roadmap

**Se fase pronta para executar:**
→ Primária: Executar o próximo plano
→ Opção: Revisar o plano primeiro
</step>

<step name="offer_options">
Apresente opções contextuais com base no estado do projeto:

```
O que você gostaria de fazer?

[Ação primária baseada no estado — ex.:]
1. Retomar agente interrompido [se agente interrompido encontrado]
   OU
1. Executar fase (/executar-fase {fase} ${WS})
   OU
1. Discutir contexto da Fase 3 (/discutir-fase 3 ${WS}) [se CONTEXT.md ausente]
   OU
1. Planejar Fase 3 (/planejar-fase 3 ${WS}) [se CONTEXT.md existir ou opção de discutir recusada]

[Opções secundárias:]
2. Revisar status da fase atual
3. Verificar todos pendentes ([N] pendentes)
4. Revisar alinhamento breve
5. Outra coisa
```

**Nota:** Ao oferecer planejamento de fase, verifique primeiro a existência do CONTEXT.md:

```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null || true
```

Se ausente, sugira discuss-phase antes do plan. Se existir, ofereça plan diretamente.

Aguarde a seleção do usuário.
</step>

<step name="route_to_workflow">
Com base na seleção do usuário, roteie para o workflow apropriado:

- **Executar plano** → Mostre o comando para o usuário executar após limpar:
  ```
  ---

  ## ▶ Próximo Passo

  **{fase}-{plano}: [Nome do Plano]** — [objetivo do PLAN.md]

  `/executar-fase {fase} ${WS}`

  <sub>`/clear` primeiro → contexto limpo</sub>

  ---
  ```
- **Planejar fase** → Mostre o comando para o usuário executar após limpar:
  ```
  ---

  ## ▶ Próximo Passo

  **Fase [N]: [Nome]** — [Objetivo do ROADMAP.md]

  `/planejar-fase [número-da-fase] ${WS}`

  <sub>`/clear` primeiro → contexto limpo</sub>

  ---

  **Também disponível:**
  - `/discutir-fase [N] ${WS}` — coletar contexto primeiro
  - `/pesquisar-fase [N] ${WS}` — investigar incógnitas

  ---
  ```
- **Avançar para próxima fase** → ./transition.md (workflow interno, invocado inline — NÃO é um comando do usuário)
- **Verificar todos** → Ler .planning/todos/pending/, apresentar resumo
- **Revisar alinhamento** → Ler PROJECT.md, comparar com o estado atual
- **Outra coisa** → Perguntar o que precisam
</step>

<step name="update_session">
Antes de prosseguir para o workflow roteado, atualize a continuidade da sessão:

Atualize STATE.md:

```markdown
## Continuidade de Sessão

Última sessão: [agora]
Parou em: Sessão retomada, prosseguindo para [ação]
Arquivo de retomada: [atualizado se aplicável]
```

Isso garante que, se a sessão terminar inesperadamente, a próxima retomada saiba o estado.
</step>

</process>

<reconstruction>
Se STATE.md estiver ausente mas outros artefatos existirem:

"STATE.md ausente. Reconstruindo a partir dos artefatos..."

1. Ler PROJECT.md → Extrair "O Que É" e Valor Central
2. Ler ROADMAP.md → Determinar fases, encontrar posição atual
3. Varrer arquivos \*-SUMMARY.md → Extrair decisões, preocupações
4. Contar todos pendentes em .planning/todos/pending/
5. Verificar arquivos .continue-here → Continuidade de sessão

Reconstrua e escreva STATE.md, depois prossiga normalmente.

Isso trata casos onde:

- O projeto é anterior à introdução do STATE.md
- O arquivo foi acidentalmente excluído
- Clonagem do repositório sem o estado completo .planning/
</reconstruction>

<quick_resume>
Se o usuário disser "continuar" ou "ir":
- Carregue o estado silenciosamente
- Determine a ação primária
- Execute imediatamente sem apresentar opções

"Continuando de [estado]... [ação]"
</quick_resume>

<success_criteria>
A retomada está completa quando:

- [ ] STATE.md carregado (ou reconstruído)
- [ ] Trabalho incompleto detectado e sinalizado
- [ ] Status claro apresentado ao usuário
- [ ] Próximas ações contextuais oferecidas
- [ ] Usuário sabe exatamente onde o projeto está
- [ ] Continuidade de sessão atualizada
</success_criteria>
