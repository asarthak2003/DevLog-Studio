# DevLog Studio Release Notes

Record of changes, enhancements, and milestones across versions of DevLog Studio.

---

## [Unreleased]

### Planned
- **Phase 3:** Persistent local storage engine, atomic `.tmp` write flushing, and retention manager.
- **Phase 4:** Dedicated Activity Bar Timeline tree view (`Day -> Session -> File`).
- **Phase 5:** One-click standup summary generator (Markdown, Plain Text, Slack) and status bar time tracker (v0.1 MVP).
- **Phase 6:** AST symbol-level attribution ("edited `TokenStore.refresh`" via document symbol providers).
- **Phase 7:** Git branch-aware session grouping, commit events, and uncommitted changes tracker.
- **Phase 8:** Session context resumption (reopening files at saved cursor lines) and private gutter notes.
- **Phase 9:** Terminal command tracking with secret redaction, debug session metrics, and privacy auditing.

---

## [0.0.1] - 2026-11-22

### Added
- **Project Foundation (Phase 1):**
  - Scaffolded extension targeting VS Code `^1.93.0` with strict TypeScript and esbuild bundler.
  - Composition root in `src/extension.ts` ensuring clean lifecycle disposal via `context.subscriptions`.
  - Structured leveled logger wrapping VS Code's `LogOutputChannel` with `info`, `warn`, `error`, and `debug` methods.
  - Base command: `DevLog Studio: Show Log` (`devlogstudio.showLog`).

- **Activity Capture Engine (Phase 2):**
  - **Interaction-Driven Heartbeats:** Event-driven active time tracking calculating deltas on user interactions without battery-draining polling timers.
  - **Idle Gap Detection:** Configurable idle timeout (`devlogstudio.idleTimeoutMinutes`) stopping time accumulation during inactivity.
  - **Window Focus Management:** Automatically caps and freezes active-time credit on window blur and safely resumes on focus.
  - **Edit Quantification:** Microsecond-cost $O(1)$ event handler recording lines added, lines removed, and edit counts without calling `document.getText()`.
  - **Ignore Engine:** Pure pattern filter using `picomatch` supporting globs (`devlogstudio.ignore`) and non-`file` URI scheme exclusion.
  - **In-Memory Activity Model:** Tracks file touches, cursor positions, visible scroll ranges, session intervals, and file renames/deletions.
  - **Diagnostic Command:** `DevLog Studio: Dump Activity Model to Log` (`devlogstudio.dumpModel`) outputting formatted ASCII activity summaries.
  - **Pause/Resume Control:** `DevLog Studio: Pause/Resume Tracking` (`devlogstudio.togglePause`).

- **Testing & Quality Assurance:**
  - Fast, headless unit test suite using `tsx` and Node 22's native `node:test` runner.
  - Comprehensive unit test coverage for `HeartbeatTracker`, `IgnoreFilter`, and `ActivityModel`.
  - ESLint configuration with strict typescript-eslint rules.

- **DevOps & Containerization:**
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`) gating pull requests targeting `main`.
  - GitHub Actions release workflow (`.github/workflows/deploy-main.yml`) packaging `.vsix` and pushing Docker images to GitHub Container Registry (`ghcr.io`).
  - Multi-stage `Dockerfile` and `docker-compose.yml` packaging an interactive browser-based `code-server` sandbox with DevLog Studio pre-installed.
