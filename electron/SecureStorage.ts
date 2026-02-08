/**
 * SecureStorage - Encrypts sensitive data using Electron's safeStorage API
 * Falls back to plain text storage if safeStorage is not available
 */

import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

interface SecureData {
    [key: string]: string;
}

export class SecureStorage {
    private filePath: string;
    private cache: SecureData = {};
    private initialized: boolean = false;

    constructor(filename: string = 'secure-data.json') {
        this.filePath = path.join(app.getPath('userData'), filename);
        this.load();
    }

    /**
     * Check if encryption is available on this system
     */
    public isEncryptionAvailable(): boolean {
        try {
            return safeStorage.isEncryptionAvailable();
        } catch {
            return false;
        }
    }

    /**
     * Get the storage backend being used (for diagnostics)
     */
    public getBackend(): string {
        try {
            if (typeof safeStorage.getSelectedStorageBackend === 'function') {
                return safeStorage.getSelectedStorageBackend();
            }
            return this.isEncryptionAvailable() ? 'encrypted' : 'plaintext';
        } catch {
            return 'unknown';
        }
    }

    /**
     * Load encrypted data from disk
     */
    private load(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const fileContent = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(fileContent);
                log.info('SecureStorage: Loading from', this.filePath);
                log.info('SecureStorage: Encryption available:', this.isEncryptionAvailable());
                log.info('SecureStorage: Backend:', this.getBackend());

                // Decrypt each value
                for (const key in parsed) {
                    try {
                        if (parsed[key] && this.isEncryptionAvailable()) {
                            const buffer = Buffer.from(parsed[key], 'base64');
                            log.info(`SecureStorage: Decrypting key "${key}", buffer length: ${buffer.length}`);
                            this.cache[key] = safeStorage.decryptString(buffer);
                            log.info(`SecureStorage: Decrypted "${key}" successfully, length: ${this.cache[key].length}`);
                        } else {
                            // Fallback: stored as plain text
                            log.info(`SecureStorage: Reading "${key}" as plain text (encryption not available or empty value)`);
                            this.cache[key] = parsed[key];
                        }
                    } catch (err) {
                        log.warn(`SecureStorage: Failed to decrypt key "${key}":`, err);
                        log.warn(`SecureStorage: Raw value for "${key}":`, parsed[key]?.substring(0, 30) + '...');
                        // Don't use corrupted data
                        this.cache[key] = '';
                    }
                }
            }
            this.initialized = true;
        } catch (err) {
            log.error('Failed to load secure storage:', err);
            this.cache = {};
            this.initialized = true;
        }
    }

    /**
     * Save encrypted data to disk
     */
    private save(): void {
        try {
            const encrypted: { [key: string]: string } = {};
            log.info('SecureStorage: Saving to', this.filePath);
            log.info('SecureStorage: Encryption available:', this.isEncryptionAvailable());

            for (const key in this.cache) {
                if (this.cache[key]) {
                    if (this.isEncryptionAvailable()) {
                        const buffer = safeStorage.encryptString(this.cache[key]);
                        encrypted[key] = buffer.toString('base64');
                        log.info(`SecureStorage: Encrypted "${key}", original length: ${this.cache[key].length}, encrypted length: ${encrypted[key].length}`);
                    } else {
                        // Fallback: store as plain text (with warning)
                        log.warn('safeStorage not available, storing data without encryption');
                        encrypted[key] = this.cache[key];
                    }
                }
            }

            fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));
            log.info('SecureStorage: Saved successfully');
        } catch (err) {
            log.error('Failed to save secure storage:', err);
        }
    }

    /**
     * Store a sensitive value (encrypted if possible)
     */
    public set(key: string, value: string): void {
        this.cache[key] = value;
        this.save();
    }

    /**
     * Retrieve a sensitive value
     */
    public get(key: string): string | undefined {
        return this.cache[key];
    }

    /**
     * Check if a key exists
     */
    public has(key: string): boolean {
        return key in this.cache && this.cache[key] !== undefined && this.cache[key] !== '';
    }

    /**
     * Delete a sensitive value
     */
    public delete(key: string): void {
        delete this.cache[key];
        this.save();
    }

    /**
     * Clear all stored data
     */
    public clear(): void {
        this.cache = {};
        this.save();
    }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
