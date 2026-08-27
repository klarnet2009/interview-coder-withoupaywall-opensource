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
import { GEMINI_MODELS, resolveGeminiModelId } from "./constants/geminiModels"

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
  education?: { degree: string; institution: string; year?: number }[];
  workHistory?: { title: string; company: string; duration: string; highlights: string[] }[];
  projects?: { name: string; description: string; tech: string[] }[];
  certifications?: string[];
  languages?: { name: string; level: string }[];
  aiSummary?: string;
  cvFilePath?: string;
  cvParsedAt?: number;
  stories?: { title: string; situation: string; action: string; result: string; tags: string[] }[];
  createdAt: number;
  updatedAt: number;
}

interface CompanyContext {
  id: string;
  companyName: string;
  jobTitle?: string;
  jobDescription?: string;
  jobUrl?: string;
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
  responsibilities?: string[];
  companyValues?: string[];
  interviewFocus?: string;
  companyInfo?: string;
  techStack?: string[];
  skillMatch?: { matched: string[]; gaps: string[] };
  talkingPoints?: string[];
  createdAt: number;
  updatedAt: number;
}

interface InterviewPreferences {
  mode: 'coding' | 'behavioral' | 'system_design' | 'programming' | 'general' | 'custom' | string;
  answerStyle: 'concise' | 'structured' | 'detailed' | 'star' | 'custom' | string;
  language: string;
  answerLanguage: string;
  autoDetectLanguage: boolean;
  confidenceHelper: boolean;
  programmingLanguage?: string;
  interviewLevel?: string;
  interviewFocus?: string[] | string;
  customTopic?: string;
  interfaceLanguage?: string;
  responseLength?: string;
  responseStyle?: string;
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
  apiProvider: "openai" | "gemini" | "anthropic" | "custom";
  customBaseUrl?: string;
  customModel?: string;
  temperature?: number;
  reasoningEffort?: "low" | "medium" | "high";
  maxTokens?: number;
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
  companyContexts: CompanyContext[];
  activeCompanyId?: string;

  // Preserved settings fields for direct form bindings and backward compatibility
  interfaceLanguage?: string;
  interviewMode?: string;
  programmingLanguage?: string;
  interviewLevel?: string;
  interviewFocus?: string[] | string;
  customTopic?: string;
  profileName?: string;
  profileExperience?: string | number;
  profileSkills?: string | string[];
  responseStyle?: string;
  responseLength?: string;
  recognitionLanguage?: string;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;

  private defaultConfig: Config = {
    // Existing defaults
    apiKey: "",
    apiProvider: "gemini",
    customBaseUrl: "https://openrouter.ai/api/v1",
    temperature: 0.2,
    reasoningEffort: "medium",
    maxTokens: 4000,
    extractionModel: GEMINI_MODELS.EXTRACTION,
    solutionModel: GEMINI_MODELS.SOLUTION,
    debuggingModel: GEMINI_MODELS.DEBUG,
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
    },
    companyContexts: []
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
   * Validate and sanitize model selection to ensure non-empty model names
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "anthropic" | "custom"): string {
    // Gemini is the migration chokepoint: resolveGeminiModelId runs on EVERY gemini
    // value (not just empty ones) so retired ids persisted in config.json are remapped
    // forward on the next load/save, and unsafe ids never reach a URL path segment.
    if (provider === "gemini") {
      return resolveGeminiModelId(model);
    }
    if (!model || typeof model !== "string" || !model.trim()) {
      if (provider === "openai") return "gpt-4o";
      if (provider === "anthropic") return "claude-3-7-sonnet-20250219";
      return "deepseek/deepseek-r1";
    }
    return model.trim();
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
        extractionModel: config.extractionModel || GEMINI_MODELS.EXTRACTION,
        solutionModel: config.solutionModel || GEMINI_MODELS.SOLUTION,
        debuggingModel: config.debuggingModel || GEMINI_MODELS.DEBUG,
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
    if (!config.companyContexts) {
      (config as Record<string, unknown>).companyContexts = [];
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
          nextUpdates.extractionModel = GEMINI_MODELS.EXTRACTION;
          nextUpdates.solutionModel = GEMINI_MODELS.SOLUTION;
          nextUpdates.debuggingModel = GEMINI_MODELS.DEBUG;
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
      // Map flat settings fields into nested interviewPreferences and keep fields in config
      const anyUpdates = nextUpdates as Record<string, unknown>;
      if (
        anyUpdates.interviewMode !== undefined ||
        anyUpdates.responseStyle !== undefined ||
        anyUpdates.responseLength !== undefined ||
        anyUpdates.programmingLanguage !== undefined ||
        anyUpdates.interviewLevel !== undefined ||
        anyUpdates.interviewFocus !== undefined ||
        anyUpdates.customTopic !== undefined ||
        anyUpdates.recognitionLanguage !== undefined ||
        anyUpdates.interfaceLanguage !== undefined
      ) {
        const prefs: InterviewPreferences = {
          ...(currentConfig.interviewPreferences || this.defaultConfig.interviewPreferences)
        };
        if (anyUpdates.interviewMode !== undefined) prefs.mode = anyUpdates.interviewMode as InterviewPreferences['mode'];
        if (anyUpdates.responseStyle !== undefined) prefs.answerStyle = anyUpdates.responseStyle as InterviewPreferences['answerStyle'];
        if (anyUpdates.recognitionLanguage !== undefined) prefs.language = anyUpdates.recognitionLanguage as string;
        if (anyUpdates.programmingLanguage !== undefined) {
          prefs.programmingLanguage = anyUpdates.programmingLanguage as string;
          if (!nextUpdates.language) {
            nextUpdates.language = anyUpdates.programmingLanguage as string;
          }
        }
        if (anyUpdates.interviewLevel !== undefined) prefs.interviewLevel = anyUpdates.interviewLevel as string;
        if (anyUpdates.interviewFocus !== undefined) prefs.interviewFocus = anyUpdates.interviewFocus as string[] | string;
        if (anyUpdates.customTopic !== undefined) prefs.customTopic = anyUpdates.customTopic as string;
        if (anyUpdates.interfaceLanguage !== undefined) prefs.interfaceLanguage = anyUpdates.interfaceLanguage as string;
        if (anyUpdates.responseLength !== undefined) prefs.responseLength = anyUpdates.responseLength as string;

        nextUpdates.interviewPreferences = prefs;
      }

      // Map audioConfig if provided as a nested object
      if (anyUpdates.audioConfig && typeof anyUpdates.audioConfig === 'object') {
        nextUpdates.audioConfig = {
          ...(currentConfig.audioConfig || {}),
          ...anyUpdates.audioConfig
        } as AudioConfig;
      }

      // Persist profile fields into profiles collection and retain flat fields
      if (
        anyUpdates.profileName !== undefined ||
        anyUpdates.profileExperience !== undefined ||
        anyUpdates.profileSkills !== undefined
      ) {
        const profiles = [...(currentConfig.profiles || [])];
        const activeId = currentConfig.activeProfileId || (profiles.length > 0 ? profiles[0].id : undefined);

        let skillsArray: string[] = [];
        if (Array.isArray(anyUpdates.profileSkills)) {
          skillsArray = anyUpdates.profileSkills as string[];
        } else if (typeof anyUpdates.profileSkills === "string") {
          skillsArray = anyUpdates.profileSkills.split(",").map((s: string) => s.trim()).filter(Boolean);
        }

        const years = typeof anyUpdates.profileExperience === "number"
          ? anyUpdates.profileExperience
          : typeof anyUpdates.profileExperience === "string"
            ? parseInt(anyUpdates.profileExperience, 10) || undefined
            : undefined;

        if (activeId && profiles.length > 0) {
          const idx = profiles.findIndex(p => p.id === activeId);
          if (idx !== -1) {
            profiles[idx] = {
              ...profiles[idx],
              ...(anyUpdates.profileName !== undefined ? { name: String(anyUpdates.profileName) } : {}),
              ...(anyUpdates.profileSkills !== undefined ? { skills: skillsArray } : {}),
              ...(years !== undefined ? { yearsExperience: years } : {}),
              updatedAt: Date.now()
            };
          }
        } else if (anyUpdates.profileName || anyUpdates.profileSkills || anyUpdates.profileExperience) {
          const newProfile: UserProfile = {
            id: `profile_${Date.now()}`,
            name: String(anyUpdates.profileName || "Default"),
            skills: skillsArray,
            yearsExperience: years,
            tone: "professional",
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          profiles.push(newProfile);
          nextUpdates.activeProfileId = newProfile.id;
        }
        nextUpdates.profiles = profiles;
      }

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
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "anthropic" | "custom"): boolean {
    if (provider === "custom") {
      return true;
    }
    if (!apiKey || typeof apiKey !== "string") return false;
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) return false;

    if (!provider) {
      if (trimmed.startsWith('sk-ant-')) {
        provider = "anthropic";
      } else if (trimmed.startsWith('sk-')) {
        provider = "openai";
      } else {
        provider = "gemini";
      }
    }

    if (provider === "openai") {
      return /^sk-[a-zA-Z0-9_-]{20,}$/.test(trimmed);
    } else if (provider === "gemini") {
      return trimmed.length >= 10;
    } else if (provider === "anthropic") {
      return /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(trimmed);
    }

    return false;
  }

  /**
   * Alias for isValidApiKeyFormat
   */
  public validateApiKey(apiKey: string, provider?: "openai" | "gemini" | "anthropic" | "custom"): boolean {
    return this.isValidApiKeyFormat(apiKey, provider);
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
   * Test API key with the selected provider and model
   */
  public async testApiKey(
    apiKey: string,
    provider?: "openai" | "gemini" | "anthropic" | "custom",
    model?: string,
    baseUrl?: string
  ): Promise<{ valid: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
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

    let result: { valid: boolean; error?: string };

    if (provider === "openai") {
      result = await this.testOpenAIKey(apiKey, model);
    } else if (provider === "custom") {
      result = await this.testCustomKey(apiKey, baseUrl, model);
    } else if (provider === "gemini") {
      result = await this.testGeminiKey(apiKey, model);
    } else if (provider === "anthropic") {
      result = await this.testAnthropicKey(apiKey, model);
    } else {
      result = { valid: false, error: "Unknown API provider" };
    }

    return {
      ...result,
      latency: Date.now() - startTime
    };
  }

  /**
   * Test OpenAI API key and model access
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

  private async testOpenAIKey(apiKey: string, model?: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const openai = new OpenAI({ apiKey: apiKey.trim() });
      if (model && (model.startsWith("o1") || model.startsWith("o3"))) {
        await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: "hi" }],
          max_completion_tokens: 5
        });
      } else if (model) {
        await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        });
      } else {
        await openai.models.list();
      }
      return { valid: true };
    } catch (error: unknown) {
      runtimeLogger.error('OpenAI API key test failed:', error);

      let errorMessage = 'Unknown error validating OpenAI API key';
      const status = this.getErrorStatus(error);
      const errorText = this.getErrorMessage(error);

      if (status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (status === 404) {
        errorMessage = `Model '${model}' not found or not accessible on this OpenAI account.`;
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its limit or has insufficient balance.';
      } else if (status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (errorText) {
        errorMessage = `Error: ${errorText}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Custom / OpenAI-compatible endpoint (Ollama, OpenRouter, DeepSeek, Groq)
   */
  private async testCustomKey(apiKey?: string, baseUrl?: string, model?: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const finalBaseUrl = baseUrl?.trim() || "https://openrouter.ai/api/v1";
      const finalKey = apiKey?.trim() || "dummy-key";
      const openai = new OpenAI({
        apiKey: finalKey,
        baseURL: finalBaseUrl,
        timeout: 10000
      });

      if (model) {
        await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        });
      } else {
        await openai.models.list();
      }
      return { valid: true };
    } catch (error: unknown) {
      runtimeLogger.error('Custom endpoint test failed:', error);
      let errorMessage = 'Unable to connect to custom API endpoint';
      const status = this.getErrorStatus(error);
      const errorText = this.getErrorMessage(error);
      const code = this.getErrorCode(error);

      if (status === 401) {
        errorMessage = 'Invalid API key for custom endpoint.';
      } else if (status === 404) {
        errorMessage = `Endpoint or model '${model || ""}' not found on server. Check Base URL and Model name.`;
      } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        errorMessage = 'Connection refused. Ensure local service (Ollama / LM Studio) is running and Base URL is correct.';
      } else if (errorText) {
        errorMessage = `Error: ${errorText}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Gemini API key by making an actual API call
   */
  private async testGeminiKey(apiKey: string, model?: string): Promise<{ valid: boolean, error?: string }> {
    try {
      if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, error: 'Invalid Gemini API key format.' };
      }

      const targetModel = resolveGeminiModelId(model);
      // Make a minimal API call to verify the key and model
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey.trim()}`,
        {
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 5 }
        },
        { timeout: 10000 }
      );

      if (response.status === 200) {
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
        errorMessage = 'Invalid Gemini API key or model permissions. Please check your key.';
      } else if (status === 404) {
        errorMessage = `Gemini model '${model}' not found or deprecated.`;
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
  private async testAnthropicKey(apiKey: string, model?: string): Promise<{ valid: boolean, error?: string }> {
    try {
      if (!apiKey || !/^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(apiKey.trim())) {
        return { valid: false, error: 'Invalid Anthropic API key format. Keys should start with sk-ant-' };
      }

      const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 10000 });
      const targetModel = model || 'claude-3-5-haiku-20241022';

      await client.messages.create({
        model: targetModel,
        max_tokens: 5,
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
      } else if (status === 404) {
        errorMessage = `Anthropic model '${model}' not found or not available.`;
      } else if (status === 429) {
        errorMessage = 'Anthropic API rate limit exceeded. Please try again later.';
      } else if (status === 400) {
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

