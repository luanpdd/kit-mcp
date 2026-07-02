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
//
// DIR-01: also rewrites the counts inside the "Estrutura do kit" ASCII tree
// (`├── agents/  {N} agents executáveis`, `{N} slash-commands`,
// `{N} skills consultáveis`) so the README can never self-contradict again.
// Throws if any of these tree mentions is absent — same contract as the
// AUTOGEN block, keeping every count mention under this script's guard.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');

const START = '<!-- AUTOGEN-COUNTS-START -->';
const END = '<!-- AUTOGEN-COUNTS-END -->';

// DIR-01: count mentions in the "Estrutura do kit" ASCII tree. Each regex must
// match the README exactly once; the number between the anchors is rewritten.
const TREE_MENTIONS = [
  { label: 'agents', re: /(agents\/\s+)\d+( agents executáveis)/, pick: (c) => c.agents },
  { label: 'commands', re: /(commands\/\s+)\d+( slash-commands)/, pick: (c) => c.commands },
  { label: 'skills', re: /(skills\/\s+)\d+( skills consultáveis)/, pick: (c) => c.skills },
];

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

  let after = before.slice(0, startIdx) + newBlock + before.slice(endIdx + END.length);

  // DIR-01: keep the "Estrutura do kit" tree counts in sync with the same
  // source of truth. Missing mention = hard error, so a README reword cannot
  // silently drop a count out of this guard.
  for (const mention of TREE_MENTIONS) {
    if (!mention.re.test(after)) {
      throw new Error(
        'README.md missing "Estrutura do kit" count mention for ' +
          mention.label +
          ' (expected pattern ' +
          mention.re +
          ') — restore the tree line or update TREE_MENTIONS in scripts/update-readme-counts.js.'
      );
    }
    after = after.replace(mention.re, (_m, p1, p2) => p1 + mention.pick(counts) + p2);
  }

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
