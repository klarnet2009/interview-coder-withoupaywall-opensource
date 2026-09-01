import React from "react"
import { ChevronDown as ChevronDownIcon, Mic, Monitor } from "lucide-react"
import type { AudioSourceType } from "./types"

/*
 * There is deliberately no per-application section here. The window id Chromium
 * accepts has no effect on the audio track on Windows, so this list used to name one
 * application while capturing the whole desktop. See electron/constants/audioSource.ts
 * for the full reasoning and for what a real per-process capture would require.
 */

interface AudioSourceSelectorProps {
  showAudioDropdown: boolean
  setShowAudioDropdown: (next: boolean) => void
  isCapturing: boolean
  isActive: boolean
  localAudioLevel: number
  preferredAudioSource: AudioSourceType
  audioDropdownRef: React.RefObject<HTMLDivElement | null>
  handleSourceSelect: (source: AudioSourceType) => void | Promise<void>
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  showAudioDropdown,
  setShowAudioDropdown,
  isCapturing,
  isActive,
  localAudioLevel,
  preferredAudioSource,
  audioDropdownRef,
  handleSourceSelect
}) => {
  return (
    <div className="relative" ref={audioDropdownRef}>
      <button
        onClick={() => setShowAudioDropdown(!showAudioDropdown)}
        aria-haspopup="listbox"
        aria-expanded={showAudioDropdown}
        className={`w-full h-11 rounded-lg border transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5 px-2 ${
          isCapturing || isActive
            ? localAudioLevel > 0.01
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-yellow-400/30 bg-yellow-500/10 text-yellow-300"
            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
        }`}
        title={`Audio: ${preferredAudioSource}`}
      >
        {(isCapturing || isActive) && localAudioLevel > 0.01 && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        )}
        {(isCapturing || isActive) && localAudioLevel <= 0.01 && (
          <span className="w-2 h-2 rounded-full bg-yellow-400/60 shrink-0" />
        )}
        {preferredAudioSource === "microphone" ? (
          <>
            <Mic className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Mic</span>
          </>
        ) : (
          <>
            <Monitor className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">System</span>
          </>
        )}
        <ChevronDownIcon className="w-3 h-3 text-white/40 shrink-0 ml-auto" />
      </button>

      {showAudioDropdown && (
        <div
          className="absolute top-full left-0 mt-1 w-full bg-black/95 backdrop-blur-md rounded-lg border border-white/15 shadow-xl overflow-hidden"
          style={{ zIndex: 200 }}
        >
          <button
            onClick={() => handleSourceSelect("system")}
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left ${
              preferredAudioSource === "system" ? "bg-white/8" : ""
            }`}
          >
            <Monitor className="w-4 h-4 text-white/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white/90">System Audio</div>
              <div className="text-[11px] text-white/40">All desktop sound</div>
            </div>
            {preferredAudioSource === "system" && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>

          <div className="h-px bg-white/10" />

          <button
            onClick={() => handleSourceSelect("microphone")}
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left ${
              preferredAudioSource === "microphone" ? "bg-white/8" : ""
            }`}
          >
            <Mic className="w-4 h-4 text-white/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white/90">Microphone</div>
              <div className="text-[11px] text-white/40">Your local voice</div>
            </div>
            {preferredAudioSource === "microphone" && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
