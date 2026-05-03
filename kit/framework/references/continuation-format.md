# Formato de Continuação

Formato padrão para apresentar os próximos passos após concluir um comando ou workflow.

## Estrutura Principal

```
---

## ▶ Próximo Passo

**{identificador}: {nome}** — {descrição em uma linha}

`{comando para copiar-colar}`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `{opção alternativa 1}` — descrição
- `{opção alternativa 2}` — descrição

---
```

## Regras de Formato

1. **Sempre mostre o que é** — nome + descrição, nunca apenas um caminho de comando
2. **Extraia contexto da fonte** — ROADMAP.md para fases, `<objective>` do PLAN.md para planos
3. **Comando em código inline** — crases, fácil de copiar-colar, renderiza como link clicável
4. **Explicação do `/clear`** — sempre inclua, mantém conciso mas explica o porquê
5. **"Também disponível" não "Outras opções"** — soa mais como um app
6. **Separadores visuais** — `---` acima e abaixo para se destacar

## Variantes

### Executar Próximo Plano

```
---

## ▶ Próximo Passo

**02-03: Rotação de Token Refresh** — Adicionar /api/auth/refresh com expiração deslizante

`/executar-fase 2`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- Revisar plano antes de executar
- `/listar-hipoteses-fase 2` — verificar hipóteses

---
```

### Executar Último Plano da Fase

Adicione nota informando que este é o último plano e o que vem a seguir:

```
---

## ▶ Próximo Passo

**02-03: Rotação de Token Refresh** — Adicionar /api/auth/refresh com expiração deslizante
<sub>Último plano da Fase 2</sub>

`/executar-fase 2`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Após a conclusão:**
- Transição da Fase 2 → Fase 3
- Próximo: **Fase 3: Funcionalidades Principais** — Dashboard do usuário e configurações

---
```

### Planejar uma Fase

```
---

## ▶ Próximo Passo

**Fase 2: Autenticação** — Fluxo de login JWT com tokens de refresh

`/planejar-fase 2`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `/discutir-fase 2` — coletar contexto primeiro
- `/pesquisar-fase 2` — investigar incógnitas
- Revisar roadmap

---
```

### Fase Concluída, Pronto para Próxima

Mostre o status de conclusão antes da próxima ação:

```
---

## ✓ Fase 2 Concluída

3/3 planos executados

## ▶ Próximo Passo

**Fase 3: Funcionalidades Principais** — Dashboard do usuário, configurações e exportação de dados

`/planejar-fase 3`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `/discutir-fase 3` — coletar contexto primeiro
- `/pesquisar-fase 3` — investigar incógnitas
- Revisar o que a Fase 2 construiu

---
```

### Múltiplas Opções Iguais

Quando não há uma ação primária clara:

```
---

## ▶ Próximo Passo

**Fase 3: Funcionalidades Principais** — Dashboard do usuário, configurações e exportação de dados

**Para planejar diretamente:** `/planejar-fase 3`

**Para discutir o contexto primeiro:** `/discutir-fase 3`

**Para pesquisar incógnitas:** `/pesquisar-fase 3`

<sub>`/clear` primeiro → contexto limpo</sub>

---
```

### Marco Concluído

```
---

## 🎉 Marco v1.0 Concluído

Todas as 4 fases lançadas

## ▶ Próximo Passo

**Iniciar v1.1** — questionamento → pesquisa → requisitos → roadmap

`/novo-marco`

<sub>`/clear` primeiro → contexto limpo</sub>

---
```

## Extraindo Contexto

### Para fases (do ROADMAP.md):

```markdown
### Phase 2: Authentication
**Goal**: JWT login flow with refresh tokens
```

Extraia: `**Fase 2: Autenticação** — Fluxo de login JWT com tokens de refresh`

### Para planos (do ROADMAP.md):

```markdown
Plans:
- [ ] 02-03: Add refresh token rotation
```

Ou do `<objective>` do PLAN.md:

```xml
<objective>
Add refresh token rotation with sliding expiry window.

Purpose: Extend session lifetime without compromising security.
</objective>
```

Extraia: `**02-03: Rotação de Token Refresh** — Adicionar /api/auth/refresh com expiração deslizante`

## Anti-Padrões

### Não: Apenas o comando (sem contexto)

```
## Para Continuar

Execute `/clear`, depois cole:
/executar-fase 2
```

O usuário não tem ideia do que é o 02-03.

### Não: Explicação do /clear ausente

```
`/planejar-fase 3`

Execute /clear primeiro.
```

Não explica o porquê. O usuário pode pular.

### Não: Linguagem "Outras opções"

```
Outras opções:
- Revisar roadmap
```

Parece algo secundário. Use "Também disponível:" em vez disso.

### Não: Blocos de código cercado para comandos

```
```
/planejar-fase 3
```
```

Blocos cercados dentro de templates criam ambiguidade de aninhamento. Use crases inline em vez disso.
