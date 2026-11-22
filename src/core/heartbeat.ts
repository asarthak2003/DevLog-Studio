import { HeartbeatResult } from './types';

export interface HeartbeatOptions {
  idleTimeoutMs: number;
  sessionGapMs: number;
}

/**
 * Pure heartbeat calculation engine for active-time calculation and idle gap detection.
 * Independent of VS Code runtime; accepts explicit timestamps for deterministic testing.
 */
export class HeartbeatTracker {
  private lastHeartbeatAt: number | null = null;
  private currentFile: string | null = null;
  private isFocused = true;
  private idleTimeoutMs: number;
  private sessionGapMs: number;

  constructor(options: HeartbeatOptions) {
    this.idleTimeoutMs = options.idleTimeoutMs;
    this.sessionGapMs = options.sessionGapMs;
  }

  public updateConfig(options: Partial<HeartbeatOptions>): void {
    if (options.idleTimeoutMs !== undefined) {
      this.idleTimeoutMs = options.idleTimeoutMs;
    }
    if (options.sessionGapMs !== undefined) {
      this.sessionGapMs = options.sessionGapMs;
    }
  }

  /**
   * Evaluates an interaction event occurring on a given file.
   * Calculates time delta and credits it to the previously active file.
   */
  public heartbeat(file: string, now: number): HeartbeatResult {
    let creditedMs = 0;
    let isIdleGap = false;
    let isSessionSplit = false;
    const previousFile = this.currentFile;

    if (this.lastHeartbeatAt !== null && this.isFocused && previousFile !== null) {
      const gap = Math.max(0, now - this.lastHeartbeatAt);

      if (gap > this.sessionGapMs) {
        // Inactivity exceeded session threshold -> split session, no time credited
        isIdleGap = true;
        isSessionSplit = true;
      } else if (gap > this.idleTimeoutMs) {
        // Inactivity exceeded idle timeout -> idle gap, no time credited
        isIdleGap = true;
      } else {
        // Valid continuous active work -> credit gap to the active file
        creditedMs = gap;
      }
    }

    this.currentFile = file;
    this.lastHeartbeatAt = now;
    this.isFocused = true;

    return {
      file: previousFile,
      creditedMs,
      isIdleGap,
      isSessionSplit,
    };
  }

  /**
   * Called when the IDE window loses focus.
   * Credits pending time up to idleTimeout and stops active tracking until focus returns.
   */
  public onWindowBlur(now: number): HeartbeatResult {
    let creditedMs = 0;
    const previousFile = this.currentFile;

    if (this.lastHeartbeatAt !== null && this.isFocused && previousFile !== null) {
      const gap = Math.max(0, now - this.lastHeartbeatAt);
      if (gap <= this.idleTimeoutMs) {
        creditedMs = gap;
      }
    }

    this.isFocused = false;
    this.lastHeartbeatAt = null;

    return {
      file: previousFile,
      creditedMs,
      isIdleGap: true,
      isSessionSplit: false,
    };
  }

  /**
   * Called when the IDE window regains focus.
   * Does not credit the period the window was blurred.
   */
  public onWindowFocus(file: string | null, now: number): void {
    this.isFocused = true;
    this.currentFile = file;
    this.lastHeartbeatAt = now;
  }

  public getCurrentFile(): string | null {
    return this.currentFile;
  }

  public getLastHeartbeatAt(): number | null {
    return this.lastHeartbeatAt;
  }

  public isWindowFocused(): boolean {
    return this.isFocused;
  }

  public reset(): void {
    this.lastHeartbeatAt = null;
    this.currentFile = null;
    this.isFocused = true;
  }
}
