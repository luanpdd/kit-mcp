<purpose>
Extrair decisões de implementação que agentes downstream precisam — usando análise primeiro da base de código
e surfacing de premissas em vez de questionamento estilo entrevista.

Você é um parceiro de pensamento, não um entrevistador. Analise a base de código profundamente, surfeie o que
você acredita com base em evidências, e pergunte ao usuário apenas para corrigir o que está errado.
</purpose>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- assumptions-analyzer — Analisa a base de código para surfaçar premissas de implementação
</available_agent_types>

<downstream_awareness>
**CONTEXT.md alimenta:**

1. **phase-researcher** — Lê CONTEXT.md para saber O QUE pesquisar
2. **planner** — Lê CONTEXT.md para saber QUAIS decisões estão bloqueadas

**Seu trabalho:** Capturar decisões de forma clara o suficiente para que agentes downstream possam agir sobre elas
sem perguntar ao usuário novamente. A saída é idêntica ao modo discuss — mesmo formato CONTEXT.md.
</downstream_awareness>

<philosophy>
**Filosofia do modo assumptions:**

O usuário é um visionário, não um arqueólogo de base de código. Eles precisam de contexto suficiente para avaliar
se suas premissas correspondem à intenção deles — não para responder perguntas que você poderia descobrir
lendo o código.

- Leia a base de código PRIMEIRO, forme opiniões SEGUNDO, pergunte APENAS sobre o que é genuinamente incerto
- Cada premissa deve citar evidências (caminhos de arquivo, padrões encontrados)
- Cada premissa deve declarar consequências se estiver errada
- Minimize interações com o usuário: ~2-4 correções vs ~15-20 perguntas
</philosophy>

<scope_guardrail>
**CRÍTICO: Sem expansão de escopo.**

O limite da fase vem do ROADMAP.md e é FIXO. A discussão esclarece COMO implementar
o que está no escopo, nunca SE adicionar novas capacidades.

Quando o usuário sugere expansão de escopo:
"[Funcionalidade X] seria uma nova capacidade — isso é sua própria fase.
Quer que eu anote para o backlog do roadmap? Por enquanto, vamos focar em [domínio da fase]."

Capturar a ideia em "Ideias Adiadas". Não perder, não agir.
</scope_guardrail>

<answer_validation>
**IMPORTANTE: Validação de resposta** — Após cada chamada AskUserQuestion, verificar se a resposta
está vazia ou apenas com espaços em branco. Se sim:
1. Tentar a pergunta novamente uma vez com os mesmos parâmetros
2. Se ainda vazia, apresentar as opções como uma lista numerada em texto simples

**Modo texto (`workflow.text_mode: true` na config ou flag `--text`):**
Quando o modo texto estiver ativo, não usar AskUserQuestion de forma alguma. Apresentar cada pergunta como uma
lista numerada em texto simples e pedir ao usuário que digite o número da escolha.
</answer_validation>

<process>

<step name="initialize" priority="first">
Número da fase do argumento (obrigatório).

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ANALYZER=$(node "./.claude/framework/bin/tools.cjs" agent-skills assumptions-analyzer 2>/dev/null)
```

Analisar JSON para: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`,
`phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`,
`plan_count`, `roadmap_exists`, `planning_exists`.

**Se `phase_found` for falso:**
```
Fase [X] não encontrada no roadmap.

Use /progresso para ver as fases disponíveis.
```
Sair do workflow.

**Se `phase_found` for verdadeiro:** Continuar para check_existing.

**Modo auto** — Se `--auto` estiver presente em ARGUMENTS:
- Em `check_existing`: auto-selecionar "Atualizar" (se contexto existe) ou continuar sem perguntar
- Em `present_assumptions`: pular portão de confirmação, prosseguir diretamente para escrever CONTEXT.md
- Em `correct_assumptions`: auto-selecionar opção recomendada para cada correção
- Registrar cada escolha auto-selecionada inline
- Após conclusão, avançar automaticamente para plan-phase
</step>

<step name="check_existing">
Verificar se CONTEXT.md já existe usando `has_context` do init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**Se existir:**

**Se `--auto`:** Auto-selecionar "Atualizar". Registrar: `[auto] Contexto existe — atualizando com análise baseada em premissas.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Contexto"
- question: "A Fase [X] já tem contexto. O que você quer fazer?"
- options:
  - "Atualizar" — Re-analisar base de código e atualizar premissas
  - "Ver" — Mostrar o que está lá
  - "Pular" — Usar contexto existente como está

Se "Atualizar": Carregar existente, continuar para load_prior_context
Se "Ver": Exibir CONTEXT.md, então oferecer atualizar/pular
Se "Pular": Sair do workflow

**Se não existir:**

Verificar `has_plans` e `plan_count` do init. **Se `has_plans` for verdadeiro:**

**Se `--auto`:** Auto-selecionar "Continuar e replanejar depois". Registrar: `[auto] Planos existem — continuando com análise de premissas, replanejará depois.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Planos existem"
- question: "A Fase [X] já tem {plan_count} plano(s) criado(s) sem contexto do usuário. Suas decisões aqui não afetarão planos existentes a menos que você replaneje."
- options:
  - "Continuar e replanejar depois"
  - "Ver planos existentes"
  - "Cancelar"

Se "Continuar e replanejar depois": Continuar para load_prior_context.
Se "Ver planos existentes": Exibir arquivos de plano, então oferecer "Continuar" / "Cancelar".
Se "Cancelar": Sair do workflow.

**Se `has_plans` for falso:** Continuar para load_prior_context.
</step>

<step name="load_prior_context">
Ler contexto de nível de projeto e fase anterior para evitar re-fazer perguntas já decididas.

**Passo 1: Ler arquivos de nível de projeto**
```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Extrair destes:
- **PROJECT.md** — Visão, princípios, não-negociáveis, preferências do usuário
- **REQUIREMENTS.md** — Critérios de aceitação, restrições
- **STATE.md** — Progresso atual, quaisquer flags

**Passo 2: Ler todos os arquivos CONTEXT.md anteriores**
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

Para cada CONTEXT.md onde o número da fase < fase atual:
- Ler a seção `<decisions>` — estas são preferências bloqueadas
- Ler `<specifics>` — referências particulares ou momentos "eu quero como X"
- Notar padrões (ex: "usuário consistentemente prefere UI mínima")

**Passo 3: Construir contexto interno `<prior_decisions>`**

Estruturar as informações extraídas para uso na geração de premissas.

**Se nenhum contexto anterior existir:** Continuar sem — esperado para fases iniciais.
</step>

<step name="cross_reference_todos">
Verificar se algum todo pendente é relevante para o escopo desta fase.

```bash
TODO_MATCHES=$(node "./.claude/framework/bin/tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

Analisar JSON para: `todo_count`, `matches[]`.

**Se `todo_count` for 0:** Pular silenciosamente.

**Se correspondências encontradas:** Apresentar todos correspondentes, usar AskUserQuestion (multiSelect) para dobrar os relevantes no escopo.

**Para todos selecionados (dobrados):** Armazenar como `<folded_todos>` para a seção `<decisions>` do CONTEXT.md.
**Para não selecionados:** Armazenar como `<reviewed_todos>` para a seção `<deferred>` do CONTEXT.md.

**Modo auto (`--auto`):** Dobrar automaticamente todos os todos com score >= 0.4. Registrar a seleção.
</step>

<step name="scout_codebase">
Varredura leve do código existente para informar a geração de premissas.

**Passo 1: Verificar mapas de base de código existentes**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**Se mapas de base de código existirem:** Ler os relevantes (CONVENTIONS.md, STRUCTURE.md, STACK.md). Extrair componentes reutilizáveis, padrões, pontos de integração. Pular para o Passo 3.

**Passo 2: Se não houver mapas de base de código, fazer grep direcionado**

Extrair termos-chave do objetivo da fase, buscar arquivos relacionados.

```bash
grep -rl "{termo1}\|{termo2}" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

Ler os 3-5 arquivos mais relevantes.

**Passo 3: Construir `<codebase_context>` interno**

Identificar ativos reutilizáveis, padrões estabelecidos, pontos de integração e opções criativas. Armazenar internamente para uso em deep_codebase_analysis.
</step>

<step name="deep_codebase_analysis">
Criar um agente `assumptions-analyzer` para analisar profundamente a base de código para esta fase. Isso
mantém conteúdos brutos de arquivos fora da janela de contexto principal, protegendo o orçamento de tokens.

**Resolver tier de calibração (se USER-PROFILE.md existir):**

```bash
PROFILE_PATH="./.claude/framework/USER-PROFILE.md"
```

Se o arquivo existir em PROFILE_PATH:
- Prioridade 1: Ler config.json > preferences.vendor_philosophy (substituição de nível de projeto)
- Prioridade 2: Ler avaliação de Vendor Choices/Philosophy do USER-PROFILE.md (global)
- Prioridade 3: Padrão para "standard"

Mapear para tier de calibração:
- conservative OU thorough-evaluator → full_maturity (mais alternativas, evidência detalhada)
- opinionated → minimal_decisive (menos alternativas, recomendações decisivas)
- pragmatic-fast OU qualquer outro valor → standard

Se não houver USER-PROFILE.md: calibration_tier = "standard"

**Criar subagente Explore:**

```
Task(subagent_type="assumptions-analyzer", prompt="""
Analisar a base de código para a Fase {PHASE}: {phase_name}.

Objetivo da fase: {roadmap_description}
Decisões anteriores: {prior_decisions_summary}
Dicas do scout de base de código: {codebase_context_summary}
Calibração: {calibration_tier}

Seu trabalho:
1. Ler descrição da fase {PHASE} do ROADMAP.md
2. Ler quaisquer arquivos CONTEXT.md anteriores de fases anteriores
3. Glob/Grep para arquivos relacionados a: {phase_relevant_terms}
4. Ler 5-15 arquivos fonte mais relevantes
5. Retornar premissas estruturadas

## Formato de Saída

Retornar EXATAMENTE esta estrutura:

## Premissas

### [Nome da Área] (ex: "Abordagem Técnica")
- **Premissa:** [Declaração de decisão]
  - **Por quê desta forma:** [Evidência da base de código — citar caminhos de arquivo]
  - **Se errado:** [Consequência concreta de estar errado]
  - **Confiança:** Confiante | Provável | Incerto

(3-5 áreas, calibradas por tier:
- full_maturity: 3-5 áreas, 2-3 alternativas por item Provável/Incerto
- standard: 3-4 áreas, 2 alternativas por item Provável/Incerto
- minimal_decisive: 2-3 áreas, recomendação única decisiva por item)

## Precisa de Pesquisa Externa
[Tópicos onde a base de código sozinha é insuficiente — compatibilidade de versão de biblioteca,
melhores práticas do ecossistema, etc. Deixar vazio se a base de código fornece evidência suficiente.]

${AGENT_SKILLS_ANALYZER}
""")
```

Analisar a resposta do subagente. Extrair:
- `assumptions[]` — cada um com área, declaração, evidência, consequência, confiança
- `needs_research[]` — tópicos que requerem pesquisa externa (pode estar vazio)

**Inicializar acumulador de refs canônicas:**
- Fonte 1: Copiar `Canonical refs:` do ROADMAP.md para esta fase, expandir para caminhos completos
- Fonte 2: Verificar REQUIREMENTS.md e PROJECT.md para specs/ADRs referenciados
- Fonte 3: Adicionar quaisquer docs referenciados nos resultados do scout de base de código
</step>

<step name="external_research">
**Pular se:** `needs_research` do deep_codebase_analysis estiver vazio.

Se tópicos de pesquisa foram sinalizados, criar um agente de pesquisa geral:

```
Task(subagent_type="general-purpose", prompt="""
Pesquisar os seguintes tópicos para a Fase {PHASE}: {phase_name}.

Tópicos precisando de pesquisa:
{needs_research_content}

Para cada tópico, retornar:
- **Achado:** [O que você aprendeu]
- **Fonte:** [URL ou referência de docs de biblioteca]
- **Impacto na confiança:** [Qual premissa isso resolve e para qual nível de confiança]

Use Context7 (resolve-library-id então query-docs) para perguntas específicas de biblioteca.
Use WebSearch para perguntas de ecossistema/melhores práticas.
""")
```

Mesclar achados de volta nas premissas:
- Atualizar níveis de confiança onde a pesquisa resolve ambiguidade
- Adicionar atribuição de fonte às premissas afetadas
- Armazenar achados de pesquisa para DISCUSSION-LOG.md

**Se nenhuma lacuna sinalizada:** Pular completamente. A maioria das fases pulará esta etapa.
</step>

<step name="present_assumptions">
Exibir todas as premissas agrupadas por área com badges de confiança.

**Formato para exibição:**

```
## Fase {PHASE}: {phase_name} — Premissas

Com base na análise da base de código, aqui está o que eu usaria:

### {Nome da Área}
{Badge de confiança} **{Declaração de premissa}**
↳ Evidência: {caminhos de arquivo citados}
↳ Se errado: {consequência}

### {Nome da Área 2}
...

[Se pesquisa externa foi realizada:]
### Pesquisa Externa Aplicada
- {Tópico}: {Achado} (Fonte: {URL})
```

**Se `--auto`:**
- Se todas as premissas são Confiante ou Provável: registrar premissas, pular para write_context.
  Registrar: `[auto] Todas as premissas Confiante/Provável — prosseguindo para captura de contexto.`
- Se alguma premissa é Incerto: registrar um aviso, auto-selecionar alternativa recomendada para
  cada item Incerto. Registrar: `[auto] {N} premissas Incertas auto-resolvidas com padrões recomendados.`
  Prosseguir para write_context.

**Caso contrário:** Usar AskUserQuestion:
- header: "Premissas"
- question: "Tudo parece correto?"
- options:
  - "Sim, prosseguir" — Escrever CONTEXT.md com estas premissas como decisões
  - "Deixe-me corrigir algumas" — Selecionar quais premissas mudar

**Se "Sim, prosseguir":** Pular para write_context.
**Se "Deixe-me corrigir algumas":** Continuar para correct_assumptions.
</step>

<step name="correct_assumptions">
As premissas já estão exibidas acima do present_assumptions.

Apresentar um multiSelect onde o rótulo de cada opção é a declaração de premissa e a descrição
é a consequência "Se errado":

Usar AskUserQuestion (multiSelect):
- header: "Correções"
- question: "Quais premissas precisam de correção?"
- options: [uma por premissa, rótulo = declaração de premissa, descrição = "Se errado: {consequência}"]

Para cada correção selecionada, fazer UMA pergunta focada:

Usar AskUserQuestion:
- header: "{Nome da Área}"
- question: "O que devemos fazer em vez disso para: {declaração de premissa}?"
- options: [2-3 alternativas concretas descrevendo resultados visíveis ao usuário, opção recomendada primeiro]

Registrar cada correção:
- Premissa original
- Alternativa escolhida pelo usuário
- Motivo (se fornecido via texto livre "Outro")

Após todas as correções processadas, continuar para write_context com premissas atualizadas.

**Modo auto:** Não deve atingir esta etapa (--auto pula de present_assumptions).
</step>

<step name="write_context">
Criar diretório de fase se necessário. Escrever CONTEXT.md usando o formato padrão de 6 seções.

**Arquivo:** `${phase_dir}/${padded_phase}-CONTEXT.md`

Mapear premissas para seções do CONTEXT.md:
- Premissas → `<decisions>` (cada premissa se torna uma decisão bloqueada: D-01, D-02, etc.)
- Correções → substituir a premissa original em `<decisions>`
- Áreas onde todas as premissas eram Confiante → marcadas como decisões bloqueadas
- Áreas com correções → incluir alternativa escolhida pelo usuário como a decisão
- Todos dobrados → incluídos em `<decisions>` em "### Todos Dobrados"

```markdown
# Fase {PHASE}: {phase_name} - Contexto

**Coletado:** {data} (modo assumptions)
**Status:** Pronto para planejamento

<domain>
## Limite da Fase

{Limite de domínio do ROADMAP.md — declaração clara de âncora de escopo}
</domain>

<decisions>
## Decisões de Implementação

### {Nome da Área 1}
- **D-01:** {Decisão — de premissa ou correção}
- **D-02:** {Decisão}

### {Nome da Área 2}
- **D-03:** {Decisão}

### Discrição do Claude
{Quaisquer premissas onde o usuário confirmou "você decide" ou deixou como está com confiança Provável}

### Todos Dobrados
{Se algum todo foi dobrado no escopo}
</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

{Refs canônicas acumuladas do passo de análise — caminhos relativos completos}

[Se não houver specs externas: "Sem specs externas — requisitos totalmente capturados nas decisões acima"]
</canonical_refs>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
{Do scout de base de código + achados do subagente Explore}

### Padrões Estabelecidos
{Padrões que restringem/habilitam esta fase}

### Pontos de Integração
{Onde o novo código se conecta ao sistema existente}
</code_context>

<specifics>
## Ideias Específicas

{Quaisquer referências particulares das correções ou input do usuário}

[Se nenhuma: "Sem requisitos específicos — aberto a abordagens padrão"]
</specifics>

<deferred>
## Ideias Adiadas

{Ideias mencionadas durante correções que estão fora do escopo}

### Todos Revisados (não dobrados)
{Todos revisados mas não dobrados — com motivo}

[Se nenhum: "Nenhum — análise permaneceu dentro do escopo da fase"]
</deferred>
```

Escrever arquivo.
</step>

<step name="write_discussion_log">
Escrever trilha de auditoria das premissas e correções.

**Arquivo:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Fase {PHASE}: {phase_name} - Log de Discussão (Modo Assumptions)

> **Apenas trilha de auditoria.** Não usar como input para agentes de planejamento, pesquisa ou execução.
> Decisões capturadas no CONTEXT.md — este log preserva a análise.

**Data:** {data ISO}
**Fase:** {padded_phase}-{phase_name}
**Modo:** assumptions
**Áreas analisadas:** {nomes de área separados por vírgula}

## Premissas Apresentadas

### {Nome da Área}
| Premissa | Confiança | Evidência |
|----------|-----------|-----------|
| {Declaração} | {Confiante/Provável/Incerto} | {caminhos de arquivo} |

{Repetir para cada área}

## Correções Feitas

{Se correções foram feitas:}

### {Nome da Área}
- **Premissa original:** {o que Claude assumiu}
- **Correção do usuário:** {o que o usuário escolheu em vez disso}
- **Motivo:** {raciocínio do usuário, se fornecido}

{Se nenhuma correção: "Sem correções — todas as premissas confirmadas."}

## Auto-Resolvido

{Se --auto e itens Incertos existiam:}
- {Premissa}: auto-selecionou {opção recomendada}

{Se não aplicável: omitir esta seção}

## Pesquisa Externa

{Se pesquisa foi realizada:}
- {Tópico}: {Achado} (Fonte: {URL})

{Se nenhuma pesquisa: omitir esta seção}
```

Escrever arquivo.
</step>

<step name="git_commit">
Commitar contexto da fase e log de discussão:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): capturar contexto da fase (modo assumptions)" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

Confirmar: "Commitado: docs(${padded_phase}): capturar contexto da fase (modo assumptions)"
</step>

<step name="update_state">
Atualizar STATE.md com informações da sessão:

```bash
node "./.claude/framework/bin/tools.cjs" state record-session \
  --stopped-at "Contexto da Fase ${PHASE} coletado (modo assumptions)" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commitar STATE.md:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(state): registrar sessão de contexto da fase ${PHASE}" --files .planning/STATE.md
```
</step>

<step name="confirm_creation">
Apresentar resumo e próximos passos:

```
Criado: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisões Capturadas (Modo Assumptions)

### {Nome da Área}
- {Decisão-chave} (de premissa / corrigida)

{Repetir por área}

[Se correções foram feitas:]
## Correções Aplicadas
- {Área}: {original} → {corrigido}

[Se ideias adiadas existirem:]
## Anotado para Depois
- {Ideia adiada} — fase futura

---

## ▶ Próximo Passo

**Fase ${PHASE}: {phase_name}** — {Objetivo do ROADMAP.md}

`/planejar-fase ${PHASE}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/planejar-fase ${PHASE} --skip-research` — planejar sem pesquisa
- `/fase-ui ${PHASE}` — gerar contrato de design UI (se trabalho de frontend)
- Revisar/editar CONTEXT.md antes de continuar

---
```
</step>

<step name="auto_advance">
Verificar gatilho de avanço automático:

1. Analisar flag `--auto` de $ARGUMENTS
2. Flag de cadeia de sincronização:
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Ler flag de cadeia e preferência do usuário:
   ```bash
   AUTO_CHAIN=$(node "./.claude/framework/bin/tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**Se flag `--auto` presente E `AUTO_CHAIN` não for verdadeiro:**
```bash
node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active true
```

**Se flag `--auto` presente OU `AUTO_CHAIN` for verdadeiro OU `AUTO_CFG` for verdadeiro:**

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AVANÇANDO AUTOMATICAMENTE PARA PLANEJAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contexto capturado (modo assumptions). Iniciando plan-phase...
```

Iniciar: `Skill(skill="framework:planejar-fase", args="${PHASE} --auto")`

Tratar retorno: PHASE COMPLETE / PLANNING COMPLETE / INCONCLUSIVE / GAPS FOUND
(tratamento idêntico ao passo auto_advance do discuss-phase.md)

**Se nem `--auto` nem config habilitado:**
Rotear para o passo confirm_creation.
</step>

</process>

<success_criteria>
- Fase validada contra o roadmap
- Contexto anterior carregado (sem re-fazer perguntas já decididas)
- Base de código profundamente analisada via subagente Explore (5-15 arquivos lidos)
- Premissas surfaçadas com evidências e níveis de confiança
- Usuário confirmou ou corrigiu premissas (~2-4 interações no máximo)
- Expansão de escopo redirecionada para ideias adiadas
- CONTEXT.md captura decisões reais (formato idêntico ao modo discuss)
- CONTEXT.md inclui canonical_refs com caminhos completos de arquivo (OBRIGATÓRIO)
- CONTEXT.md inclui code_context da análise de base de código
- DISCUSSION-LOG.md registra premissas e correções como trilha de auditoria
- STATE.md atualizado com informações da sessão
- Usuário conhece os próximos passos
</success_criteria>
