// Phase 100 — Coverage ratchet 80%→90%: targeted tests for src/cli/render.js
//
// Baseline (Phase 98): 33.69% line coverage. Target ≥ 90%.
// Strategy: import each rendered path with NO_COLOR=1 set BEFORE module load
// (mirroring test/unit/ui.test.js pattern), then exercise empty/populated
// branches of every exported renderer plus the internal `table` helper via
// renderKitList(empty=true). All output is plain text since color is off.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Force NO_COLOR before importing render.js (and its transitive ui.js).
// COLOR_ON in src/core/ui.js is captured at module-load; we want id() identity
// returners so assertions don't have to deal with ANSI escapes.
const prevNoColor = process.env.NO_COLOR;
process.env.NO_COLOR = '1';

const render = await import('../../src/cli/render.js');

// Restore happens in after-block; but Node test runner doesn't enforce it
// across files. Only restore if no other test set it.
if (prevNoColor === undefined) {
  // Leaving NO_COLOR='1' is fine — multiple test files (ui.test.js, etc.)
  // already do this and assert plain output. It's idempotent across imports.
}

// --- renderKitList ---

test('renderKitList — empty list shows "No <kind>s in kit." dim message', () => {
  const out = render.renderKitList([], 'agent');
  assert.match(out, /No agents in kit\./);
  assert.ok(out.endsWith('\n'));
});

test('renderKitList — empty list with kind=command pluralizes correctly', () => {
  const out = render.renderKitList([], 'command');
  assert.match(out, /No commands in kit\./);
});

test('renderKitList — populated list shows headers + each item with truncation', () => {
  const items = [
    { name: 'planner', description: 'Plans phases' },
    { name: 'executor', description: 'a'.repeat(100) },
  ];
  const out = render.renderKitList(items, 'agent');
  assert.match(out, /name/);
  assert.match(out, /description/);
  assert.match(out, /planner/);
  assert.match(out, /executor/);
  // 80-char cap on description — should appear, but not 100 chars of 'a'
  assert.ok(out.includes('a'.repeat(80)));
  assert.ok(!out.includes('a'.repeat(81)));
});

test('renderKitList — handles missing description (undefined → empty string)', () => {
  const items = [{ name: 'minimal' }];
  const out = render.renderKitList(items, 'skill');
  assert.match(out, /minimal/);
});

// --- renderKitSearch ---

test('renderKitSearch — empty results shows "No matches." dim message', () => {
  const out = render.renderKitSearch([]);
  assert.match(out, /No matches\./);
  assert.ok(out.endsWith('\n'));
});

test('renderKitSearch — populated results show kind/name/description columns', () => {
  const results = [
    { kind: 'agent', name: 'planner', description: 'Plans phases' },
    { kind: 'skill', name: 'four-golden-signals', description: 'Latency/Traffic/Errors/Saturation' },
  ];
  const out = render.renderKitSearch(results);
  assert.match(out, /agent/);
  assert.match(out, /planner/);
  assert.match(out, /skill/);
  assert.match(out, /four-golden-signals/);
});

// --- renderSyncTargets ---

test('renderSyncTargets — concatenates truthy capability keys with comma', () => {
  const targets = [{
    id: 'claude-code', label: 'Claude Code',
    capabilities: { agents: true, commands: true, skills: false, hooks: true },
  }];
  const out = render.renderSyncTargets(targets);
  assert.match(out, /claude-code/);
  assert.match(out, /Claude Code/);
  assert.match(out, /agents/);
  assert.match(out, /commands/);
  assert.match(out, /hooks/);
  // skills was false — should NOT appear in the row
  assert.ok(!/skills/.test(out.split('\n').find(l => l.includes('claude-code'))));
});

// --- renderSyncStatus ---

test('renderSyncStatus — mix of exists true/false renders ✓ and —', () => {
  const result = {
    target: 'claude-code',
    projectRoot: '/tmp/x',
    checks: [
      { capability: 'agents', path: '.claude/agents/', exists: true },
      { capability: 'skills', path: '.claude/skills/', exists: false },
    ],
  };
  const out = render.renderSyncStatus(result);
  assert.match(out, /Status: claude-code/);
  assert.match(out, /\/tmp\/x/);
  assert.match(out, /agents.*✓/);
  assert.match(out, /skills.*—/);
});

// --- renderSyncInstall ---

test('renderSyncInstall — tally categorizes paths by capability prefix', () => {
  const result = {
    target: 'claude-code',
    projectRoot: '/tmp/proj',
    dryRun: false,
    written: [
      '/tmp/proj/.claude/agents/planner.md',
      '/tmp/proj/.claude/agents/executor.md',
      '/tmp/proj/.claude/commands/foo.md',
      '/tmp/proj/.claude/skills/bar/SKILL.md',
      '/tmp/proj/.claude/framework/workflows/x.md',
      '/tmp/proj/.claude/hooks/y.js',
      '/tmp/proj/CLAUDE.md',
    ],
  };
  const out = render.renderSyncInstall(result);
  assert.match(out, /Synced kit → claude-code/);
  // 7 written, none hidden — total = 7
  assert.match(out, /Total:.*7/);
});

test('renderSyncInstall — dry-run appends " (dry-run)" to title', () => {
  const result = {
    target: 'claude-code', projectRoot: '/tmp/x', dryRun: true,
    written: ['/tmp/x/.claude/agents/a.md'],
  };
  const out = render.renderSyncInstall(result);
  assert.match(out, /\(dry-run\)/);
});

test('renderSyncInstall — hides .kit-mcp-managed marker from tally', () => {
  const result = {
    target: 'claude-code', projectRoot: '/tmp/x', dryRun: false,
    written: [
      '/tmp/x/.claude/agents/a.md',
      '/tmp/x/.claude/framework/.kit-mcp-managed',
    ],
  };
  const out = render.renderSyncInstall(result);
  // Total should be 1, not 2 — marker is hidden
  assert.match(out, /Total:.*1\b/);
});

// --- renderSyncRemove ---

test('renderSyncRemove — shows count of removed files', () => {
  const result = {
    target: 'claude-code',
    projectRoot: '/tmp/x',
    removed: ['a.md', 'b.md', 'c.md'],
  };
  const out = render.renderSyncRemove(result);
  assert.match(out, /Removed kit-mcp stubs from claude-code/);
  assert.match(out, /Files removed.*3/);
  assert.match(out, /Total:.*3/);
});

// --- renderReverseDetect ---

test('renderReverseDetect — empty candidates says "in sync"', () => {
  const result = { target: 'claude-code', candidates: [] };
  const out = render.renderReverseDetect(result);
  assert.match(out, /in sync/);
  assert.match(out, /✓/);
});

test('renderReverseDetect — populated candidates show kind/name/reason/diff', () => {
  const result = {
    target: 'claude-code',
    candidates: [
      { kind: 'agent', name: 'planner', reason: 'modified-in-ide', diffSummary: '+10 lines' },
      { kind: 'skill', name: 'foo', reason: 'new-in-ide', diffSummary: '+50 bytes' },
    ],
  };
  const out = render.renderReverseDetect(result);
  assert.match(out, /Candidates: 2/);
  assert.match(out, /agent.*planner/);
  assert.match(out, /skill.*foo/);
  assert.match(out, /modified-in-ide/);
  assert.match(out, /new-in-ide/);
});

test('renderReverseDetect — handles missing diffSummary (undefined → empty)', () => {
  const result = {
    target: 'claude-code',
    candidates: [{ kind: 'agent', name: 'x', reason: 'modified-in-ide' }],
  };
  const out = render.renderReverseDetect(result);
  assert.match(out, /agent.*x/);
});

// --- renderReverseApply ---

test('renderReverseApply — overwritten/merged/renamed actions render green', () => {
  const result = {
    strategy: 'overwrite',
    results: [
      { kind: 'agent', name: 'a', action: 'overwritten' },
      { kind: 'skill', name: 'b', action: 'merged' },
      { kind: 'command', name: 'c', action: 'renamed → /path/x.md' },
    ],
  };
  const out = render.renderReverseApply(result);
  assert.match(out, /Applied \(strategy=overwrite\)/);
  assert.match(out, /overwritten/);
  assert.match(out, /merged/);
  assert.match(out, /renamed/);
});

test('renderReverseApply — skipped action renders dim, unknown action yellow', () => {
  const result = {
    strategy: 'skip',
    results: [
      { kind: 'agent', name: 'a', action: 'skipped' },
      { kind: 'agent', name: 'b', action: 'unknown strategy: foo' },
    ],
  };
  const out = render.renderReverseApply(result);
  assert.match(out, /skipped/);
  assert.match(out, /unknown strategy: foo/);
});

// --- renderGatesList ---

test('renderGatesList — mix of blocking/warn-only renders mode column', () => {
  const items = [
    { id: 'budget', stage: 'pre-execute', blocking: true, description: 'Budget desc' },
    { id: 'warning', stage: 'post-verify', blocking: false, description: 'Warn-only desc' },
  ];
  const out = render.renderGatesList(items);
  assert.match(out, /budget.*pre-execute.*blocking/);
  assert.match(out, /warning.*post-verify.*warn-only/);
});

// --- renderGateRun ---

test('renderGateRun — verdict=passed renders green path', () => {
  const out = render.renderGateRun({ id: 'g', verdict: 'passed', exitCode: 0 });
  assert.match(out, /Gate g/);
  assert.match(out, /passed/);
  assert.match(out, /exit 0/);
});

test('renderGateRun — verdict=block renders red path', () => {
  const out = render.renderGateRun({ id: 'g', verdict: 'block', exitCode: 1 });
  assert.match(out, /block/);
  assert.match(out, /exit 1/);
});

test('renderGateRun — verdict=warn renders yellow path', () => {
  const out = render.renderGateRun({ id: 'g', verdict: 'warn' });
  assert.match(out, /warn/);
  // exitCode undefined — no "(exit ...)" suffix
});

test('renderGateRun — verdict=manual renders dim path', () => {
  const out = render.renderGateRun({ id: 'g', verdict: 'manual' });
  assert.match(out, /manual/);
});

// --- renderForensicsCollect ---

test('renderForensicsCollect — empty array shows "No failures collected."', () => {
  const out = render.renderForensicsCollect([]);
  assert.match(out, /No failures collected\./);
});

test('renderForensicsCollect — items render with agent/kind/path columns', () => {
  const items = [
    { agent: 'planner', kind: 'verify', absPath: '/tmp/a.md' },
    { agent: 'executor', kind: 'debug', path: '/tmp/b.md' },
    { kind: 'forensics' }, // missing agent → '?'
  ];
  const out = render.renderForensicsCollect(items);
  assert.match(out, /planner.*verify/);
  assert.match(out, /executor.*debug/);
  // missing fields render as '?'
  assert.match(out, /\?\s+forensics/);
});

// --- renderForensicsSummarize ---

test('renderForensicsSummarize — empty / nullish input shows "No failures."', () => {
  assert.match(render.renderForensicsSummarize({}), /No failures\./);
  assert.match(render.renderForensicsSummarize(null), /No failures\./);
  assert.match(render.renderForensicsSummarize(undefined), /No failures\./);
});

test('renderForensicsSummarize — populated entries render agent/count', () => {
  const byAgent = {
    planner: [{ id: 1 }, { id: 2 }],
    executor: [{ id: 3 }],
  };
  const out = render.renderForensicsSummarize(byAgent);
  assert.match(out, /planner.*2/);
  assert.match(out, /executor.*1/);
});

// --- renderListReplays ---

test('renderListReplays — null/undefined input shows "No replays recorded."', () => {
  assert.match(render.renderListReplays(null), /No replays recorded\./);
  assert.match(render.renderListReplays(undefined), /No replays recorded\./);
});

test('renderListReplays — empty array shows "No replays recorded."', () => {
  assert.match(render.renderListReplays([]), /No replays recorded\./);
});

test('renderListReplays — populated array shows id/agent/timestamp', () => {
  const items = [
    { id: 'r1', agent: 'planner', timestamp: '2026-01-01' },
    { id: 'r2', agent: 'executor', timestamp: '2026-02-02' },
  ];
  const out = render.renderListReplays(items);
  assert.match(out, /r1.*planner/);
  assert.match(out, /r2.*executor/);
  assert.match(out, /2026-01-01/);
});

// --- renderInstallTargets ---

test('renderInstallTargets — joins scopes with comma', () => {
  const targets = [
    { id: 'claude-code', label: 'Claude Code', scopes: ['user', 'project'] },
    { id: 'codex', label: 'Codex', scopes: ['user'] },
  ];
  const out = render.renderInstallTargets(targets);
  assert.match(out, /claude-code/);
  assert.match(out, /user, project/);
  assert.match(out, /codex/);
});

test('renderInstallTargets — handles missing scopes (undefined → ?)', () => {
  const targets = [{ id: 'foo', label: 'Foo' }];
  const out = render.renderInstallTargets(targets);
  assert.match(out, /foo/);
  assert.match(out, /\?/);
});

// --- renderInstallResult ---

test('renderInstallResult — dry-run renders preview-style title with hint', () => {
  const result = {
    dryRun: true, target: 'claude-code', scope: 'user',
    path: '/home/user/.claude/config', name: 'kit', via: 'local',
  };
  const out = render.renderInstallResult(result);
  assert.match(out, /Install preview \(claude-code, scope=user\)/);
  assert.match(out, /\/home\/user\/\.claude\/config/);
  assert.match(out, /No file written/);
});

test('renderInstallResult — non-dry-run renders Registered title (no hint)', () => {
  const result = {
    dryRun: false, target: 'claude-code', scope: 'user',
    path: '/x', name: 'kit', via: 'npx',
  };
  const out = render.renderInstallResult(result);
  assert.match(out, /Registered kit-mcp → claude-code \(scope=user\)/);
  assert.match(out, /Path/);
  assert.match(out, /Via.*npx/);
});

test('renderInstallResult — missing fields fall back to "—"', () => {
  const result = { dryRun: false, target: 'x', scope: 'user' };
  const out = render.renderInstallResult(result);
  // path/via undefined but `name` defaults to 'kit'; both renderable
  assert.match(out, /—|kit/);
});

// --- renderFallback ---

test('renderFallback — formats arbitrary object as pretty JSON', () => {
  const out = render.renderFallback({ foo: 'bar', n: 42 });
  assert.match(out, /"foo": "bar"/);
  assert.match(out, /"n": 42/);
  // 2-space indent (per JSON.stringify(v, null, 2))
  assert.match(out, /\{\n  "foo"/);
  assert.ok(out.endsWith('\n'));
});

test('renderFallback — handles arrays', () => {
  const out = render.renderFallback([1, 2, 3]);
  assert.match(out, /\[\s*1,\s*2,\s*3\s*\]/);
});
