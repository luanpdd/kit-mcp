---
name: reconcile-execution-backlog
cost_tier: leve
description: Codifica a invariante NEVER-MERGE/NEVER-PUSH do worktree do executor e o protocolo de reconcile do backlog por status (DONE/TODO/BLOCKED). Use ao fechar o loop do executor.
---

# Reconcile execution backlog — invariante do worktree + protocolo de fechamento de loop

Skill canônica que define **duas disciplinas do executor do kit**: (1) a invariante
**NEVER-MERGE / NEVER-PUSH** do worktree isolado e (2) o **protocolo de reconcile** do backlog de
planos de execução, status por status. Absorve a disciplina de *closing-the-loop* do padrão
[`shadcn/improve`](https://github.com/shadcn/improve) — todo plano emitido é, eventualmente,
reconciliado contra o que de fato entrou no HEAD, e nada apodrece silenciosamente no backlog.

## Quando usar

- Ao **encerrar uma run do executor** — antes de devolver o diff, reconcilie cada plano aberto do
  backlog contra o estado real do código (HEAD do worktree).
- Sempre que um orquestrador for **integrar trabalho de um executor** — para lembrar que o merge é
  decisão do usuário, não automática.
- Periodicamente, para **varrer o backlog** e baixar planos resolvidos incidentalmente, refrescar
  drift de SHA/excerpts ou marcar `STALE` quando o executor crashou no meio.

## NEVER-MERGE / NEVER-PUSH

O executor **sempre roda num worktree isolado** (branch próprio, fora do branch de trabalho do
usuário). A invariante dura:

- O orquestrador **NUNCA** faz `merge`, `push` ou `commit` no branch do usuário automaticamente.
- O executor **commita apenas dentro do seu worktree isolado** — nunca toca o branch do usuário.
- Ao terminar, ele **entrega o diff + o path do worktree** e **para**. A integração (cherry-pick,
  merge, rebase, descarte) é **decisão explícita do usuário**.
- Nenhum gate, hook ou "conveniência" pode burlar isto. Push/merge automático é violação P0.

> Regra de ouro: o executor **produz**; o usuário **integra**. O diff é uma proposta, não um fato
> consumado no histórico do usuário.

## Protocolo de reconcile

Para cada plano no backlog, reconcilie pelo seu status atual contra o HEAD do worktree:

| Status do plano | Ação de reconcile |
|---|---|
| **DONE** | *Spot-check* no HEAD — confirme que o comportamento descrito realmente entrou. Se confirmado, **retém o arquivo do plano como registro** (não apaga — é trilha de auditoria). |
| **TODO** | *Drift-check* via `planned_at_sha` vs HEAD. Se o código **driftou** desde o planejamento, **refresque** o `planned_at_sha` e os `excerpts` citados. Se o item foi **resolvido incidentalmente** por outro trabalho → marque **REJECTED** com 1 linha de motivo. |
| **IN PROGRESS (stale)** | *Flag* — provável que o **executor crashou** no meio. **Cheque o worktree** para diff parcial; decida retomar, descartar ou reabrir como TODO limpo. Nunca assuma concluído. |
| **BLOCKED** | *Investigue* a causa. Se a abordagem ficou **fundamentalmente diferente**, **reescreva com novo número** (plano novo, o antigo vira histórico). Se ainda válida, apenas **refresque** SHA/excerpts. Se o bloqueio sumiu sozinho → **REJECTED** com 1 linha. |

**Princípio:** reconciliar é baratear o próximo loop — o backlog deve sempre refletir o HEAD real,
sem planos zumbis citando linhas que já mudaram.

## Status values

Valores canônicos de status de um plano de execução:

| Status | Significado |
|---|---|
| **TODO** | Planejado, ainda não iniciado. |
| **IN PROGRESS** | Executor trabalhando agora (ou crashou no meio → vira `STALE`). |
| **DONE** | Implementado e confirmado no HEAD; arquivo retido como registro. |
| **BLOCKED** | Impedido por dependência, decisão pendente ou ambiguidade. |
| **STALE** | Marcado quando o **commit-stamp do plano diverge do HEAD** — o plano foi escrito contra um SHA que não é mais o topo. |
| **REJECTED** | Descartado — resolvido incidentalmente, by-design ou fora-de-escopo; acompanha 1 linha de motivo. |

**Regra de staleness:** compare o **commit-stamp do plano** (`planned_at_sha`) com o **HEAD** do
worktree. Se divergiram, o plano é **STALE** — antes de executá-lo, refresque SHA/excerpts (ou
reabra como TODO limpo). Plano stale executado às cegas vira patch contra código que já mudou.

## Relacionados

- [[leverage-scoring]] — schema de Finding + fórmula de leverage; os itens que entram neste backlog
  costumam nascer de findings priorizados por leverage.
