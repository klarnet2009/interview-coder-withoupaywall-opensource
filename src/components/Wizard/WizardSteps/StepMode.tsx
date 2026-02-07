import React, { useEffect, useState } from 'react';
import { Code, MessageCircle, Layers, Check } from 'lucide-react';
import { StepProps } from '../../../types';

interface StepModeProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

const INTERVIEW_MODES = [
  {
    id: 'coding' as const,
    title: 'Coding Interview',
    description: 'Algorithm problems, data structures, system design',
    icon: Code
  },
  {
    id: 'behavioral' as const,
    title: 'Behavioral Interview',
    description: 'STAR-formatted answers about your experience',
    icon: MessageCircle
  },
  {
    id: 'system_design' as const,
    title: 'System Design',
    description: 'Architecture, scalability, trade-offs',
    icon: Layers
  }
];

const ANSWER_STYLES = [
  { id: 'concise', title: 'Concise', description: 'Brief bullet points' },
  { id: 'structured', title: 'Structured', description: 'Organized sections' },
  { id: 'detailed', title: 'Detailed', description: 'Comprehensive explanation' },
  { id: 'star', title: 'STAR Format', description: 'Situation-Task-Action-Result' }
];

export const StepMode: React.FC<StepModeProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const [selectedMode, setSelectedMode] = useState(data.interviewPreferences?.mode || 'coding');
  const [selectedStyle, setSelectedStyle] = useState(data.interviewPreferences?.answerStyle || 'structured');

  useEffect(() => {
    setCanProceed(true);
    onUpdate({
      interviewPreferences: {
        ...data.interviewPreferences,
        mode: selectedMode,
        answerStyle: selectedStyle,
        language: data.interviewPreferences?.language || 'english',
        answerLanguage: data.interviewPreferences?.answerLanguage || 'same',
        autoDetectLanguage: data.interviewPreferences?.autoDetectLanguage || false,
        confidenceHelper: data.interviewPreferences?.confidenceHelper ?? true
      }
    });
  }, [selectedMode, selectedStyle, setCanProceed]);

  return (
    <div className="space-y-6">
      {/* Interview Mode */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          Interview Type
        </label>
        <div className="space-y-2">
          {INTERVIEW_MODES.map((mode) => (
            <div
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedMode === mode.id
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedMode === mode.id ? 'bg-white/20' : 'bg-white/5'
              }`}>
                <mode.icon className={`w-5 h-5 ${
                  selectedMode === mode.id ? 'text-white' : 'text-white/50'
                }`} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${
                  selectedMode === mode.id ? 'text-white' : 'text-white/80'
                }`}>
                  {mode.title}
                </div>
                <div className="text-xs text-white/50">
                  {mode.description}
                </div>
              </div>
              {selectedMode === mode.id && (
                <Check className="w-5 h-5 text-white" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Answer Style */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          Default Answer Style
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ANSWER_STYLES.map((style) => (
            <div
              key={style.id}
              onClick={() => setSelectedStyle(style.id as any)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedStyle === style.id
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
              }`}
            >
              <div className={`font-medium text-sm mb-1 ${
                selectedStyle === style.id ? 'text-white' : 'text-white/80'
              }`}>
                {style.title}
              </div>
              <div className="text-xs text-white/50">
                {style.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Helper */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
        <input
          type="checkbox"
          checked={data.interviewPreferences?.confidenceHelper ?? true}
          onChange={(e) => onUpdate({
            interviewPreferences: {
              ...data.interviewPreferences!,
              confidenceHelper: e.target.checked
            }
          })}
          className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50"
        />
        <div>
          <div className="font-medium text-white/80 text-sm">Confidence Helper</div>
          <div className="text-xs text-white/50">
            Suggest clarifying questions when the interview question is ambiguous
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepMode;
