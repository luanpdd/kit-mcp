---
phase: 82-web-surface-hardening
phase_name: Web Surface Hardening
verified_at: 2026-05-09T11:30:00Z
status: passed
score: 15/15 must-haves verified
verifier: verifier (Claude Opus 4.7)
tests_total: 222
tests_pass: 222
tests_fail: 0
tests_skipped: 2
requirements_completed: [SEC-14-01, SEC-14-02]
re_verification: false
---

# Phase 82: Web Surface Hardening — Verification Report

**Phase Goal:** Fechar 2 vulnerabilidades HIGH na surface web do UI sidecar — CSP `'unsafe-inline'` + XSS via SSE; `/shutdown` + `/publish` CSRF same-origin (token auth).

**REQs:** SEC-14-01 (CSP/XSS), SEC-14-02 (auth token)

**Verified:** 2026-05-09T11:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement Summary

Both HIGH vulnerabilities closed end-to-end with proof tests:

- **SEC-14-01 (CSP/XSS):** `'unsafe-inline'` removed from `script-src` (replaced by `'sha256-<hash>='` of inline `<script>` block); defense-in-depth `escapeHtml` audit covers all `innerHTML` interpolation sites (42 occurrences in `index.html`).
- **SEC-14-02 (auth token):** 64-char hex per-process token added to lockfile; `requireAuth` middleware on `/publish`, `/shutdown`, `/events`, `/state`. Transparent handshake — auto-spawn propagates token via `?t=<token>` URL → browser scrubs URL via `history.replaceState` → all client-side fetches use `authedFetch` wrapper.
- **Hook backward-compat:** `kit/hooks/sidecar-tool-publisher.js` v1.14.0 attaches `Authorization: Bearer` while degrading to silent 401-fail when running against pre-v1.14 sidecars.

---

## Observable Truths (15/15 PASS)

| #   | Truth                                                                  | Status     | Evidence                                                                      |
| --- | ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| 1   | `grep "'unsafe-inline'" src/ui/server.js` returns 0 matches in script-src | ✓ VERIFIED | `src/ui/server.js:55` — `script-src ${scriptSrc}` (no unsafe-inline). Only `style-src` keeps it (line 56) — intentional, documented |
| 2   | SSE payload with HTML/script renders as text literal (defense-in-depth) | ✓ VERIFIED | `src/ui/static/index.html` — 42 `escapeHtml` occurrences across `historyRowHtml`, `activeCardHtml`, `rowHtml` |
| 3   | POST /shutdown without token → 401                                     | ✓ VERIFIED | Live HTTP probe: `{"status":401, "body":"{\"error\":\"auth_required\"}"}` |
| 4   | POST /publish without token → 401                                      | ✓ VERIFIED | Live HTTP probe: `{"status":401, "body":"{\"error\":\"auth_required\"}"}` |
| 5   | GET /events without token → 401                                        | ✓ VERIFIED | Live HTTP probe: `{"status":401, "body":"{\"error\":\"auth_required\"}"}` |
| 6   | GET /state without token → 401                                         | ✓ VERIFIED | Live HTTP probe: `{"status":401, "body":"{\"error\":\"auth_required\"}"}` |
| 7   | GET /healthz works without auth                                        | ✓ VERIFIED | Live HTTP probe: `{"status":200, "body":"{\"ok\":true,...}"}` |
| 8   | Lockfile JSON has `token` field (64-char hex)                          | ✓ VERIFIED | `src/ui/lockfile.js:61` — `token: randomBytes(32).toString('hex')` |
| 9   | auto-spawn → browser handshake propagates token transparently          | ✓ VERIFIED | `src/ui/auto-spawn.js:104-105` — `tokenSuffix = lock.token ? '?t=...' : ''` |
| 10  | Browser scrubs URL via `history.replaceState` (no token leak)          | ✓ VERIFIED | `src/ui/static/index.html` — `__sidecarToken` IIFE @ offset 37934 calls `window.history.replaceState(null, "", newUrl)` |
| 11  | `src/ui/client.js publish()` attaches `Authorization: Bearer`          | ✓ VERIFIED | `src/ui/client.js:80` — `...(token ? { 'authorization': 'Bearer ' + token } : {})` |
| 12  | `kit/hooks/sidecar-tool-publisher.js` attaches Bearer + hook v1.14.0   | ✓ VERIFIED | `kit/hooks/sidecar-tool-publisher.js:2` `// hook-version: 1.14.0`; line 195 `Bearer ${token}` |
| 13  | 3 pending tests of Plan 01 reactivated in Plan 02                      | ✓ VERIFIED | `test.skip` count = 0 in `ui-hardening.test.js`/`ui-client.test.js`. OPS-04 + 2 publish tests confirmed reactivated |
| 14  | Suite still passes (222 expected)                                      | ✓ VERIFIED | `node test/run.mjs test/unit && test/integration` → 139+83 = 222 pass, 0 fail, 2 baseline skipped |
| 15  | Race condition fix v1.12.1 preserved in `sidecar-tool-publisher.js`    | ✓ VERIFIED | `kit/hooks/sidecar-tool-publisher.js:201-203` — `res.on('end', resolve); res.on('close', resolve);` |

**Score:** 15/15 truths verified

---

## Required Artifacts

| Artifact                                  | Expected                                          | Exists | Substantive | Wired | Data Flow | Status      |
| ----------------------------------------- | ------------------------------------------------- | ------ | ----------- | ----- | --------- | ----------- |
| `src/ui/server.js`                        | requireAuth + buildCsp + timingSafeEqual          | ✓      | ✓ (548L)    | ✓     | ✓         | ✓ VERIFIED  |
| `src/ui/lockfile.js`                      | randomBytes(32) token                             | ✓      | ✓ (192L)    | ✓     | ✓         | ✓ VERIFIED  |
| `src/ui/auto-spawn.js`                    | tokenSuffix `?t=` propagation                     | ✓      | ✓ (114L)    | ✓     | ✓         | ✓ VERIFIED  |
| `src/ui/static/index.html`                | __sidecarToken + authedFetch + escapeHtml audit   | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |
| `src/ui/client.js`                        | resolveSidecar + Bearer attach + 401 cache evict  | ✓      | ✓ (131L)    | ✓     | ✓         | ✓ VERIFIED  |
| `kit/hooks/sidecar-tool-publisher.js`     | readSidecarLock + Bearer + hook-version 1.14.0    | ✓      | ✓ (211L)    | ✓     | ✓         | ✓ VERIFIED  |
| `test/integration/ui-hardening.test.js`   | 9 SEC-14 + 3 SEC-14-02 prop + OPS-04 reactivated  | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |
| `test/integration/ui-server.test.js`      | withServer captures token; fetch helper {token}   | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |
| `test/integration/ui-client.test.js`      | 2 publish tests reactivated                       | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |
| `test/integration/ui-static.test.js`      | authedFetch + authedEventSourceUrl assertions     | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |
| `test/integration/ui-auto-spawn.test.js`  | unchanged (no protected endpoint touch)           | ✓      | ✓           | ✓     | ✓         | ✓ VERIFIED  |

---

## Key Link Verification

| From                                      | To                                                | Via                                              | Status     |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | ---------- |
| `src/ui/server.js` (requireAuth)          | `src/ui/lockfile.js` (acquireLock token)          | `start()` copies `lockMeta.token` → `authToken`  | ✓ WIRED    |
| `src/ui/server.js` (handleIndex)          | `src/ui/static/index.html`                        | `computeScriptHashFromHtml` SHA-256              | ✓ WIRED    |
| `src/ui/static/index.html` (innerHTML)    | `escapeHtml()` helper                             | 42 escapeHtml call sites                         | ✓ WIRED    |
| `src/ui/auto-spawn.js` (ensureSidecar)    | `src/ui/browser.js` (openBrowser)                 | URL `http://...:${port}/?t=${lock.token}`        | ✓ WIRED    |
| `src/ui/client.js` (publish)              | `src/ui/lockfile.js` (readLock)                   | `resolveSidecar` reads `lock.token`              | ✓ WIRED    |
| `kit/hooks/sidecar-tool-publisher.js`     | POST /publish via http.request                    | `readSidecarLock` + `Bearer ${token}`            | ✓ WIRED    |
| `src/ui/static/index.html` (fetch)        | `/state`, `/events` protected endpoints           | `authedFetch` + `authedEventSourceUrl` wrappers  | ✓ WIRED    |

**All key links wired.** No orphan artifacts; no missing connections.

---

## Behavioral Spot-Checks (Live HTTP Probes)

Probes executed against live `createServer` instance on ephemeral port:

| Behavior                                  | Command                                                    | Result                              | Status |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------- | ------ |
| POST /shutdown without auth → 401         | `http.request POST /shutdown`                              | `{"status":401,"body":"{\"error\":\"auth_required\"}"}` | ✓ PASS |
| POST /publish without auth → 401          | `http.request POST /publish`                               | `{"status":401,"body":"{\"error\":\"auth_required\"}"}` | ✓ PASS |
| GET /events without auth → 401            | `http.request GET /events`                                 | `{"status":401,"body":"{\"error\":\"auth_required\"}"}` | ✓ PASS |
| GET /state without auth → 401             | `http.request GET /state`                                  | `{"status":401,"body":"{\"error\":\"auth_required\"}"}` | ✓ PASS |
| GET /healthz without auth → 200           | `http.request GET /healthz`                                | `{"status":200,"body":"{\"ok\":true,...}"}` | ✓ PASS |
| CSP header on `/` has no unsafe-inline    | inspect `Content-Security-Policy` response header on GET / | `default-src 'self'; connect-src 'self'; script-src 'self' 'sha256-CQELvsXzL9IA/+uUfI5NV1WPgeg2cLU8j2hFXOk60dY='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'` | ✓ PASS |

CSP header decomposed:
- `script-src 'self' 'sha256-...'` — strict, no `unsafe-inline` ✓
- `style-src 'self' 'unsafe-inline'` — intentional (documented; CSS injection has no script vector with `connect-src 'self'`) ✓
- `connect-src 'self'` — XHR/fetch limited to same origin ✓
- `frame-ancestors 'none'` — clickjack-proof ✓

---

## Test Suite Results

| Suite           | Pass | Fail | Skipped | Notes                                                                        |
| --------------- | ---- | ---- | ------- | ---------------------------------------------------------------------------- |
| Unit            | 139  | 0    | 2       | Baseline skips (DRIFT-13-01 awk on Windows)                                  |
| Integration     | 83   | 0    | 0       | All 3 plan-deferred skips reactivated (OPS-04 + 2 publish)                  |
| **Total**       | **222** | **0** | **2** | Matches SUMMARY claim exactly                                              |

**New tests added in Phase 82:**
- 9 SEC-14 regression tests in Plan 01 (`SEC-14-01: CSP without unsafe-inline`, `SEC-14-01: 1 script block invariant`, `SEC-14-02: token field 64 hex`, 4 × 401 scenarios, valid+invalid token round-trip, timingSafeEqual unit)
- 3 SEC-14-02 prop tests in Plan 02 (Bearer attach happy-path, http_401 graceful degradation, 401 cache eviction)
- 3 reactivated tests in Plan 02 (OPS-04 + 2 ui-client tests)
- = **+12 net new active integration tests** (was 71 active before; now 83 active)

---

## Requirements Coverage

| Requirement | Source Plan        | Description                                              | Status      | Evidence                                                                |
| ----------- | ------------------ | -------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| SEC-14-01   | 82-01 + 82-02      | Strict CSP without `'unsafe-inline'` + escapeHtml audit  | ✓ SATISFIED | `script-src 'self' 'sha256-...'`; 42 escapeHtml sites; CSP test passing |
| SEC-14-02   | 82-01 + 82-02      | Per-process auth token + propagation across surfaces     | ✓ SATISFIED | All 4 protected endpoints return 401 without token; full handshake wired auto-spawn → browser → publishers |

No orphaned requirements. ROADMAP's 2 REQs both fully covered.

---

## Anti-Patterns Scan

Scanned files modified during Phase 82 for stub patterns:

| File                                       | Pattern                  | Severity   | Impact                                                          |
| ------------------------------------------ | ------------------------ | ---------- | --------------------------------------------------------------- |
| (none)                                     | TODO/FIXME/placeholder   | -          | Clean — no anti-patterns found in any modified file             |

Specifically checked:
- `src/ui/server.js`: no TODO/FIXME/placeholder; no empty handler stubs; all returns substantive
- `src/ui/lockfile.js`: clean; randomBytes(32) is the real CSPRNG call
- `src/ui/static/index.html` `__sidecarToken` IIFE: real `URLSearchParams`, real `history.replaceState`
- `src/ui/client.js`: real cache logic (TTL, invalidate-on-401)
- `kit/hooks/sidecar-tool-publisher.js`: real `http.request` with proper drain (race-fix preserved)

---

## Commit Verification

All 10 commits referenced in SUMMARYs exist in `git log`:

| Commit    | Phase  | Subject                                                                   |
| --------- | ------ | ------------------------------------------------------------------------- |
| `d7142f6` | 82-01  | feat: add per-process auth token to lockfile (SEC-14-02)                  |
| `aa07e48` | 82-01  | feat: strict CSP — sha256 hash inline `<script>`, no unsafe-inline (SEC-14-01) |
| `2e32529` | 82-01  | feat: requireAuth on /publish /shutdown /events /state (SEC-14-02)        |
| `61419ca` | 82-01  | test: pass token through existing tests; CLI postShutdown uses lock.token |
| `88262e1` | 82-01  | test: add 9 SEC-14 regression tests (CSP + auth + token)                  |
| `0c2cc7c` | 82-01  | fix: defense-in-depth escapeHtml on all dynamic innerHTML fields          |
| `368cf3d` | 82-02  | feat: propagate auth token via ?t= and authed fetch wrappers              |
| `d476631` | 82-02  | feat: client.js publish() reads lock.token + Authorization Bearer         |
| `11a9b9a` | 82-02  | feat: hook sidecar-tool-publisher attaches Bearer (hook v1.14.0)          |
| `ad4b8fb` | 82-02  | test: unskip 3 tests + add 3 token-prop E2E regression tests              |

---

## Race Condition Preservation Audit (v1.12.1 fix)

The v1.12.1 fix in `kit/hooks/sidecar-tool-publisher.js` ensures the hook's `process.exit(0)` doesn't fire before the sidecar's TCP/SSE flush completes. Verified preserved at lines 201-203:

```js
res.resume();
res.on('end', resolve);
res.on('close', resolve);
```

Both `'end'` AND `'close'` listeners present — race condition fix from v1.12.1 carried forward verbatim into the new `publish(port, token, event)` signature. SUMMARY claim verified.

---

## Code Quality Notes

- **Single-script invariant tested:** `index.html` must contain exactly 1 `<script>` block (CSP hash logic depends on this). Test `SEC-14-01: index.html contains exactly one <script> block` enforces this — future regressions caught at CI.
- **Defense-in-depth pattern:** primary defense is browser-enforced strict CSP (no unsafe-inline). Secondary is code-enforced `escapeHtml` (~50ns/call) covering all dynamic interpolation. Both layers present.
- **Constant-time string compare:** `timingSafeEqual` JS impl walks max-length even with diff lengths to prevent timing-leak side channel on token validation. Unit-tested.
- **Fail-closed pattern:** `requireAuth` returns false if `authToken` is null (server boot incomplete). No accidental "open" path.
- **Token TTL = process lifetime:** generated once at `acquireLock`, cleared at `shutdown`. No persistence leak across restarts.
- **Backward compat:** lockfiles without `token` (sidecars pre-v1.14) cause publishers to omit Authorization → server returns 401 → caller soft-fails. No crash, no LOCK_VERSION bump.

---

## Final Verdict

**STATUS: PASSED**

Phase 82 (Web Surface Hardening) achieves both stated goals:

1. **SEC-14-01 closed** — `'unsafe-inline'` removed from `script-src`; CSP enforced via SHA-256 hash; XSS defense-in-depth via `escapeHtml` on all dynamic interpolation sites.
2. **SEC-14-02 closed** — 4 protected endpoints (`/publish`, `/shutdown`, `/events`, `/state`) reject unauthenticated requests with 401; transparent token handshake via lockfile → `?t=` URL → browser closure variable + `authedFetch` wrapper; hook v1.14.0 propagates Bearer with backward-compat soft-fail.

All 15 ROADMAP success criteria verified by combination of code inspection, live HTTP probes, and 222 passing tests (including 12 net-new SEC-14 regression tests). No anti-patterns, no stubs, no orphan artifacts. Race condition fix v1.12.1 preserved.

**Phase 82 is ready for milestone completion (`/concluir-marco` or continuation to Phase 83).**

---

*Verified: 2026-05-09T11:30:00Z*
*Verifier: verifier (Claude Opus 4.7)*
*Phase: 82-web-surface-hardening*
