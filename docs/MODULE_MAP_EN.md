# Module Map (EN)

## Root-Level Files

- `package.json`: scripts, dependencies, Electron Builder packaging config.
- `vite.config.ts`: Vite + `vite-plugin-electron` setup for renderer/main/preload builds.
- `tsconfig.electron.json`: Electron TypeScript config (currently non-strict).
- `eslint.config.mjs`: flat ESLint config for TS/JS/JSON/Markdown/CSS.
- `README.md`: user-facing project and run instructions.

## Electron Main Process (`electron/`)

### Core Runtime

- `electron/main.ts`: app lifecycle, BrowserWindow setup, helper wiring, IPC bootstrap, shortcuts registration.
- `electron/ipcHandlers.ts`: all `ipcMain.handle` routes for config, screenshot flow, live interview flow, and window controls.
- `electron/preload.ts`: `window.electronAPI` bridge with invoke/listener wrappers.
- `electron/shortcuts.ts`: global shortcut registrations and handlers.
- `electron/autoUpdater.ts`: update check/download/install wiring.

### Feature Services

- `electron/ScreenshotHelper.ts`: screenshot capture, queues, preview generation, cleanup.
- `electron/ProcessingHelper.ts`: AI processing pipeline for extraction, solution generation, and debug analysis.
- `electron/AudioProcessor.ts`: non-live transcription and hint generation helpers.
- `electron/ConfigHelper.ts`: config load/save/migration/update and provider key validation.
- `electron/validation.ts`: IPC payload validators.
- `electron/store.ts`: session history store abstraction (`electron-store`).
- `electron/SecureStorage.ts`: legacy secure storage helper (currently disabled encryption path).

### Live Audio Subsystem (`electron/audio/`)

- `electron/audio/GeminiLiveService.ts`: WebSocket streaming session with Gemini Live API.
- `electron/audio/HintGenerationService.ts`: SSE hint generation over Gemini model.
- `electron/audio/LiveInterviewService.ts`: orchestrates live transcript + hint state machine.
- `electron/audio/AudioCaptureService.ts`: capture service abstraction (currently not used by main runtime flow).
- `electron/audio/index.ts`: exports for audio module symbols.

## Renderer (`src/`)

### App Shell

- `src/main.tsx`: React root + router bootstrap.
- `src/App.tsx`: global app shell, wizard gating, settings/welcome routing.

### Pages

- `src/_pages/SubscribedApp.tsx`: queue/solutions container and dynamic sizing.
- `src/_pages/Queue.tsx`: screenshot queue view.
- `src/_pages/Solutions.tsx`: solution/debug/sessions view.
- `src/_pages/DebugLive.tsx`: diagnostic page for live interview stack.

### Main UI Components

- `src/components/UnifiedPanel/UnifiedPanel.tsx`: core control panel (capture, solve, live interview controls, notices).
- `src/components/Wizard/*`: onboarding/setup flow.
- `src/components/Settings/*`: settings pages/forms/dialogs.
- `src/components/Queue/*`: screenshot list and items.
- `src/components/Solutions/SolutionCommands.tsx`: command/action controls for solution view.
- `src/components/Sessions/*`: session history UI.

### Support Modules

- `src/types/*`: app-wide TypeScript contracts.
- `src/i18n/*`: localization bootstrap and locale files.
- `src/services/AudioCaptureService.ts`: renderer audio capture service abstraction.
- `src/contexts/toast.tsx`: toast context state.

## Public Assets

- `public/pcm-capture-processor.js`: AudioWorklet processor converting captured audio to PCM chunks.
- `assets/icons/*`: packaging icons for platforms.

## Tests

- `tests/unit/validation.test.ts`: tests for IPC validation utilities.

## Legacy/Secondary Tree

- `renderer/`: secondary React app scaffold not part of the main Electron runtime path.

## Quick Ownership Matrix

- Windowing and OS behavior: `electron/main.ts`, `electron/shortcuts.ts`
- IPC boundary: `electron/preload.ts`, `electron/ipcHandlers.ts`, `src/types/electron.d.ts`
- AI processing: `electron/ProcessingHelper.ts`, `electron/audio/*`
- Config/persistence: `electron/ConfigHelper.ts`, `electron/store.ts`
- Primary user flow UI: `src/App.tsx`, `src/components/UnifiedPanel/UnifiedPanel.tsx`, `src/_pages/*`
