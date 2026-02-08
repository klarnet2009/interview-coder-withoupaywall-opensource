/**
 * Type declarations for Electron API
 */

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export type ListeningState = 'idle' | 'connecting' | 'listening' | 'no_signal' | 'transcribing' | 'generating' | 'error';

export interface LiveInterviewStatus {
  state: ListeningState;
  transcript: string;
  response: string;
  audioLevel: number;
  error?: string;
}

export interface ProblemData {
  problem_statement?: string;
  code_block?: string;
  language?: string;
  [key: string]: unknown;
}

export interface SolutionData {
  code?: string;
  explanation?: string;
  language?: string;
  previews?: Array<{ code: string; language: string }>;
  [key: string]: unknown;
}

export interface SessionWorkspaceSnapshot {
  type: "solution" | "debug";
  code?: string;
  keyPoints?: string[];
  timeComplexity?: string;
  spaceComplexity?: string;
  issues?: string[];
  fixes?: string[];
  why?: string[];
  verify?: string[];
}

export interface SessionSnippet {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  tags: string[];
  workspace?: SessionWorkspaceSnapshot;
}

export interface SessionHistoryItem {
  id: string;
  date: number;
  company?: string;
  role?: string;
  notes?: string;
  snippets: SessionSnippet[];
}

export interface InvokeResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  // Config
  getConfig: () => Promise<Record<string, unknown>>;
  updateConfig: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getSystemPromptPreview: () => Promise<{
    hintGenerationPrompt: string;
    transcriptionPrompt: string;
    settings: { interviewMode: string; answerStyle: string; language: string };
  }>;
  getSessionHistory: () => Promise<SessionHistoryItem[]>;
  getSessionHistoryItem: (sessionId: string) => Promise<SessionHistoryItem | null>;
  deleteSessionHistoryItem: (sessionId: string) => Promise<{ success: boolean }>;
  clearSessionHistory: () => Promise<{ success: boolean }>;
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  testApiKey: (apiKey: string, provider?: "openai" | "gemini" | "anthropic") => Promise<{ valid: boolean; error?: string }>;

  // Wizard
  completeWizard: (mode: 'quick' | 'advanced') => Promise<void>;
  resetWizard: () => Promise<void>;
  isWizardCompleted: () => Promise<boolean>;

  // Screenshots
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>;
  getScreenshots: () => Promise<{ path: string; preview: string }[]>;
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteLastScreenshot: () => Promise<void>;
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void;
  onDeleteLastScreenshot: (callback: () => void) => () => void;

  // Processing
  triggerProcessScreenshots: () => Promise<{ success: boolean; error?: string }>;
  triggerReset: () => Promise<InvokeResult>;
  onSolutionSuccess: (callback: (data: SolutionData) => void) => () => void;
  onSolutionError: (callback: (error: string) => void) => () => void;
  onSolutionStart: (callback: () => void) => () => void;
  onDebugStart: (callback: () => void) => () => void;
  onDebugSuccess: (callback: (data: SolutionData) => void) => () => void;
  onDebugError: (callback: (error: string) => void) => () => void;
  onProblemExtracted: (callback: (data: ProblemData) => void) => () => void;
  onProcessingNoScreenshots: (callback: () => void) => () => void;
  onProcessingStatus: (callback: (status: { message: string; progress: number }) => void) => () => void;
  onApiKeyInvalid: (callback: () => void) => () => void;
  onReset: (callback: () => void) => () => void;
  onResetView: (callback: () => void) => () => void;

  // Window management
  toggleMainWindow: () => Promise<InvokeResult>;
  triggerMoveLeft: () => Promise<InvokeResult>;
  triggerMoveRight: () => Promise<InvokeResult>;
  triggerMoveUp: () => Promise<InvokeResult>;
  triggerMoveDown: () => Promise<InvokeResult>;
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>;
  setSetupWindowSize: (dimensions: { width: number; height: number }) => Promise<void>;
  setWindowOpacity: (opacity: number) => Promise<{ success: boolean; opacity?: number; error?: string }>;

  // Settings
  openSettingsPortal: () => Promise<void>;
  onShowSettings: (callback: () => void) => () => void;

  // External links
  openLink: (url: string) => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // Updates
  startUpdate: () => Promise<InvokeResult>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;

  // Audio sources for application selection
  getAudioSources: () => Promise<{ id: string; name: string; appIcon: string | null }[]>;

  // Audio processing
  testAudio: (audioData: { buffer: number[]; mimeType: string; apiKey?: string }) => Promise<{ success: boolean; transcript?: string; error?: string }>;
  transcribeAudio: (audioData: { buffer: number[]; mimeType: string }) => Promise<{ success: boolean; text?: string; timestamp?: number; error?: string }>;
  generateHints: (transcript: string) => Promise<{ success: boolean; hints?: string; error?: string }>;

  // Utility
  getPlatform: () => string;
  removeListener: (eventName: string, callback: (...args: unknown[]) => void) => void;
  clearStore: () => Promise<void>;

  // Legacy compatibility
  onUnauthorized: (callback: () => void) => () => void;

  // Live Interview
  liveInterviewStart: (config?: {
    systemInstruction?: string;
    modelName?: string;
    apiKeyOverride?: string;
    spokenLanguage?: string;
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
  onLiveInterviewStatus: (callback: (status: LiveInterviewStatus) => void) => () => void;
  onLiveInterviewState: (callback: (state: ListeningState) => void) => () => void;
  onLiveInterviewError: (callback: (error: string) => void) => () => void;

  // Window management extras
  quitApp: () => Promise<void>;
  resetWindowSize: () => Promise<void>;

  // Dev mode utilities
  isDev: () => Promise<boolean>;
  toggleStealth: (enable: boolean) => Promise<{ success: boolean; stealth?: boolean; error?: string }>;

  // Window behavior settings
  setAlwaysOnTop: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  setStealthMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
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
