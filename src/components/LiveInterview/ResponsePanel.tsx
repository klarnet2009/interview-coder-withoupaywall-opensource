/**
 * ResponsePanel - Dedicated panel for AI-generated hints and responses
 * Subscribes to the same live-interview-status IPC channel as LiveInterviewPanel
 * but exclusively displays the AI response output.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

type ListeningState =
    | 'idle'
    | 'connecting'
    | 'listening'
    | 'no_signal'
    | 'transcribing'
    | 'generating'
    | 'error';

interface LiveInterviewStatus {
    state: ListeningState;
    transcript: string;
    response: string;
    audioLevel: number;
    error?: string;
}

export const ResponsePanel: React.FC = () => {
    const [status, setStatus] = useState<LiveInterviewStatus>({
        state: 'idle',
        transcript: '',
        response: '',
        audioLevel: 0
    });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const responseRef = useRef<HTMLDivElement>(null);

    // Subscribe to live interview events
    useEffect(() => {
        const unsubStatus = window.electronAPI.onLiveInterviewStatus((newStatus: LiveInterviewStatus) => {
            setStatus(newStatus);
        });

        const unsubState = window.electronAPI.onLiveInterviewState((state: ListeningState) => {
            setStatus(prev => ({ ...prev, state }));
        });

        return () => {
            unsubStatus();
            unsubState();
        };
    }, []);

    // Auto-scroll response
    useEffect(() => {
        if (responseRef.current) {
            responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
    }, [status.response]);

    const isActive = status.state !== 'idle' && status.state !== 'error';
    const isGenerating = status.state === 'generating';
    const hasResponse = status.response.length > 0;

    // Don't render if not active and no response to show
    if (!isActive && !hasResponse) {
        return null;
    }

    return (
        <div className="flex flex-col bg-black/40 rounded-lg overflow-hidden border border-white/10">
            {/* Header */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-3 bg-black/30 border-b border-white/10 hover:bg-white/5 transition-colors w-full text-left"
            >
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${hasResponse ? 'bg-purple-500/20' : 'bg-white/5'}`}>
                        <Sparkles className={`w-4 h-4 ${hasResponse ? 'text-purple-400' : 'text-white/40'}`} />
                    </div>
                    <span className="text-sm font-medium text-white/80">AI Suggestions</span>
                    {isGenerating && (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                    )}
                </div>

                {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-white/40" />
                    : <ChevronUp className="w-4 h-4 text-white/40" />
                }
            </button>

            {/* Content */}
            {!isCollapsed && (
                <div
                    ref={responseRef}
                    className="p-4 overflow-y-auto max-h-[300px]"
                >
                    {hasResponse ? (
                        <div className="space-y-2">
                            <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                {status.response}
                            </div>
                            {isGenerating && (
                                <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse align-middle" />
                            )}
                        </div>
                    ) : isActive ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-purple-400/60" />
                            </div>
                            <div className="text-white/30 text-xs">
                                AI hints will appear here once the interviewer speaks...
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default ResponsePanel;
