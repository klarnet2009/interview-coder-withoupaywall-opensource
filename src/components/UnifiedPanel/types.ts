import type { Screenshot } from "../../types/screenshots"

export type ListeningState =
  | "idle"
  | "connecting"
  | "listening"
  | "no_signal"
  | "transcribing"
  | "generating"
  | "error"

export type AudioSourceType = "system" | "microphone" | "application"

export interface AudioAppSource {
  id: string
  name: string
  appIcon: string | null
}

export type NoticeCode =
  | "no_screenshots"
  | "process_failed"
  | "audio_permission"
  | "audio_no_signal"
  | "live_error"
  | "api_key_invalid"

export interface ActionNotice {
  code: NoticeCode
  title: string
  message: string
  primaryLabel: string
  secondaryLabel?: string
}

export interface LiveInterviewStatus {
  state: ListeningState
  transcript: string
  response: string
  audioLevel: number
  error?: string
}

export interface UnifiedPanelProps {
  screenshots: Screenshot[]
  onDeleteScreenshot: (index: number) => void
  screenshotCount: number
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
}

export interface RuntimePreferences {
  interviewMode: string
  answerStyle: string
  displayMode: string
}
