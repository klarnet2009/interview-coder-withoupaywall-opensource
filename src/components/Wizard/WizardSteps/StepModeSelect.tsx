import React, { useEffect } from 'react';
import { Zap, Sparkles, Shield } from 'lucide-react';
import { StepProps } from '../../../types';

export const StepModeSelect: React.FC<StepProps> = ({
    setCanProceed,
    onSwitchMode,
    currentMode,
}) => {
    useEffect(() => {
        setCanProceed?.(true);
    }, [setCanProceed]);

    return (
        <div className="space-y-5">
            <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-white">
                    Choose your setup mode
                </h3>
                <p className="text-white/50 text-sm">
                    You can always change settings later.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button
                    onClick={() => onSwitchMode?.('quick')}
                    className={`p-5 rounded-xl border transition-all text-left ${currentMode === 'quick'
                            ? 'bg-white/10 border-white/30 ring-1 ring-white/20'
                            : 'bg-white/3 border-white/10 hover:bg-white/5'
                        }`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentMode === 'quick' ? 'bg-white/15' : 'bg-white/5'
                            }`}>
                            <Zap className={`w-4 h-4 ${currentMode === 'quick' ? 'text-white' : 'text-white/50'}`} />
                        </div>
                        <div>
                            <span className={`font-medium ${currentMode === 'quick' ? 'text-white' : 'text-white/70'}`}>
                                Quick Start
                            </span>
                            <p className="text-xs text-white/40">~2 min • Essential settings only</p>
                        </div>
                    </div>
                    <p className="text-xs text-white/50 pl-11">
                        Set up API key and start using. Best for experienced users.
                    </p>
                </button>

                <button
                    onClick={() => onSwitchMode?.('advanced')}
                    className={`p-5 rounded-xl border transition-all text-left ${currentMode === 'advanced'
                            ? 'bg-white/10 border-white/30 ring-1 ring-white/20'
                            : 'bg-white/3 border-white/10 hover:bg-white/5'
                        }`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentMode === 'advanced' ? 'bg-white/15' : 'bg-white/5'
                            }`}>
                            <Sparkles className={`w-4 h-4 ${currentMode === 'advanced' ? 'text-white' : 'text-white/50'}`} />
                        </div>
                        <div>
                            <span className={`font-medium ${currentMode === 'advanced' ? 'text-white' : 'text-white/70'}`}>
                                Advanced Setup
                            </span>
                            <p className="text-xs text-white/40">~5 min • Full customization</p>
                        </div>
                    </div>
                    <p className="text-xs text-white/50 pl-11">
                        Configure profile, audio, display, and test your setup.
                    </p>
                </button>
            </div>

            {/* Privacy notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/2 border border-white/5">
                <Shield className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                <p className="text-xs text-white/40 leading-relaxed">
                    <strong className="text-white/60">Privacy:</strong> API keys are stored
                    locally on your device. Nothing is sent to our servers.
                </p>
            </div>
        </div>
    );
};

export default StepModeSelect;
