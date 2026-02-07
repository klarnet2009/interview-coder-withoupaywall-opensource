/**
 * Type declarations for Electron API
 */

export interface ElectronAPI {
  // Config
  getConfig: () => Promise<any>;
  updateConfig: (config: any) => Promise<any>;
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  testApiKey: (apiKey: string, provider?: "openai" | "gemini" | "anthropic") => Promise<{ valid: boolean; error?: string }>;

  // Wizard
  completeWizard: (mode: 'quick' | 'advanced') => Promise<any>;
  resetWizard: () => Promise<any>;
  isWizardCompleted: () => Promise<boolean>;

  // Screenshots
  triggerScreenshot: () => Promise<any>;
  getScreenshots: () => Promise<any>;
  deleteScreenshot: (path: string) => Promise<any>;
  deleteLastScreenshot: () => Promise<any>;
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void;
  onDeleteLastScreenshot: (callback: () => void) => () => void;

  // Processing
  triggerProcessScreenshots: () => Promise<any>;
  triggerReset: () => Promise<any>;
  onSolutionSuccess: (callback: (data: any) => void) => () => void;
  onSolutionError: (callback: (error: string) => void) => () => void;
  onSolutionStart: (callback: () => void) => () => void;
  onDebugStart: (callback: () => void) => () => void;
  onDebugSuccess: (callback: (data: any) => void) => () => void;
  onDebugError: (callback: (error: string) => void) => () => void;
  onProblemExtracted: (callback: (data: any) => void) => () => void;
  onProcessingNoScreenshots: (callback: () => void) => () => void;
  onApiKeyInvalid: (callback: () => void) => () => void;
  onReset: (callback: () => void) => () => void;
  onResetView: (callback: () => void) => () => void;

  // Window management
  toggleMainWindow: () => Promise<any>;
  triggerMoveLeft: () => Promise<any>;
  triggerMoveRight: () => Promise<any>;
  triggerMoveUp: () => Promise<any>;
  triggerMoveDown: () => Promise<any>;
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<any>;
  setWindowOpacity: (opacity: number) => Promise<{ success: boolean; opacity?: number; error?: string }>;

  // Settings
  openSettingsPortal: () => Promise<any>;
  onShowSettings: (callback: () => void) => () => void;

  // External links
  openLink: (url: string) => void;
  openExternal: (url: string) => Promise<any>;

  // Updates
  startUpdate: () => Promise<any>;
  installUpdate: () => Promise<any>;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => () => void;

  // Credits
  decrementCredits: () => Promise<any>;

  // Audio sources for application selection
  getAudioSources: () => Promise<{ id: string; name: string; appIcon: string | null }[]>;

  // Audio processing
  testAudio: (audioData: { buffer: number[]; mimeType: string; apiKey?: string }) => Promise<{ success: boolean; transcript?: string; error?: string }>;
  transcribeAudio: (audioData: { buffer: number[]; mimeType: string }) => Promise<{ success: boolean; text?: string; timestamp?: number; error?: string }>;
  generateHints: (transcript: string) => Promise<{ success: boolean; hints?: string; error?: string }>;

  onCreditsUpdated: (callback: (credits: number) => void) => () => void;

  // Utility
  getPlatform: () => string;
  removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
  clearStore: () => Promise<any>;

  // Legacy
  openSubscriptionPortal: (authData: { id: string; email: string }) => Promise<any>;
  onSubscriptionUpdated: (callback: () => void) => () => void;
  onSubscriptionPortalClosed: (callback: () => void) => () => void;
  onUnauthorized: (callback: () => void) => () => void;
  onOutOfCredits: (callback: () => void) => () => void;

  // Live Interview
  liveInterviewStart: (config?: {
    systemInstruction?: string;
    modelName?: string;
    apiKeyOverride?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  liveInterviewStop: () => Promise<{ success: boolean; error?: string }>;
  liveInterviewStatus: () => Promise<{
    state: string;
    transcript: string;
    response: string;
    audioLevel: number;
  }>;
  liveInterviewSendText: (text: string) => Promise<{ success: boolean; error?: string }>;
  liveInterviewSendAudio: (pcmBase64: string, level: number) => Promise<{ success: boolean }>;
  onLiveInterviewStatus: (callback: (status: any) => void) => () => void;
  onLiveInterviewState: (callback: (state: string) => void) => () => void;
  onLiveInterviewError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __CREDITS__: number;
    __LANGUAGE__: string;
    __IS_INITIALIZED__: boolean;
  }
}

export { };
