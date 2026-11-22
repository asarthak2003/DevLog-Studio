import * as vscode from 'vscode';
import { ActivityModel } from './core/activityModel';
import { HeartbeatTracker } from './core/heartbeat';
import { IgnoreFilter } from './core/ignore';
import { EditorTracker } from './tracking/editorTracker';
import { logger } from './util/logger';

let activityModel: ActivityModel | undefined;

/**
 * Extension entry point: wiring and dependency injection only.
 * No business logic should reside in this file.
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Initialize logging system
  logger.init(context);
  logger.info('DevLog Studio extension activating (Phase 2: Activity Capture Engine)');

  // 2. Read configuration
  const config = vscode.workspace.getConfiguration('devlogstudio');
  const idleTimeoutMinutes = config.get<number>('idleTimeoutMinutes', 3);
  const sessionGapMinutes = config.get<number>('sessionGapMinutes', 30);
  const ignorePatterns = config.get<string[]>('ignore', []);
  const minTouchSeconds = config.get<number>('minTouchSeconds', 5);

  // 3. Initialize core domain models and services
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
  activityModel = new ActivityModel(workspaceFolder);

  const heartbeatTracker = new HeartbeatTracker({
    idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
    sessionGapMs: sessionGapMinutes * 60 * 1000,
  });

  const ignoreFilter = new IgnoreFilter(ignorePatterns);

  // 4. Initialize tracking listeners
  const editorTracker = new EditorTracker(activityModel, heartbeatTracker, ignoreFilter);
  context.subscriptions.push(editorTracker);

  // 5. Register commands
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

  logger.info('DevLog Studio extension activated successfully');
}

/**
 * Clean up extension resources on deactivation.
 */
export function deactivate(): void {
  logger.info('DevLog Studio extension deactivating');
}
