import React, { useState, useEffect } from 'react';
import { Bug, Eye, EyeOff, Terminal } from 'lucide-react';

/**
 * Floating debug mode toggle — only visible in development (npm run dev).
 * Controls:
 *  - Debug Mode: shows verbose UI indicators across the app
 *  - Stealth:    toggles window invisibility for screenshots
 */
export const DevModeToggle: React.FC = () => {
    const [isDev, setIsDev] = useState(false);
    const [stealth, setStealth] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        window.electronAPI?.isDev().then((dev) => {
            setIsDev(dev);
        }).catch(() => { });
    }, []);

    if (!isDev) return null;

    const handleToggleStealth = async () => {
        const newStealth = !stealth;
        const result = await window.electronAPI?.toggleStealth(newStealth);
        if (result?.success) {
            setStealth(newStealth);
        }
    };

    const handleToggleDebug = () => {
        const next = !debugMode;
        setDebugMode(next);
        // Broadcast to other components (UnifiedPanel etc.)
        window.dispatchEvent(new CustomEvent('debug-mode-change', { detail: next }));
    };

    return (
        <div
            className="fixed bottom-3 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            {/* Main bug icon */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${expanded
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-white/30 hover:text-white/50 border border-white/5 hover:border-white/10'
                    }`}
                title="Dev Tools"
            >
                <Bug className="w-3.5 h-3.5" />
            </button>

            {/* Expanded panel */}
            <div
                className="flex items-center gap-1 overflow-hidden transition-all duration-200"
                style={{
                    maxWidth: expanded ? '300px' : '0px',
                    opacity: expanded ? 1 : 0,
                }}
            >
                {/* Debug Mode toggle */}
                <button
                    onClick={handleToggleDebug}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${debugMode
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/8'
                        }`}
                    title={debugMode ? 'Debug Mode ON — verbose UI' : 'Debug Mode OFF — minimal UI'}
                >
                    <Terminal className="w-3 h-3" />
                    {debugMode ? 'Debug' : 'Debug'}
                </button>

                {/* Stealth toggle */}
                <button
                    onClick={handleToggleStealth}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${stealth
                        ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/8'
                        }`}
                    title={stealth ? 'Stealth ON — invisible in capture' : 'Stealth OFF — visible in capture'}
                >
                    {stealth ? (
                        <>
                            <EyeOff className="w-3 h-3" />
                            Stealth
                        </>
                    ) : (
                        <>
                            <Eye className="w-3 h-3" />
                            Visible
                        </>
                    )}
                </button>

                <span className="text-[10px] text-amber-400/60 font-mono px-1">DEV</span>
            </div>
        </div>
    );
};

export default DevModeToggle;
