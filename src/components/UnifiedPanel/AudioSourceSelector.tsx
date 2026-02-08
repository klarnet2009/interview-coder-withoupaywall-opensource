import React from "react"
import {
  ChevronDown as ChevronDownIcon,
  Headphones,
  Mic,
  Monitor,
  RefreshCw,
  Search
} from "lucide-react"
import type { AudioAppSource, AudioSourceType } from "./types"

interface AudioSourceSelectorProps {
  showAudioDropdown: boolean
  setShowAudioDropdown: (next: boolean) => void
  fetchAudioApps: () => void | Promise<void>
  isCapturing: boolean
  isActive: boolean
  localAudioLevel: number
  preferredAudioSource: AudioSourceType
  selectedAppSource: AudioAppSource | null
  audioDropdownRef: React.RefObject<HTMLDivElement | null>
  availableApps: AudioAppSource[]
  isLoadingApps: boolean
  appSearchQuery: string
  setAppSearchQuery: (value: string) => void
  handleSourceSelect: (
    source: AudioSourceType,
    appSource?: AudioAppSource
  ) => void | Promise<void>
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  showAudioDropdown,
  setShowAudioDropdown,
  fetchAudioApps,
  isCapturing,
  isActive,
  localAudioLevel,
  preferredAudioSource,
  selectedAppSource,
  audioDropdownRef,
  availableApps,
  isLoadingApps,
  appSearchQuery,
  setAppSearchQuery,
  handleSourceSelect
}) => {
  return (
    <div className="relative" ref={audioDropdownRef}>
      <button
        onClick={() => {
          const next = !showAudioDropdown
          setShowAudioDropdown(next)
          if (next) fetchAudioApps()
        }}
        className={`w-full h-11 rounded-lg border transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5 px-2 ${
          isCapturing || isActive
            ? localAudioLevel > 0.01
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-yellow-400/30 bg-yellow-500/10 text-yellow-300"
            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
        }`}
        title={`Audio: ${preferredAudioSource === "application" && selectedAppSource ? selectedAppSource.name : preferredAudioSource}`}
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
        {preferredAudioSource === "application" && selectedAppSource ? (
          <>
            {selectedAppSource.appIcon ? (
              <img
                src={selectedAppSource.appIcon}
                alt=""
                className="w-4 h-4 rounded shrink-0"
              />
            ) : (
              <Headphones className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate max-w-[60px]">{selectedAppSource.name}</span>
          </>
        ) : preferredAudioSource === "microphone" ? (
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

          <div className="h-px bg-white/10" />

          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
              Applications
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                fetchAudioApps()
              }}
              className="p-1 text-white/30 hover:text-white/70 transition-colors"
              title="Refresh list"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingApps ? "animate-spin" : ""}`} />
            </button>
          </div>

          {availableApps.length > 5 && (
            <div className="px-3 pb-1.5">
              <div className="relative">
                <input
                  type="text"
                  value={appSearchQuery}
                  onChange={(e) => setAppSearchQuery(e.target.value)}
                  placeholder="Search apps..."
                  className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                  onClick={(e) => e.stopPropagation()}
                />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              </div>
            </div>
          )}

          <div className="max-h-[180px] overflow-y-auto">
            {isLoadingApps ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-4 h-4 text-white/30 animate-spin" />
              </div>
            ) : availableApps.length === 0 ? (
              <div className="text-center py-3 text-[12px] text-white/35">
                No windows found
              </div>
            ) : (
              availableApps
                .filter(
                  (app) =>
                    !appSearchQuery ||
                    app.name.toLowerCase().includes(appSearchQuery.toLowerCase())
                )
                .map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleSourceSelect("application", app)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left ${
                      selectedAppSource?.id === app.id &&
                      preferredAudioSource === "application"
                        ? "bg-white/8"
                        : ""
                    }`}
                  >
                    {app.appIcon ? (
                      <img src={app.appIcon} alt="" className="w-5 h-5 rounded shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/50 shrink-0">
                        {app.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-[13px] text-white/80 truncate flex-1 min-w-0">
                      {app.name}
                    </span>
                    {selectedAppSource?.id === app.id &&
                      preferredAudioSource === "application" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
