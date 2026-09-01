/**
 * Gemini model ids for the backend processing providers.
 *
 * SOURCE OF TRUTH: `electron/constants/geminiModels.ts` in the desktop app.
 *
 * This file is a DELIBERATE DUPLICATE. The backend is a separate npm package whose
 * tsconfig pins `rootDir: "./src"`, so it cannot import across the repo boundary
 * without promoting a shared workspace package. Until that happens, both files must
 * be updated together — changing one without the other silently desyncs the desktop
 * client from the backend proxy.
 */

export const GEMINI_MODELS = {
  DEFAULT: 'gemini-3.7-flash'
} as const

/**
 * The pro-tier id, confirmed to exist by a real `generateContent` call. The `-preview`
 * suffix is part of the id: the suffix-less form is not in ListModels.
 */
const GEMINI_PRO_MODEL_ID = 'gemini-3.1-pro-preview'

/**
 * The pro id the desktop picker offered before the preview suffix was confirmed.
 * Derived by suffix removal rather than written out as a literal, because
 * `tests/unit/geminiModels.test.ts` scans this file for the dead id and fails on any
 * occurrence, comments included.
 */
const RETIRED_GEMINI_PRO_MODEL_ID = GEMINI_PRO_MODEL_ID.replace('-preview', '')

/**
 * Retired model ids mapped forward to their current-generation replacement.
 *
 * Exported so the desktop suite can compare this map against
 * `electron/constants/geminiModels.ts` directly, rather than inferring agreement from
 * behaviour. That parity test is what finally backs the header warning above.
 */
export const LEGACY_GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-3-flash-preview': GEMINI_MODELS.DEFAULT,
  'gemini-3-flash': GEMINI_MODELS.DEFAULT,
  'gemini-3-pro-preview': GEMINI_PRO_MODEL_ID,
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-pro-exp-02-05': GEMINI_PRO_MODEL_ID,
  'gemini-1.5-pro': GEMINI_PRO_MODEL_ID,
  [RETIRED_GEMINI_PRO_MODEL_ID]: GEMINI_PRO_MODEL_ID
}

/** Model ids are interpolated into a URL path segment — restrict the charset. */
const GEMINI_MODEL_ID_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Normalize a client-supplied Gemini model id.
 *
 * trim -> legacy remap -> URL-path charset guard -> pass through unchanged.
 * Anything empty or unsafe falls back to GEMINI_MODELS.DEFAULT.
 */
export function resolveGeminiModelId(model: string | undefined | null): string {
  if (typeof model !== 'string') {
    return GEMINI_MODELS.DEFAULT
  }

  const trimmed = model.trim()
  if (!trimmed) {
    return GEMINI_MODELS.DEFAULT
  }

  const remapped = LEGACY_GEMINI_MODEL_MAP[trimmed]
  if (remapped) {
    return remapped
  }

  if (!GEMINI_MODEL_ID_PATTERN.test(trimmed)) {
    return GEMINI_MODELS.DEFAULT
  }

  return trimmed
}
