import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WizardMode,
  AppConfig,
  DEFAULT_CONFIG,
  WizardStepConfig
} from '../../types';
import { StepWelcome } from './WizardSteps/StepWelcome';
import { StepModeSelect } from './WizardSteps/StepModeSelect';
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
  { id: 'welcome', title: 'welcome', description: 'welcome', component: StepWelcome, required: true, quickMode: true },
  { id: 'modeselect', title: 'modeselect', description: 'modeselect', component: StepModeSelect, required: true, quickMode: true },
  { id: 'provider', title: 'provider', description: 'provider', component: StepProvider, required: true, quickMode: true },
  { id: 'apikey', title: 'apikey', description: 'apikey', component: StepApiKey, required: true, quickMode: true },
  { id: 'profile', title: 'profile', description: 'profile', component: StepProfile, required: false, quickMode: false },
  { id: 'mode', title: 'mode', description: 'mode', component: StepMode, required: false, quickMode: false },
  { id: 'audio', title: 'audio', description: 'audio', component: StepAudio, required: false, quickMode: false },
  { id: 'display', title: 'display', description: 'display', component: StepDisplay, required: false, quickMode: false },
  { id: 'test', title: 'test', description: 'test', component: StepTest, required: false, quickMode: false },
  { id: 'ready', title: 'ready', description: 'ready', component: StepReady, required: true, quickMode: true },
];

export const WizardContainer: React.FC<WizardContainerProps> = ({
  initialMode = 'quick',
  onComplete,
  onSkip
}) => {
  const [mode, setMode] = useState<WizardMode>(initialMode);
  const { t } = useTranslation();
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
  const wizardRef = useRef<HTMLDivElement>(null);

  // Resize window to fit wizard card tightly (no black bars)
  useEffect(() => {
    window.electronAPI?.setSetupWindowSize({ width: 520, height: 640 });
  }, []);



  return (
    <div ref={wizardRef} className="w-full h-screen bg-[#0a0a0a] flex flex-col rounded-2xl overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header — draggable region */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">
              {t('wizard.title')}
            </div>
            <span className="text-xs px-2 py-0.5 bg-white/10 text-white/60 rounded-full">
              {mode === 'quick' ? t('wizard.quickSetup') : t('wizard.advancedSetup')}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            title={t('wizard.skipWizard')}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
        <div className="flex items-center justify-center gap-1 px-6 py-3 bg-white/2">
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
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {currentStep.id !== 'welcome' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-1">
                {t(`wizard.steps.${currentStep.id}.title`)}
              </h2>
              <p className="text-sm text-white/50">
                {t(`wizard.steps.${currentStep.id}.description`)}
              </p>
            </div>
          )}

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

        {/* Footer — hidden on welcome step (has its own Start button) */}
        {currentStep.id !== 'welcome' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/2">
            <button
              onClick={handleBack}
              disabled={isFirstStep}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isFirstStep
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
              {t('wizard.back')}
            </button>

            <div className="flex items-center gap-3">

              <button
                onClick={handleNext}
                disabled={!canProceed && currentStep.required}
                className={`flex items-center gap-1 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${!canProceed && currentStep.required
                  ? 'bg-white/20 text-white/40 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-white/90'
                  }`}
              >
                {isLastStep ? t('wizard.complete') : t('wizard.continue')}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WizardContainer;
