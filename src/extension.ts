import * as vscode from 'vscode';
import { ActivityModel } from './core/activityModel';
import { HeartbeatTracker } from './core/heartbeat';
import { IgnoreFilter } from './core/ignore';
import { WorkspaceInfo } from './core/types';
import { runRetentionJob } from './storage/retention';
import { Store } from './storage/store';
import { EditorTracker } from './tracking/editorTracker';
import { logger } from './util/logger';
import { getWorkspaceId } from './util/paths';

let activityModel: ActivityModel | undefined;
let store: Store | undefined;

/**
 * Extension entry point: wiring and dependency injection only.
 * No business logic should reside in this file.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Initialize logging system
  logger.init(context);
  logger.info('DevLog Studio extension activating (Phase 3: Storage & Data Model)');

  // 2. Read configuration
  const config = vscode.workspace.getConfiguration('devlogstudio');
  const idleTimeoutMinutes = config.get<number>('idleTimeoutMinutes', 3);
  const sessionGapMinutes = config.get<number>('sessionGapMinutes', 30);
  const ignorePatterns = config.get<string[]>('ignore', []);
  const minTouchSeconds = config.get<number>('minTouchSeconds', 5);
  const retentionDays = config.get<number>('retentionDays', 90);

  // 3. Resolve workspace identity
  const primaryFolder = vscode.workspace.workspaceFolders?.[0];
  const folderUriString = primaryFolder?.uri.toString();
  const workspaceId = getWorkspaceId(folderUriString);
  const workspaceName = primaryFolder?.name || '(no workspace)';
  const folderPath = primaryFolder?.uri.fsPath || '';

  const workspaceInfo: WorkspaceInfo = {
    id: workspaceId,
    name: workspaceName,
    folderPath,
    lastSeen: Date.now(),
  };

  // 4. Initialize local storage engine
  const sessionId = vscode.env.sessionId;
  store = new Store(context.globalStorageUri, sessionId);
  context.subscriptions.push(store);

  await store.init(workspaceInfo);

  // 5. Initialize in-memory activity model and restore today's data if present
  activityModel = new ActivityModel(workspaceId);

  try {
    const existingToday = await store.loadToday(workspaceId);
    if (existingToday) {
      activityModel.restoreFromSnapshot(existingToday);
      logger.info(`Restored today's activity snapshot for ${workspaceName} (${Object.keys(existingToday.files).length} files)`);
    }
  } catch (err) {
    logger.warn('Failed to restore today activity snapshot on startup', err);
  }

  // Hook model snapshot to store write-behind flusher
  store.setPendingLogProvider(workspaceId, () => activityModel?.getSnapshot() || null);

  // 6. Initialize heartbeat and ignore filters
  const heartbeatTracker = new HeartbeatTracker({
    idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
    sessionGapMs: sessionGapMinutes * 60 * 1000,
  });

  const ignoreFilter = new IgnoreFilter(ignorePatterns);

  // 7. Initialize tracking listeners with auto-flush hook
  const editorTracker = new EditorTracker(
    activityModel,
    heartbeatTracker,
    ignoreFilter,
    () => {
      store?.markDirty();
      store?.flush().catch((err) => logger.warn('Immediate flush error', err));
    }
  );
  context.subscriptions.push(editorTracker);

  // 8. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.showLog', () => {
      logger.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.togglePause', () => {
      if (!activityModel) return;
      const isPaused = activityModel.setPaused(!activityModel.isTrackingPaused());
      const message = isPaused ? 'Tracking paused' : 'Tracking resumed';
      logger.info(`DevLog Studio: ${message}`);
      vscode.window.showInformationMessage(`DevLog Studio: ${message}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.dumpModel', () => {
      if (!activityModel) return;
      const dumpText = activityModel.formatDump(minTouchSeconds);
      logger.info('\n' + dumpText);
      logger.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.openDataFolder', async () => {
      if (!store) return;
      const uri = store.getStorageUri();
      await vscode.commands.executeCommand('revealFileInOS', uri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.flushNow', async () => {
      if (!store) return;
      await store.flush();
      vscode.window.showInformationMessage('DevLog Studio: Activity data flushed to disk.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.exportData', async () => {
      if (!store) return;
      try {
        const exportPayload = await store.exportAll(workspaceId);
        const defaultUri = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders?.[0]?.uri || context.globalStorageUri,
          `devlog-export-${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`
        );

        const targetUri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { 'JSON Files': ['json'] },
          saveLabel: 'Export DevLog Data',
        });

        if (targetUri) {
          const bytes = Buffer.from(JSON.stringify(exportPayload, null, 2), 'utf-8');
          await vscode.workspace.fs.writeFile(targetUri, bytes);
          vscode.window.showInformationMessage(`DevLog Studio: Exported successfully to ${targetUri.fsPath}`);
        }
      } catch (err) {
        logger.error('Failed to export DevLog Studio data', err);
        vscode.window.showErrorMessage('DevLog Studio: Export failed. Check logs for details.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devlogstudio.clearData', async () => {
      if (!store || !activityModel) return;
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete all stored DevLog tracking history for "${workspaceName}"?`,
        { modal: true },
        'Clear Data'
      );

      if (confirmation === 'Clear Data') {
        await store.clearData(workspaceId);
        activityModel = new ActivityModel(workspaceId);
        store.setPendingLogProvider(workspaceId, () => activityModel?.getSnapshot() || null);
        vscode.window.showInformationMessage(`DevLog Studio: Data for "${workspaceName}" cleared.`);
        logger.info(`Cleared storage data for workspace: ${workspaceId} (${workspaceName})`);
      }
    })
  );

  // 9. Low-priority retention background task
  setTimeout(() => {
    if (store) {
      runRetentionJob(store, workspaceId, retentionDays).catch((err) => {
        logger.warn('Retention task error', err);
      });
    }
  }, 6000);

  logger.info(`DevLog Studio extension activated successfully for workspace: ${workspaceName} [${workspaceId}]`);
}

/**
 * Clean up extension resources on deactivation.
 * Flushes pending dirty logs before extension shutdown.
 */
export async function deactivate(): Promise<void> {
  logger.info('DevLog Studio extension deactivating (flushing pending writes)...');
  if (store) {
    try {
      await store.flush();
    } catch (err) {
      logger.warn('Failed to flush storage on deactivation', err);
    }
  }
}
