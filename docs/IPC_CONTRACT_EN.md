# IPC Contract (EN)

This document describes the current renderer-to-main contract exposed through `window.electronAPI`.

## Boundary Files

- Bridge definition: `electron/preload.ts`
- Main handlers: `electron/ipcHandlers.ts`
- Renderer typing: `src/types/electron.d.ts`

## Invoke Channels (`ipcRenderer.invoke` -> `ipcMain.handle`)

### Config and Setup

- `get-config`
- `update-config`
- `set-window-opacity`
- `check-api-key`
- `validate-api-key`
- `test-api-key`
- `wizard-complete`
- `wizard-reset`
- `is-wizard-completed`
- `get-system-prompt-preview`

### Screenshot and Processing

- `get-screenshot-queue`
- `get-extra-screenshot-queue`
- `delete-screenshot`
- `get-image-preview`
- `get-screenshots`
- `trigger-screenshot`
- `take-screenshot`
- `process-screenshots`
- `trigger-process-screenshots`
- `delete-last-screenshot`

### Window and App Controls

- `update-content-dimensions`
- `set-window-dimensions`
- `set-setup-window-size`
- `toggle-window`
- `trigger-move-left`
- `trigger-move-right`
- `trigger-move-up`
- `trigger-move-down`
- `reset-queues`
- `trigger-reset`
- `open-settings-portal`
- `is-dev`
- `set-always-on-top`
- `set-stealth-mode`
- `toggle-stealth`
- `quit-app`

### Audio and Live Interview

- `get-audio-sources`
- `test-audio`
- `transcribe-audio`
- `generate-hints`
- `live-interview-start`
- `live-interview-stop`
- `live-interview-status`
- `live-interview-send-text`
- `live-interview-send-audio`

### External URLs and Updates

- `open-external-url`
- `openLink`
- `start-update` (registered in `electron/autoUpdater.ts`)
- `install-update` (registered in `electron/autoUpdater.ts`)

## Push Events (`webContents.send` -> renderer listeners)

### Screenshot and Processing Events

- `screenshot-taken`
- `screenshot-deleted`
- `processing-status`
- `initial-start`
- `problem-extracted`
- `solution-success`
- `solution-error`
- `debug-start`
- `debug-success`
- `debug-error`
- `processing-no-screenshots`
- `api-key-invalid`
- `reset-view`
- `reset`
- `delete-last-screenshot`

### Live Interview Events

- `live-interview-status`
- `live-interview-state`
- `live-interview-error`

### UI/Settings/Update Events

- `show-settings-dialog`
- `update-available`
- `update-downloaded`
- `credits-updated`

## Payload Conventions

- Most handlers return `{ success: boolean, error?: string }` or typed data objects.
- Processing status pushes `{ message: string, progress: number }`.
- Live interview status pushes `{ state, transcript, response, audioLevel, error? }`.
- Screenshot items are `{ path, preview }`.

## Contract Drift and Gaps (Current)

### Missing handlers exposed by preload

Preload exposes channels that currently have no corresponding `ipcMain.handle`:

- `get-session-history`
- `get-session-history-item`
- `delete-session-history-item`
- `clear-session-history`

Impact:

- Renderer calls for session history can fail at runtime with unhandled invoke channel errors.

### Channel name mismatch

- Preload method `openExternal` invokes `openExternal`.
- Main handlers implement `open-external-url` and `openLink`.

Impact:

- Calls through `window.electronAPI.openExternal(...)` do not match an active main channel.

### Typo in event constant

- `PROCESSING_EVENTS.UNAUTHORIZED` in preload is `procesing-unauthorized` (missing "s").

Impact:

- Any code depending on this constant event name will not align with correctly spelled channels.

### Type definition drift

- `src/types/electron.d.ts` contains duplicate `setWindowOpacity` signatures.
- Type surface includes methods that are legacy or weakly aligned with runtime behavior.

Impact:

- Type-level confidence is reduced, and integration mistakes are harder to detect.

## Hardening Recommendations

1. Generate a single source-of-truth IPC map in code and derive preload/type declarations from it.
2. Add contract tests that assert every preload invoke channel has a matching main handler.
3. Enforce channel naming conventions (`kebab-case`) and reject unknown invocations in dev.
4. Add runtime schema validation on both invoke payload and response payload for critical routes.
