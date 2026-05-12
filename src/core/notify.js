// src/core/notify.js — opt-in OS-level notification on MCP tool call.
//
// Phase 164 (v1.28). Off by default — set KIT_MCP_NOTIFY=1 to enable.
// Cross-platform best-effort: PowerShell BurntToast/MessageBox on Windows,
// osascript on macOS, notify-send on Linux. Failure is silent.
//
// Throttled: minimum 5s between notifications (configurable via
// KIT_MCP_NOTIFY_THROTTLE_MS) to prevent flood.

import { spawn } from 'node:child_process';

const DEFAULT_THROTTLE_MS = 5000;
let lastNotifyAt = 0;

function throttleMs() {
  const raw = process.env.KIT_MCP_NOTIFY_THROTTLE_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THROTTLE_MS;
}

export function isNotifyEnabled() {
  return process.env.KIT_MCP_NOTIFY === '1' || process.env.KIT_MCP_NOTIFY === 'true';
}

function spawnDetached(cmd, args) {
  try {
    const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    c.unref();
  } catch { /* swallow — notification must never break the server */ }
}

// notify({title, body}): fire a best-effort OS notification. Throttled.
export function notify({ title, body } = {}) {
  if (!isNotifyEnabled()) return;
  const now = Date.now();
  if (now - lastNotifyAt < throttleMs()) return;
  lastNotifyAt = now;

  const t = (title || 'kit-mcp').replace(/"/g, "'");
  const b = (body || '').replace(/"/g, "'");

  if (process.platform === 'darwin') {
    spawnDetached('osascript', ['-e', `display notification "${b}" with title "${t}"`]);
  } else if (process.platform === 'linux') {
    spawnDetached('notify-send', [t, b]);
  } else if (process.platform === 'win32') {
    // PowerShell toast via Windows.UI.Notifications. Falls back silently if
    // BurntToast not installed — we use the simpler msg via WScript.Shell.
    const ps = `Add-Type -AssemblyName System.Windows.Forms; `
      + `$n = New-Object System.Windows.Forms.NotifyIcon; `
      + `$n.Icon = [System.Drawing.SystemIcons]::Information; `
      + `$n.BalloonTipTitle = "${t}"; `
      + `$n.BalloonTipText = "${b}"; `
      + `$n.Visible = $true; `
      + `$n.ShowBalloonTip(3000); `
      + `Start-Sleep -Seconds 4; `
      + `$n.Dispose()`;
    spawnDetached('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  }
}
