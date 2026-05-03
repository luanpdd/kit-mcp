<purpose>
Criar arquivos de handoff estruturados `.planning/HANDOFF.json` e `.continue-here.md` para preservar o estado completo do trabalho entre sessões. O JSON fornece estado legível por máquina para `/retomar-trabalho`; o markdown fornece contexto legível por humanos.
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="detect">
Encontrar o diretório de fase atual a partir dos arquivos modificados mais recentemente:

```bash
# Encontrar o diretório de fase mais recente com trabalho
(ls -lt .planning/phases/*/PLAN.md 2>/dev/null || true) | head -1 | grep -oP 'phases/\K[^/]+' || true
```

Se nenhuma fase ativa detectada, perguntar ao usuário em qual fase estão pausando o trabalho.
</step>

<step name="gather">
**Coletar estado completo para handoff:**

1. **Posição atual**: Qual fase, qual plano, qual tarefa
2. **Trabalho concluído**: O que foi feito nesta sessão
3. **Trabalho restante**: O que sobrou no plano/fase atual
4. **Decisões tomadas**: Decisões-chave e raciocínio
5. **Bloqueadores/problemas**: Qualquer coisa travada
6. **Ações humanas pendentes**: Coisas que precisam de intervenção manual (configuração de MCP, chaves de API, aprovações, testes manuais)
7. **Processos em segundo plano**: Quaisquer servidores/watchers em execução que faziam parte do workflow
8. **Arquivos modificados**: O que mudou mas não foi commitado

Perguntar ao usuário por esclarecimentos se necessário via perguntas conversacionais.

**Também inspecionar arquivos SUMMARY.md por conclusões falsas:**
```bash
# Verificar conteúdo placeholder em summaries existentes
grep -l "To be filled\|placeholder\|TBD" .planning/phases/*/*.md 2>/dev/null || true
```
Reportar quaisquer summaries com conteúdo placeholder como itens incompletos.
</step>

<step name="write_structured">
**Escrever handoff estruturado em `.planning/HANDOFF.json`:**

```bash
timestamp=$(node "./.claude/framework/bin/tools.cjs" current-timestamp full --raw)
```

```json
{
  "version": "1.0",
  "timestamp": "{timestamp}",
  "phase": "{phase_number}",
  "phase_name": "{phase_name}",
  "phase_dir": "{phase_dir}",
  "plan": {current_plan_number},
  "task": {current_task_number},
  "total_tasks": {total_task_count},
  "status": "paused",
  "completed_tasks": [
    {"id": 1, "name": "{task_name}", "status": "done", "commit": "{short_hash}"},
    {"id": 2, "name": "{task_name}", "status": "done", "commit": "{short_hash}"},
    {"id": 3, "name": "{task_name}", "status": "in_progress", "progress": "{what_done}"}
  ],
  "remaining_tasks": [
    {"id": 4, "name": "{task_name}", "status": "not_started"},
    {"id": 5, "name": "{task_name}", "status": "not_started"}
  ],
  "blockers": [
    {"description": "{bloqueador}", "type": "technical|human_action|external", "workaround": "{se houver}"}
  ],
  "human_actions_pending": [
    {"action": "{o que precisa ser feito}", "context": "{por que}", "blocking": true}
  ],
  "decisions": [
    {"decision": "{o que}", "rationale": "{por que}", "phase": "{phase_number}"}
  ],
  "uncommitted_files": [],
  "next_action": "{primeira ação específica ao retomar}",
  "context_notes": "{estado mental, abordagem, o que estava pensando}"
}
```
</step>

<step name="write">
**Escrever handoff em `.planning/phases/XX-name/.continue-here.md`:**

```markdown
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: [timestamp do current-timestamp]
---

<current_state>
[Onde exatamente estamos? Contexto imediato]
</current_state>

<completed_work>

- Tarefa 1: [nome] - Concluída
- Tarefa 2: [nome] - Concluída
- Tarefa 3: [nome] - Em progresso, [o que foi feito]
</completed_work>

<remaining_work>

- Tarefa 3: [o que falta]
- Tarefa 4: Não iniciada
- Tarefa 5: Não iniciada
</remaining_work>

<decisions_made>

- Decidiu usar [X] porque [motivo]
- Escolheu [abordagem] em vez de [alternativa] porque [motivo]
</decisions_made>

<blockers>
- [Bloqueador 1]: [status/solução alternativa]
</blockers>

<context>
[Estado mental, o que estava pensando, o plano]
</context>

<next_action>
Começar com: [primeira ação específica ao retomar]
</next_action>
```

Ser específico o suficiente para que um Claude fresco entenda imediatamente.

Usar `current-timestamp` para o campo last_updated. Você pode usar init todos (que fornece timestamps) ou chamar diretamente:
```bash
timestamp=$(node "./.claude/framework/bin/tools.cjs" current-timestamp full --raw)
```
</step>

<step name="commit">
```bash
node "./.claude/framework/bin/tools.cjs" commit "wip: [phase-name] paused at task [X]/[Y]" --files .planning/phases/*/.continue-here.md .planning/HANDOFF.json
```
</step>

<step name="confirm">
```
✓ Handoff criado:
  - .planning/HANDOFF.json (estruturado, legível por máquina)
  - .planning/phases/[XX-name]/.continue-here.md (legível por humanos)

Estado atual:

- Fase: [XX-name]
- Tarefa: [X] de [Y]
- Status: [in_progress/blocked]
- Bloqueadores: [contagem] ({contagem human_actions_pending} precisam de ação humana)
- Commitado como WIP

Para retomar: /retomar-trabalho

```
</step>

</process>

<success_criteria>
- [ ] .continue-here.md criado no diretório de fase correto
- [ ] Todas as seções preenchidas com conteúdo específico
- [ ] Commitado como WIP
- [ ] Usuário sabe a localização e como retomar
</success_criteria>
