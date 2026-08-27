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

/** Retired model ids mapped forward to their current-generation replacement. */
const LEGACY_GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-3-flash-preview': GEMINI_MODELS.DEFAULT,
  'gemini-3-flash': GEMINI_MODELS.DEFAULT,
  'gemini-3-pro-preview': 'gemini-3.1-pro',
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-pro-exp-02-05': 'gemini-3.1-pro',
  'gemini-1.5-pro': 'gemini-3.1-pro'
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
