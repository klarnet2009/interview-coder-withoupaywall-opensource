/**
 * The Ctrl+Q quit state machine.
 *
 * Deliberately free of any `electron` import: every dependency is injected, including
 * the timer pair. That is not ceremony — the three branches worth getting right (a
 * hidden window, a wedged renderer, a second press) are only testable if the guard
 * owns no clock and no window handle of its own.
 *
 * --------------------------------------------------------------------------
 * WHY THE WATCHDOG WAITS FOR AN ACKNOWLEDGEMENT, NOT FOR AN ANSWER
 * --------------------------------------------------------------------------
 *
 * Two simpler designs are both wrong.
 *
 * A watchdog armed for the user's ANSWER re-introduces exactly the session loss this
 * guard exists to prevent: a busy renderer paints the dialog at t=2.9s and the app
 * quits at t=3s while the user is still reading the first line.
 *
 * A watchdog that never fires makes an always-on-top, taskbar-hidden,
 * screen-capture-evading overlay unquittable by its own primary shortcut, sending the
 * user to Task Manager.
 *
 * So the renderer acknowledges the moment its listener fires, and the watchdog is
 * armed for THAT. Ack received -> disarm and wait indefinitely; the user may think for
 * as long as they like. No ack within {@link QUIT_ACK_TIMEOUT_MS} -> the renderer is
 * genuinely not processing events -> quit. This is the only distinction that matters:
 * "renderer is dead" versus "user is thinking".
 *
 * The residual gap, stated plainly: the ack proves the listener ran, not that the
 * dialog painted. A renderer that runs listeners but cannot paint would swallow
 * Ctrl+Q. The second-press escape hatch is the cover for that case, and it also
 * matches what a user does when nothing appears to have happened.
 */

/** Whatever the injected `setTimer` returns. The guard only ever hands it back. */
export type QuitTimerHandle = unknown;

/**
 * How long the renderer has to acknowledge the prompt before the guard concludes it is
 * not processing events at all. Only ever measured against the ACK, never the answer.
 */
export const QUIT_ACK_TIMEOUT_MS = 3000;

export interface QuitGuardDeps {
  /** True when a live, non-destroyed window exists to render the confirmation on. */
  hasWindow: () => boolean;
  /** False after Ctrl+B. Drives the reveal-first branch. */
  isWindowVisible: () => boolean;
  /** Only ever invoked when `isWindowVisible()` is false, so a toggle is unambiguous. */
  revealWindow: () => void;
  /** Sends "quit-requested" to the renderer. */
  sendQuitRequest: () => void;
  /** Terminal. The guard clears its own state before calling this. */
  quit: () => void;
  setTimer: (fn: () => void, ms: number) => QuitTimerHandle;
  clearTimer: (handle: QuitTimerHandle) => void;
}

export interface QuitGuard {
  /** Ctrl+Q. Prompts, or quits at once if already pending or if there is no window. */
  requestQuit: () => void;
  /** The renderer's listener ran. Disarms the watchdog; the wait becomes unbounded. */
  acknowledgePrompt: () => void;
  /** The user said no. */
  cancelQuit: () => void;
  /** The user said yes — or the Settings Quit button, which has its own dialog. */
  confirmQuit: () => void;
  isPending: () => boolean;
}

export function createQuitGuard(deps: QuitGuardDeps): QuitGuard {
  let pending = false;
  let ackTimer: QuitTimerHandle = null;

  const disarmWatchdog = (): void => {
    if (ackTimer !== null) {
      deps.clearTimer(ackTimer);
      ackTimer = null;
    }
  };

  /** Clear state BEFORE quitting, so the guard can never produce a second quit. */
  const quitNow = (): void => {
    disarmWatchdog();
    pending = false;
    deps.quit();
  };

  return {
    requestQuit(): void {
      // Second press while a prompt is outstanding: the user is telling us the
      // confirmation is not reaching them. Believe them.
      if (pending) {
        quitNow();
        return;
      }

      // Nothing to render a confirmation on — asking would be a silent no-op.
      if (!deps.hasWindow()) {
        quitNow();
        return;
      }

      if (!deps.isWindowVisible()) {
        deps.revealWindow();
      }

      deps.sendQuitRequest();
      pending = true;
      ackTimer = deps.setTimer(() => {
        ackTimer = null;
        quitNow();
      }, QUIT_ACK_TIMEOUT_MS);
    },

    acknowledgePrompt(): void {
      // Pending stays set on purpose: the wait for the user's answer is unbounded.
      disarmWatchdog();
    },

    cancelQuit(): void {
      disarmWatchdog();
      pending = false;
    },

    confirmQuit(): void {
      quitNow();
    },

    isPending(): boolean {
      return pending;
    }
  };
}

/*
 * One instance, shared by the shortcut handler that raises the prompt and the IPC
 * handlers that answer it. Module-level rather than passed around because
 * ShortcutsHelper and registerIpcHandlers are constructed independently in main.ts.
 */
let singleton: QuitGuard | null = null;

export function initQuitGuard(deps: QuitGuardDeps): QuitGuard {
  singleton = createQuitGuard(deps);
  return singleton;
}

/**
 * Null until ShortcutsHelper is constructed. IPC handlers can be registered first, so
 * every call site must treat this as optional rather than assuming initialisation.
 */
export function getQuitGuard(): QuitGuard | null {
  return singleton;
}
