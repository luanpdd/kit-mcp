# Template de Summary

Template para `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` - documentação de conclusão de fase.

---

## Template do Arquivo

```markdown
---
phase: XX-name
plan: YY
subsystem: [categoria primária: auth, payments, ui, api, database, infra, testing, etc.]
tags: [tech pesquisável: jwt, stripe, react, postgres, prisma]

# Grafo de dependências
requires:
  - phase: [fase anterior da qual esta depende]
    provides: [o que aquela fase construiu e esta usa]
provides:
  - [lista de o que esta fase construiu/entregou]
affects: [lista de nomes de fases ou palavras-chave que precisarão deste contexto]

# Rastreamento de tecnologia
tech-stack:
  added: [bibliotecas/ferramentas adicionadas nesta fase]
  patterns: [padrões arquiteturais/de código estabelecidos]

key-files:
  created: [arquivos importantes criados]
  modified: [arquivos importantes modificados]

key-decisions:
  - "Decisão 1"
  - "Decisão 2"

patterns-established:
  - "Padrão 1: descrição"
  - "Padrão 2: descrição"

requirements-completed: []  # OBRIGATÓRIO — Copiar TODOS os IDs de requisitos do campo `requirements` do frontmatter deste plano.

# Métricas
duration: Xmin
completed: YYYY-MM-DD
---

# Fase [X]: [Nome] — Resumo

**[Uma linha substantiva descrevendo o resultado - NÃO "fase completa" ou "implementação finalizada"]**

## Performance

- **Duração:** [tempo] (ex.: 23 min, 1h 15m)
- **Iniciado:** [timestamp ISO]
- **Concluído:** [timestamp ISO]
- **Tarefas:** [contagem concluída]
- **Arquivos modificados:** [contagem]

## Realizações
- [Resultado mais importante]
- [Segunda conquista chave]
- [Terceira se aplicável]

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: [nome da tarefa]** - `abc123f` (feat/fix/test/refactor)
2. **Tarefa 2: [nome da tarefa]** - `def456g` (feat/fix/test/refactor)
3. **Tarefa 3: [nome da tarefa]** - `hij789k` (feat/fix/test/refactor)

**Metadados do plano:** `lmn012o` (docs: plano completo)

_Nota: Tarefas TDD podem ter múltiplos commits (test → feat → refactor)_

## Arquivos Criados/Modificados
- `path/to/file.ts` - O que faz
- `path/to/another.ts` - O que faz

## Decisões Tomadas
[Decisões chave com breve justificativa, ou "Nenhuma — plano seguido como especificado"]

## Desvios do Plano

[Se sem desvios: "Nenhum — plano executado exatamente como escrito"]

[Se desvios ocorreram:]

### Problemas Corrigidos Automaticamente

**1. [Regra X - Categoria] Breve descrição**
- **Encontrado durante:** Tarefa [N] ([nome da tarefa])
- **Problema:** [O que estava errado]
- **Correção:** [O que foi feito]
- **Arquivos modificados:** [caminhos dos arquivos]
- **Verificação:** [Como foi verificado]
- **Comitado em:** [hash] (parte do commit da tarefa)

[... repetir para cada correção automática ...]

---

**Total de desvios:** [N] corrigidos automaticamente ([breakdown por regra])
**Impacto no plano:** [Breve avaliação - ex.: "Todas as correções automáticas necessárias para correção/segurança. Sem expansão de escopo."]

## Problemas Encontrados
[Problemas e como foram resolvidos, ou "Nenhum"]

[Nota: "Desvios do Plano" documenta trabalho não planejado que foi tratado automaticamente via regras de desvio. "Problemas Encontrados" documenta problemas durante o trabalho planejado que requeriram resolução de problemas.]

## Configuração Manual Necessária

[Se USER-SETUP.md foi gerado:]
**Serviços externos requerem configuração manual.** Ver [{phase}-USER-SETUP.md](./{phase}-USER-SETUP.md) para:
- Variáveis de ambiente a adicionar
- Etapas de configuração do dashboard
- Comandos de verificação

[Se sem USER-SETUP.md:]
Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase
[O que está pronto para a próxima fase]
[Quaisquer bloqueios ou preocupações]

---
*Fase: XX-nome*
*Concluída: [data]*
```

<frontmatter_guidance>
**Propósito:** Habilitar montagem automática de contexto via grafo de dependências. O frontmatter torna os metadados do summary legíveis por máquina para que o plan-phase possa escanear todos os summaries rapidamente e selecionar os relevantes com base em dependências.

**Escaneamento rápido:** O frontmatter está nas primeiras ~25 linhas, barato de escanear em todos os summaries sem ler o conteúdo completo.

**Grafo de dependências:** `requires`/`provides`/`affects` criam links explícitos entre fases, habilitando fechamento transitivo para seleção de contexto.

**Subsystem:** Categorização primária (auth, payments, ui, api, database, infra, testing) para detectar fases relacionadas.

**Tags:** Palavras-chave técnicas pesquisáveis (bibliotecas, frameworks, ferramentas) para consciência do stack tecnológico.

**Key-files:** Arquivos importantes para referências @context no PLAN.md.

**Patterns:** Convenções estabelecidas que fases futuras devem manter.

**Preenchimento:** O frontmatter é preenchido durante a criação do summary no execute-plan.md. Ver `<step name="create_summary">` para orientação campo a campo.
</frontmatter_guidance>

<one_liner_rules>
O one-liner DEVE ser substantivo:

**Bom:**
- "Auth JWT com rotação de refresh usando biblioteca jose"
- "Schema Prisma com models User, Session e Product"
- "Dashboard com métricas em tempo real via Server-Sent Events"

**Ruim:**
- "Fase completa"
- "Autenticação implementada"
- "Fundação finalizada"
- "Todas as tarefas concluídas"

O one-liner deve dizer a alguém o que realmente foi entregue.
</one_liner_rules>

<example>
```markdown
# Phase 1: Foundation Summary

**JWT auth with refresh rotation using jose library, Prisma User model, and protected API middleware**

## Performance

- **Duration:** 28 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T14:50:33Z
- **Tasks:** 5
- **Files modified:** 8

## Accomplishments
- User model with email/password auth
- Login/logout endpoints with httpOnly JWT cookies
- Protected route middleware checking token validity
- Refresh token rotation on each request

## Decisions Made
- Used jose instead of jsonwebtoken (ESM-native, Edge-compatible)
- 15-min access tokens with 7-day refresh tokens
- Storing refresh tokens in database for revocation capability

## Next Phase Readiness
- Auth foundation complete, ready for feature development
- User registration endpoint needed before public launch
```
</example>

<guidelines>
**Frontmatter:** OBRIGATÓRIO — completar todos os campos. Habilita montagem automática de contexto para planejamento futuro.

**One-liner:** Deve ser substantivo. "Auth JWT com rotação de refresh usando biblioteca jose" não "Autenticação implementada".

**Seção de Decisões:**
- Decisões chave tomadas durante a execução com justificativa
- Extraídas para o contexto acumulado do STATE.md
- Usar "Nenhuma — plano seguido como especificado" se sem desvios

**Após a criação:** STATE.md atualizado com posição, decisões, problemas.
</guidelines>
