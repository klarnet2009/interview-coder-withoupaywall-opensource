import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  MessageSquare, 
  X, 
  Send,
  Image as ImageIcon,
  Check,
  Sparkles
} from 'lucide-react';

export interface Screenshot {
  path: string;
  preview: string;
}

export interface UnifiedInputProps {
  screenshots?: Screenshot[];
  onTakeScreenshot?: () => void;
  onDeleteScreenshot?: (index: number) => void;
  onSendText: (text: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
  defaultTab?: 'screenshot' | 'text';
}

const QUICK_ACTIONS = [
  {
    label: "⚡ Optimize O(N)",
    prompt: "Optimize this solution for optimal time complexity O(N) and minimal space complexity."
  },
  {
    label: "🐛 Fix Edge Cases",
    prompt: "Identify and fix all potential edge cases including empty inputs, boundaries, and duplicates."
  },
  {
    label: "💡 Explain Code",
    prompt: "Explain the algorithmic approach, step-by-step logic, and key data structures used in this code."
  }
];

export const UnifiedInput: React.FC<UnifiedInputProps> = ({
  screenshots = [],
  onTakeScreenshot,
  onDeleteScreenshot,
  onSendText,
  isProcessing = false,
  placeholder = "Ask a follow-up question, request optimization, or paste error output...",
  className = "",
  defaultTab
}) => {
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<'screenshot' | 'text'>(
    defaultTab || (screenshots.length > 0 ? 'screenshot' : 'text')
  );
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 56), 200);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  const handleSend = () => {
    if (text.trim() && !isProcessing) {
      onSendText(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          if (onTakeScreenshot) {
            onTakeScreenshot();
          }
          return;
        }
      }
    }
  };

  const handleChipClick = (action: { label: string; prompt: string }) => {
    if (isProcessing) return;
    setActiveChip(action.label);
    setTimeout(() => setActiveChip(null), 1500);
    onSendText(action.prompt);
  };

  const hasScreenshotsTab = Boolean(onTakeScreenshot || screenshots.length > 0);

  return (
    <div
      onPaste={handlePaste}
      className={`bg-[#0d1117]/90 border border-white/10 rounded-xl overflow-hidden shadow-xl backdrop-blur-md ${className}`}
    >
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 bg-white/[0.02]">
        <div className="flex items-center gap-1">
          {hasScreenshotsTab && (
            <button
              onClick={() => setActiveTab('screenshot')}
              className={`flex items-center gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === 'screenshot'
                  ? 'text-white border-blue-400 font-semibold'
                  : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Screenshots
              {screenshots.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full font-mono">
                  {screenshots.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === 'text'
                ? 'text-white border-blue-400 font-semibold'
                : 'text-white/40 border-transparent hover:text-white/70'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Follow-up & Prompt
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-white/35 font-mono">
          <Sparkles className="w-3 h-3 text-amber-400/70" />
          <span>AI Follow-up</span>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="px-3 pt-2.5 pb-1.5 flex flex-wrap items-center gap-1.5 bg-black/20 border-b border-white/5">
        <span className="text-[10px] uppercase font-semibold text-white/30 mr-1 tracking-wider">
          Quick Actions:
        </span>
        {QUICK_ACTIONS.map((action) => {
          const isClicked = activeChip === action.label;
          return (
            <button
              key={action.label}
              onClick={() => handleChipClick(action)}
              disabled={isProcessing}
              title={action.prompt}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                isClicked
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 scale-95'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {isClicked ? <Check className="w-3 h-3 text-emerald-400" /> : null}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === 'screenshot' && hasScreenshotsTab ? (
          <div className="space-y-3">
            {screenshots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {screenshots.map((screenshot, index) => (
                  <div
                    key={screenshot.path || index}
                    className="relative group aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10"
                  >
                    <img
                      src={screenshot.preview}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      {onDeleteScreenshot && (
                        <button
                          onClick={() => onDeleteScreenshot(index)}
                          className="p-1.5 bg-rose-500/80 text-white rounded-md hover:bg-rose-500 transition-colors shadow-lg"
                          title="Remove screenshot"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] bg-black/80 text-white/80 rounded font-mono border border-white/10">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 bg-black/20 rounded-lg border border-dashed border-white/10">
                <ImageIcon className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-[12px] text-white/50 font-medium">No screenshots in queue</p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  Press shortcut, paste from clipboard (Ctrl+V), or click below
                </p>
              </div>
            )}

            {onTakeScreenshot && (
              <button
                onClick={onTakeScreenshot}
                disabled={screenshots.length >= 5 || isProcessing}
                className="w-full py-2 border border-dashed border-white/20 rounded-lg text-[12px] text-white/70 hover:text-white hover:border-white/40 hover:bg-white/[0.04] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera className="w-3.5 h-3.5" />
                {screenshots.length >= 5 ? 'Maximum screenshots reached (5)' : 'Take Screenshot (Ctrl+H)'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={2}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 resize-none font-sans leading-relaxed transition"
                style={{ minHeight: '56px', maxHeight: '200px' }}
              />
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/60">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/60">
                  Enter
                </kbd>
                <span className="hidden sm:inline">to send</span>
              </div>

              <div className="flex items-center gap-2">
                {text.trim().length > 0 && (
                  <button
                    onClick={() => {
                      setText('');
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                      }
                    }}
                    className="text-[11px] text-white/40 hover:text-white/70 px-2 py-1 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || isProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-[12px] font-medium transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isProcessing ? "Processing..." : "Send"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedInput;
