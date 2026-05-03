<purpose>
Remove uma fase futura não iniciada do roadmap do projeto, exclui seu diretório, renumera todas as fases subsequentes para manter uma sequência linear limpa e commita a mudança. O commit git serve como registro histórico da remoção.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="parse_arguments">
Analise os argumentos do comando:
- O argumento é o número da fase a remover (inteiro ou decimal)
- Exemplo: `/remover-fase 17` → fase = 17
- Exemplo: `/remover-fase 16.1` → fase = 16.1

Se nenhum argumento fornecido:

```
ERRO: Número de fase obrigatório
Uso: /remover-fase <número-da-fase>
Exemplo: /remover-fase 17
```

Encerre.
</step>

<step name="init_context">
Carregue o contexto de operação de fase:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${target}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extraia: `phase_found`, `phase_dir`, `phase_number`, `commit_docs`, `roadmap_exists`.

Leia também o conteúdo do STATE.md e ROADMAP.md para analisar a posição atual.
</step>

<step name="validate_future_phase">
Verifique se a fase é uma fase futura (não iniciada):

1. Compare a fase alvo com a fase atual do STATE.md
2. O alvo deve ser > número da fase atual

Se alvo <= fase atual:

```
ERRO: Não é possível remover a Fase {alvo}

Apenas fases futuras podem ser removidas:
- Fase atual: {atual}
- A Fase {alvo} é atual ou está concluída

Para abandonar o trabalho atual, use /pausar-trabalho.
```

Encerre.
</step>

<step name="confirm_removal">
Apresente o resumo da remoção e confirme:

```
Removendo Fase {alvo}: {Nome}

Isso irá:
- Excluir: .planning/phases/{alvo}-{slug}/
- Renumerar todas as fases subsequentes
- Atualizar: ROADMAP.md, STATE.md

Prosseguir? (s/n)
```

Aguarde a confirmação.
</step>

<step name="execute_removal">
**Delegue toda a operação de remoção ao tools:**

```bash
RESULT=$(node "./.claude/framework/bin/tools.cjs" phase remove "${target}")
```

Se a fase tiver planos executados (arquivos SUMMARY.md), tools retornará um erro. Use `--force` apenas se o usuário confirmar:

```bash
RESULT=$(node "./.claude/framework/bin/tools.cjs" phase remove "${target}" --force)
```

O CLI cuida de:
- Excluir o diretório da fase
- Renumerar todos os diretórios subsequentes (em ordem reversa para evitar conflitos)
- Renomear todos os arquivos dentro dos diretórios renumerados (PLAN.md, SUMMARY.md, etc.)
- Atualizar o ROADMAP.md (removendo a seção, renumerando todas as referências de fase, atualizando dependências)
- Atualizar o STATE.md (decrementando a contagem de fases)

Extraia do resultado: `removed`, `directory_deleted`, `renamed_directories`, `renamed_files`, `roadmap_updated`, `state_updated`.
</step>

<step name="commit">
Stage e commit da remoção:

```bash
node "./.claude/framework/bin/tools.cjs" commit "chore: remover fase {alvo} ({nome-original-da-fase})" --files .planning/
```

A mensagem do commit preserva o registro histórico do que foi removido.
</step>

<step name="completion">
Apresente o resumo de conclusão:

```
Fase {alvo} ({nome-original}) removida.

Mudanças:
- Excluído: .planning/phases/{alvo}-{slug}/
- Renumerados: {N} diretórios e {M} arquivos
- Atualizado: ROADMAP.md, STATE.md
- Commitado: chore: remover fase {alvo} ({nome-original})

---

## O Que Vem A Seguir

Gostaria de:
- `/progresso` — ver status do roadmap atualizado
- Continuar com a fase atual
- Revisar o roadmap

---
```
</step>

</process>

<anti_patterns>

- Não remover fases concluídas (com arquivos SUMMARY.md) sem --force
- Não remover fases atuais ou passadas
- Não renumerar manualmente — use `tools phase remove` que trata toda a renumeração
- Não adicionar notas de "fase removida" ao STATE.md — o commit git é o registro
- Não modificar diretórios de fases concluídas
</anti_patterns>

<success_criteria>
A remoção da fase está concluída quando:

- [ ] Fase alvo validada como futura/não iniciada
- [ ] `tools phase remove` executado com sucesso
- [ ] Mudanças commitadas com mensagem descritiva
- [ ] Usuário informado das mudanças
</success_criteria>
