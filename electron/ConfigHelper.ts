// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import axios from "axios"
import Anthropic from "@anthropic-ai/sdk"
import { OpenAI } from "openai"
// SecureStorage removed — API key is now stored in plain text in config.json
// import { secureStorage } from "./SecureStorage"
import { createScopedLogger } from "./logger"

const runtimeLogger = createScopedLogger("config")

// Extended Config interface for UX Redesign 2025
interface UserProfile {
  id: string;
  name: string;
  cvText?: string;
  targetRole?: string;
  yearsExperience?: number;
  skills: string[];
  achievements?: string;
  tone: 'formal' | 'professional' | 'casual';
  emphasis?: string;
  avoid?: string;
  createdAt: number;
  updatedAt: number;
}

interface InterviewPreferences {
  mode: 'coding' | 'behavioral' | 'system_design';
  answerStyle: 'concise' | 'structured' | 'detailed' | 'star' | 'custom';
  language: string;
  answerLanguage: string;
  autoDetectLanguage: boolean;
  confidenceHelper: boolean;
}

interface AudioConfig {
  source: 'microphone' | 'system' | 'application';
  applicationName?: string;
  autoStart: boolean;
  testCompleted: boolean;
}

interface HotkeyConfig {
  toggle: string;
  pause: string;
  copy: string;
  compact: string;
  emergencyHide: string;
}

interface DisplayConfig {
  mode: 'standard' | 'overlay' | 'mini' | 'tray';
  opacity: number;
  stealthMode: boolean;
  alwaysOnTop: boolean;
  hideFromTaskbar: boolean;
  hideTitle: boolean;
  dimOnMouseAway: boolean;
  hotkeys: HotkeyConfig;
}

interface Config {
  // Existing fields
  apiKey: string;
  apiProvider: "openai" | "gemini" | "anthropic";
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;

  // New fields for UX Redesign 2025
  wizardCompleted: boolean;
  wizardMode?: 'quick' | 'advanced';

  // Debug mode — disables window invisibility for development/testing
  debugMode?: boolean;

  profiles: UserProfile[];
  activeProfileId?: string;

  interviewPreferences: InterviewPreferences;
  audioConfig: AudioConfig;
  displayConfig: DisplayConfig;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;

  private defaultConfig: Config = {
    // Existing defaults
    apiKey: "",
    apiProvider: "gemini",
    extractionModel: "gemini-3-flash-preview",
    solutionModel: "gemini-3-flash-preview",
    debuggingModel: "gemini-3-flash-preview",
    language: "python",
    opacity: 1.0,

    // New defaults
    wizardCompleted: false,
    debugMode: false,
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
      alwaysOnTop: true,
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

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      runtimeLogger.debug('Config path:', this.configPath);
    } catch {
      runtimeLogger.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }

    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  // API key is now stored directly in config.json — no SecureStorage indirection

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      runtimeLogger.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "anthropic"): string {
    if (provider === "openai") {
      const allowedModels = ['gpt-4o', 'gpt-4o-mini'];
      if (!allowedModels.includes(model)) {
        runtimeLogger.warn(`Invalid OpenAI model specified: ${model}. Using default model: gpt-4o`);
        return 'gpt-4o';
      }
      return model;
    } else if (provider === "gemini") {
      // Only Gemini 3 family models (2.5 series)
      const allowedModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
      if (!allowedModels.includes(model)) {
        runtimeLogger.warn(`Invalid Gemini model specified: ${model}. Using default model: gemini-3-flash-preview`);
        return 'gemini-3-flash-preview';
      }
      return model;
    } else if (provider === "anthropic") {
      const allowedModels = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
      if (!allowedModels.includes(model)) {
        runtimeLogger.warn(`Invalid Anthropic model specified: ${model}. Using default model: claude-3-7-sonnet-20250219`);
        return 'claude-3-7-sonnet-20250219';
      }
      return model;
    }
    return model;
  }

  /**
   * Migrate old config format to new format
   */
  private migrateConfig(rawConfig: unknown): Config {
    const config = (
      typeof rawConfig === "object" && rawConfig !== null ? rawConfig : {}
    ) as Partial<Config> & Record<string, unknown>;
    // If wizardCompleted doesn't exist, this is an old config
    if (config.wizardCompleted === undefined) {
      runtimeLogger.debug('Migrating old config format to new format...');

      return {
        ...this.defaultConfig,
        // Preserve existing values
        apiKey: config.apiKey || "",
        apiProvider: config.apiProvider || "gemini",
        extractionModel: config.extractionModel || "gemini-3-flash-preview",
        solutionModel: config.solutionModel || "gemini-3-flash-preview",
        debuggingModel: config.debuggingModel || "gemini-3-flash-preview",
        language: config.language || "python",
        opacity: config.opacity !== undefined ? config.opacity : 1.0,
        // Mark wizard as completed for existing users
        wizardCompleted: true
      };
    }

    // Ensure all nested objects exist (for partial updates)
    if (!config.interviewPreferences) {
      config.interviewPreferences = this.defaultConfig.interviewPreferences;
    }
    if (!config.audioConfig) {
      config.audioConfig = this.defaultConfig.audioConfig;
    }
    if (!config.displayConfig) {
      config.displayConfig = this.defaultConfig.displayConfig;
    }
    if (!config.profiles) {
      config.profiles = [];
    }

    return config as Config;
  }

  /**
   * One-time migration: read API key from old secure-data.json (SecureStorage)
   * Returns the key if found, otherwise undefined
   */
  private migrateFromSecureStorage(): string | undefined {
    try {
      const secureDataPath = path.join(path.dirname(this.configPath), 'secure-data.json');
      if (fs.existsSync(secureDataPath)) {
        const data = fs.readFileSync(secureDataPath, 'utf8');
        const parsed = JSON.parse(data);
        const apiKey = parsed.apiKey;
        if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
          // Clean up old file after successful migration
          try { fs.unlinkSync(secureDataPath); } catch { /* ignore */ }
          runtimeLogger.debug('SecureStorage migration: found and migrated API key');
          return apiKey;
        }
      }
    } catch (err) {
      runtimeLogger.warn('SecureStorage migration failed (non-critical):', err);
    }
    return undefined;
  }

  public loadConfig(): Config {
    try {
      let rawConfig: unknown = { ...this.defaultConfig };
      const backupPath = this.configPath + '.backup';

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        try {
          rawConfig = JSON.parse(configData);
        } catch (parseErr) {
          runtimeLogger.error('Config file is corrupted:', parseErr);
          if (fs.existsSync(backupPath)) {
            try {
              const backupData = fs.readFileSync(backupPath, 'utf8');
              rawConfig = JSON.parse(backupData);
              runtimeLogger.debug('Restored config from backup file');
            } catch (backupErr) {
              runtimeLogger.error('Backup also corrupted, resetting to defaults:', backupErr);
              rawConfig = { ...this.defaultConfig };
            }
          } else {
            rawConfig = { ...this.defaultConfig };
          }
        }
      } else {
        this.saveConfig(this.defaultConfig);
      }

      let config = this.migrateConfig(rawConfig);

      // One-time migration: pull API key from legacy secure-data.json
      if (!config.apiKey || config.apiKey === "[ENCRYPTED]") {
        const migratedKey = this.migrateFromSecureStorage();
        if (migratedKey) {
          config.apiKey = migratedKey;
          runtimeLogger.debug('Migrated API key from secure-data.json to config.json');
        } else if (config.apiKey === "[ENCRYPTED]") {
          config.apiKey = "";
        }
      }

      // Ensure apiProvider is a valid value
      if (config.apiProvider !== "openai" && config.apiProvider !== "gemini" && config.apiProvider !== "anthropic") {
        config.apiProvider = "gemini";
      }

      // Sanitize model selections
      if (config.extractionModel) {
        config.extractionModel = this.sanitizeModelSelection(config.extractionModel, config.apiProvider);
      }
      if (config.solutionModel) {
        config.solutionModel = this.sanitizeModelSelection(config.solutionModel, config.apiProvider);
      }
      if (config.debuggingModel) {
        config.debuggingModel = this.sanitizeModelSelection(config.debuggingModel, config.apiProvider);
      }

      const finalConfig: Config = {
        ...this.defaultConfig,
        ...config,
      };

      return finalConfig;
    } catch (err) {
      runtimeLogger.error("Error loading config:", err);
      try { this.saveConfig({ ...this.defaultConfig }); } catch { /* ignore */ }
      return { ...this.defaultConfig };
    }
  }

  /**
   * Save configuration to disk.
   * API key is stored in plain text — encryption will be handled server-side in a future version.
   */
  public saveConfig(config: Config): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const jsonData = JSON.stringify(config, null, 2);
      const tmpPath = this.configPath + '.tmp';
      const backupPath = this.configPath + '.backup';

      // Backup existing valid config before writing
      if (fs.existsSync(this.configPath)) {
        try {
          const existing = fs.readFileSync(this.configPath, 'utf8');
          JSON.parse(existing); // Verify it's valid JSON
          fs.copyFileSync(this.configPath, backupPath);
        } catch {
          // Existing file is already corrupted — skip backup
        }
      }

      // Atomic write: write to temp file, then rename
      fs.writeFileSync(tmpPath, jsonData);
      fs.renameSync(tmpPath, this.configPath);
    } catch (err) {
      runtimeLogger.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      const nextUpdates: Partial<Config> = { ...updates };
      const incomingApiKey = typeof nextUpdates.apiKey === "string"
        ? nextUpdates.apiKey
        : undefined;
      let provider = nextUpdates.apiProvider || currentConfig.apiProvider;

      // Auto-detect provider based on API key format
      if (incomingApiKey && !nextUpdates.apiProvider) {
        if (incomingApiKey.trim().startsWith('sk-')) {
          if (incomingApiKey.trim().startsWith('sk-ant-')) {
            provider = "anthropic";
            runtimeLogger.debug("Auto-detected Anthropic API key format");
          } else {
            provider = "openai";
            runtimeLogger.debug("Auto-detected OpenAI API key format");
          }
        } else {
          provider = "gemini";
          runtimeLogger.debug("Using Gemini API key format (default)");
        }
        nextUpdates.apiProvider = provider;
      }

      // API key is stored directly in config — no indirection
      // (incomingApiKey stays in nextUpdates and gets saved normally)

      // If provider is changing, reset models
      if (nextUpdates.apiProvider && nextUpdates.apiProvider !== currentConfig.apiProvider) {
        if (nextUpdates.apiProvider === "openai") {
          nextUpdates.extractionModel = "gpt-4o";
          nextUpdates.solutionModel = "gpt-4o";
          nextUpdates.debuggingModel = "gpt-4o";
        } else if (nextUpdates.apiProvider === "anthropic") {
          nextUpdates.extractionModel = "claude-3-7-sonnet-20250219";
          nextUpdates.solutionModel = "claude-3-7-sonnet-20250219";
          nextUpdates.debuggingModel = "claude-3-7-sonnet-20250219";
        } else {
          nextUpdates.extractionModel = "gemini-3-flash-preview";
          nextUpdates.solutionModel = "gemini-3-flash-preview";
          nextUpdates.debuggingModel = "gemini-3-flash-preview";
        }
      }

      // Sanitize model selections
      if (nextUpdates.extractionModel) {
        nextUpdates.extractionModel = this.sanitizeModelSelection(nextUpdates.extractionModel, provider);
      }
      if (nextUpdates.solutionModel) {
        nextUpdates.solutionModel = this.sanitizeModelSelection(nextUpdates.solutionModel, provider);
      }
      if (nextUpdates.debuggingModel) {
        nextUpdates.debuggingModel = this.sanitizeModelSelection(nextUpdates.debuggingModel, provider);
      }
      // Map flat settings fields into nested interviewPreferences
      const anyUpdates = nextUpdates as Record<string, unknown>;
      if (anyUpdates.interviewMode || anyUpdates.responseStyle || anyUpdates.responseLength ||
        anyUpdates.programmingLanguage || anyUpdates.interviewLevel || anyUpdates.interviewFocus ||
        anyUpdates.customTopic || anyUpdates.recognitionLanguage || anyUpdates.interfaceLanguage) {
        const prefs = { ...(currentConfig.interviewPreferences || {}) };
        if (anyUpdates.interviewMode) prefs.mode = anyUpdates.interviewMode as InterviewPreferences['mode'];
        if (anyUpdates.responseStyle) prefs.answerStyle = anyUpdates.responseStyle as InterviewPreferences['answerStyle'];
        if (anyUpdates.recognitionLanguage) prefs.language = anyUpdates.recognitionLanguage as string;
        nextUpdates.interviewPreferences = prefs as InterviewPreferences;

        // Clean up flat fields so they don't pollute the config
        delete anyUpdates.interviewMode;
        delete anyUpdates.responseStyle;
        delete anyUpdates.responseLength;
        delete anyUpdates.programmingLanguage;
        delete anyUpdates.interviewLevel;
        delete anyUpdates.interviewFocus;
        delete anyUpdates.customTopic;
        delete anyUpdates.recognitionLanguage;
        delete anyUpdates.interfaceLanguage;
      }

      // Map audioConfig if provided as a nested object
      if (anyUpdates.audioConfig && typeof anyUpdates.audioConfig === 'object') {
        nextUpdates.audioConfig = {
          ...(currentConfig.audioConfig || {}),
          ...anyUpdates.audioConfig
        } as AudioConfig;
      }

      // Clean up profile flat fields
      delete anyUpdates.profileName;
      delete anyUpdates.profileExperience;
      delete anyUpdates.profileSkills;

      const newConfig: Config = {
        ...currentConfig,
        ...nextUpdates,
      };
      this.saveConfig(newConfig);

      // Emit update event for non-opacity changes
      if (incomingApiKey !== undefined || nextUpdates.apiProvider !== undefined ||
        nextUpdates.extractionModel !== undefined || nextUpdates.solutionModel !== undefined ||
        nextUpdates.debuggingModel !== undefined || nextUpdates.language !== undefined ||
        nextUpdates.wizardCompleted !== undefined || nextUpdates.profiles !== undefined) {
        this.emit('config-updated', newConfig);
      }

      return newConfig;
    } catch (error) {
      runtimeLogger.error('Error updating config:', error);
      return { ...this.defaultConfig };
    }
  }

  /**
   * Mark wizard as completed
   */
  public completeWizard(mode: 'quick' | 'advanced'): void {
    this.updateConfig({
      wizardCompleted: true,
      wizardMode: mode
    });
    this.emit('wizard-completed', mode);
  }

  /**
   * Reset wizard (for testing or if user wants to re-run)
   */
  public resetWizard(): void {
    this.updateConfig({ wizardCompleted: false });
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return typeof config.apiKey === 'string' && config.apiKey.trim().length > 0;
  }

  /**
   * Check if wizard has been completed
   */
  public isWizardCompleted(): boolean {
    const config = this.loadConfig();
    return config.wizardCompleted;
  }

  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "anthropic"): boolean {
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
        } else {
          provider = "openai";
        }
      } else {
        provider = "gemini";
      }
    }

    if (provider === "openai") {
      return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "gemini") {
      return apiKey.trim().length >= 10;
    } else if (provider === "anthropic") {
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    }

    return false;
  }

  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value (targeted update — does NOT go through
   * updateConfig to avoid accidentally clobbering other fields)
   */
  public setOpacity(opacity: number): void {
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    try {
      // Read existing config directly from disk
      let config: Record<string, unknown> = {};
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(raw);
      }
      // Update only opacity
      config.opacity = validOpacity;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      runtimeLogger.error('Error setting opacity:', err);
    }
  }

  /**
   * Get display config
   */
  public getDisplayConfig(): DisplayConfig {
    const config = this.loadConfig();
    return config.displayConfig || this.defaultConfig.displayConfig;
  }

  /**
   * Update display config
   */
  public updateDisplayConfig(updates: Partial<DisplayConfig>): void {
    const config = this.loadConfig();
    const newDisplayConfig = { ...config.displayConfig, ...updates };
    this.updateConfig({ displayConfig: newDisplayConfig });
  }

  /**
   * Get interview preferences
   */
  public getInterviewPreferences(): InterviewPreferences {
    const config = this.loadConfig();
    return config.interviewPreferences || this.defaultConfig.interviewPreferences;
  }

  /**
   * Update interview preferences
   */
  public updateInterviewPreferences(updates: Partial<InterviewPreferences>): void {
    const config = this.loadConfig();
    const newPreferences = { ...config.interviewPreferences, ...updates };
    this.updateConfig({ interviewPreferences: newPreferences });
  }

  /**
   * Get audio config
   */
  public getAudioConfig(): AudioConfig {
    const config = this.loadConfig();
    return config.audioConfig || this.defaultConfig.audioConfig;
  }

  /**
   * Update audio config
   */
  public updateAudioConfig(updates: Partial<AudioConfig>): void {
    const config = this.loadConfig();
    const newAudioConfig = { ...config.audioConfig, ...updates };
    this.updateConfig({ audioConfig: newAudioConfig });
  }

  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }

  // ============================================================================
  // Profile Management
  // ============================================================================

  /**
   * Get all profiles
   */
  public getProfiles(): UserProfile[] {
    const config = this.loadConfig();
    return config.profiles || [];
  }

  /**
   * Get active profile
   */
  public getActiveProfile(): UserProfile | null {
    const config = this.loadConfig();
    if (!config.activeProfileId) return null;
    return config.profiles.find(p => p.id === config.activeProfileId) || null;
  }

  /**
   * Create a new profile
   */
  public createProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): UserProfile {
    const config = this.loadConfig();
    const newProfile: UserProfile = {
      ...profile,
      id: `profile_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const profiles = [...config.profiles, newProfile];
    this.updateConfig({ profiles });

    // If this is the first profile, set it as active
    if (profiles.length === 1) {
      this.setActiveProfile(newProfile.id);
    }

    return newProfile;
  }

  /**
   * Update a profile
   */
  public updateProfile(id: string, updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): UserProfile | null {
    const config = this.loadConfig();
    const profileIndex = config.profiles.findIndex(p => p.id === id);

    if (profileIndex === -1) return null;

    const updatedProfile: UserProfile = {
      ...config.profiles[profileIndex],
      ...updates,
      updatedAt: Date.now()
    };

    const profiles = [...config.profiles];
    profiles[profileIndex] = updatedProfile;
    this.updateConfig({ profiles });

    return updatedProfile;
  }

  /**
   * Delete a profile
   */
  public deleteProfile(id: string): boolean {
    const config = this.loadConfig();
    const profiles = config.profiles.filter(p => p.id !== id);

    if (profiles.length === config.profiles.length) return false;

    const updates: Partial<Config> = { profiles };

    // If deleted profile was active, clear activeProfileId
    if (config.activeProfileId === id) {
      updates.activeProfileId = profiles.length > 0 ? profiles[0].id : undefined;
    }

    this.updateConfig(updates);
    return true;
  }

  /**
   * Set active profile
   */
  public setActiveProfile(id: string): boolean {
    const config = this.loadConfig();
    const profile = config.profiles.find(p => p.id === id);

    if (!profile) return false;

    this.updateConfig({ activeProfileId: id });
    return true;
  }

  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: "openai" | "gemini" | "anthropic"): Promise<{ valid: boolean, error?: string }> {
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          runtimeLogger.debug("Auto-detected Anthropic API key format for testing");
        } else {
          provider = "openai";
          runtimeLogger.debug("Auto-detected OpenAI API key format for testing");
        }
      } else {
        provider = "gemini";
        runtimeLogger.debug("Using Gemini API key format for testing (default)");
      }
    }

    if (provider === "openai") {
      return this.testOpenAIKey(apiKey);
    } else if (provider === "gemini") {
      return this.testGeminiKey(apiKey);
    } else if (provider === "anthropic") {
      return this.testAnthropicKey(apiKey);
    }

    return { valid: false, error: "Unknown API provider" };
  }

  /**
   * Test OpenAI API key
   */
  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }
    const maybeError = error as { status?: number; response?: { status?: number } };
    return maybeError.status ?? maybeError.response?.status;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }
    const maybeError = error as { code?: string };
    return maybeError.code;
  }

  private getErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.message;
    }
    return undefined;
  }

  private async testOpenAIKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return { valid: true };
    } catch (error: unknown) {
      runtimeLogger.error('OpenAI API key test failed:', error);

      let errorMessage = 'Unknown error validating OpenAI API key';
      const status = this.getErrorStatus(error);
      const errorText = this.getErrorMessage(error);

      if (status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (errorText) {
        errorMessage = `Error: ${errorText}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Gemini API key by making an actual API call
   */
  private async testGeminiKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      if (!apiKey || apiKey.trim().length < 20) {
        return { valid: false, error: 'Invalid Gemini API key format.' };
      }

      // Make an actual API call to verify the key works
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`,
        { timeout: 10000 }
      );

      if (response.status === 200 && response.data?.models) {
        return { valid: true };
      }

      return { valid: false, error: 'Unable to verify Gemini API key.' };
    } catch (error: unknown) {
      runtimeLogger.error('Gemini API key test failed:', error);

      let errorMessage = 'Unknown error validating Gemini API key';
      const status = this.getErrorStatus(error);
      const code = this.getErrorCode(error);
      const errorText = this.getErrorMessage(error);

      if (status === 400 || status === 403) {
        errorMessage = 'Invalid Gemini API key. Please check your key and try again.';
      } else if (status === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
      } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        errorMessage = 'Unable to connect to Gemini API. Check your internet connection.';
      } else if (errorText) {
        errorMessage = `Error: ${errorText}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Anthropic API key by making an actual API call
   */
  private async testAnthropicKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      if (!apiKey || !/^sk-ant-[a-zA-Z0-9-_]{32,}$/.test(apiKey.trim())) {
        return { valid: false, error: 'Invalid Anthropic API key format. Keys should start with sk-ant-' };
      }

      const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 10000 });

      // Make a minimal API call to verify the key works
      // Using a very short prompt to minimize token usage
      await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }]
      });

      return { valid: true };
    } catch (error: unknown) {
      runtimeLogger.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';
      const status = this.getErrorStatus(error);
      const code = this.getErrorCode(error);
      const errorText = this.getErrorMessage(error);

      if (status === 401) {
        errorMessage = 'Invalid Anthropic API key. Please check your key and try again.';
      } else if (status === 429) {
        errorMessage = 'Anthropic API rate limit exceeded. Please try again later.';
      } else if (status === 400) {
        // Bad request but key is valid
        return { valid: true };
      } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        errorMessage = 'Unable to connect to Anthropic API. Check your internet connection.';
      } else if (errorText) {
        errorMessage = `Error: ${errorText}`;
      }

      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
