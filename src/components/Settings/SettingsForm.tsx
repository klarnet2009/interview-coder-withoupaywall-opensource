import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../../contexts/toast";
import { AudioSettings } from "./AudioSettings";

type APIProvider = "openai" | "gemini" | "anthropic";

const PROVIDER_DEFAULTS: Record<APIProvider, { model: string; label: string; hint: string }> = {
    openai: { model: "gpt-4o", label: "OpenAI", hint: "sk-..." },
    gemini: { model: "gemini-3-flash-preview", label: "Gemini", hint: "AI..." },
    anthropic: { model: "claude-3-7-sonnet-20250219", label: "Claude", hint: "sk-ant-..." },
};

const MODELS: Record<APIProvider, { id: string; name: string }[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
    gemini: [
        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
    ],
    anthropic: [
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
};

export interface SettingsFormProps {
    onClose: () => void;
}

export function SettingsForm({ onClose }: SettingsFormProps) {
    const [apiKey, setApiKey] = useState("");
    const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
    const [extractionModel, setExtractionModel] = useState("gpt-4o");
    const [solutionModel, setSolutionModel] = useState("gpt-4o");
    const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
    const [audioSource, setAudioSource] = useState<'microphone' | 'system' | 'application'>('system');
    const [applicationName, setApplicationName] = useState('');
    const [alwaysOnTop, setAlwaysOnTop] = useState(true);
    const [stealthMode, setStealthMode] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const { showToast } = useToast();
    const formRef = useRef<HTMLDivElement>(null);

    // Load config
    useEffect(() => {
        setIsLoading(true);
        window.electronAPI
            .getConfig()
            .then((config: Record<string, unknown>) => {
                if (!config) return;
                if (config.apiKey) setApiKey(config.apiKey as string);
                if (config.apiProvider) setApiProvider(config.apiProvider as APIProvider);
                if (config.extractionModel) setExtractionModel(config.extractionModel as string);
                if (config.solutionModel) setSolutionModel(config.solutionModel as string);
                if (config.debuggingModel) setDebuggingModel(config.debuggingModel as string);
                if (config.audioConfig) {
                    const ac = config.audioConfig as Record<string, unknown>;
                    if (ac.source) setAudioSource(ac.source as 'microphone' | 'system' | 'application');
                    if (ac.applicationName) setApplicationName(ac.applicationName as string);
                }
                if (config.displayConfig) {
                    const dc = config.displayConfig as Record<string, unknown>;
                    if (dc.alwaysOnTop !== undefined) setAlwaysOnTop(dc.alwaysOnTop as boolean);
                    if (dc.stealthMode !== undefined) setStealthMode(dc.stealthMode as boolean);
                }
            })
            .catch(() => showToast("Error", "Failed to load settings", "error"))
            .finally(() => setIsLoading(false));
    }, [showToast]);

    // Wheel scroll workaround for transparent Electron windows
    useEffect(() => {
        const el = formRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => { e.preventDefault(); el.scrollTop += e.deltaY; };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const handleProviderChange = useCallback((provider: APIProvider) => {
        setApiProvider(provider);
        const def = PROVIDER_DEFAULTS[provider].model;
        setExtractionModel(def);
        setSolutionModel(def);
        setDebuggingModel(def);
    }, []);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.updateConfig({
                apiKey, apiProvider, extractionModel, solutionModel, debuggingModel,
                audioConfig: {
                    source: audioSource,
                    applicationName: audioSource === 'application' ? applicationName : undefined,
                    autoStart: true, testCompleted: true,
                },
            });
            if (result) {
                showToast("Success", "Settings saved", "success");
                onClose();
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch {
            showToast("Error", "Failed to save", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const openLink = (url: string) => window.electronAPI.openLink(url);

    const providerLinks: Record<APIProvider, { signup: string; keys: string; name: string }> = {
        openai: { signup: "https://platform.openai.com/signup", keys: "https://platform.openai.com/api-keys", name: "OpenAI" },
        gemini: { signup: "https://aistudio.google.com/", keys: "https://aistudio.google.com/app/apikey", name: "Google AI Studio" },
        anthropic: { signup: "https://console.anthropic.com/signup", keys: "https://console.anthropic.com/settings/keys", name: "Anthropic" },
    };

    const link = providerLinks[apiProvider];

    return (
        <div ref={formRef} className="flex flex-col gap-5 h-full overflow-y-auto">

            {/* ─── Provider ─── */}
            <section>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">Provider</label>
                <div className="flex gap-1.5">
                    {(["openai", "gemini", "anthropic"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${apiProvider === p
                                ? "bg-white text-black shadow-sm"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                                }`}
                        >
                            {PROVIDER_DEFAULTS[p].label}
                        </button>
                    ))}
                </div>
            </section>

            {/* ─── API Key ─── */}
            <section>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">
                    {PROVIDER_DEFAULTS[apiProvider].label} API Key
                </label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={PROVIDER_DEFAULTS[apiProvider].hint}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                     placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-colors"
                />
                {apiKey && (
                    <p className="text-xs text-white/40 mt-1.5">
                        Current: {apiKey.substring(0, 4)}...{apiKey.substring(apiKey.length - 4)}
                    </p>
                )}
                <p className="text-xs text-white/30 mt-1.5">
                    Stored locally. Only used for direct {PROVIDER_DEFAULTS[apiProvider].label} API calls.
                </p>
                <div className="mt-2 text-xs text-white/50">
                    No key?{" "}
                    <button onClick={() => openLink(link.signup)} className="text-blue-400 hover:underline">Sign up</button>
                    {" → "}
                    <button onClick={() => openLink(link.keys)} className="text-blue-400 hover:underline">Get API Key</button>
                </div>
            </section>

            {/* ─── Models ─── */}
            <section>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">Models</label>
                <div className="space-y-3">
                    {([
                        { key: "extractionModel", label: "Extraction", value: extractionModel, set: setExtractionModel },
                        { key: "solutionModel", label: "Solution", value: solutionModel, set: setSolutionModel },
                        { key: "debuggingModel", label: "Debugging", value: debuggingModel, set: setDebuggingModel },
                    ] as const).map(({ key, label, value, set }) => (
                        <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-white/50 w-20 shrink-0">{label}</span>
                            <div className="flex gap-1.5 flex-1">
                                {MODELS[apiProvider].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => set(m.id)}
                                        className={`flex-1 py-1.5 px-2 rounded-md text-xs transition-all ${value === m.id
                                            ? "bg-white/15 text-white border border-white/20"
                                            : "bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 border border-transparent"
                                            }`}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Audio ─── */}
            <section>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">Audio</label>
                <AudioSettings
                    audioSource={audioSource}
                    applicationName={applicationName}
                    apiKey={apiKey}
                    onAudioSourceChange={setAudioSource}
                    onApplicationChange={setApplicationName}
                />
            </section>

            {/* ─── Window ─── */}
            <section>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">Window</label>
                <div className="space-y-2">
                    {/* Always on Top */}
                    <div className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg border border-white/8">
                        <div>
                            <span className="text-sm text-white/80">Always on top</span>
                            <p className="text-[11px] text-white/35 mt-0.5">Keep window above all others</p>
                        </div>
                        <button
                            onClick={async () => {
                                const next = !alwaysOnTop;
                                await window.electronAPI.setAlwaysOnTop(next);
                                setAlwaysOnTop(next);
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors ${alwaysOnTop ? 'bg-white/30' : 'bg-white/10'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${alwaysOnTop ? 'translate-x-4 bg-white' : 'translate-x-0 bg-white/50'
                                }`} />
                        </button>
                    </div>

                    {/* Stealth Mode */}
                    <div className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg border border-white/8">
                        <div>
                            <span className="text-sm text-white/80">Stealth mode</span>
                            <p className="text-[11px] text-white/35 mt-0.5">Hide from screenshots & screen share</p>
                        </div>
                        <button
                            onClick={async () => {
                                const next = !stealthMode;
                                await window.electronAPI.setStealthMode(next);
                                setStealthMode(next);
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors ${stealthMode ? 'bg-white/30' : 'bg-white/10'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${stealthMode ? 'translate-x-4 bg-white' : 'translate-x-0 bg-white/50'
                                }`} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ─── Shortcuts (collapsible) ─── */}
            <section>
                <button
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className="flex items-center gap-1.5 text-xs font-medium text-white/60 uppercase tracking-wider hover:text-white/80 transition-colors"
                >
                    <span className={`transition-transform ${showShortcuts ? "rotate-90" : ""}`}>▶</span>
                    Keyboard Shortcuts
                </button>
                {showShortcuts && (
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 mt-2 text-xs">
                        {[
                            ["Toggle Visibility", "Ctrl+B"],
                            ["Take Screenshot", "Ctrl+H"],
                            ["Process Screenshots", "Ctrl+Enter"],
                            ["Delete Last Screenshot", "Ctrl+L"],
                            ["Reset View", "Ctrl+R"],
                            ["Quit", "Ctrl+Q"],
                            ["Move Window", "Ctrl+Arrows"],
                            ["Opacity −/+", "Ctrl+[ / ]"],
                            ["Zoom −/0/+", "Ctrl+- / 0 / ="],
                        ].map(([label, key]) => (
                            <div key={label} className="contents">
                                <span className="text-white/40">{label}</span>
                                <span className="text-white/60 font-mono">{key}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ─── Actions ─── */}
            <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/8">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                    Cancel
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.electronAPI.quitApp()}
                        className="px-4 py-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                    >
                        Quit
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !apiKey}
                        className="px-5 py-2 bg-white text-black text-sm font-medium rounded-lg
                       hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
