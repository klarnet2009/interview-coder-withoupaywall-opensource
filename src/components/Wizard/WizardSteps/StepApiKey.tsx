import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Check, X, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { StepProps, APIProvider, PROVIDERS } from '../../../types';

interface StepApiKeyProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export const StepApiKey: React.FC<StepApiKeyProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');
  const [testDetails, setTestDetails] = useState<{
    responseTime?: number;
    modelInfo?: string;
  }>({});

  const provider = data.apiProvider || 'gemini';
  const providerInfo = PROVIDERS.find(p => p.id === provider);

  // Check if we can proceed (have valid key or testing passed)
  useEffect(() => {
    const isValidFormat = validateKeyFormat(apiKey, provider);
    setCanProceed(isValidFormat && (testStatus === 'success' || testStatus === 'idle'));
  }, [apiKey, provider, testStatus, setCanProceed]);

  const validateKeyFormat = (key: string, prov: APIProvider): boolean => {
    if (!key || key.trim().length === 0) return false;
    
    if (prov === 'openai') {
      return /^sk-[a-zA-Z0-9]{32,}$/.test(key.trim());
    } else if (prov === 'anthropic') {
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(key.trim());
    } else {
      // Gemini - at least 10 chars
      return key.trim().length >= 10;
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    onUpdate({ apiKey: newKey });
    // Reset test status when key changes
    if (testStatus !== 'idle') {
      setTestStatus('idle');
      setTestError('');
    }
  };

  const testConnection = useCallback(async () => {
    if (!validateKeyFormat(apiKey, provider)) return;

    setTestStatus('testing');
    setTestError('');
    setTestDetails({});

    const startTime = Date.now();

    try {
      // Use electron API to test the key
      const result = await window.electronAPI?.testApiKey?.(apiKey, provider);
      
      const responseTime = Date.now() - startTime;

      if (result?.valid) {
        setTestStatus('success');
        setTestDetails({
          responseTime,
          modelInfo: provider === 'openai' ? 'GPT-4o accessible' :
                     provider === 'anthropic' ? 'Claude accessible' :
                     'Gemini API accessible'
        });
      } else {
        setTestStatus('error');
        setTestError(result?.error || 'Failed to validate API key');
      }
    } catch (error) {
      setTestStatus('error');
      setTestError('Network error. Please check your connection.');
    }
  }, [apiKey, provider]);

  const openExternalLink = (url: string) => {
    if (window.electronAPI?.openLink) {
      window.electronAPI.openLink(url);
    }
  };

  const getKeyPlaceholder = () => {
    return providerInfo?.keyPlaceholder || 'Enter your API key';
  };

  const getKeyFormat = () => {
    return providerInfo?.keyFormat || '';
  };

  return (
    <div className="space-y-5">
      {/* Provider indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03]">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          provider === 'gemini' ? 'bg-blue-500/20' :
          provider === 'openai' ? 'bg-green-500/20' :
          'bg-orange-500/20'
        }`}>
          <span className={`font-bold ${
            provider === 'gemini' ? 'text-blue-400' :
            provider === 'openai' ? 'text-green-400' :
            'text-orange-400'
          }`}>
            {provider === 'gemini' ? 'G' :
             provider === 'openai' ? 'O' : 'C'}
          </span>
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            {providerInfo?.name}
          </div>
          <div className="text-xs text-white/50">
            Selected provider
          </div>
        </div>
      </div>

      {/* API Key input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80">
          {provider === 'openai' ? 'OpenAI API Key' :
           provider === 'anthropic' ? 'Anthropic API Key' :
           'Gemini API Key'}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleKeyChange}
            placeholder={getKeyPlaceholder()}
            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors pr-24"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {apiKey && (
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        
        {/* Format hint */}
        <p className="text-xs text-white/40">
          Format: {getKeyFormat()}
        </p>
      </div>

      {/* Test connection button */}
      <button
        onClick={testConnection}
        disabled={!validateKeyFormat(apiKey, provider) || testStatus === 'testing'}
        className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          testStatus === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : testStatus === 'error'
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
        } ${(!validateKeyFormat(apiKey, provider) || testStatus === 'testing') ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {testStatus === 'testing' && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing connection...
          </>
        )}
        {testStatus === 'idle' && 'Test Connection'}
        {testStatus === 'success' && (
          <>
            <Check className="w-4 h-4" />
            Connection successful
          </>
        )}
        {testStatus === 'error' && (
          <>
            <X className="w-4 h-4" />
            Connection failed
          </>
        )}
      </button>

      {/* Test result details */}
      {testStatus === 'success' && testDetails.responseTime && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Response time</span>
            <span className="text-green-400">{testDetails.responseTime}ms</span>
          </div>
          {testDetails.modelInfo && (
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Status</span>
              <span className="text-green-400">{testDetails.modelInfo}</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {testStatus === 'error' && testError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-400">
            {testError}
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-white/70">Security</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed">
          Your API key is stored locally on your device using OS-level encryption. 
          It is never sent to our servers and is only used to make API calls directly 
          from your machine to {providerInfo?.name.split(' ')[0]}.
        </p>
      </div>

      {/* Get key link */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => openExternalLink(providerInfo?.getKeyUrl || '')}
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          How to get a {providerInfo?.name.split(' ')[0]} API key
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default StepApiKey;
