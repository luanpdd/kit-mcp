<planning_config>

Opções de configuração para o comportamento do diretório `.planning/`.

<config_schema>
```json
"planning": {
  "commit_docs": true,
  "search_gitignored": false
},
"git": {
  "branching_strategy": "none",
  "phase_branch_template": "framework/phase-{phase}-{slug}",
  "milestone_branch_template": "framework/{milestone}-{slug}",
  "quick_branch_template": null
}
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `commit_docs` | `true` | Se deve commitar artefatos de planejamento no git |
| `search_gitignored` | `false` | Adicionar `--no-ignore` a buscas amplas com rg |
| `git.branching_strategy` | `"none"` | Abordagem de branching git: `"none"`, `"phase"`, ou `"milestone"` |
| `git.phase_branch_template` | `"framework/phase-{phase}-{slug}"` | Template de branch para estratégia phase |
| `git.milestone_branch_template` | `"framework/{milestone}-{slug}"` | Template de branch para estratégia milestone |
| `git.quick_branch_template` | `null` | Template de branch opcional para execuções de tarefa rápida |
</config_schema>

<commit_docs_behavior>

**Quando `commit_docs: true` (padrão):**
- Arquivos de planejamento commitados normalmente
- SUMMARY.md, STATE.md, ROADMAP.md rastreados no git
- Histórico completo de decisões de planejamento preservado

**Quando `commit_docs: false`:**
- Pular todos os `git add`/`git commit` para arquivos `.planning/`
- O usuário deve adicionar `.planning/` ao `.gitignore`
- Útil para: contribuições OSS, projetos de clientes, manter o planejamento privado

**Usando tools.cjs (preferido):**

```bash
# Commit com verificações automáticas de commit_docs + gitignore:
node "./.claude/framework/bin/tools.cjs" commit "docs: update state" --files .planning/STATE.md

# Carregar config via state load (retorna JSON):
INIT=$(node "./.claude/framework/bin/tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs está disponível na saída JSON

# Ou use comandos init que incluem commit_docs:
INIT=$(node "./.claude/framework/bin/tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs está incluído em todas as saídas de comandos init
```

**Auto-detecção:** Se `.planning/` estiver no gitignore, `commit_docs` é automaticamente `false` independentemente do config.json. Isso evita erros de git quando usuários têm `.planning/` no `.gitignore`.

**Commit via CLI (trata verificações automaticamente):**

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: update state" --files .planning/STATE.md
```

O CLI verifica a configuração `commit_docs` e o status do gitignore internamente — sem condicionais manuais.

</commit_docs_behavior>

<search_behavior>

**Quando `search_gitignored: false` (padrão):**
- Comportamento padrão do rg (respeita .gitignore)
- Buscas por caminho direto funcionam: `rg "padrão" .planning/` encontra arquivos
- Buscas amplas pulam ignorados: `rg "padrão"` pula `.planning/`

**Quando `search_gitignored: true`:**
- Adicionar `--no-ignore` a buscas amplas com rg que devem incluir `.planning/`
- Necessário apenas ao buscar em todo o repositório e esperando correspondências em `.planning/`

**Nota:** A maioria das operações framework usa leituras diretas de arquivo ou caminhos explícitos, que funcionam independentemente do status do gitignore.

</search_behavior>

<setup_uncommitted_mode>

Para usar o modo não-commitado:

1. **Defina o config:**
   ```json
   "planning": {
     "commit_docs": false,
     "search_gitignored": true
   }
   ```

2. **Adicione ao .gitignore:**
   ```
   .planning/
   ```

3. **Arquivos rastreados existentes:** Se `.planning/` foi rastreado anteriormente:
   ```bash
   git rm -r --cached .planning/
   git commit -m "chore: stop tracking planning docs"
   ```

4. **Merges de branch:** Ao usar `branching_strategy: phase` ou `milestone`, o workflow `complete-milestone` remove automaticamente arquivos `.planning/` do staging antes de commits de merge quando `commit_docs: false`.

</setup_uncommitted_mode>

<branching_strategy_behavior>

**Estratégias de Branching:**

| Estratégia | Quando o branch é criado | Escopo do branch | Ponto de merge |
|------------|--------------------------|------------------|----------------|
| `none` | Nunca | N/A | N/A |
| `phase` | No início do `execute-phase` | Fase única | Usuário faz merge após a fase |
| `milestone` | No primeiro `execute-phase` do marco | Marco inteiro | Em `complete-milestone` |

**Quando `git.branching_strategy: "none"` (padrão):**
- Todo o trabalho commita para o branch atual
- Comportamento padrão do framework

**Quando `git.branching_strategy: "phase"`:**
- `execute-phase` cria/alterna para um branch antes da execução
- Nome do branch a partir de `phase_branch_template` (ex: `framework/phase-03-authentication`)
- Todos os commits do plano vão para aquele branch
- Usuário faz merge dos branches manualmente após a conclusão da fase
- `complete-milestone` oferece fazer merge de todos os branches de fase

**Quando `git.branching_strategy: "milestone"`:**
- O primeiro `execute-phase` do marco cria o branch do marco
- Nome do branch a partir de `milestone_branch_template` (ex: `framework/v1.0-mvp`)
- Todas as fases do marco commitam para o mesmo branch
- `complete-milestone` oferece fazer merge do branch do marco para main

**Variáveis de template:**

| Variável | Disponível em | Descrição |
|----------|---------------|-----------|
| `{phase}` | phase_branch_template | Número de fase com zero à esquerda (ex: "03") |
| `{slug}` | Ambos | Nome em minúsculas com hífens |
| `{milestone}` | milestone_branch_template | Versão do marco (ex: "v1.0") |

**Verificando o config:**

Use `init execute-phase` que retorna toda a config como JSON:
```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Saída JSON inclui: branching_strategy, phase_branch_template, milestone_branch_template
```

Ou use `state load` para os valores de config:
```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Analise branching_strategy, phase_branch_template, milestone_branch_template do JSON
```

**Criação de branch:**

```bash
# Para estratégia phase
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g" | sed "s/{slug}/$PHASE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# Para estratégia milestone
if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  MILESTONE_SLUG=$(echo "$MILESTONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed "s/{milestone}/$MILESTONE_VERSION/g" | sed "s/{slug}/$MILESTONE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

**Opções de merge em complete-milestone:**

| Opção | Comando git | Resultado |
|-------|-------------|-----------|
| Squash merge (recomendado) | `git merge --squash` | Único commit limpo por branch |
| Merge com histórico | `git merge --no-ff` | Preserva todos os commits individuais |
| Deletar sem merge | `git branch -D` | Descartar trabalho do branch |
| Manter branches | (nenhum) | Tratamento manual depois |

Squash merge é recomendado — mantém o histórico do branch main limpo enquanto preserva o histórico de desenvolvimento completo no branch (até ser deletado).

**Casos de uso:**

| Estratégia | Melhor para |
|------------|-------------|
| `none` | Desenvolvimento solo, projetos simples |
| `phase` | Code review por fase, rollback granular, colaboração em equipe |
| `milestone` | Branches de release, ambientes de staging, PR por versão |

</branching_strategy_behavior>

</planning_config>
