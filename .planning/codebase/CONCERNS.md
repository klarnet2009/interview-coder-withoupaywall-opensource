# Codebase Concerns

**Analysis Date:** 2026-04-11

## Severity Legend

- **Critical:** Exploitable vulnerability or data loss risk. Must fix before production.
- **High:** Significant reliability, security, or architectural risk. Fix in next sprint.
- **Medium**: Code quality or maintainability issue. Address when touching adjacent code.
- **Low**: Minor improvement. Address opportunistically.

---

## Security Concerns

### SC-1: API Keys Stored in Plaintext on Disk

- **Severity:** Critical
- **Files:** `electron/ConfigHelper.ts` (lines 94-96, 188-189, 377-405)
- **Issue:** API keys for OpenAI, Gemini, and Anthropic are stored as plaintext in `config.json` in the user data directory. The code explicitly removed SecureStorage encryption (`electron/ConfigHelper.ts:9`: "SecureStorage removed — API key is now stored in plain text in config.json"). Any process or malware with filesystem access can read user API keys.
- **Impact:** User API keys (which may have billing implications) can be stolen by any software running on the same machine. The Gemini key is also appended to URLs as a query parameter (`?key=...`), meaning it appears in logs and network traces.
- **Fix Approach:** Use `keytar` or Electron's `safeStorage` API to encrypt API keys at rest. Never include API keys as query parameters — use header-based authentication. For the Gemini WebSocket URL (`electron/audio/GeminiLiveService.ts:119`), the API key is exposed in `wss://...?key=${this.config.apiKey}`.
- **Migration Impact:** Moving to a backend/proxy would eliminate the need for client-side key storage entirely. API keys would be stored server-side and requests proxied through the backend.

### SC-2: API Keys Sent Over IPC Without Encryption

- **Severity:** High
- **Files:** `electron/preload.ts` (lines 203-204, 222-223, 246-247), `electron/ipcHandlers.ts` (lines 165-201)
- **Issue:** API keys are transmitted over IPC channels in plaintext (`validate-api-key`, `test-api-key`, `update-config`). While Electron's IPC is local, context isolation means the preload bridge transfers secrets through `ipcRenderer.invoke()`. The `live-interview-start` handler accepts an `apiKeyOverride` parameter (line 802) sent from the renderer.
- **Impact:** Compromised renderer process (e.g., via XSS or dependency compromise) could intercept API keys.
- **Fix Approach:** Minimize key transfer. Once set, keys should stay in the main process. Renderer should only send a "use stored key" signal, not the key itself.

### SC-3: `executeJavaScript` Used for IPC State

- **Severity:** High
- **Files:** `electron/ProcessingHelper.ts` (lines 75-85, 97-99), `electron/ipcHandlers.ts` (lines 303-327)
- **Issue:** Main process uses `mainWindow.webContents.executeJavaScript()` to read/write global variables (`window.__IS_INITIALIZED__`, `window.__LANGUAGE__`, `window.__CREDITS__`). This bypasses the secure IPC bridge and creates a two-way communication channel that can be exploited from the renderer.
- **Impact:** A malicious renderer script could set `window.__CREDITS__` to any value, falsify initialization state, or inject arbitrary JavaScript through the evaluation context.
- **Fix Approach:** Replace all `executeJavaScript` calls with structured IPC channels. Use `ipcMain.handle` for main→renderer data requests and proper event emissions for state sync. The `window.__CREDITS__` system (lines 303-327 of `ipcHandlers.ts`) should use IPC state management instead.

### SC-4: Insufficient Input Validation on Some IPC Channels

- **Severity:** Medium
- **Files:** `electron/ipcHandlers.ts`, `electron/validation.ts`
- **Issue:** While a validation module exists (`electron/validation.ts`), many IPC handlers accept arguments without validation. For example:
  - `live-interview-send-text` (line 895): `text` parameter is not validated for length or content
  - `live-interview-send-audio` (line 909): `pcmBase64` is not validated for size limits
  - `set-always-on-top` (line 522): `enabled` boolean is not validated
  - `set-stealth-mode` (line 538): `enabled` boolean is not validated
  - `research-company` (line 1074): `companyName` and `jobTitle` strings are not validated
  - `parse-text-profile` (line 958): `text` parameter has no length limit
  - The `audioData.buffer` in `test-audio` (line 239) validates max 10MB but `transcribe-audio` (line 263) has no size limit
- **Fix Approach:** Apply the existing `validateString`, `validateNumber`, and `validateEnum` utilities to all IPC handlers. Add size bounds to all string/array/buffer parameters.

### SC-5: DevTools Always Open in Production

- **Severity:** Medium
- **Files:** `electron/main.ts` (line 277)
- **Issue:** `state.mainWindow.webContents.openDevTools({ mode: 'detach' })` is called unconditionally — not gated behind `isDev`. DevTools is always open, even in packaged production builds.
- **Impact:** Users can inspect/modify the renderer process. XSS attack surface increase. Any user can see internal state, API keys in memory, and modify runtime behavior.
- **Fix Approach:** Gate DevTools behind development mode: `if (isDev) { state.mainWindow.webContents.openDevTools({ mode: 'detach' }); }`

### SC-6: `setWindowOpenHandler` Has Inverted Allow/Deny Logic

- **Severity:** Medium
- **Files:** `electron/main.ts` (lines 278-298)
- **Issue:** The `setWindowOpenHandler` allows URLs by default (returns `{ action: "allow" }`) and only denies specific allowed hosts. The logic is inverted: URLs NOT in the allowlist are allowed through, while allowlisted hosts are opened externally then denied in the Electron window. Non-allowlisted URLs silently pass through.
- **Impact:** Any URL not matching google.com/openai.com/anthropic.com subdomains is allowed to open in a new Electron window — including phishing sites, malware downloads, etc.
- **Fix Approach:** Default to `{ action: "deny" }` and only allow URLs to specific explicitly allowlisted domains.

### SC-7: Credits System is Client-Side Only and Trivially Bypassable

- **Severity:** Medium
- **Files:** `electron/ipcHandlers.ts` (lines 298-332), `src/App.tsx` (line 56), `src/context/AppStateContext.tsx` (line 22)
- **Issue:** The credits system uses `window.__CREDITS__` (a global JS variable) with `executeJavaScript` manipulation. Default is 999 (unlimited). No server-side validation exists. Comments say "Unlimited credits in this version" and "No credit limit in this version."
- **Impact:** Any user can trivially modify credits by opening DevTools and setting `window.__CREDITS__ = Infinity`. For commercialization, all credit logic must move server-side.
- **Fix Approach:** Remove the client-side credits system entirely. When adding a backend, credits should be stored and validated server-side with authentication tokens.

### SC-8: Auto-Updater Requires GH_TOKEN Without Graceful Fallback

- **Severity:** Low
- **Files:** `electron/autoUpdater.ts` (lines 17-19)
- **Issue:** If `GH_TOKEN` is not set, the auto-updater silently bails out with only an error log. No user-facing notification occurs. In packaged builds without GH_TOKEN, users get no updates.
- **Fix Approach:** Display a notification to the user that auto-updates are unavailable, or implement a fallback check mechanism that doesn't require authentication.

---

## Architectural Concerns

### AC-1: God Object — Main Process State

- **Severity:** High
- **Files:** `electron/main.ts` (lines 26-62)
- **Issue:** The `state` object in `main.ts` is a global mutable singleton containing window state, processing state, view state, screenshot queues, and processing events. Every module accesses it through closures created in `initializeHelpers()` and `initializeIpcHandlers()`, which receive partial state through dependency injection interfaces (`IProcessingHelperDeps`, `IShortcutsHelperDeps`, `IIpcHandlerDeps`).
- **Impact:** State changes are hard to track. Any module can mutate view state, screenshot queues, or problem info without clear ownership. The `state` object's type is `any`-ish — it mixes DOM references (`BrowserWindow | null`) with application state strings.
- **Fix Approach:** Extract state into domain-specific stores (e.g., `WindowStateStore`, `ProcessingStateStore`) with typed accessors and event-driven updates. Consider using Electron's `ipcMain` events for state synchronization rather than shared mutable objects.

### AC-2: ipcHandlers.ts is a 1158-Line Monolith

- **Severity:** High
- **Files:** `electron/ipcHandlers.ts`
- **Issue:** All IPC handlers (50+ channels) are registered in a single function. This includes config, screenshots, window management, credits, session history, audio, live interview, personalization, URL handling, and update handlers. The file mixes concerns: business logic (API key testing, profile extraction) lives alongside IPC routing.
- **Impact:** Cannot test handlers independently. Cannot reason about handler groups. Adding new features means growing this file further. Personalization handlers (lines 918-1139) duplicate config loading patterns.
- **Fix Approach:** Split into domain-specific handler modules: `configHandlers.ts`, `screenshotHandlers.ts`, `liveInterviewHandlers.ts`, `personalizationHandlers.ts`, etc. Each module exports a `register(ipcMain, deps)` function. Consider extracting business logic into service classes.

### AC-3: Tight Coupling Between ProcessingHelper and View State

- **Severity:** Medium
- **Files:** `electron/ProcessingHelper.ts`, `electron/processing/controllers/QueueProcessingController.ts`, `electron/processing/controllers/DebugProcessingController.ts`
- **Issue:** Processing controllers directly manipulate view state (`deps.setView("solutions")`, `deps.setView("debug")`) and send IPC events through `mainWindow.webContents.send()`. The processing layer is tightly coupled to the UI layer — it knows about specific view names and event channels.
- **Fix Approach:** Processing should emit typed events (e.g., `emit('processing-complete', result)`) and let the main process decide what UI changes to make. Controllers should not know about view names or window references.

### AC-4: `require()` Calls in Non-CJS Context

- **Severity:** Medium
- **Files:** `electron/validation.ts` (lines 209, 233)
- **Issue:** `validateFilePath` and `validateFilePathContained` use `const path = require('path')` inside function bodies. Since `tsconfig.electron.json` compiles to CommonJS, this works, but it's a runtime require inside a function that could be called frequently. More importantly, it defeats tree-shaking and makes the validation module harder to test in isolation.
- **Fix Approach:** Move the `path` import to the module level as a standard `import path from 'path'`.

### AC-5: LiveInterviewService is Module-Scoped Singleton in IPC Handler

- **Severity:** Medium
- **Files:** `electron/ipcHandlers.ts` (lines 797-915)
- **Issue:** `liveInterviewService` is a `let` variable scoped to the `initializeIpcHandlers` function closure. It's not accessible from other parts of the main process (e.g., shortcuts or window management). Its lifecycle is tied to the IPC handler initialization. If the app crashes and restarts the handler, the old service may leak resources.
- **Fix Approach:** Extract `LiveInterviewService` management into a dedicated service class (like `LiveInterviewManager`) that owns the instance lifecycle and exposes start/stop/status methods. Register it as a dependency rather than a closure variable.

### AC-6: ProfileExtractorService Uses Raw HTTPS Instead of SDK

- **Severity:** Medium
- **Files:** `electron/services/ProfileExtractorService.ts` (lines 46-84)
- **Issue:** The `callGemini` function constructs raw HTTPS requests to the Gemini API, including building the URL path with the API key as a query parameter (`?key=${apiKey}`). The rest of the codebase uses the Gemini SDK or `axios`. This raw approach:
  - Bypasses any centralized rate limiting or retry logic
  - Exposes the API key in URL parameters (logged by Node.js/http proxies)
  - Must manually handle HTTP status codes and error parsing
  - Doesn't share connection pooling with the rest of the app
- **Fix Approach:** Refactor to use the same `GeminiProcessingProvider` or a shared Gemini client that uses header-based authentication.

### AC-7: ConfigHelper Reads Config From Disk On Every Operation

- **Severity:** Medium
- **Files:** `electron/ConfigHelper.ts`
- **Issue:** Every call to `loadConfig()`, `updateConfig()`, `hasApiKey()`, etc. reads `config.json` from disk, parses it, and runs migration logic. For hot paths like API key checking (`hasApiKey()` called before every processing run) this is unnecessary I/O.
- **Impact:** Disk I/O on every config access. Race conditions possible if multiple operations write simultaneously (though atomic write mitigates this).
- **Fix Approach:** Cache the config in memory after first load. Add a `reload()` method for explicit refresh. Use a file watcher (`fs.watch`) for external changes.

---

## Performance Concerns

### PC-1: Screenshot Files Read Synchronously

- **Severity:** Medium
- **Files:** `electron/ScreenshotHelper.ts`, `electron/processing/screenshotPayloadLoader.ts`
- **Issue:** Screenshots are read from disk and converted to base64 synchronously during processing. Each screenshot can be several MB. The processing pipeline blocks the main process while loading potentially 5 screenshots.
- **Fix Approach:** Use async file reading (`fs.promises.readFile`) with streaming base64 conversion. Process screenshots in a worker thread to avoid blocking the main process.

### PC-2: No Request Deduplication or Throttling

- **Severity:** Low
- **Files:** `electron/ProcessingHelper.ts`, `electron/ipcHandlers.ts`
- **Issue:** Rapid shortcut presses or button clicks can trigger multiple `processScreenshots` calls. While the `AbortController` pattern allows cancellation, there's no explicit debounce on the trigger. Users pressing Ctrl+Enter rapidly could create race conditions.
- **Fix Approach:** Add a debounce (500ms) on the `trigger-process-screenshots` IPC handler, or track an "isProcessing" flag that prevents re-entry until the current flow completes.

### PC-3: WebSocket Reconnection in GeminiLiveService Has Unbounded Retry

- **Severity:** Low
- **Files:** `electron/audio/GeminiLiveService.ts` (lines 63-66)
- **Issue:** `maxReconnectAttempts` is set to 3, but there's no exponential backoff. Reconnection attempts happen immediately. The `reconnectAttempts` counter is tracked but the reconnect delay is not specified (likely immediate).
- **Fix Approach:** Add exponential backoff (1s, 2s, 4s) for WebSocket reconnection attempts.

---

## Maintenance Concerns

### MC-1: Global Mutable State in Main Process

- **Severity:** High
- **Files:** `electron/main.ts` (lines 26-62)
- **Issue:** The `state` object uses loose typing. Properties like `mainWindow`, `isWindowVisible`, `step`, `currentX`, `currentY`, and `screenWidth` are all mutable and accessed from closure functions. There's no type narrowing for null states (e.g., `mainWindow` can be `null` but is accessed without null checks in some closure functions).
- **Impact:** State management bugs are hard to catch at compile time. Window access patterns use `state.mainWindow` directly without null guards in some paths.
- **Fix Approach:** Use a state management class with typed accessors and null-safety. Make `getMainWindow()` return `BrowserWindow` and throw if null, rather than returning `null`.

### MC-2: Process Thread Naming for API Keys in Logs

- **Severity:** Medium
- **Files:** `electron/audio/GeminiLiveService.ts` (line 117)
- **Issue:** API key prefix is logged: `log.info('GeminiLiveService: API key prefix: ${this.config.apiKey.substring(0, 10)}...')`. While only the first 10 characters are shown, this still leaks partial key information to log files.
- **Fix Approach:** Log only the key type (e.g., "Gemini API key detected") without any key content.

### MC-3: Legacy Credits System Remnants Throughout Codebase

- **Severity:** Medium
- **Files:** `electron/ipcHandlers.ts` (lines 298-332), `electron/preload.ts` (line 21), `electron/main.ts` (line 52), `src/types/electron.d.ts` (line 204), `src/types/index.ts` (line 435), `src/App.tsx` (line 56)
- **Issue:** The credits system has remnants across multiple files: IPC handlers for `set-initial-credits` and `decrement-credits`, `PROCESSING_EVENTS.OUT_OF_CREDITS` event, `window.__CREDITS__` global variable, and credit checks in UI components. The app hardcodes `credits = 999` (unlimited) but still has the decrement/set infrastructure.
- **Impact:** Dead code increases maintenance burden. Confusing for anyone reading the code. Credit references in UI components still check `credits <= 0` which will never be true.
- **Fix Approach:** If credits will be reimplemented server-side, cleanly remove the client-side credit system. If not, remove all credit-related code including the IPC handlers, events, and UI checks.

### MC-4: IPC Channel Name String Constants Not Centralized

- **Severity:** Low
- **Files:** `electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/main.ts`
- **Issue:** IPC channel names are defined as string literals in `preload.ts` (`PROCESSING_EVENTS`), `ipcHandlers.ts` (`REQUIRED_PRELOAD_INVOKE_CHANNELS`), and `main.ts` (another copy of `PROCESSING_EVENTS`). While the runtime self-check exists, the three-source declaration pattern is fragile.
- **Fix Approach:** Create a shared `electron/ipcChannels.ts` module that exports typed channel name constants, used by all three files. The type system should enforce that all channels are handled.

---

## Scalability Concerns

### SCAL-1: Single Process Architecture — No Backend

- **Severity:** Critical (for commercialization)
- **Files:** All files in `electron/`
- **Issue:** The entire application runs as a single Electron process. All AI API calls go directly from the user's machine to OpenAI, Gemini, and Anthropic. There's no backend, no authentication, no rate limiting, and no usage tracking.
- **Impact:** For the open-source version, this is by design. For commercialization, this architecture cannot support:
  - User authentication
  - Rate limiting / credit system
  - Usage analytics
  - API key proxying (keys exposed to clients)
  - Multi-device state sync
- **Fix Approach:** Add a backend API layer that acts as a proxy for AI provider calls. The backend would hold API keys, authenticate users, track usage, and rate-limit requests. The Electron app would send requests to the backend instead of directly to AI providers.

### SCAL-2: Config File I/O Under Load

- **Severity:** Medium
- **Files:** `electron/ConfigHelper.ts`
- **Issue:** Config is read from disk on every `loadConfig()` call (which happens on every IPC handler that needs config). Frequent operations (key validation, processing, audio) all trigger file reads. Under heavy use, this could cause I/O bottlenecks.
- **Fix Approach:** Memory-cache the config with a dirty flag. Write to disk only on updates. Reload on external change detection.

### SCAL-3: Session History Stored as Single JSON File

- **Severity:** Low
- **Files:** `electron/store.ts`
- **Issue:** Session history is stored as a single `session-history.json` file. The entire file is read and rewritten on every update (append, delete, clear). With `MAX_SESSION_HISTORY = 30`, this is acceptable, but the pattern doesn't scale.
- **Fix Approach:** For current usage, this is fine. If session storage needs to grow, consider SQLite (via `better-sqlite3`) or individual files per session.

---

## Dependencies at Risk

### DEP-1: `screenshot-desktop` Package Reliability

- **Severity:** High
- **Files:** `electron/ScreenshotHelper.ts`, `package.json`
- **Issue:** `screenshot-desktop` v1.15.0 is used for screen capture. This package wraps platform-specific CLI tools (`screencapture` on macOS, PowerShell commands on Windows). It may break on OS updates or different Windows configurations. The Electron `desktopCapturer` API is also used but only for source listing, not for actual capture.
- **Fix Approach:** Consider migrating fully to Electron's `desktopCapturer` API for capture as well, reducing platform-specific dependency.

### DEP-2: `ws` Direct Dependency for Gemini WebSocket

- **Severity:** Medium
- **Files:** `electron/audio/GeminiLiveService.ts`, `package.json`
- **Issue:** The `ws` package is used directly for WebSocket communication with Gemini's Live API. This is a Node.js dependency imported in the main process. If the Gemini Live API protocol changes, this low-level integration must be updated manually.
- **Fix Approach:** Consider whether a Gemini Live SDK becomes available. At minimum, extract the WebSocket protocol logic into a well-tested, protocol-versioned module.

### DEP-3: Legacy AudioCaptureService Still in Build

- **Severity:** Low
- **Files:** `electron/audio/AudioCaptureService.legacy.ts`
- **Issue:** The legacy audio capture module is excluded from "active builds" per the tech debt doc, but the `.legacy.ts` file still exists in the source directory. It may be imported accidentally or create confusion.
- **Fix Approach:** Delete the file or move it to an `archive/` directory outside the source tree.

---

## Migration Concerns (for Adding Backend)

### MIG-1: API Key Management Must Move Server-Side

- **Severity:** Critical (blocks commercialization)
- **Files to change:**
  - `electron/ConfigHelper.ts` — Remove `apiKey` field from config, remove `testApiKey()`, `isValidApiKeyFormat()`
  - `electron/ipcHandlers.ts` — Remove `validate-api-key`, `test-api-key`, `check-api-key` handlers; add `login`, `logout`, `get-usage` handlers
  - `electron/preload.ts` — Remove API key IPC methods; add auth token methods
  - `src/types/electron.d.ts` — Update ElectronAPI interface
  - `src/components/Settings/SettingsPage.tsx` and `SettingsForm.tsx` — Remove API key input UI; add login/auth UI
  - `src/components/Wizard/WizardSteps/StepApiKey.tsx` and `StepTest.tsx` — Remove or replace
  - `electron/processing/ProcessingProviderOrchestrator.ts` — Accept auth tokens instead of API keys
  - `electron/audio/GeminiLiveService.ts` — Use backend proxy URL
  - `electron/audio/HintGenerationService.ts` — Use backend proxy
  - `electron/services/ProfileExtractorService.ts` — Use backend proxy

### MIG-2: Credit System Must Be Server-Side

- **Files to change:**
  - `electron/ipcHandlers.ts` — Remove `set-initial-credits`, `decrement-credits` handlers
  - `electron/main.ts` — Remove `OUT_OF_CREDITS` event
  - `src/App.tsx` — Remove local credits state (line 56)
  - `src/context/AppStateContext.tsx` — Remove credits from state
  - All UI components checking `credits <= 0` — Replace with server-side credit check

### MIG-3: Processing Pipeline Must Proxy Through Backend

- **Files to change:**
  - `electron/processing/providers/OpenAIProcessingProvider.ts` — Route through backend
  - `electron/processing/providers/GeminiProcessingProvider.ts` — Route through backend
  - `electron/processing/providers/AnthropicProcessingProvider.ts` — Route through backend
  - `electron/processing/ProcessingProviderOrchestrator.ts` — Accept auth tokens
  - `electron/audio/LiveInterviewService.ts` — Route through backend or use backend-issued tokens
  - All screenshot upload paths need to send data to the backend instead of to AI providers directly

### MIG-4: Session History Should Sync with Backend

- **Files to change:**
  - `electron/store.ts` — Replace with backend API calls
  - `electron/ipcHandlers.ts` — Session history handlers should call backend API
  - `src/types/electron.d.ts` — Update session types to include backend IDs

---

## Test Coverage Gaps

### TEST-1: No Renderer (React) Tests

- **Severity:** High
- **Files:** `tests/` directory
- **Issue:** The test suite (`tests/unit/` and `tests/integration/`) only covers Electron main process code. No React component tests exist. Components like `UnifiedPanel` (863 lines), `SettingsPage`, `WizardContainer`, and `Solutions` have zero test coverage.
- **Risk:** UI regressions go undetected. Complex state management (like live interview state transitions) could break silently.

### TEST-2: No E2E Tests

- **Severity:** Medium
- **Issue:** There are no end-to-end tests that exercise the full IPC flow from renderer to main process and back. While unit and integration tests exist for individual pieces, the full user flow (screenshot → process → display solution) is untested.

### TEST-3: No Tests for Personalization/Profile Features

- **Severity:** Medium
- **Files:** `electron/services/ProfileExtractorService.ts`, `electron/ipcHandlers.ts` (personalization handlers lines 918-1139)
- **Issue:** The personalization features (CV upload, profile extraction, company research, skill matching) have no test coverage. These features call external AI APIs and have complex error handling.

### TEST-4: ConfigHelper Not Tested

- **Severity:** Medium
- **Files:** `electron/ConfigHelper.ts`
- **Issue:** No unit tests for `ConfigHelper`. Given the migration logic, config validation, and API key management, this module should have comprehensive tests, especially for the `migrateConfig()`, `sanitizeModelSelection()`, and `testApiKey()` methods.

---

## Missing Features for Commercialization

### COMM-1: No Authentication System

- **Severity:** Critical
- **Issue:** There is no user authentication. Users don't log in, there are no user accounts, and no identity management. For a commercial product, this is the first prerequisite for credit tracking, payments, and usage limits.

### COMM-2: No Billing/Payment Integration

- **Severity:** Critical
- **Issue:** No credit system, no payment gateway, no subscription management. The existing credits system is a placeholder with hardcoded unlimited credits.

### COMM-3: No Rate Limiting

- **Severity:** High
- **Issue:** Each user directly calls AI provider APIs with their own keys. If the app moves to a shared key model, there's no rate limiting per user. A single user could exhaust the shared API budget.

### COMM-4: No Usage Analytics

- **Severity:** Medium
- **Issue:** No telemetry or analytics for understanding user behavior, feature usage, error rates, or conversion metrics. Session history is stored locally but never aggregated.

### COMM-5: No Error Reporting Service

- **Severity:** Medium
- **Issue:** Errors are logged via `electron-log` to local files. There's no Sentry, Bugsnag, or similar error reporting service. Production errors are invisible to the development team.

---

## Fragile Areas

### FRAG-1: Screenshot Capture Platform Dependency

- **Severity:** High
- **Files:** `electron/ScreenshotHelper.ts`
- **Issue:** Screenshot capture uses the `screenshot-desktop` package which relies on platform-specific binaries. On macOS it uses `screencapture`, on Windows it uses PowerShell commands. These can break with OS updates or security policy changes. The "invisible window" feature (content protection/stealth mode) is platform-specific and may behave differently across OS versions.
- **Safe Modification:** Any changes to screenshot logic must be tested on all target platforms (macOS, Windows, Linux).

### FRAG-2: Global Shortcut Conflicts

- **Severity:** Medium
- **Files:** `electron/shortcuts.ts`
- **Issue:** The app registers many global shortcuts (Ctrl/Cmd + B, H, Enter, R, L, arrows, [, ], -, =, 0, Q). These can conflict with other applications' shortcuts. `CommandOrControl+Q` on macOS conflicts with the system quit shortcut.
- **Safe Modification:** Make shortcuts configurable through settings. Consider using fewer global shortcuts and more application-level shortcuts.

### FRAG-3: Live Interview WebSocket Lifecycle

- **Severity:** Medium
- **Files:** `electron/audio/GeminiLiveService.ts`, `electron/audio/LiveInterviewService.ts`
- **Issue:** The live interview feature manages a complex state machine (idle → connecting → listening → transcribing → generating) with multiple timeout handlers, debounce logic, and WebSocket reconnection. The `LiveInterviewService` has 6 timeout variables that must be carefully managed to avoid memory leaks or zombie states.
- **Safe Modification:** Any changes to the live interview flow should be tested against the integration test (`tests/integration/liveInterviewLifecycle.integration.test.ts`). Always clean up all timeouts in `stop()`.

---

*Concerns audit: 2026-04-11*