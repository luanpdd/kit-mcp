<purpose>

Iniciar um novo ciclo de milestone para um projeto existente. Carrega contexto do projeto, coleta objetivos do milestone (do MILESTONE-CONTEXT.md ou conversa), atualiza PROJECT.md e STATE.md, opcionalmente executa pesquisa paralela, define requisitos com REQ-IDs, cria o roadmapper para gerar plano de execução por fases, e comita todos os artefatos. Equivalente brownfield do new-project.

</purpose>

<required_reading>

Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.

</required_reading>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- project-researcher — Pesquisa decisões técnicas em nível de projeto
- research-synthesizer — Sintetiza descobertas de agentes de pesquisa paralelos
- roadmapper — Cria roadmaps de execução por fases
</available_agent_types>

<process>

## 1. Carregar Contexto

Analisar `$ARGUMENTS` antes de fazer qualquer coisa:
- flag `--reset-phase-numbers` → opt-in para reiniciar numeração de fases do roadmap em `1`
- texto restante → usar como nome do milestone se presente

Se a flag estiver ausente, manter o comportamento atual de continuar numeração de fases do milestone anterior.

- Ler PROJECT.md (projeto existente, requisitos validados, decisões)
- Ler MILESTONES.md (o que foi entregue anteriormente)
- Ler STATE.md (todos pendentes, bloqueadores)
- Verificar MILESTONE-CONTEXT.md (de /discutir-milestone)

## 2. Coletar Objetivos do Milestone

**Se MILESTONE-CONTEXT.md existir:**
- Usar funcionalidades e escopo de discuss-milestone
- Apresentar resumo para confirmação

**Se não houver arquivo de contexto:**
- Apresentar o que foi entregue no último milestone
- Perguntar inline (texto livre, NÃO AskUserQuestion): "O que você quer construir a seguir?"
- Aguardar resposta, depois usar AskUserQuestion para sondar detalhes
- Se o usuário selecionar "Outro" para fornecer entrada livre, perguntar como texto simples — não outro AskUserQuestion

## 3. Determinar Versão do Milestone

- Analisar última versão do MILESTONES.md
- Sugerir próxima versão (v1.0 → v1.1, ou v2.0 para major)
- Confirmar com usuário

## 3.5. Verificar Compreensão do Milestone

Antes de escrever qualquer arquivo, apresentar um resumo do que foi coletado e pedir confirmação.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► RESUMO DO MILESTONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Nome]**

**Objetivo:** [Uma frase]

**Funcionalidades alvo:**
- [Funcionalidade 1]
- [Funcionalidade 2]
- [Funcionalidade 3]

**Contexto-chave:** [Quaisquer restrições, decisões ou notas importantes do questionamento]
```

AskUserQuestion:
- header: "Confirmar?"
- question: "Isso captura o que você quer construir neste milestone?"
- options:
  - "Parece bom" — Prosseguir para escrever PROJECT.md
  - "Ajustar" — Deixa eu corrigir ou adicionar detalhes

**Se "Ajustar":** Perguntar o que precisa mudar (texto simples, NÃO AskUserQuestion). Incorporar mudanças, reapresentar o resumo. Loop até "Parece bom" ser selecionado.

**Se "Parece bom":** Prosseguir para o Passo 4.

## 4. Atualizar PROJECT.md

Adicionar/atualizar:

```markdown
## Milestone Atual: v[X.Y] [Nome]

**Objetivo:** [Uma frase descrevendo o foco do milestone]

**Funcionalidades alvo:**
- [Funcionalidade 1]
- [Funcionalidade 2]
- [Funcionalidade 3]
```

Atualizar seção de requisitos Ativos e rodapé "Última atualização".

Garantir que a seção `## Evolução` existe no PROJECT.md. Se ausente (projetos criados antes desta funcionalidade), adicionar antes do rodapé:

```markdown
## Evolução

Este documento evolui nas transições de fase e limites de milestone.

**Após cada transição de fase** (via `/transicao`):
1. Requisitos invalidados? → Mover para Fora do Escopo com motivo
2. Requisitos validados? → Mover para Validados com referência de fase
3. Novos requisitos surgiram? → Adicionar em Ativos
4. Decisões a registrar? → Adicionar em Decisões-chave
5. "O Que É" ainda está preciso? → Atualizar se driftar

**Após cada milestone** (via `/concluir-marco`):
1. Revisão completa de todas as seções
2. Verificação do Valor Central — ainda é a prioridade certa?
3. Auditar Fora do Escopo — motivos ainda são válidos?
4. Atualizar Contexto com estado atual
```

## 5. Atualizar STATE.md

```markdown
## Posição Atual

Fase: Não iniciada (definindo requisitos)
Plano: —
Status: Definindo requisitos
Última atividade: [hoje] — Milestone v[X.Y] iniciado
```

Manter seção de Contexto Acumulado do milestone anterior.

## 6. Limpeza e Commit

Deletar MILESTONE-CONTEXT.md se existir (consumido).

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: start milestone v[X.Y] [Name]" --files .planning/PROJECT.md .planning/STATE.md
```

## 7. Carregar Contexto e Resolver Modelos

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init new-milestone)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(node "./.claude/framework/bin/tools.cjs" agent-skills project-researcher 2>/dev/null)
AGENT_SKILLS_SYNTHESIZER=$(node "./.claude/framework/bin/tools.cjs" agent-skills synthesizer 2>/dev/null)
AGENT_SKILLS_ROADMAPPER=$(node "./.claude/framework/bin/tools.cjs" agent-skills roadmapper 2>/dev/null)
```

Extrair do JSON de init: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`, `latest_completed_milestone`, `phase_dir_count`, `phase_archive_path`.

## 7.5 Segurança de reset-phase (apenas quando `--reset-phase-numbers`)

Se `--reset-phase-numbers` estiver ativo:

1. Definir número de fase inicial como `1` para o roadmap futuro.
2. Se `phase_dir_count > 0`, arquivar os diretórios de fase antigos antes do roadmapping para que novos diretórios `01-*` / `02-*` não colidam com diretórios de milestone obsoletos.

Se `phase_dir_count > 0` e `phase_archive_path` estiver disponível:

```bash
mkdir -p "${phase_archive_path}"
find .planning/phases -mindepth 1 -maxdepth 1 -type d -exec mv {} "${phase_archive_path}/" \;
```

Então verificar que `.planning/phases/` não contém mais diretórios de milestone antigos antes de continuar.

Se `phase_dir_count > 0` mas `phase_archive_path` estiver ausente:
- Parar e explicar que reiniciar numeração é inseguro sem um alvo de arquivo de milestone concluído.
- Dizer ao usuário para concluir/arquivar o milestone anterior primeiro, então reexecutar `/novo-marco --reset-phase-numbers ${WS}`.

## 8. Decisão de Pesquisa

Verificar `research_enabled` do JSON de init (carregado da config).

**Se `research_enabled` for `true`:**

AskUserQuestion: "Pesquisar o ecossistema do domínio para novas funcionalidades antes de definir requisitos?"
- "Pesquisar primeiro (Recomendado)" — Descobrir padrões, funcionalidades, arquitetura para NOVAS capacidades
- "Pular pesquisa para este milestone" — Ir direto para requisitos (não muda seu padrão)

**Se `research_enabled` for `false`:**

AskUserQuestion: "Pesquisar o ecossistema do domínio para novas funcionalidades antes de definir requisitos?"
- "Pular pesquisa (padrão atual)" — Ir direto para requisitos
- "Pesquisar primeiro" — Descobrir padrões, funcionalidades, arquitetura para NOVAS capacidades

**IMPORTANTE:** NÃO persistir esta escolha em config.json. A configuração `workflow.research` é uma preferência persistente do usuário que controla o comportamento de plan-phase em todo o projeto. Alterá-la aqui mudaria silenciosamente o comportamento futuro do `/planejar-fase`. Para mudar o padrão, use `/configuracoes`.

**Se o usuário escolheu "Pesquisar primeiro":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PESQUISANDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Criando 4 pesquisadores em paralelo...
  → Stack, Features, Architecture, Pitfalls
```

```bash
mkdir -p .planning/research
```

Criar 4 agentes project-researcher em paralelo. Cada um usa este template com campos específicos por dimensão:

**Estrutura comum para todos os 4 pesquisadores:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: ./.claude/framework/templates/research-project/{FILE}
</output>
", subagent_type="project-researcher", model="{researcher_model}", description="{DIMENSION} research")
```

**Campos específicos por dimensão:**

| Campo | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

Após todos os 4 concluírem, criar sintetizador:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

${AGENT_SKILLS_SYNTHESIZER}

Write to: .planning/research/SUMMARY.md
Use template: ./.claude/framework/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Exibir descobertas principais do SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PESQUISA CONCLUÍDA ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Adições à stack:** [do SUMMARY.md]
**Funcionalidades essenciais:** [do SUMMARY.md]
**Fique Atento a:** [do SUMMARY.md]
```

**Se "Pular pesquisa":** Continuar para o Passo 9.

## 9. Definir Requisitos

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► DEFININDO REQUISITOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ler PROJECT.md: valor central, objetivos do milestone atual, requisitos validados (o que existe).

**Se pesquisa existir:** Ler FEATURES.md, extrair categorias de funcionalidades.

Apresentar funcionalidades por categoria:
```
## [Categoria 1]
**Essenciais:** Funcionalidade A, Funcionalidade B
**Diferenciais:** Funcionalidade C, Funcionalidade D
**Notas de pesquisa:** [quaisquer notas relevantes]
```

**Se não houver pesquisa:** Coletar requisitos por conversa. Perguntar: "Quais são as principais coisas que os usuários precisam fazer com [novas funcionalidades]?" Clarificar, sondar capacidades relacionadas, agrupar em categorias.

**Definir escopo de cada categoria** via AskUserQuestion (multiSelect: true, header máx 12 chars):
- "[Funcionalidade 1]" — [breve descrição]
- "[Funcionalidade 2]" — [breve descrição]
- "Nenhuma para este milestone" — Adiar categoria inteira

Rastrear: Selecionado → este milestone. Essenciais não selecionados → futuro. Diferenciais não selecionados → fora do escopo.

**Identificar lacunas** via AskUserQuestion:
- "Não, a pesquisa cobriu" — Prosseguir
- "Sim, deixa eu adicionar alguns" — Capturar adições

**Gerar REQUIREMENTS.md:**
- Requisitos v1 agrupados por categoria (checkboxes, REQ-IDs)
- Requisitos Futuros (adiados)
- Fora do Escopo (exclusões explícitas com raciocínio)
- Seção de Rastreabilidade (vazia, preenchida pelo roadmap)

**Formato REQ-ID:** `[CATEGORIA]-[NUMERO]` (AUTH-01, NOTIF-02). Continuar numeração dos existentes.

**Critérios de qualidade de requisito:**

Bons requisitos são:
- **Específicos e testáveis:** "Usuário pode redefinir senha via link de e-mail" (não "Gerenciar redefinição de senha")
- **Centrados no usuário:** "Usuário pode X" (não "Sistema faz Y")
- **Atômicos:** Uma capacidade por requisito (não "Usuário pode fazer login e gerenciar perfil")
- **Independentes:** Dependências mínimas de outros requisitos

Apresentar lista COMPLETA de requisitos para confirmação:

```
## Requisitos do Milestone v[X.Y]

### [Categoria 1]
- [ ] **CAT1-01**: Usuário pode fazer X
- [ ] **CAT1-02**: Usuário pode fazer Y

### [Categoria 2]
- [ ] **CAT2-01**: Usuário pode fazer Z

Isso captura o que você está construindo? (sim / ajustar)
```

Se "ajustar": Voltar para definição de escopo.

**Commitar requisitos:**
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: define milestone v[X.Y] requirements" --files .planning/REQUIREMENTS.md
```

## 10. Criar Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► CRIANDO ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Criando roadmapper...
```

**Número de fase inicial:**
- Se `--reset-phase-numbers` estiver ativo, iniciar na **Fase 1**
- Caso contrário, continuar a partir do último número de fase do milestone anterior (v1.0 terminou na fase 5 → v1.1 começa na fase 6)

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
- .planning/MILESTONES.md
</files_to_read>

${AGENT_SKILLS_ROADMAPPER}

</planning_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Respect the selected numbering mode:
   - `--reset-phase-numbers` → start at Phase 1
   - default behavior → continue from the previous milestone's last phase number
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Lidar com retorno:**

**Se `## ROADMAP BLOCKED`:** Apresentar bloqueador, trabalhar com usuário, recriar agente.

**Se `## ROADMAP CREATED`:** Ler ROADMAP.md, apresentar inline:

```
## Roadmap Proposto

**[N] fases** | **[X] requisitos mapeados** | Todos cobertos ✓

| # | Fase | Objetivo | Requisitos | Critérios de Sucesso |
|---|------|----------|------------|----------------------|
| [N] | [Nome] | [Objetivo] | [REQ-IDs] | [contagem] |

### Detalhes da Fase

**Fase [N]: [Nome]**
Objetivo: [objetivo]
Requisitos: [REQ-IDs]
Critérios de sucesso:
1. [critério]
2. [critério]
```

**Pedir aprovação** via AskUserQuestion:
- "Aprovar" — Commitar e continuar
- "Ajustar fases" — Me diga o que mudar
- "Revisar arquivo completo" — Mostrar ROADMAP.md bruto

**Se "Ajustar":** Obter notas, recriar roadmapper com contexto de revisão, loop até aprovado.
**Se "Revisar":** Exibir ROADMAP.md bruto, re-perguntar.

**Commitar roadmap** (após aprovação):
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 11. Concluído

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► MILESTONE INICIALIZADO ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Nome]**

| Artefato       | Localização                 |
|----------------|-----------------------------|
| Projeto        | `.planning/PROJECT.md`      |
| Pesquisa       | `.planning/research/`       |
| Requisitos     | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] fases** | **[X] requisitos** | Pronto para construir ✓

## ▶ Próximo Passo

**Fase [N]: [Nome da Fase]** — [Objetivo]

`/discutir-fase [N] ${WS}` — coletar contexto e clarificar abordagem

<sub>`/clear` primeiro → janela de contexto fresca</sub>

Também: `/planejar-fase [N] ${WS}` — pular discussão, planejar diretamente
```

</process>

<success_criteria>
- [ ] PROJECT.md atualizado com seção de Milestone Atual
- [ ] STATE.md reiniciado para novo milestone
- [ ] MILESTONE-CONTEXT.md consumido e deletado (se existia)
- [ ] Pesquisa concluída (se selecionada) — 4 agentes paralelos, cientes do milestone
- [ ] Requisitos coletados e definidos por categoria
- [ ] REQUIREMENTS.md criado com REQ-IDs
- [ ] roadmapper criado com contexto de numeração de fases
- [ ] Arquivos de roadmap escritos imediatamente (não rascunho)
- [ ] Feedback do usuário incorporado (se houver)
- [ ] Modo de numeração de fases respeitado (continuado ou reiniciado)
- [ ] Todos os commits feitos (se docs de planejamento commitados)
- [ ] Usuário sabe próximo passo: `/discutir-fase [N] ${WS}`

**Commits atômicos:** Cada fase comita seus artefatos imediatamente.
</success_criteria>
