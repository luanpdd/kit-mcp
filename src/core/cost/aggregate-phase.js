// Phase 172 — aggregate phase.
//
// Diferencial vs ccusage: cruza usage com janela temporal da fase do
// framework kit-mcp. Heurística inicial (v1.37.0 — debt acordada pra
// iterar com sinais reais em v1.37.1).
//
// Inferência de janela:
//   - started_at: mtime do arquivo SPEC.md da fase (.planning/phases/<id>-*/).
//   - ended_at: parse `completed_at` de STATE.md global (.planning/STATE.md)
//     se a fase está listada como concluída. Senão, null (fase ativa) ou
//     usa mtime do dir.
//   - Cross-ref: git log --since/--until pra apertar bordas.
//
// correlation_confidence:
//   - 'high':    SPEC.md mtime presente + completed_at no STATE + commits
//                no intervalo (todos os 3 sinais).
//   - 'medium':  2/3 sinais.
//   - 'low':     apenas mtime do dir (sem SPEC, sem completed_at, sem commits)
//                OU detecção de rebase recente (git reflog) que invalidaria
//                bordas.
//   - 'unknown': fase não encontrada.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { discover } from './discovery.js';
import { parseJsonlFile } from './parser.js';
import { dedup } from './dedup.js';
import { priceEntries, loadSnapshot } from './pricing.js';

/**
 * @typedef {Object} PhaseOptions
 * @property {string|number} phase_id
 * @property {string}   [root_dir=process.cwd()]
 * @property {string[]} [config_dirs]
 * @property {number}   [now]
 * @property {object[]} [entries]
 * @property {Record<string,number>} [source_mtimes]
 * @property {string}   [snapshot_path]
 * @property {string}   [meta_path]
 * @property {boolean}  [skip_git=false]   skip git introspection (testes).
 * @property {{started_at?:number, ended_at?:number|null, slug?:string, confidence?:string}} [phase_window_override]
 */

/**
 * @param {PhaseOptions} opts
 * @returns {object}
 */
export function aggregatePhase(opts) {
  if (!opts || (opts.phase_id === undefined && opts.phase_id !== 0)) {
    throw new Error('aggregatePhase: phase_id is required');
  }
  const rootDir = opts.root_dir || process.cwd();
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const phaseIdStr = String(opts.phase_id);

  const window = opts.phase_window_override
    ? buildOverrideWindow(opts.phase_window_override, phaseIdStr)
    : resolvePhaseWindow(rootDir, phaseIdStr, { skip_git: !!opts.skip_git, now });

  if (!window || window.confidence === 'unknown') {
    return {
      phase_id: phaseIdStr,
      phase_slug: window?.slug || null,
      started_at: null,
      ended_at: null,
      correlation_confidence: 'unknown',
      reason: window?.reason || 'phase_not_found',
      total_usd: null,
      by_model: {},
      entry_count: 0,
      deduped_count: 0,
      skipped_entry_count: 0,
      parse_error_count: 0,
      unknown_models: [],
      pricing_source: 'unknown',
      pricing_staleness_days: -1,
    };
  }

  // Coleta entries (dedup global → filtra por janela).
  /** @type {object[]} */
  let entries = [];
  /** @type {Record<string,number>} */
  const sourceMtimes = opts.source_mtimes ? { ...opts.source_mtimes } : {};
  let parse_error_count = 0;

  if (Array.isArray(opts.entries)) {
    entries = opts.entries.slice();
  } else {
    const disc = discover({ config_dirs: opts.config_dirs });
    for (const file of disc.jsonl_files) {
      const parsed = parseJsonlFile(file);
      parse_error_count += parsed.error_count;
      if (typeof parsed.source_mtime === 'number') sourceMtimes[file] = parsed.source_mtime;
      for (const e of parsed.entries) {
        e.__source_file = file;
        if (parsed.source_mtime !== undefined) e.__source_mtime = parsed.source_mtime;
      }
      entries.push(...parsed.entries);
    }
  }

  const ddOut = dedup(entries, { sourceMtimes });

  const start = window.started_at;
  const end = window.ended_at === null ? now : window.ended_at;
  const filtered = ddOut.kept.filter((e) => {
    const t = Date.parse(e.timestamp);
    if (!Number.isFinite(t)) return false;
    return t >= start && t <= end;
  });

  const loaded = loadSnapshot({
    snapshot_path: opts.snapshot_path,
    meta_path: opts.meta_path,
    now,
    force: !!(opts.snapshot_path || opts.meta_path),
  });
  const priced = priceEntries(filtered, loaded);

  const out = {
    phase_id: phaseIdStr,
    phase_slug: window.slug,
    started_at: new Date(start).toISOString(),
    ended_at: window.ended_at === null ? null : new Date(window.ended_at).toISOString(),
    is_active: window.ended_at === null,
    correlation_confidence: window.confidence,
    correlation_signals: window.signals,
    total_usd: priced.total_usd,
    by_model: priced.by_model,
    entry_count: priced.entry_count,
    deduped_count: ddOut.deduped_count,
    skipped_entry_count: ddOut.skipped_entry_count,
    parse_error_count,
    unknown_models: priced.unknown_models,
    pricing_source: priced.pricing_source,
    pricing_staleness_days: priced.pricing_staleness_days,
  };
  if (priced.pricing_warning) out.pricing_warning = priced.pricing_warning;
  return out;
}

/**
 * Resolve a janela temporal de uma fase cruzando 3 sinais:
 *  1. SPEC.md mtime → started_at
 *  2. STATE.md completed_at → ended_at
 *  3. git log no dir da fase → confirma janela
 *
 * @param {string} rootDir
 * @param {string} phaseId
 * @param {{skip_git:boolean, now:number}} opts
 */
export function resolvePhaseWindow(rootDir, phaseId, opts) {
  const phasesDir = path.join(rootDir, '.planning', 'phases');
  let entries;
  try {
    entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  } catch {
    return { confidence: 'unknown', reason: 'phases_dir_missing', signals: {} };
  }
  const prefix = `${phaseId}-`;
  const match = entries.find((d) => d.isDirectory() && d.name.startsWith(prefix));
  if (!match) {
    return { confidence: 'unknown', reason: 'phase_dir_not_found', slug: null, signals: {} };
  }
  const slug = match.name.slice(prefix.length);
  const phaseDir = path.join(phasesDir, match.name);

  // Sinal 1: mtime SPEC.md (ou primeiro .md por ordem).
  let started_at = null;
  let signal_spec = false;
  const specCandidates = [`${phaseId}-SPEC.md`, 'SPEC.md'];
  for (const c of specCandidates) {
    try {
      const s = fs.statSync(path.join(phaseDir, c));
      started_at = s.mtimeMs;
      signal_spec = true;
      break;
    } catch {
      // continue
    }
  }
  if (started_at === null) {
    // Fallback: mtime do dir.
    try {
      started_at = fs.statSync(phaseDir).mtimeMs;
    } catch {
      return { confidence: 'unknown', reason: 'phase_dir_stat_failed', slug, signals: {} };
    }
  }

  // Sinal 2: completed_at no STATE.md (heurística — STATE global, não per-phase).
  let ended_at = null;
  let signal_state = false;
  const stateFile = path.join(rootDir, '.planning', 'STATE.md');
  try {
    const content = fs.readFileSync(stateFile, 'utf8');
    const completed = extractCompletedAt(content, phaseId);
    if (completed !== null) {
      ended_at = completed;
      signal_state = true;
    }
  } catch {
    // STATE.md ausente — ok.
  }

  // Sinal 3: git log no dir da fase.
  let signal_git = false;
  let rebase_detected = false;
  if (!opts.skip_git) {
    try {
      const logTs = gitLogLastTimestamp(rootDir, path.join('.planning', 'phases', match.name));
      if (logTs && started_at && logTs >= started_at - 60_000) {
        signal_git = true;
        if (ended_at === null) ended_at = Math.max(logTs, started_at);
      }
      rebase_detected = detectRecentRebase(rootDir);
    } catch {
      // git ausente — segue sem o sinal.
    }
  }

  const signals = {
    spec_mtime: signal_spec,
    state_completed_at: signal_state,
    git_log: signal_git,
    rebase_detected,
  };
  const positives = [signal_spec, signal_state, signal_git].filter(Boolean).length;
  let confidence = 'low';
  if (rebase_detected) {
    confidence = 'low';
  } else if (positives >= 3) {
    confidence = 'high';
  } else if (positives === 2) {
    confidence = 'medium';
  } else if (positives === 1) {
    confidence = 'low';
  } else {
    confidence = 'low';
  }

  return {
    slug,
    started_at,
    ended_at, // null se sem completed_at e sem git log → fase ativa
    confidence,
    signals,
  };
}

/**
 * Heurística simples: procura `completed_at: "<ISO>"` ou
 * `phase: <id>` seguido de `completed_at:` no STATE.md.
 *
 * @param {string} content
 * @param {string} phaseId
 * @returns {number|null} epoch ms
 */
function extractCompletedAt(content, phaseId) {
  // Procura bloco da fase: tenta capturar linha que mencione phase id +
  // próxima ocorrência de completed_at: ISO.
  const lines = content.split(/\r?\n/);
  let scope = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`phase:${phaseId}`) || lines[i].match(new RegExp(`\\b${phaseId}\\b`))) {
      scope = i;
    }
    if (scope >= 0 && i - scope < 50) {
      const m = lines[i].match(/completed_at:\s*['"]?([\d\-T:.Z]+)['"]?/);
      if (m) {
        const t = Date.parse(m[1]);
        if (Number.isFinite(t)) return t;
      }
    }
  }
  // Fallback global: pega o primeiro completed_at do arquivo se a fase
  // estiver claramente marcada como concluída.
  if (content.includes(`completed_phases:`)) {
    const m = content.match(/completed_at:\s*['"]?([\d\-T:.Z]+)['"]?/);
    if (m) {
      const t = Date.parse(m[1]);
      if (Number.isFinite(t) && content.includes(phaseId) && content.match(/(✓|done|completed|entregue)/i)) {
        return t;
      }
    }
  }
  return null;
}

/**
 * @param {string} rootDir
 * @param {string} subpath relative
 * @returns {number|null} epoch ms do último commit que tocou o path
 */
function gitLogLastTimestamp(rootDir, subpath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%ct', '--', subpath],
      { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!out) return null;
    const ct = Number.parseInt(out, 10);
    return Number.isFinite(ct) ? ct * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Detecta rebase recente (últimas 24h) inspecionando reflog. Rebase
 * destrói janela temporal autoral, então rebaixa confidence pra 'low'.
 *
 * @param {string} rootDir
 * @returns {boolean}
 */
function detectRecentRebase(rootDir) {
  try {
    const out = execFileSync(
      'git',
      ['reflog', '--date=unix', '-n', '40'],
      { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/\{(\d+)\}/);
      const ts = m ? Number.parseInt(m[1], 10) : NaN;
      if (Number.isFinite(ts) && ts >= cutoff && /rebase/i.test(line)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {{started_at?:number, ended_at?:number|null, slug?:string, confidence?:string}} ov
 * @param {string} phaseId
 */
function buildOverrideWindow(ov, phaseId) {
  return {
    slug: ov.slug || phaseId,
    started_at: typeof ov.started_at === 'number' ? ov.started_at : 0,
    ended_at: ov.ended_at === null ? null : (typeof ov.ended_at === 'number' ? ov.ended_at : null),
    confidence: ov.confidence || 'medium',
    signals: { override: true },
  };
}
