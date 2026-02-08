/// <reference types="vitest/globals" />

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { BrowserWindow } from "electron"
import type { IProcessingHelperDeps } from "../../electron/main"
import { ProcessingHelper } from "../../electron/ProcessingHelper"
import { ProcessingProviderOrchestrator } from "../../electron/processing/ProcessingProviderOrchestrator"
import type { ScreenshotHelper } from "../../electron/ScreenshotHelper"
import type {
  ProcessingProviderStrategy,
  ProblemInfo,
  ProviderResult
} from "../../electron/processing/types"

const mockConfigHelper = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({
    apiProvider: "gemini" as const,
    apiKey: "test-key",
    extractionModel: "gemini-3-flash-preview",
    solutionModel: "gemini-3-flash-preview",
    debuggingModel: "gemini-3-flash-preview",
    language: "python"
  })),
  on: vi.fn()
}))

vi.mock("../../electron/ConfigHelper", () => ({
  configHelper: mockConfigHelper
}))

type EventRecord = {
  channel: string
  payload: unknown[]
}

class MockProvider implements ProcessingProviderStrategy {
  public readonly provider = "gemini" as const

  public extractProblem = vi.fn(
    async (): Promise<ProviderResult<ProblemInfo>> => ({
      success: true,
      data: {
        problem_statement: "Two Sum",
        constraints: "n >= 1"
      }
    })
  )

  public generateSolution = vi.fn(
    async (): Promise<ProviderResult<string>> => ({
      success: true,
      data: [
        "```python",
        "def solve(nums, target):",
        "    return [0, 1]",
        "```",
        "Thoughts:",
        "- Use one-pass hash map",
        "Time complexity: O(n) because each element is visited once.",
        "Space complexity: O(n) because the map stores visited values."
      ].join("\n")
    })
  )

  public generateDebug = vi.fn(
    async (): Promise<ProviderResult<string>> => ({
      success: true,
      data: [
        "### Issue",
        "- Off-by-one in loop bounds.",
        "### Fix",
        "- Adjust index range to include last element.",
        "### Why",
        "- Prevents skipping valid candidate.",
        "### Verify",
        "- Re-run edge-case tests."
      ].join("\n")
    })
  )

  public isConfigured(): boolean {
    return true
  }
}

const createTempScreenshot = (): { path: string; dir: string } => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ic-shot-"))
  const filePath = path.join(dir, "shot.png")
  fs.writeFileSync(filePath, "fake-image")
  return { path: filePath, dir }
}

const createAbortError = (message: string): Error & { __CANCEL__: boolean } => {
  const error = new Error(message) as Error & { __CANCEL__: boolean }
  error.__CANCEL__ = true
  return error
}

const createAbortAwareProviderCall = <T,>(
  data: T
): ((args: { signal: AbortSignal }) => Promise<ProviderResult<T>>) => {
  return ({ signal }) =>
    new Promise<ProviderResult<T>>((resolve, reject) => {
      if (signal.aborted) {
        reject(createAbortError("Processing was canceled by the user."))
        return
      }

      const timer = setTimeout(() => {
        resolve({ success: true, data })
      }, 200)

      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer)
          reject(createAbortError("Processing was canceled by the user."))
        },
        { once: true }
      )
    })
}

const createNeverResolvingProviderCall = <T,>(): (() => Promise<ProviderResult<T>>) => {
  return async () =>
    new Promise<ProviderResult<T>>(() => {
      return
    })
}

const createMainWindow = (events: EventRecord[]): BrowserWindow => {
  return {
    webContents: {
      send: (channel: string, ...payload: unknown[]) => {
        events.push({ channel, payload })
      },
      executeJavaScript: vi.fn(async () => true)
    },
    isDestroyed: () => false
  } as unknown as BrowserWindow
}

const createDeps = ({
  mainQueue,
  extraQueue,
  view,
  events,
  problemInfo
}: {
  mainQueue: string[]
  extraQueue: string[]
  view: "queue" | "solutions" | "debug"
  events: EventRecord[]
  problemInfo?: ProblemInfo | null
}): {
  deps: IProcessingHelperDeps
  setView: ReturnType<typeof vi.fn>
  setHasDebugged: ReturnType<typeof vi.fn>
  setProblemInfo: ReturnType<typeof vi.fn>
  clearExtraScreenshotQueue: ReturnType<typeof vi.fn>
} => {
  const setView = vi.fn()
  const setHasDebugged = vi.fn()
  let currentProblemInfo = problemInfo === undefined ? null : problemInfo
  const setProblemInfo = vi.fn((nextInfo: ProblemInfo | null) => {
    currentProblemInfo = nextInfo
  })
  const clearExtraScreenshotQueue = vi.fn()

  const screenshotHelper = {
    getScreenshotQueue: vi.fn(() => mainQueue),
    getExtraScreenshotQueue: vi.fn(() => extraQueue),
    clearExtraScreenshotQueue,
    getImagePreview: vi.fn(async () => "preview")
  }

  const deps: IProcessingHelperDeps = {
    getScreenshotHelper: () => screenshotHelper as unknown as ScreenshotHelper,
    getMainWindow: () => createMainWindow(events),
    getView: () => view,
    setView,
    getProblemInfo: () => currentProblemInfo,
    setProblemInfo,
    getScreenshotQueue: () => mainQueue,
    getExtraScreenshotQueue: () => extraQueue,
    clearQueues: vi.fn(),
    takeScreenshot: vi.fn(async () => ""),
    getImagePreview: vi.fn(async () => "preview"),
    deleteScreenshot: vi.fn(async () => ({ success: true })),
    setHasDebugged,
    getHasDebugged: vi.fn(() => false),
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
    }
  }

  return {
    deps,
    setView,
    setHasDebugged,
    setProblemInfo,
    clearExtraScreenshotQueue
  }
}

describe("ProcessingHelper integration: screenshot processing and recovery", () => {
  const createdDirs: string[] = []
  const provider = new MockProvider()
  let providerConfigured = true
  const originalProviderTimeoutEnv = process.env.PROCESSING_PROVIDER_TIMEOUT_MS

  beforeEach(() => {
    providerConfigured = true
    vi.spyOn(ProcessingProviderOrchestrator.prototype, "sync").mockImplementation(
      () => {}
    )
    vi.spyOn(
      ProcessingProviderOrchestrator.prototype,
      "isConfigured"
    ).mockImplementation(() => providerConfigured)
    vi.spyOn(
      ProcessingProviderOrchestrator.prototype,
      "getProvider"
    ).mockReturnValue(provider)

    provider.extractProblem.mockClear()
    provider.generateSolution.mockClear()
    provider.generateDebug.mockClear()

    provider.extractProblem.mockResolvedValue({
      success: true,
      data: {
        problem_statement: "Two Sum",
        constraints: "n >= 1"
      }
    })
    provider.generateSolution.mockResolvedValue({
      success: true,
      data: [
        "```python",
        "def solve(nums, target):",
        "    return [0, 1]",
        "```",
        "Thoughts:",
        "- Use one-pass hash map",
        "Time complexity: O(n) because each element is visited once.",
        "Space complexity: O(n) because the map stores visited values."
      ].join("\n")
    })
    provider.generateDebug.mockResolvedValue({
      success: true,
      data: [
        "### Issue",
        "- Off-by-one in loop bounds.",
        "### Fix",
        "- Adjust index range to include last element.",
        "### Why",
        "- Prevents skipping valid candidate.",
        "### Verify",
        "- Re-run edge-case tests."
      ].join("\n")
    })
  })

  afterEach(() => {
    for (const dir of createdDirs.splice(0, createdDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = originalProviderTimeoutEnv
    vi.restoreAllMocks()
  })

  it("emits no-screenshots when queue is empty", async () => {
    const events: EventRecord[] = []
    const { deps } = createDeps({
      mainQueue: [],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    expect(events.map((event) => event.channel)).toContain("initial-start")
    expect(events.map((event) => event.channel)).toContain(
      "processing-no-screenshots"
    )
    expect(provider.extractProblem).not.toHaveBeenCalled()
  })

  it("switches back to queue and emits error on extraction failure", async () => {
    const shot = createTempScreenshot()
    createdDirs.push(shot.dir)

    provider.extractProblem.mockResolvedValue({
      success: false,
      error: "Provider extraction failed."
    })

    const events: EventRecord[] = []
    const { deps, setView } = createDeps({
      mainQueue: [shot.path],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    expect(setView).toHaveBeenCalledWith("queue")
    expect(events.map((event) => event.channel)).toContain("solution-error")
    expect(provider.extractProblem).toHaveBeenCalledTimes(1)
  })

  it("processes queue screenshots and transitions to solutions on success", async () => {
    const shot = createTempScreenshot()
    createdDirs.push(shot.dir)

    const events: EventRecord[] = []
    const { deps, setView, setProblemInfo, clearExtraScreenshotQueue } = createDeps({
      mainQueue: [shot.path],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    expect(provider.extractProblem).toHaveBeenCalledTimes(1)
    expect(provider.generateSolution).toHaveBeenCalledTimes(1)
    expect(setProblemInfo).toHaveBeenCalled()
    expect(clearExtraScreenshotQueue).toHaveBeenCalledTimes(1)
    expect(setView).toHaveBeenCalledWith("solutions")
    expect(events.map((event) => event.channel)).toContain("problem-extracted")
    expect(events.map((event) => event.channel)).toContain("solution-success")
  })

  it("emits debug success and marks debugged in solutions view", async () => {
    const mainShot = createTempScreenshot()
    const extraShot = createTempScreenshot()
    createdDirs.push(mainShot.dir, extraShot.dir)

    const events: EventRecord[] = []
    const { deps, setHasDebugged } = createDeps({
      mainQueue: [mainShot.path],
      extraQueue: [extraShot.path],
      view: "solutions",
      events,
      problemInfo: { problem_statement: "Two Sum" }
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    expect(provider.generateDebug).toHaveBeenCalledTimes(1)
    expect(setHasDebugged).toHaveBeenCalledWith(true)
    expect(events.map((event) => event.channel)).toContain("debug-start")
    expect(events.map((event) => event.channel)).toContain("debug-success")
  })

  it("emits api-key-invalid when provider is not configured", async () => {
    providerConfigured = false

    const shot = createTempScreenshot()
    createdDirs.push(shot.dir)

    const events: EventRecord[] = []
    const { deps } = createDeps({
      mainQueue: [shot.path],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    expect(events.map((event) => event.channel)).toEqual(["api-key-invalid"])
    expect(provider.extractProblem).not.toHaveBeenCalled()
  })

  it("cancels queue processing without emitting stale success events", async () => {
    const shot = createTempScreenshot()
    createdDirs.push(shot.dir)

    provider.extractProblem.mockImplementation(
      createAbortAwareProviderCall({
        problem_statement: "Two Sum",
        constraints: "n >= 1"
      })
    )

    const events: EventRecord[] = []
    const { deps, setView, setProblemInfo } = createDeps({
      mainQueue: [shot.path],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    const processing = helper.processScreenshots()
    await Promise.resolve()
    helper.cancelOngoingRequests()
    await processing

    const channels = events.map((event) => event.channel)
    expect(channels).toContain("processing-no-screenshots")
    expect(channels).toContain("solution-error")
    expect(channels).not.toContain("solution-success")
    expect(setView).toHaveBeenCalledWith("queue")
    expect(setProblemInfo).toHaveBeenCalledWith(null)
  })

  it("cancels debug processing and prevents stale debug success", async () => {
    const mainShot = createTempScreenshot()
    const extraShot = createTempScreenshot()
    createdDirs.push(mainShot.dir, extraShot.dir)

    provider.generateDebug.mockImplementation(
      createAbortAwareProviderCall([
        "### Issue",
        "- Delayed response"
      ].join("\n"))
    )

    const events: EventRecord[] = []
    const { deps, setHasDebugged } = createDeps({
      mainQueue: [mainShot.path],
      extraQueue: [extraShot.path],
      view: "solutions",
      events,
      problemInfo: { problem_statement: "Two Sum" }
    })

    const helper = new ProcessingHelper(deps)
    const processing = helper.processScreenshots()
    await Promise.resolve()
    helper.cancelOngoingRequests()
    await processing

    const channels = events.map((event) => event.channel)
    expect(channels).toContain("debug-start")
    expect(channels).toContain("debug-error")
    expect(channels).toContain("processing-no-screenshots")
    expect(channels).not.toContain("debug-success")
    expect(setHasDebugged).toHaveBeenCalledWith(false)
    expect(setHasDebugged).not.toHaveBeenCalledWith(true)
  })

  it("times out queue processing when provider hangs", async () => {
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = "15"

    const shot = createTempScreenshot()
    createdDirs.push(shot.dir)

    provider.extractProblem.mockImplementation(
      createNeverResolvingProviderCall<ProblemInfo>()
    )

    const events: EventRecord[] = []
    const { deps, setView } = createDeps({
      mainQueue: [shot.path],
      extraQueue: [],
      view: "queue",
      events
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    const channels = events.map((event) => event.channel)
    expect(channels).toContain("solution-error")
    expect(channels).not.toContain("solution-success")
    expect(setView).toHaveBeenCalledWith("queue")

    const timeoutError = events.find(
      (event) => event.channel === "solution-error"
    )?.payload?.[0]
    expect(String(timeoutError)).toContain("timed out")
  })

  it("times out debug processing when provider hangs", async () => {
    process.env.PROCESSING_PROVIDER_TIMEOUT_MS = "15"

    const mainShot = createTempScreenshot()
    const extraShot = createTempScreenshot()
    createdDirs.push(mainShot.dir, extraShot.dir)

    provider.generateDebug.mockImplementation(
      createNeverResolvingProviderCall<string>()
    )

    const events: EventRecord[] = []
    const { deps, setHasDebugged } = createDeps({
      mainQueue: [mainShot.path],
      extraQueue: [extraShot.path],
      view: "solutions",
      events,
      problemInfo: { problem_statement: "Two Sum" }
    })

    const helper = new ProcessingHelper(deps)
    await helper.processScreenshots()

    const channels = events.map((event) => event.channel)
    expect(channels).toContain("debug-error")
    expect(channels).not.toContain("debug-success")
    expect(setHasDebugged).not.toHaveBeenCalledWith(true)

    const timeoutError = events.find(
      (event) => event.channel === "debug-error"
    )?.payload?.[0]
    expect(String(timeoutError)).toContain("timed out")
  })
})
