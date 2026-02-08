import React from "react"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles
} from "lucide-react"
import { renderFormattedText } from "./renderFormattedText"

interface ResponseSectionProps {
  hasResponse: boolean
  isListeningActive: boolean
  isActive: boolean
  isGenerating: boolean
  response: string
  isResponseCollapsed: boolean
  onToggleCollapse: () => void
  responseRef: React.RefObject<HTMLDivElement | null>
}

export const ResponseSection: React.FC<ResponseSectionProps> = ({
  hasResponse,
  isListeningActive,
  isActive,
  isGenerating,
  response,
  isResponseCollapsed,
  onToggleCollapse,
  responseRef
}) => {
  if (!(hasResponse || (isListeningActive && isActive))) {
    return null
  }

  return (
    <div className="border-t border-white/5">
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles
            className={`w-4 h-4 ${hasResponse ? "text-purple-400" : "text-white/30"}`}
          />
          <span className="text-[13px] text-white/80">AI Suggestions</span>
          {isGenerating && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
          )}
        </div>
        {isResponseCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
        )}
      </button>

      {!isResponseCollapsed && (
        <div ref={responseRef} className="px-3 pb-3 overflow-y-auto max-h-[60vh]">
          {hasResponse ? (
            <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">
              {renderFormattedText(response)}
              {isGenerating && (
                <span className="inline-block w-1 h-3.5 bg-purple-400 motion-safe:animate-pulse align-middle ml-0.5" />
              )}
            </div>
          ) : (
            <div className="text-[13px] text-white/45 text-center py-3">
              Hints will appear once the interviewer speaks.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
