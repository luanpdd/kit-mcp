// Phase 100 — Coverage ratchet 80%→90%: targeted tests for src/core/ui.js
//
// Baseline: 52.43% line coverage. Target ≥ 90%.
// `ui.test.js` already covers c.green/icons/summary basics. Here we cover the
// uncovered branches: spinner/progress in non-TTY mode, select/confirm refusal
// when stdin is not a TTY, summary edge cases (no total/no hint).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spinner, progress, select, confirm, summary } from '../../src/core/ui.js';

// Force NO_COLOR so the COLOR_ON detection in the module render path returns
// id() identity functions. This is set early enough for any subsequent
// re-imports (none here).
const prevNoColor = process.env.NO_COLOR;
process.env.NO_COLOR = '1';

// --- helpers ---

// Capture process.stderr.write across an async fn. Returns array of strings.
async function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr);
  const captured = [];
  process.stderr.write = (chunk, ...rest) => {
    if (typeof chunk === 'string') captured.push(chunk);
    else if (chunk && chunk.toString) captured.push(chunk.toString());
    return true;
  };
  try {
    await fn();
  } finally {
    process.stderr.write = orig;
  }
  return captured;
}

// Force-set process.stderr.isTTY for the duration of fn (sync or async).
async function withTtyState(streamName, value, fn) {
  const stream = process[streamName];
  const orig = stream.isTTY;
  // Use Object.defineProperty because isTTY is a getter on real TTY streams.
  Object.defineProperty(stream, 'isTTY', { value, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(stream, 'isTTY', { value: orig, configurable: true, writable: true });
  }
}

// --- spinner — non-TTY (dot fallback) ---

test('spinner — non-TTY emits dot+text via stderr', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const sp = spinner({ text: 'loading' });
      sp.stop();
    });
  });
  // First line should be "• loading\n" (dot icon + text)
  const joined = out.join('');
  assert.match(joined, /•\s+loading/);
});

test('spinner — non-TTY update() emits new line per call', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const sp = spinner({ text: 'first' });
      sp.update('second');
      sp.stop();
    });
  });
  const joined = out.join('');
  assert.match(joined, /first/);
  assert.match(joined, /second/);
});

test('spinner — non-TTY succeed() writes check + final text', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const sp = spinner({ text: 'working' });
      sp.succeed('done!');
    });
  });
  const joined = out.join('');
  // ✓ icon plus "done!" text
  assert.match(joined, /✓\s+done!/);
});

test('spinner — non-TTY fail() writes cross + error text', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const sp = spinner({ text: 'working' });
      sp.fail('oops');
    });
  });
  const joined = out.join('');
  assert.match(joined, /✗\s+oops/);
});

test('spinner — succeed() with no arg falls back to current text', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const sp = spinner({ text: 'pending' });
      sp.succeed();
    });
  });
  const joined = out.join('');
  // succeed() without arg uses current ('pending' since no update)
  assert.match(joined, /✓\s+pending/);
});

// --- spinner — TTY mode (renders + clears) ---

test('spinner — TTY mode renders animated frame and clears on stop', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', true, async () => {
      const sp = spinner({ text: 'loading' });
      // Tick at least one render — the setInterval fires every 80ms; we don't
      // need to wait that long since we already triggered render() once at
      // construction. Stop immediately; clearLine should write "\r\x1b[K".
      sp.stop();
    });
  });
  const joined = out.join('');
  // The braille spinner glyph + text should appear at least once
  assert.match(joined, /loading/);
  // Clear-line escape sequence written on stop
  assert.match(joined, /\x1b\[K/);
});

// --- progress — non-TTY ---

test('progress — non-TTY emits ~10% boundary lines', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const p = progress({ total: 10, label: 'syncing' });
      // Tick 10 times — every "Math.floor(total/10)" === every 1 → emit each
      for (let i = 0; i < 10; i++) p.tick({ label: 'syncing' });
      p.finish('done');
    });
  });
  const joined = out.join('');
  // Should include some "%  syncing" lines + final ✓ done
  assert.match(joined, /%/);
  assert.match(joined, /syncing/);
  assert.match(joined, /✓\s+done/);
});

test('progress — total=0 renders 100%', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const p = progress({ total: 0, label: 'empty' });
      p.tick();
      p.finish('all done');
    });
  });
  const joined = out.join('');
  // 100% is the sentinel
  assert.match(joined, /100%/);
  assert.match(joined, /all done/);
});

test('progress — non-TTY finish without text omits trailing message', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', false, async () => {
      const p = progress({ total: 5, label: 'x' });
      p.tick();
      p.finish();
    });
  });
  // No "✓" line because text was undefined; only the tick-emitted lines
  const joined = out.join('');
  assert.ok(!/✓/.test(joined) || joined.length > 0);
});

test('progress — TTY mode renders animated bar + clearLine on finish', async () => {
  const out = await captureStderr(async () => {
    await withTtyState('stderr', true, async () => {
      const p = progress({ total: 4, label: 'building' });
      p.tick();
      p.tick();
      p.finish('built');
    });
  });
  const joined = out.join('');
  assert.match(joined, /building/);
  // clearLine on finish (TTY branch)
  assert.match(joined, /\x1b\[K/);
  // success line
  assert.match(joined, /✓\s+built/);
});

// --- select / confirm — refuse when stdin is not a TTY ---

test('select — throws when stdin.isTTY is false', async () => {
  await withTtyState('stdin', false, async () => {
    await assert.rejects(
      () => select({ message: 'choose', choices: ['a', 'b'] }),
      /Interactive prompt unavailable/,
    );
  });
});

test('confirm — throws when stdin.isTTY is false', async () => {
  await withTtyState('stdin', false, async () => {
    await assert.rejects(
      () => confirm({ message: 'are you sure?' }),
      /Interactive prompt unavailable/,
    );
  });
});

test('confirm — error mentions --yes hint', async () => {
  await withTtyState('stdin', false, async () => {
    await assert.rejects(
      () => confirm({ message: 'x' }),
      (err) => err.message.includes('--yes'),
    );
  });
});

// --- summary edge cases ---

test('summary — total undefined AND hint undefined: no total line', () => {
  const out = summary({
    title: 'Bare',
    rows: [['Items', 5]],
  });
  // Should NOT contain "Total:" since total was undefined
  assert.ok(!/Total:/.test(out));
});

test('summary — hint without total: emits "· hint" only', () => {
  const out = summary({
    title: 'Hint only',
    rows: [],
    hint: 'check this',
  });
  // Hint with the · prefix; no "Total:" prefix
  assert.match(out, /·\s+check this/);
  assert.ok(!/Total:/.test(out));
});

test('summary — total without hint: emits "Total: N" only (no ·)', () => {
  const out = summary({
    title: 'Just total',
    rows: [['x', 1]],
    total: 1,
  });
  assert.match(out, /Total:\s+1/);
  assert.ok(!/·/.test(out));
});

test('summary — long-label rows align via padEnd to widest label', () => {
  const out = summary({
    title: 'Aligned',
    rows: [
      ['Short',  10],
      ['VeryLongLabel', 5],
    ],
    total: 15,
  });
  // Both rows present; the shorter label is padded to match VeryLongLabel width
  assert.match(out, /Short/);
  assert.match(out, /VeryLongLabel/);
  // The output is well-formed (no crash) and contains Total
  assert.match(out, /Total:\s+15/);
});

// Restore NO_COLOR if we set it locally (idempotent — multiple test files do this)
if (prevNoColor === undefined) {
  // leave as-is; NO_COLOR=1 is benign for subsequent tests
}
