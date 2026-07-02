---
name: publicar-rapido
description: Variante leve de /publicar para hotfix/quick-task — sem dependência de ROADMAP/MILESTONE-AUDIT. Infere tipo do commit, gera Notion + cofre + PR cross-linkados.
argument-hint: "[branch destino opcional, padrão: detectado/sugerido]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - AskUserQuestion
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
---

# /publicar-rapido — Pipeline Notion + PR + Cofre, sem cerimônia de milestone

Variante de `/publicar` para mudanças que **não passaram pelo fluxo completo de milestone**: hotfix em produção, fix expresso (1 migration / 1 PR), refatoração curta, mudança trivial que precisa cross-link Notion + Obsidian + PR mesmo sem ROADMAP arquivado.

## Quando usar

- Hotfix em produção: 1-3 commits, branch curta, sem milestone aberto.
- Pequena feature isolada que não justificou abrir milestone.
- Correção de bug urgente que precisa ir documentada mas o overhead do `/publicar` não compensa.

**Não use** quando o trabalho foi um milestone de várias fases — use `/publicar` (que valida MILESTONE-AUDIT.md, ROADMAP arquivado, etc).

## Diferenças vs /publicar

| Aspecto | `/publicar` | `/publicar-rapido` |
|---|---|---|
| Pré-requisitos de planejamento | ROADMAP + MILESTONE-AUDIT obrigatórios | Apenas commit(s) na branch |
| Detecção de versão | De `STATE.md` | De `package.json` ou git tag mais recente |
| Detecção de tipo | Inferido do milestone | **Inferido do commit message** (`fix:`/`feat:`/`refactor:`/`chore:` prefix) |
| Notion | Página de changelog do milestone | Entrada curta na página de **changelog** com 1 parágrafo |
| Cofre Obsidian | Nota de PR + Changelog completo + componentes afetados | Apenas nota de PR + entrada no Changelog |
| Pre-flight sync com `main` | Sim (Passo 0) | **Sim — herdado** |
| Tempo médio | 60-90s | **~30s** |

## Processo

### Passo 0 — Pre-flight: sincronizar com main (obrigatório, herdado de /publicar)

Igual ao Passo 0 do `/publicar`: `git fetch origin main`, lista commits novos, oferece rebase/merge/ignorar/cancelar via `AskUserQuestion`. **Não pule** — esse é exatamente o cenário onde dev paralelo causa conflito tardio em hotfix.

### Passo 1 — Detectar contexto

#### 1.1 — Tipo do commit

Leia o commit mais recente (`git log -1 --format=%B`). Se houver múltiplos commits desde `origin/main`, leia todos (`git log origin/main..HEAD --format=%B`).

Inferir `TIPO_MUDANCA` por prefix do **primeiro commit** ou pelo padrão majoritário se múltiplos:

| Prefix | TIPO_MUDANCA | Notion section |
|---|---|---|
| `fix:` / `bugfix:` | `Corrigido` | Bug fix |
| `feat:` / `feature:` | `Adicionado` | Feature |
| `perf:` | `Melhorado` | Performance |
| `refactor:` | `Alterado` | Refactor |
| `chore:` / `docs:` / `style:` | `Alterado` | Manutenção |
| `revert:` | `Removido` | Revert |
| Sem prefix | `Alterado` | (perguntar via AskUserQuestion) |

Se não conseguir inferir (nenhum prefix), use `AskUserQuestion`:
- **header:** "Tipo"
- **question:** "Tipo da mudança?"
- **options:** "Correção (fix)", "Feature (feat)", "Refator (refactor)", "Outro"

#### 1.2 — Título resumido

Extraia o **primeiro commit message** sem o prefix. Se múltiplos commits, use o **mais descritivo** (mais longo). Limite a 60 chars.

Exemplos:
- `fix: corrige FK em contact_prefs migration` → `Corrige FK em contact_prefs migration`
- `feat: adiciona índice em contacts.phone` → `Adiciona índice em contacts.phone`

Apresente ao user via `AskUserQuestion`:
- **question:** "Título sugerido: \"{TITULO}\". Confirma?"
- **options:** Confirmar, Editar (text input)

#### 1.3 — Versão

Detecte `VERSION` (ordem de prioridade):
1. `package.json` campo `version` (incremente o patch — ex: `1.2.3` → `1.2.4`)
2. Tag git mais recente: `git describe --tags --abbrev=0` (incremente patch)
3. Sem fonte: use timestamp `YYYY-MM-DD-HHMMSS`

Apresente via `AskUserQuestion`:
- **question:** "Próxima versão: {VERSION}. Confirma ou pula bump de package.json?"
- **options:** Bump+commit, Sem bump (só Notion+PR)

Se "Bump+commit", execute:
```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump {VERSION}"
```

### Passo 2 — Decidir branch

Igual ao `/publicar` Passo 2 — usar branch atual ou criar nova baseada no `TIPO_MUDANCA`. Sugestão de nome:

- `fix:` → `fix-{slug-do-titulo}`
- `feat:` → `feat-{slug-do-titulo}`
- `refactor:` → `refactor-{slug-do-titulo}`

### Passo 3 — Criar página Notion (curta)

Carregue `.claude/notion-config.json` (com fallback do auto-detect — Passo 0.5 do `/publicar`).

Use `notion-create-pages` com `parent.page_id = NOTION_CHANGELOG_PAGE_ID`.

**Template enxuto (não confundir com o template completo do /publicar):**

```
Título: {VERSION} — {TITULO}
Ícone: 🩹 (fix) | ✨ (feat) | 🔧 (refactor) | 🧹 (chore)

[Callout cinza] Quick fix · {DATA} · Branch: `{BRANCH}` · Tipo: {TIPO_MUDANCA}

## O que mudou

{1 parágrafo descrevendo a mudança em linguagem direta — extraia do commit body se houver, senão use o título expandido.}

## Arquivos tocados

[Tabela: Arquivo | O que mudou]
{lista de `git diff origin/main..HEAD --stat` resumida — primeiros 10 arquivos}

## Como verificar

{Se TIPO_MUDANCA = fix: instrução curta de smoke test do bug. Se feat: passo a passo de uso. Se refactor: nota dizendo "sem mudança de comportamento esperada".}

## Referências

- Commit(s): `{lista de hashes curtos}`
- Branch: `{BRANCH}`
- PR: (será preenchido pelo dev após o passo 4)
```

Armazene `NOTION_URL`.

Se houver `PENDENTE_COMMIT = true` (Passo 2), execute o commit agora com o link incluído:

```bash
git commit -m "{TIPO_MUDANCA_PREFIX}: {TITULO}

Notion: {NOTION_URL}"
```

### Passo 4 — Push + PR

```bash
git push origin {BRANCH}

gh pr create \
  --title "{TIPO_MUDANCA_PREFIX}: {TITULO}" \
  --body "..."
```

**Body do PR (template enxuto):**

```markdown
## {TITULO}

{1 parágrafo do que mudou}

### Arquivos
{lista de até 5 paths}

### Documentação
📄 Notion: {NOTION_URL}
{Se OBSIDIAN_URL definido: 📚 Cofre: {OBSIDIAN_URL}}

### Sync com main
{Se SYNC_SKIPPED = true: ⚠️ PR aberto sem rebase com origin/main — possível conflito ao revisar.}
{Senão: ✓ Sincronizado com main em {timestamp}.}
```

Sem rodapé de IA. Sem assinatura de tooling.

### Passo 5 — Cofre Obsidian (curto)

Igual ao Passo 0.7 + 5 do `/publicar`, mas com escrita reduzida:

- **Nota de PR** (obrigatória): `01 - PRs/YYYY/YYYY-MM-DD-pr-{PR_NUMBER}-{slug}.md` com frontmatter `notion: {NOTION_URL}`.
- **Changelog**: adicionar 1 linha em `03 - Changelog/YYYY.md` na seção apropriada (`### Corrigido` / `### Adicionado` / etc baseado em `TIPO_MUDANCA`), referenciando PR.
- **Componentes afetados**: PULAR. /publicar-rapido não atualiza notas de componente — usar `/publicar` quando o escopo justificar.

Mesma cerimônia de commit + push do cofre.

### Passo 6 — Reportar

```
🩹 Quick publish concluída em ~{TEMPO_TOTAL}s

📄 Notion:   {NOTION_URL}
🔗 PR:       {PR_URL}
📚 Obsidian: {OBSIDIAN_URL}      ← ou ⚠️ pulado: {motivo}
🌿 Branch:   {BRANCH}
🏷  Tipo:     {TIPO_MUDANCA}
```

## Para projetos novos

Mesmo `notion-config.json` do `/publicar`. Auto-detect (Passo 0.5 herdado) cobre o caso de config ausente — basta a página existir no Notion.
