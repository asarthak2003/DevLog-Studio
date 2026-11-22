import * as vscode from 'vscode';
import { ActivityModel } from '../core/activityModel';
import { HeartbeatTracker } from '../core/heartbeat';
import { IgnoreFilter } from '../core/ignore';

export class EditorTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private model: ActivityModel;
  private heartbeat: HeartbeatTracker;
  private ignoreFilter: IgnoreFilter;

  constructor(model: ActivityModel, heartbeat: HeartbeatTracker, ignoreFilter: IgnoreFilter) {
    this.model = model;
    this.heartbeat = heartbeat;
    this.ignoreFilter = ignoreFilter;

    this.registerListeners();
  }

  private getRelativePath(uri: vscode.Uri): string | null {
    if (this.ignoreFilter.isIgnored(uri.scheme, uri.fsPath)) {
      return null;
    }

    const relative = vscode.workspace.asRelativePath(uri, false);
    if (this.ignoreFilter.isIgnored(uri.scheme, relative)) {
      return null;
    }

    return relative;
  }

  private processInteraction(file: string | null): void {
    if (!file || this.model.isTrackingPaused()) {
      return;
    }

    const now = Date.now();
    const result = this.heartbeat.heartbeat(file, now);

    if (result.file && result.creditedMs > 0) {
      this.model.addActiveTime(result.file, result.creditedMs, now);
    }

    if (result.isSessionSplit) {
      this.model.startNewSession(now);
    }

    this.model.touchFile(file, now);
  }

  private registerListeners(): void {
    // 1. Active editor switched
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || this.model.isTrackingPaused()) {
          return;
        }
        const file = this.getRelativePath(editor.document.uri);
        this.processInteraction(file);
      })
    );

    // 2. Cursor selection changed
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (this.model.isTrackingPaused()) return;
        const file = this.getRelativePath(e.textEditor.document.uri);
        if (!file) return;

        this.processInteraction(file);

        if (e.selections.length > 0) {
          const primary = e.selections[0].active;
          this.model.recordCursor(file, primary.line, primary.character, Date.now());
        }
      })
    );

    // 3. Scroll / Visible ranges changed
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
        if (this.model.isTrackingPaused()) return;
        const file = this.getRelativePath(e.textEditor.document.uri);
        if (!file) return;

        this.processInteraction(file);

        if (e.visibleRanges.length > 0) {
          const primary = e.visibleRanges[0];
          this.model.recordVisibleRange(file, primary.start.line, primary.end.line, Date.now());
        }
      })
    );

    // 4. Window focus / blur
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        const now = Date.now();
        if (state.focused) {
          const activeDoc = vscode.window.activeTextEditor?.document;
          const file = activeDoc ? this.getRelativePath(activeDoc.uri) : null;
          this.heartbeat.onWindowFocus(file, now);
          if (file) {
            this.model.touchFile(file, now);
          }
        } else {
          const blurResult = this.heartbeat.onWindowBlur(now);
          if (blurResult.file && blurResult.creditedMs > 0) {
            this.model.addActiveTime(blurResult.file, blurResult.creditedMs, now);
          }
        }
      })
    );

    // 5. Document text edits (Keystrokes & modifications)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.model.isTrackingPaused()) return;
        if (e.contentChanges.length === 0) return; // Ignore dirty-flag notifications

        const file = this.getRelativePath(e.document.uri);
        if (!file) return;

        const now = Date.now();
        this.processInteraction(file);

        let linesAdded = 0;
        let linesRemoved = 0;

        for (const change of e.contentChanges) {
          const newLines = (change.text.match(/\n/g) || []).length;
          const oldLines = change.range.end.line - change.range.start.line;
          linesAdded += newLines;
          linesRemoved += oldLines;
        }

        this.model.recordEdit(file, linesAdded, linesRemoved, now);
      })
    );

    // 6. Document saved
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.model.isTrackingPaused()) return;
        const file = this.getRelativePath(doc.uri);
        if (!file) return;

        const now = Date.now();
        this.processInteraction(file);
        this.model.recordSave(file, now);
      })
    );

    // 7. File renames
    this.disposables.push(
      vscode.workspace.onDidRenameFiles((e) => {
        for (const { oldUri, newUri } of e.files) {
          const oldRel = vscode.workspace.asRelativePath(oldUri, false);
          const newRel = vscode.workspace.asRelativePath(newUri, false);
          this.model.renameFile(oldRel, newRel);
        }
      })
    );

    // 8. File deletions
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((e) => {
        for (const uri of e.files) {
          const rel = vscode.workspace.asRelativePath(uri, false);
          this.model.deleteFile(rel);
        }
      })
    );

    // 9. Configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('devlogstudio')) {
          this.updateConfiguration();
        }
      })
    );
  }

  public updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration('devlogstudio');
    const idleTimeoutMinutes = config.get<number>('idleTimeoutMinutes', 3);
    const sessionGapMinutes = config.get<number>('sessionGapMinutes', 30);
    const ignorePatterns = config.get<string[]>('ignore', []);

    this.heartbeat.updateConfig({
      idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
      sessionGapMs: sessionGapMinutes * 60 * 1000,
    });

    this.ignoreFilter.updatePatterns(ignorePatterns);
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
