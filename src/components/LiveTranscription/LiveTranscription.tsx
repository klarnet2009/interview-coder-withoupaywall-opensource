import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";

interface LiveTranscriptionProps {
    isActive: boolean;
    onToggle: () => void;
}

export function LiveTranscription({ isActive, onToggle }: LiveTranscriptionProps) {
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcript, setTranscript] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);

    // Start/stop audio capture based on isActive
    useEffect(() => {
        if (isActive) {
            startAudioCapture();
        } else {
            stopAudioCapture();
        }
        return () => {
            stopAudioCapture();
        };
    }, [isActive]);

    // Auto-scroll transcript
    useEffect(() => {
        if (transcriptContainerRef.current) {
            transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
    }, [transcript]);

    const startAudioCapture = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;

            // Setup audio analysis for VU meter
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            analyserRef.current = analyser;
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            // Update audio level periodically
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            levelIntervalRef.current = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(Math.min(100, (average / 128) * 100));
            }, 50);

            // Setup MediaRecorder for chunks
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            let chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (chunks.length > 0) {
                    const audioBlob = new Blob(chunks, { type: mimeType });
                    chunks = [];
                    await processAudioChunk(audioBlob, mimeType);
                }
            };

            // Record in 5-second chunks
            const recordChunk = () => {
                if (mediaRecorderRef.current && streamRef.current) {
                    mediaRecorder.start();
                    setTimeout(() => {
                        if (mediaRecorderRef.current?.state === 'recording') {
                            mediaRecorderRef.current.stop();
                            // Start next chunk after a brief pause
                            setTimeout(recordChunk, 100);
                        }
                    }, 5000);
                }
            };
            recordChunk();

        } catch (err) {
            console.error('Failed to start audio capture:', err);
            setError('Failed to access microphone');
        }
    };

    const stopAudioCapture = () => {
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
            levelIntervalRef.current = null;
        }
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setAudioLevel(0);
    };

    const processAudioChunk = async (audioBlob: Blob, mimeType: string) => {
        setIsProcessing(true);
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const buffer = Array.from(new Uint8Array(arrayBuffer));

            const result = await window.electronAPI.transcribeAudio({
                buffer,
                mimeType
            });

            if (result.success && result.text) {
                const text = result.text.trim();
                if (text && text !== '[SILENCE]' && text !== '[NO RESPONSE]') {
                    setTranscript(prev => [...prev, text]);
                }
            } else if (result.error) {
                console.error('Transcription error:', result.error);
            }
        } catch (err) {
            console.error('Failed to process audio:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header with toggle and VU meter */}
            <div className="flex items-center gap-3 p-3 bg-black/20 border-b border-white/10">
                <button
                    onClick={onToggle}
                    className={`p-2 rounded-lg transition-all ${isActive
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                >
                    {isActive ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <Volume2 size={14} className="text-white/50" />
                        <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                                style={{ width: `${audioLevel}%` }}
                            />
                        </div>
                        <span className="text-xs text-white/50 w-8 text-right">
                            {Math.round(audioLevel)}%
                        </span>
                    </div>
                </div>

                {isProcessing && (
                    <Loader2 size={16} className="text-blue-400 animate-spin" />
                )}
            </div>

            {/* Transcript area */}
            <div
                ref={transcriptContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-2"
            >
                {error && (
                    <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {transcript.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-white/40">
                        <Mic size={32} className="mb-2" />
                        <p className="text-sm">
                            {isActive
                                ? 'Listening for speech...'
                                : 'Click the microphone to start'}
                        </p>
                    </div>
                )}

                {transcript.map((text, index) => (
                    <div
                        key={index}
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm"
                    >
                        {text}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LiveTranscription;
