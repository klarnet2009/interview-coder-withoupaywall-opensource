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
 * The pro-tier id, confirmed to exist by a real `generateContent` call.
 *
 * The `-preview` suffix is part of the id, not decoration — the suffix-less form is not
 * in ListModels and fails at the first request. Named here because the picker entry, the
 * legacy remap targets and the retired-id derivation below all have to agree on it.
 */
const GEMINI_PRO_MODEL_ID = "gemini-3.1-pro-preview";

/**
 * Models offered in the Settings model picker.
 * Call sites append their own "Custom Model..." affordance where they support one.
 */
export const GEMINI_SELECTABLE_MODELS = [
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
  /*
   * "(Preview)" is information, not styling: this value is persisted to config.json and
   * used for months, so the user is entitled to know the id has a retirement date.
   * Model names here are product proper nouns and are deliberately not routed through i18n.
   */
  { id: GEMINI_PRO_MODEL_ID, name: "Gemini 3.1 Pro (Preview)" }
] as const;

/** Derived from GEMINI_SELECTABLE_MODELS — never hand-write this list. */
export const GEMINI_MODEL_IDS: readonly string[] = GEMINI_SELECTABLE_MODELS.map(
  (model) => model.id
);

/**
 * The pro id this picker offered before the preview suffix was confirmed. It does not
 * exist on the API, so anyone who has already chosen Pro from Settings is carrying a
 * dead id in config.json right now; the map entry below is what rescues them.
 *
 * Derived by suffix removal rather than written out as a literal, and that is
 * load-bearing: `tests/unit/geminiModels.test.ts` scans every .ts/.tsx under
 * `electron/`, `src/` and `backend/src/` and fails on any occurrence of the dead id,
 * comments included. Writing it out — even to explain this entry — breaks the gate.
 */
const RETIRED_GEMINI_PRO_MODEL_ID = GEMINI_PRO_MODEL_ID.replace("-preview", "");

/**
 * Retired model ids mapped forward to their current-generation replacement.
 * This is the ONLY place retired ids are allowed to appear.
 *
 * INVARIANT, enforced by test: every value here must be a member of
 * {@link GEMINI_MODEL_IDS} or of {@link GEMINI_MODELS}. A remap target that nothing else
 * in the app vouches for is how the migration path itself walks users onto a dead id.
 */
export const LEGACY_GEMINI_MODEL_MAP: Record<string, string> = {
  "gemini-3-flash-preview": GEMINI_MODELS.DEFAULT,
  "gemini-3-flash": GEMINI_MODELS.DEFAULT,
  "gemini-3-pro-preview": GEMINI_PRO_MODEL_ID,
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-pro-exp-02-05": GEMINI_PRO_MODEL_ID,
  "gemini-1.5-pro": GEMINI_PRO_MODEL_ID,
  [RETIRED_GEMINI_PRO_MODEL_ID]: GEMINI_PRO_MODEL_ID
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
