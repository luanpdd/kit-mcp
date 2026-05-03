# /setup-notion — Inicializar Documentação Notion para um Projeto

Cria a estrutura de páginas Notion para um novo projeto sob a página raiz do seu workspace e gera o `.claude/notion-config.json` local.

## Quando usar

Ao iniciar um novo projeto framework que ainda não tem página no Notion.
Execute uma vez por projeto — depois use `/publicar` normalmente.

## Processo

### Passo 1 — Ler contexto do projeto

Leia `.planning/PROJECT.md` para obter:
- Nome do projeto
- Stack
- Descrição em 1 frase

### Passo 2 — Criar páginas no Notion

Use o Notion MCP (`notion-create-pages`) com `parent.page_id = "{NOTION_PARENT_PAGE_ID}"`, onde `NOTION_PARENT_PAGE_ID` é o ID da página raiz do seu workspace de documentação (configure via env var `KIT_NOTION_PARENT_PAGE_ID` ou substitua diretamente).

Crie a página raiz do projeto com ícone 📋 e este conteúdo:

```
[Callout azul] {NOME_PROJETO} — {DESCRICAO_1_FRASE}

---

## Stack
[Tabela com camadas e tecnologias do PROJECT.md]

---

## Estrutura da Documentação
- changelog/ — Uma entrada por milestone
- features/ — O que cada feature faz
- adr/ — Decisões arquiteturais
- runbooks/ — Procedimentos operacionais

---

## Versões Lançadas
[Tabela vazia: Versão | Nome | Data | Status]
```

Depois crie as 4 subpáginas sob a página raiz criada:
- 📅 `changelog/` — com tabela de índice vazia
- 📄 `features/` — com tabela de índice vazia
- 🏛️ `adr/` — com tabela de índice vazia
- 📖 `runbooks/` — com tabela de índice vazia

### Passo 3 — Gerar notion-config.json

Com os IDs retornados pelo Notion MCP, crie `.claude/notion-config.json`:

```json
{
  "project": "{NOME_PROJETO}",
  "notion": {
    "root": "{ID_ROOT}",
    "root_url": "{URL_ROOT}",
    "changelog": "{ID_CHANGELOG}",
    "features": "{ID_FEATURES}",
    "adr": "{ID_ADR}",
    "runbooks": "{ID_RUNBOOKS}"
  }
}
```

### Passo 4 — Reportar resultado

```
✅ Notion configurado para {NOME_PROJETO}

📋 Página principal: {URL_ROOT}
📅 changelog/: {URL_CHANGELOG}
📄 features/: {URL_FEATURES}
🏛️ adr/: {URL_ADR}
📖 runbooks/: {URL_RUNBOOKS}

Arquivo criado: .claude/notion-config.json
Próximo passo: use /publicar ao concluir o próximo milestone.
```

## Configuração da página raiz do Notion

Defina o ID da página raiz onde os projetos serão criados (uma página "guarda-chuva" no seu workspace Notion):

- Via env var: `export KIT_NOTION_PARENT_PAGE_ID="<ID_DA_PAGINA>"`
- Ou substitua `{NOTION_PARENT_PAGE_ID}` no Passo 2 pelo ID literal antes de executar.

Para obter o ID: abra a página no Notion → Share → Copy link → o ID é o hash de 32 caracteres no final da URL.
