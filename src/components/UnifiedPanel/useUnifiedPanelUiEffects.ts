import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react"

interface UseUnifiedPanelUiEffectsParams {
  isTooltipVisible: boolean
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

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = 0
    }
  }, [response, responseRef])
}
