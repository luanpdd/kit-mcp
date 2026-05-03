<purpose>
Extrair decisões de implementação que agentes downstream precisam. Analisar a fase para identificar áreas cinzentas, deixar o usuário escolher o que discutir, então fazer deep-dive em cada área selecionada até a satisfação.

Você é um parceiro de pensamento, não um entrevistador. O usuário é o visionário — você é o construtor. Seu trabalho é capturar decisões que guiarão pesquisa e planejamento, não descobrir a implementação por conta própria.
</purpose>

<downstream_awareness>
**CONTEXT.md alimenta:**

1. **phase-researcher** — Lê CONTEXT.md para saber O QUE pesquisar
   - "Usuário quer layout baseado em cards" → pesquisador investiga padrões de componentes de card
   - "Scroll infinito decidido" → pesquisador investiga bibliotecas de virtualização

2. **planner** — Lê CONTEXT.md para saber QUAIS decisões estão bloqueadas
   - "Pull-to-refresh no mobile" → planejador inclui isso nas especificações de tarefas
   - "Discrição do Claude: skeleton de carregamento" → planejador pode decidir a abordagem

**Seu trabalho:** Capturar decisões claramente o suficiente para que agentes downstream possam agir nelas sem perguntar ao usuário novamente.

**Não é seu trabalho:** Descobrir COMO implementar. Isso é o que pesquisa e planejamento fazem com as decisões que você captura.
</downstream_awareness>

<philosophy>
**Usuário = fundador/visionário. Claude = construtor.**

O usuário sabe:
- Como imagina funcionando
- Como deve ser o visual/sensação
- O que é essencial vs bom ter
- Comportamentos ou referências específicas que têm em mente

O usuário não sabe (e não deve ser perguntado):
- Padrões da base de código (pesquisador lê o código)
- Riscos técnicos (pesquisador identifica estes)
- Abordagem de implementação (planejador descobre isso)
- Métricas de sucesso (inferidas do trabalho)

Perguntar sobre visão e escolhas de implementação. Capturar decisões para agentes downstream.
</philosophy>

<scope_guardrail>
**CRÍTICO: Sem expansão de escopo.**

O limite da fase vem do ROADMAP.md e é FIXO. A discussão clarifica COMO implementar o que está no escopo, nunca SE adicionar novas capacidades.

**Permitido (clarificando ambiguidade):**
- "Como os posts devem ser exibidos?" (layout, densidade, informações mostradas)
- "O que acontece em estado vazio?" (dentro da funcionalidade)
- "Pull to refresh ou manual?" (escolha de comportamento)

**Não permitido (expansão de escopo):**
- "Deveríamos também adicionar comentários?" (nova capacidade)
- "E a busca/filtragem?" (nova capacidade)
- "Talvez incluir favoritos?" (nova capacidade)

**A heurística:** Isso clarifica como implementamos o que já está na fase, ou adiciona uma nova capacidade que poderia ser sua própria fase?

**Quando o usuário sugere expansão de escopo:**
```
"[Funcionalidade X] seria uma nova capacidade — é sua própria fase.
Quer que eu anote para o backlog do roadmap?

Por enquanto, vamos focar em [domínio da fase]."
```

Capturar a ideia em uma seção "Ideias Adiadas". Não a perder, não agir sobre ela.
</scope_guardrail>

<gray_area_identification>
Áreas cinzentas são **decisões de implementação que o usuário se importa** — coisas que podem ir de múltiplas formas e mudariam o resultado.

**Como identificar áreas cinzentas:**

1. **Ler o objetivo da fase** do ROADMAP.md
2. **Entender o domínio** — Que tipo de coisa está sendo construída?
   - Algo que usuários VÊM → apresentação visual, interações, estados importam
   - Algo que usuários CHAMAM → contratos de interface, respostas, erros importam
   - Algo que usuários EXECUTAM → invocação, saída, modos de comportamento importam
   - Algo que usuários LÊM → estrutura, tom, profundidade, fluxo importam
   - Algo sendo ORGANIZADO → critérios, agrupamento, tratamento de exceções importam
3. **Gerar áreas cinzentas específicas da fase** — Não categorias genéricas, mas decisões concretas para ESTA fase

**Não usar rótulos de categoria genéricos** (UI, UX, Comportamento). Gerar áreas cinzentas específicas:

```
Fase: "Autenticação de usuário"
→ Gerenciamento de sessão, Respostas de erro, Política multi-dispositivo, Fluxo de recuperação

Fase: "Organizar biblioteca de fotos"
→ Critérios de agrupamento, Tratamento de duplicatas, Convenção de nomenclatura, Estrutura de pastas

Fase: "CLI para backups de banco de dados"
→ Formato de saída, Design de flags, Relatório de progresso, Recuperação de erros

Fase: "Documentação de API"
→ Estrutura/navegação, Profundidade de exemplos de código, Abordagem de versionamento, Elementos interativos
```

**A pergunta-chave:** Quais decisões mudariam o resultado que o usuário deveria opinar?

**Claude lida com isso (não perguntar):**
- Detalhes técnicos de implementação
- Padrões de arquitetura
- Otimização de performance
- Escopo (roadmap define isso)
</gray_area_identification>

<answer_validation>
**IMPORTANTE: Validação de resposta** — Após cada chamada AskUserQuestion, verificar se a resposta está vazia ou contém apenas espaços em branco. Se sim:
1. Tentar a pergunta novamente com os mesmos parâmetros
2. Se ainda vazia, apresentar as opções como uma lista numerada em texto simples e pedir ao usuário que digite o número da sua escolha
Nunca prosseguir com uma resposta vazia.

**Modo texto (`workflow.text_mode: true` na config ou flag `--text`):**
Quando o modo texto estiver ativo, **não use AskUserQuestion de forma alguma**. Em vez disso, apresente cada
pergunta como uma lista numerada em texto simples e peça ao usuário que digite o número da sua escolha.
Isso é necessário para sessões remotas do Claude Code (modo `/rc`) onde o App Claude
não pode encaminhar seleções de menu TUI de volta ao host.

Ativar modo texto:
- Por sessão: passar flag `--text` para qualquer comando (ex: `/discutir-fase --text`)
- Por projeto: `tools config-set workflow.text_mode true`

O modo texto aplica-se a TODOS os workflows na sessão, não apenas ao discuss-phase.
</answer_validation>

<process>

**Caminho expresso disponível:** Se você já tem um PRD ou documento de critérios de aceitação, use `/planejar-fase {fase} --prd caminho/para/prd.md` para pular esta discussão e ir direto ao planejamento.

<step name="initialize" priority="first">
Número da fase do argumento (obrigatório).

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ADVISOR=$(node "./.claude/framework/bin/tools.cjs" agent-skills advisor 2>/dev/null)
```

Analisar JSON para: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**Se `phase_found` for false:**
```
Fase [X] não encontrada no roadmap.

Use /progresso ${WS} para ver as fases disponíveis.
```
Sair do workflow.

**Se `phase_found` for true:** Continuar para check_existing.

**Modo auto** — Se `--auto` estiver presente em ARGUMENTS:
- Em `check_existing`: auto-selecionar "Pular" (se contexto existir) ou continuar sem prompt (se sem contexto/planos)
- Em `present_gray_areas`: auto-selecionar TODAS as áreas cinzentas sem perguntar ao usuário
- Em `discuss_areas`: para cada pergunta de discussão, escolher a opção recomendada (primeira opção, ou a marcada como "recomendada") sem usar AskUserQuestion
- Logar cada escolha auto-selecionada inline para que o usuário possa revisar decisões no arquivo de contexto
- Após a discussão concluir, avançar automaticamente para plan-phase (comportamento existente)
</step>

<step name="check_existing">
Verificar se CONTEXT.md já existe usando `has_context` do init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**Se existir:**

**Se `--auto`:** Auto-selecionar "Atualizar" — carregar contexto existente e continuar para analyze_phase. Logar: `[auto] Contexto existe — atualizando com decisões auto-selecionadas.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Contexto"
- question: "Fase [X] já tem contexto. O que você quer fazer?"
- options:
  - "Atualizar" — Revisar e revisar contexto existente
  - "Visualizar" — Me mostra o que há
  - "Pular" — Usar contexto existente como está

Se "Atualizar": Carregar existente, continuar para analyze_phase
Se "Visualizar": Exibir CONTEXT.md, então oferecer atualizar/pular
Se "Pular": Sair do workflow

**Se não existir:**

Verificar `has_plans` e `plan_count` do init. **Se `has_plans` for true:**

**Se `--auto`:** Auto-selecionar "Continuar e replanejar depois". Logar: `[auto] Planos existem — continuando com captura de contexto, replanejará depois.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Planos existem"
- question: "Fase [X] já tem {plan_count} plano(s) criado(s) sem contexto do usuário. Suas decisões aqui não afetarão os planos existentes a menos que você replane."
- options:
  - "Continuar e replanejar depois" — Capturar contexto, então executar /planejar-fase {X} ${WS} para replanejar
  - "Visualizar planos existentes" — Mostrar planos antes de decidir
  - "Cancelar" — Pular discuss-phase

Se "Continuar e replanejar depois": Continuar para analyze_phase.
Se "Visualizar planos existentes": Exibir arquivos de plano, então oferecer "Continuar" / "Cancelar".
Se "Cancelar": Sair do workflow.

**Se `has_plans` for false:** Continuar para load_prior_context.
</step>

<step name="load_prior_context">
Ler contexto de projeto e de fases anteriores para evitar re-perguntar questões já decididas e manter consistência.

**Passo 1: Ler arquivos em nível de projeto**
```bash
# Arquivos centrais do projeto
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Extrair destes:
- **PROJECT.md** — Visão, princípios, inegociáveis, preferências do usuário
- **REQUIREMENTS.md** — Critérios de aceitação, restrições, must-haves vs bom-ter
- **STATE.md** — Progresso atual, quaisquer flags ou notas de sessão

**Passo 2: Ler todos os arquivos CONTEXT.md anteriores**
```bash
# Encontrar todos os arquivos CONTEXT.md de fases anteriores à atual
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

Para cada CONTEXT.md onde o número de fase < fase atual:
- Ler a seção `<decisions>` — estas são preferências bloqueadas
- Ler `<specifics>` — referências particulares ou momentos "quero como X"
- Notar quaisquer padrões (ex: "usuário consistentemente prefere UI minimalista", "usuário rejeitou atalhos de tecla única")

**Passo 3: Construir contexto interno `<prior_decisions>`**

Estruturar as informações extraídas:
```
<prior_decisions>
## Nível de Projeto
- [Princípio ou restrição chave do PROJECT.md]
- [Requisito que afeta esta fase do REQUIREMENTS.md]

## Das Fases Anteriores
### Fase N: [Nome]
- [Decisão que pode ser relevante para a fase atual]
- [Preferência que estabelece um padrão]

### Fase M: [Nome]
- [Outra decisão relevante]
</prior_decisions>
```

**Uso nos passos subsequentes:**
- `analyze_phase`: Pular áreas cinzentas já decididas em fases anteriores
- `present_gray_areas`: Anotar opções com decisões anteriores ("Você escolheu X na Fase 5")
- `discuss_areas`: Pré-preencher respostas ou sinalizar conflitos ("Isso contradiz a Fase 3 — mesmo aqui ou diferente?")

**Se nenhum contexto anterior existir:** Continuar sem — isso é esperado para fases iniciais.
</step>

<step name="cross_reference_todos">
Verificar se alguma tarefa pendente é relevante ao escopo desta fase. Exibe itens do backlog que de outra forma poderiam ser perdidos.

**Carregar e corresponder tarefas:**
```bash
TODO_MATCHES=$(node "./.claude/framework/bin/tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

Analisar JSON para: `todo_count`, `matches[]` (cada um com `file`, `title`, `area`, `score`, `reasons`).

**Se `todo_count` for 0 ou `matches` estiver vazio:** Pular silenciosamente — sem atraso no workflow.

**Se correspondências encontradas:**

Apresentar tarefas correspondentes ao usuário. Mostrar cada correspondência com seu título, área e por que correspondeu:

```
📋 Encontradas {N} tarefa(s) pendente(s) que podem ser relevantes para a Fase {X}:

{Para cada correspondência:}
- **{título}** (área: {área}, relevância: {score}) — correspondeu em {reasons}
```

Usar AskUserQuestion (multiSelect) perguntando quais tarefas incorporar ao escopo desta fase:

```
Quais dessas tarefas devem ser incorporadas ao escopo da Fase {X}?
(Selecione as que se aplicam, ou nenhuma para pular)
```

**Para tarefas selecionadas (incorporadas):**
- Armazenar internamente como `<folded_todos>` para inclusão na seção `<decisions>` do CONTEXT.md
- Estes se tornam itens de escopo adicionais que agentes downstream (pesquisador, planejador) verão

**Para tarefas não selecionadas (revisadas mas não incorporadas):**
- Armazenar internamente como `<reviewed_todos>` para inclusão na seção `<deferred>` do CONTEXT.md
- Isso evita que fases futuras re-exibam as mesmas tarefas como "perdidas"

**Modo auto (`--auto`):** Incorporar todas as tarefas com score >= 0,4 automaticamente. Logar a seleção.
</step>

<step name="scout_codebase">
Varredura leve do código existente para informar identificação de áreas cinzentas e discussão. Usa ~10% do contexto — aceitável para uma sessão interativa.

**Passo 1: Verificar mapas de codebase existentes**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**Se mapas de codebase existirem:** Ler os mais relevantes (CONVENTIONS.md, STRUCTURE.md, STACK.md com base no tipo de fase). Extrair:
- Componentes/hooks/utilitários reutilizáveis
- Padrões estabelecidos (gerenciamento de estado, estilização, busca de dados)
- Pontos de integração (onde novo código se conectaria)

Pular para o Passo 3 abaixo.

**Passo 2: Se não há mapas de codebase, fazer grep direcionado**

Extrair termos-chave do objetivo da fase (ex: "feed" → "post", "card", "list"; "auth" → "login", "session", "token").

```bash
# Encontrar arquivos relacionados aos termos do objetivo da fase
grep -rl "{termo1}\|{termo2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10 || true

# Encontrar componentes/hooks existentes
ls src/components/ 2>/dev/null || true
ls src/hooks/ 2>/dev/null || true
ls src/lib/ src/utils/ 2>/dev/null || true
```

Ler os 3-5 arquivos mais relevantes para entender padrões existentes.

**Passo 3: Construir codebase_context interno**

Da varredura, identificar:
- **Ativos reutilizáveis** — componentes, hooks, utilitários existentes que poderiam ser usados nesta fase
- **Padrões estabelecidos** — como a base de código faz gerenciamento de estado, estilização, busca de dados
- **Pontos de integração** — onde novo código se conectaria (rotas, nav, providers)
- **Opções criativas** — abordagens que a arquitetura existente habilita ou restringe

Armazenar como `<codebase_context>` interno para uso em analyze_phase e present_gray_areas. Isso NÃO é escrito em arquivo — é usado apenas nesta sessão.
</step>

<step name="analyze_phase">
Analisar a fase para identificar áreas cinzentas que valem a discussão. **Usar tanto `prior_decisions` quanto `codebase_context` para embasar a análise.**

**Ler a descrição da fase do ROADMAP.md e determinar:**

1. **Limite de domínio** — Qual capacidade esta fase está entregando? Declará-la claramente.

1b. **Inicializar acumulador de refs canônicas** — Começar a construir a lista `<canonical_refs>` para CONTEXT.md. Isso se acumula ao longo de toda a discussão, não apenas neste passo.

   **Fonte 1 (agora):** Copiar `Canonical refs:` do ROADMAP.md para esta fase. Expandir cada uma para um caminho relativo completo.
   **Fonte 2 (agora):** Verificar REQUIREMENTS.md e PROJECT.md por quaisquer specs/ADRs referenciados para esta fase.
   **Fonte 3 (scout_codebase):** Se código existente referencia docs (ex: comentários citando ADRs), adicionar esses.
   **Fonte 4 (discuss_areas):** Quando o usuário disser "leia X", "verifique Y", ou referenciar qualquer doc/spec/ADR durante a discussão — adicionar imediatamente. Estes são frequentemente as refs MAIS importantes porque representam docs que o usuário especificamente quer seguidos.

   Esta lista é OBRIGATÓRIA no CONTEXT.md. Cada ref deve ter um caminho relativo completo para que agentes downstream possam lê-la diretamente. Se não existirem docs externos, note isso explicitamente.

2. **Verificar decisões anteriores** — Antes de gerar áreas cinzentas, verificar se alguma já foi decidida:
   - Escanear `<prior_decisions>` por escolhas relevantes (ex: "Somente Ctrl+C, sem atalhos de tecla única")
   - Estas estão **pré-respondidas** — não re-perguntar a menos que esta fase tenha necessidades conflitantes
   - Notar decisões anteriores aplicáveis para uso na apresentação

3. **Áreas cinzentas por categoria** — Para cada categoria relevante (UI, UX, Comportamento, Estados Vazios, Conteúdo), identificar 1-2 ambiguidades específicas que mudariam a implementação. **Anotar com contexto de código onde relevante** (ex: "Você já tem um componente Card" ou "Sem padrão existente para isso").

4. **Avaliação de pulo** — Se não existirem áreas cinzentas significativas (infraestrutura pura, implementação clara, ou tudo já decidido em fases anteriores), a fase pode não precisar de discussão.

**Detecção de Modo Advisor:**

Verificar se o modo advisor deve ativar:

1. Verificar USER-PROFILE.md:
   ```bash
   PROFILE_PATH="./.claude/framework/USER-PROFILE.md"
   ```
   ADVISOR_MODE = arquivo existe em PROFILE_PATH → true, caso contrário → false

2. Se ADVISOR_MODE for true, resolver tier de calibração vendor_philosophy:
   - Prioridade 1: Ler config.json > preferences.vendor_philosophy (override em nível de projeto)
   - Prioridade 2: Ler avaliação Vendor Choices/Philosophy do USER-PROFILE.md (global)
   - Prioridade 3: Padrão para "standard" se nenhum tiver valor ou valor for UNSCORED

   Mapear para tier de calibração:
   - conservative OU thorough-evaluator → full_maturity
   - opinionated → minimal_decisive
   - pragmatic-fast OU qualquer outro valor OU vazio → standard

3. Resolver modelo para agentes advisor:
   ```bash
   ADVISOR_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model advisor-researcher --raw)
   ```

Se ADVISOR_MODE for false, pular todos os passos específicos de advisor — workflow prossegue com fluxo conversacional existente inalterado.

**Produzir sua análise internamente, então apresentar ao usuário.**

Exemplo de análise para fase "Feed de Posts" (com código e contexto anterior):
```
Domínio: Exibindo posts de usuários seguidos
Existente: Componente Card (src/components/ui/Card.tsx), hook useInfiniteQuery, Tailwind CSS
Decisões anteriores: "UI minimalista preferida" (Fase 2), "Sem paginação — sempre scroll infinito" (Fase 4)
Áreas cinzentas:
- UI: Estilo de layout (cards vs timeline vs grid) — Componente Card existe com variantes shadow/rounded
- UI: Densidade de informação (posts completos vs prévias) — sem padrões de densidade existentes
- Comportamento: Padrão de carregamento — JÁ DECIDIDO: scroll infinito (Fase 4)
- Estado Vazio: O que mostra quando não há posts — Componente EmptyState existe em ui/
- Conteúdo: Quais metadados exibir (hora, autor, contagem de reações)
```
</step>

<step name="present_gray_areas">
Apresentar o limite de domínio, decisões anteriores e áreas cinzentas ao usuário.

**Primeiro, declarar o limite e quaisquer decisões anteriores que se aplicam:**
```
Fase [X]: [Nome]
Domínio: [O que esta fase entrega — da sua análise]

Vamos clarificar COMO implementar isso.
(Novas capacidades pertencem a outras fases.)

[Se decisões anteriores se aplicam:]
**Carregando de fases anteriores:**
- [Decisão da Fase N que se aplica aqui]
- [Decisão da Fase M que se aplica aqui]
```

**Se `--auto`:** Auto-selecionar TODAS as áreas cinzentas. Logar: `[auto] Selecionadas todas as áreas cinzentas: [lista de nomes das áreas].` Pular o AskUserQuestion abaixo e continuar diretamente para discuss_areas com todas as áreas selecionadas.

**Caso contrário, usar AskUserQuestion (multiSelect: true):**
- header: "Discutir"
- question: "Quais áreas você quer discutir para [nome da fase]?"
- options: Gerar 3-4 áreas cinzentas específicas da fase, cada uma com:
  - "[Área específica]" (rótulo) — concreto, não genérico
  - [1-2 perguntas que isso cobre + anotação de contexto de código] (descrição)
  - **Destacar a escolha recomendada com breve explicação do porquê**

**Anotações de decisão anterior:** Quando uma área cinzenta já foi decidida em uma fase anterior, anotá-la:
```
☐ Atalhos de saída — Como os usuários devem sair?
  (Você decidiu "Somente Ctrl+C, sem atalhos de tecla única" na Fase 5 — revisitar ou manter?)
```

**Anotações de contexto de código:** Quando o scout encontrou código existente relevante, anotar a descrição da área cinzenta:
```
☐ Estilo de layout — Cards vs lista vs timeline?
  (Você já tem um componente Card com variantes shadow/rounded. Reutilizá-lo mantém o app consistente.)
```

**Combinando ambos:** Quando tanto decisões anteriores quanto contexto de código se aplicam:
```
☐ Comportamento de carregamento — Scroll infinito ou paginação?
  (Você escolheu scroll infinito na Fase 4. Hook useInfiniteQuery já configurado.)
```

**NÃO incluir opção "pular" ou "você decide".** O usuário executou este comando para discutir — dar escolhas reais.

**Exemplos por domínio (com contexto de código):**

Para "Feed de Posts" (funcionalidade visual):
```
☐ Estilo de layout — Cards vs lista vs timeline? (Componente Card existe com variantes)
☐ Comportamento de carregamento — Scroll infinito ou paginação? (Hook useInfiniteQuery disponível)
☐ Ordenação de conteúdo — Cronológico, algorítmico, ou escolha do usuário?
☐ Metadados de post — Quais informações por post? Timestamps, reações, autor?
```

Para "CLI de backup de banco de dados" (ferramenta de linha de comando):
```
☐ Formato de saída — JSON, tabela, ou texto simples? Níveis de verbosidade?
☐ Design de flags — Flags curtas, longas, ou ambas? Obrigatórias vs opcionais?
☐ Relatório de progresso — Silencioso, barra de progresso, ou log verbose?
☐ Recuperação de erros — Falhar rápido, tentar novamente, ou solicitar ação?
```

Para "Organizar biblioteca de fotos" (tarefa de organização):
```
☐ Critérios de agrupamento — Por data, localização, faces, ou eventos?
☐ Tratamento de duplicatas — Manter melhor, manter todos, ou solicitar cada vez?
☐ Convenção de nomenclatura — Nomes originais, datas, ou descritivos?
☐ Estrutura de pastas — Plana, aninhada por ano, ou por categoria?
```

Continuar para discuss_areas com áreas selecionadas (ou advisor_research se ADVISOR_MODE for true).
</step>

<step name="advisor_research">
**Pesquisa Advisor** (somente quando ADVISOR_MODE for true)

Após o usuário selecionar áreas cinzentas em present_gray_areas, criar agentes de pesquisa paralelos.

1. Exibir status breve: "Pesquisando {N} áreas..."

2. Para CADA área cinzenta selecionada pelo usuário, criar um Task() em paralelo:

   Task(
     prompt="First, read @./.claude/agents/advisor-researcher.md for your role and instructions.

     <gray_area>{area_name}: {area_description from gray area identification}</gray_area>
     <phase_context>{phase_goal and description from ROADMAP.md}</phase_context>
     <project_context>{project name and brief description from PROJECT.md}</project_context>
     <calibration_tier>{resolved calibration tier: full_maturity | standard | minimal_decisive}</calibration_tier>

     Research this gray area and return a structured comparison table with rationale.
     ${AGENT_SKILLS_ADVISOR}",
     subagent_type="general-purpose",
     model="{ADVISOR_MODEL}",
     description="Research: {area_name}"
   )

   Todas as chamadas Task() criam simultaneamente — NÃO aguardar uma antes de iniciar a próxima.

3. Após TODOS os agentes retornarem, SINTETIZAR resultados antes de apresentar:
   Para o retorno de cada agente:
   a. Analisar a tabela de comparação markdown e parágrafo de raciocínio
   b. Verificar se todas as 5 colunas estão presentes (Option | Pros | Cons | Complexity | Recommendation) — preencher colunas ausentes em vez de mostrar tabela quebrada
   c. Verificar contagem de opções contra o tier de calibração:
      - full_maturity: 3-5 opções aceitável
      - standard: 2-4 opções aceitável
      - minimal_decisive: 1-2 opções aceitável
      Se agente retornou demais, remover as menos viáveis. Se poucas demais, aceitar como está.
   d. Reescrever parágrafo de raciocínio para incorporar contexto do projeto e contexto de discussão em andamento ao qual o agente não tinha acesso
   e. Se agente retornou apenas 1 opção, converter de formato de tabela para recomendação direta: "Abordagem padrão para {área}: {opção}. {raciocínio}"

4. Armazenar tabelas sintetizadas para uso em discuss_areas.

**Se ADVISOR_MODE for false:** Pular este passo inteiramente — prosseguir diretamente de present_gray_areas para discuss_areas.
</step>

<step name="discuss_areas">
Discutir cada área selecionada com o usuário. O fluxo depende do modo advisor.

**Se ADVISOR_MODE for true:**

Fluxo de discussão com tabela primeiro — apresentar tabelas de comparação baseadas em pesquisa, então capturar escolhas do usuário.

**Para cada área selecionada:**

1. **Apresentar a tabela de comparação sintetizada + parágrafo de raciocínio** (do passo advisor_research)

2. **Usar AskUserQuestion:**
   - header: "{area_name}"
   - question: "Qual abordagem para {area_name}?"
   - options: Extrair da coluna Option da tabela (AskUserQuestion adiciona "Outro" automaticamente)

3. **Registrar a seleção do usuário:**
   - Se o usuário escolher das opções da tabela → registrar como decisão bloqueada para essa área
   - Se o usuário escolher "Outro" → receber seu input, refletir de volta para confirmação, registrar

4. **Após registrar escolha, Claude decide se perguntas de acompanhamento são necessárias:**
   - Se a escolha tem ambiguidade que afetaria o planejamento downstream → fazer 1-2 perguntas de acompanhamento direcionadas usando AskUserQuestion
   - Se a escolha é clara e autocontida → mover para próxima área
   - NÃO fazer as 4 perguntas padrão — a tabela já forneceu o contexto

5. **Após todas as áreas processadas:**
   - header: "Concluído"
   - question: "Isso cobre [listar áreas]. Pronto para criar contexto?"
   - options: "Criar contexto" / "Revisitar uma área"

**Tratamento de expansão de escopo (modo advisor):**
Se o usuário mencionar algo fora do domínio da fase:
```
"[Funcionalidade] parece uma nova capacidade — pertence à sua própria fase.
Vou anotá-la como uma ideia adiada.

De volta a [área atual]: [retornar à pergunta atual]"
```

Rastrear ideias adiadas internamente.

---

**Se ADVISOR_MODE for false:**

Para cada área selecionada, conduzir um loop de discussão focado.

**Modo pesquisa-antes-das-perguntas:** Verificar se `workflow.research_before_questions` está habilitado na config (do contexto init ou `.planning/config.json`). Quando habilitado, antes de apresentar perguntas para cada área:
1. Fazer uma breve busca na web por melhores práticas relacionadas ao tópico da área
2. Resumir as principais descobertas em 2-3 bullet points
3. Apresentar a pesquisa junto com a pergunta para que o usuário possa tomar uma decisão mais informada

Exemplo com pesquisa habilitada:
```
Vamos falar sobre [Estratégia de Autenticação].

📊 Pesquisa de melhores práticas:
• OAuth 2.0 + PKCE é o padrão atual para SPAs (substitui fluxo implícito)
• Tokens de sessão com cookies httpOnly preferidos sobre localStorage para proteção XSS
• Considerar suporte a passkey/WebAuthn — adoção está acelerando em 2025-2026

Com esse contexto: Como os usuários devem autenticar?
```

Quando desabilitado (padrão), pular a pesquisa e apresentar perguntas diretamente como antes.

**Suporte a modo texto:** Analisar `--text` opcional de `$ARGUMENTS`.
- Aceitar flag `--text` OU ler `workflow.text_mode` da config (do contexto init)
- Quando ativo, substituir TODAS as chamadas `AskUserQuestion` por listas numeradas de texto simples
- Usuário digita um número para selecionar, ou digita texto livre para "Outro"
- Isso é necessário para sessões remotas do Claude Code (modo `/rc`) onde menus TUI
  não funcionam através do App Claude

**Suporte a modo batch:** Analisar `--batch` opcional de `$ARGUMENTS`.
- Aceitar `--batch`, `--batch=N`, ou `--batch N`

**Suporte a modo analyze:** Analisar `--analyze` opcional de `$ARGUMENTS`.
Quando `--analyze` estiver ativo, antes de apresentar cada pergunta (ou grupo de perguntas no modo batch), fornecer uma breve **análise de trade-offs** para a decisão:
- 2-3 opções com prós/contras baseados no contexto da codebase e padrões comuns
- Uma abordagem recomendada com raciocínio
- Armadilhas conhecidas ou restrições de fases anteriores

Exemplo com `--analyze`:
```
**Análise de trade-offs: Estratégia de autenticação**

| Abordagem | Prós | Contras |
|-----------|------|---------|
| Cookies de sessão | Simples, httpOnly evita XSS | Requer proteção CSRF, sessões fixas |
| JWT (stateless) | Escalável, sem estado no servidor | Tamanho do token, complexidade de revogação |
| OAuth 2.0 + PKCE | Padrão da indústria para SPAs | Mais configuração, UX de fluxo de redirecionamento |

💡 Recomendado: OAuth 2.0 + PKCE — seu app tem login social nos requisitos (REQ-04) e isso se alinha com a configuração NextAuth existente em `src/lib/auth.ts`.

Como os usuários devem autenticar?
```

Isso dá ao usuário contexto para tomar decisões informadas sem prompts extras. Quando `--analyze` estiver ausente, apresentar perguntas diretamente como antes.
- Aceitar `--batch`, `--batch=N`, ou `--batch N`
- Padrão de 4 perguntas por batch quando nenhum número é fornecido
- Limitar tamanhos explícitos a 2-5 para que um batch permaneça respondível
- Se `--batch` estiver ausente, manter o fluxo existente de uma pergunta por vez

**Filosofia:** permanecer adaptativo, mas deixar o usuário escolher o ritmo.
- Modo padrão: 4 turnos de pergunta única, então verificar se continuar
- Modo `--batch`: 1 turno agrupado com 2-5 perguntas numeradas, então verificar se continuar

Cada resposta (ou conjunto de respostas, no modo batch) deve revelar a próxima pergunta ou próximo batch.

**Modo auto (`--auto`):** Para cada área, Claude seleciona a opção recomendada (primeira opção, ou a explicitamente marcada como "recomendada") para cada pergunta sem usar AskUserQuestion. Logar cada escolha auto-selecionada:
```
[auto] [Área] — P: "[texto da pergunta]" → Selecionado: "[opção escolhida]" (padrão recomendado)
```
Após todas as áreas serem auto-resolvidas, pular o prompt "Explorar mais áreas cinzentas" e prosseguir diretamente para write_context.

**Modo interativo (sem `--auto`):**

**Para cada área:**

1. **Anunciar a área:**
   ```
   Vamos falar sobre [Área].
   ```

2. **Fazer perguntas usando o ritmo selecionado:**

   **Padrão (sem `--batch`): Fazer 4 perguntas usando AskUserQuestion**
   - header: "[Área]" (máx 12 chars — abreviar se necessário)
   - question: Decisão específica para esta área
   - options: 2-3 escolhas concretas (AskUserQuestion adiciona "Outro" automaticamente), com a escolha recomendada destacada e breve explicação do porquê
   - **Anotar opções com contexto de código** quando relevante:
     ```
     "Como os posts devem ser exibidos?"
     - Cards (reutiliza o componente Card existente — consistente com Mensagens)
     - Lista (mais simples, seria um novo padrão)
     - Timeline (precisa de novo componente Timeline — nenhum existe ainda)
     ```
   - Incluir "Você decide" como opção quando razoável — captura discrição do Claude
   - **Context7 para escolhas de biblioteca:** Quando uma área cinzenta envolve seleção de biblioteca (ex: "magic links" → consultar docs do next-auth) ou decisões de abordagem de API, usar ferramentas `mcp__context7__*` para buscar documentação atual e informar as opções. Não usar Context7 para cada pergunta — apenas quando conhecimento específico da biblioteca melhora as opções.

   **Modo batch (`--batch`): Fazer 2-5 perguntas numeradas em um turno de texto simples**
   - Agrupar perguntas intimamente relacionadas para a área atual em uma única mensagem
   - Manter cada pergunta concreta e respondível em uma resposta
   - Quando opções são úteis, incluir escolhas inline curtas por pergunta em vez de um AskUserQuestion separado para cada item
   - Após a resposta do usuário, refletir de volta as decisões capturadas, notar itens não respondidos, e fazer apenas o mínimo de acompanhamento necessário antes de prosseguir
   - Preservar adaptabilidade entre batches: usar o conjunto completo de respostas para decidir o próximo batch ou se a área está suficientemente clara

3. **Após o conjunto atual de perguntas, verificar:**
   - header: "[Área]" (máx 12 chars)
   - question: "Mais perguntas sobre [área], ou mover para próxima? (Restantes: [listar outras áreas não visitadas])"
   - options: "Mais perguntas" / "Próxima área"

   Ao construir o texto da pergunta, listar as áreas não visitadas restantes para que o usuário saiba o que vem a seguir. Por exemplo: "Mais perguntas sobre Layout, ou mover para próxima? (Restantes: Comportamento de carregamento, Ordenação de conteúdo)"

   Se "Mais perguntas" → fazer mais 4 perguntas únicas, ou mais um batch de 2-5 perguntas quando `--batch` estiver ativo, então verificar novamente
   Se "Próxima área" → prosseguir para próxima área selecionada
   Se "Outro" (texto livre) → interpretar intenção: frases de continuação ("mais", "continuar", "sim", "mais perguntas") mapeiam para "Mais perguntas"; frases de avanço ("feito", "continuar", "próximo", "pular") mapeiam para "Próxima área". Se ambíguo, perguntar: "Continuar com mais perguntas sobre [área], ou mover para a próxima área?"

4. **Após todas as áreas inicialmente selecionadas concluírem:**
   - Resumir o que foi capturado da discussão até agora
   - AskUserQuestion:
     - header: "Concluído"
     - question: "Discutimos [listar áreas]. Quais áreas cinzentas permanecem pouco claras?"
     - options: "Explorar mais áreas cinzentas" / "Estou pronto para o contexto"
   - Se "Explorar mais áreas cinzentas":
     - Identificar 2-4 áreas cinzentas adicionais com base no que foi aprendido
     - Retornar à lógica de present_gray_areas com essas novas áreas
     - Loop: discutir novas áreas, então solicitar novamente
   - Se "Estou pronto para o contexto": Prosseguir para write_context

**Acumulação de ref canônica durante a discussão:**
Quando o usuário referencia um doc, spec, ou ADR durante qualquer resposta — ex: "leia adr-014", "verifique a spec MCP", "de acordo com browse-spec.md" — imediatamente:
1. Ler o doc referenciado (ou confirmar que existe)
2. Adicioná-lo ao acumulador de refs canônicas com caminho relativo completo
3. Usar o que aprendeu do doc para informar perguntas subsequentes

Esses docs referenciados pelo usuário são frequentemente MAIS importantes do que refs do ROADMAP.md porque representam docs que o usuário especificamente quer que agentes downstream sigam. Nunca os perder.

**Design de perguntas:**
- Opções devem ser concretas, não abstratas ("Cards" não "Opção A")
- Cada resposta deve informar a próxima pergunta ou próximo batch
- Se o usuário escolher "Outro" para fornecer input livre (ex: "deixa eu descrever", "outra coisa", ou uma resposta aberta), fazer o acompanhamento como texto simples — NÃO outro AskUserQuestion. Aguardar eles digitarem no prompt normal, então refletir seu input de volta e confirmar antes de retomar AskUserQuestion ou o próximo batch numerado.

**Tratamento de expansão de escopo:**
Se o usuário mencionar algo fora do domínio da fase:
```
"[Funcionalidade] parece uma nova capacidade — pertence à sua própria fase.
Vou anotá-la como uma ideia adiada.

De volta a [área atual]: [retornar à pergunta atual]"
```

Rastrear ideias adiadas internamente.

**Rastrear dados do log de discussão internamente:**
Para cada pergunta feita, acumular:
- Nome da área
- Todas as opções apresentadas (rótulo + descrição)
- Qual opção o usuário selecionou (ou sua resposta em texto livre)
- Quaisquer notas ou esclarecimentos de acompanhamento que o usuário forneceu
Esses dados são usados para gerar DISCUSSION-LOG.md no passo `write_context`.
</step>

<step name="write_context">
Criar CONTEXT.md capturando as decisões tomadas.

**Também gerar DISCUSSION-LOG.md** — uma trilha de auditoria completa do Q&A do discuss-phase.
Este arquivo é apenas para referência humana (auditorias de software, revisões de conformidade). NÃO é
consumido por agentes downstream (pesquisador, planejador, executor).

**Encontrar ou criar diretório de fase:**

Usar valores do init: `phase_dir`, `phase_slug`, `padded_phase`.

Se `phase_dir` for null (fase existe no roadmap mas sem diretório):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Localização do arquivo:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Estruturar o conteúdo pelo que foi discutido:**

```markdown
# Fase [X]: [Nome] - Contexto

**Coletado:** [data]
**Status:** Pronto para planejamento

<domain>
## Limite da Fase

[Declaração clara do que esta fase entrega — a âncora de escopo]

</domain>

<decisions>
## Decisões de Implementação

### [Categoria 1 que foi discutida]
- **D-01:** [Decisão ou preferência capturada]
- **D-02:** [Outra decisão se aplicável]

### [Categoria 2 que foi discutida]
- **D-03:** [Decisão ou preferência capturada]

### Discrição do Claude
[Áreas onde o usuário disse "você decide" — notar que Claude tem flexibilidade aqui]

### Tarefas Incorporadas
[Se alguma tarefa foi incorporada ao escopo do passo cross_reference_todos, listá-las aqui.
Cada entrada deve incluir o título da tarefa, problema original e como se encaixa no escopo desta fase.
Se nenhuma tarefa foi incorporada: omitir esta subseção inteiramente.]

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

[Seção OBRIGATÓRIA. Escrever aqui a lista COMPLETA de refs canônicas acumuladas.
Fontes: refs do ROADMAP.md + refs do REQUIREMENTS.md + docs referenciados pelo usuário durante
a discussão + quaisquer docs descobertos durante a varredura da codebase. Agrupar por área de tópico.
Cada entrada precisa de um caminho relativo completo — não apenas um nome.]

### [Área de tópico 1]
- `caminho/para/adr-ou-spec.md` — [O que decide/define que é relevante]
- `caminho/para/doc.md` §N — [Referência de seção específica]

### [Área de tópico 2]
- `caminho/para/feature-doc.md` — [O que este doc define]

[Se sem specs externas: "Sem specs externas — requisitos totalmente capturados nas decisões acima"]

</canonical_refs>

<code_context>
## Insights de Código Existente

### Ativos Reutilizáveis
- [Componente/hook/utilitário]: [Como poderia ser usado nesta fase]

### Padrões Estabelecidos
- [Padrão]: [Como restringe/habilita esta fase]

### Pontos de Integração
- [Onde novo código se conecta ao sistema existente]

</code_context>

<specifics>
## Ideias Específicas

[Quaisquer referências particulares, exemplos, ou momentos "quero como X" da discussão]

[Se nenhum: "Sem requisitos específicos — aberto a abordagens padrão"]

</specifics>

<deferred>
## Ideias Adiadas

[Ideias que surgiram mas pertencem a outras fases. Não as perder.]

### Tarefas Revisadas (não incorporadas)
[Se alguma tarefa foi revisada em cross_reference_todos mas não incorporada ao escopo,
listá-las aqui para que fases futuras saibam que foram consideradas.
Cada entrada: título da tarefa + motivo pelo qual foi adiada (fora do escopo, pertence à Fase Y, etc.)
Se sem tarefas revisadas-mas-adiadas: omitir esta subseção inteiramente.]

[Se nenhum: "Nenhum — discussão ficou dentro do escopo da fase"]

</deferred>

---

*Fase: XX-nome*
*Contexto coletado: [data]*
```

Escrever arquivo.
</step>

<step name="confirm_creation">
Apresentar resumo e próximos passos:

```
Criado: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisões Capturadas

### [Categoria]
- [Decisão-chave]

### [Categoria]
- [Decisão-chave]

[Se ideias adiadas existirem:]
## Anotado para Depois
- [Ideia adiada] — fase futura

---

## ▶ Próximo Passo

**Fase ${PHASE}: [Nome]** — [Objetivo do ROADMAP.md]

`/planejar-fase ${PHASE} ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/planejar-fase ${PHASE} --skip-research ${WS}` — planejar sem pesquisa
- `/fase-ui ${PHASE} ${WS}` — gerar contrato de design de UI antes do planejamento (se a fase tem trabalho de frontend)
- Revisar/editar CONTEXT.md antes de continuar

---
```
</step>

<step name="git_commit">
**Escrever DISCUSSION-LOG.md antes de commitar:**

**Localização do arquivo:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Fase [X]: [Nome] - Log de Discussão

> **Somente trilha de auditoria.** Não usar como entrada para agentes de planejamento, pesquisa ou execução.
> Decisões são capturadas no CONTEXT.md — este log preserva as alternativas consideradas.

**Data:** [data ISO]
**Fase:** [número-fase]-[nome-fase]
**Áreas discutidas:** [lista separada por vírgula]

---

[Para cada área cinzenta discutida:]

## [Nome da Área]

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| [Opção 1] | [Descrição do AskUserQuestion] | |
| [Opção 2] | [Descrição] | ✓ |
| [Opção 3] | [Descrição] | |

**Escolha do usuário:** [Opção selecionada ou resposta em texto livre]
**Notas:** [Quaisquer esclarecimentos, contexto de acompanhamento, ou raciocínio fornecido pelo usuário]

---

[Repetir para cada área]

## Discrição do Claude

[Listar áreas onde o usuário disse "você decide" ou delegou ao Claude]

## Ideias Adiadas

[Ideias mencionadas durante a discussão que foram anotadas para fases futuras]
```

Escrever arquivo.

Commitar contexto da fase e log de discussão:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

Confirmar: "Commitado: docs(${padded_phase}): capturar contexto da fase"
</step>

<step name="update_state">
Atualizar STATE.md com informações da sessão:

```bash
node "./.claude/framework/bin/tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commitar STATE.md:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Verificar gatilho de avanço automático:

1. Analisar flag `--auto` de $ARGUMENTS
2. **Sincronizar flag de cadeia com intenção** — se o usuário invocou manualmente (sem `--auto`), limpar a flag de cadeia efêmera de qualquer cadeia `--auto` anterior interrompida. Isso NÃO toca em `workflow.auto_advance` (preferência persistente do usuário):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Ler tanto a flag de cadeia quanto a preferência do usuário:
   ```bash
   AUTO_CHAIN=$(node "./.claude/framework/bin/tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**Se flag `--auto` presente E `AUTO_CHAIN` não for true:** Persistir flag de cadeia na config (lida com uso direto de `--auto` sem new-project):
```bash
node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active true
```

**Se flag `--auto` presente OU `AUTO_CHAIN` for true OU `AUTO_CFG` for true:**

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AVANÇANDO AUTOMATICAMENTE PARA PLANEJAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contexto capturado. Iniciando plan-phase...
```

Iniciar plan-phase usando a ferramenta Skill para evitar sessões Task aninhadas (que causam freezes de runtime devido ao aninhamento profundo de agentes — ver #686):
```
Skill(skill="framework:planejar-fase", args="${PHASE} --auto ${WS}")
```

Isso mantém a cadeia de avanço automático plana — discutir, planejar e executar todos rodam no mesmo nível de aninhamento em vez de criar agentes Task cada vez mais profundos.

**Lidar com retorno do plan-phase:**
- **FASE CONCLUÍDA** → Cadeia completa bem-sucedida. Exibir:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   framework ► FASE ${PHASE} CONCLUÍDA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Pipeline de avanço automático finalizado: discutir → planejar → executar

  Próximo: /discutir-fase ${NEXT_PHASE} --auto ${WS}
  <sub>/clear primeiro → janela de contexto fresca</sub>
  ```
- **PLANEJAMENTO CONCLUÍDO** → Planejamento feito, execução não terminou:
  ```
  Avanço automático parcial: Planejamento concluído, execução não terminou.
  Continuar: /executar-fase ${PHASE} ${WS}
  ```
- **PLANEJAMENTO INCONCLUSIVO / CHECKPOINT** → Parar cadeia:
  ```
  Avanço automático parado: Planejamento precisa de input.
  Continuar: /planejar-fase ${PHASE} ${WS}
  ```
- **LACUNAS ENCONTRADAS** → Parar cadeia:
  ```
  Avanço automático parado: Lacunas encontradas durante execução.
  Continuar: /planejar-fase ${PHASE} --gaps ${WS}
  ```

**Se nem `--auto` nem config habilitado:**
Rotear para passo `confirm_creation` (comportamento existente — mostrar próximos passos manuais).
</step>

</process>

<success_criteria>
- Fase validada contra o roadmap
- Contexto anterior carregado (PROJECT.md, REQUIREMENTS.md, STATE.md, arquivos CONTEXT.md anteriores)
- Questões já decididas não re-perguntadas (carregadas de fases anteriores)
- Codebase varrida por ativos reutilizáveis, padrões e pontos de integração
- Áreas cinzentas identificadas por análise inteligente com anotações de código e decisão anterior
- Usuário selecionou quais áreas discutir
- Cada área selecionada explorada até satisfação do usuário (com opções informadas por código e por decisões anteriores)
- Expansão de escopo redirecionada para ideias adiadas
- CONTEXT.md captura decisões reais, não visão vaga
- CONTEXT.md inclui seção canonical_refs com caminhos completos de arquivos para cada spec/ADR/doc que agentes downstream precisam (OBRIGATÓRIO — nunca omitir)
- CONTEXT.md inclui seção code_context com ativos e padrões reutilizáveis
- Ideias adiadas preservadas para fases futuras
- STATE.md atualizado com informações da sessão
- Usuário sabe os próximos passos
</success_criteria>
