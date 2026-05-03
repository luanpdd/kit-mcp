---
name: mapear-codebase
description: Analisa a base de código com agentes mapeadores paralelos para produzir documentos em .planning/codebase/
argument-hint: "[opcional: área específica para mapear, ex: 'api' ou 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

<objective>
Analisar a base de código existente usando agentes codebase-mapper paralelos para produzir documentos estruturados.

Cada agente mapeador explora uma área de foco e **escreve documentos diretamente** em `.planning/codebase/`. O orquestrador recebe apenas confirmações, mantendo o uso de contexto mínimo.

Saída: pasta .planning/codebase/ com 7 documentos estruturados sobre o estado da base de código.
</objective>

<execution_context>
@./.claude/framework/workflows/map-codebase.md
</execution_context>

<context>
Área de foco: $ARGUMENTS (opcional - se fornecido, orienta os agentes a focar em um subsistema específico)

**Carregar estado do projeto se existir:**
Verificar .planning/STATE.md - carrega contexto se o projeto já foi inicializado

**Este comando pode rodar:**
- Antes de /novo-projeto (bases de código brownfield) - cria mapa da base de código primeiro
- Após /novo-projeto (bases de código greenfield) - atualiza o mapa conforme o código evolui
- A qualquer momento para atualizar a compreensão da base de código
</context>

<when_to_use>
**Use mapear-codebase para:**
- Projetos brownfield antes da inicialização (entender o código existente primeiro)
- Atualizar mapa da base de código após mudanças significativas
- Onboarding em uma base de código desconhecida
- Antes de grandes refatorações (entender o estado atual)
- Quando STATE.md referencia informações desatualizadas da base de código

**Pule mapear-codebase para:**
- Projetos greenfield sem código ainda (nada a mapear)
- Bases de código triviais (menos de 5 arquivos)
</when_to_use>

<process>
1. Verificar se .planning/codebase/ já existe (oferecer para atualizar ou pular)
2. Criar estrutura de diretório .planning/codebase/
3. Invocar 4 agentes codebase-mapper paralelos:
   - Agente 1: foco tech → escreve STACK.md, INTEGRATIONS.md
   - Agente 2: foco arch → escreve ARCHITECTURE.md, STRUCTURE.md
   - Agente 3: foco quality → escreve CONVENTIONS.md, TESTING.md
   - Agente 4: foco concerns → escreve CONCERNS.md
4. Aguardar conclusão dos agentes, coletar confirmações (NÃO o conteúdo dos documentos)
5. Verificar se todos os 7 documentos existem com contagem de linhas
6. Commitar mapa da base de código
7. Oferecer próximos passos (tipicamente: /novo-projeto ou /planejar-fase)
</process>

<success_criteria>
- [ ] Diretório .planning/codebase/ criado
- [ ] Todos os 7 documentos da base de código escritos pelos agentes mapeadores
- [ ] Documentos seguem estrutura de template
- [ ] Agentes paralelos concluíram sem erros
- [ ] Usuário conhece próximos passos
</success_criteria>