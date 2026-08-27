import React, { useEffect } from 'react';
import { Check, ExternalLink, ShieldCheck, Sparkles, CreditCard, Zap } from 'lucide-react';
import { StepProps, APIProvider, PROVIDERS } from '../../../types';

interface StepProviderProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

export const StepProvider: React.FC<StepProviderProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const selectedProvider = data.apiProvider || 'gemini';

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const isKeyCompatible = (key: string | undefined, prov: APIProvider): boolean => {
    if (!key) return true;
    const trimmed = key.trim();
    if (prov === 'custom') return true;
    if (prov === 'openai' || prov === 'anthropic') {
      return /^sk-[a-zA-Z0-9_-]{20,}$/.test(trimmed);
    } else {
      // gemini
      return !trimmed.startsWith('sk-') && trimmed.length >= 10;
    }
  };

  const handleSelectProvider = (providerId: APIProvider) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      // If the current API key is incompatible with the newly selected provider, reset it
      const currentKey = data.apiKey;
      const compatibleKey = isKeyCompatible(currentKey, providerId) ? currentKey : '';

      onUpdate({
        apiProvider: providerId,
        apiKey: compatibleKey,
        customBaseUrl: providerId === 'custom' ? (data.customBaseUrl || 'https://openrouter.ai/api/v1') : data.customBaseUrl,
        // Reset models to defaults for this provider
        extractionModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
            providerId === 'custom' ? 'deepseek/deepseek-r1' :
              'gemini-3-flash-preview',
        solutionModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
            providerId === 'custom' ? 'deepseek/deepseek-r1' :
              'gemini-3-flash-preview',
        debuggingModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
            providerId === 'custom' ? 'deepseek/deepseek-r1' :
              'gemini-3-flash-preview',
      });
    }
  };


  const openExternalLink = (url: string) => {
    if (window.electronAPI?.openLink) {
      window.electronAPI.openLink(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-white/60 mb-2">
        Select the AI service that will generate your interview answers.
        You can change this anytime later in settings.
      </div>

      {/* BYOK (Bring Your Own Key) Explainer Card */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-zinc-900/60 to-purple-950/40 border border-blue-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            BYOK Architecture (Bring Your Own Key)
          </span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          Interview Coder makes direct API requests from your device to the chosen provider. No telemetry, no middleman servers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
            <Zap className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-medium text-blue-300 block">Gemini Free Tier</span>
              <span className="text-[10px] text-white/50 leading-tight block">
                Free without credit card (60 req/min). Best to get started immediately.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
            <CreditCard className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-medium text-green-300 block">OpenAI & Anthropic</span>
              <span className="text-[10px] text-white/50 leading-tight block">
                Paid tier ($5 min credit). Excellent for complex coding & system design.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            onClick={() => handleSelectProvider(provider.id)}
            className={`relative p-4 rounded-xl border cursor-pointer transition-all ${selectedProvider === provider.id
                ? 'bg-white/10 border-white/30 shadow-lg'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/5 hover:border-white/20'
              }`}
          >
            {/* Selection indicator */}
            <div className="absolute top-4 right-4">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedProvider === provider.id
                    ? 'bg-white border-white'
                    : 'border-white/30'
                  }`}
              >
                {selectedProvider === provider.id && (
                  <Check className="w-3 h-3 text-black" />
                )}
              </div>
            </div>

            {/* Provider info */}
            <div className="flex items-start gap-3">
              {/* Provider icon/color indicator */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${provider.id === 'gemini' ? 'bg-blue-500/20' :
                    provider.id === 'openai' ? 'bg-green-500/20' :
                      'bg-orange-500/20'
                  }`}
              >
                <span className={`text-lg font-bold ${provider.id === 'gemini' ? 'text-blue-400' :
                    provider.id === 'openai' ? 'text-green-400' :
                      'text-orange-400'
                  }`}>
                  {provider.id === 'gemini' ? 'G' :
                    provider.id === 'openai' ? 'O' : 'C'}
                </span>
              </div>

              <div className="flex-1 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">
                    {provider.name}
                  </span>
                  {provider.recommended && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded flex items-center gap-1 font-medium">
                      <Sparkles className="w-2.5 h-2.5" />
                      Free & Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  {provider.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Provider comparison */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
        <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2.5">
          Quick Comparison
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/50">Free Tier</span>
            <span className="text-white/70">Gemini: 60 req/min (No CC) • OpenAI / Claude: Paid</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Best For</span>
            <span className="text-white/70">Live Audio & Speed • Algorithm Depth • Deep Reasoning</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Latency</span>
            <span className="text-white/70">Ultra Fast (Flash) • Fast (4o) • Moderate (Sonnet)</span>
          </div>
        </div>
      </div>

      {/* Get API key link */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <span className="text-xs text-white/50">
          Don't have an API key yet?
        </span>
        <button
          onClick={() => openExternalLink(PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl || '')}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          Get {PROVIDERS.find(p => p.id === selectedProvider)?.name.split(' ')[0]} Key
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default StepProvider;
