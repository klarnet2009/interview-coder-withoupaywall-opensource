# Config and Persistence (EN)

## Storage Overview

The application persists data in three main buckets:

1. Runtime config (`config.json` under app userData path)
2. Session history (`electron-store` file `session-history`)
3. Screenshot files (`screenshots`, `extra_screenshots`, temporary screenshot dir)

## Config File

Primary implementation: `electron/ConfigHelper.ts`

### Location

- Default: `<userData>/config.json`
- `userData` is set in `electron/main.ts` to app-scoped directory (`interview-coder-v1`).

### Key Fields

- Provider/API:
  - `apiKey`
  - `apiProvider`
  - `extractionModel`
  - `solutionModel`
  - `debuggingModel`
- UI and behavior:
  - `language`
  - `opacity`
  - `displayConfig`
- Onboarding:
  - `wizardCompleted`
  - `wizardMode`
- Interview profile preferences:
  - `interviewPreferences`
  - `profiles`
  - `activeProfileId`
- Audio:
  - `audioConfig`

### Write Strategy

- `saveConfig(...)` uses atomic write pattern:
  - write temp file
  - backup previous valid file
  - rename temp to target
- `loadConfig(...)` supports corruption recovery from backup.

### Migration Paths

- Legacy config migration when new fields are missing.
- One-time migration from old `secure-data.json` API key storage.

## API Key Storage Status

Current behavior:

- API key is stored in plain JSON (`config.apiKey`).
- `SecureStorage` exists but encryption path is intentionally disabled.

Implication:

- Local-at-rest encryption is currently not enforced.

## Opacity Persistence Path

- `set-window-opacity` IPC updates both window opacity and persisted config.
- `ConfigHelper.setOpacity(...)` performs targeted direct file write.

Note:

- This targeted write bypasses the full backup/atomic logic in `saveConfig(...)`.

## Session History Store

Primary implementation: `electron/store.ts`

- Backed by `electron-store` key `sessionHistory`.
- Keeps max 30 sessions.
- Session entries contain snippets and optional workspace snapshots.

Known wiring gap:

- Session history IPC methods are exposed in preload but corresponding `ipcMain.handle` routes are currently missing.

## Screenshot Persistence

Primary implementation: `electron/ScreenshotHelper.ts`

Directories:

- `<userData>/screenshots`
- `<userData>/extra_screenshots`
- `<temp>/interview-coder-screenshots`

Behavior:

- Queues are memory-backed with file paths.
- Directories are cleaned on startup.
- Max queue length per stream is limited (`MAX_SCREENSHOTS`).

## Recommendations

1. Move API key to OS-backed encryption (`safeStorage` with robust fallback policy).
2. Route all config writes through a single atomic writer (including opacity updates).
3. Add persistence smoke tests for config corruption recovery and migration.
4. Implement missing IPC handlers for session history to align preload/runtime contract.
