---
name: publicar
description: Publica o milestone atual — cria documentação no Notion, abre PR no GitHub com link Notion na descrição
argument-hint: "[versão opcional, ex: 'v1.1']"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - AskUserQuestion
  - mcp__claude_ai_Notion__notion-create-pages
---

# /publicar — Publicar Milestone com Documentação Notion + GitHub

Publica o milestone atual: cria documentação no Notion, abre PR no GitHub e inclui o link Notion na descrição do PR.

## Quando usar

Após concluir e arquivar um milestone com `/concluir-marco`.

## Dependências obrigatórias

- `.claude/notion-config.json` presente e preenchido — se não existir, encerre com:
  > "⛔ notion-config.json não encontrado. Execute /setup-notion para configurar o Notion deste projeto."
- Notion MCP configurado na sessão Claude Code
- `gh` CLI autenticado (`gh auth status`)
- Milestone arquivado com `/concluir-marco`

## Dependências opcionais

- `$OBSIDIAN_TEAM_VAULT` — caminho absoluto do cofre Obsidian do time (sincronizado via Git).
  - Se ausente ou inválido: o **Passo 5 (Obsidian)** é pulado com aviso, sem quebrar PR/Notion.

## Processo

### Passo 1 — Ler contexto

Leia os seguintes arquivos:
- `.claude/notion-config.json` → IDs das páginas Notion
- `.planning/STATE.md` → versão e nome do milestone
- `.planning/PROJECT.md` → nome e stack do projeto
- `.planning/milestones/` → arquivos do último milestone arquivado (ROADMAP + REQUIREMENTS)
- `.planning/milestones/vX.X-MILESTONE-AUDIT.md` → cobertura de requisitos e métricas

Extraia:
- `VERSION` — ex: `v1.1`
- `MILESTONE_NAME` — ex: `Nome do Milestone`
- `NOTION_CHANGELOG_PAGE_ID` — do notion-config.json
- Realizações principais (das SUMMARY.md ou do ROADMAP arquivado)
- Decisões arquiteturais (do STATE.md ou SUMMARYs)
- Dívidas técnicas
- Métricas (testes, arquivos, fases, planos)

### Passo 2 — Decidir branch de publicação

Execute `git branch --show-current` para identificar a branch local atual.

Use `AskUserQuestion` com opções para perguntar ao usuário:

```
question: "Branch atual: {BRANCH_ATUAL}. Como deseja publicar?"
header: "Branch"
options:
  - label: "Usar branch atual"
    description: "Commit, push e PR na branch {BRANCH_ATUAL}"
  - label: "Criar nova branch"
    description: "Criar uma branch a partir da main com nome baseado nas mudanças"
```

#### Se "Usar branch atual"

- Verifique mudanças não commitadas: `git status --porcelain`
- Se houver, use `AskUserQuestion`:
  ```
  question: "Há mudanças não commitadas. Deseja incluí-las no commit?"
  header: "Commit"
  options:
    - label: "Sim, incluir tudo"
      description: "git add . — o commit será feito após criar o Notion (para incluir o link)"
    - label: "Não, só fazer push"
      description: "Pular o commit e ir direto para o push"
  ```
  - Se "Sim": guarde `PENDENTE_COMMIT = true`. O commit será executado no Passo 3, depois de ter o `NOTION_URL`.
- Prossiga para o Passo 3 com `BRANCH = {BRANCH_ATUAL}`

#### Se "Criar nova branch"

Analise o conteúdo do milestone para inferir tipo e escopo e gere o nome sugerido:

**Regras de nomenclatura:**

| Tipo de mudança | Prefixo | Exemplo |
|---|---|---|
| Correção de bug | `fix` | `fix-sidebar-v2` |
| Nova feature | `feat` | `feat-dashboard-icons` |
| Refatoração | `refactor` | `refactor-auth-flow` |
| Melhoria de performance | `perf` | `perf-sidebar` |
| Mudança visual / UI | `ui` | `ui-dashboard-icons` |
| Atualização de conteúdo/texto | `content` | `content-onboarding` |

**Formato:** `{prefixo}-{nome-da-aba-modal-ou-area}-{versão se houver mais de uma branch do mesmo tipo}`

Use `AskUserQuestion` para confirmar o nome sugerido:

```
question: "Nome sugerido para a nova branch: {NOME_SUGERIDO}. Confirma?"
header: "Nome da branch"
options:
  - label: "{NOME_SUGERIDO}"
    description: "Usar o nome sugerido"
  - label: "Outro nome"
    description: "Digitar um nome diferente"
```

Se "Outro nome" → aguarde o usuário digitar via campo "Other" do modal.

Após confirmação:
```bash
git fetch origin
git checkout -b {NOVA_BRANCH} origin/main
```

- Se havia mudanças não commitadas na branch anterior, use `AskUserQuestion`:
  ```
  question: "Deseja levar as mudanças não commitadas para a nova branch?"
  header: "Mudanças"
  options:
    - label: "Sim, transportar"
      description: "git stash → checkout → git stash pop"
    - label: "Não, descartar"
      description: "Deixar as mudanças na branch anterior"
  ```
- Prossiga para o Passo 3 com `BRANCH = {NOVA_BRANCH}`

### Passo 3 — Criar página Notion ⚠️ OBRIGATÓRIO — não pule esta etapa

**Esta etapa deve ser executada ANTES do push e do PR.** O link do Notion precisa estar disponível para incluir na descrição do PR.

Use o Notion MCP (`notion-create-pages`) para criar uma subpágina em `NOTION_CHANGELOG_PAGE_ID` (a página `changelog/` do projeto).

Após chamar `notion-create-pages`, armazene a URL retornada como `NOTION_URL`.

Se `PENDENTE_COMMIT = true`, execute o commit agora com o link incluído:
```bash
git add .
git commit -m "{tipo}: {MILESTONE_NAME}

Notion: {NOTION_URL}"
```

**Template da página:**

```
Título: {VERSION} — {MILESTONE_NAME}
Ícone: 🚀

[Callout verde] Entregue em: {DATA} | Requisitos: X/X | Testes: N passando

---

# Para o Time de Produto

## O que você consegue fazer agora
[Para cada feature entregue: 1 parágrafo em linguagem de produto, sem jargão técnico]
[Se houver UI nova: inclua passo a passo "Como usar"]

---

# Para o Time Técnico

## O que mudou no código
[Tabela: Arquivo | O que mudou]
[Code snippet do padrão principal implementado, se relevante]

## Decisões Arquiteturais
[Toggle para cada decisão relevante: contexto + decisão + consequências]

## Dívidas Técnicas Registradas
[Tabela: Item | Impacto | Quando tratar]

---

## Referências
- Branch: `{BRANCH}`
- Tag git: `{VERSION}`
- Testes: N passando
- Auditoria: `.planning/{VERSION}-MILESTONE-AUDIT.md`
```

**Regras de voz:**
- Seção "Produto": sem nomes de arquivo, sem SQL, sem termos de código. Foco em "antes X, agora Y".
- Seção "Técnico": arquivos reais, commits, decisões de implementação.

### Passo 4 — Push e PR no GitHub

⚠️ Só execute este passo após ter o `NOTION_URL` do Passo 3.

```bash
git push origin {BRANCH}

gh pr create \
  --title "{VERSION}: {MILESTONE_NAME}" \
  --body "..."
```

**Template do body do PR:**

```markdown
## {VERSION} — {MILESTONE_NAME}

### O que muda
[3-5 bullet points em linguagem de negócio]

### Cobertura
- Requisitos: X/X satisfeitos
- Testes: N passando
- TypeScript: limpo (0 erros)

### Documentação
📄 Notion: {NOTION_URL}

### Como testar
[Checklist de smoke tests manuais do MILESTONE-AUDIT.md]
```

**Regras para o PR:**
- Sem rodapé de assinatura de IA
- Sem menção a ferramentas ou geradores
- Linguagem direta, como se fosse escrito pelo dev

### Passo 5 — 📚 Atualizar cofre Obsidian do time

⚠️ **Este passo é "bônus".** Se falhar por qualquer motivo (variável ausente, caminho inválido, conflito Git não-resolvível, push rejeitado após retry), **armazene o motivo em `OBSIDIAN_SKIP_REASON` e prossiga para o Passo 6**. PR e Notion já estão feitos — o dev atualiza o cofre manualmente depois.

#### 5.1 — Validar ambiente

- Ler `$OBSIDIAN_TEAM_VAULT`.
- Se a variável não estiver definida:
  > ⚠️ Variável OBSIDIAN_TEAM_VAULT não configurada. Pule para os próximos passos do onboarding no README do cofre.

  Defina `OBSIDIAN_SKIP_REASON = "OBSIDIAN_TEAM_VAULT não configurada"` e vá para o Passo 6.
- Se definida mas o caminho não existir (`test -d "$OBSIDIAN_TEAM_VAULT"` falha):
  > ⚠️ Cofre Obsidian não encontrado em: {caminho}. Verifique se o clone local existe.

  Defina `OBSIDIAN_SKIP_REASON = "Cofre não encontrado em {caminho}"` e vá para o Passo 6.

#### 5.2 — Sincronizar com remoto

```bash
git -C "$OBSIDIAN_TEAM_VAULT" pull --rebase
```

- Se o `pull --rebase` falhar com conflito, tentar resolução automática:
  ```bash
  git -C "$OBSIDIAN_TEAM_VAULT" rebase --abort 2>/dev/null || true
  git -C "$OBSIDIAN_TEAM_VAULT" pull --rebase -X theirs
  ```
- Se ainda assim falhar: defina `OBSIDIAN_SKIP_REASON = "Conflito Git no cofre — resolver manualmente"` e vá para o Passo 6.

#### 5.3 — Ler CLAUDE.md do cofre

Ler `$OBSIDIAN_TEAM_VAULT/CLAUDE.md`. Esse arquivo contém as convenções de documentação do time (nomenclatura, estrutura de pastas, templates, convenções de commit). **As regras vivem lá** — siga o que o CLAUDE.md mandar, não o que este prompt diz de cor.

Se o `CLAUDE.md` não existir: defina `OBSIDIAN_SKIP_REASON = "CLAUDE.md ausente no cofre — estrutura desconhecida"` e vá para o Passo 6.

#### 5.4 — Criar/atualizar as notas

Baseado no contexto do PR que acabou de ser publicado (número, título, arquivos tocados, `MILESTONE_NAME`, `NOTION_URL`):

**a) Nota do PR** (obrigatória)

Caminho: `01 - PRs/YYYY/YYYY-MM-DD-pr-{PR_NUMBER}-{slug-do-titulo}.md`

- `YYYY` / `YYYY-MM-DD` = data do merge/criação do PR.
- `slug-do-titulo` = título do PR em kebab-case (lowercase, sem acentos, espaços → `-`, sem pontuação).
- Usar `09 - Templates/template-pr.md` como base.
- **Frontmatter DEVE conter `notion: {NOTION_URL}`** para ponte bidirecional entre as duas bases.

**b) Changelog** (obrigatório)

Caminho: `03 - Changelog/YYYY.md`

- Adicionar entrada na seção `## Não lançado`, nas subseções apropriadas:
  - `### Adicionado` — features novas
  - `### Alterado` — mudanças de comportamento existente
  - `### Corrigido` — bugs
  - `### Removido` — remoções
- Cada entrada deve referenciar o número do PR.

**c) Notas de componentes/endpoints afetados** (condicional)

Se o PR tocar componentes/páginas/endpoints existentes:
- Localizar a nota correspondente em `05 - Frontend/` e/ou `06 - Backend/`.
- Atualizar a seção `## Histórico de mudanças` com a data (`YYYY-MM-DD`) e o link do PR.

Se o PR introduzir algo **novo**:
- Criar nova nota em `05 - Frontend/` ou `06 - Backend/` usando `09 - Templates/template-funcionalidade.md`.

#### 5.5 — Commit e push

```bash
cd "$OBSIDIAN_TEAM_VAULT"
git add .
git commit -m "docs(pr-{PR_NUMBER}): {título-curto}"
git push
```

- Título curto = slug do título do PR truncado em ~60 chars, seguindo convenções de commit do `CLAUDE.md` do cofre.
- Se o `git push` falhar por divergência:
  ```bash
  git pull --rebase
  git push
  ```
- Se ainda falhar: defina `OBSIDIAN_SKIP_REASON = "Push rejeitado após rebase — resolver manualmente"` e vá para o Passo 6.

#### 5.6 — Capturar link da nota de PR

Construir a URL pública da nota no GitHub. Defina o repositório do cofre via env var `OBSIDIAN_VAULT_REPO` (formato `owner/repo`):

```
OBSIDIAN_URL = https://github.com/${OBSIDIAN_VAULT_REPO}/blob/main/01%20-%20PRs/YYYY/YYYY-MM-DD-pr-{PR_NUMBER}-{slug}.md
```

Se `OBSIDIAN_VAULT_REPO` não estiver definida, defina `OBSIDIAN_SKIP_REASON = "OBSIDIAN_VAULT_REPO não configurada"` e vá para o Passo 6.

- Encode: espaços → `%20`. Barras internas permanecem literais.
- Armazene como `OBSIDIAN_URL` para uso no Passo 6.

### Passo 6 — Reportar resultado

Exiba ao usuário:

```
✅ Milestone {VERSION} publicado

📄 Notion: {NOTION_URL}
🔗 PR: {PR_URL}
📚 Obsidian: {OBSIDIAN_URL}
🌿 Branch: {BRANCH}
```

Se o Passo 5 foi pulado, substitua a linha do Obsidian por:

```
⚠️ Obsidian: pulado — {OBSIDIAN_SKIP_REASON}
```

(mantendo as demais linhas intactas)

## Para outros projetos

Copie `.claude/notion-config.json` para o projeto e preencha com os IDs corretos:

```json
{
  "project": "NomeDoProjeto",
  "notion": {
    "root": "ID_DA_PAGINA_PRINCIPAL",
    "root_url": "https://www.notion.so/...",
    "changelog": "ID_DA_PAGINA_CHANGELOG",
    "features": "ID_DA_PAGINA_FEATURES",
    "adr": "ID_DA_PAGINA_ADR",
    "runbooks": "ID_DA_PAGINA_RUNBOOKS"
  }
}
```

Para criar a estrutura de um novo projeto no Notion, execute `/setup-notion`.
