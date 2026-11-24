// Core domain types, state interfaces, and data models for DevLog Studio.

export interface TrackerConfig {
  idleTimeoutMinutes: number;
  sessionGapMinutes: number;
  minTouchSeconds: number;
  retentionDays: number;
  ignorePatterns: string[];
}

export interface FileStats {
  activeMs: number;
  editCount: number;
  linesAdded: number;
  linesRemoved: number;
  firstTouch: number;
  lastTouch: number;
  lastCursor?: { line: number; character: number };
  lastVisibleRange?: { startLine: number; endLine: number };
  symbols?: Record<string, SymbolStats>;
}

export interface SymbolStats {
  kind: string;
  edits: number;
  lastTouch: number;
  lastKnownLine: number;
}

export interface Session {
  id: string;
  start: number;
  end: number;
  activeMs: number;
  branch?: string;
  repo?: string;
}

export interface DayLog {
  schemaVersion: number;
  workspaceId: string;
  date: string;
  sessions: Session[];
  files: Record<string, FileStats>;
  events: TimelineEvent[];
  notes?: UserNote[];
}

export interface TimelineEvent {
  type: 'commit' | 'terminal' | 'debug' | 'task' | 'branchSwitch';
  time: number;
  [key: string]: unknown;
}

export interface UserNote {
  id: string;
  createdAt: number;
  file: string;
  line: number;
  anchorText: string;
  text: string;
  kind: 'note' | 'next';
  done: boolean;
  branch?: string;
}

export interface HeartbeatResult {
  file: string | null;
  creditedMs: number;
  isIdleGap: boolean;
  isSessionSplit: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  folderPath: string;
  lastSeen: number;
}

export interface WorkspaceIndex {
  workspaces: Record<string, WorkspaceInfo>;
}

export interface MonthlySummary {
  schemaVersion: number;
  month: string; // YYYY-MM
  workspaceId: string;
  totalActiveMs: number;
  totalEdits: number;
  linesAdded: number;
  linesRemoved: number;
  files: Record<string, { activeMs: number; editCount: number }>;
  commits?: string[];
}
