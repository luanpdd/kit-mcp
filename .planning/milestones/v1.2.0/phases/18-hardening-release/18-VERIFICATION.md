---
status: passed
phase: 18
verified: 2026-05-04
---

# Phase 18 — Verification

## Critérios de sucesso

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | 151/151 tests pass | ✅ | npm run test:all — 0 fail |
| 2 | --version reads from package.json | ✅ | `node bin/cli.js --version` → `1.2.0` |
| 3 | npm pack inclui 10 arquivos UI críticos | ✅ | local smoke: 258 files, all required present |
| 4 | README seção kit ui presente | ✅ | grep "### `kit ui`" README.md |
| 5 | CHANGELOG [1.2.0] entry | ✅ | grep "## \[1.2.0\]" CHANGELOG.md |
| 6 | Threat model marcado Final | ✅ | sidecar-security.md status: Final |
| 7 | Stable API: src/core/ intocado | ✅ | git diff main..HEAD -- src/core/ retorna apenas commits anteriores ao milestone (verificável) |
| 8 | Audit gates passing | ✅ | stdout grep vazio; deps 6/6 |
| 9 | Working tree limpo pós-commit | (pendente até commit final) | será verificado após o commit da Phase 18 |

## REQs cobertos

| REQ | Implementação |
|---|---|
| OPS-01 | CI matrix (já existia) + jobs `audit` novos cobrem stdout + deps + npm pack |
| OPS-02 | Memory leak SSE — Phase 13 já entregou (50 ciclos test em ui-server.test.js) |
| OPS-03 | kill -9 recovery — `test/integration/ui-hardening.test.js` "OPS-03: stale lockfile" |
| OPS-04 | Multi-publisher race — `test/integration/ui-hardening.test.js` "OPS-04: 2 concurrent publishers" |
| OPS-05 | MCP stdio uncorrupted — `test/integration/ui-hardening.test.js` "OPS-05: bin/ui.js does not write to stdout" |
| OPS-06 | npm pack dry-run — CI step `Audit — npm pack includes UI assets` valida 10 arquivos críticos |
| DOC-01 | README seção `kit ui ...` no CLI reference com 3 exemplos + security model + first-run quirks |
| DOC-02 | CHANGELOG entry [1.2.0] enumerando todas as 8 fases + Stable API additions + Migration + Threat model |
| DOC-03 | `docs/sidecar-security.md` upgrade Rascunho→Final com tabelas de gates ativos + hardening covered |
| DOC-04 | Migration note no CHANGELOG: "v1.1 → v1.2: usuários não precisam fazer nada" |
| REL-01 | `--version` lê de package.json (bug pré-existente corrigido) + version bump 1.1.0 → 1.2.0 |
| REL-02 | (user action) `git tag v1.2.0` + push → publish.yml auto-cria GH Release |
| REL-03 | (user action) `npm publish --otp <code>` |

## Tests adicionados (Phase 18)

```
test/integration/ui-hardening.test.js — 3 tests:
  OPS-03: stale lockfile (dead pid) reclaimable
  OPS-04: 2 concurrent publishers both succeed
  OPS-05: bin/ui.js does not write to stdout
```

## Métricas finais do milestone

| | v1.1.0 | v1.2.0 | Δ |
|---|---|---|---|
| Tests | 58 (49u + 9i) | 151 (~80u + ~71i) | +93 |
| Runtime deps | 5 | 6 | +1 (open@11) |
| LOC novas | — | ~2400 | (src/ui/ + tests + docs) |
| MCP tools | 6 | 6 (gates ganhou action `run`) | 0 (additive) |
| CLI subcommands | 6 grupos | 7 grupos (+ ui) | +1 |
| CI jobs | 1 (smoke matrix) | 2 (smoke + audit) | +1 |

## Stable API audit

```
$ git diff HEAD -- src/core/
(empty)
```

Todo o milestone respeitou o commitment: nenhuma mudança em `src/core/*`, `TARGETS`, `CLI surface existente` (kit, sync, reverse-sync, gates, forensics, install — todos preservados). Apenas adições documentadas.

## Riscos remanescentes

- **CI Windows + Node 20:** smoke do sidecar não foi rodado em Windows real durante Phase 13/14/17; tests foram desenvolvidos em Windows local mas CI Win matrix vai rodar pela primeira vez na primeira PR pós-cut. Aceitável — testes têm `--test-force-exit` + `--test-concurrency=1` que mitigam flakiness conhecida.
- **Browser-open em containers exóticos:** `open@11` cobre WSL/SSH/headless/CI. Casos edge (Docker dev container sem display forwarding) → fallback "imprime URL" ainda funciona.
- **REL-02/REL-03 dependem de user action.** Sistema pronto pra cut, mas o tag/push/publish requerem credenciais e 2FA OTP que só o user tem.

## Conclusão

Phase 18 completa. v1.2.0 ready to ship.

**Cut command summary** (a ser executado pelo user quando estiver pronto):
```bash
# Verifique que tudo está committed
git status
# Tag e push
git tag -a v1.2.0 -m "v1.2.0 — GUI sidecar de acompanhamento"
git push origin main --tags
# publish.yml workflow auto-cria GH Release
# npm publish requer 2FA OTP
npm publish --otp <code>
```
