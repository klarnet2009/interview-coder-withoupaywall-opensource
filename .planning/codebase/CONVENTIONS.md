# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

### Files

- **React components:** PascalCase `.tsx` — e.g., `WizardContainer.tsx`, `ErrorBoundary.tsx`, `SettingsPage.tsx`
- **Main process modules:** PascalCase `.ts` — e.g., `ProcessingHelper.ts`, `ScreenshotHelper.ts`, `ConfigHelper.ts`
- **Type definition files:** lowercase or camelCase `.ts` — e.g., `types.ts`, `electron.d.ts`, `screenshots.ts`
- **Utility files:** camelCase `.ts` — e.g., `sessionRestore.ts`, `utils.ts`, `platform.ts`
- **Barrel/index files:** `index.ts` or `index.tsx` — e.g., `src/components/Wizard/index.ts`, `src/i18n/index.ts`
- **Test files:** `{name}.test.ts` or `{name}.integration.test.ts` — colocated in `tests/` directory
- **Legacy files:** suffixed with `.legacy.ts` — e.g., `AudioCaptureService.legacy.ts` (excluded from compilation via `tsconfig`)

**Rule:** Use PascalCase for components and main-process class files. Use camelCase for utilities and services. Test files use `.test.ts` suffix.

### Directories

- **React component groups:** PascalCase — e.g., `Wizard/`, `Settings/`, `LiveInterview/`
- **Main process modules:** camelCase — e.g., `processing/`, `audio/`
- **Page-level components:** `_pages/` (underscore prefix distinguishes route-level components)
- **Utility/lib directories:** lowercase — e.g., `lib/`, `utils/`, `services/`

### Functions

- **camelCase** for all functions — e.g., `formatSolutionResponse`, `validateString`, `createScopedLogger`
- **Handler functions in IPC:** `registerHandle("channel-name", handler)` pattern — handler defined inline or as named function
- **Hook functions:** `use` prefix — e.g., `useAppState`, `useToast`, `useAudioCapture`, `useUnifiedPanelSubscriptions`

```typescript
// Example: Main process function
export function validateConfigUpdate(input: unknown): ValidationResult<ConfigUpdateInput> { ... }

// Example: React hook
export function useAppState(): AppStateContextType { ... }
```

### Variables and Constants

- **Local variables:** camelCase — e.g., `mainWindow`, `currentStepIndex`, `isWindowVisible`
- **Module-level constants:** UPPER_SNAKE_CASE for true constants, camelCase for config objects
- **State variables:** descriptive camelCase — e.g., `processingStatus`, `wizardCompleted`, `hasApiKey`

```typescript
// Module-level constants
const INITIALIZATION_MAX_ATTEMPTS = 50
const INITIALIZATION_POLL_MS = 100
const MAX_SESSION_HISTORY = 30

// Config/default objects (camelCase)
const DEFAULT_CONFIG: AppConfig = { ... }
const PROCESSING_EVENTS = { ... } as const
```

### Types and Interfaces

- **Interfaces:** PascalCase with `I` prefix for dependency-injection interfaces — e.g., `IProcessingHelperDeps`, `IShortcutsHelperDeps`, `IIpcHandlerDeps`
- **Regular interfaces:** PascalCase without prefix — e.g., `ProblemInfo`, `ProviderResult<T>`, `SessionWorkspaceSnapshot`
- **Type aliases:** PascalCase — e.g., `APIProvider`, `ListeningState`, `ProcessingStatus`
- **Generic parameters:** descriptive PascalCase — e.g., `ProviderResult<T>`, `ValidationResult<T>`
- **Enums/const objects as types:** Use `as const` assertion for literal types

```typescript
// Dependency injection interface (I-prefix convention)
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  // ...
}

// Regular interface
export interface ProviderResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Type alias
export type APIProvider = "openai" | "gemini" | "anthropic"
export type ListeningState = "idle" | "connecting" | "listening" | "error"
```

### IPC Channel Names

- **kebab-case** for all IPC channel names — e.g., `trigger-screenshot`, `live-interview-start`, `set-window-opacity`
- **Event channels (main→renderer):** kebab-case — e.g., `screenshot-taken`, `processing-status`, `live-interview-state`
- **Processing events:** defined in `PROCESSING_EVENTS` const object — e.g., `PROCESSING_EVENTS.SOLUTION_SUCCESS` maps to `"solution-success"`

## TypeScript Patterns

### Strict Mode

Both `tsconfig.json` (renderer) and `tsconfig.electron.json` (main) use strict mode:

```json
// tsconfig.json (renderer)
{ "strict": true, "noUnusedLocals": false, "noUnusedParameters": false }

// tsconfig.electron.json (main)
{ "strict": true, "strictNullChecks": true, "noImplicitAny": true }
```

- `noUnusedLocals` and `noUnusedParameters` are **disabled** — dead code is tolerated
- Main process uses `CommonJS` modules; renderer uses `ESNext` with bundler resolution
- Both exclude `**/*.legacy.ts` files

### Result Pattern

Main process operations return a **`ValidationResult<T>`** discriminated union:

```typescript
export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

Callers check `result.success` and access `result.data` or `result.error`. Used in `electron/validation.ts` and IPC handlers.

### Provider Strategy Pattern

AI providers implement the **`ProcessingProviderStrategy`** interface:

```typescript
export interface ProcessingProviderStrategy {
  readonly provider: ApiProvider
  isConfigured(): boolean
  extractProblem(request: ExtractProblemRequest): Promise<ProviderResult<ProblemInfo>>
  generateSolution(request: GenerateSolutionRequest): Promise<ProviderResult<string>>
  generateDebug(request: GenerateDebugRequest): Promise<ProviderResult<string>>
}
```

Each provider (`GeminiProcessingProvider`, `OpenAIProcessingProvider`, `AnthropicProcessingProvider`) lives in `electron/processing/providers/`. Orchestrated by `ProcessingProviderOrchestrator` which syncs config and routes calls.

### Discriminated Union Types

Used for type-safe state management:

```typescript
// Restored workspace payload discriminated by target field
export type RestoredWorkspacePayload =
  | { target: "debug"; payload: RestoredDebugWorkspacePayload }
  | { target: "solution"; payload: RestoredSolutionWorkspacePayload }
```

### Const Assertions for IPC Events

IPC event channel names use `as const` assertion to ensure type safety:

```typescript
const PROCESSING_EVENTS = {
  UNAUTHORIZED: "processing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  // ...
} as const
```

### Path Aliases

- `@` maps to `./src` in both `vite.config.ts` and `vitest.config.ts`
- Main process files use relative paths — e.g., `import { configHelper } from "./ConfigHelper"`
- Renderer files may use `@/` alias — e.g., `import { cn } from "@/lib/utils"`

### Type Definition Locations

| Category | File | Notes |
|----------|------|-------|
| App config types | `src/types/index.ts` | Main type definitions (AppConfig, WizardState, etc.) |
| IPC/Electron types | `src/types/electron.d.ts` | Window.electronAPI interface, global declarations |
| Screenshot types | `src/types/screenshots.ts` | Minimal Screenshot interface |
| Solution types | `src/types/solutions.ts` | Solution, SolutionsResponse interfaces |
| Component types | `src/components/*/types.ts` | Colocated with component (e.g., `UnifiedPanel/types.ts`) |
| Processing types | `electron/processing/types.ts` | Provider, request, result types |
| Store types | `electron/store.ts` | StoredSnippet, StoredSession |
| Session types | `src/types/index.ts` | SavedSnippet, SessionWorkspaceSnapshot |

### Duplicate Type Definitions

**Warning:** Some types are defined in multiple places:
- `Screenshot` is defined in both `src/types/index.tsx` and `src/types/screenshots.ts` with different shapes
- `ProblemInfo` is defined in both `electron/main.ts` and `electron/processing/types.ts`
- `SessionWorkspaceSnapshot` is defined in both `src/types/electron.d.ts` and `electron/store.ts`

When modifying these, check all definition sites.

## React Patterns

### Component Structure

- **Function components** with hooks — no class components except `ErrorBoundary`
- **Props interface** defined inline or in colocated `types.ts`

```typescript
// Component with props interface (inline)
interface WizardContainerProps {
  initialMode?: WizardMode
  onComplete: (config: Partial<AppConfig>, mode: WizardMode) => void
  onSkip: () => void
}

export const WizardContainer: React.FC<WizardContainerProps> = ({
  initialMode = 'quick',
  onComplete,
  onSkip
}) => { ... }
```

- **Class components** only for error boundaries (`ErrorBoundary` extends `Component`)

### State Management

- **Global state:** React Context (`AppStateContext`, `ToastContext`)
- **Server state:** TanStack Query (`@tanstack/react-query`) via `QueryClientProvider`
- **Local state:** `useState` hooks within components
- **No Redux or Zustand** — prefers lightweight context + local state

```typescript
// Context pattern (src/contexts/toast.tsx)
export const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
```

### Hook Patterns

Custom hooks follow `use` prefix convention:

- `useAppState()` — global app state (credits, language, initialized)
- `useToast()` — toast notification context
- `useAudioCapture` — audio capture logic for live interview
- `useUnifiedPanelSubscriptions` — IPC event subscription management
- `useUnifiedPanelUiEffects` — UI side effects for the unified panel

### Event Subscription Pattern

IPC event listeners use a subscribe/unsubscribe pattern:

```typescript
// Renderer subscribes to IPC events and gets cleanup function
const unsubscribe = window.electronAPI.onSolutionSuccess((data) => {
  // handle event
})
// Cleanup on unmount
return () => unsubscribe()
```

Multiple subscriptions are cleaned up in arrays:

```typescript
const cleanupFunctions = [
  window.electronAPI.onSolutionSuccess(hideProcessingStatus),
  window.electronAPI.onSolutionError(hideProcessingStatus),
  // ...
]
return () => { cleanupFunctions.forEach((fn) => fn()) }
```

### Component Composition

- **Barrel exports** via `index.ts` files — e.g., `src/components/Wizard/index.ts`
- **Props passing** through interface types — components receive typed props, not context
- **Conditional rendering** based on initialization state:

```typescript
{isInitialized ? (
  isSettingsOpen ? <SettingsPage /> :
  showWizard ? <WizardContainer /> :
  hasApiKey && wizardCompleted ? <SubscribedApp /> :
  <WelcomeScreen />
) : <LoadingSpinner />}
```

### Error Boundary Pattern

The `ErrorBoundary` component wraps the entire application:

```typescript
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>
```

Provides fallback UI with retry button and error message display.

## Electron Patterns

### IPC Architecture

**Three-file contract** that must stay synchronized:

1. **Bridge definition:** `electron/preload.ts` — `contextBridge.exposeInMainWorld("electronAPI", {...})`
2. **Main handlers:** `electron/ipcHandlers.ts` — `registerHandle("channel-name", handler)`
3. **Renderer types:** `src/types/electron.d.ts` — `interface ElectronAPI {...}`

**Channel naming:**
- Invoke channels (renderer→main): `kebab-case` — e.g., `get-config`, `trigger-screenshot`
- Event channels (main→renderer): `kebab-case` — e.g., `screenshot-taken`, `live-interview-state`
- Processing events: defined in `PROCESSING_EVENTS` constant

**Validation pattern** for IPC handlers:

```typescript
registerHandle("delete-screenshot", async (event, path: string) => {
  const pathValidation = validateFilePath(path, 'path');
  if (!pathValidation.success) {
    logger.warn(`delete-screenshot: invalid path - ${pathValidation.error}`);
    return { success: false, error: pathValidation.error };
  }
  return deps.deleteScreenshot(pathValidation.data!)
})
```

### Dependency Injection Pattern

Main process uses a **dependency injection** pattern via interfaces:

```typescript
// Define deps interface in electron/main.ts
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  // ... all state accessors
}

// Helper classes receive deps in constructor
class ProcessingHelper {
  private readonly deps: IProcessingHelperDeps
  constructor(deps: IProcessingHelperDeps) { this.deps = deps }
}
```

This pattern enables testability (seen in `tests/integration/processingHelper.integration.test.ts`).

### Window Management

- Single `state` object in `electron/main.ts` holds all app state
- State accessors exported as functions: `getMainWindow()`, `getView()`, `setView()`
- Window visibility managed through opacity (0 = hidden, 1 = visible)
- Development mode relaxes invisibility protections

### Configuration Pattern

- **ConfigHelper** (`electron/ConfigHelper.ts`) manages persistent config
- Config stored in platform-specific user data directory as JSON
- EventEmitter pattern for config changes: `configHelper.on("config-updated", callback)`
- Runtime config loads from `.env` in dev, `process.resourcesPath/.env` in prod

### Scoped Logger Pattern

```typescript
import { createScopedLogger } from "./logger"
const runtimeLogger = createScopedLogger("main")

// Usage
runtimeLogger.debug("Processing provider initialized:", provider)
runtimeLogger.error("Failed to process:", error)
```

`logger.debug` only outputs in development mode.

## Import Organization

**Order (renderer/src files):**
1. React imports
2. Third-party library imports (`@tanstack/react-query`, `lucide-react`, etc.)
3. Internal component imports (`./components/...`)
4. Type imports (`from "../../types"`)
5. Utility imports (`from "../../lib/utils"`)

**Order (main/electron files):**
1. Node built-ins (`fs`, `path`, `os`, etc.)
2. Electron imports (`from "electron"`)
3. Third-party imports (`axios`, `openai`, etc.)
4. Internal module imports (`from "./ConfigHelper"`, `from "./logger"`)
5. Type imports (`from "./processing/types"`)

**Path conventions:**
- Main process uses **relative paths** — e.g., `import { configHelper } from "./ConfigHelper"`
- Renderer uses **`@/` alias** for cross-module imports — e.g., `import { cn } from "@/lib/utils"`
- Colocated imports use **relative paths** — e.g., `import { StepWelcome } from "./WizardSteps/StepWelcome"`

## Error Handling Patterns

### Main Process

- **Validation layer:** `electron/validation.ts` provides `validateString`, `validateNumber`, `validateEnum`, `validateConfigUpdate`, `validateFilePath`, `validateUrl`
- **Result objects:** Functions return `{ success: boolean, data?: T, error?: string }` pattern
- **Try-catch with error extraction:**

```typescript
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message
  return fallback
}
```

- **IPC handler error pattern:**

```typescript
try {
  // ... operation
  return { success: true, result }
} catch (error: unknown) {
  logger.error("Operation failed:", error)
  return { success: false, error: getErrorMessage(error, "Failed to operation") }
}
```

### Renderer Process

- **ErrorBoundary** wraps entire app for unhandled errors
- **Toast notifications** for user-facing errors via `ToastContext`
- **IPC error handling:** Each IPC call handles errors individually — no global error boundary for IPC

### AbortController Pattern

Processing supports cancellation via `AbortController`:

```typescript
private currentProcessingAbortController: AbortController | null = null

processScreenshots() {
  this.currentProcessingAbortController = new AbortController()
  // Pass signal to provider calls
}

cancelOngoingRequests() {
  this.currentProcessingAbortController?.abort()
}
```

## Logging Patterns

**Framework:** `electron-log` wrapped with scoped logger

**Pattern:**
```typescript
import { createScopedLogger } from "./logger"
const logger = createScopedLogger("moduleName")

logger.info("Operation succeeded", result)
logger.warn("Unexpected but handled condition", details)
logger.error("Operation failed", error)
logger.debug("Dev-only diagnostic info", data)  // Only in development
```

**Renderer logging:** Plain `console.log` / `console.error` — no structured logger

**Preload logging:** Custom lightweight logger (can't use `electron-log` in sandboxed preload):

```typescript
const log = (msg: string, ...args: unknown[]) => console.log(`[preload] ${msg}`, ...args)
const logError = (msg: string, ...args: unknown[]) => console.error(`[preload] ${msg}`, ...args)
```

## Comments

**When to Comment:**
- JSDoc comments on exported interfaces and types
- Inline comments for non-obvious logic (IPC validation, security checks)
- Section headers with `// ========== Section Name ==========` in long files
- `// NOTE:` for important constraints or gotchas
- `// Legacy` markers on backward-compatibility code

**Pattern observed:**
```typescript
// Clean up any existing service first
if (liveInterviewService) {
  liveInterviewService.removeAllListeners?.();
  try { await liveInterviewService.stop(); } catch { /* Ignore cleanup errors. */ }
  liveInterviewService = null;
}
```

## Function Design

**Size:** Functions tend to be moderate (10-50 lines). IPC handlers can be longer due to validation + error handling.

**Parameters:**
- Use typed object parameters for configs — e.g., `(config: ProviderConfig)`
- Use destructuring for multiple related params in React components
- Use optional parameters for overridable behavior — e.g., `sourceId?: string`

**Return Values:**
- Main process: `{ success: boolean, data?: T, error?: string }` result objects
- Renderer: Direct values or `void`
- IPC invoke calls: `Promise<T>` — always async from renderer perspective

## Module Exports

**Named exports** are the standard pattern. No default exports except:

- `export default App` in `src/App.tsx` (React convention)
- `export default Button` in `src/components/ui/button.tsx` (Radix/shadcn pattern)

**Barrel files:**
- `src/components/Wizard/index.ts` re-exports all step components
- `electron/audio/index.ts` re-exports audio services
- `electron/processing/types.ts` consolidates processing type exports

```typescript
// Barrel file pattern (src/components/Wizard/index.ts)
export { WizardContainer } from './WizardContainer'
export { StepWelcome } from './WizardSteps/StepWelcome'
export { StepProvider } from './WizardSteps/StepProvider'
// ...
```

## CSS/Styling Conventions

### Tailwind CSS v4

- Uses **Tailwind CSS v4** with PostCSS plugin (`@tailwindcss/vite`)
- Custom theme defined in `src/index.css` with `@theme` directive
- Global styles in `src/index.css` (animations, custom keyframes)

### Design System

`src/styles/design-system.ts` exports a comprehensive design token system:

```typescript
export const colors = { background: { primary: '#000000', ... }, ... }
export const typography = { fontFamily: { ... }, sizes: { ... }, weights: { ... } }
export const spacing = { 0: '0', 1: '0.25rem', ... }
export const borderRadius = { sm: '0.375rem', DEFAULT: '0.5rem', ... }
```

**Usage:** Components reference these tokens directly in style objects or Tailwind classes.

### Utility Function

`src/lib/utils.ts` provides the standard shadcn/ui `cn()` utility:

```typescript
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Component Styling Pattern

- **Tailwind classes** for layout and responsive design
- **Radix UI primitives** for accessible component foundations (`@radix-ui/react-dialog`, etc.)
- **class-variance-authority (cva)** for button/variant styling
- **Dark theme only** — no light mode, all backgrounds shades of black

```typescript
// Button variant pattern (src/components/ui/button.tsx)
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium...",
  {
    variants: {
      variant: { default: "bg-primary...", destructive: "bg-destructive...", ... },
      size: { default: "h-9 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", ... }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)
```

## Internationalization

- **i18next** with `react-i18next` integration
- Translation files in `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`
- Usage: `const { t } = useTranslation()` then `t('common.initializing')`
- Default language: English (`lng: 'en'`)

---

*Convention analysis: 2026-04-11*