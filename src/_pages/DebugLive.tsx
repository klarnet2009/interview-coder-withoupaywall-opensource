import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic, MicOff, Volume2, VolumeX, Loader2, AlertCircle,
    Settings, Monitor, Terminal, Activity, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

interface LogEntry {
    timestamp: string;
    type: 'info' | 'error' | 'transcript' | 'response' | 'state';
    message: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const DebugLive: React.FC = () => {
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState<LiveInterviewStatus>({
        state: 'idle',
        transcript: '',
        response: '',
        audioLevel: 0
    });

    // Configuration
    const [modelName, setModelName] = useState(DEFAULT_MODEL);
    const [audioSource, setAudioSource] = useState<AudioSourceType>('system');
    const [apiKeyOverride, setApiKeyOverride] = useState('');
    const [opaqueMode, setOpaqueMode] = useState(false);
    const [spokenLanguage, setSpokenLanguage] = useState('en');

    // Logs
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const AudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        setLogs(prev => [...prev, {
            timestamp: new Date().toISOString().split('T')[1].slice(0, -1),
            type,
            message
        }].slice(-100)); // Keep last 100 logs
    }, []);

    // Subscribe to events
    useEffect(() => {
        const unsubStatus = window.electronAPI.onLiveInterviewStatus((newStatus: LiveInterviewStatus) => {
            setStatus(newStatus);
        });

        const unsubState = window.electronAPI.onLiveInterviewState((state: ListeningState) => {
            setStatus(prev => ({ ...prev, state }));
            addLog('state', `State changed to: ${state}`);
        });

        const unsubError = window.electronAPI.onLiveInterviewError((errorMsg: string) => {
            addLog('error', errorMsg);
            setStatus(prev => ({ ...prev, state: 'error' }));
        });

        addLog('info', 'Debug Console Ready');

        return () => {
            unsubStatus();
            unsubState();
            unsubError();
            stopAudioCapture();
        };
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    /**
     * Start audio capture
     */
    const startAudioCapture = async (source: AudioSourceType) => {
        try {
            let stream: MediaStream;
            addLog('info', `Starting audio capture: ${source}`);

            if (source === 'system') {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: {
                        // @ts-ignore
                        systemAudio: 'include',
                        suppressLocalAudioPlayback: false,
                    } as any
                });
                stream.getVideoTracks().forEach(track => track.stop());
            } else {
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
            AudioContextRef.current = new AudioContext({ sampleRate: 16000 });

            const audioSource = AudioContextRef.current.createMediaStreamSource(stream);
            const bufferSize = 1024;
            const processor = AudioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

            processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);

                // Calculate level
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const level = Math.sqrt(sum / inputData.length);

                // Convert to PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Send to main process
                const uint8Array = new Uint8Array(pcmData.buffer);
                const binary = String.fromCharCode.apply(null, Array.from(uint8Array));
                const base64 = btoa(binary);

                window.electronAPI.liveInterviewSendAudio(base64, level);
            };

            audioSource.connect(processor);
            processor.connect(AudioContextRef.current.destination);
            processorRef.current = processor;

            addLog('info', 'Audio capture started successfully');
        } catch (err: any) {
            addLog('error', `Audio capture failed: ${err.message}`);
            throw err;
        }
    };

    const stopAudioCapture = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (AudioContextRef.current) {
            AudioContextRef.current.close();
            AudioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        addLog('info', 'Audio capture stopped');
    };

    const handleToggle = useCallback(async () => {
        if (isActive) {
            stopAudioCapture();
            await window.electronAPI.liveInterviewStop();
            setIsActive(false);
            setStatus({ state: 'idle', transcript: '', response: '', audioLevel: 0 });
        } else {
            try {
                addLog('info', `Connecting to Gemini with model: ${modelName}, language: ${spokenLanguage}`);
                const result = await window.electronAPI.liveInterviewStart({
                    modelName,
                    apiKeyOverride: apiKeyOverride || undefined,
                    spokenLanguage,
                });

                if (result.success) {
                    await startAudioCapture(audioSource);
                    setIsActive(true);
                } else {
                    addLog('error', result.error || 'Failed to start');
                }
            } catch (err: any) {
                addLog('error', err.message);
            }
        }
    }, [isActive, modelName, audioSource, spokenLanguage]);

    return (
        <div className={`flex h-screen text-gray-300 font-sans overflow-hidden ${opaqueMode ? 'bg-[#0D1117]' : 'bg-[#0D1117]/90'}`}>
            {/* Sidebar / Controls */}
            <div className="w-80 bg-[#161B22] border-r border-white/10 flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        Debug Live
                    </h2>
                    <button onClick={() => navigate('/')} className="text-xs hover:text-white">
                        Exit
                    </button>
                </div>

                <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                    {/* Connection Config */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                            <Settings className="w-4 h-4" />
                            Configuration
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Model Name</label>
                            <input
                                type="text"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                className="w-full bg-[#0D1117] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">API Key (override)</label>
                            <input
                                type="password"
                                value={apiKeyOverride}
                                onChange={(e) => setApiKeyOverride(e.target.value)}
                                placeholder="Leave empty to use saved key"
                                className="w-full bg-[#0D1117] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none placeholder:text-gray-600"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Audio Source</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setAudioSource('system')}
                                    className={`flex items-center justify-center gap-2 py-2 rounded text-xs border ${audioSource === 'system'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-[#0D1117] border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <Monitor className="w-3 h-3" /> System
                                </button>
                                <button
                                    onClick={() => setAudioSource('microphone')}
                                    className={`flex items-center justify-center gap-2 py-2 rounded text-xs border ${audioSource === 'microphone'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-[#0D1117] border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <Mic className="w-3 h-3" /> Mic
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Spoken Language</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { code: 'en', label: '🇬🇧 English' },
                                    { code: 'ru', label: '🇷🇺 Russian' },
                                    { code: 'lv', label: '🇱🇻 Latvian' },
                                    { code: 'de', label: '🇩🇪 German' },
                                ].map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setSpokenLanguage(lang.code)}
                                        className={`flex items-center justify-center gap-1 py-1.5 rounded text-xs border ${spokenLanguage === lang.code
                                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                            : 'bg-[#0D1117] border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {lang.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Opaque Mode */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                                {opaqueMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                <span>Opaque Mode</span>
                            </div>
                            <button
                                onClick={() => {
                                    const newOpaque = !opaqueMode;
                                    setOpaqueMode(newOpaque);
                                    window.electronAPI.setWindowOpacity(newOpaque ? 1.0 : 0.85);
                                }}
                                className={`relative w-10 h-5 rounded-full transition-colors ${opaqueMode ? 'bg-blue-500' : 'bg-gray-600'
                                    }`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${opaqueMode ? 'translate-x-5' : 'translate-x-0'
                                    }`} />
                            </button>
                        </div>
                    </div>

                    {/* Status Panel */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Status</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                                }`}>
                                {status.state}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Audio Level</span>
                                <span>{(status.audioLevel * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-2 bg-[#0D1117] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-75"
                                    style={{ width: `${Math.min(100, status.audioLevel * 500)}%` }} // Amplify for visibility
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleToggle}
                        disabled={status.state === 'connecting'}
                        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${isActive
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            }`}
                    >
                        {status.state === 'connecting' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isActive ? (
                            <>Stop Session</>
                        ) : (
                            <>Start Debug Session</>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col">
                {/* Visualizer Panel */}
                <div className="h-1/2 p-6 flex flex-col gap-4 border-b border-white/10 overflow-hidden">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Terminal className="w-4 h-4" />
                        Real-time Interaction
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-4 h-full">
                        {/* User Transcript */}
                        <div className="bg-[#161B22] rounded-lg border border-white/10 p-4 overflow-y-auto">
                            <h3 className="text-xs font-bold text-blue-400 mb-2 uppercase tracking-wider">Input (Transcript)</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{status.transcript || <span className="text-gray-600 italic">Waiting for speech...</span>}</p>
                        </div>

                        {/* Model Response */}
                        <div className="bg-[#161B22] rounded-lg border border-white/10 p-4 overflow-y-auto">
                            <h3 className="text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">Output (Model)</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{status.response || <span className="text-gray-600 italic">Waiting for response...</span>}</p>
                        </div>
                    </div>
                </div>

                {/* Logs Console */}
                <div className="flex-1 bg-black p-4 font-mono text-xs overflow-y-auto">
                    <div className="flex items-center gap-2 text-gray-500 mb-2 pb-2 border-b border-white/10">
                        <ArrowRight className="w-3 h-3" />
                        Event Log
                    </div>
                    <div className="space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-3 hover:bg-white/5 p-0.5 rounded">
                                <span className="text-gray-600 select-none">{log.timestamp}</span>
                                <span className={`uppercase w-16 shrink-0 font-bold ${log.type === 'error' ? 'text-red-500' :
                                    log.type === 'state' ? 'text-yellow-500' :
                                        log.type === 'transcript' ? 'text-blue-500' :
                                            log.type === 'response' ? 'text-purple-500' :
                                                'text-gray-400'
                                    }`}>{log.type}</span>
                                <span className="text-gray-300 break-all">{log.message}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugLive;
