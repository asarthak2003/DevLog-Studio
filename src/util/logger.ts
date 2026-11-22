import * as vscode from 'vscode';

/**
 * DevLog structured logger wrapping VS Code's LogOutputChannel.
 * Provides leveled logging (info, warn, error, debug) and channel focus controls.
 */
class DevLogger {
  private channel: vscode.LogOutputChannel | undefined;

  public init(context: vscode.ExtensionContext): void {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel('DevLog Studio', { log: true });
      context.subscriptions.push(this.channel);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    this.channel?.info(message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.channel?.warn(message, ...args);
  }

  public error(message: string | Error, ...args: unknown[]): void {
    if (message instanceof Error) {
      this.channel?.error(message.stack || message.message, ...args);
    } else {
      this.channel?.error(message, ...args);
    }
  }

  public debug(message: string, ...args: unknown[]): void {
    this.channel?.debug(message, ...args);
  }

  public show(preserveFocus = true): void {
    this.channel?.show(preserveFocus);
  }
}

export const logger = new DevLogger();
