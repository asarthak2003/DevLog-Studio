import * as crypto from 'crypto';

/**
 * Computes a short stable 12-character hex hash from a workspace URI string.
 */
export function getWorkspaceId(folderUriString?: string): string {
  if (!folderUriString) {
    return 'no-workspace';
  }
  return crypto.createHash('sha256').update(folderUriString).digest('hex').slice(0, 12);
}

/**
 * Normalizes file path slashes to forward slashes.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
