---
name: para-memory-files
description: >
  File-based memory system using Tiago Forte's PARA method. Use this skill whenever
  you need to store, retrieve, update, or organize knowledge across sessions. Covers
  three memory layers: (1) Knowledge graph in PARA folders with atomic YAML facts,
  (2) Daily notes as raw timeline, (3) Tacit knowledge about user patterns. Also
  handles planning files, memory decay, weekly synthesis, and recall via qmd.
  Trigger on any memory operation: saving facts, writing daily notes, creating
  entities, running weekly synthesis, recalling past context, or managing plans.
---

# PARA Memory Files

Memória persistente baseada em arquivos, organizada pelo método PARA do Tiago Forte. Três camadas: um grafo de conhecimento, daily notes e conhecimento tácito. Todos os caminhos são relativos a `$AGENT_HOME`.

## Três Camadas de Memória

### Camada 1: Grafo de Conhecimento (`$AGENT_HOME/life/` -- PARA)

Armazenamento baseado em entidades. Cada entidade ganha uma pasta com dois tiers:

1. `summary.md` -- contexto rápido, carregue primeiro.
2. `items.yaml` -- fatos atômicos, carregue sob demanda.

```text
$AGENT_HOME/life/
  projects/          # Trabalho ativo com objetivos/prazos claros
    <name>/
      summary.md
      items.yaml
  areas/             # Responsabilidades contínuas, sem data de fim
    people/<name>/
    companies/<name>/
  resources/         # Material de referência, tópicos de interesse
    <topic>/
  archives/          # Itens inativos das outras três
  index.md
```

**Regras PARA:**

- **Projects** -- trabalho ativo com objetivo ou prazo. Mover para archives quando completo.
- **Areas** -- contínuo (pessoas, empresas, responsabilidades). Sem data de fim.
- **Resources** -- material de referência, tópicos de interesse.
- **Archives** -- itens inativos de qualquer categoria.

**Regras de fatos:**

- Salve fatos duráveis imediatamente em `items.yaml`.
- Semanalmente: reescreva `summary.md` a partir dos fatos ativos.
- Nunca delete fatos. Substitua (`status: superseded`, adicione `superseded_by`).
- Quando uma entidade ficar inativa, mova sua pasta para `$AGENT_HOME/life/archives/`.

**Quando criar uma entidade:**

- Mencionada 3+ vezes, OU
- Relação direta com o usuário (família, colega de trabalho, parceiro, cliente), OU
- Projeto ou empresa significativa na vida do usuário.
- Caso contrário, anote nas daily notes.

Para o schema YAML de fato atômico e as regras de memory decay, veja [references/schemas.md](references/schemas.md).

### Camada 2: Daily Notes (`$AGENT_HOME/memory/YYYY-MM-DD.md`)

Linha do tempo bruta de eventos -- a camada do "quando".

- Escreva continuamente durante as conversas.
- Extraia fatos duráveis para a Camada 1 durante heartbeats.

### Camada 3: Conhecimento Tácito (`$AGENT_HOME/MEMORY.md`)

Como o usuário opera -- padrões, preferências, lições aprendidas.

- Não são fatos sobre o mundo; são fatos sobre o usuário.
- Atualize sempre que aprender novos padrões de operação.

## Escreva -- Sem Notas Mentais

Memória não sobrevive a restart de sessão. Arquivos sobrevivem.

- Quer lembrar de algo -> ESCREVA NUM ARQUIVO.
- "Lembre disso" -> atualize `$AGENT_HOME/memory/YYYY-MM-DD.md` ou o arquivo de entidade relevante.
- Aprenda uma lição -> atualize AGENTS.md, TOOLS.md ou o arquivo de skill relevante.
- Cometa um erro -> documente para que o você-do-futuro não repita.
- Arquivos de texto em disco são sempre melhores que segurar em contexto temporário.

## Memory Recall -- Use qmd

Use `qmd` em vez de fazer grep em arquivos:

```bash
qmd query "what happened at Christmas"   # Busca semântica com reranking
qmd search "specific phrase"              # Busca BM25 por keyword
qmd vsearch "conceptual question"         # Similaridade vetorial pura
```

Indexe sua pasta pessoal: `qmd index $AGENT_HOME`

Vetores + BM25 + reranking encontram coisas mesmo quando o wording difere.

## Planejamento

Mantenha planos em arquivos com timestamp em `plans/` na raiz do projeto (fora da memória pessoal para que outros agentes possam acessá-los). Use `qmd` para buscar planos. Planos ficam stale -- se um plano mais novo existe, não se confunda com a versão mais antiga. Se notar staleness, atualize o arquivo para indicar o que ele é supersededBy.
