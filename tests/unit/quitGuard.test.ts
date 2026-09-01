/**
 * The Ctrl+Q quit guard.
 *
 * This file lives in tests/unit/, NOT in electron/: `tsconfig.electron.json` includes
 * `electron/**\/*` and would typecheck and emit a test placed there into dist-electron.
 *
 * Every dependency of the guard is injected — including the timer pair — precisely so
 * the three interesting branches can be exercised without an Electron runtime. A
 * guard tested only through "does it call quit" would be a vacuous gate; the cases
 * that matter are the hidden window, the renderer that never answers, and the
 * difference between a renderer that is dead and a user who is thinking.
 */
/// <reference types="vitest/globals" />

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUIT_ACK_TIMEOUT_MS,
  createQuitGuard,
  type QuitGuardDeps
} from "../../electron/quitGuard";

/** A hand-rolled timer queue. The guard owns no real clock, so neither does this test. */
function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const scheduled = new Map<number, { at: number; fn: () => void }>();

  return {
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      scheduled.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (handle: unknown) => {
      scheduled.delete(handle as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, entry] of [...scheduled.entries()]) {
        if (entry.at <= now) {
          scheduled.delete(id);
          entry.fn();
        }
      }
    },
    pending: () => scheduled.size
  };
}

function harness(overrides: Partial<QuitGuardDeps> = {}) {
  const clock = createFakeClock();
  const calls = {
    revealWindow: vi.fn(),
    sendQuitRequest: vi.fn(),
    quit: vi.fn()
  };
  const deps: QuitGuardDeps = {
    hasWindow: () => true,
    isWindowVisible: () => true,
    revealWindow: calls.revealWindow,
    sendQuitRequest: calls.sendQuitRequest,
    quit: calls.quit,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...overrides
  };
  return { guard: createQuitGuard(deps), clock, ...calls };
}

describe("requestQuit", () => {
  it("quits at once when there is no window to render a confirmation on", () => {
    const { guard, quit, sendQuitRequest } = harness({ hasWindow: () => false });

    guard.requestQuit();

    expect(quit).toHaveBeenCalledTimes(1);
    expect(sendQuitRequest).not.toHaveBeenCalled();
  });

  it("reveals a hidden window before asking, so the prompt is never off-screen", () => {
    // Ctrl+B hides the window. Without this branch the confirmation would render to a
    // screen the user cannot see, and Ctrl+Q would appear to do nothing at all.
    const { guard, revealWindow, sendQuitRequest, quit } = harness({
      isWindowVisible: () => false
    });

    guard.requestQuit();

    expect(revealWindow).toHaveBeenCalledTimes(1);
    expect(sendQuitRequest).toHaveBeenCalledTimes(1);
    expect(revealWindow.mock.invocationCallOrder[0]).toBeLessThan(
      sendQuitRequest.mock.invocationCallOrder[0]
    );
    expect(quit).not.toHaveBeenCalled();
  });

  it("leaves a visible window alone and just asks", () => {
    const { guard, revealWindow, sendQuitRequest, quit } = harness();

    guard.requestQuit();

    expect(revealWindow).not.toHaveBeenCalled();
    expect(sendQuitRequest).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();
  });

  it("reports itself pending once a prompt is outstanding", () => {
    const { guard } = harness();
    expect(guard.isPending()).toBe(false);
    guard.requestQuit();
    expect(guard.isPending()).toBe(true);
  });
});

describe("the acknowledgement watchdog", () => {
  it("quits anyway when the renderer never acknowledges", () => {
    // An always-on-top, taskbar-hidden overlay must never become unquittable by its
    // own primary shortcut just because the renderer wedged.
    const { guard, clock, quit } = harness();

    guard.requestQuit();
    expect(quit).not.toHaveBeenCalled();

    clock.advance(QUIT_ACK_TIMEOUT_MS);

    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("waits without any deadline once the renderer acknowledges", () => {
    // The watchdog discriminates "renderer is dead" from "user is thinking". A user
    // who is merely reading the dialog must never be timed out.
    const { guard, clock, quit } = harness();

    guard.requestQuit();
    guard.acknowledgePrompt();
    clock.advance(QUIT_ACK_TIMEOUT_MS * 10);

    expect(quit).not.toHaveBeenCalled();
    expect(guard.isPending()).toBe(true);
  });

  it("disarms the watchdog on acknowledgement rather than merely ignoring it", () => {
    const { guard, clock } = harness();

    guard.requestQuit();
    expect(clock.pending()).toBe(1);
    guard.acknowledgePrompt();
    expect(clock.pending()).toBe(0);
  });
});

describe("cancelQuit", () => {
  it("leaves the app running and clears the pending state", () => {
    const { guard, clock, quit } = harness();

    guard.requestQuit();
    guard.acknowledgePrompt();
    guard.cancelQuit();

    expect(quit).not.toHaveBeenCalled();
    expect(guard.isPending()).toBe(false);

    clock.advance(QUIT_ACK_TIMEOUT_MS * 10);
    expect(quit).not.toHaveBeenCalled();
  });

  it("lets a later Ctrl+Q prompt again with a fresh watchdog", () => {
    const { guard, clock, quit, sendQuitRequest } = harness();

    guard.requestQuit();
    guard.acknowledgePrompt();
    guard.cancelQuit();

    guard.requestQuit();
    expect(sendQuitRequest).toHaveBeenCalledTimes(2);
    expect(quit).not.toHaveBeenCalled();

    clock.advance(QUIT_ACK_TIMEOUT_MS);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});

describe("the second-press escape hatch", () => {
  it("quits immediately on a second press while a prompt is pending", () => {
    // Covers the residual gap in the ack design: the ack proves the listener ran, not
    // that the dialog painted. A user who sees nothing happen presses again.
    const { guard, quit } = harness();

    guard.requestQuit();
    guard.requestQuit();

    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("quits immediately on a second press even after the first was acknowledged", () => {
    const { guard, quit } = harness();

    guard.requestQuit();
    guard.acknowledgePrompt();
    guard.requestQuit();

    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("does not double-quit when the watchdog would also have fired", () => {
    const { guard, clock, quit } = harness();

    guard.requestQuit();
    guard.requestQuit();
    clock.advance(QUIT_ACK_TIMEOUT_MS * 10);

    expect(quit).toHaveBeenCalledTimes(1);
  });
});

describe("confirmQuit", () => {
  it("quits exactly once and leaves no watchdog armed", () => {
    const { guard, clock, quit } = harness();

    guard.requestQuit();
    guard.acknowledgePrompt();
    guard.confirmQuit();

    expect(quit).toHaveBeenCalledTimes(1);
    expect(guard.isPending()).toBe(false);
    expect(clock.pending()).toBe(0);

    clock.advance(QUIT_ACK_TIMEOUT_MS * 10);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("still quits when invoked without a pending prompt, as the Settings button does", () => {
    // The Settings Quit button already has its own confirmation, so it arrives here
    // with nothing pending. Both paths must converge on one terminal call.
    const { guard, quit } = harness();

    guard.confirmQuit();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});

describe("the module-level singleton", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("hands the same instance to the shortcut helper and the IPC handlers", async () => {
    const mod = await import("../../electron/quitGuard");
    const clock = createFakeClock();
    const created = mod.initQuitGuard({
      hasWindow: () => true,
      isWindowVisible: () => true,
      revealWindow: vi.fn(),
      sendQuitRequest: vi.fn(),
      quit: vi.fn(),
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    expect(mod.getQuitGuard()).toBe(created);
  });

  it("reports no guard before initialisation, so handlers can call it optionally", async () => {
    const mod = await import("../../electron/quitGuard");
    expect(mod.getQuitGuard()).toBeNull();
  });
});
