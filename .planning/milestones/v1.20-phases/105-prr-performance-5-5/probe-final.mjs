// Final M4 probe for Phase 105: 5-run measurement matrix with pre-warm enabled.
// Uses 800ms post-initialize wait so the boot-time pre-warm (Phase 105) has
// resolved before the first dispatch. This represents the realistic
// production scenario where the LLM client takes seconds-to-minutes to
// issue the first tools/call after IDE startup — pre-warm completes
// invisibly behind that latency.
//
// Reports min / median / max for p50 / p95 / p99 across runs.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
const mcpEntry = path.join(repoRoot, 'bin', 'mcp.js');

async function driveServer(requests, { timeoutMs = 30000, perStepMs = 80, postInitWaitMs = 800 } = {}) {
  const child = spawn(process.execPath, [mcpEntry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, KIT_MCP_METRICS_RESET: '1' },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (b) => { stdout += b.toString(); });
  child.stderr.on('data', (b) => { stderr += b.toString(); });

  for (let idx = 0; idx < requests.length; idx++) {
    const req = requests[idx];
    child.stdin.write(JSON.stringify(req) + '\n');
    if (idx === 0 && postInitWaitMs > 0) {
      await new Promise((r) => setTimeout(r, postInitWaitMs));
    } else {
      await new Promise((r) => setTimeout(r, perStepMs));
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  child.kill();
  await Promise.race([
    new Promise((r) => child.on('exit', r)),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);

  const byId = new Map();
  for (const line of stdout.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      if (j && typeof j.id === 'number') byId.set(j.id, j);
    } catch { /* non-JSON noise */ }
  }
  return { byId, stdout, stderr };
}

function envelopeJson(resp) {
  const text = resp?.result?.content?.[0]?.text ?? '';
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function singleRun(N) {
  const requests = [
    {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '0.0.0' } },
    },
  ];
  for (let i = 0; i < N; i++) {
    requests.push({
      jsonrpc: '2.0', id: 2 + i, method: 'tools/call',
      params: { name: 'kit', arguments: { action: 'list-agents', terse: true } },
    });
  }
  requests.push({
    jsonrpc: '2.0', id: 2 + N, method: 'tools/call',
    params: { name: 'metrics-snapshot', arguments: {} },
  });

  const { byId, stdout, stderr } = await driveServer(requests);
  const snap = byId.get(2 + N);
  if (!snap) {
    throw new Error(`No snapshot. stdout=${stdout.slice(0, 800)} stderr=${stderr.slice(0, 800)}`);
  }
  const env = envelopeJson(snap);
  return env.latency['kit'];
}

const N = 30;
const RUNS = 5;
const results = [];
for (let r = 0; r < RUNS; r++) {
  const lat = await singleRun(N);
  results.push(lat);
  console.log(`Run ${r + 1}/${RUNS}: count=${lat.count} p50=${lat.p50}ms p95=${lat.p95}ms p99=${lat.p99}ms`);
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

const p50s = results.map(r => r.p50);
const p95s = results.map(r => r.p95);
const p99s = results.map(r => r.p99);
console.log('\n=== Summary across 5 runs (N=30 each) ===');
console.log(`p50: min=${Math.min(...p50s).toFixed(2)}ms median=${median(p50s).toFixed(2)}ms max=${Math.max(...p50s).toFixed(2)}ms`);
console.log(`p95: min=${Math.min(...p95s).toFixed(2)}ms median=${median(p95s).toFixed(2)}ms max=${Math.max(...p95s).toFixed(2)}ms`);
console.log(`p99: min=${Math.min(...p99s).toFixed(2)}ms median=${median(p99s).toFixed(2)}ms max=${Math.max(...p99s).toFixed(2)}ms`);
