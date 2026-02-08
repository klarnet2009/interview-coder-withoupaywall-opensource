// ProcessingHelper.ts
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { BrowserWindow } from "electron"
import { configHelper } from "./ConfigHelper"
import { ProcessingProviderOrchestrator } from "./processing/ProcessingProviderOrchestrator"
import { formatDebugResponse } from "./processing/formatters/debugResponseFormatter"
import { formatSolutionResponse } from "./processing/formatters/solutionResponseFormatter"
import type { ProviderConfig } from "./processing/types"
export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper | null
  private readonly providerOrchestrator: ProcessingProviderOrchestrator

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    this.providerOrchestrator = new ProcessingProviderOrchestrator()

    // Initialize AI provider based on config
    this.initializeProvider()

    // Listen for config changes to re-initialize provider
    configHelper.on("config-updated", () => {
      this.initializeProvider()
    })
  }

  private getProviderConfig(): ProviderConfig {
    const config = configHelper.loadConfig()
    return {
      apiProvider: config.apiProvider,
      apiKey: config.apiKey,
      extractionModel: config.extractionModel,
      solutionModel: config.solutionModel,
      debuggingModel: config.debuggingModel
    }
  }

  private initializeProvider(): void {
    try {
      this.providerOrchestrator.sync(this.getProviderConfig())
    } catch (error) {
      console.error("Failed to initialize processing provider:", error)
    }
  }



  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return fallback
  }

  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined
    }
    const maybeAxios = error as { response?: { status?: number }; status?: number }
    return maybeAxios.response?.status ?? maybeAxios.status
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }

      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }

      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();

    // Verify currently selected provider is configured.
    this.initializeProvider()
    if (!this.providerOrchestrator.isConfigured(this.getProviderConfig())) {
      console.error(`${config.apiProvider} provider is not configured`)
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID)
      return
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (!this.screenshotHelper) {
      console.error("Screenshot helper not initialized");
      return;
    }

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)

      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        // Store screenshotHelper in local variable for use in callbacks
        const screenshotHelper = this.screenshotHelper;

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter((s): s is { path: string; preview: string; data: string } => s !== null);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots as { path: string; data: string }[], signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: unknown) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            this.getErrorMessage(error, "Server error. Please try again.")
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)

      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);

        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const screenshotHelper = this.screenshotHelper;
        const allPaths = [
          ...screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];

        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }

              return {
                path,
                preview: await screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter((s): s is { path: string; preview: string; data: string } => s !== null);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots as { path: string; data: string }[],
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: unknown) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            this.getErrorMessage(error, "Debug processing failed")
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      if (!this.screenshotHelper) {
        throw new Error("Screenshot helper not initialized");
      }

      // Step 1: Extract problem info using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map(screenshot => screenshot.data);

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      const provider = this.providerOrchestrator.getProvider(
        this.getProviderConfig()
      )
      const extractionResult = await provider.extractProblem({
        imageDataList,
        language,
        model: config.extractionModel,
        signal
      })

      if (!extractionResult.success || !extractionResult.data) {
        return {
          success: false,
          error:
            extractionResult.error ||
            "Failed to process screenshots. Please try again."
        }
      }

      const problemInfo = extractionResult.data

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        });
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();

          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100
          });

          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: unknown) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }

      // Handle OpenAI API errors specifically
      const status = this.getErrorStatus(error);
      if (status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later."
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error: this.getErrorMessage(
          error,
          "Failed to process screenshots. Please try again."
        )
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (!this.screenshotHelper) {
        throw new Error("Screenshot helper not initialized");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        });
      }

      // Create prompt for solution generation
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
`;

      const provider = this.providerOrchestrator.getProvider(
        this.getProviderConfig()
      )
      const generationResult = await provider.generateSolution({
        promptText,
        model: config.solutionModel,
        signal
      })

      if (!generationResult.success || !generationResult.data) {
        return {
          success: false,
          error:
            generationResult.error ||
            "Failed to generate solution. No response from AI provider."
        }
      }
      const responseContent = generationResult.data

      const formattedResponse = formatSolutionResponse(responseContent)
      return { success: true, data: formattedResponse };
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }

      const status = this.getErrorStatus(error);
      if (status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      }

      console.error("Solution generation error:", error);
      return {
        success: false,
        error: this.getErrorMessage(error, "Failed to generate solution")
      };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
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
`;

      let progressMessage = "Analyzing code and generating debug feedback..."
      if (config.apiProvider === "gemini") {
        progressMessage =
          "Analyzing code and generating debug feedback with Gemini..."
      } else if (config.apiProvider === "anthropic") {
        progressMessage =
          "Analyzing code and generating debug feedback with Claude..."
      }
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: progressMessage,
          progress: 60
        })
      }

      const provider = this.providerOrchestrator.getProvider(
        this.getProviderConfig()
      )
      const debugResult = await provider.generateDebug({
        debugPrompt,
        imageDataList,
        model: config.debuggingModel,
        signal
      })

      if (!debugResult.success || !debugResult.data) {
        return {
          success: false,
          error:
            debugResult.error ||
            "Failed to generate debug analysis. No response from AI provider."
        }
      }
      const debugContent = debugResult.data

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      const response = formatDebugResponse(debugContent)
      return { success: true, data: response };
    } catch (error: unknown) {
      console.error("Debug processing error:", error);
      return {
        success: false,
        error: this.getErrorMessage(error, "Failed to process debug request")
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
