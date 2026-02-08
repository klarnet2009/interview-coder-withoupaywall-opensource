/**
 * AudioCaptureService - Platform-agnostic audio capture with source selection
 * Supports: System audio (loopback), Per-app audio, VU metering
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export type AudioSourceType = 'system' | 'app' | 'microphone';

export interface AudioSource {
    id: string;
    name: string;
    type: AudioSourceType;
    icon?: string;
}

export interface AudioCaptureConfig {
    sourceType: AudioSourceType;
    sourceId?: string;          // App ID for per-app capture
    sampleRate: number;         // Target: 16000Hz
    channels: number;           // Target: 1 (mono)
    chunkMs: number;            // Chunk duration for processing
}

export interface AudioChunk {
    buffer: Float32Array;
    timestamp: number;
    duration: number;
    level: number;              // RMS level 0-1
}

const DEFAULT_CONFIG: AudioCaptureConfig = {
    sourceType: 'system',
    sampleRate: 16000,
    channels: 1,
    chunkMs: 300
};

type AudioContextGlobal = typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
};

export class AudioCaptureService extends EventEmitter {
    private config: AudioCaptureConfig;
    private mediaStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private chunkBuffer: Float32Array[] = [];
    private isCapturing: boolean = false;
    private levelInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<AudioCaptureConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get available audio sources
     */
    public async getAvailableSources(): Promise<AudioSource[]> {
        const sources: AudioSource[] = [];

        // System audio source
        sources.push({
            id: 'system-loopback',
            name: 'System Audio (All)',
            type: 'system'
        });

        // Get running apps with audio (platform-specific)
        try {
            const appSources = await this.getAppAudioSources();
            sources.push(...appSources);
        } catch (err) {
            log.warn('Failed to get app audio sources:', err);
        }

        return sources;
    }

    /**
     * Platform-specific: Get apps that are producing audio
     */
    private async getAppAudioSources(): Promise<AudioSource[]> {
        // This will be implemented with native modules for per-app capture
        // For now, return empty - will use system audio
        return [];
    }

    /**
     * Start audio capture from selected source
     */
    public async start(sourceId?: string): Promise<void> {
        if (this.isCapturing) {
            await this.stop();
        }

        try {
            log.info(`Starting audio capture: source=${sourceId || 'system'}`);

            // For now, use system audio via desktopCapturer
            // This will be enhanced with native WASAPI for true loopback
            this.mediaStream = await this.captureSystemAudio();

            await this.setupAudioProcessing();
            this.isCapturing = true;

            this.emit('started');
            log.info('Audio capture started successfully');
        } catch (error) {
            log.error('Failed to start audio capture:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Capture system audio using Electron's desktopCapturer
     */
    private async captureSystemAudio(): Promise<MediaStream> {
        // In renderer process, we'll use getDisplayMedia
        // This is a fallback - real implementation uses IPC to main process

        // For Electron main process, we need to use native modules
        // This placeholder will be replaced with proper WASAPI/ScreenCaptureKit

        throw new Error('System audio capture requires IPC call to main process');
    }

    /**
     * Setup audio processing pipeline
     */
    private async setupAudioProcessing(): Promise<void> {
        if (!this.mediaStream) {
            throw new Error('No media stream available');
        }

        const audioContextCtor =
            globalThis.AudioContext || (globalThis as AudioContextGlobal).webkitAudioContext;
        if (!audioContextCtor) {
            throw new Error('AudioContext is not available in this environment');
        }
        this.audioContext = new audioContextCtor({ sampleRate: this.config.sampleRate });

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Analyser for VU meter
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3;

        // Processor for chunking
        const bufferSize = Math.floor(this.config.sampleRate * this.config.chunkMs / 1000);
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        this.processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const chunk = new Float32Array(inputData);

            const level = this.calculateRMS(chunk);

            const audioChunk: AudioChunk = {
                buffer: chunk,
                timestamp: Date.now(),
                duration: this.config.chunkMs,
                level
            };

            this.emit('chunk', audioChunk);
        };

        // Connect nodes
        source.connect(this.analyser);
        this.analyser.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        // Start level monitoring
        this.startLevelMonitoring();
    }

    /**
     * Calculate RMS level of audio buffer
     */
    private calculateRMS(buffer: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     * Start VU meter level monitoring
     */
    private startLevelMonitoring(): void {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.levelInterval = setInterval(() => {
            if (!this.analyser) return;

            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const level = Math.min(1, average / 128);

            this.emit('level', level);
        }, 50);
    }

    /**
     * Stop audio capture
     */
    public async stop(): Promise<void> {
        log.info('Stopping audio capture');

        if (this.levelInterval) {
            clearInterval(this.levelInterval);
            this.levelInterval = null;
        }

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        this.isCapturing = false;
        this.emit('stopped');
    }

    /**
     * Check if currently capturing
     */
    public isActive(): boolean {
        return this.isCapturing;
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<AudioCaptureConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

export const audioCaptureService = new AudioCaptureService();
