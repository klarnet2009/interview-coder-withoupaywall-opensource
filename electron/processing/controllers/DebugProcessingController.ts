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

interface DebugFlowResult {
  success: boolean
  data?: ReturnType<typeof formatDebugResponse>
  error?: string
}

export class DebugProcessingController {
  private readonly context: ProcessingControllerContext

  constructor(context: ProcessingControllerContext) {
    this.context = context
  }

  public async run(
    signal: AbortSignal,
    onTimeoutAbort: () => void
  ): Promise<void> {
    const { deps, screenshotHelper } = this.context
    const mainWindow = this.context.getMainWindow()
    if (!mainWindow) {
      return
    }

    const extraScreenshotQueue = screenshotHelper.getExtraScreenshotQueue()
    console.log("Processing extra queue screenshots:", extraScreenshotQueue)

    if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
      console.log("No extra screenshots found in queue")
      mainWindow.webContents.send(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    const existingExtraScreenshots = filterExistingScreenshotPaths(extraScreenshotQueue)
    if (existingExtraScreenshots.length === 0) {
      console.log("Extra screenshot files don't exist on disk")
      mainWindow.webContents.send(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    mainWindow.webContents.send(deps.PROCESSING_EVENTS.DEBUG_START)

    try {
      const allPaths = [
        ...screenshotHelper.getScreenshotQueue(),
        ...existingExtraScreenshots
      ]
      const existingAllPaths = filterExistingScreenshotPaths(allPaths)
      const screenshots = await loadScreenshotPayloads(existingAllPaths)
      if (screenshots.length === 0) {
        throw new Error("Failed to load screenshot data for debugging")
      }

      console.log(
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
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.DEBUG_SUCCESS, result.data)
        return
      }

      mainWindow.webContents.send(deps.PROCESSING_EVENTS.DEBUG_ERROR, result.error)
    } catch (error: unknown) {
      if (isProviderTimeoutError(error)) {
        mainWindow.webContents.send(
          deps.PROCESSING_EVENTS.DEBUG_ERROR,
          `AI provider timed out while ${error.stage}. Please retry or switch provider/model.`
        )
      } else if (axios.isCancel(error)) {
        mainWindow.webContents.send(
          deps.PROCESSING_EVENTS.DEBUG_ERROR,
          "Extra processing was canceled by the user."
        )
      } else {
        mainWindow.webContents.send(
          deps.PROCESSING_EVENTS.DEBUG_ERROR,
          this.context.getErrorMessage(error, "Debug processing failed")
        )
      }
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
        mainWindow.webContents.send("processing-status", {
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
        mainWindow.webContents.send("processing-status", {
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
        mainWindow.webContents.send("processing-status", {
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

      console.error("Debug processing error:", error)
      return {
        success: false,
        error: this.context.getErrorMessage(error, "Failed to process debug request")
      }
    }
  }
}
