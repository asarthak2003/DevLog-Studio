import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateDayLog } from '../../src/storage/migrate';

describe('migrateDayLog', () => {
  it('validates and preserves schemaVersion 1 data', () => {
    const raw = {
      schemaVersion: 1,
      workspaceId: 'test-ws',
      date: '2026-11-24',
      sessions: [{ id: 's1', start: 1, end: 2, activeMs: 1 }],
      files: {
        'a.ts': { activeMs: 10, editCount: 1, linesAdded: 5, linesRemoved: 0, firstTouch: 1, lastTouch: 2 },
      },
      events: [],
    };

    const migrated = migrateDayLog(raw);
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.workspaceId, 'test-ws');
    assert.equal(migrated.sessions.length, 1);
    assert.ok(migrated.files['a.ts']);
  });

  it('populates missing fields gracefully when legacy or partial data is passed', () => {
    const partial = {
      workspaceId: 'partial-ws',
    };

    const migrated = migrateDayLog(partial);
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.workspaceId, 'partial-ws');
    assert.deepEqual(migrated.sessions, []);
    assert.deepEqual(migrated.files, {});
    assert.deepEqual(migrated.events, []);
  });

  it('throws an error if payload is non-object', () => {
    assert.throws(() => migrateDayLog(null));
    assert.throws(() => migrateDayLog('bad json'));
  });
});
