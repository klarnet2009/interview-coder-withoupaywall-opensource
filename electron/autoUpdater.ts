import { autoUpdater } from "electron-updater"
import { BrowserWindow, ipcMain, app } from "electron"
import log from "electron-log"
import { createScopedLogger } from "./logger"

const runtimeLogger = createScopedLogger("autoUpdater")

export function initAutoUpdater() {
  runtimeLogger.info("Initializing auto-updater...")

  // Skip update checks in development
  if (!app.isPackaged) {
    runtimeLogger.info("Skipping auto-updater in development mode")
    return
  }

  if (!process.env.GH_TOKEN) {
    runtimeLogger.error("GH_TOKEN environment variable is not set")
    return
  }

  // Configure auto updater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = true
  autoUpdater.allowPrerelease = true

  // Enable more verbose logging
  autoUpdater.logger = log
  log.transports.file.level = "debug"
  runtimeLogger.info(
    "Auto-updater logger configured with level:",
    log.transports.file.level
  )

  // Log all update events
  autoUpdater.on("checking-for-update", () => {
    runtimeLogger.info("Checking for updates...")
  })

  autoUpdater.on("update-available", (info) => {
    runtimeLogger.info("Update available:", info)
    // Notify renderer process about available update
    BrowserWindow.getAllWindows().forEach((window) => {
      runtimeLogger.info("Sending update-available to window")
      window.webContents.send("update-available", info)
    })
  })

  autoUpdater.on("update-not-available", (info) => {
    runtimeLogger.info("Update not available:", info)
  })

  autoUpdater.on("download-progress", (progressObj) => {
    runtimeLogger.info("Download progress:", progressObj)
  })

  autoUpdater.on("update-downloaded", (info) => {
    runtimeLogger.info("Update downloaded:", info)
    // Notify renderer process that update is ready to install
    BrowserWindow.getAllWindows().forEach((window) => {
      runtimeLogger.info("Sending update-downloaded to window")
      window.webContents.send("update-downloaded", info)
    })
  })

  autoUpdater.on("error", (err) => {
    runtimeLogger.error("Auto updater error:", err)
  })

  // Check for updates immediately
  runtimeLogger.info("Checking for updates...")
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      runtimeLogger.info("Update check result:", result)
    })
    .catch((err) => {
      runtimeLogger.error("Error checking for updates:", err)
    })

  // Set up update checking interval (every 1 hour)
  setInterval(() => {
    runtimeLogger.info("Checking for updates (interval)...")
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        runtimeLogger.info("Update check result (interval):", result)
      })
      .catch((err) => {
        runtimeLogger.error("Error checking for updates (interval):", err)
      })
  }, 60 * 60 * 1000)

  // Handle IPC messages from renderer
  ipcMain.handle("start-update", async () => {
    runtimeLogger.info("Start update requested")
    try {
      await autoUpdater.downloadUpdate()
      runtimeLogger.info("Update download completed")
      return { success: true }
    } catch (error) {
      runtimeLogger.error("Failed to start update:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle("install-update", () => {
    runtimeLogger.info("Install update requested")
    autoUpdater.quitAndInstall()
  })
}
