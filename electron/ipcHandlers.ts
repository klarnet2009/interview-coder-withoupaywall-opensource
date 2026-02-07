// ipcHandlers.ts

import { ipcMain, shell, dialog, desktopCapturer } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { validateConfigUpdate, validateString, validateEnum, validateFilePath } from "./validation"
import { getAudioProcessor } from "./AudioProcessor"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    // Validate input before processing
    const validation = validateConfigUpdate(updates);
    if (!validation.success) {
      console.warn('Invalid config update:', validation.error);
      throw new Error(validation.error);
    }
    return configHelper.updateConfig(validation.data!);
  })

  ipcMain.handle("set-window-opacity", (_event, opacity: number) => {
    const win = deps.getMainWindow();
    if (win && !win.isDestroyed()) {
      const clamped = Math.max(0.1, Math.min(1.0, opacity));
      win.setOpacity(clamped);
      configHelper.setOpacity(clamped);
      return { success: true, opacity: clamped };
    }
    return { success: false, error: 'No window available' };
  })

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })

  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
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
  ipcMain.handle("test-api-key", async (_event, apiKey: string, provider?: "openai" | "gemini" | "anthropic") => {
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
      console.error("Error testing API key:", error);
      return { valid: false, error: "Failed to test API key" };
    }
  })

  // Wizard handlers
  ipcMain.handle("wizard-complete", (_event, mode: 'quick' | 'advanced') => {
    configHelper.completeWizard(mode);
    return { success: true };
  })

  ipcMain.handle("wizard-reset", () => {
    configHelper.resetWizard();
    return { success: true };
  })

  ipcMain.handle("is-wizard-completed", () => {
    return configHelper.isWizardCompleted();
  })

  // Audio sources handler
  ipcMain.handle("get-audio-sources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 16, height: 16 }
      });

      return sources.map(source => ({
        id: source.id,
        name: source.name,
        appIcon: source.appIcon?.toDataURL() || null
      }));
    } catch (error) {
      console.error("Error getting audio sources:", error);
      return [];
    }
  })

  // Audio test handler - tests audio recognition with Gemini
  ipcMain.handle("test-audio", async (_event, audioData: { buffer: number[]; mimeType: string; apiKey?: string }) => {
    try {
      const processor = getAudioProcessor();
      // If apiKey is provided, set it directly
      if (audioData.apiKey) {
        processor.setApiKey(audioData.apiKey);
      }
      const buffer = Buffer.from(audioData.buffer);
      const result = await processor.testAudio(buffer, audioData.mimeType);
      return result;
    } catch (error) {
      console.error("Error testing audio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Transcribe audio chunk handler
  ipcMain.handle("transcribe-audio", async (_event, audioData: { buffer: number[]; mimeType: string }) => {
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
      console.error("Error transcribing audio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Generate hints from transcript
  ipcMain.handle("generate-hints", async (_event, transcript: string) => {
    try {
      const processor = getAudioProcessor();
      const hints = await processor.generateHints(transcript);
      return { success: true, hints };
    } catch (error) {
      console.error("Error generating hints:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
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
      console.error("Error decrementing credits:", error)
    }
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
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
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
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
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })

  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  })

  // Settings portal handler
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
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
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
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
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })

  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
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
      console.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })

  // ========== Live Interview Handlers ==========


  let liveInterviewService: any = null;

  ipcMain.handle("live-interview-start", async (_event, config: {
    systemInstruction?: string;
    modelName?: string;
    apiKeyOverride?: string;
    spokenLanguage?: string;
  }) => {
    try {
      // Use override key if provided, otherwise use saved key
      const apiKey = config?.apiKeyOverride || configHelper.loadConfig().apiKey;
      if (!apiKey) {
        return { success: false, error: "No API key configured" };
      }

      // Dynamically import to avoid circular dependencies
      const { LiveInterviewService } = await import('./audio/LiveInterviewService');

      liveInterviewService = new LiveInterviewService({
        apiKey,
        model: config?.modelName,
        systemInstruction: config?.systemInstruction,
        spokenLanguage: config?.spokenLanguage || 'en',
      });

      // Forward events to renderer
      const mainWindow = deps.getMainWindow();

      liveInterviewService.on('status', (status: any) => {
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
    } catch (error: any) {
      console.error("Error starting live interview:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("live-interview-stop", async () => {
    try {
      if (liveInterviewService) {
        await liveInterviewService.stop();
        liveInterviewService = null;
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error stopping live interview:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("live-interview-status", () => {
    if (liveInterviewService) {
      return liveInterviewService.getStatus();
    }
    return { state: 'idle', transcript: '', response: '', audioLevel: 0 };
  });

  ipcMain.handle("live-interview-send-text", async (_event, text: string) => {
    try {
      if (liveInterviewService && liveInterviewService.geminiService) {
        liveInterviewService.geminiService.sendText(text);
        return { success: true };
      }
      return { success: false, error: "Not connected" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Receive audio chunks from renderer process
  ipcMain.handle("live-interview-send-audio", (_event, pcmBase64: string, level: number) => {
    if (liveInterviewService && liveInterviewService.isActive()) {
      liveInterviewService.receiveAudio(pcmBase64, level);
      return { success: true };
    }
    return { success: false };
  });

}

