// Install kit-mcp into an IDE's MCP-server config.
//
// Strategies:
//   merge-mcpServers-json — read JSON, merge `mcpServers[name]`, write back
//   append-toml-snippet   — print TOML snippet for the user to paste (Codex)
//
// We never overwrite blindly: existing entries with the same name are replaced
// only if --force is passed, otherwise we abort with a clear message.

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getTarget, listTargets } from '../core/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '../..');

export async function installMcp(targetId, opts = {}) {
  const target = getTarget(targetId);
  if (!target.mcpConfig) {
    return { ok: false, target: targetId, reason: `${target.label} has no MCP config integration in registry.` };
  }

  const scope   = opts.scope ?? 'user'; // 'user' | 'project'
  const name    = opts.name  ?? 'kit';
  const dryRun  = !!opts.dryRun;
  const force   = !!opts.force;

  const entry = buildServerEntry(opts);
  const configPath = resolveConfigPath(target.mcpConfig, scope, opts.projectRoot);
  if (!configPath) {
    return { ok: false, target: targetId, reason: `Could not resolve config path for scope=${scope}.` };
  }

  if (target.mcpConfig.strategy === 'merge-mcpServers-json') {
    return await mergeJson(configPath, target.mcpConfig.userKey ?? 'mcpServers', name, entry, { dryRun, force, target: targetId });
  }
  if (target.mcpConfig.strategy === 'append-toml-snippet') {
    return await appendToml(configPath, name, entry, { dryRun, force, target: targetId });
  }
  return { ok: false, target: targetId, reason: `Unknown strategy: ${target.mcpConfig.strategy}` };
}

export function listInstallTargets() {
  return listTargets().filter(t => t.capabilities.mcpConfig);
}

// --- helpers ---

function buildServerEntry(opts) {
  // Three modes:
  //   via=local (default) — point at this clone's bin/mcp.js with the running node
  //   via=npx             — `npx -y @luanpdd/kit-mcp` (portable, works on any machine after publish)
  //   via=global          — `kit-mcp` (assumes user has `npm install -g @luanpdd/kit-mcp`)
  // Override anything with explicit --command / --args.
  const via = opts.via ?? 'local';
  let command, args;

  if (via === 'npx') {
    command = 'npx';
    args = ['-y', opts.pkg ?? '@luanpdd/kit-mcp'];
  } else if (via === 'global') {
    command = 'kit-mcp';
    args = [];
  } else {
    command = process.execPath;
    args = [path.join(REPO_ROOT, 'bin', 'mcp.js')];
  }

  return {
    command: opts.command ?? command,
    args:    opts.args    ?? args,
    env:     opts.env     ?? {},
  };
}

function resolveConfigPath(cfg, scope, projectRoot) {
  if (scope === 'user' && cfg.userPath)   return expandHome(cfg.userPath);
  if (scope === 'project' && cfg.path)    return path.join(path.resolve(projectRoot ?? process.cwd()), cfg.path);
  if (cfg.userPath) return expandHome(cfg.userPath);
  if (cfg.path)     return path.join(path.resolve(projectRoot ?? process.cwd()), cfg.path);
  return null;
}

function expandHome(p) {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

async function mergeJson(filePath, key, name, entry, { dryRun, force, target }) {
  let json = {};
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    json = JSON.parse(raw);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      return { ok: false, target, reason: `Failed to parse existing config at ${filePath}: ${e.message}` };
    }
  }
  json[key] ??= {};
  if (json[key][name] && !force) {
    return {
      ok: false, target, configPath: filePath,
      reason: `An MCP server named "${name}" already exists in ${filePath}. Re-run with --force to replace, or pass --name <other>.`,
    };
  }
  json[key][name] = entry;

  if (dryRun) {
    return { ok: true, target, configPath: filePath, dryRun: true, preview: json };
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  return { ok: true, target, configPath: filePath, name, entry };
}

async function appendToml(filePath, name, entry, { dryRun, target }) {
  // Codex MCP entries in TOML look like:
  //   [mcp_servers.kit]
  //   command = "node"
  //   args = ["/abs/path/bin/mcp.js"]
  const toml = [
    `[mcp_servers.${name}]`,
    `command = ${JSON.stringify(entry.command)}`,
    `args = ${JSON.stringify(entry.args)}`,
    Object.keys(entry.env || {}).length
      ? `env = { ${Object.entries(entry.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')} }`
      : null,
    '',
  ].filter(Boolean).join('\n');

  if (dryRun) {
    return { ok: true, target, configPath: filePath, dryRun: true, snippet: toml };
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // Append (Codex tolerates duplicate sections only with [tables.*]; manual review encouraged).
  let existing = '';
  try { existing = await fs.readFile(filePath, 'utf8'); } catch {}
  if (existing.includes(`[mcp_servers.${name}]`)) {
    return {
      ok: false, target, configPath: filePath,
      reason: `[mcp_servers.${name}] already exists in ${filePath}. Edit by hand or pass --name <other>.`,
    };
  }
  await fs.writeFile(filePath, existing + (existing.endsWith('\n') ? '' : '\n') + toml, 'utf8');
  return { ok: true, target, configPath: filePath, snippet: toml };
}
