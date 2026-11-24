import { DayLog, FileStats, Session } from './types';

export class ActivityModel {
  private files: Map<string, FileStats> = new Map();
  private sessions: Session[] = [];
  private currentSession: Session | null = null;
  private isPaused = false;
  private dirty = false;
  private workspaceId: string;
  private dateString: string;

  constructor(workspaceId = 'default', now = Date.now()) {
    this.workspaceId = workspaceId;
    this.dateString = new Date(now).toISOString().slice(0, 10);
    this.startNewSession(now);
  }

  public setPaused(paused: boolean): boolean {
    this.isPaused = paused;
    return this.isPaused;
  }

  public isTrackingPaused(): boolean {
    return this.isPaused;
  }

  public isDirty(): boolean {
    return this.dirty;
  }

  public markClean(): void {
    this.dirty = false;
  }

  public getDate(): string {
    return this.dateString;
  }

  public getWorkspaceId(): string {
    return this.workspaceId;
  }

  public startNewSession(now: number, branch?: string, repo?: string): Session {
    if (this.currentSession) {
      this.currentSession.end = now;
    }

    const session: Session = {
      id: `session_${now}_${Math.random().toString(36).substring(2, 8)}`,
      start: now,
      end: now,
      activeMs: 0,
      branch,
      repo,
    };

    this.sessions.push(session);
    this.currentSession = session;
    this.dirty = true;
    return session;
  }

  public getCurrentSession(): Session | null {
    return this.currentSession;
  }

  private getOrCreateFileStats(file: string, now: number): FileStats {
    let stats = this.files.get(file);
    if (!stats) {
      stats = {
        activeMs: 0,
        editCount: 0,
        linesAdded: 0,
        linesRemoved: 0,
        firstTouch: now,
        lastTouch: now,
      };
      this.files.set(file, stats);
      this.dirty = true;
    }
    return stats;
  }

  public touchFile(file: string, now: number): void {
    if (this.isPaused || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.lastTouch = now;
    if (this.currentSession) {
      this.currentSession.end = now;
    }
    this.dirty = true;
  }

  public addActiveTime(file: string, ms: number, now: number): void {
    if (this.isPaused || ms <= 0 || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.activeMs += ms;
    stats.lastTouch = now;

    if (this.currentSession) {
      this.currentSession.activeMs += ms;
      this.currentSession.end = now;
    }
    this.dirty = true;
  }

  public recordEdit(file: string, added: number, removed: number, now: number): void {
    if (this.isPaused || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.editCount += 1;
    stats.linesAdded += added;
    stats.linesRemoved += removed;
    stats.lastTouch = now;

    if (this.currentSession) {
      this.currentSession.end = now;
    }
    this.dirty = true;
  }

  public recordSave(file: string, now: number): void {
    if (this.isPaused || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.lastTouch = now;
    if (this.currentSession) {
      this.currentSession.end = now;
    }
    this.dirty = true;
  }

  public recordCursor(file: string, line: number, character: number, now: number): void {
    if (this.isPaused || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.lastCursor = { line, character };
    stats.lastTouch = now;
    this.dirty = true;
  }

  public recordVisibleRange(file: string, startLine: number, endLine: number, now: number): void {
    if (this.isPaused || !file) return;
    const stats = this.getOrCreateFileStats(file, now);
    stats.lastVisibleRange = { startLine, endLine };
    stats.lastTouch = now;
    this.dirty = true;
  }

  public renameFile(oldPath: string, newPath: string): void {
    const existing = this.files.get(oldPath);
    if (existing) {
      this.files.delete(oldPath);
      this.files.set(newPath, existing);
      this.dirty = true;
    }
  }

  public deleteFile(file: string): void {
    if (this.files.delete(file)) {
      this.dirty = true;
    }
  }

  public getFileStats(file: string): FileStats | undefined {
    return this.files.get(file);
  }

  public getAllFiles(): Map<string, FileStats> {
    return new Map(this.files);
  }

  public getSessions(): Session[] {
    return [...this.sessions];
  }

  /**
   * Restores in-memory model from a persistent DayLog record.
   */
  public restoreFromSnapshot(log: DayLog): void {
    this.workspaceId = log.workspaceId;
    this.dateString = log.date;
    this.files.clear();
    for (const [path, stats] of Object.entries(log.files || {})) {
      this.files.set(path, { ...stats });
    }
    this.sessions = log.sessions ? log.sessions.map((s) => ({ ...s })) : [];
    this.currentSession = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1] : null;
    this.dirty = false;
  }

  /**
   * Midnight rollover: checks if current timestamp has crossed into a new date.
   * If crossed, returns rollover info so old day can be flushed and a fresh day started.
   */
  public checkMidnightRollover(now = Date.now()): { rolledOver: boolean; oldDate: string; newDate: string } {
    const currentDate = new Date(now).toISOString().slice(0, 10);
    if (currentDate !== this.dateString) {
      const oldDate = this.dateString;
      this.dateString = currentDate;
      // End current session at midnight and start fresh in the new day
      this.files.clear();
      this.sessions = [];
      this.currentSession = null;
      this.startNewSession(now);
      this.dirty = true;
      return { rolledOver: true, oldDate, newDate: currentDate };
    }
    return { rolledOver: false, oldDate: this.dateString, newDate: this.dateString };
  }

  public getSnapshot(): DayLog {
    const filesRecord: Record<string, FileStats> = {};
    for (const [path, stats] of this.files.entries()) {
      filesRecord[path] = { ...stats };
    }

    return {
      schemaVersion: 1,
      workspaceId: this.workspaceId,
      date: this.dateString,
      sessions: this.sessions.map((s) => ({ ...s })),
      files: filesRecord,
      events: [],
    };
  }

  /**
   * Generates a readable ASCII summary table for the debug dump command.
   */
  public formatDump(minTouchSeconds = 5): string {
    const minTouchMs = minTouchSeconds * 1000;
    const rows: string[] = [];
    rows.push('========================================================================');
    rows.push(`DevLog Studio Activity Dump | Date: ${this.dateString} | Paused: ${this.isPaused}`);
    rows.push(`Sessions (${this.sessions.length}):`);
    for (const s of this.sessions) {
      const durationSec = Math.round((s.end - s.start) / 1000);
      const activeSec = Math.round(s.activeMs / 1000);
      rows.push(`  - Session ${s.id.slice(-6)}: ${activeSec}s active / ${durationSec}s span (Branch: ${s.branch || 'none'})`);
    }
    rows.push('------------------------------------------------------------------------');
    rows.push('Tracked Files:');
    rows.push(
      `${'File'.padEnd(36)} | ${'Active'.padEnd(10)} | ${'Edits'.padEnd(7)} | ${'+Lines'.padEnd(7)} | ${'-Lines'.padEnd(7)}`
    );
    rows.push('------------------------------------------------------------------------');

    let totalActiveMs = 0;
    let totalEdits = 0;

    for (const [file, stats] of this.files.entries()) {
      if (stats.activeMs < minTouchMs && stats.editCount === 0) {
        continue;
      }

      totalActiveMs += stats.activeMs;
      totalEdits += stats.editCount;

      const activeStr = `${Math.round(stats.activeMs / 1000)}s`;
      const shortFile = file.length > 34 ? `...${file.slice(-31)}` : file;
      rows.push(
        `${shortFile.padEnd(36)} | ${activeStr.padEnd(10)} | ${String(stats.editCount).padEnd(7)} | ${String(stats.linesAdded).padEnd(7)} | ${String(stats.linesRemoved).padEnd(7)}`
      );
    }

    rows.push('========================================================================');
    rows.push(`Total Active: ${Math.round(totalActiveMs / 1000)}s | Total Edits: ${totalEdits}`);
    rows.push('========================================================================');

    return rows.join('\n');
  }
}
