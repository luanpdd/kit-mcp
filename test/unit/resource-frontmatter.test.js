// Quality gate (v1.41): every agent/skill/command frontmatter honors the
// canonical invariants. This is the blocking enforcement that runs in
// prepublishOnly (via the same pure checker the gates/resource-frontmatter.md
// gate shells out to). Bash-free → identical behavior on Windows and Linux.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkResourceFrontmatter } from '../../scripts/check-resource-frontmatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(__dirname, '..', '..', 'kit');

test('resource-frontmatter: every agent/skill/command frontmatter is valid', async () => {
  const { ok, violations } = await checkResourceFrontmatter(KIT_ROOT);
  const report = violations.map((v) => `  ${v.file} — [${v.rule}] ${v.detail}`).join('\n');
  assert.ok(ok, `frontmatter gate found ${violations.length} violation(s):\n${report}`);
});

test('resource-frontmatter: checker actually catches violations (self-test)', async () => {
  // Run against a synthetic kit fixture written on the fly to prove the checker
  // is not vacuously passing.
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-fm-'));
  const agentsDir = path.join(tmp, 'agents');
  await fs.mkdir(agentsDir, { recursive: true });
  // Bad agent: invalid cost_tier, ellipsis, colon-space, unknown tool.
  await fs.writeFile(
    path.join(agentsDir, 'bad.md'),
    '---\nname: bad\ncost_tier: enorme\ndescription: faz coisas: incríveis e mais…\ntools: Read, Frobnicate\n---\nbody\n',
    'utf8',
  );
  const { ok, violations } = await checkResourceFrontmatter(tmp);
  await fs.rm(tmp, { recursive: true, force: true });
  assert.equal(ok, false);
  const rules = new Set(violations.map((v) => v.rule));
  assert.ok(rules.has('cost_tier-invalid'), 'detecta cost_tier inválido');
  assert.ok(rules.has('description-ellipsis'), 'detecta reticências');
  assert.ok(rules.has('description-colon-space'), 'detecta ": " não-aspado');
  assert.ok(rules.has('tool-unknown'), 'detecta tool desconhecida');
});
