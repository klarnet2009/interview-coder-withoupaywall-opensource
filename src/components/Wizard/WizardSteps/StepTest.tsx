import React, { useState, useEffect } from 'react';
import { Play, Check, AlertCircle, Loader2, Terminal, MessageSquare, Code, XCircle } from 'lucide-react';
import { StepProps } from '../../../types';

interface StepTestProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

const TEST_SCENARIOS = [
  {
    id: 'coding',
    title: 'Coding Problem',
    description: 'Two Sum - Find indices of two numbers that add up to target',
    icon: Code
  },
  {
    id: 'behavioral',
    title: 'Behavioral Question',
    description: 'Tell me about a challenging bug you fixed recently',
    icon: MessageSquare
  },
  {
    id: 'system_design',
    title: 'System Design',
    description: 'Design a URL shortening service like bit.ly',
    icon: Terminal
  }
];

interface ReadinessCheck {
  apiKeyPresent: boolean;
  apiConnection: boolean;
  audioConfigured: boolean;
  audioSourceReady: boolean;
}

export const StepTest: React.FC<StepTestProps> = ({
  data,
  setCanProceed
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ReadinessCheck | null>(null);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    // This step is optional.
    setCanProceed(true);
  }, [setCanProceed]);

  const runTest = async () => {
    setTestStatus('running');
    setTestError('');
    setTestResults(null);

    try {
      const provider = (data.apiProvider || 'gemini') as 'openai' | 'gemini' | 'anthropic';
      const apiKey = (data.apiKey || '').trim();
      const apiKeyPresent = apiKey.length > 0;
      let localError = '';

      let apiConnection = false;
      if (apiKeyPresent) {
        const result = await window.electronAPI.testApiKey(apiKey, provider);
        apiConnection = !!result.valid;
        if (!apiConnection && result.error) {
          localError = result.error;
        }
      }

      const audioConfigured = !!data.audioConfig?.source;
      const audioSourceReady =
        data.audioConfig?.source !== 'application' ||
        !!data.audioConfig?.applicationName;

      const readiness: ReadinessCheck = {
        apiKeyPresent,
        apiConnection,
        audioConfigured,
        audioSourceReady
      };

      setTestResults(readiness);

      if (apiConnection && audioConfigured && audioSourceReady) {
        setTestStatus('success');
      } else {
        if (!localError) {
          localError = 'Readiness check found configuration issues. Please review the items below.';
        }
        setTestStatus('error');
      }

      if (localError) {
        setTestError(localError);
      }
    } catch (error) {
      console.error('Readiness check failed:', error);
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Failed to run readiness check.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/60">
        Run a real readiness check before your interview. This verifies API access and
        core configuration health. It does not benchmark model speed.
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80">
          Select Test Scenario
        </label>
        <div className="space-y-2">
          {TEST_SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() => setSelectedScenario(scenario.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedScenario === scenario.id
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedScenario === scenario.id ? 'bg-white/20' : 'bg-white/5'
              }`}>
                <scenario.icon className={`w-5 h-5 ${
                  selectedScenario === scenario.id ? 'text-white' : 'text-white/50'
                }`} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${
                  selectedScenario === scenario.id ? 'text-white' : 'text-white/80'
                }`}>
                  {scenario.title}
                </div>
                <div className="text-xs text-white/50">
                  {scenario.description}
                </div>
              </div>
              {selectedScenario === scenario.id && (
                <Check className="w-5 h-5 text-white" />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={runTest}
        disabled={testStatus === 'running'}
        className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          testStatus === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : testStatus === 'error'
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-white text-black hover:bg-white/90'
        }`}
      >
        {testStatus === 'idle' && (
          <>
            <Play className="w-4 h-4" />
            Run Readiness Check
          </>
        )}
        {testStatus === 'running' && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking...
          </>
        )}
        {testStatus === 'success' && (
          <>
            <Check className="w-4 h-4" />
            Check Passed
          </>
        )}
        {testStatus === 'error' && (
          <>
            <XCircle className="w-4 h-4" />
            Check Needs Attention
          </>
        )}
      </button>

      {testResults && (
        <div className={`p-4 rounded-xl border space-y-3 ${
          testStatus === 'success'
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className={`flex items-center gap-2 font-medium ${
            testStatus === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {testStatus === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {testStatus === 'success' ? 'Readiness verified' : 'Readiness issues found'}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">API key entered</span>
              <span className={testResults.apiKeyPresent ? 'text-green-400' : 'text-red-400'}>
                {testResults.apiKeyPresent ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">API connection</span>
              <span className={testResults.apiConnection ? 'text-green-400' : 'text-red-400'}>
                {testResults.apiConnection ? 'Verified' : 'Failed'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Audio source configured</span>
              <span className={testResults.audioConfigured ? 'text-green-400' : 'text-red-400'}>
                {testResults.audioConfigured ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Audio source ready</span>
              <span className={testResults.audioSourceReady ? 'text-green-400' : 'text-red-400'}>
                {testResults.audioSourceReady ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {testError && (
            <div className="pt-2 border-t border-white/10 text-xs text-red-300">
              {testError}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02]">
        <AlertCircle className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40">
          This check validates real configuration readiness. You can skip and continue, but
          unresolved issues may break live assistance.
        </p>
      </div>
    </div>
  );
};

export default StepTest;
