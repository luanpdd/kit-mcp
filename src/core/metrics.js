// OBS-18-01 / OBS-18-02 — in-memory golden signals for kit-mcp server.
//
// Phase 94: Eat Your Own Dog Food. The skill `four-golden-signals` says any
// user-facing service worth its salt instruments Latency + Traffic + Errors
// + Saturation. The MCP server qualifies — every tool call is a request from
// an LLM client and tail latency / error rate are exactly the signals an
// operator wants when something feels off.
//
// Scope decisions (see .planning/phases/94-golden-signals-mcp-server/94-CONTEXT.md):
//   - Zero dependencies. Map + array stdlib only — preserves the 6-deps budget
//     that Phase 92.01 fought to maintain and that Phase 93.01 enforces in CI.
//   - In-memory only. No file persistence, no socket export, no OTel SDK.
//     kit-mcp is a developer tool launched on demand by an IDE; cross-process
//     telemetry pipelines are explicit non-goals (see <deferred> block in
//     94-CONTEXT.md). A future phase can layer OTel on top of this API.
//   - Bounded memory. Histograms cap at HISTOGRAM_CAP=1000 samples per tool
//     with FIFO drop. At cap, p50/p95/p99 over the latest 1000 samples is
//     more useful than an unbounded array that could grow for the lifetime
//     of a long-lived MCP session.
//   - Snapshot is read-only. Returns a fresh plain-object copy so callers
//     can JSON.stringify it without exposing internal Map references.
//
// API surface (4 exports):
//   incrementInvocation(tool, status)  — counter++ keyed `${tool}:${status}`
//   recordLatency(tool, ms)            — push to histogram, FIFO at cap
//   snapshot()                         — { counters, latency } plain object
//   reset()                            — clear both maps; called on boot if
//                                         KIT_MCP_METRICS_RESET=1
//
// Boot-time reset honors the env var by calling reset() at module load when
// the flag is set. This keeps the signal "fresh" for a probe in tests or for
// an operator who spawned the server with the flag for a clean comparison.

const HISTOGRAM_CAP = 1000;

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
