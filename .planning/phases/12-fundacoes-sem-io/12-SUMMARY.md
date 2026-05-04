# Phase 12: Fundações sem I/O — Summary

**Concluída:** 2026-05-04
**Tipo:** Pure utilities (sem rede, sem fs cross-process)
**REQs entregues:** 2/2 (SRV-08, SRV-09)

## Entregue

| Arquivo | Tipo | LOC |
|---|---|---|
| `src/ui/events.js` | Schema + helpers | ~60 |
| `src/ui/port.js` | findFreePort utility | ~55 |
| `src/ui/lockfile.js` | Lockfile module | ~120 |
| `test/unit/ui-events.test.js` | Unit tests | 11 tests |
| `test/unit/ui-port.test.js` | Unit tests | 6 tests |
| `test/unit/ui-lockfile.test.js` | Unit tests | 16 tests |

## Tests

| Antes | Depois | Δ |
|---|---|---|
| 49 unit + 9 integration = 58 | 82 unit + 9 integration = **91** | +33 unit |

## Decisões de implementação relevantes

1. **`validateEvent` é JS puro sem zod** — princípio do PROJECT.md "máx 1 dep nova". Validator manual cobre os mesmos casos críticos (type enum, ts type, payload size, serialização).
2. **`probeStale` aceita `healthzProbe` por DI** — mantém o módulo lockfile.js puro de rede; quem precisar de probe HTTP injeta a função. Phase 13 vai prover ela.
3. **`acquireLockOrReclaim` é o helper recomendado** — `acquireLock` direto é primitivo demais; o helper já cobre o caso "stale" automaticamente.
4. **`crypto.randomBytes(8)` pra runId** — 16 hex chars = 64 bits = colisão astronômica em runs paralelos; o suficiente sem ser overkill.
5. **`net.createServer().listen` retry-loop** em vez de `dgram` ou `lsof` parsing — simples, cross-platform, race aceitável (mitigada upstream).

## Próxima fase

Phase 13 — Servidor HTTP standalone + SSE endpoint.

Vai consumir os 3 módulos:
- `events.makeEvent` no bus interno e em /publish
- `port.findFreePortOrThrow` no startup
- `lockfile.acquireLockOrReclaim` antes de listen
