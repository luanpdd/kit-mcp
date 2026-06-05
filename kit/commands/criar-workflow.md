---
name: criar-workflow
description: Gera um Dynamic Workflow customizado pro teu projeto. Pergunta o padrao de harness (6 opcoes), eliciaa params especificos, compoe reusando agents/skills do kit, materializa em .claude/workflows/.
argument-hint: "<descricao livre em portugues do que voce quer auditar/automatizar>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Task
---

# criar-workflow

> Entrypoint pra gerar um Dynamic Workflow customizado pro teu projeto. O kit não cresce com workflows de nicho — cresce com a capacidade de gerar workflows sob demanda.

> Cada usuário ganha o DELE, calibrado pro stack/dor que ele tem. Outro usuário com necessidade diferente roda `/criar-workflow <sua descrição>` e ganha um diferente.

<objective>
Invoca o agent [`workflow-generator`](../agents/workflow-generator.md) que executa 4 layers:

1. **Classify** — pergunta qual dos 6 patterns canônicos (Classify-Act, Fanout-Synthesize, Adversarial-Verify, Generate-Filter, Tournament, Loop-Done) encaixa
2. **Specify** — faz 2-4 perguntas específicas do pattern escolhido
3. **Compose** — detecta MCP necessárias + propõe reuso de agents canônicos do kit
4. **Materialize** — escreve `.claude/workflows/<slug>.workflow.js` + `.claude/commands/<slug>.md` (locais ao projeto, NUNCA no kit canônico)

**Cria:**
- `.claude/workflows/<slug>.workflow.js` — script JS executável pela tool Workflow do Claude Code
- `.claude/commands/<slug>.md` — slash-command que dispara o workflow

**Após:** `/<slug> [--args]` invoca direto. Pra rodar a cada N minutos: `/loop 3m /<slug>`. Pra cron remoto: `/schedule "*/3 * * * *" <slug>`.
</objective>

<context>
**Argumento:**
- `$ARGUMENTS` — descrição livre em português do objetivo. Quanto mais específico, menos perguntas o gerador faz no Layer 1.

**Exemplos:**
```
/criar-workflow auditar comportamento dos agentes IA atendendo WhatsApp 
                a cada 3 minutos, analisar transcripts e gerar report

/criar-workflow rankear top 10 PRs no GitHub abertos ha mais de 7 dias 
                sem revisao por impacto

/criar-workflow bug hunt continuo no codigo do servico de pagamento 
                ate 2 rounds sem novos achados

/criar-workflow brainstorm 12 nomes pra minha CLI e pegar top 3 por 
                memorability + brand fit
```

**Pré-requisitos:**
- Claude Code Max / Team / Enterprise (Dynamic Workflows em research preview Opus 4.8+)
- Tool `Workflow` habilitada na sessão
- `.claude/workflows/` existe ou sera criado

**Quando NÃO usar:**
- Tarefa cabe em 1 slash-command existente (ex.: ja temos `/auditar-observabilidade-cobertura-workflow` — não duplique)
- Descrição vaga ("automatize meu projeto") — refine antes
- Mudança que precisa entrar no kit canônico — esses são PRs no repo `luanpdd/kit-mcp`, não workflows locais
</context>

<process>

## 1. Validar descrição mínima

```bash
DESC="$ARGUMENTS"
if [ -z "$DESC" ] || [ ${#DESC} -lt 10 ]; then
  echo "ERRO: descreva o que voce quer com pelo menos 10 chars."
  echo "Exemplo: /criar-workflow auditar conversas IA no WhatsApp a cada 3min"
  exit 1
fi
```

## 2. Garantir destino existe

```bash
mkdir -p .claude/workflows .claude/commands
```

## 3. Dispatch para workflow-generator

```text
Task(
  subagent_type="workflow-generator",
  prompt="
description: ${DESC}
output_dir_workflows: .claude/workflows/
output_dir_commands: .claude/commands/

Execute os 4 layers conforme spec do agent:

LAYER 0 — Classify (AskUserQuestion obrigatorio, 6 opcoes do pattern)
LAYER 1 — Specify (perguntas especificas do pattern escolhido, 2-4 max)
LAYER 2 — Compose (detectar MCP + propor reuso de agents do kit via AskUserQuestion)
LAYER 3 — Materialize (.workflow.js + .md com header // kit-mcp:user-generated)
LAYER 4 — Deliver (output formatado com slug, pattern, MCP, comandos /<slug>, /loop, /schedule)

REGRAS DURAS:
- meta literal puro (sem template literals, sem function calls, sem spread)
- Todo agent() com schema JSON Schema declarado (required: [...])
- pipeline() default, parallel() so com justificativa inline
- Sem Date.now()/Math.random()/argless new Date() — pra randomness varie por indice, pra timestamps passe via args
- Header // kit-mcp:user-generated no topo do .workflow.js (distingue de // kit-mcp:reference do canonico)

NAO escreva em kit/ — workflows gerados sao locais.
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► CRIAR-WORKFLOW ▸ <slug>
═══════════════════════════════════════════════════════════

[output do workflow-generator]

## Como usar

```
/<slug> [--args ...]                       # 1 execucao
/loop 3m /<slug> [--args ...]              # a cada 3min (dentro da sessao)
/schedule "*/3 * * * *" <slug> [--args]    # cron remoto (24/7)
```

## Editar depois

Se quiser ajustar:
- `.claude/workflows/<slug>.workflow.js` — script do workflow
- `.claude/commands/<slug>.md` — slash-command (interface + flags)

A tool Workflow do Claude Code re-le o script a cada execucao — edit ja vale na proxima rodada.

## Quando descontinuar

Apaga os 2 arquivos. Sem efeito colateral (workflows user-generated nao entram no kit/file-manifest.json nem no kit-mcp sync).
```

</process>

<success_criteria>
- [ ] `$ARGUMENTS` validado (≥ 10 chars)
- [ ] `.claude/workflows/` e `.claude/commands/` criados se ausentes
- [ ] `workflow-generator` invocado via `Task()` com a descrição original
- [ ] Layer 0 (classify pattern) com `AskUserQuestion` obrigatório — NUNCA infere
- [ ] Layer 1 (specify) com perguntas específicas DO PADRÃO ESCOLHIDO — não pergunta tudo sempre
- [ ] Layer 2 (compose) propõe reuso de agents canônicos quando match óbvio
- [ ] Layer 3 (materialize) escreve 2 arquivos com headers corretos
- [ ] Layer 4 (deliver) output com `/<slug>`, `/loop`, `/schedule` formatados
- [ ] Workflow gerado parseável (`node -c` syntax check)
- [ ] Nenhum arquivo escrito em `kit/` (canônico) — só em `.claude/`
</success_criteria>
