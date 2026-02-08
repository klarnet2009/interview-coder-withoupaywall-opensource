# Interview Coder - AI Coding Interview Assistant

## Project Overview

Interview Coder is a free, open-source desktop application designed to help users prepare for technical coding interviews. The app provides AI-powered problem analysis, solution generation, and debugging assistance. It features an "invisible" window mode that bypasses most screen capture methods, making it undetectable during online interviews.

**Key Characteristics:**
- **License**: AGPL-3.0 (open-source, community-driven)
- **Type**: Electron-based desktop application
- **Language**: TypeScript with React UI
- **Package Manager**: npm (also supports bun)
- **Version**: 1.0.19

---

## Technology Stack

| Category | Technologies |
|----------|--------------|
| **Framework** | Electron 40.2.1 |
| **UI Library** | React 19.2.4 |
| **Language** | TypeScript 5.4.2 |
| **Build Tool** | Vite 6.2.5 with vite-plugin-electron |
| **Styling** | Tailwind CSS 4.1.18 |
| **UI Components** | Radix UI (@radix-ui/react-*) |
| **State Management** | TanStack Query (@tanstack/react-query) |
| **AI APIs** | OpenAI, Google Gemini, Anthropic Claude |
| **Testing** | Vitest 2.1.9 |
| **Linting** | ESLint 9.39.2 with TypeScript plugin |
| **Icons** | Lucide React |

---

## Project Architecture

### Process Structure

The application follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                            │
│  (electron/main.ts)                                             │
│  - Window lifecycle management                                  │
│  - Global shortcuts registration                                │
│  - Screenshot capture (ScreenshotHelper)                        │
│  - AI API processing (ProcessingHelper)                         │
│  - Live interview services (audio/Gemini Live)                  │
│  - Configuration persistence (ConfigHelper)                     │
│  - IPC handlers (ipcHandlers.ts)                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ IPC (inter-process communication)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Preload Script                             │
│  (electron/preload.ts)                                          │
│  - Secure bridge between main and renderer                      │
│  - Exposes window.electronAPI to renderer                       │
│  - Context isolation enabled (security)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│  (src/main.tsx, src/App.tsx)                                    │
│  - React UI components                                          │
│  - User interaction handling                                    │
│  - Wizard/setup flow                                            │
│  - Screenshot queue UI                                          │
│  - Solution/debug views                                         │
│  - Live interview controls                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Directories

```
interview-coder/
├── electron/              # Main process code
│   ├── main.ts           # App entry point, window management
│   ├── preload.ts        # IPC bridge to renderer
│   ├── ipcHandlers.ts    # IPC request handlers
│   ├── ScreenshotHelper.ts   # Screenshot capture logic
│   ├── ProcessingHelper.ts   # AI processing orchestration
│   ├── ConfigHelper.ts   # Settings persistence
│   ├── shortcuts.ts      # Global keyboard shortcuts
│   ├── audio/            # Live audio services
│   │   ├── GeminiLiveService.ts
│   │   ├── HintGenerationService.ts
│   │   └── LiveInterviewService.ts
│   └── processing/       # AI processing providers
│       ├── providers/    # OpenAI, Gemini, Anthropic providers
│       └── controllers/  # Queue & Debug controllers
├── src/                  # Renderer process code
│   ├── main.tsx          # React app entry
│   ├── App.tsx           # Root component
│   ├── _pages/           # Page components
│   ├── components/       # React components
│   │   ├── UnifiedPanel/     # Main runtime controller
│   │   ├── Settings/         # Settings UI
│   │   ├── Wizard/           # Onboarding flow
│   │   └── ui/               # Base UI components
│   ├── types/            # TypeScript type definitions
│   ├── i18n/             # Internationalization
│   └── utils/            # Utility functions
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docs/                 # Documentation
├── assets/               # Icons and images
├── dist/                 # Renderer build output
└── dist-electron/        # Main process build output
```

---

## Build and Development Commands

### Prerequisites
- Node.js 16+ (required)
- npm or bun package manager
- OS screen recording permissions (for screenshot feature)

### Core Commands

```bash
# Development (recommended)
npm run dev              # Clean + watch TS + Vite dev server + Electron

# Development (without clean)
npm start                # Same as dev but without clean step

# Production build
npm run build            # Production renderer + Electron build

# Run production build
npm run run-prod         # Run built Electron main

# Linting
npm run lint             # Run ESLint on all files

# Testing
npm test                 # Run Vitest once
npm run test:watch       # Run Vitest in watch mode
npm run test:coverage    # Run tests with coverage report

# Bundle size check
npm run check:bundle     # Enforce bundle size budget

# Platform-specific packaging
npm run package          # Build and package for current platform
npm run package-mac      # Build and package for macOS (DMG)
npm run package-win      # Build and package for Windows (NSIS)

# Utility
npm run clean            # Remove dist and dist-electron directories
```

### Development Runtime Details

- **Renderer Dev URL**: `http://localhost:54321`
- **Main Process Output**: `dist-electron/`
- **Renderer Output**: `dist/`
- **Packaged Apps**: `release/`

**Important**: In development mode (`NODE_ENV=development`), window invisibility protections are relaxed for debugging purposes. The window will be visible and non-transparent.

---

## Global Keyboard Shortcuts

The application registers global shortcuts that work even when the window is hidden:

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Toggle window visibility |
| `Ctrl/Cmd + H` | Take screenshot |
| `Ctrl/Cmd + L` | Delete last screenshot |
| `Ctrl/Cmd + Enter` | Process screenshots |
| `Ctrl/Cmd + R` | Start new problem (reset) |
| `Ctrl/Cmd + Arrow Keys` | Move window |
| `Ctrl/Cmd + [` | Decrease opacity |
| `Ctrl/Cmd + ]` | Increase opacity |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Reset zoom |
| `Ctrl/Cmd + =` | Zoom in |
| `Ctrl/Cmd + Q` | Quit application |

---

## IPC Contract (Main ↔ Renderer Communication)

The IPC boundary is defined in three files that must be kept synchronized:

1. **Bridge Definition**: `electron/preload.ts`
2. **Main Handlers**: `electron/ipcHandlers.ts`
3. **Renderer Types**: `src/types/electron.d.ts`

### Key Invoke Channels

**Config & Setup:**
- `get-config`, `update-config`
- `check-api-key`, `validate-api-key`, `test-api-key`
- `wizard-complete`, `is-wizard-completed`

**Screenshots:**
- `trigger-screenshot`, `take-screenshot`
- `delete-screenshot`, `delete-last-screenshot`
- `process-screenshots`, `trigger-process-screenshots`

**Window Controls:**
- `toggle-window`, `set-window-opacity`
- `trigger-move-left/right/up/down`

**Live Interview:**
- `live-interview-start`, `live-interview-stop`
- `live-interview-send-audio`, `live-interview-send-text`

### Key Event Channels (Main → Renderer)

- `screenshot-taken`, `screenshot-deleted`
- `processing-status`, `problem-extracted`, `solution-success`
- `debug-success`, `debug-error`
- `live-interview-status`, `live-interview-state`

---

## Code Style Guidelines

### TypeScript Configuration

The project uses strict TypeScript settings:

```json
// tsconfig.json (Renderer)
{
  "strict": true,
  "noUnusedLocals": false,
  "noUnusedParameters": false,
  "noFallthroughCasesInSwitch": true,
  "moduleResolution": "bundler"
}

// tsconfig.electron.json (Main Process)
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true,
  "module": "CommonJS"
}
```

### ESLint Rules

- Uses flat config format (`eslint.config.mjs`)
- Extends recommended TypeScript rules
- Supports JSON and CSS linting
- Ignores: `dist/`, `dist-electron/`, `release/`, `node_modules/`

### Naming Conventions

- **Files**: PascalCase for components (`SettingsDialog.tsx`), camelCase for utilities
- **Components**: PascalCase (`UnifiedPanel`, `WizardContainer`)
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE or camelCase
- **IPC Channels**: kebab-case (`trigger-screenshot`, `live-interview-start`)

---

## Testing Strategy

### Test Framework
- **Runner**: Vitest
- **Environment**: Node.js
- **Globals**: Enabled

### Test Structure

```
tests/
├── unit/
│   ├── validation.test.ts              # IPC validation utilities
│   ├── sessionRestore.test.ts          # Session restore helper
│   └── responseFormatters.test.ts      # Solution/debug formatters
└── integration/
    ├── ipcContract.integration.test.ts     # IPC invoke contract
    ├── liveInterviewLifecycle.integration.test.ts
    └── processingHelper.integration.test.ts
```

### Running Tests

```bash
npm test                 # Run all tests once
npm run test:watch       # Run in watch mode
npm run test:coverage    # Generate coverage report
```

---

## Configuration and Persistence

### User Configuration

Stored in platform-specific user data directory:
- **Windows**: `C:\Users\[USERNAME]\AppData\Roaming\interview-coder-v1\config.json`
- **macOS**: `/Users/[USERNAME]/Library/Application Support/interview-coder-v1/config.json`
- **Linux**: `~/.config/interview-coder-v1/config.json`

Managed by `electron/ConfigHelper.ts`.

### Session History

Stored using `electron-store` in the same user data directory.

### Environment Variables

- **Development**: Loaded from `.env` in project root
- **Production**: Loaded from `.env` in app resources path

---

## Security Considerations

### Current Security Measures

1. **Context Isolation**: Enabled (`contextIsolation: true`)
2. **Node Integration**: Disabled (`nodeIntegration: false`)
3. **Preload Bridge**: All main-renderer communication goes through typed preload
4. **IPC Validation**: Input validation exists in `electron/validation.ts`
5. **External URLs**: Opening brokered by main process with allowlist

### Known Security Gaps

1. **API Key Storage**: API keys stored in raw JSON config (not encrypted at rest)
2. **IPC Contract Drift**: Some preload channels lack corresponding main handlers
3. **Type Definition Drift**: Some duplicate/incorrect type signatures in `electron.d.ts`

### Security Best Practices for Contributors

- Never enable `nodeIntegration` in renderer
- Keep `contextIsolation: true`
- Validate all IPC payloads
- Use the preload bridge for all main-renderer communication
- Do not store sensitive data unencrypted

---

## Adding New AI Providers

To add support for a new AI provider (e.g., Claude, Deepseek, Grok):

1. **Create Provider Class**: Add new file in `electron/processing/providers/`
   - Implement provider interface
   - Handle API authentication and requests

2. **Register Provider**: Update `electron/processing/ProcessingProviderOrchestrator.ts`

3. **Add UI Options**: Update `src/components/Settings/SettingsDialog.tsx`
   - Add provider selection dropdown
   - Add API key input field

4. **Update Types**: Add provider types to `src/types/electron.d.ts`

5. **Test**: Verify with `npm test` and manual testing

---

## Development Workflow

### Typical Local Development Loop

1. `npm install` - Install dependencies
2. `npm run dev` - Start development mode
3. Test features manually (screenshots, processing, live interview)
4. Run `npm run lint` and `npm test` before committing
5. Submit PR with clear description

### Branch Protection Rules

- All changes must be submitted via PR to main branch
- PRs require 2 approving reviews
- Independent approval required for most recent push
- All code-related conversations must be resolved before merge

### Commit Message Convention

Use conventional commits format:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `test: add tests`
- `refactor: code refactoring`

---

## Documentation Index

Comprehensive documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| `CODEBASE_DOCS_INDEX_EN.md` | Index of all documentation |
| `ARCHITECTURE_OVERVIEW_EN.md` | System architecture and runtime topology |
| `MODULE_MAP_EN.md` | File and module ownership map |
| `IPC_CONTRACT_EN.md` | Complete IPC channel reference |
| `LIVE_AUDIO_FLOW_EN.md` | Live interview audio flow |
| `CONFIG_AND_PERSISTENCE_EN.md` | Configuration and persistence details |
| `DEV_WORKFLOW_EN.md` | Development workflow guide |
| `TECH_DEBT_AND_RISKS_EN.md` | Known technical debt and risks |

---

## Troubleshooting

### Common Development Issues

**Window not visible after start:**
- Use `Ctrl/Cmd + B` to toggle visibility
- Check if opacity is set too low (use `Ctrl/Cmd + ]` to increase)
- In dev mode, window should always be visible

**Screenshots not capturing:**
- Ensure screen recording permission is granted to Terminal/IDE
- On macOS: System Preferences > Security & Privacy > Privacy > Screen Recording

**Build failures:**
- Run `npm run clean` before building
- Delete `node_modules` and reinstall if needed

**Hotkeys not working:**
- Check if another app is using the same shortcuts
- Verify Electron window exists and is not destroyed

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). This means:

- You can use, modify, and distribute this software freely
- If you modify the code, you must share your changes under the same license
- If you run a modified version on a network server, you must make the source available to users

See [LICENSE](LICENSE) for full text.
