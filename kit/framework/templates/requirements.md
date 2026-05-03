# Template de Requirements

Template para `.planning/REQUIREMENTS.md` — requisitos verificáveis que definem "pronto."

<template>

```markdown
# Requisitos: [Nome do Projeto]

**Definidos:** [data]
**Valor Central:** [de PROJECT.md]

## Requisitos v1

Requisitos para o lançamento inicial. Cada um mapeia para fases do roadmap.

### Autenticação

- [ ] **AUTH-01**: Usuário pode se cadastrar com email e senha
- [ ] **AUTH-02**: Usuário recebe verificação por email após o cadastro
- [ ] **AUTH-03**: Usuário pode redefinir senha via link por email
- [ ] **AUTH-04**: Sessão do usuário persiste após atualização do navegador

### [Categoria 2]

- [ ] **[CAT]-01**: [Descrição do requisito]
- [ ] **[CAT]-02**: [Descrição do requisito]
- [ ] **[CAT]-03**: [Descrição do requisito]

### [Categoria 3]

- [ ] **[CAT]-01**: [Descrição do requisito]
- [ ] **[CAT]-02**: [Descrição do requisito]

## Requisitos v2

Diferidos para lançamento futuro. Rastreados mas não no roadmap atual.

### [Categoria]

- **[CAT]-01**: [Descrição do requisito]
- **[CAT]-02**: [Descrição do requisito]

## Fora do Escopo

Explicitamente excluídos. Documentados para prevenir expansão de escopo.

| Funcionalidade | Motivo |
|----------------|--------|
| [Funcionalidade] | [Por que excluída] |
| [Funcionalidade] | [Por que excluída] |

## Rastreabilidade

Quais fases cobrem quais requisitos. Atualizado durante a criação do roadmap.

| Requisito | Fase | Status |
|-----------|------|--------|
| AUTH-01 | Fase 1 | Pending |
| AUTH-02 | Fase 1 | Pending |
| AUTH-03 | Fase 1 | Pending |
| AUTH-04 | Fase 1 | Pending |
| [REQ-ID] | Fase [N] | Pending |

**Cobertura:**
- Requisitos v1: [X] total
- Mapeados para fases: [Y]
- Não mapeados: [Z] ⚠️

---
*Requisitos definidos: [data]*
*Última atualização: [data] após [gatilho]*
```

</template>

<guidelines>

**Formato de Requisito:**
- ID: `[CATEGORIA]-[NÚMERO]` (AUTH-01, CONTENT-02, SOCIAL-03)
- Descrição: Centrada no usuário, testável, atômica
- Checkbox: Apenas para requisitos v1 (v2 ainda não são acionáveis)

**Categorias:**
- Derivar das categorias FEATURES.md da pesquisa
- Manter consistente com convenções do domínio
- Típicas: Autenticação, Conteúdo, Social, Notificações, Moderação, Pagamentos, Admin

**v1 vs v2:**
- v1: Escopo comprometido, estará nas fases do roadmap
- v2: Reconhecido mas diferido, não no roadmap atual
- Mover v2 → v1 requer atualização do roadmap

**Fora do Escopo:**
- Exclusões explícitas com raciocínio
- Evita "por que você não incluiu X?" depois
- Anti-funcionalidades da pesquisa pertencem aqui com alertas

**Rastreabilidade:**
- Vazio inicialmente, preenchido durante a criação do roadmap
- Cada requisito mapeia para exatamente uma fase
- Requisitos não mapeados = lacuna no roadmap

**Valores de Status:**
- Pending: Não iniciado
- In Progress: Fase está ativa
- Complete: Requisito verificado
- Blocked: Aguardando fator externo

</guidelines>

<evolution>

**Após cada fase ser concluída:**
1. Marcar requisitos cobertos como Complete
2. Atualizar status de rastreabilidade
3. Anotar quaisquer requisitos que mudaram de escopo

**Após atualizações do roadmap:**
1. Verificar se todos os requisitos v1 ainda estão mapeados
2. Adicionar novos requisitos se o escopo expandiu
3. Mover requisitos para v2/fora do escopo se foram descartados

**Critérios de conclusão de requisito:**
- Requisito está "Complete" quando:
  - Funcionalidade está implementada
  - Funcionalidade está verificada (testes passam, verificação manual feita)
  - Funcionalidade está comitada

</evolution>

<example>

```markdown
# Requisitos: CommunityApp

**Definidos:** 2025-01-14
**Valor Central:** Usuários podem compartilhar e discutir conteúdo com pessoas que compartilham seus interesses

## Requisitos v1

### Autenticação

- [ ] **AUTH-01**: Usuário pode se cadastrar com email e senha
- [ ] **AUTH-02**: Usuário recebe verificação por email após o cadastro
- [ ] **AUTH-03**: Usuário pode redefinir senha via link por email
- [ ] **AUTH-04**: Sessão do usuário persiste após atualização do navegador

### Perfis

- [ ] **PROF-01**: Usuário pode criar perfil com nome de exibição
- [ ] **PROF-02**: Usuário pode fazer upload de foto de avatar
- [ ] **PROF-03**: Usuário pode escrever bio (máx 500 chars)
- [ ] **PROF-04**: Usuário pode visualizar perfis de outros usuários

### Conteúdo

- [ ] **CONT-01**: Usuário pode criar post de texto
- [ ] **CONT-02**: Usuário pode fazer upload de imagem com post
- [ ] **CONT-03**: Usuário pode editar próprios posts
- [ ] **CONT-04**: Usuário pode deletar próprios posts
- [ ] **CONT-05**: Usuário pode visualizar feed de posts

### Social

- [ ] **SOCL-01**: Usuário pode seguir outros usuários
- [ ] **SOCL-02**: Usuário pode deixar de seguir usuários
- [ ] **SOCL-03**: Usuário pode curtir posts
- [ ] **SOCL-04**: Usuário pode comentar em posts
- [ ] **SOCL-05**: Usuário pode visualizar feed de atividades (posts de usuários seguidos)

## Requisitos v2

### Notificações

- **NOTF-01**: Usuário recebe notificações no app
- **NOTF-02**: Usuário recebe email para novos seguidores
- **NOTF-03**: Usuário recebe email para comentários em seus posts
- **NOTF-04**: Usuário pode configurar preferências de notificação

### Moderação

- **MODR-01**: Usuário pode denunciar conteúdo
- **MODR-02**: Usuário pode bloquear outros usuários
- **MODR-03**: Admin pode visualizar conteúdo denunciado
- **MODR-04**: Admin pode remover conteúdo
- **MODR-05**: Admin pode banir usuários

## Fora do Escopo

| Funcionalidade | Motivo |
|----------------|--------|
| Chat em tempo real | Alta complexidade, não é central para o valor da comunidade |
| Posts em vídeo | Custos de armazenamento/banda, diferir para v2+ |
| Login OAuth | Email/senha suficiente para v1 |
| App mobile | Web primeiro, mobile depois |

## Rastreabilidade

| Requisito | Fase | Status |
|-----------|------|--------|
| AUTH-01 | Fase 1 | Pending |
| AUTH-02 | Fase 1 | Pending |
| AUTH-03 | Fase 1 | Pending |
| AUTH-04 | Fase 1 | Pending |
| PROF-01 | Fase 2 | Pending |
| PROF-02 | Fase 2 | Pending |
| PROF-03 | Fase 2 | Pending |
| PROF-04 | Fase 2 | Pending |
| CONT-01 | Fase 3 | Pending |
| CONT-02 | Fase 3 | Pending |
| CONT-03 | Fase 3 | Pending |
| CONT-04 | Fase 3 | Pending |
| CONT-05 | Fase 3 | Pending |
| SOCL-01 | Fase 4 | Pending |
| SOCL-02 | Fase 4 | Pending |
| SOCL-03 | Fase 4 | Pending |
| SOCL-04 | Fase 4 | Pending |
| SOCL-05 | Fase 4 | Pending |

**Cobertura:**
- Requisitos v1: 18 total
- Mapeados para fases: 18
- Não mapeados: 0 ✓

---
*Requisitos definidos: 2025-01-14*
*Última atualização: 2025-01-14 após definição inicial*
```

</example>
