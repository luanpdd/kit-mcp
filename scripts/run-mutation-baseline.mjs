// Driver script for v1.20 mutation baseline (Phase 101 / REQ INFRA-20-02).
//
// Iterates each src/core/*.js file independently, using a focused subset of
// test files relevant to that source file. This keeps each Stryker
// invocation under ~30 seconds, vs ~100 minutes for the naive
// "all-files × full-suite" approach which has unacceptable wall-clock cost
// on dev laptops.
//
// Output: aggregates per-file scores into reports/mutation/baseline-summary.json
// and pretty-prints a markdown-friendly table to stdout.
//
// Reproducibility: re-running this script is idempotent — each file's
// individual report goes to reports/mutation/<file-stem>/, the aggregator
// re-reads them all every run.
//
// Refs:
//   - Phase 101 plan: .planning/phases/101-mutation-testing-baseline/101-01-PLAN.md
//   - Stryker config: stryker.config.json (canonical)
//   - Wrapper: test/run-mutation.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// File → relevant test files. Each entry is comma-separated paths under test/unit/.
// When deciding mappings, prefer:
//   - Direct matches (foo.js → foo.test.js + foo-coverage.test.js)
//   - Functional siblings (path-safety.js exercised by replays-path-traversal.test.js)
//   - Indirect coverage tests (kit.js exercised heavily by sync.test.js)
const CORE_FILE_TESTS = {
  'src/core/error-redaction.js': 'test/unit/error-redaction.test.js',
  'src/core/failures.js': 'test/unit/failures-coverage.test.js',
  'src/core/gate-runner.js': 'test/unit/gate-runner-tmpdir.test.js,test/unit/gates.test.js',
  'src/core/gates.js': 'test/unit/gates.test.js',
  'src/core/kit.js': 'test/unit/kit.test.js,test/unit/sync.test.js',
  'src/core/manifest-verify.js':
    'test/unit/manifest-verify.test.js,test/unit/regen-manifest.test.js',
  'src/core/metrics.js': 'test/unit/metrics.test.js,test/unit/metrics-retention.test.js',
  'src/core/path-safety.js':
    'test/unit/replays-path-traversal.test.js,test/unit/sync.test.js',
  'src/core/reflect.js': 'test/unit/reflect-paths.test.js,test/unit/reflect-redact.test.js',
  'src/core/registry.js': 'test/unit/registry.test.js',
  'src/core/replays.js':
    'test/unit/replays-path-traversal.test.js,test/unit/replays-redact.test.js',
  'src/core/reverse-sync.js':
    'test/unit/reverse-sync.test.js,test/unit/reverse-sync-parallel.test.js,test/unit/reverse-sync-paths.test.js',
  'src/core/sync.js':
    'test/unit/sync.test.js,test/unit/sync-concurrent.test.js,test/unit/sync-round-trip-all-targets.test.js,test/unit/compatibility-dedup.test.js',
  'src/core/ui.js':
    'test/unit/ui.test.js,test/unit/ui-events.test.js,test/unit/ui-lockfile.test.js,test/unit/ui-port.test.js,test/unit/ui-wrapper.test.js,test/unit/ui-client-paths.test.js',
  'src/core/watch.js': 'test/unit/watch-debounce.test.js',
};

const ROOT = path.resolve(path.join(import.meta.dirname, '..'));
process.chdir(ROOT);

const REPORTS_DIR = path.join(ROOT, 'reports', 'mutation');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const CANONICAL_JSON_PATH = path.join(REPORTS_DIR, 'mutation-report.json');
const CANONICAL_HTML_PATH = path.join(REPORTS_DIR, 'mutation-report.html');

const summary = {
  schemaVersion: '1.20-baseline',
  generated: new Date().toISOString(),
  perFile: {},
  totals: { killed: 0, survived: 0, timeout: 0, noCoverage: 0, mutants: 0 },
};

const targets = Object.entries(CORE_FILE_TESTS);
console.log(`Running mutation baseline for ${targets.length} files…\n`);

for (const [srcFile, tests] of targets) {
  const stem = path.basename(srcFile, '.js');
  const fileReportDir = path.join(REPORTS_DIR, stem);
  fs.mkdirSync(fileReportDir, { recursive: true });

  const env = { ...process.env, STRYKER_MUTATE_TEST_FILES: tests };

  const args = [
    'stryker',
    'run',
    '--mutate',
    srcFile,
    '--logLevel',
    'warn',
    '--reporters',
    'json',
  ];

  const t0 = Date.now();
  console.log(`▶ ${srcFile}  (tests: ${tests.split(',').length})`);
  const r = spawnSync('npx', args, { stdio: ['ignore', 'pipe', 'pipe'], env, shell: true });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (r.status !== 0) {
    console.error(`  ✖ exit ${r.status} after ${elapsed}s`);
    console.error(r.stderr?.toString().slice(0, 400));
    summary.perFile[srcFile] = { error: `exit ${r.status}`, elapsed };
    continue;
  }

  // Stryker writes to the canonical path defined in stryker.config.json
  // (reports/mutation/mutation-report.json). Move it under the per-file
  // sub-directory so subsequent iterations don't overwrite previous results.
  const canonicalReportPath = path.join(REPORTS_DIR, 'mutation-report.json');
  const reportPath = path.join(fileReportDir, 'mutation-report.json');
  if (fs.existsSync(canonicalReportPath)) {
    fs.copyFileSync(canonicalReportPath, reportPath);
  }
  if (!fs.existsSync(reportPath)) {
    console.error(`  ✖ no JSON at ${reportPath}`);
    summary.perFile[srcFile] = { error: 'no-json', elapsed };
    continue;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const fileEntry = report.files[srcFile.replace(/\\/g, '/')];
  if (!fileEntry) {
    console.error(`  ✖ JSON missing entry for ${srcFile}; keys=${Object.keys(report.files)}`);
    summary.perFile[srcFile] = { error: 'no-entry', elapsed };
    continue;
  }

  let killed = 0, survived = 0, timeout = 0, noCoverage = 0;
  const survivedMutants = [];
  for (const m of fileEntry.mutants) {
    if (m.status === 'Killed') killed++;
    else if (m.status === 'Survived') {
      survived++;
      survivedMutants.push({
        mutator: m.mutatorName,
        line: m.location.start.line,
        col: m.location.start.column,
      });
    } else if (m.status === 'Timeout') timeout++;
    else if (m.status === 'NoCoverage') noCoverage++;
  }
  const total = killed + survived + timeout + noCoverage;
  const score = total > 0 ? ((killed + timeout) / total) * 100 : 0;

  summary.perFile[srcFile] = {
    killed,
    survived,
    timeout,
    noCoverage,
    mutants: total,
    score: Number(score.toFixed(2)),
    elapsed: Number(elapsed),
    survivedMutants: survivedMutants.slice(0, 10),
  };
  summary.totals.killed += killed;
  summary.totals.survived += survived;
  summary.totals.timeout += timeout;
  summary.totals.noCoverage += noCoverage;
  summary.totals.mutants += total;

  console.log(
    `  ✓ ${score.toFixed(2)}% (${killed}k/${survived}s/${timeout}t/${noCoverage}n; ${total} total) in ${elapsed}s`,
  );
}

const totals = summary.totals;
summary.totals.score = Number(
  (((totals.killed + totals.timeout) / Math.max(totals.mutants, 1)) * 100).toFixed(2),
);

// Cleanup canonical paths if they still hold the last-file partial reports —
// the per-file reports are the source of truth.
if (fs.existsSync(CANONICAL_JSON_PATH)) fs.rmSync(CANONICAL_JSON_PATH);
if (fs.existsSync(CANONICAL_HTML_PATH)) fs.rmSync(CANONICAL_HTML_PATH);

fs.writeFileSync(
  path.join(REPORTS_DIR, 'baseline-summary.json'),
  JSON.stringify(summary, null, 2),
);

console.log(`\n=== Baseline Summary ===`);
console.log(`Total mutants: ${totals.mutants}`);
console.log(`Killed:        ${totals.killed}`);
console.log(`Survived:      ${totals.survived}`);
console.log(`Timeout:       ${totals.timeout}`);
console.log(`NoCoverage:    ${totals.noCoverage}`);
console.log(`Mutation score: ${summary.totals.score}%`);
console.log(`\nDetails: reports/mutation/baseline-summary.json`);
