/**
 * LiveInterviewService - Handles Gemini connection (main process)
 * Audio capture happens in renderer and is sent via IPC
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { GeminiLiveService, TranscriptUpdate } from './GeminiLiveService';
import { HintGenerationService, HintResponse, HintUserProfile, HintCompanyContext } from './HintGenerationService';

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
    interviewMode?: string;
    answerStyle?: string;
    userProfile?: HintUserProfile | null;
    companyContext?: HintCompanyContext | null;
}

export class LiveInterviewService extends EventEmitter {
    private config: LiveInterviewConfig;
    private geminiService: GeminiLiveService | null = null;
    private hintService: HintGenerationService | null = null;
    private state: ListeningState = 'idle';
    private currentTranscript: string = '';
    private currentResponse: string = '';
    private responseHistory: string = '';
    private static readonly MAX_RESPONSE_HISTORY_LENGTH = 200_000;
    private audioLevel: number = 0;
    private silenceTimeout: ReturnType<typeof setTimeout> | null = null;

    private transcribeHoldTimeout: ReturnType<typeof setTimeout> | null = null;
    private transcriptClearTimeout: ReturnType<typeof setTimeout> | null = null;
    private hintTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
    private forceHintTimeout: ReturnType<typeof setTimeout> | null = null;
    private endTurnDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
    private lastTranscriptTime: number = 0;
    private lastHintTranscript: string = '';
    private pendingHint: boolean = false;
    private lastNonSilentAudioAt: number = 0;
    private lastEndTurnAt: number = 0;

    // Minimum time to stay in 'transcribing' before allowing transition back
    private static readonly TRANSCRIBE_HOLD_MS = 2000;
    // Time after last response to clear accumulated transcript
    private static readonly TRANSCRIPT_CLEAR_MS = 5000;
    // Minimum count of meaningful chars (letters/digits) in new transcript delta
    // to trigger hint generation. Kept low to avoid dropping short questions.
    private static readonly MIN_MEANINGFUL_NEW_CHARS_FOR_HINT = 2;
    // Silence duration after last transcript token to auto-trigger hint
    private static readonly HINT_TRIGGER_SILENCE_MS = 1500;
    // Hard fallback if turnComplete/silence trigger missed
    private static readonly FORCE_HINT_FALLBACK_MS = 3200;
    // Audio thresholds for explicit turn finalization
    private static readonly AUDIO_SILENCE_LEVEL = 0.01;
    private static readonly END_TURN_SILENCE_MS = 900;
    private static readonly END_TURN_MIN_INTERVAL_MS = 1200;

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
                this.config.spokenLanguage,
                this.config.interviewMode,
                this.config.answerStyle,
                this.config.userProfile,
                this.config.companyContext
            );
            this.setupHintListeners();

            this.setupGeminiListeners();
            await this.geminiService.connect();

            this.lastNonSilentAudioAt = Date.now();
            this.setState('listening');
            log.info('LiveInterviewService: Session started (Gemini connected, HintService ready)');

        } catch (error) {
            log.error('LiveInterviewService: Failed to start', error);
            // Cleanup any partially-initialized resources to prevent leaks
            if (this.geminiService) {
                this.geminiService.disconnect();
                this.geminiService = null;
            }
            if (this.hintService) {
                this.hintService.removeAllListeners();
                this.hintService = null;
            }
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
                if (this.hasMeaningfulDeltaForHint()) {
                    log.info('LiveInterviewService: Auto-triggering hint after silence');
                    this.triggerHintGeneration('silence-fallback');
                }
            }, LiveInterviewService.HINT_TRIGGER_SILENCE_MS);

            if (this.forceHintTimeout) {
                clearTimeout(this.forceHintTimeout);
            }
            this.forceHintTimeout = setTimeout(() => {
                this.forceHintTimeout = null;
                if (
                    this.state !== 'generating' &&
                    this.currentTranscript.trim().length > 0
                ) {
                    log.info('LiveInterviewService: Forced hint trigger fallback');
                    this.triggerHintGeneration('forced-fallback', true);
                }
            }, LiveInterviewService.FORCE_HINT_FALLBACK_MS);

            this.emitStatus();
        });

        // Ignore Live API model responses (just acknowledgments like "Heard.")
        this.geminiService.on('response', () => {
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
            if (this.currentTranscript && this.hasMeaningfulDeltaForHint()) {
                this.triggerHintGeneration('turn-complete');
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

        this.geminiService.on('authError', (reason: string) => {
            log.error('LiveInterviewService: API key invalid —', reason);
            this.emit('error', new Error('API key is invalid. Please check your key in Settings.'));
            this.setState('error');
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
                // Cap response history to prevent unbounded growth
                if (this.responseHistory.length > LiveInterviewService.MAX_RESPONSE_HISTORY_LENGTH) {
                    this.responseHistory = this.responseHistory.slice(
                        0, Math.floor(LiveInterviewService.MAX_RESPONSE_HISTORY_LENGTH / 2)
                    );
                }
                this.scheduleTranscriptClear();
                this.setState('listening');

                // If a hint was requested while this one was streaming, fire it now
                if (this.pendingHint) {
                    this.pendingHint = false;
                    if (this.hasMeaningfulDeltaForHint()) {
                        log.info('LiveInterviewService: Firing pending hint generation');
                        this.triggerHintGeneration('pending-drain');
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
    private triggerHintGeneration(
        reason: 'turn-complete' | 'silence-fallback' | 'forced-fallback' | 'pending-drain',
        force: boolean = false
    ): void {
        if (!this.hintService || !this.currentTranscript) return;
        if (!force && !this.hasMeaningfulDeltaForHint()) return;

        // Don't interrupt an in-flight hint — queue it for after completion
        if (this.hintService.isActive()) {
            log.info('LiveInterviewService: Hint generation in progress, queuing for later');
            this.pendingHint = true;
            return;
        }

        this.clearHintTimers();

        log.info(`LiveInterviewService: Triggering hint generation (${this.currentTranscript.length} chars, reason=${reason})`);
        this.lastHintTranscript = this.currentTranscript;
        this.setState('generating');
        this.emitStatus();

        this.hintService.generateHint(this.currentTranscript);
    }

    private clearHintTimers(): void {
        if (this.hintTriggerTimeout) {
            clearTimeout(this.hintTriggerTimeout);
            this.hintTriggerTimeout = null;
        }
        if (this.forceHintTimeout) {
            clearTimeout(this.forceHintTimeout);
            this.forceHintTimeout = null;
        }
    }

    private scheduleEndTurnIfSilent(isSilent: boolean): void {
        if (!this.geminiService?.isActive()) {
            return;
        }

        if (!isSilent) {
            this.lastNonSilentAudioAt = Date.now();
            if (this.endTurnDebounceTimeout) {
                clearTimeout(this.endTurnDebounceTimeout);
                this.endTurnDebounceTimeout = null;
            }
            return;
        }

        if (this.endTurnDebounceTimeout) {
            return;
        }

        this.endTurnDebounceTimeout = setTimeout(() => {
            this.endTurnDebounceTimeout = null;
            const now = Date.now();
            const sinceSpeech = now - this.lastNonSilentAudioAt;
            const sinceLastEndTurn = now - this.lastEndTurnAt;

            if (
                (this.state === 'listening' || this.state === 'transcribing') &&
                sinceSpeech >= LiveInterviewService.END_TURN_SILENCE_MS &&
                sinceLastEndTurn >= LiveInterviewService.END_TURN_MIN_INTERVAL_MS
            ) {
                this.lastEndTurnAt = now;
                log.info('LiveInterviewService: Forcing endTurn after local silence');
                this.geminiService?.endTurn();
            }
        }, LiveInterviewService.END_TURN_SILENCE_MS);
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
            this.lastHintTranscript = '';
            this.pendingHint = false;
            this.geminiService?.clearTranscript();
            this.emitStatus();
        }, LiveInterviewService.TRANSCRIPT_CLEAR_MS);
    }


    // Debug: log audio levels periodically
    private lastAudioLevelLogAt = 0;

    /**
     * Receive audio chunk from renderer process
     * @param pcmBase64 - Base64 encoded PCM audio
     * @param level - Audio level (0-1)
     */
    public receiveAudio(pcmBase64: string, level: number): void {
        this.audioLevel = level;

        // Periodic audio level debug log (every 3s)
        const now = Date.now();
        if (now - this.lastAudioLevelLogAt >= 3000) {
            this.lastAudioLevelLogAt = now;
            log.info(`LiveInterviewService: [AUDIO] level=${level.toFixed(4)} state=${this.state} wsActive=${!!this.geminiService?.isActive()}`);
        }

        // Handle silence detection
        const isSilent = level < LiveInterviewService.AUDIO_SILENCE_LEVEL;

        // Force turn finalization when speech ended but remote turnComplete lags
        this.scheduleEndTurnIfSilent(isSilent);

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
            try {
                const buffer = Buffer.from(pcmBase64, 'base64');
                this.geminiService.sendAudio(buffer);
            } catch (error) {
                log.warn('LiveInterviewService: Failed to decode/send audio chunk', error);
            }
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

        if (this.forceHintTimeout) {
            clearTimeout(this.forceHintTimeout);
            this.forceHintTimeout = null;
        }

        if (this.endTurnDebounceTimeout) {
            clearTimeout(this.endTurnDebounceTimeout);
            this.endTurnDebounceTimeout = null;
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
        this.pendingHint = false;
        this.lastTranscriptTime = 0;
        this.lastNonSilentAudioAt = 0;
        this.lastEndTurnAt = 0;
        this.audioLevel = 0;
        this.setState('idle');
    }

    /**
     * Send text to the Gemini service (proxy for private geminiService)
     */
    public sendText(text: string): void {
        if (this.geminiService) {
            this.geminiService.sendText(text);
        }
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
     * Returns transcript content not covered by the last generated hint.
     * Uses prefix matching instead of raw length diff to stay correct after transcript resets.
     */
    private getUnprocessedTranscriptDelta(): string {
        if (!this.currentTranscript) return '';
        if (!this.lastHintTranscript) return this.currentTranscript;
        if (this.currentTranscript.startsWith(this.lastHintTranscript)) {
            return this.currentTranscript.slice(this.lastHintTranscript.length);
        }
        return this.currentTranscript;
    }

    /**
     * Avoid generating hints from punctuation-only noise while still allowing short phrases.
     */
    private hasMeaningfulDeltaForHint(): boolean {
        const delta = this.getUnprocessedTranscriptDelta().trim();
        if (!delta) return false;

        let meaningfulCount = 0;
        for (const char of delta) {
            if (/[\p{L}\p{N}]/u.test(char)) {
                meaningfulCount++;
                if (meaningfulCount >= LiveInterviewService.MIN_MEANINGFUL_NEW_CHARS_FOR_HINT) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if currently active
     */
    public isActive(): boolean {
        return this.state !== 'idle' && this.state !== 'error';
    }
}

