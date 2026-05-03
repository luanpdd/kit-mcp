---
name: depurar
description: Depuração sistemática com estado persistente entre resets de contexto
argument-hint: [descrição do problema]
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Depurar problemas usando o método científico com isolamento de subagente.

**Papel do orquestrador:** Coletar sintomas, invocar agente debugger, tratar checkpoints, invocar continuações.

**Por que subagente:** Investigação consome contexto rapidamente (ler arquivos, formar hipóteses, testar). Contexto fresco de 200k por investigação. Contexto principal permanece enxuto para interação com o usuário.
</objective>

<available_agent_types>
Tipos de subagente framework válidos (usar nomes exatos — não usar 'general-purpose'):
- debugger — Diagnostica e corrige problemas
</available_agent_types>

<context>
Problema do usuário: $ARGUMENTS

Verificar sessões ativas:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>

## 0. Inicializar Contexto

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair `commit_docs` do JSON de init. Resolver modelo do depurador:
```bash
debugger_model=$(node "./.claude/framework/bin/tools.cjs" resolve-model debugger --raw)
```

## 1. Verificar Sessões Ativas

Se existirem sessões ativas E sem $ARGUMENTS:
- Listar sessões com status, hipótese, próxima ação
- Usuário escolhe número para retomar OU descreve novo problema

Se $ARGUMENTS fornecido OU usuário descreve novo problema:
- Continuar para coleta de sintomas

## 2. Coletar Sintomas (se novo problema)

Usar AskUserQuestion para cada:

1. **Comportamento esperado** - O que deveria acontecer?
2. **Comportamento atual** - O que acontece em vez disso?
3. **Mensagens de erro** - Algum erro? (colar ou descrever)
4. **Cronologia** - Quando isso começou? Já funcionou?
5. **Reprodução** - Como você aciona o problema?

Após todos coletados, confirmar pronto para investigar.

## 3. Invocar Agente debugger

Preencher prompt e invocar:

```markdown
<objective>
Investigar problema: {slug}

**Resumo:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Criar: .planning/debug/{slug}.md
</debug_file>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="debugger",
  model="{debugger_model}",
  description="Depurar {slug}"
)
```

## 4. Tratar Retorno do Agente

**Se `## CAUSA RAIZ ENCONTRADA`:**
- Exibir causa raiz e resumo de evidências
- Oferecer opções:
  - "Corrigir agora" - invocar subagente de correção
  - "Planejar correção" - sugerir /planejar-fase --gaps
  - "Correção manual" - concluído

**Se `## CHECKPOINT ATINGIDO`:**
- Apresentar detalhes do checkpoint ao usuário
- Obter resposta do usuário
- Se tipo de checkpoint for `human-verify`:
  - Se usuário confirmar corrigido: continuar para o agente finalizar/resolver/arquivar
  - Se usuário reportar problemas: continuar para o agente retornar à investigação/correção
- Invocar agente de continuação (ver passo 5)

**Se `## INVESTIGAÇÃO INCONCLUSIVA`:**
- Mostrar o que foi verificado e eliminado
- Oferecer opções:
  - "Continuar investigando" - invocar novo agente com contexto adicional
  - "Investigação manual" - concluído
  - "Adicionar mais contexto" - coletar mais sintomas, invocar novamente

## 5. Invocar Agente de Continuação (Após Checkpoint)

Quando usuário responde ao checkpoint, invocar agente fresco:

```markdown
<objective>
Continuar depuração de {slug}. Evidências estão no arquivo de depuração.
</objective>

<prior_state>
<files_to_read>
- .planning/debug/{slug}.md (Estado da sessão de depuração)
</files_to_read>
</prior_state>

<checkpoint_response>
**Tipo:** {checkpoint_type}
**Resposta:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="debugger",
  model="{debugger_model}",
  description="Continuar depuração {slug}"
)
```

</process>

<success_criteria>
- [ ] Sessões ativas verificadas
- [ ] Sintomas coletados (se novo)
- [ ] debugger invocado com contexto
- [ ] Checkpoints tratados corretamente
- [ ] Causa raiz confirmada antes de corrigir
</success_criteria>
