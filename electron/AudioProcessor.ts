/**
 * AudioProcessor - Processes audio chunks via Gemini API for speech-to-text
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { configHelper } from './ConfigHelper';
import log from 'electron-log';

export interface TranscriptionResult {
    text: string;
    timestamp: number;
    confidence?: number;
}

export interface AudioProcessorConfig {
    apiKey: string;
    model?: string;
    language?: string;
}

export class AudioProcessor {
    private apiKey: string;
    private model: string;
    private transcriptionHistory: TranscriptionResult[] = [];
    private maxHistoryLength = 20;

    constructor(config?: Partial<AudioProcessorConfig>) {
        const loadedConfig = configHelper.loadConfig();
        this.apiKey = config?.apiKey || loadedConfig.apiKey || '';
        this.model = config?.model || 'gemini-3-flash-preview';
    }

    /**
     * Update API key
     */
    setApiKey(key: string): void {
        this.apiKey = key;
    }

    /**
     * Process audio buffer and return transcription
     */
    async transcribe(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        try {
            const base64Audio = audioBuffer.toString('base64');

            // Sanitize MIME type (remove codecs)
            const cleanMimeType = mimeType.split(';')[0].trim();

            // Fallback to stable model for debugging if Gemini 3 fails
            const audioModel = 'gemini-3-flash-preview';

            log.info(`Transcribing audio: ${audioBuffer.length} bytes, original mime: ${mimeType}, sending: ${cleanMimeType}`);
            log.info(`Using model: ${audioModel}, API key prefix: ${this.apiKey.substring(0, 8)}...`);

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${audioModel}:generateContent`,
                {
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: cleanMimeType,
                                        data: base64Audio
                                    }
                                },
                                {
                                    text: "Transcribe the audio accurately. Return only the transcribed text, nothing else. If no speech is detected, return [SILENCE]."
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1024
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.apiKey
                    },
                    timeout: 30000
                }
            );

            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '[NO RESPONSE]';

            const result: TranscriptionResult = {
                text: text.trim(),
                timestamp: Date.now()
            };

            // Add to history
            this.transcriptionHistory.push(result);
            if (this.transcriptionHistory.length > this.maxHistoryLength) {
                this.transcriptionHistory.shift();
            }

            return result;
        } catch (error: any) {
            // Enhanced error logging
            if (error.response) {
                log.error('Gemini API Error Status:', error.response.status);
                log.error('Gemini API Error Data:', JSON.stringify(error.response.data, null, 2));
            } else {
                log.error('Audio transcription error (no response):', error.message);
            }
            throw error;
        }
    }

    /**
     * Process audio file and return transcription
     */
    async transcribeFile(filePath: string): Promise<TranscriptionResult> {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let mimeType = 'audio/webm';
        if (ext === '.wav') mimeType = 'audio/wav';
        else if (ext === '.mp3') mimeType = 'audio/mpeg';
        else if (ext === '.mp4' || ext === '.m4a') mimeType = 'audio/mp4';

        return this.transcribe(buffer, mimeType);
    }

    /**
     * Get full transcript from history
     */
    getFullTranscript(): string {
        return this.transcriptionHistory
            .filter(r => r.text !== '[SILENCE]' && r.text !== '[NO RESPONSE]')
            .map(r => r.text)
            .join(' ');
    }

    /**
     * Get recent transcript (last N entries)
     */
    getRecentTranscript(count: number = 5): string {
        return this.transcriptionHistory
            .slice(-count)
            .filter(r => r.text !== '[SILENCE]' && r.text !== '[NO RESPONSE]')
            .map(r => r.text)
            .join(' ');
    }

    /**
     * Clear transcription history
     */
    clearHistory(): void {
        this.transcriptionHistory = [];
    }

    /**
     * Generate hints based on transcript context
     */
    async generateHints(recentTranscript: string): Promise<string> {
        if (!this.apiKey || !recentTranscript || recentTranscript.trim().length < 10) {
            return '';
        }

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    contents: [
                        {
                            parts: [
                                {
                                    text: `You are an AI assistant helping someone during a technical interview. 
Based on the interviewer's recent question or statement, provide a brief, helpful hint or suggestion.

Interviewer said: "${recentTranscript}"

Provide a concise hint (1-2 sentences) that would help the candidate answer effectively. Focus on key points they should mention.`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 256
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        } catch (error) {
            log.error('Hint generation error:', error);
            return '';
        }
    }

    /**
     * Test audio processing with a short sample
     */
    async testAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<{
        success: boolean;
        transcript?: string;
        error?: string;
    }> {
        try {
            const result = await this.transcribe(audioBuffer, mimeType);
            return {
                success: true,
                transcript: result.text
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

// Singleton instance
let processorInstance: AudioProcessor | null = null;

export function getAudioProcessor(config?: Partial<AudioProcessorConfig>): AudioProcessor {
    if (!processorInstance) {
        processorInstance = new AudioProcessor(config);
    }
    return processorInstance;
}

export function resetAudioProcessor(): void {
    processorInstance = null;
}
