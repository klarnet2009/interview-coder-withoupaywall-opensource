import type {
  ActionNotice,
  AudioSourceType,
  ListeningState,
  NoticeCode
} from "./types"

export const stateLabels: Record<ListeningState, string> = {
  idle: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  no_signal: "No Signal",
  transcribing: "Transcribing",
  generating: "Generating",
  error: "Error"
}

export const stateBadgeClasses: Record<ListeningState, string> = {
  idle: "bg-gray-500/20 text-gray-300 border-gray-400/30",
  connecting: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  listening: "bg-green-500/20 text-green-300 border-green-400/30",
  no_signal: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  transcribing: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  generating: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  error: "bg-red-500/20 text-red-300 border-red-400/30"
}

export const stateLane: ListeningState[] = [
  "connecting",
  "listening",
  "transcribing",
  "generating"
]

export const toRuntimeAudioSource = (value: unknown): AudioSourceType => {
  if (value === "microphone") return "microphone"
  if (value === "application") return "application"
  return "system"
}

export const isPermissionError = (value: string) => {
  const normalized = value.toLowerCase()
  return (
    normalized.includes("permission") ||
    normalized.includes("notallowederror") ||
    normalized.includes("denied")
  )
}

export const NOTICE_MAP: Record<NoticeCode, ActionNotice> = {
  no_screenshots: {
    code: "no_screenshots",
    title: "No screenshots captured",
    message: "Capture at least one screenshot to start processing.",
    primaryLabel: "Capture Now"
  },
  process_failed: {
    code: "process_failed",
    title: "Processing failed",
    message: "The last processing attempt did not complete successfully.",
    primaryLabel: "Retry Processing",
    secondaryLabel: "Reset Session"
  },
  audio_permission: {
    code: "audio_permission",
    title: "Audio permission blocked",
    message: "Grant microphone or screen-audio access, then retry.",
    primaryLabel: "Choose Source",
    secondaryLabel: "Dismiss"
  },
  audio_no_signal: {
    code: "audio_no_signal",
    title: "No audio signal detected",
    message: "Your session is running, but no usable audio input is reaching the app.",
    primaryLabel: "Switch Source",
    secondaryLabel: "Stop Listening"
  },
  live_error: {
    code: "live_error",
    title: "Live session error",
    message: "Live interview assistant hit an error and needs recovery.",
    primaryLabel: "Restart Listening",
    secondaryLabel: "Stop Session"
  },
  api_key_invalid: {
    code: "api_key_invalid",
    title: "API key issue",
    message: "The configured provider key is invalid or unavailable.",
    primaryLabel: "Open Settings",
    secondaryLabel: "Log Out"
  }
}
