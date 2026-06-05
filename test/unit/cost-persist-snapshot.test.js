// Phase 172 — persist-snapshot unit tests.
//
// Invariantes:
//  - persistSnapshot grava .planning/costs/<ts>-<tool>.json com envelope
//    { ts, tool, snap }.
//  - loadSnapshots lê arquivos dentro do window, ordenados ascendente por ts.
//  - Diretório inexistente é criado.
//  - Falha graceful: dir não-criavel retorna { file: null, warning }.
//  - JSON corrompido é ignorado em loadSnapshots (mirror metrics.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { persistSnapshot, loadSnapshots, __TEST_SNAPSHOT_DIR_REL } from '../../src/core/cost/persist-snapshot.js';

test('persistSnapshot grava envelope { ts, tool, snap }', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-'));
  try {
    const snap = { date: '2026-06-05', total_usd: 1.23 };
    const r = await persistSnapshot(tmp, snap, { tool: 'cost-today' });
    assert.ok(r.file, 'file path retornado');
    const raw = await fs.readFile(r.file, 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.tool, 'cost-today');
    assert.deepEqual(parsed.snap, snap);
    assert.ok(Number.isFinite(parsed.ts));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('persistSnapshot cria .planning/costs/ se não existir', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-mk-'));
  try {
    const r = await persistSnapshot(tmp, { x: 1 }, { tool: 'cost-blocks' });
    assert.ok(r.file);
    const stat = await fs.stat(path.join(tmp, __TEST_SNAPSHOT_DIR_REL));
    assert.ok(stat.isDirectory());
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadSnapshots retorna ordenado asc por ts', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-load-'));
  try {
    await persistSnapshot(tmp, { v: 1 }, { tool: 't', now: 1000 });
    await persistSnapshot(tmp, { v: 2 }, { tool: 't', now: 2000 });
    await persistSnapshot(tmp, { v: 3 }, { tool: 't', now: 1500 });
    const all = await loadSnapshots(tmp, 1e15);
    assert.equal(all.length, 3);
    assert.equal(all[0].ts, 1000);
    assert.equal(all[1].ts, 1500);
    assert.equal(all[2].ts, 2000);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadSnapshots window filter cutoff', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-win-'));
  try {
    // Antigo (cutoff vai cortar) + recente.
    await persistSnapshot(tmp, { v: 'old' }, { tool: 't', now: 1 });
    await persistSnapshot(tmp, { v: 'new' }, { tool: 't', now: Date.now() });
    const recent = await loadSnapshots(tmp, 60_000); // 60s window
    assert.equal(recent.length, 1);
    assert.equal(recent[0].snap.v, 'new');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadSnapshots tolera JSON corrompido (skip silencioso)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-corrupt-'));
  try {
    const dir = path.join(tmp, __TEST_SNAPSHOT_DIR_REL);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'corrupt.json'), '{{ broken');
    await persistSnapshot(tmp, { v: 1 }, { tool: 't', now: Date.now() });
    const all = await loadSnapshots(tmp, 1e15);
    assert.equal(all.length, 1, 'apenas o válido sobrevive');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadSnapshots retorna [] quando dir ausente', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-empty-'));
  try {
    const all = await loadSnapshots(tmp, 1e15);
    assert.deepEqual(all, []);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('persistSnapshot falha graceful se rootDir aponta a arquivo', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-persist-fail-'));
  try {
    // Cria um arquivo onde .planning/costs/ deveria virar dir → mkdir falha.
    const planning = path.join(tmp, '.planning');
    await fs.mkdir(planning, { recursive: true });
    await fs.writeFile(path.join(planning, 'costs'), 'eu sou um arquivo');
    const r = await persistSnapshot(tmp, { x: 1 }, { tool: 't' });
    assert.equal(r.file, null);
    assert.ok(r.warning && r.warning.startsWith('mkdir_failed:'));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
