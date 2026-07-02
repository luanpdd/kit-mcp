// Phase 172 — Dedup 3 níveis (gap G6 do SPEC).
//
// Por que 3 níveis: o algoritmo naive do ccusage faz hash composto direto
// com `${messageId}|${requestId}`. Mas quando AMBOS são null (entry de
// summary, eventos de tool sem reply, etc) o hash colapsa em
// `undefined|undefined` e DEDUPa-se duas entries legitimamente diferentes.
//
// Nível 1: skip entries com messageId == null OU requestId == null →
//          incrementa skipped_entry_count (NÃO conta como deduped).
// Nível 2: hash composto inclui minuteBucket(timestamp) para distinguir
//          retries em janelas diferentes; e model para distinguir runs
//          paralelos no mesmo bucket.
// Nível 3: tie-break determinístico quando há colisão real:
//            (a) arquivo mais novo (maior mtime do source_file)
//            (b) não-sidechain ganha de sidechain
//            (c) maior soma de tokens (input+output+cache_*)
//            (d) timestamp mais cedo (estável)
//
// Cada entry é assumida vir do parser e CARREGAR `__source_file` +
// `__source_mtime` se houver (anexados pelo agregador antes de dedupar).

const MS_PER_MINUTE = 60_000;

/**
 * @param {object[]} entries
 * @param {{ sourceMtimes?: Record<string, number> }} [opts]
 * @returns {{
 *   kept: object[],
 *   deduped_count: number,
 *   skipped_entry_count: number,
 *   buckets: number,
 * }}
 */
export function dedup(entries, opts = {}) {
  if (!Array.isArray(entries)) {
    return { kept: [], deduped_count: 0, skipped_entry_count: 0, buckets: 0 };
  }
  const sourceMtimes = opts.sourceMtimes || {};
  let skipped_entry_count = 0;

  // Nível 1: separa quem tem chave forte.
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  /** @type {object[]} */
  const passthrough = [];

  for (const e of entries) {
    if (!isStrongId(e?.messageId) || !isStrongId(e?.requestId)) {
      // SPEC: entries com messageId/requestId null → skip (não vai pro
      // bucket de dedup, NÃO entra no output). Mantém visibilidade
      // operacional via counter.
      skipped_entry_count++;
      continue;
    }
    const key = compositeKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  // Nível 2 + 3: para cada bucket, pickar 1 vencedor via tie-break.
  /** @type {object[]} */
  const kept = [];
  let deduped_count = 0;
  for (const [, group] of groups) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const winner = pickWinner(group, sourceMtimes);
    kept.push(winner);
    deduped_count += group.length - 1;
  }

  kept.push(...passthrough);

  return {
    kept,
    deduped_count,
    skipped_entry_count,
    buckets: groups.size,
  };
}

/**
 * Hash composto do nível 2.
 *
 * @param {any} e
 * @returns {string}
 */
function compositeKey(e) {
  const ts = Date.parse(e.timestamp);
  const bucket = Number.isFinite(ts) ? Math.floor(ts / MS_PER_MINUTE) : 'na';
  return `${e.messageId}|${e.requestId}|${e.model}|${bucket}`;
}

/**
 * @param {any} v
 * @returns {boolean}
 */
function isStrongId(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Tie-break determinístico do nível 3.
 *
 * @param {object[]} group
 * @param {Record<string,number>} sourceMtimes
 * @returns {object}
 */
function pickWinner(group, sourceMtimes) {
  let best = group[0];
  for (let i = 1; i < group.length; i++) {
    const candidate = group[i];
    if (cmp(candidate, best, sourceMtimes) > 0) best = candidate;
  }
  return best;
}

/**
 * Retorna >0 se `a` ganha de `b`. Tie-break em ordem:
 *  (a) source_mtime maior
 *  (b) não-sidechain > sidechain
 *  (c) maior soma de tokens
 *  (d) timestamp mais cedo (menor ts ganha — entry "original" é a primeira)
 *
 * @param {any} a
 * @param {any} b
 * @param {Record<string,number>} sourceMtimes
 * @returns {number}
 */
function cmp(a, b, sourceMtimes) {
  const ma = mtimeOf(a, sourceMtimes);
  const mb = mtimeOf(b, sourceMtimes);
  if (ma !== mb) return ma - mb;

  const sa = a.isSidechain ? 1 : 0;
  const sb = b.isSidechain ? 1 : 0;
  if (sa !== sb) return sb - sa; // não-sidechain (0) ganha → 0-1 = -1 → b ganha, então invertido

  const ta = tokenSum(a);
  const tb = tokenSum(b);
  if (ta !== tb) return ta - tb;

  // Timestamp mais cedo ganha → ts menor é melhor → invertemos.
  const tsA = Date.parse(a.timestamp) || 0;
  const tsB = Date.parse(b.timestamp) || 0;
  return tsB - tsA;
}

/**
 * @param {any} e
 * @param {Record<string,number>} sourceMtimes
 * @returns {number}
 */
function mtimeOf(e, sourceMtimes) {
  if (typeof e.__source_mtime === 'number') return e.__source_mtime;
  if (e.__source_file && sourceMtimes[e.__source_file] !== undefined) {
    return sourceMtimes[e.__source_file];
  }
  return 0;
}

/**
 * @param {any} e
 * @returns {number}
 */
function tokenSum(e) {
  const u = e.usage || {};
  return (
    (u.input_tokens || 0) +
    (u.output_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0)
  );
}

/**
 * Exposto para tests + agregadores.
 */
export const __internals = { compositeKey, isStrongId, tokenSum };
