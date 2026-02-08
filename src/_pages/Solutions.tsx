// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"

import { ProblemStatementData } from "../types/solutions"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import { SessionHistory } from "../components/Sessions"
import Debug from "./Debug"
import { useToast } from "../contexts/toast"
import { COMMAND_KEY } from "../utils/platform"
import { SavedSnippet, Session } from "../types"

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-[13px] bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.45] text-gray-100 max-w-[680px]">
        {content}
      </div>
    )}
  </div>
)
const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    if (typeof content === "string") {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="space-y-2 relative rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        {title}
      </h2>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-[13px] bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Loading solutions...
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 text-[12px] text-white bg-white/10 hover:bg-white/20 rounded px-2 py-1 transition"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <SyntaxHighlighter
            showLineNumbers
            language={currentLanguage == "golang" ? "go" : currentLanguage}
            style={dracula}
            customStyle={{
              maxWidth: "100%",
              margin: 0,
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              backgroundColor: "rgba(22, 27, 34, 0.5)"
            }}
            wrapLongLines={true}
          >
            {content as string}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => {
  // Helper to ensure we have proper complexity values
  const formatComplexity = (complexity: string | null): string => {
    // Default if no complexity returned by LLM
    if (!complexity || complexity.trim() === "") {
      return "Complexity not available";
    }

    const bigORegex = /O\([^)]+\)/i;
    // Return the complexity as is if it already has Big O notation
    if (bigORegex.test(complexity)) {
      return complexity;
    }

    // Concat Big O notation to the complexity
    return `O(${complexity})`;
  };

  const formattedTimeComplexity = formatComplexity(timeComplexity);
  const formattedSpaceComplexity = formatComplexity(spaceComplexity);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        Complexity
      </h2>
      {isLoading ? (
        <p className="text-[13px] bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Calculating complexity...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Time:</strong> {formattedTimeComplexity}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Space:</strong> {formattedSpaceComplexity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NextStepSection = ({
  isDebugReady,
  onCapture,
  onDebug,
  onReset
}: {
  isDebugReady: boolean
  onCapture: () => Promise<void>
  onDebug: () => Promise<void>
  onReset: () => Promise<void>
}) => (
  <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      Next Step
    </h2>
    <div className="space-y-1 text-[13px] text-gray-100 leading-[1.45]">
      <div className="flex items-start gap-2">
        <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
        <div>Run this solution against the prompt examples and one edge case.</div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
        <div>
          If output mismatches, capture the failing case and run debug to get a corrected version.
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
        <div>Keep one clean final version ready to paste into your editor.</div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        onClick={onCapture}
        className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/90 hover:bg-white/10 transition-colors"
      >
        Capture Edge Case
      </button>
      <button
        onClick={onDebug}
        className={`h-8 px-3 rounded-md border text-[12px] transition-colors ${
          isDebugReady
            ? "border-blue-400/35 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
            : "border-white/15 bg-white/5 text-white/45"
        }`}
      >
        {isDebugReady ? "Run Debug" : "Need Screenshot for Debug"}
      </button>
      <button
        onClick={onReset}
        className="h-8 px-3 rounded-md border border-white/20 bg-transparent text-[12px] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        Start New Session
      </button>
    </div>
  </div>
)

export interface SolutionsProps {
  setView: (view: "queue" | "solutions") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)
  const [inlineNotice, setInlineNotice] = useState<{
    code: "solution_error" | "debug_error" | "no_screenshots"
    title: string
    message: string
  } | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [sessionHistory, setSessionHistory] = useState<Session[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  interface Screenshot {
    id: string
    path: string
    preview: string
    timestamp: number
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([])

  const loadSessionHistory = async () => {
    setIsHistoryLoading(true)
    try {
      const history = await window.electronAPI.getSessionHistory()
      setSessionHistory(Array.isArray(history) ? history : [])
    } catch (error) {
      console.error("Failed to load session history:", error)
      showToast("Error", "Failed to load session history.", "error")
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const runRetryAction = async () => {
    if (extraScreenshots.length === 0) {
      setInlineNotice({
        code: "no_screenshots",
        title: "No screenshots available",
        message: "Capture at least one screenshot before retrying processing."
      })
      await window.electronAPI.triggerScreenshot()
      return
    }

    const result = await window.electronAPI.triggerProcessScreenshots()
    if (!result.success) {
      showToast("Error", "Retry failed. Please try again.", "error")
    }
  }

  const handleInlinePrimary = async () => {
    if (!inlineNotice) return

    if (inlineNotice.code === "no_screenshots") {
      await window.electronAPI.triggerScreenshot()
      return
    }

    await runRetryAction()
  }

  const handleInlineSecondary = async () => {
    await window.electronAPI.triggerReset()
    setInlineNotice(null)
  }

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        console.log("Raw screenshot data:", existing)
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        console.log("Processed screenshots:", screenshots)
        setExtraScreenshots(screenshots)
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        setExtraScreenshots([])
      }
    }

    fetchScreenshots()
  }, [solutionData])

  const { showToast } = useToast()

  useEffect(() => {
    loadSessionHistory()
  }, [])

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        setInlineNotice((prev) => (prev?.code === "no_screenshots" ? null : prev))
        try {
          const existing = await window.electronAPI.getScreenshots()
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now()
            })
          )
          setExtraScreenshots(screenshots)
        } catch (error) {
          console.error("Error loading extra screenshots:", error)
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true)

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["new_solution"]
        })

        // Reset screenshots
        setExtraScreenshots([])
        setInlineNotice(null)

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setInlineNotice(null)
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
      }),
      window.electronAPI.onProblemExtracted((data: Record<string, unknown>) => {
        queryClient.setQueryData(["problem_statement"], data)
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", error, "error")
        setInlineNotice({
          code: "solution_error",
          title: "Processing failed",
          message: error || "Solution generation failed. Retry processing or reset session."
        })
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
        console.error("Processing error:", error)
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data: Record<string, unknown>) => {
        setInlineNotice(null)
        if (!data) {
          console.warn("Received empty or invalid solution data")
          return
        }
        console.log({ data })
        const solutionData = {
          code: typeof data.code === "string" ? data.code : "",
          thoughts: Array.isArray(data.thoughts)
            ? data.thoughts.filter((item): item is string => typeof item === "string")
            : [],
          time_complexity:
            typeof data.time_complexity === "string" ? data.time_complexity : "",
          space_complexity:
            typeof data.space_complexity === "string" ? data.space_complexity : ""
        }

        queryClient.setQueryData(["solution"], solutionData)
        setSolutionData(solutionData.code || null)
        setThoughtsData(solutionData.thoughts || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots()
            const screenshots =
              (Array.isArray(existing) ? existing : []).map((p: { path: string; preview: string }) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now()
              })) || []
            setExtraScreenshots(screenshots)
          } catch (error) {
            console.error("Error loading extra screenshots:", error)
            setExtraScreenshots([])
          }
        }
        fetchScreenshots()
        loadSessionHistory()
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true)
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data: Record<string, unknown>) => {
        queryClient.setQueryData(["new_solution"], data)
        setDebugProcessing(false)
        setInlineNotice(null)
        loadSessionHistory()
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
        setInlineNotice({
          code: "debug_error",
          title: "Debug processing failed",
          message: "The debug pipeline could not complete. Retry with updated screenshots."
        })
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        setInlineNotice({
          code: "no_screenshots",
          title: "No screenshots detected",
          message: "Capture additional screenshots, then retry processing."
        })
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      }),
      // Removed out of credits handler - unlimited credits in this version
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots()
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        setExtraScreenshots(screenshots)
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot", "error")
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
      showToast("Error", "Failed to delete the screenshot", "error")
    }
  }

  const handleNextCapture = async () => {
    await window.electronAPI.triggerScreenshot()
  }

  const handleNextDebug = async () => {
    if (extraScreenshots.length === 0) {
      setInlineNotice({
        code: "no_screenshots",
        title: "No screenshots detected",
        message: "Capture additional screenshots, then retry processing."
      })
      return
    }
    await window.electronAPI.triggerProcessScreenshots()
  }

  const handleNextReset = async () => {
    await window.electronAPI.triggerReset()
  }

  const handleOpenHistory = async () => {
    setIsHistoryOpen(true)
    await loadSessionHistory()
  }

  const handleDeleteSession = async (sessionId: string) => {
    const result = await window.electronAPI.deleteSessionHistoryItem(sessionId)
    if (!result.success) {
      showToast("Error", "Failed to delete session.", "error")
      return
    }
    await loadSessionHistory()
  }

  const handleClearHistory = async () => {
    const result = await window.electronAPI.clearSessionHistory()
    if (!result.success) {
      showToast("Error", "Failed to clear session history.", "error")
      return
    }
    await loadSessionHistory()
  }

  const handleExportSession = async (sessionId: string) => {
    const session = await window.electronAPI.getSessionHistoryItem(sessionId)
    if (!session) {
      showToast("Error", "Session not found.", "error")
      return
    }

    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `session-${sessionId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleUseSnippet = (snippet: SavedSnippet, session: Session) => {
    if (snippet.workspace?.type === "debug") {
      queryClient.setQueryData(["new_solution"], {
        code: snippet.workspace.code || snippet.answer,
        debug_analysis: snippet.answer,
        thoughts: snippet.workspace.keyPoints || [snippet.question],
        issues: snippet.workspace.issues || [],
        fixes: snippet.workspace.fixes || [],
        why: snippet.workspace.why || [],
        verify: snippet.workspace.verify || [],
        next_steps: snippet.workspace.verify || [],
        time_complexity: snippet.workspace.timeComplexity || "N/A - Debug mode",
        space_complexity: snippet.workspace.spaceComplexity || "N/A - Debug mode"
      })
      setDebugProcessing(false)
    } else {
      queryClient.removeQueries({ queryKey: ["new_solution"] })
      const restoredSolution = {
        code: snippet.workspace?.code || snippet.answer,
        thoughts: snippet.workspace?.keyPoints || [snippet.question],
        time_complexity:
          snippet.workspace?.timeComplexity ||
          "Loaded from session history",
        space_complexity:
          snippet.workspace?.spaceComplexity ||
          "Loaded from session history"
      }
      queryClient.setQueryData(["solution"], restoredSolution)
      setSolutionData(restoredSolution.code)
      setThoughtsData(restoredSolution.thoughts)
      setTimeComplexityData(restoredSolution.time_complexity)
      setSpaceComplexityData(restoredSolution.space_complexity)
    }

    setInlineNotice(null)
    setIsHistoryOpen(false)
    showToast(
      "Loaded",
      `Restored answer from ${new Date(session.date).toLocaleString()}.`,
      "success"
    )
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
          credits={credits}
        />
      ) : (
        <div ref={contentRef} className="relative">
          <div className="space-y-3 px-4 py-3">
            {/* Conditionally render the screenshot queue if solutionData is available */}
            {solutionData && (
              <div className="bg-transparent w-fit">
                <div className="pb-3">
                  <div className="space-y-3 w-fit">
                    <ScreenshotQueue
                      isLoading={debugProcessing}
                      screenshots={extraScreenshots}
                      onDeleteScreenshot={handleDeleteExtraScreenshot}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navbar of commands with the SolutionsHelper */}
            {inlineNotice && (
              <div className="p-3 rounded-lg border border-amber-400/35 bg-amber-500/10 text-amber-100">
                <div className="text-[13px] font-semibold">{inlineNotice.title}</div>
                <div className="text-[12px] text-amber-100/85 mt-0.5">{inlineNotice.message}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleInlinePrimary}
                    className="h-8 px-3 rounded-md border border-amber-300/45 bg-amber-500/20 text-[12px] font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    {inlineNotice.code === "no_screenshots" ? "Capture Now" : "Retry Processing"}
                  </button>
                  <button
                    onClick={handleInlineSecondary}
                    className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
                  >
                    Reset Session
                  </button>
                  <button
                    onClick={() => setInlineNotice(null)}
                    className="h-8 px-3 rounded-md border border-white/20 bg-transparent text-[12px] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <SolutionCommands
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              isProcessing={!problemStatementData || !solutionData}
              extraScreenshots={extraScreenshots}
              credits={credits}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
            />

            <div className="flex items-center justify-between px-1">
              <div className="text-[12px] text-white/45">
                {"Workspace: Key points -> Code -> Complexity -> Next step"}
              </div>
              <button
                onClick={handleOpenHistory}
                className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
              >
                Session History
              </button>
            </div>

            {/* Main Content - Modified width constraints */}
            <div className="w-full text-sm text-black bg-black/60 rounded-md">
              <div className="rounded-lg overflow-hidden">
                <div className="px-4 py-3 space-y-4 max-w-full">
                  {!solutionData && (
                    <>
                      <ContentSection
                        title="Problem Statement"
                        content={problemStatementData?.problem_statement}
                        isLoading={!problemStatementData}
                      />
                      {problemStatementData && (
                        <div className="mt-4 flex">
                          <p className="text-[13px] bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                            Generating solutions...
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {solutionData && (
                    <>
                      <ContentSection
                        title={`Key Points (${COMMAND_KEY} + Arrow keys to scroll)`}
                        content={
                          thoughtsData && (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                {thoughtsData.map((thought, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-2"
                                  >
                                    <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                    <div>{thought}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        isLoading={!thoughtsData}
                      />

                      <SolutionSection
                        title="Code"
                        content={solutionData}
                        isLoading={!solutionData}
                        currentLanguage={currentLanguage}
                      />

                      <ComplexitySection
                        timeComplexity={timeComplexityData}
                        spaceComplexity={spaceComplexityData}
                        isLoading={!timeComplexityData || !spaceComplexityData}
                      />

                      <NextStepSection
                        isDebugReady={extraScreenshots.length > 0}
                        onCapture={handleNextCapture}
                        onDebug={handleNextDebug}
                        onReset={handleNextReset}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <SessionHistory
              isOpen={isHistoryOpen}
              isLoading={isHistoryLoading}
              onClose={() => setIsHistoryOpen(false)}
              sessions={sessionHistory}
              onDeleteSession={handleDeleteSession}
              onExportSession={handleExportSession}
              onUseSnippet={handleUseSnippet}
              onClearHistory={handleClearHistory}
              onRefresh={loadSessionHistory}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Solutions
