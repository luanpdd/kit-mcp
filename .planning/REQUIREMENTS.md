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

- [ ] **INFRA-20-01**: CI line coverage threshold é elevado de 80% → 90%, com testes targeted nos arquivos abaixo do alvo. Suite continua all-green.
- [ ] **INFRA-20-02**: Mutation testing via stryker rodando localmente, baseline mutation score documentado em `.planning/audits/v1.20/MUTATION-BASELINE.md`. Stryker config em `stryker.config.json`. NPM script `test:mutation`. Não bloqueia CI nesta versão (gate v1.21+).

### Observabilidade

- [ ] **OBS-20-01**: Tool MCP `metrics-snapshot` automaticamente persiste o snapshot via `metrics.persistSnapshot()` em vez de exigir trigger manual. Comportamento idempotente — chamadas repetidas dentro de 1s não duplicam.
- [ ] **OBS-20-02**: SLOs YAML aceitam campo `windows: { fast: <duration>, slow: <duration> }` com defaults `1h`/`6h`. `/burn-rate-status` calcula e exibe burn rate para ambas as janelas, status enum considera dual-window (fast em PAGE, slow em TICKET).

### SRE PRR

- [ ] **SRE-20-01**: RUNBOOK.md ganha 3+ scenarios novos (boot failure, sidecar port collision, npm CVE rotation), cada um com Symptom→Diagnosis→Fix→Verification. Drill log template em `.planning/audits/v1.20/EMERGENCY-DRILL-LOG.md` com 1 entry inicial. Eleva PRR Emergency 4/5 → 5/5.
- [ ] **SRE-20-02**: Wins finais Performance — lazy-load completo das deps opcionais remanescentes (chokidar config tuning), MCP roundtrip p95 sub-100ms verificado em BENCHMARK.md. Eleva PRR Performance 4/5 → 5/5.

## Requisitos Futuros (adiados)

- Mutation testing como gate de CI (mutation score ≥ X% bloqueia merge) — depende de baseline INFRA-20-02 amadurecer.
- Coverage 90% → 95% ratchet (ROI cai exponencialmente acima de 90%).
- Latency histogram p99 budget gate em CI.

## Fora do Escopo

- **Adições funcionais ao kit (skills/agents/commands novos)** — v1.20 é internal hardening; nada de surface API nova.
- **Changes em src/core/sync.js, registry.js, kit.js além do necessário** — Stable API v1.0+ preservada.
- **Migrações de versão major de deps existentes** — apenas stryker (dev dep nova).

## Rastreabilidade

| REQ-ID | Phase | Status |
|---|---|---|
| INFRA-20-01 | TBD | pending |
| INFRA-20-02 | TBD | pending |
| OBS-20-01 | TBD | pending |
| OBS-20-02 | TBD | pending |
| SRE-20-01 | TBD | pending |
| SRE-20-02 | TBD | pending |

(Preenchido pelo roadmapper.)
