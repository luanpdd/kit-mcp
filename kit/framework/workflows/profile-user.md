<purpose>
Orquestra o fluxo completo de perfilamento do desenvolvedor: consentimento, análise de sessão (ou questionário alternativo), geração do perfil, exibição dos resultados e criação de artefatos.

Este workflow conecta a Fase 1 (pipeline de sessão) e a Fase 2 (motor de perfilamento) em uma experiência coesa para o usuário. Todo o trabalho pesado é feito pelos subcomandos tools.cjs e pelo agente user-profiler — este workflow orquestra a sequência, trata ramificações e fornece a UX.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.

Referências principais:
- @./.claude/framework/references/ui-brand.md (padrões de exibição)
- @./.claude/framework/agents/user-profiler.md (definição do agente de perfilamento)
- @./.claude/framework/references/user-profiling.md (documento de referência de perfilamento)
</required_reading>

<process>

## 1. Inicializar

Analise flags do $ARGUMENTS:
- Detecte a flag `--questionnaire` (pular análise de sessão, apenas questionário)
- Detecte a flag `--refresh` (reconstruir perfil mesmo quando já existe)

Verifique se já existe um perfil:

```bash
PROFILE_PATH="./.claude/framework/USER-PROFILE.md"
[ -f "$PROFILE_PATH" ] && echo "EXISTS" || echo "NOT_FOUND"
```

**Se o perfil existir E --refresh NÃO estiver definido E --questionnaire NÃO estiver definido:**

Use AskUserQuestion:
- header: "Perfil Existente"
- question: "Você já tem um perfil. O que gostaria de fazer?"
- options:
  - "Visualizar" -- Exibe o cartão de resumo do perfil existente e encerra
  - "Atualizar" -- Continua com o comportamento --refresh
  - "Cancelar" -- Encerra o workflow

Se "Visualizar": Leia USER-PROFILE.md, exiba seu conteúdo formatado como cartão de resumo e encerre.
Se "Atualizar": Defina o comportamento --refresh e continue.
Se "Cancelar": Exiba "Nenhuma mudança realizada." e encerre.

**Se o perfil existir E --refresh ESTIVER definido:**

Faça backup do perfil existente:
```bash
cp "./.claude/framework/USER-PROFILE.md" "./.claude/framework/USER-PROFILE.backup.md"
```

Exiba: "Re-analisando suas sessões para atualizar seu perfil."
Continue para o passo 2.

**Se nenhum perfil existir:** Continue para o passo 2.

---

## 2. Gate de Consentimento (ACTV-06)

**Pule se** a flag `--questionnaire` estiver definida (nenhum arquivo JSONL é lido — pule diretamente para o passo 4b).

Exiba a tela de consentimento:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework > PERFIL DO SEU ESTILO DE CODIFICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O Claude começa cada conversa de forma genérica. Um perfil ensina ao Claude
como VOCÊ realmente trabalha — não como você acha que trabalha.

## O Que Será Analisado

Suas sessões recentes do Claude Code, buscando padrões nestas
8 dimensões comportamentais:

| Dimensão                | O Que Mede                                          |
|-------------------------|-----------------------------------------------------|
| Estilo de Comunicação   | Como você formula pedidos (direto vs. detalhado)    |
| Velocidade de Decisão   | Como você escolhe entre opções                      |
| Profundidade de Explicação | Quanta explicação você quer com o código          |
| Abordagem de Debug      | Como você trata erros e bugs                        |
| Filosofia de UX         | Quanto você se preocupa com design vs. função       |
| Filosofia de Fornecedores | Como você avalia bibliotecas e ferramentas         |
| Gatilhos de Frustração  | O que faz você corrigir o Claude                    |
| Estilo de Aprendizado   | Como você prefere aprender coisas novas             |

## Tratamento de Dados

✓ Lê arquivos de sessão localmente (somente leitura, nada modificado)
✓ Analisa padrões de mensagem (não o significado do conteúdo)
✓ Armazena perfil em ./.claude/framework/USER-PROFILE.md
✗ Nada é enviado a serviços externos
✗ Conteúdo sensível (chaves de API, senhas) é automaticamente excluído
```

**Se caminho --refresh:**
Mostre consentimento abreviado:

```
Re-analisando suas sessões para atualizar seu perfil.
Seu perfil existente foi salvo em USER-PROFILE.backup.md.
```

Use AskUserQuestion:
- header: "Atualizar"
- question: "Continuar com a atualização do perfil?"
- options:
  - "Continuar" -- Prosseguir para o passo 3
  - "Cancelar" -- Encerrar o workflow

**Se caminho padrão (sem --refresh):**

Use AskUserQuestion:
- header: "Pronto?"
- question: "Pronto para analisar suas sessões?"
- options:
  - "Vamos lá" -- Prosseguir para o passo 3 (análise de sessão)
  - "Usar questionário" -- Pular para o passo 4b (caminho do questionário)
  - "Agora não" -- Exibir "Sem problemas. Execute /perfil-usuario quando estiver pronto." e encerrar

---

## 3. Varredura de Sessões

Exiba: "◆ Varrendo sessões..."

Execute a varredura de sessões:
```bash
SCAN_RESULT=$(node ./.claude/framework/bin/tools.cjs scan-sessions --json 2>/dev/null)
```

Analise a saída JSON para obter a contagem de sessões e projetos.

Exiba: "✓ Encontradas N sessões em M projetos"

**Determine a suficiência de dados:**
- Conte o total de mensagens disponíveis a partir do resultado da varredura
- Se 0 sessões encontradas: Exiba "Nenhuma sessão encontrada. Usando questionário." e pule para o passo 4b
- Se sessões encontradas: Continue para o passo 4a

---

## 4a. Caminho de Análise de Sessão

Exiba: "◆ Amostrando mensagens..."

Execute a amostragem do perfil:
```bash
SAMPLE_RESULT=$(node ./.claude/framework/bin/tools.cjs profile-sample --json 2>/dev/null)
```

Analise a saída JSON para obter o caminho do diretório temporário e a contagem de mensagens.

Exiba: "✓ N mensagens amostradas de M projetos"

Exiba: "◆ Analisando padrões..."

**Spawne o agente user-profiler usando a ferramenta Task:**

Use a ferramenta Task para spawnar o agente `user-profiler`. Forneça a ele:
- O caminho do arquivo JSONL amostrado da saída de profile-sample
- O documento de referência de perfilamento em `./.claude/framework/references/user-profiling.md`

O prompt do agente deve seguir esta estrutura:
```
Read the profiling reference document and the sampled session messages, then analyze the developer's behavioral patterns across all 8 dimensions.

Reference: @./.claude/framework/references/user-profiling.md
Session data: @{temp_dir}/profile-sample.jsonl

Analyze these messages and return your analysis in the <analysis> JSON format specified in the reference document.
```

**Analise a saída do agente:**
- Extraia o bloco JSON `<analysis>` da resposta do agente
- Salve o JSON de análise em um arquivo temporário (no mesmo diretório temporário criado por profile-sample)

```bash
ANALYSIS_PATH="{temp_dir}/analysis.json"
```

Escreva o JSON de análise em `$ANALYSIS_PATH`.

Exiba: "✓ Análise completa (N dimensões pontuadas)"

**Verifique dados insuficientes:**
- Leia o JSON de análise e verifique a contagem total de mensagens
- Se < 50 mensagens foram analisadas: Note que um suplemento de questionário pode melhorar a precisão. Exiba: "Nota: Dados de sessão limitados (N mensagens). Os resultados podem ter menor confiança."

Continue para o passo 5.

---

## 4b. Caminho do Questionário

Exiba: "Usando questionário para construir seu perfil."

**Obtenha as perguntas:**
```bash
QUESTIONS=$(node ./.claude/framework/bin/tools.cjs profile-questionnaire --json 2>/dev/null)
```

Analise o JSON de perguntas. Ele contém 8 perguntas, uma por dimensão.

**Apresente cada pergunta ao usuário via AskUserQuestion:**

Para cada pergunta no array:
- header: O nome da dimensão (ex.: "Estilo de Comunicação")
- question: O texto da pergunta
- options: As opções de resposta da definição da pergunta

Colete todas as respostas em um objeto JSON mapeando chaves de dimensão para valores de resposta selecionados.

**Salve as respostas em arquivo temporário:**
```bash
ANSWERS_PATH=$(mktemp /tmp/profile-answers-XXXXXX.json)
```

Escreva o JSON de respostas em `$ANSWERS_PATH`.

**Converta respostas em análise:**
```bash
ANALYSIS_RESULT=$(node ./.claude/framework/bin/tools.cjs profile-questionnaire --answers "$ANSWERS_PATH" --json 2>/dev/null)
```

Analise o JSON de análise do resultado.

Salve o JSON de análise em arquivo temporário:
```bash
ANALYSIS_PATH=$(mktemp /tmp/profile-analysis-XXXXXX.json)
```

Escreva o JSON de análise em `$ANALYSIS_PATH`.

Continue para o passo 5 (pule a resolução de divergências, pois o questionário trata a ambiguidade internamente).

---

## 5. Resolução de Divergências

**Pule se** for o caminho apenas de questionário (divergências já tratadas internamente).

Leia o JSON de análise de `$ANALYSIS_PATH`.

Verifique cada dimensão com `cross_project_consistent: false`.

**Para cada divergência detectada:**

Use AskUserQuestion:
- header: O nome da dimensão (ex.: "Estilo de Comunicação")
- question: "Suas sessões mostram padrões diferentes:" seguido do contexto da divergência (ex.: "Projetos CLI/backend -> direto-conciso, Projetos Frontend/UI -> detalhado-estruturado")
- options:
  - Opção A de avaliação (ex.: "direto-conciso")
  - Opção B de avaliação (ex.: "detalhado-estruturado")
  - "Dependente de contexto (manter ambos)"

**Se o usuário escolher uma avaliação específica:** Atualize o campo `rating` da dimensão no JSON de análise para o valor selecionado.

**Se o usuário escolher "Dependente de contexto":** Mantenha a avaliação dominante no campo `rating`. Adicione um `context_note` ao resumo da dimensão descrevendo a divergência (ex.: "Dependente de contexto: direto em projetos CLI, detalhado em projetos frontend").

Escreva o JSON de análise atualizado de volta em `$ANALYSIS_PATH`.

---

## 6. Escrita do Perfil

Exiba: "◆ Escrevendo perfil..."

```bash
node ./.claude/framework/bin/tools.cjs write-profile --input "$ANALYSIS_PATH" --json 2>/dev/null
```

Exiba: "✓ Perfil escrito em ./.claude/framework/USER-PROFILE.md"

---

## 7. Exibição dos Resultados

Leia o JSON de análise de `$ANALYSIS_PATH` para construir a exibição.

**Mostre a tabela de boletim:**

```
## Seu Perfil

| Dimensão                   | Avaliação             | Confiança |
|----------------------------|-----------------------|-----------|
| Estilo de Comunicação      | detalhado-estruturado | ALTA      |
| Velocidade de Decisão      | deliberado-informado  | MÉDIA     |
| Profundidade de Explicação | conciso               | ALTA      |
| Abordagem de Debug         | hipótese-orientada    | MÉDIA     |
| Filosofia de UX            | pragmático            | BAIXA     |
| Filosofia de Fornecedores  | avaliador-completo    | ALTA      |
| Gatilhos de Frustração     | escopo-excessivo      | MÉDIA     |
| Estilo de Aprendizado      | autodidata            | ALTA      |
```

(Preencha com os valores reais do JSON de análise.)

**Mostre os destaques:**

Escolha 3-4 dimensões com maior confiança e mais sinais de evidência. Formate como:

```
## Destaques

- **Comunicação (ALTA):** Você consistentemente fornece contexto estruturado com
  cabeçalhos e descrições de problema antes de fazer pedidos
- **Escolhas de Fornecedores (ALTA):** Você pesquisa alternativas completamente —
  comparando docs, atividade no GitHub e tamanhos de bundle antes de decidir
- **Frustrações (MÉDIA):** Você corrige o Claude mais frequentemente por fazer coisas
  que você não pediu — escopo excessivo é seu principal gatilho
```

Construa os destaques a partir do array `evidence` e dos campos `summary` no JSON de análise. Use as citações de evidência mais convincentes. Formate cada um como "Você tende a..." ou "Você consistentemente..." com atribuição de evidência.

**Ofereça visualização completa do perfil:**

Use AskUserQuestion:
- header: "Perfil"
- question: "Quer ver o perfil completo?"
- options:
  - "Sim" -- Leia e exiba o conteúdo completo de USER-PROFILE.md, depois continue para o passo 8
  - "Continuar para artefatos" -- Prossiga diretamente para o passo 8

---

## 8. Seleção de Artefatos (ACTV-05)

Use AskUserQuestion com multiSelect:
- header: "Artefatos"
- question: "Quais artefatos devo gerar?"
- options (TODOS pré-selecionados por padrão):
  - "Arquivo de comando /definir-perfil" -- "Carregue suas preferências em qualquer sessão"
  - "Seção de perfil no CLAUDE.md" -- "Adicionar perfil ao CLAUDE.md deste projeto"
  - "CLAUDE.md global" -- "Adicionar perfil ao ./.claude/CLAUDE.md para todos os projetos"

**Se nenhum artefato selecionado:** Exiba "Nenhum artefato gerado. Seu perfil está salvo em ./.claude/framework/USER-PROFILE.md" e pule para o passo 10.

---

## 9. Geração de Artefatos

Gere os artefatos selecionados sequencialmente (I/O de arquivo é rápido, sem benefício de agentes paralelos):

**Para /definir-perfil (se selecionado):**

```bash
node ./.claude/framework/bin/tools.cjs generate-dev-preferences --analysis "$ANALYSIS_PATH" --json 2>/dev/null
```

Exiba: "✓ Gerado /definir-perfil em ./.claude/commands/definir-perfil.md"

**Para seção de perfil no CLAUDE.md (se selecionado):**

```bash
node ./.claude/framework/bin/tools.cjs generate-claude-profile --analysis "$ANALYSIS_PATH" --json 2>/dev/null
```

Exiba: "✓ Seção de perfil adicionada ao CLAUDE.md"

**Para CLAUDE.md global (se selecionado):**

```bash
node ./.claude/framework/bin/tools.cjs generate-claude-profile --analysis "$ANALYSIS_PATH" --global --json 2>/dev/null
```

Exiba: "✓ Seção de perfil adicionada ao ./.claude/CLAUDE.md"

**Tratamento de erros:** Se qualquer chamada tools.cjs falhar, exiba a mensagem de erro e use AskUserQuestion para oferecer "Tentar novamente" ou "Pular este artefato". Ao tentar novamente, execute o comando novamente. Ao pular, continue para o próximo artefato.

---

## 10. Resumo e Diff de Atualização

**Se caminho --refresh:**

Leia o backup antigo e a nova análise para comparar avaliações/confiança das dimensões.

Leia o perfil salvo em backup:
```bash
BACKUP_PATH="./.claude/framework/USER-PROFILE.backup.md"
```

Compare a avaliação e confiança de cada dimensão entre o antigo e o novo. Exiba uma tabela de diff mostrando apenas as dimensões que mudaram:

```
## Mudanças

| Dimensão        | Antes                       | Depois                       |
|-----------------|-----------------------------|-----------------------------|
| Comunicação     | direto-conciso (BAIXA)      | detalhado-estruturado (ALTA) |
| Debug           | corrija-primeiro (MÉDIA)    | hipótese-orientado (MÉDIA)   |
```

Se nada mudou: Exiba "Nenhuma mudança detectada — seu perfil já está atualizado."

**Exiba o resumo final:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework > PERFIL CONCLUÍDO ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seu perfil:    ./.claude/framework/USER-PROFILE.md
```

Em seguida, liste os caminhos de cada artefato gerado:
```
Artefatos:
  ✓ /definir-perfil      ./.claude/commands/definir-perfil.md
  ✓ Seção no CLAUDE.md        ./CLAUDE.md
  ✓ CLAUDE.md global          ./.claude/CLAUDE.md
```

(Mostre apenas os artefatos que foram realmente gerados.)

**Limpe os arquivos temporários:**

Remova o diretório temporário criado por profile-sample (contém JSONL de amostra e JSON de análise):
```bash
rm -rf "$TEMP_DIR"
```

Também remova quaisquer arquivos temporários avulsos criados para respostas do questionário:
```bash
rm -f "$ANSWERS_PATH" 2>/dev/null
rm -f "$ANALYSIS_PATH" 2>/dev/null
```

(Limpe apenas os caminhos temporários que foram realmente criados durante esta execução do workflow.)

</process>

<success_criteria>
- [ ] Inicialização detecta perfil existente e trata todas as três respostas (visualizar/atualizar/cancelar)
- [ ] Gate de consentimento exibido para o caminho de análise de sessão, pulado para o caminho de questionário
- [ ] Varredura de sessões descobre sessões e reporta estatísticas
- [ ] Caminho de análise de sessão: amostra mensagens, spawna agente de perfilamento, extrai JSON de análise
- [ ] Caminho de questionário: apresenta 8 perguntas, coleta respostas, converte em JSON de análise
- [ ] Resolução de divergências apresenta divergências dependentes de contexto com opções de resolução do usuário
- [ ] Perfil escrito em USER-PROFILE.md via subcomando write-profile
- [ ] Exibição dos resultados mostra tabela de boletim e destaques com evidências
- [ ] Seleção de artefatos usa multiSelect com todas as opções pré-selecionadas
- [ ] Artefatos gerados sequencialmente via subcomandos tools.cjs
- [ ] Diff de atualização mostra dimensões alteradas quando --refresh foi usado
- [ ] Arquivos temporários limpos ao concluir
</success_criteria>
