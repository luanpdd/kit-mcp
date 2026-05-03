# Template de Roadmap

Template para `.planning/ROADMAP.md`.

## Roadmap Inicial (v1.0 Greenfield)

```markdown
# Roadmap: [Nome do Projeto]

## Visão Geral

[Um parágrafo descrevendo a jornada do início ao fim]

## Fases

**Numeração de Fases:**
- Fases inteiras (1, 2, 3): Trabalho planejado do milestone
- Fases decimais (2.1, 2.2): Inserções urgentes (marcadas com INSERIDA)

Fases decimais aparecem entre seus inteiros vizinhos em ordem numérica.

- [ ] **Fase 1: [Nome]** - [Descrição em uma linha]
- [ ] **Fase 2: [Nome]** - [Descrição em uma linha]
- [ ] **Fase 3: [Nome]** - [Descrição em uma linha]
- [ ] **Fase 4: [Nome]** - [Descrição em uma linha]

## Detalhes das Fases

### Fase 1: [Nome]
**Objetivo**: [O que esta fase entrega]
**Depende de**: Nada (primeira fase)
**Requisitos**: [REQ-01, REQ-02, REQ-03]  <!-- colchetes opcionais, o parser lida com ambos os formatos -->
**Critérios de Sucesso** (o que deve ser VERDADEIRO):
  1. [Comportamento observável da perspectiva do usuário]
  2. [Comportamento observável da perspectiva do usuário]
  3. [Comportamento observável da perspectiva do usuário]
**Planos**: [Número de planos, ex.: "3 planos" ou "A definir"]

Planos:
- [ ] 01-01: [Breve descrição do primeiro plano]
- [ ] 01-02: [Breve descrição do segundo plano]
- [ ] 01-03: [Breve descrição do terceiro plano]

### Fase 2: [Nome]
**Objetivo**: [O que esta fase entrega]
**Depende de**: Fase 1
**Requisitos**: [REQ-04, REQ-05]
**Critérios de Sucesso** (o que deve ser VERDADEIRO):
  1. [Comportamento observável da perspectiva do usuário]
  2. [Comportamento observável da perspectiva do usuário]
**Planos**: [Número de planos]

Planos:
- [ ] 02-01: [Breve descrição]
- [ ] 02-02: [Breve descrição]

### Fase 2.1: Correção Crítica (INSERIDA)
**Objetivo**: [Trabalho urgente inserido entre fases]
**Depende de**: Fase 2
**Critérios de Sucesso** (o que deve ser VERDADEIRO):
  1. [O que a correção alcança]
**Planos**: 1 plano

Planos:
- [ ] 02.1-01: [Descrição]

### Fase 3: [Nome]
**Objetivo**: [O que esta fase entrega]
**Depende de**: Fase 2
**Requisitos**: [REQ-06, REQ-07, REQ-08]
**Critérios de Sucesso** (o que deve ser VERDADEIRO):
  1. [Comportamento observável da perspectiva do usuário]
  2. [Comportamento observável da perspectiva do usuário]
  3. [Comportamento observável da perspectiva do usuário]
**Planos**: [Número de planos]

Planos:
- [ ] 03-01: [Breve descrição]
- [ ] 03-02: [Breve descrição]

### Fase 4: [Nome]
**Objetivo**: [O que esta fase entrega]
**Depende de**: Fase 3
**Requisitos**: [REQ-09, REQ-10]
**Critérios de Sucesso** (o que deve ser VERDADEIRO):
  1. [Comportamento observável da perspectiva do usuário]
  2. [Comportamento observável da perspectiva do usuário]
**Planos**: [Número de planos]

Planos:
- [ ] 04-01: [Breve descrição]

## Progresso

**Ordem de Execução:**
As fases executam em ordem numérica: 2 → 2.1 → 2.2 → 3 → 3.1 → 4

| Fase | Planos Completos | Status | Concluída |
|------|------------------|--------|-----------|
| 1. [Nome] | 0/3 | Não iniciada | - |
| 2. [Nome] | 0/2 | Não iniciada | - |
| 3. [Nome] | 0/2 | Não iniciada | - |
| 4. [Nome] | 0/1 | Não iniciada | - |
```

<guidelines>
**Planejamento inicial (v1.0):**
- A contagem de fases depende da configuração de granularidade (grosseiro: 3-5, padrão: 5-8, fino: 8-12)
- Cada fase entrega algo coerente
- Fases podem ter 1+ planos (dividir se >3 tarefas ou múltiplos subsistemas)
- Planos usam nomenclatura: {phase}-{plan}-PLAN.md (ex.: 01-02-PLAN.md)
- Sem estimativas de tempo (isso não é PM enterprise)
- Tabela de progresso atualizada pelo workflow de execução
- Contagem de planos pode ser "A definir" inicialmente, refinada durante o planejamento

**Critérios de sucesso:**
- 2-5 comportamentos observáveis por fase (da perspectiva do usuário)
- Verificados contra requisitos durante a criação do roadmap
- Fluem para `must_haves` no plan-phase
- Verificados pelo verify-phase após a execução
- Formato: "Usuário pode [ação]" ou "[Coisa] funciona/existe"

**Após milestones serem entregues:**
- Colapsar milestones completos em tags `<details>`
- Adicionar novas seções de milestone para trabalho futuro
- Manter numeração contínua de fases (nunca reiniciar em 01)
</guidelines>

<status_values>
- `Not started` - Não iniciada
- `In progress` - Em andamento
- `Complete` - Concluída (adicionar data de conclusão)
- `Deferred` - Diferida (com motivo)
</status_values>

## Roadmap Agrupado por Milestone (Após o v1.0 Ser Entregue)

Após completar o primeiro milestone, reorganizar com agrupamentos de milestone:

```markdown
# Roadmap: [Nome do Projeto]

## Milestones

- ✅ **v1.0 MVP** - Fases 1-4 (entregue YYYY-MM-DD)
- 🚧 **v1.1 [Nome]** - Fases 5-6 (em andamento)
- 📋 **v2.0 [Nome]** - Fases 7-10 (planejado)

## Fases

<details>
<summary>✅ v1.0 MVP (Fases 1-4) - ENTREGUE YYYY-MM-DD</summary>

### Fase 1: [Nome]
**Objetivo**: [O que esta fase entrega]
**Planos**: 3 planos

Planos:
- [x] 01-01: [Breve descrição]
- [x] 01-02: [Breve descrição]
- [x] 01-03: [Breve descrição]

[... fases restantes do v1.0 ...]

</details>

### 🚧 v1.1 [Nome] (Em Andamento)

**Objetivo do Milestone:** [O que o v1.1 entrega]

#### Fase 5: [Nome]
**Objetivo**: [O que esta fase entrega]
**Depende de**: Fase 4
**Planos**: 2 planos

Planos:
- [ ] 05-01: [Breve descrição]
- [ ] 05-02: [Breve descrição]

[... fases restantes do v1.1 ...]

### 📋 v2.0 [Nome] (Planejado)

**Objetivo do Milestone:** [O que o v2.0 entrega]

[... fases do v2.0 ...]

## Progresso

| Fase | Milestone | Planos Completos | Status | Concluída |
|------|-----------|------------------|--------|-----------|
| 1. Fundação | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 2. Funcionalidades | v1.0 | 2/2 | Complete | YYYY-MM-DD |
| 5. Segurança | v1.1 | 0/2 | Not started | - |
```

**Notas:**
- Emoji de milestone: ✅ entregue, 🚧 em andamento, 📋 planejado
- Milestones completos colapsados em `<details>` para legibilidade
- Milestones atuais/futuros expandidos
- Numeração contínua de fases (01-99)
- Tabela de progresso inclui coluna de milestone
