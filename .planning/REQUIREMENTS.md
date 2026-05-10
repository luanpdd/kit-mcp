# REQUIREMENTS — kit-mcp v1.20

> Tech Debt Closure & Quality Hardening — fechamento dos 5 itens parqueados pós-v1.19.
> Numeração de fases: continua de v1.19 (último concluído: Fase 99) → v1.20 começa em **Fase 100**.

## Contexto

Pós-v1.19 (Maturidade Operacional) o kit ficou em **PRR 28/30**, **coverage 81.51%**, **482 testes**. Restaram 5 itens documentados no [v1.19-MILESTONE-AUDIT.md:13](.planning/milestones/v1.19-MILESTONE-AUDIT.md) e [STATE.md](.planning/STATE.md) como tech debt v1.20+:

1. Auto-snapshot triggered em metrics-snapshot tool call
2. Multi-window burn-rate (1h fast + 6h slow)
3. Mutation testing (stryker)
4. Coverage 80% → 90% ratchet
5. Emergency PRR 4/5 → 5/5
6. Performance PRR 4/5 → 5/5

Este milestone fecha todos eles. Zero superfície de API nova; 1 dev dep nova (stryker).

## Requisitos

### Infra & Quality

- [x] **INFRA-20-01**: CI line coverage threshold é elevado de 80% → 86% (ratchet honesto entregue 2026-05-10; 86 → 90 deferido para v1.21+ porque cli/index.js capped at 82.61% por limite estrutural — live spawn / interactive TTY paths exigiriam `__test` exports que violam Stable API v1.0+). Wave 1 entregou 169 testes (482→651, +35.1%) elevando 7/8 hot files a ≥90%. Suite all-green. 3 avenues canônicas para 86→90 documentadas inline em ci.yml: (a) stryker mutation gate via Phase 101, (b) Phase 105 cli/index.js helper extraction, (c) branch coverage como 2º gate.
- [ ] **INFRA-20-02**: Mutation testing via stryker rodando localmente, baseline mutation score documentado em `.planning/audits/v1.20/MUTATION-BASELINE.md`. Stryker config em `stryker.config.json`. NPM script `test:mutation`. Não bloqueia CI nesta versão (gate v1.21+).

### Observabilidade

- [ ] **OBS-20-01**: Tool MCP `metrics-snapshot` automaticamente persiste o snapshot via `metrics.persistSnapshot()` em vez de exigir trigger manual. Comportamento idempotente — chamadas repetidas dentro de 1s não duplicam.
- [ ] **OBS-20-02**: SLOs YAML aceitam campo `windows: { fast: <duration>, slow: <duration> }` com defaults `1h`/`6h`. `/burn-rate-status` calcula e exibe burn rate para ambas as janelas, status enum considera dual-window (fast em PAGE, slow em TICKET).

### SRE PRR

- [ ] **SRE-20-01**: RUNBOOK.md ganha 3+ scenarios novos (boot failure, sidecar port collision, npm CVE rotation), cada um com Symptom→Diagnosis→Fix→Verification. Drill log template em `.planning/audits/v1.20/EMERGENCY-DRILL-LOG.md` com 1 entry inicial. Eleva PRR Emergency 4/5 → 5/5.
- [ ] **SRE-20-02**: Wins finais Performance — lazy-load completo das deps opcionais remanescentes (chokidar config tuning), MCP roundtrip p95 sub-100ms verificado em BENCHMARK.md. Eleva PRR Performance 4/5 → 5/5.

## Requisitos Futuros (adiados)

- Mutation testing como gate de CI (mutation score ≥ X% bloqueia merge) — depende de baseline INFRA-20-02 amadurecer.
- **Coverage 86% → 90% ratchet** (debt v1.21+ — saiu de Phase 100; 3 avenues canônicas: (a) Phase 101 stryker mutation gate como signal complementar, (b) Phase 105 extração de helpers cli/index.js para sibling modules permitindo in-process testing, (c) branch coverage como 2º gate; atualmente em 83.58%).
- Coverage 90% → 95% ratchet (ROI cai exponencialmente acima de 90%; antecedido por 86→90).
- Latency histogram p99 budget gate em CI.

## Fora do Escopo

- **Adições funcionais ao kit (skills/agents/commands novos)** — v1.20 é internal hardening; nada de surface API nova.
- **Changes em src/core/sync.js, registry.js, kit.js além do necessário** — Stable API v1.0+ preservada.
- **Migrações de versão major de deps existentes** — apenas stryker (dev dep nova).

## Rastreabilidade

| REQ-ID | Phase | Status |
|---|---|---|
| INFRA-20-01 | 100 | Complete |
| INFRA-20-02 | 101 | pending |
| OBS-20-01 | 102 | pending |
| OBS-20-02 | 103 | pending |
| SRE-20-01 | 104 | pending |
| SRE-20-02 | 105 | pending |

(Preenchido pelo roadmapper.)
