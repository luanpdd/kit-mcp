<purpose>

Marcar uma versão enviada (v1.0, v1.1, v2.0) como completa. Cria registro histórico no MILESTONES.md, realiza revisão completa de evolução do PROJECT.md, reorganiza ROADMAP.md com agrupamentos de milestone e tageia o release no git.

</purpose>

<required_reading>

1. templates/milestone.md
2. templates/milestone-archive.md
3. `.planning/ROADMAP.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/PROJECT.md`

</required_reading>

<archival_behavior>

Quando um milestone é concluído:

1. Extrair detalhes completos do milestone para `.planning/milestones/v[X.Y]-ROADMAP.md`
2. Arquivar requisitos para `.planning/milestones/v[X.Y]-REQUIREMENTS.md`
3. Atualizar ROADMAP.md — substituir detalhes do milestone por resumo em uma linha
4. Deletar REQUIREMENTS.md (novo para próximo milestone)
5. Realizar revisão completa de evolução do PROJECT.md
6. Oferecer criar próximo milestone inline
7. Arquivar artefatos UI (`*-UI-SPEC.md`, `*-UI-REVIEW.md`) junto com outros documentos de fase
8. Limpar arquivos de screenshot `.planning/ui-reviews/` (ativos binários, nunca arquivados)

**Eficiência de Contexto:** Arquivos mantêm ROADMAP.md de tamanho constante e REQUIREMENTS.md com escopo de milestone.

**Arquivo ROADMAP** usa `templates/milestone-archive.md` — inclui cabeçalho de milestone (status, fases, data), detalhes completos de fase, resumo do milestone (decisões, issues, dívida técnica).

**Arquivo REQUIREMENTS** contém todos os requisitos marcados como completos com resultados, tabela de rastreabilidade com status final, notas sobre requisitos alterados.

</archival_behavior>

<process>

<step name="verify_readiness">

**Usar `roadmap analyze` para verificação abrangente de prontidão:**

```bash
ROADMAP=$(node "./.claude/framework/bin/tools.cjs" roadmap analyze)
```

Isso retorna todas as fases com contagens de plano/resumo e status de disco. Usar isso para verificar:
- Quais fases pertencem a este milestone?
- Todas as fases completas (todos os planos têm resumos)? Verificar `disk_status === 'complete'` para cada uma.
- `progress_percent` deve ser 100%.

**Verificação de conclusão de requisitos (OBRIGATÓRIO antes de apresentar):**

Analisar tabela de rastreabilidade do REQUIREMENTS.md:
- Contar total de requisitos v1 vs requisitos marcados (`[x]`)
- Identificar quaisquer linhas não-Completas na tabela de rastreabilidade

Apresentar:

```
Milestone: [Nome, ex: "v1.0 MVP"]

Inclui:
- Fase 1: Foundation (2/2 planos completos)
- Fase 2: Authentication (2/2 planos completos)
- Fase 3: Core Features (3/3 planos completos)
- Fase 4: Polish (1/1 plano completo)

Total: {phase_count} fases, {total_plans} planos, todos completos
Requisitos: {N}/{M} requisitos v1 marcados
```

**Se requisitos incompletos** (N < M):

```
⚠ Requisitos Não Marcados:

- [ ] {REQ-ID}: {descrição} (Fase {X})
- [ ] {REQ-ID}: {descrição} (Fase {Y})
```

DEVE apresentar 3 opções:
1. **Prosseguir mesmo assim** — marcar milestone como completo com lacunas conhecidas
2. **Executar auditoria primeiro** — `/auditar-marco` para avaliar severidade das lacunas
3. **Abortar** — retornar ao desenvolvimento

Se o usuário selecionar "Prosseguir mesmo assim": notar requisitos incompletos no MILESTONES.md em `### Lacunas Conhecidas` com REQ-IDs e descrições.

<config-check>

```bash
cat .planning/config.json 2>/dev/null || true
```

</config-check>

<if mode="yolo">

```
⚡ Auto-aprovado: Verificação de escopo do milestone
[Mostrar resumo de breakdown sem perguntar]
Prosseguindo para coleta de estatísticas...
```

Prosseguir para gather_stats.

</if>

<if mode="interactive" OR="custom with gates.confirm_milestone_scope true">

```
Pronto para marcar este milestone como enviado?
(sim / esperar / ajustar escopo)
```

Aguardar confirmação.
- "ajustar escopo": Perguntar quais fases incluir.
- "esperar": Parar, usuário retorna quando pronto.

</if>

</step>

<step name="gather_stats">

Calcular estatísticas do milestone:

```bash
git log --oneline --grep="feat(" | head -20
git diff --stat FIRST_COMMIT..LAST_COMMIT | tail -1
find . -name "*.swift" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null || true
git log --format="%ai" FIRST_COMMIT | tail -1
git log --format="%ai" LAST_COMMIT | head -1
```

Apresentar:

```
Estatísticas do Milestone:
- Fases: [X-Y]
- Planos: [Z] total
- Tarefas: [N] total (dos resumos de fase)
- Arquivos modificados: [M]
- Linhas de código: [LOC] [linguagem]
- Linha do tempo: [Dias] dias ([Início] → [Fim])
- Intervalo Git: feat(XX-XX) → feat(YY-YY)
```

</step>

<step name="extract_accomplishments">

Extrair resumos de uma linha dos arquivos SUMMARY.md usando summary-extract:

```bash
# Para cada fase no milestone, extrair uma linha
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  [ -e "$summary" ] || continue
  node "./.claude/framework/bin/tools.cjs" summary-extract "$summary" --fields one_liner --pick one_liner
done
```

Extrair 4-6 realizações principais. Apresentar:

```
Realizações principais para este milestone:
1. [Conquista da fase 1]
2. [Conquista da fase 2]
3. [Conquista da fase 3]
4. [Conquista da fase 4]
5. [Conquista da fase 5]
```

</step>

<step name="create_milestone_entry">

**Nota:** A entrada do MILESTONES.md agora é criada automaticamente por `tools milestone complete` no passo archive_milestone. A entrada inclui versão, data, contagens de fase/plano/tarefa e realizações extraídas dos arquivos SUMMARY.md.

Se detalhes adicionais forem necessários (ex: resumo "Entregado" fornecido pelo usuário, intervalo git, estatísticas LOC), adicioná-los manualmente após a CLI criar a entrada base.

</step>

<step name="evolve_project_full_review">

Revisão completa de evolução do PROJECT.md na conclusão do milestone.

Ler todos os resumos de fase:

```bash
cat .planning/phases/*-*/*-SUMMARY.md
```

**Checklist de revisão completa:**

1. **Precisão de "O Que É":**
   - Comparar descrição atual com o que foi construído
   - Atualizar se o produto mudou de forma significativa

2. **Verificação de Valor Central:**
   - Ainda é a prioridade correta? O envio revelou um valor central diferente?
   - Atualizar se A ÚNICA COISA mudou

3. **Auditoria de Requisitos:**

   **Seção Validados:**
   - Todos os requisitos Ativos enviados neste milestone → Mover para Validados
   - Formato: `- ✓ [Requisito] — v[X.Y]`

   **Seção Ativos:**
   - Remover requisitos movidos para Validados
   - Adicionar novos requisitos para próximo milestone
   - Manter requisitos não endereçados

   **Auditoria de Fora do Escopo:**
   - Revisar cada item — raciocínio ainda é válido?
   - Remover itens irrelevantes
   - Adicionar requisitos invalidados durante o milestone

4. **Atualização de Contexto:**
   - Estado atual da base de código (LOC, stack tecnológica)
   - Temas de feedback do usuário (se houver)
   - Issues conhecidas ou dívida técnica

5. **Auditoria de Decisões Importantes:**
   - Extrair todas as decisões dos resumos de fase do milestone
   - Adicionar à tabela de Decisões Importantes com resultados
   - Marcar ✓ Bom, ⚠️ Revisar, ou — Pendente

6. **Verificação de Restrições:**
   - Alguma restrição mudou durante o desenvolvimento? Atualizar conforme necessário

Atualizar PROJECT.md inline. Atualizar rodapé "Última atualização":

```markdown
---
*Última atualização: [data] após milestone v[X.Y]*
```

**Passo completo quando:**

- [ ] "O Que É" revisado e atualizado se necessário
- [ ] Valor Central verificado como ainda correto
- [ ] Todos os requisitos enviados movidos para Validados
- [ ] Novos requisitos adicionados a Ativos para próximo milestone
- [ ] Raciocínio de Fora do Escopo auditado
- [ ] Contexto atualizado com estado atual
- [ ] Todas as decisões do milestone adicionadas a Decisões Importantes
- [ ] Rodapé "Última atualização" reflete conclusão do milestone

</step>

<step name="reorganize_roadmap">

Atualizar `.planning/ROADMAP.md` — agrupar fases do milestone concluído:

```markdown
# Roadmap: [Nome do Projeto]

## Milestones

- ✅ **v1.0 MVP** — Fases 1-4 (enviado YYYY-MM-DD)
- 🚧 **v1.1 Segurança** — Fases 5-6 (em progresso)
- 📋 **v2.0 Redesign** — Fases 7-10 (planejado)

## Fases

<details>
<summary>✅ v1.0 MVP (Fases 1-4) — ENVIADO YYYY-MM-DD</summary>

- [x] Fase 1: Foundation (2/2 planos) — concluído YYYY-MM-DD
- [x] Fase 2: Authentication (2/2 planos) — concluído YYYY-MM-DD
- [x] Fase 3: Core Features (3/3 planos) — concluído YYYY-MM-DD
- [x] Fase 4: Polish (1/1 plano) — concluído YYYY-MM-DD

</details>

### 🚧 v[Próximo] [Nome] (Em Progresso / Planejado)

- [ ] Fase 5: [Nome] ([N] planos)
- [ ] Fase 6: [Nome] ([N] planos)

## Progresso

| Fase              | Milestone | Planos Completos | Status       | Concluído  |
| ----------------- | --------- | ---------------- | ------------ | ---------- |
| 1. Foundation     | v1.0      | 2/2              | Completo     | YYYY-MM-DD |
| 2. Authentication | v1.0      | 2/2              | Completo     | YYYY-MM-DD |
| 3. Core Features  | v1.0      | 3/3              | Completo     | YYYY-MM-DD |
| 4. Polish         | v1.0      | 1/1              | Completo     | YYYY-MM-DD |
| 5. Auditoria Seg. | v1.1      | 0/1              | Não iniciado | -          |
| 6. Hardening      | v1.1      | 0/2              | Não iniciado | -          |
```

</step>

<step name="archive_milestone">

**Delegar arquivamento ao tools:**

```bash
ARCHIVE=$(node "./.claude/framework/bin/tools.cjs" milestone complete "v[X.Y]" --name "[Nome do Milestone]")
```

A CLI cuida de:
- Criar diretório `.planning/milestones/`
- Arquivar ROADMAP.md para `milestones/v[X.Y]-ROADMAP.md`
- Arquivar REQUIREMENTS.md para `milestones/v[X.Y]-REQUIREMENTS.md` com cabeçalho de arquivo
- Mover arquivo de auditoria para milestones se existir
- Criar/anexar entrada MILESTONES.md com realizações dos arquivos SUMMARY.md
- Atualizar STATE.md (status, última atividade)

Extrair do resultado: `version`, `date`, `phases`, `plans`, `tasks`, `accomplishments`, `archived`.

Verificar: `✅ Milestone arquivado em .planning/milestones/`

**Arquivamento de fase (opcional):** Após o arquivamento concluir, perguntar ao usuário:

AskUserQuestion(header="Arquivar Fases", question="Arquivar diretórios de fase para milestones/?", options: "Sim — mover para milestones/v[X.Y]-phases/" | "Pular — manter fases no lugar")

Se "Sim": mover diretórios de fase para o arquivo de milestone:
```bash
mkdir -p .planning/milestones/v[X.Y]-phases
# Para cada diretório de fase em .planning/phases/:
mv .planning/phases/{phase-dir} .planning/milestones/v[X.Y]-phases/
```
Verificar: `✅ Diretórios de fase arquivados em .planning/milestones/v[X.Y]-phases/`

Se "Pular": Diretórios de fase permanecem em `.planning/phases/` como histórico de execução bruto. Use `/limpeza` mais tarde para arquivar retroativamente.

Após o arquivamento, a IA ainda cuida de:
- Reorganizar ROADMAP.md com agrupamento de milestone (requer julgamento)
- Revisão completa de evolução do PROJECT.md (requer compreensão)
- Deletar ROADMAP.md e REQUIREMENTS.md originais
- Estes NÃO são totalmente delegados porque requerem interpretação de conteúdo pela IA

</step>

<step name="reorganize_roadmap_and_delete_originals">

Após `milestone complete` ter arquivado, reorganizar ROADMAP.md com agrupamentos de milestone, então deletar originais:

**Reorganizar ROADMAP.md** — agrupar fases do milestone concluído:

```markdown
# Roadmap: [Nome do Projeto]

## Milestones

- ✅ **v1.0 MVP** — Fases 1-4 (enviado YYYY-MM-DD)
- 🚧 **v1.1 Segurança** — Fases 5-6 (em progresso)

## Fases

<details>
<summary>✅ v1.0 MVP (Fases 1-4) — ENVIADO YYYY-MM-DD</summary>

- [x] Fase 1: Foundation (2/2 planos) — concluído YYYY-MM-DD
- [x] Fase 2: Authentication (2/2 planos) — concluído YYYY-MM-DD

</details>
```

**Então deletar originais:**

```bash
rm .planning/ROADMAP.md
rm .planning/REQUIREMENTS.md
```

</step>

<step name="write_retrospective">

**Anexar à retrospectiva viva:**

Verificar retrospectiva existente:
```bash
ls .planning/RETROSPECTIVE.md 2>/dev/null || true
```

**Se existir:** Ler o arquivo, anexar nova seção de milestone antes da seção "## Tendências Cross-Milestone".

**Se não existir:** Criar a partir do template em `./.claude/framework/templates/retrospective.md`.

**Coletar dados de retrospectiva:**

1. De arquivos SUMMARY.md: Extrair principais entregáveis, resumos de uma linha, decisões técnicas
2. De arquivos VERIFICATION.md: Extrair pontuações de verificação, lacunas encontradas
3. De arquivos UAT.md: Extrair resultados de testes, issues encontradas
4. De git log: Contar commits, calcular linha do tempo
5. Do trabalho do milestone: Refletir sobre o que funcionou e o que não funcionou

**Escrever a seção do milestone:**

```markdown
## Milestone: v{versão} — {nome}

**Enviado:** {data}
**Fases:** {phase_count} | **Planos:** {plan_count}

### O Que Foi Construído
{Extrair resumos de uma linha do SUMMARY.md}

### O Que Funcionou
{Padrões que levaram a execução suave}

### O Que Foi Ineficiente
{Oportunidades perdidas, retrabalho, gargalos}

### Padrões Estabelecidos
{Novas convenções descobertas durante este milestone}

### Lições Principais
{Aprendizados específicos e acionáveis}

### Observações de Custo
- Mix de modelos: {X}% opus, {Y}% sonnet, {Z}% haiku
- Sessões: {contagem}
- Notável: {observação de eficiência}
```

**Atualizar tendências cross-milestone:**

Se a seção "## Tendências Cross-Milestone" existir, atualizar as tabelas com novos dados deste milestone.

**Commitar:**
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: atualizar retrospectiva para v${VERSION}" --files .planning/RETROSPECTIVE.md
```

</step>

<step name="update_state">

A maioria das atualizações do STATE.md foi tratada pelo `milestone complete`, mas verificar e atualizar campos restantes:

**Referência do Projeto:**

```markdown
## Referência do Projeto

Ver: .planning/PROJECT.md (atualizado [hoje])

**Valor central:** [Valor central atual do PROJECT.md]
**Foco atual:** [Próximo milestone ou "Planejando próximo milestone"]
```

**Contexto Acumulado:**
- Limpar resumo de decisões (log completo no PROJECT.md)
- Limpar bloqueadores resolvidos
- Manter bloqueadores abertos para próximo milestone

</step>

<step name="handle_branches">

Verificar estratégia de branching e oferecer opções de merge.

Usar `init milestone-op` para contexto, ou carregar config diretamente:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair `branching_strategy`, `phase_branch_template`, `milestone_branch_template` e `commit_docs` do JSON de init.

**Se "none":** Pular para git_tag.

**Para estratégia "phase":**

```bash
BRANCH_PREFIX=$(echo "$PHASE_BRANCH_TEMPLATE" | sed 's/{.*//')
PHASE_BRANCHES=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ')
```

**Para estratégia "milestone":**

```bash
BRANCH_PREFIX=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed 's/{.*//')
MILESTONE_BRANCH=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ' | head -1)
```

**Se nenhuma branch encontrada:** Pular para git_tag.

**Se branches existirem:**

```
## Branches Git Detectadas

Estratégia de branching: {phase/milestone}
Branches: {lista}

Opções:
1. **Merge para main** — Fazer merge da(s) branch(es) para main
2. **Deletar sem merge** — Já foi feito merge ou não é necessário
3. **Manter branches** — Deixar para tratamento manual
```

AskUserQuestion com opções: Squash merge (Recomendado), Merge com histórico, Deletar sem merge, Manter branches.

**Squash merge:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
git checkout main

if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git merge --squash "$branch"
    # Remover .planning/ do staging se commit_docs for false
    if [ "$COMMIT_DOCS" = "false" ]; then
      git reset HEAD .planning/ 2>/dev/null || true
    fi
    git commit -m "feat: $branch para v[X.Y]"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git merge --squash "$MILESTONE_BRANCH"
  # Remover .planning/ do staging se commit_docs for false
  if [ "$COMMIT_DOCS" = "false" ]; then
    git reset HEAD .planning/ 2>/dev/null || true
  fi
  git commit -m "feat: $MILESTONE_BRANCH para v[X.Y]"
fi

git checkout "$CURRENT_BRANCH"
```

**Merge com histórico:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
git checkout main

if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git merge --no-ff --no-commit "$branch"
    # Remover .planning/ do staging se commit_docs for false
    if [ "$COMMIT_DOCS" = "false" ]; then
      git reset HEAD .planning/ 2>/dev/null || true
    fi
    git commit -m "Merge branch '$branch' para v[X.Y]"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git merge --no-ff --no-commit "$MILESTONE_BRANCH"
  # Remover .planning/ do staging se commit_docs for false
  if [ "$COMMIT_DOCS" = "false" ]; then
    git reset HEAD .planning/ 2>/dev/null || true
  fi
  git commit -m "Merge branch '$MILESTONE_BRANCH' para v[X.Y]"
fi

git checkout "$CURRENT_BRANCH"
```

**Deletar sem merge:**

```bash
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git branch -d "$branch" 2>/dev/null || git branch -D "$branch"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git branch -d "$MILESTONE_BRANCH" 2>/dev/null || git branch -D "$MILESTONE_BRANCH"
fi
```

**Manter branches:** Reportar "Branches preservadas para tratamento manual"

</step>

<step name="git_tag">

Criar tag git:

```bash
git tag -a v[X.Y] -m "v[X.Y] [Nome]

Entregado: [Uma frase]

Realizações principais:
- [Item 1]
- [Item 2]
- [Item 3]

Ver .planning/MILESTONES.md para detalhes completos."
```

Confirmar: "Taggeado: v[X.Y]"

Perguntar: "Fazer push da tag para o remoto? (s/n)"

Se sim:
```bash
git push origin v[X.Y]
```

</step>

<step name="git_commit_milestone">

Commitar conclusão do milestone.

```bash
node "./.claude/framework/bin/tools.cjs" commit "chore: concluir milestone v[X.Y]" --files .planning/milestones/v[X.Y]-ROADMAP.md .planning/milestones/v[X.Y]-REQUIREMENTS.md .planning/milestones/v[X.Y]-MILESTONE-AUDIT.md .planning/MILESTONES.md .planning/PROJECT.md .planning/STATE.md
```

Confirmar: "Commitado: chore: concluir milestone v[X.Y]"

</step>

<step name="offer_next">

```
✅ Milestone v[X.Y] [Nome] concluído

Enviado:
- [N] fases ([M] planos, [P] tarefas)
- [Uma frase do que foi enviado]

Arquivado:
- milestones/v[X.Y]-ROADMAP.md
- milestones/v[X.Y]-REQUIREMENTS.md

Resumo: .planning/MILESTONES.md
Tag: v[X.Y]

---

## ▶ Próximo Passo

**Iniciar Próximo Milestone** — questionamento → pesquisa → requisitos → roadmap

`/novo-marco`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

---
```

</step>

</process>

<milestone_naming>

**Convenções de versão:**
- **v1.0** — MVP Inicial
- **v1.1, v1.2** — Atualizações menores, novas funcionalidades, correções
- **v2.0, v3.0** — Reescritas maiores, mudanças breaking, nova direção

**Nomes:** Palavras curtas 1-2 (v1.0 MVP, v1.1 Segurança, v1.2 Performance, v2.0 Redesign).

</milestone_naming>

<what_qualifies>

**Criar milestones para:** Release inicial, releases públicos, conjuntos de funcionalidades principais enviados, antes de arquivar planejamento.

**Não criar milestones para:** Cada conclusão de fase (muito granular), trabalho em progresso, iterações de dev internas (a menos que realmente enviado).

Heurística: "Isso foi implantado/usável/enviado?" Se sim → milestone. Se não → continuar trabalhando.

</what_qualifies>

<success_criteria>

A conclusão do milestone é bem-sucedida quando:

- [ ] Entrada MILESTONES.md criada com estatísticas e realizações
- [ ] Revisão completa de evolução do PROJECT.md concluída
- [ ] Todos os requisitos enviados movidos para Validados no PROJECT.md
- [ ] Decisões Importantes atualizadas com resultados
- [ ] ROADMAP.md reorganizado com agrupamento de milestone
- [ ] Arquivo de roadmap criado (milestones/v[X.Y]-ROADMAP.md)
- [ ] Arquivo de requisitos criado (milestones/v[X.Y]-REQUIREMENTS.md)
- [ ] REQUIREMENTS.md deletado (novo para próximo milestone)
- [ ] STATE.md atualizado com referência de projeto fresca
- [ ] Tag git criada (v[X.Y])
- [ ] Commit de milestone feito (inclui arquivos de arquivo e deleção)
- [ ] Conclusão de requisitos verificada contra tabela de rastreabilidade do REQUIREMENTS.md
- [ ] Requisitos incompletos surfaçados com opções prosseguir/auditar/abortar
- [ ] Lacunas conhecidas registradas no MILESTONES.md se usuário prosseguiu com requisitos incompletos
- [ ] RETROSPECTIVE.md atualizado com seção de milestone
- [ ] Tendências cross-milestone atualizadas
- [ ] Usuário conhece próximo passo (/novo-marco)

</success_criteria>
