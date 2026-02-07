import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  RefreshCw, 
  Minimize2, 
  Maximize2,
  Lightbulb,
  Code,
  MessageSquare,
  Clock,
  Zap,
  MoreHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AnswerStyle } from '../../types';

interface AIResponseProps {
  response: {
    id: string;
    content: string;
    style: AnswerStyle;
    timestamp: number;
    processingTime: number;
  } | null;
  isLoading: boolean;
  onQuickAction: (action: string, responseId: string) => void;
  onChangeStyle: (style: AnswerStyle) => void;
  currentStyle: AnswerStyle;
}

const QUICK_ACTIONS = [
  { id: 'copy', label: 'Copy', icon: Copy },
  { id: 'shorten', label: 'Shorten', icon: Minimize2 },
  { id: 'expand', label: 'Expand', icon: Maximize2 },
  { id: 'variants', label: '3 Variants', icon: Lightbulb },
  { id: 'star', label: 'STAR Format', icon: MessageSquare },
  { id: 'code', label: 'Add Code', icon: Code },
  { id: 'confident', label: 'More Confident', icon: Zap },
];

const STYLE_OPTIONS: { id: AnswerStyle; label: string; description: string }[] = [
  { id: 'concise', label: 'Concise', description: 'Brief points' },
  { id: 'structured', label: 'Structured', description: 'Organized sections' },
  { id: 'detailed', label: 'Detailed', description: 'Comprehensive' },
  { id: 'star', label: 'STAR', description: 'STAR format' },
  { id: 'custom', label: 'My Voice', description: 'Your style' },
];

export const AIResponse: React.FC<AIResponseProps> = ({
  response,
  isLoading,
  onQuickAction,
  onChangeStyle,
  currentStyle
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAllActions, setShowAllActions] = useState(false);

  const handleCopy = async () => {
    if (response?.content) {
      await navigator.clipboard.writeText(response.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatContent = (content: string) => {
    // Simple formatting: convert markdown-like syntax
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-base font-semibold text-white mt-4 mb-2">{line.slice(3)}</h2>;
        }
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <li key={i} className="ml-4 text-sm text-white/80 leading-relaxed">
              {line.slice(2)}
            </li>
          );
        }
        // Numbered lists
        if (/^\d+\. /.test(line)) {
          return (
            <li key={i} className="ml-4 text-sm text-white/80 leading-relaxed list-decimal">
              {line.replace(/^\d+\. /, '')}
            </li>
          );
        }
        // Code blocks
        if (line.startsWith('```')) {
          return null; // Handle code blocks separately
        }
        // Empty lines
        if (!line.trim()) {
          return <div key={i} className="h-2" />;
        }
        // Regular text
        return <p key={i} className="text-sm text-white/80 leading-relaxed">{line}</p>;
      });
  };

  if (isLoading) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-white/60 animate-spin" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">Generating response...</div>
            <div className="text-xs text-white/40">This may take a few seconds</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded animate-pulse" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 text-center">
        <Lightbulb className="w-12 h-12 text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/40">No response yet</p>
        <p className="text-xs text-white/30 mt-1">
          Take a screenshot or type a question to get started
        </p>
      </div>
    );
  }

  const visibleActions = showAllActions ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 4);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white/60" />
          </div>
          <span className="text-sm font-medium text-white/80">AI Response</span>
          {response.processingTime > 0 && (
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {response.processingTime}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Style selector */}
          <select
            value={currentStyle}
            onChange={(e) => onChangeStyle(e.target.value as AnswerStyle)}
            className="text-xs bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
          >
            {STYLE_OPTIONS.map(style => (
              <option key={style.id} value={style.id}>{style.label}</option>
            ))}
          </select>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Copy response"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <>
          <div className="p-4 max-h-[400px] overflow-auto">
            <div className="prose prose-invert prose-sm max-w-none">
              {formatContent(response.content)}
            </div>
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap gap-2">
              {visibleActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => action.id === 'copy' ? handleCopy() : onQuickAction(action.id, response.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-lg transition-colors"
                >
                  <action.icon className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              ))}
              
              {!showAllActions && (
                <button
                  onClick={() => setShowAllActions(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  More
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIResponse;
