<purpose>
Captura de ideias sem fricção. Uma chamada Write, uma linha de confirmação. Sem perguntas, sem prompts.
Executa inline — sem Task, sem AskUserQuestion, sem Bash.
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="storage_format">
**Formato de armazenamento de notas.**

Notas são armazenadas como arquivos markdown individuais:

- **Escopo do projeto**: `.planning/notes/{AAAA-MM-DD}-{slug}.md` — usado quando `.planning/` existe no cwd
- **Escopo global**: `./.claude/notes/{AAAA-MM-DD}-{slug}.md` — fallback quando não há `.planning/`, ou quando a flag `--global` está presente

Cada arquivo de nota:

```markdown
---
date: "AAAA-MM-DD HH:mm"
promoted: false
---

{texto da nota verbatim}
```

**Flag `--global`**: Remover `--global` de qualquer lugar em `$ARGUMENTS` antes de analisar. Quando presente, forçar escopo global independentemente de `.planning/` existir.

**Importante**: NÃO criar `.planning/` se não existir. Usar escopo global silenciosamente como fallback.
</step>

<step name="parse_subcommand">
**Analisar subcomando de $ARGUMENTS (após remover --global).**

| Condição | Subcomando |
|----------|------------|
| Argumentos são exatamente `list` (sem distinção maiúscula/minúscula) | **list** |
| Argumentos são exatamente `promote <N>` onde N é um número | **promote** |
| Argumentos estão vazios (sem texto algum) | **list** |
| Qualquer outra coisa | **append** (o texto É a nota) |

**Crítico**: `list` é somente um subcomando quando é o ARGUMENTO INTEIRO. `/nota lista de compras` salva uma nota com o texto "lista de compras". O mesmo para `promote` — somente um subcomando quando seguido por exatamente um número.
</step>

<step name="append">
**Subcomando: append — criar um arquivo de nota com timestamp.**

1. Determinar escopo (projeto ou global) conforme formato de armazenamento acima
2. Garantir que o diretório de notas existe (`.planning/notes/` ou `./.claude/notes/`)
3. Gerar slug: primeiras ~4 palavras significativas do texto da nota, minúsculo, separado por hífen (remover artigos/preposições do início)
4. Gerar nome de arquivo: `{AAAA-MM-DD}-{slug}.md`
   - Se um arquivo com esse nome já existir, adicionar `-2`, `-3`, etc.
5. Escrever o arquivo com frontmatter e texto da nota (ver formato de armazenamento)
6. Confirmar com exatamente uma linha: `Anotado ({escopo}): {texto da nota}`
   - Onde `{escopo}` é "projeto" ou "global"

**Restrições:**
- **Nunca modificar o texto da nota** — capturar verbatim, incluindo erros de digitação
- **Nunca fazer perguntas** — apenas escrever e confirmar
- **Formato de timestamp**: Usar horário local, `AAAA-MM-DD HH:mm` (24 horas, sem segundos)
</step>

<step name="list">
**Subcomando: list — mostrar notas de ambos os escopos.**

1. Glob `.planning/notes/*.md` (se diretório existir) — notas do projeto
2. Glob `./.claude/notes/*.md` (se diretório existir) — notas globais
3. Para cada arquivo, ler frontmatter para obter `date` e status `promoted`
4. Excluir arquivos onde `promoted: true` das contagens ativas (mas ainda mostrar, dimmed)
5. Ordenar por data, numerar todas as entradas ativas sequencialmente começando em 1
6. Se total de entradas ativas > 20, mostrar apenas as últimas 10 com nota sobre quantas foram omitidas

**Formato de exibição:**

```
Notas:

Projeto (.planning/notes/):
  1. [2026-02-08 14:32] refatorar o sistema de hook para suportar validadores assíncronos
  2. [promovido] [2026-02-08 14:40] adicionar rate limiting nos endpoints da API
  3. [2026-02-08 15:10] considerar adicionar flag --dry-run ao build

Global (./.claude/notes/):
  4. [2026-02-08 10:00] ideia entre projetos sobre config compartilhada

{contagem} nota(s) ativa(s). Use `/nota promote <N>` para converter em uma tarefa.
```

Se um escopo não tiver diretório ou entradas, mostrar: `(sem notas)`
</step>

<step name="promote">
**Subcomando: promote — converter uma nota em uma tarefa.**

1. Executar a lógica de **list** para construir o índice numerado (ambos os escopos)
2. Encontrar a entrada N da lista numerada
3. Se N for inválido ou referir a uma nota já promovida, informar o usuário e parar
4. **Requer diretório `.planning/`** — se não existir, avisar: "Tarefas requerem um projeto framework. Execute `/novo-projeto` para inicializar um."
5. Garantir que o diretório `.planning/todos/pending/` existe
6. Gerar ID da tarefa: `{NNN}-{slug}` onde NNN é o próximo número sequencial (escanear tanto `.planning/todos/pending/` quanto `.planning/todos/done/` pelo maior número existente, incrementar em 1, preencher com zeros à esquerda até 3 dígitos) e slug são as primeiras ~4 palavras significativas do texto da nota
7. Extrair o texto da nota do arquivo fonte (corpo após frontmatter)
8. Criar `.planning/todos/pending/{id}.md`:

```yaml
---
title: "{texto da nota}"
status: pending
priority: P2
source: "promoted from /nota"
created: {AAAA-MM-DD}
theme: general
---

## Objetivo

{texto da nota}

## Contexto

Promovido de nota rápida capturada em {data original}.

## Critérios de Aceitação

- [ ] {critério principal derivado do texto da nota}
```

9. Marcar o arquivo de nota fonte como promovido: atualizar seu frontmatter para `promoted: true`
10. Confirmar: `Nota {N} promovida para tarefa {id}: {texto da nota}`
</step>

</process>

<edge_cases>
1. **"list" como texto de nota**: `/nota lista de coisas` salva nota "lista de coisas" (subcomando apenas quando `list` é o argumento inteiro)
2. **Sem `.planning/`**: Fallback para `./.claude/notes/` global — funciona em qualquer diretório
3. **Promote sem projeto**: Avisa que tarefas requerem `.planning/`, sugere `/novo-projeto`
4. **Arquivos grandes**: `list` mostra as últimas 10 quando há > 20 entradas ativas
5. **Slugs duplicados**: Adicionar `-2`, `-3` etc. ao nome do arquivo se slug já usado na mesma data
6. **Posição de `--global`**: Removido de qualquer lugar — `--global minha ideia` e `minha ideia --global` ambos salvam "minha ideia" globalmente
7. **Promote já promovido**: Informar usuário "Nota {N} já está promovida" e parar
8. **Texto de nota vazio após remover flags**: Tratar como subcomando `list`
</edge_cases>

<success_criteria>
- [ ] Append: Arquivo de nota escrito com frontmatter correto e texto verbatim
- [ ] Append: Nenhuma pergunta feita — captura instantânea
- [ ] List: Ambos os escopos mostrados com numeração sequencial
- [ ] List: Notas promovidas mostradas mas dimmed
- [ ] Promote: Tarefa criada com formato correto
- [ ] Promote: Nota fonte marcada como promovida
- [ ] Fallback global: Funciona quando `.planning/` não existe
</success_criteria>
