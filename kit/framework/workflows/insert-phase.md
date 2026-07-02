<purpose>
Inserir uma fase decimal para trabalho urgente descoberto no meio do milestone entre fases inteiras existentes. Usa numeração decimal (72.1, 72.2, etc.) para preservar a sequência lógica de fases planejadas enquanto acomoda inserções urgentes sem renumerar todo o roadmap.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="parse_arguments">
Analisar os argumentos do comando:
- Primeiro argumento: número de fase inteiro após o qual inserir
- Argumentos restantes: descrição da fase

Exemplo: `/inserir-fase 72 Corrigir bug crítico de auth`
-> after = 72
-> description = "Corrigir bug crítico de auth"

Se argumentos ausentes:

```
ERRO: Número de fase e descrição são obrigatórios
Uso: /inserir-fase <após> <descrição>
Exemplo: /inserir-fase 72 Corrigir bug crítico de auth
```

Sair.

Validar que o primeiro argumento é um inteiro.
</step>

<step name="init_context">
Carregar contexto de operação de fase:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${after_phase}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Verificar `roadmap_exists` do JSON de init. Se falso:
```
ERRO: Nenhum roadmap encontrado (.planning/ROADMAP.md)
```
Sair.
</step>

<step name="insert_phase">
**Delegar a inserção de fase ao tools:**

```bash
RESULT=$(node "./.claude/framework/bin/tools.cjs" phase insert "${after_phase}" "${description}")
```

A CLI cuida de:
- Verificar se a fase alvo existe no ROADMAP.md
- Calcular o próximo número decimal de fase (verificando decimais existentes no disco)
- Gerar slug a partir da descrição
- Criar o diretório de fase (`.planning/phases/{N.M}-{slug}/`)
- Inserir a entrada de fase no ROADMAP.md após a fase alvo com marcador (INSERTED)

Extrair do resultado: `phase_number`, `after_phase`, `name`, `slug`, `directory`.
</step>

<step name="update_project_state">
Atualizar STATE.md para refletir a fase inserida:

1. Ler `.planning/STATE.md`
2. Em "## Accumulated Context" → "### Roadmap Evolution" adicionar entrada:
   ```
   - Fase {decimal_phase} inserida após Fase {after_phase}: {description} (URGENTE)
   ```

Se a seção "Roadmap Evolution" não existir, criá-la.
</step>

<step name="completion">
Apresentar resumo de conclusão:

```
Fase {decimal_phase} inserida após Fase {after_phase}:
- Descrição: {description}
- Diretório: .planning/phases/{decimal-phase}-{slug}/
- Status: Ainda não planejada
- Marcador: (INSERTED) - indica trabalho urgente

Roadmap atualizado: .planning/ROADMAP.md
Estado do projeto atualizado: .planning/STATE.md

---

## Próximo Passo

**Fase {decimal_phase}: {description}** -- inserção urgente

`/planejar-fase {decimal_phase}`

<sub>`/clear` primeiro -> janela de contexto fresca</sub>

---

**Também disponível:**
- Revisar impacto da inserção: Verificar se as dependências da Fase {next_integer} ainda fazem sentido
- Revisar roadmap

---
```
</step>

</process>

<anti_patterns>

- Não use isto para trabalho planejado no final do milestone (use /adicionar-fase)
- Não insira antes da Fase 1 (decimal 0.1 não faz sentido)
- Não renumere fases existentes
- Não modifique o conteúdo da fase alvo
- Não crie planos ainda (isso é /planejar-fase)
- Não commite mudanças (o usuário decide quando commitar)
</anti_patterns>

<success_criteria>
A inserção de fase está completa quando:

- [ ] `tools phase insert` executado com sucesso
- [ ] Diretório de fase criado
- [ ] Roadmap atualizado com nova entrada de fase (inclui marcador "(INSERTED)")
- [ ] STATE.md atualizado com nota de evolução do roadmap
- [ ] Usuário informado dos próximos passos e implicações de dependências
</success_criteria>
