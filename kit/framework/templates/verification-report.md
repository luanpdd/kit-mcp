# Template de Relatório de Verificação

Template para `.planning/phases/XX-name/{phase_num}-VERIFICATION.md` — resultados de verificação do objetivo da fase.

---

## Template do Arquivo

```markdown
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verificados
---

# Fase {X}: {Nome} — Relatório de Verificação

**Objetivo da Fase:** {objetivo do ROADMAP.md}
**Verificado:** {timestamp}
**Status:** {passed | gaps_found | human_needed}

## Atingimento do Objetivo

### Verdades Observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | {verdade dos must_haves} | ✓ VERIFICADO | {o que confirmou} |
| 2 | {verdade dos must_haves} | ✗ FALHOU | {o que está errado} |
| 3 | {verdade dos must_haves} | ? INCERTO | {por que não pode verificar} |

**Pontuação:** {N}/{M} verdades verificadas

### Artefatos Necessários

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|---------|
| `src/components/Chat.tsx` | Componente de lista de mensagens | ✓ EXISTE + SUBSTANCIAL | Exporta ChatList, renderiza Message[], sem stubs |
| `src/app/api/chat/route.ts` | CRUD de mensagens | ✗ STUB | Arquivo existe mas POST retorna placeholder |
| `prisma/schema.prisma` | Model de Message | ✓ EXISTE + SUBSTANCIAL | Model definido com todos os campos |

**Artefatos:** {N}/{M} verificados

### Verificação de Conexões Chave

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| Chat.tsx | /api/chat | fetch in useEffect | ✓ CONECTADO | Linha 23: `fetch('/api/chat')` com tratamento de resposta |
| ChatInput | /api/chat POST | onSubmit handler | ✗ NÃO CONECTADO | onSubmit apenas chama console.log |
| /api/chat POST | database | prisma.message.create | ✗ NÃO CONECTADO | Retorna resposta hardcoded, sem chamada ao DB |

**Conexões:** {N}/{M} verificadas

## Cobertura de Requisitos

| Requisito | Status | Problema Bloqueante |
|-----------|--------|---------------------|
| {REQ-01}: {descrição} | ✓ SATISFEITO | - |
| {REQ-02}: {descrição} | ✗ BLOQUEADO | Rota da API é stub |
| {REQ-03}: {descrição} | ? PRECISA HUMANO | Não é possível verificar WebSocket programaticamente |

**Cobertura:** {N}/{M} requisitos satisfeitos

## Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| src/app/api/chat/route.ts | 12 | `// TODO: implement` | ⚠️ Alerta | Indica incompleto |
| src/components/Chat.tsx | 45 | `return <div>Placeholder</div>` | 🛑 Bloqueador | Não renderiza conteúdo |
| src/hooks/useChat.ts | - | Arquivo faltando | 🛑 Bloqueador | Hook esperado não existe |

**Anti-padrões:** {N} encontrados ({blockers} bloqueadores, {warnings} alertas)

## Verificação Humana Necessária

{Se nenhuma verificação humana necessária:}
Nenhuma — todos os itens verificáveis foram verificados programaticamente.

{Se verificação humana necessária:}

### 1. {Nome do Teste}
**Teste:** {O que fazer}
**Esperado:** {O que deve acontecer}
**Por que humano:** {Por que não pode verificar programaticamente}

### 2. {Nome do Teste}
**Teste:** {O que fazer}
**Esperado:** {O que deve acontecer}
**Por que humano:** {Por que não pode verificar programaticamente}

## Resumo de Lacunas

{Se sem lacunas:}
**Nenhuma lacuna encontrada.** Objetivo da fase atingido. Pronto para prosseguir.

{Se lacunas encontradas:}

### Lacunas Críticas (Bloqueiam o Progresso)

1. **{Nome da lacuna}**
   - Faltando: {o que está faltando}
   - Impacto: {por que isso bloqueia o objetivo}
   - Correção: {o que precisa acontecer}

2. **{Nome da lacuna}**
   - Faltando: {o que está faltando}
   - Impacto: {por que isso bloqueia o objetivo}
   - Correção: {o que precisa acontecer}

### Lacunas Não-Críticas (Podem Ser Diferidas)

1. **{Nome da lacuna}**
   - Problema: {o que está errado}
   - Impacto: {impacto limitado porque...}
   - Recomendação: {corrigir agora ou diferir}

## Planos de Correção Recomendados

{Se lacunas encontradas, gerar recomendações de plano de correção:}

### {phase}-{next}-PLAN.md: {Nome da Correção}

**Objetivo:** {O que isso corrige}

**Tarefas:**
1. {Tarefa para corrigir lacuna 1}
2. {Tarefa para corrigir lacuna 2}
3. {Tarefa de verificação}

**Escopo estimado:** {Pequeno / Médio}

---

### {phase}-{next+1}-PLAN.md: {Nome da Correção}

**Objetivo:** {O que isso corrige}

**Tarefas:**
1. {Tarefa}
2. {Tarefa}

**Escopo estimado:** {Pequeno / Médio}

---

## Metadados de Verificação

**Abordagem de verificação:** Goal-backward (derivada do objetivo da fase)
**Fonte dos must-haves:** {frontmatter do PLAN.md | derivado do objetivo do ROADMAP.md}
**Verificações automatizadas:** {N} passaram, {M} falharam
**Verificações humanas necessárias:** {N}
**Tempo total de verificação:** {duração}

---
*Verificado: {timestamp}*
*Verificador: Claude (subagente)*
```

---

## Diretrizes

**Valores de status:**
- `passed` — Todos os must-haves verificados, sem bloqueadores
- `gaps_found` — Uma ou mais lacunas críticas encontradas
- `human_needed` — Verificações automatizadas passam mas verificação humana necessária

**Tipos de evidência:**
- Para EXISTS: "Arquivo no caminho, exporta X"
- Para SUBSTANTIVE: "N linhas, tem padrões X, Y, Z"
- Para WIRED: "Linha N: código que conecta A a B"
- Para FAILED: "Faltando porque X" ou "Stub porque Y"

**Níveis de severidade:**
- 🛑 Bloqueador: Impede o atingimento do objetivo, deve corrigir
- ⚠️ Alerta: Indica incompleto mas não bloqueia
- ℹ️ Info: Notável mas não problemático

**Geração de plano de correção:**
- Gerar apenas se gaps_found
- Agrupar correções relacionadas em planos únicos
- Manter 2-3 tarefas por plano
- Incluir tarefa de verificação em cada plano

---

## Exemplo

```markdown
---
phase: 03-chat
verified: 2025-01-15T14:30:00Z
status: gaps_found
score: 2/5 must-haves verificados
---

# Fase 3: Interface de Chat — Relatório de Verificação

**Objetivo da Fase:** Interface de chat funcional onde usuários podem enviar e receber mensagens
**Verificado:** 2025-01-15T14:30:00Z
**Status:** gaps_found

## Atingimento do Objetivo

### Verdades Observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Usuário pode ver mensagens existentes | ✗ FALHOU | Componente renderiza placeholder, não dados de mensagem |
| 2 | Usuário pode digitar uma mensagem | ✓ VERIFICADO | Campo de input existe com handler onChange |
| 3 | Usuário pode enviar uma mensagem | ✗ FALHOU | Handler onSubmit é apenas console.log |
| 4 | Mensagem enviada aparece na lista | ✗ FALHOU | Sem atualização de estado após envio |
| 5 | Mensagens persistem após atualização | ? INCERTO | Não é possível verificar — envio não funciona |

**Pontuação:** 1/5 verdades verificadas

## Resumo de Lacunas

### Lacunas Críticas (Bloqueiam o Progresso)

1. **Componente de chat é placeholder**
   - Faltando: Renderização real da lista de mensagens
   - Impacto: Usuários veem "Chat will be here" em vez de mensagens
   - Correção: Implementar Chat.tsx para buscar e renderizar mensagens

2. **Rotas da API são stubs**
   - Faltando: Integração com banco nas rotas GET e POST
   - Impacto: Sem persistência de dados, sem funcionalidade real
   - Correção: Conectar chamadas prisma nos handlers de rota

## Planos de Correção Recomendados

### 03-04-PLAN.md: Implementar API de Chat

**Objetivo:** Conectar rotas da API ao banco de dados

**Tarefas:**
1. Implementar GET /api/chat com prisma.message.findMany
2. Implementar POST /api/chat com prisma.message.create
3. Verificar: API retorna dados reais, POST cria registros

**Escopo estimado:** Pequeno

---

## Metadados de Verificação

**Abordagem de verificação:** Goal-backward (derivada do objetivo da fase)
**Fonte dos must-haves:** frontmatter do 03-01-PLAN.md
**Verificações automatizadas:** 2 passaram, 8 falharam
**Verificações humanas necessárias:** 0 (bloqueadas por falhas automatizadas)
**Tempo total de verificação:** 2 min

---
*Verificado: 2025-01-15T14:30:00Z*
*Verificador: Claude (subagente)*
```
