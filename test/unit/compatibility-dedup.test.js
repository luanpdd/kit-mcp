// PERF-15-02: regression tests for compatibility dedup (Phase 85 Plan 02).
// Validates that `## Compatibilidade` was removed from all 27 agents,
// canonical kit/COMPATIBILITY.md exists with all agents listed, and
// kit/file-manifest.json verifies cleanly post-edit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyManifest } from '../../src/core/manifest-verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const KIT = path.join(REPO, 'kit');
const AGENTS_DIR = path.join(KIT, 'agents');

// The 27 agents that originally had `## Compatibilidade` blocks (verified via grep
// in Phase 85 Plan 02 read_first). If this list drifts, the test will catch it.
const DEDUPED_AGENTS = [
  'omm-auditor', 'supabase-edge-fn-writer', 'prr-conductor', 'release-pipeline-auditor',
  'load-shedding-instrumenter', 'cascading-failures-auditor', 'observability-coverage-auditor',
  'ai-mutation-tester', 'shotgun-surgery-detector', 'storytelling-analyst',
  'payload-capture-instrumenter', 'seam-finder', 'legacy-characterizer',
  'refactor-safety-auditor', 'supabase-storage-implementer', 'supabase-migration-writer',
  'supabase-architect', 'postmortem-writer', 'toil-auditor', 'golden-signals-instrumenter',
  'burn-rate-forecaster', 'slo-engineer', 'supabase-auth-bootstrapper',
  'supabase-realtime-implementer', 'supabase-rls-writer', 'incident-investigator',
  'observability-instrumenter',
];

test('PERF-15-02: zero `## Compatibilidade` headings remain in any kit/agents/*.md', () => {
  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const offenders = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');
    if (/^## Compatibilidade$/m.test(content)) {
      offenders.push(f);
    }
  }
  assert.equal(offenders.length, 0, `agents still have '## Compatibilidade': ${offenders.join(', ')}`);
});

test('PERF-15-02: all 27 deduped agents have `**Compat:**` reference line + relative link to COMPATIBILITY.md', () => {
  const missing = [];
  const noLink = [];
  for (const name of DEDUPED_AGENTS) {
    const p = path.join(AGENTS_DIR, name + '.md');
    if (!fs.existsSync(p)) { missing.push(name + ' (file not found)'); continue; }
    const content = fs.readFileSync(p, 'utf8');
    if (!content.includes('**Compat:**')) missing.push(name);
    if (!content.includes('[COMPATIBILITY.md](../COMPATIBILITY.md)')) noLink.push(name);
  }
  assert.equal(missing.length, 0, `agents missing **Compat:** line: ${missing.join(', ')}`);
  assert.equal(noLink.length, 0, `agents missing relative link to COMPATIBILITY.md: ${noLink.join(', ')}`);
});

test('PERF-15-02: kit/COMPATIBILITY.md exists, lists all 27 agents in matrix, manifest verifies clean', async () => {
  const compatPath = path.join(KIT, 'COMPATIBILITY.md');
  assert.ok(fs.existsSync(compatPath), 'kit/COMPATIBILITY.md must exist');
  const compat = fs.readFileSync(compatPath, 'utf8');

  // Each of the 27 agents must appear as a row in the canonical matrix
  // (format: "| <name> |" — confirms inclusion regardless of column position).
  const missing = DEDUPED_AGENTS.filter(name => !compat.includes('| ' + name + ' |'));
  assert.equal(missing.length, 0, `agents missing from COMPATIBILITY.md matrix: ${missing.join(', ')}`);

  // Manifest must verify clean — Phase 83 verifyManifest is what blocks sync if stale.
  const r = await verifyManifest(KIT);
  assert.ok(r.ok, `verifyManifest failed: ${r.reason}\nmismatches: ${JSON.stringify(r.mismatches)}\nmissing: ${JSON.stringify(r.missing)}`);
});
