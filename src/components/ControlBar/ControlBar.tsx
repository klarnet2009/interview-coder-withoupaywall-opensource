import React from 'react';
import { 
  Pause, 
  Play, 
  Trash2, 
  Settings, 
  Bug,
  Layers,
  MessageSquare,
  Code
} from 'lucide-react';
import { AnswerStyle, InterviewMode } from '../../types';

interface ControlBarProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onClearContext: () => void;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
  currentStyle: AnswerStyle;
  onChangeStyle: (style: AnswerStyle) => void;
  interviewMode: InterviewMode;
  onChangeMode: (mode: InterviewMode) => void;
  canClear: boolean;
}

const STYLES: { id: AnswerStyle; label: string; icon: typeof Code }[] = [
  { id: 'concise', label: 'Concise', icon: Layers },
  { id: 'structured', label: 'Structured', icon: Layers },
  { id: 'detailed', label: 'Detailed', icon: MessageSquare },
  { id: 'star', label: 'STAR', icon: Code },
];

const MODES: { id: InterviewMode; label: string }[] = [
  { id: 'coding', label: 'Coding' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'system_design', label: 'System Design' },
];

export const ControlBar: React.FC<ControlBarProps> = ({
  isPaused,
  onTogglePause,
  onClearContext,
  onOpenSettings,
  onOpenDebug,
  currentStyle,
  onChangeStyle,
  interviewMode,
  onChangeMode,
  canClear
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-t border-white/10">
      {/* Left section - Main controls */}
      <div className="flex items-center gap-2">
        {/* Pause/Resume */}
        <button
          onClick={onTogglePause}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isPaused
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isPaused ? 'Resume listening' : 'Pause listening'}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          )}
        </button>

        {/* Clear */}
        <button
          onClick={onClearContext}
          disabled={!canClear}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear context"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Interview Mode */}
        <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onChangeMode(mode.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                interviewMode === mode.id
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {mode.label.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Right section - Secondary controls */}
      <div className="flex items-center gap-2">
        {/* Answer Style */}
        <div className="hidden sm:flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onChangeStyle(style.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentStyle === style.id
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Mobile style selector */}
        <select
          value={currentStyle}
          onChange={(e) => onChangeStyle(e.target.value as AnswerStyle)}
          className="sm:hidden text-xs bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-white/70 focus:outline-none"
        >
          {STYLES.map(style => (
            <option key={style.id} value={style.id}>{style.label}</option>
          ))}
        </select>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Debug */}
        <button
          onClick={onOpenDebug}
          className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          title="Debug & Test"
        >
          <Bug className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
