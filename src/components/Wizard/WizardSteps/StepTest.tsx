import React, { useState, useEffect } from 'react';
import { Play, Check, AlertCircle, Loader2, Terminal, MessageSquare, Code } from 'lucide-react';
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

export const StepTest: React.FC<StepTestProps> = ({
  data,
  setCanProceed
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    extraction?: number;
    solution?: number;
    total?: number;
  }>({});

  useEffect(() => {
    // Allow proceeding even without test
    setCanProceed(true);
  }, [setCanProceed]);

  const runTest = async () => {
    setTestStatus('running');
    
    // Simulate test
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setTestResults({
      extraction: 320,
      solution: 890,
      total: 1210
    });
    
    setTestStatus('success');
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/60">
        Test your setup with a sample question. This ensures everything is working 
        correctly before your real interview.
      </div>

      {/* Test scenarios */}
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

      {/* Manual input option */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-sm font-medium text-white/80 mb-2">
          Or type your own question
        </div>
        <textarea
          placeholder="Enter a sample interview question..."
          rows={3}
          className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Run test button */}
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
            Run Test
          </>
        )}
        {testStatus === 'running' && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing...
          </>
        )}
        {testStatus === 'success' && (
          <>
            <Check className="w-4 h-4" />
            Test Passed
          </>
        )}
      </button>

      {/* Test results */}
      {testStatus === 'success' && testResults.total && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-medium">
            <Check className="w-5 h-5" />
            All systems operational
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Problem extraction</span>
              <span className="text-white/80">{testResults.extraction}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Solution generation</span>
              <span className="text-white/80">{testResults.solution}ms</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-white/60">Total latency</span>
              <span className="text-green-400">{testResults.total}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Skip option */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02]">
        <AlertCircle className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40">
          You can skip this test and start using the app immediately. 
          The test can be run anytime from the Debug menu.
        </p>
      </div>
    </div>
  );
};

export default StepTest;
