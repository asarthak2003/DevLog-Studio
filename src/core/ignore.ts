import picomatch from 'picomatch';

/**
 * Pure ignore pattern matcher using picomatch.
 * Independent of VS Code runtime for unit testing.
 */
export class IgnoreFilter {
  private matcher: (path: string) => boolean;
  private patterns: string[];

  constructor(patterns: string[] = []) {
    this.patterns = patterns;
    this.matcher = picomatch(this.patterns, { dot: true });
  }

  /**
   * Updates ignore patterns and recompiles matcher.
   */
  public updatePatterns(patterns: string[]): void {
    this.patterns = patterns;
    this.matcher = picomatch(this.patterns, { dot: true });
  }

  /**
   * Determines if a document should be excluded from activity capture.
   * @param scheme URI scheme (e.g., 'file', 'untitled', 'output', 'git')
   * @param relativePath Workspace-relative or normalized file path
   */
  public isIgnored(scheme: string, relativePath: string): boolean {
    // Only local filesystem documents are tracked
    if (scheme !== 'file') {
      return true;
    }

    if (!relativePath) {
      return true;
    }

    // Normalize Windows backslashes to forward slashes for picomatch
    const normalized = relativePath.replace(/\\/g, '/');

    // Skip root-relative leading slash if present
    const cleanPath = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    return this.matcher(cleanPath);
  }

  public getPatterns(): string[] {
    return [...this.patterns];
  }
}
