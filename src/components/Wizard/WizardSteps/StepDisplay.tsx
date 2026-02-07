import React, { useEffect, useState } from 'react';
import { Monitor, Minimize2, EyeOff, Keyboard, Check, Info } from 'lucide-react';
import { StepProps } from '../../../types';

interface StepDisplayProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

const DISPLAY_MODES = [
  {
    id: 'standard' as const,
    title: 'Standard Window',
    description: 'Normal application window',
    icon: Monitor
  },
  {
    id: 'overlay' as const,
    title: 'Overlay Mode',
    description: 'Floats over other apps, semi-transparent',
    icon: Minimize2,
    recommended: true
  },
  {
    id: 'mini' as const,
    title: 'Mini Widget',
    description: 'Compact, shows only current suggestion',
    icon: Minimize2
  },
  {
    id: 'tray' as const,
    title: 'System Tray Only',
    description: 'Hidden, hotkey to show',
    icon: EyeOff
  }
];

const HOTKEYS = [
  { id: 'toggle', label: 'Show/Hide App', defaultValue: 'Ctrl + `' },
  { id: 'pause', label: 'Pause/Resume', defaultValue: 'Ctrl + Space' },
  { id: 'copy', label: 'Copy Last Answer', defaultValue: 'Ctrl + Shift + C' },
  { id: 'compact', label: 'Toggle Compact Mode', defaultValue: 'Ctrl + =' },
  { id: 'emergencyHide', label: 'Emergency Hide (press 3x)', defaultValue: 'Esc Esc Esc' }
];

export const StepDisplay: React.FC<StepDisplayProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const [selectedMode, setSelectedMode] = useState(data.displayConfig?.mode || 'overlay');
  const [stealthMode, setStealthMode] = useState(data.displayConfig?.stealthMode || false);
  const [hideFromTaskbar, setHideFromTaskbar] = useState(data.displayConfig?.hideFromTaskbar || false);
  const [dimOnMouseAway, setDimOnMouseAway] = useState(data.displayConfig?.dimOnMouseAway || false);

  useEffect(() => {
    setCanProceed(true);
    onUpdate({
      displayConfig: {
        mode: selectedMode,
        opacity: data.displayConfig?.opacity || 1.0,
        stealthMode,
        hideFromTaskbar,
        hideTitle: data.displayConfig?.hideTitle || false,
        dimOnMouseAway,
        hotkeys: data.displayConfig?.hotkeys || {
          toggle: 'Ctrl+`',
          pause: 'Ctrl+Space',
          copy: 'Ctrl+Shift+C',
          compact: 'Ctrl+=',
          emergencyHide: 'Esc Esc Esc'
        }
      }
    });
  }, [selectedMode, stealthMode, hideFromTaskbar, dimOnMouseAway, setCanProceed]);

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/60">
        Configure how the app appears on screen. Choose a mode that works best 
        for your interview setup.
      </div>

      {/* Display mode selection */}
      <div className="grid grid-cols-2 gap-2">
        {DISPLAY_MODES.map((mode) => (
          <div
            key={mode.id}
            onClick={() => setSelectedMode(mode.id)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              selectedMode === mode.id
                ? 'bg-white/10 border-white/30'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                selectedMode === mode.id ? 'bg-white/20' : 'bg-white/5'
              }`}>
                <mode.icon className={`w-4 h-4 ${
                  selectedMode === mode.id ? 'text-white' : 'text-white/50'
                }`} />
              </div>
              {mode.recommended && (
                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded">
                  Recommended
                </span>
              )}
              {selectedMode === mode.id && (
                <Check className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`font-medium text-sm mb-1 ${
              selectedMode === mode.id ? 'text-white' : 'text-white/80'
            }`}>
              {mode.title}
            </div>
            <div className="text-xs text-white/50">
              {mode.description}
            </div>
          </div>
        ))}
      </div>

      {/* Stealth options */}
      <div className="space-y-3 p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <EyeOff className="w-4 h-4 text-white/60" />
          <span className="text-sm font-medium text-white/80">Stealth Options</span>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={stealthMode}
              onChange={(e) => setStealthMode(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50"
            />
            <div>
              <div className="text-sm text-white/80">Enable stealth mode</div>
              <div className="text-xs text-white/50">Minimal UI, reduced visibility</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideFromTaskbar}
              onChange={(e) => setHideFromTaskbar(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50"
            />
            <div>
              <div className="text-sm text-white/80">Hide from taskbar</div>
              <div className="text-xs text-white/50">Window won't appear in taskbar or Alt+Tab</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dimOnMouseAway}
              onChange={(e) => setDimOnMouseAway(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50"
            />
            <div>
              <div className="text-sm text-white/80">Dim when mouse away</div>
              <div className="text-xs text-white/50">Reduce opacity when cursor leaves window</div>
            </div>
          </label>
        </div>
      </div>

      {/* Hotkeys info */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="w-4 h-4 text-white/60" />
          <span className="text-sm font-medium text-white/80">Default Hotkeys</span>
        </div>
        <div className="space-y-2">
          {HOTKEYS.map((hotkey) => (
            <div key={hotkey.id} className="flex justify-between text-sm">
              <span className="text-white/60">{hotkey.label}</span>
              <span className="text-white/80 font-mono">{hotkey.defaultValue}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
          <Info className="w-3 h-3 text-white/40 mt-0.5" />
          <p className="text-xs text-white/40">
            Hotkeys can be customized in Settings after completing the wizard.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StepDisplay;
