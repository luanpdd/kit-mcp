// src/mcp-server/roots.js — MCP `roots` capability consumer.
//
// Phase 166 (v1.29). The MCP spec lets clients (hosts like Claude Code,
// Cursor) declare workspace roots via `roots/list`. Servers can query this
// to learn the project directory without guessing from `process.cwd()`.
//
// Flow:
//   1. Server declares capability `roots: { listChanged: true }` on init.
//   2. After `initialized` notification, server sends `roots/list` request.
//   3. Cache the response in memory.
//   4. Listen for `notifications/roots/list_changed` to refresh cache.
//
// Discipline:
//   - Failures are silent — fallback to process.cwd() if host doesn't support.
//   - Cache survives the session; not persisted to disk.
//   - No side effects (the auto-sync that USES the roots lives in another module).

import { ListRootsRequestSchema, RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';

// Module-level cache. Keyed by server instance via closure in attachRootsCapability.
let cachedRoots = null;
let supportLevel = 'unknown'; // 'supported' | 'unsupported' | 'unknown'

/**
 * Convert a file:// URI to a local filesystem path. Returns null if invalid.
 * @param {string} uri
 */
function uriToPath(uri) {
  if (typeof uri !== 'string') return null;
  if (!uri.startsWith('file://')) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

/**
 * Request roots/list from the connected client. Caches the result.
 * Returns array of {uri, name, path} entries, or [] on failure.
 * @param {import('@modelcontextprotocol/sdk/server/index.js').Server} server
 */
export async function fetchRoots(server) {
  try {
    const result = await server.request(
      { method: 'roots/list' },
      // The SDK validates the response shape with this schema
      // eslint-disable-next-line no-undef
      // @ts-ignore — runtime-only import shape
      undefined,
    );
    // Defensive: SDK may return either {roots: [...]} or the bare array depending on version
    const roots = Array.isArray(result?.roots) ? result.roots
      : Array.isArray(result) ? result
      : [];
    const normalized = roots.map((r) => ({
      uri: r.uri,
      name: r.name,
      path: uriToPath(r.uri),
    })).filter((r) => r.path);
    cachedRoots = normalized;
    supportLevel = 'supported';
    return normalized;
  } catch (e) {
    // Client doesn't support roots, or returned an error.
    supportLevel = 'unsupported';
    cachedRoots = [];
    return [];
  }
}

/**
 * Attach roots capability handlers to the server. Must be called BEFORE
 * server.connect(). Sets up the list_changed listener so cache stays fresh.
 * @param {import('@modelcontextprotocol/sdk/server/index.js').Server} server
 */
export function attachRootsCapability(server) {
  // Listen for client telling us roots changed — invalidate cache.
  server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
    // Re-fetch on next access via fetchRoots(). Mark cache stale.
    cachedRoots = null;
    // Eager refresh — best-effort.
    try { await fetchRoots(server); } catch { /* swallow */ }
  });
}

/**
 * Get the currently-cached roots, or trigger a fetch if not yet cached.
 * Returns array of {uri, name, path}.
 * @param {import('@modelcontextprotocol/sdk/server/index.js').Server} server
 */
export async function getRoots(server) {
  if (cachedRoots !== null) return cachedRoots;
  return await fetchRoots(server);
}

/**
 * Get the primary project root path. Falls back to process.cwd() if no
 * roots were declared by the client. Synchronous accessor for use AFTER
 * fetchRoots() has been called at least once.
 */
export function getPrimaryProjectRoot() {
  if (cachedRoots && cachedRoots.length > 0) {
    return cachedRoots[0].path;
  }
  return process.cwd();
}

/**
 * Diagnostic helper — exposes whether host declared roots support.
 * Values: 'supported' | 'unsupported' | 'unknown'.
 */
export function getRootsSupportLevel() {
  return supportLevel;
}

/**
 * Reset state. Test helper only.
 */
export function __resetForTests() {
  cachedRoots = null;
  supportLevel = 'unknown';
}
