#!/usr/bin/env node
// DX-15-01: regen the AUTOGEN-COUNTS block in README.md from real kit/ counts.
// Idempotent: if counts already match, the file is NOT rewritten (no-op = zero diff).
// Run standalone (`node scripts/update-readme-counts.js`) or import { updateReadmeCounts }.
//
// Counted categories:
//   - kit/agents/*.md
//   - kit/commands/*.md
//   - kit/skills/*/SKILL.md  (one count per subdir that contains SKILL.md)
//   - gates/*.md
//
// Block format in README.md (single line of content):
//   <!-- AUTOGEN-COUNTS-START -->
//   **Bundled workflow:** {N} agents · {N} commands · {N} skills · {N} gates
//   <!-- AUTOGEN-COUNTS-END -->
//
// Throws if the block markers are absent — README must already contain them
// (Task 1 of plan 86-01 establishes the block once).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');

const START = '<!-- AUTOGEN-COUNTS-START -->';
const END = '<!-- AUTOGEN-COUNTS-END -->';

async function countMdIn(dirAbs) {
  const ents = await readdir(dirAbs, { withFileTypes: true });
  return ents.filter((e) => e.isFile() && e.name.endsWith('.md')).length;
}

async function countSkillsIn(skillsRootAbs) {
  const ents = await readdir(skillsRootAbs, { withFileTypes: true });
  let n = 0;
  for (const ent of ents) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('_')) continue; // _shared-* are glossaries, not skills
    try {
      const buf = await readFile(path.join(skillsRootAbs, ent.name, 'SKILL.md'));
      if (buf) n++;
    } catch {
      /* not a skill */
    }
  }
  return n;
}

export async function updateReadmeCounts(repoRoot = REPO_ROOT_DEFAULT) {
  const agents = await countMdIn(path.join(repoRoot, 'kit', 'agents'));
  const commands = await countMdIn(path.join(repoRoot, 'kit', 'commands'));
  const skills = await countSkillsIn(path.join(repoRoot, 'kit', 'skills'));
  const gates = await countMdIn(path.join(repoRoot, 'gates'));
  const counts = { agents, commands, skills, gates };

  const readmePath = path.join(repoRoot, 'README.md');
  const before = await readFile(readmePath, 'utf8');

  const startIdx = before.indexOf(START);
  const endIdx = before.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      'README.md missing AUTOGEN-COUNTS block — add ' + START + ' and ' + END + ' first.'
    );
  }

  // Preserve the existing README's line-ending convention. Without this, on
  // Windows checkouts (CRLF) the script would rewrite the block with LF and
  // leave the file in a "modified" state per `git status` even though counts
  // already match — breaking the idempotency contract.
  const eol = before.includes('\r\n') ? '\r\n' : '\n';

  const newBlock =
    START +
    eol +
    '**Bundled workflow:** ' +
    agents +
    ' agents · ' +
    commands +
    ' commands · ' +
    skills +
    ' skills · ' +
    gates +
    ' gates' +
    eol +
    END;

  const after = before.slice(0, startIdx) + newBlock + before.slice(endIdx + END.length);

  if (after === before) {
    return { changed: false, counts };
  }
  await writeFile(readmePath, after, 'utf8');
  return { changed: true, counts };
}

// Run standalone: emit a single-line summary on stderr; exit 0 on success.
const argvPath = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
const metaPath = import.meta.url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
if (
  import.meta.url === `file://${argvPath}` ||
  process.argv[1] === __filename ||
  argvPath.endsWith('update-readme-counts.js') ||
  metaPath === argvPath
) {
  try {
    const { changed, counts } = await updateReadmeCounts();
    process.stderr.write(
      (changed ? '[update-readme-counts] updated' : '[update-readme-counts] no-op') +
        ' — ' +
        counts.agents +
        ' agents, ' +
        counts.commands +
        ' commands, ' +
        counts.skills +
        ' skills, ' +
        counts.gates +
        ' gates\n'
    );
  } catch (e) {
    process.stderr.write('[update-readme-counts] ERROR: ' + e.message + '\n');
    process.exit(1);
  }
}
