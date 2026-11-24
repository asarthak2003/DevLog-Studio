import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { createMonthlySummary } from './merge';
import { Store } from './store';

/**
 * Background retention worker that rolls up days older than retentionDays
 * into compact monthly summaries and removes raw daily files.
 */
export async function runRetentionJob(
  store: Store,
  workspaceId: string,
  retentionDays = 90
): Promise<void> {
  try {
    const days = await store.listDays(workspaceId);
    if (days.length === 0) return;

    const now = Date.now();
    const cutoffMs = now - retentionDays * 24 * 60 * 60 * 1000;

    // Filter dates older than cutoff
    const expiredDates = days.filter((d) => {
      const parsed = Date.parse(`${d}T00:00:00Z`);
      return !isNaN(parsed) && parsed < cutoffMs;
    });

    if (expiredDates.length === 0) return;

    logger.info(`Running DevLog Studio retention roll-up for ${expiredDates.length} historical day(s)...`);

    // Group expired dates by month (YYYY-MM)
    const monthsMap = new Map<string, string[]>();
    for (const d of expiredDates) {
      const month = d.slice(0, 7);
      if (!monthsMap.has(month)) {
        monthsMap.set(month, []);
      }
      monthsMap.get(month)!.push(d);
    }

    const baseUri = store.getStorageUri();

    for (const [month, monthDays] of monthsMap.entries()) {
      const dailyLogs = [];
      for (const d of monthDays) {
        const log = await store.loadDay(workspaceId, d);
        if (log) {
          dailyLogs.push(log);
        }
      }

      if (dailyLogs.length > 0) {
        const summary = createMonthlySummary(month, workspaceId, dailyLogs);
        const summaryFolder = vscode.Uri.joinPath(baseUri, 'summaries', workspaceId);
        await vscode.workspace.fs.createDirectory(summaryFolder);

        const summaryUri = vscode.Uri.joinPath(summaryFolder, `${month}.json`);
        const bytes = Buffer.from(JSON.stringify(summary, null, 2), 'utf-8');
        await vscode.workspace.fs.writeFile(summaryUri, bytes);
      }

      // Delete raw expired daily files
      const dataFolder = vscode.Uri.joinPath(baseUri, 'data', workspaceId);
      const entries = await vscode.workspace.fs.readDirectory(dataFolder);

      for (const d of monthDays) {
        const matchingFiles = entries.filter(([name]) => name.startsWith(`${d}.`));
        for (const [name] of matchingFiles) {
          const fileUri = vscode.Uri.joinPath(dataFolder, name);
          try {
            await vscode.workspace.fs.delete(fileUri, { useTrash: false });
          } catch {
            // ignore deletion failure
          }
        }
      }
    }

    logger.info('DevLog Studio retention roll-up completed successfully');
  } catch (err) {
    logger.warn('DevLog Studio retention roll-up encountered an error', err);
  }
}
