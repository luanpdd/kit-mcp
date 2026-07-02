<purpose>
Validar a integridade do diretório `.planning/` e relatar problemas acionáveis. Verifica arquivos ausentes, configurações inválidas, estado inconsistente e planos órfãos. Opcionalmente repara problemas com correção automática.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="parse_args">
**Analisar argumentos:**

Verificar se a flag `--repair` está presente nos argumentos do comando.

```
REPAIR_FLAG=""
if arguments contain "--repair"; then
  REPAIR_FLAG="--repair"
fi
```
</step>

<step name="run_health_check">
**Executar validação de saúde:**

```bash
node "./.claude/framework/bin/tools.cjs" validate health $REPAIR_FLAG
```

Analisar saída JSON:
- `status`: "healthy" | "degraded" | "broken"
- `errors[]`: Problemas críticos (code, message, fix, repairable)
- `warnings[]`: Problemas não críticos
- `info[]`: Notas informativas
- `repairable_count`: Número de problemas com correção automática
- `repairs_performed[]`: Ações tomadas se --repair foi usado
</step>

<step name="format_output">
**Formatar e exibir resultados:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework Verificação de Saúde
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: SAUDÁVEL | DEGRADADO | QUEBRADO
Erros: N | Avisos: N | Info: N
```

**Se reparos foram realizados:**
```
## Reparos Realizados

- ✓ config.json: Criado com padrões
- ✓ STATE.md: Regenerado a partir do roadmap
```

**Se erros existirem:**
```
## Erros

- [E001] config.json: Erro de análise JSON na linha 5
  Correção: Execute /saude --repair para redefinir para padrões

- [E002] PROJECT.md não encontrado
  Correção: Execute /novo-projeto para criar
```

**Se avisos existirem:**
```
## Avisos

- [W002] STATE.md referencia fase 5, mas apenas as fases 1-3 existem
  Correção: Revise STATE.md manualmente antes de alterá-lo; o reparo não substituirá um STATE.md existente

- [W005] Diretório de fase "1-setup" não segue o formato NN-name
  Correção: Renomear para corresponder ao padrão (ex: 01-setup)
```

**Se info existir:**
```
## Info

- [I001] 02-implementation/02-01-PLAN.md não tem SUMMARY.md
  Nota: Pode estar em andamento
```

**Rodapé (se problemas reparáveis existirem e --repair NÃO foi usado):**
```
---
N problemas podem ser auto-reparados. Execute: /saude --repair
```
</step>

<step name="offer_repair">
**Se problemas reparáveis existirem e --repair NÃO foi usado:**

Perguntar ao usuário se quer executar reparos:

```
Deseja executar /saude --repair para corrigir N problemas automaticamente?
```

Se sim, re-executar com flag --repair e exibir resultados.
</step>

<step name="verify_repairs">
**Se reparos foram realizados:**

Re-executar verificação de saúde sem --repair para confirmar que os problemas foram resolvidos:

```bash
node "./.claude/framework/bin/tools.cjs" validate health
```

Relatar status final.
</step>

</process>

<error_codes>

| Código | Severidade | Descrição | Reparável |
|--------|------------|-----------|-----------|
| E001 | error | Diretório .planning/ não encontrado | Não |
| E002 | error | PROJECT.md não encontrado | Não |
| E003 | error | ROADMAP.md não encontrado | Não |
| E004 | error | STATE.md não encontrado | Sim |
| E005 | error | Erro de análise do config.json | Sim |
| W001 | warning | PROJECT.md com seção obrigatória ausente | Não |
| W002 | warning | STATE.md referencia fase inválida | Não |
| W003 | warning | config.json não encontrado | Sim |
| W004 | warning | Valor de campo inválido no config.json | Não |
| W005 | warning | Incompatibilidade de nomenclatura de diretório de fase | Não |
| W006 | warning | Fase no ROADMAP mas sem diretório | Não |
| W007 | warning | Fase no disco mas não no ROADMAP | Não |
| W008 | warning | config.json: workflow.nyquist_validation ausente (padrão habilitado mas agentes podem pular) | Sim |
| W009 | warning | Fase tem Validation Architecture no RESEARCH.md mas sem VALIDATION.md | Não |
| I001 | info | Plano sem SUMMARY (pode estar em andamento) | Não |

</error_codes>

<repair_actions>

| Ação | Efeito | Risco |
|------|--------|-------|
| createConfig | Criar config.json com padrões | Nenhum |
| resetConfig | Deletar + recriar config.json | Perde configurações personalizadas |
| regenerateState | Criar STATE.md a partir da estrutura do ROADMAP quando está ausente | Perde histórico de sessão |
| addNyquistKey | Adicionar workflow.nyquist_validation: true ao config.json | Nenhum — corresponde ao padrão existente |

**Não reparável (muito arriscado):**
- Conteúdo de PROJECT.md, ROADMAP.md
- Renomeação de diretório de fase
- Limpeza de planos órfãos

</repair_actions>

<stale_task_cleanup>
**Específico para Windows:** Verificar diretórios de tarefas obsoletos do Claude Code que se acumulam em caso de crash/congelamento.
Estes são deixados para trás quando subagentes são forçados a encerrar e consomem espaço em disco.

Quando `--repair` está ativo, detectar e limpar:

```bash
# Verificar diretórios de tarefas obsoletos (mais antigos que 24 horas)
TASKS_DIR="./.claude/tasks"
if [ -d "$TASKS_DIR" ]; then
  STALE_COUNT=$( (find "$TASKS_DIR" -maxdepth 1 -type d -mtime +1 2>/dev/null || true) | wc -l )
  if [ "$STALE_COUNT" -gt 0 ]; then
    echo "⚠️  Encontrados $STALE_COUNT diretórios de tarefas obsoletos em ./.claude/tasks/"
    echo "   Estes são restos de sessões de subagentes que crasharam."
    echo "   Execute: rm -rf ./.claude/tasks/*  (seguro — apenas afeta sessões mortas)"
  fi
fi
```

Relatar como diagnóstico info: `I002 | info | Diretórios de tarefas de subagente obsoletos encontrados | Sim (--repair os remove)`
</stale_task_cleanup>
