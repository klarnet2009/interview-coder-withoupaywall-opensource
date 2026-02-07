/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  clearStore: () => Promise<{ success: boolean; error?: string }>
  getScreenshots: () => Promise<{
    success: boolean
    previews?: Array<{ path: string; preview: string }> | null
    error?: string
  }>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: Record<string, unknown>) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProcessingStatus: (
    callback: (status: { message: string; progress: number }) => void
  ) => () => void
  onProblemExtracted: (callback: (data: Record<string, unknown>) => void) => () => void
  onSolutionSuccess: (callback: (data: Record<string, unknown>) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  openExternal: (url: string) => void
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>
  triggerProcessScreenshots: () => Promise<{ success: boolean; error?: string }>
  triggerReset: () => Promise<{ success: boolean; error?: string }>
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>
  // Add update-related methods
  startUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string }) => void) => () => void
  onUpdateDownloaded: (callback: (info: { version: string; releaseDate?: string }) => void) => () => void
  getSessionHistory: () => Promise<Array<{
    id: string
    date: number
    company?: string
    role?: string
    notes?: string
    snippets: Array<{
      id: string
      question: string
      answer: string
      timestamp: number
      tags: string[]
      workspace?: {
        type: "solution" | "debug"
        code?: string
        keyPoints?: string[]
        timeComplexity?: string
        spaceComplexity?: string
        issues?: string[]
        fixes?: string[]
        why?: string[]
        verify?: string[]
      }
    }>
  }>>
  getSessionHistoryItem: (sessionId: string) => Promise<{
    id: string
    date: number
    snippets: Array<{ id: string; question: string; answer: string; timestamp: number; tags: string[] }>
  } | null>
  deleteSessionHistoryItem: (sessionId: string) => Promise<{ success: boolean }>
  clearSessionHistory: () => Promise<{ success: boolean }>
}

interface Window {
  electronAPI: ElectronAPI
  electron: {
    ipcRenderer: {
      on(channel: string, func: (...args: unknown[]) => void): void
      removeListener(channel: string, func: (...args: unknown[]) => void): void
    }
  }
  __CREDITS__: number
  __LANGUAGE__: string
  __IS_INITIALIZED__: boolean
}
