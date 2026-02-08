import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

interface WelcomeScreenProps {
  onOpenSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenSettings }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resize the Electron window to a proper centered setup-mode size
  useEffect(() => {
    window.electronAPI?.setSetupWindowSize({ width: 460, height: 680 });
  }, []);

  // Workaround: transparent Electron windows on Windows swallow wheel events.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollTop += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const shortcuts = [
    [t('settings.shortcuts.toggleVisibility'), 'Ctrl+B'],
    [t('settings.shortcuts.takeScreenshot'), 'Ctrl+H'],
    [t('settings.shortcuts.deleteLastScreenshot'), 'Ctrl+L'],
    [t('settings.shortcuts.processScreenshots'), 'Ctrl+Enter'],
    [t('settings.shortcuts.resetView'), 'Ctrl+R'],
    [t('settings.shortcuts.quit'), 'Ctrl+Q'],
  ];

  return (
    <div className="bg-black w-full h-full flex flex-col select-none rounded-2xl overflow-hidden">
      {/* Drag area */}
      <div
        className="h-8 w-full shrink-0 flex items-center justify-end px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            className="w-3 h-3 rounded-full bg-white/20 hover:bg-red-500 transition-colors"
            onClick={() => window.electronAPI?.toggleMainWindow()}
            title="Hide"
          />
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 pb-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[22px] font-semibold text-white tracking-tight">
            {t('welcome.title')}
          </h1>
          <span className="text-[10px] font-medium px-2 py-0.5 bg-linear-to-r from-blue-500/30 to-purple-500/30 text-blue-300 rounded-full border border-blue-500/20 uppercase tracking-wider">
            {t('welcome.badge')}
          </span>
        </div>
        <p className="text-white/50 text-[13px] mb-5 leading-relaxed">
          {t('welcome.subtitle')}
        </p>

        {/* Shortcuts */}
        <div className="bg-white/3 border border-white/6 rounded-xl p-4 mb-4">
          <h3 className="text-white/80 font-medium mb-2.5 text-[13px]">{t('welcome.shortcutsTitle')}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {shortcuts.map(([label, key]) => (
              <div key={label} className="flex items-center justify-between text-[12px]">
                <span className="text-white/50">{label}</span>
                <kbd className="text-white/80 bg-white/6 border border-white/8 rounded px-1.5 py-0.5 text-[11px] font-mono ml-2 shrink-0">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-white/3 border border-white/6 rounded-xl p-4 mb-4">
          <h3 className="text-white/80 font-medium mb-1.5 text-[13px]">{t('welcome.gettingStarted')}</h3>
          <p className="text-white/50 text-[12px] mb-3 leading-relaxed">
            {t('welcome.gettingStartedDesc')}
          </p>
          <Button
            className="w-full py-2.5 bg-white text-black rounded-lg font-medium text-[13px] hover:bg-white/90 transition-all active:scale-[0.98]"
            onClick={onOpenSettings}
          >
            {t('welcome.openSettings')}
          </Button>
        </div>

        {/* Footer hint */}
        <div className="text-white/30 text-[12px] text-center mt-auto pt-3">
          {t('welcome.footerHint', { key: 'Ctrl+H' })}
        </div>
      </div>
    </div>
  );
};
