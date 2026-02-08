import { BrowserWindow } from "electron"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { configHelper } from "./ConfigHelper"
import { type IProcessingHelperDeps } from "./main"
import { DebugProcessingController } from "./processing/controllers/DebugProcessingController"
import { QueueProcessingController } from "./processing/controllers/QueueProcessingController"
import { type ProcessingControllerContext } from "./processing/controllers/types"
import { ProcessingProviderOrchestrator } from "./processing/ProcessingProviderOrchestrator"
import { getProviderTimeoutMs } from "./processing/providerTimeout"
import type { ProviderConfig } from "./processing/types"

export class ProcessingHelper {
  private readonly deps: IProcessingHelperDeps
  private readonly screenshotHelper: ScreenshotHelper | null
  private readonly providerOrchestrator: ProcessingProviderOrchestrator
  private readonly providerTimeoutMs: number

  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    this.providerOrchestrator = new ProcessingProviderOrchestrator()
    this.providerTimeoutMs = getProviderTimeoutMs()

    this.initializeProvider()

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

  private async waitForInitialization(mainWindow: BrowserWindow): Promise<void> {
    let attempts = 0
    const maxAttempts = 50

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }

    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getLanguage(): Promise<string> {
    try {
      const config = configHelper.loadConfig()
      if (config.language) {
        return config.language
      }

      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )
          if (typeof language === "string" && language) {
            return language
          }
        } catch (error) {
          console.warn("Could not get language from window", error)
        }
      }

      return "python"
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  private createControllerContext(): ProcessingControllerContext | null {
    if (!this.screenshotHelper) {
      console.error("Screenshot helper not initialized")
      return null
    }

    return {
      deps: this.deps,
      screenshotHelper: this.screenshotHelper,
      providerOrchestrator: this.providerOrchestrator,
      getProviderConfig: () => this.getProviderConfig(),
      getMainWindow: () => this.deps.getMainWindow(),
      getLanguage: () => this.getLanguage(),
      getErrorMessage: (error, fallback) => this.getErrorMessage(error, fallback),
      getErrorStatus: (error) => this.getErrorStatus(error),
      providerTimeoutMs: this.providerTimeoutMs
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) {
      return
    }

    const config = configHelper.loadConfig()

    this.initializeProvider()
    if (!this.providerOrchestrator.isConfigured(this.getProviderConfig())) {
      console.error(`${config.apiProvider} provider is not configured`)
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID)
      return
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    const context = this.createControllerContext()
    if (!context) {
      return
    }

    if (view === "queue") {
      this.currentProcessingAbortController = new AbortController()
      const { signal } = this.currentProcessingAbortController

      try {
        const queueController = new QueueProcessingController(context)
        await queueController.run(signal, () => {
          if (this.currentProcessingAbortController?.signal.aborted) {
            return
          }
          this.currentProcessingAbortController?.abort()
        })
      } finally {
        this.currentProcessingAbortController = null
      }
      return
    }

    this.currentExtraProcessingAbortController = new AbortController()
    const { signal } = this.currentExtraProcessingAbortController
    try {
      const debugController = new DebugProcessingController(context)
      await debugController.run(signal, () => {
        if (this.currentExtraProcessingAbortController?.signal.aborted) {
          return
        }
        this.currentExtraProcessingAbortController?.abort()
      })
    } finally {
      this.currentExtraProcessingAbortController = null
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
