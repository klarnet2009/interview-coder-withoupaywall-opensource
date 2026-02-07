import React, { useEffect } from 'react';
import { Check, ExternalLink } from 'lucide-react';
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

  const handleSelectProvider = (providerId: APIProvider) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      onUpdate({
        apiProvider: providerId,
        // Reset models to defaults for this provider
        extractionModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
            'gemini-3-flash-preview',
        solutionModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
            'gemini-3-flash-preview',
        debuggingModel: providerId === 'openai' ? 'gpt-4o' :
          providerId === 'anthropic' ? 'claude-3-7-sonnet-20250219' :
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
      <div className="text-sm text-white/60 mb-4">
        Select the AI service that will generate your interview answers.
        You can change this later in settings.
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            onClick={() => handleSelectProvider(provider.id)}
            className={`relative p-4 rounded-xl border cursor-pointer transition-all ${selectedProvider === provider.id
                ? 'bg-white/10 border-white/30'
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
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${provider.id === 'gemini' ? 'bg-blue-500/20' :
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
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded">
                      Recommended
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
      <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <h4 className="text-sm font-medium text-white/80 mb-3">
          Quick Comparison
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Free tier</span>
            <span className="text-white/70">Gemini: 60 req/min • OpenAI: Limited • Claude: Limited</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Best for</span>
            <span className="text-white/70">Conversational • Technical • Analysis</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Speed</span>
            <span className="text-white/70">Fast • Fast • Moderate</span>
          </div>
        </div>
      </div>

      {/* Get API key link */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
        <span className="text-sm text-white/50">
          Don't have an API key?
        </span>
        <button
          onClick={() => openExternalLink(PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl || '')}
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Get {PROVIDERS.find(p => p.id === selectedProvider)?.name.split(' ')[0]} key
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default StepProvider;
