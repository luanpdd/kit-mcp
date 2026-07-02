# Perfilamento de Usuário: Referência de Heurísticas de Detecção

Este documento de referência define heurísticas de detecção para perfilamento comportamental em 8 dimensões. O agente user-profiler aplica estas regras ao analisar mensagens de sessão extraídas. Não invente dimensões ou regras de pontuação além do que está definido aqui.

## Como Usar Este Documento

1. O agente user-profiler lê este documento antes de analisar quaisquer mensagens
2. Para cada dimensão, o agente verifica padrões de sinal definidos abaixo nas mensagens
3. O agente aplica as heurísticas de detecção para classificar o padrão do desenvolvedor
4. A confiança é pontuada usando os thresholds definidos por dimensão
5. As citações de evidência são curadas usando as regras na seção de Curadoria de Evidências
6. A saída deve conformar ao esquema JSON na seção de Esquema de Saída

---

## Dimensões

### 1. Estilo de Comunicação

`dimension_id: communication_style`

**O que estamos medindo:** Como o desenvolvedor formula solicitações, instruções e feedback — o padrão estrutural de suas mensagens para o Claude.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `terse-direct` | Mensagens curtas, imperativas com contexto mínimo. Vai direto ao ponto imediatamente. |
| `conversational` | Mensagens de comprimento médio misturando instruções com perguntas e pensamento em voz alta. Tom natural, informal. |
| `detailed-structured` | Mensagens longas com estrutura explícita — cabeçalhos, listas numeradas, declarações de problema, pré-análise. |
| `mixed` | Nenhum padrão dominante; o estilo muda com base no tipo de tarefa ou contexto do projeto. |

**Padrões de sinal:**

1. **Distribuição do comprimento das mensagens** — Contagem média de palavras nas mensagens. Terse < 50 palavras, conversacional 50-200 palavras, detalhado > 200 palavras.
2. **Proporção imperativo-para-interrogativo** — Proporção de comandos ("corrija isso", "adicione X") para perguntas ("o que você acha?", "deveríamos?"). Alta proporção imperativa sugere terse-direct.
3. **Formatação estrutural** — Presença de cabeçalhos markdown, listas numeradas, blocos de código ou marcadores nas mensagens. Formatação frequente sugere detailed-structured.
4. **Preâmbulos de contexto** — Se o desenvolvedor fornece contexto antes de fazer uma solicitação. Preâmbulos sugerem conversacional ou detailed-structured.
5. **Completude das frases** — Se as mensagens usam frases completas ou fragmentos/abreviações. Fragmentos sugerem terse-direct.
6. **Padrão de acompanhamento** — Se o desenvolvedor fornece contexto adicional em mensagens subsequentes (solicitações de múltiplas mensagens sugerem conversacional).

**Heurísticas de detecção:**

1. Se comprimento médio da mensagem < 50 palavras E predominantemente modo imperativo E formatação mínima → `terse-direct`
2. Se comprimento médio 50-200 palavras E mistura de imperativo e interrogativo E formatação ocasional → `conversational`
3. Se comprimento médio > 200 palavras E formatação estrutural frequente E preâmbulos de contexto presentes → `detailed-structured`
4. Se variância do comprimento é alta (desvio padrão > 60% da média) E nenhum padrão único domina (< 60% das mensagens combinam com um estilo) → `mixed`
5. Se padrão varia sistematicamente por tipo de projeto (ex: terse em projetos CLI, detailed em frontend) → `mixed` com nota dependente de contexto

**Pontuação de confiança:**

- **HIGH:** 10+ mensagens mostrando padrão consistente (> 70% de combinação), mesmo padrão observado em 2+ projetos
- **MEDIUM:** 5-9 mensagens mostrando padrão, OU padrão consistente em apenas 1 projeto
- **LOW:** < 5 mensagens com sinais relevantes, OU sinais mistos (padrões contraditórios observados em contextos similares)
- **UNSCORED:** 0 mensagens com sinais relevantes para esta dimensão

**Citações de exemplo:**

- **terse-direct:** "corrija o bug de auth" / "adicione paginação ao endpoint de lista" / "este teste está falhando, faça passar"
- **conversational:** "Estou pensando que provavelmente deveríamos tratar o caso de erro aqui. O que você acha de retornar 422 em vez de 500? O cliente precisa saber que foi um problema de validação."
- **detailed-structured:** "## Contexto\nO fluxo de auth atualmente usa cookies de sessão mas precisamos migrar para JWT.\n\n## Requisitos\n1. Tokens de acesso (expiração 15min)\n2. Tokens de refresh (7 dias)\n3. Cookies httpOnly\n\n## O que tentei\nAnalisei jose e jsonwebtoken..."

**Padrões dependentes de contexto:**

Quando o estilo de comunicação varia sistematicamente por projeto ou tipo de tarefa, reporte o split em vez de forçar um único rating. Exemplo: "dependente de contexto: terse-direct para correções de bugs e ferramental CLI, detailed-structured para arquitetura e trabalho frontend." A orquestração da Fase 3 resolve splits dependentes de contexto apresentando o split ao desenvolvedor.

---

### 2. Velocidade de Decisão

`dimension_id: decision_speed`

**O que estamos medindo:** Quão rapidamente o desenvolvedor faz escolhas quando o Claude apresenta opções, alternativas ou trade-offs.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `fast-intuitive` | Decide imediatamente com base em experiência ou intuição. Deliberação mínima. |
| `deliberate-informed` | Solicita comparação ou resumo antes de decidir. Quer entender os trade-offs. |
| `research-first` | Adia decisão para pesquisar independentemente. Pode sair e voltar com descobertas. |
| `delegator` | Delega para a recomendação do Claude. Confia na sugestão. |

**Padrões de sinal:**

1. **Latência de resposta a opções** — Quantas mensagens entre o Claude apresentar opções e o desenvolvedor escolher. Imediato (mesma mensagem ou próxima) sugere fast-intuitive.
2. **Solicitações de comparação** — Presença de "compare estes", "quais são os trade-offs?", "prós e contras?" sugere deliberate-informed.
3. **Indicadores de pesquisa externa** — Mensagens como "pesquisei X e...", "de acordo com os docs...", "li que..." sugerem research-first.
4. **Linguagem de delegação** — "escolha um", "o que você recomenda", "você decide", "vá com a melhor opção" sugere delegator.
5. **Frequência de reversão de decisão** — Com que frequência o desenvolvedor muda uma decisão após tomá-la. Reversões frequentes podem indicar fast-intuitive com baixa confiança.

**Heurísticas de detecção:**

1. Se desenvolvedor seleciona opções dentro de 1-2 mensagens da apresentação E usa linguagem decisiva ("use X", "vá com A") E raramente pede comparações → `fast-intuitive`
2. Se desenvolvedor solicita análise de trade-offs ou tabelas de comparação E decide após receber comparação E faz perguntas de esclarecimento → `deliberate-informed`
3. Se desenvolvedor adia decisões com "deixa eu pesquisar isso" E retorna com informação externa E cita documentação ou artigos → `research-first`
4. Se desenvolvedor usa linguagem de delegação (> 3 instâncias) E raramente substitui escolhas do Claude E diz "parece bom" ou "você decide" → `delegator`
5. Se nenhum padrão claro OU evidência está dividida entre múltiplos estilos → classificar como o estilo dominante com nota dependente de contexto

**Pontuação de confiança:**

- **HIGH:** 10+ pontos de decisão observados mostrando padrão consistente, mesmo padrão em 2+ projetos
- **MEDIUM:** 5-9 pontos de decisão, OU consistente em apenas 1 projeto
- **LOW:** < 5 pontos de decisão observados, OU estilos de tomada de decisão mistos
- **UNSCORED:** 0 mensagens contendo sinais relevantes para decisão

**Citações de exemplo:**

- **fast-intuitive:** "Use Tailwind. Próxima pergunta." / "Opção B, vamos em frente"
- **deliberate-informed:** "Você pode comparar Prisma vs Drizzle para este caso de uso? Quero entender a história de migração e as diferenças de segurança de tipo antes de escolher."
- **research-first:** "Espere na escolha de DB — quero ler os docs do Drizzle e verificar as issues do GitHub primeiro. Voltarei com uma decisão."
- **delegator:** "Você sabe mais sobre isso do que eu. O que você recomendar, vá com isso."

**Padrões dependentes de contexto:**

A velocidade de decisão frequentemente varia por stakes. Um desenvolvedor pode ser fast-intuitive para escolhas de estilo mas research-first para banco de dados ou decisões de auth. Quando este padrão é claro, reporte o split: "dependente de contexto: fast-intuitive para baixo-stakes (estilo, nomenclatura), deliberate-informed para alto-stakes (arquitetura, segurança)."

---

### 3. Profundidade de Explicação

`dimension_id: explanation_depth`

**O que estamos medindo:** Quanta explicação o desenvolvedor quer junto com o código — sua preferência por entendimento vs. velocidade.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `code-only` | Quer código funcionando com explicação mínima ou nenhuma. Lê e entende código diretamente. |
| `concise` | Quer breve explicação da abordagem com o código. Decisões chave anotadas, não exaustivo. |
| `detailed` | Quer percurso completo da abordagem, raciocínio e código. Aprecia estrutura. |
| `educational` | Quer explicação conceitual profunda. Trata interações como oportunidades de aprendizado. |

**Padrões de sinal:**

1. **Solicitações explícitas de profundidade** — "apenas mostre o código", "explique por que", "me ensine sobre X", "pule a explicação"
2. **Reação a explicações** — O desenvolvedor pula as explicações? Pede mais detalhes? Diz "demais"?
3. **Profundidade de perguntas de acompanhamento** — Acompanhamentos superficiais ("funciona?") vs. conceituais ("por que este padrão em vez de X?")
4. **Sinais de compreensão de código** — O desenvolvedor referencia detalhes de implementação em suas mensagens? Isso sugere que lê e entende código diretamente.
5. **Sinais de "já sei isso"** — Mensagens como "estou familiarizado com X", "pule o básico", "sei como hooks funcionam" indicam menor preferência de explicação.

**Heurísticas de detecção:**

1. Se desenvolvedor diz "apenas o código" ou "pule a explicação" E raramente faz perguntas conceituais de acompanhamento E referencia detalhes de código diretamente → `code-only`
2. Se desenvolvedor aceita explicações breves sem pedir mais E faz acompanhamentos focados sobre decisões específicas → `concise`
3. Se desenvolvedor faz perguntas "por quê" E solicita percursos E aprecia explicações estruturadas → `detailed`
4. Se desenvolvedor faz perguntas conceituais além da tarefa imediata E usa linguagem de aprendizado ("quero entender", "me ensine") → `educational`

**Pontuação de confiança:**

- **HIGH:** 10+ mensagens mostrando preferência consistente, mesma preferência em 2+ projetos
- **MEDIUM:** 5-9 mensagens, OU consistente em apenas 1 projeto
- **LOW:** < 5 mensagens relevantes, OU preferências mudam entre interações
- **UNSCORED:** 0 mensagens com sinais relevantes

**Citações de exemplo:**

- **code-only:** "Apenas me dê a implementação. Vou ler." / "Pule a explicação, mostre o código."
- **concise:** "Resumo rápido da abordagem, depois o código por favor." / "Por que você usou um Map aqui em vez de um objeto?"
- **detailed:** "Me guie pelo passo a passo. Quero entender o fluxo de auth antes de implementarmos."
- **educational:** "Você pode explicar como a rotação de token de refresh JWT funciona conceitualmente? Quero entender o modelo de segurança, não apenas implementar."

---

### 4. Abordagem de Debugging

`dimension_id: debugging_approach`

**O que estamos medindo:** Como o desenvolvedor aborda problemas, erros e comportamento inesperado ao trabalhar com o Claude.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `fix-first` | Cola erro, quer que seja corrigido. Mínimo interesse em diagnóstico. Orientado a resultados. |
| `diagnostic` | Compartilha erro com contexto, quer entender a causa antes de corrigir. |
| `hypothesis-driven` | Investiga independentemente primeiro, traz teorias específicas ao Claude para validação. |
| `collaborative` | Quer trabalhar o problema passo a passo com o Claude como parceiro. |

**Padrões de sinal:**

1. **Estilo de apresentação de erros** — Cola apenas o erro (fix-first) vs. erro + "acho que pode ser..." (hypothesis-driven) vs. "você pode me ajudar a entender por que..." (diagnostic)
2. **Indicadores de pré-investigação** — O desenvolvedor compartilha o que já tentou? Menciona leitura de logs, verificação de estado ou isolamento do problema?
3. **Interesse na causa raiz** — Após uma correção, o desenvolvedor pergunta "por que isso aconteceu?" ou apenas segue em frente?
4. **Linguagem passo a passo** — "Vamos verificar X primeiro", "o que devemos olhar a seguir?", "me guie pelo debugging"
5. **Padrão de aceitação de correção** — O desenvolvedor aplica correções imediatamente ou as questiona primeiro?

**Heurísticas de detecção:**

1. Se desenvolvedor cola erros sem contexto E aceita correções sem perguntas sobre causa raiz E segue em frente imediatamente → `fix-first`
2. Se desenvolvedor fornece contexto do erro E pergunta "por que isso está acontecendo?" E quer explicação com a correção → `diagnostic`
3. Se desenvolvedor compartilha sua própria análise E propõe teorias ("acho que o problema é X porque...") E pede ao Claude para confirmar ou refutar → `hypothesis-driven`
4. Se desenvolvedor usa linguagem colaborativa ("vamos", "o que deveríamos verificar?") E prefere diagnóstico incremental E percorre problemas juntos → `collaborative`

**Pontuação de confiança:**

- **HIGH:** 10+ interações de debugging mostrando abordagem consistente, mesma abordagem em 2+ projetos
- **MEDIUM:** 5-9 interações de debugging, OU consistente em apenas 1 projeto
- **LOW:** < 5 interações de debugging, OU abordagem varia significativamente
- **UNSCORED:** 0 mensagens com sinais relevantes para debugging

**Citações de exemplo:**

- **fix-first:** "Estou recebendo este erro: TypeError: Cannot read properties of undefined. Corrija."
- **diagnostic:** "A API retorna 500 quando envio um POST para /users. Aqui está o corpo da requisição e o log do servidor. O que está causando isso?"
- **hypothesis-driven:** "Acho que a condição de corrida está na limpeza do useEffect. Verifiquei e a assinatura não está sendo cancelada no unmount. Você pode confirmar?"
- **collaborative:** "Vamos debugar isso juntos. O teste passa localmente mas falha no CI. O que devemos verificar primeiro?"

---

### 5. Filosofia de UX

`dimension_id: ux_philosophy`

**O que estamos medindo:** Como o desenvolvedor prioriza experiência do usuário, design e qualidade visual em relação à funcionalidade.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `function-first` | Faça funcionar, polir depois. Preocupação mínima com UX durante a implementação. |
| `pragmatic` | Usabilidade básica desde o início. Nada feio ou quebrado, mas sem obsessão de design. |
| `design-conscious` | Design e UX são tratados como tão importantes quanto a funcionalidade. Atenção a detalhes visuais. |
| `backend-focused` | Constrói principalmente backend/CLI. Exposição ou interesse mínimo em frontend. |

**Padrões de sinal:**

1. **Solicitações relacionadas a design** — Menções de estilo, layout, responsividade, animações, esquemas de cores, espaçamento
2. **Timing de polimento** — O desenvolvedor pede polimento visual durante a implementação ou adia?
3. **Especificidade do feedback de UI** — Vago ("deixe mais bonito") vs. específico ("aumente o padding para 16px, mude o peso da fonte para 600")
4. **Distribuição frontend vs. backend** — Proporção de solicitações focadas em frontend vs. backend
5. **Menções de acessibilidade** — Referências a a11y, leitores de tela, navegação por teclado, labels ARIA

**Heurísticas de detecção:**

1. Se desenvolvedor raramente menciona UI/UX E foca em lógica, APIs, dados E adia estilo ("vamos deixar bonito depois") → `function-first`
2. Se desenvolvedor inclui requisitos básicos de UX E menciona usabilidade mas não pixel-perfeição E equilibra forma com função → `pragmatic`
3. Se desenvolvedor fornece requisitos de design específicos E menciona polimento, animações, espaçamento E trata bugs de UI tão seriamente quanto bugs de lógica → `design-conscious`
4. Se desenvolvedor trabalha principalmente em ferramentas CLI, APIs ou sistemas backend E raramente ou nunca trabalha em frontend E mensagens focam em dados, desempenho, infraestrutura → `backend-focused`

**Pontuação de confiança:**

- **HIGH:** 10+ mensagens com sinais relevantes de UX, mesmo padrão em 2+ projetos
- **MEDIUM:** 5-9 mensagens, OU consistente em apenas 1 projeto
- **LOW:** < 5 mensagens relevantes, OU filosofia varia por tipo de projeto
- **UNSCORED:** 0 mensagens com sinais relevantes de UX

**Citações de exemplo:**

- **function-first:** "Apenas faça o formulário funcionar. Vamos estilizar depois." / "Não me importo com a aparência, preciso dos dados fluindo."
- **pragmatic:** "Certifique-se de que o estado de carregamento está visível e as mensagens de erro são claras. Estilo padrão está bom."
- **design-conscious:** "O botão precisa de mais espaço — adicione 12px de padding vertical e faça a transição do hover 200ms. Verifique também a taxa de contraste."
- **backend-focused:** "Estou construindo uma ferramenta CLI. Sem UI necessária." / "Adicione o endpoint REST, vou lidar com o frontend separadamente."

---

### 6. Filosofia de Vendor

`dimension_id: vendor_philosophy`

**O que estamos medindo:** Como o desenvolvedor aborda a escolha e avaliação de bibliotecas, frameworks e serviços externos.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `pragmatic-fast` | Usa o que funciona, o que o Claude sugere, ou o que é mais rápido. Avaliação mínima. |
| `conservative` | Prefere opções bem conhecidas, testadas, amplamente adotadas. Avesso a risco. |
| `thorough-evaluator` | Pesquisa alternativas, lê docs, compara recursos e trade-offs antes de comprometer. |
| `opinionated` | Tem preferências fortes e pré-existentes para ferramentas específicas. Sabe o que gosta. |

**Padrões de sinal:**

1. **Linguagem de seleção de biblioteca** — "use qualquer coisa", "X é o padrão?", "quero comparar A vs B", "estamos usando X, ponto final"
2. **Profundidade de avaliação** — O desenvolvedor aceita a primeira sugestão ou pede alternativas?
3. **Preferências declaradas** — Menções explícitas de ferramentas preferidas, experiência passada ou filosofia de ferramentas
4. **Padrões de rejeição** — O desenvolvedor rejeita as sugestões do Claude? Com base em quê (popularidade, experiência pessoal, qualidade dos docs)?
5. **Atitude em relação a dependências** — "minimizar dependências", "sem dependências externas", "adicione o que precisarmos" — revela filosofia sobre código externo

**Heurísticas de detecção:**

1. Se desenvolvedor aceita sugestões de biblioteca sem resistência E usa frases como "parece bom" ou "vá com isso" E raramente pergunta sobre alternativas → `pragmatic-fast`
2. Se desenvolvedor pergunta sobre popularidade, manutenção, comunidade E prefere "padrão da indústria" ou "testado em batalha" E evita o novo/experimental → `conservative`
3. Se desenvolvedor solicita comparações E lê docs antes de decidir E pergunta sobre casos extremos, licença, tamanho do bundle → `thorough-evaluator`
4. Se desenvolvedor nomeia bibliotecas específicas sem ser solicitado E substitui as sugestões do Claude E expressa preferências fortes → `opinionated`

**Pontuação de confiança:**

- **HIGH:** 10+ decisões de vendor/biblioteca observadas, mesmo padrão em 2+ projetos
- **MEDIUM:** 5-9 decisões, OU consistente em apenas 1 projeto
- **LOW:** < 5 decisões de vendor observadas, OU padrão varia
- **UNSCORED:** 0 mensagens com sinais de seleção de vendor

**Citações de exemplo:**

- **pragmatic-fast:** "Use qualquer ORM que você recomende. Só preciso que funcione." / "Tudo bem, Tailwind está bom."
- **conservative:** "Prisma é o ORM mais usado para isso? Quero algo com uma comunidade grande." / "Vamos ficar com o que a maioria das equipes usa."
- **thorough-evaluator:** "Antes de escolhermos uma biblioteca de gerenciamento de estado, você pode comparar Zustand vs Jotai vs Redux Toolkit? Quero entender tamanho do bundle, superfície de API e suporte a TypeScript."
- **opinionated:** "Estamos usando Drizzle, não Prisma. Usei os dois e a API similar ao SQL do Drizzle é melhor para queries complexas."

---

### 7. Gatilhos de Frustração

`dimension_id: frustration_triggers`

**O que estamos medindo:** O que causa frustração visível, correção ou sinais emocionais negativos nas mensagens do desenvolvedor para o Claude.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `scope-creep` | Frustrado quando o Claude faz coisas que não foram pedidas. Quer execução limitada. |
| `instruction-adherence` | Frustrado quando o Claude não segue as instruções precisamente. Valoriza exatidão. |
| `verbosity` | Frustrado quando o Claude explica demais ou é muito prolixo. Quer concisão. |
| `regression` | Frustrado quando o Claude quebra código funcionando ao corrigir outra coisa. Valoriza estabilidade. |

**Padrões de sinal:**

1. **Linguagem de correção** — "não pedi isso", "não faça X", "eu disse Y não Z", "por que você mudou isso?"
2. **Padrões de repetição** — Repetir a mesma instrução com ênfase sugere frustração de instruction-adherence
3. **Mudanças de tom emocional** — Mudança de neutro para direto, uso de maiúsculas, pontos de exclamação, palavras explícitas de frustração
4. **Declarações "não"** — "não adicione recursos extras", "não explique tanto", "não mexa naquele arquivo" — o que eles proíbem revela o que os frustra
5. **Recuperação da frustração** — Com que rapidez o desenvolvedor retorna ao tom neutro após um evento de frustração

**Heurísticas de detecção:**

1. Se desenvolvedor corrige o Claude por fazer trabalho não solicitado E usa linguagem como "eu só pedi X", "pare de adicionar coisas", "fique com o que pedi" → `scope-creep`
2. Se desenvolvedor repete instruções E corrige desvios específicos de requisitos declarados E enfatiza precisão ("eu disse especificamente...") → `instruction-adherence`
3. Se desenvolvedor pede ao Claude para ser mais curto E pula explicações E expressa irritação com comprimento ("demais", "apenas a resposta") → `verbosity`
4. Se desenvolvedor expressa frustração com funcionalidade quebrada E verifica regressões E diz "você quebrou X ao corrigir Y" → `regression`

**Pontuação de confiança:**

- **HIGH:** 10+ eventos de frustração mostrando padrão consistente de gatilho, mesmo gatilho em 2+ projetos
- **MEDIUM:** 5-9 eventos de frustração, OU consistente em apenas 1 projeto
- **LOW:** < 5 eventos de frustração observados (nota: contagem baixa de frustração é POSITIVA — significa que o desenvolvedor está geralmente satisfeito, não que os dados são insuficientes)
- **UNSCORED:** 0 mensagens com sinais de frustração (nota: "nenhuma frustração detectada" é um achado válido)

**Citações de exemplo:**

- **scope-creep:** "Pedi para corrigir o bug de login, não refatorar todo o módulo de auth. Reverta tudo exceto a correção do bug."
- **instruction-adherence:** "Eu disse para usar um Map, não um objeto. Fui específico sobre isso. Por favor refaça com um Map."
- **verbosity:** "Explicação excessiva demais. Apenas mostre a alteração de código, mais nada."
- **regression:** "A busca estava funcionando bem antes. Agora após sua 'correção' no filtro, os resultados de busca estão vazios. Não mexa em coisas que não pedi para mudar."

---

### 8. Estilo de Aprendizado

`dimension_id: learning_style`

**O que estamos medindo:** Como o desenvolvedor prefere entender novos conceitos, ferramentas ou padrões que encontra.

**Espectro de rating:**

| Rating | Descrição |
|--------|-----------|
| `self-directed` | Lê código diretamente, descobre as coisas independentemente. Faz perguntas específicas ao Claude. |
| `guided` | Pede ao Claude para explicar partes relevantes. Prefere entendimento guiado. |
| `documentation-first` | Lê docs e tutoriais oficiais antes de mergulhar. Faz referência à documentação. |
| `example-driven` | Quer exemplos funcionando para modificar e aprender. Aprendiz por correspondência de padrões. |

**Padrões de sinal:**

1. **Iniciação de aprendizado** — O desenvolvedor começa lendo código, pedindo explicação, solicitando docs ou pedindo exemplos?
2. **Referência a fontes externas** — Menções de documentação, tutoriais, Stack Overflow, posts de blog sugerem documentation-first
3. **Solicitações de exemplo** — "mostre um exemplo", "você pode me dar uma amostra?", "deixa eu ver como isso fica na prática"
4. **Indicadores de leitura de código** — "olhei a implementação", "vejo que X chama Y", "lendo o código..."
5. **Proporção explicação vs. código** — Proporção de mensagens "explique X" para "mostre X"

**Heurísticas de detecção:**

1. Se desenvolvedor referencia leitura de código diretamente E faz perguntas específicas e direcionadas E demonstra investigação independente → `self-directed`
2. Se desenvolvedor pede ao Claude para explicar conceitos E solicita percursos E prefere entendimento mediado pelo Claude → `guided`
3. Se desenvolvedor cita documentação E pede links de docs E menciona leitura de tutoriais ou guias oficiais → `documentation-first`
4. Se desenvolvedor solicita exemplos E modifica exemplos fornecidos E aprende por correspondência de padrões → `example-driven`

**Pontuação de confiança:**

- **HIGH:** 10+ interações de aprendizado mostrando preferência consistente, mesma preferência em 2+ projetos
- **MEDIUM:** 5-9 interações de aprendizado, OU consistente em apenas 1 projeto
- **LOW:** < 5 interações de aprendizado, OU preferência varia por familiaridade com o tópico
- **UNSCORED:** 0 mensagens com sinais relevantes de aprendizado

**Citações de exemplo:**

- **self-directed:** "Li o código do middleware. O problema é que a verificação do token acontece após o rate limiter. Esses deveriam ser trocados?"
- **guided:** "Você pode me guiar por como o fluxo de auth funciona neste código? Comece pela requisição de login."
- **documentation-first:** "Li os docs do Prisma sobre relações. Você pode me ajudar a aplicar o padrão muitos-para-muitos do guia deles ao nosso schema?"
- **example-driven:** "Mostre um exemplo funcionando de uma rota de API protegida com validação JWT. Vou adaptá-la para nossos endpoints."

---

## Curadoria de Evidências

### Formato de Evidência

Use o formato combinado para cada entrada de evidência:

**Sinal:** [interpretação do padrão — o que a citação demonstra] / **Exemplo:** "[citação aparada, ~100 caracteres]" — project: [nome do projeto]

### Alvos de Evidência

- **3 citações de evidência por dimensão** (24 no total em todas as 8 dimensões)
- Selecione citações que melhor ilustram o padrão classificado
- Prefira citações de projetos diferentes para demonstrar consistência entre projetos
- Quando menos de 3 citações relevantes existirem, inclua o que estiver disponível e anote a contagem de evidências

### Truncamento de Citação

- Apare as citações ao sinal comportamental — a parte que demonstra o padrão
- Almeje aproximadamente 100 caracteres por citação
- Preserve o fragmento significativo, não a mensagem completa
- Se o sinal está no meio de uma mensagem longa, use "..." para indicar truncamento
- Nunca inclua a mensagem completa de 500 caracteres quando 50 capturam o sinal

### Atribuição de Projeto

- Toda citação de evidência deve incluir o nome do projeto
- A atribuição de projeto permite verificação e mostra padrões entre projetos
- Formato: `-- project: [nome]`

### Exclusão de Conteúdo Sensível (Camada 1)

O agente de perfilamento nunca deve selecionar citações contendo qualquer um dos seguintes padrões:

- `sk-` (prefixos de chave de API)
- `Bearer ` (tokens de auth)
- `password` (credenciais)
- `secret` (segredos)
- `token` (quando usado como valor de credencial, não discussão de conceito)
- `api_key` ou `API_KEY` (referências de chave de API)
- Caminhos de arquivo absolutos completos contendo nomes de usuário (ex: `/Users/joao/...`, `/home/joao/...`)

**Quando conteúdo sensível for encontrado e excluído**, reporte como metadados na saída de análise:

```json
{
  "sensitive_excluded": [
    { "type": "api_key_pattern", "count": 2 },
    { "type": "file_path_with_username", "count": 1 }
  ]
}
```

Estes metadados permitem auditoria de defesa em profundidade. A Camada 2 (filtro regex na etapa write-profile) fornece uma segunda passagem, mas o perfilador ainda deve evitar selecionar citações sensíveis.

### Prioridade de Linguagem Natural

Pondere mensagens de linguagem natural mais alto do que:
- Saída de log colada (detectada por timestamps, strings de formato repetidas, `[DEBUG]`, `[INFO]`, `[ERROR]`)
- Dumps de contexto de sessão (mensagens começando com "This session is being continued from a previous conversation")
- Grandes colagens de código (mensagens onde > 80% do conteúdo está dentro de cercas de código)

Estes tipos de mensagem são genuínos mas carregam menos sinal comportamental. Despriorize-os ao selecionar citações de evidência.

---

## Ponderação por Recência

### Diretriz

Sessões recentes (últimos 30 dias) devem ser ponderadas aproximadamente 3x em comparação com sessões mais antigas ao analisar padrões.

### Justificativa

Estilos de desenvolvedor evoluem. Um desenvolvedor que era direto há seis meses pode agora fornecer contexto estruturado detalhado. O comportamento recente é um reflexo mais preciso do estilo de trabalho atual.

### Aplicação

1. Ao contar sinais para pontuação de confiança, sinais recentes contam 3x (ex: 4 sinais recentes = 12 sinais ponderados)
2. Ao selecionar citações de evidência, prefira citações recentes a citações mais antigas quando ambas demonstram o mesmo padrão
3. Quando padrões conflitam entre sessões recentes e mais antigas, o padrão recente tem precedência para o rating, mas anote a evolução: "mudou recentemente de terse-direct para conversacional"
4. A janela de 30 dias é relativa à data de análise, não uma data fixa

### Casos Extremos

- Se TODAS as sessões são mais antigas que 30 dias, não aplique ponderação (todas as sessões são igualmente antigas)
- Se TODAS as sessões são dentro dos últimos 30 dias, não aplique ponderação (todas as sessões são igualmente recentes)
- O peso de 3x é uma diretriz, não um multiplicador rígido — use julgamento quando a contagem ponderada muda um threshold de confiança

---

## Tratamento de Dados Escassos

### Thresholds de Mensagem

| Total de Mensagens Genuínas | Modo | Comportamento |
|-----------------------------|------|---------------|
| > 50 | `full` | Análise completa em todas as 8 dimensões. Questionário opcional (usuário pode escolher suplementar). |
| 20-50 | `hybrid` | Analise as mensagens disponíveis. Pontue cada dimensão com confiança. Suplementar com questionário para dimensões LOW/UNSCORED. |
| < 20 | `insufficient` | Todas as dimensões pontuadas como LOW ou UNSCORED. Recomende questionário como fonte primária do perfil. Nota: "dados de sessão insuficientes para análise comportamental." |

### Tratando Dimensões Insuficientes

Quando uma dimensão específica tem dados insuficientes (mesmo se o total de mensagens excede os thresholds):

- Defina confiança como `UNSCORED`
- Defina resumo como: "Dados insuficientes — nenhum sinal claro detectado para esta dimensão."
- Defina claude_instruction como fallback neutro: "Nenhuma preferência forte detectada. Pergunte ao desenvolvedor quando esta dimensão for relevante."
- Defina evidence_quotes como array vazio `[]`
- Defina evidence_count como `0`

### Suplemento de Questionário

Quando operando no modo `hybrid`, o questionário preenche lacunas para dimensões onde a análise de sessão produziu confiança LOW ou UNSCORED. Os ratings derivados do questionário usam:
- Confiança **MEDIUM** para escolhas fortes e definitivas
- Confiança **LOW** para "varia" ou seleções ambíguas

Se análise de sessão e questionário concordam em uma dimensão, a confiança pode ser elevada (ex: sessão LOW + questionário MEDIUM em acordo = MEDIUM).

---

## Esquema de Saída

O agente de perfilamento deve retornar JSON correspondendo a este esquema exato, envolvido em tags `<analysis>`.

```json
{
  "profile_version": "1.0",
  "analyzed_at": "timestamp ISO-8601",
  "data_source": "session_analysis",
  "projects_analyzed": ["nome-do-projeto-1", "nome-do-projeto-2"],
  "messages_analyzed": 0,
  "message_threshold": "full|hybrid|insufficient",
  "sensitive_excluded": [
    { "type": "string", "count": 0 }
  ],
  "dimensions": {
    "communication_style": {
      "rating": "terse-direct|conversational|detailed-structured|mixed",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [
        {
          "signal": "Interpretação do padrão descrevendo o que a citação demonstra",
          "quote": "Citação aparada, aproximadamente 100 caracteres",
          "project": "nome-do-projeto"
        }
      ],
      "summary": "Descrição de uma a duas frases do padrão observado",
      "claude_instruction": "Diretiva imperativa para o Claude: 'Corresponda ao estilo de comunicação estruturado' não 'Você tende a fornecer contexto estruturado'"
    },
    "decision_speed": {
      "rating": "fast-intuitive|deliberate-informed|research-first|delegator",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "explanation_depth": {
      "rating": "code-only|concise|detailed|educational",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "debugging_approach": {
      "rating": "fix-first|diagnostic|hypothesis-driven|collaborative",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "ux_philosophy": {
      "rating": "function-first|pragmatic|design-conscious|backend-focused",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "vendor_philosophy": {
      "rating": "pragmatic-fast|conservative|thorough-evaluator|opinionated",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "frustration_triggers": {
      "rating": "scope-creep|instruction-adherence|verbosity|regression",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "learning_style": {
      "rating": "self-directed|guided|documentation-first|example-driven",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    }
  }
}
```

### Notas do Esquema

- **`profile_version`**: Sempre `"1.0"` para esta versão do esquema
- **`analyzed_at`**: Timestamp ISO-8601 de quando a análise foi realizada
- **`data_source`**: `"session_analysis"` para perfilamento baseado em sessão, `"questionnaire"` para questionário apenas, `"hybrid"` para combinado
- **`projects_analyzed`**: Lista de nomes de projetos que contribuíram com mensagens
- **`messages_analyzed`**: Número total de mensagens genuínas de usuário processadas
- **`message_threshold`**: Qual modo de threshold foi acionado (`full`, `hybrid`, `insufficient`)
- **`sensitive_excluded`**: Array de tipos de conteúdo sensível excluído com contagens (array vazio se nenhum encontrado)
- **`claude_instruction`**: Deve ser escrito em forma imperativa dirigida ao Claude. Este campo é como o perfil se torna acionável.
  - Bom: "Forneça respostas estruturadas com cabeçalhos e listas numeradas para corresponder ao estilo de comunicação deste desenvolvedor."
  - Ruim: "Você tende a gostar de respostas estruturadas."
  - Bom: "Pergunte antes de fazer alterações além da solicitação declarada — este desenvolvedor valoriza execução limitada."
  - Ruim: "O desenvolvedor fica frustrado quando você faz trabalho extra."

---

## Consistência Entre Projetos

### Avaliação

Para cada dimensão, avalie se o padrão observado é consistente entre os projetos analisados:

- **`cross_project_consistent: true`** — O mesmo rating se aplicaria independentemente de qual projeto é analisado. Evidências de 2+ projetos mostram o mesmo padrão.
- **`cross_project_consistent: false`** — O padrão varia por projeto. Inclua uma nota dependente de contexto no resumo.

### Reportando Splits

Quando `cross_project_consistent` é falso, o resumo deve descrever o split:

- "Dependente de contexto: terse-direct para projetos CLI/backend (tools, api-server), detailed-structured para projetos frontend (dashboard, landing-page)."
- "Dependente de contexto: fast-intuitive para tecnologia familiar (React, Node), research-first para novos domínios (Rust, ML)."

O campo rating deve refletir o padrão **dominante** (mais evidência). O resumo descreve a nuance.

### Resolução na Fase 3

Splits dependentes de contexto são resolvidos durante a orquestração da Fase 3. O orquestrador apresenta o split ao desenvolvedor e pergunta qual padrão representa sua preferência geral. Até ser resolvido, o Claude usa o padrão dominante com consciência da variação dependente de contexto.

---

*Versão do documento de referência: 1.0*
*Dimensões: 8*
*Esquema: profile_version 1.0*
