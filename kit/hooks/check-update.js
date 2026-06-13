#!/usr/bin/env node
// hook-version: 1.30.0
// SEC-13-05: flush-before-exit category = E (parent returns after spawn unref; child uses sync fs writes) — no fix needed
// Check for framework updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const homeDir = os.homedir();
const cwd = process.cwd();

// Detect runtime config directory (supports Claude, OpenCode, Antigravity via ~/.gemini)
// Respects CLAUDE_CONFIG_DIR for custom config directory setups
function detectConfigDir(baseDir) {
  // Check env override first (supports multi-account setups)
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  if (envDir && fs.existsSync(path.join(envDir, 'framework', 'VERSION'))) {
    return envDir;
  }
  for (const dir of ['.config/opencode', '.opencode', '.gemini', '.claude']) {
    if (fs.existsSync(path.join(baseDir, dir, 'framework', 'VERSION'))) {
      return path.join(baseDir, dir);
    }
  }
  return envDir || path.join(baseDir, '.claude');
}

const globalConfigDir = detectConfigDir(homeDir);
const projectConfigDir = detectConfigDir(cwd);
const cacheDir = path.join(globalConfigDir, 'cache');
const cacheFile = path.join(cacheDir, 'update-check.json');

// VERSION file locations (check project first, then global)
const projectVersionFile = path.join(projectConfigDir, 'framework', 'VERSION');
const globalVersionFile = path.join(globalConfigDir, 'framework', 'VERSION');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Run check in background (spawn background process, windowsHide prevents console flash)
// SEC-13-05: parent process retorna imediatamente após child.unref() — não
// há buffered I/O no parent. Child usa fs.writeFileSync (sync), sem race.
// Categoria E na taxonomia da Phase 80.
const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  // Check project directory first (local install), then global
  let installed = '0.0.0';
  let configDir = '';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(projectVersionFile));
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(globalVersionFile));
    }
  } catch (e) {}

  // Check for stale hooks — compare hook version headers against installed VERSION
  // Hooks live inside framework/hooks/, not configDir/hooks/
  let staleHooks = [];
  if (configDir) {
    const hooksDir = path.join(configDir, 'framework', 'hooks');
    try {
      if (fs.existsSync(hooksDir)) {
        const hookFiles = fs.readdirSync(hooksDir).filter(f => f.startsWith('framework-') && f.endsWith('.js'));
        for (const hookFile of hookFiles) {
          try {
            const content = fs.readFileSync(path.join(hooksDir, hookFile), 'utf8');
            const versionMatch = content.match(/\\/\\/ hook-version:\\s*(.+)/);
            if (versionMatch) {
              const hookVersion = versionMatch[1].trim();
              if (hookVersion !== installed && !hookVersion.includes('{{')) {
                staleHooks.push({ file: hookFile, hookVersion, installedVersion: installed });
              }
            } else {
              // No version header at all — definitely stale (pre-version-tracking)
              staleHooks.push({ file: hookFile, hookVersion: 'unknown', installedVersion: installed });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  let latest = null;
  try {
    latest = execSync('npm view framework-cc version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000),
    stale_hooks: staleHooks.length > 0 ? staleHooks : undefined
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: true  // Required on Windows for proper process detachment
});

child.unref();
