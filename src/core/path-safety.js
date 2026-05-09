// SEC-14-03: validate that a projectRoot supplied via MCP message points to a
// real git workspace before any handler that writes to disk dispatches into
// sync.js / reverse-sync.js.
//
// The helper is intentionally pure (no throw): MCP handlers package errors as
// `{ error: <string> }` envelopes (see src/mcp-server/index.js handleSync,
// handleGates, handleForensics — all use the same shape). Returning a discriminated
// `{ ok, ...}` lets each caller decide between an envelope error or a CLI exit
// without try/catch boilerplate.
//
// Why a directory-existence + walk-up `.git/` check (and not, say, spawning
// `git rev-parse --show-toplevel`):
//   - Heuristic is good enough for our threat model. The attacker we are blocking
//     is "MCP message says projectRoot=\\evil-host\share or %APPDATA%". Both fail
//     the existence-or-`.git`-ancestor test trivially.
//   - No child_process means no dependency on `git` being on PATH at runtime, no
//     spawn latency on the hot path of every tool call, and no risk of the spawned
//     git itself reading config from an attacker-influenced cwd.
//   - The walk-up loop is bounded — Windows roots terminate at `D:\`, POSIX at
//     `/`, and `path.dirname(cur) === cur` is the universal fixed point. Typical
//     workspaces have <8 levels to a `.git/`, so a stat per level is fine.
//
// CLI does NOT call this — `bin/cli.js` trusts whoever invoked it (same trust
// model as Phase 79.01's gates.run guard).

import path from 'node:path';
import fs from 'node:fs/promises';

// All rejection reasons embed the literal "git workspace" — MCP clients (and
// our own regression tests) match on that single sentinel regardless of which
// check fired. Keeping the wording uniform means callers don't have to maintain
// six regexes; one suffices.
const SENTINEL = 'MCP sync requires projectRoot to be a git workspace';

export async function validateProjectRoot(projectRoot) {
  // Reject empty / nullish up-front. We require an explicit projectRoot from
  // MCP messages — falling back to `process.cwd()` of the MCP server would let
  // an attacker probe wherever the server happened to be launched.
  if (projectRoot === undefined || projectRoot === null || projectRoot === '') {
    return {
      ok: false,
      reason: SENTINEL + '; got <empty> (pass an absolute path to a git workspace)',
    };
  }
  if (typeof projectRoot !== 'string') {
    return {
      ok: false,
      reason: SENTINEL + '; got non-string projectRoot of type ' + typeof projectRoot,
    };
  }

  // path.resolve normalises separators and collapses `..` segments so a later
  // attacker payload like `C:\Users\\..\evil` is reduced before the existence
  // check happens. resolve() is also a no-op on already-absolute paths.
  const resolved = path.resolve(projectRoot);

  // Defensive — path.resolve should always return absolute, but if a future
  // Node version changes that we still want to reject.
  if (!path.isAbsolute(resolved)) {
    return {
      ok: false,
      reason: SENTINEL + '; projectRoot did not resolve to an absolute path: ' + projectRoot,
    };
  }

  // The stat doubles as an existence + reachability check. UNC paths to
  // unreachable hosts (`\\evil-host\share`) reject here on Windows with ENOENT
  // / EHOSTUNREACH within milliseconds; Node treats both as a rejection so we
  // never proceed to write a single byte.
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return {
      ok: false,
      reason: SENTINEL + '; projectRoot does not exist or is unreachable: ' + resolved,
    };
  }

  if (!stat.isDirectory()) {
    return {
      ok: false,
      reason: SENTINEL + '; projectRoot must be a directory: ' + resolved,
    };
  }

  // Walk up looking for `.git` (file or directory — `git worktree` uses a file).
  // Bounded by the dirname fixed-point check so this terminates on every OS.
  let cur = resolved;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.stat(path.join(cur, '.git'));
      return { ok: true, resolvedPath: resolved };
    } catch {
      // not here — keep walking up
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // No .git/ found anywhere in the chain — the canonical reject. The literal
  // "git workspace" string is part of the public contract — tests
  // (test/unit/mcp-projectroot-guard.test.js) and downstream MCP clients match
  // on it. Don't rephrase without coordinating callers.
  return {
    ok: false,
    reason: SENTINEL + '; got ' + projectRoot,
  };
}
