/**
 * AudioCaptureService - Captures audio from various sources
 * Supports: microphone, system audio, specific application
 */

export type AudioSourceType = 'microphone' | 'system' | 'application';

export interface AudioCaptureConfig {
    sourceType: AudioSourceType;
    applicationSourceId?: string; // For specific app capture
    chunkIntervalMs?: number; // How often to send chunks (default: 3000ms)
}

export interface AudioChunk {
    data: Blob;
    timestamp: number;
    duration: number;
}

type AudioChunkCallback = (chunk: AudioChunk) => void;
type ErrorCallback = (error: Error) => void;
type LevelCallback = (level: number) => void;

export class AudioCaptureService {
    private mediaStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private isCapturing = false;
    private config: AudioCaptureConfig;
    private chunkStartTime = 0;
    private onChunk: AudioChunkCallback | null = null;
    private onError: ErrorCallback | null = null;
    private onLevel: LevelCallback | null = null;
    private levelInterval: NodeJS.Timeout | null = null;

    constructor(config: AudioCaptureConfig) {
        this.config = {
            chunkIntervalMs: 3000, // 3 seconds default
            ...config
        };
    }

    /**
     * Start capturing audio from configured source
     */
    async start(
        onChunk: AudioChunkCallback,
        onError: ErrorCallback,
        onLevel?: LevelCallback
    ): Promise<void> {
        if (this.isCapturing) {
            throw new Error('Already capturing audio');
        }

        this.onChunk = onChunk;
        this.onError = onError;
        this.onLevel = onLevel || null;

        try {
            this.mediaStream = await this.getMediaStream();
            this.setupAudioAnalyser();
            this.setupMediaRecorder();
            this.isCapturing = true;
            console.log('Audio capture started:', this.config.sourceType);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.onError(err);
            throw err;
        }
    }

    /**
     * Stop capturing audio
     */
    stop(): void {
        if (!this.isCapturing) return;

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.levelInterval) {
            clearInterval(this.levelInterval);
            this.levelInterval = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;
        this.mediaRecorder = null;
        this.isCapturing = false;
        console.log('Audio capture stopped');
    }

    /**
     * Check if currently capturing
     */
    get capturing(): boolean {
        return this.isCapturing;
    }

    /**
     * Get the media stream based on source type
     */
    private async getMediaStream(): Promise<MediaStream> {
        switch (this.config.sourceType) {
            case 'microphone':
                return this.getMicrophoneStream();
            case 'system':
                return this.getSystemAudioStream();
            case 'application':
                return this.getApplicationAudioStream();
            default:
                throw new Error(`Unknown source type: ${this.config.sourceType}`);
        }
    }

    /**
     * Get microphone audio stream
     */
    private async getMicrophoneStream(): Promise<MediaStream> {
        return navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
    }

    /**
     * Get system audio stream (requires screen share permission)
     */
    private async getSystemAudioStream(): Promise<MediaStream> {
        // In Electron, we need to use desktopCapturer for system audio
        // This is a simplified version - actual implementation may need
        // to use electron's desktopCapturer API
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: {
                    // @ts-expect-error - Electron specific options
                    mandatory: {
                        chromeMediaSource: 'desktop'
                    }
                },
                video: {
                    // @ts-expect-error - Electron specific options
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        maxWidth: 1,
                        maxHeight: 1,
                        maxFrameRate: 1
                    }
                }
            });

            // Remove video track as we only need audio
            stream.getVideoTracks().forEach(track => {
                track.stop();
                stream.removeTrack(track);
            });

            return stream;
        } catch {
            // Fallback: try to get audio-only if supported
            console.warn('System audio capture failed, trying fallback...');
            throw new Error('System audio capture requires screen share permission');
        }
    }

    /**
     * Get specific application audio stream
     */
    private async getApplicationAudioStream(): Promise<MediaStream> {
        if (!this.config.applicationSourceId) {
            throw new Error('Application source ID is required for app capture');
        }

        // Use Electron's desktopCapturer to get specific window audio
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // @ts-expect-error - Electron specific options
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: this.config.applicationSourceId
                    }
                },
                video: false
            });
            return stream;
        } catch {
            // Fallback to system audio with app-specific filtering (simplified)
            console.warn('App-specific capture failed, falling back to system audio');
            return this.getSystemAudioStream();
        }
    }

    /**
     * Setup audio analyser for level monitoring
     */
    private setupAudioAnalyser(): void {
        if (!this.mediaStream || !this.onLevel) return;

        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        // Start level monitoring
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.levelInterval = setInterval(() => {
            if (this.analyser) {
                this.analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                this.onLevel?.(Math.min(100, (average / 128) * 100));
            }
        }, 100);
    }

    /**
     * Setup media recorder for chunked recording
     */
    private setupMediaRecorder(): void {
        if (!this.mediaStream) return;

        // Use WebM for browser compatibility, or WAV if available
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

        this.mediaRecorder = new MediaRecorder(this.mediaStream, {
            mimeType,
            audioBitsPerSecond: 128000
        });

        const chunks: Blob[] = [];
        this.chunkStartTime = Date.now();

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: mimeType });
                const duration = Date.now() - this.chunkStartTime;
                this.onChunk?.({
                    data: blob,
                    timestamp: this.chunkStartTime,
                    duration
                });
            }
        };

        // Start recording with timed chunks
        this.mediaRecorder.start();

        // Set up chunking interval
        const sendChunk = () => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                chunks.length = 0;
                this.chunkStartTime = Date.now();
                this.mediaRecorder.start();
            }
        };

        setInterval(sendChunk, this.config.chunkIntervalMs);
    }
}

// Singleton for easy access
let instance: AudioCaptureService | null = null;

export function getAudioCaptureService(config?: AudioCaptureConfig): AudioCaptureService {
    if (!instance && config) {
        instance = new AudioCaptureService(config);
    }
    if (!instance) {
        throw new Error('AudioCaptureService not initialized. Call with config first.');
    }
    return instance;
}

export function resetAudioCaptureService(): void {
    if (instance) {
        instance.stop();
        instance = null;
    }
}
