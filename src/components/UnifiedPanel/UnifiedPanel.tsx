import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Play,
  Square,
  Volume2,
  VolumeX,
  AlertCircle,
  Settings,
  LogOut,
  ChevronDown as ChevronDownIcon,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import ScreenshotQueue from "../Queue/ScreenshotQueue";
import { useToast } from "../../contexts/toast";
import { COMMAND_KEY } from "../../utils/platform";
import { ActionNoticeBanner } from "./ActionNoticeBanner";
import { AudioSourceSelector } from "./AudioSourceSelector";
import {
  isPermissionError,
  NOTICE_MAP,
  stateBadgeClasses,
  stateLabels,
  toRuntimeAudioSource
} from "./constants";
import { LiveStateLane } from "./LiveStateLane";
import { ResponseSection } from "./ResponseSection";
import { useAudioCapture } from "./useAudioCapture";
import { useUnifiedPanelSubscriptions } from "./useUnifiedPanelSubscriptions";
import { useUnifiedPanelUiEffects } from "./useUnifiedPanelUiEffects";
import type {
  ActionNotice,
  AudioAppSource,
  AudioSourceType,
  LiveInterviewStatus,
  RuntimePreferences,
  UnifiedPanelProps
} from "./types";

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  screenshots,
  onDeleteScreenshot,
  screenshotCount,
  credits,
  currentLanguage,
  setLanguage,
  onTooltipVisibilityChange
}) => {
  const { showToast } = useToast();
  void currentLanguage;
  void setLanguage;

  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const isActiveRef = useRef(false);
  const [status, setStatus] = useState<LiveInterviewStatus>({
    state: "idle",
    transcript: "",
    response: "",
    audioLevel: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  const [showAudioDropdown, setShowAudioDropdown] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [preferredAudioSource, setPreferredAudioSource] =
    useState<AudioSourceType>("system");
  const [selectedAppSource, setSelectedAppSource] = useState<AudioAppSource | null>(null);
  const [availableApps, setAvailableApps] = useState<AudioAppSource[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [runtimePreferences, setRuntimePreferences] = useState<RuntimePreferences>({
    interviewMode: "coding",
    answerStyle: "structured",
    displayMode: "standard"
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const audioDropdownRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  const { localAudioLevel, startAudioCapture, stopAudioCapture } = useAudioCapture({
    isActiveRef
  });

  useUnifiedPanelSubscriptions({
    isCapturing,
    isActive,
    setStatus,
    setError,
    setActionNotice,
    setDebugMode,
    statusState: status.state
  });

  useUnifiedPanelUiEffects({
    isTooltipVisible,
    tooltipRef,
    onTooltipVisibilityChange,
    showAudioDropdown,
    audioDropdownRef,
    setShowAudioDropdown,
    responseRef,
    response: status.response
  });

  useEffect(() => {
    const loadPreferredSource = async () => {
      try {
        const config = await window.electronAPI.getConfig();
        const typedConfig = config as {
          audioConfig?: { source?: string; applicationId?: string; applicationName?: string };
          interviewPreferences?: { mode?: string; answerStyle?: string };
          displayConfig?: { mode?: string };
        };
        const preferred = toRuntimeAudioSource(
          typedConfig.audioConfig?.source
        );
        setPreferredAudioSource(preferred);
        if (preferred === "application" && typedConfig.audioConfig?.applicationId) {
          setSelectedAppSource({
            id: typedConfig.audioConfig.applicationId,
            name: typedConfig.audioConfig.applicationName || "App",
            appIcon: null // Icon will be refreshed when dropdown opens
          });
        }
        setRuntimePreferences({
          interviewMode: typedConfig.interviewPreferences?.mode || "coding",
          answerStyle: typedConfig.interviewPreferences?.answerStyle || "structured",
          displayMode: typedConfig.displayConfig?.mode || "standard"
        });
      } catch (configError) {
        console.error("Failed to load preferred audio source:", configError);
      }
    };

    loadPreferredSource();
  }, []);

  const fetchAudioApps = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const sources = await window.electronAPI.getAudioSources();
      setAvailableApps(sources);
    } catch (err) {
      console.error("Failed to fetch audio sources:", err);
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  const handleSourceSelect = async (source: AudioSourceType, appSource?: AudioAppSource) => {
    setShowAudioDropdown(false);
    setError(null);
    setPreferredAudioSource(source);
    if (appSource) setSelectedAppSource(appSource);
    if (source !== "application") setSelectedAppSource(null);

    try {
      const config = await window.electronAPI.getConfig();
      const current = config as { audioConfig?: Record<string, unknown> };
      await window.electronAPI.updateConfig({
        audioConfig: {
          ...(current.audioConfig || {}),
          source,
          applicationId: appSource?.id,
          applicationName: appSource?.name
        }
      });
    } catch (configError) {
      console.error("Failed to persist preferred audio source:", configError);
    }

    // Start audio capture only — Gemini processing is started separately via startInterview
    try {
      await startAudioCapture(source, appSource?.id);
      setIsCapturing(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start audio capture";
      setError(message);
      setActionNotice(
        isPermissionError(message)
          ? NOTICE_MAP.audio_permission
          : {
            ...NOTICE_MAP.live_error,
            message
          }
      );
      return;
    }
  };

  // Step 2: User explicitly starts the interview — begin Gemini processing
  const startInterview = async () => {
    setError(null);
    try {
      const result = await window.electronAPI.liveInterviewStart();
      if (result.success) {
        isActiveRef.current = true;
        setIsActive(true);
        setActionNotice((prev) => {
          if (
            prev?.code === "audio_permission" ||
            prev?.code === "audio_no_signal" ||
            prev?.code === "live_error"
          ) {
            return null;
          }
          return prev;
        });
      } else {
        const fallbackError = result.error || "Failed to start live session";
        setError(fallbackError);
        setActionNotice({
          ...NOTICE_MAP.live_error,
          message: fallbackError
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start listening";
      setError(message);
      setActionNotice({
        ...NOTICE_MAP.live_error,
        message
      });
    }
  };


  const handleStop = useCallback(async () => {
    stopAudioCapture();
    await window.electronAPI.liveInterviewStop();
    isActiveRef.current = false;
    setIsActive(false);
    setIsCapturing(false);
    setStatus({ state: "idle", transcript: "", response: "", audioLevel: 0 });
    setError(null);
    setActionNotice((prev) => {
      if (
        prev?.code === "audio_no_signal" ||
        prev?.code === "live_error" ||
        prev?.code === "audio_permission"
      ) {
        return null;
      }
      return prev;
    });
  }, [stopAudioCapture]);

  const handleScreenshot = async () => {
    try {
      const result = await window.electronAPI.triggerScreenshot();
      if (!result.success) {
        showToast("Error", "Failed to take screenshot", "error");
      } else {
        setActionNotice((prev) => (prev?.code === "no_screenshots" ? null : prev));
      }
    } catch (screenshotError) {
      console.error("Screenshot capture failed:", screenshotError);
      showToast("Error", "Failed to take screenshot", "error");
    }
  };

  const handleSolve = async () => {
    if (screenshotCount === 0) {
      setActionNotice(NOTICE_MAP.no_screenshots);
      return;
    }

    if (credits <= 0) {
      showToast("No Credits", "Add credits before processing screenshots.", "error");
      return;
    }

    try {
      const result = await window.electronAPI.triggerProcessScreenshots();
      if (!result.success) {
        setActionNotice(NOTICE_MAP.process_failed);
        showToast("Error", "Failed to process screenshots", "error");
      }
    } catch (processError) {
      console.error("Screenshot processing failed:", processError);
      setActionNotice(NOTICE_MAP.process_failed);
      showToast("Error", "Failed to process screenshots", "error");
    }
  };

  const handleSignOut = async () => {
    try {
      await window.electronAPI.updateConfig({ apiKey: "" });
      await window.electronAPI.triggerReset();
      showToast(
        "Signed Out",
        "API key removed. Configure a new key to continue.",
        "success"
      );
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (logoutError) {
      console.error("Logout failed:", logoutError);
      showToast("Error", "Failed to log out", "error");
    }
  };

  const dismissNotice = () => {
    setActionNotice(null);
  };

  const handleNoticePrimary = async () => {
    if (!actionNotice) {
      return;
    }

    switch (actionNotice.code) {
      case "no_screenshots":
        await handleScreenshot();
        break;
      case "process_failed":
        await handleSolve();
        break;
      case "audio_permission":
      case "audio_no_signal":
        setShowAudioDropdown(true);
        break;
      case "api_key_invalid":
        await window.electronAPI.openSettingsPortal();
        break;
      case "live_error":
        if (isActive) {
          await handleStop();
        }
        setShowAudioDropdown(true);
        break;
      default:
        break;
    }
  };

  const handleNoticeSecondary = async () => {
    if (!actionNotice) {
      return;
    }

    switch (actionNotice.code) {
      case "process_failed":
        await window.electronAPI.triggerReset();
        break;
      case "audio_no_signal":
      case "live_error":
        if (isActive) {
          await handleStop();
        }
        break;
      case "api_key_invalid":
        await handleSignOut();
        break;
      default:
        dismissNotice();
        break;
    }
  };

  const renderVUMeter = () => {
    const level = Math.min(1, localAudioLevel * 10);
    const bars = 8;
    return (
      <div className="flex items-end gap-0.5 h-4">
        {Array.from({ length: bars }).map((_, i) => {
          const threshold = i / bars;
          const isLit = level > threshold;
          const color = i < 5 ? "bg-green-500" : i < 7 ? "bg-yellow-500" : "bg-red-500";
          return (
            <div
              key={i}
              className={`w-1 rounded-sm transition-all duration-75 ${isLit ? color : "bg-white/10"
                }`}
              style={{ height: `${(i + 1) * 12.5}%` }}
            />
          );
        })}
      </div>
    );
  };

  const isListeningActive = status.state !== "idle" && status.state !== "error";
  const isGenerating = status.state === "generating";
  const hasResponse = status.response.length > 0;
  const hasTranscript = status.transcript.length > 0;
  const showContent =
    screenshotCount > 0 || isActive || hasTranscript || hasResponse || error || !!actionNotice;

  return (
    <div className={`flex flex-col overflow-visible ${debugMode
      ? "bg-black/45 rounded-xl border border-white/10"
      : "bg-black/80 rounded-lg"
      }`}>
      <div className="px-3 py-3 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-semibold text-white">Session Controls</div>

          <div className="flex items-center gap-1.5">
            {debugMode ? (
              <span
                className={`text-[12px] px-2 py-1 rounded-md border ${stateBadgeClasses[status.state]}`}
              >
                {stateLabels[status.state]}
              </span>
            ) : (
              <span
                className={`w-2 h-2 rounded-full transition-colors ${status.state === "idle" || status.state === "error"
                  ? "bg-white/30"
                  : status.state === "generating"
                    ? "bg-purple-400 animate-pulse"
                    : "bg-emerald-400 animate-pulse"
                  }`}
                title={stateLabels[status.state]}
              />
            )}

            <div className="relative">
              <button
                onClick={() => setIsTooltipVisible(!isTooltipVisible)}
                className={`p-2 rounded-md transition-colors ${isTooltipVisible
                  ? "bg-white/15 text-white"
                  : "hover:bg-white/10 text-white/60 hover:text-white/90"
                  }`}
              >
                <Settings className="w-4 h-4" />
              </button>

              {isTooltipVisible && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 py-1 rounded-lg border border-white/10 bg-[#1a1a1a]/95 backdrop-blur-xl shadow-2xl z-50"
                  onMouseLeave={() => setIsTooltipVisible(false)}
                >
                  {/* Shortcuts */}
                  <div className="px-3 py-1.5 text-[10px] font-medium text-white/35 uppercase tracking-wider">Shortcuts</div>
                  <div className="px-3 py-1 flex justify-between text-[11px]">
                    <span className="text-white/50">Toggle</span>
                    <kbd className="text-white/70">{COMMAND_KEY}+B</kbd>
                  </div>
                  <div className="px-3 py-1 flex justify-between text-[11px]">
                    <span className="text-white/50">Screenshot</span>
                    <kbd className="text-white/70">{COMMAND_KEY}+H</kbd>
                  </div>
                  <div className="px-3 py-1 flex justify-between text-[11px]">
                    <span className="text-white/50">Process</span>
                    <kbd className="text-white/70">{COMMAND_KEY}+↵</kbd>
                  </div>

                  <div className="my-1 border-t border-white/8" />

                  {/* Settings */}
                  <button
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-[12px] text-white/75 hover:bg-white/8 hover:text-white transition-colors text-left"
                    onClick={() => { window.electronAPI.openSettingsPortal(); setIsTooltipVisible(false); }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Open Settings
                  </button>

                  {/* Log Out */}
                  <button
                    onClick={() => { handleSignOut(); setIsTooltipVisible(false); }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-[12px] text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Log Out
                  </button>
                </div>
              )}
            </div>

            <div
              className="p-2 rounded-md hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
              style={{ WebkitAppRegion: "drag", appRegion: "drag" } as React.CSSProperties}
              title="Drag to move window"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-white/35"
              >
                <circle cx="9" cy="5" r="1" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Column 1: Capture with dropdown for screen/window selection */}
          <div className="relative">
            <div className="flex items-stretch gap-0 h-11">
              <button
                onClick={handleScreenshot}
                className="flex-1 rounded-l-lg border border-r-0 border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors px-3"
                title={`Take Screenshot (${COMMAND_KEY}+H)`}
              >
                <div className="flex items-center justify-center gap-1.5 text-[13px] font-medium">
                  <Camera className="w-4 h-4" />
                  Capture
                </div>
              </button>
              <button
                onClick={() => {
                  // TODO: Add screen/window picker dropdown
                  handleScreenshot();
                }}
                className="w-8 rounded-r-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center"
                title="Choose what to capture"
              >
                <ChevronDownIcon className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
            {screenshotCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-[11px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                {screenshotCount}
              </span>
            )}
          </div>

          {/* Column 2: Start / Stop Interview */}
          {isActive ? (
            <button
              onClick={handleStop}
              className="h-11 rounded-lg border border-red-400/35 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5"
              title="Stop Interview"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
          ) : (
            <button
              onClick={async () => {
                if (!isCapturing) {
                  await handleSourceSelect(preferredAudioSource, selectedAppSource || undefined);
                }
                await startInterview();
              }}
              disabled={credits <= 0}
              className={`h-11 rounded-lg border text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${credits <= 0
                ? "border-white/10 bg-white/5 text-white/35 cursor-not-allowed"
                : "border-emerald-400/35 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                }`}
              title="Start Interview"
            >
              <Play className="w-4 h-4 fill-current" />
              Start
            </button>
          )}

          <AudioSourceSelector
            showAudioDropdown={showAudioDropdown}
            setShowAudioDropdown={setShowAudioDropdown}
            fetchAudioApps={fetchAudioApps}
            isCapturing={isCapturing}
            isActive={isActive}
            localAudioLevel={localAudioLevel}
            preferredAudioSource={preferredAudioSource}
            selectedAppSource={selectedAppSource}
            audioDropdownRef={audioDropdownRef}
            availableApps={availableApps}
            isLoadingApps={isLoadingApps}
            appSearchQuery={appSearchQuery}
            setAppSearchQuery={setAppSearchQuery}
            handleSourceSelect={handleSourceSelect}
          />
        </div>

        {/* VU meter — visible when capturing or active */}
        {(isCapturing || isActive) && (
          <div className="flex items-center gap-2 px-1">
            {renderVUMeter()}
            {localAudioLevel > 0.01 ? (
              <Volume2 className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span className="text-[11px] text-white/40">Audio Level</span>
          </div>
        )}

        {/* Error/no_signal — no_signal only shown during setup, not during live interview */}
        {(status.state === "error" || (status.state === "no_signal" && !isActive)) && (
          <div className="text-[12px] text-orange-300 flex items-center gap-1.5 px-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {status.state === "no_signal"
              ? "No signal detected. Check source sharing and volume."
              : "Live session hit an error. Use recovery actions below."}
          </div>
        )}

        {/* Dev-only: Runtime preference badges */}
        {debugMode && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/3 text-white/75">
              Mode: {runtimePreferences.interviewMode.replace("_", " ")}
            </span>
            <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/3 text-white/75">
              Style: {runtimePreferences.answerStyle}
            </span>
            <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/3 text-white/75">
              Display: {runtimePreferences.displayMode}
            </span>
          </div>
        )}

        {/* Dev-only: Live State Lane */}
        {debugMode && (
          <LiveStateLane state={status.state} />
        )}
      </div>

      {showContent && (
        <div>
          {actionNotice && (
            <ActionNoticeBanner
              notice={actionNotice}
              onPrimary={handleNoticePrimary}
              onSecondary={handleNoticeSecondary}
              onDismiss={dismissNotice}
            />
          )}

          {error && (
            <div className="mx-3 mt-3 bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-[13px] leading-relaxed">{error}</span>
            </div>
          )}

          {screenshotCount > 0 && (
            <div className="px-3 py-3 border-t border-white/5 mt-3">
              <ScreenshotQueue
                isLoading={false}
                screenshots={screenshots}
                onDeleteScreenshot={onDeleteScreenshot}
              />
            </div>
          )}

          {isActive && hasTranscript && (
            <div className="px-3 py-3 border-t border-white/5">
              <div className="flex items-start gap-2">
                <Volume2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-blue-300 font-medium mb-1">Interviewer</div>
                  <div className="text-[13px] text-white leading-relaxed">
                    {status.transcript}
                    {status.state === "transcribing" && (
                      <span className="inline-block w-1 h-3.5 ml-0.5 bg-blue-400 motion-safe:animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <ResponseSection
            hasResponse={hasResponse}
            isListeningActive={isListeningActive}
            isActive={isActive}
            isGenerating={isGenerating}
            response={status.response}
            isResponseCollapsed={isResponseCollapsed}
            onToggleCollapse={() => setIsResponseCollapsed(!isResponseCollapsed)}
            responseRef={responseRef}
          />

          {(actionNotice?.code === "process_failed" ||
            actionNotice?.code === "live_error") && (
              <div className="px-3 pb-3 pt-1 flex items-center gap-2">
                <button
                  onClick={() => window.electronAPI.triggerReset()}
                  className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/85 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset View
                </button>
                <button
                  onClick={handleSolve}
                  disabled={screenshotCount === 0}
                  className={`h-8 px-3 rounded-md border text-[12px] inline-flex items-center gap-1.5 transition-colors ${screenshotCount === 0
                    ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                    : "border-blue-400/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
                    }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Process
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default UnifiedPanel;
