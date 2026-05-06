---
phase: 31
status: complete
completed: 2026-05-06
covers_reqs: [INT-SB-01, INT-SB-02, INT-SB-03, INT-SB-04, INT-SB-05, INT-SB-06, INT-SB-07]
---

# Phase 31 — Summary: Integração Suíte Supabase

## Entregue

7 agentes Supabase patcheados — cada um com bloco "## Observabilidade integrada" novo + seção "Ver também" expandida com skills observabilidade.

| # | Agent | Lines (antes → depois) | REQs |
|---|-------|------------------------|------|
| 1 | supabase-architect | 153 → 166 | INT-SB-01 |
| 2 | supabase-migration-writer | 156 → 174 | INT-SB-02 |
| 3 | supabase-rls-writer | 218 → 235 | INT-SB-03 |
| 4 | supabase-edge-fn-writer | 185 → 207 | INT-SB-04 |
| 5 | supabase-realtime-implementer | 252 → 275 | INT-SB-05 |
| 6 | supabase-auth-bootstrapper | 298 → 315 | INT-SB-06 |
| 7 | supabase-storage-implementer | 240 → 258 | INT-SB-07 |

## Padrão aplicado

Cada agente ganhou:

1. **Bloco "## Observabilidade integrada"** antes da seção "Ver também" final, descrevendo:
   - Quais atributos canônicos o agente injeta no output
   - Quais skills observabilidade são consultadas (Phase 29-30 via direct ref; Phase 32/34 via forward ref `*(Phase X)*`)
   - Que comportamentos o output respeita (instrumentação bundle, ODD, audit trail)
2. **Seção "Ver também" expandida** com cross-refs para skills observabilidade relevantes

## Conexões skills↔agentes Supabase

```
event-based-slos*    ← architect, auth-bootstrapper
ODD                  ← architect, migration-writer, edge-fn-writer
OMM*                 ← architect
structured-events    ← migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer
core-analysis-loop   ← rls-writer
opentelemetry-std    ← edge-fn-writer
distributed-tracing  ← edge-fn-writer, realtime-implementer
telemetry-sampling*  ← edge-fn-writer, storage-implementer

(*) forward ref para Phase 32/34
```

## Validação

- ✅ 7/7 agentes patcheados (verificação `grep -c "## Observabilidade integrada"` → 1 cada)
- ✅ Tamanho de cada agent < 320 lines (max: 315 em auth-bootstrapper)
- ✅ Sync continua idempotente (precedente Phase 29-30 mantido)
- ✅ Anti-pitfall A2 preservado — descriptions dos agentes não mudaram (bloco adicionado é body, não frontmatter)

## Próximo: Phase 32 — Skills SLO + agentes SLO + comandos
