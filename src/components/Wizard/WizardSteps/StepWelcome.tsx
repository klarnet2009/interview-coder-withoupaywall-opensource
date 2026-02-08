import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Shield, Code, MessageSquare, Eye, ArrowRight } from 'lucide-react';
import { StepProps } from '../../../types';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const FEATURES = [
  { icon: Eye, titleKey: 'wizard.steps.welcome.features.invisible', hintKey: 'wizard.steps.welcome.hints.invisible' },
  { icon: Code, titleKey: 'wizard.steps.welcome.features.ai', hintKey: 'wizard.steps.welcome.hints.ai' },
  { icon: MessageSquare, titleKey: 'wizard.steps.welcome.features.behavioral', hintKey: 'wizard.steps.welcome.hints.behavioral' },
  { icon: Shield, titleKey: 'wizard.steps.welcome.features.privacy', hintKey: 'wizard.steps.welcome.hints.privacy' },
];

export const StepWelcome: React.FC<StepProps> = ({
  setCanProceed,
  onNext,
}) => {
  const { t, i18n } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setCanProceed?.(true);
  }, [setCanProceed]);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    window.electronAPI?.updateConfig({ uiLanguage: langCode }).catch(() => { });
  };

  return (
    <div className="space-y-5 flex flex-col items-center">
      {/* Welcome message */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mb-1">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white">
          {t('wizard.steps.welcome.heading')}
        </h3>
        <p className="text-white/50 text-sm max-w-xs mx-auto">
          {t('wizard.steps.welcome.subtitle')}
        </p>
      </div>

      {/* Language selector */}
      <div className="flex items-center justify-center gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${i18n.language === lang.code
                ? 'bg-white/10 border border-white/25 text-white'
                : 'bg-white/3 border border-white/8 text-white/50 hover:bg-white/5'
              }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>

      {/* Features with hover hints */}
      <div className="space-y-2 w-full">
        {FEATURES.map((feature, index) => (
          <div
            key={index}
            className="rounded-xl bg-white/3 border border-white/5 overflow-hidden transition-all duration-300 cursor-default hover:bg-white/5 hover:border-white/10"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <feature.icon className={`w-4 h-4 shrink-0 transition-colors duration-300 ${hoveredIndex === index ? 'text-white' : 'text-white/50'
                }`} />
              <span className={`text-[13px] transition-colors duration-300 ${hoveredIndex === index ? 'text-white' : 'text-white/70'
                }`}>
                {t(feature.titleKey)}
              </span>
            </div>
            {/* Expandable hint */}
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{
                maxHeight: hoveredIndex === index ? '80px' : '0px',
                opacity: hoveredIndex === index ? 1 : 0,
              }}
            >
              <p className="px-3 pb-3 pt-0 text-[12px] text-white/45 leading-relaxed pl-10">
                {t(feature.hintKey)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Centered Start button */}
      <button
        onClick={onNext}
        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all mt-2"
      >
        {t('wizard.start')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default StepWelcome;
