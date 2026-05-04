// src/ui/browser.js
// Cross-platform browser opener. Wraps `open@11` with detection for environments
// where launching a browser silently fails (CI, headless SSH, WSL, sandboxed
// macOS Terminal). In those environments we DON'T attempt to launch — we just
// print the URL to stderr so the user can copy it.
//
// Discipline: nothing on stdout. Audit gate enforced by Phase 11 CI.

import process from 'node:process';

let openModule = null;

async function loadOpen() {
  if (openModule) return openModule;
  try {
    const mod = await import('open');
    openModule = mod.default || mod;
    return openModule;
  } catch (err) {
    return null;
  }
}

// isHeadless heuristics — designed to err on the side of NOT launching.
// Returns a reason string when headless, or null when a browser launch is plausible.
export function detectHeadless(env = process.env, plat = process.platform) {
  if (env.CI && env.CI !== 'false') return 'CI=' + env.CI;
  if (env.KIT_MCP_NO_OPEN === '1' || env.KIT_MCP_NO_OPEN === 'true') return 'KIT_MCP_NO_OPEN';
  if (env.TERM === 'dumb') return 'TERM=dumb';
  // Linux without a display server is headless. WSL is special: it forwards
  // to the Windows host browser via wslview, so we let `open` try.
  if (plat === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    if (env.WSL_DISTRO_NAME || env.WSLENV) return null; // WSL — let `open` try (it'll use wslview)
    return 'no_display';
  }
  // SSH session without local display — no good way to open in user's browser.
  if (env.SSH_CONNECTION && plat !== 'win32' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    return 'ssh_no_display';
  }
  return null;
}

// openBrowser(url, opts):
//   { opened: true,  via: 'open' }                    on success
//   { opened: false, reason: 'headless:<why>', url }  when headless detected
//   { opened: false, reason: 'no_module' }            if `open` package missing
//   { opened: false, reason: 'launch_failed:<msg>' }  if open() throws
//
// Always calls process.stderr.write with the URL so the user can copy it manually.
export async function openBrowser(url, { force = false } = {}) {
  process.stderr.write(`[kit-mcp ui] ${url}\n`);

  if (!force) {
    const headless = detectHeadless();
    if (headless) {
      process.stderr.write(`[kit-mcp ui] not opening browser (${headless}) — open the URL above manually\n`);
      return { opened: false, reason: `headless:${headless}`, url };
    }
  }

  const open = await loadOpen();
  if (!open) {
    process.stderr.write('[kit-mcp ui] `open` package not available — open the URL above manually\n');
    return { opened: false, reason: 'no_module' };
  }

  try {
    // open() returns a child process; we don't await its exit (it's the browser).
    // We just need to know that the spawn succeeded.
    await open(url);
    return { opened: true, via: 'open' };
  } catch (err) {
    process.stderr.write(`[kit-mcp ui] browser launch failed: ${err.message} — open the URL above manually\n`);
    return { opened: false, reason: `launch_failed:${err.message}` };
  }
}

export const __test = { loadOpen };
