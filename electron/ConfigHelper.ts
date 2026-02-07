// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"
// SecureStorage removed — using raw JSON config for now
// Server-side config management will be added later

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

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }

    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "anthropic"): string {
    if (provider === "openai") {
      const allowedModels = ['gpt-4o', 'gpt-4o-mini'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid OpenAI model specified: ${model}. Using default model: gpt-4o`);
        return 'gpt-4o';
      }
      return model;
    } else if (provider === "gemini") {
      // Only Gemini 3 family models (2.5 series)
      const allowedModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Gemini model specified: ${model}. Using default model: gemini-3-flash-preview`);
        return 'gemini-3-flash-preview';
      }
      return model;
    } else if (provider === "anthropic") {
      const allowedModels = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Anthropic model specified: ${model}. Using default model: claude-3-7-sonnet-20250219`);
        return 'claude-3-7-sonnet-20250219';
      }
      return model;
    }
    return model;
  }

  /**
   * Migrate old config format to new format
   */
  private migrateConfig(config: any): Config {
    // If wizardCompleted doesn't exist, this is an old config
    if (config.wizardCompleted === undefined) {
      console.log('Migrating old config format to new format...');

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
          try { fs.unlinkSync(secureDataPath); } catch (_) { /* ignore */ }
          console.log('SecureStorage migration: found and migrated API key');
          return apiKey;
        }
      }
    } catch (err) {
      console.warn('SecureStorage migration failed (non-critical):', err);
    }
    return undefined;
  }

  public loadConfig(): Config {
    try {
      console.log('=== LOAD CONFIG DEBUG ===');
      console.log('Config path:', this.configPath);
      console.log('Config file exists:', fs.existsSync(this.configPath));

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        let config: any;

        try {
          config = JSON.parse(configData);
        } catch (parseErr) {
          // Config file is corrupted — auto-reset to defaults
          console.error('Config file is corrupted, resetting to defaults:', parseErr);
          this.saveConfig(this.defaultConfig);
          return { ...this.defaultConfig };
        }

        console.log('Loaded config - apiKey exists:', !!config.apiKey && config.apiKey.length > 0 && config.apiKey !== '[ENCRYPTED]');
        console.log('Loaded config - apiProvider:', config.apiProvider);

        // Migrate if needed
        config = this.migrateConfig(config);

        // One-time migration: pull API key from old secure-data.json if present
        if ((!config.apiKey || config.apiKey === '' || config.apiKey === '[ENCRYPTED]')) {
          const migratedKey = this.migrateFromSecureStorage();
          if (migratedKey) {
            config.apiKey = migratedKey;
            console.log('Migrated API key from secure-data.json to raw config');
          }
        }

        // Clear legacy placeholder
        if (config.apiKey === '[ENCRYPTED]') {
          config.apiKey = '';
        }
        console.log('=========================');

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

        return {
          ...this.defaultConfig,
          ...config
        };
      }

      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return { ...this.defaultConfig };
    } catch (err) {
      console.error("Error loading config:", err);
      // Critical failure — reset file on disk so next start is clean
      try { this.saveConfig(this.defaultConfig); } catch (_) { /* ignore */ }
      return { ...this.defaultConfig };
    }
  }

  /**
   * Save configuration to disk
   * Raw JSON — API key stored directly (server-side config coming later)
   */
  public saveConfig(config: Config): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Debug logging
      console.log('=== SAVE CONFIG DEBUG ===');
      console.log('Config path:', this.configPath);
      console.log('API key provided:', config.apiKey ? `Yes (${config.apiKey.substring(0, 8)}...)` : 'No');
      console.log('API provider:', config.apiProvider);
      console.log('Extraction model:', config.extractionModel);

      // Store everything directly in JSON (raw config mode)
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('Config file saved successfully');
      console.log('=========================');
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider = updates.apiProvider || currentConfig.apiProvider;

      // Auto-detect provider based on API key format
      if (updates.apiKey && !updates.apiProvider) {
        if (updates.apiKey.trim().startsWith('sk-')) {
          if (updates.apiKey.trim().startsWith('sk-ant-')) {
            provider = "anthropic";
            console.log("Auto-detected Anthropic API key format");
          } else {
            provider = "openai";
            console.log("Auto-detected OpenAI API key format");
          }
        } else {
          provider = "gemini";
          console.log("Using Gemini API key format (default)");
        }
        updates.apiProvider = provider;
      }

      // If provider is changing, reset models
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        if (updates.apiProvider === "openai") {
          updates.extractionModel = "gpt-4o";
          updates.solutionModel = "gpt-4o";
          updates.debuggingModel = "gpt-4o";
        } else if (updates.apiProvider === "anthropic") {
          updates.extractionModel = "claude-3-7-sonnet-20250219";
          updates.solutionModel = "claude-3-7-sonnet-20250219";
          updates.debuggingModel = "claude-3-7-sonnet-20250219";
        } else {
          updates.extractionModel = "gemini-3-flash-preview";
          updates.solutionModel = "gemini-3-flash-preview";
          updates.debuggingModel = "gemini-3-flash-preview";
        }
      }

      // Sanitize model selections
      if (updates.extractionModel) {
        updates.extractionModel = this.sanitizeModelSelection(updates.extractionModel, provider);
      }
      if (updates.solutionModel) {
        updates.solutionModel = this.sanitizeModelSelection(updates.solutionModel, provider);
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = this.sanitizeModelSelection(updates.debuggingModel, provider);
      }

      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);

      // Emit update event for non-opacity changes
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined ||
        updates.extractionModel !== undefined || updates.solutionModel !== undefined ||
        updates.debuggingModel !== undefined || updates.language !== undefined ||
        updates.wizardCompleted !== undefined || updates.profiles !== undefined) {
        this.emit('config-updated', newConfig);
      }

      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
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
    return !!config.apiKey && config.apiKey.trim().length > 0;
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
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
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
          console.log("Auto-detected Anthropic API key format for testing");
        } else {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format for testing");
        }
      } else {
        provider = "gemini";
        console.log("Using Gemini API key format for testing (default)");
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
  private async testOpenAIKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);

      let errorMessage = 'Unknown error validating OpenAI API key';

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
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
      const axios = require('axios');
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`,
        { timeout: 10000 }
      );

      if (response.status === 200 && response.data?.models) {
        return { valid: true };
      }

      return { valid: false, error: 'Unable to verify Gemini API key.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);

      let errorMessage = 'Unknown error validating Gemini API key';

      if (error.response?.status === 400 || error.response?.status === 403) {
        errorMessage = 'Invalid Gemini API key. Please check your key and try again.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Unable to connect to Gemini API. Check your internet connection.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
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

      // Use the Anthropic SDK that's already a dependency
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 10000 });

      // Make a minimal API call to verify the key works
      // Using a very short prompt to minimize token usage
      await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }]
      });

      return { valid: true };
    } catch (error: any) {
      console.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';

      if (error.status === 401) {
        errorMessage = 'Invalid Anthropic API key. Please check your key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Anthropic API rate limit exceeded. Please try again later.';
      } else if (error.status === 400) {
        // Bad request but key is valid
        return { valid: true };
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Unable to connect to Anthropic API. Check your internet connection.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
