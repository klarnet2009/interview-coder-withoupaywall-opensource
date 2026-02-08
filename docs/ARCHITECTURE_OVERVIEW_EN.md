# Architecture Overview (EN)

## System Summary

The app is an Electron desktop client with a React renderer.

- Main process owns window lifecycle, global shortcuts, screenshots, AI API calls, live interview services, config, and IPC handlers.
- Preload process exposes a typed bridge (`window.electronAPI`) to renderer code.
- Renderer process owns UI state and interaction logic.

Primary entry points:

- `electron/main.ts`
- `electron/preload.ts`
- `src/main.tsx`
- `src/App.tsx`

## Runtime Topology

```text
Renderer (React UI)
  -> window.electronAPI (preload bridge)
    -> ipcRenderer.invoke / ipcRenderer.on
      -> ipcMain.handle / BrowserWindow.webContents.send
        -> Main process services
           - ScreenshotHelper
           - ProcessingHelper (OpenAI/Gemini/Anthropic)
           - LiveInterviewService (Gemini Live + HintGeneration)
           - ConfigHelper
```

## Main Process Responsibilities

`electron/main.ts`

- Initializes single-instance app behavior.
- Creates BrowserWindow with dev/prod window policy differences.
- Sets user data/session/cache/temp paths.
- Loads env variables (`.env` in dev, resources path in prod).
- Initializes helpers:
  - `ScreenshotHelper`
  - `ProcessingHelper`
  - `ShortcutsHelper`
- Registers IPC through `initializeIpcHandlers(...)`.
- Registers global shortcuts after window creation.
- Initializes auto-updater.

## Renderer Responsibilities

Core files:

- `src/App.tsx`
- `src/_pages/Queue.tsx`
- `src/_pages/Solutions.tsx`
- `src/components/UnifiedPanel/UnifiedPanel.tsx`

Renderer owns:

- Wizard/setup flow
- Screenshot queue UI
- Solution/debug views
- Live interview controls and visual state
- Toasts and error surfaces

## Primary Feature Flows

### 1. Screenshot Solution Flow

1. Renderer calls `triggerScreenshot`.
2. Main captures screenshot through `ScreenshotHelper`.
3. Renderer requests processing (`trigger-process-screenshots`).
4. Main (`ProcessingHelper`) performs:
   - Problem extraction from images
   - Solution generation
5. Main streams progress and status events back to renderer.

### 2. Debug Flow

1. While in solutions view, extra screenshots are captured.
2. `ProcessingHelper` combines context with extra screenshots.
3. Main returns structured debug output (`issue`, `fix`, `why`, `verify`).

### 3. Live Interview Flow

1. Renderer captures audio via `AudioWorklet`.
2. Renderer sends PCM chunks to main (`live-interview-send-audio`).
3. `LiveInterviewService` forwards audio to `GeminiLiveService`.
4. Transcripts accumulate and trigger `HintGenerationService`.
5. Status/state updates stream back to renderer.

## Environment Modes

### Development (`NODE_ENV=development`)

- BrowserWindow is non-transparent and visible.
- Content protection is disabled.
- Dev server is loaded from `http://localhost:54321`.
- Auto-updater is skipped when app is not packaged.

### Production

- Transparent/invisible behavior and content protection are enabled.
- Bundled `dist/index.html` is loaded.
- Auto-updater can run (requires packaging and `GH_TOKEN`).

## Security Boundaries

- Renderer uses context isolation and preload bridge (`nodeIntegration: false`, `contextIsolation: true`).
- IPC input validation exists for selected handlers (`electron/validation.ts`).
- External URL opening is brokered by main process.

Known boundary weakness:

- API keys are currently stored in raw JSON config (`ConfigHelper`), not encrypted at rest.
