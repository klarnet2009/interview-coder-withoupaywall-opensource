import type { BrowserWindow } from "electron"
import type { IProcessingHelperDeps } from "../../main"
import type { ScreenshotHelper } from "../../ScreenshotHelper"
import type { ProcessingProviderOrchestrator } from "../ProcessingProviderOrchestrator"
import type { ProviderConfig } from "../types"

export interface ProcessingControllerContext {
  deps: IProcessingHelperDeps
  screenshotHelper: ScreenshotHelper
  providerOrchestrator: ProcessingProviderOrchestrator
  getProviderConfig: () => ProviderConfig
  getMainWindow: () => BrowserWindow | null
  getLanguage: () => Promise<string>
  getErrorMessage: (error: unknown, fallback: string) => string
  getErrorStatus: (error: unknown) => number | undefined
  providerTimeoutMs: number
}
