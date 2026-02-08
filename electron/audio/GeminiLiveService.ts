/**
 * GeminiLiveService - Real-time audio streaming with Gemini Live API
 * Provides: WebSocket connection, audio streaming, transcription, and AI responses
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import WebSocket from 'ws';

// Types for Gemini Live API messages
export interface GeminiLiveConfig {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    spokenLanguage?: string;
}

export interface TranscriptUpdate {
    text: string;
    isFinal: boolean;
    timestamp: number;
}

export interface AIResponse {
    text: string;
    isComplete: boolean;
    timestamp: number;
}

export interface GeminiLiveMessage {
    serverContent?: {
        inputTranscription?: {
            text: string;
        };
        modelTurn?: {
            parts: Array<{
                text?: string;
                inlineData?: {
                    data: string;
                    mimeType: string;
                };
            }>;
        };
        interrupted?: boolean;
        turnComplete?: boolean;
    };
    error?: {
        code: number;
        message: string;
    };
}

// Model for Live API (speech recognition + text response)
// gemini-live-2.5-flash-preview supports TEXT response modality natively
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
// Model for response generation (will be used separately)
export const RESPONSE_MODEL = 'gemini-3-flash-preview';
const WEBSOCKET_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export class GeminiLiveService extends EventEmitter {
    private config: GeminiLiveConfig;
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private intentionalDisconnect: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private currentTranscript: string = '';
    private currentResponse: string = '';
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private static readonly MAX_TRANSCRIPT_LENGTH = 100_000;

    constructor(config: GeminiLiveConfig) {
        super();
        this.config = {
            ...config,
            model: config.model || DEFAULT_MODEL,
        };
        // Must be set after this.config is assigned (getDefaultSystemInstruction reads this.config)
        this.config.systemInstruction = config.systemInstruction || this.getDefaultSystemInstruction();
    }

    private getDefaultSystemInstruction(): string {
        const langMap: Record<string, string> = {
            'en': 'English',
            'ru': 'Russian',
            'lv': 'Latvian',
            'de': 'German',
        };
        const langName = langMap[this.config.spokenLanguage || 'en'] || 'English';

        return `You are a speech transcription assistant in a real-time interview session.
The speaker is speaking in ${langName}.

Your only job is to listen to the audio input carefully.
When the user finishes speaking, respond with a very brief acknowledgment like "Heard." or "Got it."
Do NOT provide any analysis, hints, or answers — another model handles that.
Keep your responses to 1-2 words maximum.`;
    }

    /**
     * Connect to Gemini Live API.
     * Returns a Promise that resolves when the WebSocket is open
     * and the setup message has been sent.
     */
    public async connect(): Promise<void> {
        if (this.isConnected) {
            log.warn('GeminiLiveService: Already connected');
            return;
        }

        this.intentionalDisconnect = false;

        return new Promise<void>((resolve, reject) => {
            try {
                log.info('GeminiLiveService: Connecting to Gemini Live API...');
                log.info(`GeminiLiveService: Using model: ${this.config.model}`);
                log.info(`GeminiLiveService: API key prefix: ${this.config.apiKey.substring(0, 10)}...`);

                const url = `${WEBSOCKET_URL}?key=${this.config.apiKey}`;
                this.ws = new WebSocket(url);

                this.ws.on('open', () => {
                    log.info('GeminiLiveService: WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.sendSetup();
                    this.emit('connected');
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    this.handleMessage(data.toString());
                });

                this.ws.on('error', (error: Error) => {
                    log.error('GeminiLiveService: WebSocket error', error);
                    this.emit('error', new Error('WebSocket connection error'));
                    // Reject only if we haven't connected yet
                    if (!this.isConnected) {
                        reject(new Error('WebSocket connection error'));
                    }
                });

                this.ws.on('close', (code: number, reason: Buffer) => {
                    log.info('GeminiLiveService: WebSocket closed', code, reason.toString());
                    const wasConnected = this.isConnected;
                    this.isConnected = false;
                    this.emit('disconnected', reason.toString());

                    // Don't reconnect on auth errors — retrying with the same key is pointless
                    const isAuthError = code === 1007 || code === 1008;
                    if (isAuthError) {
                        log.error(`GeminiLiveService: Auth error (code ${code}), not reconnecting`);
                        // Clean up ws to prevent listener/socket leaks
                        if (this.ws) {
                            this.ws.removeAllListeners();
                            this.ws = null;
                        }
                        this.emit('authError', reason.toString());
                    }

                    // Only attempt reconnection if not intentionally disconnected and not auth error
                    if (!this.intentionalDisconnect && !isAuthError && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        this.reconnectTimeout = setTimeout(() => {
                            this.reconnectTimeout = null;
                            this.connect();
                        }, 1000 * this.reconnectAttempts);
                    }

                    // Reject if we closed before ever connecting
                    if (!wasConnected) {
                        reject(new Error(`WebSocket closed before connection established (code ${code})`));
                    }
                });

            } catch (error) {
                log.error('GeminiLiveService: Failed to connect', error);
                reject(error);
            }
        });
    }

    /**
     * Send initial setup message
     */
    private sendSetup(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log.error('GeminiLiveService: Cannot send setup - not connected');
            return;
        }

        const setupMessage = {
            setup: {
                model: `models/${this.config.model}`,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    temperature: 0.7,
                    maxOutputTokens: 50,
                },
                systemInstruction: {
                    parts: [{ text: this.config.systemInstruction }]
                },
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: false,
                        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
                        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                        prefixPaddingMs: 100,
                        silenceDurationMs: 500
                    },
                    activityHandling: 'NO_INTERRUPTION'
                },
                inputAudioTranscription: {}
            }
        };

        this.ws.send(JSON.stringify(setupMessage));
        log.info('GeminiLiveService: Setup message sent');
        this.startDebugStats();
    }

    /**
     * Handle incoming messages from Gemini
     */
    // ── Debug stats ──────────────────────────────────────────────
    private debugAudioChunksSent = 0;
    private debugWsMsgsReceived = 0;
    private debugTranscriptsReceived = 0;
    private debugStatsInterval: ReturnType<typeof setInterval> | null = null;

    private startDebugStats(): void {
        if (this.debugStatsInterval) return;
        this.debugStatsInterval = setInterval(() => {
            log.info(
                `GeminiLiveService: [STATS] audioSent=${this.debugAudioChunksSent}` +
                ` wsMsgs=${this.debugWsMsgsReceived}` +
                ` transcripts=${this.debugTranscriptsReceived}` +
                ` wsState=${this.ws?.readyState ?? 'null'}`
            );
            this.debugAudioChunksSent = 0;
            this.debugWsMsgsReceived = 0;
            this.debugTranscriptsReceived = 0;
        }, 5000);
    }

    private stopDebugStats(): void {
        if (this.debugStatsInterval) {
            clearInterval(this.debugStatsInterval);
            this.debugStatsInterval = null;
        }
    }
    // ── End debug stats ──────────────────────────────────────────

    private handleMessage(data: string): void {
        try {
            this.debugWsMsgsReceived++;
            const message: GeminiLiveMessage = JSON.parse(data);

            // Log message type for debugging
            const msgType = message.error ? 'error'
                : message.serverContent?.inputTranscription ? 'inputTranscription'
                    : message.serverContent?.modelTurn ? 'modelTurn'
                        : message.serverContent?.turnComplete ? 'turnComplete'
                            : 'other';
            log.debug(`GeminiLiveService: [MSG] type=${msgType}`);

            // Handle errors
            if (message.error) {
                log.error('GeminiLiveService: API error', message.error);
                this.emit('error', new Error(message.error.message));
                return;
            }

            const serverContent = message.serverContent;
            if (!serverContent) return;

            // Handle input transcription (user's speech as text)
            // inputAudioTranscription sends sub-word tokens — concatenate directly (no added spaces)
            if (serverContent.inputTranscription?.text) {
                const newText = serverContent.inputTranscription.text;
                if (newText) {
                    this.debugTranscriptsReceived++;
                    // Append directly — the API includes spaces/punctuation in token text
                    this.currentTranscript += newText;
                    // Prevent unbounded growth in long sessions
                    if (this.currentTranscript.length > GeminiLiveService.MAX_TRANSCRIPT_LENGTH) {
                        this.currentTranscript = this.currentTranscript.slice(
                            -Math.floor(GeminiLiveService.MAX_TRANSCRIPT_LENGTH / 2)
                        );
                    }
                    const transcript: TranscriptUpdate = {
                        text: this.currentTranscript,
                        isFinal: false,
                        timestamp: Date.now()
                    };
                    this.emit('transcript', transcript);
                }
            }

            // Handle model's text response
            if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                    if (part.text) {
                        this.currentResponse += part.text;
                        const response: AIResponse = {
                            text: this.currentResponse,
                            isComplete: false,
                            timestamp: Date.now()
                        };
                        this.emit('response', response);
                    }
                }
            }

            // Handle interruption (barge-in)
            if (serverContent.interrupted) {
                log.info('GeminiLiveService: Turn interrupted');
                this.currentResponse = '';
                this.emit('interrupted');
            }

            // Handle turn complete
            if (serverContent.turnComplete) {
                log.info('GeminiLiveService: Turn complete');

                // Emit final transcript (keep accumulated text, don't clear)
                if (this.currentTranscript) {
                    this.emit('transcript', {
                        text: this.currentTranscript,
                        isFinal: true,
                        timestamp: Date.now()
                    });
                }

                // Emit final response
                if (this.currentResponse) {
                    this.emit('response', {
                        text: this.currentResponse,
                        isComplete: true,
                        timestamp: Date.now()
                    });
                }

                // Only clear response, keep transcript accumulated
                this.currentResponse = '';
                this.emit('turnComplete');
            }

        } catch (error) {
            log.error('GeminiLiveService: Failed to parse message', error);
        }
    }

    /**
     * Send audio chunk to Gemini
     * @param pcmData - 16-bit PCM audio at 16kHz, mono
     */
    public sendAudio(pcmData: Int16Array | Buffer): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log.warn('GeminiLiveService: Cannot send audio - not connected');
            return;
        }

        // Convert to base64
        let base64Data: string;
        if (Buffer.isBuffer(pcmData)) {
            base64Data = pcmData.toString('base64');
        } else {
            base64Data = Buffer.from(pcmData.buffer).toString('base64');
        }

        const audioMessage = {
            realtimeInput: {
                mediaChunks: [{
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=16000'
                }]
            }
        };

        try {
            this.debugAudioChunksSent++;
            this.ws.send(JSON.stringify(audioMessage));
        } catch (error) {
            log.warn('GeminiLiveService: Failed to send audio (WebSocket may have closed)', error);
        }
    }

    /**
     * Send text message (for testing or manual input)
     */
    public sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log.warn('GeminiLiveService: Cannot send text - not connected');
            return;
        }

        const textMessage = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text }]
                }],
                turnComplete: true
            }
        };

        this.ws.send(JSON.stringify(textMessage));
    }

    /**
     * End the current turn (signal end of speech).
     *
     * NOTE: With automaticActivityDetection enabled in the setup config,
     * sending explicit activityEnd messages causes a 1007 disconnect:
     * "Explicit activity control is not supported when automatic activity
     * detection is enabled."  The API handles end-of-speech detection
     * automatically, so this method is intentionally a no-op.
     */
    public endTurn(): void {
        // Automatic activity detection is enabled — no-op.
    }

    /**
     * Disconnect from Gemini Live API.
     * Safe to call in any WebSocket state (CONNECTING, OPEN, CLOSING, CLOSED).
     */
    public disconnect(): void {
        this.intentionalDisconnect = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            // Remove all listeners first to prevent reconnection attempts
            // and avoid 'close before established' errors
            this.ws.removeAllListeners();
            try {
                this.ws.close();
            } catch {
                // Ignore errors from closing in CONNECTING state
            }
            this.ws = null;
        }
        this.isConnected = false;
        this.currentTranscript = '';
        this.currentResponse = '';
        this.stopDebugStats();
    }

    /**
     * Clear accumulated transcript
     */
    public clearTranscript(): void {
        this.currentTranscript = '';
    }

    /**
     * Check connection status
     */
    public isActive(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Update system instruction
     */
    public updateSystemInstruction(instruction: string): void {
        this.config.systemInstruction = instruction;
        // Reconnect to apply changes
        if (this.isConnected) {
            this.disconnect();
            this.connect();
        }
    }

    public getSystemInstruction(): string {
        return this.config.systemInstruction || '';
    }
}
