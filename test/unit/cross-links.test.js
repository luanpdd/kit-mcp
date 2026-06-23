// Cross-link integrity gate (KIT-AUDIT P1).
//
// Every relative Markdown link `](path.md)` inside kit/ must resolve to a real
// file. Catches the 3 broken-link patterns the audit found (../kit/, deep
// ../../../../kit/, and skill→skill ../skills/X) and any future regression.
//
// Excluded by design:
//   - absolute links (http:, https:, mailto:)
//   - template placeholders containing `{` (e.g. ./{phase}-USER-SETUP.md in
//     kit/framework/templates/ — resolved at framework-render time, not a real path)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const KIT_ROOT = path.resolve(import.meta.dirname, '..', '..', 'kit');

function walkMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(p));
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Matches markdown links to a *.md target (with optional #anchor), no whitespace
// in the path. Captures the path part only.
const LINK_RE = /\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g;

test('cross-links: every relative .md link inside kit/ resolves to a real file', () => {
  const files = walkMarkdown(KIT_ROOT);
  const broken = [];

  for (const file of files) {
    const txt = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = LINK_RE.exec(txt)) !== null) {
      const link = m[1];
      if (/^(https?:|mailto:)/.test(link)) continue; // external
      if (link.includes('{')) continue; // template placeholder (rendered later)
      const target = path.resolve(path.dirname(file), link);
      if (!fs.existsSync(target)) {
        broken.push(`${path.relative(KIT_ROOT, file).split(path.sep).join('/')} -> ${link}`);
      }
    }
  }

  assert.deepEqual(
    broken,
    [],
    `Broken relative .md links in kit/ (${broken.length}):\n  ${broken.join('\n  ')}`,
  );
});
