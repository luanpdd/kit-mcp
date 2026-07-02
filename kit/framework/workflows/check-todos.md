<purpose>
Listar todos os todos pendentes, permitir seleção, carregar contexto completo do todo selecionado e encaminhar para a ação adequada.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="init_context">
Carregar contexto de todos:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init todos)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair do JSON de init: `todo_count`, `todos`, `pending_dir`.

Se `todo_count` for 0:
```
Nenhum todo pendente.

Todos são capturados durante sessões de trabalho com /adicionar-tarefa.

---

Deseja:

1. Continuar com a fase atual (/progresso)
2. Adicionar um todo agora (/adicionar-tarefa)
```

Sair.
</step>

<step name="parse_filter">
Verificar filtro de área nos argumentos:
- `/verificar-tarefas` → mostrar todos
- `/verificar-tarefas api` → filtrar apenas para area:api
</step>

<step name="list_todos">
Usar o array `todos` do contexto de init (já filtrado por área se especificado).

Analisar e exibir como lista numerada:

```
Todos Pendentes:

1. Adicionar refresh de token auth (api, há 2 dias)
2. Corrigir problema de z-index do modal (ui, há 1 dia)
3. Refatorar pool de conexão do banco de dados (database, há 5h)

---

Responda com um número para ver detalhes, ou:
- `/verificar-tarefas [área]` para filtrar por área
- `q` para sair
```

Formatar idade como tempo relativo a partir do timestamp criado.
</step>

<step name="handle_selection">
Aguardar o usuário responder com um número.

Se válido: carregar todo selecionado, prosseguir.
Se inválido: "Seleção inválida. Responda com um número (1-[N]) ou `q` para sair."
</step>

<step name="load_context">
Ler o arquivo de todo completamente. Exibir:

```
## [título]

**Área:** [área]
**Criado:** [data] (há [tempo relativo])
**Arquivos:** [lista ou "Nenhum"]

### Problema
[conteúdo da seção de problema]

### Solução
[conteúdo da seção de solução]
```

Se o campo `files` tiver entradas, leia e resuma brevemente cada um.
</step>

<step name="check_roadmap">
Verificar roadmap (pode usar init progress ou verificar existência de arquivo diretamente):

Se `.planning/ROADMAP.md` existir:
1. Verificar se a área do todo corresponde a uma fase futura
2. Verificar se os arquivos do todo se sobrepõem ao escopo de uma fase
3. Anotar qualquer correspondência para as opções de ação
</step>

<step name="offer_actions">
**Se o todo mapear para uma fase do roadmap:**

Usar AskUserQuestion:
- header: "Ação"
- question: "Este todo está relacionado à Fase [N]: [nome]. O que você gostaria de fazer?"
- options:
  - "Trabalhar nisso agora" — mover para feito, começar a trabalhar
  - "Adicionar ao plano da fase" — incluir ao planejar a Fase [N]
  - "Explorar abordagem" — pensar antes de decidir
  - "Devolver" — retornar à lista

**Se não houver correspondência no roadmap:**

Usar AskUserQuestion:
- header: "Ação"
- question: "O que você gostaria de fazer com este todo?"
- options:
  - "Trabalhar nisso agora" — mover para feito, começar a trabalhar
  - "Criar uma fase" — /adicionar-fase com este escopo
  - "Explorar abordagem" — pensar antes de decidir
  - "Devolver" — retornar à lista
</step>

<step name="execute_action">
**Trabalhar nisso agora:**
```bash
mv ".planning/todos/pending/[filename]" ".planning/todos/done/"
```
Atualizar contagem de todos no STATE.md. Apresentar contexto do problema/solução. Começar o trabalho ou perguntar como prosseguir.

**Adicionar ao plano da fase:**
Anotar referência do todo nas notas de planejamento da fase. Manter no pendente. Retornar à lista ou sair.

**Criar uma fase:**
Exibir: `/adicionar-fase [descrição do todo]`
Manter no pendente. Usuário executa o comando em contexto novo.

**Explorar abordagem:**
Manter no pendente. Iniciar discussão sobre o problema e abordagens.

**Devolver:**
Retornar ao passo list_todos.
</step>

<step name="update_state">
Após qualquer ação que altere a contagem de todos:

Re-executar `init todos` para obter contagem atualizada, depois atualizar seção "### Pending Todos" do STATE.md se existir.
</step>

<step name="git_commit">
Se o todo foi movido para done/, commitar a mudança:

```bash
git rm --cached .planning/todos/pending/[filename] 2>/dev/null || true
node "./.claude/framework/bin/tools.cjs" commit "docs: start work on todo - [título]" --files .planning/todos/done/[filename] .planning/STATE.md
```

A ferramenta respeita a configuração `commit_docs` e gitignore automaticamente.

Confirmar: "Commitado: docs: start work on todo - [título]"
</step>

</process>

<success_criteria>
- [ ] Todos os todos pendentes listados com título, área, idade
- [ ] Filtro de área aplicado se especificado
- [ ] Contexto completo do todo selecionado carregado
- [ ] Contexto do roadmap verificado para correspondência de fase
- [ ] Ações adequadas oferecidas
- [ ] Ação selecionada executada
- [ ] STATE.md atualizado se contagem de todos mudou
- [ ] Mudanças commitadas no git (se todo movido para done/)
</success_criteria>
