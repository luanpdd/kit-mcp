<purpose>
Executar uma tarefa trivial inline sem sobrecarga de subagentes. Sem PLAN.md, sem spawning de Task, sem pesquisa, sem verificação de plano. Apenas: entender → fazer → commitar → registrar.

Para tarefas como: corrigir um typo, atualizar um valor de config, adicionar um import ausente, renomear uma variável, commitar trabalho não commitado, adicionar uma entrada no .gitignore, incrementar um número de versão.

Use /expresso para qualquer coisa que precise de planejamento em múltiplas etapas ou pesquisa.
</purpose>

<process>

<step name="parse_task">
Analisar `$ARGUMENTS` para a descrição da tarefa.

Se vazio, perguntar:
```
Qual é a correção rápida? (uma frase)
```

Armazenar como `$TASK`.
</step>

<step name="scope_check">
**Antes de fazer qualquer coisa, verificar se isso é realmente trivial.**

Uma tarefa é trivial se pode ser concluída em:
- ≤ 3 edições de arquivo
- ≤ 1 minuto de trabalho
- Sem novas dependências ou mudanças de arquitetura
- Sem pesquisa necessária

Se a tarefa parece não trivial (refatoração multi-arquivo, nova feature, precisa de pesquisa), dizer:

```
Isso parece precisar de planejamento. Use /expresso em vez disso:
  /expresso "{descrição da tarefa}"
```

E parar.
</step>

<step name="execute_inline">
Fazer o trabalho diretamente:

1. Ler o(s) arquivo(s) relevante(s)
2. Fazer a(s) mudança(s)
3. Verificar se a mudança funciona (rodar testes existentes se aplicável, ou fazer uma verificação rápida)

**Sem PLAN.md.** Apenas fazer.
</step>

<step name="commit">
Commitar a mudança atomicamente:

```bash
git add -A
git commit -m "fix: {descrição concisa do que mudou}"
```

Usar formato de commit convencional: `fix:`, `feat:`, `docs:`, `chore:`, `refactor:` conforme adequado.
</step>

<step name="log_to_state">
Se `.planning/STATE.md` existir, adicionar à tabela "Quick Tasks Completed".
Se a tabela não existir, pular este passo silenciosamente.

```bash
# Verificar se STATE.md tem tabela de tarefas rápidas
if grep -q "Quick Tasks Completed" .planning/STATE.md 2>/dev/null; then
  # Adicionar entrada — o workflow gerencia o formato
  echo "| $(date +%Y-%m-%d) | fast | $TASK | ✅ |" >> .planning/STATE.md
fi
```
</step>

<step name="done">
Relatar conclusão:

```
✅ Concluído: {o que foi alterado}
   Commit: {hash curto}
   Arquivos: {lista de arquivos alterados}
```

Sem sugestões de próximos passos. Sem roteamento de workflow. Apenas concluído.
</step>

</process>

<guardrails>
- NUNCA spawnar uma Task/subagente — isso roda inline
- NUNCA criar arquivos PLAN.md ou SUMMARY.md
- NUNCA executar pesquisa ou verificação de plano
- Se a tarefa levar mais de 3 edições de arquivo, PARE e redirecione para /expresso
- Se não souber como implementar, PARE e redirecione para /expresso
</guardrails>

<success_criteria>
- [ ] Tarefa concluída no contexto atual (sem subagentes)
- [ ] Commit git atômico com mensagem convencional
- [ ] STATE.md atualizado se existir
- [ ] Operação total abaixo de 2 minutos de tempo real
</success_criteria>
