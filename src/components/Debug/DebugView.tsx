import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Terminal, 
  Activity, 
  Check,
  AlertCircle,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { PipelineStep, DebugLog } from '../../types';

interface DebugViewProps {
  isOpen: boolean;
  onClose: () => void;
  provider: string;
  model: string;
}

type DebugTab = 'test' | 'pipeline' | 'logs';

const TEST_QUESTIONS = {
  coding: [
    'Two Sum: Find indices of two numbers that add up to target',
    'Reverse a linked list',
    'Merge two sorted arrays',
    'Valid parentheses'
  ],
  behavioral: [
    'Tell me about a challenging bug you fixed recently',
    'Describe a time you had to learn a new technology quickly',
    'How do you handle conflicts in a team?',
    'Tell me about a project you are proud of'
  ],
  system_design: [
    'Design a URL shortening service like bit.ly',
    'Design a chat application like WhatsApp',
    'Design a rate limiter',
    'Design a distributed cache'
  ]
};

export const DebugView: React.FC<DebugViewProps> = ({
  isOpen,
  onClose,
  provider,
  model
}) => {
  const [activeTab, setActiveTab] = useState<DebugTab>('test');
  const [testInput, setTestInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'coding' | 'behavioral' | 'system_design'>('coding');
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { name: 'Input Received', status: 'pending', duration: 0 },
    { name: 'Problem Extraction', status: 'pending', duration: 0 },
    { name: 'Context Building', status: 'pending', duration: 0 },
    { name: 'AI Request', status: 'pending', duration: 0 },
    { name: 'Response Processing', status: 'pending', duration: 0 }
  ]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (level: DebugLog['level'], message: string, data?: unknown) => {
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      level,
      message,
      data
    }]);
  };

  const tabs: Array<{ id: DebugTab; label: string; icon: typeof Play }> = [
    { id: 'test', label: 'Test Input', icon: Play },
    { id: 'pipeline', label: 'Pipeline', icon: Activity },
    { id: 'logs', label: 'Logs', icon: Terminal }
  ];

  const runTest = async () => {
    if (!testInput.trim()) return;

    setIsRunning(true);
    setTestResult(null);
    addLog('info', 'Starting test...', { input: testInput });

    // Reset pipeline
    setPipelineSteps(steps => steps.map(s => ({ ...s, status: 'pending', duration: 0 })));

    // Simulate pipeline
    const steps = ['Input Received', 'Problem Extraction', 'Context Building', 'AI Request', 'Response Processing'];
    
    for (let i = 0; i < steps.length; i++) {
      const stepName = steps[i];
      setPipelineSteps(prev => prev.map(s => 
        s.name === stepName ? { ...s, status: 'running' } : s
      ));
      
      addLog('info', `${stepName}...`);
      
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
      
      const duration = Math.floor(Math.random() * 500) + 200;
      setPipelineSteps(prev => prev.map(s => 
        s.name === stepName ? { ...s, status: 'success', duration } : s
      ));
      
      addLog('info', `${stepName} completed`, { duration: `${duration}ms` });
    }

    // Generate mock response
    const responses = [
      'Based on the problem, I would approach this by...',
      'The optimal solution involves using a hash map...',
      'Here is a step-by-step approach...'
    ];
    setTestResult(responses[Math.floor(Math.random() * responses.length)]);
    
    addLog('success', 'Test completed successfully');
    setIsRunning(false);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      provider,
      model,
      logs,
      pipeline: pipelineSteps
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleLogExpand = (index: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getLogIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warn':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />;
      default:
        return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-white/60" />
            <h2 className="text-lg font-semibold text-white">Debug & Test</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-white'
                  : 'text-white/40 border-transparent hover:text-white/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Test Tab */}
          {activeTab === 'test' && (
            <div className="space-y-6">
              {/* Category selection */}
              <div className="flex gap-2">
                {(['coding', 'behavioral', 'system_design'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      selectedCategory === cat
                        ? 'bg-white/10 text-white'
                        : 'bg-white/[0.03] text-white/60 hover:bg-white/5'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Sample questions */}
              <div className="space-y-2">
                <label className="text-sm text-white/60">Sample questions:</label>
                <div className="grid grid-cols-1 gap-2">
                  {TEST_QUESTIONS[selectedCategory].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setTestInput(q)}
                      className="text-left p-3 rounded-lg bg-white/[0.03] text-white/70 text-sm hover:bg-white/5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="text-sm text-white/60">Or type your own:</label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Enter interview question..."
                  rows={4}
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Run button */}
              <button
                onClick={runTest}
                disabled={!testInput.trim() || isRunning}
                className="w-full py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Test
                  </>
                )}
              </button>

              {/* Result */}
              {testResult && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Response</span>
                  </div>
                  <p className="text-sm text-white/80">{testResult}</p>
                </div>
              )}
            </div>
          )}

          {/* Pipeline Tab */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Pipeline Status</span>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Running
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    Success
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {pipelineSteps.map((step, index) => (
                  <div
                    key={step.name}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex-shrink-0">
                      {step.status === 'running' ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                      ) : step.status === 'success' ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                      ) : step.status === 'error' ? (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <span className="text-xs text-white/30">{index + 1}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/80">{step.name}</span>
                        {step.duration > 0 && (
                          <span className="text-xs text-white/40">{step.duration}ms</span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {step.status === 'pending' && 'Waiting...'}
                        {step.status === 'running' && 'Processing...'}
                        {step.status === 'success' && 'Completed'}
                        {step.status === 'error' && 'Failed'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total time */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-sm text-white/60">Total Pipeline Time</span>
                <span className="text-sm font-medium text-white">
                  {pipelineSteps.reduce((acc, s) => acc + s.duration, 0)}ms
                </span>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">
                  {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                </span>
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <Terminal className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No logs yet</p>
                  <p className="text-xs text-white/30 mt-1">Run a test to generate logs</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <div className="flex items-start gap-3">
                        {getLogIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                              log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
                              log.level === 'success' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {log.level}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 mt-1">{log.message}</p>
                          
                          {!!log.data && (
                            <div className="mt-2">
                              <button
                                onClick={() => toggleLogExpand(index)}
                                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60"
                              >
                                {expandedLogs.has(index) ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                Data
                              </button>
                              
                              {expandedLogs.has(index) && (
                                <pre className="mt-2 p-2 rounded bg-black/50 text-xs text-white/50 overflow-auto">
                                  {JSON.stringify(log.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-white/40">
            <div className="flex items-center gap-4">
              <span>Provider: <span className="text-white/60">{provider}</span></span>
              <span>Model: <span className="text-white/60">{model}</span></span>
            </div>
            <span>Debug Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugView;
