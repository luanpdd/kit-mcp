<internal_workflow>

**Este é um workflow INTERNO — NÃO é um comando para o usuário.**

Não existe um comando `/transition`. Este workflow é invocado automaticamente pelo
`execute-phase` durante o avanço automático, ou inline pelo orquestrador após a verificação
da fase. Jamais diga aos usuários para executar `/transition`.

**Comandos válidos para o usuário para progressão de fase:**
- `/discutir-fase {N}` — discutir uma fase antes do planejamento
- `/planejar-fase {N}` — planejar uma fase
- `/executar-fase {N}` — executar uma fase
- `/progresso` — ver o progresso do roadmap

</internal_workflow>

<required_reading>

**Leia estes arquivos AGORA:**

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/ROADMAP.md`
4. Arquivos de plano da fase atual (`*-PLAN.md`)
5. Arquivos de resumo da fase atual (`*-SUMMARY.md`)

</required_reading>

<purpose>

Marcar a fase atual como concluída e avançar para a próxima. Este é o ponto natural onde o rastreamento de progresso e a evolução do PROJECT.md acontecem.

"Planejar a próxima fase" = "fase atual está concluída"

</purpose>

<process>

<step name="load_project_state" priority="first">

Antes da transição, leia o estado do projeto:

```bash
cat .planning/STATE.md 2>/dev/null || true
cat .planning/PROJECT.md 2>/dev/null || true
```

Analise a posição atual para verificar se estamos fazendo a transição da fase correta.
Note o contexto acumulado que pode precisar de atualização após a transição.

</step>

<step name="verify_completion">

Verifique se a fase atual tem todos os resumos de plano:

```bash
(ls .planning/phases/XX-current/*-PLAN.md 2>/dev/null || true) | sort
(ls .planning/phases/XX-current/*-SUMMARY.md 2>/dev/null || true) | sort
```

**Lógica de verificação:**

- Contar arquivos PLAN
- Contar arquivos SUMMARY
- Se as contagens coincidirem: todos os planos concluídos
- Se não coincidirem: incompleto

<config-check>

```bash
cat .planning/config.json 2>/dev/null || true
```

</config-check>

**Verificar dívida de verificação nesta fase:**

```bash
# Contar itens pendentes na fase atual
OUTSTANDING=""
for f in .planning/phases/XX-current/*-UAT.md .planning/phases/XX-current/*-VERIFICATION.md; do
  [ -f "$f" ] || continue
  grep -q "result: pending\|result: blocked\|status: partial\|status: human_needed\|status: diagnosed" "$f" && OUTSTANDING="$OUTSTANDING\n$(basename $f)"
done
```

**Se OUTSTANDING não estiver vazio:**

Adicione à mensagem de confirmação de conclusão (independente do modo):

```
Itens de verificação pendentes nesta fase:
{listar nomes de arquivo}

Estes serão carregados como dívida. Revise: `/auditar-uat`
```

Isto NÃO bloqueia a transição — garante que o usuário veja a dívida antes de confirmar.

**Se todos os planos estiverem concluídos:**

<if mode="yolo">

```
⚡ Auto-aprovado: Transição Fase [X] → Fase [X+1]
Fase [X] concluída — todos os [Y] planos finalizados.

Prosseguindo para marcar como concluído e avançar...
```

Prossiga diretamente para o passo cleanup_handoff.

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

Pergunte: "Fase [X] concluída — todos os [Y] planos finalizados. Pronto para marcar como concluído e avançar para a Fase [X+1]?"

Aguarde confirmação antes de prosseguir.

</if>

**Se os planos estiverem incompletos:**

**TRILHO DE SEGURANÇA: always_confirm_destructive aplica-se aqui.**
Pular planos incompletos é destrutivo — SEMPRE solicite confirmação independente do modo.

Apresente:

```
Fase [X] tem planos incompletos:
- {fase}-01-SUMMARY.md ✓ Concluído
- {fase}-02-SUMMARY.md ✗ Ausente
- {fase}-03-SUMMARY.md ✗ Ausente

⚠️ Trilho de segurança: Pular planos requer confirmação (ação destrutiva)

Opções:
1. Continuar a fase atual (executar planos restantes)
2. Marcar como concluído mesmo assim (pular planos restantes)
3. Revisar o que falta
```

Aguarde a decisão do usuário.

</step>

<step name="cleanup_handoff">

Verifique handoffs pendentes:

```bash
ls .planning/phases/XX-current/.continue-here*.md 2>/dev/null || true
```

Se encontrados, exclua-os — a fase está concluída, os handoffs são obsoletos.

</step>

<step name="update_roadmap_and_state">

**Delegue as atualizações do ROADMAP.md e STATE.md ao tools:**

```bash
TRANSITION=$(node "./.claude/framework/bin/tools.cjs" phase complete "${current_phase}")
```

O CLI cuida de:
- Marcar o checkbox da fase como `[x]` concluído com a data de hoje
- Atualizar a contagem de planos para o final (ex.: "3/3 planos concluídos")
- Atualizar a tabela de Progresso (Status → Concluído, adicionando data)
- Avançar o STATE.md para a próxima fase (Fase Atual, Status → Pronto para planejar, Plano Atual → Não iniciado)
- Detectar se esta é a última fase do marco

Extraia do resultado: `completed_phase`, `plans_executed`, `next_phase`, `next_phase_name`, `is_last_phase`.

</step>

<step name="archive_prompts">

Se prompts foram gerados para a fase, eles permanecem no lugar.
O padrão de subpasta `completed/` do create-meta-prompts trata o arquivamento.

</step>

<step name="evolve_project">

Evolua o PROJECT.md para refletir os aprendizados da fase concluída.

**Leia os resumos da fase:**

```bash
cat .planning/phases/XX-current/*-SUMMARY.md
```

**Avalie mudanças de requisitos:**

1. **Requisitos validados?**
   - Algum requisito Ativo foi entregue nesta fase?
   - Mova para Validado com referência da fase: `- ✓ [Requisito] — Fase X`

2. **Requisitos invalidados?**
   - Algum requisito Ativo foi descoberto como desnecessário ou incorreto?
   - Mova para Fora do Escopo com motivo: `- [Requisito] — [por que invalidado]`

3. **Requisitos emergentes?**
   - Novos requisitos descobertos durante a construção?
   - Adicione ao Ativo: `- [ ] [Novo requisito]`

4. **Decisões a registrar?**
   - Extraia decisões dos arquivos SUMMARY.md
   - Adicione à tabela de Decisões-Chave com resultado se conhecido

5. **"O Que É" ainda está preciso?**
   - Se o produto mudou significativamente, atualize a descrição
   - Mantenha-o atual e preciso

**Atualize o PROJECT.md:**

Faça as edições inline. Atualize o rodapé "Última atualização":

```markdown
---
*Última atualização: [data] após a Fase [X]*
```

**Exemplo de evolução:**

Antes:

```markdown
### Ativo

- [ ] Autenticação JWT
- [ ] Sincronização em tempo real < 500ms
- [ ] Modo offline

### Fora do Escopo

- OAuth2 — complexidade não necessária para v1
```

Depois (Fase 2 entregou auth JWT, descobriu que rate limiting era necessário):

```markdown
### Validado

- ✓ Autenticação JWT — Fase 2

### Ativo

- [ ] Sincronização em tempo real < 500ms
- [ ] Modo offline
- [ ] Rate limiting no endpoint de sync

### Fora do Escopo

- OAuth2 — complexidade não necessária para v1
```

**Passo concluído quando:**

- [ ] Resumos da fase revisados para aprendizados
- [ ] Requisitos validados movidos de Ativo
- [ ] Requisitos invalidados movidos para Fora do Escopo com motivo
- [ ] Requisitos emergentes adicionados ao Ativo
- [ ] Novas decisões registradas com justificativa
- [ ] "O Que É" atualizado se o produto mudou
- [ ] Rodapé "Última atualização" reflete esta transição

</step>

<step name="update_current_position_after_transition">

**Nota:** As atualizações básicas de posição (Fase Atual, Status, Plano Atual, Última Atividade) já foram tratadas pelo `tools phase complete` no passo update_roadmap_and_state.

Verifique se as atualizações estão corretas lendo STATE.md. Se a barra de progresso precisar de atualização, use:

```bash
PROGRESS=$(node "./.claude/framework/bin/tools.cjs" progress bar --raw)
```

Atualize a linha da barra de progresso no STATE.md com o resultado.

**Passo concluído quando:**

- [ ] Número da fase incrementado para a próxima fase (feito por phase complete)
- [ ] Status do plano redefinido para "Não iniciado" (feito por phase complete)
- [ ] Status mostra "Pronto para planejar" (feito por phase complete)
- [ ] Barra de progresso reflete o total de planos concluídos

</step>

<step name="update_project_reference">

Atualize a seção de Referência do Projeto no STATE.md.

```markdown
## Referência do Projeto

Ver: .planning/PROJECT.md (atualizado em [hoje])

**Valor central:** [Valor central atual do PROJECT.md]
**Foco atual:** [Nome da próxima fase]
```

Atualize a data e o foco atual para refletir a transição.

</step>

<step name="review_accumulated_context">

Revise e atualize a seção de Contexto Acumulado no STATE.md.

**Decisões:**

- Note decisões recentes desta fase (máx. 3-5)
- O log completo está na tabela de Decisões-Chave do PROJECT.md

**Bloqueadores/Preocupações:**

- Revise os bloqueadores da fase concluída
- Se resolvidos nesta fase: Remova da lista
- Se ainda relevantes para o futuro: Mantenha com prefixo "Fase X"
- Adicione quaisquer novas preocupações dos resumos da fase concluída

**Exemplo:**

Antes:

```markdown
### Bloqueadores/Preocupações

- ⚠️ [Fase 1] Schema do banco de dados sem índice para consultas comuns
- ⚠️ [Fase 2] Comportamento de reconexão WebSocket em redes instáveis desconhecido
```

Depois (se a indexação do banco de dados foi resolvida na Fase 2):

```markdown
### Bloqueadores/Preocupações

- ⚠️ [Fase 2] Comportamento de reconexão WebSocket em redes instáveis desconhecido
```

**Passo concluído quando:**

- [ ] Decisões recentes anotadas (log completo no PROJECT.md)
- [ ] Bloqueadores resolvidos removidos da lista
- [ ] Bloqueadores não resolvidos mantidos com prefixo de fase
- [ ] Novas preocupações da fase concluída adicionadas

</step>

<step name="update_session_continuity_after_transition">

Atualize a seção de Continuidade de Sessão no STATE.md para refletir a conclusão da transição.

**Formato:**

```markdown
Última sessão: [hoje]
Parou em: Fase [X] concluída, pronta para planejar a Fase [X+1]
Arquivo de retomada: Nenhum
```

**Passo concluído quando:**

- [ ] Timestamp da última sessão atualizado para data e hora atuais
- [ ] "Parou em" descreve a conclusão da fase e a próxima fase
- [ ] Arquivo de retomada confirmado como Nenhum (transições não usam arquivos de retomada)

</step>

<step name="offer_next_phase">

**OBRIGATÓRIO: Verificar o status do marco antes de apresentar os próximos passos.**

**Use o resultado da transição do `tools phase complete`:**

O campo `is_last_phase` do resultado de phase complete informa diretamente:
- `is_last_phase: false` → Mais fases restam → Vá para **Rota A**
- `is_last_phase: true` → Última fase concluída → **Verifique primeiro colisões de workstream**

Os campos `next_phase` e `next_phase_name` fornecem os detalhes da próxima fase.

Se precisar de contexto adicional, use:
```bash
ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)
```

Isto retorna todas as fases com objetivos, status em disco e informações de conclusão.

---

**Verificação de colisão de workstream (quando `is_last_phase: true`):**

Antes de rotear para a Rota B, verifique se outros workstreams ainda estão ativos.
Isto evita que um workstream avance ou conclua o marco enquanto outros workstreams
ainda estão trabalhando em suas fases.

**Pule esta verificação se NÃO estiver no modo workstream** (ou seja, `WORKSTREAM` não está definido / modo plano).
No modo plano, vá diretamente para **Rota B**.

```bash
# Verifique apenas se estamos no modo workstream
if [ -n "$WORKSTREAM" ]; then
  WS_LIST=$(node "./.claude/framework/bin/tools.cjs" workstream list --raw)
fi
```

Analise o resultado JSON. A saída tem `{ mode, workstreams: [...] }`.
Cada entrada de workstream tem: `name`, `status`, `current_phase`, `phase_count`, `completed_phases`.

Filtre o workstream atual (`$WORKSTREAM`) e quaisquer workstreams com
status contendo "milestone complete" ou "archived" (sem distinção de maiúsculas).
As entradas restantes são **outros workstreams ativos**.

- **Se outros workstreams ativos existirem** → Vá para **Rota B1**
- **Se NÃO houver outros workstreams ativos** (ou modo plano) → Vá para **Rota B**

---

**Rota A: Mais fases restam no marco**

Leia ROADMAP.md para obter o nome e o objetivo da próxima fase.

**Verifique se a próxima fase tem CONTEXT.md:**

```bash
ls .planning/phases/*[X+1]*/*-CONTEXT.md 2>/dev/null || true
```

**Se a próxima fase existir:**

<if mode="yolo">

**Se CONTEXT.md existir:**

```
Fase [X] marcada como concluída.

Próxima: Fase [X+1] — [Nome]

⚡ Continuando automaticamente: Planejar a Fase [X+1] em detalhe
```

Saia do skill e invoque SlashCommand("/planejar-fase [X+1] --auto ${WS}")

**Se CONTEXT.md NÃO existir:**

```
Fase [X] marcada como concluída.

Próxima: Fase [X+1] — [Nome]

⚡ Continuando automaticamente: Discutir a Fase [X+1] primeiro
```

Saia do skill e invoque SlashCommand("/discutir-fase [X+1] --auto ${WS}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

**Se CONTEXT.md NÃO existir:**

```
## ✓ Fase [X] Concluída

---

## ▶ Próximo Passo

**Fase [X+1]: [Nome]** — [Objetivo do ROADMAP.md]

`/discutir-fase [X+1] ${WS}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `/planejar-fase [X+1] ${WS}` — pular discussão, planejar diretamente
- `/pesquisar-fase [X+1] ${WS}` — investigar incógnitas

---
```

**Se CONTEXT.md existir:**

```
## ✓ Fase [X] Concluída

---

## ▶ Próximo Passo

**Fase [X+1]: [Nome]** — [Objetivo do ROADMAP.md]
<sub>✓ Contexto coletado, pronto para planejar</sub>

`/planejar-fase [X+1] ${WS}`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `/discutir-fase [X+1] ${WS}` — revisitar contexto
- `/pesquisar-fase [X+1] ${WS}` — investigar incógnitas

---
```

</if>

---

**Rota B1: Workstream concluído, outros workstreams ainda ativos**

Esta rota é alcançada quando `is_last_phase: true` E a verificação de colisão encontrou
outros workstreams ativos. NÃO sugira concluir o marco ou avançar para o próximo marco —
outros workstreams ainda estão trabalhando.

**Limpe o flag de encadeamento automático** — o limite do workstream é o ponto de parada natural:

```bash
node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false
```

<if mode="yolo">

Substitua o avanço automático: NÃO continue automaticamente para a conclusão do marco.
Apresente as informações de bloqueio e pare.

</if>

Apresente (todos os modos):

```
## ✓ Fase {X}: {Nome da Fase} Concluída

As fases deste workstream estão concluídas. Outros workstreams ainda estão ativos:

| Workstream | Status | Fase | Progresso |
|------------|--------|------|-----------|
| {nome}     | {status} | {current_phase} | {completed_phases}/{phase_count} |
| ...        | ...    | ...  | ...       |

---

## Próximos Passos

Arquivar este workstream:

`/workstreams complete {current_ws_name} ${WS}`

Ver o progresso geral do marco:

`/workstreams progress ${WS}`

<sub>A conclusão do marco estará disponível quando todos os workstreams terminarem.</sub>

---
```

NÃO sugira `/concluir-marco` ou `/novo-marco`.
NÃO invoque automaticamente mais slash commands.

**Pare aqui.** O usuário deve decidir explicitamente o que fazer em seguida.

---

**Rota B: Marco concluído (todas as fases finalizadas)**

**Esta rota é alcançada apenas quando:**
- `is_last_phase: true` E não há outros workstreams ativos (ou modo plano)

**Limpe o flag de encadeamento automático** — o limite do marco é o ponto de parada natural:

```bash
node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false
```

<if mode="yolo">

```
Fase {X} marcada como concluída.

🎉 Marco {versão} está 100% concluído — todas as {N} fases finalizadas!

⚡ Continuando automaticamente: Concluir o marco e arquivar
```

Saia do skill e invoque SlashCommand("/concluir-marco {versão} ${WS}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

```
## ✓ Fase {X}: {Nome da Fase} Concluída

🎉 Marco {versão} está 100% concluído — todas as {N} fases finalizadas!

---

## ▶ Próximo Passo

**Concluir Marco {versão}** — arquivar e preparar para o próximo

`/concluir-marco {versão} ${WS}`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- Revisar as realizações antes de arquivar

---
```

</if>

</step>

</process>

<implicit_tracking>
O rastreamento de progresso é IMPLÍCITO: planejar a fase N implica que as fases 1-(N-1) estão concluídas. Sem etapa separada de progresso — o movimento para frente É o progresso.
</implicit_tracking>

<partial_completion>

Se o usuário quiser seguir em frente, mas a fase não estiver totalmente concluída:

```
Fase [X] tem planos incompletos:
- {fase}-02-PLAN.md (não executado)
- {fase}-03-PLAN.md (não executado)

Opções:
1. Marcar como concluído mesmo assim (planos não foram necessários)
2. Adiar trabalho para fase posterior
3. Ficar e terminar a fase atual
```

Respeite o julgamento do usuário — ele sabe se o trabalho importa.

**Se marcando como concluído com planos incompletos:**

- Atualize ROADMAP: "2/3 planos concluídos" (não "3/3")
- Note na mensagem de transição quais planos foram pulados

</partial_completion>

<success_criteria>

A transição está concluída quando:

- [ ] Resumos de plano da fase atual verificados (todos existem ou usuário escolheu pular)
- [ ] Quaisquer handoffs obsoletos excluídos
- [ ] ROADMAP.md atualizado com status de conclusão e contagem de planos
- [ ] PROJECT.md evoluído (requisitos, decisões, descrição se necessário)
- [ ] STATE.md atualizado (posição, referência do projeto, contexto, sessão)
- [ ] Tabela de progresso atualizada
- [ ] Usuário conhece os próximos passos

</success_criteria>
