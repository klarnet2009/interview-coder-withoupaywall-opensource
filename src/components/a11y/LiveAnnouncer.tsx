import React from "react"

interface LiveAnnouncerProps {
  message: string
}

/**
 * The single announcement channel for the app.
 *
 * Politeness is deliberate and must not be raised. The screen reader is the
 * user's only audio channel and they are simultaneously listening to a human
 * interviewer; interrupting the reader mid-utterance is quite likely to talk
 * over the AI hint the user is in the middle of consuming. Every state this
 * app can enter is recoverable and is also rendered visibly with an action
 * banner, so a one-second queue delay is the better trade here.
 *
 * The region is always mounted, even with nothing to say: a region that
 * appears at the same moment as its first text is usually missed entirely.
 *
 * By convention this is the only file in `src` carrying a live-region
 * attribute, so that no other node can start narrating on its own.
 */
export const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({ message }) => (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    {message}
  </div>
)
