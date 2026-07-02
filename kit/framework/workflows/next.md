<purpose>
Detectar o estado atual do projeto e avançar automaticamente para o próximo passo lógico do workflow framework.
Lê o estado do projeto para determinar a progressão: discussão → planejamento → execução → verificação → conclusão.
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="detect_state">
Ler o estado do projeto para determinar a posição atual:

```bash
# Obter snapshot do estado
node "./.claude/framework/bin/tools.cjs" state json 2>/dev/null || echo "{}"
```

Também ler:
- `.planning/STATE.md` — fase atual, progresso, contagens de planos
- `.planning/ROADMAP.md` — estrutura do milestone e lista de fases

Extrair:
- `current_phase` — qual fase está ativa
- `plan_of` / `plans_total` — progresso de execução de planos
- `progress` — percentual geral
- `status` — ativo, pausado, etc.

Se o diretório `.planning/` não existir:
```
Nenhum projeto framework detectado. Execute `/novo-projeto` para começar.
```
Sair.
</step>

<step name="determine_next_action">
Aplicar regras de roteamento com base no estado:

**Rota 1: Nenhuma fase existe ainda → discussão**
Se o ROADMAP tem fases mas nenhum diretório de fase existe no disco:
→ Próxima ação: `/discutir-fase <primeira-fase>`

**Rota 2: Fase existe mas não tem CONTEXT.md ou RESEARCH.md → discussão**
Se o diretório da fase atual existe mas não tem CONTEXT.md nem RESEARCH.md:
→ Próxima ação: `/discutir-fase <fase-atual>`

**Rota 3: Fase tem contexto mas sem planos → planejamento**
Se a fase atual tem CONTEXT.md (ou RESEARCH.md) mas nenhum arquivo PLAN.md:
→ Próxima ação: `/planejar-fase <fase-atual>`

**Rota 4: Fase tem planos mas summaries incompletos → execução**
Se planos existem mas nem todos têm summaries correspondentes:
→ Próxima ação: `/executar-fase <fase-atual>`

**Rota 5: Todos os planos têm summaries → verificar e concluir**
Se todos os planos na fase atual têm summaries:
→ Próxima ação: `/verificar-trabalho` então `/complete-phase`

**Rota 6: Fase concluída, próxima fase existe → avançar**
Se a fase atual está concluída e a próxima fase existe no ROADMAP:
→ Próxima ação: `/discutir-fase <proxima-fase>`

**Rota 7: Todas as fases concluídas → concluir milestone**
Se todas as fases estão concluídas:
→ Próxima ação: `/concluir-marco`

**Rota 8: Pausado → retomar**
Se STATE.md mostra paused_at:
→ Próxima ação: `/retomar-trabalho`
</step>

<step name="show_and_execute">
Exibir a determinação:

```
## framework Próximo

**Atual:** Fase [N] — [nome] | [progresso]%
**Status:** [descrição do status]

▶ **Próximo passo:** `/[comando] [args]`
  [Explicação em uma linha de por que este é o próximo passo]
```

Então invocar imediatamente o comando determinado via SlashCommand.
Não pedir confirmação — o objetivo do `/proximo` é avanço sem fricção.
</step>

</process>

<success_criteria>
- [ ] Estado do projeto detectado corretamente
- [ ] Próxima ação determinada corretamente pelas regras de roteamento
- [ ] Comando invocado imediatamente sem confirmação do usuário
- [ ] Status claro mostrado antes de invocar
</success_criteria>
