import React, { useState, useCallback, useMemo } from 'react';
import {
  WizardMode,
  WizardStep,
  WizardState,
  AppConfig,
  DEFAULT_CONFIG,
  WizardStepConfig
} from '../../types';
import { StepWelcome } from './WizardSteps/StepWelcome';
import { StepProvider } from './WizardSteps/StepProvider';
import { StepApiKey } from './WizardSteps/StepApiKey';
import { StepProfile } from './WizardSteps/StepProfile';
import { StepMode } from './WizardSteps/StepMode';
import { StepAudio } from './WizardSteps/StepAudio';
import { StepDisplay } from './WizardSteps/StepDisplay';
import { StepTest } from './WizardSteps/StepTest';
import { StepReady } from './WizardSteps/StepReady';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WizardContainerProps {
  initialMode?: WizardMode;
  onComplete: (config: Partial<AppConfig>, mode: WizardMode) => void;
  onSkip: () => void;
}

const WIZARD_STEPS: WizardStepConfig[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with Interview Assistant', component: StepWelcome, required: true, quickMode: true },
  { id: 'provider', title: 'Provider', description: 'Choose your AI provider', component: StepProvider, required: true, quickMode: true },
  { id: 'apikey', title: 'API Key', description: 'Enter your API key', component: StepApiKey, required: true, quickMode: true },
  { id: 'profile', title: 'Profile', description: 'Set up your profile', component: StepProfile, required: false, quickMode: false },
  { id: 'mode', title: 'Mode', description: 'Configure interview preferences', component: StepMode, required: false, quickMode: false },
  { id: 'audio', title: 'Audio', description: 'Configure audio input', component: StepAudio, required: false, quickMode: false },
  { id: 'display', title: 'Display', description: 'Configure display settings', component: StepDisplay, required: false, quickMode: false },
  { id: 'test', title: 'Test', description: 'Test your setup', component: StepTest, required: false, quickMode: false },
  { id: 'ready', title: 'Ready', description: 'You are all set!', component: StepReady, required: true, quickMode: true },
];

export const WizardContainer: React.FC<WizardContainerProps> = ({
  initialMode = 'quick',
  onComplete,
  onSkip
}) => {
  const [mode, setMode] = useState<WizardMode>(initialMode);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [config, setConfig] = useState<Partial<AppConfig>>({
    apiProvider: 'gemini',
    apiKey: '',
    extractionModel: 'gemini-3-flash-preview',
    solutionModel: 'gemini-3-flash-preview',
    debuggingModel: 'gemini-3-flash-preview',
    language: 'python',
    opacity: 1.0,
    wizardCompleted: false,
    profiles: [],
    interviewPreferences: DEFAULT_CONFIG.interviewPreferences,
    audioConfig: DEFAULT_CONFIG.audioConfig,
    displayConfig: DEFAULT_CONFIG.displayConfig,
  });
  const [canProceed, setCanProceed] = useState(false);

  // Get steps based on mode
  const steps = useMemo(() => {
    return WIZARD_STEPS.filter(step => mode === 'advanced' || step.quickMode);
  }, [mode]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleUpdateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete(config, mode);
    } else {
      setCurrentStepIndex(prev => prev + 1);
      setCanProceed(false);
    }
  }, [isLastStep, currentStepIndex, config, mode, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [isFirstStep, currentStepIndex]);

  const handleSetCanProceed = useCallback((can: boolean) => {
    setCanProceed(can);
  }, []);

  const handleSwitchMode = useCallback((newMode: WizardMode) => {
    setMode(newMode);
    // Reset to appropriate step
    const newSteps = WIZARD_STEPS.filter(step => newMode === 'advanced' || step.quickMode);
    // Try to find current step in new steps, otherwise go to provider
    const currentStepId = currentStep.id;
    const newIndex = newSteps.findIndex(s => s.id === currentStepId);
    setCurrentStepIndex(newIndex >= 0 ? newIndex : 1);
  }, [currentStep]);

  const CurrentStepComponent = currentStep.component;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">
              Interview Assistant
            </div>
            <span className="text-xs px-2 py-0.5 bg-white/10 text-white/60 rounded-full">
              {mode === 'quick' ? 'Quick Setup' : 'Advanced Setup'}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            title="Skip wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-white/80 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 px-6 py-3 bg-white/[0.02]">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`w-2 h-2 rounded-full transition-all duration-200 ${index === currentStepIndex
                    ? 'bg-white w-4'
                    : index < currentStepIndex
                      ? 'bg-white/40'
                      : 'bg-white/10'
                  }`}
                title={step.title}
              />
              {index < steps.length - 1 && (
                <div className="w-4 h-px bg-white/10" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-6 min-h-[320px]">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-1">
              {currentStep.title}
            </h2>
            <p className="text-sm text-white/50">
              {currentStep.description}
            </p>
          </div>

          <CurrentStepComponent
            data={config}
            onUpdate={handleUpdateConfig}
            onNext={handleNext}
            onBack={handleBack}
            isActive={true}
            setCanProceed={handleSetCanProceed}
            onSwitchMode={handleSwitchMode}
            currentMode={mode}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isFirstStep
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {mode === 'quick' && currentStep.id === 'welcome' && (
              <button
                onClick={() => handleSwitchMode('advanced')}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Switch to Advanced
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={!canProceed && currentStep.required}
              className={`flex items-center gap-1 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${!canProceed && currentStep.required
                  ? 'bg-white/20 text-white/40 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-white/90'
                }`}
            >
              {isLastStep ? 'Complete' : 'Continue'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WizardContainer;
