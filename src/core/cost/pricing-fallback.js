// Phase 172 — pricing fallback via models.dev (opt-in).
//
// Comportamento: quando pricing.js retorna usd=null + model em unknown_models[]
// E o caller passou refresh_pricing:true, esta camada tenta resolver via
// API models.dev. Cache local em ~/.kit-mcp/pricing-cache.json TTL 24h.
//
// Falha graceful: network down, EACCES no cache dir, JSON malformed → log
// stderr + skip. NÃO crashar e NÃO consultar a tool inteira por causa de
// 1 modelo desconhecido.
//
// Endpoint considerado: https://models.dev/api/models/<model>.json
// (estrutura best-effort — se schema mudar, fallback ainda retorna null
// graciosamente).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const DEFAULT_TTL_HOURS = 24;
const CACHE_DIR = path.join(os.homedir(), '.kit-mcp');
const CACHE_FILE = path.join(CACHE_DIR, 'pricing-cache.json');

/**
 * @typedef {Object} CacheEntry
 * @property {number} fetched_at        epoch ms
 * @property {object|null} pricing      null = lookup failed (negative cache)
 */

/**
 * @returns {number} TTL em ms.
 */
function ttlMs() {
  const env = process.env.KIT_MCP_PRICING_CACHE_TTL_HOURS;
  const n = env ? Number(env) : DEFAULT_TTL_HOURS;
  const hours = Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

/**
 * @param {string} [file]
 * @returns {Record<string, CacheEntry>}
 */
function readCache(file = CACHE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, CacheEntry>} cache
 * @param {string} [file]
 * @returns {{ ok: boolean, warning?: string }}
 */
function writeCache(cache, file = CACHE_FILE) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    return { ok: false, warning: `pricing_cache_write_failed:${code || 'unknown'}` };
  }
}

/**
 * @param {string} model
 * @param {{ timeout_ms?: number, fetcher?: (url:string)=>Promise<any> }} [opts]
 * @returns {Promise<object|null>}
 */
async function fetchModelsDev(model, opts = {}) {
  const timeout = opts.timeout_ms || 5000;
  const fetcher = opts.fetcher || ((url) => doFetch(url, timeout));
  const safe = encodeURIComponent(model);
  const url = `https://models.dev/api/models/${safe}.json`;
  try {
    return await fetcher(url);
  } catch {
    return null;
  }
}

async function doFetch(url, timeout) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'kit-mcp-cost-fallback/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resolve um modelo desconhecido via cache → models.dev. Atualiza cache.
 *
 * @param {string} model
 * @param {{ cacheFile?: string, now?: number, fetcher?: (url:string)=>Promise<any>, ttl_ms?: number }} [opts]
 * @returns {Promise<{ pricing: object|null, source: 'cache-hit'|'cache-miss-network'|'cache-miss-network-failed', warnings: string[] }>}
 */
export async function resolveFallback(model, opts = {}) {
  const file = opts.cacheFile || CACHE_FILE;
  const now = opts.now || Date.now();
  const ttl = opts.ttl_ms || ttlMs();
  const warnings = [];
  const cache = readCache(file);
  const cached = cache[model];
  if (cached && (now - cached.fetched_at) < ttl) {
    return { pricing: cached.pricing, source: 'cache-hit', warnings };
  }
  const fresh = await fetchModelsDev(model, { fetcher: opts.fetcher });
  cache[model] = { fetched_at: now, pricing: fresh };
  const write = writeCache(cache, file);
  if (!write.ok && write.warning) warnings.push(write.warning);
  return {
    pricing: fresh,
    source: fresh ? 'cache-miss-network' : 'cache-miss-network-failed',
    warnings,
  };
}

export const __internals = { readCache, writeCache, ttlMs, CACHE_FILE };
