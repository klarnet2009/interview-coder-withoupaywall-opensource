import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react"

interface UseUnifiedPanelUiEffectsParams {
  isTooltipVisible: boolean
  setIsTooltipVisible: Dispatch<SetStateAction<boolean>>
  tooltipRef: RefObject<HTMLDivElement | null>
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  showAudioDropdown: boolean
  audioDropdownRef: RefObject<HTMLDivElement | null>
  setShowAudioDropdown: Dispatch<SetStateAction<boolean>>
  showCaptureDropdown: boolean
  captureDropdownRef: RefObject<HTMLDivElement | null>
  setShowCaptureDropdown: Dispatch<SetStateAction<boolean>>
  responseRef: RefObject<HTMLDivElement | null>
  response: string
}

export function useUnifiedPanelUiEffects({
  isTooltipVisible,
  setIsTooltipVisible,
  tooltipRef,
  onTooltipVisibilityChange,
  showAudioDropdown,
  audioDropdownRef,
  setShowAudioDropdown,
  showCaptureDropdown,
  captureDropdownRef,
  setShowCaptureDropdown,
  responseRef,
  response
}: UseUnifiedPanelUiEffectsParams): void {
  const prevResponseRef = useRef<string>("")

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible, onTooltipVisibilityChange, tooltipRef])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        audioDropdownRef.current &&
        !audioDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAudioDropdown(false)
      }
      if (
        captureDropdownRef.current &&
        !captureDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCaptureDropdown(false)
      }
    }

    if (showAudioDropdown || showCaptureDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [audioDropdownRef, setShowAudioDropdown, showAudioDropdown, captureDropdownRef, setShowCaptureDropdown, showCaptureDropdown])

  // Escape closes all three overlays. The mousedown handler above only covers
  // the two dropdowns and only reacts to a pointer, which leaves the settings
  // menu with no dismissal path at all for a keyboard user — the exact user
  // this always-on-top overlay exists to serve.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }
      setIsTooltipVisible(false)
      setShowAudioDropdown(false)
      setShowCaptureDropdown(false)
    }

    if (isTooltipVisible || showAudioDropdown || showCaptureDropdown) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [
    isTooltipVisible,
    setIsTooltipVisible,
    showAudioDropdown,
    setShowAudioDropdown,
    showCaptureDropdown,
    setShowCaptureDropdown
  ])

  useEffect(() => {
    const prevResponse = prevResponseRef.current
    if (!prevResponse && response && responseRef.current) {
      responseRef.current.scrollTop = 0
    }
    prevResponseRef.current = response
  }, [response, responseRef])
}

