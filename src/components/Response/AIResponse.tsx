import React, { useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Copy,
  Lightbulb,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  Zap
} from "lucide-react"
import { AnswerStyle } from "../../types"

interface AIResponseProps {
  response: {
    id: string
    content: string
    style: AnswerStyle
    timestamp: number
    processingTime: number
  } | null
  isLoading: boolean
  onQuickAction: (action: string, responseId: string) => void
  onChangeStyle: (style: AnswerStyle) => void
  currentStyle: AnswerStyle
}

const QUICK_ACTIONS = [
  { id: "copy", label: "Copy", icon: Copy },
  { id: "shorten", label: "Shorten", icon: Minimize2 },
  { id: "expand", label: "Expand", icon: Maximize2 },
  { id: "variants", label: "3 Variants", icon: Lightbulb },
  { id: "star", label: "STAR Format", icon: MessageSquare },
  { id: "code", label: "Add Code", icon: Code },
  { id: "confident", label: "More Confident", icon: Zap }
]

const STYLE_OPTIONS: { id: AnswerStyle; label: string; description: string }[] = [
  { id: "concise", label: "Concise", description: "Brief points" },
  { id: "structured", label: "Structured", description: "Organized sections" },
  { id: "detailed", label: "Detailed", description: "Comprehensive" },
  { id: "star", label: "STAR", description: "STAR format" },
  { id: "custom", label: "My Voice", description: "Your style" }
]

interface StructuredResponse {
  keyPoints: string[]
  code: string
  complexity: string[]
  nextSteps: string[]
}

const normalizeLine = (line: string) => line.trim().replace(/^[-*•]\s+|^\d+\.\s+/, "").trim()

const extractCode = (content: string) => {
  const codeMatch = content.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/)
  return codeMatch?.[1]?.trim() || ""
}

const extractBullets = (content: string) =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => normalizeLine(line))
    .filter(Boolean)

const buildStructuredResponse = (content: string): StructuredResponse => {
  const bullets = extractBullets(content)
  const code = extractCode(content)
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const complexity = lines
    .filter((line) => /time complexity|space complexity|o\([^)]+\)/i.test(line))
    .map((line) => normalizeLine(line))

  const nextStepsFromText = lines
    .filter((line) => /next step|next action|verify|test/i.test(line))
    .map((line) => normalizeLine(line))
    .slice(0, 3)

  const keyPoints = bullets.slice(0, 5)
  const nextSteps =
    nextStepsFromText.length > 0
      ? nextStepsFromText
      : [
          "Validate against one edge case.",
          "If output mismatches, run a debug pass with new context.",
          "Keep one final concise version ready to paste."
        ]

  return {
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : ["Response generated. Expand or refine for a tighter final answer."],
    code,
    complexity:
      complexity.length > 0
        ? complexity
        : ["Complexity details were not explicitly provided in this response."],
    nextSteps
  }
}

const SectionCard = ({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
    <h3 className="text-[13px] font-medium text-white tracking-wide">{title}</h3>
    {children}
  </div>
)

export const AIResponse: React.FC<AIResponseProps> = ({
  response,
  isLoading,
  onQuickAction,
  onChangeStyle,
  currentStyle
}) => {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [showAllActions, setShowAllActions] = useState(false)

  const structured = useMemo(
    () => (response ? buildStructuredResponse(response.content) : null),
    [response]
  )

  const handleCopy = async () => {
    if (response?.content) {
      await navigator.clipboard.writeText(response.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
    )
  }

  if (!response || !structured) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 text-center">
        <Lightbulb className="w-12 h-12 text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/40">No response yet</p>
        <p className="text-xs text-white/30 mt-1">
          Take a screenshot or type a question to get started
        </p>
      </div>
    )
  }

  const visibleActions = showAllActions ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 4)

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
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
          <select
            value={currentStyle}
            onChange={(event) => onChangeStyle(event.target.value as AnswerStyle)}
            className="text-xs bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
          >
            {STYLE_OPTIONS.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleCopy}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Copy response"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="p-4 max-h-[460px] overflow-auto space-y-3">
            <SectionCard title="Key Points">
              <div className="space-y-1.5">
                {structured.keyPoints.map((point, index) => (
                  <div key={`kp-${index}`} className="flex items-start gap-2 text-[13px] text-white/85 leading-[1.45]">
                    <div className="w-1 h-1 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div>{point}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Code">
              {structured.code ? (
                <pre className="text-[12px] text-white/80 overflow-auto bg-black/40 rounded-md p-3 whitespace-pre-wrap">
                  {structured.code}
                </pre>
              ) : (
                <p className="text-[13px] text-white/50">No dedicated code block was detected.</p>
              )}
            </SectionCard>

            <SectionCard title="Complexity">
              <div className="space-y-1.5">
                {structured.complexity.map((line, index) => (
                  <p key={`cx-${index}`} className="text-[13px] text-white/80 leading-[1.45]">
                    {line}
                  </p>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Next Step">
              <div className="space-y-1.5">
                {structured.nextSteps.map((line, index) => (
                  <div key={`next-${index}`} className="flex items-start gap-2 text-[13px] text-white/85 leading-[1.45]">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                    <div>{line}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap gap-2">
              {visibleActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() =>
                    action.id === "copy" ? handleCopy() : onQuickAction(action.id, response.id)
                  }
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
  )
}

export default AIResponse
