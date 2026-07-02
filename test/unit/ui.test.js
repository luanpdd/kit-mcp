import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Force NO_COLOR before importing ui.js (the COLOR_ON detection runs at module load).
const prevNoColor = process.env.NO_COLOR;
process.env.NO_COLOR = '1';

const { c, icons, summary } = await import('../../src/core/ui.js');

after(() => {
  if (prevNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = prevNoColor;
});

test('c.green honors NO_COLOR (returns plain text)', () => {
  const out = c.green('hello');
  assert.equal(out, 'hello', 'NO_COLOR should disable ANSI codes');
});

test('icons set is non-empty and contains the expected verbs', () => {
  assert.ok(icons.check);
  assert.ok(icons.cross);
  assert.ok(icons.warn);
  assert.ok(Array.isArray(icons.spinner));
  assert.ok(icons.spinner.length >= 8);
});

test('summary — renders title, rows with counts, and total line', () => {
  const out = summary({
    title: 'Synced kit-mcp → claude-code',
    rows: [
      ['Agents',    19],
      ['Commands',  60],
      ['Skills',     1],
      ['Framework',134],
      ['Hooks',      5],
    ],
    total: 219,
    hint: 'project: /tmp/foo',
  });
  // Title with check icon
  assert.match(out, /✓ Synced kit-mcp → claude-code/);
  // Each row label + count
  assert.match(out, /Agents\s+19\s+✓/);
  assert.match(out, /Commands\s+60\s+✓/);
  assert.match(out, /Framework\s+134\s+✓/);
  // Total line
  assert.match(out, /Total: 219/);
  assert.match(out, /project: \/tmp\/foo/);
});

test('summary — handles empty rows gracefully', () => {
  const out = summary({ title: 'Nothing to do', rows: [], total: 0 });
  assert.match(out, /✓ Nothing to do/);
  assert.match(out, /Total: 0/);
});

test('summary — zero counts dimmed (still has fallback ✓ icon)', () => {
  const out = summary({
    title: 'Status',
    rows: [['Skills', 0]],
    total: 0,
  });
  // With NO_COLOR active, both 0 and ✓ render as plain — what matters is structure
  assert.match(out, /Skills\s+0\s+✓/);
});

test('summary — fail status row shows cross', () => {
  const out = summary({
    title: 'Sync',
    rows: [['Agents', 5, 'fail']],
    total: 5,
  });
  assert.match(out, /Agents\s+5\s+✗/);
});
