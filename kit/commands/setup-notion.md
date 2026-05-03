# /setup-notion — Inicializar Documentação Notion para um Projeto

Cria a estrutura de páginas Notion para um novo projeto sob a página principal da Trynux e gera o `.claude/notion-config.json` local.

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

Use o Notion MCP (`notion-create-pages`) com `parent.page_id = "32ef0a728177815ebc40e72122b69e9b"` (página principal Trynux — Sistema de Documentação).

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

## Página principal Trynux (não alterar)

ID: `32ef0a728177815ebc40e72122b69e9b`
URL: https://www.notion.so/32ef0a728177815ebc40e72122b69e9b
