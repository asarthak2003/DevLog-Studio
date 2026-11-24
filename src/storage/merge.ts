import { DayLog, FileStats, MonthlySummary, Session, TimelineEvent, UserNote } from '../core/types';

/**
 * Pure function to merge multiple DayLog records (e.g. from multiple VS Code windows)
 * for the same date and workspace into a single unified record.
 */
export function mergeDayLogs(logs: DayLog[]): DayLog {
  if (logs.length === 0) {
    return {
      schemaVersion: 1,
      workspaceId: 'default',
      date: new Date().toISOString().slice(0, 10),
      sessions: [],
      files: {},
      events: [],
    };
  }

  const base = logs[0];
  const maxSchema = Math.max(...logs.map((l) => l.schemaVersion || 1));
  const mergedFiles: Record<string, FileStats> = {};
  const sessionsMap = new Map<string, Session>();
  const eventsMap = new Map<string, TimelineEvent>();
  const notesMap = new Map<string, UserNote>();

  for (const log of logs) {
    // 1. Merge sessions
    for (const s of log.sessions || []) {
      const existing = sessionsMap.get(s.id);
      if (!existing) {
        sessionsMap.set(s.id, { ...s });
      } else {
        existing.start = Math.min(existing.start, s.start);
        existing.end = Math.max(existing.end, s.end);
        existing.activeMs = Math.max(existing.activeMs, s.activeMs);
        if (!existing.branch && s.branch) existing.branch = s.branch;
        if (!existing.repo && s.repo) existing.repo = s.repo;
      }
    }

    // 2. Merge files
    for (const [path, stats] of Object.entries(log.files || {})) {
      const existing = mergedFiles[path];
      if (!existing) {
        mergedFiles[path] = {
          activeMs: stats.activeMs || 0,
          editCount: stats.editCount || 0,
          linesAdded: stats.linesAdded || 0,
          linesRemoved: stats.linesRemoved || 0,
          firstTouch: stats.firstTouch || 0,
          lastTouch: stats.lastTouch || 0,
          lastCursor: stats.lastCursor ? { ...stats.lastCursor } : undefined,
          lastVisibleRange: stats.lastVisibleRange ? { ...stats.lastVisibleRange } : undefined,
          symbols: stats.symbols ? JSON.parse(JSON.stringify(stats.symbols)) : undefined,
        };
      } else {
        existing.activeMs += stats.activeMs || 0;
        existing.editCount += stats.editCount || 0;
        existing.linesAdded += stats.linesAdded || 0;
        existing.linesRemoved += stats.linesRemoved || 0;
        if (stats.firstTouch > 0) {
          existing.firstTouch = existing.firstTouch > 0 ? Math.min(existing.firstTouch, stats.firstTouch) : stats.firstTouch;
        }
        if (stats.lastTouch > existing.lastTouch) {
          existing.lastTouch = stats.lastTouch;
          if (stats.lastCursor) existing.lastCursor = { ...stats.lastCursor };
          if (stats.lastVisibleRange) existing.lastVisibleRange = { ...stats.lastVisibleRange };
        }

        // Merge symbols if present
        if (stats.symbols) {
          if (!existing.symbols) existing.symbols = {};
          for (const [symName, symStats] of Object.entries(stats.symbols)) {
            const existingSym = existing.symbols[symName];
            if (!existingSym) {
              existing.symbols[symName] = { ...symStats };
            } else {
              existingSym.edits += symStats.edits;
              if (symStats.lastTouch > existingSym.lastTouch) {
                existingSym.lastTouch = symStats.lastTouch;
                existingSym.lastKnownLine = symStats.lastKnownLine;
              }
            }
          }
        }
      }
    }

    // 3. Merge events
    for (const ev of log.events || []) {
      const key = `${ev.type}_${ev.time}_${JSON.stringify(ev)}`;
      if (!eventsMap.has(key)) {
        eventsMap.set(key, { ...ev });
      }
    }

    // 4. Merge notes
    for (const note of log.notes || []) {
      notesMap.set(note.id, { ...note });
    }
  }

  // Sort sessions chronologically
  const sortedSessions = Array.from(sessionsMap.values()).sort((a, b) => a.start - b.start);
  // Sort events chronologically
  const sortedEvents = Array.from(eventsMap.values()).sort((a, b) => a.time - b.time);

  return {
    schemaVersion: maxSchema,
    workspaceId: base.workspaceId,
    date: base.date,
    sessions: sortedSessions,
    files: mergedFiles,
    events: sortedEvents,
    notes: notesMap.size > 0 ? Array.from(notesMap.values()) : undefined,
  };
}

/**
 * Creates a compact monthly summary from an array of daily logs.
 */
export function createMonthlySummary(
  month: string,
  workspaceId: string,
  dailyLogs: DayLog[]
): MonthlySummary {
  let totalActiveMs = 0;
  let totalEdits = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  const filesSummary: Record<string, { activeMs: number; editCount: number }> = {};
  const commitsSet = new Set<string>();

  for (const day of dailyLogs) {
    for (const [path, stats] of Object.entries(day.files || {})) {
      totalActiveMs += stats.activeMs || 0;
      totalEdits += stats.editCount || 0;
      linesAdded += stats.linesAdded || 0;
      linesRemoved += stats.linesRemoved || 0;

      if (!filesSummary[path]) {
        filesSummary[path] = { activeMs: 0, editCount: 0 };
      }
      filesSummary[path].activeMs += stats.activeMs || 0;
      filesSummary[path].editCount += stats.editCount || 0;
    }

    for (const ev of day.events || []) {
      if (ev.type === 'commit' && typeof ev.hash === 'string') {
        commitsSet.add(ev.hash);
      }
    }
  }

  return {
    schemaVersion: 1,
    month,
    workspaceId,
    totalActiveMs,
    totalEdits,
    linesAdded,
    linesRemoved,
    files: filesSummary,
    commits: commitsSet.size > 0 ? Array.from(commitsSet) : undefined,
  };
}
