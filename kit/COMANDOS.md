# Comandos do framework — Referência Rápida

## Fluxo Principal

| Comando | O que faz |
|---------|-----------|
| `/novo-projeto` | Inicializa um novo projeto com coleta profunda de contexto e PROJECT.md |
| `/novo-marco` | Inicia um novo ciclo de milestone — atualiza PROJECT.md e encaminha para requisitos |
| `/discutir-fase` | Reúne contexto da fase por questionamento adaptativo antes do planejamento (`--auto` para pular perguntas) |
| `/planejar-fase` | Cria plano detalhado da fase (PLAN.md) com loop de verificação |
| `/executar-fase` | Executa todos os planos de uma fase com paralelização por ondas |
| `/proximo` | Avança automaticamente para o próximo passo lógico no workflow framework |
| `/autonomo` | Executa todas as fases restantes de forma autônoma — discutir→planejar→executar por fase |

## Tarefas Rápidas

| Comando | O que faz |
|---------|-----------|
| `/fazer` | Roteia texto livre para o comando do framework correto automaticamente |
| `/rapido` | Executa tarefa trivial inline — sem subagentes, sem overhead de planejamento |
| `/expresso` | Executa tarefa rápida com garantias framework (commits atômicos, rastreamento de estado), pula agentes opcionais |

## Gerenciamento de Fases

| Comando | O que faz |
|---------|-----------|
| `/adicionar-fase` | Adiciona fase ao final do milestone atual no roadmap |
| `/inserir-fase` | Insere trabalho urgente como fase decimal (ex: 72.1) entre fases existentes |
| `/remover-fase` | Remove uma fase futura do roadmap e renumera as subsequentes |
| `/pesquisar-fase` | Pesquisa como implementar uma fase (standalone — normalmente use `/planejar-fase`) |
| `/listar-hipoteses-fase` | Mostra as hipóteses do Claude sobre a abordagem de uma fase antes do planejamento |

## Milestones e Progresso

| Comando | O que faz |
|---------|-----------|
| `/progresso` | Verifica o progresso do projeto, mostra contexto e roteia para próxima ação |
| `/auditar-marco` | Audita a conclusão do milestone contra a intenção original antes de arquivar |
| `/concluir-marco` | Arquiva milestone concluído e prepara para próxima versão |
| `/resumo-marco` | Gera resumo abrangente do projeto para onboarding e revisão da equipe |
| `/planejar-lacunas` | Cria fases para fechar todas as lacunas identificadas pela auditoria de milestone |

## Verificação e Qualidade

| Comando | O que faz |
|---------|-----------|
| `/verificar-trabalho` | Valida funcionalidades construídas através de UAT conversacional |
| `/validar-fase` | Audita retroativamente e preenche lacunas de validação Nyquist para uma fase concluída |
| `/auditar-uat` | Auditoria multi-fase de todos os itens de UAT e verificação pendentes |
| `/adicionar-testes` | Gera testes para uma fase concluída com base nos critérios de UAT e implementação |
| `/verificar-tarefas` | Lista todos os todos pendentes e seleciona um para trabalhar |

## UI / Frontend

| Comando | O que faz |
|---------|-----------|
| `/fase-ui` | Gera contrato de design UI (UI-SPEC.md) para fases de frontend |
| `/revisar-ui` | Auditoria visual retroativa de 6 pilares do código frontend implementado |

## Sessão e Contexto

| Comando | O que faz |
|---------|-----------|
| `/pausar-trabalho` | Cria handoff de contexto ao pausar trabalho no meio de uma fase |
| `/retomar-trabalho` | Retoma o trabalho da sessão anterior com restauração completa de contexto |
| `/relatorio-sessao` | Gera relatório da sessão com estimativas de uso de tokens, resumo de trabalho e resultados |
| `/fio` | Gerencia threads de contexto persistentes para trabalho entre sessões |

## Análise e Diagnóstico

| Comando | O que faz |
|---------|-----------|
| `/mapear-codebase` | Analisa a base de código com agentes paralelos, produz documentos em `.planning/codebase/` |
| `/depurar` | Depuração sistemática com estado persistente entre resets de contexto |
| `/forense` | Investigação post-mortem de workflows framework com falha — analisa git, artefatos e estado |
| `/saude` | Diagnostica a integridade do diretório de planejamento e opcionalmente repara problemas |
| `/estatisticas` | Exibe estatísticas do projeto — fases, planos, requisitos, métricas git e linha do tempo |

## Publicação e Colaboração

| Comando | O que faz |
|---------|-----------|
| `/publicar` | Cria PR, executa revisão e prepara para merge após a verificação passar |
| `/branch-pr` | Cria branch limpo para PR filtrando commits de `.planning/` — pronto para revisão de código |
| `/revisar` | Solicita revisão entre IAs de planos de fase a partir de CLIs externas |

## Backlog e Ideias

| Comando | O que faz |
|---------|-----------|
| `/nota` | Captura de ideias sem fricção — adicionar, listar ou promover notas |
| `/adicionar-tarefa` | Captura ideia ou tarefa como todo a partir do contexto da conversa atual |
| `/adicionar-backlog` | Adiciona uma ideia ao estacionamento de backlog (numeração 999.x) |
| `/revisar-backlog` | Revisa e promove itens do backlog para o milestone ativo |
| `/plantar-ideia` | Captura ideia prospectiva com condições de gatilho — surge automaticamente no milestone certo |

## Workspaces

| Comando | O que faz |
|---------|-----------|
| `/novo-workspace` | Cria workspace isolado com cópias de repos e `.planning/` independente |
| `/listar-workspaces` | Lista os workspaces framework ativos e seu status |
| `/remover-workspace` | Remove um workspace framework e limpa as worktrees |
| `/fluxos-trabalho` | Gerencia fluxos de trabalho paralelos — listar, criar, alternar, status, concluir e retomar |
| `/gerenciador` | Central de comando interativa para gerenciar múltiplas fases em um terminal |

## Perfil e Configurações

| Comando | O que faz |
|---------|-----------|
| `/perfil-usuario` | Gera perfil comportamental do desenvolvedor e cria artefatos descobríveis pelo Claude |
| `/definir-perfil` | Altera o perfil de modelo para os agentes framework (quality/balanced/budget/inherit) |
| `/configuracoes` | Configura os toggles de workflow framework e perfil de modelo |

## Utilitários

| Comando | O que faz |
|---------|-----------|
| `/ajuda` | Mostra os comandos do framework disponíveis e o guia de uso |
| `/atualizar` | Atualiza o framework para a versão mais recente com exibição de changelog |
| `/reaplicar-patches` | Reaplicar modificações locais após uma atualização do framework |
| `/limpeza` | Arquiva diretórios de fase acumulados de milestones concluídos |
| `/entrar-discord` | Link para entrar na comunidade framework no Discord |
