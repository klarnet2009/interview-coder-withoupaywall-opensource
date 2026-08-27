# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
interview-coder/
├── build/                    # Electron-builder resources (entitlements, icons)
├── dist/                     # Built renderer output (Vite)
├── dist-electron/            # Built main process output (TypeScript CJS)
├── docs/                     # Documentation (architecture, module map, etc.)
│   └── adr/                  # Architecture Decision Records
├── electron/                 # Main process source code
│   ├── audio/                # Live interview audio services
│   ├── processing/           # AI processing pipeline
│   │   ├── controllers/      # Queue and Debug flow controllers
│   │   ├── formatters/       # Solution and debug response formatters
│   │   └── providers/        # AI provider implementations
│   ├── services/             # PDF parsing and profile extraction
│   ├── main.ts               # Main process entry point
│   ├── preload.ts            # IPC bridge (context isolation)
│   ├── ipcHandlers.ts         # IPC handler registration
│   ├── ProcessingHelper.ts   # Screenshot processing orchestrator
│   ├── ScreenshotHelper.ts   # Screenshot capture & queue management
│   ├── ConfigHelper.ts       # Configuration persistence singleton
│   ├── shortcuts.ts          # Global keyboard shortcut registration
│   ├── store.ts              # Session history JSON store
│   ├── logger.ts             # Scoped logging wrapper
│   ├── validation.ts         # IPC input validation utilities
│   ├── autoUpdater.ts        # Auto-update handler
│   ├── AudioProcessor.ts     # Audio transcription via Gemini
│   └── SecureStorage.ts      # (Legacy) Secure key storage
├── public/                   # Static assets
│   └── pcm-capture-processor.js  # Web Audio PCM capture worker
├── scripts/                  # Build/utility scripts
├── src/                       # Renderer process source code
│   ├── _pages/               # Page-level components (routes)
│   ├── components/           # React UI components
│   │   ├── ControlBar/       # Bottom control bar (actions, mic, settings)
│   │   ├── Debug/            # Debug panel components
│   │   ├── DragHandle/       # Window drag area
│   │   ├── Header/           # Top header/title bar
│   │   ├── Input/            # Input field components
│   │   ├── LiveInterview/    # (Empty) Live interview UI placeholder
│   │   ├── LiveTranscription/# Live transcription display
│   │   ├── Profile/          # Profile management UI
│   │   ├── Queue/            # Screenshot queue view
│   │   ├── Response/          # AI response display components
│   │   ├── Sessions/         # Session history browser
│   │   ├── Settings/         # Settings dialog and pages
│   │   ├── Solutions/        # Solution display view
│   │   ├── StatusBar/        # Status indicator bar
│   │   ├── UnifiedPanel/     # Main runtime controller panel
│   │   ├── ui/               # Base UI primitives (button, card, dialog, input, toast)
│   │   ├── Wizard/           # Onboarding wizard flow
│   │   ├── DevModeToggle.tsx  # Dev mode switcher
│   │   ├── ErrorBoundary.tsx  # React error boundary
│   │   ├── UpdateNotification.tsx  # Auto-update notification
│   │   └── WelcomeScreen.tsx  # Welcome/login screen
│   ├── context/              # React context providers (AppState)
│   ├── contexts/             # Additional contexts (toast)
│   ├── i18n/                 # Internationalization config + locales
│   ├── lib/                  # Shared utilities (session restore, utils)
│   ├── services/             # Renderer-side services (audio capture legacy)
│   ├── styles/               # Design system tokens
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions (platform detection)
│   ├── App.tsx               # Root React component
│   ├── main.tsx              # React entry point
│   └── index.css             # Global CSS (Tailwind)
├── tests/                     # Test files
│   ├── integration/          # Integration tests (IPC, processing, live interview)
│   └── unit/                 # Unit tests (validation, formatters, session restore)
├── assets/                    # App icons and build resources
├── .planning/                  # GSD planning documents
├── index.html                  # Vite HTML entry point
├── vite.config.ts             # Vite + Electron plugin configuration
├── tsconfig.json              # TypeScript config (renderer)
├── tsconfig.electron.json     # TypeScript config (main process)
├── tsconfig.node.json         # TypeScript config (Node)
├── vitest.config.ts           # Vitest test runner configuration
├── eslint.config.mjs          # ESLint flat config
├── postcss.config.js          # PostCSS config (Tailwind)
├── package.json               # NPM package manifest
└── vitest.config.ts           # Vitest configuration
```

## Directory Purposes

**`electron/`:**
- Purpose: All main process code — window management, IPC, AI processing, audio, config
- Contains: TypeScript files compiled to CJS via tsconfig.electron.json
- Key entry: `electron/main.ts` (app startup)

**`electron/audio/`:**
- Purpose: Real-time audio and live interview services
- Contains: Gemini Live WebSocket client, hint generation via REST, live interview orchestration
- Key files: `GeminiLiveService.ts`, `HintGenerationService.ts`, `LiveInterviewService.ts`, `AudioProcessor.ts`

**`electron/processing/`:**
- Purpose: AI provider abstraction and processing pipeline
- Contains: Provider strategy pattern implementations, processing controllers, response formatters
- Key files: `ProcessingProviderOrchestrator.ts` (factory), `types.ts` (interfaces), `screenshotPayloadLoader.ts`

**`electron/processing/controllers/`:**
- Purpose: Step-by-step processing flow orchestration
- Contains: `QueueProcessingController.ts` (initial solution), `DebugProcessingController.ts` (debug mode)
- Key files: `types.ts` (ProcessingControllerContext)

**`electron/processing/providers/`:**
- Purpose: AI provider implementations
- Contains: One file per provider (OpenAI, Gemini, Anthropic)
- Key files: Each provider implements `ProcessingProviderStrategy` interface

**`electron/processing/formatters/`:**
- Purpose: Transform raw AI responses into structured UI data
- Contains: `solutionResponseFormatter.ts`, `debugResponseFormatter.ts`

**`electron/services/`:**
- Purpose: File parsing and AI-powered extraction services
- Contains: `PdfParserService.ts` (CV upload), `ProfileExtractorService.ts` (AI extraction of profile/company data)

**`src/`:**
- Purpose: All renderer process code — React UI, state management, types
- Contains: Pages, components, contexts, hooks, utilities, i18n, styles
- Key entry: `src/main.tsx` → `src/App.tsx`

**`src/_pages/`:**
- Purpose: Top-level page/route components
- Key files: `SubscribedApp.tsx` (main app after setup), `Queue.tsx`, `Solutions.tsx`, `Debug.tsx`, `DebugLive.tsx`

**`src/components/`:**
- Purpose: Reusable React UI components organized by feature
- Key directories: `UnifiedPanel/` (main runtime panel), `Settings/`, `Wizard/`, `Queue/`, `Solutions/`

**`src/components/ui/`:**
- Purpose: Base Radix UI primitive wrappers
- Contains: `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `toast.tsx`

**`src/components/UnifiedPanel/`:**
- Purpose: Main runtime controller — handles live interview, screenshots, solutions
- Key files: `UnifiedPanel.tsx` (main component), `useAudioCapture.ts`, `useUnifiedPanelSubscriptions.ts`, `useUnifiedPanelUiEffects.ts`

**`src/context/`:**
- Purpose: React context providers
- Key file: `AppStateContext.tsx` (global credits, language, initialization state)

**`src/contexts/`:**
- Purpose: Additional React contexts
- Key file: `toast.tsx` (toast notification context)

**`src/i18n/`:**
- Purpose: Internationalization configuration and locale files
- Contains: `index.ts` (i18next config), `locales/` (translation JSON files)

**`src/lib/`:**
- Purpose: Shared utility modules
- Key files: `sessionRestore.ts` (session history IPC), `utils.ts` (general helpers)

**`src/types/`:**
- Purpose: TypeScript type definitions and declarations
- Key files:
  - `electron.d.ts` — `ElectronAPI` interface and `Window` augmentation
  - `index.ts` — `AppConfig`, `WizardStep`, `UserProfile`, `CompanyContext`, etc.
  - `index.tsx` — React component type utilities
  - `screenshots.ts` — Screenshot-related types
  - `solutions.ts` — Solution/debug response types

**`tests/`:**
- Purpose: Automated tests
- `unit/`: `validation.test.ts`, `sessionRestore.test.ts`, `responseFormatters.test.ts`
- `integration/`: `ipcContract.integration.test.ts`, `liveInterviewLifecycle.integration.test.ts`, `processingHelper.integration.test.ts`

**`docs/`:**
- Purpose: Project documentation
- Key files: Architecture overview, module map, IPC contract, live audio flow, config/persistence, dev workflow, tech debt

## Key File Locations

**Entry Points:**
- `electron/main.ts`: Main process entry — app lifecycle, window creation, helper initialization
- `electron/preload.ts`: IPC bridge — exposes `window.electronAPI`
- `src/main.tsx`: React entry — mounts `<App />` with `HashRouter`
- `src/App.tsx`: Root component — routing, wizard/settings flow, toast provider

**Configuration:**
- `vite.config.ts`: Vite + electron plugin, dev server port 54321, `@` alias
- `tsconfig.json`: Renderer TypeScript config (strict, bundler moduleResolution)
- `tsconfig.electron.json`: Main process TypeScript config (strict, CommonJS module)
- `electron/tsconfig.json`: Additional electron TS config
- `package.json`: App version 1.0.19, scripts, dependencies, electron-builder config
- `postcss.config.js`: PostCSS with Tailwind
- `eslint.config.mjs`: ESLint flat config with TypeScript plugin

**Core Logic:**
- `electron/ProcessingHelper.ts`: Screenshot processing orchestrator (entry to AI pipeline)
- `electron/ConfigHelper.ts`: Configuration singleton with persistence, migration, validation
- `electron/ScreenshotHelper.ts`: Screenshot capture, dual-queue management, platform-specific capture
- `electron/ipcHandlers.ts`: All IPC `handle` registrations (100+ channels)
- `electron/processing/ProcessingProviderOrchestrator.ts`: AI provider factory
- `electron/audio/LiveInterviewService.ts`: Live interview state machine + audio routing
- `electron/audio/GeminiLiveService.ts`: WebSocket client for Gemini Live API
- `electron/audio/HintGenerationService.ts`: REST-based hint generation with caching

**IPC Contract:**
- `electron/preload.ts`: Defines `electronAPI` object — all renderer→main invoke channels + event listeners
- `electron/ipcHandlers.ts`: Registers all `ipcMain.handle()` handlers — validates incoming data
- `src/types/electron.d.ts`: TypeScript interface for `window.electronAPI` — used by renderer

**State (Main Process):**
- `electron/main.ts` lines 26-62: `state` object centrally manages window, helpers, view, problem info
- `electron/store.ts`: Session history persistence (replaces electron-store)

**State (Renderer):**
- `src/App.tsx`: Root state for initialization, wizard, settings, credits
- `src/context/AppStateContext.tsx`: Global React context for credits, language, initialization
- `src/contexts/toast.tsx`: Toast notification context

**Testing:**
- `vitest.config.ts`: Vitest configuration
- `tests/unit/`: Unit tests for pure logic
- `tests/integration/`: Integration tests for cross-process flows

## Naming Conventions

**Files:**
- React components: PascalCase (`UnifiedPanel.tsx`, `SettingsDialog.tsx`)
- Utility/service modules: camelCase (`sessionRestore.ts`, `screenshotPayloadLoader.ts`)
- Type definitions: PascalCase or camelCase (`electron.d.ts`, `index.ts`)
- Main process modules: PascalCase for classes (`ConfigHelper.ts`, `ProcessingHelper.ts`)

**Directories:**
- Feature directories: PascalCase (`UnifiedPanel/`, `LiveInterview/`)
- Utility/pseudo-packages: camelCase or lowercase (`processing/`, `audio/`, `i18n/`)

**IPC Channels:**
- Invoke channels: kebab-case (`trigger-screenshot`, `live-interview-start`, `get-config`)
- Event channels: kebab-case (`screenshot-taken`, `processing-status`, `live-interview-state`)

**Constants:**
- Processing events: UPPER_SNAKE_CASE in `PROCESSING_EVENTS` object

## Where to Add New Code

**New AI Provider:**
1. Create provider file: `electron/processing/providers/{Name}ProcessingProvider.ts`
2. Implement `ProcessingProviderStrategy` interface (from `electron/processing/types.ts`)
3. Register in `ProcessingProviderOrchestrator.createProvider()` method in `electron/processing/ProcessingProviderOrchestrator.ts`
4. Add provider type to `ApiProvider` union type in `electron/processing/types.ts`
5. Add to `ConfigHelper` model validation (`sanitizeModelSelection()`)
6. Add to `PROVIDERS` array in `src/types/index.ts`
7. Add UI selection in `src/components/Settings/SettingsForm.tsx`
8. Add to `electron/preload.ts` `testApiKey` channel if needed

**New Processing Flow (beyond Queue/Debug):**
1. Create new controller in `electron/processing/controllers/`
2. Implement `run(signal, onTimeoutAbort)` method
3. Register in `ProcessingHelper.processScreenshots()` or add new method
4. Add corresponding IPC channel in `electron/ipcHandlers.ts`
5. Add event constants to `PROCESSING_EVENTS`
6. Add preload bridge method in `electron/preload.ts`
7. Add type to `src/types/electron.d.ts`

**New Live Feature (e.g., video analysis):**
1. Create service in `electron/audio/` or new `electron/video/` directory
2. Add IPC handlers in `electron/ipcHandlers.ts`
3. Add preload bridge methods in `electron/preload.ts`
4. Add TypeScript types in `src/types/electron.d.ts`
5. Create React component in `src/components/`
6. Integrate into `UnifiedPanel` or create new page in `src/_pages/`

**New Settings/Config Option:**
1. Add field to `Config` interface in `electron/ConfigHelper.ts`
2. Add to `defaultConfig` object
3. Handle in `updateConfig()` method (migration, default values)
4. Add to `AppConfig` type in `src/types/index.ts`
5. Add to `DEFAULT_CONFIG` constant
6. Add UI control in `src/components/Settings/SettingsForm.tsx`
7. Add IPC channel if main process needs the value

**New React Component:**
- Shared UI primitive: `src/components/ui/{component}.tsx`
- Feature component: `src/components/{FeatureName}/{ComponentName}.tsx`
- Page: `src/_pages/{PageName}.tsx`
- Hook: Co-locate in same directory as component (`useAudioCapture.ts` pattern)

**New Test:**
- Unit test: `tests/unit/{moduleName}.test.ts`
- Integration test: `tests/integration/{featureName}.integration.test.ts`

## Special Directories

**`dist/` (Renderer build output):**
- Purpose: Vite-built renderer assets (HTML, JS bundles, CSS)
- Generated: Yes — created by `vite build`
- Committed: No — in `.gitignore`

**`dist-electron/` (Main process build output):**
- Purpose: Compiled main process CJS files (main.js, preload.js)
- Generated: Yes — created by `tsc -p tsconfig.electron.json`
- Committed: No — in `.gitignore`

**`release/` (Packaged apps):**
- Purpose: Built and packaged Electron applications (DMG, NSIS, etc.)
- Generated: Yes — created by `electron-builder`
- Committed: No

**`{userData}/` (Runtime data — platform-specific):**
- Purpose: Config, screenshots, session history at runtime
- Location:
  - Windows: `C:\Users\[USER]\AppData\Roaming\interview-coder-v1\`
  - macOS: `~/Library/Application Support/interview-coder-v1/`
  - Linux: `~/.config/interview-coder-v1/`
- Key files: `config.json`, `config.json.backup`, `screenshots/`, `extra_screenshots/`, `session-history.json`
- Generated: Yes — created at runtime by ConfigHelper and ScreenshotHelper

**`public/pcm-capture-processor.js`:**
- Purpose: Web Audio worklet processor for PCM audio capture in renderer
- Loaded by: Audio capture hook in `src/components/UnifiedPanel/useAudioCapture.ts`

**`assets/`:**
- Purpose: App icons and electron-builder resources (ICNS, ICO, PNG)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents (codebase analysis, phase plans)
- Committed: Yes

---

*Structure analysis: 2026-04-11*