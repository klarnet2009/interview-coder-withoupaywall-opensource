/**
 * IPC Input Validation Utilities
 * Provides type-safe validation for IPC handler inputs
 */

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Validate that a value is a non-empty string
 */
export function validateString(value: unknown, fieldName: string, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
}): ValidationResult<string> {
    if (typeof value !== 'string') {
        return { success: false, error: `${fieldName} must be a string` };
    }

    if (options?.minLength && value.length < options.minLength) {
        return { success: false, error: `${fieldName} must be at least ${options.minLength} characters` };
    }

    if (options?.maxLength && value.length > options.maxLength) {
        return { success: false, error: `${fieldName} must be at most ${options.maxLength} characters` };
    }

    if (options?.pattern && !options.pattern.test(value)) {
        return { success: false, error: `${fieldName} has invalid format` };
    }

    return { success: true, data: value };
}

/**
 * Validate that a value is a number within optional bounds
 */
export function validateNumber(value: unknown, fieldName: string, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
}): ValidationResult<number> {
    if (typeof value !== 'number' || isNaN(value)) {
        return { success: false, error: `${fieldName} must be a number` };
    }

    if (options?.integer && !Number.isInteger(value)) {
        return { success: false, error: `${fieldName} must be an integer` };
    }

    if (options?.min !== undefined && value < options.min) {
        return { success: false, error: `${fieldName} must be at least ${options.min}` };
    }

    if (options?.max !== undefined && value > options.max) {
        return { success: false, error: `${fieldName} must be at most ${options.max}` };
    }

    return { success: true, data: value };
}

/**
 * Validate that a value is one of allowed enum values
 */
export function validateEnum<T extends string>(
    value: unknown,
    fieldName: string,
    allowedValues: readonly T[]
): ValidationResult<T> {
    if (typeof value !== 'string') {
        return { success: false, error: `${fieldName} must be a string` };
    }

    if (!allowedValues.includes(value as T)) {
        return { success: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
    }

    return { success: true, data: value as T };
}

/**
 * Validate config update object
 */
export interface ConfigUpdateInput {
    apiKey?: string;
    apiProvider?: 'openai' | 'gemini' | 'anthropic';
    extractionModel?: string;
    solutionModel?: string;
    debuggingModel?: string;
    language?: string;
    opacity?: number;
    wizardCompleted?: boolean;
    // Interview preferences (can be sent as flat or nested)
    interviewMode?: string;
    responseStyle?: string;
    responseLength?: string;
    programmingLanguage?: string;
    interviewLevel?: string;
    interviewFocus?: string;
    customTopic?: string;
    recognitionLanguage?: string;
    interfaceLanguage?: string;
    // Profile fields
    profileName?: string;
    profileExperience?: string;
    profileSkills?: string;
    // Nested objects
    interviewPreferences?: Record<string, unknown>;
    audioConfig?: Record<string, unknown>;
}

export function validateConfigUpdate(input: unknown): ValidationResult<ConfigUpdateInput> {
    if (!input || typeof input !== 'object') {
        return { success: false, error: 'Config update must be an object' };
    }

    const obj = input as Record<string, unknown>;
    const result: ConfigUpdateInput = {};

    // Validate apiKey if present
    if (obj.apiKey !== undefined) {
        if (typeof obj.apiKey !== 'string') {
            return { success: false, error: 'apiKey must be a string' };
        }
        result.apiKey = obj.apiKey;
    }

    // Validate apiProvider if present
    if (obj.apiProvider !== undefined) {
        const providers = ['openai', 'gemini', 'anthropic'] as const;
        const validation = validateEnum(obj.apiProvider, 'apiProvider', providers);
        if (!validation.success) return { success: false, error: validation.error };
        result.apiProvider = validation.data;
    }

    // Validate model strings if present
    for (const modelKey of ['extractionModel', 'solutionModel', 'debuggingModel'] as const) {
        if (obj[modelKey] !== undefined) {
            const validation = validateString(obj[modelKey], modelKey, { minLength: 1, maxLength: 100 });
            if (!validation.success) return { success: false, error: validation.error };
            result[modelKey] = validation.data;
        }
    }

    // Validate language if present
    if (obj.language !== undefined) {
        const validation = validateString(obj.language, 'language', { minLength: 1, maxLength: 50 });
        if (!validation.success) return { success: false, error: validation.error };
        result.language = validation.data;
    }

    // Validate opacity if present
    if (obj.opacity !== undefined) {
        const validation = validateNumber(obj.opacity, 'opacity', { min: 0, max: 1 });
        if (!validation.success) return { success: false, error: validation.error };
        result.opacity = validation.data;
    }

    // Validate wizardCompleted if present
    if (obj.wizardCompleted !== undefined) {
        if (typeof obj.wizardCompleted !== 'boolean') {
            return { success: false, error: 'wizardCompleted must be a boolean' };
        }
        result.wizardCompleted = obj.wizardCompleted;
    }

    // Pass through string settings fields
    const stringFields = [
        'interviewMode', 'responseStyle', 'responseLength',
        'programmingLanguage', 'interviewLevel', 'interviewFocus',
        'customTopic', 'recognitionLanguage', 'interfaceLanguage',
        'profileName', 'profileExperience', 'profileSkills'
    ] as const;
    for (const field of stringFields) {
        if (obj[field] !== undefined && typeof obj[field] === 'string') {
            (result as Record<string, unknown>)[field] = obj[field];
        }
    }

    // Pass through nested objects
    if (obj.interviewPreferences !== undefined && typeof obj.interviewPreferences === 'object') {
        result.interviewPreferences = obj.interviewPreferences as Record<string, unknown>;
    }
    if (obj.audioConfig !== undefined && typeof obj.audioConfig === 'object') {
        result.audioConfig = obj.audioConfig as Record<string, unknown>;
    }

    return { success: true, data: result };
}

/**
 * Validate file path (security check with normalization)
 */
export function validateFilePath(value: unknown, fieldName: string): ValidationResult<string> {
    if (typeof value !== 'string') {
        return { success: false, error: `${fieldName} must be a string` };
    }

    // Reject null bytes
    if (value.includes('\0')) {
        return { success: false, error: `${fieldName} contains invalid characters` };
    }

    // Normalize and resolve to catch traversal via encoding tricks
    const path = require('path');
    const resolved = path.resolve(value);

    // Check that resolved path doesn't differ in a suspicious way (traversal attempt)
    if (resolved.includes('..')) {
        return { success: false, error: `${fieldName} contains path traversal` };
    }

    return { success: true, data: resolved };
}

/**
 * Validate that a file path is contained within an allowed directory
 */
export function validateFilePathContained(
    value: unknown,
    fieldName: string,
    allowedDir: string
): ValidationResult<string> {
    const pathResult = validateFilePath(value, fieldName);
    if (!pathResult.success) {
        return pathResult;
    }

    const path = require('path');
    const normalizedAllowed = path.resolve(allowedDir);
    const normalizedPath = pathResult.data!;

    if (!normalizedPath.startsWith(normalizedAllowed + path.sep) && normalizedPath !== normalizedAllowed) {
        return { success: false, error: `${fieldName} is outside allowed directory` };
    }

    return { success: true, data: normalizedPath };
}

/**
 * Validate URL with protocol whitelist
 */
export function validateUrl(value: unknown, fieldName: string): ValidationResult<string> {
    if (typeof value !== 'string') {
        return { success: false, error: `${fieldName} must be a string` };
    }

    try {
        const parsed = new URL(value);
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
            return { success: false, error: `${fieldName} uses disallowed protocol: ${parsed.protocol}` };
        }
        return { success: true, data: value };
    } catch {
        return { success: false, error: `${fieldName} is not a valid URL` };
    }
}
