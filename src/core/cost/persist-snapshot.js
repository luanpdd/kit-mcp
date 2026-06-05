// Phase 172 — persist cost snapshots (opt-in, mirror de src/core/metrics.js).
//
// Quando uma tool/CLI for chamada com `persist:true`, grava o output em
// `<rootDir>/.planning/costs/<ts>.json`. Default off — não polui o disco
// silenciosamente.
//
// Mirror do contrato de metrics.js:
//   - persistSnapshot(rootDir, snap, opts?) → grava + retorna { file, snap }.
//   - loadSnapshots(rootDir, windowMs?) → lê + ordena ascendente por ts.
//   - cleanup automático >30d na escrita (rolling, sem retention job).
//
// Falha graceful: se mkdir/EACCES/EROFS, retorna `{ file: null, snap, warning }`
// — NÃO joga exceção pra dentro da tool.
//
// Diferença vs metrics.js: aqui o `snap` é o output cru da tool cost-*,
// que JÁ contém `ts`/`date`/etc. Não injetamos campos. O envelope salvo é
// `{ ts, tool, snap }` com `ts = Date.now()` no momento da gravação +
// nome da tool pra facilitar consulta retroativa.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_RETENTION_MS = 30 * 86400 * 1000;
const SNAPSHOT_DIR_REL = path.join('.planning', 'costs');

/**
 * @param {string} rootDir
 * @param {object} snap          output da tool cost-*
 * @param {{ tool?: string, retentionMs?: number, now?: number }} [opts]
 * @returns {Promise<{ file: string|null, snap: object, warning?: string }>}
 */
export async function persistSnapshot(rootDir, snap, opts = {}) {
  const root = rootDir || process.cwd();
  const retentionMs = Number.isFinite(opts.retentionMs) ? opts.retentionMs : DEFAULT_RETENTION_MS;
  const tool = typeof opts.tool === 'string' ? opts.tool : 'unknown';
  const ts = typeof opts.now === 'number' ? opts.now : Date.now();
  const dir = path.join(root, SNAPSHOT_DIR_REL);
  const envelope = { ts, tool, snap };

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    return { file: null, snap, warning: `mkdir_failed:${errCode(err)}` };
  }

  const isoSafe = new Date(ts).toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${isoSafe}-${tool}.json`);
  try {
    await fs.writeFile(file, JSON.stringify(envelope, null, 2));
  } catch (err) {
    return { file: null, snap, warning: `write_failed:${errCode(err)}` };
  }

  // Cleanup best-effort.
  try {
    await cleanupOldSnapshots(dir, retentionMs);
  } catch {
    // ignore — cleanup é eviction, não windowing autoritativo.
  }

  return { file, snap };
}

/**
 * @param {string} rootDir
 * @param {number} [windowMs]
 * @returns {Promise<Array<{ts:number, tool:string, snap:object}>>}
 */
export async function loadSnapshots(rootDir, windowMs = DEFAULT_RETENTION_MS) {
  const root = rootDir || process.cwd();
  const dir = path.join(root, SNAPSHOT_DIR_REL);
  const cutoff = Date.now() - windowMs;
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, f), 'utf-8');
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed?.ts) && parsed.ts >= cutoff) {
        out.push(parsed);
      }
    } catch {
      // corrupt — skip silently (mirror de metrics.js).
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/**
 * @param {string} dir
 * @param {number} maxAgeMs
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
      // ignore
    }
  }
}

function errCode(err) {
  return err && /** @type {NodeJS.ErrnoException} */ (err).code ? err.code : 'unknown';
}

export const __TEST_SNAPSHOT_DIR_REL = SNAPSHOT_DIR_REL;
