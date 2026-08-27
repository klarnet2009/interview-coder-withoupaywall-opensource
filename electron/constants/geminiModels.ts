/**
 * Single source of truth for every Gemini model id used by the desktop app.
 *
 * This module is imported by BOTH the Electron main process and the renderer,
 * so it must stay pure data + pure functions: no `electron` imports, no node
 * builtins, no imports at all. It lives under `electron/` (not `src/`) because
 * `tsconfig.electron.json` has no explicit `rootDir` — if an electron file
 * imported from `src/`, the inferred common root would move to the repo root
 * and every emit would shift to `dist-electron/electron/main.js`, breaking the
 * `main` entry declared in package.json.
 *
 * The backend (`backend/src/processing/providers/gemini.models.ts`) mirrors the
 * subset it needs, because `backend/` is a separate package with `rootDir: "./src"`.
 * Keep the two in sync.
 */

/**
 * Gemini model ids by role.
 *
 * Every role except LIVE targets the `generateContent` REST family.
 */
export const GEMINI_MODELS = {
  DEFAULT: "gemini-3.7-flash",
  EXTRACTION: "gemini-3.7-flash",
  SOLUTION: "gemini-3.7-flash",
  DEBUG: "gemini-3.7-flash",
  HINT: "gemini-3.7-flash",
  AUDIO: "gemini-3.7-flash",
  /** CV/JD parsing is long-input structured extraction — 3.6 Flash is the better fit. */
  PROFILE: "gemini-3.6-flash",
  /*
   * LIVE targets the BidiGenerateContent websocket (Live API), NOT `generateContent`.
   * The Live API accepts a narrower, separately-versioned model family: dropping any
   * of the generateContent ids above into this slot will break the socket connection.
   * They are NOT interchangeable.
   *
   * Before editing this value, check the current Live API model list at
   * https://ai.google.dev/gemini-api/docs/live
   */
  LIVE: "gemini-2.5-flash-native-audio-preview-12-2025"
} as const;

/**
 * Models offered in the Settings model picker.
 * Call sites append their own "Custom Model..." affordance where they support one.
 */
export const GEMINI_SELECTABLE_MODELS = [
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" }
] as const;

/** Derived from GEMINI_SELECTABLE_MODELS — never hand-write this list. */
export const GEMINI_MODEL_IDS: readonly string[] = GEMINI_SELECTABLE_MODELS.map(
  (model) => model.id
);

/**
 * Retired model ids mapped forward to their current-generation replacement.
 * This is the ONLY place retired ids are allowed to appear.
 */
export const LEGACY_GEMINI_MODEL_MAP: Record<string, string> = {
  "gemini-3-flash-preview": GEMINI_MODELS.DEFAULT,
  "gemini-3-flash": GEMINI_MODELS.DEFAULT,
  "gemini-3-pro-preview": "gemini-3.1-pro",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-pro-exp-02-05": "gemini-3.1-pro",
  "gemini-1.5-pro": "gemini-3.1-pro"
};

/** Model ids are interpolated into a URL path segment — restrict the charset. */
const GEMINI_MODEL_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Membership test against the picker list. For UI hinting only — unknown ids are
 * still valid (the Custom Model feature depends on that).
 */
export function isKnownGeminiModel(id: string): boolean {
  return GEMINI_MODEL_IDS.includes(id);
}

/**
 * Normalize a Gemini model id coming from persisted config or user input.
 *
 * trim -> legacy remap -> URL-path charset guard -> pass through unchanged.
 * Anything empty or unsafe falls back to {@link GEMINI_MODELS.DEFAULT}.
 */
export function resolveGeminiModelId(model: string | undefined | null): string {
  if (typeof model !== "string") {
    return GEMINI_MODELS.DEFAULT;
  }

  const trimmed = model.trim();
  if (!trimmed) {
    return GEMINI_MODELS.DEFAULT;
  }

  const remapped = LEGACY_GEMINI_MODEL_MAP[trimmed];
  if (remapped) {
    return remapped;
  }

  if (!GEMINI_MODEL_ID_PATTERN.test(trimmed)) {
    return GEMINI_MODELS.DEFAULT;
  }

  return trimmed;
}
