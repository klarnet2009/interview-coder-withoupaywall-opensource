# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

### OpenAI API
- **Purpose:** AI problem extraction, solution generation, and debugging assistance
- **SDK:** `openai` v6.18.0 (NPM package)
- **Auth:** API key stored in `config.json` (user data directory), passed as `apiKey` to `new OpenAI({ apiKey })`
- **Models used:**
  - Default: `gpt-4o`
  - Also allowed: `gpt-4o-mini`
- **Client location:** `electron/processing/providers/OpenAIProcessingProvider.ts`
- **Config validation:** `electron/ConfigHelper.ts` — `testOpenAIKey()` validates via `openai.models.list()`
- **API key format:** Starts with `sk-`, minimum 32 alphanumeric chars (`/^sk-[a-zA-Z0-9]{32,}$/`)

### Google Gemini API — REST
- **Purpose:** AI problem extraction, solution generation, debugging, audio transcription, profile extraction, company research, hint generation
- **SDK:** No dedicated SDK — uses `axios` (REST) and native `https` module (SSE streaming)
- **Auth:** API key passed as URL query parameter `?key=<API_KEY>`
- **Models used:**
  - `gemini-2.0-flash` — Profile extraction and company research (`electron/services/ProfileExtractorService.ts`)
  - `gemini-3-flash-preview` — Default extraction, solution, debugging, hints
  - `gemini-3-pro-preview` — Alternative model option
  - `gemini-2.5-flash-native-audio-preview-12-2025` — Live audio transcription
- **Client locations:**
  - `electron/processing/providers/GeminiProcessingProvider.ts` — Screenshot processing (axios REST)
  - `electron/audio/HintGenerationService.ts` — Real-time hint generation (Node.js `https` module, SSE streaming)
  - `electron/audio/AudioProcessor.ts` — Audio transcription (axios REST)
  - `electron/services/ProfileExtractorService.ts` — CV parsing, job description extraction, company research (native `https`)
- **Config validation:** `electron/ConfigHelper.ts` — `testGeminiKey()` calls `generativelanguage.googleapis.com/v1beta/models`
- **API key format:** Minimum 20 characters, no specific prefix
- **REST endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- **SSE streaming endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={apiKey}`

### Google Gemini API — Live (WebSocket)
- **Purpose:** Real-time audio streaming for live interview assistance
- **SDK:** `ws` v8.19.0 (WebSocket client)
- **Auth:** API key passed as URL query parameter in WebSocket URL
- **WebSocket URL:** `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={apiKey}`
- **Client location:** `electron/audio/GeminiLiveService.ts`
- **Protocol:** Binary audio streaming (PCM 16-bit, 16kHz, mono via base64-encoded chunks), JSON setup/configuration messages
- **Models:** `gemini-2.5-flash-native-audio-preview-12-2025`
- **Features:** Real-time transcription, audio streaming, automatic activity detection, turn management
- **Cache endpoint:** `https://generativelanguage.googleapis.com/v1beta/cachedContents?key={apiKey}` — Explicit context caching for hint generation

### Anthropic Claude API
- **Purpose:** AI problem extraction, solution generation, debugging assistance
- **SDK:** `@anthropic-ai/sdk` v0.73.0 (NPM package)
- **Auth:** API key stored in `config.json`, passed as `apiKey` to `new Anthropic({ apiKey })`
- **Models used:**
  - Default: `claude-3-7-sonnet-20250219`
  - Also allowed: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`
  - Validation test: `claude-3-haiku-20240307` (minimal token usage for key validation)
- **Client location:** `electron/processing/providers/AnthropicProcessingProvider.ts`
- **Config validation:** `electron/ConfigHelper.ts` — `testAnthropicKey()` creates minimal message with claude-3-haiku
- **API key format:** Starts with `sk-ant-`, minimum 32 chars (`/^sk-ant-[a-zA-Z0-9-_]{32,}$/`)
- **Special handling:** Detects 429 (rate limit), 413 (payload too large), 400 (bad request — treated as valid key)

### Gemini Context Caching
- **Purpose:** Cost optimization for hint generation in live interview mode
- **Implementation:** `electron/audio/HintGenerationService.ts` — `createCache()` method
- **Endpoint:** `POST /v1beta/cachedContents?key={apiKey}`
- **Behavior:** Creates cached content after first hint when conversation exceeds ~1024 tokens; deletes cache on session stop
- **TTL:** 3600 seconds (1 hour)

## Data Storage

### Databases:
- None (no SQL/NoSQL database)

### File-Based Storage:
- **Config file:** `electron/ConfigHelper.ts`
  - Path: `{userData}/config.json` (platform-specific)
  - Windows: `C:\Users\[USERNAME]\AppData\Roaming\interview-coder-v1\config.json`
  - macOS: `/Users/[USERNAME]/Library/Application Support/interview-coder-v1/config.json`
  - Format: JSON (plain text, NOT encrypted)
  - Contains: API key, provider, models, language, opacity, wizard state, profiles, company contexts, interview preferences, audio config, display config
  - Atomic writes via temp file + rename (`config.json.tmp` → `config.json`)
  - Backup: `config.json.backup` created before each write

- **Session history:** `electron/store.ts`
  - Path: `{userData}/session-history.json`
  - Format: JSON array of `StoredSession` objects
  - Max: 30 sessions (FIFO)
  - Methods: `getSessionHistory()`, `appendSessionHistoryEntry()`, `deleteSessionHistoryItem()`, `clearSessionHistory()`

- **Secure storage (legacy):** `electron/SecureStorage.ts`
  - Path: `{userData}/secure-data.json`
  - Uses Electron's `safeStorage` API for encryption when available, fallback to plain text
  - **NOTE:** Migration path implemented — `ConfigHelper.migrateFromSecureStorage()` moves API key from secure-data.json to config.json and deletes the old file
  - Currently NOT used for new data; API keys now stored directly in config.json

- **Screenshots:** `electron/ScreenshotHelper.ts`
  - Main queue: `{userData}/screenshots/*.png`
  - Extra queue: `{userData}/extra_screenshots/*.png`
  - Temp: `{temp}/interview-coder-screenshots/`
  - Max 5 screenshots per queue (FIFO eviction)
  - Cleaned on app startup

- **App data paths** (configured in `electron/main.ts`):
  - `userData` → `{appData}/interview-coder-v1/`
  - `sessionData` → `{appData}/interview-coder-v1/session`
  - `temp` → `{appData}/interview-coder-v1/temp`
  - `cache` → `{appData}/interview-coder-v1/cache`

### File Storage:
- Local filesystem only (no cloud storage)
- PDF files handled via `electron/dialog` file picker for CV/resume upload (`electron/services/PdfParserService.ts`)

### Caching:
- Gemini Context Caching: Server-side (explicit API), managed in `electron/audio/HintGenerationService.ts`
- No local HTTP cache or service worker cache

## Authentication & Identity

**Auth Provider:**
- None (no Supabase, OAuth, or other auth service)
- Auth callback was previously implemented but removed — comment in `electron/main.ts`: "Auth callback removed as we no longer use Supabase authentication"

**API Key-Based Authentication:**
- User provides their own API key for the selected AI provider
- Key stored in plain text in `config.json` (not encrypted at rest)
- Auto-detection of provider from key format:
  - `sk-ant-*` → Anthropic
  - `sk-*` → OpenAI
  - Everything else → Gemini (default)
- Key validation: `ConfigHelper.testApiKey()` makes real API calls to verify
- Key format validation: `ConfigHelper.isValidApiKeyFormat()` checks regex patterns

**Wizard Flow:**
- First-time setup wizard managed in `electron/ConfigHelper.ts`
- `wizardCompleted` flag in config
- `wizard-complete` / `wizard-reset` / `is-wizard-completed` IPC channels

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Bugsnag, or other error tracking service)

**Logging:**
- `electron-log` v5.2.4 — Structured logging for Electron main process
  - Default transports: console + file
  - File logs stored in platform-specific user data directory
  - Log levels: info, warn, error, debug (debug only in development mode)
- Scoped logger utility: `electron/logger.ts` — `createScopedLogger(scope)` adds `[scope]` prefix
- Used throughout: `main.ts`, `ScreenshotHelper.ts`, `ProcessingHelper.ts`, `ConfigHelper.ts`, `ipcHandlers.ts`, `autoUpdater.ts`, all audio services, all processing providers

## CI/CD & Deployment

**Auto-Update:**
- `electron-updater` v6.3.9 — Auto-update from GitHub Releases
- Configuration in `package.json` → `build.publish`:
  - Provider: `github`
  - Owner: `ibttf`
  - Repo: `interview-coder`
  - Release type: `release`
- `GH_TOKEN` environment variable required for publishing
- Checks every 1 hour in production (`electron/autoUpdater.ts`)
- IPC channels: `start-update`, `install-update`, `update-available`, `update-downloaded`

**Packaging:**
- `electron-builder` v26.7.0 — Multi-platform packaging
- macOS: DMG + ZIP (x64, arm64), notarized, hardened runtime, custom entitlements
- Windows: NSIS installer
- Linux: AppImage
- ASAR archive enabled, maximum compression
- Custom protocol `interview-coder://` registered on all platforms
- `.env` file bundled as `extraResources`

## Environment Configuration

**Required env vars:**
- `NODE_ENV` — `development` or `production` (set by `cross-env` in scripts)
- `GH_TOKEN` — GitHub personal access token (for auto-updater publishing)

**Optional env vars:**
- None explicitly documented

**Config file (`.env`):**
- Loaded by `dotenv` at app startup
- In dev: loaded from `process.cwd()/.env`
- In production: loaded from `process.resourcesPath/.env`
- Bundled as extraResource in packaged app

**API key management:**
- Stored in `config.json` (plain text)
- No encryption at rest (SecureStorage migration path exists but keys now stored directly)
- Validated via real API calls to the selected provider
- Provider auto-detected from key format

## IPC Communication (Electron Main ↔ Renderer)

**Architecture:**
- `electron/preload.ts` — Context bridge exposing `window.electronAPI`
- `electron/ipcHandlers.ts` — Main process handlers using `ipcMain.handle()`
- `src/types/electron.d.ts` — TypeScript type declarations for the bridge

**IPC Contract Validation:**
- `REQUIRED_PRELOAD_INVOKE_CHANNELS` array in `ipcHandlers.ts` lists all expected channels
- On initialization, missing handlers are logged as errors (throws in development)

**Invoke Channels (Renderer → Main):**

| Channel | Purpose | File |
|---------|---------|------|
| `get-config` / `update-config` | Configuration CRUD | `electron/ipcHandlers.ts` |
| `check-api-key` / `validate-api-key` / `test-api-key` | API key validation | `electron/ipcHandlers.ts` |
| `wizard-complete` / `wizard-reset` / `is-wizard-completed` | Onboarding wizard | `electron/ipcHandlers.ts` |
| `trigger-screenshot` / `take-screenshot` / `delete-screenshot` / `delete-last-screenshot` / `get-screenshots` | Screenshot management | `electron/ipcHandlers.ts` |
| `trigger-process-screenshots` / `process-screenshots` | AI processing | `electron/ipcHandlers.ts` |
| `trigger-reset` | Reset session | `electron/ipcHandlers.ts` |
| `toggle-window` | Window visibility toggle | `electron/ipcHandlers.ts` |
| `set-window-opacity` / `update-content-dimensions` / `set-setup-window-size` | Window management | `electron/ipcHandlers.ts` |
| `trigger-move-left` / `trigger-move-right` / `trigger-move-up` / `trigger-move-down` | Window positioning | `electron/ipcHandlers.ts` |
| `get-capture-sources` / `get-audio-sources` | Desktop capture sources | `electron/ipcHandlers.ts` |
| `live-interview-start` / `live-interview-stop` / `live-interview-status` / `live-interview-send-text` / `live-interview-send-audio` | Live interview streaming | `electron/ipcHandlers.ts` |
| `test-audio` / `transcribe-audio` / `generate-hints` | Audio processing | `electron/ipcHandlers.ts` |
| `open-external-url` / `openLink` / `open-settings-portal` | External navigation | `electron/ipcHandlers.ts` |
| `clear-store` / `get-session-history` / `get-session-history-item` / `delete-session-history-item` / `clear-session-history` | Session history | `electron/ipcHandlers.ts` |
| `set-always-on-top` / `set-stealth-mode` / `toggle-stealth` / `is-dev` / `quit-app` | App control | `electron/ipcHandlers.ts` |
| `upload-cv` / `parse-text-profile` / `upload-job-description` / `parse-job-text` / `research-company` / `get-skill-match` / `get-active-profile` / `get-active-company` | Personalization | `electron/ipcHandlers.ts` |
| `start-update` / `install-update` | Auto-updater | `electron/autoUpdater.ts` |

**Event Channels (Main → Renderer):**

| Channel | Purpose | Trigger |
|---------|---------|---------|
| `screenshot-taken` | New screenshot captured | ScreenshotHelper |
| `screenshot-deleted` | Screenshot deleted | ipcHandlers |
| `delete-last-screenshot` | Delete last screenshot shortcut | ShortcutsHelper |
| `reset-view` / `reset` | Session reset | ShortcutsHelper / ipcHandlers |
| `processing-status` | Processing progress | ProcessingHelper |
| `problem-extracted` | Problem extracted from screenshots | ProcessingController |
| `solution-success` | Solution generated | ProcessingController |
| `solution-error` / `debug-error` | Processing error | ProcessingController |
| `debug-success` / `debug-start` | Debug flow status | ProcessingController |
| `processing-unauthorized` / `api-key-invalid` | Auth failure | ProcessingHelper / ipcHandlers |
| `processing-no-screenshots` | No screenshots to process | ProcessingHelper |
| `live-interview-status` / `live-interview-state` / `live-interview-error` | Live interview events | LiveInterviewService |
| `update-available` / `update-downloaded` | Auto-update events | electron-updater |
| `show-settings-dialog` | Open settings from menu | ipcHandlers |
| `credits-updated` | Credits balance change | ipcHandlers |
| `restore-focus` | Focus restoration after IPC | preload.ts |

## Network Requests

**HTTP Clients:**
- `axios` v1.7.7 — Used by:
  - `electron/processing/providers/GeminiProcessingProvider.ts` — Gemini REST API calls
  - `electron/ConfigHelper.ts` — Gemini API key validation (`generativelanguage.googleapis.com`)
  - `electron/audio/AudioProcessor.ts` — Audio transcription via Gemini API
- Native `https` module — Used by:
  - `electron/audio/HintGenerationService.ts` — SSE streaming for hints
  - `electron/services/ProfileExtractorService.ts` — Profile/company extraction
- `openai` SDK — Uses built-in HTTP client
- `@anthropic-ai/sdk` — Uses built-in HTTP client

**WebSocket Connections:**
- `ws` v8.19.0 — Used by `electron/audio/GeminiLiveService.ts` for real-time audio streaming
  - Endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
  - Protocol: Binary audio (PCM base64) and JSON messages
  - Reconnection: Automatic (up to 3 attempts with backoff), except on auth errors (1007/1008)

**API Rate Limiting:**
- OpenAI: 60-second timeout, 2 retries (`electron/processing/providers/OpenAIProcessingProvider.ts`)
- Anthropic: 60-second timeout, 2 retries (`electron/processing/providers/AnthropicProcessingProvider.ts`)
- Gemini: No explicit retry; timeout varies by service (30s audio, 60s hint streaming)
- Provider timeout: Configurable via `electron/processing/providerTimeout.ts`

**External URLs Whitelist:**
- `google.com`, `openai.com`, `anthropic.com` and their subdomains — Allowed in `electron/main.ts` `setWindowOpenHandler()`

## Screen Capture APIs and Permissions

**Desktop Capturer:**
- `electron/desktopCapturer` — Used to enumerate screens/windows for targeted capture
  - `getSources({ types: ["window", "screen"] })` — Lists available capture sources
  - Used in: `electron/ipcHandlers.ts` (`get-capture-sources`, `get-audio-sources`), `electron/ScreenshotHelper.ts` (`captureWindowById`)

**Screenshot Methods:**
- `screenshot-desktop` v1.15.0 — Cross-platform native screenshot (primary method on macOS/Linux)
  - Falls back to PowerShell on Windows for multi-monitor support
  - PowerShell method: Uses `System.Drawing` .NET classes for screen capture
- `electron/desktopCapturer` — Targeted window/screen capture by source ID
- Window hiding/showing: App window is hidden before screenshot capture, then restored

**Display Media Handler:**
- `session.defaultSession.setDisplayMediaRequestHandler()` in `electron/main.ts`
  - Auto-grants display media requests for system audio capture
  - Returns first available screen source with loopback audio

**Security Considerations:**
- Context isolation enabled (`contextIsolation: true`)
- Node integration disabled (`nodeIntegration: false`)
- All main-renderer communication through typed preload bridge
- IPC input validation via `electron/validation.ts` (strings, enums, file paths, URLs, config updates)
- URL whitelist for external links in `setWindowOpenHandler()`
- API keys stored in plain text JSON (not encrypted at rest)
- Stealth mode: Content protection, taskbar hiding, always-on-top available in production

---

*Integration audit: 2026-04-11*