<purpose>
Capturar uma ideia, tarefa ou problema que surge durante uma sessão framework como um todo estruturado para trabalho futuro. Permite o fluxo "pensamento → captura → continuar" sem perder contexto.
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

Extrair do JSON de init: `commit_docs`, `date`, `timestamp`, `todo_count`, `todos`, `pending_dir`, `todos_dir_exists`.

Garantir que os diretórios existam:
```bash
mkdir -p .planning/todos/pending .planning/todos/done
```

Anotar áreas existentes do array de todos para consistência no passo infer_area.
</step>

<step name="extract_content">
**Com argumentos:** Use como título/foco.
- `/adicionar-tarefa Adicionar refresh de token auth` → título = "Adicionar refresh de token auth"

**Sem argumentos:** Analise a conversa recente para extrair:
- O problema específico, ideia ou tarefa discutida
- Caminhos de arquivo relevantes mencionados
- Detalhes técnicos (mensagens de erro, números de linha, restrições)

Formular:
- `title`: Título descritivo de 3-10 palavras (verbo de ação preferido)
- `problem`: O que está errado ou por que isso é necessário
- `solution`: Dicas de abordagem ou "TBD" se for apenas uma ideia
- `files`: Caminhos relevantes com números de linha da conversa
</step>

<step name="infer_area">
Inferir área a partir dos caminhos de arquivo:

| Padrão de caminho | Área |
|-------------------|------|
| `src/api/*`, `api/*` | `api` |
| `src/components/*`, `src/ui/*` | `ui` |
| `src/auth/*`, `auth/*` | `auth` |
| `src/db/*`, `database/*` | `database` |
| `tests/*`, `__tests__/*` | `testing` |
| `docs/*` | `docs` |
| `.planning/*` | `planning` |
| `scripts/*`, `bin/*` | `tooling` |
| Sem arquivos ou incerto | `general` |

Use a área existente do passo 2 se houver correspondência similar.
</step>

<step name="check_duplicates">
```bash
# Buscar palavras-chave do título em todos existentes
grep -l -i "[palavras-chave do título]" .planning/todos/pending/*.md 2>/dev/null || true
```

Se encontrar duplicata potencial:
1. Leia o todo existente
2. Compare o escopo

Se houver sobreposição, use AskUserQuestion:
- header: "Duplicata?"
- question: "Todo similar existe: [título]. O que você gostaria de fazer?"
- options:
  - "Ignorar" — manter todo existente
  - "Substituir" — atualizar existente com novo contexto
  - "Adicionar mesmo assim" — criar como todo separado
</step>

<step name="create_file">
Use valores do contexto de init: `timestamp` e `date` já estão disponíveis.

Gerar slug para o título:
```bash
slug=$(node "./.claude/framework/bin/tools.cjs" generate-slug "$title" --raw)
```

Escrever em `.planning/todos/pending/${date}-${slug}.md`:

```markdown
---
created: [timestamp]
title: [título]
area: [área]
files:
  - [arquivo:linhas]
---

## Problema

[descrição do problema - contexto suficiente para Claude futuro entender semanas depois]

## Solução

[dicas de abordagem ou "TBD"]
```
</step>

<step name="update_state">
Se `.planning/STATE.md` existir:

1. Use `todo_count` do contexto de init (ou re-execute `init todos` se a contagem mudou)
2. Atualize "### Pending Todos" em "## Accumulated Context"
</step>

<step name="git_commit">
Commitar o todo e qualquer estado atualizado:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: capture todo - [título]" --files .planning/todos/pending/[filename] .planning/STATE.md
```

A ferramenta respeita a configuração `commit_docs` e gitignore automaticamente.

Confirmar: "Commitado: docs: capture todo - [título]"
</step>

<step name="confirm">
```
Todo salvo: .planning/todos/pending/[filename]

  [título]
  Área: [área]
  Arquivos: [contagem] referenciados

---

Deseja:

1. Continuar com o trabalho atual
2. Adicionar outro todo
3. Ver todos os todos (/verificar-tarefas)
```
</step>

</process>

<success_criteria>
- [ ] Estrutura de diretórios existe
- [ ] Arquivo de todo criado com frontmatter válido
- [ ] Seção de problema tem contexto suficiente para o Claude futuro
- [ ] Sem duplicatas (verificado e resolvido)
- [ ] Área consistente com todos existentes
- [ ] STATE.md atualizado se existir
- [ ] Todo e estado commitados no git
</success_criteria>
