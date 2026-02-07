import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import { useToast } from "../contexts/toast"
import { Screenshot } from "../types/screenshots"
import { ComplexitySection } from "./Solutions"

interface DebugProps {
  isProcessing: boolean
  setIsProcessing: (isProcessing: boolean) => void
  currentLanguage: string
  setLanguage: (language: string) => void
  credits: number
}

interface DebugPayload {
  code?: string
  debug_analysis?: string
  thoughts?: string[]
  time_complexity?: string
  space_complexity?: string
  issues?: string[]
  fixes?: string[]
  why?: string[]
  verify?: string[]
  next_steps?: string[]
}

interface DebugSections {
  issues: string[]
  fixes: string[]
  why: string[]
  verify: string[]
}

const normalizeHeading = (line: string) =>
  line
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[:-]+$/, "")
    .trim()
    .toLowerCase()

const isPotentialHeading = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^#{1,3}\s+/.test(trimmed)) return true
  if (/^\*\*.+\*\*$/.test(trimmed)) return true
  return /^[A-Za-z][A-Za-z\s/&()-]{2,48}:?$/.test(trimmed)
}

const toBulletList = (raw: string): string[] => {
  const normalized = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const bullets = normalized
    .filter((line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+|^\d+\.\s+/, "").trim())
    .filter(Boolean)

  if (bullets.length > 0) {
    return bullets
  }

  return normalized
    .join(" ")
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const extractSection = (analysis: string, aliases: string[]): string[] => {
  const lines = analysis.split(/\r?\n/)
  let start = -1
  let end = lines.length

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeHeading(lines[index] || "")
    if (aliases.some((alias) => normalized.includes(alias))) {
      start = index + 1
      break
    }
  }

  if (start === -1) {
    return []
  }

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (isPotentialHeading(line) && !aliases.some((alias) => normalizeHeading(line).includes(alias))) {
      end = index
      break
    }
  }

  return toBulletList(lines.slice(start, end).join("\n"))
}

const parseSectionsFromAnalysis = (analysis: string): DebugSections => ({
  issues: extractSection(analysis, ["issues identified", "issue", "problems", "bugs"]),
  fixes: extractSection(analysis, ["specific improvements", "fix", "corrections", "improvements"]),
  why: extractSection(analysis, ["why", "explanation", "changes needed", "rationale"]),
  verify: extractSection(analysis, ["verify", "validation", "test plan", "key points", "checks"])
})

const resolveDebugSections = (payload: DebugPayload): DebugSections => {
  const fromPayload: DebugSections = {
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    fixes: Array.isArray(payload.fixes) ? payload.fixes : [],
    why: Array.isArray(payload.why) ? payload.why : [],
    verify: Array.isArray(payload.verify)
      ? payload.verify
      : Array.isArray(payload.next_steps)
      ? payload.next_steps
      : []
  }

  if (
    fromPayload.issues.length > 0 ||
    fromPayload.fixes.length > 0 ||
    fromPayload.why.length > 0 ||
    fromPayload.verify.length > 0
  ) {
    return fromPayload
  }

  if (payload.debug_analysis) {
    return parseSectionsFromAnalysis(payload.debug_analysis)
  }

  return {
    issues: [],
    fixes: [],
    why: [],
    verify: []
  }
}

const StructuredListCard = ({
  title,
  items,
  loadingText,
  fallbackText
}: {
  title: string
  items: string[]
  loadingText: string
  fallbackText: string
}) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">{title}</h2>
    {items.length === 0 ? (
      <p className="text-[13px] text-white/45">{loadingText || fallbackText}</p>
    ) : (
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2 text-[13px] leading-[1.45] text-gray-100">
            <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
            <div>{item}</div>
          </div>
        ))}
      </div>
    )}
  </div>
)

const CodeSection = ({
  code,
  isLoading,
  currentLanguage
}: {
  code: string | null
  isLoading: boolean
  currentLanguage: string
}) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">Code</h2>
    {isLoading ? (
      <p className="text-[13px] bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
        Generating updated code...
      </p>
    ) : (
      <div className="w-full overflow-hidden rounded-md">
        <SyntaxHighlighter
          showLineNumbers
          language={currentLanguage === "golang" ? "go" : currentLanguage}
          style={dracula}
          customStyle={{
            maxWidth: "100%",
            margin: 0,
            padding: "1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            backgroundColor: "rgba(22, 27, 34, 0.5)"
          }}
          wrapLongLines
        >
          {code || "// Debug mode - see analysis below"}
        </SyntaxHighlighter>
      </div>
    )}
  </div>
)

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    return (Array.isArray(existing) ? existing : []).map((preview) => ({
      id: preview.path,
      path: preview.path,
      preview: preview.preview,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error("Error loading screenshots:", error)
    throw error
  }
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  currentLanguage,
  setLanguage,
  credits
}) => {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[]>([])
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(null)
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(null)
  const [debugAnalysis, setDebugAnalysis] = useState<string | null>(null)
  const [debugSections, setDebugSections] = useState<DebugSections>({
    issues: [],
    fixes: [],
    why: [],
    verify: []
  })

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  const applyDebugPayload = useCallback(
    (payload: DebugPayload | null) => {
      if (!payload) {
        return
      }

      const resolvedSections = resolveDebugSections(payload)
      const keyPointsFromPayload = Array.isArray(payload.thoughts) ? payload.thoughts.filter(Boolean) : []
      const keyPoints =
        keyPointsFromPayload.length > 0
          ? keyPointsFromPayload
          : [...resolvedSections.issues, ...resolvedSections.fixes].slice(0, 5)

      setDebugSections(resolvedSections)
      setThoughtsData(keyPoints)
      setDebugAnalysis(payload.debug_analysis || null)
      setNewCode(payload.code || "// Debug mode - see analysis below")
      setTimeComplexityData(payload.time_complexity || "N/A - Debug mode")
      setSpaceComplexityData(payload.space_complexity || "N/A - Debug mode")
      setIsProcessing(false)
    },
    [setIsProcessing]
  )

  useEffect(() => {
    const cachedDebugData = queryClient.getQueryData(["new_solution"]) as DebugPayload | null
    applyDebugPayload(cachedDebugData)

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => {
        refetch()
        setNewCode(null)
        setThoughtsData([])
        setDebugAnalysis(null)
        setDebugSections({ issues: [], fixes: [], why: [], verify: [] })
      }),
      window.electronAPI.onDebugSuccess((data: DebugPayload) => {
        queryClient.setQueryData(["new_solution"], data)
        applyDebugPayload(data)
      }),
      window.electronAPI.onDebugStart(() => {
        setIsProcessing(true)
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setIsProcessing(false)
        console.error("Processing error:", error)
      })
    ]

    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (tooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [
    applyDebugPayload,
    queryClient,
    refetch,
    setIsProcessing,
    showToast,
    tooltipHeight,
    tooltipVisible
  ])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]
    try {
      const response = await window.electronAPI.deleteScreenshot(screenshotToDelete.path)
      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
    }
  }

  const handleCapture = async () => {
    await window.electronAPI.triggerScreenshot()
  }

  const handleDebugAgain = async () => {
    await window.electronAPI.triggerProcessScreenshots()
  }

  const handleReset = async () => {
    await window.electronAPI.triggerReset()
  }

  const verifySteps =
    debugSections.verify.length > 0
      ? debugSections.verify
      : ["Re-run the failing test case and compare output with expected results."]

  return (
    <div ref={contentRef} className="relative">
      <div className="space-y-3 px-4 py-3">
        <div className="bg-transparent w-fit">
          <div className="pb-3">
            <div className="space-y-3 w-fit">
              <ScreenshotQueue
                screenshots={screenshots}
                onDeleteScreenshot={handleDeleteExtraScreenshot}
                isLoading={isProcessing}
              />
            </div>
          </div>
        </div>

        <SolutionCommands
          screenshots={screenshots}
          onTooltipVisibilityChange={handleTooltipVisibilityChange}
          isProcessing={isProcessing}
          extraScreenshots={screenshots}
          credits={credits}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />

        <div className="w-full text-sm text-black bg-black/60 rounded-md">
          <div className="rounded-lg overflow-hidden">
            <div className="px-4 py-3 space-y-4">
              <StructuredListCard
                title="Key Points"
                items={thoughtsData}
                loadingText="Analyzing key findings..."
                fallbackText="No key points available yet."
              />

              <div className="grid gap-3 md:grid-cols-2">
                <StructuredListCard
                  title="Issue"
                  items={debugSections.issues}
                  loadingText="Detecting root issues..."
                  fallbackText="No explicit issues identified."
                />
                <StructuredListCard
                  title="Fix"
                  items={debugSections.fixes}
                  loadingText="Preparing code fixes..."
                  fallbackText="No explicit fixes listed yet."
                />
                <StructuredListCard
                  title="Why"
                  items={debugSections.why}
                  loadingText="Building reasoning..."
                  fallbackText="No explanation provided yet."
                />
                <StructuredListCard
                  title="Verify"
                  items={debugSections.verify}
                  loadingText="Preparing verification checklist..."
                  fallbackText="No verification checklist found yet."
                />
              </div>

              <CodeSection
                code={newCode}
                isLoading={!newCode}
                currentLanguage={currentLanguage}
              />

              <ComplexitySection
                timeComplexity={timeComplexityData}
                spaceComplexity={spaceComplexityData}
                isLoading={!timeComplexityData || !spaceComplexityData}
              />

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <h2 className="text-[13px] font-medium text-white tracking-wide">Next Step</h2>
                <div className="space-y-1.5">
                  {verifySteps.map((step, index) => (
                    <div key={`verify-${index}`} className="flex items-start gap-2 text-[13px] leading-[1.45] text-gray-100">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                      <div>{step}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCapture}
                    className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/90 hover:bg-white/10 transition-colors"
                  >
                    Capture More Context
                  </button>
                  <button
                    onClick={handleDebugAgain}
                    className="h-8 px-3 rounded-md border border-blue-400/35 bg-blue-500/15 text-[12px] text-blue-200 hover:bg-blue-500/25 transition-colors"
                  >
                    Run Debug Again
                  </button>
                  <button
                    onClick={handleReset}
                    className="h-8 px-3 rounded-md border border-white/20 bg-transparent text-[12px] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Reset Session
                  </button>
                </div>
              </div>

              {debugAnalysis && (
                <details className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <summary className="text-[13px] text-white/70 cursor-pointer">
                    Raw debug analysis
                  </summary>
                  <div className="mt-2 text-[12px] leading-[1.45] whitespace-pre-wrap text-white/75 max-h-[320px] overflow-auto pr-2">
                    {debugAnalysis}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Debug
