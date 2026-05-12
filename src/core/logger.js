// src/core/logger.js — JSONL append-only logger with date-based rotation.
//
// Phase 158 (v1.28): every MCP tool invocation is appended to
//   ~/.kit-mcp/logs/kit-mcp-YYYY-MM-DD.log
// as a single JSON line per event. Files are rotated by calendar day; on the
// first write of a new day, old files past the retention horizon are deleted.
//
// Discipline:
//   - Async fire-and-forget — must never block the MCP request handler.
//   - File-only — never writes to stdout (MCP spec) and stderr only on
//     last-resort init failure.
//   - Cross-platform — uses os.homedir(), path.join, never POSIX-only ops.
//
// Retention is read from KIT_MCP_LOG_RETENTION_DAYS (integer, default 7).
// Set to 0 to disable rotation/cleanup entirely (keep forever).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = process.env.KIT_MCP_LOG_DIR
  || path.join(os.homedir(), '.kit-mcp', 'logs');

function retentionDays() {
  const raw = process.env.KIT_MCP_LOG_RETENTION_DAYS;
  if (raw === undefined || raw === '') return 7;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

function todayStamp(d = new Date()) {
  // YYYY-MM-DD in local time. Rotation key — must stay stable within a day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentLogPath() {
  return path.join(LOG_DIR, `kit-mcp-${todayStamp()}.log`);
}

export function logDir() {
  return LOG_DIR;
}

let initDone = false;
let initFailed = false;

function ensureDir() {
  if (initDone) return !initFailed;
  initDone = true;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    return true;
  } catch (e) {
    initFailed = true;
    // Last-resort signal to operator; stderr is allowed (stdout would corrupt
    // the MCP transport).
    try { console.error(`[kit-mcp logger] failed to create ${LOG_DIR}: ${e.message}`); } catch { /* noop */ }
    return false;
  }
}

let lastRotationCheck = '';

function rotateIfNeeded() {
  const today = todayStamp();
  if (lastRotationCheck === today) return;
  lastRotationCheck = today;

  const keep = retentionDays();
  if (keep === 0) return; // keep forever

  try {
    const entries = fs.readdirSync(LOG_DIR);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keep);
    const cutoffStamp = todayStamp(cutoff);
    for (const name of entries) {
      const m = name.match(/^kit-mcp-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!m) continue;
      if (m[1] < cutoffStamp) {
        try { fs.unlinkSync(path.join(LOG_DIR, name)); } catch { /* swallow */ }
      }
    }
  } catch { /* swallow */ }
}

// logEvent(event) — append one JSON line. Synchronous write to a file handle
// is cheap (~µs) and avoids losing events if the process exits right after.
// All fields except `ts` are caller-supplied; we add `ts` ISO 8601.
export function logEvent(event) {
  if (!ensureDir()) return;
  rotateIfNeeded();
  const enriched = { ts: new Date().toISOString(), pid: process.pid, ...event };
  try {
    fs.appendFileSync(currentLogPath(), JSON.stringify(enriched) + '\n', 'utf8');
  } catch { /* swallow — logging must never break the caller */ }
}

// listLogs() — returns absolute paths of available log files, most recent first.
export function listLogs() {
  if (!ensureDir()) return [];
  try {
    return fs.readdirSync(LOG_DIR)
      .filter((n) => /^kit-mcp-\d{4}-\d{2}-\d{2}\.log$/.test(n))
      .sort((a, b) => b.localeCompare(a))
      .map((n) => path.join(LOG_DIR, n));
  } catch {
    return [];
  }
}

// tailLogs({lines, follow, onLine}) — reads the last N lines across files,
// optionally tailing forever (writes to onLine as new lines arrive). Returns
// a `stop()` function when follow=true; otherwise resolves after initial read.
export function tailLogs({ lines = 50, follow = false, onLine } = {}) {
  if (!onLine) throw new Error('tailLogs requires onLine callback');

  const files = listLogs();
  // Walk from oldest-relevant forward to collect last N lines. Approximation:
  // read latest file, if it has < N lines, also read the previous one, etc.
  const collected = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const fileLines = content.split('\n').filter(Boolean);
      collected.unshift(...fileLines);
    } catch { /* skip unreadable */ }
    if (collected.length >= lines) break;
  }
  const tail = collected.slice(-lines);
  for (const line of tail) onLine(line);

  if (!follow) return { stop: () => {} };

  // Naive follow: poll the current-day file every 250ms for new bytes.
  let offset = 0;
  try {
    const cur = currentLogPath();
    if (fs.existsSync(cur)) offset = fs.statSync(cur).size;
  } catch { /* ignore */ }
  let stopped = false;
  const interval = setInterval(() => {
    if (stopped) return;
    try {
      const cur = currentLogPath();
      if (!fs.existsSync(cur)) return;
      const stat = fs.statSync(cur);
      if (stat.size <= offset) return;
      const fd = fs.openSync(cur, 'r');
      const buf = Buffer.alloc(stat.size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      fs.closeSync(fd);
      offset = stat.size;
      const text = buf.toString('utf8');
      for (const line of text.split('\n')) {
        if (line) onLine(line);
      }
    } catch { /* swallow */ }
  }, 250);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}
