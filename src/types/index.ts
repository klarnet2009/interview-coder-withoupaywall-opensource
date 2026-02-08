/**
 * Type definitions for Interview Assistant
 * UX Redesign 2025
 */

import type { ComponentType } from 'react';

// ============================================================================
// Wizard Types
// ============================================================================

export type WizardMode = 'quick' | 'advanced';
export type WizardStep =
  | 'welcome'
  | 'modeselect'
  | 'provider'
  | 'apikey'
  | 'profile'
  | 'mode'
  | 'audio'
  | 'display'
  | 'test'
  | 'ready';

export interface WizardState {
  mode: WizardMode;
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  canProceed: boolean;
}

// ============================================================================
// API Provider Types
// ============================================================================

export type APIProvider = 'openai' | 'gemini' | 'anthropic';

export interface ProviderInfo {
  id: APIProvider;
  name: string;
  description: string;
  recommended?: boolean;
  getKeyUrl: string;
  keyFormat: string;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    description: 'Best for conversational, natural responses. Generous free tier: 60 requests/minute.',
    recommended: true,
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    keyFormat: 'AIzaSy...',
    keyPlaceholder: 'AIzaSy...'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    description: 'Most capable for technical deep-dives. Requires billing setup.',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    keyFormat: 'sk-...',
    keyPlaceholder: 'sk-...'
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Excellent reasoning and analysis capabilities.',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    keyFormat: 'sk-ant-...',
    keyPlaceholder: 'sk-ant-...'
  }
];

// ============================================================================
// User Profile Types
// ============================================================================

export type CommunicationTone = 'formal' | 'professional' | 'casual';
export type AnswerStyle = 'concise' | 'structured' | 'detailed' | 'star' | 'custom';

export interface UserProfile {
  id: string;
  name: string;
  cvText?: string;
  targetRole?: string;
  yearsExperience?: number;
  skills: string[];
  achievements?: string;
  tone: CommunicationTone;
  emphasis?: string;
  avoid?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Interview Mode Types
// ============================================================================

export type InterviewMode = 'coding' | 'behavioral' | 'system_design';
export type DisplayMode = 'standard' | 'overlay' | 'mini' | 'tray';

export interface InterviewPreferences {
  mode: InterviewMode;
  answerStyle: AnswerStyle;
  language: string;
  answerLanguage: string;
  autoDetectLanguage: boolean;
  confidenceHelper: boolean;
}

// ============================================================================
// Audio Types
// ============================================================================

export type AudioSource = 'microphone' | 'system' | 'application';

export interface AudioConfig {
  source: AudioSource;
  applicationName?: string;
  autoStart: boolean;
  testCompleted: boolean;
}

export interface AudioLevel {
  peak: number;
  noiseFloor: number;
  status: 'good' | 'quiet' | 'loud' | 'no_signal';
}

// ============================================================================
// UI/Display Types
// ============================================================================

export interface HotkeyConfig {
  toggle: string;
  pause: string;
  copy: string;
  compact: string;
  emergencyHide: string;
}

export interface DisplayConfig {
  mode: DisplayMode;
  opacity: number;
  stealthMode: boolean;
  hideFromTaskbar: boolean;
  hideTitle: boolean;
  dimOnMouseAway: boolean;
  hotkeys: HotkeyConfig;
}

// ============================================================================
// App Configuration
// ============================================================================

export interface AppConfig {
  // Existing fields
  apiKey: string;
  apiProvider: APIProvider;
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;

  // Wizard
  wizardCompleted: boolean;
  wizardMode?: WizardMode;

  // Debug mode — disables window invisibility for development/testing
  debugMode?: boolean;

  // Profiles
  profiles: UserProfile[];
  activeProfileId?: string;

  // Interview preferences
  interviewPreferences: InterviewPreferences;

  // Audio
  audioConfig: AudioConfig;

  // Display
  displayConfig: DisplayConfig;
}

// Default configuration
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  apiProvider: 'gemini',
  extractionModel: 'gemini-3-flash-preview',
  solutionModel: 'gemini-3-flash-preview',
  debuggingModel: 'gemini-3-flash-preview',
  language: 'python',
  opacity: 1.0,

  wizardCompleted: false,

  profiles: [],

  interviewPreferences: {
    mode: 'coding',
    answerStyle: 'structured',
    language: 'english',
    answerLanguage: 'same',
    autoDetectLanguage: false,
    confidenceHelper: true
  },

  audioConfig: {
    source: 'system',
    autoStart: true,
    testCompleted: false
  },

  displayConfig: {
    mode: 'standard',
    opacity: 1.0,
    stealthMode: false,
    hideFromTaskbar: false,
    hideTitle: false,
    dimOnMouseAway: false,
    hotkeys: {
      toggle: 'Ctrl+B',
      pause: 'N/A',
      copy: 'N/A',
      compact: 'Ctrl+0',
      emergencyHide: 'Ctrl+B'
    }
  }
};

// ============================================================================
// Processing/Status Types
// ============================================================================

export type ProcessingStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'ready'
  | 'error'
  | 'paused';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'rate_limited';

export interface StatusState {
  processing: ProcessingStatus;
  connection: ConnectionStatus;
  provider: APIProvider;
  latency: number;
  language: string;
  audioLevel?: AudioLevel;
  errorMessage?: string;
}

// ============================================================================
// AI Response Types
// ============================================================================

export interface AIResponse {
  id: string;
  content: string;
  style: AnswerStyle;
  timestamp: number;
  processingTime: number;
  tokensUsed?: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  handler?: (responseId: string) => void;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: 'copy', label: 'Copy' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
  { id: 'variants', label: '3 variants' },
  { id: 'star', label: 'STAR format' },
  { id: 'confident', label: 'More confident' },
  { id: 'myvoice', label: 'My voice' }
];

// ============================================================================
// Debug Types
// ============================================================================

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration: number;
  details?: string;
}

export interface DebugLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: unknown;
}

export interface DebugState {
  logs: DebugLog[];
  pipeline: PipelineStep[];
  testInput?: string;
  testOutput?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  date: number;
  company?: string;
  role?: string;
  snippets: SavedSnippet[];
  notes?: string;
}

export interface SavedSnippet {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  tags: string[];
  workspace?: {
    type: 'solution' | 'debug';
    code?: string;
    keyPoints?: string[];
    timeComplexity?: string;
    spaceComplexity?: string;
    issues?: string[];
    fixes?: string[];
    why?: string[];
    verify?: string[];
  };
}

// ============================================================================
// IPC Event Types
// ============================================================================

export interface ProcessingEvents {
  INITIAL_START: 'processing-initial-start';
  PROBLEM_EXTRACTED: 'processing-problem-extracted';
  SOLUTION_SUCCESS: 'processing-solution-success';
  SOLUTION_ERROR: 'processing-solution-error';
  DEBUG_START: 'processing-debug-start';
  DEBUG_SUCCESS: 'processing-debug-success';
  DEBUG_ERROR: 'processing-debug-error';
  API_KEY_INVALID: 'processing-api-key-invalid';
  NO_SCREENSHOTS: 'processing-no-screenshots';
  OUT_OF_CREDITS: 'processing-out-of-credits';
  UNAUTHORIZED: 'processing-unauthorized';
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface StepProps {
  data: Partial<AppConfig>;
  onUpdate: (updates: Partial<AppConfig>) => void;
  onNext: () => void;
  onBack?: () => void;
  isActive: boolean;
  setCanProceed: (can: boolean) => void;
  onSwitchMode?: (mode: 'quick' | 'advanced') => void;
  currentMode?: 'quick' | 'advanced';
}

export interface WizardStepConfig {
  id: WizardStep;
  title: string;
  description: string;
  component: ComponentType<StepProps>;
  required: boolean;
  quickMode: boolean;
}
