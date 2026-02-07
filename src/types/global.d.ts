interface Window {
  __IS_INITIALIZED__: boolean
  __CREDITS__: number
  __LANGUAGE__: string
  electron: Record<string, unknown> // Replace with proper Electron type if needed
  electronAPI: import('./electron').ElectronAPI
}
