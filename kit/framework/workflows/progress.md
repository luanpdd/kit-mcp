<purpose>
Verificar o progresso do projeto, resumir trabalhos recentes e o que está por vir, então rotear inteligentemente para a próxima ação — seja executando um plano existente ou criando o próximo. Fornece consciência situacional antes de continuar o trabalho.
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="init_context">
**Carregar contexto de progresso (apenas caminhos):**

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init progress)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair do JSON do init: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`.

```bash
DISCUSS_MODE=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

Se `project_exists` for false (sem diretório `.planning/`):

```
Estrutura de planejamento não encontrada.

Execute /novo-projeto para iniciar um novo projeto.
```

Sair.

Se STATE.md estiver ausente: sugerir `/novo-projeto`.

**Se ROADMAP.md ausente mas PROJECT.md existir:**

Isso significa que um milestone foi concluído e arquivado. Ir para **Rota F** (entre milestones).

Se ambos ROADMAP.md e PROJECT.md estiverem ausentes: sugerir `/novo-projeto`.
</step>

<step name="load">
**Usar extração estruturada do tools:**

Em vez de ler arquivos completos, usar ferramentas direcionadas para obter apenas os dados necessários para o relatório:
- `ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)`
- `STATE=$(node "./.claude/framework/bin/tools.cjs" state-snapshot)`

Isso minimiza o uso de contexto do orquestrador.
</step>

<step name="analyze_roadmap">
**Obter análise abrangente do roadmap (substitui análise manual):**

```bash
ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)
```

Retorna JSON estruturado com:
- Todas as fases com status no disco (completo/parcial/planejado/vazio/sem_diretório)
- Objetivo e dependências por fase
- Contagens de plano e summary por fase
- Estatísticas agregadas: total de planos, summaries, percentual de progresso
- Identificação de fase atual e próxima

Usar isso em vez de ler/analisar manualmente ROADMAP.md.
</step>

<step name="recent">
**Coletar contexto de trabalho recente:**

- Encontrar os 2-3 arquivos SUMMARY.md mais recentes
- Usar `summary-extract` para análise eficiente:
  ```bash
  node "./.claude/framework/bin/tools.cjs" summary-extract <path> --fields one_liner
  ```
- Isso mostra "no que estivemos trabalhando"
</step>

<step name="position">
**Analisar posição atual do contexto init e análise do roadmap:**

- Usar `current_phase` e `next_phase` do `$ROADMAP`
- Notar `paused_at` se o trabalho foi pausado (do `$STATE`)
- Contar todos pendentes: usar `init todos` ou `list-todos`
- Verificar sessões de debug ativas: `(ls .planning/debug/*.md 2>/dev/null || true) | grep -v resolved | wc -l`
</step>

<step name="report">
**Gerar barra de progresso do tools, então apresentar relatório de status rico:**

```bash
# Obter barra de progresso formatada
PROGRESS_BAR=$(node "./.claude/framework/bin/tools.cjs" progress bar --raw)
```

Apresentar:

```
# [Nome do Projeto]

**Progresso:** {PROGRESS_BAR}
**Perfil:** [quality/balanced/budget/inherit]
**Modo de discussão:** {DISCUSS_MODE}

## Trabalho Recente
- [Fase X, Plano Y]: [o que foi realizado - 1 linha do summary-extract]
- [Fase X, Plano Z]: [o que foi realizado - 1 linha do summary-extract]

## Posição Atual
Fase [N] de [total]: [nome-da-fase]
Plano [M] de [fase-total]: [status]
CONTEXTO: [✓ se has_context | - se não]

## Decisões-Chave Tomadas
- [extrair de $STATE.decisions[]]
- [ex: jq -r '.decisions[].decision' do state-snapshot]

## Bloqueadores/Preocupações
- [extrair de $STATE.blockers[]]
- [ex: jq -r '.blockers[].text' do state-snapshot]

## Todos Pendentes
- [contagem] pendentes — /verificar-todos para revisar

## Sessões de Debug Ativas
- [contagem] ativas — /depurar para continuar
(Mostrar esta seção apenas se contagem > 0)

## O Que Vem a Seguir
[Objetivo da próxima fase/plano da análise do roadmap]
```

</step>

<step name="route">
**Determinar próxima ação com base em contagens verificadas.**

**Passo 1: Contar planos, summaries e problemas na fase atual**

Listar arquivos no diretório da fase atual:

```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true) | wc -l
```

Declarar: "Esta fase tem {X} planos, {Y} summaries."

**Passo 1.5: Verificar lacunas UAT não resolvidas**

Verificar arquivos UAT.md com status "diagnosed" (tem lacunas precisando de correções).

```bash
# Verificar UAT diagnosticado com lacunas ou parcial (teste incompleto)
grep -l "status: diagnosed\|status: partial" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true
```

Rastrear:
- `uat_with_gaps`: Arquivos UAT.md com status "diagnosed" (lacunas precisam de correção)
- `uat_partial`: Arquivos UAT.md com status "partial" (teste incompleto)

**Passo 1.6: Verificação de saúde entre fases**

Escanear TODAS as fases no milestone atual por dívida de verificação pendente usando o CLI (que respeita limites de milestone via `getMilestonePhaseFilter`):

```bash
DEBT=$(node "./.claude/framework/bin/tools.cjs" audit-uat --raw 2>/dev/null)
```

Analisar JSON para `summary.total_items` e `summary.total_files`.

Rastrear: `outstanding_debt` — `summary.total_items` da auditoria.

**Se outstanding_debt > 0:** Adicionar uma seção de aviso ao relatório de progresso (no passo `report`), colocada entre "## O Que Vem a Seguir" e a sugestão de rota:

```markdown
## Dívida de Verificação ({N} arquivos em fases anteriores)

| Fase | Arquivo | Problema |
|------|---------|---------|
| {phase} | {filename} | {pending_count} pendentes, {skipped_count} pulados, {blocked_count} bloqueados |
| {phase} | {filename} | human_needed — {count} itens |

Revisar: `/auditar-uat ${WS}` — auditoria completa entre fases
Retomar teste: `/verificar-trabalho {phase} ${WS}` — retestar fase específica
```

Isso é um AVISO, não um bloqueador — o roteamento prossegue normalmente. A dívida é visível para que o usuário possa fazer uma escolha informada.

**Passo 2: Rotear com base nas contagens**

| Condição | Significado | Ação |
|----------|-------------|------|
| uat_partial > 0 | Teste UAT incompleto | Ir para **Rota E.2** |
| uat_with_gaps > 0 | Lacunas UAT precisam de planos de correção | Ir para **Rota E** |
| summaries < plans | Planos não executados existem | Ir para **Rota A** |
| summaries = plans E plans > 0 | Fase completa | Ir para Passo 3 |
| plans = 0 | Fase ainda não planejada | Ir para **Rota B** |

---

**Rota A: Plano não executado existe**

Encontrar o primeiro PLAN.md sem SUMMARY.md correspondente.
Ler sua seção `<objective>`.

```
---

## ▶ Próximo Passo

**{phase}-{plan}: [Nome do Plano]** — [resumo do objetivo do PLAN.md]

`/executar-fase {phase} ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---
```

---

**Rota B: Fase precisa de planejamento**

Verificar se `{phase_num}-CONTEXT.md` existe no diretório da fase.

Verificar se a fase atual tem indicadores de UI:

```bash
PHASE_SECTION=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${CURRENT_PHASE}" 2>/dev/null)
PHASE_HAS_UI=$(echo "$PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**Se CONTEXT.md existir:**

```
---

## ▶ Próximo Passo

**Fase {N}: {Nome}** — {Objetivo do ROADMAP.md}
<sub>✓ Contexto coletado, pronto para planejar</sub>

`/planejar-fase {phase-number} ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---
```

**Se CONTEXT.md NÃO existir E fase tem UI (`PHASE_HAS_UI` for `true`):**

```
---

## ▶ Próximo Passo

**Fase {N}: {Nome}** — {Objetivo do ROADMAP.md}

`/discutir-fase {phase}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/fase-ui {phase}` — gerar contrato de design de UI (recomendado para fases de frontend)
- `/planejar-fase {phase}` — pular discussão, planejar diretamente
- `/listar-hipoteses-fase {phase}` — ver hipóteses do Claude

---
```

**Se CONTEXT.md NÃO existir E fase não tem UI:**

```
---

## ▶ Próximo Passo

**Fase {N}: {Nome}** — {Objetivo do ROADMAP.md}

`/discutir-fase {phase} ${WS}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/planejar-fase {phase} ${WS}` — pular discussão, planejar diretamente
- `/listar-hipoteses-fase {phase} ${WS}` — ver hipóteses do Claude

---
```

---

**Rota E: Lacunas UAT precisam de planos de correção**

UAT.md existe com lacunas (problemas diagnosticados). Usuário precisa planejar correções.

```
---

## ⚠ Lacunas UAT Encontradas

**{phase_num}-UAT.md** tem {N} lacunas requerendo correções.

`/planejar-fase {phase} --gaps ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/executar-fase {phase} ${WS}` — executar planos da fase
- `/verificar-trabalho {phase} ${WS}` — executar mais testes UAT

---
```

---

**Rota E.2: Teste UAT incompleto (parcial)**

UAT.md existe com `status: partial` — sessão de teste encerrou antes de todos os itens serem resolvidos.

```
---

## Teste UAT Incompleto

**{phase_num}-UAT.md** tem {N} testes não resolvidos (pendentes, bloqueados ou pulados).

`/verificar-trabalho {phase} ${WS}` — retomar teste de onde parou

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/auditar-uat ${WS}` — auditoria UAT completa entre fases
- `/executar-fase {phase} ${WS}` — executar planos da fase

---
```

---

**Passo 3: Verificar status do milestone (apenas quando fase completa)**

Ler ROADMAP.md e identificar:
1. Número da fase atual
2. Todos os números de fase na seção do milestone atual

Contar fases totais e identificar o número de fase mais alto.

Declarar: "Fase atual é {X}. Milestone tem {N} fases (mais alta: {Y})."

**Rotear com base no status do milestone:**

| Condição | Significado | Ação |
|----------|-------------|------|
| fase atual < fase mais alta | Mais fases restam | Ir para **Rota C** |
| fase atual = fase mais alta | Milestone completo | Ir para **Rota D** |

---

**Rota C: Fase completa, mais fases restam**

Ler ROADMAP.md para obter o nome e objetivo da próxima fase.

Verificar se a próxima fase tem indicadores de UI:

```bash
NEXT_PHASE_SECTION=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "$((Z+1))" 2>/dev/null)
NEXT_HAS_UI=$(echo "$NEXT_PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**Se próxima fase tem UI (`NEXT_HAS_UI` for `true`):**

```
---

## ✓ Fase {Z} Concluída

## ▶ Próximo Passo

**Fase {Z+1}: {Nome}** — {Objetivo do ROADMAP.md}

`/discutir-fase {Z+1}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/fase-ui {Z+1}` — gerar contrato de design de UI (recomendado para fases de frontend)
- `/planejar-fase {Z+1}` — pular discussão, planejar diretamente
- `/verificar-trabalho {Z}` — teste de aceitação do usuário antes de continuar

---
```

**Se próxima fase não tem UI:**

```
---

## ✓ Fase {Z} Concluída

## ▶ Próximo Passo

**Fase {Z+1}: {Nome}** — {Objetivo do ROADMAP.md}

`/discutir-fase {Z+1} ${WS}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/planejar-fase {Z+1} ${WS}` — pular discussão, planejar diretamente
- `/verificar-trabalho {Z} ${WS}` — teste de aceitação do usuário antes de continuar

---
```

---

**Rota D: Milestone completo**

```
---

## 🎉 Milestone Concluído

Todas as {N} fases finalizadas!

## ▶ Próximo Passo

**Concluir Milestone** — arquivar e preparar para o próximo

`/concluir-marco ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/verificar-trabalho ${WS}` — teste de aceitação do usuário antes de concluir milestone

---
```

---

**Rota F: Entre milestones (ROADMAP.md ausente, PROJECT.md existe)**

Um milestone foi concluído e arquivado. Pronto para iniciar o próximo ciclo de milestone.

Ler MILESTONES.md para encontrar a versão do último milestone concluído.

```
---

## ✓ Milestone v{X.Y} Concluído

Pronto para planejar o próximo milestone.

## ▶ Próximo Passo

**Iniciar Próximo Milestone** — questionamento → pesquisa → requisitos → roadmap

`/novo-marco ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---
```

</step>

<step name="edge_cases">
**Tratar casos de borda:**

- Fase completa mas próxima fase não planejada → oferecer `/planejar-fase [próxima] ${WS}`
- Todo o trabalho completo → oferecer conclusão do milestone
- Bloqueadores presentes → destacar antes de oferecer continuar
- Arquivo de handoff existe → mencioná-lo, oferecer `/retomar-trabalho ${WS}`
</step>

</process>

<success_criteria>

- [ ] Contexto rico fornecido (trabalho recente, decisões, problemas)
- [ ] Posição atual clara com progresso visual
- [ ] O que vem a seguir claramente explicado
- [ ] Roteamento inteligente: /executar-fase se planos existem, /planejar-fase se não
- [ ] Usuário confirma antes de qualquer ação
- [ ] Transferência perfeita para o comando framework apropriado
</success_criteria>
