<purpose>
Analisar texto livre do usuário e encaminhar para o comando do framework mais adequado. Este é um despachante — nunca faz o trabalho em si. Combinar a intenção do usuário com o melhor comando, confirmar o encaminhamento e repassar.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="validate">
**Verificar input.**

Se `$ARGUMENTS` estiver vazio, perguntar via AskUserQuestion:

```
O que você gostaria de fazer? Descreva a tarefa, bug ou ideia e eu encaminharei para o comando do framework correto.
```

Aguardar resposta antes de continuar.
</step>

<step name="check_project">
**Verificar se o projeto existe.**

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" state load 2>/dev/null)
```

Registrar se `.planning/` existe — algumas rotas exigem isso, outras não.
</step>

<step name="route">
**Combinar intenção com comando.**

Avaliar `$ARGUMENTS` contra estas regras de encaminhamento. Aplicar a **primeira regra que corresponder**:

| Se o texto descreve... | Encaminhar para | Por quê |
|------------------------|-----------------|---------|
| Iniciar um novo projeto, "configurar", "inicializar" | `/novo-projeto` | Precisa de inicialização completa do projeto |
| Mapear ou analisar uma base de código existente | `/mapear-codebase` | Descoberta da base de código |
| Um bug, erro, crash, falha ou algo quebrado | `/depurar` | Precisa de investigação sistemática |
| Explorar, pesquisar, comparar, ou "como X funciona" | `/pesquisar-fase` | Pesquisa de domínio antes do planejamento |
| Discutir visão, "como X deveria parecer", brainstorming | `/discutir-fase` | Precisa coletar contexto |
| Uma tarefa complexa: refatoração, migração, arquitetura multi-arquivo, redesign de sistema | `/adicionar-fase` | Precisa de uma fase completa com ciclo planejar/construir |
| Planejar uma fase específica ou "planejar fase N" | `/planejar-fase` | Pedido direto de planejamento |
| Executar uma fase ou "construir fase N", "rodar fase N" | `/executar-fase` | Pedido direto de execução |
| Rodar todas as fases restantes automaticamente | `/autonomo` | Execução autônoma completa |
| Uma revisão ou preocupação de qualidade sobre trabalho existente | `/verificar-trabalho` | Precisa de verificação |
| Verificar progresso, status, "onde estou" | `/progresso` | Verificação de status |
| Retomar trabalho, "continuar de onde parei" | `/retomar-trabalho` | Restauração de sessão |
| Uma nota, ideia ou "lembrar de..." | `/adicionar-tarefa` | Capturar para depois |
| Adicionar testes, "escrever testes", "cobertura de testes" | `/adicionar-testes` | Geração de testes |
| Completar um milestone, entregar, lançar | `/concluir-marco` | Ciclo de vida do milestone |
| Uma tarefa específica, acionável e pequena (adicionar feature, corrigir typo, atualizar config) | `/expresso` | Autocontido, executor único |

**Requer diretório `.planning/`:** Todas as rotas exceto `/novo-projeto`, `/mapear-codebase`, `/ajuda`. Se o projeto não existe e a rota exige, sugerir `/novo-projeto` primeiro.

**Tratamento de ambiguidade:** Se o texto puder corresponder razoavelmente a múltiplas rotas, perguntar ao usuário via AskUserQuestion com as 2-3 principais opções. Por exemplo:

```
"Refatorar o sistema de autenticação" pode ser:
1. /adicionar-fase — Ciclo de planejamento completo (recomendado para refatorações multi-arquivo)
2. /expresso — Execução rápida (se o escopo for pequeno e claro)

Qual abordagem se encaixa melhor?
```
</step>

<step name="display">
**Mostrar a decisão de encaminhamento.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► ROTEAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Input:** {primeiros 80 chars de $ARGUMENTS}
**Encaminhando para:** {comando escolhido}
**Motivo:** {explicação em uma linha}
```
</step>

<step name="dispatch">
**Invocar o comando escolhido.**

Executar o comando `/*` selecionado, passando `$ARGUMENTS` como args.

Se o comando escolhido espera um número de fase e nenhum foi fornecido no texto, extraí-lo do contexto ou perguntar via AskUserQuestion.

Após invocar o comando, parar. O comando despachado gerencia tudo a partir daqui.
</step>

</process>

<success_criteria>
- [ ] Input validado (não vazio)
- [ ] Intenção combinada com exatamente um comando do framework
- [ ] Ambiguidade resolvida via pergunta ao usuário (se necessário)
- [ ] Existência do projeto verificada para rotas que exigem
- [ ] Decisão de encaminhamento exibida antes do despacho
- [ ] Comando invocado com argumentos adequados
- [ ] Nenhum trabalho feito diretamente — apenas despachante
</success_criteria>
