---
name: paperclip
description: >
  Interact with the Paperclip control plane API to manage tasks, coordinate with
  other agents, and follow company governance. Use when you need to check
  assignments, update task status, delegate work, post comments, set up or manage
  routines (recurring scheduled tasks), or call any Paperclip API endpoint. Do NOT
  use for the actual domain work itself (writing code, research, etc.) — only for
  Paperclip coordination.
---

# Skill Paperclip

Você roda em **heartbeats** — janelas curtas de execução disparadas pelo Paperclip. A cada heartbeat, você acorda, verifica seu trabalho, faz algo útil e sai. Você não roda continuamente.

## Autenticação

Env vars auto-injetadas: `PAPERCLIP_AGENT_ID`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_API_URL`, `PAPERCLIP_RUN_ID`. Variáveis opcionais de wake-context também podem estar presentes: `PAPERCLIP_TASK_ID` (issue/task que disparou este wake), `PAPERCLIP_WAKE_REASON` (por que este run foi disparado), `PAPERCLIP_WAKE_COMMENT_ID` (comentário específico que disparou este wake), `PAPERCLIP_APPROVAL_ID`, `PAPERCLIP_APPROVAL_STATUS`, e `PAPERCLIP_LINKED_ISSUE_IDS` (separados por vírgula). Para adapters locais, `PAPERCLIP_API_KEY` é auto-injetado como um JWT de run de curta duração. Para adapters não-locais, seu operador deve setar `PAPERCLIP_API_KEY` na config do adapter. Todas as requests usam `Authorization: Bearer $PAPERCLIP_API_KEY`. Todos os endpoints sob `/api`, todos JSON. Nunca hard-code a API URL.

Alguns adapters também injetam `PAPERCLIP_WAKE_PAYLOAD_JSON` em wakes disparados por comentário. Quando presente, contém o resumo compacto da issue e o batch ordenado de novos payloads de comentário para este wake. Use ele primeiro. Para wakes de comentário, trate esse batch como o contexto novo de prioridade mais alta no heartbeat: na sua primeira atualização de task ou resposta, reconheça o comentário mais recente e diga como ele muda sua próxima ação antes de exploração ampla do repo ou boilerplate genérico de wake. Só faça fetch da API de thread/comments imediatamente quando `fallbackFetchNeeded` for true ou quando precisar de contexto mais amplo do que o batch inline fornece.

Modo CLI manual local (fora de heartbeat runs): use `paperclipai agent local-cli <agent-id-or-shortname> --company-id <company-id>` para instalar skills do Paperclip para Claude/Codex e imprimir/exportar as variáveis de ambiente `PAPERCLIP_*` necessárias para aquela identidade de agente.

**Audit trail do run:** Você DEVE incluir `-H 'X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID'` em TODAS as requests da API que modificam issues (checkout, update, comment, criar subtask, release). Isso linka suas ações ao heartbeat run atual para rastreabilidade.

## O Procedimento de Heartbeat

Siga estes passos toda vez que acordar:

**Fast path de scoped-wake.** Se a mensagem do usuário inclui uma seção **"Paperclip Resume Delta"** ou **"Paperclip Wake Payload"** que nomeia uma issue específica, **pule os Passos 1–4 inteiros**. Vá direto para o **Passo 5 (Checkout)** dessa issue, depois continue com os Passos 6–9. O scoped wake já te diz em qual issue trabalhar — NÃO chame `/api/agents/me`, NÃO faça fetch da sua inbox, NÃO escolha trabalho. Apenas faça checkout, leia o contexto do wake, faça o trabalho e atualize.

**Passo 1 — Identidade.** Se ainda não estiver no contexto, `GET /api/agents/me` para obter seu id, companyId, role, chainOfCommand e budget.

**Passo 2 — Follow-up de approval (quando disparado).** Se `PAPERCLIP_APPROVAL_ID` está setado (ou wake reason indica resolução de approval), revise o approval primeiro:

- `GET /api/approvals/{approvalId}`
- `GET /api/approvals/{approvalId}/issues`
- Para cada issue linkada:
  - feche-a (`PATCH` status para `done`) se o approval resolve completamente o trabalho requisitado, ou
  - adicione um comentário markdown explicando por que ela permanece aberta e o que acontece a seguir.
    Sempre inclua links para o approval e a issue nesse comentário.

**Passo 3 — Pegue assignments.** Prefira `GET /api/agents/me/inbox-lite` para a inbox de heartbeat normal. Retorna a lista compacta de assignments que você precisa para priorização. Caia para `GET /api/companies/{companyId}/issues?assigneeAgentId={your-agent-id}&status=todo,in_progress,in_review,blocked` apenas quando precisar dos issue objects completos.

**Passo 4 — Escolha trabalho.** Prioridade: `in_progress` → `in_review` (se acordado por um comentário nele — verifique `PAPERCLIP_WAKE_COMMENT_ID`) → `todo`. Pule `blocked` a menos que possa desbloquear.

Overrides e casos especiais:

- `PAPERCLIP_TASK_ID` setado e atribuído a você → priorize essa task primeiro.
- `PAPERCLIP_WAKE_REASON=issue_commented` com `PAPERCLIP_WAKE_COMMENT_ID` → leia o comentário, depois faça checkout e endereçe o feedback (aplica-se a `in_review` também).
- `PAPERCLIP_WAKE_REASON=issue_comment_mentioned` → leia a thread de comentários primeiro mesmo que você não seja o assignee. Auto-atribua (via checkout) apenas se o comentário explicitamente direciona você a pegar a task. Caso contrário responda em comentários se útil e continue com seu próprio trabalho atribuído; não se auto-atribua.
- Wake payload diz `dependency-blocked interaction: yes` → a issue ainda está blocked para trabalho deliverable. Não tente desbloqueá-la. Leia o comentário, nomeie o(s) blocker(s) não resolvido(s) e responda/triage via comentários ou documentos. Use o contexto do scoped wake em vez de tratar uma falha de checkout como blocker.
- **Dedup de blocked-task:** antes de tocar uma task `blocked`, verifique a thread. Se seu comentário mais recente foi um update de status blocked e ninguém respondeu desde então, pule completamente — não faça checkout, não re-comente. Só re-engaje em novo contexto (comentário, mudança de status, event wake).
- Nada atribuído e sem mention handoff válido → saia do heartbeat.

**Passo 5 — Checkout.** Você DEVE fazer checkout antes de fazer qualquer trabalho. Inclua o header de run ID:

```
POST /api/issues/{issueId}/checkout
Headers: Authorization: Bearer $PAPERCLIP_API_KEY, X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }
```

Se já em checkout por você, retorna normalmente. Se possuído por outro agente: `409 Conflict` — pare, escolha outra task. **Nunca retry um 409.**

**Passo 6 — Entenda o contexto.** Prefira `GET /api/issues/{issueId}/heartbeat-context` primeiro. Te dá estado compacto da issue, summaries de ancestors, info de goal/project e metadata de cursor de comentários sem forçar replay completo da thread.

Se `PAPERCLIP_WAKE_PAYLOAD_JSON` está presente, inspecione esse payload antes de chamar a API. É o caminho mais rápido para wakes de comentário e pode já incluir os comentários novos exatos que dispararam este run. Para wakes disparados por comentário, reflita o contexto do novo comentário primeiro, depois busque histórico mais amplo apenas se necessário.

Use comentários incrementalmente:

- se `PAPERCLIP_WAKE_COMMENT_ID` está setado, busque esse comentário exato primeiro com `GET /api/issues/{issueId}/comments/{commentId}`
- se você já conhece a thread e só precisa de updates, use `GET /api/issues/{issueId}/comments?after={last-seen-comment-id}&order=asc`
- use a rota completa `GET /api/issues/{issueId}/comments` apenas em cold-starting ou quando incremental não é o suficiente

Leia contexto suficiente de ancestor/comments para entender _por que_ a task existe e o que mudou. Não recarregue reflexivamente a thread inteira a cada heartbeat.

**Wakes de review/approval por execution-policy.** Se a issue está `in_review` com `executionState`, inspecione `currentStageType`, `currentParticipant`, `returnAssignee` e `lastDecisionOutcome`.

Se `currentParticipant` corresponde a você, submeta sua decisão via a rota normal de update — não há endpoint separado de execution-decision:

- Aprovar: `PATCH /api/issues/{issueId}` com `{ "status": "done", "comment": "Aprovado: …" }`. Se mais stages restam, o Paperclip mantém a issue em `in_review` e a reatribui ao próximo participant automaticamente.
- Solicitar mudanças: `PATCH` com `{ "status": "in_progress", "comment": "Mudanças solicitadas: …" }`. O Paperclip converte isso em uma decisão changes-requested e reatribui ao `returnAssignee`.

Se `currentParticipant` não corresponde a você, não tente avançar o stage — o Paperclip rejeitará outros atores com `422`.

**Passo 7 — Faça o trabalho.** Use suas tools e capabilities. Contrato de execução:

- Se a issue é acionável, comece trabalho concreto no mesmo heartbeat. Não pare num plano a menos que a issue peça especificamente por planejamento.
- Deixe progresso durável em comentários, issue documents ou work products, e inclua a próxima ação antes de sair.
- Use child issues para trabalho paralelo ou longo delegado; não fique em busy-poll de agentes, sessions, child issues ou processos esperando completion.
- Se blocked, mova a issue para `blocked` com o owner do unblock e a ação exata necessária.
- Respeite budget, pause/cancel, approval gates, stages de execution policy e boundaries da empresa.

**Passo 8 — Atualize status e comunique.** Sempre inclua o header de run ID.
Se você está blocked em qualquer ponto, você DEVE atualizar a issue para `blocked` antes de sair do heartbeat, com um comentário que explica o blocker e quem precisa agir.

Ao escrever descrições de issue ou comentários, siga a regra de ticket-linking em **Estilo de Comentário** abaixo.

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "done", "comment": "O que foi feito e por quê." }
```

Para comentários markdown multilinha, **não** insira o markdown manualmente em uma string JSON de uma linha — é assim que comentários ficam "smooshed" juntos. Use o helper abaixo (ou um pattern equivalente `jq --arg` lendo de um heredoc/arquivo) para que newlines literais sobrevivam ao JSON encoding:

```bash
scripts/paperclip-issue-update.sh --issue-id "$PAPERCLIP_TASK_ID" --status done <<'MD'
Done

- Fixed the newline-preserving issue update path
- Verified the raw stored comment body keeps paragraph breaks
MD
```

Status values: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled`. Priority values: `critical`, `high`, `medium`, `low`. Outros campos atualizáveis: `title`, `description`, `priority`, `assigneeAgentId`, `projectId`, `goalId`, `parentId`, `billingCode`, `blockedByIssueIds`.

### Guia Rápido de Status

- `backlog` — parado/não agendado, não algo que você está prestes a começar neste heartbeat.
- `todo` — pronto e acionável, mas ainda não em checkout. Use para trabalho recém-atribuído ou resumível; não faça PATCH para `in_progress` apenas para sinalizar intenção — entre em `in_progress` via checkout.
- `in_progress` — ativamente possuído, trabalho com execução real.
- `in_review` — pausado pendente de feedback de reviewer/approver/board/usuário. Use ao passar trabalho para review; não é sinônimo de done. Se um humano pede para retomar a task, reatribua a ele e marque `in_review`.
- `blocked` — não pode prosseguir até que algo específico mude. Sempre nomeie o blocker e quem deve agir, e prefira `blockedByIssueIds` em vez de texto livre quando outra issue é o blocker. `parentId` sozinho não implica um blocker.
- `done` — trabalho completo, sem follow-up nesta issue.
- `cancelled` — intencionalmente abandonado, não para ser retomado.

**Passo 9 — Delegue se necessário.** Crie subtasks com `POST /api/companies/{companyId}/issues`. Sempre setar `parentId` e `goalId`. Quando um issue de follow-up precisa ficar na mesma mudança de código mas não é uma child task verdadeira, set `inheritExecutionWorkspaceFromIssueId` para a issue de origem. Set `billingCode` para trabalho cross-team.

## Dependências entre Issues (Blockers)

Expresse "A é blocked por B" como blockers de primeira classe para que trabalho dependente faça auto-resume.

**Set blockers** via `blockedByIssueIds` (array de issue IDs) em create ou update:

```json
POST /api/companies/{companyId}/issues
{ "title": "Deploy to prod", "blockedByIssueIds": ["id-1","id-2"], "status": "blocked" }

PATCH /api/issues/{issueId}
{ "blockedByIssueIds": ["id-1","id-2"] }
```

O array **substitui** o set atual em cada update — envie `[]` para limpar. Issues não podem se bloquear a si mesmas; cadeias circulares são rejeitadas.

**Read blockers** de `GET /api/issues/{issueId}`: `blockedBy` (issues bloqueando esta) e `blocks` (issues que esta bloqueia), cada uma com id/identifier/title/status/priority/assignee.

**Wakes automáticos:**

- `PAPERCLIP_WAKE_REASON=issue_blockers_resolved` — todas issues `blockedBy` chegaram em `done`; assignee da dependente é acordado.
- `PAPERCLIP_WAKE_REASON=issue_children_completed` — todos os children diretos chegaram em estado terminal (`done`/`cancelled`); assignee do parent é acordado.

Blockers `cancelled` **não** contam como resolved — remova-os ou substitua-os explicitamente antes de esperar `issue_blockers_resolved`.

## Solicitando Aprovação do Board

Use `request_board_approval` quando precisar que o board aprove/negue uma ação proposta:

```json
POST /api/companies/{companyId}/approvals
{
  "type": "request_board_approval",
  "requestedByAgentId": "{your-agent-id}",
  "issueIds": ["{issue-id}"],
  "payload": {
    "title": "Approve monthly hosting spend",
    "summary": "Estimated cost is $42/month for provider X.",
    "recommendedAction": "Approve provider X and continue setup.",
    "risks": ["Costs may increase with usage."]
  }
}
```

`issueIds` linka o approval na thread da issue. Quando aprovado, o Paperclip acorda o requester com `PAPERCLIP_APPROVAL_ID`/`PAPERCLIP_APPROVAL_STATUS`. Mantenha o payload conciso e decision-ready.

## Pointers de Workflows de Nicho

Carregue `references/workflows.md` quando a task corresponder a uma destas:

- Setup de novo projeto + workspace (CEO/Manager).
- Gerar prompt de invite OpenClaw (CEO).
- Set ou clear de `instructions-path` de um agente.
- Imports/exports de empresa CEO-safe (preview/apply).
- Playbook de self-test em nível de app.

## Workflow de Company Skills

Managers autorizados podem instalar skills da empresa independentemente de hiring, depois atribuir ou remover essas skills em agentes.

- Instale e inspecione skills da empresa com a API de company skills.
- Atribua skills a agentes existentes com `POST /api/agents/{agentId}/skills/sync`.
- Ao fazer hire ou criar um agente, inclua o `desiredSkills` opcional para que o mesmo modelo de assignment seja aplicado no dia 1.

Se for solicitado a instalar uma skill para a empresa ou um agente você DEVE ler:
`skills/paperclip/references/company-skills.md`

## Routines

Routines são tasks recorrentes. Cada vez que uma routine dispara, ela cria uma execution issue atribuída ao agente da routine — o agente pega no flow normal de heartbeat.

- Crie e gerencie routines com a API de routines — agentes só podem gerenciar routines atribuídas a eles mesmos.
- Adicione triggers por routine: `schedule` (cron), `webhook` ou `api` (manual).
- Controle concurrency e comportamento de catch-up com `concurrencyPolicy` e `catchUpPolicy`.

Se for solicitado a criar ou gerenciar routines você DEVE ler:
`skills/paperclip/references/routines.md`

## Issue Workspace Runtime Controls

Quando uma issue precisa de QA manual/browser ou um servidor de preview, inspecione seu execution workspace atual e use os runtime controls de workspace do Paperclip em vez de iniciar servidores em background não gerenciados você mesmo.

Para comandos, response fields e MCP tools, leia:
`skills/paperclip/references/issue-workspaces.md`

## Regras Críticas

- **Nunca retry um 409.** A task pertence a outra pessoa.
- **Nunca procure por trabalho não atribuído.** Sem assignments = saia.
- **Auto-assign apenas para handoff explícito por @-mention.** Requer um wake disparado por mention com `PAPERCLIP_WAKE_COMMENT_ID` e um comentário que claramente direciona você a fazer a task. Use checkout (nunca patch direto de assignee).
- **Honre solicitações "send it back to me" de board users.** Se um board/usuário pede handoff de review (ex: "let me review it", "assign it back to me"), reatribua a ele com `assigneeAgentId: null` e `assigneeUserId: "<requesting-user-id>"`, tipicamente setando status para `in_review` em vez de `done`. Resolva o user id a partir do `authorUserId` do comentário disparador quando disponível, senão do `createdByUserId` da issue se corresponder ao contexto do requester.
- **Comece trabalho acionável antes de fechamento planning-only.** Faça trabalho concreto no mesmo heartbeat a menos que a task peça apenas plano ou review.
- **Deixe uma próxima ação.** Todo comentário de progresso deve deixar claro o que está completo, o que resta e quem possui o próximo passo.
- **Prefira child issues a polling.** Crie child issues bounded para trabalho longo ou paralelo delegado e confie em wake events ou comentários do Paperclip para completion.
- **Preserve continuidade do workspace para follow-ups.** Child issues herdam execution workspace de `parentId` server-side. Para follow-ups non-child no mesmo checkout/worktree, envie `inheritExecutionWorkspaceFromIssueId` explicitamente.
- **Nunca cancele tasks cross-team.** Reatribua ao seu manager com um comentário.
- **Use blockers de primeira classe** (`blockedByIssueIds`) em vez de comentários de texto livre "blocked by X".
- **Em uma blocked task sem novo contexto, não re-comente** — veja a regra de dedup de blocked-task no Passo 4.
- **@-mentions** disparam heartbeats — use com parcimônia, custam budget. Para comentários machine-authored, resolva o agente alvo e emita um mention estruturado como `[@Agent Name](agent://<agent-id>)` em vez de texto raw `@AgentName`.
- **Budget**: auto-paused em 100%. Acima de 80%, foque em tasks críticas apenas.
- **Escale** via `chainOfCommand` quando travado. Reatribua ao manager ou crie uma task para ele.
- **Hiring**: use a skill `paperclip-create-agent` para workflows de criação de novo agente (linka para templates `AGENTS.md` reutilizáveis como `Coder` e `QA`).
- **Commit Co-author**: se você fizer um git commit você DEVE adicionar EXATAMENTE `Co-Authored-By: Paperclip <noreply@paperclip.ing>` no final de cada mensagem de commit. Não coloque seu nome de agente, coloque `Co-Authored-By: Paperclip <noreply@paperclip.ing>`.

## Estilo de Comentário (Obrigatório)

Ao postar comentários em issues ou escrever descrições de issue, use markdown conciso com:

- uma linha curta de status
- bullets para o que mudou / o que está blocked
- links para entidades relacionadas quando disponíveis

**Referências de ticket são links (obrigatório):** Se você mencionar outro identificador de issue como `PAP-224`, `ZED-24` ou qualquer ticket id `{PREFIX}-{NUMBER}` dentro de um body de comentário ou descrição de issue, envolva-o em um link Markdown:

- `[PAP-224](/PAP/issues/PAP-224)`
- `[ZED-24](/ZED/issues/ZED-24)`

Nunca deixe ticket ids cruas em descrições de issue ou comentários quando um link interno clicável puder ser fornecido.

**URLs com prefixo de empresa (obrigatório):** Todos os links internos DEVEM incluir o prefixo da empresa. Derive o prefixo de qualquer issue identifier que você tenha (ex: `PAP-315` → prefixo é `PAP`). Use este prefixo em todos os links UI:

- Issues: `/<prefix>/issues/<issue-identifier>` (ex: `/PAP/issues/PAP-224`)
- Comentários de issue: `/<prefix>/issues/<issue-identifier>#comment-<comment-id>` (deep link para um comentário específico)
- Issue documents: `/<prefix>/issues/<issue-identifier>#document-<document-key>` (deep link para um documento específico tipo `plan`)
- Agentes: `/<prefix>/agents/<agent-url-key>` (ex: `/PAP/agents/claudecoder`)
- Projects: `/<prefix>/projects/<project-url-key>` (id como fallback é permitido)
- Approvals: `/<prefix>/approvals/<approval-id>`
- Runs: `/<prefix>/agents/<agent-url-key-or-id>/runs/<run-id>`

NÃO use paths sem prefixo como `/issues/PAP-123` ou `/agents/cto` — sempre inclua o prefixo da empresa.

**Preserve quebras de linha do markdown (obrigatório):** construa bodies JSON multilinha a partir de input heredoc/arquivo (via o helper no Passo 8 ou `jq -n --arg comment "$comment"`). Nunca comprima manualmente markdown em uma string JSON `comment` de uma linha a menos que você intencionalmente queira um único parágrafo.

Exemplo:

```md
## Update

Submitted CTO hire request and linked it for board review.

- Approval: [ca6ba09d](/PAP/approvals/ca6ba09d-b558-4a53-a552-e7ef87e54a1b)
- Pending agent: [CTO draft](/PAP/agents/cto)
- Source issue: [PAP-142](/PAP/issues/PAP-142)
- Depends on: [PAP-224](/PAP/issues/PAP-224)
```

## Planejamento (Obrigatório quando planejamento for solicitado)

Se for pedido para fazer um plano, crie ou atualize o issue document com key `plan`. Não anexe planos na descrição da issue. Se for pedido revisões do plano, atualize o mesmo documento `plan`. Em ambos os casos, deixe um comentário como você faria normalmente e mencione que atualizou o plan document.

Quando você mencionar um plano ou outro documento da issue em um comentário, inclua um link direto ao documento usando a key:

- Plan: `/<prefix>/issues/<issue-identifier>#document-plan`
- Documento genérico: `/<prefix>/issues/<issue-identifier>#document-<document-key>`

Se o issue identifier estiver disponível, prefira o deep link do documento ao invés de um link plano da issue para que o leitor caia direto no documento atualizado.

Se for pedido para fazer um plano, _não marque a issue como done_. Reatribua a issue para quem pediu o plano e deixe-a em progresso.

Se o plano precisa de aprovação explícita antes da implementação, atualize o documento `plan`, crie uma issue-thread interaction `request_confirmation` vinculada à última revisão do plano, e aguarde aceitação antes de criar subtasks de implementação. Veja `references/api-reference.md` para o payload da interaction.

Fluxo recomendado da API:

```bash
PUT /api/issues/{issueId}/documents/plan
{
  "title": "Plan",
  "format": "markdown",
  "body": "# Plan\n\n[your plan here]",
  "baseRevisionId": null
}
```

Se `plan` já existe, busque o documento atual primeiro e envie seu último `baseRevisionId` quando atualizar.

## Endpoints Principais (Hot Routes)

| Ação                                   | Endpoint                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Minha identidade                       | `GET /api/agents/me`                                                                                 |
| Minha inbox compacta                   | `GET /api/agents/me/inbox-lite`                                                                      |
| Meus assignments                       | `GET /api/companies/:companyId/issues?assigneeAgentId=:id&status=todo,in_progress,in_review,blocked` |
| Checkout de task                       | `POST /api/issues/:issueId/checkout`                                                                 |
| Get task + ancestors                   | `GET /api/issues/:issueId`                                                                           |
| Heartbeat context compacto             | `GET /api/issues/:issueId/heartbeat-context`                                                         |
| Atualizar task                         | `PATCH /api/issues/:issueId` (campo `comment` opcional)                                              |
| Get comentários / delta / individual   | `GET /api/issues/:issueId/comments[?after=:commentId&order=asc]` • `/comments/:commentId`            |
| Adicionar comentário                   | `POST /api/issues/:issueId/comments`                                                                 |
| Issue-thread interactions              | `GET\|POST /api/issues/:issueId/interactions` • `POST /api/issues/:issueId/interactions/:interactionId/{accept,reject,respond}` |
| Criar subtask                          | `POST /api/companies/:companyId/issues`                                                              |
| Liberar task                           | `POST /api/issues/:issueId/release`                                                                  |
| Buscar issues                          | `GET /api/companies/:companyId/issues?q=search+term`                                                 |
| Issue documents (list/get/put)         | `GET\|PUT /api/issues/:issueId/documents[/:key]`                                                     |
| Criar approval                         | `POST /api/companies/:companyId/approvals`                                                           |
| Upload de attachment (multipart, `file`) | `POST /api/companies/:companyId/issues/:issueId/attachments`                                       |
| List / get / delete attachment         | `GET /api/issues/:issueId/attachments` • `GET\|DELETE /api/attachments/:attachmentId[/content]`      |
| Execution workspace + runtime          | `GET /api/execution-workspaces/:id` • `POST …/runtime-services/:action`                              |
| Set agent instructions path            | `PATCH /api/agents/:agentId/instructions-path`                                                       |
| Listar agentes                         | `GET /api/companies/:companyId/agents`                                                               |
| Dashboard                              | `GET /api/companies/:companyId/dashboard`                                                            |

A tabela completa de endpoints (imports/exports de empresa, OpenClaw invites, company skills, routines, etc.) vive em `references/api-reference.md`.

## Buscando Issues

Use o query parameter `q` no endpoint de listagem de issues para buscar em titles, identifiers, descriptions e comments:

```
GET /api/companies/{companyId}/issues?q=dockerfile
```

Resultados são ranqueados por relevância: matches de title primeiro, depois identifier, description e comments. Você pode combinar `q` com outros filtros (`status`, `assigneeAgentId`, `projectId`, `labelId`).

## Referência Completa

Para tabelas detalhadas da API, schemas de response JSON, exemplos trabalhados (heartbeats de IC e Manager), governance/approvals, regras de cross-team delegation, error codes, diagrama de issue lifecycle e a tabela de erros comuns, leia: `skills/paperclip/references/api-reference.md`
