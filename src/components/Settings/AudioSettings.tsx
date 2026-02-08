import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Monitor, Headphones, Check, RefreshCw, Search, Volume2, Loader2 } from "lucide-react";

type AudioSource = 'microphone' | 'system' | 'application';

interface AudioSourceItem {
    id: string;
    name: string;
    appIcon: string | null;
}

interface AudioSettingsProps {
    audioSource: AudioSource;
    applicationName: string;
    apiKey?: string; // API key for audio recognition test
    onAudioSourceChange: (source: AudioSource) => void;
    onApplicationChange: (appName: string) => void;
}

export function AudioSettings({
    audioSource,
    applicationName,
    apiKey,
    onAudioSourceChange,
    onApplicationChange
}: AudioSettingsProps) {
    const { t } = useTranslation();
    const [availableWindows, setAvailableWindows] = useState<AudioSourceItem[]>([]);
    const [isLoadingWindows, setIsLoadingWindows] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Test audio state
    const [isTesting, setIsTesting] = useState(false);
    const [testCountdown, setTestCountdown] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [testResult, setTestResult] = useState<{ success: boolean; text?: string; transcript?: string; error?: string } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const AUDIO_SOURCES = [
        {
            id: 'microphone' as const,
            title: t('settings.audio.microphone'),
            description: t('settings.audio.microphoneDesc'),
            icon: Mic
        },
        {
            id: 'system' as const,
            title: t('settings.audio.system'),
            description: t('settings.audio.systemDesc'),
            icon: Monitor,
            recommended: true
        },
        {
            id: 'application' as const,
            title: t('settings.audio.application'),
            description: t('settings.audio.applicationDesc'),
            icon: Headphones
        }
    ];

    useEffect(() => {
        if (audioSource === 'application') {
            fetchAudioSources();
        }
    }, [audioSource]);

    const fetchAudioSources = async () => {
        setIsLoadingWindows(true);
        try {
            const sources = await window.electronAPI.getAudioSources();
            setAvailableWindows(sources);
        } catch (error) {
            console.error('Error fetching audio sources:', error);
        } finally {
            setIsLoadingWindows(false);
        }
    };

    const filteredWindows = availableWindows.filter(window =>
        window.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const commonApps = ['Zoom', 'Teams', 'Meet', 'Chrome', 'Edge', 'Firefox', 'Discord', 'Slack'];
    const quickSelectApps = availableWindows.filter(w =>
        commonApps.some(app => w.name.toLowerCase().includes(app.toLowerCase()))
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Test audio function
    const testAudioRecognition = async () => {
        setIsTesting(true);
        setTestResult(null);
        setTestCountdown(5);
        setAudioLevel(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: false
            });

            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            levelIntervalRef.current = setInterval(() => {
                if (analyserRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setAudioLevel(Math.min(100, (average / 128) * 100));
                }
            }, 100);

            for (let i = 5; i > 0; i--) {
                setTestCountdown(i);
                await new Promise(r => setTimeout(r, 1000));
            }

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            const recordingPromise = new Promise<Blob>((resolve) => {
                mediaRecorder.onstop = () => {
                    resolve(new Blob(chunks, { type: mimeType }));
                };
            });

            mediaRecorder.start();
            setTestCountdown(-1);

            await new Promise(r => setTimeout(r, 3000));
            mediaRecorder.stop();

            const audioBlob = await recordingPromise;

            if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
            stream.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) audioContextRef.current.close();
            setAudioLevel(0);

            setTestCountdown(-2);
            const arrayBuffer = await audioBlob.arrayBuffer();
            const buffer = Array.from(new Uint8Array(arrayBuffer));

            const result = await window.electronAPI.testAudio({
                buffer,
                mimeType,
                apiKey
            });

            setTestResult(result);
        } catch (error) {
            console.error('Audio test error:', error);
            setTestResult({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to access microphone'
            });
        } finally {
            setIsTesting(false);
            setTestCountdown(0);
        }
    };

    return (
        <div className="space-y-3">
            <label className="text-sm font-medium text-white">{t('settings.audio.title')}</label>
            <p className="text-xs text-white/60 -mt-2 mb-2">
                {t('settings.audio.selectSource')}
            </p>

            {/* Source selection */}
            <div className="flex gap-2">
                {AUDIO_SOURCES.map((source) => (
                    <div
                        key={source.id}
                        onClick={() => onAudioSourceChange(source.id)}
                        className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-all ${audioSource === source.id
                            ? 'bg-white/10 border border-white/20'
                            : 'bg-black/30 border border-white/5 hover:bg-white/5'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${audioSource === source.id ? 'bg-white/20' : 'bg-white/5'
                            }`}>
                            <source.icon className={`w-4 h-4 ${audioSource === source.id ? 'text-white' : 'text-white/50'
                                }`} />
                        </div>
                        <span className={`text-xs font-medium text-center ${audioSource === source.id ? 'text-white' : 'text-white/70'
                            }`}>
                            {source.title}
                        </span>
                        {source.recommended && (
                            <span className="text-[8px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded">
                                {t('settings.audio.recommended')}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Application selector */}
            {audioSource === 'application' && (
                <div className="p-3 rounded-lg bg-white/3 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/80">{t('settings.audio.selectApp')}</span>
                        <button
                            onClick={fetchAudioSources}
                            disabled={isLoadingWindows}
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title={t('settings.audio.refreshList')}
                        >
                            <RefreshCw className={`w-3 h-3 ${isLoadingWindows ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Quick select */}
                    {quickSelectApps.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {quickSelectApps.slice(0, 4).map((app) => (
                                <button
                                    key={app.id}
                                    onClick={() => onApplicationChange(app.name)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${applicationName === app.name
                                        ? 'bg-white/20 text-white border border-white/30'
                                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                                        }`}
                                >
                                    {app.appIcon && (
                                        <img src={app.appIcon} alt="" className="w-3 h-3 rounded" />
                                    )}
                                    <span className="truncate max-w-[80px]">{app.name}</span>
                                    {applicationName === app.name && <Check className="w-2 h-2" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search & list */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('settings.audio.searchApps')}
                            className="w-full pl-7 pr-2 py-1.5 bg-black/50 border border-white/10 rounded text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                        />
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
                    </div>

                    <div className="max-h-[120px] overflow-y-auto space-y-1">
                        {isLoadingWindows ? (
                            <div className="flex items-center justify-center py-4">
                                <RefreshCw className="w-4 h-4 text-white/40 animate-spin" />
                            </div>
                        ) : filteredWindows.length === 0 ? (
                            <div className="text-center py-2 text-xs text-white/40">
                                {searchQuery ? t('settings.audio.noMatches') : t('settings.audio.noApps')}
                            </div>
                        ) : (
                            filteredWindows.slice(0, 10).map((window) => (
                                <button
                                    key={window.id}
                                    onClick={() => onApplicationChange(window.name)}
                                    className={`w-full flex items-center gap-2 p-2 rounded text-left transition-all ${applicationName === window.name
                                        ? 'bg-white/10 border border-white/20'
                                        : 'bg-white/2 border border-transparent hover:bg-white/5'
                                        }`}
                                >
                                    {window.appIcon ? (
                                        <img src={window.appIcon} alt="" className="w-4 h-4 rounded" />
                                    ) : (
                                        <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center text-[8px]">
                                            {window.name.charAt(0)}
                                        </div>
                                    )}
                                    <span className={`text-xs truncate flex-1 ${applicationName === window.name ? 'text-white' : 'text-white/70'
                                        }`}>
                                        {window.name}
                                    </span>
                                    {applicationName === window.name && (
                                        <Check className="w-3 h-3 text-white" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {applicationName && (
                        <div className="flex items-center gap-1 p-2 rounded bg-green-500/10 border border-green-500/20">
                            <Check className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-green-400 truncate">{t('settings.audio.selected', { name: applicationName })}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Audio Test Section */}
            <div className="p-3 rounded-lg bg-white/3 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-white/60" />
                        <span className="text-sm font-medium text-white/80">{t('settings.audio.testTitle')}</span>
                    </div>
                    <button
                        onClick={testAudioRecognition}
                        disabled={isTesting}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isTesting ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {testCountdown > 0 ? t('settings.audio.startingIn', { count: testCountdown }) :
                                    testCountdown === -1 ? t('settings.audio.recording') :
                                        testCountdown === -2 ? t('settings.audio.processing') : t('settings.audio.testing')}
                            </>
                        ) : (
                            <>
                                <Mic className="w-3 h-3" />
                                {t('settings.audio.testButton')}
                            </>
                        )}
                    </button>
                </div>

                {/* VU Meter */}
                {isTesting && (
                    <div className="space-y-1">
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-100 rounded-full ${audioLevel > 80 ? 'bg-red-500' :
                                    audioLevel > 50 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                    }`}
                                style={{ width: `${audioLevel}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-white/40">
                            <span>{t('settings.audio.quiet')}</span>
                            <span>{t('settings.audio.optimal')}</span>
                            <span>{t('settings.audio.loud')}</span>
                        </div>
                        <p className="text-xs text-white/50 text-center">
                            {testCountdown > 0 ? t('settings.audio.speakWhenReady') :
                                testCountdown === -1 ? t('settings.audio.speakNow') :
                                    testCountdown === -2 ? t('settings.audio.sendingToAI') : ''}
                        </p>
                    </div>
                )}

                {/* Test Result */}
                {testResult && (
                    <div className={`p-3 rounded-lg border ${testResult.success
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                        }`}>
                        {testResult.success ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="w-4 h-4 text-green-400" />
                                    <span className="text-sm font-medium text-green-400">{t('settings.audio.recognitionSuccess')}</span>
                                </div>
                                <p className="text-sm text-white/80 bg-black/30 p-2 rounded">
                                    "{testResult.transcript || testResult.text}"
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-red-400">{t('settings.audio.testFailed')}</span>
                                </div>
                                <p className="text-xs text-red-300/70">{testResult.error}</p>
                            </>
                        )}
                    </div>
                )}

                <p className="text-xs text-white/40">
                    {t('settings.audio.testHint')}
                </p>
            </div>
        </div>
    );
}
