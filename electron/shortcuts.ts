import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { createScopedLogger } from "./logger"

const runtimeLogger = createScopedLogger("shortcuts")

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    let currentOpacity = mainWindow.getOpacity();
    let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    runtimeLogger.debug(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);

    mainWindow.setOpacity(newOpacity);

    // Save the opacity setting to config without re-initializing the client
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      runtimeLogger.error('Error saving opacity to config:', error);
    }

    // If we're making the window visible, also make sure it's shown and interaction is enabled
    if (newOpacity > 0.1 && !this.deps.isVisible()) {
      this.deps.toggleMainWindow();
    }
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        runtimeLogger.debug("Taking screenshot...")
        try {
          const screenshotPath = await this.deps.takeScreenshot()
          const preview = await this.deps.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          runtimeLogger.error("Error capturing screenshot:", error)
        }
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.deps.processingHelper?.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+R", () => {
      runtimeLogger.debug(
        "Command + R pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests()

      // Clear both screenshot queues
      this.deps.clearQueues()

      runtimeLogger.debug("Cleared queues.")

      // Update the view state to 'queue'
      this.deps.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    })

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      runtimeLogger.debug("Command/Ctrl + Left pressed. Moving window left.")
      this.deps.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Right", () => {
      runtimeLogger.debug("Command/Ctrl + Right pressed. Moving window right.")
      this.deps.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+Down", () => {
      runtimeLogger.debug("Command/Ctrl + down pressed. Moving window down.")
      this.deps.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+Up", () => {
      runtimeLogger.debug("Command/Ctrl + Up pressed. Moving window Up.")
      this.deps.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+B", () => {
      runtimeLogger.debug("Command/Ctrl + B pressed. Toggling window visibility.")
      this.deps.toggleMainWindow()
    })

    globalShortcut.register("CommandOrControl+Q", () => {
      runtimeLogger.debug("Command/Ctrl + Q pressed. Quitting application.")
      app.quit()
    })

    // Adjust opacity shortcuts
    globalShortcut.register("CommandOrControl+[", () => {
      runtimeLogger.debug("Command/Ctrl + [ pressed. Decreasing opacity.")
      this.adjustOpacity(-0.1)
    })

    globalShortcut.register("CommandOrControl+]", () => {
      runtimeLogger.debug("Command/Ctrl + ] pressed. Increasing opacity.")
      this.adjustOpacity(0.1)
    })

    // Zoom controls
    globalShortcut.register("CommandOrControl+-", () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        const newZoom = currentZoom - 0.5
        mainWindow.webContents.setZoomLevel(newZoom)
        runtimeLogger.debug(`Zoom: ${Math.round(Math.pow(1.2, newZoom) * 100)}%`)
      }
    })

    globalShortcut.register("CommandOrControl+0", () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
        runtimeLogger.debug(`Zoom: 100%`)
      }
    })

    globalShortcut.register("CommandOrControl+=", () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        const newZoom = currentZoom + 0.5
        mainWindow.webContents.setZoomLevel(newZoom)
        runtimeLogger.debug(`Zoom: ${Math.round(Math.pow(1.2, newZoom) * 100)}%`)
      }
    })

    // Delete last screenshot shortcut
    globalShortcut.register("CommandOrControl+L", () => {
      runtimeLogger.debug("Command/Ctrl + L pressed. Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        // Send an event to the renderer to delete the last screenshot
        mainWindow.webContents.send("delete-last-screenshot")
      }
    })

    // Toggle DevTools
    globalShortcut.register("F12", () => {
      runtimeLogger.debug("F12 pressed. Toggling DevTools.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools()
      }
    })

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
