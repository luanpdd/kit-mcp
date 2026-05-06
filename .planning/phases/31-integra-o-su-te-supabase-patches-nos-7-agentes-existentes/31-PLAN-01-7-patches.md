---
phase: 31
plan: 01
title: 7 patches em agentes Supabase
goal: Adicionar bloco "Observabilidade integrada" + cross-refs em 7 agentes Supabase existentes
status: complete
covers_reqs: [INT-SB-01, INT-SB-02, INT-SB-03, INT-SB-04, INT-SB-05, INT-SB-06, INT-SB-07]
---

# Plan 01: 7 patches em agentes Supabase

## Tarefas

| # | Agent | Skills observabilidade adicionadas | REQ |
|---|-------|------------------------------------|-----|
| 1 | supabase-architect | event-based-slos*, ODD, OMM* | INT-SB-01 |
| 2 | supabase-migration-writer | structured-events, ODD | INT-SB-02 |
| 3 | supabase-rls-writer | structured-events, core-analysis-loop | INT-SB-03 |
| 4 | supabase-edge-fn-writer | opentelemetry-standard, distributed-tracing, telemetry-sampling*, structured-events, ODD | INT-SB-04 |
| 5 | supabase-realtime-implementer | distributed-tracing, structured-events | INT-SB-05 |
| 6 | supabase-auth-bootstrapper | structured-events, event-based-slos* | INT-SB-06 |
| 7 | supabase-storage-implementer | structured-events, telemetry-sampling* | INT-SB-07 |

(*) forward refs marcadas com `*(Phase 32)*` ou `*(Phase 34)*`.

## Validação

- 7 arquivos `kit/agents/supabase-*.md` editados
- Cada um tem bloco "## Observabilidade integrada" novo
- Seções "Ver também" expandidas com skills observabilidade
- Sync idempotente (excluindo timestamp regenerado)
- Tamanho máximo de cada agent < 320 lines (não inflar muito)
