import { useEffect, type Dispatch, type SetStateAction } from "react"
import { NOTICE_MAP } from "./constants"
import type {
  ActionNotice,
  ListeningState,
  LiveInterviewStatus
} from "./types"

interface UseUnifiedPanelSubscriptionsParams {
  isCapturing: boolean
  isActive: boolean
  setStatus: Dispatch<SetStateAction<LiveInterviewStatus>>
  setError: Dispatch<SetStateAction<string | null>>
  setActionNotice: Dispatch<SetStateAction<ActionNotice | null>>
  setDebugMode: Dispatch<SetStateAction<boolean>>
  statusState: ListeningState
}

export function useUnifiedPanelSubscriptions({
  isCapturing,
  isActive,
  setStatus,
  setError,
  setActionNotice,
  setDebugMode,
  statusState
}: UseUnifiedPanelSubscriptionsParams): void {
  useEffect(() => {
    const unsubStatus = window.electronAPI.onLiveInterviewStatus(
      (newStatus: LiveInterviewStatus) => {
        setStatus(newStatus)
      }
    )
    const unsubState = window.electronAPI.onLiveInterviewState(
      (state: ListeningState) => {
        setStatus((prev) => ({ ...prev, state }))
      }
    )
    const unsubError = window.electronAPI.onLiveInterviewError((errorMsg: string) => {
      setError(errorMsg)
      setStatus((prev) => ({ ...prev, state: "error" }))
      setActionNotice({
        ...NOTICE_MAP.live_error,
        message: errorMsg || NOTICE_MAP.live_error.message
      })
    })

    const unsubProcessError = window.electronAPI.onSolutionError(
      (errorMessage: string) => {
        setActionNotice({
          ...NOTICE_MAP.process_failed,
          message: errorMessage || NOTICE_MAP.process_failed.message
        })
      }
    )

    const unsubNoScreenshots = window.electronAPI.onProcessingNoScreenshots(() => {
      setActionNotice(NOTICE_MAP.no_screenshots)
    })

    const unsubInvalidKey = window.electronAPI.onApiKeyInvalid(() => {
      setActionNotice(NOTICE_MAP.api_key_invalid)
    })

    const clearFailures = () => {
      setActionNotice((prev) => {
        if (!prev) {
          return prev
        }
        if (
          prev.code === "process_failed" ||
          prev.code === "no_screenshots" ||
          prev.code === "api_key_invalid"
        ) {
          return null
        }
        return prev
      })
    }

    const unsubSolutionSuccess = window.electronAPI.onSolutionSuccess(clearFailures)
    const unsubReset = window.electronAPI.onResetView(() => {
      setActionNotice(null)
      setError(null)
    })

    return () => {
      unsubStatus()
      unsubState()
      unsubError()
      unsubProcessError()
      unsubNoScreenshots()
      unsubInvalidKey()
      unsubSolutionSuccess()
      unsubReset()
    }
  }, [setActionNotice, setError, setStatus])

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>
      setDebugMode(Boolean(customEvent.detail))
    }
    window.addEventListener("debug-mode-change", handler)
    return () => {
      window.removeEventListener("debug-mode-change", handler)
    }
  }, [setDebugMode])

  useEffect(() => {
    if (statusState === "no_signal" && isCapturing && !isActive) {
      setActionNotice((prev) => {
        if (prev?.code === "audio_no_signal") {
          return prev
        }
        return NOTICE_MAP.audio_no_signal
      })
      return
    }

    if (statusState !== "no_signal") {
      setActionNotice((prev) => (prev?.code === "audio_no_signal" ? null : prev))
    }
  }, [isActive, isCapturing, setActionNotice, statusState])
}
