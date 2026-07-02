// OBS-18-01 / OBS-18-02 — in-memory golden signals for kit-mcp server.
// OBS-19-01 / OBS-19-02 / OBS-19-03 — disk-persistent rolling snapshots.
//
// Phase 94: Eat Your Own Dog Food. The skill `four-golden-signals` says any
// user-facing service worth its salt instruments Latency + Traffic + Errors
// + Saturation. The MCP server qualifies — every tool call is a request from
// an LLM client and tail latency / error rate are exactly the signals an
// operator wants when something feels off.
//
// Scope decisions (see .planning/phases/94-golden-signals-mcp-server/94-CONTEXT.md):
//   - Zero new dependencies. Phase 99 adds fs/promises + path from stdlib only —
//     the 6-deps budget Phase 92.01 fought to maintain and Phase 93.01 enforces
//     in CI is preserved.
//   - In-memory primary, on-demand persistence. The Map+array core stays
//     in-memory; persistSnapshot writes a JSON file under .planning/metrics/
//     snapshots/ when called. No background timer, no implicit writes — the
//     /burn-rate-status command and metrics-snapshot tool are the writers.
//   - Bounded memory. Histograms cap at HISTOGRAM_CAP=1000 samples per tool
//     with FIFO drop.
//   - Bounded disk. cleanupOldSnapshots prunes files > 30 days old on every
//     persistSnapshot call (rolling window, no separate retention job).
//   - Snapshot is read-only. Returns a fresh plain-object copy so callers
//     can JSON.stringify it without exposing internal Map references.
//   - Persisted shape includes `ts` (epoch ms) inside the JSON. We do NOT
//     parse the filename for windowing — filesystem-safe ISO encoding
//     (`replace(/[:.]/g, '-')`) is one-way (cannot reliably round-trip back
//     through Date.parse) and mtime is unreliable across copy/touch. The
//     in-file ts is authoritative.
//
// API surface (5 exports + 2 async):
//   incrementInvocation(tool, status)  — counter++ keyed `${tool}:${status}`
//   recordLatency(tool, ms)            — push to histogram, FIFO at cap
//   snapshot()                         — { counters, latency } plain object
//   reset()                            — clear both maps; called on boot if
//                                         KIT_MCP_METRICS_RESET=1
//   persistSnapshot(rootDir)           — write {ts, counters, latency} to
//                                         .planning/metrics/snapshots/<ts>.json
//                                         + cleanup files > 30d
//   loadSnapshots(rootDir, windowMs)   — read all snapshots whose in-file ts
//                                         is within windowMs (default 30d),
//                                         sorted ascending by ts
//
// Boot-time reset honors the env var by calling reset() at module load when
// the flag is set. This keeps the signal "fresh" for a probe in tests or for
// an operator who spawned the server with the flag for a clean comparison.

import fs from 'node:fs/promises';
import path from 'node:path';

const HISTOGRAM_CAP = 1000;
const DEFAULT_RETENTION_MS = 30 * 86400 * 1000; // 30 days rolling.
const SNAPSHOT_DIR_REL = path.join('.planning', 'metrics', 'snapshots');

const counters = new Map();   // key: `${tool}:${status}` → count (number)
const histograms = new Map(); // key: tool → number[] (length ≤ HISTOGRAM_CAP)

/**
 * Increment the invocation counter for a tool/status pair.
 *
 * @param {string} tool   Tool name as it appears in the MCP request payload.
 * @param {'ok'|'error'} [status='ok']  Outcome of the dispatch.
 * @returns {void}
 */
export function incrementInvocation(tool, status = 'ok') {
  if (typeof tool !== 'string' || tool.length === 0) return;
  const key = `${tool}:${status}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

/**
 * Record an observed latency for a tool. Drops the oldest sample (FIFO) once
 * the per-tool histogram reaches HISTOGRAM_CAP, keeping memory bounded across
 * long-lived MCP sessions.
 *
 * @param {string} tool   Tool name.
 * @param {number} ms     Elapsed wall-clock time in milliseconds.
 * @returns {void}
 */
export function recordLatency(tool, ms) {
  if (typeof tool !== 'string' || tool.length === 0) return;
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
  let arr = histograms.get(tool);
  if (!arr) {
    arr = [];
    histograms.set(tool, arr);
  }
  arr.push(ms);
  if (arr.length > HISTOGRAM_CAP) arr.shift(); // FIFO drop oldest sample
}

/**
 * Compute a percentile over a sorted ascending array. Linear-interpolation
 * variant matches the typical Prometheus / Datadog reading. For N≤1000
 * (HISTOGRAM_CAP) the sort cost on snapshot is acceptable — snapshots are
 * read on-demand by the metrics-snapshot tool, not on every dispatch.
 *
 * @param {number[]} sorted  Ascending-sorted samples.
 * @param {number} p         Percentile in [0, 1].
 * @returns {number}
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/**
 * Build a read-only snapshot of all metrics. Counters are returned as a plain
 * object keyed `${tool}:${status}` → count. Latency is keyed by tool to a
 * `{ p50, p95, p99, count }` triple so a single tool never appears split
 * across status outcomes (latency observation point is a single line in the
 * dispatcher, success and failure both record).
 *
 * @returns {{
 *   counters: Record<string, number>,
 *   latency:  Record<string, { p50: number, p95: number, p99: number, count: number }>
 * }}
 */
export function snapshot() {
  const out = { counters: {}, latency: {} };
  for (const [key, val] of counters) out.counters[key] = val;
  for (const [tool, samples] of histograms) {
    if (samples.length === 0) continue;
    const sorted = [...samples].sort((a, b) => a - b);
    out.latency[tool] = {
      p50: percentile(sorted, 0.50),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      count: samples.length,
    };
  }
  return out;
}

/**
 * Clear both counters and histograms. Used by tests and by the boot-time
 * KIT_MCP_METRICS_RESET=1 path so an operator can probe a fresh window.
 *
 * @returns {void}
 */
export function reset() {
  counters.clear();
  histograms.clear();
}

/**
 * OBS-19-01 — Persist the current snapshot to disk under
 * `<rootDir>/.planning/metrics/snapshots/<timestamp>.json`. Runs the rolling
 * cleanup of files older than `retentionMs` (default 30d) on every call so
 * callers don't need a separate retention job.
 *
 * The on-disk shape is `{ ts: <epoch_ms>, counters, latency }`. The `ts` field
 * inside the JSON — NOT the filename — is the authoritative timestamp for
 * loadSnapshots windowing. The filename uses an ISO encoding with `:` and `.`
 * replaced by `-` for filesystem safety; that encoding is one-way (cannot
 * round-trip back through Date.parse), so we never parse it for ordering.
 *
 * @param {string} [rootDir=process.cwd()]  Project root. Snapshots land under
 *   `<rootDir>/.planning/metrics/snapshots/`.
 * @param {object} [opts]
 * @param {number} [opts.retentionMs]  Override the rolling-window age in ms.
 *   Defaults to 30 days. Tests use shorter windows to drive the cleanup path.
 * @returns {Promise<{file: string, snap: {ts: number, counters: object, latency: object}}>}
 */
export async function persistSnapshot(rootDir = process.cwd(), opts = {}) {
  const retentionMs = Number.isFinite(opts.retentionMs) ? opts.retentionMs : DEFAULT_RETENTION_MS;
  const dir = path.join(rootDir, SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  const ts = Date.now();
  const snap = { ts, ...snapshot() };
  // Filesystem-safe ISO encoding — Windows forbids `:` in paths and `.` is
  // ambiguous with extension separators on shells with brace expansion.
  const isoSafe = new Date(ts).toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${isoSafe}.json`);
  await fs.writeFile(file, JSON.stringify(snap, null, 2));
  await cleanupOldSnapshots(dir, retentionMs);
  return { file, snap };
}

/**
 * OBS-19-02 — Load all snapshots from disk whose in-file `ts` is within the
 * sliding window. Returns the array sorted ascending by `ts` so consumers
 * (`/burn-rate-status`) can compute first-vs-last deltas without re-sorting.
 *
 * Defensive against malformed JSON: a corrupt file is skipped silently rather
 * than aborting the whole load. The 30d window is rolling from "now" — pass a
 * smaller value to drive recent-only views (e.g. `60 * 60 * 1000` for last
 * hour) when computing burn rate over a baseline window.
 *
 * @param {string} [rootDir=process.cwd()]  Project root.
 * @param {number} [windowMs]  Sliding window in ms. Defaults to 30 days.
 * @returns {Promise<Array<{ts: number, counters: object, latency: object}>>}
 *   Empty array if the snapshots directory does not exist.
 */
export async function loadSnapshots(rootDir = process.cwd(), windowMs = DEFAULT_RETENTION_MS) {
  const dir = path.join(rootDir, SNAPSHOT_DIR_REL);
  const cutoff = Date.now() - windowMs;
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return []; // Dir absent on first run — not an error.
  }
  const results = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, f), 'utf-8');
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed?.ts) && parsed.ts >= cutoff) {
        results.push(parsed);
      }
    } catch {
      // Corrupt file — skip silently rather than break the whole burn-rate
      // calculation. A future phase can surface counts via a doctor probe.
    }
  }
  return results.sort((a, b) => a.ts - b.ts);
}

/**
 * OBS-19-03 — Internal helper: delete snapshot files older than `maxAgeMs`.
 * Called from persistSnapshot on every write so retention is implicit.
 * Uses fs.stat().mtimeMs as the age proxy; we accept the small drift versus
 * the in-file `ts` because cleanup is best-effort eviction, not authoritative
 * windowing (loadSnapshots reads the in-file ts).
 *
 * @param {string} dir         Absolute path to the snapshots directory.
 * @param {number} maxAgeMs    Files with mtime older than this are unlinked.
 * @returns {Promise<void>}
 */
async function cleanupOldSnapshots(dir, maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const fp = path.join(dir, f);
    try {
      const stat = await fs.stat(fp);
      if (stat.mtimeMs < cutoff) await fs.unlink(fp);
    } catch {
      // Unlink can race with concurrent cleanup; ignore ENOENT and friends.
    }
  }
}

// Boot-time reset honors KIT_MCP_METRICS_RESET=1. We call reset() instead of
// merely skipping init because the maps are already empty at module load —
// the call is a no-op today but documents the contract for any future module
// that imports metrics.js after another module has already populated state.
if (process.env.KIT_MCP_METRICS_RESET === '1') {
  reset();
}

// Exported for tests only — keeps the API surface explicit while letting unit
// tests assert on the FIFO behavior at the boundary.
export const __TEST_HISTOGRAM_CAP = HISTOGRAM_CAP;
export const __TEST_SNAPSHOT_DIR_REL = SNAPSHOT_DIR_REL;
