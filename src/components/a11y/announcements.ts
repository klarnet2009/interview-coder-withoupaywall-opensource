import { useEffect, useRef, useState } from "react"

/**
 * Returns the part of `next` that has not been announced yet.
 *
 * This mirrors `getUnprocessedTranscriptDelta` in
 * `electron/audio/LiveInterviewService.ts`, which runs the same prefix-delta
 * algorithm over the same transcript stream in the main process. The branches
 * are deliberately identical, including the empty-`previous` case that returns
 * the whole current transcript: two divergent notions of "what is new in this
 * transcript" operating on one stream would be a bug waiting to happen.
 *
 * A non-prefix `next` means a correction or a session reset, so the whole
 * string is returned rather than a nonsensical slice.
 */
export function announcementDelta(previous: string, next: string): string {
  if (!next) return ""
  if (!previous) return next
  if (next.startsWith(previous)) {
    return next.slice(previous.length)
  }
  return next
}

/**
 * Holds a copy of `value` that only updates once `value` has stopped changing
 * for `delayMs`.
 *
 * The live status stream fires per partial-transcription update, which is far
 * faster than anyone can listen. Settling turns that stream into one emission
 * per natural speech pause — which is also the first moment a partial
 * transcript means anything.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState<T>(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setSettled(value)
    }, delayMs)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, delayMs])

  return settled
}
