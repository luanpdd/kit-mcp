#!/usr/bin/env node
// Quick sanity check — ensures TOOLS descriptions stay under 1024 chars.
import { promises as fs } from 'node:fs';

const src = await fs.readFile('src/mcp-server/index.js', 'utf8');
const lines = src.split('\n');
let inTools = false;
let braceDepth = 0;
let currentName = null;
const results = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^const TOOLS = \[/.test(line)) { inTools = true; continue; }
  if (!inTools) continue;
  if (/^\];/.test(line.trim())) break;

  const nm = line.match(/^\s*name:\s*'([^']+)'/);
  if (nm) currentName = nm[1];

  const dm = line.match(/^\s*description:\s*'(.+)',?\s*$/);
  if (dm && currentName) {
    // Unescape \' to '
    const desc = dm[1].replace(/\\'/g, "'");
    results.push({ name: currentName, len: desc.length, over: desc.length > 1024 });
    currentName = null;
  }
}

for (const r of results) {
  console.log(r.name.padEnd(20), String(r.len).padStart(4), 'chars', r.over ? '⚠ OVER 1024' : '');
}
const over = results.filter((r) => r.over);
console.log(`\n${results.length} tools, ${over.length} over 1024 chars`);
process.exit(over.length === 0 ? 0 : 1);
