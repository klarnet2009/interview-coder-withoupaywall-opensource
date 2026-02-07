import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createRoot } from "react-dom/client";
import {
  Camera,
  Play,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  Monitor,
  Bug,
  Settings,
  ChevronUp,
  ChevronDown,
  Sparkles,
  LogOut,
  ChevronDown as ChevronDownIcon,
  RefreshCw,
  ShieldAlert,
  RotateCcw
} from "lucide-react";
import ScreenshotQueue from "../Queue/ScreenshotQueue";
import { LanguageSelector } from "../shared/LanguageSelector";
import { useToast } from "../../contexts/toast";
import { COMMAND_KEY } from "../../utils/platform";
import { Screenshot } from "../../types/screenshots";

type ListeningState =
  | "idle"
  | "connecting"
  | "listening"
  | "no_signal"
  | "transcribing"
  | "generating"
  | "error";

type AudioSourceType = "system" | "microphone";

type NoticeCode =
  | "no_screenshots"
  | "process_failed"
  | "audio_permission"
  | "audio_no_signal"
  | "live_error"
  | "api_key_invalid";

interface ActionNotice {
  code: NoticeCode;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

interface LiveInterviewStatus {
  state: ListeningState;
  transcript: string;
  response: string;
  audioLevel: number;
  error?: string;
}

interface UnifiedPanelProps {
  screenshots: Screenshot[];
  onDeleteScreenshot: (index: number) => void;
  screenshotCount: number;
  credits: number;
  currentLanguage: string;
  setLanguage: (language: string) => void;
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
}

interface RuntimePreferences {
  interviewMode: string;
  answerStyle: string;
  displayMode: string;
}

const stateLabels: Record<ListeningState, string> = {
  idle: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  no_signal: "No Signal",
  transcribing: "Transcribing",
  generating: "Generating",
  error: "Error"
};

const stateBadgeClasses: Record<ListeningState, string> = {
  idle: "bg-gray-500/20 text-gray-300 border-gray-400/30",
  connecting: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  listening: "bg-green-500/20 text-green-300 border-green-400/30",
  no_signal: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  transcribing: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  generating: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  error: "bg-red-500/20 text-red-300 border-red-400/30"
};

const stateLane: ListeningState[] = [
  "connecting",
  "listening",
  "transcribing",
  "generating"
];

const toRuntimeAudioSource = (value: unknown): AudioSourceType => {
  if (value === "microphone") {
    return "microphone";
  }
  return "system";
};

const isPermissionError = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("permission") ||
    normalized.includes("notallowederror") ||
    normalized.includes("denied")
  );
};

const NOTICE_MAP: Record<NoticeCode, ActionNotice> = {
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
    primaryLabel: "Open API Settings",
    secondaryLabel: "Log Out"
  }
};

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  screenshots,
  onDeleteScreenshot,
  screenshotCount,
  credits,
  currentLanguage,
  setLanguage,
  onTooltipVisibilityChange
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<LiveInterviewStatus>({
    state: "idle",
    transcript: "",
    response: "",
    audioLevel: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  const [showAudioDropdown, setShowAudioDropdown] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [preferredAudioSource, setPreferredAudioSource] =
    useState<AudioSourceType>("system");
  const [runtimePreferences, setRuntimePreferences] = useState<RuntimePreferences>({
    interviewMode: "coding",
    answerStyle: "structured",
    displayMode: "standard"
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const audioDropdownRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const unsubStatus = window.electronAPI.onLiveInterviewStatus(
      (newStatus: LiveInterviewStatus) => {
        setStatus(newStatus);
      }
    );
    const unsubState = window.electronAPI.onLiveInterviewState(
      (state: ListeningState) => {
        setStatus((prev) => ({ ...prev, state }));
      }
    );
    const unsubError = window.electronAPI.onLiveInterviewError((errorMsg: string) => {
      setError(errorMsg);
      setStatus((prev) => ({ ...prev, state: "error" }));
      setActionNotice({
        ...NOTICE_MAP.live_error,
        message: errorMsg || NOTICE_MAP.live_error.message
      });
    });

    const unsubProcessError = window.electronAPI.onSolutionError(
      (errorMessage: string) => {
        setActionNotice({
          ...NOTICE_MAP.process_failed,
          message: errorMessage || NOTICE_MAP.process_failed.message
        });
      }
    );

    const unsubNoScreenshots = window.electronAPI.onProcessingNoScreenshots(() => {
      setActionNotice(NOTICE_MAP.no_screenshots);
    });

    const unsubInvalidKey = window.electronAPI.onApiKeyInvalid(() => {
      setActionNotice(NOTICE_MAP.api_key_invalid);
    });

    const clearFailures = () => {
      setActionNotice((prev) => {
        if (!prev) {
          return prev;
        }
        if (
          prev.code === "process_failed" ||
          prev.code === "no_screenshots" ||
          prev.code === "api_key_invalid"
        ) {
          return null;
        }
        return prev;
      });
    };

    const unsubSolutionSuccess = window.electronAPI.onSolutionSuccess(clearFailures);
    const unsubReset = window.electronAPI.onResetView(() => {
      setActionNotice(null);
      setError(null);
    });

    return () => {
      unsubStatus();
      unsubState();
      unsubError();
      unsubProcessError();
      unsubNoScreenshots();
      unsubInvalidKey();
      unsubSolutionSuccess();
      unsubReset();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, []);

  useEffect(() => {
    let tooltipHeight = 0;
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10;
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
  }, [isTooltipVisible, onTooltipVisibilityChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        audioDropdownRef.current &&
        !audioDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAudioDropdown(false);
      }
    };
    if (showAudioDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAudioDropdown]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [status.response]);

  useEffect(() => {
    if (status.state === "no_signal" && isActive) {
      setActionNotice((prev) => {
        if (prev?.code === "audio_no_signal") {
          return prev;
        }
        return NOTICE_MAP.audio_no_signal;
      });
      return;
    }

    if (status.state !== "no_signal") {
      setActionNotice((prev) => (prev?.code === "audio_no_signal" ? null : prev));
    }
  }, [status.state, isActive]);

  useEffect(() => {
    const loadPreferredSource = async () => {
      try {
        const config = await window.electronAPI.getConfig();
        const typedConfig = config as {
          audioConfig?: { source?: string };
          interviewPreferences?: { mode?: string; answerStyle?: string };
          displayConfig?: { mode?: string };
        };
        const preferred = toRuntimeAudioSource(
          typedConfig.audioConfig?.source
        );
        setPreferredAudioSource(preferred);
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

  const startAudioCapture = async (source: AudioSourceType) => {
    try {
      let stream: MediaStream;

      if (source === "system") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        stream.getVideoTracks().forEach((track) => track.stop());
        if (stream.getAudioTracks().length === 0) {
          throw new Error("No audio track detected. Enable audio sharing and try again.");
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      }

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      const audioSrc = audioContextRef.current.createMediaStreamSource(stream);

      await audioContextRef.current.audioWorklet.addModule("/pcm-capture-processor.js");
      const processor = new AudioWorkletNode(
        audioContextRef.current,
        "pcm-capture-processor"
      );

      processor.port.onmessage = (event) => {
        const { pcmBuffer, level } = event.data;
        setLocalAudioLevel(level);

        const uint8Array = new Uint8Array(pcmBuffer);
        const binary = String.fromCharCode.apply(null, Array.from(uint8Array));
        const base64 = btoa(binary);
        window.electronAPI.liveInterviewSendAudio(base64, level);
      };

      audioSrc.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = processor;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        throw new Error("Permission denied. Please allow audio capture and retry.");
      }
      throw err;
    }
  };

  const stopAudioCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setLocalAudioLevel(0);
  };
  const handleSourceSelect = async (source: AudioSourceType) => {
    setShowAudioDropdown(false);
    setError(null);
    setPreferredAudioSource(source);

    try {
      const config = await window.electronAPI.getConfig();
      const current = config as { audioConfig?: Record<string, unknown> };
      await window.electronAPI.updateConfig({
        audioConfig: {
          ...(current.audioConfig || {}),
          source
        }
      });
    } catch (configError) {
      console.error("Failed to persist preferred audio source:", configError);
    }

    try {
      const result = await window.electronAPI.liveInterviewStart();
      if (result.success) {
        await startAudioCapture(source);
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
      setActionNotice(
        isPermissionError(message)
          ? NOTICE_MAP.audio_permission
          : {
              ...NOTICE_MAP.live_error,
              message
            }
      );
      await window.electronAPI.liveInterviewStop();
    }
  };

  const handleStop = useCallback(async () => {
    stopAudioCapture();
    await window.electronAPI.liveInterviewStop();
    setIsActive(false);
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
  }, []);

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

  const extractLanguagesAndUpdate = (direction?: "next" | "prev") => {
    const hiddenRenderContainer = document.createElement("div");
    hiddenRenderContainer.style.position = "absolute";
    hiddenRenderContainer.style.left = "-9999px";
    document.body.appendChild(hiddenRenderContainer);

    const root = createRoot(hiddenRenderContainer);
    root.render(
      <LanguageSelector currentLanguage={currentLanguage} setLanguage={() => {}} />
    );

    setTimeout(() => {
      const selectElement = hiddenRenderContainer.querySelector("select");
      if (selectElement) {
        const values = Array.from(selectElement.options).map((opt) => opt.value);
        const currentIndex = values.indexOf(currentLanguage);
        let newIndex = currentIndex;

        if (direction === "prev") {
          newIndex = (currentIndex - 1 + values.length) % values.length;
        } else {
          newIndex = (currentIndex + 1) % values.length;
        }

        if (newIndex !== currentIndex) {
          setLanguage(values[newIndex]);
          window.electronAPI.updateConfig({ language: values[newIndex] });
        }
      }
      root.unmount();
      document.body.removeChild(hiddenRenderContainer);
    }, 50);
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
              className={`w-1 rounded-sm transition-all duration-75 ${
                isLit ? color : "bg-white/10"
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

  const activeLaneIndex = stateLane.indexOf(status.state);

  return (
    <div className="flex flex-col bg-black/45 rounded-xl overflow-visible border border-white/10">
      <div className="px-3 py-3 border-b border-white/10 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-white">Session Controls</div>
            <div className="text-[12px] text-white/60">
              Capture the problem, process it, and run live assistance.
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[12px] px-2 py-1 rounded-md border ${
                stateBadgeClasses[status.state]
              }`}
            >
              {stateLabels[status.state]}
            </span>

            <div
              className="relative"
              onMouseEnter={() => setIsTooltipVisible(true)}
              onMouseLeave={() => setIsTooltipVisible(false)}
            >
              <button className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors">
                <Settings className="w-4 h-4" />
              </button>

              {isTooltipVisible && (
                <div
                  ref={tooltipRef}
                  className="absolute top-full right-0 mt-2 w-64"
                  style={{ zIndex: 100 }}
                >
                  <div className="absolute -top-2 right-0 w-full h-2" />
                  <div className="p-3 text-xs bg-black/90 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-xl">
                    <div className="space-y-2.5">
                      <h3 className="font-medium text-[11px] text-white/60 uppercase tracking-wider">
                        Shortcuts
                      </h3>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-white/70">Toggle</span>
                          <span className="text-[12px] text-white">{COMMAND_KEY} + B</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-white/70">Screenshot</span>
                          <span className="text-[12px] text-white">{COMMAND_KEY} + H</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-white/70">Process</span>
                          <span className="text-[12px] text-white">{COMMAND_KEY} + Enter</span>
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-2 space-y-1.5">
                        <button
                          className="flex items-center justify-between w-full rounded px-1.5 py-1 hover:bg-white/10 transition-colors"
                          onClick={() => extractLanguagesAndUpdate("next")}
                        >
                          <span className="text-[12px] text-white/70">Language</span>
                          <span className="text-[12px] text-white/90">{currentLanguage}</span>
                        </button>
                        <button
                          className="flex items-center justify-between w-full rounded px-1.5 py-1 hover:bg-white/10 transition-colors"
                          onClick={() => window.electronAPI.openSettingsPortal()}
                        >
                          <span className="text-[12px] text-white/70">API Settings</span>
                          <span className="text-[12px] text-white/40">Open</span>
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-1.5 text-[12px] text-red-400 hover:text-red-300 transition-colors w-full rounded px-1.5 py-1 hover:bg-white/5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Log Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/debug-live")}
              className="p-2 rounded-md hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
              title="Debug"
            >
              <Bug className="w-4 h-4" />
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-md hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>

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
          <button
            onClick={handleScreenshot}
            className="relative h-11 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors px-3"
            title={`Take Screenshot (${COMMAND_KEY}+H)`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[13px] font-medium">
              <Camera className="w-4 h-4" />
              Capture
            </div>
            {screenshotCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-[11px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                {screenshotCount}
              </span>
            )}
          </button>

          <button
            onClick={handleSolve}
            disabled={screenshotCount === 0 || credits <= 0}
            className={`h-11 rounded-lg border text-[13px] font-medium transition-colors px-3 flex items-center justify-center gap-1.5 ${
              screenshotCount === 0 || credits <= 0
                ? "border-white/10 bg-white/5 text-white/35 cursor-not-allowed"
                : "border-blue-400/30 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
            }`}
            title={`Process (${COMMAND_KEY}+Enter)`}
          >
            <Play className="w-4 h-4 fill-current" />
            Process
          </button>

          <div className="relative" ref={audioDropdownRef}>
            {isActive ? (
              <button
                onClick={handleStop}
                className="w-full h-11 rounded-lg border border-red-400/35 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5"
                title="Stop Listening"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Live
              </button>
            ) : (
              <div className="flex items-stretch gap-1 h-11">
                <button
                  onClick={() => handleSourceSelect(preferredAudioSource)}
                  className="flex-1 rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5 px-2"
                  title={`Start Listening (${preferredAudioSource})`}
                >
                  <Mic className="w-4 h-4" />
                  {preferredAudioSource === "microphone" ? "Mic Live" : "System Live"}
                </button>
                <button
                  onClick={() => setShowAudioDropdown(!showAudioDropdown)}
                  className="w-10 rounded-lg border border-emerald-400/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition-colors flex items-center justify-center"
                  title="Choose audio source"
                >
                  <ChevronDownIcon className="w-3.5 h-3.5 text-emerald-100/80" />
                </button>
              </div>
            )}

            {showAudioDropdown && (
              <div
                className="absolute top-full left-0 mt-1 w-full bg-black/95 backdrop-blur-md rounded-lg border border-white/15 shadow-xl overflow-hidden"
                style={{ zIndex: 200 }}
              >
                <button
                  onClick={() => handleSourceSelect("system")}
                  className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
                >
                  <Monitor className="w-4 h-4 text-white/70" />
                  <div>
                    <div className="text-[13px] text-white/90">Window Audio</div>
                    <div className="text-[12px] text-white/45">Zoom, Meet, browser tab</div>
                  </div>
                </button>
                <div className="h-px bg-white/10" />
                <button
                  onClick={() => handleSourceSelect("microphone")}
                  className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
                >
                  <Mic className="w-4 h-4 text-white/70" />
                  <div>
                    <div className="text-[13px] text-white/90">Microphone</div>
                    <div className="text-[12px] text-white/45">Your local voice</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/[0.03] text-white/75">
            Mode: {runtimePreferences.interviewMode.replace("_", " ")}
          </span>
          <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/[0.03] text-white/75">
            Style: {runtimePreferences.answerStyle}
          </span>
          <span className="text-[12px] px-2 py-1 rounded-md border border-white/15 bg-white/[0.03] text-white/75">
            Display: {runtimePreferences.displayMode}
          </span>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[13px] text-white/75">Live State Lane</div>
            {isActive && (
              <div className="flex items-center gap-1.5">
                {renderVUMeter()}
                {localAudioLevel > 0.01 ? (
                  <Volume2 className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {stateLane.map((laneState, index) => {
              const isActiveStep = status.state === laneState;
              const isCompletedStep = activeLaneIndex > -1 && activeLaneIndex > index;
              const isIdle = status.state === "idle";

              return (
                <div
                  key={laneState}
                  className={`rounded-md border px-2 py-1.5 text-center text-[12px] functional-state-transition ${
                    isIdle
                      ? "border-white/10 bg-black/30 text-white/40"
                      : isActiveStep
                      ? "border-blue-400/35 bg-blue-500/15 text-blue-200"
                      : isCompletedStep
                      ? "border-green-400/35 bg-green-500/15 text-green-200"
                      : "border-white/10 bg-black/30 text-white/45"
                  }`}
                >
                  {stateLabels[laneState]}
                </div>
              );
            })}
          </div>

          {(status.state === "error" || status.state === "no_signal") && (
            <div className="mt-2 text-[12px] text-orange-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {status.state === "no_signal"
                ? "No signal detected. Check source sharing and volume."
                : "Live session hit an error. Use recovery actions below."}
            </div>
          )}
        </div>
      </div>

      {showContent && (
        <div>
          {actionNotice && (
            <div className="mx-3 mt-3 p-3 rounded-lg border border-amber-400/35 bg-amber-500/10 text-amber-100 functional-enter">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">{actionNotice.title}</div>
                  <div className="text-[12px] text-amber-100/85 mt-0.5">
                    {actionNotice.message}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={handleNoticePrimary}
                      className="h-8 px-3 rounded-md border border-amber-300/45 bg-amber-500/20 text-[12px] font-medium hover:bg-amber-500/30 transition-colors"
                    >
                      {actionNotice.primaryLabel}
                    </button>
                    {actionNotice.secondaryLabel && (
                      <button
                        onClick={handleNoticeSecondary}
                        className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
                      >
                        {actionNotice.secondaryLabel}
                      </button>
                    )}
                    <button
                      onClick={dismissNotice}
                      className="h-8 px-3 rounded-md border border-white/20 bg-transparent text-[12px] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
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

          {(hasResponse || (isListeningActive && isActive)) && (
            <div className="border-t border-white/5">
              <button
                onClick={() => setIsResponseCollapsed(!isResponseCollapsed)}
                className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles
                    className={`w-4 h-4 ${hasResponse ? "text-purple-400" : "text-white/30"}`}
                  />
                  <span className="text-[13px] text-white/80">AI Suggestions</span>
                  {isGenerating && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  )}
                </div>
                {isResponseCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                )}
              </button>

              {!isResponseCollapsed && (
                <div ref={responseRef} className="px-3 pb-3 overflow-y-auto max-h-[220px]">
                  {hasResponse ? (
                    <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">
                      {status.response}
                      {isGenerating && (
                        <span className="inline-block w-1 h-3.5 bg-purple-400 motion-safe:animate-pulse align-middle ml-0.5" />
                      )}
                    </div>
                  ) : (
                    <div className="text-[13px] text-white/45 text-center py-3">
                      Hints will appear once the interviewer speaks.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                className={`h-8 px-3 rounded-md border text-[12px] inline-flex items-center gap-1.5 transition-colors ${
                  screenshotCount === 0
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
