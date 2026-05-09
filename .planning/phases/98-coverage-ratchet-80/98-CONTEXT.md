# Phase 98: Coverage Ratchet 75→80% - Contexto

**Coletado:** 2026-05-09
**Modo:** Auto-gerado

<domain>
**INFRA-19-01:** Subir threshold ci.yml 75 → 80%. Endereçar 2 hot files que ficaram nos 50s% pós-Phase 97:
- `src/ui/auto-spawn.js`: 56.64% → ≥75%
- `src/cli/index.js`: 55.26% → ≥70%

</domain>

<decisions>
### Restrições
- Stable API v1.0+.
- Phase 79-97 invariants preservados.
- Zero deps novas.

### Files

- `test/unit/auto-spawn-paths.test.js` (NEW) — spawn fallback, lockfile race, port allocation edge cases.
- `test/unit/cli-subcommands.test.js` (NEW) — kit doctor partial, kit ui open sem sidecar, kit gates error paths.
- `.github/workflows/ci.yml` — bump THRESHOLD 75 → 80.

### Approach

1. Run `node --experimental-test-coverage --test test/unit/*.test.js` para baseline.
2. Identify uncovered hot paths em ambos files.
3. Write tests específicos.
4. Re-run coverage. Se ≥80%, bump threshold. Se 78-79%, threshold=78 com ratchet doc.

</decisions>
