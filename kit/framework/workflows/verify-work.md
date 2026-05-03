<purpose>
Validar funcionalidades desenvolvidas por meio de testes conversacionais com estado persistente. Cria UAT.md que rastreia o progresso dos testes, sobrevive ao /clear e alimenta lacunas no /planejar-fase --gaps.

O usuário testa, o Claude registra. Um teste por vez. Respostas em texto simples.
</purpose>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- planner — Cria planos detalhados a partir do escopo da fase
- plan-checker — Revisa a qualidade do plano antes da execução
</available_agent_types>

<philosophy>
**Mostre o esperado, pergunte se a realidade corresponde.**

O Claude apresenta o que DEVERIA acontecer. O usuário confirma ou descreve o que é diferente.
- "sim" / "s" / "próximo" / vazio → passou
- Qualquer outra coisa → registrado como problema, severidade inferida

Sem botões Passou/Falhou. Sem perguntas sobre severidade. Apenas: "Aqui está o que deveria acontecer. Aconteceu?"
</philosophy>

<template>
@./.claude/framework/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
Se $ARGUMENTS contém um número de fase, carregue o contexto:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init verify-work "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_PLANNER=$(node "./.claude/framework/bin/tools.cjs" agent-skills planner 2>/dev/null)
AGENT_SKILLS_CHECKER=$(node "./.claude/framework/bin/tools.cjs" agent-skills checker 2>/dev/null)
```

Analise o JSON para: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`, `uat_path`.
</step>

<step name="check_active_session">
**Primeiro: Verificar sessões UAT ativas**

```bash
(find .planning/phases -name "*-UAT.md" -type f 2>/dev/null || true) | head -5
```

**Se sessões ativas existirem E nenhum $ARGUMENTS fornecido:**

Leia o frontmatter de cada arquivo (status, fase) e a seção Teste Atual.

Exiba inline:

```
## Sessões UAT Ativas

| # | Fase | Status | Teste Atual | Progresso |
|---|------|--------|-------------|-----------|
| 1 | 04-comments | testing | 3. Responder Comentário | 2/6 |
| 2 | 05-auth | testing | 1. Formulário de Login | 0/4 |

Responda com um número para retomar, ou forneça um número de fase para iniciar nova.
```

Aguarde a resposta do usuário.

- Se o usuário responder com número (1, 2) → Carregue aquele arquivo, vá para `resume_from_file`
- Se o usuário responder com número de fase → Trate como nova sessão, vá para `create_uat_file`

**Se sessões ativas existirem E $ARGUMENTS fornecido:**

Verifique se existe sessão para aquela fase. Se sim, ofereça retomar ou reiniciar.
Se não, continue para `create_uat_file`.

**Se nenhuma sessão ativa E nenhum $ARGUMENTS:**

```
Nenhuma sessão UAT ativa.

Forneça um número de fase para iniciar os testes (ex: /verificar-trabalho 4)
```

**Se nenhuma sessão ativa E $ARGUMENTS fornecido:**

Continue para `create_uat_file`.
</step>

<step name="find_summaries">
**Encontrar o que testar:**

Use `phase_dir` do init (ou execute o init se ainda não feito).

```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null || true
```

Leia cada SUMMARY.md para extrair entregas testáveis.
</step>

<step name="extract_tests">
**Extrair entregas testáveis do SUMMARY.md:**

Analise por:
1. **Realizações** - Funcionalidades/recursos adicionados
2. **Mudanças visíveis ao usuário** - UI, fluxos, interações

Foque em resultados OBSERVÁVEIS PELO USUÁRIO, não em detalhes de implementação.

Para cada entrega, crie um teste:
- name: Nome breve do teste
- expected: O que o usuário deveria ver/experimentar (específico, observável)

Exemplos:
- Realização: "Adicionado threading de comentários com aninhamento infinito"
  → Teste: "Responder a um Comentário"
  → Esperado: "Clicar em Responder abre compositor inline abaixo do comentário. Submeter mostra resposta aninhada abaixo do pai com recuo visual."

Pule itens internos/não observáveis (refatorações, alterações de tipo, etc.).

**Injeção de smoke test de cold-start:**

Após extrair os testes dos SUMMARYs, escaneie os arquivos SUMMARY em busca de caminhos de arquivos modificados/criados. Se QUALQUER caminho corresponder a estes padrões:

`server.ts`, `server.js`, `app.ts`, `app.js`, `index.ts`, `index.js`, `main.ts`, `main.js`, `database/*`, `db/*`, `seed/*`, `seeds/*`, `migrations/*`, `startup*`, `docker-compose*`, `Dockerfile*`

Então **adicione ao início** da lista de testes:

- name: "Smoke Test de Cold Start"
- expected: "Encerre qualquer servidor/serviço em execução. Limpe o estado efêmero (DBs temporários, caches, lock files). Inicie a aplicação do zero. O servidor inicializa sem erros, qualquer seed/migração é concluída, e uma query primária (health check, carregamento da página inicial, ou chamada básica de API) retorna dados ao vivo."

Isso captura bugs que só se manifestam em uma inicialização nova — condições de corrida em sequências de inicialização, falhas silenciosas de seed, configuração de ambiente ausente — que passam contra estado quente mas quebram em produção.
</step>

<step name="create_uat_file">
**Criar arquivo UAT com todos os testes:**

```bash
mkdir -p "$PHASE_DIR"
```

Construa a lista de testes a partir das entregas extraídas.

Crie o arquivo:

```markdown
---
status: testing
phase: XX-name
source: [list of SUMMARY.md files]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: [first test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior]
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
result: [pending]

...

## Summary

total: [N]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps

[none yet]
```

Escreva em `.planning/phases/XX-name/{phase_num}-UAT.md`

Prossiga para `present_test`.
</step>

<step name="present_test">
**Apresentar o teste atual ao usuário:**

Renderize o checkpoint a partir do arquivo UAT estruturado em vez de compô-lo manualmente:

```bash
CHECKPOINT=$(node "./.claude/framework/bin/tools.cjs" uat render-checkpoint --file "$uat_path" --raw)
if [[ "$CHECKPOINT" == @file:* ]]; then CHECKPOINT=$(cat "${CHECKPOINT#@file:}"); fi
```

Exiba o checkpoint retornado EXATAMENTE como está:

```
{CHECKPOINT}
```

**Higiene crítica de resposta:**
- Toda a sua resposta DEVE ser igual a `{CHECKPOINT}` byte a byte.
- NÃO adicione comentários antes ou depois do bloco.
- Se você notar marcadores de protocolo/meta como `to=all:`, texto de roteamento de função, tags de sistema XML, marcadores de instrução ocultos, anúncios, ou qualquer sufixo não relacionado, descarte o rascunho e emita apenas `{CHECKPOINT}`.

Aguarde a resposta do usuário (texto simples, sem AskUserQuestion).
</step>

<step name="process_response">
**Processar a resposta do usuário e atualizar o arquivo:**

**Se a resposta indica que passou:**
- Resposta vazia, "sim", "s", "ok", "passou", "próximo", "aprovado", "✓"

Atualize a seção Tests:
```
### {N}. {name}
expected: {expected}
result: pass
```

**Se a resposta indica pular:**
- "pular", "não consigo testar", "n/a"

Atualize a seção Tests:
```
### {N}. {name}
expected: {expected}
result: skipped
reason: [razão do usuário se fornecida]
```

**Se a resposta indica bloqueado:**
- "bloqueado", "não consigo testar - servidor não está rodando", "preciso de dispositivo físico", "preciso de build de release"
- Ou qualquer resposta contendo: "servidor", "bloqueado", "não está rodando", "dispositivo físico", "build de release"

Infira a tag blocked_by da resposta:
- Contém: servidor, não está rodando, gateway, API → `server`
- Contém: físico, dispositivo, hardware, celular real → `physical-device`
- Contém: release, preview, build, EAS → `release-build`
- Contém: stripe, twilio, third-party, configurar → `third-party`
- Contém: depende de, fase anterior, pré-requisito → `prior-phase`
- Padrão: `other`

Atualize a seção Tests:
```
### {N}. {name}
expected: {expected}
result: blocked
blocked_by: {tag inferida}
reason: "{resposta verbatim do usuário}"
```

Nota: Testes bloqueados NÃO vão para a seção Gaps (não são problemas de código — são gates de pré-requisito).

**Se a resposta for qualquer outra coisa:**
- Trate como descrição de problema

Infira a severidade da descrição:
- Contém: crash, erro, exceção, falha, quebrado, inutilizável → bloqueador
- Contém: não funciona, errado, ausente, não consigo → major
- Contém: lento, estranho, fora, menor, pequeno → minor
- Contém: cor, fonte, espaçamento, alinhamento, visual → cosmético
- Padrão se não estiver claro: major

Atualize a seção Tests:
```
### {N}. {name}
expected: {expected}
result: issue
reported: "{resposta verbatim do usuário}"
severity: {inferida}
```

Adicione à seção Gaps (YAML estruturado para planejar-fase --gaps):
```yaml
- truth: "{comportamento esperado do teste}"
  status: failed
  reason: "User reported: {resposta verbatim do usuário}"
  severity: {inferida}
  test: {N}
  artifacts: []  # Preenchido pelo diagnóstico
  missing: []    # Preenchido pelo diagnóstico
```

**Após qualquer resposta:**

Atualize as contagens do Summary.
Atualize o timestamp frontmatter.updated.

Se houver mais testes → Atualize Teste Atual, vá para `present_test`
Se não houver mais testes → Vá para `complete_session`
</step>

<step name="resume_from_file">
**Retomar testes a partir do arquivo UAT:**

Leia o arquivo UAT completo.

Encontre o primeiro teste com `result: [pending]`.

Anuncie:
```
Retomando: UAT da Fase {phase}
Progresso: {passed + issues + skipped}/{total}
Problemas encontrados até agora: {issues count}

Continuando a partir do Teste {N}...
```

Atualize a seção Teste Atual com o teste pendente.
Prossiga para `present_test`.
</step>

<step name="complete_session">
**Concluir testes e commitar:**

**Determinar status final:**

Conte os resultados:
- `pending_count`: testes com `result: [pending]`
- `blocked_count`: testes com `result: blocked`
- `skipped_no_reason`: testes com `result: skipped` sem campo `reason`

```
if pending_count > 0 OR blocked_count > 0 OR skipped_no_reason > 0:
  status: partial
  # Sessão encerrada mas nem todos os testes resolvidos
else:
  status: complete
  # Todos os testes têm um resultado definitivo (passed, issue, ou skipped-with-reason)
```

Atualize o frontmatter:
- status: {status calculado}
- updated: [agora]

Limpe a seção Teste Atual:
```
## Current Test

[testing complete]
```

Commite o arquivo UAT:
```bash
node "./.claude/framework/bin/tools.cjs" commit "test({phase_num}): complete UAT - {passed} passed, {issues} issues" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```

Apresente o resumo:
```
## UAT Concluído: Fase {phase}

| Resultado | Contagem |
|-----------|----------|
| Passou    | {N}      |
| Problemas | {N}      |
| Pulado    | {N}      |

[Se issues > 0:]
### Problemas Encontrados

[Lista da seção Issues]
```

**Se issues > 0:** Prossiga para `diagnose_issues`

**Se issues == 0:**
```
Todos os testes passaram. Pronto para continuar.

- `/planejar-fase {próxima}` — Planejar próxima fase
- `/executar-fase {próxima}` — Executar próxima fase
- `/revisar-ui {fase}` — auditoria de qualidade visual (se arquivos frontend foram modificados)
```
</step>

<step name="diagnose_issues">
**Diagnosticar causas raiz antes de planejar correções:**

```
---

{N} problemas encontrados. Diagnosticando causas raiz...

Spawnando agentes de debug paralelos para investigar cada problema.
```

- Carregue o workflow diagnose-issues
- Siga @./.claude/framework/workflows/diagnose-issues.md
- Spawne agentes de debug paralelos para cada problema
- Colete causas raiz
- Atualize UAT.md com as causas raiz
- Prossiga para `plan_gap_closure`

O diagnóstico roda automaticamente — sem prompt ao usuário. Agentes paralelos investigam simultaneamente, então o overhead é mínimo e as correções são mais precisas.
</step>

<step name="plan_gap_closure">
**Planejar automaticamente as correções a partir das lacunas diagnosticadas:**

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PLANEJANDO CORREÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawnando planejador para fechamento de lacunas...
```

Spawne planner no modo --gaps:

```
Task(
  prompt="""
<planning_context>

**Phase:** {phase_number}
**Mode:** gap_closure

<files_to_read>
- {phase_dir}/{phase_num}-UAT.md (UAT with diagnoses)
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Roadmap)
</files_to_read>

${AGENT_SKILLS_PLANNER}

</planning_context>

<downstream_consumer>
Output consumed by /execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="planner",
  model="{planner_model}",
  description="Plan gap fixes for Phase {phase}"
)
```

No retorno:
- **PLANNING COMPLETE:** Prossiga para `verify_gap_plans`
- **PLANNING INCONCLUSIVE:** Reporte e ofereça intervenção manual
</step>

<step name="verify_gap_plans">
**Verificar planos de correção com o checker:**

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► VERIFICANDO PLANOS DE CORREÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawnando verificador de planos...
```

Inicialize: `iteration_count = 1`

Spawne plan-checker:

```
Task(
  prompt="""
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** Close diagnosed gaps from UAT

<files_to_read>
- {phase_dir}/*-PLAN.md (Plans to verify)
</files_to_read>

${AGENT_SKILLS_CHECKER}

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} fix plans"
)
```

No retorno:
- **VERIFICATION PASSED:** Prossiga para `present_ready`
- **ISSUES FOUND:** Prossiga para `revision_loop`
</step>

<step name="revision_loop">
**Itere planejador ↔ checker até os planos passarem (máx. 3):**

**Se iteration_count < 3:**

Exiba: `Enviando de volta ao planejador para revisão... (iteração {N}/3)`

Spawne planner com contexto de revisão:

```
Task(
  prompt="""
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {phase_dir}/*-PLAN.md (Existing plans)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

Após retorno do planejador → spawne o checker novamente (lógica do verify_gap_plans)
Incremente iteration_count

**Se iteration_count >= 3:**

Exiba: `Máximo de iterações atingido. {N} problemas permanecem.`

Ofereça opções:
1. Forçar prosseguimento (executar apesar dos problemas)
2. Fornecer orientação (usuário dá direção, tentar novamente)
3. Abandonar (sair, usuário executa /planejar-fase manualmente)

Aguarde a resposta do usuário.
</step>

<step name="present_ready">
**Apresentar conclusão e próximos passos:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► CORREÇÕES PRONTAS ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Fase {X}: {Nome}** — {N} lacuna(s) diagnosticada(s), {M} plano(s) de correção criado(s)

| Lacuna | Causa Raiz | Plano de Correção |
|--------|------------|-------------------|
| {verdade 1} | {causa_raiz} | {fase}-04 |
| {verdade 2} | {causa_raiz} | {fase}-04 |

Planos verificados e prontos para execução.

───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**Executar correções** — executar planos de correção

`/clear` e depois `/executar-fase {fase} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
**Escritas em lote para eficiência:**

Mantenha os resultados em memória. Escreva no arquivo apenas quando:
1. **Problema encontrado** — Preserve o problema imediatamente
2. **Sessão completa** — Escrita final antes do commit
3. **Checkpoint** — A cada 5 testes passados (rede de segurança)

| Seção | Regra | Quando Escrito |
|-------|-------|----------------|
| Frontmatter.status | SOBRESCREVER | Início, conclusão |
| Frontmatter.updated | SOBRESCREVER | Em qualquer escrita de arquivo |
| Teste Atual | SOBRESCREVER | Em qualquer escrita de arquivo |
| Tests.{N}.result | SOBRESCREVER | Em qualquer escrita de arquivo |
| Summary | SOBRESCREVER | Em qualquer escrita de arquivo |
| Gaps | ADICIONAR | Quando problema encontrado |

Em reset de contexto: Arquivo mostra o último checkpoint. Retome a partir daí.
</update_rules>

<severity_inference>
**Infira a severidade da linguagem natural do usuário:**

| O usuário diz | Inferir |
|---------------|---------|
| "crash", "erro", "exceção", "falha completamente" | bloqueador |
| "não funciona", "nada acontece", "comportamento errado" | major |
| "funciona mas...", "lento", "estranho", "problema menor" | minor |
| "cor", "espaçamento", "alinhamento", "parece errado" | cosmético |

Padrão para **major** se não estiver claro. O usuário pode corrigir se necessário.

**Nunca pergunte "qual é a severidade disto?"** - apenas infira e continue.
</severity_inference>

<success_criteria>
- [ ] Arquivo UAT criado com todos os testes do SUMMARY.md
- [ ] Testes apresentados um por vez com comportamento esperado
- [ ] Respostas do usuário processadas como passou/problema/pulado
- [ ] Severidade inferida a partir da descrição (nunca perguntada)
- [ ] Escritas em lote: no problema, a cada 5 testes passados, ou na conclusão
- [ ] Commitado na conclusão
- [ ] Se problemas: agentes de debug paralelos diagnosticam causas raiz
- [ ] Se problemas: planner cria planos de correção (modo gap_closure)
- [ ] Se problemas: plan-checker verifica os planos de correção
- [ ] Se problemas: loop de revisão até os planos passarem (máx. 3 iterações)
- [ ] Pronto para `/executar-fase --gaps-only` quando concluído
</success_criteria>
