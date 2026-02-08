import * as axios from "axios"
import { configHelper } from "../../ConfigHelper"
import { formatSolutionResponse } from "../formatters/solutionResponseFormatter"
import {
  isProviderTimeoutError,
  runWithProviderTimeout
} from "../providerTimeout"
import {
  filterExistingScreenshotPaths,
  loadScreenshotPayloads,
  type Base64ScreenshotPayload
} from "../screenshotPayloadLoader"
import type { ProblemInfo, ProviderResult } from "../types"
import type { ProcessingControllerContext } from "./types"
import { logger } from "../../logger"

interface QueueFlowResult {
  success: boolean
  data?: ReturnType<typeof formatSolutionResponse>
  error?: string
}

const isProviderConfigError = (message: string): boolean => {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("api key") ||
    normalized.includes("not configured") ||
    normalized.includes("invalid") ||
    normalized.includes("openai") ||
    normalized.includes("gemini") ||
    normalized.includes("anthropic")
  )
}

export class QueueProcessingController {
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
      logger.warn("QueueProcessingController: Already running, ignoring duplicate call")
      return
    }
    this.isRunning = true

    try {
      const { deps, screenshotHelper } = this.context
      const mainWindow = this.context.getMainWindow()
      if (!mainWindow) {
        return
      }

      this.safeSend(deps.PROCESSING_EVENTS.INITIAL_START)

      const screenshotQueue = screenshotHelper.getScreenshotQueue()
      logger.info("Processing main queue screenshots:", screenshotQueue)

      if (!screenshotQueue || screenshotQueue.length === 0) {
        logger.info("No screenshots found in queue")
        this.safeSend(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      const existingScreenshots = await filterExistingScreenshotPaths(screenshotQueue)
      if (existingScreenshots.length === 0) {
        logger.warn("Screenshot files don't exist on disk")
        this.safeSend(deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      try {
        const screenshots = await loadScreenshotPayloads(existingScreenshots)
        if (screenshots.length === 0) {
          throw new Error("Failed to load screenshot data")
        }

        const result = await this.processScreenshots(
          screenshots,
          signal,
          onTimeoutAbort
        )

        if (!result.success) {
          if (result.error && isProviderConfigError(result.error)) {
            this.safeSend(deps.PROCESSING_EVENTS.API_KEY_INVALID)
          } else {
            this.safeSend(
              deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          logger.info("Resetting view to queue due to error")
          deps.setView("queue")
          return
        }

        logger.info("Setting view to solutions after successful processing")
        this.safeSend(
          deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        deps.setView("solutions")
      } catch (error: unknown) {
        if (isProviderTimeoutError(error)) {
          this.safeSend(
            deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            `AI provider timed out while ${error.stage}. Please retry or switch provider/model.`
          )
        } else if (axios.isCancel(error)) {
          this.safeSend(
            deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          this.safeSend(
            deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            this.context.getErrorMessage(error, "Server error. Please try again.")
          )
        }
        logger.info("Resetting view to queue due to error")
        deps.setView("queue")
      }
    } finally {
      this.isRunning = false
    }
  }
  private async processScreenshots(
    screenshots: Base64ScreenshotPayload[],
    signal: AbortSignal,
    onTimeoutAbort: () => void
  ): Promise<QueueFlowResult> {
    try {
      const config = configHelper.loadConfig()
      const language = await this.context.getLanguage()
      const mainWindow = this.context.getMainWindow()

      const imageDataList = screenshots.map((screenshot) => screenshot.data)

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        })
      }

      const provider = this.context.providerOrchestrator.getProvider(
        this.context.getProviderConfig()
      )
      const extractionResult = await runWithProviderTimeout(
        () =>
          provider.extractProblem({
            imageDataList,
            language,
            model: config.extractionModel,
            signal
          }),
        {
          signal,
          stage: "extracting the problem",
          timeoutMs: this.context.providerTimeoutMs,
          onTimeout: onTimeoutAbort
        }
      )

      if (!extractionResult.success || !extractionResult.data) {
        return {
          success: false,
          error:
            extractionResult.error ||
            "Failed to process screenshots. Please try again."
        }
      }

      const problemInfo = extractionResult.data

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        })
      }

      this.context.deps.setProblemInfo(problemInfo)

      if (mainWindow) {
        this.safeSend(
          this.context.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        )
      }

      const solutionsResult = await this.generateSolution(
        problemInfo,
        signal,
        onTimeoutAbort
      )
      if (!solutionsResult.success || !solutionsResult.data) {
        return {
          success: false,
          error:
            solutionsResult.error || "Failed to generate solutions"
        }
      }

      this.context.screenshotHelper.clearExtraScreenshotQueue()

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Solution generated successfully",
          progress: 100
        })
      }

      return { success: true, data: solutionsResult.data }
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
          error: "Processing was canceled by the user."
        }
      }

      const status = this.context.getErrorStatus(error)
      if (status === 401) {
        return {
          success: false,
          error: "Invalid API key for the selected provider. Please check your settings."
        }
      }
      if (status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later."
        }
      }
      if (status === 500) {
        return {
          success: false,
          error: "AI provider server error. Please try again later."
        }
      }

      logger.error("API Error Details:", error)
      return {
        success: false,
        error: this.context.getErrorMessage(
          error,
          "Failed to process screenshots. Please try again."
        )
      }
    }
  }

  private async generateSolution(
    problemInfo: ProblemInfo,
    signal: AbortSignal,
    onTimeoutAbort: () => void
  ): Promise<ProviderResult<ReturnType<typeof formatSolutionResponse>>> {
    try {
      const language = await this.context.getLanguage()
      const config = configHelper.loadConfig()
      const mainWindow = this.context.getMainWindow()

      if (mainWindow) {
        this.safeSend("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        })
      }

      const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`

      const provider = this.context.providerOrchestrator.getProvider(
        this.context.getProviderConfig()
      )
      const generationResult = await runWithProviderTimeout(
        () =>
          provider.generateSolution({
            promptText,
            model: config.solutionModel,
            signal
          }),
        {
          signal,
          stage: "generating the solution",
          timeoutMs: this.context.providerTimeoutMs,
          onTimeout: onTimeoutAbort
        }
      )

      if (!generationResult.success || !generationResult.data) {
        return {
          success: false,
          error:
            generationResult.error ||
            "Failed to generate solution. No response from AI provider."
        }
      }

      return {
        success: true,
        data: formatSolutionResponse(generationResult.data)
      }
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
          error: "Processing was canceled by the user."
        }
      }

      const status = this.context.getErrorStatus(error)
      if (status === 401) {
        return {
          success: false,
          error: "Invalid API key for the selected provider. Please check your settings."
        }
      }
      if (status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later."
        }
      }

      logger.error("Solution generation error:", error)
      return {
        success: false,
        error: this.context.getErrorMessage(error, "Failed to generate solution")
      }
    }
  }
}
