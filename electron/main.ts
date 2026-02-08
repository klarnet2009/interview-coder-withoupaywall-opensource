import { app, BrowserWindow, desktopCapturer, screen, session, shell } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { ProcessingHelper } from "./ProcessingHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { initAutoUpdater } from "./autoUpdater"
import { configHelper } from "./ConfigHelper"
import { createScopedLogger } from "./logger"
import * as dotenv from "dotenv"

// Constants
const isDev = process.env.NODE_ENV === "development"
const runtimeLogger = createScopedLogger("main")

interface ProblemInfo {
  problem_statement?: string
  constraints?: string
  example_input?: string
  example_output?: string
  [key: string]: unknown
}

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as ProcessingHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as ProblemInfo | null,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => ProblemInfo | null
  setProblemInfo: (info: ProblemInfo | null) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: (sourceId?: string) => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: (sourceId?: string) => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  setSetupWindowSize: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: (sourceId?: string) => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step)
  } as IShortcutsHelperDeps)
}

// Auth callback removed as we no longer use Supabase authentication

// Single instance handling is done at the end of the file

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 60
  state.currentY = 50

  // Debug mode: auto-enabled in development (npm run dev), disabled in production
  if (isDev) {
    runtimeLogger.debug('[DEBUG MODE] Window invisibility disabled — window will appear in screen capture');
  }

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: isDev ? 560 : 800,
    height: 600,
    minWidth: isDev ? 520 : 750,
    minHeight: isDev ? 100 : 100,
    x: state.currentX,
    y: 50,
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true
    },
    show: true,
    frame: false,
    transparent: false,
    fullscreenable: false,
    hasShadow: true,
    opacity: 1.0,  // Start with full opacity
    backgroundColor: "#0a0a0a",
    focusable: true,
    skipTaskbar: false,
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // Content protection disabled — stealth mode will be managed server-side in the future
  state.mainWindow.setContentProtection(false);

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    runtimeLogger.debug("Window finished loading")
  })
  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      runtimeLogger.error("Window failed to load:", errorCode, errorDescription)
      if (isDev) {
        // In development, retry loading after a short delay
        runtimeLogger.debug("Retrying to load development server...")
        setTimeout(() => {
          state.mainWindow?.loadURL("http://localhost:54321").catch((error) => {
            runtimeLogger.error("Failed to load dev server on retry:", error)
          })
        }, 1000)
      }
    }
  )

  if (isDev) {
    // In development, load from the dev server
    runtimeLogger.debug("Loading from development server: http://localhost:54321")
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      runtimeLogger.error("Failed to load dev server, falling back to local file:", error)
      // Fallback to local file if dev server is not available
      const indexPath = path.join(__dirname, "../dist/index.html")
      runtimeLogger.debug("Falling back to:", indexPath)
      if (fs.existsSync(indexPath) && state.mainWindow) {
        state.mainWindow.loadFile(indexPath)
      } else {
        runtimeLogger.error("Could not find index.html in dist folder")
      }
    })
  } else {
    // In production, load from the built files
    const indexPath = path.join(__dirname, "../dist/index.html")
    runtimeLogger.debug("Loading production build:", indexPath)

    if (fs.existsSync(indexPath)) {
      state.mainWindow.loadFile(indexPath)
    } else {
      runtimeLogger.error("Could not find index.html in dist folder")
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1)
  // DevTools — always open for debugging
  state.mainWindow.webContents.openDevTools({ mode: 'detach' })
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    runtimeLogger.debug("Attempting to open URL:", url)
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname;
      const allowedHosts = ["google.com", "openai.com", "anthropic.com"];
      if (
        allowedHosts.includes(hostname) ||
        hostname.endsWith(".google.com") ||
        hostname.endsWith(".openai.com") ||
        hostname.endsWith(".anthropic.com")
      ) {
        shell.openExternal(url);
        return { action: "deny" }; // Do not open this URL in a new Electron window
      }
    } catch (error) {
      runtimeLogger.error("Invalid URL in setWindowOpenHandler", { url, error });
      return { action: "deny" }; // Deny access as URL string is malformed or invalid
    }
    return { action: "allow" };
  })

  // Prevent background throttling for uninterrupted audio processing
  state.mainWindow.webContents.setBackgroundThrottling(false)
  state.mainWindow.webContents.setFrameRate(60)

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true

  // Set opacity based on user preferences or hide initially
  // Ensure the window is visible for the first launch or if opacity > 0.1
  const savedOpacity = configHelper.getOpacity();
  runtimeLogger.debug(`Initial opacity from config: ${savedOpacity}`);

  // Always make sure window is shown first
  state.mainWindow.showInactive(); // Use showInactive for consistency

  if (savedOpacity <= 0.1) {
    runtimeLogger.debug('Initial opacity too low, setting to 0 and hiding window');
    state.mainWindow.setOpacity(0);
    state.isWindowVisible = false;
  } else {
    runtimeLogger.debug(`Setting initial opacity to ${savedOpacity}`);
    state.mainWindow.setOpacity(savedOpacity);
    state.isWindowVisible = true;
  }
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Window visibility functions
function hideMainWindow(): void {
  const win = state.mainWindow;
  if (win && !win.isDestroyed()) {
    const bounds = win.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setOpacity(0);
    state.isWindowVisible = false;
    runtimeLogger.debug('Window hidden, opacity set to 0');
  }
}

function showMainWindow(): void {
  const win = state.mainWindow;
  if (win && !win.isDestroyed()) {
    if (state.windowPosition && state.windowSize) {
      win.setBounds({
        ...state.windowPosition,
        ...state.windowSize
      });
    }
    win.setIgnoreMouseEvents(false);
    if (!isDev) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      });
      win.setContentProtection(true);
    }
    win.setOpacity(0); // Set opacity to 0 before showing
    win.showInactive(); // Use showInactive instead of show+focus
    win.setOpacity(1); // Then set opacity to 1 after showing
    state.isWindowVisible = true;
    runtimeLogger.debug('Window shown with showInactive(), opacity set to 1');
  }
}

function toggleMainWindow(): void {
  runtimeLogger.debug(`Toggling window. Current state: ${state.isWindowVisible ? 'visible' : 'hidden'}`);
  if (state.isWindowVisible) {
    hideMainWindow();
  } else {
    showMainWindow();
  }
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  state.currentX = updateFn(state.currentX)
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  )
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const newY = updateFn(state.currentY)
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3

  // Log the current state and limits
  runtimeLogger.debug({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY
  })

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    )
  }
}

// Window dimension functions
function setWindowDimensions(width: number, height: number): void {
  const win = state.mainWindow;
  if (win && !win.isDestroyed()) {
    const [currentX, currentY] = win.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    const maxWidth = Math.floor(workArea.width * 0.25)

    win.setBounds({
      x: Math.min(currentX, workArea.width - maxWidth),
      y: currentY,
      width: Math.min(width + 32, maxWidth),
      height: Math.ceil(height)
    })
  }
}

// Setup-mode window sizing (centered, no width cap)
function setSetupWindowSize(width: number, height: number): void {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  const { workAreaSize } = screen.getPrimaryDisplay();
  const x = Math.round((workAreaSize.width - width) / 2);
  const y = Math.round((workAreaSize.height - height) / 2);
  win.setBounds({ x, y, width, height });
}

// Environment setup
function loadEnvVariables() {
  if (isDev) {
    runtimeLogger.debug("Loading env variables from:", path.join(process.cwd(), ".env"))
    dotenv.config({ path: path.join(process.cwd(), ".env") })
  } else {
    runtimeLogger.debug(
      "Loading env variables from:",
      path.join(process.resourcesPath, ".env")
    )
    dotenv.config({ path: path.join(process.resourcesPath, ".env") })
  }
  runtimeLogger.debug("Environment variables loaded for open-source version")
}

// Initialize application
async function initializeApp() {
  try {
    // Check for single instance
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
      runtimeLogger.debug("Another instance is already running, quitting...")
      app.quit()
      return
    }

    // Handle second instance
    app.on("second-instance", (event, commandLine) => {
      runtimeLogger.debug("second-instance event received:", commandLine)
      if (!state.mainWindow) {
        createWindow()
      } else {
        if (state.mainWindow.isMinimized()) state.mainWindow.restore()
        state.mainWindow.focus()
      }
    })

    // Auth callback handling removed
    app.on("open-url", (event, url) => {
      runtimeLogger.debug("open-url event received:", url)
      event.preventDefault()
    })

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit()
        state.mainWindow = null
      }
    })

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })

    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(app.getPath('appData'), 'interview-coder-v1')
    const sessionPath = path.join(appDataPath, 'session')
    const tempPath = path.join(appDataPath, 'temp')
    const cachePath = path.join(appDataPath, 'cache')

    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    app.setPath('userData', appDataPath)
    app.setPath('sessionData', sessionPath)
    app.setPath('temp', tempPath)
    app.setPath('cache', cachePath)

    loadEnvVariables()

    // Register the interview-coder protocol (after app is ready)
    try {
      if (process.platform === "darwin") {
        app.setAsDefaultProtocolClient("interview-coder")
      } else {
        app.setAsDefaultProtocolClient("interview-coder", process.execPath, [
          path.resolve(process.argv[1] || "")
        ])
      }
    } catch (error) {
      runtimeLogger.error("Failed to register protocol:", error)
    }

    // Allow getDisplayMedia() in renderer for system audio capture
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        // Auto-grant with the entire screen so we get system audio
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        if (sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' })
        } else {
          callback({})
        }
      }
    )

    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      runtimeLogger.debug("No API key found in configuration. User will need to set up.")
    }

    initializeHelpers()
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      setSetupWindowSize,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    await createWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    runtimeLogger.debug(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    runtimeLogger.error("Failed to initialize application:", error)
    app.quit()
  }
}

// App event handlers will be set up after single instance check in initializeApp

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): ProblemInfo | null {
  return state.problemInfo
}

function setProblemInfo(problemInfo: ProblemInfo | null): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(sourceId?: string): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available")
  return (
    state.screenshotHelper?.takeScreenshot(
      () => hideMainWindow(),
      () => showMainWindow(),
      sourceId
    ) || ""
  )
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || ""
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  )
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  setSetupWindowSize,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged
}

// Start the application when Electron is ready
if (app && app.whenReady) {
  app.whenReady().then(initializeApp)
} else {
  runtimeLogger.error("Electron app is not available. Make sure you're running this with Electron.")
  process.exit(1)
}
