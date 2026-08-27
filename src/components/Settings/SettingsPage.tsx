import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../contexts/toast";
import { AudioSettings } from "./AudioSettings";
import { ProfileManager } from "../Profile/ProfileManager";
import { UserProfile } from "../../types";

type APIProvider = "openai" | "gemini" | "anthropic" | "custom";

type SettingsSection = "api" | "audio" | "language" | "mode" | "profile" | "style" | "window" | "shortcuts" | "debug";

const PROVIDER_META: Record<APIProvider, { model: string; label: string; hint: string }> = {
    gemini: { model: "gemini-3-flash-preview", label: "Gemini", hint: "AIzaSy..." },
    openai: { model: "gpt-4o", label: "OpenAI", hint: "sk-..." },
    anthropic: { model: "claude-3-7-sonnet-20250219", label: "Claude", hint: "sk-ant-..." },
    custom: { model: "deepseek/deepseek-r1", label: "Custom / Ollama", hint: "sk-or-... or token" },
};

const MODELS: Record<APIProvider, { id: string; name: string }[]> = {
    gemini: [
        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
        { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro Exp" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
        { id: "custom", name: "Custom Model..." },
    ],
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "o1", name: "o1" },
        { id: "o3-mini", name: "o3-mini" },
        { id: "o1-mini", name: "o1-mini" },
        { id: "gpt-4.5-preview", name: "GPT-4.5" },
        { id: "custom", name: "Custom Model..." },
    ],
    anthropic: [
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "custom", name: "Custom Model..." },
    ],
    custom: [
        { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
        { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
        { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder" },
        { id: "deepseek-r1:latest", name: "Ollama R1" },
        { id: "qwen2.5-coder:latest", name: "Ollama Qwen" },
        { id: "custom", name: "Custom Model..." },
    ],
};

const PROVIDER_LINKS: Record<APIProvider, { signup: string; keys: string }> = {
    gemini: { signup: "https://aistudio.google.com/", keys: "https://aistudio.google.com/app/apikey" },
    openai: { signup: "https://platform.openai.com/signup", keys: "https://platform.openai.com/api-keys" },
    anthropic: { signup: "https://console.anthropic.com/signup", keys: "https://console.anthropic.com/settings/keys" },
    custom: { signup: "https://openrouter.ai/signup", keys: "https://openrouter.ai/keys" },
};


const SECTIONS: { id: SettingsSection; icon: string }[] = [
    { id: "api", icon: "🔑" },
    { id: "audio", icon: "🎙" },
    { id: "language", icon: "🌐" },
    { id: "mode", icon: "🎯" },
    { id: "profile", icon: "👤" },
    { id: "style", icon: "💬" },
    { id: "window", icon: "🔳" },
    { id: "shortcuts", icon: "⌨️" },
    { id: "debug", icon: "🐛" },
];

const RECOGNITION_LANGUAGES = [
    { code: "auto", name: "Auto-detect" },
    { code: "en", name: "English" },
    { code: "ru", name: "Русский" },
    { code: "de", name: "Deutsch" },
    { code: "fr", name: "Français" },
    { code: "es", name: "Español" },
    { code: "pt", name: "Português" },
    { code: "it", name: "Italiano" },
    { code: "nl", name: "Nederlands" },
    { code: "pl", name: "Polski" },
    { code: "uk", name: "Українська" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "zh", name: "中文" },
    { code: "ar", name: "العربية" },
    { code: "hi", name: "हिन्दी" },
    { code: "tr", name: "Türkçe" },
    { code: "vi", name: "Tiếng Việt" },
    { code: "th", name: "ไทย" },
    { code: "sv", name: "Svenska" },
    { code: "cs", name: "Čeština" },
    { code: "lv", name: "Latviešu" },
    { code: "lt", name: "Lietuvių" },
    { code: "et", name: "Eesti" },
];

const INTERFACE_LANGUAGES = [
    { code: "en", name: "English" },
    { code: "ru", name: "Русский" },
];

const PROGRAMMING_LANGUAGES = [
    "Python", "JavaScript", "TypeScript", "Go", "Java", "C++", "C#", "Rust", "Swift", "Kotlin", "Ruby", "PHP", "Scala", "Haskell",
];

const INTERVIEW_FOCUS = [
    { id: "algorithms", label: "Algorithms & DS" },
    { id: "system_design", label: "System Design" },
    { id: "frontend", label: "Frontend" },
    { id: "backend", label: "Backend" },
    { id: "devops", label: "DevOps" },
    { id: "ml", label: "ML / AI" },
];

export interface SettingsPageProps {
    onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const [activeSection, setActiveSection] = useState<SettingsSection>("api");

    // API state
    const [apiKey, setApiKey] = useState("");
    const [apiProvider, setApiProvider] = useState<APIProvider>("gemini");
    const [customBaseUrl, setCustomBaseUrl] = useState("https://openrouter.ai/api/v1");
    const [extractionModel, setExtractionModel] = useState("gemini-3-flash-preview");
    const [solutionModel, setSolutionModel] = useState("gemini-3-flash-preview");
    const [debuggingModel, setDebuggingModel] = useState("gemini-3-flash-preview");
    const [customExtractionModel, setCustomExtractionModel] = useState("");
    const [customSolutionModel, setCustomSolutionModel] = useState("");
    const [customDebuggingModel, setCustomDebuggingModel] = useState("");
    const [temperature, setTemperature] = useState<number>(0.2);
    const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
    const [maxTokens, setMaxTokens] = useState<number>(4000);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testDetails, setTestDetails] = useState<{ responseTime?: number; error?: string }>({});

    // Audio state
    const [audioSource, setAudioSource] = useState<'microphone' | 'system' | 'application'>('system');
    const [applicationName, setApplicationName] = useState('');

    // Language state
    const [recognitionLang, setRecognitionLang] = useState("auto");
    const [interfaceLang, setInterfaceLang] = useState(i18n.language);

    // Interview mode state
    const [interviewMode, setInterviewMode] = useState<"programming" | "general" | "custom">("programming");
    const [programmingLang, setProgrammingLang] = useState("Python");
    const [interviewLevel, setInterviewLevel] = useState<"junior" | "middle" | "senior">("middle");
    const [interviewFocus, setInterviewFocus] = useState<string[]>(["algorithms"]);
    const [customTopic, setCustomTopic] = useState("");

    // Profiles state
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | undefined>();
    const [profileName, setProfileName] = useState("");
    const [profileExperience, setProfileExperience] = useState("");
    const [profileSkills, setProfileSkills] = useState("");

    // Personalization state
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [jobDescText, setJobDescText] = useState('');
    const [companyStatus, setCompanyStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
    const [profileSubTab, setProfileSubTab] = useState<'profile' | 'company'>('profile');

    // Response style state
    const [responseStyle, setResponseStyle] = useState("full");
    const [responseLength, setResponseLength] = useState("medium");

    // Debug state
    const [promptPreview, setPromptPreview] = useState<{
        hintGenerationPrompt: string;
        transcriptionPrompt: string;
        settings: { interviewMode: string; answerStyle: string; language: string };
    } | null>(null);
    const [promptLoading, setPromptLoading] = useState(false);

    // Window settings state
    const [alwaysOnTop, setAlwaysOnTop] = useState(true);
    const [stealthMode, setStealthMode] = useState(true);

    const [isLoading, setIsLoading] = useState(false);

    // Load config
    useEffect(() => {
        setIsLoading(true);
        window.electronAPI
            .getConfig()
            .then((config: Record<string, unknown>) => {
                if (!config) return;
                if (config.apiKey) setApiKey(config.apiKey as string);
                if (config.apiProvider) setApiProvider(config.apiProvider as APIProvider);
                if (config.customBaseUrl) setCustomBaseUrl(config.customBaseUrl as string);
                if (config.temperature !== undefined) setTemperature(Number(config.temperature));
                if (config.reasoningEffort) setReasoningEffort(config.reasoningEffort as 'low' | 'medium' | 'high');
                if (config.maxTokens !== undefined) setMaxTokens(Number(config.maxTokens));
                if (config.extractionModel) setExtractionModel(config.extractionModel as string);
                if (config.solutionModel) setSolutionModel(config.solutionModel as string);
                if (config.debuggingModel) setDebuggingModel(config.debuggingModel as string);
                if (config.audioConfig) {
                    const ac = config.audioConfig as Record<string, unknown>;
                    if (ac.source) setAudioSource(ac.source as 'microphone' | 'system' | 'application');
                    if (ac.applicationName) setApplicationName(ac.applicationName as string);
                }
                if (config.recognitionLanguage) setRecognitionLang(config.recognitionLanguage as string);
                if (config.interfaceLanguage) {
                    const lang = config.interfaceLanguage as string;
                    setInterfaceLang(lang);
                    i18n.changeLanguage(lang);
                }
                // Load from nested interviewPreferences (primary) or flat fields (backward compat)
                const prefs = config.interviewPreferences as Record<string, unknown> | undefined;
                const mode = prefs?.mode || config.interviewMode;
                const style = prefs?.answerStyle || config.responseStyle;
                const recLang = prefs?.language || config.recognitionLanguage;
                if (recLang) setRecognitionLang(recLang as string);
                if (mode) setInterviewMode(mode as "programming" | "general" | "custom");
                if (config.programmingLanguage) setProgrammingLang(config.programmingLanguage as string);
                if (config.interviewLevel) setInterviewLevel(config.interviewLevel as "junior" | "middle" | "senior");
                if (config.interviewFocus) setInterviewFocus(config.interviewFocus as string[]);
                if (config.customTopic) setCustomTopic(config.customTopic as string);
                if (config.profileName) setProfileName(config.profileName as string);
                if (config.profileExperience) setProfileExperience(config.profileExperience as string);
                if (config.profileSkills) setProfileSkills(config.profileSkills as string);

                // Load personalization profiles
                if (config.profiles && Array.isArray(config.profiles)) {
                    setProfiles(config.profiles as UserProfile[]);
                }
                if (config.activeProfileId) {
                    setActiveProfileId(config.activeProfileId as string);
                }

                const companies = config.companyContexts as { id?: string; companyName?: string; jobTitle?: string }[] | undefined;
                const activeCompanyId = config.activeCompanyId as string | undefined;
                if (companies && activeCompanyId) {
                    const activeCompany = companies.find((c: { id?: string }) => c.id === activeCompanyId);
                    if (activeCompany) {
                        if (activeCompany.companyName) setCompanyName(activeCompany.companyName);
                        if (activeCompany.jobTitle) setJobTitle(activeCompany.jobTitle);
                        setCompanyStatus('done');
                    }
                }
                if (style) setResponseStyle(style as string);
                if (config.responseLength) setResponseLength(config.responseLength as string);
                if (config.displayConfig) {
                    const dc = config.displayConfig as Record<string, unknown>;
                    if (dc.alwaysOnTop !== undefined) setAlwaysOnTop(dc.alwaysOnTop as boolean);
                    if (dc.stealthMode !== undefined) setStealthMode(dc.stealthMode as boolean);
                }
            })
            .catch(() => showToast(t("common.error"), t("common.settingsLoadError"), "error"))
            .finally(() => setIsLoading(false));
    }, [showToast, t, i18n]);


    // Wheel scroll workaround
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => { e.preventDefault(); el.scrollTop += e.deltaY; };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // Resize window
    useEffect(() => {
        window.electronAPI?.setSetupWindowSize({ width: 660, height: 800 });
    }, []);

    const handleProviderChange = useCallback((provider: APIProvider) => {
        setApiProvider(provider);
        const def = PROVIDER_META[provider].model;
        setExtractionModel(def);
        setSolutionModel(def);
        setDebuggingModel(def);
        setTestStatus('idle');
        setTestDetails({});
    }, []);

    const handleInterfaceLangChange = useCallback((lang: string) => {
        setInterfaceLang(lang);
        i18n.changeLanguage(lang);
    }, [i18n]);

    const toggleFocus = useCallback((id: string) => {
        setInterviewFocus(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    }, []);

    const handleTestConnection = async () => {
        if (apiProvider !== 'custom' && !apiKey.trim()) {
            showToast(t("common.error"), "Please enter an API key first", "error");
            return;
        }

        setTestStatus('testing');
        setTestDetails({});
        const startTime = Date.now();

        try {
            const activeModel = solutionModel === 'custom' ? (customSolutionModel || 'custom-model') : solutionModel;
            const result = await window.electronAPI.testApiKey(
                apiKey.trim(),
                apiProvider,
                activeModel,
                apiProvider === 'custom' ? customBaseUrl : undefined
            );
            const responseTime = result?.latency ?? (Date.now() - startTime);
            if (result?.valid) {
                setTestStatus('success');
                setTestDetails({ responseTime });
                showToast(t("common.success"), `Connected to ${PROVIDER_META[apiProvider].label} (${responseTime}ms)`, "success");
            } else {
                setTestStatus('error');
                setTestDetails({ error: result?.error || "Failed to validate API key or model" });
                showToast(t("common.error"), result?.error || "Validation failed", "error");
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Network error";
            setTestStatus('error');
            setTestDetails({ error: errorMsg });
            showToast(t("common.error"), errorMsg, "error");
        }
    };

    const handleCreateProfile = async (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
        const now = Date.now();
        const newProfile: UserProfile = {
            ...profileData,
            id: `profile-${now}`,
            createdAt: now,
            updatedAt: now,
        };
        const updated = [...profiles, newProfile];
        setProfiles(updated);
        setActiveProfileId(newProfile.id);
        await window.electronAPI.updateConfig({
            profiles: updated,
            activeProfileId: newProfile.id,
        });
        showToast(t("common.success"), "Profile created successfully", "success");
    };

    const handleUpdateProfile = async (id: string, updates: Partial<UserProfile>) => {
        const updated = profiles.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p);
        setProfiles(updated);
        await window.electronAPI.updateConfig({ profiles: updated });
        showToast(t("common.success"), "Profile updated", "success");
    };

    const handleDeleteProfile = async (id: string) => {
        const updated = profiles.filter(p => p.id !== id);
        let nextActiveId = activeProfileId;
        if (activeProfileId === id) {
            nextActiveId = updated.length > 0 ? updated[0].id : undefined;
        }
        setProfiles(updated);
        setActiveProfileId(nextActiveId);
        await window.electronAPI.updateConfig({
            profiles: updated,
            activeProfileId: nextActiveId,
        });
        showToast(t("common.success"), "Profile deleted", "success");
    };

    const handleSetActiveProfile = async (id: string) => {
        setActiveProfileId(id);
        await window.electronAPI.updateConfig({ activeProfileId: id });
        showToast(t("common.success"), "Active profile updated", "success");
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const finalExtraction = extractionModel === 'custom' ? (customExtractionModel.trim() || 'custom-model') : extractionModel;
            const finalSolution = solutionModel === 'custom' ? (customSolutionModel.trim() || 'custom-model') : solutionModel;
            const finalDebugging = debuggingModel === 'custom' ? (customDebuggingModel.trim() || 'custom-model') : debuggingModel;

            const result = await window.electronAPI.updateConfig({
                apiKey: apiKey.trim(),
                apiProvider,
                customBaseUrl: apiProvider === 'custom' ? customBaseUrl.trim() : undefined,
                extractionModel: finalExtraction,
                solutionModel: finalSolution,
                debuggingModel: finalDebugging,
                temperature,
                reasoningEffort,
                maxTokens,
                audioConfig: {
                    source: audioSource,
                    applicationName: audioSource === 'application' ? applicationName : undefined,
                    autoStart: true,
                    testCompleted: true,
                },
                recognitionLanguage: recognitionLang,
                interfaceLanguage: interfaceLang,
                interviewMode,
                programmingLanguage: programmingLang,
                interviewLevel,
                interviewFocus,
                customTopic,
                profileName,
                profileExperience,
                profileSkills,
                responseStyle,
                responseLength,
                displayConfig: {
                    alwaysOnTop,
                    stealthMode,
                }
            });
            if (result) {
                showToast(t("common.success"), t("common.settingsSaved"), "success");
                onClose();
            }
        } catch {
            showToast(t("common.error"), t("common.settingsSaveError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const openLink = (url: string) => window.electronAPI.openLink(url);
    const link = PROVIDER_LINKS[apiProvider];

    // ──────────────── Section renderers ────────────────

    const renderAPI = () => (
        <div className="space-y-5">
            {/* Provider toggle */}
            <Field label={t("settings.api.provider")}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(["gemini", "openai", "anthropic", "custom"] as const).map((p) => (
                        <Pill key={p} active={apiProvider === p} onClick={() => handleProviderChange(p)}>
                            {PROVIDER_META[p].label}
                        </Pill>
                    ))}
                </div>
            </Field>

            {/* Custom Base URL (shown when provider === 'custom') */}
            {apiProvider === 'custom' && (
                <Field label="Endpoint Base URL (OpenAI-Compatible)">
                    <input
                        type="text"
                        value={customBaseUrl}
                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                        placeholder="https://openrouter.ai/api/v1"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors font-mono"
                    />
                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[11px] text-white/40 mr-1">Presets:</span>
                        {[
                            { label: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-r1" },
                            { label: "Ollama (Local)", url: "http://localhost:11434/v1", model: "deepseek-r1:latest" },
                            { label: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
                            { label: "Groq", url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
                            { label: "LM Studio", url: "http://localhost:1234/v1", model: "local-model" }
                        ].map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                    setCustomBaseUrl(preset.url);
                                    setSolutionModel(preset.model);
                                    setExtractionModel(preset.model);
                                    setDebuggingModel(preset.model);
                                }}
                                className="px-2 py-0.5 rounded text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </Field>
            )}

            {/* API Key */}
            <Field label={`${PROVIDER_META[apiProvider].label} ${t("settings.api.apiKey")}`}>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value);
                        if (testStatus !== 'idle') {
                            setTestStatus('idle');
                            setTestDetails({});
                        }
                    }}
                    placeholder={PROVIDER_META[apiProvider].hint}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                />
                {apiKey && <p className="text-xs text-white/40 mt-1">{t("settings.api.currentKey")}: {apiKey.substring(0, 4)}...{apiKey.substring(apiKey.length - 4)}</p>}
                <p className="text-xs text-white/30 mt-1">{t("settings.api.storedLocally", { provider: PROVIDER_META[apiProvider].label })}</p>
                {apiProvider !== 'custom' && link && (
                    <p className="text-xs text-white/50 mt-1">
                        {t("settings.api.noKey")}{" "}
                        <button onClick={() => openLink(link.signup)} className="text-blue-400 hover:underline">{t("settings.api.signup")}</button>
                        {" → "}
                        <button onClick={() => openLink(link.keys)} className="text-blue-400 hover:underline">{t("settings.api.getKey")}</button>
                    </p>
                )}
            </Field>

            {/* Test Connection Button & Result */}
            <div className="space-y-2 pt-1">
                <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={(apiProvider !== 'custom' && !apiKey.trim()) || testStatus === 'testing'}
                    className={`w-full py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border ${
                        testStatus === 'success'
                            ? 'bg-green-500/15 text-green-300 border-green-500/30'
                            : testStatus === 'error'
                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                    } ${((apiProvider !== 'custom' && !apiKey.trim()) || testStatus === 'testing') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {testStatus === 'testing' ? '⏳ Testing Connection & Model...' :
                     testStatus === 'success' ? `✅ Connected (${testDetails.responseTime || 0}ms)` :
                     testStatus === 'error' ? '❌ Connection Failed — Retry' :
                     '🔍 Test Connection & Model'}
                </button>
                {testStatus === 'error' && testDetails.error && (
                    <p className="text-[11px] text-red-400/90 px-1">{testDetails.error}</p>
                )}
            </div>

            {/* Models Selection */}
            <Field label={t("settings.api.models")}>
                <div className="space-y-3">
                    {([
                        { key: "extraction", value: extractionModel, set: setExtractionModel, customVal: customExtractionModel, setCustom: setCustomExtractionModel },
                        { key: "solution", value: solutionModel, set: setSolutionModel, customVal: customSolutionModel, setCustom: setCustomSolutionModel },
                        { key: "debugging", value: debuggingModel, set: setDebuggingModel, customVal: customDebuggingModel, setCustom: setCustomDebuggingModel },
                    ] as const).map(({ key, value, set, customVal, setCustom }) => {
                        const isCustom = !MODELS[apiProvider].some(m => m.id === value && m.id !== 'custom') || value === 'custom';
                        return (
                            <div key={key} className="space-y-1.5 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-white/70">{t(`settings.api.${key}`)}</span>
                                    <span className="text-[11px] text-white/40 font-mono">{isCustom ? customVal || value : value}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {MODELS[apiProvider].map((m) => (
                                        <Pill
                                            key={m.id}
                                            active={m.id === 'custom' ? isCustom : value === m.id}
                                            onClick={() => {
                                                if (m.id === 'custom') {
                                                    set('custom');
                                                } else {
                                                    set(m.id);
                                                }
                                            }}
                                            small
                                        >
                                            {m.name}
                                        </Pill>
                                    ))}
                                </div>
                                {isCustom && (
                                    <input
                                        type="text"
                                        value={customVal || (value !== 'custom' ? value : '')}
                                        onChange={(e) => {
                                            setCustom(e.target.value);
                                            set(e.target.value || 'custom');
                                        }}
                                        placeholder="Enter model identifier (e.g. o3-mini, deepseek/deepseek-r1)"
                                        className="w-full mt-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-white/30"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </Field>

            {/* Hyperparameters Section */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Model Hyperparameters
                </h4>
                <div className="space-y-3">
                    {/* Temperature Slider */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/60">Temperature (Creativity)</span>
                            <span className="text-white/90 font-mono">{temperature.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 bg-white/10 rounded-lg cursor-pointer h-1.5"
                        />
                        <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                            <span>0.0 (Deterministic / Exact Code)</span>
                            <span>0.2 (Optimal)</span>
                            <span>1.0 (Creative)</span>
                        </div>
                    </div>

                    {/* Reasoning Effort (o1, o3, DeepSeek R1) */}
                    <div>
                        <span className="text-xs text-white/60 block mb-1">Reasoning Effort (for o1 / o3 / R1)</span>
                        <div className="flex gap-1.5">
                            {(["low", "medium", "high"] as const).map((effort) => (
                                <Pill
                                    key={effort}
                                    active={reasoningEffort === effort}
                                    onClick={() => setReasoningEffort(effort)}
                                    small
                                >
                                    {effort.toUpperCase()}
                                </Pill>
                            ))}
                        </div>
                    </div>

                    {/* Max Tokens */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/60">Max Output Tokens</span>
                            <span className="text-white/90 font-mono">{maxTokens}</span>
                        </div>
                        <input
                            type="range"
                            min="1000"
                            max="16000"
                            step="500"
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                            className="w-full accent-blue-500 bg-white/10 rounded-lg cursor-pointer h-1.5"
                        />
                    </div>
                </div>
            </div>
        </div>
    );


    const renderAudio = () => (
        <AudioSettings
            audioSource={audioSource}
            applicationName={applicationName}
            apiKey={apiKey}
            onAudioSourceChange={setAudioSource}
            onApplicationChange={setApplicationName}
        />
    );

    const renderLanguage = () => (
        <div className="space-y-5">
            <Field label={t("settings.language.recognition")}>
                <select
                    value={recognitionLang}
                    onChange={(e) => setRecognitionLang(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                >
                    {RECOGNITION_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-black text-white">
                            {lang.code === "auto" ? `🔍 ${lang.name}` : lang.name}
                        </option>
                    ))}
                </select>
                {recognitionLang === "auto" && (
                    <p className="text-xs text-yellow-400/70 mt-1.5">💡 {t("settings.language.autoDetectHint")}</p>
                )}
            </Field>

            <Field label={t("settings.language.interface")}>
                <div className="flex gap-1.5">
                    {INTERFACE_LANGUAGES.map((lang) => (
                        <Pill key={lang.code} active={interfaceLang === lang.code} onClick={() => handleInterfaceLangChange(lang.code)}>
                            {lang.name}
                        </Pill>
                    ))}
                </div>
            </Field>
        </div>
    );

    const renderMode = () => (
        <div className="space-y-5">
            {/* Mode selector */}
            <Field label={t("settings.mode.label")}>
                <div className="flex gap-1.5">
                    {(["programming", "general", "custom"] as const).map((m) => (
                        <Pill key={m} active={interviewMode === m} onClick={() => setInterviewMode(m)}>
                            {t(`settings.mode.${m}`)}
                        </Pill>
                    ))}
                </div>
            </Field>

            {interviewMode === "programming" && (
                <>
                    <Field label={t("settings.mode.progLang")}>
                        <div className="flex flex-wrap gap-1.5">
                            {PROGRAMMING_LANGUAGES.map((lang) => (
                                <Pill key={lang} active={programmingLang === lang} onClick={() => setProgrammingLang(lang)} small>
                                    {lang}
                                </Pill>
                            ))}
                        </div>
                    </Field>

                    <Field label={t("settings.mode.level")}>
                        <div className="flex gap-1.5">
                            {(["junior", "middle", "senior"] as const).map((lvl) => (
                                <Pill key={lvl} active={interviewLevel === lvl} onClick={() => setInterviewLevel(lvl)}>
                                    {t(`settings.mode.${lvl}`)}
                                </Pill>
                            ))}
                        </div>
                    </Field>

                    <Field label={t("settings.mode.focus")}>
                        <div className="flex flex-wrap gap-1.5">
                            {INTERVIEW_FOCUS.map((f) => (
                                <Pill key={f.id} active={interviewFocus.includes(f.id)} onClick={() => toggleFocus(f.id)} small>
                                    {f.label}
                                </Pill>
                            ))}
                        </div>
                        <p className="text-xs text-white/30 mt-1">{t("settings.mode.focusHint")}</p>
                    </Field>
                </>
            )}

            {interviewMode === "custom" && (
                <Field label={t("settings.mode.topic")}>
                    <input
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder={t("settings.mode.topicPlaceholder")}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                    />
                </Field>
            )}
        </div>
    );

    const handleJobDescSettings = async () => {
        if (!jobDescText.trim()) return;
        setCompanyStatus('parsing');
        try {
            const result = await window.electronAPI.parseJobText(jobDescText);
            if (!result.success) { setCompanyStatus('error'); return; }
            const c = result.company as { companyName?: string; jobTitle?: string } | undefined;
            if (c) {
                if (c.companyName) setCompanyName(c.companyName);
                if (c.jobTitle) setJobTitle(c.jobTitle);
            }
            setCompanyStatus('done');
            showToast(t("common.success"), "Job description analyzed", "success");
        } catch {
            setCompanyStatus('error');
        }
    };

    const handleJdUploadSettings = async () => {
        setCompanyStatus('parsing');
        try {
            const result = await window.electronAPI.uploadJobDescription();
            if (result.canceled) { setCompanyStatus('idle'); return; }
            if (!result.success) { setCompanyStatus('error'); return; }
            const c = result.company as { companyName?: string; jobTitle?: string } | undefined;
            if (c) {
                if (c.companyName) setCompanyName(c.companyName);
                if (c.jobTitle) setJobTitle(c.jobTitle);
            }
            setCompanyStatus('done');
            showToast(t("common.success"), "Job description analyzed", "success");
        } catch {
            setCompanyStatus('error');
        }
    };

    const renderProfile = () => (
        <div className="space-y-4">
            {/* Sub-tabs for profile section */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {([
                    { id: 'profile' as const, label: '👤 Profile Manager' },
                    { id: 'company' as const, label: '🏢 Company Context' },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setProfileSubTab(tab.id)}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            profileSubTab === tab.id
                                ? 'bg-white/15 text-white shadow-sm'
                                : 'text-white/40 hover:text-white/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {profileSubTab === 'profile' && (
                <ProfileManager
                    embedded={true}
                    profiles={profiles}
                    activeProfileId={activeProfileId}
                    onCreateProfile={handleCreateProfile}
                    onUpdateProfile={handleUpdateProfile}
                    onDeleteProfile={handleDeleteProfile}
                    onSetActiveProfile={handleSetActiveProfile}
                />
            )}

            {/* Company sub-tab */}
            {profileSubTab === 'company' && (
                <div className="space-y-4 pt-2">
                    {companyStatus === 'done' && companyName && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-2">
                            <span className="text-sm">✅</span>
                            <div>
                                <p className="text-xs text-green-400 font-medium">{companyName}{jobTitle ? ` — ${jobTitle}` : ''}</p>
                                <p className="text-xs text-white/50 mt-0.5">Company context active. AI will tailor answers.</p>
                            </div>
                        </div>
                    )}

                    <Field label="Upload Job Description (PDF)">
                        <button
                            onClick={handleJdUploadSettings}
                            disabled={companyStatus === 'parsing'}
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm hover:bg-white/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {companyStatus === 'parsing' ? '⏳ Analyzing...' : '📄 Upload JD (PDF)'}
                        </button>
                    </Field>

                    <Field label="Or paste job description text">
                        <textarea
                            value={jobDescText}
                            onChange={(e) => setJobDescText(e.target.value)}
                            placeholder="Paste the full job description here..."
                            rows={4}
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </Field>
                    <button
                        onClick={handleJobDescSettings}
                        disabled={!jobDescText.trim() || companyStatus === 'parsing'}
                        className="w-full px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg text-sm text-white/80 transition-colors font-medium"
                    >
                        {companyStatus === 'parsing' ? '⏳ Analyzing...' : 'Analyze Job Description'}
                    </button>

                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-300">
                            Adding company context helps the AI match your answers to the specific role and company culture.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStyle = () => (
        <div className="space-y-5">
            <Field label={t("settings.style.responseStyle")}>
                <div className="space-y-1.5">
                    {(["hints", "full", "bullets", "echo"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setResponseStyle(s)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${responseStyle === s
                                ? "bg-white/10 border border-white/20 text-white"
                                : "bg-white/3 border border-transparent text-white/60 hover:bg-white/5"
                                }`}
                        >
                            <span className="font-medium">{t(`settings.style.${s}`)}</span>
                            <span className="text-xs text-white/40 ml-2">— {t(`settings.style.${s}Desc`)}</span>
                        </button>
                    ))}
                </div>
            </Field>

            <Field label={t("settings.style.responseLength")}>
                <div className="flex gap-1.5">
                    {(["short", "medium", "long"] as const).map((l) => (
                        <Pill key={l} active={responseLength === l} onClick={() => setResponseLength(l)}>
                            {t(`settings.style.${l}`)}
                        </Pill>
                    ))}
                </div>
            </Field>
        </div>
    );

    const renderWindow = () => (
        <div className="space-y-3">
            {/* Always on Top */}
            <div className="flex items-center justify-between py-2.5 px-3 bg-white/5 rounded-lg border border-white/8">
                <div>
                    <span className="text-sm text-white/80">{t("settings.window.alwaysOnTop")}</span>
                    <p className="text-[11px] text-white/35 mt-0.5">{t("settings.window.alwaysOnTopDesc")}</p>
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
            <div className="flex items-center justify-between py-2.5 px-3 bg-white/5 rounded-lg border border-white/8">
                <div>
                    <span className="text-sm text-white/80">{t("settings.window.stealthMode")}</span>
                    <p className="text-[11px] text-white/35 mt-0.5">{t("settings.window.stealthModeDesc")}</p>
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

            <p className="text-xs text-white/25 mt-1">{t("settings.window.hint")}</p>
        </div>
    );

    const renderShortcuts = () => (
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            {[
                [t("settings.shortcuts.toggleVisibility"), "Ctrl+B"],
                [t("settings.shortcuts.takeScreenshot"), "Ctrl+H"],
                [t("settings.shortcuts.processScreenshots"), "Ctrl+Enter"],
                [t("settings.shortcuts.deleteLastScreenshot"), "Ctrl+L"],
                [t("settings.shortcuts.resetView"), "Ctrl+Alt+R"],
                [t("settings.shortcuts.quit"), "Ctrl+Q"],
                [t("settings.shortcuts.moveWindow"), "Ctrl+Alt+Arrows"],
                [t("settings.shortcuts.centerWindow") || "Center Window", "Ctrl+Alt+C"],
                [t("settings.shortcuts.opacity"), "Ctrl+Alt+[ / ]"],
                [t("settings.shortcuts.zoom"), "Ctrl+- / 0 / ="],
            ].map(([label, key]) => (
                <div key={label} className="contents">
                    <span className="text-white/40">{label}</span>
                    <span className="text-white/60 font-mono">{key}</span>
                </div>
            ))}
        </div>
    );

    const loadPromptPreview = useCallback(async () => {
        setPromptLoading(true);
        try {
            const preview = await window.electronAPI.getSystemPromptPreview();
            setPromptPreview(preview);
        } catch (err) {
            console.error('Failed to load prompt preview:', err);
        } finally {
            setPromptLoading(false);
        }
    }, []);

    const renderDebug = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white/80">🐛 System Prompt Debug</h3>
                <button
                    onClick={loadPromptPreview}
                    disabled={promptLoading}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-all disabled:opacity-40"
                >
                    {promptLoading ? 'Loading...' : 'Load Prompts'}
                </button>
            </div>

            {promptPreview ? (
                <>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Active Settings</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-white/5 rounded p-2">
                                <span className="text-white/40">Mode:</span>
                                <span className="ml-1 text-white/80">{promptPreview.settings.interviewMode}</span>
                            </div>
                            <div className="bg-white/5 rounded p-2">
                                <span className="text-white/40">Style:</span>
                                <span className="ml-1 text-white/80">{promptPreview.settings.answerStyle}</span>
                            </div>
                            <div className="bg-white/5 rounded p-2">
                                <span className="text-white/40">Lang:</span>
                                <span className="ml-1 text-white/80">{promptPreview.settings.language}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Hint Generation Prompt</span>
                            <span className="text-[10px] text-white/30">(gemini-3-flash)</span>
                        </div>
                        <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                            {promptPreview.hintGenerationPrompt}
                        </pre>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">Transcription Prompt</span>
                            <span className="text-[10px] text-white/30">(gemini-native-audio)</span>
                        </div>
                        <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">
                            {promptPreview.transcriptionPrompt || '(no custom instruction — using model default)'}
                        </pre>
                    </div>

                    <p className="text-[10px] text-white/30 italic">
                        These are the exact system instructions sent to Gemini when you start an interview.
                        Change settings, save, then reload this preview.
                    </p>
                </>
            ) : (
                <div className="text-xs text-white/30 text-center py-8">
                    Click "Load Prompts" to preview the system instructions that will be sent to Gemini.
                </div>
            )}
        </div>
    );

    const SECTION_RENDERERS: Record<SettingsSection, () => React.JSX.Element> = {
        api: renderAPI,
        audio: renderAudio,
        language: renderLanguage,
        mode: renderMode,
        profile: renderProfile,
        style: renderStyle,
        shortcuts: renderShortcuts,
        window: renderWindow,
        debug: renderDebug,
    };

    return (
        <div className="w-full h-full bg-black text-white rounded-2xl overflow-hidden flex flex-col select-none">
            {/* Drag area */}
            <div
                className="h-8 w-full shrink-0 flex items-center justify-between px-4"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                <span className="text-xs text-white/40 font-medium">{t("settings.title")}</span>
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button
                        className="w-3 h-3 rounded-full bg-white/20 hover:bg-red-500 transition-colors"
                        onClick={onClose}
                        title="Close"
                    />
                </div>
            </div>

            {/* Main layout: sidebar + content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Sidebar */}
                <nav className="w-[140px] shrink-0 border-r border-white/8 py-2 px-2 flex flex-col gap-0.5">
                    {SECTIONS.map((sec) => (
                        <button
                            key={sec.id}
                            onClick={() => setActiveSection(sec.id)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all ${activeSection === sec.id
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:bg-white/5 hover:text-white/70"
                                }`}
                        >
                            <span className="text-sm">{sec.icon}</span>
                            <span>{t(`settings.sections.${sec.id}`)}</span>
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-4">
                    <div key={activeSection} className="animate-fade-in">
                        {SECTION_RENDERERS[activeSection]()}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between shrink-0">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                >
                    {t("settings.actions.cancel")}
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.electronAPI.quitApp()}
                        className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                        {t("settings.actions.quit")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !apiKey}
                        className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? t("settings.actions.saving") : t("settings.actions.save")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ──────────────── Reusable primitives ────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2 block">{label}</label>
            {children}
        </div>
    );
}

function Pill({ active, onClick, children, small }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    small?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`${small ? "py-1.5 px-2.5 text-xs" : "py-2 px-3 text-sm"} rounded-lg font-medium transition-all ${active
                ? "bg-white text-black shadow-sm"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                }`}
        >
            {children}
        </button>
    );
}
