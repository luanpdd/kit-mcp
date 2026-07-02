<purpose>
Orquestrar agentes mapeadores de base de código em paralelo para analisar a base de código e produzir documentos estruturados em .planning/codebase/

Cada agente tem contexto fresco, explora uma área de foco específica e **escreve documentos diretamente**. O orquestrador recebe apenas confirmação + contagens de linhas, então escreve um resumo.

Saída: pasta .planning/codebase/ com 7 documentos estruturados sobre o estado da base de código.
</purpose>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- codebase-mapper — Mapeia estrutura do projeto e dependências
</available_agent_types>

<philosophy>
**Por que agentes mapeadores dedicados:**
- Contexto fresco por domínio (sem contaminação de tokens)
- Agentes escrevem documentos diretamente (sem transferência de contexto de volta ao orquestrador)
- Orquestrador apenas resume o que foi criado (uso mínimo de contexto)
- Execução mais rápida (agentes rodam simultaneamente)

**Qualidade do documento acima de comprimento:**
Incluir detalhes suficientes para ser útil como referência. Priorizar exemplos práticos (especialmente padrões de código) sobre brevidade arbitrária.

**Sempre incluir caminhos de arquivo:**
Os documentos são material de referência para o Claude ao planejar/executar. Sempre incluir caminhos de arquivo reais formatados com backticks: `src/services/user.ts`.
</philosophy>

<process>

<step name="init_context" priority="first">
Carregar contexto de mapeamento de base de código:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_MAPPER=$(node "./.claude/framework/bin/tools.cjs" agent-skills codebase-mapper 2>/dev/null)
```

Extrair do JSON de init: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`.
</step>

<step name="check_existing">
Verificar se .planning/codebase/ já existe usando `has_maps` do contexto de init.

Se `codebase_dir_exists` for verdadeiro:
```bash
ls -la .planning/codebase/
```

**Se existir:**

```
.planning/codebase/ já existe com estes documentos:
[Listar arquivos encontrados]

O que fazer a seguir?
1. Atualizar - Deletar existente e remapear base de código
2. Atualizar seletivamente - Manter existente, apenas atualizar documentos específicos
3. Pular - Usar mapa de base de código existente como está
```

Aguardar resposta do usuário.

Se "Atualizar": Deletar .planning/codebase/, continuar para create_structure
Se "Atualizar seletivamente": Perguntar quais documentos atualizar, continuar para spawn_agents (filtrado)
Se "Pular": Sair do workflow

**Se não existir:**
Continuar para create_structure.
</step>

<step name="create_structure">
Criar diretório .planning/codebase/:

```bash
mkdir -p .planning/codebase
```

**Arquivos de saída esperados:**
- STACK.md (do mapeador tech)
- INTEGRATIONS.md (do mapeador tech)
- ARCHITECTURE.md (do mapeador arch)
- STRUCTURE.md (do mapeador arch)
- CONVENTIONS.md (do mapeador quality)
- TESTING.md (do mapeador quality)
- CONCERNS.md (do mapeador concerns)

Continuar para spawn_agents.
</step>

<step name="detect_runtime_capabilities">
Antes de criar agentes, detectar se o runtime atual suporta a ferramenta `Task` para delegação de subagentes.

**Como detectar:** Verificar se você tem acesso a uma ferramenta `Task` (pode ser capitalizado como `Task` ou minúsculo como `task` dependendo do runtime). Se você NÃO tiver uma ferramenta `Task`/`task` (ou apenas tiver ferramentas como `browser_subagent` que é para navegação web, NÃO análise de código):

→ **Pular `spawn_agents` e `collect_confirmations`** — ir diretamente para `sequential_mapping` em vez disso.

**CRÍTICO:** Nunca usar `browser_subagent` ou `Explore` como substituto para `Task`. A ferramenta `browser_subagent` é exclusivamente para interação com páginas web e falhará para análise de base de código. Se `Task` não estiver disponível, realizar o mapeamento sequencialmente em contexto.
</step>

<step name="spawn_agents" condition="Ferramenta Task disponível">
Criar 4 agentes codebase-mapper em paralelo.

Usar ferramenta Task com `subagent_type="codebase-mapper"`, `model="{mapper_model}"` e `run_in_background=true` para execução paralela.

**CRÍTICO:** Usar o agente dedicado `codebase-mapper`, NÃO `Explore` ou `browser_subagent`. O agente mapeador escreve documentos diretamente.

**Agente 1: Foco Tech**

```
Task(
  subagent_type="codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Mapear stack tech da base de código",
  prompt="Focus: tech

Analisar esta base de código para stack tecnológico e integrações externas.

Escrever estes documentos em .planning/codebase/:
- STACK.md - Linguagens, runtime, frameworks, dependências, configuração
- INTEGRATIONS.md - APIs externas, bancos de dados, provedores de auth, webhooks

Explorar minuciosamente. Escrever documentos diretamente usando templates. Retornar apenas confirmação.
${AGENT_SKILLS_MAPPER}"
)
```

**Agente 2: Foco Arquitetura**

```
Task(
  subagent_type="codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Mapear arquitetura da base de código",
  prompt="Focus: arch

Analisar arquitetura da base de código e estrutura de diretórios.

Escrever estes documentos em .planning/codebase/:
- ARCHITECTURE.md - Padrão, camadas, fluxo de dados, abstrações, pontos de entrada
- STRUCTURE.md - Layout de diretórios, localizações-chave, convenções de nomenclatura

Explorar minuciosamente. Escrever documentos diretamente usando templates. Retornar apenas confirmação.
${AGENT_SKILLS_MAPPER}"
)
```

**Agente 3: Foco Qualidade**

```
Task(
  subagent_type="codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Mapear convenções da base de código",
  prompt="Focus: quality

Analisar esta base de código para convenções de código e padrões de teste.

Escrever estes documentos em .planning/codebase/:
- CONVENTIONS.md - Estilo de código, nomenclatura, padrões, tratamento de erros
- TESTING.md - Framework, estrutura, mocking, cobertura

Explorar minuciosamente. Escrever documentos diretamente usando templates. Retornar apenas confirmação.
${AGENT_SKILLS_MAPPER}"
)
```

**Agente 4: Foco Preocupações**

```
Task(
  subagent_type="codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Mapear preocupações da base de código",
  prompt="Focus: concerns

Analisar esta base de código para dívida técnica, issues conhecidas e áreas de preocupação.

Escrever este documento em .planning/codebase/:
- CONCERNS.md - Dívida técnica, bugs, segurança, performance, áreas frágeis

Explorar minuciosamente. Escrever documento diretamente usando template. Retornar apenas confirmação.
${AGENT_SKILLS_MAPPER}"
)
```

Continuar para collect_confirmations.
</step>

<step name="collect_confirmations">
Aguardar todos os 4 agentes concluírem usando a ferramenta TaskOutput.

**Para cada task_id de agente retornado pelas chamadas da ferramenta Agent acima:**
```
Ferramenta TaskOutput:
  task_id: "{task_id do resultado do Agent}"
  block: true
  timeout: 300000
```

Chamar TaskOutput para todos os 4 agentes em paralelo (mensagem única com 4 chamadas TaskOutput).

Uma vez que todas as chamadas TaskOutput retornarem, ler o arquivo de saída de cada agente para coletar confirmações.

**Formato de confirmação esperado de cada agente:**
```
## Mapeamento Concluído

**Foco:** {foco}
**Documentos escritos:**
- `.planning/codebase/{DOC1}.md` ({N} linhas)
- `.planning/codebase/{DOC2}.md` ({N} linhas)

Pronto para resumo do orquestrador.
```

**O que você recebe:** Apenas caminhos de arquivo e contagens de linhas. NÃO conteúdo de documentos.

Se algum agente falhou, notar a falha e continuar com documentos bem-sucedidos.

Continuar para verify_output.
</step>

<step name="sequential_mapping" condition="Ferramenta Task NÃO disponível (ex: Antigravity, Gemini CLI, Codex)">
Quando a ferramenta `Task` não estiver disponível, realizar mapeamento de base de código sequencialmente no contexto atual. Isso substitui `spawn_agents` e `collect_confirmations`.

**IMPORTANTE:** NÃO usar `browser_subagent`, `Explore`, ou qualquer ferramenta baseada em navegador. Usar apenas ferramentas de sistema de arquivos (Read, Bash, Write, Grep, Glob, list_dir, view_file, grep_search, ou ferramentas equivalentes disponíveis no seu runtime).

Realizar todas as 4 passagens de mapeamento sequencialmente:

**Passagem 1: Foco Tech**
- Explorar package.json/Cargo.toml/go.mod/requirements.txt, arquivos de config, árvores de dependências
- Escrever `.planning/codebase/STACK.md` — Linguagens, runtime, frameworks, dependências, configuração
- Escrever `.planning/codebase/INTEGRATIONS.md` — APIs externas, bancos de dados, provedores de auth, webhooks

**Passagem 2: Foco Arquitetura**
- Explorar estrutura de diretórios, pontos de entrada, limites de módulo, fluxo de dados
- Escrever `.planning/codebase/ARCHITECTURE.md` — Padrão, camadas, fluxo de dados, abstrações, pontos de entrada
- Escrever `.planning/codebase/STRUCTURE.md` — Layout de diretórios, localizações-chave, convenções de nomenclatura

**Passagem 3: Foco Qualidade**
- Explorar estilo de código, padrões de tratamento de erros, arquivos de teste, config CI
- Escrever `.planning/codebase/CONVENTIONS.md` — Estilo de código, nomenclatura, padrões, tratamento de erros
- Escrever `.planning/codebase/TESTING.md` — Framework, estrutura, mocking, cobertura

**Passagem 4: Foco Preocupações**
- Explorar TODOs, issues conhecidas, áreas frágeis, padrões de segurança
- Escrever `.planning/codebase/CONCERNS.md` — Dívida técnica, bugs, segurança, performance, áreas frágeis

Usar os mesmos templates de documento que o agente `codebase-mapper`. Incluir caminhos de arquivo reais formatados com backticks.

Continuar para verify_output.
</step>

<step name="verify_output">
Verificar se todos os documentos foram criados com sucesso:

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Checklist de verificação:**
- Todos os 7 documentos existem
- Nenhum documento vazio (cada um deve ter >20 linhas)

Se algum documento estiver ausente ou vazio, notar quais agentes podem ter falhado.

Continuar para scan_for_secrets.
</step>

<step name="scan_for_secrets">
**VERIFICAÇÃO CRÍTICA DE SEGURANÇA:** Verificar arquivos de saída por segredos acidentalmente vazados antes de commitar.

Executar detecção de padrões de segredos:

```bash
# Verificar padrões comuns de chave de API nos documentos gerados
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**Se SECRETS_FOUND=true:**

```
⚠️  ALERTA DE SEGURANÇA: Segredos potenciais detectados nos documentos de base de código!

Padrões encontrados que parecem chaves de API ou tokens em:
[mostrar saída do grep]

Isso exporia credenciais se commitado.

**Ação necessária:**
1. Revisar o conteúdo sinalizado acima
2. Se esses são segredos reais, devem ser removidos antes de commitar
3. Considerar adicionar arquivos sensíveis às permissões "Deny" do Claude Code

Pausando antes de commitar. Responda "seguro para prosseguir" se o conteúdo sinalizado não for realmente sensível, ou edite os arquivos primeiro.
```

Aguardar confirmação do usuário antes de continuar para commit_codebase_map.

**Se SECRETS_FOUND=false:**

Continuar para commit_codebase_map.
</step>

<step name="commit_codebase_map">
Commitar o mapa de base de código:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: mapear base de código existente" --files .planning/codebase/*.md
```

Continuar para offer_next.
</step>

<step name="offer_next">
Apresentar resumo de conclusão e próximos passos.

**Obter contagens de linhas:**
```bash
wc -l .planning/codebase/*.md
```

**Formato de saída:**

```
Mapeamento de base de código concluído.

Criado .planning/codebase/:
- STACK.md ([N] linhas) - Tecnologias e dependências
- ARCHITECTURE.md ([N] linhas) - Design do sistema e padrões
- STRUCTURE.md ([N] linhas) - Layout de diretórios e organização
- CONVENTIONS.md ([N] linhas) - Estilo de código e padrões
- TESTING.md ([N] linhas) - Estrutura e práticas de teste
- INTEGRATIONS.md ([N] linhas) - Serviços externos e APIs
- CONCERNS.md ([N] linhas) - Dívida técnica e issues


---

## ▶ Próximo Passo

**Inicializar projeto** — usar contexto de base de código para planejamento

`/novo-projeto`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- Re-executar mapeamento: `/mapear-codebase`
- Revisar arquivo específico: `cat .planning/codebase/STACK.md`
- Editar qualquer documento antes de prosseguir

---
```

Encerrar workflow.
</step>

</process>

<success_criteria>
- Diretório .planning/codebase/ criado
- Se ferramenta Task disponível: 4 agentes codebase-mapper em paralelo criados com run_in_background=true
- Se ferramenta Task NÃO disponível: 4 passagens de mapeamento sequenciais realizadas inline (nunca usando browser_subagent)
- Todos os 7 documentos de base de código existem
- Nenhum documento vazio (cada um deve ter >20 linhas)
- Resumo de conclusão claro com contagens de linhas
- Usuário oferecido próximos passos claros no estilo framework
</success_criteria>
