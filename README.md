# DevLog Studio

<p align="left">
  <strong>Your work, remembered. Resume tomorrow, report in seconds.</strong>
</p>

DevLog Studio is a quiet, privacy-first, local-only VS Code extension that passively tracks your software development workflow—files touched, active coding time, keystroke line counts, symbols, git branches, and commits—turning raw developer activity into structured timelines, instant session resumption, and one-click standup reports.

---

## Key Principles

- **Zero AI & Zero Network:** Completely offline. Never transmits telemetry, metrics, code, or personal data to external servers or third-party APIs.
- **Local-Only Metadata:** Only tracks file paths, line counters, symbol name paths, and timestamps. **File contents are never stored.**
- **Microsecond Keystroke Overhead:** Event handlers execute $O(1)$ arithmetic counters only. Heavy parsing, disk writes, and AST resolutions are debounced.
- **Decoupled Pure Logic:** Core domain rules are isolated from the VS Code runtime, enabling 100% headless automated unit testing.
- **Multi-Window Concurrency:** Safe file partitioning per editor window avoids concurrency lockups and file collisions.

---

## Features (Current & Roadmap)

| Phase | Capability | Status |
|:---:|---|:---:|
| **1** | **Foundation & Setup:** Strict TypeScript, esbuild bundling, and structured log output channel | **Complete** |
| **2** | **Activity Capture Engine:** In-memory heartbeat active-time calculation, idle detection, and edit metrics | **Complete** |
| **3** | **Local Storage:** Atomic write-behind persistence, schema versioning, and retention roll-up | *Next* |
| **4** | **Timeline Sidebar:** Activity Bar tree view (`Day -> Session -> File`) with throttled live refresh | *Planned* |
| **5** | **Standup Builder & Status Bar (MVP):** Deterministic report generator (Markdown/Slack) and live status bar | *Planned* |
| **6** | **Symbol Tracking:** AST function and class attribution via language server document symbols | *Planned* |
| **7** | **Git Integration:** Branch-partitioned sessions, commit tracking, and uncommitted work inspection | *Planned* |
| **8** | **Session Resume & Notes:** One-click reopen of yesterday's files at saved cursors with private gutter notes | *Planned* |
| **9** | **Terminal & Privacy:** Opt-in terminal command tracking with secret redaction and data inspection | *Planned* |
| **10** | **Production Release:** Hardening, performance benchmarks, and Marketplace / Open VSX publication | *Planned* |

---

## Commands

Access these commands from the Command Palette (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS):

| Command ID | Title | Description |
|---|---|---|
| `devlogstudio.showLog` | **DevLog Studio: Show Log** | Opens the dedicated DevLog Studio structured output channel. |
| `devlogstudio.togglePause` | **DevLog Studio: Pause/Resume Tracking** | Temporarily pauses or resumes all background activity capture. |
| `devlogstudio.dumpModel` | **DevLog Studio: Dump Activity Model to Log** | Formats current in-memory sessions, active time, and edits into an ASCII table. |

---

## Extension Settings

Customize DevLog Studio via **Settings** (`Ctrl+,`) under `DevLog Studio`:

| Setting | Type | Default | Description |
|---|:---:|:---:|---|
| `devlogstudio.idleTimeoutMinutes` | `number` | `3` | Minutes of inactivity before active-time accumulation pauses. |
| `devlogstudio.sessionGapMinutes` | `number` | `30` | Minutes of inactivity before work is automatically split into a new session. |
| `devlogstudio.ignore` | `array` | `[...defaults]` | Glob patterns for files and directories that should never be tracked. |
| `devlogstudio.minTouchSeconds` | `number` | `5` | Minimum seconds a file must remain focused to count as touched if no edits were made. |

*Default ignore patterns:*
`**/node_modules/**`, `**/.git/**`, `**/dist/**`, `**/out/**`, `**/build/**`, `**/*.lock`, `**/package-lock.json`, `**/*.min.*`.

---

## Privacy Guarantee

DevLog Studio is built from the ground up to respect developer privacy and enterprise compliance:

1. **No External Network Requests:** The extension contains zero HTTP/HTTPS network calls, analytics, or background telemetry.
2. **No Code Scraping:** Only metadata (relative file paths, line counter deltas, timestamps) is captured. Your proprietary source code is never read or stored.
3. **Opt-In Everything Sensitive:** Terminal commands, debug sessions, and future integrations default to disabled or strictly redacted modes.

---

## Development & Local Testing

### Prerequisites
- Node.js LTS (v20+ or v22+)
- npm v10+
- VS Code ^1.93.0

### Build & Run
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Build production bundle with esbuild
npm run compile

# 4. Check linting rules
npm run lint
```

### Debugging with Extension Host
1. Open the project in VS Code / Antigravity IDE.
2. Press **`F5`** (or select `Run` -> `Start Debugging`).
3. An **`[Extension Development Host]`** window will launch with DevLog Studio loaded.
4. Open any project in that window, edit files, and run `DevLog Studio: Dump Activity Model to Log` to inspect live capture.

### Docker Interactive Sandbox
To test DevLog Studio inside a browser-based web VS Code instance (`code-server`):
```bash
docker compose up --build
```
Then navigate to `http://localhost:8080` in your web browser.

---

## License

MIT © [DevLog Studio Contributors](LICENSE)
