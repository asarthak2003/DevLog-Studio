import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDayLogs, createMonthlySummary } from '../../src/storage/merge';
import { DayLog } from '../../src/core/types';

describe('mergeDayLogs (multi-window reconciliation)', () => {
  it('merges multiple window files for the same date and sums stats', () => {
    const windowALog: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-123',
      date: '2026-11-24',
      sessions: [
        { id: 'sess-1', start: 1000, end: 2000, activeMs: 1000, branch: 'main' },
      ],
      files: {
        'src/app.ts': {
          activeMs: 4000,
          editCount: 3,
          linesAdded: 10,
          linesRemoved: 2,
          firstTouch: 1000,
          lastTouch: 1800,
          lastCursor: { line: 10, character: 4 },
        },
      },
      events: [
        { type: 'branchSwitch', time: 1000, branch: 'main' },
      ],
    };

    const windowBLog: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-123',
      date: '2026-11-24',
      sessions: [
        { id: 'sess-2', start: 3000, end: 4000, activeMs: 1000, branch: 'main' },
      ],
      files: {
        'src/app.ts': {
          activeMs: 2000,
          editCount: 2,
          linesAdded: 5,
          linesRemoved: 1,
          firstTouch: 1500,
          lastTouch: 2500, // Newer touch
          lastCursor: { line: 25, character: 0 },
        },
        'src/utils.ts': {
          activeMs: 3000,
          editCount: 1,
          linesAdded: 20,
          linesRemoved: 0,
          firstTouch: 3100,
          lastTouch: 3500,
        },
      },
      events: [
        { type: 'commit', time: 3500, hash: 'abc1234', subject: 'feat: add utils' },
      ],
    };

    const merged = mergeDayLogs([windowALog, windowBLog]);

    assert.equal(merged.workspaceId, 'ws-123');
    assert.equal(merged.date, '2026-11-24');
    assert.equal(merged.sessions.length, 2);
    assert.equal(merged.events.length, 2);

    // File src/app.ts: totals summed, earliest firstTouch, latest lastTouch and cursor
    const appStats = merged.files['src/app.ts'];
    assert.ok(appStats);
    assert.equal(appStats.activeMs, 6000); // 4000 + 2000
    assert.equal(appStats.editCount, 5); // 3 + 2
    assert.equal(appStats.linesAdded, 15); // 10 + 5
    assert.equal(appStats.linesRemoved, 3); // 2 + 1
    assert.equal(appStats.firstTouch, 1000); // min(1000, 1500)
    assert.equal(appStats.lastTouch, 2500); // max(1800, 2500)
    assert.deepEqual(appStats.lastCursor, { line: 25, character: 0 }); // from windowB (latest touch)

    // File src/utils.ts from windowB present
    assert.ok(merged.files['src/utils.ts']);
    assert.equal(merged.files['src/utils.ts'].activeMs, 3000);
  });

  it('de-duplicates duplicate sessions and events across window files', () => {
    const logA: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-1',
      date: '2026-11-24',
      sessions: [{ id: 'sess-dup', start: 100, end: 500, activeMs: 300 }],
      files: {},
      events: [{ type: 'commit', time: 200, hash: 'c1' }],
    };

    const logB: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-1',
      date: '2026-11-24',
      sessions: [{ id: 'sess-dup', start: 100, end: 600, activeMs: 400 }], // same session ID
      files: {},
      events: [{ type: 'commit', time: 200, hash: 'c1' }], // same commit event
    };

    const merged = mergeDayLogs([logA, logB]);
    assert.equal(merged.sessions.length, 1);
    assert.equal(merged.sessions[0].end, 600);
    assert.equal(merged.sessions[0].activeMs, 400);
    assert.equal(merged.events.length, 1);
  });

  it('creates compact monthly summary correctly', () => {
    const day1: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-1',
      date: '2026-08-01',
      sessions: [],
      files: {
        'index.ts': { activeMs: 10000, editCount: 5, linesAdded: 50, linesRemoved: 10, firstTouch: 1, lastTouch: 2 },
      },
      events: [{ type: 'commit', time: 10, hash: 'commit-a' }],
    };

    const day2: DayLog = {
      schemaVersion: 1,
      workspaceId: 'ws-1',
      date: '2026-08-02',
      sessions: [],
      files: {
        'index.ts': { activeMs: 5000, editCount: 2, linesAdded: 10, linesRemoved: 5, firstTouch: 1, lastTouch: 2 },
        'styles.css': { activeMs: 3000, editCount: 1, linesAdded: 15, linesRemoved: 0, firstTouch: 1, lastTouch: 2 },
      },
      events: [{ type: 'commit', time: 20, hash: 'commit-b' }],
    };

    const summary = createMonthlySummary('2026-08', 'ws-1', [day1, day2]);
    assert.equal(summary.month, '2026-08');
    assert.equal(summary.totalActiveMs, 18000);
    assert.equal(summary.totalEdits, 8);
    assert.equal(summary.linesAdded, 75);
    assert.equal(summary.linesRemoved, 15);
    assert.equal(summary.files['index.ts'].activeMs, 15000);
    assert.equal(summary.files['styles.css'].activeMs, 3000);
    assert.deepEqual(summary.commits?.sort(), ['commit-a', 'commit-b']);
  });
});
