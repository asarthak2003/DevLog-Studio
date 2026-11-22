import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HeartbeatTracker } from '../../src/core/heartbeat';

describe('HeartbeatTracker', () => {
  it('credits active time when gap is within idleTimeout', () => {
    const tracker = new HeartbeatTracker({
      idleTimeoutMs: 3 * 60 * 1000, // 3 minutes
      sessionGapMs: 30 * 60 * 1000, // 30 minutes
    });

    const t0 = 100000;
    // First touch
    const r1 = tracker.heartbeat('src/app.ts', t0);
    assert.equal(r1.creditedMs, 0);
    assert.equal(r1.file, null);

    // Second touch after 10 seconds
    const r2 = tracker.heartbeat('src/app.ts', t0 + 10000);
    assert.equal(r2.creditedMs, 10000);
    assert.equal(r2.file, 'src/app.ts');
    assert.equal(r2.isIdleGap, false);
  });

  it('credits time to the previous file when switching editors', () => {
    const tracker = new HeartbeatTracker({
      idleTimeoutMs: 3 * 60 * 1000,
      sessionGapMs: 30 * 60 * 1000,
    });

    const t0 = 100000;
    tracker.heartbeat('src/fileA.ts', t0);

    // Switch to fileB after 15 seconds
    const r2 = tracker.heartbeat('src/fileB.ts', t0 + 15000);
    assert.equal(r2.creditedMs, 15000);
    assert.equal(r2.file, 'src/fileA.ts'); // Credited to previous file!
    assert.equal(tracker.getCurrentFile(), 'src/fileB.ts');
  });

  it('does not credit time when gap exceeds idle timeout', () => {
    const tracker = new HeartbeatTracker({
      idleTimeoutMs: 180000, // 3 min
      sessionGapMs: 1800000, // 30 min
    });

    const t0 = 100000;
    tracker.heartbeat('src/app.ts', t0);

    // Gap of 5 minutes (exceeds 3 min)
    const r2 = tracker.heartbeat('src/app.ts', t0 + 300000);
    assert.equal(r2.creditedMs, 0);
    assert.equal(r2.isIdleGap, true);
    assert.equal(r2.isSessionSplit, false);
  });

  it('detects session split when gap exceeds session gap threshold', () => {
    const tracker = new HeartbeatTracker({
      idleTimeoutMs: 180000,
      sessionGapMs: 1800000, // 30 min
    });

    const t0 = 100000;
    tracker.heartbeat('src/app.ts', t0);

    // Gap of 45 minutes
    const r2 = tracker.heartbeat('src/app.ts', t0 + 45 * 60 * 1000);
    assert.equal(r2.creditedMs, 0);
    assert.equal(r2.isIdleGap, true);
    assert.equal(r2.isSessionSplit, true);
  });

  it('credits pending time on window blur and ignores unfocused duration on focus', () => {
    const tracker = new HeartbeatTracker({
      idleTimeoutMs: 180000,
      sessionGapMs: 1800000,
    });

    const t0 = 100000;
    tracker.heartbeat('src/app.ts', t0);

    // Blur after 20 seconds
    const blurResult = tracker.onWindowBlur(t0 + 20000);
    assert.equal(blurResult.creditedMs, 20000);
    assert.equal(blurResult.file, 'src/app.ts');
    assert.equal(tracker.isWindowFocused(), false);

    // Focus after 1 hour (unfocused time should NOT be credited)
    tracker.onWindowFocus('src/app.ts', t0 + 3600000);
    assert.equal(tracker.isWindowFocused(), true);

    // Next interaction 5 seconds later
    const r3 = tracker.heartbeat('src/app.ts', t0 + 3605000);
    assert.equal(r3.creditedMs, 5000);
  });
});
