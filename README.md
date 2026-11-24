# DevLog Studio

<p align="left">
  <strong>Your work, remembered. Resume tomorrow, report in seconds.</strong>
</p>

DevLog Studio is a quiet, privacy-first, local-only VS Code extension that passively tracks your software development workflow—files touched, active coding time, keystroke line counts, symbols, git branches, and commits—turning raw developer activity into structured timelines, instant session resumption, and one-click standup reports.

---

## Why DevLog Studio?

- **100% Offline & Zero Telemetry:** DevLog Studio never makes network calls. No API keys, no AI models, no telemetry, and no data leaving your machine.
- **Local-Only Metadata:** Only file paths, line counters, symbol names, and timestamps are tracked. **Your source code contents are never stored.**
- **Zero Keystroke Lag:** Event handlers run lightweight arithmetic counters only. Heavy parsing and disk writes are debounced so typing remains butter-smooth.
- **Multi-Window Safe:** Works seamlessly with multiple VS Code windows open on the same project without locking or file conflicts.

---

## Quick Start

1. **Install DevLog Studio** from the VS Code Marketplace or Open VSX.
2. **Just start coding:** DevLog Studio automatically tracks your active focus, edit bursts, and file touches in the background.
3. **Inspect your activity:** Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
   ```text
   DevLog Studio: Dump Activity Model to Log
   ```
   The Output panel will open showing your active time, edit counts, and lines added/removed per file.
4. **Pause anytime:** Need private time? Run `DevLog Studio: Pause/Resume Tracking` from the Command Palette to pause tracking instantly.

---

## Commands & Detailed Purposes

Access all commands anytime via the Command Palette (**`Ctrl+Shift+P`** on Windows/Linux, **`Cmd+Shift+P`** on macOS) by typing `DevLog Studio`:

| Command ID | Command Title | Quick Purpose |
|---|---|---|
| `devlogstudio.dumpModel` | **DevLog Studio: Dump Activity Model to Log** | Generates an instant ASCII report of active sessions, time per file, and edit metrics. |
| `devlogstudio.togglePause` | **DevLog Studio: Pause/Resume Tracking** | One-click toggle to temporarily pause or resume all activity monitoring. |
| `devlogstudio.showLog` | **DevLog Studio: Show Log** | Opens and reveals the dedicated DevLog Studio log channel in the Output panel. |
| `devlogstudio.openDataFolder` | **DevLog Studio: Open Data Folder** | Reveals the local storage directory in your OS file explorer. |
| `devlogstudio.exportData` | **DevLog Studio: Export Data** | Merges and exports all recorded workspace history into a standalone JSON file. |
| `devlogstudio.clearData` | **DevLog Studio: Clear Workspace Data** | Safely deletes all recorded tracking and summary files for the current workspace. |
| `devlogstudio.flushNow` | **DevLog Studio: Flush Data to Disk Now** | Forces an immediate write of pending in-memory activity logs to local storage. |

---

### Deep Dive: Command Purposes & Use Cases

#### 1. `DevLog Studio: Dump Activity Model to Log`
* **Primary Purpose:** Instant live visibility into your current coding session.
* **When to Use:**
  * Before heading to lunch or ending your workday to see exactly what you accomplished.
  * During daily standups to recall the exact files, lines, and durations you worked on.
  * To verify that your project ignore globs are working as expected.
* **What it Does:** Computes in-memory session statistics and renders a clean, human-readable ASCII summary table directly in the **Output** channel:
  ```text
  ========================================================================
  DevLog Studio Activity Dump | Date: 2026-11-24 | Paused: false
  Sessions (1):
    - Session a1b2c3: 42m active / 1h 10m span (Branch: main)
  ------------------------------------------------------------------------
  Tracked Files:
  File                                 | Active     | Edits   | +Lines  | -Lines 
  ------------------------------------------------------------------------
  src/core/heartbeat.ts                | 24m        | 18      | 85      | 12     
  src/tracking/editorTracker.ts        | 18m        | 12      | 42      | 6      
  ========================================================================
  Total Active: 42m | Total Edits: 30
  ========================================================================
  ```

#### 2. `DevLog Studio: Pause/Resume Tracking`
* **Primary Purpose:** Privacy on-demand and distraction filtering.
* **When to Use:**
  * When opening confidential files, credentials, or personal side-notes that you don't want recorded in your activity history.
  * During prolonged meetings or pair-programming sessions where you want tracking frozen.
* **What it Does:** Immediately flips the internal tracking state. While paused, all keystrokes, editor switches, and active-time counters are ignored. Running the command again displays a notification and resumes tracking seamlessly.

#### 3. `DevLog Studio: Show Log`
* **Primary Purpose:** Quick access to the extension's diagnostic logs and activity history.
* **When to Use:**
  * When you want to review historical logs, check extension startup status, or inspect output without digging through the VS Code Output channel dropdown.
* **What it Does:** Opens the bottom **Output** panel and brings the `DevLog Studio` log stream into immediate focus.

---

## Extension Settings

Customize DevLog Studio under **Settings** (`Ctrl+,` or `Cmd+,`) by searching for `DevLog Studio`:

| Setting | Type | Default | Description |
|---|:---:|:---:|---|
| `devlogstudio.idleTimeoutMinutes` | `number` | `3` | Inactivity threshold before active-time accumulation pauses. |
| `devlogstudio.sessionGapMinutes` | `number` | `30` | Inactivity threshold before work is split into a new session. |
| `devlogstudio.retentionDays` | `number` | `90` | Days of raw daily logs to retain before rolling up into monthly summaries. |
| `devlogstudio.ignore` | `array` | `[...defaults]` | Glob patterns for files and directories that should never be tracked. |
| `devlogstudio.minTouchSeconds` | `number` | `5` | Minimum seconds a file must remain focused to count as touched if no edits were made. |

*Default ignore patterns:*
`**/node_modules/**`, `**/.git/**`, `**/dist/**`, `**/out/**`, `**/build/**`, `**/*.lock`, `**/package-lock.json`, `**/*.min.*`.

---

## Feature Roadmap

| Phase | Capability | Status |
|:---:|---|:---:|
| **1** | **Foundation & Setup:** High-performance esbuild bundle and structured logging | **Available** |
| **2** | **Activity Capture Engine:** In-memory heartbeat active-time calculation, idle detection, and edit metrics | **Available** |
| **3** | **Local Storage:** Atomic write-behind disk persistence, schema versioning, and retention roll-ups | **Available** |
| **4** | **Timeline Sidebar:** Dedicated Activity Bar tree view (`Day -> Session -> File`) with live updates | *Coming Soon* |
| **5** | **Standup Export & Status Bar (MVP):** One-click deterministic standup summary generator (Markdown/Slack) | *Coming Soon* |
| **6** | **Symbol-Level Tracking:** Function and class attribution ("you edited `TokenStore.refresh`") | *Coming Soon* |
| **7** | **Git Integration:** Branch-partitioned sessions, commit events, and uncommitted changes list | *Coming Soon* |
| **8** | **Resume Context & Notes:** Reopen yesterday's files at saved cursor lines with private gutter notes | *Coming Soon* |
| **9** | **Terminal & Tasks:** Opt-in terminal command tracking with automatic secret redaction | *Coming Soon* |

---

## Privacy & Security Guarantees

DevLog Studio is built from the ground up for strict privacy and enterprise compliance:

1. **Zero Network Connections:** The extension has no network client, no analytics SDKs, and no external endpoints.
2. **No Proprietary Code Access:** DevLog Studio never reads or caches the contents of your files—only file paths, line counts, and timestamps.
3. **Data Sovereignty:** All activity data stays stored solely on your local disk under VS Code's private global storage directory.

---

## Feedback & Issues

Have an idea, request, or issue? Please open an issue on our [GitHub Issue Tracker](https://github.com/asarthak2003/DevLog-Studio/issues).

---

## License

Copyright (c) 2026 Sarthak (asarthak2003). All rights reserved.

This software is source-available for evaluation and contributions via the official repository. Redistribution, modification for independent release, sublicensing, and commercial sale are strictly prohibited. See [LICENSE](LICENSE) for full details.
