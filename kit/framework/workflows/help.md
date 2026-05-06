<purpose>
Exibir a referência completa de comandos do framework. Emitir APENAS o conteúdo de referência. NÃO adicionar análise do projeto, status do git, sugestões de próximos passos ou qualquer comentário além da referência.
</purpose>

<reference>
# Referência de Comandos do framework

**framework** cria planos hierárquicos de projeto otimizados para desenvolvimento ágil solo com Claude Code.

## ⭐ Em dúvida? Use `/fazer`

`/fazer "descrição livre"` é o **entrypoint canônico** — analisa sua intenção e roteia automaticamente para o melhor comando. Use sempre que não souber qual `/*` invocar.

| Sua intenção | Comando |
|---|---|
| Trivial (typo, rename, log) | `/rapido` |
| Concreta com commit limpo | `/expresso` |
| Multi-arquivo estruturado | `/discutir-fase` → `/planejar-fase` → `/executar-fase` |
| "Onde parei?" | `/proximo` |
| Investigar bug | `/depurar` |
| Capturar ideia sem agir | `/nota` ou `/adicionar-tarefa` |

## Início Rápido

1. `/novo-projeto` - Inicializar projeto (inclui pesquisa, requisitos, roadmap)
2. `/planejar-fase 1` - Criar plano detalhado para a primeira fase
3. `/executar-fase 1` - Executar a fase

## Mantendo Atualizado

O framework evolui rápido. Atualize periodicamente:

```bash
npx framework-cc@latest
```

## Fluxo Principal

```
/novo-projeto → /planejar-fase → /executar-fase → repetir
```

### Inicialização do Projeto

**`/novo-projeto`**
Inicializar novo projeto através de fluxo unificado.

Um comando te leva da ideia ao pronto-para-planejar:
- Questionamento profundo para entender o que você está construindo
- Pesquisa de domínio opcional (cria 4 agentes pesquisadores em paralelo)
- Definição de requisitos com escopo v1/v2/fora-do-escopo
- Criação de roadmap com breakdown de fases e critérios de sucesso

Cria todos os artefatos de `.planning/`:
- `PROJECT.md` — visão e requisitos
- `config.json` — modo do workflow (interativo/yolo)
- `research/` — pesquisa de domínio (se selecionado)
- `REQUIREMENTS.md` — requisitos com escopo e REQ-IDs
- `ROADMAP.md` — fases mapeadas para requisitos
- `STATE.md` — memória do projeto

Uso: `/novo-projeto`

**`/mapear-codebase`**
Mapear uma base de código existente para projetos brownfield.

- Analisa a base de código com agentes Explore em paralelo
- Cria `.planning/codebase/` com 7 documentos focados
- Cobre stack, arquitetura, estrutura, convenções, testes, integrações, preocupações
- Use antes de `/novo-projeto` em bases de código existentes

Uso: `/mapear-codebase`

### Planejamento de Fase

**`/discutir-fase <número>`**
Ajudar a articular sua visão para uma fase antes do planejamento.

- Captura como você imagina que essa fase vai funcionar
- Cria CONTEXT.md com sua visão, essenciais e limites
- Use quando você tem ideias sobre como algo deve parecer/funcionar
- `--batch` opcional faz 2-5 perguntas relacionadas por vez em vez de uma por uma

Uso: `/discutir-fase 2`
Uso: `/discutir-fase 2 --batch`
Uso: `/discutir-fase 2 --batch=3`

**`/pesquisar-fase <número>`**
Pesquisa abrangente de ecossistema para domínios nichados/complexos.

- Descobre stack padrão, padrões de arquitetura, armadilhas
- Cria RESEARCH.md com conhecimento de "como especialistas constroem isso"
- Use para 3D, jogos, áudio, shaders, ML e outros domínios especializados
- Va além de "qual biblioteca" para conhecimento de ecossistema

Uso: `/pesquisar-fase 3`

**`/listar-hipoteses-fase <número>`**
Ver o que Claude está planejando fazer antes de começar.

- Mostra a abordagem pretendida do Claude para uma fase
- Permite corrigir o curso se o Claude entendeu mal sua visão
- Nenhum arquivo criado — saída apenas conversacional

Uso: `/listar-hipoteses-fase 3`

**`/planejar-fase <número>`**
Criar plano de execução detalhado para uma fase específica.

- Gera `.planning/phases/XX-nome-fase/XX-YY-PLAN.md`
- Divide a fase em tarefas concretas e acionáveis
- Inclui critérios de verificação e medidas de sucesso
- Múltiplos planos por fase suportados (XX-01, XX-02, etc.)

Uso: `/planejar-fase 1`
Resultado: Cria `.planning/phases/01-foundation/01-01-PLAN.md`

**Caminho Express por PRD:** Passe `--prd caminho/para/requisitos.md` para pular o discutir-fase completamente. Seu PRD se torna decisões bloqueadas no CONTEXT.md. Útil quando você já tem critérios de aceitação claros.

### Execução

**`/executar-fase <número-fase>`**
Executar todos os planos em uma fase, ou rodar uma wave específica.

- Agrupa planos por wave (do frontmatter), executa waves sequencialmente
- Planos dentro de cada wave rodam em paralelo via ferramenta Task
- Flag `--wave N` opcional executa apenas a Wave `N` e para a menos que a fase esteja completamente concluída
- Verifica o objetivo da fase após todos os planos concluírem
- Atualiza REQUIREMENTS.md, ROADMAP.md, STATE.md

Uso: `/executar-fase 5`
Uso: `/executar-fase 5 --wave 2`

### Roteador Inteligente

**`/fazer <descrição>`**
Rotear texto livre para o comando do framework correto automaticamente.

- Analisa input em linguagem natural para encontrar o melhor comando do framework correspondente
- Age como despachante — nunca faz o trabalho em si
- Resolve ambiguidade pedindo que você escolha entre as principais correspondências
- Use quando você sabe o que quer mas não sabe qual comando `/*` rodar

Uso: `/fazer corrigir o botão de login`
Uso: `/fazer refatorar o sistema de auth`
Uso: `/fazer quero iniciar um novo milestone`

### Modo Rápido

**`/expresso [--full] [--discuss] [--research]`**
Executar tarefas pequenas e ad-hoc com garantias framework mas pular agentes opcionais.

O modo rápido usa o mesmo sistema com um caminho mais curto:
- Cria planejador + executor (pula pesquisador, verificador de plano, verificador por padrão)
- Tarefas rápidas ficam em `.planning/quick/` separado das fases planejadas
- Atualiza rastreamento STATE.md (não ROADMAP.md)

Flags habilitam etapas de qualidade adicionais:
- `--discuss` — Discussão leve para surfaçar áreas cinzas antes do planejamento
- `--research` — Agente de pesquisa focado investiga abordagens antes do planejamento
- `--full` — Adiciona verificação de plano (máx 2 iterações) e verificação pós-execução

Flags são combináveis: `--discuss --research --full` dá o pipeline de qualidade completo para uma única tarefa.

Uso: `/expresso`
Uso: `/expresso --research --full`
Resultado: Cria `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`

---

**`/rapido [descrição]`**
Executar uma tarefa trivial inline — sem subagentes, sem arquivos de planejamento, sem overhead.

Para tarefas pequenas demais para justificar planejamento: correções de typos, mudanças de config, commits esquecidos, adições simples. Roda no contexto atual, faz a mudança, commita e registra no STATE.md.

- Nenhum PLAN.md ou SUMMARY.md criado
- Nenhum subagente criado (roda inline)
- ≤ 3 edições de arquivo — redireciona para `/expresso` se a tarefa for não trivial
- Commit atômico com mensagem convencional

Uso: `/rapido "corrigir o typo no README"`
Uso: `/rapido "adicionar .env ao gitignore"`

### Gerenciamento do Roadmap

**`/adicionar-fase <descrição>`**
Adicionar nova fase ao final do milestone atual.

- Anexa ao ROADMAP.md
- Usa o próximo número sequencial
- Atualiza estrutura de diretórios de fase

Uso: `/adicionar-fase "Adicionar dashboard admin"`

**`/inserir-fase <após> <descrição>`**
Inserir trabalho urgente como fase decimal entre fases existentes.

- Cria fase intermediária (ex: 7.1 entre 7 e 8)
- Útil para trabalho descoberto que deve acontecer no meio do milestone
- Mantém ordenação de fases

Uso: `/inserir-fase 7 "Corrigir bug crítico de auth"`
Resultado: Cria Fase 7.1

**`/remover-fase <número>`**
Remover uma fase futura e renumerar fases subsequentes.

- Deleta diretório de fase e todas as referências
- Renumera todas as fases subsequentes para fechar a lacuna
- Funciona apenas em fases futuras (não iniciadas)
- Commit git preserva registro histórico

Uso: `/remover-fase 17`
Resultado: Fase 17 deletada, fases 18-20 se tornam 17-19

### Gerenciamento de Milestone

**`/novo-marco <nome>`**
Iniciar um novo milestone através de fluxo unificado.

- Questionamento profundo para entender o que você está construindo a seguir
- Pesquisa de domínio opcional (cria 4 agentes pesquisadores em paralelo)
- Definição de requisitos com escopo
- Criação de roadmap com breakdown de fases
- Flag `--reset-phase-numbers` opcional reinicia a numeração na Fase 1 e arquiva diretórios de fase antigos primeiro por segurança

Espelha o fluxo de `/novo-projeto` para projetos brownfield (PROJECT.md existente).

Uso: `/novo-marco "Funcionalidades v2.0"`
Uso: `/novo-marco --reset-phase-numbers "Funcionalidades v2.0"`

**`/concluir-marco <versão>`**
Arquivar milestone concluído e preparar para próxima versão.

- Cria entrada no MILESTONES.md com estatísticas
- Arquiva detalhes completos no diretório milestones/
- Cria tag git para o release
- Prepara workspace para próxima versão

Uso: `/concluir-marco 1.0.0`

### Rastreamento de Progresso

**`/progresso`**
Verificar status do projeto e rotear inteligentemente para próxima ação.

- Mostra barra de progresso visual e percentual de conclusão
- Resume trabalho recente dos arquivos SUMMARY
- Exibe posição atual e o que vem a seguir
- Lista decisões-chave e issues abertas
- Oferece executar próximo plano ou criá-lo se ausente
- Detecta conclusão de milestone a 100%

Uso: `/progresso`

### Gerenciamento de Sessão

**`/retomar-trabalho`**
Retomar trabalho de sessão anterior com restauração completa de contexto.

- Lê STATE.md para contexto do projeto
- Mostra posição atual e progresso recente
- Oferece próximas ações baseadas no estado do projeto

Uso: `/retomar-trabalho`

**`/pausar-trabalho`**
Criar handoff de contexto ao pausar trabalho no meio de uma fase.

- Cria arquivo .continue-here com estado atual
- Atualiza seção de continuidade de sessão do STATE.md
- Captura contexto de trabalho em andamento

Uso: `/pausar-trabalho`

### Depuração

**`/depurar [descrição do problema]`**
Depuração sistemática com estado persistente entre resets de contexto.

- Coleta sintomas através de questionamento adaptativo
- Cria `.planning/debug/[slug].md` para rastrear investigação
- Investiga usando método científico (evidência → hipótese → teste)
- Sobrevive ao `/clear` — rode `/depurar` sem args para retomar
- Arquiva issues resolvidas em `.planning/debug/resolved/`

Uso: `/depurar "botão de login não funciona"`
Uso: `/depurar` (retomar sessão ativa)

### Notas Rápidas

**`/nota <texto>`**
Captura de ideia sem fricção — um comando, salvo instantaneamente, sem perguntas.

- Salva nota com timestamp em `.planning/notes/` (ou `./.claude/notes/` globalmente)
- Três subcomandos: append (padrão), list, promote
- Promote converte uma nota em um todo estruturado
- Funciona sem um projeto (usa escopo global como fallback)

Uso: `/nota refatorar o sistema de hooks`
Uso: `/nota list`
Uso: `/nota promote 3`
Uso: `/nota --global ideia para múltiplos projetos`

### Gerenciamento de Todos

**`/adicionar-tarefa [descrição]`**
Capturar ideia ou tarefa como todo da conversa atual.

- Extrai contexto da conversa (ou usa descrição fornecida)
- Cria arquivo de todo estruturado em `.planning/todos/pending/`
- Infere área de caminhos de arquivo para agrupamento
- Verifica duplicatas antes de criar
- Atualiza contagem de todos no STATE.md

Uso: `/adicionar-tarefa` (infere da conversa)
Uso: `/adicionar-tarefa Adicionar refresh de token de auth`

**`/verificar-tarefas [área]`**
Listar todos pendentes e selecionar um para trabalhar.

- Lista todos os todos pendentes com título, área, idade
- Filtro de área opcional (ex: `/verificar-tarefas api`)
- Carrega contexto completo do todo selecionado
- Roteia para ação apropriada (trabalhar agora, adicionar à fase, fazer brainstorm)
- Move todo para done/ quando o trabalho começa

Uso: `/verificar-tarefas`
Uso: `/verificar-tarefas api`

### Teste de Aceitação de Usuário

**`/verificar-trabalho [fase]`**
Validar funcionalidades construídas através de UAT conversacional.

- Extrai entregáveis testáveis dos arquivos SUMMARY.md
- Apresenta testes um por um (respostas sim/não)
- Diagnostica falhas automaticamente e cria planos de correção
- Pronto para re-execução se issues encontradas

Uso: `/verificar-trabalho 3`

### Publicar Trabalho

**`/publicar [fase]`**
Criar um PR do trabalho de fase concluído com corpo gerado automaticamente.

- Faz push da branch para o remoto
- Cria PR com resumo do SUMMARY.md, VERIFICATION.md, REQUIREMENTS.md
- Opcionalmente solicita revisão de código
- Atualiza STATE.md com status de publicação

Pré-requisitos: Fase verificada, CLI `gh` instalada e autenticada.

Uso: `/publicar 4` ou `/publicar 4 --draft`

---

**`/revisar --phase N [--gemini] [--claude] [--codex] [--all]`**
Revisão por pares entre IAs — invoca CLIs de IA externas para revisar planos de fase de forma independente.

- Detecta CLIs disponíveis (gemini, claude, codex)
- Cada CLI revisa planos independentemente com o mesmo prompt estruturado
- Produz REVIEWS.md com feedback por revisor e resumo de consenso
- Alimenta revisões de volta no planejamento: `/planejar-fase N --reviews`

Uso: `/revisar --phase 3 --all`

---

**`/branch-pr [alvo]`**
Criar uma branch limpa para pull requests filtrando commits de .planning/.

- Classifica commits: somente-código (incluir), somente-planejamento (excluir), misto (incluir sem .planning/)
- Cherry-picks commits de código em uma branch limpa
- Revisores veem apenas mudanças de código, sem artefatos framework

Uso: `/branch-pr` ou `/branch-pr main`

---

**`/plantar-ideia [ideia]`**
Capturar uma ideia prospectiva com condições de gatilho para surfacing automático.

- Seeds preservam O PORQUÊ, QUANDO surfaçar, e breadcrumbs para código relacionado
- Auto-surfaça durante `/novo-marco` quando condições de gatilho correspondem
- Melhor do que itens adiados — gatilhos são verificados, não esquecidos

Uso: `/plantar-ideia "adicionar notificações em tempo real quando construirmos o sistema de eventos"`

---

**`/auditar-uat`**
Auditoria cross-fase de todos os itens UAT e de verificação pendentes.
- Escaneia cada fase por itens pendentes, pulados, bloqueados e que precisam de humano
- Cruza com a base de código para detectar documentação obsoleta
- Produz plano de teste humano priorizado agrupado por testabilidade
- Use antes de iniciar um novo milestone para limpar dívida de verificação

Uso: `/auditar-uat`

### Auditoria de Milestone

**`/auditar-marco [versão]`**
Auditar conclusão de milestone contra intenção original.

- Lê todos os arquivos VERIFICATION.md de fase
- Verifica cobertura de requisitos
- Cria agente verificador de integração para fiação cross-fase
- Cria MILESTONE-AUDIT.md com lacunas e dívida técnica

Uso: `/auditar-marco`

**`/planejar-lacunas`**
Criar fases para fechar lacunas identificadas pela auditoria.

- Lê MILESTONE-AUDIT.md e agrupa lacunas em fases
- Prioriza por prioridade de requisito (must/should/nice)
- Adiciona fases de fechamento de lacunas ao ROADMAP.md
- Pronto para `/planejar-fase` nas novas fases

Uso: `/planejar-lacunas`

### Configuração

**`/configuracoes`**
Configurar toggles de workflow e perfil de modelo interativamente.

- Alternar agentes pesquisador, verificador de plano, verificador
- Selecionar perfil de modelo (quality/balanced/budget/inherit)
- Atualiza `.planning/config.json`

Uso: `/configuracoes`

**`/set-profile <perfil>`**
Troca rápida de perfil de modelo para agentes framework.

- `quality` — Opus em todo lugar exceto verificação
- `balanced` — Opus para planejamento, Sonnet para execução (padrão)
- `budget` — Sonnet para escrita, Haiku para pesquisa/verificação
- `inherit` — Usa modelo da sessão atual para todos os agentes (OpenCode `/model`)

Uso: `/set-profile budget`

### Comandos Utilitários

**`/limpeza`**
Arquivar diretórios de fase acumulados de milestones concluídos.

- Identifica fases de milestones concluídos ainda em `.planning/phases/`
- Mostra resumo dry-run antes de mover qualquer coisa
- Move diretórios de fase para `.planning/milestones/v{X.Y}-phases/`
- Use após múltiplos milestones para reduzir bagunça em `.planning/phases/`

Uso: `/limpeza`

**`/ajuda`**
Mostrar esta referência de comandos.

**`/atualizar`**
Atualizar framework para a versão mais recente com preview do changelog.

- Mostra comparação de versão instalada vs mais recente
- Exibe entradas de changelog para versões que você perdeu
- Destaca breaking changes
- Confirma antes de rodar a instalação
- Melhor do que `npx framework-cc` puro

Uso: `/atualizar`

**`/join-discord`**
Entrar na comunidade framework no Discord.

- Obtenha ajuda, compartilhe o que você está construindo, fique atualizado
- Conecte-se com outros usuários framework

Uso: `/join-discord`

## Arquivos & Estrutura

```
.planning/
├── PROJECT.md            # Visão do projeto
├── ROADMAP.md            # Breakdown de fases atual
├── STATE.md              # Memória e contexto do projeto
├── RETROSPECTIVE.md      # Retrospectiva viva (atualizada por milestone)
├── config.json           # Modo de workflow & portões
├── todos/                # Ideias e tarefas capturadas
│   ├── pending/          # Todos esperando para serem trabalhados
│   └── done/             # Todos concluídos
├── debug/                # Sessões de debug ativas
│   └── resolved/         # Issues resolvidas arquivadas
├── milestones/
│   ├── v1.0-ROADMAP.md       # Snapshot de roadmap arquivado
│   ├── v1.0-REQUIREMENTS.md  # Requisitos arquivados
│   └── v1.0-phases/          # Diretórios de fase arquivados (via /limpeza ou --archive-phases)
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # Mapa da base de código (projetos brownfield)
│   ├── STACK.md          # Linguagens, frameworks, dependências
│   ├── ARCHITECTURE.md   # Padrões, camadas, fluxo de dados
│   ├── STRUCTURE.md      # Layout de diretórios, arquivos-chave
│   ├── CONVENTIONS.md    # Padrões de código, nomenclatura
│   ├── TESTING.md        # Configuração de testes, padrões
│   ├── INTEGRATIONS.md   # Serviços externos, APIs
│   └── CONCERNS.md       # Dívida técnica, issues conhecidas
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Modos de Workflow

Definido durante `/novo-projeto`:

**Modo Interativo**

- Confirma cada decisão importante
- Pausa em checkpoints para aprovação
- Mais orientação durante todo o processo

**Modo YOLO**

- Aprova automaticamente a maioria das decisões
- Executa planos sem confirmação
- Para apenas em checkpoints críticos

Mude a qualquer momento editando `.planning/config.json`

## Configuração de Planejamento

Configure como artefatos de planejamento são gerenciados em `.planning/config.json`:

**`planning.commit_docs`** (padrão: `true`)
- `true`: Artefatos de planejamento commitados no git (workflow padrão)
- `false`: Artefatos de planejamento mantidos apenas localmente, não commitados

Quando `commit_docs: false`:
- Adicione `.planning/` ao seu `.gitignore`
- Útil para contribuições OSS, projetos de clientes, ou manter planejamento privado
- Todos os arquivos de planejamento ainda funcionam normalmente, apenas não rastreados no git

**`planning.search_gitignored`** (padrão: `false`)
- `true`: Adiciona `--no-ignore` a buscas ripgrep amplas
- Necessário apenas quando `.planning/` está no gitignore e você quer que buscas em todo o projeto o incluam

Exemplo de config:
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## Workflows Comuns

**Iniciando um novo projeto:**

```
/novo-projeto        # Fluxo unificado: questionamento → pesquisa → requisitos → roadmap
/clear
/planejar-fase 1     # Criar planos para a primeira fase
/clear
/executar-fase 1     # Executar todos os planos na fase
```

**Retomando trabalho após uma pausa:**

```
/progresso  # Ver onde você parou e continuar
```

**Adicionando trabalho urgente no meio do milestone:**

```
/inserir-fase 5 "Correção crítica de segurança"
/planejar-fase 5.1
/executar-fase 5.1
```

**Concluindo um milestone:**

```
/concluir-marco 1.0.0
/clear
/novo-marco  # Iniciar próximo milestone (questionamento → pesquisa → requisitos → roadmap)
```

**Capturando ideias durante o trabalho:**

```
/adicionar-tarefa                        # Capturar do contexto da conversa
/adicionar-tarefa Corrigir z-index modal # Capturar com descrição explícita
/verificar-tarefas                       # Revisar e trabalhar nos todos
/verificar-tarefas api                   # Filtrar por área
```

**Depurando um problema:**

```
/depurar "envio de formulário falha silenciosamente"  # Iniciar sessão de debug
# ... investigação acontece, contexto enche ...
/clear
/depurar                                               # Retomar de onde parou
```

## Obtendo Ajuda

- Leia `.planning/PROJECT.md` para visão do projeto
- Leia `.planning/STATE.md` para contexto atual
- Verifique `.planning/ROADMAP.md` para status de fases
- Rode `/progresso` para ver onde você está
</reference>
