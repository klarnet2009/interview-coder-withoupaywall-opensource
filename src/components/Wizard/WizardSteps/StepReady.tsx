import React, { useEffect } from 'react';
import { Check, Sparkles, Mic, Monitor, User, Settings } from 'lucide-react';
import { StepProps, PROVIDERS } from '../../../types';
import { COMMAND_KEY } from '../../../utils/platform';

interface StepReadyProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

export const StepReady: React.FC<StepReadyProps> = ({
  data,
  setCanProceed
}) => {
  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const provider = data.apiProvider || 'gemini';
  const providerInfo = PROVIDERS.find(p => p.id === provider);
  const hasProfile = data.profiles && data.profiles.length > 0;

  const getDisplayModeLabel = (mode?: string) => {
    switch (mode) {
      case 'overlay': return 'Overlay Mode';
      case 'mini': return 'Mini Widget';
      case 'tray': return 'System Tray';
      default: return 'Standard Window';
    }
  };

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-2">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-white">
          You're all set!
        </h3>
        <p className="text-white/60 text-sm max-w-sm mx-auto">
          Your Interview Assistant is configured and ready to help you ace your interviews.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
        <h4 className="text-sm font-medium text-white/80 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Configuration Summary
        </h4>

        <div className="space-y-3">
          {/* Provider */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <div className={`w-2 h-2 rounded-full ${
                provider === 'gemini' ? 'bg-blue-400' :
                provider === 'openai' ? 'bg-green-400' :
                'bg-orange-400'
              }`} />
              AI Provider
            </div>
            <span className="text-sm text-white/80">{providerInfo?.name}</span>
          </div>

          {/* API Key */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">API Key</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-green-400">Connected</span>
            </div>
          </div>

          {/* Profile */}
          {hasProfile && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <User className="w-3.5 h-3.5" />
                Profile
              </div>
              <span className="text-sm text-white/80">
                {data.profiles?.[0]?.name}
              </span>
            </div>
          )}

          {/* Interview Mode */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Interview Type</span>
            <span className="text-sm text-white/80 capitalize">
              {data.interviewPreferences?.mode?.replace('_', ' ') || 'Coding'}
            </span>
          </div>

          {/* Answer Style */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Answer Style</span>
            <span className="text-sm text-white/80 capitalize">
              {data.interviewPreferences?.answerStyle || 'Structured'}
            </span>
          </div>

          {/* Audio Source */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Mic className="w-3.5 h-3.5" />
              Audio Source
            </div>
            <span className="text-sm text-white/80 capitalize">
              {data.audioConfig?.source || 'System'}
            </span>
          </div>

          {/* Display Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Monitor className="w-3.5 h-3.5" />
              Display Mode
            </div>
            <span className="text-sm text-white/80">
              {getDisplayModeLabel(data.displayConfig?.mode)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick start tips */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white/80">Quick Start Tips</h4>
        
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs text-white/70">
              1
            </div>
            <div>
              <div className="text-sm text-white/80">Toggle visibility</div>
              <div className="text-xs text-white/50">Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">{COMMAND_KEY} + B</kbd> to show/hide the app</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs text-white/70">
              2
            </div>
            <div>
              <div className="text-sm text-white/80">Take screenshots</div>
              <div className="text-xs text-white/50">Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">{COMMAND_KEY} + H</kbd> to capture problems</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs text-white/70">
              3
            </div>
            <div>
              <div className="text-sm text-white/80">Get answers</div>
              <div className="text-xs text-white/50">Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">{COMMAND_KEY} + Enter</kbd> to process</div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit settings note */}
      <div className="flex items-center justify-center gap-2 text-sm text-white/50">
        <Settings className="w-4 h-4" />
        You can change these settings anytime from the menu
      </div>
    </div>
  );
};

export default StepReady;
