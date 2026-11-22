import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityModel } from '../../src/core/activityModel';

describe('ActivityModel', () => {
  it('aggregates file edits, lines added/removed, and active time', () => {
    const t0 = 100000;
    const model = new ActivityModel('test-workspace', t0);

    model.touchFile('src/index.ts', t0);
    model.recordEdit('src/index.ts', 15, 3, t0 + 1000);
    model.addActiveTime('src/index.ts', 5000, t0 + 5000);

    const stats = model.getFileStats('src/index.ts');
    assert.ok(stats);
    assert.equal(stats.editCount, 1);
    assert.equal(stats.linesAdded, 15);
    assert.equal(stats.linesRemoved, 3);
    assert.equal(stats.activeMs, 5000);

    // Second edit
    model.recordEdit('src/index.ts', 2, 1, t0 + 6000);
    assert.equal(stats.editCount, 2);
    assert.equal(stats.linesAdded, 17);
    assert.equal(stats.linesRemoved, 4);
  });

  it('tracks cursor position and visible ranges', () => {
    const t0 = 100000;
    const model = new ActivityModel('test-workspace', t0);

    model.recordCursor('src/auth.ts', 42, 10, t0);
    model.recordVisibleRange('src/auth.ts', 20, 80, t0);

    const stats = model.getFileStats('src/auth.ts');
    assert.ok(stats);
    assert.deepEqual(stats.lastCursor, { line: 42, character: 10 });
    assert.deepEqual(stats.lastVisibleRange, { startLine: 20, endLine: 80 });
  });

  it('handles file rename and file deletion', () => {
    const t0 = 100000;
    const model = new ActivityModel('test-workspace', t0);

    model.recordEdit('src/oldName.ts', 10, 0, t0);
    assert.ok(model.getFileStats('src/oldName.ts'));

    model.renameFile('src/oldName.ts', 'src/newName.ts');
    assert.equal(model.getFileStats('src/oldName.ts'), undefined);
    assert.equal(model.getFileStats('src/newName.ts')?.linesAdded, 10);

    model.deleteFile('src/newName.ts');
    assert.equal(model.getFileStats('src/newName.ts'), undefined);
  });

  it('respects pause flag and freezes tracking', () => {
    const t0 = 100000;
    const model = new ActivityModel('test-workspace', t0);

    model.setPaused(true);
    assert.equal(model.isTrackingPaused(), true);

    model.recordEdit('src/paused.ts', 100, 50, t0);
    model.addActiveTime('src/paused.ts', 10000, t0);
    assert.equal(model.getFileStats('src/paused.ts'), undefined);

    model.setPaused(false);
    model.recordEdit('src/paused.ts', 5, 1, t0);
    assert.equal(model.getFileStats('src/paused.ts')?.linesAdded, 5);
  });

  it('creates sessions and serializes snapshot correctly', () => {
    const t0 = 100000;
    const model = new ActivityModel('test-workspace', t0);

    model.addActiveTime('src/app.ts', 3000, t0 + 1000);
    const session1 = model.getCurrentSession();
    assert.ok(session1);
    assert.equal(session1.activeMs, 3000);

    // Split session
    const session2 = model.startNewSession(t0 + 50000, 'feature/auth');
    assert.equal(model.getSessions().length, 2);
    assert.equal(session2.branch, 'feature/auth');

    const snapshot = model.getSnapshot();
    assert.equal(snapshot.workspaceId, 'test-workspace');
    assert.equal(snapshot.sessions.length, 2);
    assert.ok(snapshot.files['src/app.ts']);
  });
});
