import * as axios from "axios"
import { configHelper } from "../../ConfigHelper"
import { formatDebugResponse } from "../formatters/debugResponseFormatter"
import {
  isProviderTimeoutError,
  runWithProviderTimeout
} from "../providerTimeout"
import {
  filterExistingScreenshotPaths,
  loadScreenshotPayloads,
  type Base64ScreenshotPayload
} from "../screenshotPayloadLoader"
import type { ProcessingControllerContext } from "./types"
import { logger } from "../../logger"

interface DebugFlowResult {
  success: boolean
  data?: ReturnType<typeof formatDebugResponse>
  error?: string
}

export class DebugProcessingController {
  private readonly context: ProcessingControllerContext
  private isRunning = false

  constructor(context: ProcessingControllerContext) {
    this.context = context
  }

  /**
   * Safe IPC send — guards against window being destroyed during async processing
   */
  private safeSend(channel: string, ...args: unknown[]): void {
    const mainWindow = this.context.getMainWindow()
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args)
      }
    } catch (error) {
      logger.warn(`Failed to send IPC message '${channel}':`, error)
    }
  }

  public async run(
    signal: AbortSignal,
    onTimeoutAbort: () => void
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn("DebugProcessingController: Already running, ignoring duplicate call")
      return
    }
    this.isRunning = true

    try {
      const { deps, screenshotHelper } = this.context
      const mainWindow = this.context.getMainWindow()
      if (!mainWindow) {
        return
      }

      const extraScreenshotQueue = screenshotHelper.getExtraScreenshotQueue()
      logger.info("Processing extra queue screenshots:", extraScreenshotQueue)

      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        logger.info("No extra screenshots found in queue")
        this.safeSend(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      const existingExtraScreenshots = await filterExistingScreenshotPaths(extraScreenshotQueue)
      if (existingExtraScreenshots.length === 0) {
        logger.warn("Extra screenshot files don't exist on disk")
        this.safeSend(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      this.safeSend(deps.PROCESSING_EVENTS.DEBUG_START)

      try {
        const allPaths = [
          ...screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ]
        const existingAllPaths = await filterExistingScreenshotPaths(allPaths)
        const screenshots = await loadScreenshotPayloads(existingAllPaths)
        if (screenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging")
        }

        logger.info(
          "Combined screenshots for processing:",
          screenshots.map((shot) => shot.path)
        )

        const result = await this.processDebugScreenshots(
          screenshots,
          signal,
          onTimeoutAbort
        )
        if (result.success) {
          deps.setHasDebugged(true)
          this.safeSend(deps.PROCESSING_EVENTS.DEBUG_SUCCESS, result.data)
          return
        }

        this.safeSend(deps.PROCESSING_EVENTS.DEBUG_ERROR, result.error)
      } catch (error: unknown) {
        if (isProviderTimeoutError(error)) {
          this.safeSend(
            deps.PROCESSING_EVENTS.DEBUG_ERROR,
            `AI provider timed out while ${error.stage}. Please retry or switch provider/model.`
          )
        } else if (axios.isCancel(error)) {
          this.safeSend(
            deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          this.safeSend(
            deps.PROCESSING_EVENTS.DEBUG_ERROR,
            this.context.getErrorMessage(error, "Debug processing failed")
          )
        }
      }
    } finally {
      this.isRunning = false
    }
  }

  private async processDebugScreenshots(
    screenshots: Base64ScreenshotPayload[],
    signal: AbortSignal,
    onTimeoutAbort: () => void
  ): Promise<DebugFlowResult> {
    try {
      const problemInfo = this.context.deps.getProblemInfo()
      const language = await this.context.getLanguage()
      const config = configHelper.loadConfig()
      const mainWindow = this.context.getMainWindow()

      if (!problemInfo) {
        throw new Error("No problem info available")
      }

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        })
      }

      const imageDataList = screenshots.map((screenshot) => screenshot.data)
      const debugPrompt = `
You are a coding interview debugging assistant.

I am solving this problem:
"${problemInfo.problem_statement}"
Language: ${language}

Analyze the screenshots and return a debugging report using this exact structure and headings:

### Issue
- Clear, concrete problems in the current solution.

### Fix
- Exact corrections or code changes required.

### Why
- Why each fix is needed and how it improves correctness/performance.

### Verify
- Concrete validation steps and test checks to confirm the fix.

Rules:
1. Keep each section actionable and concise.
2. Use bullet points for every section.
3. If you include code, put it in a fenced markdown code block with language.
4. Do not omit any of the four sections.
`

      let progressMessage = "Analyzing code and generating debug feedback..."
      if (config.apiProvider === "gemini") {
        progressMessage = "Analyzing code and generating debug feedback with Gemini..."
      } else if (config.apiProvider === "anthropic") {
        progressMessage = "Analyzing code and generating debug feedback with Claude..."
      }
      if (mainWindow) {
        this.safeSend("processing-status", {
          message: progressMessage,
          progress: 60
        })
      }

      const provider = this.context.providerOrchestrator.getProvider(
        this.context.getProviderConfig()
      )
      const debugResult = await runWithProviderTimeout(
        () =>
          provider.generateDebug({
            debugPrompt,
            imageDataList,
            model: config.debuggingModel,
            signal
          }),
        {
          signal,
          stage: "generating debug analysis",
          timeoutMs: this.context.providerTimeoutMs,
          onTimeout: onTimeoutAbort
        }
      )

      if (!debugResult.success || !debugResult.data) {
        return {
          success: false,
          error:
            debugResult.error ||
            "Failed to generate debug analysis. No response from AI provider."
        }
      }

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        })
      }

      return { success: true, data: formatDebugResponse(debugResult.data) }
    } catch (error: unknown) {
      if (isProviderTimeoutError(error)) {
        return {
          success: false,
          error: `AI provider timed out while ${error.stage}. Please retry or switch provider/model.`
        }
      }

      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Extra processing was canceled by the user."
        }
      }

      logger.error("Debug processing error:", error)
      return {
        success: false,
        error: this.context.getErrorMessage(error, "Failed to process debug request")
      }
    }
  }
}
