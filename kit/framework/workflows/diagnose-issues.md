<purpose>
Orquestrar agentes de depuração paralelos para investigar lacunas de UAT e encontrar causas raiz.

Após o UAT encontrar lacunas, spawnar um agente de depuração por lacuna. Cada agente investiga de forma autônoma com sintomas pré-preenchidos do UAT. Coletar causas raiz, atualizar lacunas do UAT.md com diagnóstico e repassar para plan-phase --gaps com diagnósticos reais.

O orquestrador se mantém enxuto: analisar lacunas, spawnar agentes, coletar resultados, atualizar UAT.
</purpose>

<available_agent_types>
Tipos de subagentes framework válidos (use os nomes exatos — não use 'general-purpose'):
- debugger — Diagnostica e corrige problemas
</available_agent_types>

<paths>
DEBUG_DIR=.planning/debug

Arquivos de debug usam o caminho `.planning/debug/` (diretório oculto com ponto inicial).
</paths>

<core_principle>
**Diagnosticar antes de planejar correções.**

O UAT nos diz O QUÊ está quebrado (sintomas). Agentes de debug encontram POR QUÊ (causa raiz). O plan-phase --gaps então cria correções direcionadas baseadas em causas reais, não suposições.

Sem diagnóstico: "Comentário não atualiza" → adivinhar a correção → talvez errado
Com diagnóstico: "Comentário não atualiza" → "dependência ausente no useEffect" → correção precisa
</core_principle>

<process>

<step name="parse_gaps">
**Extrair lacunas do UAT.md:**

Ler a seção "Gaps" (formato YAML):
```yaml
- truth: "Comentário aparece imediatamente após envio"
  status: failed
  reason: "Usuário relatou: funciona mas não aparece até eu recarregar a página"
  severity: major
  test: 2
  artifacts: []
  missing: []
```

Para cada lacuna, leia também o teste correspondente da seção "Tests" para obter contexto completo.

Construir lista de lacunas:
```
gaps = [
  {truth: "Comentário aparece imediatamente...", severity: "major", test_num: 2, reason: "..."},
  {truth: "Botão de resposta posicionado corretamente...", severity: "minor", test_num: 5, reason: "..."},
  ...
]
```
</step>

<step name="report_plan">
**Relatar plano de diagnóstico ao usuário:**

```
## Diagnosticando {N} Lacunas

Spawning parallel debug agents to investigate root causes:

| Lacuna (Verdade) | Severidade |
|------------------|------------|
| Comentário aparece imediatamente após envio | major |
| Botão de resposta posicionado corretamente | minor |
| Delete remove comentário | blocker |

Cada agente irá:
1. Criar DEBUG-{slug}.md com sintomas pré-preenchidos
2. Investigar de forma autônoma (ler código, formular hipóteses, testar)
3. Retornar causa raiz

Isso roda em paralelo - todas as lacunas investigadas simultaneamente.
```
</step>

<step name="spawn_agents">
**Carregar habilidades do agente:**

```bash
AGENT_SKILLS_DEBUGGER=$(node "./.claude/framework/bin/tools.cjs" agent-skills debugger 2>/dev/null)
```

**Spawnar agentes de depuração em paralelo:**

Para cada lacuna, preencher o template debug-subagent-prompt e spawnar:

```
Task(
  prompt=filled_debug_subagent_prompt + "\n\n<files_to_read>\n- {phase_dir}/{phase_num}-UAT.md\n- .planning/STATE.md\n</files_to_read>\n${AGENT_SKILLS_DEBUGGER}",
  subagent_type="debugger",
  isolation="worktree",
  description="Debug: {truth_short}"
)
```

**Todos os agentes são spawnados em uma única mensagem** (execução paralela).

Placeholders do template:
- `{truth}`: O comportamento esperado que falhou
- `{expected}`: Do teste do UAT
- `{actual}`: Descrição verbatim do usuário do campo reason
- `{errors}`: Quaisquer mensagens de erro do UAT (ou "None reported")
- `{reproduction}`: "Test {test_num} in UAT"
- `{timeline}`: "Discovered during UAT"
- `{goal}`: `find_root_cause_only` (fluxo UAT - plan-phase --gaps gerencia as correções)
- `{slug}`: Gerado a partir da verdade
</step>

<step name="collect_results">
**Coletar causas raiz dos agentes:**

Cada agente retorna com:
```
## ROOT CAUSE FOUND

**Debug Session:** ${DEBUG_DIR}/{slug}.md

**Root Cause:** {causa específica com evidência}

**Evidence Summary:**
- {descoberta chave 1}
- {descoberta chave 2}
- {descoberta chave 3}

**Files Involved:**
- {arquivo1}: {o que está errado}
- {arquivo2}: {problema relacionado}

**Suggested Fix Direction:** {dica breve para plan-phase --gaps}
```

Analisar cada retorno para extrair:
- root_cause: A causa diagnosticada
- files: Arquivos envolvidos
- debug_path: Caminho para o arquivo de sessão de debug
- suggested_fix: Dica para o plano de fechamento de lacunas

Se o agente retornar `## INVESTIGATION INCONCLUSIVE`:
- root_cause: "Investigação inconclusiva - revisão manual necessária"
- Anotar qual problema precisa de atenção manual
- Incluir possibilidades restantes do retorno do agente
</step>

<step name="update_uat">
**Atualizar lacunas do UAT.md com diagnóstico:**

Para cada lacuna na seção Gaps, adicionar campos artifacts e missing:

```yaml
- truth: "Comentário aparece imediatamente após envio"
  status: failed
  reason: "Usuário relatou: funciona mas não aparece até eu recarregar a página"
  severity: major
  test: 2
  root_cause: "useEffect em CommentList.tsx com dependência commentCount ausente"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect com dependência ausente"
  missing:
    - "Adicionar commentCount ao array de dependências do useEffect"
    - "Acionar re-renderização quando novo comentário for adicionado"
  debug_session: .planning/debug/comment-not-refreshing.md
```

Atualizar status no frontmatter para "diagnosed".

Commitar o UAT.md atualizado:
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs({phase_num}): add root causes from diagnosis" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```
</step>

<step name="report_results">
**Relatar resultados do diagnóstico e repassar:**

Exibir:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► DIAGNOSIS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Lacuna (Verdade) | Causa Raiz | Arquivos |
|------------------|------------|----------|
| Comentário aparece imediatamente | dependência ausente no useEffect | CommentList.tsx |
| Botão de resposta posicionado corretamente | ordem CSS flex incorreta | ReplyButton.tsx |
| Delete remove comentário | API sem header de auth | api/comments.ts |

Sessões de debug: ${DEBUG_DIR}/

Prosseguindo para planejar correções...
```

Retornar ao orquestrador verify-work para planejamento automático.
NÃO oferecer próximos passos manuais - verify-work gerencia o restante.
</step>

</process>

<context_efficiency>
Agentes começam com sintomas pré-preenchidos do UAT (sem coleta de sintomas).
Agentes apenas diagnosticam — plan-phase --gaps gerencia as correções (sem aplicação de correções).
</context_efficiency>

<failure_handling>
**Agente falha em encontrar causa raiz:**
- Marcar lacuna como "precisa de revisão manual"
- Continuar com outras lacunas
- Relatar diagnóstico incompleto

**Agente atinge timeout:**
- Verificar DEBUG-{slug}.md para progresso parcial
- Pode retomar com /depurar

**Todos os agentes falham:**
- Algo sistêmico (permissões, git, etc.)
- Relatar para investigação manual
- Fallback para plan-phase --gaps sem causas raiz (menos preciso)
</failure_handling>

<success_criteria>
- [ ] Lacunas analisadas do UAT.md
- [ ] Agentes de depuração spawnados em paralelo
- [ ] Causas raiz coletadas de todos os agentes
- [ ] Lacunas do UAT.md atualizadas com artifacts e missing
- [ ] Sessões de debug salvas em ${DEBUG_DIR}/
- [ ] Repassar para verify-work para planejamento automático
</success_criteria>
