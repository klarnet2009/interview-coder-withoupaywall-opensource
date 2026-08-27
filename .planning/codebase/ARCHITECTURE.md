# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Electron desktop application with multi-process architecture

**Key Characteristics:**
- Two-process Electron model: main process (Node.js) + renderer process (React)
- IPC bridge via context-isolated preload script for all cross-process communication
- Strategy pattern for AI provider abstraction (OpenAI, Gemini, Anthropic)
- Controller pattern for processing flows (Queue, Debug)
- Singleton module for configuration (`ConfigHelper`, `store.ts`)
- Event-driven architecture using Electron IPC events for real-time updates
- Global state in main process; React Query + local state in renderer

## Layers

### Main Process Layer
- **Purpose:** System-level operations, window lifecycle, screenshots, AI API calls, audio streaming, config persistence
- **Location:** `electron/`
- **Contains:** Window management, IPC handlers, processing controllers, AI provider implementations, audio services, config management
- **Depends on:** Electron APIs, file system, AI provider SDKs (OpenAI, Anthropic, Google Gemini), `desktopCapturer`, `globalShortcut`
- **Used by:** Renderer process (via IPC)

### Preload Bridge Layer
- **Purpose:** Secure IPC bridge between main and renderer with context isolation
- **Location:** `electron/preload.ts`
- **Contains:** `electronAPI` object exposed to `window.electronAPI`
- **Depends on:** `contextBridge`, `ipcRenderer` from Electron
- **Used by:** Renderer process via `window.electronAPI.*`

### Renderer Process Layer
- **Purpose:** UI rendering, user interaction, state management for views
- **Location:** `src/`
- **Contains:** React components, pages, contexts, hooks, types, i18n
- **Depends on:** React, TanStack Query, Radix UI, `window.electronAPI` for all backend communication
- **Used by:** End user via the application window

## Data Flow

### Screenshot → AI Processing → Solution/Debug Flow

```
1. User presses Cmd/Ctrl+H (or clicks screenshot button)
2. ShortcutsHelper → ScreenshotHelper.takeScreenshot()
   a. Main window hides (opacity=0, ignoreMouseEvents=true)
   b. Screen captured via desktopCapturer or screenshot-desktop package
   c. PNG saved to userData/screenshots/ (or extra_screenshots/)
   d. Base64 preview sent to renderer via "screenshot-taken" IPC event
3. Renderer displays screenshot thumbnails in queue view
4. User presses Cmd/Ctrl+Enter to process
5. IPC: renderer → main ("trigger-process-screenshots")
6. ProcessingHelper.processScreenshots() dispatches to controller:
   a. QueueProcessingController (initial solution):
      - Loads screenshot base64 payloads
      - Calls provider.extractProblem() → AI extracts problem info
      - Sends "problem-extracted" event to renderer
      - Calls provider.generateSolution() → AI generates solution
      - Sends "solution-success" event to renderer
      - View changes to "solutions"
   b. DebugProcessingController (debug mode):
      - Combines original + extra screenshots
      - Calls provider.generateDebug() → AI provides debug analysis
      - Sends "debug-success" event to renderer
7. Renderer receives formatted solution/debug data and displays it
```

### Live Interview Audio Flow

```
1. Renderer captures PCM audio via Web Audio API (AudioContext + ScriptProcessorNode)
2. Audio chunk sent via IPC: renderer → main ("live-interview-send-audio")
3. LiveInterviewService (main process) manages:
   a. GeminiLiveService: WebSocket to Gemini Live API for real-time transcription
   b. HintGenerationService: REST API calls to Gemini for hint generation
4. Transcription and hints streamed back via IPC events:
   - "live-interview-status" → transcript + AI response + audio level
   - "live-interview-state" → state transitions (idle/listening/generating)
   - "live-interview-error" → error messages
5. Renderer displays live transcript and AI-generated hints
```

### Configuration Flow

```
1. ConfigHelper singleton reads/writes config.json in userData directory
2. On config update, emits "config-updated" event
3. ProcessingProviderOrchestrator listens and re-syncs provider on change
4. Renderer reads config via "get-config" IPC, writes via "update-config"
5. Config includes: API keys, models, wizard state, profiles, preferences, display settings
```

### Window Visibility / Stealth Flow

```
1. Hide: mainWindow.setIgnoreMouseEvents(true), mainWindow.setOpacity(0)
2. Show: mainWindow.setIgnoreMouseEvents(false), mainWindow.setAlwaysOnTop(true, "screen-saver"), mainWindow.setContentProtection(true), mainWindow.setOpacity(1)
3. In dev mode (NODE_ENV=development): stealth features disabled, window always visible
4. Opacity adjustments: Cmd/Ctrl+[ to decrease, Cmd/Ctrl+] to increase
5. Opacity persisted in config.json via ConfigHelper.setOpacity()
```

## Key Abstractions

### ProcessingProviderOrchestrator
- **Purpose:** Strategy factory that creates the correct AI provider based on config
- **Files:** `electron/processing/ProcessingProviderOrchestrator.ts`
- **Pattern:** Strategy pattern — swaps provider implementations at runtime based on `apiProvider` config
- **Re-syncs on:** Config changes (listens to `config-updated` event from ConfigHelper)

### ProcessingProviderStrategy (Interface)
- **Purpose:** Common interface for all AI providers
- **Files:** `electron/processing/types.ts`
- **Methods:** `extractProblem()`, `generateSolution()`, `generateDebug()`
- **Implementations:**
  - `electron/processing/providers/OpenAIProcessingProvider.ts`
  - `electron/processing/providers/GeminiProcessingProvider.ts`
  - `electron/processing/providers/AnthropicProcessingProvider.ts`

### ProcessingController (Queue / Debug)
- **Purpose:** Orchestrates multi-step AI processing with progress events
- **Files:** `electron/processing/controllers/QueueProcessingController.ts`, `electron/processing/controllers/DebugProcessingController.ts`
- **Pattern:** Command pattern with AbortController for cancellation
- **Context:** `ProcessingControllerContext` injects deps (screenshot helper, provider, language getter, error handlers)

### ConfigHelper (Singleton)
- **Purpose:** Persistent configuration management with migration, validation, and provider-specific defaults
- **Files:** `electron/ConfigHelper.ts`
- **Pattern:** Singleton with EventEmitter for change notification
- **Storage:** Plain JSON file at `{userData}/config.json` with backup mechanism
- **Key behaviors:**
  - Auto-detects API provider from key format (`sk-` → OpenAI, `sk-ant-` → Anthropic, otherwise → Gemini)
  - Validates and sanitizes model names per provider
  - Resets models when provider changes
  - Migrates from legacy `secure-data.json` format
  - Atomic writes via temp file + rename

### ScreenshotHelper
- **Purpose:** Manages screenshot capture, storage, and queue lifecycle
- **Files:** `electron/ScreenshotHelper.ts`
- **Pattern:** Two-queue system (main queue + extra queue for debug screenshots)
- **Key behaviors:**
  - Hides main window before capture, shows after
  - Platform-specific capture: `screenshot-desktop` on macOS/Linux, PowerShell fallback on Windows
  - `desktopCapturer` for specific window capture
  - Max 5 screenshots per queue, FIFO cleanup
  - Cleans directories on startup

### LiveInterviewService
- **Purpose:** Real-time interview assistance via Gemini Live API + hint generation
- **Files:** `electron/audio/LiveInterviewService.ts`
- **Pattern:** EventEmitter-based state machine with multiple timeout-driven transitions
- **Key states:** idle → connecting → listening → transcribing → generating → idle
- **Key behaviors:**
  - Voices silences and transcript deltas trigger hint generation
  - Multi-turn conversation history maintained for context
  - Auto-transcription hold, transcript clearing, silence detection

### Store (Session History)
- **Purpose:** Lightweight JSON file store for interview session history
- **Files:** `electron/store.ts`
- **Pattern:** Simple read/write JSON file (replaces electron-store due to ESM incompatibility)
- **Storage:** `{userData}/session-history.json`, max 30 sessions

## Entry Points

### Main Process Entry
- **Location:** `electron/main.ts`
- **Triggers:** `app.whenReady()` → `initializeApp()`
- **Responsibilities:**
  1. Single instance lock (`app.requestSingleInstanceLock()`)
  2. Load environment variables from `.env`
  3. Set custom app data/cache directories
  4. Register protocol handler (`interview-coder://`)
  5. Configure display media request handler for system audio
  6. Initialize helpers (Screenshot, Processing, Shortcuts)
  7. Register IPC handlers
  8. Create BrowserWindow with security settings
  9. Start auto-updater

### Renderer Entry
- **Location:** `src/main.tsx`
- **Triggers:** Loaded by `index.html` via Vite
- **Responsibilities:** React 19 root creation, HashRouter setup, CSS import, i18n initialization

### Preload Entry
- **Location:** `electron/preload.ts`
- **Triggers:** Loaded by BrowserWindow's preload script
- **Responsibilities:** Expose `window.electronAPI` via `contextBridge.exposeInMainWorld()`

## Error Handling

**Strategy:** Multi-layer error handling with graceful degradation

**Main Process Patterns:**
- `try/catch` blocks in all IPC handlers return `{ success: false, error: message }` objects
- `safeSend()` in processing controllers checks `mainWindow.isDestroyed()` before IPC sends
- Processing flows use `AbortController` for user-initiated cancellation
- Provider timeout wrapper (`runWithProviderTimeout`) prevents hanging API calls
- ConfigHelper uses backup file (`config.json.backup`) and atomic writes to prevent corruption
- Logger wraps `electron-log` with scoped loggers (`createScopedLogger("scope")`)

**Renderer Process Patterns:**
- `ErrorBoundary` component wraps the entire app
- IPC invoke calls use `try/catch` with toast notifications for errors
- TanStack Query retry: 1, with `refetchOnWindowFocus: false`
- Toast context for user-facing error notifications
- Processing status bar shows progress with cleanup on error events

**IPC Validation:**
- `electron/validation.ts` provides typed validators (`validateString`, `validateNumber`, `validateUrl`, `validateFilePath`, `validateEnum`, `validateConfigUpdate`)
- Applied in `ipcHandlers.ts` for user-input channels
- Contract enforcement: `REQUIRED_PRELOAD_INVOKE_CHANNELS` list checked at startup

## Cross-Cutting Concerns

**Logging:** Scoped logger (`electron/logger.ts`) wrapping `electron-log` with `[scope]` prefixes. Debug logs gated to `NODE_ENV=development`.

**Validation:** Centralized in `electron/validation.ts` — all IPC inputs from renderer validated before processing.

**Internationalization (i18n):** `src/i18n/` with `react-i18next`. Locale files in `src/i18n/locales/`. Translation hook: `useTranslation()`.

**Auto-Update:** `electron/autoUpdater.ts` uses `electron-updater`. Only active in production builds with `GH_TOKEN`. Update events forwarded to renderer.

**Toast Notifications:** `src/contexts/toast.tsx` provides a `ToastContext` with `showToast(title, description, variant)`. Radix UI Toast component renders them.

**Session Restore:** `src/lib/sessionRestore.ts` handles saving/retrieving session history across app restarts via IPC.

**Build Configuration:**
- Vite with `vite-plugin-electron` for main + preload bundling
- Main process compiled as CJS (tsconfig.electron.json)
- Renderer uses Vite dev server at port 54321 in development
- `@` path alias maps to `src/`
- Code splitting via manual chunks for react-syntax-highlighter, Radix UI, react-query, i18n

**Window Configuration:**
- Frameless window (`frame: false`, `titleBarStyle: "hidden"`)
- `contextIsolation: true`, `nodeIntegration: false`
- `alwaysOnTop` toggled at runtime (screen-saver level when visible)
- Content protection (`setContentProtection(true)`) for stealth in production
- Window `showInactive()` + opacity animation for smooth show/hide

---

*Architecture analysis: 2026-04-11*