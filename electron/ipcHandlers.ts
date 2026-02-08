// ipcHandlers.ts

import { app, ipcMain, shell, desktopCapturer } from "electron"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { validateConfigUpdate, validateString, validateEnum, validateUrl, validateFilePath } from "./validation"
import { getAudioProcessor } from "./AudioProcessor"
import { logger } from "./logger"
import {
  clearStoreData,
  clearSessionHistory,
  deleteSessionHistoryItem,
  getSessionHistory,
  getSessionHistoryItem
} from "./store"


const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

interface LiveInterviewServiceInstance {
  start: () => Promise<void>
  stop: () => Promise<void>
  getStatus: () => {
    state: string
    transcript: string
    response: string
    audioLevel: number
  }
  receiveAudio: (pcmBase64: string, level: number) => void
  isActive: () => boolean
  sendText: (text: string) => void
  on: ((event: "status", callback: (status: unknown) => void) => void) &
  ((event: "stateChange", callback: (state: string) => void) => void) &
  ((event: "error", callback: (error: Error) => void) => void)
  removeAllListeners: (event?: string) => void
}

const REQUIRED_PRELOAD_INVOKE_CHANNELS = [
  "open-settings-portal",
  "update-content-dimensions",
  "set-setup-window-size",
  "clear-store",
  "get-screenshots",
  "delete-screenshot",
  "toggle-window",
  "openLink",
  "trigger-screenshot",
  "trigger-process-screenshots",
  "trigger-reset",
  "trigger-move-left",
  "trigger-move-right",
  "trigger-move-up",
  "trigger-move-down",
  "start-update",
  "install-update",
  "get-config",
  "update-config",
  "get-system-prompt-preview",
  "get-session-history",
  "get-session-history-item",
  "delete-session-history-item",
  "clear-session-history",
  "set-window-opacity",
  "check-api-key",
  "validate-api-key",
  "open-external-url",
  "delete-last-screenshot",
  "test-api-key",
  "wizard-complete",
  "wizard-reset",
  "is-wizard-completed",
  "get-audio-sources",
  "test-audio",
  "transcribe-audio",
  "generate-hints",
  "live-interview-start",
  "live-interview-stop",
  "live-interview-status",
  "live-interview-send-text",
  "live-interview-send-audio",
  "quit-app",
  "is-dev",
  "toggle-stealth",
  "set-always-on-top",
  "set-stealth-mode",
  "get-capture-sources",
  "upload-cv",
  "parse-text-profile",
  "upload-job-description",
  "parse-job-text",
  "research-company",
  "get-skill-match",
  "get-active-profile",
  "get-active-company"
] as const

const EXTERNAL_INVOKE_CHANNELS = ["start-update", "install-update"] as const
const EXTERNAL_INVOKE_CHANNEL_SET = new Set<string>(EXTERNAL_INVOKE_CHANNELS)

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  logger.info("Initializing IPC handlers")

  const registeredInvokeChannels = new Set<string>()
  const registerHandle = (
    channel: string,
    handler: Parameters<typeof ipcMain.handle>[1]
  ) => {
    registeredInvokeChannels.add(channel)
    ipcMain.handle(channel, handler)
  }

  const openExternalUrl = (url: string) => {
    try {
      const urlValidation = validateUrl(url, 'url');
      if (!urlValidation.success) {
        logger.warn(`Blocked external URL: ${url} - ${urlValidation.error}`);
        return { success: false, error: urlValidation.error };
      }
      logger.info(`Opening external URL: ${url}`)
      shell.openExternal(url)
      return { success: true }
    } catch (error) {
      logger.error(`Error opening URL ${url}:`, error)
      return { success: false, error: `Failed to open URL: ${error}` }
    }
  }

  // Configuration handlers
  registerHandle("get-config", () => {
    return configHelper.loadConfig();
  })

  registerHandle("update-config", (_event, updates: Record<string, unknown>) => {
    // Validate input before processing
    const validation = validateConfigUpdate(updates);
    if (!validation.success) {
      logger.warn('Invalid config update:', validation.error);
      throw new Error(validation.error);
    }
    return configHelper.updateConfig(validation.data as unknown as Partial<ReturnType<typeof configHelper.loadConfig>>);
  })

  registerHandle("set-window-opacity", (_event, opacity: number) => {
    const win = deps.getMainWindow();
    if (win && !win.isDestroyed()) {
      const clamped = Math.max(0.1, Math.min(1.0, opacity));
      win.setOpacity(clamped);
      configHelper.setOpacity(clamped);
      return { success: true, opacity: clamped };
    }
    return { success: false, error: 'No window available' };
  })

  registerHandle("check-api-key", () => {
    return configHelper.hasApiKey();
  })



  registerHandle("validate-api-key", async (_event, apiKey: string) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return {
        valid: false,
        error: "Invalid API key format. OpenAI API keys start with 'sk-'"
      };
    }

    // Then test the API key with OpenAI
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // Test API key with specific provider
  registerHandle("test-api-key", async (_event, apiKey: string, provider?: "openai" | "gemini" | "anthropic") => {
    try {
      // Validate API key input
      const keyValidation = validateString(apiKey, 'apiKey', { minLength: 10, maxLength: 200 });
      if (!keyValidation.success) {
        return { valid: false, error: keyValidation.error };
      }

      // Validate provider if provided
      if (provider !== undefined) {
        const providerValidation = validateEnum(provider, 'provider', ['openai', 'gemini', 'anthropic'] as const);
        if (!providerValidation.success) {
          return { valid: false, error: providerValidation.error };
        }
      }

      const result = await configHelper.testApiKey(apiKey, provider);
      return result;
    } catch (error) {
      logger.error("Error testing API key:", error);
      return { valid: false, error: "Failed to test API key" };
    }
  })

  // Wizard handlers
  registerHandle("wizard-complete", (_event, mode: 'quick' | 'advanced') => {
    configHelper.completeWizard(mode);
    return { success: true };
  })

  registerHandle("wizard-reset", () => {
    configHelper.resetWizard();
    return { success: true };
  })

  registerHandle("is-wizard-completed", () => {
    return configHelper.isWizardCompleted();
  })

  // Audio sources handler
  registerHandle("get-audio-sources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 32, height: 32 }
      });

      return sources.map(source => ({
        id: source.id,
        name: source.name,
        appIcon: source.appIcon?.toDataURL() || null
      }));
    } catch (error) {
      logger.error("Error getting audio sources:", error);
      return [];
    }
  })

  // Audio test handler - tests audio recognition with Gemini
  registerHandle("test-audio", async (_event, audioData: { buffer: number[]; mimeType: string; apiKey?: string }) => {
    try {
      const processor = getAudioProcessor();
      // If apiKey is provided, set it directly
      if (audioData.apiKey) {
        processor.setApiKey(audioData.apiKey);
      }
      const MAX_AUDIO_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
      if (!audioData.buffer || audioData.buffer.length > MAX_AUDIO_BUFFER_SIZE) {
        return { success: false, error: `Audio buffer exceeds maximum size (${MAX_AUDIO_BUFFER_SIZE} bytes)` };
      }
      const buffer = Buffer.from(audioData.buffer);
      const result = await processor.testAudio(buffer, audioData.mimeType);
      return result;
    } catch (error) {
      logger.error("Error testing audio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Transcribe audio chunk handler
  registerHandle("transcribe-audio", async (_event, audioData: { buffer: number[]; mimeType: string }) => {
    try {
      const processor = getAudioProcessor();
      const buffer = Buffer.from(audioData.buffer);
      const result = await processor.transcribe(buffer, audioData.mimeType);
      return {
        success: true,
        text: result.text,
        timestamp: result.timestamp
      };
    } catch (error) {
      logger.error("Error transcribing audio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Generate hints from transcript
  registerHandle("generate-hints", async (_event, transcript: string) => {
    try {
      const processor = getAudioProcessor();
      const hints = await processor.generateHints(transcript);
      return { success: true, hints };
    } catch (error) {
      logger.error("Error generating hints:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Credits handlers
  registerHandle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      logger.error("Error setting initial credits:", error)
      throw error
    }
  })

  registerHandle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      logger.error("Error decrementing credits:", error)
    }
  })

  registerHandle("clear-store", () => {
    try {
      clearStoreData()
    } catch (error) {
      logger.error("Error clearing store:", error)
      throw error
    }
  })

  // Screenshot queue handlers
  registerHandle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  registerHandle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  registerHandle("delete-screenshot", async (event, path: string) => {
    const pathValidation = validateFilePath(path, 'path');
    if (!pathValidation.success) {
      logger.warn(`delete-screenshot: invalid path - ${pathValidation.error}`);
      return { success: false, error: pathValidation.error };
    }
    return deps.deleteScreenshot(pathValidation.data!)
  })

  registerHandle("get-image-preview", async (event, path: string) => {
    const pathValidation = validateFilePath(path, 'path');
    if (!pathValidation.success) {
      logger.warn(`get-image-preview: invalid path - ${pathValidation.error}`);
      return '';
    }
    return deps.getImagePreview(pathValidation.data!)
  })

  // Screenshot processing handlers
  registerHandle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }

    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  registerHandle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  registerHandle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Setup-mode window sizing (centered, no width cap)
  registerHandle(
    "set-setup-window-size",
    (_event, { width, height }: { width: number; height: number }) => {
      deps.setSetupWindowSize(width, height)
    }
  )

  // Screenshot management handlers
  registerHandle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      logger.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  registerHandle("trigger-screenshot", async (_event, sourceId?: string) => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot(sourceId)
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        logger.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  // Capture sources handler — lists windows/screens for the capture dropdown
  registerHandle("get-capture-sources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 160, height: 100 }
      })
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon?.toDataURL() || null
      }))
    } catch (error) {
      logger.error("Error getting capture sources:", error)
      return []
    }
  })

  registerHandle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      logger.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  registerHandle("open-external-url", (event, url: string) => {
    return openExternalUrl(url)
  })

  // Open external URL handler
  registerHandle("openLink", (event, url: string) => {
    return openExternalUrl(url)
  })

  // Keep backward compatibility for preload/runtime code that still invokes "openExternal"
  registerHandle("openExternal", (_event, url: string) => {
    return openExternalUrl(url)
  })

  // Settings portal handler
  registerHandle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Dev mode detection
  registerHandle("is-dev", () => {
    return process.env.NODE_ENV === "development";
  })

  // Set always-on-top at runtime and persist to config
  registerHandle("set-always-on-top", (_event, enabled: boolean) => {
    const win = deps.getMainWindow();
    if (win) {
      if (enabled) {
        win.setAlwaysOnTop(true, "screen-saver", 1);
      } else {
        win.setAlwaysOnTop(false);
      }
      configHelper.updateDisplayConfig({ alwaysOnTop: enabled });
      logger.info(`[SETTINGS] Always on top: ${enabled}`);
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Set stealth mode at runtime and persist to config
  registerHandle("set-stealth-mode", (_event, enabled: boolean) => {
    const win = deps.getMainWindow();
    if (win) {
      win.setContentProtection(enabled);
      win.setSkipTaskbar(enabled);
      configHelper.updateDisplayConfig({ stealthMode: enabled });
      logger.info(`[SETTINGS] Stealth mode: ${enabled}`);
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Toggle stealth mode at runtime (dev mode only)
  registerHandle("toggle-stealth", (_event, enable: boolean) => {
    if (process.env.NODE_ENV !== "development") {
      return { success: false, error: "Only available in dev mode" };
    }
    const win = deps.getMainWindow();
    if (win) {
      win.setContentProtection(enable);
      win.setSkipTaskbar(enable);
      logger.info(`[DEBUG] Stealth mode ${enable ? 'ON' : 'OFF'}`);
      return { success: true, stealth: enable };
    }
    return { success: false, error: "Main window not available" };
  })

  // Quit application handler
  registerHandle("quit-app", () => {
    app.quit();
  })

  // Window management handlers
  registerHandle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      logger.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  registerHandle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      logger.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  registerHandle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      logger.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  registerHandle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      logger.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  registerHandle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      logger.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  registerHandle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      logger.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  registerHandle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      logger.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  registerHandle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      logger.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })

  // Delete last screenshot handler
  registerHandle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue"
        ? deps.getScreenshotQueue()
        : deps.getExtraScreenshotQueue()

      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" }
      }

      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1]

      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot)

      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }

      return result
    } catch (error) {
      logger.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })

  // ========== Session History ==========
  registerHandle("get-session-history", () => {
    try {
      return getSessionHistory()
    } catch (error) {
      logger.error("Error getting session history:", error)
      return []
    }
  })

  registerHandle("get-session-history-item", (_event, sessionId: string) => {
    try {
      const id = typeof sessionId === "string" ? sessionId : ""
      if (!id) {
        return null
      }
      return getSessionHistoryItem(id)
    } catch (error) {
      logger.error("Error getting session history item:", error)
      return null
    }
  })

  registerHandle("delete-session-history-item", (_event, sessionId: string) => {
    try {
      const id = typeof sessionId === "string" ? sessionId : ""
      if (!id) {
        return { success: false, error: "Invalid sessionId" }
      }
      const success = deleteSessionHistoryItem(id)
      return { success }
    } catch (error) {
      logger.error("Error deleting session history item:", error)
      return { success: false, error: "Failed to delete session history item" }
    }
  })

  registerHandle("clear-session-history", () => {
    try {
      clearSessionHistory()
      return { success: true }
    } catch (error) {
      logger.error("Error clearing session history:", error)
      return { success: false, error: "Failed to clear session history" }
    }
  })

  // ========== System Prompt Preview ==========
  registerHandle("get-system-prompt-preview", async () => {
    const savedConfig = configHelper.loadConfig();
    const prefs = savedConfig.interviewPreferences;

    // Build the same prompt HintGenerationService would use
    const { HintGenerationService } = await import('./audio/HintGenerationService');
    const tempService = new HintGenerationService(
      'preview-key',
      undefined,
      prefs?.language || 'en',
      prefs?.mode,
      prefs?.answerStyle,
      savedConfig.profiles?.find((p: { id: string }) => p.id === savedConfig.activeProfileId) || null,
      (savedConfig.companyContexts || []).find((c: { id: string }) => c.id === savedConfig.activeCompanyId) || null
    );
    // Access the built system instruction
    const hintPrompt = tempService.getSystemInstruction();

    // Build the transcription prompt from GeminiLiveService
    const { GeminiLiveService } = await import('./audio/GeminiLiveService');
    const tempGemini = new GeminiLiveService({
      apiKey: 'preview-key',
      spokenLanguage: prefs?.language || 'en',
    });
    const transcriptionPrompt = tempGemini.getSystemInstruction();

    return {
      hintGenerationPrompt: hintPrompt,
      transcriptionPrompt: transcriptionPrompt,
      settings: {
        interviewMode: prefs?.mode || 'coding',
        answerStyle: prefs?.answerStyle || 'structured',
        language: prefs?.language || 'en',
      }
    };
  });

  // ========== Live Interview Handlers ==========


  let liveInterviewService: LiveInterviewServiceInstance | null = null;

  registerHandle("live-interview-start", async (_event, config: {
    systemInstruction?: string;
    modelName?: string;
    apiKeyOverride?: string;
    spokenLanguage?: string;
  }) => {
    try {
      // Clean up any existing service first
      if (liveInterviewService) {
        liveInterviewService.removeAllListeners?.();
        try {
          await liveInterviewService.stop();
        } catch {
          // Ignore cleanup errors.
        }
        liveInterviewService = null;
      }

      // Use override key if provided, otherwise use saved key
      const savedConfig = configHelper.loadConfig();
      const apiKey = config?.apiKeyOverride || savedConfig.apiKey;
      if (!apiKey) {
        return { success: false, error: "No API key configured" };
      }

      // Load saved interview preferences
      const prefs = savedConfig.interviewPreferences;

      // Dynamically import to avoid circular dependencies
      const { LiveInterviewService } = await import('./audio/LiveInterviewService');

      // Load active profile and company for personalization
      const activeProfile = savedConfig.profiles?.find((p: { id: string }) => p.id === savedConfig.activeProfileId) || null;
      const activeCompany = (savedConfig.companyContexts || []).find((c: { id: string }) => c.id === savedConfig.activeCompanyId) || null;

      liveInterviewService = new LiveInterviewService({
        apiKey,
        model: config?.modelName,
        systemInstruction: config?.systemInstruction,
        spokenLanguage: config?.spokenLanguage || 'en',
        interviewMode: prefs?.mode,
        answerStyle: prefs?.answerStyle,
        userProfile: activeProfile,
        companyContext: activeCompany,
      }) as LiveInterviewServiceInstance;

      // Forward events to renderer
      const mainWindow = deps.getMainWindow();

      liveInterviewService.on('status', (status: unknown) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('live-interview-status', status);
        }
      });

      liveInterviewService.on('stateChange', (state: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('live-interview-state', state);
        }
      });

      liveInterviewService.on('error', (error: Error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('live-interview-error', error.message);
        }
      });

      await liveInterviewService.start();
      return { success: true };
    } catch (error: unknown) {
      logger.error("Error starting live interview:", error);
      return { success: false, error: getErrorMessage(error, "Failed to start live interview") };
    }
  });

  registerHandle("live-interview-stop", async () => {
    try {
      if (liveInterviewService) {
        liveInterviewService.removeAllListeners?.();
        await liveInterviewService.stop();
        liveInterviewService = null;
      }
      return { success: true };
    } catch (error: unknown) {
      logger.error("Error stopping live interview:", error);
      return { success: false, error: getErrorMessage(error, "Failed to stop live interview") };
    }
  });

  registerHandle("live-interview-status", () => {
    if (liveInterviewService) {
      return liveInterviewService.getStatus();
    }
    return { state: 'idle', transcript: '', response: '', audioLevel: 0 };
  });

  registerHandle("live-interview-send-text", async (_event, text: string) => {
    try {
      if (liveInterviewService) {
        liveInterviewService.sendText(text);
        return { success: true };
      }
      return { success: false, error: "Not connected" };
    } catch (error: unknown) {
      logger.error("Failed to send live text:", error);
      return { success: false, error: getErrorMessage(error, "Failed to send live text") };
    }
  });

  // Receive audio chunks from renderer process
  registerHandle("live-interview-send-audio", (_event, pcmBase64: string, level: number) => {
    if (liveInterviewService && liveInterviewService.isActive()) {
      liveInterviewService.receiveAudio(pcmBase64, level);
      return { success: true };
    }
    return { success: false };
  });

  // ========== Personalization Handlers ==========

  registerHandle("upload-cv", async () => {
    try {
      const { openAndParsePdf } = await import('./services/PdfParserService');
      const pdf = await openAndParsePdf();
      if (!pdf) return { success: false, canceled: true };

      const config = configHelper.loadConfig();
      const apiKey = config.apiKey;
      if (!apiKey) return { success: false, error: 'No API key configured' };

      const { extractProfileFromText } = await import('./services/ProfileExtractorService');
      const extracted = await extractProfileFromText(apiKey, pdf.text);

      // Build or update profile
      const now = Date.now();
      const existingProfile = config.profiles.find(p => p.id === config.activeProfileId);
      const profileId = existingProfile?.id || `profile-${now}`;

      const updatedProfile = {
        ...(existingProfile || { id: profileId, tone: 'professional' as const, skills: [], createdAt: now }),
        ...extracted,
        name: extracted.name || existingProfile?.name || 'Default Profile',
        cvText: pdf.text,
        cvFilePath: pdf.filePath,
        cvParsedAt: now,
        updatedAt: now
      };

      const profiles = config.profiles.filter(p => p.id !== profileId);
      profiles.push(updatedProfile);
      configHelper.updateConfig({ profiles, activeProfileId: profileId });

      return { success: true, profile: updatedProfile, fileName: pdf.fileName };
    } catch (error: unknown) {
      logger.error('CV upload failed:', error);
      return { success: false, error: getErrorMessage(error, 'CV upload failed') };
    }
  });

  registerHandle("parse-text-profile", async (_event, text: string) => {
    try {
      const config = configHelper.loadConfig();
      const apiKey = config.apiKey;
      if (!apiKey) return { success: false, error: 'No API key configured' };

      const { extractProfileFromText } = await import('./services/ProfileExtractorService');
      const extracted = await extractProfileFromText(apiKey, text);

      const now = Date.now();
      const existingProfile = config.profiles.find(p => p.id === config.activeProfileId);
      const profileId = existingProfile?.id || `profile-${now}`;

      const updatedProfile = {
        ...(existingProfile || { id: profileId, tone: 'professional' as const, skills: [], createdAt: now }),
        ...extracted,
        name: extracted.name || existingProfile?.name || 'Default Profile',
        cvText: text,
        cvParsedAt: now,
        updatedAt: now
      };

      const profiles = config.profiles.filter(p => p.id !== profileId);
      profiles.push(updatedProfile);
      configHelper.updateConfig({ profiles, activeProfileId: profileId });

      return { success: true, profile: updatedProfile };
    } catch (error: unknown) {
      logger.error('Text profile parse failed:', error);
      return { success: false, error: getErrorMessage(error, 'Text profile parse failed') };
    }
  });

  registerHandle("upload-job-description", async () => {
    try {
      const { openAndParsePdf } = await import('./services/PdfParserService');
      const pdf = await openAndParsePdf();
      if (!pdf) return { success: false, canceled: true };

      const config = configHelper.loadConfig();
      const apiKey = config.apiKey;
      if (!apiKey) return { success: false, error: 'No API key configured' };

      const { extractCompanyFromText, computeSkillMatch } = await import('./services/ProfileExtractorService');
      const extracted = await extractCompanyFromText(apiKey, pdf.text);

      // Compute skill match if we have a profile
      const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
      let skillMatch = undefined;
      if (activeProfile && extracted.requiredSkills) {
        skillMatch = computeSkillMatch(
          activeProfile.skills || [],
          extracted.requiredSkills,
          extracted.niceToHaveSkills
        );
      }

      const now = Date.now();
      const company = {
        id: `company-${now}`,
        ...extracted,
        jobDescription: pdf.text,
        skillMatch,
        createdAt: now,
        updatedAt: now
      };

      const contexts = [...(config.companyContexts || []), company];
      configHelper.updateConfig({ companyContexts: contexts, activeCompanyId: company.id });

      return { success: true, company, fileName: pdf.fileName };
    } catch (error: unknown) {
      logger.error('Job description upload failed:', error);
      return { success: false, error: getErrorMessage(error, 'Job description upload failed') };
    }
  });

  registerHandle("parse-job-text", async (_event, text: string) => {
    try {
      const config = configHelper.loadConfig();
      const apiKey = config.apiKey;
      if (!apiKey) return { success: false, error: 'No API key configured' };

      const { extractCompanyFromText, computeSkillMatch } = await import('./services/ProfileExtractorService');
      const extracted = await extractCompanyFromText(apiKey, text);

      const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
      let skillMatch = undefined;
      if (activeProfile && extracted.requiredSkills) {
        skillMatch = computeSkillMatch(
          activeProfile.skills || [],
          extracted.requiredSkills,
          extracted.niceToHaveSkills
        );
      }

      const now = Date.now();
      const company = {
        id: `company-${now}`,
        ...extracted,
        jobDescription: text,
        skillMatch,
        createdAt: now,
        updatedAt: now
      };

      const contexts = [...(config.companyContexts || []), company];
      configHelper.updateConfig({ companyContexts: contexts, activeCompanyId: company.id });

      return { success: true, company };
    } catch (error: unknown) {
      logger.error('Job text parse failed:', error);
      return { success: false, error: getErrorMessage(error, 'Job text parse failed') };
    }
  });

  registerHandle("research-company", async (_event, companyName: string, jobTitle?: string) => {
    try {
      const config = configHelper.loadConfig();
      const apiKey = config.apiKey;
      if (!apiKey) return { success: false, error: 'No API key configured' };

      const { researchCompany } = await import('./services/ProfileExtractorService');
      const research = await researchCompany(apiKey, companyName, jobTitle);

      // Update active company context with research (immutable update)
      const updatedContexts = (config.companyContexts || []).map(c =>
        c.id === config.activeCompanyId
          ? {
            ...c,
            companyInfo: research.companyInfo,
            techStack: research.techStack || c.techStack,
            companyValues: research.companyValues || c.companyValues,
            talkingPoints: research.talkingPoints,
            updatedAt: Date.now()
          }
          : c
      );
      configHelper.updateConfig({ companyContexts: updatedContexts });

      return { success: true, research };
    } catch (error: unknown) {
      logger.error('Company research failed:', error);
      return { success: false, error: getErrorMessage(error, 'Company research failed') };
    }
  });

  registerHandle("get-skill-match", async () => {
    try {
      const config = configHelper.loadConfig();
      const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
      const activeCompany = (config.companyContexts || []).find(c => c.id === config.activeCompanyId);

      if (!activeProfile || !activeCompany || !activeCompany.requiredSkills) {
        return { success: false, error: 'No active profile or company with required skills' };
      }

      const { computeSkillMatch } = await import('./services/ProfileExtractorService');
      const match = computeSkillMatch(
        activeProfile.skills || [],
        activeCompany.requiredSkills,
        activeCompany.niceToHaveSkills
      );

      return { success: true, skillMatch: match };
    } catch (error: unknown) {
      logger.error('Skill match failed:', error);
      return { success: false, error: getErrorMessage(error, 'Skill match failed') };
    }
  });

  registerHandle("get-active-profile", async () => {
    const config = configHelper.loadConfig();
    const profile = config.profiles.find(p => p.id === config.activeProfileId);
    return { profile: profile || null };
  });

  registerHandle("get-active-company", async () => {
    const config = configHelper.loadConfig();
    const company = (config.companyContexts || []).find(c => c.id === config.activeCompanyId);
    return { company: company || null };
  });

  const missingInvokeChannels = REQUIRED_PRELOAD_INVOKE_CHANNELS.filter(
    (channel) =>
      !registeredInvokeChannels.has(channel) &&
      !EXTERNAL_INVOKE_CHANNEL_SET.has(channel)
  )

  if (missingInvokeChannels.length > 0) {
    const message = `IPC invoke contract mismatch. Missing handlers: ${missingInvokeChannels.join(", ")}`
    logger.error(message)
    if (process.env.NODE_ENV === "development") {
      throw new Error(message)
    }
  }

}



