interface Window {
  __IS_INITIALIZED__: boolean
  __CREDITS__: number
  __LANGUAGE__: string
  __AUTH_TOKEN__: string | null
  supabase: Record<string, unknown> // Replace with proper Supabase client type if needed
  electron: Record<string, unknown> // Replace with proper Electron type if needed
  electronAPI: import('./electron').ElectronAPI
}
