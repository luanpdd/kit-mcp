// upgrade-check.js — non-blocking check for newer kit-mcp on npm.
//
// Both `kit doctor` (U1) and `kit ui start` (U4) call this. Result is cached
// to ~/.kit-mcp/version-check.json for 24h so we don't hit the npm registry on
// every boot. Falls back gracefully when offline or when the request fails.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_NAME = '@luanpdd/kit-mcp';
const CHECK_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REQUEST_TIMEOUT_MS = 1500;

function cacheFile() {
  return path.join(os.homedir(), '.kit-mcp', 'version-check.json');
}

async function readCache() {
  try {
    const raw = await fs.readFile(cacheFile(), 'utf8');
    const obj = JSON.parse(raw);
    if (typeof obj.checkedAt !== 'number' || typeof obj.latest !== 'string') return null;
    if (Date.now() - obj.checkedAt > CHECK_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

async function writeCache(obj) {
  try {
    await fs.mkdir(path.dirname(cacheFile()), { recursive: true });
    await fs.writeFile(cacheFile(), JSON.stringify(obj), 'utf8');
  } catch {
    /* cache failures are silent — not critical */
  }
}

function fetchLatest() {
  // Use the registry's package endpoint. Falls back to gracefully on any error.
  return new Promise((resolve) => {
    const req = https.request({
      method: 'GET',
      hostname: 'registry.npmjs.org',
      path: `/${encodeURIComponent(PACKAGE_NAME)}/latest`,
      headers: { 'accept': 'application/json' },
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve(typeof j.version === 'string' ? j.version : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { try { req.destroy(); } catch { /* noop */ } resolve(null); });
    req.end();
  });
}

export async function getLocalVersion() {
  // Read package.json from the kit-mcp install root (parent of src/).
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const raw = await fs.readFile(pkgPath, 'utf8');
    const j = JSON.parse(raw);
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}

// Compare semver-like x.y.z lexically by component. Returns -1/0/1.
// Missing components default to 0 ("1.5" === "1.5.0").
function compareVersions(a, b) {
  const parse = (v) => {
    const parts = v.split('.').map((n) => Number.parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

// checkUpgrade({ force }): returns { local, latest, behind, source } or null on failure.
//   force=true bypasses the 24h cache.
export async function checkUpgrade({ force = false } = {}) {
  const local = await getLocalVersion();
  if (!local) return null;

  if (!force) {
    const cached = await readCache();
    if (cached?.latest) {
      return {
        local,
        latest: cached.latest,
        behind: compareVersions(local, cached.latest) < 0,
        source: 'cache',
      };
    }
  }

  const latest = await fetchLatest();
  if (!latest) {
    // Network failed; surface what we have.
    return { local, latest: null, behind: false, source: 'offline' };
  }

  await writeCache({ checkedAt: Date.now(), latest });
  return {
    local,
    latest,
    behind: compareVersions(local, latest) < 0,
    source: 'network',
  };
}

export const __test = { compareVersions, PACKAGE_NAME, CHECK_TTL_MS };
