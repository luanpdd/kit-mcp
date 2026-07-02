<purpose>
Extrair decisões de implementação que agentes downstream precisam. Analisar a fase para identificar áreas cinzentas, deixar o usuário escolher o que discutir, então fazer deep-dive em cada área selecionada até a satisfação.

Você é um parceiro de pensamento, não um entrevistador. O usuário é o visionário — você é o construtor. Seu trabalho é capturar decisões que guiarão pesquisa e planejamento, não descobrir a implementação por conta própria.
</purpose>

<downstream_awareness>
**CONTEXT.md alimenta:**

1. **phase-researcher** — Lê CONTEXT.md para saber O QUE pesquisar
   - "Usuário quer layout baseado em cards" → pesquisador investiga padrões de componentes de card
   - "Scroll infinito decidido" → pesquisador investiga bibliotecas de virtualização

2. **planner** — Lê CONTEXT.md para saber QUAIS decisões estão bloqueadas
   - "Pull-to-refresh no mobile" → planejador inclui isso nas especificações de tarefas
   - "Discrição do Claude: skeleton de carregamento" → planejador pode decidir a abordagem

**Seu trabalho:** Capturar decisões claramente o suficiente para que agentes downstream possam agir nelas sem perguntar ao usuário novamente.

**Não é seu trabalho:** Descobrir COMO implementar. Isso é o que pesquisa e planejamento fazem com as decisões que você captura.
</downstream_awareness>

<philosophy>
**Usuário = visionário. Claude = construtor.**

Usuário SABE: como imagina, visual/sensação, essencial vs nice-to-have, referências específicas.
Usuário NÃO sabe (não pergunte): padrões da codebase (pesquisador lê), riscos técnicos (pesquisador), abordagem de implementação (planejador), métricas (inferidas).

Pergunte sobre visão e escolhas; capture decisões pra agentes downstream.
</philosophy>

<scope_guardrail>
**CRÍTICO: sem expansão de escopo.** Limite da fase vem do ROADMAP e é FIXO. Discussão clarifica COMO, nunca SE adicionar capacidades.

| Permitido (clarifica) | Não permitido (expande) |
|---|---|
| "Como exibir posts?" (layout, densidade) | "Adicionar comentários?" (nova capacidade) |
| "O que em estado vazio?" | "E busca/filtragem?" |
| "Pull-to-refresh ou manual?" | "Incluir favoritos?" |

**Heurística:** clarifica o que já está na fase, ou adiciona capacidade que merece fase própria?

**Quando usuário sugere expansão:** "[X] seria nova capacidade — fase própria. Anoto pro backlog. De volta a [tópico]." Capture em "Ideias Adiadas". Não perca, não aja.
</scope_guardrail>

<supabase_detection>
**Detecção de fase Supabase:** antes de identificar áreas cinzentas genéricas, verifique se a fase mexe em Supabase (DB/Auth/Realtime/Edge Functions/Storage/RLS/migrations).

Sinais de fase Supabase no objetivo do ROADMAP.md ou nos REQs mapeados:
- Menções a "Supabase", "Postgres", "RLS", "policy", "migration", "supabase/migrations/", "supabase/schemas/", "supabase/functions/"
- Menções a "Auth Next.js", "@supabase/ssr", "magic link", "OAuth", "MFA"
- Menções a "broadcast", "realtime", "presence", "postgres_changes"
- Menções a "Edge Function", "Deno", "pgvector", "RAG", "pg_cron", "pgmq"
- Menções a "bucket", "signed URL", "storage.objects"

**Se for fase Supabase:** considere delegar a discussão para o agent `supabase-architect` em vez de gerar áreas cinzentas genéricas. O architect já tem template de perguntas Supabase-específicas (tier Free/Pro, branches, RLS strategy multi-tenant, schema design, topology realtime, custos de egress/branches).

```
Task(subagent_type=supabase-architect, prompt="Projete schema + RLS + topologia para esta fase Supabase: {phase_goal}. Retorne plano em formato Markdown estruturado para servir de base ao CONTEXT.md.")
```

Use o output do architect como base do `<decisions>` do CONTEXT.md em vez de fazer questionamento manual. **Para fases mistas** (parte Supabase, parte genérica) — use architect só para a parte Supabase, depois faça discussão padrão para o resto.

**Fallback graceful (Content Packs):** `supabase-architect` vive no pack `supabase`, que pode não estar instalado. Antes de delegar, confirme que `.claude/agents/supabase-architect.md` existe. Se ausente, **não falhe** — faça a discussão Supabase você mesmo (tier Free/Pro, RLS multi-tenant, schema, realtime, custos) ou delegue via `subagent_type=general-purpose` lendo a skill `b2b-saas-architecture` se presente. Nunca chame um `subagent_type` que o projeto não tem.
</supabase_detection>

<gray_area_identification>
Áreas cinzentas são **decisões de implementação que o usuário se importa** — coisas que podem ir de múltiplas formas e mudariam o resultado.

**Como identificar áreas cinzentas:**

1. **Ler o objetivo da fase** do ROADMAP.md
2. **Entender o domínio** — Que tipo de coisa está sendo construída?
   - Algo que usuários VÊM → apresentação visual, interações, estados importam
   - Algo que usuários CHAMAM → contratos de interface, respostas, erros importam
   - Algo que usuários EXECUTAM → invocação, saída, modos de comportamento importam
   - Algo que usuários LÊM → estrutura, tom, profundidade, fluxo importam
   - Algo sendo ORGANIZADO → critérios, agrupamento, tratamento de exceções importam
3. **Gerar áreas cinzentas específicas da fase** — Não categorias genéricas, mas decisões concretas para ESTA fase

**Não use rótulos genéricos** (UI/UX/Comportamento). Gere áreas específicas. Exemplos: Auth → sessão, erros, multi-device, recuperação. Backups CLI → output, flags, progress, recovery. Foto biblioteca → agrupamento, duplicatas, nomenclatura, pastas. API docs → estrutura, exemplos, versionamento, interativos.

**Pergunta-chave:** quais decisões mudariam o resultado que o usuário deveria opinar?

**Claude trata sozinho (não perguntar):** detalhes técnicos, padrões de arquitetura, otimização, escopo (roadmap define).
</gray_area_identification>

<answer_validation>
**IMPORTANTE: Validação de resposta** — Após cada chamada AskUserQuestion, verificar se a resposta está vazia ou contém apenas espaços em branco. Se sim:
1. Tentar a pergunta novamente com os mesmos parâmetros
2. Se ainda vazia, apresentar as opções como uma lista numerada em texto simples e pedir ao usuário que digite o número da sua escolha
Nunca prosseguir com uma resposta vazia.

**Modo texto (`workflow.text_mode: true` na config ou flag `--text`):**
Quando o modo texto estiver ativo, **não use AskUserQuestion de forma alguma**. Em vez disso, apresente cada
pergunta como uma lista numerada em texto simples e peça ao usuário que digite o número da sua escolha.
Isso é necessário para sessões remotas do Claude Code (modo `/rc`) onde o App Claude
não pode encaminhar seleções de menu TUI de volta ao host.

Ativar modo texto:
- Por sessão: passar flag `--text` para qualquer comando (ex: `/discutir-fase --text`)
- Por projeto: `tools config-set workflow.text_mode true`

O modo texto aplica-se a TODOS os workflows na sessão, não apenas ao discuss-phase.
</answer_validation>

<process>

**Caminho expresso disponível:** Se você já tem um PRD ou documento de critérios de aceitação, use `/planejar-fase {fase} --prd caminho/para/prd.md` para pular esta discussão e ir direto ao planejamento.

<step name="initialize" priority="first">
Número da fase do argumento (obrigatório).

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ADVISOR=$(node "./.claude/framework/bin/tools.cjs" agent-skills advisor 2>/dev/null)
```

Analisar JSON para: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**Se `phase_found` for false:**
```
Fase [X] não encontrada no roadmap.

Use /progresso ${WS} para ver as fases disponíveis.
```
Sair do workflow.

**Se `phase_found` for true:** Continuar para check_existing.

**Modo auto** — Se `--auto` estiver presente em ARGUMENTS:
- Em `check_existing`: auto-selecionar "Pular" (se contexto existir) ou continuar sem prompt (se sem contexto/planos)
- Em `present_gray_areas`: auto-selecionar TODAS as áreas cinzentas sem perguntar ao usuário
- Em `discuss_areas`: para cada pergunta de discussão, escolher a opção recomendada (primeira opção, ou a marcada como "recomendada") sem usar AskUserQuestion
- Logar cada escolha auto-selecionada inline para que o usuário possa revisar decisões no arquivo de contexto
- Após a discussão concluir, avançar automaticamente para plan-phase (comportamento existente)
</step>

<step name="check_existing">
Verificar se CONTEXT.md já existe usando `has_context` do init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**Se existir:**

**Se `--auto`:** Auto-selecionar "Atualizar" — carregar contexto existente e continuar para analyze_phase. Logar: `[auto] Contexto existe — atualizando com decisões auto-selecionadas.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Contexto"
- question: "Fase [X] já tem contexto. O que você quer fazer?"
- options:
  - "Atualizar" — Revisar e revisar contexto existente
  - "Visualizar" — Me mostra o que há
  - "Pular" — Usar contexto existente como está

Se "Atualizar": Carregar existente, continuar para analyze_phase
Se "Visualizar": Exibir CONTEXT.md, então oferecer atualizar/pular
Se "Pular": Sair do workflow

**Se não existir:**

Verificar `has_plans` e `plan_count` do init. **Se `has_plans` for true:**

**Se `--auto`:** Auto-selecionar "Continuar e replanejar depois". Logar: `[auto] Planos existem — continuando com captura de contexto, replanejará depois.`

**Caso contrário:** Usar AskUserQuestion:
- header: "Planos existem"
- question: "Fase [X] já tem {plan_count} plano(s) criado(s) sem contexto do usuário. Suas decisões aqui não afetarão os planos existentes a menos que você replane."
- options:
  - "Continuar e replanejar depois" — Capturar contexto, então executar /planejar-fase {X} ${WS} para replanejar
  - "Visualizar planos existentes" — Mostrar planos antes de decidir
  - "Cancelar" — Pular discuss-phase

Se "Continuar e replanejar depois": Continuar para analyze_phase.
Se "Visualizar planos existentes": Exibir arquivos de plano, então oferecer "Continuar" / "Cancelar".
Se "Cancelar": Sair do workflow.

**Se `has_plans` for false:** Continuar para load_prior_context.
</step>

<step name="load_prior_context">
Ler PROJECT.md (visão/princípios/inegociáveis), REQUIREMENTS.md (critérios/must-haves), STATE.md (progresso/flags). Encontrar CONTEXT.md anteriores (`find .planning/phases -name "*-CONTEXT.md" | sort`); pra cada um com número < fase atual, extrair `<decisions>` (preferências bloqueadas) e `<specifics>` (refs particulares).

Construir contexto interno `<prior_decisions>` com seções "Nível de Projeto" + "Das Fases Anteriores".

**Uso downstream:** `analyze_phase` pula áreas já decididas; `present_gray_areas` anota com refs ("Você escolheu X na Fase 5"); `discuss_areas` pré-preenche ou sinaliza conflitos. Sem contexto anterior → continuar (esperado pra fases iniciais).
</step>

<step name="cross_reference_todos">
Verificar se alguma tarefa pendente é relevante ao escopo desta fase. Exibe itens do backlog que de outra forma poderiam ser perdidos.

**Carregar e corresponder tarefas:**
```bash
TODO_MATCHES=$(node "./.claude/framework/bin/tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

Analisar JSON para: `todo_count`, `matches[]` (cada um com `file`, `title`, `area`, `score`, `reasons`).

**Se `todo_count` for 0 ou `matches` estiver vazio:** Pular silenciosamente — sem atraso no workflow.

**Se correspondências encontradas:**

Apresentar tarefas correspondentes ao usuário. Mostrar cada correspondência com seu título, área e por que correspondeu:

```
📋 Encontradas {N} tarefa(s) pendente(s) que podem ser relevantes para a Fase {X}:

{Para cada correspondência:}
- **{título}** (área: {área}, relevância: {score}) — correspondeu em {reasons}
```

Usar AskUserQuestion (multiSelect) perguntando quais tarefas incorporar ao escopo desta fase:

```
Quais dessas tarefas devem ser incorporadas ao escopo da Fase {X}?
(Selecione as que se aplicam, ou nenhuma para pular)
```

**Para tarefas selecionadas (incorporadas):**
- Armazenar internamente como `<folded_todos>` para inclusão na seção `<decisions>` do CONTEXT.md
- Estes se tornam itens de escopo adicionais que agentes downstream (pesquisador, planejador) verão

**Para tarefas não selecionadas (revisadas mas não incorporadas):**
- Armazenar internamente como `<reviewed_todos>` para inclusão na seção `<deferred>` do CONTEXT.md
- Isso evita que fases futuras re-exibam as mesmas tarefas como "perdidas"

**Modo auto (`--auto`):** Incorporar todas as tarefas com score >= 0,4 automaticamente. Logar a seleção.
</step>

<step name="scout_codebase">
Varredura leve do código existente para informar identificação de áreas cinzentas e discussão. Usa ~10% do contexto — aceitável para uma sessão interativa.

**Passo 1: Verificar mapas de codebase existentes**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**Mapas de codebase existem (`.planning/codebase/*.md`):** ler CONVENTIONS/STRUCTURE/STACK conforme tipo da fase. Extrair: ativos reutilizáveis, padrões estabelecidos, pontos de integração.

**Sem mapas:** grep direcionado por termos-chave do objetivo (`grep -rl "termo1\|termo2" src/ app/ --include='*.{ts,tsx,js,jsx}' | head -10`) + `ls src/{components,hooks,lib,utils}/`. Ler 3-5 arquivos mais relevantes.

Construir `<codebase_context>` interno: ativos reutilizáveis, padrões, pontos de integração, opções criativas que a arquitetura habilita/restringe. Não escreve em arquivo — só sessão atual.
</step>

<step name="analyze_phase">
Analisar a fase para identificar áreas cinzentas que valem a discussão. **Usar tanto `prior_decisions` quanto `codebase_context` para embasar a análise.**

**Ler a descrição da fase do ROADMAP.md e determinar:**

1. **Limite de domínio** — Qual capacidade esta fase está entregando? Declará-la claramente.

1b. **Inicializar acumulador de refs canônicas** — Começar a construir a lista `<canonical_refs>` para CONTEXT.md. Isso se acumula ao longo de toda a discussão, não apenas neste passo.

   **Fonte 1 (agora):** Copiar `Canonical refs:` do ROADMAP.md para esta fase. Expandir cada uma para um caminho relativo completo.
   **Fonte 2 (agora):** Verificar REQUIREMENTS.md e PROJECT.md por quaisquer specs/ADRs referenciados para esta fase.
   **Fonte 3 (scout_codebase):** Se código existente referencia docs (ex: comentários citando ADRs), adicionar esses.
   **Fonte 4 (discuss_areas):** Quando o usuário disser "leia X", "verifique Y", ou referenciar qualquer doc/spec/ADR durante a discussão — adicionar imediatamente. Estes são frequentemente as refs MAIS importantes porque representam docs que o usuário especificamente quer seguidos.

   Esta lista é OBRIGATÓRIA no CONTEXT.md. Cada ref deve ter um caminho relativo completo para que agentes downstream possam lê-la diretamente. Se não existirem docs externos, note isso explicitamente.

2. **Verificar decisões anteriores** — Antes de gerar áreas cinzentas, verificar se alguma já foi decidida:
   - Escanear `<prior_decisions>` por escolhas relevantes (ex: "Somente Ctrl+C, sem atalhos de tecla única")
   - Estas estão **pré-respondidas** — não re-perguntar a menos que esta fase tenha necessidades conflitantes
   - Notar decisões anteriores aplicáveis para uso na apresentação

3. **Áreas cinzentas por categoria** — Para cada categoria relevante (UI, UX, Comportamento, Estados Vazios, Conteúdo), identificar 1-2 ambiguidades específicas que mudariam a implementação. **Anotar com contexto de código onde relevante** (ex: "Você já tem um componente Card" ou "Sem padrão existente para isso").

4. **Avaliação de pulo** — Se não existirem áreas cinzentas significativas (infraestrutura pura, implementação clara, ou tudo já decidido em fases anteriores), a fase pode não precisar de discussão.

**Detecção de Modo Advisor:**

`ADVISOR_MODE = exists("./.claude/framework/USER-PROFILE.md")`. Se false, pular todos os passos advisor — workflow conversacional inalterado.

Se true, resolver `calibration_tier` por prioridade: (1) `config.json > preferences.vendor_philosophy` (project), (2) USER-PROFILE.md Vendor Choices/Philosophy (global), (3) default `standard`. Mapeamento: `conservative`/`thorough-evaluator` → `full_maturity`; `opinionated` → `minimal_decisive`; `pragmatic-fast` ou outro/vazio → `standard`.

`ADVISOR_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model advisor-researcher --raw)`

**Produzir sua análise internamente, então apresentar ao usuário.**

Exemplo de análise para fase "Feed de Posts" (com código e contexto anterior):
```
Domínio: Exibindo posts de usuários seguidos
Existente: Componente Card (src/components/ui/Card.tsx), hook useInfiniteQuery, Tailwind CSS
Decisões anteriores: "UI minimalista preferida" (Fase 2), "Sem paginação — sempre scroll infinito" (Fase 4)
Áreas cinzentas:
- UI: Estilo de layout (cards vs timeline vs grid) — Componente Card existe com variantes shadow/rounded
- UI: Densidade de informação (posts completos vs prévias) — sem padrões de densidade existentes
- Comportamento: Padrão de carregamento — JÁ DECIDIDO: scroll infinito (Fase 4)
- Estado Vazio: O que mostra quando não há posts — Componente EmptyState existe em ui/
- Conteúdo: Quais metadados exibir (hora, autor, contagem de reações)
```
</step>

<step name="present_gray_areas">
Apresentar o limite de domínio, decisões anteriores e áreas cinzentas ao usuário.

**Primeiro, declarar o limite e quaisquer decisões anteriores que se aplicam:**
```
Fase [X]: [Nome]
Domínio: [O que esta fase entrega — da sua análise]

Vamos clarificar COMO implementar isso.
(Novas capacidades pertencem a outras fases.)

[Se decisões anteriores se aplicam:]
**Carregando de fases anteriores:**
- [Decisão da Fase N que se aplica aqui]
- [Decisão da Fase M que se aplica aqui]
```

**Se `--auto`:** Auto-selecionar TODAS as áreas cinzentas. Logar: `[auto] Selecionadas todas as áreas cinzentas: [lista de nomes das áreas].` Pular o AskUserQuestion abaixo e continuar diretamente para discuss_areas com todas as áreas selecionadas.

**Caso contrário, usar AskUserQuestion (multiSelect: true):**
- header: "Discutir"
- question: "Quais áreas você quer discutir para [nome da fase]?"
- options: Gerar 3-4 áreas cinzentas específicas da fase, cada uma com:
  - "[Área específica]" (rótulo) — concreto, não genérico
  - [1-2 perguntas que isso cobre + anotação de contexto de código] (descrição)
  - **Destacar a escolha recomendada com breve explicação do porquê**

**Anotações de decisão anterior:** Quando uma área cinzenta já foi decidida em uma fase anterior, anotá-la:
```
☐ Atalhos de saída — Como os usuários devem sair?
  (Você decidiu "Somente Ctrl+C, sem atalhos de tecla única" na Fase 5 — revisitar ou manter?)
```

**Anotações de contexto de código:** Quando o scout encontrou código existente relevante, anotar a descrição da área cinzenta:
```
☐ Estilo de layout — Cards vs lista vs timeline?
  (Você já tem um componente Card com variantes shadow/rounded. Reutilizá-lo mantém o app consistente.)
```

**Combinando ambos:** Quando tanto decisões anteriores quanto contexto de código se aplicam:
```
☐ Comportamento de carregamento — Scroll infinito ou paginação?
  (Você escolheu scroll infinito na Fase 4. Hook useInfiniteQuery já configurado.)
```

**NÃO incluir opção "pular" ou "você decide".** O usuário executou este comando para discutir — dar escolhas reais.

**Exemplos por domínio:**
- Feed de Posts: layout (cards/lista/timeline), carregamento (infinito/paginação), ordenação, metadados
- Backup CLI: output (JSON/tabela/texto), flags (curtas/longas), progress (silencioso/bar/verbose), recovery (fail-fast/retry)
- Foto biblioteca: agrupamento (data/local/face/evento), duplicatas (melhor/todos/prompt), nomenclatura, pastas

Continuar para discuss_areas com áreas selecionadas (ou advisor_research se ADVISOR_MODE for true).
</step>

<step name="advisor_research">
**Pesquisa Advisor** (somente quando ADVISOR_MODE for true)

Após o usuário selecionar áreas cinzentas em present_gray_areas, criar agentes de pesquisa paralelos.

1. Exibir status breve: "Pesquisando {N} áreas..."

2. Para CADA área cinzenta selecionada pelo usuário, criar um Task() em paralelo:

   Task(
     prompt="First, read @./.claude/agents/advisor-researcher.md for your role and instructions.

     <gray_area>{area_name}: {area_description from gray area identification}</gray_area>
     <phase_context>{phase_goal and description from ROADMAP.md}</phase_context>
     <project_context>{project name and brief description from PROJECT.md}</project_context>
     <calibration_tier>{resolved calibration tier: full_maturity | standard | minimal_decisive}</calibration_tier>

     Research this gray area and return a structured comparison table with rationale.
     ${AGENT_SKILLS_ADVISOR}",
     subagent_type="general-purpose",
     model="{ADVISOR_MODEL}",
     description="Research: {area_name}"
   )

   Todas as chamadas Task() criam simultaneamente — NÃO aguardar uma antes de iniciar a próxima.

3. Após TODOS os agentes retornarem, SINTETIZAR resultados antes de apresentar:
   Para o retorno de cada agente:
   a. Analisar a tabela de comparação markdown e parágrafo de raciocínio
   b. Verificar se todas as 5 colunas estão presentes (Option | Pros | Cons | Complexity | Recommendation) — preencher colunas ausentes em vez de mostrar tabela quebrada
   c. Verificar contagem de opções contra o tier de calibração:
      - full_maturity: 3-5 opções aceitável
      - standard: 2-4 opções aceitável
      - minimal_decisive: 1-2 opções aceitável
      Se agente retornou demais, remover as menos viáveis. Se poucas demais, aceitar como está.
   d. Reescrever parágrafo de raciocínio para incorporar contexto do projeto e contexto de discussão em andamento ao qual o agente não tinha acesso
   e. Se agente retornou apenas 1 opção, converter de formato de tabela para recomendação direta: "Abordagem padrão para {área}: {opção}. {raciocínio}"

4. Armazenar tabelas sintetizadas para uso em discuss_areas.

**Se ADVISOR_MODE for false:** Pular este passo inteiramente — prosseguir diretamente de present_gray_areas para discuss_areas.
</step>

<step name="discuss_areas">
Discutir cada área selecionada com o usuário. O fluxo depende do modo advisor.

**Se ADVISOR_MODE for true:**

Fluxo de discussão com tabela primeiro — apresentar tabelas de comparação baseadas em pesquisa, então capturar escolhas do usuário.

**Para cada área selecionada:**

1. **Apresentar a tabela de comparação sintetizada + parágrafo de raciocínio** (do passo advisor_research)

2. **Usar AskUserQuestion:**
   - header: "{area_name}"
   - question: "Qual abordagem para {area_name}?"
   - options: Extrair da coluna Option da tabela (AskUserQuestion adiciona "Outro" automaticamente)

3. **Registrar a seleção do usuário:**
   - Se o usuário escolher das opções da tabela → registrar como decisão bloqueada para essa área
   - Se o usuário escolher "Outro" → receber seu input, refletir de volta para confirmação, registrar

4. **Após registrar escolha, Claude decide se perguntas de acompanhamento são necessárias:**
   - Se a escolha tem ambiguidade que afetaria o planejamento downstream → fazer 1-2 perguntas de acompanhamento direcionadas usando AskUserQuestion
   - Se a escolha é clara e autocontida → mover para próxima área
   - NÃO fazer as 4 perguntas padrão — a tabela já forneceu o contexto

5. **Após todas as áreas processadas:**
   - header: "Concluído"
   - question: "Isso cobre [listar áreas]. Pronto para criar contexto?"
   - options: "Criar contexto" / "Revisitar uma área"

**Tratamento de expansão de escopo (modo advisor):**
Se o usuário mencionar algo fora do domínio da fase:
```
"[Funcionalidade] parece uma nova capacidade — pertence à sua própria fase.
Vou anotá-la como uma ideia adiada.

De volta a [área atual]: [retornar à pergunta atual]"
```

Rastrear ideias adiadas internamente.

---

**Se ADVISOR_MODE for false:**

Para cada área selecionada, conduzir um loop de discussão focado.

**Modos opcionais (lidos de config + args):**

- **`workflow.research_before_questions: true`** ou padrão off — antes de cada área, fazer 2-3 bullet de melhores práticas via web, apresentar com a pergunta. Ex: "OAuth 2.0 + PKCE é padrão atual pra SPAs; cookies httpOnly preferidos vs localStorage; passkey/WebAuthn em alta 2025-2026."
- **`--text` ou `workflow.text_mode: true`** — substitui TODOS AskUserQuestion por listas numeradas em texto simples (necessário em sessões remotas Claude Code `/rc`).
- **`--batch[=N]`** (default 4 quando ausente, range 2-5) — 1 turno agrupado com N perguntas numeradas em vez de N turnos de pergunta única. Após responder, refletir capturas e fazer follow-up mínimo.
- **`--analyze`** — antes de cada pergunta (ou batch), fornecer mini-tabela de trade-offs (2-3 opções, prós/contras baseados na codebase + padrões), recomendação destacada, pitfalls.

**Filosofia:** adaptativo, usuário escolhe o ritmo. Default: 4 turnos de pergunta única, depois verifica continuar. `--batch`: 1 turno agrupado, depois verifica.

Cada resposta (ou conjunto de respostas, no modo batch) deve revelar a próxima pergunta ou próximo batch.

**Modo auto (`--auto`):** Para cada área, Claude seleciona a opção recomendada (primeira opção, ou a explicitamente marcada como "recomendada") para cada pergunta sem usar AskUserQuestion. Logar cada escolha auto-selecionada:
```
[auto] [Área] — P: "[texto da pergunta]" → Selecionado: "[opção escolhida]" (padrão recomendado)
```
Após todas as áreas serem auto-resolvidas, pular o prompt "Explorar mais áreas cinzentas" e prosseguir diretamente para write_context.

**Modo interativo (sem `--auto`):**

**Para cada área:**

1. **Anunciar a área:**
   ```
   Vamos falar sobre [Área].
   ```

2. **Fazer perguntas usando o ritmo selecionado:**

   **Padrão (sem `--batch`): Fazer 4 perguntas usando AskUserQuestion**
   - header: "[Área]" (máx 12 chars — abreviar se necessário)
   - question: Decisão específica para esta área
   - options: 2-3 escolhas concretas (AskUserQuestion adiciona "Outro" automaticamente), com a escolha recomendada destacada e breve explicação do porquê
   - **Anotar opções com contexto de código** quando relevante:
     ```
     "Como os posts devem ser exibidos?"
     - Cards (reutiliza o componente Card existente — consistente com Mensagens)
     - Lista (mais simples, seria um novo padrão)
     - Timeline (precisa de novo componente Timeline — nenhum existe ainda)
     ```
   - Incluir "Você decide" como opção quando razoável — captura discrição do Claude
   - **Context7 para escolhas de biblioteca:** Quando uma área cinzenta envolve seleção de biblioteca (ex: "magic links" → consultar docs do next-auth) ou decisões de abordagem de API, usar ferramentas `mcp__context7__*` para buscar documentação atual e informar as opções. Não usar Context7 para cada pergunta — apenas quando conhecimento específico da biblioteca melhora as opções.

   **Modo batch (`--batch`): Fazer 2-5 perguntas numeradas em um turno de texto simples**
   - Agrupar perguntas intimamente relacionadas para a área atual em uma única mensagem
   - Manter cada pergunta concreta e respondível em uma resposta
   - Quando opções são úteis, incluir escolhas inline curtas por pergunta em vez de um AskUserQuestion separado para cada item
   - Após a resposta do usuário, refletir de volta as decisões capturadas, notar itens não respondidos, e fazer apenas o mínimo de acompanhamento necessário antes de prosseguir
   - Preservar adaptabilidade entre batches: usar o conjunto completo de respostas para decidir o próximo batch ou se a área está suficientemente clara

3. **Após o conjunto atual de perguntas, verificar:**
   - header: "[Área]" (máx 12 chars)
   - question: "Mais perguntas sobre [área], ou mover para próxima? (Restantes: [listar outras áreas não visitadas])"
   - options: "Mais perguntas" / "Próxima área"

   Ao construir o texto da pergunta, listar as áreas não visitadas restantes para que o usuário saiba o que vem a seguir. Por exemplo: "Mais perguntas sobre Layout, ou mover para próxima? (Restantes: Comportamento de carregamento, Ordenação de conteúdo)"

   Se "Mais perguntas" → fazer mais 4 perguntas únicas, ou mais um batch de 2-5 perguntas quando `--batch` estiver ativo, então verificar novamente
   Se "Próxima área" → prosseguir para próxima área selecionada
   Se "Outro" (texto livre) → interpretar intenção: frases de continuação ("mais", "continuar", "sim", "mais perguntas") mapeiam para "Mais perguntas"; frases de avanço ("feito", "continuar", "próximo", "pular") mapeiam para "Próxima área". Se ambíguo, perguntar: "Continuar com mais perguntas sobre [área], ou mover para a próxima área?"

4. **Após todas as áreas inicialmente selecionadas concluírem:**
   - Resumir o que foi capturado da discussão até agora
   - AskUserQuestion:
     - header: "Concluído"
     - question: "Discutimos [listar áreas]. Quais áreas cinzentas permanecem pouco claras?"
     - options: "Explorar mais áreas cinzentas" / "Estou pronto para o contexto"
   - Se "Explorar mais áreas cinzentas":
     - Identificar 2-4 áreas cinzentas adicionais com base no que foi aprendido
     - Retornar à lógica de present_gray_areas com essas novas áreas
     - Loop: discutir novas áreas, então solicitar novamente
   - Se "Estou pronto para o contexto": Prosseguir para write_context

**Acumulação de refs canônicas:** quando usuário referencia doc/spec/ADR (ex: "leia adr-014"), imediatamente: leia o doc, adicione ao acumulador com caminho relativo completo, use pra informar perguntas seguintes. Esses são frequentemente MAIS importantes que refs do ROADMAP — usuário quer que agentes downstream sigam. Nunca perca.

**Design de perguntas:** opções concretas (não "Opção A"), cada resposta informa a próxima. Se usuário escolher "Outro" pra texto livre, faça acompanhamento em prompt simples (NÃO outro AskUserQuestion); reflita de volta e confirme.

**Expansão de escopo:** ver `<scope_guardrail>` acima — anote como Ideia Adiada, retorne ao tópico.

**Log interno por pergunta:** área, opções apresentadas, seleção do usuário, notas de acompanhamento. Usado pra gerar DISCUSSION-LOG.md no `write_context`.
</step>

<step name="write_context">
Criar CONTEXT.md capturando as decisões tomadas.

**Também gerar DISCUSSION-LOG.md** — uma trilha de auditoria completa do Q&A do discuss-phase.
Este arquivo é apenas para referência humana (auditorias de software, revisões de conformidade). NÃO é
consumido por agentes downstream (pesquisador, planejador, executor).

**Encontrar ou criar diretório de fase:**

Usar valores do init: `phase_dir`, `phase_slug`, `padded_phase`.

Se `phase_dir` for null (fase existe no roadmap mas sem diretório):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Localização do arquivo:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Estruturar o conteúdo pelo que foi discutido:**

```markdown
# Fase [X]: [Nome] - Contexto

**Coletado:** [data]
**Status:** Pronto para planejamento

<domain>
## Limite da Fase

[Declaração clara do que esta fase entrega — a âncora de escopo]

</domain>

<decisions>
## Decisões de Implementação

### [Categoria 1 que foi discutida]
- **D-01:** [Decisão ou preferência capturada]
- **D-02:** [Outra decisão se aplicável]

### [Categoria 2 que foi discutida]
- **D-03:** [Decisão ou preferência capturada]

### Discrição do Claude
[Áreas onde o usuário disse "você decide" — notar que Claude tem flexibilidade aqui]

### Tarefas Incorporadas
[Se alguma tarefa foi incorporada ao escopo do passo cross_reference_todos, listá-las aqui.
Cada entrada deve incluir o título da tarefa, problema original e como se encaixa no escopo desta fase.
Se nenhuma tarefa foi incorporada: omitir esta subseção inteiramente.]

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

[Seção OBRIGATÓRIA. Escrever aqui a lista COMPLETA de refs canônicas acumuladas.
Fontes: refs do ROADMAP.md + refs do REQUIREMENTS.md + docs referenciados pelo usuário durante
a discussão + quaisquer docs descobertos durante a varredura da codebase. Agrupar por área de tópico.
Cada entrada precisa de um caminho relativo completo — não apenas um nome.]

### [Área de tópico 1]
- `caminho/para/adr-ou-spec.md` — [O que decide/define que é relevante]
- `caminho/para/doc.md` §N — [Referência de seção específica]

### [Área de tópico 2]
- `caminho/para/feature-doc.md` — [O que este doc define]

[Se sem specs externas: "Sem specs externas — requisitos totalmente capturados nas decisões acima"]

</canonical_refs>

<code_context>
## Insights de Código Existente

### Ativos Reutilizáveis
- [Componente/hook/utilitário]: [Como poderia ser usado nesta fase]

### Padrões Estabelecidos
- [Padrão]: [Como restringe/habilita esta fase]

### Pontos de Integração
- [Onde novo código se conecta ao sistema existente]

</code_context>

<specifics>
## Ideias Específicas

[Quaisquer referências particulares, exemplos, ou momentos "quero como X" da discussão]

[Se nenhum: "Sem requisitos específicos — aberto a abordagens padrão"]

</specifics>

<deferred>
## Ideias Adiadas

[Ideias que surgiram mas pertencem a outras fases. Não as perder.]

### Tarefas Revisadas (não incorporadas)
[Se alguma tarefa foi revisada em cross_reference_todos mas não incorporada ao escopo,
listá-las aqui para que fases futuras saibam que foram consideradas.
Cada entrada: título da tarefa + motivo pelo qual foi adiada (fora do escopo, pertence à Fase Y, etc.)
Se sem tarefas revisadas-mas-adiadas: omitir esta subseção inteiramente.]

[Se nenhum: "Nenhum — discussão ficou dentro do escopo da fase"]

</deferred>

---

*Fase: XX-nome*
*Contexto coletado: [data]*
```

Escrever arquivo.
</step>

<step name="confirm_creation">
Apresentar resumo e próximos passos:

```
Criado: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisões Capturadas

### [Categoria]
- [Decisão-chave]

### [Categoria]
- [Decisão-chave]

[Se ideias adiadas existirem:]
## Anotado para Depois
- [Ideia adiada] — fase futura

---

## ▶ Próximo Passo

**Fase ${PHASE}: [Nome]** — [Objetivo do ROADMAP.md]

`/planejar-fase ${PHASE} ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---

**Também disponível:**
- `/planejar-fase ${PHASE} --skip-research ${WS}` — planejar sem pesquisa
- `/fase-ui ${PHASE} ${WS}` — gerar contrato de design de UI antes do planejamento (se a fase tem trabalho de frontend)
- Revisar/editar CONTEXT.md antes de continuar

---
```
</step>

<step name="git_commit">
**Escrever DISCUSSION-LOG.md antes de commitar:**

**Localização do arquivo:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Fase [X]: [Nome] - Log de Discussão

> **Somente trilha de auditoria.** Não usar como entrada para agentes de planejamento, pesquisa ou execução.
> Decisões são capturadas no CONTEXT.md — este log preserva as alternativas consideradas.

**Data:** [data ISO]
**Fase:** [número-fase]-[nome-fase]
**Áreas discutidas:** [lista separada por vírgula]

---

[Para cada área cinzenta discutida:]

## [Nome da Área]

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| [Opção 1] | [Descrição do AskUserQuestion] | |
| [Opção 2] | [Descrição] | ✓ |
| [Opção 3] | [Descrição] | |

**Escolha do usuário:** [Opção selecionada ou resposta em texto livre]
**Notas:** [Quaisquer esclarecimentos, contexto de acompanhamento, ou raciocínio fornecido pelo usuário]

---

[Repetir para cada área]

## Discrição do Claude

[Listar áreas onde o usuário disse "você decide" ou delegou ao Claude]

## Ideias Adiadas

[Ideias mencionadas durante a discussão que foram anotadas para fases futuras]
```

Escrever arquivo.

Commitar contexto da fase e log de discussão:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

Confirmar: "Commitado: docs(${padded_phase}): capturar contexto da fase"
</step>

<step name="update_state">
Atualizar STATE.md com informações da sessão:

```bash
node "./.claude/framework/bin/tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commitar STATE.md:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
**Detecção:** flag `--auto` em $ARGUMENTS, OR `workflow._auto_chain_active=true`, OR `workflow.auto_advance=true`.

**Sync de cadeia:** se usuário invocou manualmente (sem `--auto`), zere `workflow._auto_chain_active` (mas NÃO toque `workflow.auto_advance` — preferência do usuário). Se `--auto` presente e cadeia não estava ativa, set `_auto_chain_active=true` (handle uso direto de `--auto` sem new-project).

**Quando ativo:** dispare `Skill(skill="framework:planejar-fase", args="${PHASE} --auto ${WS}")` (use Skill, não Task aninhado — evita freeze de runtime, issue #686).

**Roteamento de retorno do plan-phase:**
- `FASE CONCLUÍDA` → cadeia completa. Próximo: `/discutir-fase ${NEXT_PHASE} --auto ${WS}` (após `/clear`)
- `PLANEJAMENTO CONCLUÍDO` → execução parou. Continuar: `/executar-fase ${PHASE} ${WS}`
- `PLANEJAMENTO INCONCLUSIVO / CHECKPOINT` → parou. Continuar: `/planejar-fase ${PHASE} ${WS}`
- `LACUNAS ENCONTRADAS` → parou. Continuar: `/planejar-fase ${PHASE} --gaps ${WS}`

**Quando inativo:** rotear pra `confirm_creation` (comportamento manual existente).
</step>

</process>

<success_criteria>
- Fase validada contra o roadmap
- Contexto anterior carregado (PROJECT.md, REQUIREMENTS.md, STATE.md, arquivos CONTEXT.md anteriores)
- Questões já decididas não re-perguntadas (carregadas de fases anteriores)
- Codebase varrida por ativos reutilizáveis, padrões e pontos de integração
- Áreas cinzentas identificadas por análise inteligente com anotações de código e decisão anterior
- Usuário selecionou quais áreas discutir
- Cada área selecionada explorada até satisfação do usuário (com opções informadas por código e por decisões anteriores)
- Expansão de escopo redirecionada para ideias adiadas
- CONTEXT.md captura decisões reais, não visão vaga
- CONTEXT.md inclui seção canonical_refs com caminhos completos de arquivos para cada spec/ADR/doc que agentes downstream precisam (OBRIGATÓRIO — nunca omitir)
- CONTEXT.md inclui seção code_context com ativos e padrões reutilizáveis
- Ideias adiadas preservadas para fases futuras
- STATE.md atualizado com informações da sessão
- Usuário sabe os próximos passos
</success_criteria>
