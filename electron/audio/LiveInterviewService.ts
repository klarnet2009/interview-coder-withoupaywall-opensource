/**
 * LiveInterviewService - Handles Gemini connection (main process)
 * Audio capture happens in renderer and is sent via IPC
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { GeminiLiveService, TranscriptUpdate, AIResponse } from './GeminiLiveService';
import { HintGenerationService, HintResponse } from './HintGenerationService';

export type ListeningState =
    | 'idle'
    | 'connecting'
    | 'listening'
    | 'no_signal'
    | 'transcribing'
    | 'generating'
    | 'error';

export interface ListeningStatus {
    state: ListeningState;
    transcript: string;
    response: string;
    audioLevel: number;
    error?: string;
}

export interface LiveInterviewConfig {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    spokenLanguage?: string;
}

export class LiveInterviewService extends EventEmitter {
    private config: LiveInterviewConfig;
    public geminiService: GeminiLiveService | null = null;
    private hintService: HintGenerationService | null = null;
    private state: ListeningState = 'idle';
    private currentTranscript: string = '';
    private currentResponse: string = '';
    private responseHistory: string = '';
    private audioLevel: number = 0;
    private silenceTimeout: NodeJS.Timeout | null = null;

    private transcribeHoldTimeout: NodeJS.Timeout | null = null;
    private transcriptClearTimeout: NodeJS.Timeout | null = null;
    private hintTriggerTimeout: NodeJS.Timeout | null = null;
    private lastTranscriptTime: number = 0;
    private lastHintTranscript: string = '';
    private pendingHint: boolean = false;

    // Minimum time to stay in 'transcribing' before allowing transition back
    private static readonly TRANSCRIBE_HOLD_MS = 2000;
    // Time after last response to clear accumulated transcript
    private static readonly TRANSCRIPT_CLEAR_MS = 5000;
    // Minimum new transcript length to trigger new hint generation
    private static readonly MIN_NEW_CHARS_FOR_HINT = 10;
    // Silence duration after last transcript token to auto-trigger hint
    private static readonly HINT_TRIGGER_SILENCE_MS = 1500;

    constructor(config: LiveInterviewConfig) {
        super();
        this.config = config;
    }

    /**
     * Start listening session (connects to Gemini only)
     * Audio capture is done in renderer process
     */
    public async start(): Promise<void> {
        if (this.state !== 'idle') {
            log.warn('LiveInterviewService: Already running');
            return;
        }

        try {
            this.setState('connecting');

            // Initialize Gemini Live (transcription only)
            this.geminiService = new GeminiLiveService({
                apiKey: this.config.apiKey,
                model: this.config.model,
                systemInstruction: this.config.systemInstruction,
                spokenLanguage: this.config.spokenLanguage,
            });

            // Initialize Hint Generation (Gemini 3.0 Flash)
            this.hintService = new HintGenerationService(
                this.config.apiKey,
                undefined,
                this.config.spokenLanguage
            );
            this.setupHintListeners();

            // Create explicit cache for system instruction (non-blocking)
            this.hintService.createCache().catch(err => {
                log.warn('LiveInterviewService: Cache creation failed, using inline instructions', err);
            });

            this.setupGeminiListeners();
            await this.geminiService.connect();

            this.setState('listening');
            log.info('LiveInterviewService: Session started (Gemini connected, HintService ready)');

        } catch (error) {
            log.error('LiveInterviewService: Failed to start', error);
            this.setState('error');
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Setup Gemini event listeners (transcription only)
     */
    private setupGeminiListeners(): void {
        if (!this.geminiService) return;

        this.geminiService.on('connected', () => {
            log.info('LiveInterviewService: Gemini connected');
        });

        this.geminiService.on('transcript', (update: TranscriptUpdate) => {
            this.currentTranscript = update.text;
            this.lastTranscriptTime = Date.now();

            // Cancel any pending clear
            if (this.transcriptClearTimeout) {
                clearTimeout(this.transcriptClearTimeout);
                this.transcriptClearTimeout = null;
            }

            // Move to transcribing if we're in listening/no_signal
            if (this.state === 'listening' || this.state === 'no_signal') {
                this.setState('transcribing');
            }

            // Reset the hold timer
            if (this.transcribeHoldTimeout) {
                clearTimeout(this.transcribeHoldTimeout);
            }
            this.transcribeHoldTimeout = setTimeout(() => {
                this.transcribeHoldTimeout = null;
                if (this.state === 'transcribing' &&
                    Date.now() - this.lastTranscriptTime >= LiveInterviewService.TRANSCRIBE_HOLD_MS) {
                    this.setState('listening');
                }
            }, LiveInterviewService.TRANSCRIBE_HOLD_MS);

            // Auto-trigger hint generation after silence (fallback for missed turnComplete)
            if (this.hintTriggerTimeout) {
                clearTimeout(this.hintTriggerTimeout);
            }
            this.hintTriggerTimeout = setTimeout(() => {
                this.hintTriggerTimeout = null;
                const newContent = this.currentTranscript.length - this.lastHintTranscript.length;
                if (newContent >= LiveInterviewService.MIN_NEW_CHARS_FOR_HINT) {
                    log.info('LiveInterviewService: Auto-triggering hint after silence');
                    this.triggerHintGeneration();
                }
            }, LiveInterviewService.HINT_TRIGGER_SILENCE_MS);

            this.emitStatus();
        });

        // Ignore Live API model responses (just acknowledgments like "Heard.")
        this.geminiService.on('response', (_response: AIResponse) => {
            // Do nothing — hints come from HintGenerationService
        });

        this.geminiService.on('interrupted', () => {
            log.info('LiveInterviewService: Barge-in detected (Live API response interrupted)');
            // Don't abort hint generation — barge-in is about the Live API's 
            // own audio response, not our separate Gemini 3 Flash hint stream
            this.setState('transcribing');
            this.emitStatus();
        });

        this.geminiService.on('turnComplete', () => {
            log.info('LiveInterviewService: Turn complete');

            // Trigger hint generation if we have meaningful new transcript
            const newContent = this.currentTranscript.length - this.lastHintTranscript.length;
            if (this.currentTranscript && newContent >= LiveInterviewService.MIN_NEW_CHARS_FOR_HINT) {
                this.triggerHintGeneration();
            }

            // Let debounce timer handle state transition
            if (!this.transcribeHoldTimeout && this.state !== 'generating') {
                this.setState('listening');
            }
        });

        this.geminiService.on('error', (error: Error) => {
            log.error('LiveInterviewService: Gemini error', error);
            this.emit('error', error);
        });

        this.geminiService.on('disconnected', () => {
            log.warn('LiveInterviewService: Gemini disconnected');
            if (this.state !== 'idle') {
                this.setState('error');
            }
        });
    }

    /**
     * Setup HintGenerationService listeners
     */
    private setupHintListeners(): void {
        if (!this.hintService) return;

        this.hintService.on('hint', (hint: HintResponse) => {
            // New hints on top, old ones below
            this.currentResponse = this.responseHistory
                ? hint.text + '\n\n---\n\n' + this.responseHistory
                : hint.text;
            if (hint.isComplete) {
                // Save to history (newest first)
                this.responseHistory = this.currentResponse;
                this.scheduleTranscriptClear();
                this.setState('listening');

                // If a hint was requested while this one was streaming, fire it now
                if (this.pendingHint) {
                    this.pendingHint = false;
                    const newContent = this.currentTranscript.length - this.lastHintTranscript.length;
                    if (newContent >= LiveInterviewService.MIN_NEW_CHARS_FOR_HINT) {
                        log.info('LiveInterviewService: Firing pending hint generation');
                        this.triggerHintGeneration();
                    }
                }
            }
            this.emitStatus();
        });

        this.hintService.on('error', (error: Error) => {
            log.error('LiveInterviewService: Hint generation error', error);
            this.setState('listening');
            this.emitStatus();
        });
    }

    /**
     * Trigger hint generation from accumulated transcript
     */
    private triggerHintGeneration(): void {
        if (!this.hintService || !this.currentTranscript) return;

        // Don't interrupt an in-flight hint — queue it for after completion
        if (this.hintService.isActive()) {
            log.info('LiveInterviewService: Hint generation in progress, queuing for later');
            this.pendingHint = true;
            return;
        }

        log.info(`LiveInterviewService: Triggering hint generation (${this.currentTranscript.length} chars)`);
        this.lastHintTranscript = this.currentTranscript;
        this.setState('generating');
        this.emitStatus();

        this.hintService.generateHint(this.currentTranscript);
    }

    /**
     * Schedule transcript clear after a period of silence post-response
     */
    private scheduleTranscriptClear(): void {
        if (this.transcriptClearTimeout) {
            clearTimeout(this.transcriptClearTimeout);
        }
        this.transcriptClearTimeout = setTimeout(() => {
            this.transcriptClearTimeout = null;
            log.info('LiveInterviewService: Clearing accumulated transcript after silence');
            this.currentTranscript = '';
            this.geminiService?.clearTranscript();
            this.emitStatus();
        }, LiveInterviewService.TRANSCRIPT_CLEAR_MS);
    }


    /**
     * Receive audio chunk from renderer process
     * @param pcmBase64 - Base64 encoded PCM audio
     * @param level - Audio level (0-1)
     */
    public receiveAudio(pcmBase64: string, level: number): void {
        this.audioLevel = level;

        // Handle silence detection
        const isSilent = level < 0.01;

        if (isSilent) {
            if (this.state === 'listening' && !this.silenceTimeout) {
                this.silenceTimeout = setTimeout(() => {
                    this.setState('no_signal');
                    this.emitStatus();
                }, 5000);
            }
        } else {
            if (this.silenceTimeout) {
                clearTimeout(this.silenceTimeout);
                this.silenceTimeout = null;
            }
            if (this.state === 'no_signal') {
                this.setState('listening');
            }
        }

        // Send to Gemini
        if (this.geminiService?.isActive()) {
            const buffer = Buffer.from(pcmBase64, 'base64');
            this.geminiService.sendAudio(buffer);
        }

        this.emitStatus();
    }

    /**
     * Stop listening session
     */
    public async stop(): Promise<void> {
        log.info('LiveInterviewService: Stopping session');

        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }

        if (this.transcribeHoldTimeout) {
            clearTimeout(this.transcribeHoldTimeout);
            this.transcribeHoldTimeout = null;
        }

        if (this.hintTriggerTimeout) {
            clearTimeout(this.hintTriggerTimeout);
            this.hintTriggerTimeout = null;
        }

        if (this.transcriptClearTimeout) {
            clearTimeout(this.transcriptClearTimeout);
            this.transcriptClearTimeout = null;
        }

        if (this.geminiService) {
            this.geminiService.disconnect();
            this.geminiService = null;
        }

        if (this.hintService) {
            this.hintService.abort();
            await this.hintService.deleteCache();
            this.hintService.clearHistory();
            this.hintService.removeAllListeners();
            this.hintService = null;
        }

        this.currentTranscript = '';
        this.currentResponse = '';
        this.responseHistory = '';
        this.lastHintTranscript = '';
        this.audioLevel = 0;
        this.setState('idle');
    }

    /**
     * Get current status
     */
    public getStatus(): ListeningStatus {
        return {
            state: this.state,
            transcript: this.currentTranscript,
            response: this.currentResponse,
            audioLevel: this.audioLevel
        };
    }

    /**
     * Update state and emit event
     */
    private setState(newState: ListeningState): void {
        if (this.state !== newState) {
            log.info(`LiveInterviewService: State ${this.state} -> ${newState}`);
            this.state = newState;
            this.emit('stateChange', newState);
        }
    }

    /**
     * Emit current status
     */
    private emitStatus(): void {
        this.emit('status', this.getStatus());
    }

    /**
     * Check if currently active
     */
    public isActive(): boolean {
        return this.state !== 'idle' && this.state !== 'error';
    }
}
