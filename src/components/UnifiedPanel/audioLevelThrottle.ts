/**
 * Decides when a newly measured audio level is allowed to reach React state.
 *
 * The capture worklet posts a frame roughly every 30ms (~33Hz). Calling
 * `setState` on every frame re-renders the panel tree at that rate for a value
 * that drives one small meter, so level updates are spaced out here. The audio
 * itself is never throttled - every frame still reaches the main process.
 *
 * Kept as a dependency-free module rather than living inside `useAudioCapture`
 * so the rule is testable under the repo's `node` vitest environment, which
 * has no `AudioContext`, `AudioWorkletNode` or `navigator.mediaDevices`.
 */

/**
 * Minimum spacing between accepted level updates.
 *
 * This is a floor on the gap, not a fixed rate: against the worklet's ~33Hz
 * frame stream it accepts at t = 0, 60, 120 ... i.e. ~17 of every 33 frames.
 * Describing it as "20Hz" would be wrong.
 */
export const AUDIO_LEVEL_UI_INTERVAL_MS = 50

/**
 * The level at which the UI switches between its "receiving audio" and "no
 * audio" affordances.
 *
 * The same number is compared against at four call sites:
 *   - `UnifiedPanel.tsx` (the `localAudioLevel > 0.01` meter branch)
 *   - `AudioSourceSelector.tsx` (three branches: the capture indicator, the
 *     active-level badge, and its `<= 0.01` counterpart)
 *
 * A crossing of this threshold bypasses the interval gate entirely, so speech
 * onset is never held back. If this value changes, those call sites must move
 * with it.
 */
export const AUDIO_LEVEL_UI_THRESHOLD = 0.01

export interface AudioLevelThrottleOptions {
  /** Minimum milliseconds between accepted updates. */
  intervalMs?: number
  /** Visibility threshold whose crossing forces an immediate accept. */
  threshold?: number
}

export type AudioLevelThrottle = (level: number, nowMs: number) => boolean

/**
 * Creates an independent throttle. All state lives in the returned closure, so
 * two instances never share timestamps.
 */
export function createAudioLevelThrottle(
  options: AudioLevelThrottleOptions = {}
): AudioLevelThrottle {
  const intervalMs = options.intervalMs ?? AUDIO_LEVEL_UI_INTERVAL_MS
  const threshold = options.threshold ?? AUDIO_LEVEL_UI_THRESHOLD

  let hasAccepted = false
  let lastAcceptedLevel = 0
  let lastAcceptedAt = 0

  return (level: number, nowMs: number): boolean => {
    const crossedThreshold =
      hasAccepted && level > threshold !== lastAcceptedLevel > threshold

    const accept =
      !hasAccepted || crossedThreshold || nowMs - lastAcceptedAt >= intervalMs

    if (!accept) {
      return false
    }

    hasAccepted = true
    lastAcceptedLevel = level
    // Floor gate: store the observed clock, never `lastAcceptedAt += intervalMs`.
    // The accumulator form lags the clock after any idle gap (capture paused,
    // source switched, renderer backgrounded) and then lets every call through
    // until it catches up - an unthrottled burst of renders, which is the exact
    // failure this throttle exists to prevent.
    lastAcceptedAt = nowMs
    return true
  }
}
