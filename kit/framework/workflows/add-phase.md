<purpose>
Adicionar uma nova fase inteira ao final do milestone atual no roadmap. Calcula automaticamente o próximo número de fase, cria o diretório da fase e atualiza a estrutura do roadmap.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="parse_arguments">
Analisar os argumentos do comando:
- Todos os argumentos se tornam a descrição da fase
- Exemplo: `/adicionar-fase Adicionar autenticação` → descrição = "Adicionar autenticação"
- Exemplo: `/adicionar-fase Corrigir problemas críticos de performance` → descrição = "Corrigir problemas críticos de performance"

Se nenhum argumento for fornecido:

```
ERRO: Descrição da fase obrigatória
Uso: /adicionar-fase <descrição>
Exemplo: /adicionar-fase Adicionar sistema de autenticação
```

Sair.
</step>

<step name="init_context">
Carregar contexto de operação de fase:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "0")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Verificar `roadmap_exists` do JSON de init. Se false:
```
ERRO: Nenhum roadmap encontrado (.planning/ROADMAP.md)
Execute /novo-projeto para inicializar.
```
Sair.
</step>

<step name="add_phase">
**Delegar a adição de fase ao tools:**

```bash
RESULT=$(node "./.claude/framework/bin/tools.cjs" phase add "${description}")
```

O CLI gerencia:
- Encontrar o maior número de fase inteira existente
- Calcular o próximo número de fase (máx + 1)
- Gerar slug a partir da descrição
- Criar o diretório da fase (`.planning/phases/{NN}-{slug}/`)
- Inserir a entrada de fase no ROADMAP.md com seções de Objetivo, Dependências e Planos

Extrair do resultado: `phase_number`, `padded`, `name`, `slug`, `directory`.
</step>

<step name="update_project_state">
Atualizar STATE.md para refletir a nova fase:

1. Leia `.planning/STATE.md`
2. Em "## Accumulated Context" → "### Roadmap Evolution" adicione entrada:
   ```
   - Fase {N} adicionada: {descrição}
   ```

Se a seção "Roadmap Evolution" não existir, crie-a.
</step>

<step name="completion">
Apresentar resumo de conclusão:

```
Fase {N} adicionada ao milestone atual:
- Descrição: {descrição}
- Diretório: .planning/phases/{phase-num}-{slug}/
- Status: Ainda não planejada

Roadmap atualizado: .planning/ROADMAP.md

---

## ▶ Próximo

**Fase {N}: {descrição}**

`/planejar-fase {N}`

<sub>`/clear` primeiro → janela de contexto limpa</sub>

---

**Também disponível:**
- `/adicionar-fase <descrição>` — adicionar outra fase
- Revisar o roadmap

---
```
</step>

</process>

<success_criteria>
- [ ] `tools phase add` executado com sucesso
- [ ] Diretório da fase criado
- [ ] Roadmap atualizado com nova entrada de fase
- [ ] STATE.md atualizado com nota de evolução do roadmap
- [ ] Usuário informado sobre próximos passos
</success_criteria>
