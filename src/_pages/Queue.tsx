import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { UnifiedPanel } from "../components/UnifiedPanel"
import { useToast } from "../contexts/toast"
import { Screenshot } from "../types/screenshots"

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    return existing
  } catch (error) {
    console.error("Error loading screenshots:", error)
    throw error
  }
}

interface QueueProps {
  setView: (view: "queue" | "solutions") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const Queue: React.FC<QueueProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const { showToast } = useToast()

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const [inlineNotice, setInlineNotice] = useState<{
    code: "no_screenshots" | "process_failed"
    title: string
    message: string
  } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const {
    data: screenshots = [],
    refetch
  } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot file", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  const handleNoticePrimary = async () => {
    if (!inlineNotice) return

    if (inlineNotice.code === "no_screenshots") {
      await window.electronAPI.triggerScreenshot()
      return
    }

    if (screenshots.length === 0) {
      setInlineNotice({
        code: "no_screenshots",
        title: "No screenshots available",
        message: "Capture at least one screenshot before retrying processing."
      })
      return
    }

    const result = await window.electronAPI.triggerProcessScreenshots()
    if (!result.success) {
      showToast("Error", "Retry failed. Please try again.", "error")
    }
  }

  const handleNoticeSecondary = async () => {
    await window.electronAPI.triggerReset()
    setInlineNotice(null)
  }

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
      window.electronAPI.onScreenshotTaken(() => {
        refetch()
        setInlineNotice((prev) => (prev?.code === "no_screenshots" ? null : prev))
      }),
      window.electronAPI.onResetView(() => {
        refetch()
        setInlineNotice(null)
      }),
      window.electronAPI.onSolutionStart(() => {
        setInlineNotice(null)
      }),
      window.electronAPI.onDeleteLastScreenshot(async () => {
        if (screenshots.length > 0) {
          await handleDeleteScreenshot(screenshots.length - 1);
        } else {
          showToast("No Screenshots", "There are no screenshots to delete", "neutral");
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        )
        setInlineNotice({
          code: "process_failed",
          title: "Processing failed",
          message: error || "The app could not process screenshots. Retry or reset session."
        })
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        setInlineNotice({
          code: "no_screenshots",
          title: "No screenshots detected",
          message: "Capture your coding problem first, then run processing."
        })
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        )
      }),
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight, screenshots])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  return (
    <div ref={contentRef} className="bg-transparent w-full">
      <div className="px-4 py-3">
        {inlineNotice && (
          <div className="mb-3 p-3 rounded-lg border border-amber-400/35 bg-amber-500/10 text-amber-100">
            <div className="text-[13px] font-semibold">{inlineNotice.title}</div>
            <div className="text-[12px] text-amber-100/85 mt-0.5">{inlineNotice.message}</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleNoticePrimary}
                className="h-8 px-3 rounded-md border border-amber-300/45 bg-amber-500/20 text-[12px] font-medium hover:bg-amber-500/30 transition-colors"
              >
                {inlineNotice.code === "no_screenshots" ? "Capture Now" : "Retry Processing"}
              </button>
              <button
                onClick={handleNoticeSecondary}
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
        <UnifiedPanel
          screenshots={screenshots}
          onDeleteScreenshot={handleDeleteScreenshot}
          screenshotCount={screenshots.length}
          credits={credits}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
          onTooltipVisibilityChange={handleTooltipVisibilityChange}
        />
      </div>
    </div>
  )
}

export default Queue
