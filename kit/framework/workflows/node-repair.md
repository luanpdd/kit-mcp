<purpose>
Operador de reparo autônomo para verificação de tarefas com falha. Invocado pelo execute-plan quando uma tarefa não passa nos critérios de conclusão. Propõe e tenta correções estruturadas antes de escalar ao usuário.
</purpose>

<inputs>
- FAILED_TASK: Número, nome e critérios de conclusão da tarefa no plano
- ERROR: O que a verificação produziu — resultado real vs. esperado
- PLAN_CONTEXT: Tarefas adjacentes e objetivo da fase (para consciência de restrições)
- REPAIR_BUDGET: Máximo de tentativas de reparo restantes (padrão: 2)
</inputs>

<repair_directive>
Analise a falha e escolha exatamente uma estratégia de reparo:

**RETRY** — A abordagem estava correta, mas a execução falhou. Tente novamente com um ajuste concreto.
- Usar quando: erro de comando, dependência ausente, caminho errado, problema de ambiente, falha transiente
- Saída: `RETRY: [ajuste específico a fazer antes de tentar novamente]`

**DECOMPOSE** — A tarefa é muito ampla. Divida em sub-etapas menores verificáveis.
- Usar quando: os critérios de conclusão cobrem múltiplos aspectos, lacunas de implementação são estruturais
- Saída: `DECOMPOSE: [sub-tarefa 1] | [sub-tarefa 2] | ...` (máx. 3 sub-tarefas)
- Sub-tarefas devem ter, cada uma, um único resultado verificável

**PRUNE** — A tarefa é inviável dadas as restrições atuais. Pule com justificativa.
- Usar quando: pré-requisito ausente e não corrigível aqui, fora do escopo, contradiz uma decisão anterior
- Saída: `PRUNE: [justificativa em uma frase]`

**ESCALATE** — Orçamento de reparo esgotado, ou esta é uma decisão arquitetural (Regra 4).
- Usar quando: RETRY falhou mais de uma vez com abordagens diferentes, ou a correção requer mudança estrutural
- Saída: `ESCALATE: [o que foi tentado] | [qual decisão é necessária]`
</repair_directive>

<process>

<step name="diagnose">
Leia o erro e os critérios de conclusão com atenção. Pergunte:
1. É um problema transitório/ambiental? → RETRY
2. A tarefa é verificavelmente muito ampla? → DECOMPOSE
3. Um pré-requisito está genuinamente ausente e não pode ser corrigido no escopo? → PRUNE
4. RETRY já foi tentado para esta tarefa? Verifique REPAIR_BUDGET. Se 0 → ESCALATE
</step>

<step name="execute_retry">
Se RETRY:
1. Aplique o ajuste específico declarado na diretiva
2. Execute novamente a implementação da tarefa
3. Execute novamente a verificação
4. Se passar → continue normalmente, registre `[Node Repair - RETRY] Tarefa [X]: [ajuste feito]`
5. Se falhar novamente → decremente REPAIR_BUDGET, invoque node-repair novamente com contexto atualizado
</step>

<step name="execute_decompose">
Se DECOMPOSE:
1. Substitua a tarefa com falha pelas sub-tarefas inline (não modifique PLAN.md em disco)
2. Execute as sub-tarefas sequencialmente, cada uma com sua própria verificação
3. Se todas passarem → trate a tarefa original como bem-sucedida, registre `[Node Repair - DECOMPOSE] Tarefa [X] → [N] sub-tarefas`
4. Se uma sub-tarefa falhar → invoque node-repair novamente para essa sub-tarefa (REPAIR_BUDGET aplica-se por sub-tarefa)
</step>

<step name="execute_prune">
Se PRUNE:
1. Marque a tarefa como pulada com justificativa
2. Registre no SUMMARY "Problemas Encontrados": `[Node Repair - PRUNE] Tarefa [X]: [justificativa]`
3. Continue para a próxima tarefa
</step>

<step name="execute_escalate">
Se ESCALATE:
1. Suba para o usuário via verification_failure_gate com histórico completo de reparo
2. Apresente: o que foi tentado (cada tentativa RETRY/DECOMPOSE), qual é o bloqueador, opções disponíveis
3. Aguarde a direção do usuário antes de continuar
</step>

</process>

<logging>
Todas as ações de reparo devem aparecer no SUMMARY.md em "## Desvios do Plano":

| Tipo | Formato |
|------|--------|
| RETRY com sucesso | `[Node Repair - RETRY] Tarefa X: [ajuste] — resolvido` |
| RETRY falha → ESCALATE | `[Node Repair - RETRY] Tarefa X: [N] tentativas esgotadas — escalado ao usuário` |
| DECOMPOSE | `[Node Repair - DECOMPOSE] Tarefa X dividida em [N] sub-tarefas — todas passaram` |
| PRUNE | `[Node Repair - PRUNE] Tarefa X pulada: [justificativa]` |
</logging>

<constraints>
- REPAIR_BUDGET padrão é 2 por tarefa. Configurável via config.json `workflow.node_repair_budget`.
- Nunca modifique PLAN.md em disco — sub-tarefas decompostas existem apenas em memória.
- Sub-tarefas DECOMPOSE devem ser mais específicas que a original, não apenas reescritas sinônimas.
- Se config.json `workflow.node_repair` for `false`, pule diretamente para verification_failure_gate (o usuário mantém o comportamento original).
</constraints>
