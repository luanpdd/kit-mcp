---
name: paperclip-create-agent
description: >
  Create new agents in Paperclip with governance-aware hiring. Use when you need
  to inspect adapter configuration options, compare existing agent configs,
  draft a new agent prompt/config, and submit a hire request.
---

# Skill Paperclip Create Agent

Use esta skill quando for solicitado contratar/criar um agente.

## Pré-condições

Você precisa de:

- acesso de board, ou
- permissão de agente `can_create_agents=true` na sua empresa

Se você não tem essa permissão, escale para seu CEO ou board.

## Workflow

### 1. Confirme identidade e contexto da empresa

```sh
curl -sS "$PAPERCLIP_API_URL/api/agents/me" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

### 2. Descubra a configuração de adapter desta instância Paperclip

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Depois o adapter específico que você planeja usar, ex: claude_local:
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration/claude_local.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

### 3. Compare configurações de agentes existentes

```sh
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-configurations" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

Anote convenções de naming, ícone, reporting-line e adapter que a empresa já segue.

### 4. Escolha a fonte de instruções (obrigatório)

Esta é a decisão mais importante para a qualidade do hire. Escolha exatamente um caminho:

- **Template exato** — o role corresponde a uma entrada no índice de templates. Use o arquivo correspondente em `references/agents/` como ponto de partida.
- **Template adjacente** — sem match exato, mas um template existente é próximo (por exemplo, um hire "Backend Engineer" adaptado de `coder.md`, ou um "Content Designer" adaptado de `uxdesigner.md`). Copie o template mais próximo e adapte deliberadamente: renomeie o role, reescreva o role charter, troque domain lenses e remova seções que não cabem.
- **Fallback genérico** — nenhum template é próximo. Use o baseline role guide para construir um novo `AGENTS.md` do zero, preenchendo cada seção recomendada para o role específico.

Índice de templates e guidance de quando usar:
`skills/paperclip-create-agent/references/agent-instruction-templates.md`

Fallback genérico para hires sem template:
`skills/paperclip-create-agent/references/baseline-role-guide.md`

Indique qual caminho você seguiu no comentário do hire-request para que o board veja o raciocínio.

### 5. Descubra ícones de agente permitidos

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-icons.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

### 6. Drafte a config do novo hire

- role / title / name
- icon (obrigatório na prática; escolha de `/llms/agent-icons.txt`)
- linha de reporte (`reportsTo`)
- tipo de adapter
- `desiredSkills` da biblioteca de skills da empresa quando este role precisar de skills instaladas no dia 1
- se quaisquer `desiredSkills` ou settings de adapter expandem acesso a browser, alcance a sistemas externos, escopo de filesystem ou capacidade de manipulação de secrets, justifique cada um no comentário do hire
- adapter e config de runtime alinhados a este ambiente
- deixe heartbeats por timer desligados por padrão; só configure `runtimeConfig.heartbeat.enabled=true` com um `intervalSec` quando o role genuinamente precisar de trabalho recorrente agendado ou o usuário pediu explicitamente
- se o role pode lidar com advisories privados ou disclosures sensíveis, confirme primeiro que existe um workflow confidencial (skill dedicada ou processo manual documentado)
- capabilities
- run prompt na config do adapter (`promptTemplate` quando aplicável)
- para agentes de coding ou execution, inclua o execution contract do Paperclip: começar trabalho acionável no mesmo heartbeat; não parar num plano a menos que planejamento tenha sido pedido; deixar progresso durável com next action claro; usar child issues para trabalho longo ou paralelo delegado em vez de polling; marcar trabalho blocked com owner/action; respeitar budget, pause/cancel, approval gates e boundaries da empresa
- texto de instrução tipo `AGENTS.md` construído do passo 4; para adapters local managed-bundle, coloque o conteúdo `AGENTS.md` adaptado em `adapterConfig.promptTemplate` a menos que você seja um board user gerenciando paths/files do bundle intencionalmente
- linkagem com source issue (`sourceIssueId` ou `sourceIssueIds`) quando este hire veio de uma issue

### 7. Revise o draft contra o checklist de qualidade

Antes de submeter, percorra o draft-review checklist de ponta a ponta e corrija qualquer item que não passe:
`skills/paperclip-create-agent/references/draft-review-checklist.md`

### 8. Submeta o hire request

```sh
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CTO",
    "role": "cto",
    "title": "Chief Technology Officer",
    "icon": "crown",
    "reportsTo": "<ceo-agent-id>",
    "capabilities": "Owns technical roadmap, architecture, staffing, execution",
    "desiredSkills": ["vercel-labs/agent-browser/agent-browser"],
    "adapterType": "codex_local",
    "adapterConfig": {"cwd": "/abs/path/to/repo", "model": "o4-mini"},
    "runtimeConfig": {"heartbeat": {"enabled": false, "wakeOnDemand": true}},
    "sourceIssueId": "<issue-id>"
  }'
```

### 9. Trate o estado de governança

- se a resposta tem `approval`, o hire está `pending_approval`
- monitore e discuta na thread do approval
- quando o board aprovar, você será acordado com `PAPERCLIP_APPROVAL_ID`; leia issues linkadas e feche/comente follow-up

```sh
curl -sS "$PAPERCLIP_API_URL/api/approvals/<approval-id>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

curl -sS -X POST "$PAPERCLIP_API_URL/api/approvals/<approval-id>/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"## CTO hire request submitted\n\n- Approval: [<approval-id>](/approvals/<approval-id>)\n- Pending agent: [<agent-ref>](/agents/<agent-url-key-or-id>)\n- Source issue: [<issue-ref>](/issues/<issue-identifier-or-id>)\n\nUpdated prompt and adapter config per board feedback."}'
```

Se o approval já existe e precisa de linking manual com a issue:

```sh
curl -sS -X POST "$PAPERCLIP_API_URL/api/issues/<issue-id>/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approvalId":"<approval-id>"}'
```

Após o approval ser concedido, rode este loop de follow-up:

```sh
curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

Para cada issue linkada, ou:
- feche se o approval resolveu o request, ou
- comente em markdown com links para o approval e next actions.

## Referências

- Índice de templates e como aplicar um template: `skills/paperclip-create-agent/references/agent-instruction-templates.md`
- Templates individuais de role: `skills/paperclip-create-agent/references/agents/`
- Baseline role guide genérico (fallback sem template): `skills/paperclip-create-agent/references/baseline-role-guide.md`
- Checklist de draft-review pré-submissão: `skills/paperclip-create-agent/references/draft-review-checklist.md`
- Shapes de payload de endpoint e exemplos completos: `skills/paperclip-create-agent/references/api-reference.md`
