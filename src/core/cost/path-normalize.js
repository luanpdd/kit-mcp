// Phase 172 (v1.37 cost-tracking) — cross-platform path utilities.
//
// Why this exists: ccusage tem implementação Rust com cross-platform
// "for free" via `std::path`. Aqui em Node precisamos detectar
// process.platform === 'win32' para:
//   1. Split de CLAUDE_CONFIG_DIR (semicolon no Windows, colon em POSIX)
//   2. Conversão path → POSIX para hashing/dedup determinístico
//   3. PID liveness com EPERM no Windows (kill(pid, 0) lança permission
//      denied em processos de outros users → considerar alive=true).
//
// Zero deps. Pure functions exceto isPathAlive (lê syscalls).

import path from 'node:path';
import process from 'node:process';

/**
 * Converte um path para forma POSIX (slashes /), preservando drive letter no
 * Windows como `c:/Users/...`. Útil para gerar chaves estáveis em dedup,
 * porque o mesmo arquivo descoberto via `~/.claude` no WSL e via
 * `C:\Users\...` no Windows native gera a mesma chave após normalize.
 *
 * @param {string} p
 * @returns {string}
 */
export function toPosix(p) {
  if (typeof p !== 'string') return '';
  return p.replace(/\\/g, '/');
}

/**
 * Splita o env var CLAUDE_CONFIG_DIR com separador correto por plataforma.
 * Windows: `';'` (mesmo que PATH). POSIX: `':'`.
 * Retorna array de paths trimmed sem vazios.
 *
 * @param {string|undefined} envValue
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {string[]}
 */
export function splitConfigDirs(envValue, platform = process.platform) {
  if (!envValue || typeof envValue !== 'string') return [];
  const sep = platform === 'win32' ? ';' : ':';
  return envValue
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Liveness check de PID usando `process.kill(pid, 0)`. Trata as duas
 * exceções esperadas:
 *   - ESRCH (no such process) → false
 *   - EPERM (permission denied — Windows comum, ou kernel hardening em
 *     Linux) → true, pois o processo EXISTE, só não temos acesso.
 * Outros erros → false defensivo + log opcional via opts.onError.
 *
 * @param {number} pid
 * @param {{ onError?: (err: Error) => void }} [opts]
 * @returns {boolean}
 */
export function isPathAlive(pid, opts = {}) {
  if (typeof pid !== 'number' || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code === 'EPERM') return true;
    if (code === 'ESRCH') return false;
    if (opts.onError) opts.onError(/** @type {Error} */ (err));
    return false;
  }
}

/**
 * Junta segments com path.join e retorna a versão POSIX. Útil em fixtures
 * de teste cross-platform.
 *
 * @param {...string} parts
 * @returns {string}
 */
export function joinPosix(...parts) {
  return toPosix(path.join(...parts));
}
