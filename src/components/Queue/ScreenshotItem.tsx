// src/components/Queue/ScreenshotItem.tsx
import React, { useState, useEffect } from "react"
import { X, ZoomIn } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Screenshot {
  path: string
  preview: string
}

interface ScreenshotItemProps {
  screenshot: Screenshot
  onDelete: (index: number) => void
  index: number
  isLoading: boolean
}

const ScreenshotItem: React.FC<ScreenshotItemProps> = ({
  screenshot,
  onDelete,
  index,
  isLoading
}) => {
  const { t } = useTranslation()
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await onDelete(index)
  }

  const handleOpenLightbox = () => {
    if (!isLoading) {
      setIsLightboxOpen(true)
    }
  }

  const handleCloseLightbox = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setIsLightboxOpen(false)
  }

  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isLightboxOpen])

  return (
    <>
      <div
        onClick={handleOpenLightbox}
        className={`border border-white/20 hover:border-white/40 bg-black/60 rounded-lg overflow-hidden relative w-[128px] h-[72px] transition-colors ${
          isLoading ? "" : "group cursor-pointer"
        }`}
        title={isLoading ? "Processing screenshot..." : "Click to enlarge screenshot"}
      >
        <div className="w-full h-full relative flex items-center justify-center bg-black/40">
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={screenshot.preview}
            alt={`Screenshot ${index + 1}`}
            className={`w-full h-full object-contain transition-transform duration-300 ${
              isLoading
                ? "opacity-50"
                : "group-hover:scale-105 group-hover:brightness-90"
            }`}
          />
          {!isLoading && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none">
              <ZoomIn className="w-4 h-4 text-white/80 drop-shadow" />
            </div>
          )}
        </div>
        {!isLoading && (
          <button
            onClick={handleDelete}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-red-500/80 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
            aria-label={t('a11y.label.deleteScreenshot')}
            title="Delete screenshot"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.label.screenshotPreview')}
          onClick={handleCloseLightbox}
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={screenshot.preview}
              alt={`Full screenshot ${index + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-white/20 shadow-2xl"
            />
            <button
              onClick={handleCloseLightbox}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-black/80 hover:bg-white/20 text-white border border-white/20 shadow-lg transition-colors cursor-pointer"
              aria-label={t('a11y.label.closePreview')}
              title="Close preview (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ScreenshotItem

