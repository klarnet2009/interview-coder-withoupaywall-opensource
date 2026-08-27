# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- Vitest 2.1.9
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (jest-compatible)
- `@testing-library/react` (v16.3.2) and `@testing-library/jest-dom` (v6.9.1) available but not yet used

**Environment:**
- Node.js environment (`environment: 'node'`)
- No jsdom/browser environment configured — React component tests would need setup

**Run Commands:**
```bash
npm test                  # Run all tests once (vitest run)
npm run test:watch        # Run in watch mode (vitest)
npm run test:coverage     # Run tests with coverage report (vitest run --coverage)
```

## Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        globals: true,                           // No need to import describe/it/expect
        environment: 'node',                     // Node.js environment
        include: [
            'tests/**/*.{test,spec}.{ts,tsx}',  // Centralized test directory
            'electron/**/*.{test,spec}.ts'       // Colocated electron tests (none yet)
        ],
        exclude: ['node_modules', 'dist', 'dist-electron']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')  // Matches vite.config.ts
        }
    }
})
```

**Key settings:**
- `globals: true` — `describe`, `it`, `expect` available globally without imports
- Files matching `**/*.test.ts` or `**/*.spec.ts` in `tests/` or `electron/` directories
- Path alias `@` maps to `./src`, matching the production build

## Test File Organization

**Location:** Centralized in `tests/` directory (not colocated with source)

**Structure:**
```
tests/
├── unit/
│   ├── validation.test.ts                    # IPC validation utilities
│   ├── sessionRestore.test.ts               # Session restore helper
│   └── responseFormatters.test.ts            # Solution/debug response formatters
└── integration/
    ├── ipcContract.integration.test.ts           # IPC channel contract verification
    ├── liveInterviewLifecycle.integration.test.ts # Live interview start/stop lifecycle
    └── processingHelper.integration.test.ts      # Screenshot processing & recovery
```

**Naming conventions:**
- Unit tests: `{module}.test.ts` — e.g., `validation.test.ts`
- Integration tests: `{module}.integration.test.ts` — e.g., `ipcContract.integration.test.ts`

**Note:** The `vitest.config.ts` also allows `electron/**/*.{test,spec}.ts` but no colocated test files exist in `electron/` currently.

## Test Structure

### Unit Test Pattern

```typescript
/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { validateString, validateNumber, validateEnum } from '../../electron/validation'

describe('validateString', () => {
    it('returns success for valid string', () => {
        const result = validateString('hello', 'field')
        expect(result.success).toBe(true)
        expect(result.data).toBe('hello')
    })

    it('returns error for non-string', () => {
        const result = validateString(123, 'field')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a string')
    })
})
```

**Patterns:**
- `/// <reference types="vitest/globals" />` at top for type support
- Explicit imports from `vitest` (even though globals enabled)
- `describe` groups tests by function or module
- `it('returns success for X', ...)` — descriptive assertion-focused names
- Direct assertions on `result.success`, `result.data`, `result.error`
- Options objects passed to validation functions for constraint testing

### Integration Test Pattern

```typescript
/// <reference types="vitest/globals" />

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// Mock Electron and dependencies BEFORE importing modules
vi.mock("electron", () => ({
    app: { quit: mocks.appQuit },
    ipcMain: { handle: mocks.ipcHandle },
    // ...
}))

vi.mock("../../electron/ConfigHelper", () => ({
    configHelper: mockConfigHelper
}))

// Import AFTER mocks are set up
import { initializeIpcHandlers } from "../../electron/ipcHandlers"

describe("IPC contract integration", () => {
    beforeEach(() => {
        mocks.ipcHandle.mockClear()
    })

    it("covers all preload invoke channels in main handlers", () => {
        initializeIpcHandlers(deps)
        const registered = new Set(mocks.ipcHandle.mock.calls.map(call => call[0]))
        const invoked = extractInvokedChannelsFromPreload()
        const missing = invoked.filter(channel => !registered.has(channel))
        expect(missing).toEqual([])
    })
})
```

**Key patterns:**
- `vi.mock()` at module level, BEFORE importing the module under test
- `vi.hoisted()` for mock factories that need to reference `vi`
- `beforeEach` for resetting mock state between tests
- `afterEach` with `vi.restoreAllMocks()` and `vi.useRealTimers()`
- Dependency injection via deps object for `ProcessingHelper`, `initializeIpcHandlers`
- Temp file creation/cleanup for integration tests that need filesystem

### Session Restore Test Pattern

```typescript
import { SavedSnippet } from "../../src/types"
import { restoreSnippetWorkspace } from "../../src/lib/sessionRestore"

describe("restoreSnippetWorkspace", () => {
    it("restores debug workspace payload with explicit values", () => {
        const snippet: SavedSnippet = { /* ... full object ... */ }
        const restored = restoreSnippetWorkspace(snippet)
        expect(restored.target).toBe("debug")
        if (restored.target === "debug") {
            expect(restored.payload.code).toBe("const x = arr[i]")
            // ... more assertions
        }
    })

    it("falls back to solution payload when workspace is missing", () => {
        const snippet: SavedSnippet = { /* minimal object */ }
        const restored = restoreSnippetWorkspace(snippet)
        // Test defaults and fallbacks
    })
})
```

**Pattern:** Test both the happy path with full data AND the fallback/default behavior.

## Mocking

### Framework: Vitest `vi`

**Mock setup pattern:**

```typescript
// 1. Define mocks with vi.hoisted()
const mocks = vi.hoisted(() => ({
    ipcHandle: vi.fn(),
    openExternal: vi.fn(),
    getSources: vi.fn().mockResolvedValue([]),
    appQuit: vi.fn()
}))

// 2. Mock modules BEFORE importing
vi.mock("electron", () => ({
    app: { quit: mocks.appQuit },
    ipcMain: { handle: mocks.ipcHandle },
}))

// 3. Mock internal modules
vi.mock("../../electron/ConfigHelper", () => ({
    configHelper: mockConfigHelper
}))
```

### What to Mock

| Category | What | Example |
|----------|------|---------|
| Electron APIs | `ipcMain.handle`, `shell.openExternal`, `desktopCapturer` | `vi.mock("electron", ...)` |
| Config | `configHelper.loadConfig`, `configHelper.updateConfig` | `vi.hoisted(() => ({ loadConfig: vi.fn(), ... }))` |
| Electron Store | `getSessionHistory`, `clearSessionHistory` | `vi.mock("../../electron/store", ...)` |
| AI Providers | `extractProblem`, `generateSolution`, `generateDebug` | `vi.spyOn(GeminiLiveService.prototype, "connect")` |
| File System | Temp directories for screenshot tests | `fs.mkdtempSync`, cleanup in `afterEach` |

### What NOT to Mock

- **Pure functions** — `validateString`, `formatSolutionResponse`, `restoreSnippetWorkspace`
- **Type definitions and interfaces** — tested through implementation
- **Configuration constants** — no point mocking static values

### Mocking Patterns in Detail

**Electron module mock:**
```typescript
vi.mock("electron", () => ({
    app: { quit: mocks.appQuit },
    ipcMain: { handle: mocks.ipcHandle },
    shell: { openExternal: mocks.openExternal },
    desktopCapturer: { getSources: mocks.getSources }
}))
```

**Class instance mock (prototype spying):**
```typescript
beforeEach(() => {
    vi.spyOn(GeminiLiveService.prototype, "connect").mockImplementation(
        async function (this: GeminiLiveService): Promise<void> {
            (this as unknown as { isConnected: boolean }).isConnected = true
        }
    )
})

afterEach(() => {
    vi.restoreAllMocks()
})
```

**Provider mock for ProcessingHelper tests:**
```typescript
class MockProvider implements ProcessingProviderStrategy {
    public readonly provider = "gemini" as const
    public extractProblem = vi.fn(async () => ({ success: true, data: { ... } }))
    public generateSolution = vi.fn(async () => ({ success: true, data: "..." }))
    public generateDebug = vi.fn(async () => ({ success: true, data: "..." }))
    public isConfigured() { return true }
}
```

**Timer mock for timeout testing:**
```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it("times out processing when provider hangs", async () => {
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = "15"
    // ... test that timeout fires
})
```

### Environment Variable Manipulation

Tests modify `process.env` for timeout testing:

```typescript
const originalProviderTimeoutEnv = process.env.PROCESSING_PROVIDER_TIMEOUT_MS

beforeEach(() => {
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = "15"  // 15ms timeout
})

afterEach(() => {
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = originalProviderTimeoutEnv  // Restore
})
```

## Fixtures and Factories

### Test Data

Tests create test data inline — no shared fixture files.

**Pattern: Inline test data creation**

```typescript
const snippet: SavedSnippet = {
    id: "1",
    question: "Why does this fail?",
    answer: "Because index is out of bounds.",
    timestamp: Date.now(),
    tags: ["debug"],
    workspace: { type: "debug", code: "const x = arr[i]", /* ... */ }
}
```

**Factory pattern for mock data:**

```typescript
const createTempScreenshot = (): { path: string; dir: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ic-shot-"))
    const filePath = path.join(dir, "shot.png")
    fs.writeFileSync(filePath, "fake-image")
    return { path: filePath, dir }
}
```

**Factory pattern for dependency injection:**

```typescript
const createDeps = ({
    mainQueue, extraQueue, view, events, problemInfo
}: {...}): { deps: IProcessingHelperDeps, setView, setHasDebugged, ... } => {
    const setView = vi.fn()
    const setHasDebugged = vi.fn()
    // ... construct full deps object
    return { deps, setView, setHasDebugged, ... }
}
```

### Temp File Cleanup

Integration tests that create temp files clean up in `afterEach`:

```typescript
const createdDirs: string[] = []

afterEach(() => {
    for (const dir of createdDirs.splice(0, createdDirs.length)) {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})
```

## Coverage

**Requirements:** No enforced coverage target (no coverage thresholds in vitest config)

**View Coverage:**
```bash
npm run test:coverage    # Generates coverage report
```

**Current coverage:** Not reported — run `npm run test:coverage` to see current numbers

## Test Types

### Unit Tests

**Scope:** Pure functions, validation logic, data transformation, response formatting

**Files:**
- `tests/unit/validation.test.ts` — IPC input validation functions
- `tests/unit/sessionRestore.test.ts` — Session/workspace restore logic
- `tests/unit/responseFormatters.test.ts` — AI response parsing and formatting

**Approach:**
- Test pure functions directly with varied inputs
- Test edge cases: empty inputs, missing fields, invalid types
- Test default values and fallback behavior
- No mocks needed for these pure functions

### Integration Tests

**Scope:** Cross-module interactions, IPC contracts, lifecycle management

**Files:**
- `tests/integration/ipcContract.integration.test.ts` — Verifies all preload invoke channels have corresponding main-process handlers
- `tests/integration/liveInterviewLifecycle.integration.test.ts` — Start/stop/restart lifecycle of live interview service
- `tests/integration/processingHelper.integration.test.ts` — Screenshot processing pipeline, cancellation, timeout

**Approach:**
- Mock Electron APIs and external dependencies
- Test actual module interaction (ProcessingHelper ↔ ProcessingProviderOrchestrator)
- Verify IPC contract integrity (preload channels vs main handlers)
- Test lifecycle transitions (idle → connecting → listening → idle)
- Test cancellation and timeout scenarios
- Use dependency injection for testability

### E2E Tests

**Not used.** No end-to-end or browser-based testing framework configured. `@testing-library/react` and `@testing-library/jest-dom` are installed as devDependencies but no component tests exist yet.

## Common Patterns

### Async Testing

```typescript
// Promise-based async tests
it("processes queue screenshots and transitions to solutions on success", async () => {
    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()
    expect(provider.extractProblem).toHaveBeenCalledTimes(1)
})

// Timer-based async with fake timers
it("forces endTurn after local silence", async () => {
    const service = new LiveInterviewService({ apiKey: "test-key" })
    await service.start()
    service.receiveAudio(chunk, 0.2)
    vi.advanceTimersByTime(1000)
    expect(endTurnSpy).toHaveBeenCalled()
})

// Abort-aware provider calls
const createAbortAwareProviderCall = <T,>(data: T) => {
    return ({ signal }: { signal: AbortSignal }) =>
        new Promise<ProviderResult<T>>((resolve, reject) => {
            if (signal.aborted) { reject(createAbortError("...")); return }
            const timer = setTimeout(() => { resolve({ success: true, data }) }, 200)
            signal.addEventListener("abort", () => { clearTimeout(timer); reject(...) })
        })
}
```

### Error Testing

```typescript
it("returns error for non-string", () => {
    const result = validateString(123, 'field')
    expect(result.success).toBe(false)
    expect(result.error).toContain('must be a string')
})

it("rejects path traversal", () => {
    const result = validateFilePath('../etc/passwd', 'path')
    expect(result.success).toBe(false)
    expect(result.error).toContain('invalid characters')
})
```

### Contract Testing

The IPC contract test verifies synchronization between preload and handlers:

```typescript
// Read preload source and extract all invoke channel names
const extractInvokedChannelsFromPreload = (): string[] => {
    const preloadPath = path.resolve(process.cwd(), "electron/preload.ts")
    const preloadSource = fs.readFileSync(preloadPath, "utf8")
    const invokeRegex = /ipcRenderer\.invoke\(\s*["'`]([^"'`]+)["'`]/g
    const channels = new Set<string>()
    for (const match of preloadSource.matchAll(invokeRegex)) {
        channels.add(match[1])
    }
    return [...channels]
}

// Check that all preload channels have corresponding handlers
it("covers all preload invoke channels in main handlers", () => {
    initializeIpcHandlers(deps)
    const registered = new Set(mocks.ipcHandle.mock.calls.map(call => call[0]))
    const invoked = extractInvokedChannelsFromPreload()
    const externallyRegistered = new Set(["start-update", "install-update"])
    const missing = invoked.filter(
        channel => !registered.has(channel) && !externallyRegistered.has(channel)
    )
    expect(missing).toEqual([])
})
```

### Event Recording Pattern

Integration tests capture IPC events for verification:

```typescript
type EventRecord = { channel: string; payload: unknown[] }
const events: EventRecord[] = []

const createMainWindow = (events: EventRecord[]): BrowserWindow => ({
    webContents: {
        send: (channel: string, ...payload: unknown[]) => {
            events.push({ channel, payload })
        },
        executeJavaScript: vi.fn(async () => true)
    },
    isDestroyed: () => false
} as unknown as BrowserWindow)

// Then assert on emitted events
expect(events.map(event => event.channel)).toContain("solution-success")
```

## What's Tested

| Area | Coverage | Files |
|------|----------|-------|
| IPC validation | Full | `tests/unit/validation.test.ts` |
| Response formatting | Core paths | `tests/unit/responseFormatters.test.ts` |
| Session restore | Core paths + fallbacks | `tests/unit/sessionRestore.test.ts` |
| IPC channel contract | Preload↔Main sync | `tests/integration/ipcContract.integration.test.ts` |
| Processing pipeline | Queue→extract→solve flow | `tests/integration/processingHelper.integration.test.ts` |
| Processing cancellation | Abort flow | `tests/integration/processingHelper.integration.test.ts` |
| Processing timeout | Provider hangs | `tests/integration/processingHelper.integration.test.ts` |
| Live interview lifecycle | Start/stop/restart | `tests/integration/liveInterviewLifecycle.integration.test.ts` |
| Live interview disconnect | Recovery after error | `tests/integration/liveInterviewLifecycle.integration.test.ts` |

## What's NOT Tested

| Area | Risk | Priority |
|------|------|----------|
| React components | No component tests exist at all | High |
| Custom hooks (`useAudioCapture`, `useUnifiedPanelSubscriptions`, etc.) | Side effects and IPC subscriptions untested | High |
| Screenshot capture workflow | `ScreenshotHelper.ts` not tested | High |
| Config persistence | `ConfigHelper.ts` file I/O not tested | Medium |
| Window management | `main.ts` window lifecycle not tested | Medium |
| AI provider implementations | Gemini/OpenAI/Anthropic providers not tested (only mocked) | Medium |
| IPC handler logic | Only contract tested, not handler behavior | Medium |
| Session history store | `store.ts` CRUD operations not unit-tested | Low |
| Localization | i18n translations not tested | Low |
| Preload script | Not unit-tested (only contract-tested) | Low |
| UI rendering | No visual regression tests | Low |
| Audio capture | Live audio pipeline not tested | Low |

## Adding New Tests

### New Unit Test

1. Create file at `tests/unit/{module}.test.ts`
2. Import the function directly: `import { myFunction } from '../../path/to/module'`
3. Use `describe`/`it` pattern with `expect` assertions
4. For pure functions, no mocking needed

### New Integration Test

1. Create file at `tests/integration/{module}.integration.test.ts`
2. Set up mocks with `vi.mock()` at module level, BEFORE importing
3. Use `vi.hoisted()` for mock factories
4. Clean up with `afterEach(() => vi.restoreAllMocks())`
5. Use dependency injection pattern for class instantiation

### Adding a React Component Test

1. Install testing environment: would need `environment: 'jsdom'` for component tests
2. Import `@testing-library/react` render functions
3. Import `@testing-library/jest-dom` matchers
4. Mock `window.electronAPI` for component tests that interact with Electron
5. No existing patterns to follow — would need to establish conventions

### Running Specific Tests

```bash
# Run a single test file
npx vitest run tests/unit/validation.test.ts

# Run all unit tests
npx vitest run tests/unit/

# Run all integration tests
npx vitest run tests/integration/

# Run tests matching a pattern
npx vitest run -t "validateString"
```

---

*Testing analysis: 2026-04-11*