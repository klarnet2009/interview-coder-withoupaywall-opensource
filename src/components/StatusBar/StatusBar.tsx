import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Mic, 
  MicOff, 
  Pause,
  Settings,
  Clock,
  Globe,
  Cpu,
  Keyboard,
  X,
  Command
} from 'lucide-react';
import { ConnectionStatus, ProcessingStatus, APIProvider } from '../../types';

interface StatusBarProps {
  connection: ConnectionStatus;
  processing: ProcessingStatus;
  provider: APIProvider;
  model: string;
  latency: number;
  language: string;
  isPaused: boolean;
  onTogglePause: () => void;
  onOpenSettings: () => void;
}

const PROVIDER_INFO: Record<APIProvider, { name: string; color: string }> = {
  gemini: { name: 'Gemini', color: 'text-blue-400' },
  openai: { name: 'OpenAI', color: 'text-green-400' },
  anthropic: { name: 'Claude', color: 'text-orange-400' }
};

const HOTKEYS = [
  { key: 'Ctrl + B', action: 'Show/Hide app' },
  { key: 'Ctrl + H', action: 'Take screenshot' },
  { key: 'Ctrl + Enter', action: 'Process' },
  { key: 'Ctrl + L', action: 'Delete last screenshot' },
  { key: 'Ctrl + R', action: 'Reset view' },
  { key: 'Ctrl + Arrow', action: 'Move window' },
  { key: 'Ctrl + [ / ]', action: 'Decrease/Increase opacity' },
  { key: 'Ctrl + - / 0 / =', action: 'Zoom controls' },
  { key: 'Ctrl + Q', action: 'Quit app' },
];

export const StatusBar: React.FC<StatusBarProps> = ({
  connection,
  processing,
  provider,
  model,
  latency,
  language,
  isPaused,
  onTogglePause,
  onOpenSettings
}) => {
  const [showHotkeys, setShowHotkeys] = useState(false);

  const getConnectionIcon = () => {
    switch (connection) {
      case 'connected':
        return <Wifi className="w-3.5 h-3.5 text-green-400" />;
      case 'disconnected':
        return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'rate_limited':
        return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <Wifi className="w-3.5 h-3.5 text-white/40" />;
    }
  };

  const getProcessingIcon = () => {
    if (isPaused) {
      return <Pause className="w-3.5 h-3.5 text-yellow-400" />;
    }
    
    switch (processing) {
      case 'listening':
        return <Mic className="w-3.5 h-3.5 text-green-400 animate-pulse" />;
      case 'processing':
        return <Cpu className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      case 'ready':
        return <Mic className="w-3.5 h-3.5 text-white/60" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <MicOff className="w-3.5 h-3.5 text-white/40" />;
    }
  };

  const getLatencyColor = () => {
    if (latency < 500) return 'text-green-400';
    if (latency < 1500) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusText = () => {
    if (isPaused) return 'Paused';
    
    switch (processing) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'ready':
        return 'Ready';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  const providerInfo = PROVIDER_INFO[provider];

  // Extract short model name
  const shortModelName = model 
    ? model.replace('gemini-', '').replace('gpt-', '').replace('claude-', '')
    : '';

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/50 backdrop-blur-sm border-b border-white/10">
        {/* Left section - Status */}
        <div className="flex items-center gap-4">
          {/* Processing status */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePause}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {getProcessingIcon()}
              <span className={`text-xs font-medium ${
                isPaused ? 'text-yellow-400' : 
                processing === 'listening' ? 'text-green-400' :
                processing === 'processing' ? 'text-blue-400' :
                'text-white/60'
              }`}>
                {getStatusText()}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-white/10" />

          {/* Provider + Model */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">AI:</span>
            <span className={`text-xs font-medium ${providerInfo.color}`}>
              {providerInfo.name}
            </span>
            {shortModelName && (
              <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                {shortModelName}
              </span>
            )}
          </div>

          {/* Latency */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-white/40" />
            <span className={`text-xs ${getLatencyColor()}`}>
              {latency}ms
            </span>
          </div>
        </div>

        {/* Right section - Connection & Language */}
        <div className="flex items-center gap-4">
          {/* Language */}
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/60 uppercase">
              {language}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-white/10" />

          {/* Connection status */}
          <div className="flex items-center gap-1.5" title={`Connection: ${connection}`}>
            {getConnectionIcon()}
            <span className={`text-xs capitalize ${
              connection === 'connected' ? 'text-green-400' :
              connection === 'rate_limited' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {connection === 'rate_limited' ? 'Rate Limited' : connection}
            </span>
          </div>

          {/* Hotkeys button */}
          <button
            onClick={() => setShowHotkeys(true)}
            className="flex items-center gap-1.5 p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Hotkeys</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hotkeys Modal */}
      {showHotkeys && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-white/60" />
                <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setShowHotkeys(false)}
                className="p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-2">
                {HOTKEYS.map((hotkey, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="text-sm text-white/70">{hotkey.action}</span>
                    <kbd className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-xs text-white/80 font-mono">
                      <Command className="w-3 h-3" />
                      {hotkey.key.replace('Ctrl + ', '')}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  <strong>Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Ctrl + B</kbd> to quickly show or hide the app during your interview.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatusBar;
