<purpose>
Executar um prompt de fase (PLAN.md) e criar o resumo do resultado (SUMMARY.md).
</purpose>

<required_reading>
Ler STATE.md antes de qualquer operação para carregar contexto do projeto.
Ler config.json para configurações de comportamento de planejamento.

@./.claude/framework/references/git-integration.md
</required_reading>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- executor — Executa tarefas do plano, commits, cria SUMMARY.md
</available_agent_types>

<process>

<step name="init_context" priority="first">
Carregar contexto de execução (apenas caminhos para minimizar contexto do orquestrador):

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init execute-phase "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair do JSON do init: `executor_model`, `commit_docs`, `sub_repos`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`, `state_path`, `config_path`.

Se `.planning/` ausente: erro.
</step>

<step name="identify_plan">
```bash
# Usar plans/summaries do JSON INIT, ou listar arquivos
(ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null || true) | sort
(ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null || true) | sort
```

Encontrar o primeiro PLAN sem SUMMARY correspondente. Fases decimais suportadas (`01.1-hotfix/`):

```bash
PHASE=$(echo "$PLAN_PATH" | grep -oE '[0-9]+(\.[0-9]+)?-[0-9]+')
# configurações de config podem ser obtidas via tools config-get se necessário
```

<if mode="yolo">
Auto-aprovar: `⚡ Executar {phase}-{plan}-PLAN.md [Plano X de Y para Fase Z]` → parse_segments.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
Apresentar identificação do plano, aguardar confirmação.
</if>
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<step name="parse_segments">
```bash
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**Roteamento por tipo de checkpoint:**

| Checkpoints | Padrão | Execução |
|-------------|--------|----------|
| Nenhum | A (autônomo) | Subagente único: plano completo + SUMMARY + commit |
| Somente Verify | B (segmentado) | Segmentos entre checkpoints. Após none/human-verify → SUBAGENTE. Após decision/human-action → MAIN |
| Decision | C (main) | Executar inteiramente no contexto main |

**Padrão A:** init_agent_tracking → criar Task(subagent_type="executor", model=executor_model, isolation="worktree") com prompt: executar plano em [caminho], autônomo, todas as tarefas + SUMMARY + commit, seguir regras de desvio/auth, reportar: nome do plano, tarefas, caminho do SUMMARY, hash do commit → rastrear agent_id → aguardar → atualizar rastreamento → reportar.

**Padrão B:** Executar segmento por segmento. Segmentos autônomos: criar subagente para tarefas atribuídas apenas (sem SUMMARY/commit). Checkpoints: contexto main. Após todos os segmentos: agregar, criar SUMMARY, commitar. Ver segment_execution.

**Padrão C:** Executar no main usando fluxo padrão (step name="execute").

Contexto fresco por subagente preserva qualidade máxima. Contexto main permanece enxuto.
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
rm -f .planning/current-agent-id.txt
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

Se interrompido: perguntar ao usuário para retomar (parâmetro `resume` do Task) ou começar do zero.

**Protocolo de rastreamento:** Ao criar: escrever agent_id em `current-agent-id.txt`, anexar em agent-history.json: `{"agent_id":"[id]","task_description":"[desc]","phase":"[phase]","plan":"[plan]","segment":[num|null],"timestamp":"[ISO]","status":"spawned","completion_timestamp":null}`. Ao concluir: status → "completed", definir completion_timestamp, deletar current-agent-id.txt. Podar: se entries > max_entries, remover o mais antigo "completed" (nunca "spawned").

Executar para Padrão A/B antes de criar. Padrão C: pular.
</step>

<step name="segment_execution">
Somente Padrão B (checkpoints verify-only). Pular para A/C.

1. Analisar mapa de segmento: localizações e tipos de checkpoint
2. Por segmento:
   - Rota de subagente: criar executor para tarefas atribuídas apenas. Prompt: intervalo de tarefas, caminho do plano, ler plano completo para contexto, executar tarefas atribuídas, rastrear desvios, SEM SUMMARY/commit. Rastrear via protocolo de agente.
   - Rota main: executar tarefas usando fluxo padrão (step name="execute")
3. Após TODOS os segmentos: agregar arquivos/desvios/decisões → criar SUMMARY.md → commitar → self-check:
   - Verificar se key-files.created existem no disco com `[ -f ]`
   - Verificar se `git log --oneline --all --grep="{phase}-{plan}"` retorna ≥1 commit
   - Anexar `## Self-Check: PASSED` ou `## Self-Check: FAILED` ao SUMMARY

   **Bug conhecido do Claude Code (classifyHandoffIfNeeded):** Se algum agente de segmento reportar "falhado" com `classifyHandoffIfNeeded is not defined`, este é um bug de runtime do Claude Code — não uma falha real. Executar spot-checks; se passarem, tratar como bem-sucedido.
</step>

<step name="load_prompt">
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```
Este É o conjunto de instruções de execução. Seguir exatamente. Se o plano referenciar CONTEXT.md: honrar a visão do usuário ao longo de todo o processo.

**Se o plano contiver bloco `<interfaces>`:** Estas são definições de tipo e contratos pré-extraídos. Usá-los diretamente — NÃO re-ler os arquivos fonte para descobrir tipos. O planejador já extraiu o que você precisa.
</step>

<step name="previous_phase_check">
```bash
node "./.claude/framework/bin/tools.cjs" phases list --type summaries --raw
# Extrair o penúltimo summary do resultado JSON
```
Se SUMMARY anterior tiver bloqueadores não resolvidos em "Issues Encountered" ou "Next Phase Readiness": AskUserQuestion(header="Problemas Anteriores", options: "Prosseguir mesmo assim" | "Resolver primeiro" | "Revisar anterior").
</step>

<step name="execute">
Desvios são normais — tratar via regras abaixo.

1. Ler arquivos @context do prompt
2. **Ferramentas MCP:** Se CLAUDE.md ou instruções do projeto referenciam ferramentas MCP (ex: jCodeMunch para navegação de código), preferir sobre Grep/Glob quando disponíveis. Usar Grep/Glob como fallback se ferramentas MCP não acessíveis.
3. Por tarefa:
   - **Gate OBRIGATÓRIO read_first:** Se a tarefa tiver campo `<read_first>`, você DEVE ler cada arquivo listado ANTES de fazer qualquer edição. Não é opcional. Não pule arquivos porque você "já sabe" o que está neles — leia-os. Os arquivos read_first estabelecem a verdade base para a tarefa.
   - `type="auto"`: se `tdd="true"` → execução TDD. Implementar com regras de desvio + gates de auth. Verificar critérios de done. Commitar (ver task_commit). Rastrear hash para Summary.
   - `type="checkpoint:*"`: PARAR → checkpoint_protocol → aguardar usuário → continuar apenas após confirmação.
   - **Verificação OBRIGATÓRIA de acceptance_criteria:** Após completar cada tarefa, se ela tiver `<acceptance_criteria>`, verificar CADA critério antes de mover para a próxima tarefa. Usar grep, leituras de arquivo ou comandos CLI para confirmar cada critério. Se algum critério falhar, corrigir a implementação antes de prosseguir. Não pule critérios ou marque-os como "verificar depois".
3. Executar verificações `<verification>`
4. Confirmar que `<success_criteria>` foram atendidos
5. Documentar desvios no Summary
</step>

<authentication_gates>

## Gates de Autenticação

Erros de auth durante execução NÃO são falhas — são pontos de interação esperados.

**Indicadores:** "Not authenticated", "Unauthorized", 401/403, "Please run {tool} login", "Set {ENV_VAR}"

**Protocolo:**
1. Reconhecer gate de auth (não é um bug)
2. PARAR execução da tarefa
3. Criar checkpoint:human-action dinâmico com passos exatos de auth
4. Aguardar usuário autenticar
5. Verificar se credenciais funcionam
6. Tentar novamente a tarefa original
7. Continuar normalmente

**Exemplo:** `vercel --yes` → "Not authenticated" → checkpoint pedindo ao usuário para `vercel login` → verificar com `vercel whoami` → tentar deploy novamente → continuar

**No Summary:** Documentar como fluxo normal em "## Authentication Gates", não como desvios.

</authentication_gates>

<deviation_rules>

## Regras de Desvio

Você VAI descobrir trabalho não planejado. Aplicar automaticamente, rastrear tudo para o Summary.

| Regra | Gatilho | Ação | Permissão |
|-------|---------|------|-----------|
| **1: Bug** | Comportamento quebrado, erros, queries erradas, erros de tipo, vulns de segurança, race conditions, vazamentos | Corrigir → testar → verificar → rastrear `[Regra 1 - Bug]` | Auto |
| **2: Crítico Faltando** | Essenciais faltando: tratamento de erros, validação, auth, CSRF/CORS, rate limiting, índices, logging | Adicionar → testar → verificar → rastrear `[Regra 2 - Crítico Faltando]` | Auto |
| **3: Bloqueante** | Impede conclusão: deps faltando, tipos errados, imports quebrados, env/config/arquivos faltando, deps circulares | Corrigir bloqueador → verificar prosseguimento → rastrear `[Regra 3 - Bloqueante]` | Auto |
| **4: Arquitetural** | Mudança estrutural: nova tabela DB, mudança de schema, novo serviço, troca de biblioteca, quebra de API, nova infra | PARAR → apresentar decisão (abaixo) → rastrear `[Regra 4 - Arquitetural]` | Perguntar usuário |

**Formato da Regra 4:**
```
⚠️ Decisão Arquitetural Necessária

Tarefa atual: [nome da tarefa]
Descoberta: [o que provocou isso]
Mudança proposta: [modificação]
Por que necessário: [raciocínio]
Impacto: [o que isso afeta]
Alternativas: [outras abordagens]

Prosseguir com mudança proposta? (sim / abordagem diferente / adiar)
```

**Prioridade:** Regra 4 (PARAR) > Regras 1-3 (auto) > incerto → Regra 4
**Casos de borda:** validação faltando → R2 | crash por null → R1 | nova tabela → R4 | nova coluna → R1/2
**Heurística:** Afeta correção/segurança/conclusão? → R1-3. Talvez? → R4.

</deviation_rules>

<deviation_documentation>

## Documentando Desvios

SUMMARY DEVE incluir seção de desvios. Nenhum? → `## Desvios do Plano\n\nNenhum - plano executado exatamente como escrito.`

Por desvio: **[Regra N - Categoria] Título** — Encontrado durante: Tarefa X | Problema | Correção | Arquivos modificados | Verificação | Hash do commit

Encerrar com: **Total de desvios:** N auto-corrigidos (detalhamento). **Impacto:** avaliação.

</deviation_documentation>

<tdd_plan_execution>
## Execução TDD

Para planos `type: tdd` — RED-GREEN-REFACTOR:

1. **Infraestrutura** (somente primeiro plano TDD): detectar projeto, instalar framework, config, verificar suite vazia
2. **RED:** Ler `<behavior>` → teste(s) falhando → executar (DEVE falhar) → commitar: `test({phase}-{plan}): add failing test for [feature]`
3. **GREEN:** Ler `<implementation>` → código mínimo → executar (DEVE passar) → commitar: `feat({phase}-{plan}): implement [feature]`
4. **REFACTOR:** Limpar → testes DEVEM passar → commitar: `refactor({phase}-{plan}): clean up [feature]`

Erros: RED não falha → investigar teste/feature existente. GREEN não passa → depurar, iterar. REFACTOR quebra → desfazer.

Ver `./.claude/framework/references/tdd.md` para estrutura.
</tdd_plan_execution>

<precommit_failure_handling>
## Tratamento de Falha de Hook Pre-commit

Seus commits podem acionar hooks pre-commit. Hooks de auto-correção se tratam transparentemente — arquivos são corrigidos e re-staged automaticamente.

**Se rodando como agente executor paralelo (criado por execute-phase):**
Usar `--no-verify` em todos os commits. Hooks pre-commit causam contenção de lock de build quando múltiplos agentes commitam simultaneamente (ex: conflitos de lock do cargo em projetos Rust). O orquestrador valida uma vez após todos os agentes concluírem.

**Se rodando como o único executor (modo sequencial):**
Se um commit for BLOQUEADO por um hook:

1. O comando `git commit` falha com saída de erro do hook
2. Ler o erro — ele diz exatamente qual hook e o que falhou
3. Corrigir o problema (erro de tipo, violação de lint, vazamento de segredo, etc.)
4. `git add` nos arquivos corrigidos
5. Tentar o commit novamente
6. Orçamento de 1-2 tentativas por commit
</precommit_failure_handling>

<task_commit>
## Protocolo de Commit de Tarefa

Após cada tarefa (verificação passou, critérios de done atendidos), commitar imediatamente.

**1. Verificar:** `git status --short`

**2. Staged individualmente** (NUNCA `git add .` ou `git add -A`):
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**3. Tipo de commit:**

| Tipo | Quando | Exemplo |
|------|--------|---------|
| `feat` | Nova funcionalidade | feat(08-02): create user registration endpoint |
| `fix` | Correção de bug | fix(08-02): correct email validation regex |
| `test` | Somente teste (TDD RED) | test(08-02): add failing test for password hashing |
| `refactor` | Sem mudança de comportamento (TDD REFACTOR) | refactor(08-02): extract validation to helper |
| `perf` | Performance | perf(08-02): add database index |
| `docs` | Documentação | docs(08-02): add API docs |
| `style` | Formatação | style(08-02): format auth module |
| `chore` | Config/deps | chore(08-02): add bcrypt dependency |

**4. Formato:** `{type}({phase}-{plan}): {description}` com bullet points para mudanças-chave.

<sub_repos_commit_flow>
**Modo sub-repos:** Se `sub_repos` estiver configurado (array não-vazio do contexto init), usar `commit-to-subrepo` em vez do git commit padrão. Isso roteia arquivos para seu sub-repo correto com base no prefixo do caminho.

```bash
node ./.claude/framework/bin/tools.cjs commit-to-subrepo "{type}({phase}-{plan}): {description}" --files file1 file2 ...
```

O comando agrupa arquivos por prefixo de sub-repo e commita atomicamente em cada um. Retorna JSON: `{ committed: true, repos: { "backend": { hash: "abc", files: [...] }, ... } }`.

Registrar hashes de cada repo na resposta para rastreamento no SUMMARY.

**Se `sub_repos` for vazio ou não definido:** Usar fluxo padrão de git commit abaixo.
</sub_repos_commit_flow>

**5. Registrar hash:**
```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
TASK_COMMITS+=("Task ${TASK_NUM}: ${TASK_COMMIT}")
```

**6. Verificar arquivos gerados não rastreados:**
```bash
git status --short | grep '^??'
```
Se novos arquivos não rastreados apareceram após executar scripts ou ferramentas, decidir para cada:
- **Commitar** — se for arquivo fonte, config ou artefato intencional
- **Adicionar ao .gitignore** — se for saída gerada/runtime (artefatos de build, arquivos `.env`, arquivos de cache, saída compilada)
- NÃO deixar arquivos gerados sem rastrear

</task_commit>

<step name="checkpoint_protocol">
Em `type="checkpoint:*"`: automatizar tudo possível primeiro. Checkpoints são apenas para verificação/decisões.

Exibir: caixa `CHECKPOINT: [Tipo]` → Progresso {X}/{Y} → Nome da tarefa → conteúdo específico do tipo → `SUA AÇÃO: [sinal]`

| Tipo | Conteúdo | Sinal de retomada |
|------|----------|-------------------|
| human-verify (90%) | O que foi construído + passos de verificação (comandos/URLs) | "approved" ou descrever problemas |
| decision (9%) | Decisão necessária + contexto + opções com prós/contras | "Select: option-id" |
| human-action (1%) | O que foi automatizado + UM passo manual + plano de verificação | "done" |

Após resposta: verificar se especificado. Passou → continuar. Falhou → informar, aguardar. AGUARDAR usuário — NÃO alucinar conclusão.

Ver ./.claude/framework/references/checkpoints.md para detalhes.
</step>

<step name="checkpoint_return_for_orchestrator">
Quando criado via Task e atingindo checkpoint: retornar estado estruturado (não pode interagir com usuário diretamente).

**Retorno necessário:** 1) Tabela de Tarefas Concluídas (hashes + arquivos) 2) Tarefa Atual (o que está bloqueando) 3) Detalhes do Checkpoint (conteúdo para o usuário) 4) Aguardando (o que é necessário do usuário)

Orquestrador analisa → apresenta ao usuário → cria continuação fresca com o estado de tarefas concluídas. Você NÃO será retomado. No contexto main: usar checkpoint_protocol acima.
</step>

<step name="verification_failure_gate">
Se a verificação falhar:

**Verificar se node repair está habilitado** (padrão: ligado):
```bash
NODE_REPAIR=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.node_repair 2>/dev/null || echo "true")
```

Se `NODE_REPAIR` for `true`: invocar `@./.claude/framework/workflows/node-repair.md` com:
- FAILED_TASK: número da tarefa, nome, done-criteria
- ERROR: resultado esperado vs atual
- PLAN_CONTEXT: nomes de tarefas adjacentes + objetivo da fase
- REPAIR_BUDGET: `workflow.node_repair_budget` da config (padrão: 2)

Node repair tentará RETRY, DECOMPOSE ou PRUNE autonomamente. Só chega neste gate novamente se o orçamento de reparo estiver esgotado (ESCALATE).

Se `NODE_REPAIR` for `false` OU reparo retornar ESCALATE: PARAR. Apresentar: "Verificação falhou para Tarefa [X]: [nome]. Esperado: [critérios]. Atual: [resultado]. Reparo tentado: [resumo do que foi tentado]." Opções: Tentar novamente | Pular (marcar incompleto) | Parar (investigar). Se pulado → SUMMARY "Issues Encountered".
</step>

<step name="record_completion_time">
```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```
</step>

<step name="generate_user_setup">
```bash
grep -A 50 "^user_setup:" .planning/phases/XX-name/{phase}-{plan}-PLAN.md | head -50
```

Se user_setup existir: criar `{phase}-USER-SETUP.md` usando template `./.claude/framework/templates/user-setup.md`. Por serviço: tabela de vars de env, checklist de configuração de conta, config do dashboard, notas de dev local, comandos de verificação. Status "Incompleto". Definir `USER_SETUP_CREATED=true`. Se vazio/ausente: pular.
</step>

<step name="create_summary">
Criar `{phase}-{plan}-SUMMARY.md` em `.planning/phases/XX-name/`. Usar `./.claude/framework/templates/summary.md`.

**Frontmatter:** phase, plan, subsystem, tags | requires/provides/affects | tech-stack.added/patterns | key-files.created/modified | key-decisions | requirements-completed (**DEVE** copiar array `requirements` do frontmatter do PLAN.md verbatim) | duration ($DURATION), completed ($PLAN_END_TIME date).

Título: `# Phase [X] Plan [Y]: [Name] Summary`

One-liner SUBSTANTIVO: "JWT auth with refresh rotation using jose library" não "Authentication implemented"

Incluir: duração, horários de início/fim, contagem de tarefas, contagem de arquivos.

Próximo: mais planos → "Pronto para {next-plan}" | último → "Fase concluída, pronto para próximo passo".
</step>

<step name="update_current_position">
Atualizar STATE.md usando tools:

```bash
# Avançar contador de planos (trata caso de borda último-plano)
node "./.claude/framework/bin/tools.cjs" state advance-plan

# Recalcular barra de progresso do estado no disco
node "./.claude/framework/bin/tools.cjs" state update-progress

# Registrar métricas de execução
node "./.claude/framework/bin/tools.cjs" state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
</step>

<step name="extract_decisions_and_issues">
Do SUMMARY: Extrair decisões e adicionar ao STATE.md:

```bash
# Adicionar cada decisão das key-decisions do SUMMARY
# Preferir entradas de arquivo para texto shell-safe (preserva `$`, `*`, etc. exatamente)
node "./.claude/framework/bin/tools.cjs" state add-decision \
  --phase "${PHASE}" --summary-file "${DECISION_TEXT_FILE}" --rationale-file "${RATIONALE_FILE}"

# Adicionar bloqueadores se encontrados
node "./.claude/framework/bin/tools.cjs" state add-blocker --text-file "${BLOCKER_TEXT_FILE}"
```
</step>

<step name="update_session_continuity">
Atualizar informações de sessão usando tools:

```bash
node "./.claude/framework/bin/tools.cjs" state record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" \
  --resume-file "None"
```

Manter STATE.md abaixo de 150 linhas.
</step>

<step name="issues_review_gate">
Se SUMMARY "Issues Encountered" ≠ "None": yolo → logar e continuar. Interativo → apresentar problemas, aguardar confirmação.
</step>

<step name="update_roadmap">
```bash
node "./.claude/framework/bin/tools.cjs" roadmap update-plan-progress "${PHASE}"
```
Conta arquivos PLAN vs SUMMARY no disco. Atualiza linha da tabela de progresso com contagem correta e status (`In Progress` ou `Complete` com data).
</step>

<step name="update_requirements">
Marcar requisitos concluídos do campo `requirements:` do frontmatter do PLAN.md:

```bash
node "./.claude/framework/bin/tools.cjs" requirements mark-complete ${REQ_IDS}
```

Extrair IDs de requisito do frontmatter do plano (ex: `requirements: [AUTH-01, AUTH-02]`). Se não houver campo requirements, pular.
</step>

<step name="git_commit_metadata">
Código de tarefa já commitado por tarefa. Commitar metadados do plano:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```
</step>

<step name="update_codebase_map">
Se .planning/codebase/ não existir: pular.

```bash
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null || true
```

Atualizar apenas mudanças estruturais: novo dir src/ → STRUCTURE.md | deps → STACK.md | padrão de arquivo → CONVENTIONS.md | cliente API → INTEGRATIONS.md | config → STACK.md | renomeado → atualizar caminhos. Pular mudanças apenas de código/bugfix/conteúdo.

```bash
node "./.claude/framework/bin/tools.cjs" commit "" --files .planning/codebase/*.md --amend
```
</step>

<step name="offer_next">
Se `USER_SETUP_CREATED=true`: exibir `⚠️ CONFIGURAÇÃO DE USUÁRIO NECESSÁRIA` com caminho + tarefas de env/config NO TOPO.

```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
```

| Condição | Rota | Ação |
|----------|------|------|
| summaries < plans | **A: Mais planos** | Encontrar próximo PLAN sem SUMMARY. Yolo: continuar automaticamente. Interativo: mostrar próximo plano, sugerir `/executar-fase {phase}` + `/verificar-trabalho`. PARAR aqui. |
| summaries = plans, atual < fase mais alta | **B: Fase concluída** | Mostrar conclusão, sugerir `/planejar-fase {Z+1}` + `/verificar-trabalho {Z}` + `/discutir-fase {Z+1}` |
| summaries = plans, atual = fase mais alta | **C: Milestone concluído** | Mostrar banner, sugerir `/concluir-marco` + `/verificar-trabalho` + `/adicionar-fase` |

Todas as rotas: `/clear` primeiro para contexto fresco.
</step>

</process>

<success_criteria>

- Todas as tarefas do PLAN.md concluídas
- Todas as verificações passaram
- USER-SETUP.md gerado se user_setup no frontmatter
- SUMMARY.md criado com conteúdo substantivo
- STATE.md atualizado (posição, decisões, problemas, sessão)
- ROADMAP.md atualizado
- Se mapa de codebase existir: mapa atualizado com mudanças de execução (ou pulado se sem mudanças significativas)
- Se USER-SETUP.md criado: destacado na saída de conclusão
</success_criteria>
