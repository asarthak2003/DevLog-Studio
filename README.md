# DevLog Studio

**Your work, remembered. Resume tomorrow, report in seconds.**

DevLog Studio is a local-only VS Code extension that records developer activity (files touched, active time, edits, AST symbols, branches, and commits) without AI, telemetry, or network calls.

## Principles

- **No AI, no network:** Completely offline. Never transmits any data.
- **Local-only metadata:** Only records file paths, line counts, symbol names, and timestamps. File contents are never stored.
- **Microsecond keystroke overhead:** Event handlers execute $O(1)$ arithmetic; all heavy parsing or writes are debounced.
- **Pure logic separation:** Core functionality is decoupled from VS Code APIs for deterministic unit testing.

## Commands

- `DevLog Studio: Show Log` (`devlogstudio.showLog`): Displays structured logs in the output channel.
# 1. Install dependencies
npm install

# 2. Compile and bundle with esbuild
npm run compile

# 3. Lint the codebase
npm run lint
Then press F5 in VS Code, open the Command Palette (Ctrl+Shift+) 
DevLog Studio: Show Log