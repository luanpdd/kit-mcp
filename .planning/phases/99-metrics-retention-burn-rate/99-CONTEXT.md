# Phase 99: Metrics Retention + Burn-rate Calculator - Contexto

**Coletado:** 2026-05-09
**Modo:** Auto-gerado
**Depends on:** Phase 98 ✅

<domain>
**OBS-19-01:** `metrics.persistSnapshot(rootDir)` — escreve `{counters, latency, timestamp}` em `.planning/metrics/snapshots/<ISO-timestamp>.json`.
**OBS-19-02:** `metrics.loadSnapshots(rootDir, windowMs)` — retorna array filtered por timestamp dentro da janela.
**OBS-19-03:** Cleanup snapshots > 30d (rolling window, executado em `persistSnapshot`).
**OBS-19-04:** `kit/commands/burn-rate-status.md` patch — consume snapshots + SLOs YAML; tabela ETA exhaustão por SLO. Aplica skill `burn-rate-alerting`.

</domain>

<decisions>
### Restrições
- Stable API v1.0+ preservada — `persistSnapshot` + `loadSnapshots` são exports novos aditivos.
- `.planning/metrics/snapshots/` deve ir em `.gitignore` (dev artifact, não shipped).
- Phase 94-97 invariants preservados (metrics.js export shape estável).
- Zero deps novas.

### Diretrizes

**`src/core/metrics.js` — adicionar:**
```js
export async function persistSnapshot(rootDir = process.cwd()) {
  const dir = path.join(rootDir, '.planning', 'metrics', 'snapshots');
  await fs.mkdir(dir, { recursive: true });
  const snap = snapshot();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${ts}.json`);
  await fs.writeFile(file, JSON.stringify(snap, null, 2));
  await cleanupOldSnapshots(dir, 30 * 86400 * 1000);
  return { file, snap };
}

export async function loadSnapshots(rootDir = process.cwd(), windowMs = 30 * 86400 * 1000) {
  const dir = path.join(rootDir, '.planning', 'metrics', 'snapshots');
  const cutoff = Date.now() - windowMs;
  const files = await fs.readdir(dir).catch(() => []);
  const results = [];
  for (const f of files.filter(f => f.endsWith('.json'))) {
    const tsStr = f.replace('.json', '').replace(/-/g, ':');
    const ts = Date.parse(tsStr);
    if (Number.isFinite(ts) && ts >= cutoff) {
      const raw = await fs.readFile(path.join(dir, f), 'utf-8');
      results.push({ ts, ...JSON.parse(raw) });
    }
  }
  return results.sort((a, b) => a.ts - b.ts);
}

async function cleanupOldSnapshots(dir, maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  const files = await fs.readdir(dir).catch(() => []);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const stat = await fs.stat(path.join(dir, f));
      if (stat.mtimeMs < cutoff) await fs.unlink(path.join(dir, f));
    } catch {}
  }
}
```

**`/burn-rate-status` command patch:**
- Atual: skeleton skill-driven.
- Novo: lê `.planning/slos/*.yml` e `.planning/metrics/snapshots/`. Calcula SLI atual (ratio good/total OU p95). Compara contra target. Calcula burn rate (% budget gasto / hora). ETA exhaustão.

**Tests:**
- `test/unit/metrics-retention.test.js` — persistSnapshot creates file, loadSnapshots filters window, cleanup removes old.
- `test/unit/burn-rate-calc.test.js` — fixture com snapshots sintéticos + SLO YAML, assert SLI calc + burn rate.

**.gitignore:**
- Adicionar `.planning/metrics/snapshots/`.

</decisions>

<deferred>
- Auto-snapshot triggered em metrics-snapshot tool call — v1.20+.
- Multi-window burn-rate (1h fast + 6h slow) — v1.20+.
- Alert dispatch (Slack/Discord) — out of scope, kit-mcp é dev tool.
</deferred>
