/// <reference types="vitest/globals" />

import fs from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  openExternal: vi.fn(),
  getSources: vi.fn().mockResolvedValue([]),
  appQuit: vi.fn()
}))

const mockConfigHelper = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({
    apiKey: "test-key",
    apiProvider: "gemini",
    extractionModel: "gemini-3-flash-preview",
    solutionModel: "gemini-3-flash-preview",
    debuggingModel: "gemini-3-flash-preview",
    language: "python",
    interviewPreferences: {
      mode: "coding",
      answerStyle: "structured",
      language: "en"
    }
  })),
  updateConfig: vi.fn((updates: Record<string, unknown>) => updates),
  hasApiKey: vi.fn(() => true),
  isValidApiKeyFormat: vi.fn(() => true),
  testApiKey: vi.fn(async () => ({ valid: true })),
  completeWizard: vi.fn(),
  resetWizard: vi.fn(),
  isWizardCompleted: vi.fn(() => false),
  setOpacity: vi.fn(),
  updateDisplayConfig: vi.fn()
}))

const mockStoreApi = vi.hoisted(() => ({
  getSessionHistory: vi.fn(() => []),
  getSessionHistoryItem: vi.fn(() => null),
  deleteSessionHistoryItem: vi.fn(() => true),
  clearSessionHistory: vi.fn(),
  store: {
    clear: vi.fn()
  }
}))

vi.mock("electron", () => ({
  app: {
    quit: mocks.appQuit
  },
  ipcMain: {
    handle: mocks.ipcHandle
  },
  shell: {
    openExternal: mocks.openExternal
  },
  desktopCapturer: {
    getSources: mocks.getSources
  }
}))

vi.mock("../../electron/ConfigHelper", () => ({
  configHelper: mockConfigHelper
}))

vi.mock("../../electron/AudioProcessor", () => ({
  getAudioProcessor: () => ({
    setApiKey: vi.fn(),
    testAudio: vi.fn(async () => ({ success: true })),
    transcribe: vi.fn(async () => ({ text: "ok", timestamp: Date.now() })),
    generateHints: vi.fn(async () => ["hint"])
  })
}))

vi.mock("../../electron/store", () => mockStoreApi)

import { initializeIpcHandlers } from "../../electron/ipcHandlers"

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

describe("IPC contract integration", () => {
  beforeEach(() => {
    mocks.ipcHandle.mockClear()
  })

  it("covers all preload invoke channels in main handlers", () => {
    initializeIpcHandlers({
      getMainWindow: () => null,
      setWindowDimensions: vi.fn(),
      setSetupWindowSize: vi.fn(),
      getScreenshotQueue: vi.fn(() => []),
      getExtraScreenshotQueue: vi.fn(() => []),
      deleteScreenshot: vi.fn(async () => ({ success: true })),
      getImagePreview: vi.fn(async () => ""),
      processingHelper: null,
      PROCESSING_EVENTS: {
        UNAUTHORIZED: "processing-unauthorized",
        NO_SCREENSHOTS: "processing-no-screenshots",
        OUT_OF_CREDITS: "out-of-credits",
        API_KEY_INVALID: "api-key-invalid",
        INITIAL_START: "initial-start",
        PROBLEM_EXTRACTED: "problem-extracted",
        SOLUTION_SUCCESS: "solution-success",
        INITIAL_SOLUTION_ERROR: "solution-error",
        DEBUG_START: "debug-start",
        DEBUG_SUCCESS: "debug-success",
        DEBUG_ERROR: "debug-error"
      },
      takeScreenshot: vi.fn(async () => ""),
      getView: vi.fn(() => "queue" as const),
      toggleMainWindow: vi.fn(),
      clearQueues: vi.fn(),
      setView: vi.fn(),
      moveWindowLeft: vi.fn(),
      moveWindowRight: vi.fn(),
      moveWindowUp: vi.fn(),
      moveWindowDown: vi.fn()
    })

    const registered = new Set<string>(
      mocks.ipcHandle.mock.calls.map((call) => call[0] as string)
    )
    const invoked = extractInvokedChannelsFromPreload()
    const externallyRegistered = new Set(["start-update", "install-update"])

    const missing = invoked.filter(
      (channel) => !registered.has(channel) && !externallyRegistered.has(channel)
    )

    expect(missing).toEqual([])
  })
})
