/**
 * UnifiedPanel - Single compact panel combining:
 * - Screenshot controls (from QueueCommands)
 * - Audio capture controls (from LiveInterviewPanel)
 * - Transcript display (from LiveInterviewPanel)
 * - AI Suggestions (from ResponsePanel)
 * - Settings tooltip (from QueueCommands)
 * - Screenshot thumbnails (from ScreenshotQueue)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import {
    Camera, Play, Mic, MicOff, Square, Volume2, VolumeX,
    Loader2, AlertCircle, Monitor, Bug, Settings, ChevronUp,
    ChevronDown, Sparkles, LogOut, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import ScreenshotQueue from '../Queue/ScreenshotQueue';
import { LanguageSelector } from '../shared/LanguageSelector';
import { useToast } from '../../contexts/toast';
import { COMMAND_KEY } from '../../utils/platform';
import { Screenshot } from '../../types/screenshots';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface UnifiedPanelProps {
    screenshots: Screenshot[];
    onDeleteScreenshot: (index: number) => void;
    screenshotCount: number;
    credits: number;
    currentLanguage: string;
    setLanguage: (language: string) => void;
    onTooltipVisibilityChange: (visible: boolean, height: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const stateLabels: Record<ListeningState, string> = {
    idle: 'Ready',
    connecting: 'Connecting...',
    listening: 'Listening...',
    no_signal: 'No audio',
    transcribing: 'Transcribing...',
    generating: 'Generating...',
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

// ─── Component ────────────────────────────────────────────────────────────────

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
    screenshots,
    onDeleteScreenshot,
    screenshotCount,
    credits,
    currentLanguage,
    setLanguage,
    onTooltipVisibilityChange
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    // ─── Audio state ──────────────────────────────────────────────────────────
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

    // ─── UI state ─────────────────────────────────────────────────────────────
    const [showAudioDropdown, setShowAudioDropdown] = useState(false);
    const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    // ─── Refs ─────────────────────────────────────────────────────────────────
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<AudioWorkletNode | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const audioDropdownRef = useRef<HTMLDivElement>(null);
    const responseRef = useRef<HTMLDivElement>(null);

    // ─── IPC Subscriptions ────────────────────────────────────────────────────

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
        return () => { stopAudioCapture(); };
    }, []);

    // Tooltip height reporting
    useEffect(() => {
        let tooltipHeight = 0;
        if (tooltipRef.current && isTooltipVisible) {
            tooltipHeight = tooltipRef.current.offsetHeight + 10;
        }
        onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
    }, [isTooltipVisible]);

    // Close audio dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (audioDropdownRef.current && !audioDropdownRef.current.contains(e.target as Node)) {
                setShowAudioDropdown(false);
            }
        };
        if (showAudioDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAudioDropdown]);

    // Auto-scroll response
    useEffect(() => {
        if (responseRef.current) {
            responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
    }, [status.response]);

    // ─── Audio Capture Logic ──────────────────────────────────────────────────

    const startAudioCapture = async (source: AudioSourceType) => {
        try {
            let stream: MediaStream;

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
                if (stream.getAudioTracks().length === 0) {
                    throw new Error('No audio - select a tab/window with audio enabled');
                }
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
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });

            const audioSrc = audioContextRef.current.createMediaStreamSource(stream);

            // Load AudioWorklet processor module
            await audioContextRef.current.audioWorklet.addModule('/pcm-capture-processor.js');
            const processor = new AudioWorkletNode(audioContextRef.current, 'pcm-capture-processor');

            processor.port.onmessage = (event) => {
                const { pcmBuffer, level } = event.data;
                setLocalAudioLevel(level);

                const uint8Array = new Uint8Array(pcmBuffer);
                const binary = String.fromCharCode.apply(null, Array.from(uint8Array));
                const base64 = btoa(binary);
                window.electronAPI.liveInterviewSendAudio(base64, level);
            };

            audioSrc.connect(processor);
            processor.connect(audioContextRef.current.destination);
            processorRef.current = processor;
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Permission denied. Please try again.');
            }
            throw err;
        }
    };

    const stopAudioCapture = () => {
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
        if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
        setLocalAudioLevel(0);
    };

    const handleSourceSelect = async (source: AudioSourceType) => {
        setAudioSource(source);
        setShowAudioDropdown(false);
        setError(null);

        try {
            const result = await window.electronAPI.liveInterviewStart();
            if (result.success) {
                await startAudioCapture(source);
                setIsActive(true);
            } else {
                setError(result.error || 'Failed to start Gemini connection');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start');
            await window.electronAPI.liveInterviewStop();
        }
    };

    const handleStop = useCallback(async () => {
        stopAudioCapture();
        await window.electronAPI.liveInterviewStop();
        setIsActive(false);
        setStatus({ state: 'idle', transcript: '', response: '', audioLevel: 0 });
        setError(null);
    }, []);

    // ─── Screenshot Handlers ─────────────────────────────────────────────────

    const handleScreenshot = async () => {
        try {
            const result = await window.electronAPI.triggerScreenshot();
            if (!result.success) {
                showToast('Error', 'Failed to take screenshot', 'error');
            }
        } catch (error) {
            showToast('Error', 'Failed to take screenshot', 'error');
        }
    };

    const handleSolve = async () => {
        if (screenshotCount === 0) return;
        try {
            const result = await window.electronAPI.triggerProcessScreenshots();
            if (!result.success) {
                showToast('Error', 'Failed to process screenshots', 'error');
            }
        } catch (error) {
            showToast('Error', 'Failed to process screenshots', 'error');
        }
    };

    // ─── Settings Handlers ───────────────────────────────────────────────────

    const handleSignOut = async () => {
        try {
            await window.electronAPI.openSettingsPortal();
        } catch (err) {
            showToast('Error', 'Failed to open settings', 'error');
        }
    };

    const extractLanguagesAndUpdate = (direction?: 'next' | 'prev') => {
        const hiddenRenderContainer = document.createElement('div');
        hiddenRenderContainer.style.position = 'absolute';
        hiddenRenderContainer.style.left = '-9999px';
        document.body.appendChild(hiddenRenderContainer);

        const root = createRoot(hiddenRenderContainer);
        root.render(<LanguageSelector currentLanguage={currentLanguage} setLanguage={() => { }} />);

        setTimeout(() => {
            const selectElement = hiddenRenderContainer.querySelector('select');
            if (selectElement) {
                const values = Array.from(selectElement.options).map(opt => opt.value);
                const currentIndex = values.indexOf(currentLanguage);
                let newIndex = currentIndex;

                if (direction === 'prev') {
                    newIndex = (currentIndex - 1 + values.length) % values.length;
                } else {
                    newIndex = (currentIndex + 1) % values.length;
                }

                if (newIndex !== currentIndex) {
                    setLanguage(values[newIndex]);
                    window.electronAPI.updateConfig({ language: values[newIndex] });
                }
            }
            root.unmount();
            document.body.removeChild(hiddenRenderContainer);
        }, 50);
    };

    // ─── Render Helpers ───────────────────────────────────────────────────────

    const renderVUMeter = () => {
        const level = Math.min(1, localAudioLevel * 10);
        const bars = 8;
        return (
            <div className="flex items-center gap-0.5 h-3">
                {Array.from({ length: bars }).map((_, i) => {
                    const threshold = i / bars;
                    const isLit = level > threshold;
                    const color = i < 5 ? 'bg-green-500' : i < 7 ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                        <div
                            key={i}
                            className={`w-1 rounded-sm transition-all duration-75 ${isLit ? color : 'bg-white/10'}`}
                            style={{ height: `${(i + 1) * 12.5}%` }}
                        />
                    );
                })}
            </div>
        );
    };

    const isListeningActive = status.state !== 'idle' && status.state !== 'error';
    const isGenerating = status.state === 'generating';
    const hasResponse = status.response.length > 0;
    const hasTranscript = status.transcript.length > 0;
    const showContent = screenshotCount > 0 || isActive || hasTranscript || hasResponse || error;

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col bg-black/40 rounded-lg overflow-visible border border-white/10">
            {/* ═══ Header Bar ═══ */}
            <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/90">

                {/* Screenshot */}
                <button
                    onClick={handleScreenshot}
                    className="relative p-1.5 rounded hover:bg-white/10 transition-colors"
                    title={`Take Screenshot (${COMMAND_KEY}+H)`}
                >
                    <Camera className="w-3.5 h-3.5" />
                    {screenshotCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none font-bold">
                            {screenshotCount}
                        </span>
                    )}
                </button>

                {/* Solve */}
                {screenshotCount > 0 && (
                    <button
                        onClick={handleSolve}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors ${credits <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        title={`Solve (${COMMAND_KEY}+Enter)`}
                    >
                        <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                )}

                {/* Separator */}
                <div className="h-3 w-px bg-white/15 mx-0.5" />

                {/* Audio Control */}
                <div className="relative" ref={audioDropdownRef}>
                    {isActive ? (
                        <button
                            onClick={handleStop}
                            className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Stop Listening"
                        >
                            <Square className="w-3 h-3 fill-current" />
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowAudioDropdown(!showAudioDropdown)}
                            className="flex items-center gap-0.5 p-1.5 rounded hover:bg-white/10 transition-colors"
                            title="Start Listening"
                        >
                            <Mic className="w-3.5 h-3.5" />
                            <ChevronDownIcon className="w-2.5 h-2.5 text-white/40" />
                        </button>
                    )}

                    {/* Audio Source Dropdown */}
                    {showAudioDropdown && (
                        <div
                            className="absolute top-full left-0 mt-1 w-44 bg-black/90 backdrop-blur-md rounded-lg border border-white/10 shadow-xl overflow-hidden"
                            style={{ zIndex: 200 }}
                        >
                            <button
                                onClick={() => handleSourceSelect('system')}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left"
                            >
                                <Monitor className="w-3.5 h-3.5 text-white/60" />
                                <div>
                                    <div className="text-[11px] text-white/90">Window Audio</div>
                                    <div className="text-[9px] text-white/40">Zoom, Meet</div>
                                </div>
                            </button>
                            <div className="h-px bg-white/10" />
                            <button
                                onClick={() => handleSourceSelect('microphone')}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left"
                            >
                                <Mic className="w-3.5 h-3.5 text-white/60" />
                                <div>
                                    <div className="text-[11px] text-white/90">Microphone</div>
                                    <div className="text-[9px] text-white/40">Local voice</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* VU Meter (when active) */}
                {isActive && (
                    <>
                        {renderVUMeter()}
                        {localAudioLevel > 0.01
                            ? <Volume2 className="w-3 h-3 text-green-400" />
                            : <VolumeX className="w-3 h-3 text-gray-500" />
                        }
                    </>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Status dot */}
                <div className={`w-1.5 h-1.5 rounded-full ${stateColors[status.state]} ${status.state === 'listening' ? 'animate-pulse' : ''
                    }`} title={stateLabels[status.state]} />
                {['connecting', 'transcribing', 'generating'].includes(status.state) && (
                    <Loader2 className="w-3 h-3 animate-spin text-white/50" />
                )}

                {/* Separator */}
                <div className="h-3 w-px bg-white/15 mx-0.5" />

                {/* Settings */}
                <div
                    className="relative"
                    onMouseEnter={() => setIsTooltipVisible(true)}
                    onMouseLeave={() => setIsTooltipVisible(false)}
                >
                    <button className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                    </button>

                    {/* Settings Tooltip */}
                    {isTooltipVisible && (
                        <div
                            ref={tooltipRef}
                            className="absolute top-full right-0 mt-2 w-56"
                            style={{ zIndex: 100 }}
                        >
                            <div className="absolute -top-2 right-0 w-full h-2" />
                            <div className="p-2.5 text-xs bg-black/90 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-xl">
                                <div className="space-y-2">
                                    <h3 className="font-medium text-[10px] text-white/50 uppercase tracking-wider">Shortcuts</h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between px-1 py-0.5">
                                            <span className="text-[10px] text-white/70">Toggle</span>
                                            <div className="flex gap-0.5">
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">{COMMAND_KEY}</span>
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">B</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-1 py-0.5">
                                            <span className="text-[10px] text-white/70">Screenshot</span>
                                            <div className="flex gap-0.5">
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">{COMMAND_KEY}</span>
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">H</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-1 py-0.5">
                                            <span className="text-[10px] text-white/70">Solve</span>
                                            <div className="flex gap-0.5">
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">{COMMAND_KEY}</span>
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">↵</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-1 py-0.5">
                                            <span className="text-[10px] text-white/70">Delete</span>
                                            <div className="flex gap-0.5">
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">{COMMAND_KEY}</span>
                                                <span className="bg-white/15 px-1 py-0.5 rounded text-[9px]">L</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-white/10 pt-1.5 space-y-1">
                                        <div
                                            className="flex items-center justify-between cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
                                            onClick={() => extractLanguagesAndUpdate('next')}
                                        >
                                            <span className="text-[10px] text-white/60">Language</span>
                                            <span className="text-[10px] text-white/90">{currentLanguage}</span>
                                        </div>
                                        <div
                                            className="flex items-center justify-between cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
                                            onClick={() => window.electronAPI.openSettingsPortal()}
                                        >
                                            <span className="text-[10px] text-white/60">API Settings</span>
                                            <span className="text-[10px] text-white/40">→</span>
                                        </div>
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors w-full px-1 py-0.5"
                                        >
                                            <LogOut className="w-2.5 h-2.5" />
                                            Log Out
                                        </button>
                                        <button
                                            onClick={() => window.electronAPI.quitApp()}
                                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors w-full px-1 py-0.5"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                                                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                            </svg>
                                            Exit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Debug */}
                <button
                    onClick={() => navigate('/debug-live')}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                    title="Debug"
                >
                    <Bug className="w-3.5 h-3.5" />
                </button>

                {/* Log Out */}
                <button
                    onClick={handleSignOut}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                    title="Log Out"
                >
                    <LogOut className="w-3.5 h-3.5" />
                </button>

                {/* Drag Handle */}
                <div
                    className="p-1 rounded hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
                    style={{ WebkitAppRegion: 'drag', appRegion: 'drag' } as React.CSSProperties}
                    title="Drag to move window"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white/30">
                        <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                        <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
                    </svg>
                </div>
            </div>

            {/* ═══ Content Area ═══ */}
            {showContent && (
                <div className="border-t border-white/10">
                    {/* Error */}
                    {error && (
                        <div className="mx-3 my-2 bg-red-500/10 border border-red-500/20 p-2 rounded flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span className="text-[11px]">{error}</span>
                        </div>
                    )}

                    {/* Screenshot Thumbnails */}
                    {screenshotCount > 0 && (
                        <div className="px-3 py-2">
                            <ScreenshotQueue
                                isLoading={false}
                                screenshots={screenshots}
                                onDeleteScreenshot={onDeleteScreenshot}
                            />
                        </div>
                    )}

                    {/* Transcript */}
                    {isActive && hasTranscript && (
                        <div className="px-3 py-2 border-t border-white/5">
                            <div className="flex items-start gap-2">
                                <Volume2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] text-blue-300 font-medium mb-0.5">Interviewer:</div>
                                    <div className="text-sm text-white leading-relaxed">
                                        {status.transcript}
                                        {status.state === 'transcribing' && (
                                            <span className="inline-block w-1 h-3.5 ml-0.5 bg-blue-400 animate-pulse align-middle" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI Response */}
                    {(hasResponse || (isListeningActive && isActive)) && (
                        <div className="border-t border-white/5">
                            {/* Response Header */}
                            <button
                                onClick={() => setIsResponseCollapsed(!isResponseCollapsed)}
                                className="flex items-center justify-between w-full px-3 py-2 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className={`w-3.5 h-3.5 ${hasResponse ? 'text-purple-400' : 'text-white/30'}`} />
                                    <span className="text-[11px] text-white/70">AI Suggestions</span>
                                    {isGenerating && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                                </div>
                                {isResponseCollapsed
                                    ? <ChevronDown className="w-3 h-3 text-white/30" />
                                    : <ChevronUp className="w-3 h-3 text-white/30" />
                                }
                            </button>

                            {/* Response Content */}
                            {!isResponseCollapsed && (
                                <div ref={responseRef} className="px-3 pb-3 overflow-y-auto max-h-[200px]">
                                    {hasResponse ? (
                                        <div className="text-[12px] text-white/90 whitespace-pre-wrap leading-relaxed">
                                            {status.response}
                                            {isGenerating && (
                                                <span className="inline-block w-1 h-3.5 bg-purple-400 animate-pulse align-middle ml-0.5" />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-white/30 text-center py-3">
                                            Hints will appear once the interviewer speaks...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UnifiedPanel;
