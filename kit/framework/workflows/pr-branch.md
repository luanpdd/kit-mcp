<purpose>
Cria uma branch limpa para pull requests, filtrando commits do diretório .planning/.
A branch de PR contém apenas mudanças de código — revisores não veem artefatos framework
(PLAN.md, SUMMARY.md, STATE.md, CONTEXT.md, etc.).

Usa git cherry-pick com filtragem de caminho para reconstruir um histórico limpo.
</purpose>

<process>

<step name="detect_state">
Analise `$ARGUMENTS` para branch alvo (padrão: `main`).

```bash
CURRENT_BRANCH=$(git branch --show-current)
TARGET=${1:-main}
```

Verifique pré-condições:
- Deve estar em uma branch de feature (não main/master)
- Deve ter commits à frente do alvo

```bash
AHEAD=$(git rev-list --count "$TARGET".."$CURRENT_BRANCH" 2>/dev/null)
if [ "$AHEAD" = "0" ]; then
  echo "Nenhum commit à frente de $TARGET — nada para filtrar."
  exit 0
fi
```

Exiba:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► BRANCH DE PR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: {CURRENT_BRANCH}
Alvo: {TARGET}
Commits: {AHEAD} à frente
```
</step>

<step name="analyze_commits">
Classifique os commits:

```bash
# Obter todos os commits à frente do alvo
git log --oneline "$TARGET".."$CURRENT_BRANCH" --no-merges
```

Para cada commit, verifique se ele toca APENAS arquivos em .planning/:

```bash
# Para cada hash de commit
FILES=$(git diff-tree --no-commit-id --name-only -r $HASH)
ALL_PLANNING=$(echo "$FILES" | grep -v "^\.planning/" | wc -l)
```

Classifique:
- **Commits de código**: Tocam ao menos um arquivo fora de .planning/ → INCLUIR
- **Commits apenas de planejamento**: Tocam apenas arquivos em .planning/ → EXCLUIR
- **Commits mistos**: Tocam ambos → INCLUIR (mudanças de planejamento vêm junto)

Exiba a análise:
```
Commits a incluir: {N} (mudanças de código)
Commits a excluir: {N} (apenas planejamento)
Commits mistos: {N} (código + planejamento — incluídos)
```
</step>

<step name="create_pr_branch">
```bash
PR_BRANCH="${CURRENT_BRANCH}-pr"

# Criar branch de PR a partir do alvo
git checkout -b "$PR_BRANCH" "$TARGET"
```

Cherry-pick apenas commits de código (em ordem):

```bash
for HASH in $CODE_COMMITS; do
  git cherry-pick "$HASH" --no-commit
  # Remover qualquer arquivo .planning/ que veio em commits mistos
  git rm -r --cached .planning/ 2>/dev/null || true
  git commit -C "$HASH"
done
```

Retorne à branch original:
```bash
git checkout "$CURRENT_BRANCH"
```
</step>

<step name="verify">
```bash
# Verificar se há arquivos .planning/ na branch de PR
PLANNING_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | grep "^\.planning/" | wc -l)
TOTAL_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | wc -l)
PR_COMMITS=$(git rev-list --count "$TARGET".."$PR_BRANCH")
```

Exiba os resultados:
```
✅ Branch de PR criada: {PR_BRANCH}

Original: {AHEAD} commits, {ORIGINAL_FILES} arquivos
Branch de PR: {PR_COMMITS} commits, {TOTAL_FILES} arquivos
Arquivos de planejamento: {PLANNING_FILES} (deve ser 0)

Próximos passos:
  git push origin {PR_BRANCH}
  gh pr create --base {TARGET} --head {PR_BRANCH}

Ou use /publicar para criar o PR automaticamente.
```
</step>

</process>

<success_criteria>
- [ ] Branch de PR criada a partir do alvo
- [ ] Commits somente de planejamento excluídos
- [ ] Sem arquivos .planning/ no diff da branch de PR
- [ ] Mensagens de commit preservadas do original
- [ ] Usuário visualiza os próximos passos
</success_criteria>
