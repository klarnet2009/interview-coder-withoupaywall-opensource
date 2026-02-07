import React, { useEffect, useState } from 'react';
import { Mic, Monitor, Headphones, Check, Volume2, Search, RefreshCw } from 'lucide-react';
import { StepProps } from '../../../types';

interface StepAudioProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

const AUDIO_SOURCES = [
  {
    id: 'microphone' as const,
    title: 'Microphone',
    description: 'Capture your own voice (for practice)',
    icon: Mic
  },
  {
    id: 'system' as const,
    title: 'System Audio',
    description: 'Capture all computer audio — works with Zoom, Teams, Meet',
    icon: Monitor,
    recommended: true
  },
  {
    id: 'application' as const,
    title: 'Specific Application',
    description: 'Capture audio from a specific app (Zoom, Teams, etc.)',
    icon: Headphones
  }
];

interface AudioSource {
  id: string;
  name: string;
  appIcon: string | null;
}

export const StepAudio: React.FC<StepAudioProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const [selectedSource, setSelectedSource] = useState(data.audioConfig?.source || 'system');
  const [selectedApp, setSelectedApp] = useState(data.audioConfig?.applicationName || '');
  const [autoStart, setAutoStart] = useState(data.audioConfig?.autoStart ?? true);
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [availableWindows, setAvailableWindows] = useState<AudioSource[]>([]);
  const [isLoadingWindows, setIsLoadingWindows] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setCanProceed(true);
    onUpdate({
      audioConfig: {
        source: selectedSource,
        applicationName: selectedSource === 'application' ? selectedApp : undefined,
        autoStart,
        testCompleted: data.audioConfig?.testCompleted || false
      }
    });
  }, [selectedSource, selectedApp, autoStart, setCanProceed]);

  // Fetch available windows when application source is selected
  useEffect(() => {
    if (selectedSource === 'application') {
      fetchAudioSources();
    }
  }, [selectedSource]);

  const fetchAudioSources = async () => {
    setIsLoadingWindows(true);
    try {
      const sources = await window.electronAPI.getAudioSources();
      setAvailableWindows(sources);
    } catch (error) {
      console.error('Error fetching audio sources:', error);
    } finally {
      setIsLoadingWindows(false);
    }
  };

  const testAudio = () => {
    setIsTesting(true);
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      setIsTesting(false);
      setAudioLevel(0);
      onUpdate({
        audioConfig: {
          source: selectedSource,
          applicationName: selectedSource === 'application' ? selectedApp : undefined,
          autoStart,
          testCompleted: true
        }
      });
    }, 3000);
  };

  const filteredWindows = availableWindows.filter(window =>
    window.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Common apps for quick selection
  const commonApps = ['Zoom', 'Teams', 'Meet', 'Chrome', 'Edge', 'Firefox', 'Discord', 'Slack'];
  const quickSelectApps = availableWindows.filter(w => 
    commonApps.some(app => w.name.toLowerCase().includes(app.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/60">
        Choose how the app will listen to your interview. System Audio works for most cases, 
        but you can select a specific app for better isolation.
      </div>

      {/* Audio source selection */}
      <div className="space-y-2">
        {AUDIO_SOURCES.map((source) => (
          <div
            key={source.id}
            onClick={() => setSelectedSource(source.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selectedSource === source.id
                ? 'bg-white/10 border-white/30'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedSource === source.id ? 'bg-white/20' : 'bg-white/5'
            }`}>
              <source.icon className={`w-5 h-5 ${
                selectedSource === source.id ? 'text-white' : 'text-white/50'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${
                  selectedSource === source.id ? 'text-white' : 'text-white/80'
                }`}>
                  {source.title}
                </span>
                {source.recommended && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-xs text-white/50">
                {source.description}
              </div>
            </div>
            {selectedSource === source.id && (
              <Check className="w-5 h-5 text-white" />
            )}
          </div>
        ))}
      </div>

      {/* Application selector */}
      {selectedSource === 'application' && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white/80">Select Application</span>
            </div>
            <button
              onClick={fetchAudioSources}
              disabled={isLoadingWindows}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingWindows ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search applications..."
              className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          </div>

          {/* Quick select - common apps */}
          {!searchQuery && quickSelectApps.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-white/40">Quick Select:</span>
              <div className="flex flex-wrap gap-2">
                {quickSelectApps.slice(0, 6).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedApp === app.name
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-white/[0.05] text-white/70 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {app.appIcon && (
                      <img src={app.appIcon} alt="" className="w-4 h-4 rounded" />
                    )}
                    <span className="truncate max-w-[120px]">{app.name}</span>
                    {selectedApp === app.name && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All windows list */}
          <div className="space-y-2">
            <span className="text-xs text-white/40">
              {searchQuery ? 'Search Results' : 'All Windows'} 
              <span className="text-white/30">({filteredWindows.length})</span>
            </span>
            
            <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
              {isLoadingWindows ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-white/40 animate-spin" />
                </div>
              ) : filteredWindows.length === 0 ? (
                <div className="text-center py-4 text-sm text-white/40">
                  {searchQuery ? 'No matching windows found' : 'No windows available'}
                </div>
              ) : (
                filteredWindows.map((window) => (
                  <button
                    key={window.id}
                    onClick={() => setSelectedApp(window.name)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                      selectedApp === window.name
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-white/[0.02] border border-transparent hover:bg-white/5'
                    }`}
                  >
                    {window.appIcon ? (
                      <img src={window.appIcon} alt="" className="w-6 h-6 rounded" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs">
                        {window.name.charAt(0)}
                      </div>
                    )}
                    <span className={`text-sm truncate flex-1 ${
                      selectedApp === window.name ? 'text-white' : 'text-white/70'
                    }`}>
                      {window.name}
                    </span>
                    {selectedApp === window.name && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected app indicator */}
          {selectedApp && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">Selected: {selectedApp}</span>
            </div>
          )}
        </div>
      )}

      {/* Audio test */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-white/60" />
            <span className="text-sm font-medium text-white/80">Audio Test</span>
          </div>
          <button
            onClick={testAudio}
            disabled={isTesting}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test Audio'}
          </button>
        </div>

        {/* VU Meter */}
        <div className="space-y-1">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 rounded-full ${
                audioLevel > 80 ? 'bg-red-500' :
                audioLevel > 50 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>Quiet</span>
            <span>Optimal</span>
            <span>Loud</span>
          </div>
        </div>

        {data.audioConfig?.testCompleted && !isTesting && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Check className="w-4 h-4" />
            Audio test completed
          </div>
        )}
      </div>

      {/* Auto-start option */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50"
        />
        <div>
          <div className="font-medium text-white/80 text-sm">Auto-start listening</div>
          <div className="text-xs text-white/50">
            Automatically start listening when you complete the wizard
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepAudio;
