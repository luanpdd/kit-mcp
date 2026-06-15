<purpose>
Configuração interativa dos agentes de workflow framework (research, plan_check, verifier) e seleção de perfil de modelo via prompt de múltiplas perguntas. Atualiza .planning/config.json com as preferências do usuário. Opcionalmente salva as configurações como padrões globais (~/.framework/defaults.json) para projetos futuros.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="ensure_and_load_config">
Garanta que o config existe e carregue o estado atual:

```bash
node "./.claude/framework/bin/tools.cjs" config-ensure-section
INIT=$(node "./.claude/framework/bin/tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Cria `.planning/config.json` com valores padrão se ausente e carrega os valores de config atuais.
</step>

<step name="read_current">
```bash
cat .planning/config.json
```

Analise os valores atuais (padrão para `true` se não presente):
- `workflow.research` — spawnar pesquisador durante plan-phase
- `workflow.plan_check` — spawnar verificador de plano durante plan-phase
- `workflow.verifier` — spawnar verificador durante execute-phase
- `workflow.nyquist_validation` — pesquisa de arquitetura de validação durante plan-phase (padrão: true se ausente)
- `workflow.ui_phase` — gerar contratos de design UI-SPEC.md para fases frontend (padrão: true se ausente)
- `workflow.ui_safety_gate` — solicitar execução de /fase-ui antes de planejar fases frontend (padrão: true se ausente)
- `workflow.cost_awareness` — pré-flight de subagentes: `silencioso` | `resumo` | `confirmar` (padrão: `resumo` se ausente)
- `model_profile` — qual modelo cada agente usa (padrão: `balanced`)
- `git.branching_strategy` — abordagem de branching (padrão: `"none"`)
</step>

<step name="present_settings">
Use AskUserQuestion com os valores atuais pré-selecionados:

```
AskUserQuestion([
  {
    question: "Qual perfil de modelo para os agentes?",
    header: "Modelo",
    multiSelect: false,
    options: [
      { label: "Qualidade", description: "Opus em todo lugar exceto verificação (maior custo)" },
      { label: "Balanceado (Recomendado)", description: "Opus para planejamento, Sonnet para pesquisa/execução/verificação" },
      { label: "Econômico", description: "Sonnet para escrita, Haiku para pesquisa/verificação (menor custo)" },
      { label: "Herdar", description: "Usar o modelo da sessão atual para todos os agentes (melhor para OpenRouter, modelos locais, ou troca de modelo em runtime)" }
    ]
  },
  {
    question: "Spawnar Pesquisador de Plano? (pesquisa o domínio antes do planejamento)",
    header: "Pesquisa",
    multiSelect: false,
    options: [
      { label: "Sim", description: "Pesquisar objetivos da fase antes do planejamento" },
      { label: "Não", description: "Pular pesquisa, planejar diretamente" }
    ]
  },
  {
    question: "Spawnar Verificador de Plano? (verifica os planos antes da execução)",
    header: "Verificar Plano",
    multiSelect: false,
    options: [
      { label: "Sim", description: "Verificar se os planos atendem os objetivos da fase" },
      { label: "Não", description: "Pular verificação de plano" }
    ]
  },
  {
    question: "Spawnar Verificador de Execução? (verifica a conclusão da fase)",
    header: "Verificador",
    multiSelect: false,
    options: [
      { label: "Sim", description: "Verificar must-haves após a execução" },
      { label: "Não", description: "Pular verificação pós-execução" }
    ]
  },
  {
    question: "Avanço automático do pipeline? (discutir → planejar → executar automaticamente)",
    header: "Auto",
    multiSelect: false,
    options: [
      { label: "Não (Recomendado)", description: "/clear manual + colar entre estágios" },
      { label: "Sim", description: "Encadear estágios via subagentes Task() (mesma isolação)" }
    ]
  },
  {
    question: "Consciência de custo de subagentes? (controla o pré-flight antes de disparar Task() em massa)",
    header: "Custo",
    multiSelect: false,
    options: [
      { label: "Resumo (Recomendado)", description: "Antes de cada fan-out, lista os subagents + cost_tier (leve/medio/pesado) e segue. Equilíbrio transparência/atrito." },
      { label: "Confirmar", description: "Pede confirmação explícita antes de cada fan-out de subagents (executor até ~10, implementers 3-6). Máxima transparência, mais atrito." },
      { label: "Silencioso", description: "Sem pré-flight nem resumo — dispara direto (comportamento legado). Menor atrito, custo só visível no rodapé /custo-sessao." }
    ]
  },
  {
    question: "Habilitar Validação Nyquist? (pesquisa cobertura de testes durante o planejamento)",
    header: "Nyquist",
    multiSelect: false,
    options: [
      { label: "Sim (Recomendado)", description: "Pesquisar cobertura de testes automatizados durante plan-phase. Adiciona requisitos de validação aos planos. Bloqueia aprovação se tarefas não tiverem verificação automatizada." },
      { label: "Não", description: "Pular pesquisa de validação. Bom para prototipagem rápida ou fases sem testes." }
    ]
  },
  // Nota: A validação Nyquist depende da saída da pesquisa. Se a pesquisa estiver desabilitada,
  // o plan-phase pula automaticamente as etapas Nyquist (sem RESEARCH.md para extrair).
  {
    question: "Habilitar Fase UI? (gera contratos de design UI-SPEC.md para fases frontend)",
    header: "Fase UI",
    multiSelect: false,
    options: [
      { label: "Sim (Recomendado)", description: "Gerar contratos de design UI antes de planejar fases frontend. Bloqueia espaçamento, tipografia, cores e copywriting." },
      { label: "Não", description: "Pular geração de UI-SPEC. Bom para projetos somente backend ou fases de API." }
    ]
  },
  {
    question: "Habilitar Gate de Segurança UI? (solicita executar /fase-ui antes de planejar fases frontend)",
    header: "Gate UI",
    multiSelect: false,
    options: [
      { label: "Sim (Recomendado)", description: "plan-phase pergunta para executar /fase-ui primeiro quando indicadores frontend detectados." },
      { label: "Não", description: "Sem prompt — plan-phase prossegue sem verificação de UI-SPEC." }
    ]
  },
  {
    question: "Estratégia de branching no git?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "Nenhuma (Recomendado)", description: "Commitar diretamente na branch atual" },
      { label: "Por Fase", description: "Criar branch para cada fase (framework/phase-{N}-{name})" },
      { label: "Por Marco", description: "Criar branch para o marco completo (framework/{versão}-{nome})" }
    ]
  },
  {
    question: "Habilitar avisos de janela de contexto? (injeta mensagens de aviso quando o contexto está ficando cheio)",
    header: "Avisos de Ctx",
    multiSelect: false,
    options: [
      { label: "Sim (Recomendado)", description: "Avisar quando o uso de contexto exceder 65%. Ajuda a evitar perda de trabalho." },
      { label: "Não", description: "Desabilitar avisos. Permite que o Claude atinja o auto-compact naturalmente. Bom para execuções longas sem supervisão." }
    ]
  },
  {
    question: "Pesquisar melhores práticas antes de fazer perguntas? (busca na web durante new-project e discuss-phase)",
    header: "Pesquisa Perguntas",
    multiSelect: false,
    options: [
      { label: "Não (Recomendado)", description: "Fazer perguntas diretamente. Mais rápido, usa menos tokens." },
      { label: "Sim", description: "Buscar melhores práticas na web antes de cada grupo de perguntas. Perguntas mais embasadas mas usa mais tokens." }
    ]
  },
  {
    question: "Pular discuss-phase no modo autônomo? (usar objetivos do ROADMAP como spec)",
    header: "Pular Discuss",
    multiSelect: false,
    options: [
      { label: "Não (Recomendado)", description: "Executar discuss inteligente antes de cada fase — apresenta áreas cinzentas e captura decisões." },
      { label: "Sim", description: "Pular discuss no /autonomo — encadear diretamente para plan. Melhor para trabalho backend/pipeline onde as descrições de fase são a spec." }
    ]
  }
])
```
</step>

<step name="update_config">
Mescle as novas configurações no config.json existente:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget" | "inherit",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false,
    "nyquist_validation": true/false,
    "ui_phase": true/false,
    "ui_safety_gate": true/false,
    "cost_awareness": "silencioso" | "resumo" | "confirmar",
    "text_mode": true/false,
    "research_before_questions": true/false,
    "discuss_mode": "discuss" | "assumptions",
    "skip_discuss": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone",
    "quick_branch_template": <string|null>
  },
  "hooks": {
    "context_warnings": true/false,
    "workflow_guard": true/false
  }
}
```

Escreva o config atualizado em `.planning/config.json`.
</step>

<step name="save_as_defaults">
Pergunte se deseja salvar estas configurações como padrões globais para projetos futuros:

```
AskUserQuestion([
  {
    question: "Salvar como configurações padrão para todos os novos projetos?",
    header: "Padrões",
    multiSelect: false,
    options: [
      { label: "Sim", description: "Novos projetos começam com estas configurações (salvo em ~/.framework/defaults.json)" },
      { label: "Não", description: "Aplicar apenas a este projeto" }
    ]
  }
])
```

Se "Sim": escreva o mesmo objeto de config (menos campos específicos do projeto como `brave_search`) em `~/.framework/defaults.json`:

```bash
mkdir -p ~/.framework
```

Escreva `~/.framework/defaults.json` com:
```json
{
  "mode": <atual>,
  "granularity": <atual>,
  "model_profile": <atual>,
  "commit_docs": <atual>,
  "parallelization": <atual>,
  "branching_strategy": <atual>,
  "quick_branch_template": <atual>,
  "workflow": {
    "research": <atual>,
    "plan_check": <atual>,
    "verifier": <atual>,
    "auto_advance": <atual>,
    "nyquist_validation": <atual>,
    "ui_phase": <atual>,
    "ui_safety_gate": <atual>,
    "cost_awareness": <atual>,
    "skip_discuss": <atual>
  }
}
```
</step>

<step name="confirm">
Exiba:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► CONFIGURAÇÕES ATUALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Configuração              | Valor |
|---------------------------|-------|
| Perfil de Modelo          | {quality/balanced/budget/inherit} |
| Pesquisador de Plano      | {Ativo/Inativo} |
| Verificador de Plano      | {Ativo/Inativo} |
| Verificador de Execução   | {Ativo/Inativo} |
| Avanço Automático         | {Ativo/Inativo} |
| Consciência de Custo      | {silencioso/resumo/confirmar} |
| Validação Nyquist         | {Ativo/Inativo} |
| Fase UI                   | {Ativo/Inativo} |
| Gate UI                   | {Ativo/Inativo} |
| Branching Git             | {Nenhuma/Por Fase/Por Marco} |
| Pular Discuss             | {Ativo/Inativo} |
| Avisos de Contexto        | {Ativo/Inativo} |
| Salvo como Padrões        | {Sim/Não} |

Estas configurações se aplicam às futuras execuções de /planejar-fase e /executar-fase.

Comandos rápidos:
- /definir-perfil <perfil> — trocar perfil de modelo
- /planejar-fase --research — forçar pesquisa
- /planejar-fase --skip-research — pular pesquisa
- /planejar-fase --skip-verify — pular verificação de plano
```
</step>

</process>

<success_criteria>
- [ ] Config atual lido
- [ ] Usuário apresentado com 11 configurações (perfil + 9 toggles de workflow + branching git)
- [ ] Config atualizado com seções model_profile, workflow e git
- [ ] Usuário ofereceu salvar como padrões globais (~/.framework/defaults.json)
- [ ] Mudanças confirmadas ao usuário
</success_criteria>
