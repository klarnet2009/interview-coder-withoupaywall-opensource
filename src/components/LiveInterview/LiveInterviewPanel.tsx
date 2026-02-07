/**
 * LiveInterviewPanel - Real-time interview assistance UI
 * Captures audio from selected source and sends to Gemini via IPC
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, VolumeX, Loader2, AlertCircle, Monitor, Bug } from 'lucide-react';

type ListeningState =
    | 'idle'
    | 'connecting'
    | 'listening'
    | 'no_signal'
    | 'transcribing'
    | 'generating'
    | 'error';

type AudioSourceType = 'system' | 'microphone';

interface LiveInterviewStatus {
    state: ListeningState;
    transcript: string;
    response: string;
    audioLevel: number;
    error?: string;
}

const stateLabels: Record<ListeningState, string> = {
    idle: 'Ready to listen',
    connecting: 'Connecting...',
    listening: 'Listening...',
    no_signal: 'No audio detected',
    transcribing: 'Transcribing...',
    generating: 'Generating response...',
    error: 'Error'
};

const stateColors: Record<ListeningState, string> = {
    idle: 'bg-gray-500',
    connecting: 'bg-yellow-500',
    listening: 'bg-green-500',
    no_signal: 'bg-orange-500',
    transcribing: 'bg-blue-500',
    generating: 'bg-purple-500',
    error: 'bg-red-500'
};

export const LiveInterviewPanel: React.FC = () => {
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [audioSource, setAudioSource] = useState<AudioSourceType>('system');
    const [status, setStatus] = useState<LiveInterviewStatus>({
        state: 'idle',
        transcript: '',
        response: '',
        audioLevel: 0
    });
    const [error, setError] = useState<string | null>(null);
    const [localAudioLevel, setLocalAudioLevel] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // Subscribe to live interview events
    useEffect(() => {
        const unsubStatus = window.electronAPI.onLiveInterviewStatus((newStatus: LiveInterviewStatus) => {
            setStatus(newStatus);
        });

        const unsubState = window.electronAPI.onLiveInterviewState((state: ListeningState) => {
            setStatus(prev => ({ ...prev, state }));
        });

        const unsubError = window.electronAPI.onLiveInterviewError((errorMsg: string) => {
            setError(errorMsg);
            setStatus(prev => ({ ...prev, state: 'error' }));
        });

        return () => {
            unsubStatus();
            unsubState();
            unsubError();
        };
    }, []);


    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAudioCapture();
        };
    }, []);

    /**
     * Start audio capture from selected source
     */
    const startAudioCapture = async (source: AudioSourceType) => {
        try {
            let stream: MediaStream;

            if (source === 'system') {
                // Capture system audio via getDisplayMedia
                // User will select a tab/window - audio from that will be captured
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true, // Required but we'll discard it
                    audio: {
                        // @ts-ignore - systemAudio is newer API
                        systemAudio: 'include',
                        suppressLocalAudioPlayback: false,
                    } as any
                });

                // Stop video track - we only need audio
                stream.getVideoTracks().forEach(track => track.stop());

                if (stream.getAudioTracks().length === 0) {
                    throw new Error('No audio - select a tab/window with audio enabled');
                }
            } else {
                // Capture microphone
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
            }

            mediaStreamRef.current = stream;
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });

            const audioSource = audioContextRef.current.createMediaStreamSource(stream);
            const bufferSize = 1024; // ~256ms at 16kHz
            const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

            processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);

                // Calculate audio level
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const level = Math.sqrt(sum / inputData.length);
                setLocalAudioLevel(level);

                // Convert Float32 to Int16 PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert to base64 and send to main process
                const uint8Array = new Uint8Array(pcmData.buffer);
                const binary = String.fromCharCode.apply(null, Array.from(uint8Array));
                const base64 = btoa(binary);

                window.electronAPI.liveInterviewSendAudio(base64, level);
            };

            audioSource.connect(processor);
            processor.connect(audioContextRef.current.destination);
            processorRef.current = processor;

            console.log(`Audio capture started: ${source}`);
        } catch (err: any) {
            console.error('Failed to start audio capture:', err);
            if (err.name === 'NotAllowedError') {
                throw new Error('Permission denied. Please try again and select a source.');
            }
            throw err;
        }
    };

    /**
     * Stop audio capture
     */
    const stopAudioCapture = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setLocalAudioLevel(0);
    };

    /**
     * Switch audio source while active
     */
    const handleSourceChange = async (newSource: AudioSourceType) => {
        setAudioSource(newSource);
        setError(null);

        try {
            // Start Gemini connection first
            const result = await window.electronAPI.liveInterviewStart();

            if (result.success) {
                // Then start audio capture
                await startAudioCapture(newSource);
                setIsActive(true);
            } else {
                setError(result.error || 'Failed to start Gemini connection');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start');
            // Stop Gemini if audio failed
            await window.electronAPI.liveInterviewStop();
        }
    };

    const handleStop = useCallback(async () => {
        stopAudioCapture();
        await window.electronAPI.liveInterviewStop();
        setIsActive(false);
        setStatus({
            state: 'idle',
            transcript: '',
            response: '',
            audioLevel: 0
        });
        setError(null);
    }, []);

    const renderVUMeter = () => {
        const level = Math.min(1, localAudioLevel * 10);
        const bars = 10;

        return (
            <div className="flex items-center gap-0.5 h-4">
                {Array.from({ length: bars }).map((_, i) => {
                    const threshold = i / bars;
                    const isLit = level > threshold;
                    const color = i < 6 ? 'bg-green-500' : i < 8 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                        <div
                            key={i}
                            className={`w-1.5 rounded-sm transition-all duration-75 ${isLit ? color : 'bg-gray-600'}`}
                            style={{ height: `${(i + 1) * 10}%` }}
                        />
                    );
                })}
            </div>
        );
    };

    const renderStateIndicator = () => {
        const isLoading = ['connecting', 'transcribing', 'generating'].includes(status.state);

        return (
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stateColors[status.state]} ${status.state === 'listening' ? 'animate-pulse' : ''
                    }`} />
                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-white/60" />}
                <span className="text-xs text-white/60">{stateLabels[status.state]}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-black/40 rounded-lg overflow-hidden border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-black/30 border-b border-white/10">
                <div className="flex items-center gap-3">
                    {isActive ? (
                        <button
                            onClick={handleStop}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Stop Session"
                        >
                            <MicOff className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="w-5 h-5" /> // Placeholder to keep spacing
                    )}

                    {isActive && (
                        <>
                            {renderVUMeter()}
                            {localAudioLevel > 0.01
                                ? <Volume2 className="w-4 h-4 text-green-400" />
                                : <VolumeX className="w-4 h-4 text-gray-500" />
                            }
                        </>
                    )}
                </div>

                {renderStateIndicator()}

                {/* Debug Mode Button */}
                <button
                    onClick={() => navigate('/debug-live')}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                    title="Open Debug Mode"
                >
                    <Bug className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {isActive ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Transcript */}
                        <div className="flex-1 p-4 overflow-y-auto">
                            {status.transcript ? (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded bg-blue-500/20">
                                            <Volume2 className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs text-blue-300 mb-1 font-medium">Interviewer:</div>
                                            <div className="text-lg text-white leading-relaxed font-light">
                                                {status.transcript}
                                                {status.state === 'transcribing' && (
                                                    <span className="inline-block w-1.5 h-5 ml-1 bg-blue-400 animate-pulse align-middle" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                                        <div className="w-3 h-3 rounded-full bg-green-500" />
                                    </div>
                                    <div className="text-white/40 text-sm">
                                        Listening for interviewer...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-3 text-red-400 max-w-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span className="text-sm text-left">{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h2 className="text-2xl font-light text-white tracking-tight">Ready to Start?</h2>
                            <p className="text-white/40 text-sm max-w-xs">
                                Select your audio source and start the session to get real-time assistance.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                            <button
                                onClick={() => handleSourceChange('system')}
                                className="group flex flex-col items-center gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-green-500/50 transition-all text-white/60 hover:text-white"
                            >
                                <div className="p-4 rounded-full bg-white/5 group-hover:bg-green-500/20 group-hover:text-green-400 transition-colors">
                                    <Monitor className="w-8 h-8" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">Window Audio</span>
                                    <span className="text-[10px] text-white/30">Zoom, Meet, Teams</span>
                                </div>
                            </button>

                            <button
                                onClick={() => handleSourceChange('microphone')}
                                className="group flex flex-col items-center gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-green-500/50 transition-all text-white/60 hover:text-white"
                            >
                                <div className="p-4 rounded-full bg-white/5 group-hover:bg-green-500/20 group-hover:text-green-400 transition-colors">
                                    <Mic className="w-8 h-8" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">Microphone</span>
                                    <span className="text-[10px] text-white/30">Local voice capture</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveInterviewPanel;
