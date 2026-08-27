/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest"

import {
  AUDIO_LEVEL_UI_INTERVAL_MS,
  AUDIO_LEVEL_UI_THRESHOLD,
  createAudioLevelThrottle
} from "../../src/components/UnifiedPanel/audioLevelThrottle"

const LOUD = 0.2
const QUIET = 0.0

describe("createAudioLevelThrottle", () => {
  it("always accepts the first level a fresh throttle sees", () => {
    const throttle = createAudioLevelThrottle()

    expect(throttle(LOUD, 0)).toBe(true)
  })

  it("rejects a level arriving inside the interval on the same side of the threshold", () => {
    const throttle = createAudioLevelThrottle()

    expect(throttle(LOUD, 0)).toBe(true)
    expect(throttle(LOUD + 0.05, 10)).toBe(false)
    expect(throttle(LOUD + 0.1, 49)).toBe(false)
  })

  it("accepts a level arriving at or after the interval", () => {
    const throttle = createAudioLevelThrottle()

    expect(throttle(LOUD, 0)).toBe(true)
    expect(throttle(LOUD, AUDIO_LEVEL_UI_INTERVAL_MS)).toBe(true)
    expect(throttle(LOUD, AUDIO_LEVEL_UI_INTERVAL_MS + 200)).toBe(true)
  })

  it("accepts an upward threshold crossing immediately - speech onset never waits", () => {
    const throttle = createAudioLevelThrottle()

    expect(throttle(QUIET, 0)).toBe(true)
    // 1ms later, well inside the interval, but the level crossed 0.01 upward.
    expect(throttle(AUDIO_LEVEL_UI_THRESHOLD + 0.001, 1)).toBe(true)
  })

  it("accepts a downward threshold crossing immediately - the no-audio affordance must not linger", () => {
    const throttle = createAudioLevelThrottle()

    expect(throttle(LOUD, 0)).toBe(true)
    expect(throttle(QUIET, 1)).toBe(true)
  })

  it("accepts 17 of 33 frames across one simulated second at 33Hz", () => {
    const throttle = createAudioLevelThrottle()

    let accepted = 0
    for (let i = 0; i < 33; i++) {
      if (throttle(LOUD, i * 30)) {
        accepted++
      }
    }

    // Accepts land at t = 0, 60, 120 ... 960.
    expect(accepted).toBeGreaterThanOrEqual(16)
    expect(accepted).toBeLessThanOrEqual(18)
  })

  it("does not burst after an idle gap", () => {
    const throttle = createAudioLevelThrottle()

    // Prime, then jump 5 seconds - as if capture were paused or the renderer
    // backgrounded - and resume the 33Hz stream.
    expect(throttle(LOUD, 0)).toBe(true)

    let accepted = 0
    for (let i = 0; i < 33; i++) {
      if (throttle(LOUD, 5000 + i * 30)) {
        accepted++
      }
    }

    // A catch-up accumulator (`lastAccepted += intervalMs`) returns 33 here.
    expect(accepted).toBeGreaterThanOrEqual(16)
    expect(accepted).toBeLessThanOrEqual(18)
  })

  it("keeps instances independent", () => {
    const first = createAudioLevelThrottle()
    const second = createAudioLevelThrottle()

    expect(first(LOUD, 0)).toBe(true)
    expect(first(LOUD, 10)).toBe(false)

    // A separate instance has its own unset state, so this must still pass.
    expect(second(LOUD, 10)).toBe(true)
    expect(second(LOUD, 20)).toBe(false)

    // And the first instance's own gate is unaffected by the second.
    expect(first(LOUD, 60)).toBe(true)
  })
})
