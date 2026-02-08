import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../contexts/toast";
import { AudioSettings } from "./AudioSettings";

type APIProvider = "openai" | "gemini" | "anthropic";

type SettingsSection = "api" | "audio" | "language" | "mode" | "profile" | "style" | "window" | "shortcuts" | "debug";

const PROVIDER_META: Record<APIProvider, { model: string; label: string; hint: string }> = {
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

const PROVIDER_LINKS: Record<APIProvider, { signup: string; keys: string }> = {
    openai: { signup: "https://platform.openai.com/signup", keys: "https://platform.openai.com/api-keys" },
    gemini: { signup: "https://aistudio.google.com/", keys: "https://aistudio.google.com/app/apikey" },
    anthropic: { signup: "https://console.anthropic.com/signup", keys: "https://console.anthropic.com/settings/keys" },
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
    const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
    const [extractionModel, setExtractionModel] = useState("gpt-4o");
    const [solutionModel, setSolutionModel] = useState("gpt-4o");
    const [debuggingModel, setDebuggingModel] = useState("gpt-4o");

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

    // Profile state
    const [profileName, setProfileName] = useState("");
    const [profileExperience, setProfileExperience] = useState("");
    const [profileSkills, setProfileSkills] = useState("");

    // Personalization state
    const [cvUploadStatus, setCvUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [cvFileName, setCvFileName] = useState<string>('');
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [jobDescText, setJobDescText] = useState('');
    const [companyStatus, setCompanyStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
    const [profileSubTab, setProfileSubTab] = useState<'profile' | 'cv' | 'company'>('profile');

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

                // Load personalization data
                const profiles = config.profiles as { id?: string; name?: string; skills?: string[]; cvFilePath?: string }[] | undefined;
                const activeProfileId = config.activeProfileId as string | undefined;
                if (profiles && activeProfileId) {
                    const activeProfile = profiles.find((p: { id?: string }) => p.id === activeProfileId);
                    if (activeProfile) {
                        if (activeProfile.name) setProfileName(activeProfile.name);
                        if (activeProfile.skills) setProfileSkills(activeProfile.skills.join(', '));
                        if (activeProfile.cvFilePath) {
                            setCvFileName(activeProfile.cvFilePath.split(/[/\\]/).pop() || '');
                            setCvUploadStatus('done');
                        }
                    }
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
        window.electronAPI?.setSetupWindowSize({ width: 640, height: 780 });
    }, []);

    const handleProviderChange = useCallback((provider: APIProvider) => {
        setApiProvider(provider);
        const def = PROVIDER_META[provider].model;
        setExtractionModel(def);
        setSolutionModel(def);
        setDebuggingModel(def);
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
            });
            if (result) {
                showToast(t("common.success"), t("common.settingsSaved"), "success");
                onClose();
                setTimeout(() => window.location.reload(), 1500);
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
                <div className="flex gap-1.5">
                    {(["openai", "gemini", "anthropic"] as const).map((p) => (
                        <Pill key={p} active={apiProvider === p} onClick={() => handleProviderChange(p)}>
                            {PROVIDER_META[p].label}
                        </Pill>
                    ))}
                </div>
            </Field>

            {/* API Key */}
            <Field label={`${PROVIDER_META[apiProvider].label} ${t("settings.api.apiKey")}`}>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={PROVIDER_META[apiProvider].hint}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                     placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                />
                {apiKey && <p className="text-xs text-white/40 mt-1">{t("settings.api.currentKey")}: {apiKey.substring(0, 4)}...{apiKey.substring(apiKey.length - 4)}</p>}
                <p className="text-xs text-white/30 mt-1">{t("settings.api.storedLocally", { provider: PROVIDER_META[apiProvider].label })}</p>
                <p className="text-xs text-white/50 mt-1">
                    {t("settings.api.noKey")}{" "}
                    <button onClick={() => openLink(link.signup)} className="text-blue-400 hover:underline">{t("settings.api.signup")}</button>
                    {" → "}
                    <button onClick={() => openLink(link.keys)} className="text-blue-400 hover:underline">{t("settings.api.getKey")}</button>
                </p>
            </Field>

            {/* Models */}
            <Field label={t("settings.api.models")}>
                <div className="space-y-2.5">
                    {([
                        { key: "extraction", value: extractionModel, set: setExtractionModel },
                        { key: "solution", value: solutionModel, set: setSolutionModel },
                        { key: "debugging", value: debuggingModel, set: setDebuggingModel },
                    ] as const).map(({ key, value, set }) => (
                        <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-white/50 w-20 shrink-0">{t(`settings.api.${key}`)}</span>
                            <div className="flex gap-1.5 flex-1">
                                {MODELS[apiProvider].map((m) => (
                                    <Pill key={m.id} active={value === m.id} onClick={() => set(m.id)} small>{m.name}</Pill>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Field>
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
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                     focus:outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
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
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                       placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                    />
                </Field>
            )}
        </div>
    );

    const handleCvUploadSettings = async () => {
        setCvUploadStatus('uploading');
        try {
            const result = await window.electronAPI.uploadCv();
            if (result.canceled) { setCvUploadStatus('idle'); return; }
            if (!result.success) { setCvUploadStatus('error'); return; }
            const p = result.profile as { name?: string; skills?: string[]; achievements?: string } | undefined;
            if (p) {
                if (p.name) setProfileName(p.name);
                if (p.skills) setProfileSkills(p.skills.join(', '));
                if (p.achievements) setProfileExperience(p.achievements);
            }
            setCvFileName(result.fileName || '');
            setCvUploadStatus('done');
            showToast(t("common.success"), "CV processed successfully", "success");
        } catch {
            setCvUploadStatus('error');
        }
    };

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
        <div className="space-y-5">
            {/* Sub-tabs for profile section */}
            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
                {([
                    { id: 'profile' as const, label: '👤 Profile' },
                    { id: 'cv' as const, label: '📄 CV Upload' },
                    { id: 'company' as const, label: '🏢 Company' },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setProfileSubTab(tab.id)}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            profileSubTab === tab.id
                                ? 'bg-white/10 text-white'
                                : 'text-white/40 hover:text-white/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Profile sub-tab */}
            {profileSubTab === 'profile' && (
                <>
                    <Field label={t("settings.profile.name")}>
                        <input
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder={t("settings.profile.namePlaceholder")}
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                             placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </Field>

                    <Field label={t("settings.profile.experience")}>
                        <textarea
                            value={profileExperience}
                            onChange={(e) => setProfileExperience(e.target.value)}
                            placeholder={t("settings.profile.experiencePlaceholder")}
                            rows={4}
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none
                             placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </Field>

                    <Field label={t("settings.profile.skills")}>
                        <input
                            value={profileSkills}
                            onChange={(e) => setProfileSkills(e.target.value)}
                            placeholder={t("settings.profile.skillsPlaceholder")}
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                             placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                        <p className="text-xs text-white/30 mt-1">{t("settings.profile.skillsHint")}</p>
                    </Field>

                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-300">
                            {t("settings.profile.profileHint")}
                        </p>
                    </div>
                </>
            )}

            {/* CV Upload sub-tab */}
            {profileSubTab === 'cv' && (
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center">
                        {cvUploadStatus === 'idle' && (
                            <>
                                <p className="text-3xl mb-2">📄</p>
                                <p className="text-sm text-white/60 mb-3">Upload your CV/Resume (PDF)</p>
                                <button
                                    onClick={handleCvUploadSettings}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white/80 transition-colors"
                                >
                                    Choose File
                                </button>
                            </>
                        )}
                        {cvUploadStatus === 'uploading' && (
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-3xl animate-pulse">⏳</p>
                                <p className="text-sm text-white/60">Processing CV with AI...</p>
                            </div>
                        )}
                        {cvUploadStatus === 'done' && (
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-3xl">✅</p>
                                <p className="text-sm text-white/80 font-medium">{cvFileName}</p>
                                <p className="text-xs text-white/50">Profile fields auto-populated from CV</p>
                                <button
                                    onClick={handleCvUploadSettings}
                                    className="text-xs text-white/40 hover:text-white/60 underline mt-1"
                                >
                                    Upload different file
                                </button>
                            </div>
                        )}
                        {cvUploadStatus === 'error' && (
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-3xl">❌</p>
                                <p className="text-sm text-red-400/80">Upload failed</p>
                                <button
                                    onClick={() => setCvUploadStatus('idle')}
                                    className="text-xs text-white/40 hover:text-white/60 underline"
                                >
                                    Try again
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-300">
                            Your CV is parsed locally and sent to AI for skill extraction. Data stays on your device.
                        </p>
                    </div>
                </div>
            )}

            {/* Company sub-tab */}
            {profileSubTab === 'company' && (
                <div className="space-y-4">
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
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm
                             hover:bg-white/10 disabled:opacity-50 transition-colors"
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
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none
                             placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </Field>
                    <button
                        onClick={handleJobDescSettings}
                        disabled={!jobDescText.trim() || companyStatus === 'parsing'}
                        className="w-full px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg text-sm text-white/80 transition-colors"
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
                [t("settings.shortcuts.resetView"), "Ctrl+R"],
                [t("settings.shortcuts.quit"), "Ctrl+Q"],
                [t("settings.shortcuts.moveWindow"), "Ctrl+Arrows"],
                [t("settings.shortcuts.opacity"), "Ctrl+[ / ]"],
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
                        className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded-lg
                       hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
