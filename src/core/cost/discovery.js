// Phase 172 — cost JSONL discovery.
//
// Algoritmo (espelha ccusage):
//   1. Se CLAUDE_CONFIG_DIR setado, split por separador da plataforma e usar
//      esses dirs (multi-account support estrutural).
//   2. Senão, tentar XDG_CONFIG_HOME/claude.
//   3. Senão, fallback platform-specific:
//        - win32: %APPDATA%/claude (process.env.APPDATA) e ~/.claude
//        - posix: ~/.claude
//   4. Para cada dir, walk recursivamente procurando `*.jsonl` dentro de
//      `projects/`. (Claude Code grava em ~/.claude/projects/<slug>/*.jsonl.)
//   5. Filtrar dirs inexistentes (não warn, é normal).
//
// Output:
//   {
//     config_dirs: string[],          // dirs efetivamente existentes
//     jsonl_files: string[],          // paths absolutos POSIX-normalized
//     source_map: Record<file, dir>,  // qual config_dir descobriu o arquivo
//     warnings: string[],             // dirs que não existem mas foram pedidos
//   }
//
// Cross-platform: usa os.homedir() + path.sep. NÃO assume POSIX nem CRLF.
// Falha graceful: se um dir explode no readdir (EACCES), pula com warning.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { splitConfigDirs, toPosix } from './path-normalize.js';

/**
 * @typedef {Object} DiscoveryOptions
 * @property {string[]} [config_dirs]   Override explícito (não lê env).
 * @property {NodeJS.ProcessEnv} [env]  Override de env (para testes).
 * @property {string} [homedir]         Override de homedir (para testes).
 * @property {NodeJS.Platform} [platform]
 */

/**
 * @param {DiscoveryOptions} [opts]
 * @returns {{ config_dirs: string[], jsonl_files: string[], source_map: Record<string,string>, warnings: string[] }}
 */
export function discover(opts = {}) {
  const env = opts.env || process.env;
  const platform = opts.platform || process.platform;
  const homedir = opts.homedir || os.homedir();

  const requested = opts.config_dirs && Array.isArray(opts.config_dirs)
    ? opts.config_dirs.slice()
    : computeDefaultDirs(env, platform, homedir);

  const warnings = [];
  const existing = [];
  for (const d of requested) {
    if (!d) continue;
    try {
      const stat = fs.statSync(d);
      if (stat.isDirectory()) existing.push(d);
      else warnings.push(`not_a_directory:${d}`);
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      if (code === 'ENOENT') {
        // silencioso — esperado se Claude Code nunca rodou nesse dir.
        continue;
      }
      warnings.push(`stat_failed:${d}:${code || 'unknown'}`);
    }
  }

  const jsonl_files = [];
  /** @type {Record<string,string>} */
  const source_map = {};

  for (const dir of existing) {
    // Claude Code grava em <config_dir>/projects/<slug>/*.jsonl.
    const projectsDir = path.join(dir, 'projects');
    let stat;
    try {
      stat = fs.statSync(projectsDir);
    } catch {
      stat = null;
    }
    const scanRoot = stat && stat.isDirectory() ? projectsDir : dir;
    walkJsonl(scanRoot, (file) => {
      const norm = toPosix(file);
      jsonl_files.push(norm);
      source_map[norm] = dir;
    }, warnings);
  }

  return {
    config_dirs: existing,
    jsonl_files,
    source_map,
    warnings,
  };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {NodeJS.Platform} platform
 * @param {string} homedir
 * @returns {string[]}
 */
function computeDefaultDirs(env, platform, homedir) {
  // CLAUDE_CONFIG_DIR explícito tem precedência absoluta.
  if (env.CLAUDE_CONFIG_DIR) return splitConfigDirs(env.CLAUDE_CONFIG_DIR, platform);
  /** @type {string[]} */
  const dirs = [];
  if (env.XDG_CONFIG_HOME) dirs.push(path.join(env.XDG_CONFIG_HOME, 'claude'));
  if (platform === 'win32' && env.APPDATA) {
    dirs.push(path.join(env.APPDATA, 'claude'));
  }
  // Fallback POSIX-style sempre presente como último recurso.
  dirs.push(path.join(homedir, '.claude'));
  // Dedup preservando ordem.
  return Array.from(new Set(dirs));
}

/**
 * @param {string} root
 * @param {(file: string) => void} onFile
 * @param {string[]} warnings
 */
function walkJsonl(root, onFile, warnings) {
  /** @type {fs.Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (err) {
    warnings.push(`readdir_failed:${root}:${/** @type {NodeJS.ErrnoException} */ (err).code || 'unknown'}`);
    return;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkJsonl(full, onFile, warnings);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
      onFile(full);
    }
  }
}
