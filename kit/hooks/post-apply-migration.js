#!/usr/bin/env node
// hook-version: 1.4.1
// SEC-13-05: flush-before-exit category = A (stderr.write + immediate exit)
// Fix applied: process.stderr.write(summary, () => process.exit(0)) on success path.
// kit-mcp · Post-apply Migration Hook (PostToolUse)
//
// Triggers automatically AFTER a successful Supabase MCP apply_migration call.
// Performs the 3 manual steps that devs always forget:
//
//   (a) Mirror the .sql to supabase/migrations/{TIMESTAMP}_{name}.sql
//       so the project's git history captures the migration.
//   (b) Create a stub note in the Obsidian vault under
//       07 - Banco de Dados/Migrations/{YYYY}/{TIMESTAMP}_{name}.md
//       (only if the vault is detected — same heuristic as /publicar Step 0.7).
//   (c) Stage both files in git so the next commit picks them up.
//
// All three steps are SOFT — failures log to stderr and continue.
// The hook never blocks the calling tool.
//
// Enable via .claude/settings.json:
//   "hooks": {
//     "post_apply_migration": true
//   }
//
// Triggered on PostToolUse for tool_name matching Supabase MCP apply_migration.
// Reads from stdin a JSON envelope including:
//   tool_name        — full tool id, ex "mcp__0a71...__apply_migration"
//   tool_input       — { name: "20260409_contact_prefs", query: "ALTER TABLE..." }
//   tool_response    — server response (if available)
//   project_root     — absolute path to the project (best-effort)

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';

    // Match any MCP tool ending in apply_migration.
    if (!/apply_migration$/.test(toolName)) {
      process.exit(0);
    }

    const migrationName = data.tool_input?.name || '';
    const sqlBody = data.tool_input?.query || '';
    if (!migrationName || !sqlBody) {
      process.stderr.write('[post-apply-migration] missing name or query — skipping\n');
      process.exit(0);
    }

    const projectRoot = data.project_root || process.cwd();
    const ts = formatTimestamp(new Date());
    const safeName = migrationName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${ts}_${safeName}.sql`;

    // --- (a) mirror to supabase/migrations/ ---
    const targetDir = path.join(projectRoot, 'supabase', 'migrations');
    let mirroredPath = null;
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      mirroredPath = path.join(targetDir, fileName);
      fs.writeFileSync(mirroredPath, sqlBody, 'utf8');
      process.stderr.write(`[post-apply-migration] ✓ mirrored to ${path.relative(projectRoot, mirroredPath)}\n`);
    } catch (err) {
      process.stderr.write(`[post-apply-migration] ⚠ mirror failed: ${err.message}\n`);
    }

    // --- (b) stub in Obsidian vault (best-effort) ---
    const vault = detectObsidianVault();
    let stubPath = null;
    if (vault) {
      try {
        const year = new Date().getFullYear();
        const stubDir = path.join(vault, '07 - Banco de Dados', 'Migrations', String(year));
        fs.mkdirSync(stubDir, { recursive: true });
        stubPath = path.join(stubDir, `${ts}_${safeName}.md`);
        if (!fs.existsSync(stubPath)) {
          fs.writeFileSync(stubPath, renderStub(migrationName, sqlBody, ts), 'utf8');
          process.stderr.write(`[post-apply-migration] ✓ stub criado em ${path.relative(vault, stubPath)}\n`);
        }
      } catch (err) {
        process.stderr.write(`[post-apply-migration] ⚠ stub failed: ${err.message}\n`);
      }
    } else {
      process.stderr.write('[post-apply-migration] vault não detectado — pulando stub\n');
    }

    // --- (c) git stage (best-effort) ---
    if (mirroredPath) {
      try {
        execSync(`git add "${path.relative(projectRoot, mirroredPath)}"`, { cwd: projectRoot, stdio: 'ignore' });
        process.stderr.write('[post-apply-migration] ✓ staged no git\n');
      } catch (err) {
        // Project may not be a git repo, or .sql may be ignored. Soft-fail.
      }
    }

    // The final advisory printed back to Claude (and to the user via stderr)
    // SEC-13-05: aguardar flush do stderr antes do exit. Sem callback, o
    // resumo final pode ser dropado em pipes lentos (CI/Windows). Os outros
    // process.stderr.write intermediários (linhas ~71/87/93/100) NÃO precisam
    // do callback porque o process continua executando após eles — o event
    // loop drena o buffer naturalmente antes do próximo write.
    if (mirroredPath || stubPath) {
      const lines = ['[post-apply-migration] resumo:'];
      if (mirroredPath) lines.push(`  • SQL: ${path.relative(projectRoot, mirroredPath)}`);
      if (stubPath)     lines.push(`  • Stub: ${path.relative(vault, stubPath)}`);
      lines.push('  → cofre Obsidian: edite o stub e commite quando puder.');
      process.stderr.write(lines.join('\n') + '\n', () => process.exit(0));
      return;
    }

    process.exit(0);
  } catch (err) {
    process.stderr.write(`[post-apply-migration] hook error: ${err.message}\n`);
    process.exit(0);
  }
});

// ───────────────────────────────────────────────────────── helpers

function formatTimestamp(d) {
  // YYYYMMDDHHMMSS — same convention used by Supabase migrations.
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function detectObsidianVault() {
  // Mesma heurística do Passo 0.7 do /publicar.
  if (process.env.OBSIDIAN_TEAM_VAULT && fs.existsSync(process.env.OBSIDIAN_TEAM_VAULT)) {
    return process.env.OBSIDIAN_TEAM_VAULT;
  }
  const candidates = [
    process.env.HOME && path.join(process.env.HOME, 'Documentos', 'Obsidian', 'chat-trynux'),
    process.env.HOME && path.join(process.env.HOME, 'Documents', 'Obsidian', 'chat-trynux'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'Documentos', 'Obsidian', 'chat-trynux'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'Documents', 'Obsidian', 'chat-trynux'),
    process.env.USER && path.join('/mnt/c/Users', process.env.USER, 'Documents', 'Obsidian', 'chat-trynux'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c; } catch { /* noop */ }
  }
  return null;
}

function renderStub(name, sql, ts) {
  const firstLines = sql
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('--'))
    .slice(0, 8)
    .join('\n');
  return [
    '---',
    `migration: "${name}"`,
    `applied_at: ${new Date().toISOString()}`,
    `timestamp: ${ts}`,
    'status: applied',
    'pr: (preencher quando abrir PR)',
    '---',
    '',
    `# ${name}`,
    '',
    '## O que essa migration faz',
    '',
    '_(uma frase, em linguagem de produto)_',
    '',
    '## Tabelas / colunas afetadas',
    '',
    '_(liste tabelas, colunas, FKs novas/alteradas)_',
    '',
    '## Como reverter',
    '',
    '_(comando ou DDL para desfazer; "irreversível" se for o caso)_',
    '',
    '## Primeiras linhas (para referência)',
    '',
    '```sql',
    firstLines,
    '```',
    '',
  ].join('\n');
}
