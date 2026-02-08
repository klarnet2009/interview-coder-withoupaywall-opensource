import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Settings,
  ChevronUp,
  ChevronDown,
  Sparkles,
  LogOut,
  ChevronDown as ChevronDownIcon,
  RefreshCw,
  ShieldAlert,
  RotateCcw,
  Headphones,
  Search
} from "lucide-react";
import ScreenshotQueue from "../Queue/ScreenshotQueue";
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

type AudioSourceType = "system" | "microphone" | "application";

interface AudioAppSource {
  id: string;
  name: string;
  appIcon: string | null;
}

type NoticeCode =
  | "no_screenshots"
  | "process_failed"
  | "audio_permission"
  | "audio_no_signal"
  | "live_error"
  | "api_key_invalid";

/**
 * Lightweight markdown-to-React renderer for hint responses.
 * Supports: **bold**, *italic*, `code`, bullet points (• / -)
 */
function renderFormattedText(text: string): React.ReactNode {
  // Split into lines first for bullet point handling
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Bullet point detection
    const bulletMatch = line.match(/^(\s*)(•|-|\*)\s+(.*)$/);
    const isBullet = !!bulletMatch;
    const lineContent = isBullet ? bulletMatch![3] : line;

    // Parse inline formatting
    const parts: React.ReactNode[] = [];
    // Regex: **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineContent)) !== null) {
      // Push text before match
      if (match.index > lastIndex) {
        parts.push(lineContent.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // **bold**
        parts.push(<strong key={`${lineIdx}-b-${match.index}`} className="font-semibold text-white">{match[2]}</strong>);
      } else if (match[3]) {
        // *italic*
        parts.push(<em key={`${lineIdx}-i-${match.index}`} className="italic text-white/80">{match[3]}</em>);
      } else if (match[4]) {
        // `code`
        parts.push(<code key={`${lineIdx}-c-${match.index}`} className="bg-white/10 px-1 py-0.5 rounded text-[12px] font-mono text-purple-300">{match[4]}</code>);
      }
      lastIndex = match.index + match[0].length;
    }
    // Push remaining text
    if (lastIndex < lineContent.length) {
      parts.push(lineContent.slice(lastIndex));
    }

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex gap-1.5 ml-1">
          <span className="text-purple-400 shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && '\n'}
      </React.Fragment>
    );
  });
}

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
  if (value === "microphone") return "microphone";
  if (value === "application") return "application";
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
    primaryLabel: "Open Settings",
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
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
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
      responseRef.current.scrollTop = 0; // New content appears at top
    }
  }, [status.response]);

  // Listen for debug mode changes from DevModeToggle
  useEffect(() => {
    const handler = (e: Event) => {
      setDebugMode((e as CustomEvent).detail as boolean);
    };
    window.addEventListener('debug-mode-change', handler);
    return () => window.removeEventListener('debug-mode-change', handler);
  }, []);

  useEffect(() => {
    // Only show no_signal warning during initial audio setup, not during live interview
    // (silence between questions is normal during an active session)
    if (status.state === "no_signal" && isCapturing && !isActive) {
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
  }, [status.state, isActive, isCapturing]);

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

  const startAudioCapture = async (source: AudioSourceType, appSourceId?: string) => {
    try {
      let stream: MediaStream;

      if (source === "application" && appSourceId) {
        // Per-window audio capture via Electron chromeMediaSourceId
        const desktopCaptureConstraints: MediaStreamConstraints = {
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: appSourceId
            }
          } as unknown as MediaTrackConstraints,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: appSourceId
            }
          } as unknown as MediaTrackConstraints
        };
        stream = await navigator.mediaDevices.getUserMedia(desktopCaptureConstraints);
        // We only need audio — stop the video track
        stream.getVideoTracks().forEach((track) => track.stop());
        if (stream.getAudioTracks().length === 0) {
          throw new Error("No audio track detected from the selected application.");
        }
      } else if (source === "system") {
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

      // For system/app audio: use native sample rate (typically 48kHz)
      // and let the AudioWorklet handle resampling to 16kHz.
      // For microphone: use 16kHz directly since getUserMedia supports it.
      const useNativeRate = source === "system" || source === "application";
      const contextSampleRate = useNativeRate ? undefined : 16000;
      audioContextRef.current = new AudioContext(
        contextSampleRate ? { sampleRate: contextSampleRate } : {}
      );

      const actualRate = audioContextRef.current.sampleRate;
      console.log(`Audio capture: source=${source}, contextSampleRate=${actualRate}`);

      const audioSrc = audioContextRef.current.createMediaStreamSource(stream);

      await audioContextRef.current.audioWorklet.addModule("/pcm-capture-processor.js");
      const processor = new AudioWorkletNode(
        audioContextRef.current,
        "pcm-capture-processor",
        { processorOptions: { inputSampleRate: actualRate } }
      );

      processor.port.onmessage = (event) => {
        const { pcmBuffer, level } = event.data;
        setLocalAudioLevel(level);

        // Only send audio to Gemini when interview is actively running
        if (!isActiveRef.current) return;

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

  const activeLaneIndex = stateLane.indexOf(status.state);

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

          {/* Column 3: Audio source indicator with dropdown */}
          <div className="relative" ref={audioDropdownRef}>
            <button
              onClick={() => {
                const next = !showAudioDropdown;
                setShowAudioDropdown(next);
                if (next) fetchAudioApps();
              }}
              className={`w-full h-11 rounded-lg border transition-colors text-[13px] font-medium flex items-center justify-center gap-1.5 px-2 ${isCapturing || isActive
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
                    <img src={selectedAppSource.appIcon} alt="" className="w-4 h-4 rounded shrink-0" />
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
                {/* System Audio */}
                <button
                  onClick={() => handleSourceSelect("system")}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left ${preferredAudioSource === "system" ? "bg-white/8" : ""}`}
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

                {/* Microphone */}
                <button
                  onClick={() => handleSourceSelect("microphone")}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-white/10 transition-colors text-left ${preferredAudioSource === "microphone" ? "bg-white/8" : ""}`}
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

                {/* Applications header */}
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Applications</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchAudioApps(); }}
                    className="p-1 text-white/30 hover:text-white/70 transition-colors"
                    title="Refresh list"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingApps ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* App search */}
                {availableApps.length > 5 && (
                  <div className="px-3 pb-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        placeholder="Search apps…"
                        className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    </div>
                  </div>
                )}

                {/* App list */}
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
                      .filter(app =>
                        !appSearchQuery || app.name.toLowerCase().includes(appSearchQuery.toLowerCase())
                      )
                      .map((app) => (
                        <button
                          key={app.id}
                          onClick={() => handleSourceSelect("application", app)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left ${selectedAppSource?.id === app.id && preferredAudioSource === "application" ? "bg-white/8" : ""
                            }`}
                        >
                          {app.appIcon ? (
                            <img src={app.appIcon} alt="" className="w-5 h-5 rounded shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/50 shrink-0">
                              {app.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-[13px] text-white/80 truncate flex-1 min-w-0">{app.name}</span>
                          {selectedAppSource?.id === app.id && preferredAudioSource === "application" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
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
          <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
            <div className="text-[13px] text-white/75 mb-2">Live State Lane</div>
            <div className="grid grid-cols-4 gap-1.5">
              {stateLane.map((laneState, index) => {
                const isActiveStep = status.state === laneState;
                const isCompletedStep = activeLaneIndex > -1 && activeLaneIndex > index;
                const isIdle = status.state === "idle";

                return (
                  <div
                    key={laneState}
                    className={`rounded-md border px-2 py-1.5 text-center text-[12px] functional-state-transition ${isIdle
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
          </div>
        )}
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
                <div ref={responseRef} className="px-3 pb-3 overflow-y-auto max-h-[60vh]">
                  {hasResponse ? (
                    <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">
                      {renderFormattedText(status.response)}
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
