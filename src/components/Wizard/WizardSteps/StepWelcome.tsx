import React, { useEffect } from 'react';
import { Sparkles, Shield, Zap, Code, MessageSquare, Eye } from 'lucide-react';
import { StepProps } from '../../../types';

interface StepWelcomeProps extends StepProps {
  setCanProceed: (can: boolean) => void;
  onSwitchMode: (mode: 'quick' | 'advanced') => void;
  currentMode: 'quick' | 'advanced';
}

const FEATURES = [
  {
    icon: Eye,
    title: '99% Invisible',
    description: 'Undetectable window that bypasses most screen capture methods'
  },
  {
    icon: Code,
    title: 'AI-Powered Solutions',
    description: 'Get detailed coding solutions with complexity analysis'
  },
  {
    icon: MessageSquare,
    title: 'Behavioral Interview',
    description: 'STAR-formatted answers based on your experience'
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your API keys stored locally, nothing sent to our servers'
  }
];

export const StepWelcome: React.FC<StepWelcomeProps> = ({
  setCanProceed,
  onSwitchMode,
  currentMode
}) => {
  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-2">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white">
          Welcome to Interview Assistant
        </h3>
        <p className="text-white/60 text-sm max-w-sm mx-auto">
          Your AI-powered companion for technical interviews. 
          Get real-time assistance while staying completely invisible.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((feature, index) => (
          <div
            key={index}
            className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors"
          >
            <feature.icon className="w-5 h-5 text-white/70 mb-2" />
            <div className="text-sm font-medium text-white/90 mb-1">
              {feature.title}
            </div>
            <div className="text-xs text-white/50 leading-relaxed">
              {feature.description}
            </div>
          </div>
        ))}
      </div>

      {/* Mode selection */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-white/70 text-center">
          Choose your setup mode:
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSwitchMode('quick')}
            className={`p-4 rounded-xl border transition-all text-left ${
              currentMode === 'quick'
                ? 'bg-white/10 border-white/30'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className={`w-4 h-4 ${currentMode === 'quick' ? 'text-white' : 'text-white/50'}`} />
              <span className={`font-medium ${currentMode === 'quick' ? 'text-white' : 'text-white/70'}`}>
                Quick Start
              </span>
            </div>
            <p className="text-xs text-white/50">
              3 minutes • Essential config only
            </p>
          </button>

          <button
            onClick={() => onSwitchMode('advanced')}
            className={`p-4 rounded-xl border transition-all text-left ${
              currentMode === 'advanced'
                ? 'bg-white/10 border-white/30'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={`w-4 h-4 ${currentMode === 'advanced' ? 'text-white' : 'text-white/50'}`} />
              <span className={`font-medium ${currentMode === 'advanced' ? 'text-white' : 'text-white/70'}`}>
                Advanced
              </span>
            </div>
            <p className="text-xs text-white/50">
              8 minutes • Full customization
            </p>
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <Shield className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          <strong className="text-white/60">Privacy Notice:</strong> Your API keys are stored 
          locally on your device. We never send your data to our servers. This tool is for 
          learning and practice purposes.
        </p>
      </div>
    </div>
  );
};

export default StepWelcome;
