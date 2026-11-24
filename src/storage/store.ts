import * as vscode from 'vscode';
import { DayLog, WorkspaceIndex, WorkspaceInfo } from '../core/types';
import { logger } from '../util/logger';
import { mergeDayLogs } from './merge';
import { migrateDayLog } from './migrate';

export class Store implements vscode.Disposable {
  private baseStorageUri: vscode.Uri;
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private isDirty = false;
  private pendingLogProvider: (() => DayLog | null) | null = null;
  private activeWorkspaceId = 'default';

  constructor(baseStorageUri: vscode.Uri, sessionId: string) {
    this.baseStorageUri = baseStorageUri;
    this.sessionId = sessionId;
    this.startWriteBehindTimer();
  }

  public getStorageUri(): vscode.Uri {
    return this.baseStorageUri;
  }

  public setPendingLogProvider(workspaceId: string, provider: () => DayLog | null): void {
    this.activeWorkspaceId = workspaceId;
    this.pendingLogProvider = provider;
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  private startWriteBehindTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.isDirty) {
        this.flush().catch((err) => {
          logger.warn('Background store flush failed', err);
        });
      }
    }, 30000);
  }

  public async init(workspaceInfo?: WorkspaceInfo): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.baseStorageUri);
      const dataUri = vscode.Uri.joinPath(this.baseStorageUri, 'data');
      const summariesUri = vscode.Uri.joinPath(this.baseStorageUri, 'summaries');
      await vscode.workspace.fs.createDirectory(dataUri);
      await vscode.workspace.fs.createDirectory(summariesUri);

      if (workspaceInfo) {
        await this.updateWorkspaceIndex(workspaceInfo);
      }
    } catch (err) {
      logger.error('Failed to initialize DevLog Studio storage directories', err);
    }
  }

  public async updateWorkspaceIndex(info: WorkspaceInfo): Promise<void> {
    const indexUri = vscode.Uri.joinPath(this.baseStorageUri, 'index.json');
    let index: WorkspaceIndex = { workspaces: {} };

    try {
      const bytes = await vscode.workspace.fs.readFile(indexUri);
      index = JSON.parse(Buffer.from(bytes).toString('utf-8'));
    } catch {
      // index.json does not exist yet; default empty
    }

    index.workspaces[info.id] = { ...info, lastSeen: Date.now() };

    const payload = Buffer.from(JSON.stringify(index, null, 2), 'utf-8');
    await this.atomicWrite(indexUri, payload);
  }

  private async atomicWrite(targetUri: vscode.Uri, bytes: Uint8Array): Promise<void> {
    const tmpUri = vscode.Uri.parse(`${targetUri.toString()}.tmp`);
    await vscode.workspace.fs.writeFile(tmpUri, bytes);
    await vscode.workspace.fs.rename(tmpUri, targetUri, { overwrite: true });
  }

  /**
   * Saves the current window's log atomically to disk.
   */
  public async save(workspaceId: string, date: string, data: DayLog): Promise<void> {
    const folderUri = vscode.Uri.joinPath(this.baseStorageUri, 'data', workspaceId);
    await vscode.workspace.fs.createDirectory(folderUri);

    const fileName = `${date}.${this.sessionId}.json`;
    const targetUri = vscode.Uri.joinPath(folderUri, fileName);
    const bytes = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');

    await this.atomicWrite(targetUri, bytes);
    this.isDirty = false;
  }

  /**
   * Loads and merges all session logs for a given date and workspace.
   */
  public async loadDay(workspaceId: string, date: string): Promise<DayLog | null> {
    const folderUri = vscode.Uri.joinPath(this.baseStorageUri, 'data', workspaceId);
    let entries: [string, vscode.FileType][] = [];

    try {
      entries = await vscode.workspace.fs.readDirectory(folderUri);
    } catch {
      return null;
    }

    const dayFiles = entries.filter(
      ([name, type]) =>
        type === vscode.FileType.File &&
        name.startsWith(`${date}.`) &&
        name.endsWith('.json') &&
        !name.includes('.tmp') &&
        !name.includes('.corrupt')
    );

    if (dayFiles.length === 0) {
      return null;
    }

    const loadedLogs: DayLog[] = [];

    for (const [name] of dayFiles) {
      const fileUri = vscode.Uri.joinPath(folderUri, name);
      try {
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const parsed = JSON.parse(Buffer.from(bytes).toString('utf-8'));
        const validated = migrateDayLog(parsed);
        loadedLogs.push(validated);
      } catch (err) {
        logger.warn(`Corrupt file detected at ${fileUri.fsPath}. Quarantining...`, err);
        const corruptUri = vscode.Uri.parse(`${fileUri.toString()}.corrupt-${Date.now()}`);
        try {
          await vscode.workspace.fs.rename(fileUri, corruptUri, { overwrite: true });
        } catch {
          // ignore rename failure
        }
      }
    }

    if (loadedLogs.length === 0) {
      return null;
    }

    return mergeDayLogs(loadedLogs);
  }

  public async loadToday(workspaceId: string): Promise<DayLog | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.loadDay(workspaceId, today);
  }

  public async listDays(workspaceId: string): Promise<string[]> {
    const folderUri = vscode.Uri.joinPath(this.baseStorageUri, 'data', workspaceId);
    let entries: [string, vscode.FileType][] = [];

    try {
      entries = await vscode.workspace.fs.readDirectory(folderUri);
    } catch {
      return [];
    }

    const dates = new Set<string>();
    for (const [name, type] of entries) {
      if (type === vscode.FileType.File && name.endsWith('.json')) {
        const match = name.match(/^(\d{4}-\d{2}-\d{2})\./);
        if (match) {
          dates.add(match[1]);
        }
      }
    }

    return Array.from(dates).sort().reverse();
  }

  public async flush(): Promise<void> {
    if (!this.pendingLogProvider) {
      return;
    }

    const currentLog = this.pendingLogProvider();
    if (currentLog) {
      await this.save(this.activeWorkspaceId, currentLog.date, currentLog);
      logger.debug(`Flushed DevLog Studio data to disk for ${currentLog.date}`);
    }
  }

  public async exportAll(workspaceId: string): Promise<Record<string, unknown>> {
    const days = await this.listDays(workspaceId);
    const dayRecords: Record<string, DayLog> = {};

    for (const d of days) {
      const merged = await this.loadDay(workspaceId, d);
      if (merged) {
        dayRecords[d] = merged;
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      workspaceId,
      daysCount: days.length,
      days: dayRecords,
    };
  }

  public async clearData(workspaceId?: string): Promise<void> {
    if (workspaceId) {
      const dataUri = vscode.Uri.joinPath(this.baseStorageUri, 'data', workspaceId);
      const summariesUri = vscode.Uri.joinPath(this.baseStorageUri, 'summaries', workspaceId);
      await this.deleteDirectorySafely(dataUri);
      await this.deleteDirectorySafely(summariesUri);
    } else {
      const dataUri = vscode.Uri.joinPath(this.baseStorageUri, 'data');
      const summariesUri = vscode.Uri.joinPath(this.baseStorageUri, 'summaries');
      await this.deleteDirectorySafely(dataUri);
      await this.deleteDirectorySafely(summariesUri);
    }
    this.isDirty = false;
  }

  private async deleteDirectorySafely(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    } catch {
      // directory did not exist
    }
  }

  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
