<purpose>

Conduzir todas as fases restantes do milestone de forma autônoma. Para cada fase incompleta: discutir → planejar → executar usando invocações planas Skill(). Pausa apenas para decisões explícitas do usuário (aceitação de áreas cinzas, bloqueadores, solicitações de validação). Re-lê ROADMAP.md após cada fase para capturar fases inseridas dinamicamente.

</purpose>

<required_reading>

Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Inicializar

Analisar `$ARGUMENTS` para a flag `--from N`:

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi
```

Bootstrap via init de nível de milestone:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analisar JSON para: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`.

**Se `roadmap_exists` for falso:** Erro — "Nenhum ROADMAP.md encontrado. Execute `/novo-marco` primeiro."
**Se `state_exists` for falso:** Erro — "Nenhum STATE.md encontrado. Execute `/novo-marco` primeiro."

Exibir banner de inicialização:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Fases: {phase_count} total, {completed_phases} concluídas
```

Se `FROM_PHASE` estiver definido, exibir: `Iniciando da fase ${FROM_PHASE}`

</step>

<step name="discover_phases">

## 2. Descobrir Fases

Executar descoberta de fases:

```bash
ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)
```

Analisar o array JSON `phases`.

**Filtrar para fases incompletas:** Manter apenas fases onde `disk_status !== "complete"` OU `roadmap_complete === false`.

**Aplicar filtro `--from N`:** Se `FROM_PHASE` foi fornecido, adicionalmente filtrar fases onde `number < FROM_PHASE` (usar comparação numérica — trata fases decimais como "5.1").

**Ordenar por `number`** em ordem numérica ascendente.

**Se nenhuma fase incompleta restar:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO ▸ CONCLUÍDO 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Todas as fases concluídas! Nada mais a fazer.
```

Sair limpo.

**Exibir plano de fases:**

```
## Plano de Fases

| # | Fase | Status |
|---|------|--------|
| 5 | Scaffolding de Skills & Descoberta de Fases | Em Progresso |
| 6 | Discuss Inteligente | Não Iniciado |
| 7 | Refinamentos de Auto-Chain | Não Iniciado |
| 8 | Orquestração de Ciclo de Vida | Não Iniciado |
```

**Buscar detalhes para cada fase:**

```bash
DETAIL=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extrair `phase_name`, `goal`, `success_criteria` de cada um. Armazenar para uso em execute_phase e mensagens de transição.

</step>

<step name="execute_phase">

## 3. Executar Fase

Para a fase atual, exibir o banner de progresso:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO ▸ Fase {N}/{T}: {Nome} [████░░░░] {P}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Onde N = número da fase atual (do ROADMAP, ex: 6), T = total de fases do milestone (do `phase_count` analisado no passo de inicialização, ex: 8), P = percentual de todas as fases do milestone concluídas até agora. Calcular P como: (número de fases com `disk_status` "complete" do `roadmap analyze` mais recente / T × 100). Usar █ para segmentos preenchidos e ░ para vazios na barra de progresso (8 caracteres de largura).

**3a. Discuss Inteligente**

Verificar se CONTEXT.md já existe para esta fase:

```bash
PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op ${PHASE_NUM})
```

Analisar `has_context` do JSON.

**Se has_context for verdadeiro:** Pular discuss — contexto já coletado. Exibir:

```
Fase ${PHASE_NUM}: Contexto existe — pulando discuss.
```

Prosseguir para 3b.

**Se has_context for falso:** Verificar se discuss está desabilitado via configurações:

```bash
SKIP_DISCUSS=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.skip_discuss 2>/dev/null || echo "false")
```

**Se SKIP_DISCUSS for `true`:** Pular discuss completamente — a descrição da fase no ROADMAP é a spec. Exibir:

```
Fase ${PHASE_NUM}: Discuss pulado (workflow.skip_discuss=true) — usando objetivo da fase do ROADMAP como spec.
```

Escrever um CONTEXT.md mínimo para que o plan-phase downstream tenha input válido. Obter detalhes da fase:

```bash
DETAIL=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extrair `goal` e `requirements` do JSON. Escrever `${phase_dir}/${padded_phase}-CONTEXT.md` com:

```markdown
# Fase {PHASE_NUM}: {Nome da Fase} - Contexto

**Coletado:** {data}
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

{objetivo da descrição da fase no ROADMAP}

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário. Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código para guiar decisões.

</decisions>

<code_context>
## Insights do Código Existente

Contexto da base de código será coletado durante a pesquisa do plan-phase.

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos — fase de discuss pulada. Consulte a descrição da fase no ROADMAP e critérios de sucesso.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
```

Commitar o contexto mínimo:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${PADDED_PHASE}): contexto auto-gerado (discuss pulado)" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Prosseguir para 3b.

**Se SKIP_DISCUSS for `false` (ou não definido):** Executar o passo smart_discuss para esta fase.

Após smart_discuss concluir, verificar se o contexto foi escrito:

```bash
PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op ${PHASE_NUM})
```

Verificar `has_context`. Se falso → ir para handle_blocker: "Discuss inteligente para a fase ${PHASE_NUM} não produziu CONTEXT.md."

**3a.5. Contrato de Design UI (Fases Frontend)**

Verificar se esta fase tem indicadores frontend e se um UI-SPEC já existe:

```bash
PHASE_SECTION=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase ${PHASE_NUM} 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

Verificar se o workflow de fase UI está habilitado:

```bash
UI_PHASE_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**Se `HAS_UI` for 0 (indicadores frontend encontrados) E `UI_SPEC_FILE` estiver vazio (nenhum UI-SPEC existe) E `UI_PHASE_CFG` não for `false`:**

Exibir:

```
Fase ${PHASE_NUM}: Fase frontend detectada — gerando contrato de design UI...
```

```
Skill(skill="framework:fase-ui", args="${PHASE_NUM}")
```

Verificar se UI-SPEC foi criado:

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**Se `UI_SPEC_FILE` ainda estiver vazio após ui-phase:** Exibir aviso `Fase ${PHASE_NUM}: Geração de UI-SPEC não produziu saída — continuando sem contrato de design.` e prosseguir para 3b.

**Se `HAS_UI` for 1 (sem indicadores frontend) OU `UI_SPEC_FILE` não estiver vazio (UI-SPEC já existe) OU `UI_PHASE_CFG` for `false`:** Pular silenciosamente para 3b.

**3b. Planejar**

```
Skill(skill="framework:planejar-fase", args="${PHASE_NUM}")
```

Verificar se o plano produziu saída — re-executar `init phase-op` e verificar `has_plans`. Se falso → ir para handle_blocker: "Fase de planejamento ${PHASE_NUM} não produziu planos."

**3c. Executar**

```
Skill(skill="framework:executar-fase", args="${PHASE_NUM} --no-transition")
```

**3d. Roteamento Pós-Execução**

Após execute-phase retornar, ler o resultado de verificação:

```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

Onde `PHASE_DIR` vem da chamada `init phase-op` já feita no passo 3a. Se a variável não estiver no escopo, re-buscar:

```bash
PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op ${PHASE_NUM})
```

Analisar `phase_dir` do JSON.

**Se VERIFY_STATUS estiver vazio** (sem VERIFICATION.md ou sem campo status):

Ir para handle_blocker: "Fase de execução ${PHASE_NUM} não produziu resultados de verificação."

**Se `passed`:**

Exibir:
```
Fase ${PHASE_NUM} ✅ ${PHASE_NAME} — Verificação aprovada
```

Prosseguir para o passo iterate.

**Se `human_needed`:**

Ler a seção human_verification do VERIFICATION.md para obter a contagem e itens que requerem teste manual.

Exibir os itens, então perguntar ao usuário via AskUserQuestion:
- **question:** "Fase ${PHASE_NUM} tem itens precisando de verificação manual. Validar agora ou continuar para a próxima fase?"
- **options:** "Validar agora" / "Continuar sem validação"

Em **"Validar agora"**: Apresentar os itens específicos da seção human_verification do VERIFICATION.md. Após o usuário revisar, perguntar:
- **question:** "Resultado da validação?"
- **options:** "Tudo certo — continuar" / "Encontrei problemas"

Em "Tudo certo — continuar": Exibir `Fase ${PHASE_NUM} ✅ Validação humana aprovada` e prosseguir para o passo iterate.

Em "Encontrei problemas": Ir para handle_blocker com os problemas reportados pelo usuário como descrição.

Em **"Continuar sem validação"**: Exibir `Fase ${PHASE_NUM} ⏭ Validação humana adiada` e prosseguir para o passo iterate.

**Se `gaps_found`:**

Ler resumo de lacunas do VERIFICATION.md (pontuação e itens ausentes). Exibir:
```
⚠ Fase ${PHASE_NUM}: ${PHASE_NAME} — Lacunas Encontradas
Pontuação: {N}/{M} must-haves verificados
```

Perguntar ao usuário via AskUserQuestion:
- **question:** "Lacunas encontradas na fase ${PHASE_NUM}. Como prosseguir?"
- **options:** "Executar fechamento de lacunas" / "Continuar sem corrigir" / "Parar modo autônomo"

Em **"Executar fechamento de lacunas"**: Executar ciclo de fechamento de lacunas (limite: 1 tentativa):

```
Skill(skill="framework:planejar-fase", args="${PHASE_NUM} --gaps")
```

Verificar se os planos de lacunas foram criados — re-executar `init phase-op ${PHASE_NUM}` e verificar `has_plans`. Se nenhum novo plano de lacunas → ir para handle_blocker: "Planejamento de fechamento de lacunas para a fase ${PHASE_NUM} não produziu planos."

Re-executar:
```
Skill(skill="framework:executar-fase", args="${PHASE_NUM} --no-transition")
```

Re-ler status de verificação:
```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

Se `passed` ou `human_needed`: Rotear normalmente (continuar ou perguntar ao usuário como acima).

Se ainda `gaps_found` após esta tentativa: Exibir "Lacunas persistem após tentativa de fechamento." e perguntar via AskUserQuestion:
- **question:** "Fechamento de lacunas não resolveu completamente os problemas. Como prosseguir?"
- **options:** "Continuar mesmo assim" / "Parar modo autônomo"

Em "Continuar mesmo assim": Prosseguir para o passo iterate.
Em "Parar modo autônomo": Ir para handle_blocker.

Isso limita o fechamento de lacunas a 1 tentativa automática para prevenir loops infinitos.

Em **"Continuar sem corrigir"**: Exibir `Fase ${PHASE_NUM} ⏭ Lacunas adiadas` e prosseguir para o passo iterate.

Em **"Parar modo autônomo"**: Ir para handle_blocker com "Usuário parou — lacunas permanecem na fase ${PHASE_NUM}".

**3d.5. Revisão de UI (Fases Frontend)**

> Executar após qualquer roteamento de execução bem-sucedido (passed, human_needed aceito, ou lacunas adiadas/aceitas) — antes de prosseguir para o passo iterate.

Verificar se esta fase tinha um UI-SPEC (criado no passo 3a.5 ou pré-existente):

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

Verificar se a revisão de UI está habilitada:

```bash
UI_REVIEW_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.ui_review 2>/dev/null || echo "true")
```

**Se `UI_SPEC_FILE` não estiver vazio E `UI_REVIEW_CFG` não for `false`:**

Exibir:

```
Fase ${PHASE_NUM}: Fase frontend com UI-SPEC — executando auditoria de revisão UI...
```

```
Skill(skill="framework:revisar-ui", args="${PHASE_NUM}")
```

Exibir o resumo do resultado da revisão (pontuação do UI-REVIEW.md se produzido). Continuar para o passo iterate independente da pontuação — revisão de UI é consultiva, não bloqueante.

**Se `UI_SPEC_FILE` estiver vazio OU `UI_REVIEW_CFG` for `false`:** Pular silenciosamente para o passo iterate.

</step>

<step name="smart_discuss">

## Discuss Inteligente

Executar discuss inteligente para a fase atual. Propõe respostas para áreas cinzas em tabelas em lote — o usuário aceita ou substitui por área. Produz saída CONTEXT.md idêntica ao discuss-phase regular.

> **Nota:** O discuss inteligente é uma variante otimizada para autonomia do skill `framework:discutir-fase`. Produz saída CONTEXT.md idêntica mas usa propostas de tabela em lote em vez de questionamento sequencial. O skill original `discuss-phase` permanece inalterado (conforme CTRL-03). Milestones futuros podem extrair isso para um arquivo de skill separado.

**Inputs:** `PHASE_NUM` de execute_phase. Executar init para obter caminhos de fase:

```bash
PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op ${PHASE_NUM})
```

Analisar do JSON: `phase_dir`, `phase_slug`, `padded_phase`, `phase_name`.

---

### Sub-passo 1: Carregar contexto anterior

Ler contexto de nível de projeto e fase anterior para evitar re-fazer perguntas já decididas.

**Ler arquivos do projeto:**

```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Extrair destes:
- **PROJECT.md** — Visão, princípios, não-negociáveis, preferências do usuário
- **REQUIREMENTS.md** — Critérios de aceitação, restrições, must-haves vs nice-to-haves
- **STATE.md** — Progresso atual, decisões registradas até agora

**Ler todos os arquivos CONTEXT.md anteriores:**

```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

Para cada CONTEXT.md onde o número da fase < fase atual:
- Ler a seção `<decisions>` — estas são preferências bloqueadas
- Ler `<specifics>` — referências particulares ou momentos "eu quero como X"
- Notar padrões (ex: "usuário consistentemente prefere UI mínima", "usuário rejeitou saída verbosa")

**Construir contexto interno prior_decisions** (não escrever em arquivo):

```
<prior_decisions>
## Nível de Projeto
- [Princípio ou restrição chave do PROJECT.md]
- [Requisito afetando esta fase do REQUIREMENTS.md]

## De Fases Anteriores
### Fase N: [Nome]
- [Decisão relevante para a fase atual]
- [Preferência que estabelece um padrão]
</prior_decisions>
```

Se nenhum contexto anterior existir, continuar sem — esperado para fases iniciais.

---

### Sub-passo 2: Explorar Base de Código

Varredura leve da base de código para informar identificação de áreas cinzas e propostas. Manter abaixo de ~5% do contexto.

**Verificar mapas de base de código existentes:**

```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**Se mapas de base de código existirem:** Ler os mais relevantes (CONVENTIONS.md, STRUCTURE.md, STACK.md com base no tipo de fase). Extrair componentes reutilizáveis, padrões estabelecidos, pontos de integração. Pular para construir contexto abaixo.

**Se não houver mapas de base de código, fazer grep direcionado:**

Extrair termos-chave do objetivo da fase. Buscar arquivos relacionados:

```bash
grep -rl "{termo1}\|{termo2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10 || true
ls src/components/ src/hooks/ src/lib/ src/utils/ 2>/dev/null || true
```

Ler os 3-5 arquivos mais relevantes para entender padrões existentes.

**Construir codebase_context interno** (não escrever em arquivo):
- **Ativos reutilizáveis** — componentes existentes, hooks, utilitários usáveis nesta fase
- **Padrões estabelecidos** — como a base de código faz gerenciamento de estado, estilização, busca de dados
- **Pontos de integração** — onde o novo código se conecta (rotas, nav, providers)

---

### Sub-passo 3: Analisar Fase e Gerar Propostas

**Obter detalhes da fase:**

```bash
DETAIL=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extrair `goal`, `requirements`, `success_criteria` da resposta JSON.

**Detecção de infraestrutura — verificar PRIMEIRO antes de gerar áreas cinzas:**

Uma fase é infraestrutura pura quando TODOS estes são verdadeiros:
1. Palavras-chave do objetivo correspondem: "scaffolding", "plumbing", "setup", "configuration", "migration", "refactor", "rename", "restructure", "upgrade", "infrastructure"
2. E critérios de sucesso são todos técnicos: "arquivo existe", "teste passa", "config válida", "comando executa"
3. E nenhum comportamento voltado ao usuário é descrito (sem "usuários podem", "exibe", "mostra", "apresenta")

**Se apenas infraestrutura:** Pular Sub-passo 4. Pular diretamente para Sub-passo 5 com CONTEXT.md mínimo. Exibir:

```
Fase ${PHASE_NUM}: Fase de infraestrutura — pulando discuss, escrevendo contexto mínimo.
```

Usar estes padrões para o CONTEXT.md:
- `<domain>`: Limite da fase do objetivo do ROADMAP
- `<decisions>`: Subseção única "### Discrição do Claude" — "Todas as escolhas de implementação são de discrição do Claude — fase de infraestrutura pura"
- `<code_context>`: O que o scout de base de código encontrou
- `<specifics>`: "Sem requisitos específicos — fase de infraestrutura"
- `<deferred>`: "Nenhum"

**Se NÃO for infraestrutura — gerar propostas de áreas cinzas:**

Determinar tipo de domínio a partir do objetivo da fase:
- Algo que os usuários **VEEM** → visual: layout, interações, estados, densidade
- Algo que os usuários **CHAMAM** → interface: contratos, respostas, erros, auth
- Algo que os usuários **EXECUTAM** → execução: invocação, saída, modos de comportamento, flags
- Algo que os usuários **LEEM** → conteúdo: estrutura, tom, profundidade, fluxo
- Algo sendo **ORGANIZADO** → organização: critérios, agrupamento, exceções, nomenclatura

Verificar prior_decisions — pular áreas cinzas já decididas em fases anteriores.

Gerar **3-4 áreas cinzas** com **~4 perguntas cada**. Para cada pergunta:
- **Pré-selecionar uma resposta recomendada** com base em: decisões anteriores (consistência), padrões da base de código (reutilização), convenções de domínio (abordagens padrão), critérios de sucesso do ROADMAP
- Gerar **1-2 alternativas** por pergunta
- **Anotar** com contexto de decisão anterior ("Você decidiu X na Fase N") e contexto de código ("Componente Y existe com variantes Z") onde relevante

---

### Sub-passo 4: Apresentar Propostas por Área

Apresentar áreas cinzas **uma de cada vez**. Para cada área (M de N):

Exibir uma tabela:

```
### Área Cinza {M}/{N}: {Nome da Área}

| # | Pergunta | ✅ Recomendado | Alternativa(s) |
|---|----------|----------------|----------------|
| 1 | {pergunta} | {resposta} — {raciocínio} | {alt1}; {alt2} |
| 2 | {pergunta} | {resposta} — {raciocínio} | {alt1} |
| 3 | {pergunta} | {resposta} — {raciocínio} | {alt1}; {alt2} |
| 4 | {pergunta} | {resposta} — {raciocínio} | {alt1} |
```

Então perguntar ao usuário via **AskUserQuestion**:
- **header:** "Área {M}/{N}"
- **question:** "Aceitar estas respostas para {Nome da Área}?"
- **options:** Construir dinamicamente — sempre "Aceitar todas" primeiro, então "Mudar P1" a "Mudar PN" para cada pergunta (até 4), depois "Discutir mais fundo" por último. Máximo de 6 opções explícitas (AskUserQuestion adiciona "Outro" automaticamente).

**Em "Aceitar todas":** Registrar todas as respostas recomendadas para esta área. Passar para a próxima área.

**Em "Mudar PN":** Usar AskUserQuestion com as alternativas para aquela pergunta específica:
- **header:** "{Nome da Área}"
- **question:** "P{N}: {texto da pergunta}"
- **options:** Listar as 1-2 alternativas mais "Você decide" (mapeia para Discrição do Claude)

Registrar a escolha do usuário. Re-exibir a tabela atualizada com a mudança refletida. Re-apresentar o prompt completo de aceitação para que o usuário possa fazer mudanças adicionais ou aceitar.

**Em "Discutir mais fundo":** Mudar para modo interativo apenas para esta área — fazer perguntas uma de cada vez usando AskUserQuestion com 2-3 opções concretas por pergunta mais "Você decide". Após 4 perguntas, perguntar:
- **header:** "{Nome da Área}"
- **question:** "Mais perguntas sobre {nome da área}, ou passar para a próxima?"
- **options:** "Mais perguntas" / "Próxima área"

Se "Mais perguntas", fazer mais 4. Se "Próxima área", exibir tabela de resumo final das respostas capturadas para esta área e continuar.

**Em "Outro" (texto livre):** Interpretar como uma solicitação de mudança específica ou feedback geral. Incorporar nas decisões da área, re-exibir tabela atualizada, re-apresentar prompt de aceitação.

**Tratamento de expansão de escopo:** Se o usuário mencionar algo fora do domínio da fase:

```
"{Funcionalidade} parece uma nova capacidade — pertence à sua própria fase.
Vou anotá-la como uma ideia adiada.

Voltando a {área atual}: {retornar à pergunta atual}"
```

Rastrear ideias adiadas internamente para inclusão no CONTEXT.md.

---

### Sub-passo 5: Escrever CONTEXT.md

Após todas as áreas serem resolvidas (ou pular infraestrutura), escrever o arquivo CONTEXT.md.

**Caminho do arquivo:** `${phase_dir}/${padded_phase}-CONTEXT.md`

Usar **exatamente** esta estrutura (idêntica à saída do discuss-phase):

```markdown
# Fase {PHASE_NUM}: {Nome da Fase} - Contexto

**Coletado:** {data}
**Status:** Pronto para planejamento

<domain>
## Limite da Fase

{Declaração de limite de domínio da análise — o que esta fase entrega}

</domain>

<decisions>
## Decisões de Implementação

### {Nome da Área 1}
- {Resposta aceita/escolhida para P1}
- {Resposta aceita/escolhida para P2}
- {Resposta aceita/escolhida para P3}
- {Resposta aceita/escolhida para P4}

### {Nome da Área 2}
- {Resposta aceita/escolhida para P1}
- {Resposta aceita/escolhida para P2}
...

### Discrição do Claude
{Quaisquer respostas "Você decide" coletadas — notar que Claude tem flexibilidade aqui}

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- {Do scout de base de código — componentes, hooks, utilitários}

### Padrões Estabelecidos
- {Do scout de base de código — gerenciamento de estado, estilização, busca de dados}

### Pontos de Integração
- {Do scout de base de código — onde o novo código se conecta}

</code_context>

<specifics>
## Ideias Específicas

{Quaisquer referências específicas ou "eu quero como X" da discussão}
{Se nenhuma: "Sem requisitos específicos — aberto a abordagens padrão"}

</specifics>

<deferred>
## Ideias Adiadas

{Ideias capturadas mas fora do escopo para esta fase}
{Se nenhuma: "Nenhuma — discussão permaneceu dentro do escopo da fase"}

</deferred>
```

Escrever o arquivo.

**Commitar:**

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${PADDED_PHASE}): contexto do discuss inteligente" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Exibir confirmação:

```
Criado: {caminho}
Decisões capturadas: {contagem} em {area_count} áreas
```

</step>

<step name="iterate">

## 4. Iterar

Após cada fase concluir, re-ler ROADMAP.md para capturar fases inseridas durante a execução (fases decimais como 5.1):

```bash
ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)
```

Re-filtrar fases incompletas usando a mesma lógica que discover_phases:
- Manter fases onde `disk_status !== "complete"` OU `roadmap_complete === false`
- Aplicar filtro `--from N` se originalmente fornecido
- Ordenar por número ascendente

Ler STATE.md fresco:

```bash
cat .planning/STATE.md
```

Verificar bloqueadores na seção Blockers/Concerns. Se bloqueadores encontrados, ir para handle_blocker com a descrição do bloqueador.

Se fases incompletas permanecerem: prosseguir para a próxima fase, voltar para execute_phase.

Se todas as fases concluíram, prosseguir para o passo lifecycle.

</step>

<step name="lifecycle">

## 5. Ciclo de Vida

Após todas as fases concluírem, executar a sequência de ciclo de vida do milestone: auditar → concluir → limpar.

Exibir banner de transição de ciclo de vida:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO ▸ CICLO DE VIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Todas as fases concluídas → Iniciando ciclo de vida: auditar → concluir → limpar
 Milestone: {milestone_version} — {milestone_name}
```

**5a. Auditar**

```
Skill(skill="framework:auditar-marco")
```

Após a auditoria concluir, detectar o resultado:

```bash
AUDIT_FILE=".planning/v${milestone_version}-MILESTONE-AUDIT.md"
AUDIT_STATUS=$(grep "^status:" "${AUDIT_FILE}" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**Se AUDIT_STATUS estiver vazio** (sem arquivo de auditoria ou sem campo status):

Ir para handle_blocker: "Auditoria não produziu resultados — arquivo de auditoria ausente ou malformado."

**Se `passed`:**

Exibir:
```
Auditoria ✅ aprovada — prosseguindo para concluir milestone
```

Prosseguir para 5b (sem pausa de usuário — conforme CTRL-01).

**Se `gaps_found`:**

Ler o resumo de lacunas do arquivo de auditoria. Exibir:
```
⚠ Auditoria: Lacunas Encontradas
```

Perguntar ao usuário via AskUserQuestion:
- **question:** "Auditoria do milestone encontrou lacunas. Como prosseguir?"
- **options:** "Continuar mesmo assim — aceitar lacunas" / "Parar — corrigir lacunas manualmente"

Em **"Continuar mesmo assim"**: Exibir `Auditoria ⏭ Lacunas aceitas — prosseguindo para concluir milestone` e prosseguir para 5b.

Em **"Parar"**: Ir para handle_blocker com "Usuário parou — lacunas de auditoria permanecem. Execute /auditar-marco para revisar, então /concluir-marco quando pronto."

**Se `tech_debt`:**

Ler o resumo de dívida técnica do arquivo de auditoria. Exibir:
```
⚠ Auditoria: Dívida Técnica Identificada
```

Mostrar o resumo, então perguntar ao usuário via AskUserQuestion:
- **question:** "Auditoria do milestone encontrou dívida técnica. Como prosseguir?"
- **options:** "Continuar com dívida técnica" / "Parar — resolver dívida primeiro"

Em **"Continuar com dívida técnica"**: Exibir `Auditoria ⏭ Dívida técnica reconhecida — prosseguindo para concluir milestone` e prosseguir para 5b.

Em **"Parar"**: Ir para handle_blocker com "Usuário parou — dívida técnica a resolver. Execute /auditar-marco para ver detalhes."

**5b. Concluir Milestone**

```
Skill(skill="framework:concluir-marco", args="${milestone_version}")
```

Após concluir-marco retornar, verificar se produziu saída:

```bash
ls .planning/milestones/v${milestone_version}-ROADMAP.md 2>/dev/null || true
```

Se o arquivo de arquivo não existir, ir para handle_blocker: "Concluir milestone não produziu arquivos de arquivo esperados."

**5c. Limpar**

```
Skill(skill="framework:limpeza")
```

Limpeza mostra seu próprio dry-run e pede aprovação do usuário internamente — esta é uma pausa aceitável conforme CTRL-01 já que é uma decisão explícita sobre exclusão de arquivos.

**5d. Conclusão Final**

Exibir banner de conclusão final:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO ▸ CONCLUÍDO 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Status: Concluído ✅
 Ciclo de vida: auditar ✅ → concluir ✅ → limpar ✅

 Publique! 🚀
```

</step>

<step name="handle_blocker">

## 6. Tratar Bloqueador

Quando qualquer operação de fase falha ou um bloqueador é detectado, apresentar 3 opções via AskUserQuestion:

**Prompt:** "Fase {N} ({Nome}) encontrou um problema: {descrição}"

**Opções:**
1. **"Corrigir e tentar novamente"** — Re-executar o passo que falhou (discuss, plan, ou execute) para esta fase
2. **"Pular esta fase"** — Marcar fase como pulada, continuar para a próxima fase incompleta
3. **"Parar modo autônomo"** — Exibir resumo do progresso até agora e sair limpo

**Em "Corrigir e tentar novamente":** Voltar para o passo que falhou dentro de execute_phase. Se o mesmo passo falhar novamente após tentativa, re-apresentar estas opções.

**Em "Pular esta fase":** Registrar `Fase {N} ⏭ {Nome} — Pulada pelo usuário` e prosseguir para iterate.

**Em "Parar modo autônomo":** Exibir resumo de progresso:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AUTÔNOMO ▸ PARADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Concluídas: {lista de fases concluídas}
 Puladas: {lista de fases puladas}
 Restantes: {lista de fases restantes}

 Retomar com: /autonomo --from {próxima_fase}
```

</step>

</process>

<success_criteria>
- [ ] Todas as fases incompletas executadas em ordem (discuss inteligente → ui-phase → plan → execute → ui-review cada uma)
- [ ] Discuss inteligente propõe respostas de áreas cinzas em tabelas, usuário aceita ou substitui por área
- [ ] Banners de progresso exibidos entre fases
- [ ] Execute-phase invocado com --no-transition (autônomo gerencia transições)
- [ ] Verificação pós-execução lê VERIFICATION.md e roteia por status
- [ ] Verificação passed → continuar automaticamente para a próxima fase
- [ ] Verificação human-needed → usuário solicitado a validar ou pular
- [ ] Gaps-found → usuário oferecido fechamento de lacunas, continuar, ou parar
- [ ] Fechamento de lacunas limitado a 1 tentativa (previne loops infinitos)
- [ ] Falhas de plan-phase e execute-phase roteiam para handle_blocker
- [ ] ROADMAP.md re-lido após cada fase (captura fases inseridas)
- [ ] STATE.md verificado para bloqueadores antes de cada fase
- [ ] Bloqueadores tratados via escolha do usuário (tentar novamente / pular / parar)
- [ ] Conclusão final ou resumo de parada exibido
- [ ] Após todas as fases concluírem, passo lifecycle é invocado (não sugestão manual)
- [ ] Banner de transição de ciclo de vida exibido antes da auditoria
- [ ] Auditoria invocada via Skill(skill="framework:auditar-marco")
- [ ] Roteamento de resultado de auditoria: passed → auto-continuar, gaps_found → usuário decide, tech_debt → usuário decide
- [ ] Falha técnica de auditoria (sem arquivo/sem status) roteia para handle_blocker
- [ ] Concluir-milestone invocado via Skill() com argumento ${milestone_version}
- [ ] Limpeza invocada via Skill() — confirmação interna é aceitável (CTRL-01)
- [ ] Banner de conclusão final exibido após ciclo de vida
- [ ] Barra de progresso usa número de fase / total de fases do milestone (não posição entre incompletas)
- [ ] Discuss inteligente documenta relação com discuss-phase com nota CTRL-03
- [ ] Fases frontend recebem UI-SPEC gerado antes do planejamento (passo 3a.5) se ainda não presente
- [ ] Fases frontend recebem auditoria de revisão UI após execução bem-sucedida (passo 3d.5) se UI-SPEC existe
- [ ] ui-phase e revisão de UI respeitam toggles de config workflow.ui_phase e workflow.ui_review
- [ ] Revisão de UI é consultiva (não bloqueante) — fase prossegue para iterate independente da pontuação
</success_criteria>
