<purpose>
Cria um pull request a partir do trabalho concluído de fase/marco, gera um corpo rico para o PR a partir dos artefatos de planejamento, opcionalmente executa revisão de código e prepara para o merge. Fecha o loop planejar → executar → verificar → publicar.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="initialize">
Analise os argumentos e carregue o estado do projeto:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analise do JSON do init: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`.

Também carregue o config para a estratégia de branching:
```bash
CONFIG=$(node "./.claude/framework/bin/tools.cjs" state load)
```

Extraia: `branching_strategy`, `branch_name`.
</step>

<step name="preflight_checks">
Verifique se o trabalho está pronto para publicar:

1. **Verificação passou?**
   ```bash
   VERIFICATION=$(cat ${PHASE_DIR}/*-VERIFICATION.md 2>/dev/null)
   ```
   Verifique `status: passed` ou `status: human_needed` (com aprovação humana).
   Se nenhum VERIFICATION.md ou status for `gaps_found`: avise e peça confirmação do usuário.

2. **Árvore de trabalho limpa?**
   ```bash
   git status --short
   ```
   Se houver mudanças não commitadas: peça ao usuário para fazer commit ou stash primeiro.

3. **Na branch correta?**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```
   Se estiver em `main`/`master`: avise — deve estar em uma branch de feature.
   Se a branching_strategy for `none`: ofereça criar uma branch agora.

4. **Remote configurado?**
   ```bash
   git remote -v | head -2
   ```
   Detecte o remote `origin`. Se nenhum remote: erro — não é possível criar PR.

5. **CLI `gh` disponível?**
   ```bash
   which gh && gh auth status 2>&1
   ```
   Se `gh` não encontrado ou não autenticado: forneça instruções de configuração e encerre.
</step>

<step name="push_branch">
Faça push da branch atual para o remote:

```bash
git push origin ${CURRENT_BRANCH} 2>&1
```

Se o push falhar (ex.: sem upstream): defina o upstream:
```bash
git push --set-upstream origin ${CURRENT_BRANCH} 2>&1
```

Reporte: "Push de `{branch}` para origin ({contagem_commits} commits à frente de main)"
</step>

<step name="generate_pr_body">
Gere automaticamente um corpo rico para o PR a partir dos artefatos de planejamento:

**1. Título:**
```
Fase {número_da_fase}: {nome_da_fase}
```
Ou para marco: `Marco {versão}: {nome}`

**2. Seção de Resumo:**
Leia ROADMAP.md para o objetivo da fase. Leia VERIFICATION.md para o status de verificação.

```markdown
## Resumo

**Fase {N}: {Nome}**
**Objetivo:** {objetivo do ROADMAP.md}
**Status:** Verificado ✓

{Um parágrafo sintetizado dos arquivos SUMMARY.md — o que foi construído}
```

**3. Seção de Mudanças:**
Para cada SUMMARY.md no diretório da fase:
```markdown
## Mudanças

### Plano {plan_id}: {nome_do_plano}
{uma_linha do frontmatter do SUMMARY.md}

**Arquivos principais:**
{key-files.created e key-files.modified do frontmatter do SUMMARY.md}
```

**4. Seção de Requisitos:**
```markdown
## Requisitos Atendidos

{REQ-IDs do frontmatter do plano, vinculados às descrições do REQUIREMENTS.md}
```

**5. Seção de Testes:**
```markdown
## Verificação

- [x] Verificação automatizada: {passou/falhou do VERIFICATION.md}
- {itens de verificação humana do VERIFICATION.md, se houver}
```

**6. Seção de Decisões:**
```markdown
## Decisões Principais

{Decisões do contexto acumulado do STATE.md relevantes para esta fase}
```
</step>

<step name="create_pr">
Crie o PR usando o corpo gerado:

```bash
gh pr create \
  --title "Fase ${PHASE_NUMBER}: ${PHASE_NAME}" \
  --body "${PR_BODY}" \
  --base main
```

Se a flag `--draft` foi passada: adicione `--draft`.

Reporte: "PR #{número} criado: {url}"
</step>

<step name="optional_review">
Pergunte se o usuário quer acionar uma revisão de código:

```
AskUserQuestion:
  question: "PR criado. Executar revisão de código antes do merge?"
  options:
    - label: "Pular revisão"
      description: "PR está pronto — fazer merge quando CI passar"
    - label: "Auto-revisão"
      description: "Vou revisar o diff no PR eu mesmo"
    - label: "Solicitar revisão"
      description: "Solicitar revisão de um colega de equipe"
```

**Se "Solicitar revisão":**
```bash
gh pr edit ${PR_NUMBER} --add-reviewer "${REVIEWER}"
```

**Se "Auto-revisão":**
Reporte a URL do PR e sugira: "Revise o diff em {url}/files"
</step>

<step name="track_shipping">
Atualize o STATE.md para refletir a ação de publicação:

```bash
node "./.claude/framework/bin/tools.cjs" state update "Last Activity" "$(date +%Y-%m-%d)"
node "./.claude/framework/bin/tools.cjs" state update "Status" "Fase ${PHASE_NUMBER} publicada — PR #${PR_NUMBER}"
```

Se `commit_docs` for true:
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): publicar fase ${PHASE_NUMBER} — PR #${PR_NUMBER}" --files .planning/STATE.md
```
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## ✓ Fase {X}: {Nome} — Publicada

PR: #{número} ({url})
Branch: {branch} → main
Commits: {contagem}
Verificação: ✓ Passou
Requisitos: {N} REQ-IDs atendidos

Próximos passos:
- Revisar/aprovar PR
- Fazer merge quando CI passar
- /concluir-marco (se for a última fase do marco)
- /progresso (para ver o que vem a seguir)

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
Após publicar:

- /concluir-marco — se todas as fases do marco estiverem concluídas
- /progresso — ver o estado geral do projeto
- /executar-fase {próxima} — continuar para a próxima fase
</offer_next>

<success_criteria>
- [ ] Verificações de preflight passaram (verificação, árvore limpa, branch, remote, gh)
- [ ] Branch enviada para o remote via push
- [ ] PR criado com corpo rico gerado automaticamente
- [ ] STATE.md atualizado com status de publicação
- [ ] Usuário conhece o número do PR e os próximos passos
</success_criteria>
