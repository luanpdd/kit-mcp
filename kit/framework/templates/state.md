# Template de State

Template para `.planning/STATE.md` — a memória viva do projeto.

---

## Template do Arquivo

```markdown
# Estado do Projeto

## Referência do Projeto

Ver: .planning/PROJECT.md (atualizado em [data])

**Valor central:** [Uma linha da seção Core Value do PROJECT.md]
**Foco atual:** [Nome da fase atual]

## Posição Atual

Fase: [X] de [Y] ([Nome da fase])
Plano: [A] de [B] na fase atual
Status: [Pronto para planejar / Planejando / Pronto para executar / Em andamento / Fase concluída]
Última atividade: [AAAA-MM-DD] — [O que aconteceu]

Progresso: [░░░░░░░░░░] 0%

## Métricas de Performance

**Velocidade:**
- Total de planos concluídos: [N]
- Duração média: [X] min
- Tempo total de execução: [X.X] horas

**Por Fase:**

| Fase | Planos | Total | Média/Plano |
|------|--------|-------|-------------|
| - | - | - | - |

**Tendência Recente:**
- Últimos 5 planos: [durações]
- Tendência: [Melhorando / Estável / Degradando]

*Atualizado após cada conclusão de plano*

## Contexto Acumulado

### Decisões

Decisões estão registradas na tabela de Decisões Chave do PROJECT.md.
Decisões recentes que afetam o trabalho atual:

- [Fase X]: [Resumo da decisão]
- [Fase Y]: [Resumo da decisão]

### Todos Pendentes

[De .planning/todos/pending/ — ideias capturadas durante as sessões]

Nenhum ainda.

### Bloqueios/Preocupações

[Problemas que afetam trabalho futuro]

Nenhum ainda.

## Continuidade de Sessão

Última sessão: [AAAA-MM-DD HH:MM]
Parou em: [Descrição da última ação concluída]
Arquivo de retomada: [Caminho para .continue-here*.md se existir, caso contrário "Nenhum"]
```

<purpose>

STATE.md é a memória de curto prazo do projeto abrangendo todas as fases e sessões.

**Problema que resolve:** Informações são capturadas em summaries, issues e decisões, mas não são consumidas sistematicamente. Sessões começam sem contexto.

**Solução:** Um arquivo único e pequeno que:
- É lido primeiro em todo workflow
- É atualizado após toda ação significativa
- Contém um digest do contexto acumulado
- Permite restauração instantânea de sessão

</purpose>

<lifecycle>

**Criação:** Após ROADMAP.md ser criado (durante o init)
- Referenciar PROJECT.md (lê-lo para o contexto atual)
- Inicializar seções de contexto acumulado vazias
- Definir posição como "Fase 1 pronta para planejar"

**Leitura:** Primeiro passo de todo workflow
- progress: Apresentar status ao usuário
- plan: Informar decisões de planejamento
- execute: Saber a posição atual
- transition: Saber o que está completo

**Escrita:** Após toda ação significativa
- execute: Após SUMMARY.md ser criado
  - Atualizar posição (fase, plano, status)
  - Notar novas decisões (detalhar no PROJECT.md)
  - Adicionar bloqueios/preocupações
- transition: Após fase marcada como completa
  - Atualizar barra de progresso
  - Limpar bloqueios resolvidos
  - Atualizar data de referência do Projeto

</lifecycle>

<sections>

### Referência do Projeto
Aponta para PROJECT.md para contexto completo. Inclui:
- Valor central (o UMA coisa que importa)
- Foco atual (qual fase)
- Data da última atualização (aciona re-leitura se desatualizada)

Claude lê PROJECT.md diretamente para requisitos, restrições e decisões.

### Posição Atual
Onde estamos agora:
- Fase X de Y — qual fase
- Plano A de B — qual plano dentro da fase
- Status — estado atual
- Última atividade — o que aconteceu mais recentemente
- Barra de progresso — indicador visual da conclusão geral

Cálculo do progresso: (planos concluídos) / (total de planos em todas as fases) × 100%

### Métricas de Performance
Rastrear velocidade para entender padrões de execução:
- Total de planos concluídos
- Duração média por plano
- Divisão por fase
- Tendência recente (melhorando/estável/degradando)

Atualizado após cada conclusão de plano.

### Contexto Acumulado

**Decisões:** Referência à tabela de Decisões Chave do PROJECT.md, mais resumo de decisões recentes para acesso rápido. Log completo de decisões fica no PROJECT.md.

**Todos Pendentes:** Ideias capturadas via /add-todo
- Contagem de todos pendentes
- Referência a .planning/todos/pending/
- Lista breve se poucos, contagem se muitos (ex.: "5 todos pendentes — ver /check-todos")

**Bloqueios/Preocupações:** Das seções "Prontidão para Próxima Fase"
- Problemas que afetam trabalho futuro
- Prefixo com fase de origem
- Limpos quando endereçados

### Continuidade de Sessão
Permite retomada instantânea:
- Quando foi a última sessão
- O que foi concluído por último
- Há algum arquivo .continue-here para retomar

</sections>

<size_constraint>

Manter STATE.md abaixo de 100 linhas.

É um DIGEST, não um arquivo. Se o contexto acumulado crescer demais:
- Manter apenas 3-5 decisões recentes no resumo (log completo no PROJECT.md)
- Manter apenas bloqueios ativos, remover os resolvidos

O objetivo é "ler uma vez, saber onde estamos" — se for muito longo, isso falha.

</size_constraint>
