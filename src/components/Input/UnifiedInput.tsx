import React, { useState, useRef } from 'react';
import { 
  Camera, 
  MessageSquare, 
  X, 
  Send,
  Image as ImageIcon
} from 'lucide-react';

interface Screenshot {
  path: string;
  preview: string;
}

interface UnifiedInputProps {
  screenshots: Screenshot[];
  onTakeScreenshot: () => void;
  onDeleteScreenshot: (index: number) => void;
  onSendText: (text: string) => void;
  isProcessing: boolean;
  placeholder?: string;
}

export const UnifiedInput: React.FC<UnifiedInputProps> = ({
  screenshots,
  onTakeScreenshot,
  onDeleteScreenshot,
  onSendText,
  isProcessing,
  placeholder = "Type your question or take a screenshot..."
}) => {
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<'screenshot' | 'text'>('screenshot');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (text.trim() && !isProcessing) {
      onSendText(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('screenshot')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'screenshot'
              ? 'text-white border-b-2 border-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Camera className="w-4 h-4" />
          Screenshots
          {screenshots.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/10 rounded-full">
              {screenshots.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'text'
              ? 'text-white border-b-2 border-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Text Input
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'screenshot' ? (
          <div className="space-y-4">
            {/* Screenshot grid */}
            {screenshots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {screenshots.map((screenshot, index) => (
                  <div
                    key={screenshot.path}
                    className="relative group aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10"
                  >
                    <img
                      src={screenshot.preview}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => onDeleteScreenshot(index)}
                        className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-500 transition-colors"
                        title="Remove screenshot"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-1 text-[10px] bg-black/70 text-white/70 rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/40">No screenshots yet</p>
                <p className="text-xs text-white/30 mt-1">
                  Press Ctrl+H to capture or click the button below
                </p>
              </div>
            )}

            {/* Take screenshot button */}
            <button
              onClick={onTakeScreenshot}
              disabled={screenshots.length >= 5}
              className="w-full py-3 border border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-white/40 hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-4 h-4" />
              {screenshots.length >= 5 ? 'Max screenshots (5)' : 'Take Screenshot'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">
                Press Cmd/Ctrl + Enter to send
              </span>
              <button
                onClick={handleSend}
                disabled={!text.trim() || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedInput;
