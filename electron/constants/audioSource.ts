/**
 * Single source of truth for the audio-source union used by the desktop app.
 *
 * This module is imported by BOTH the Electron main process and the renderer, so it
 * must stay pure data + pure functions: no `electron` imports, no node builtins, no
 * imports at all. It lives under `electron/` (not `src/`) for the same reason
 * `geminiModels.ts` does — `tsconfig.electron.json` has no explicit `rootDir`, so an
 * import from `src/` would move the inferred common root to the repo root and shift
 * every emit to `dist-electron/electron/main.js`, breaking the `main` entry declared
 * in package.json.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO PER-APPLICATION MEMBER, AND WHY ADDING ONE BACK IS A DEFECT
 * ---------------------------------------------------------------------------
 *
 * The app used to offer "capture audio from this window". It did not do that.
 *
 * Chromium does not implement per-window audio capture on Windows
 * (electron/electron#18231, open since 2019 and closed without a fix).
 * `getUserMedia` with `chromeMediaSource: "desktop"` ignores the window id for the
 * audio track and returns whole-system loopback — and it still hands back a valid
 * audio track, so nothing errors and nothing warns. The control looked live, named a
 * single application, and shipped the entire desktop.
 *
 * That is what made this a privacy defect rather than a quality bug. This app runs
 * during job interviews. The extra audio is the user's other calls, their
 * notifications, their music, and anyone else in the room — streamed to Google's Live
 * API by someone who believed they had selected Zoom.
 *
 * A real per-process capture needs the Windows Process Loopback API
 * (`ActivateAudioInterfaceAsync` with `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`,
 * Windows 10 build 20348+) reached through a native addon or a helper process.
 * Adding a per-application member back to this union WITHOUT that native path
 * re-introduces the misrepresentation in full. Do not do it from good intentions.
 *
 * The cost of the removal is real and was accepted knowingly, not waved away: the
 * removed path acquired silently via `getUserMedia`, whereas System Audio acquires via
 * `getDisplayMedia`, which raises the Windows share picker every session and fails
 * with "No audio track detected. Enable audio sharing and try again." if the user does
 * not tick the audio box. Same bytes, different acquisition. A prompting path that
 * captures what it says beats a silent path that captures more than it says.
 */

/**
 * Every audio source the shipped capture path offers.
 *
 * `system` goes through `getDisplayMedia` (whole desktop, share picker per session).
 * `microphone` goes through `getUserMedia` (the user's own voice).
 * Both do exactly what their label says on Windows.
 */
export const AUDIO_SOURCE_IDS = ["system", "microphone"] as const;

/** The audio-source union. Declared here once; never re-declare it at a call site. */
export type AudioSource = (typeof AUDIO_SOURCE_IDS)[number];

/** The source used whenever a persisted or user-supplied value cannot be trusted. */
export const DEFAULT_AUDIO_SOURCE: AudioSource = "system";

/**
 * Coerce an arbitrary persisted or user-supplied value to a supported audio source.
 *
 * A config.json still holding the removed per-application value resolves to system
 * audio, which is the content that path was already delivering. Anything unknown,
 * absent or wrongly typed also resolves to system rather than being left pointing at
 * an option the app no longer offers.
 */
export function normalizeAudioSource(value: unknown): AudioSource {
  return (AUDIO_SOURCE_IDS as readonly string[]).includes(value as string)
    ? (value as AudioSource)
    : DEFAULT_AUDIO_SOURCE;
}
