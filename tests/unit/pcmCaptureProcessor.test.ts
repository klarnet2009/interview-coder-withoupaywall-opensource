/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it } from "vitest"

const WORKLET_PATH = path.resolve(
  __dirname,
  "../../public/pcm-capture-processor.js"
)

const FRAME_SIZE = 480
const FRAME_BYTES = FRAME_SIZE * 2
const QUANTUM = 128

interface PostedFrame {
  pcmBuffer: ArrayBuffer
  level: number
}

interface WorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean
}

interface Harness {
  processor: WorkletProcessor
  posted: PostedFrame[]
  transfers: (ArrayBuffer[] | undefined)[]
}

/**
 * The worklet is plain AudioWorklet-scope JavaScript with no module system, so
 * it is loaded into a `node:vm` context that supplies the three globals it is
 * allowed to touch. Cross-realm ArrayBuffers posted through the fake port view
 * fine from this realm with a plain `new Int16Array(buf)`.
 */
function createHarness(inputSampleRate: number): Harness {
  const source = readFileSync(WORKLET_PATH, "utf8")
  const posted: PostedFrame[] = []
  const transfers: (ArrayBuffer[] | undefined)[] = []
  let captured: unknown = null

  class FakeAudioWorkletProcessor {
    port = {
      postMessage(message: PostedFrame, transfer?: ArrayBuffer[]) {
        // The real port takes ownership via the transfer list; the harness
        // records it so the zero-copy form can be asserted.
        transfers.push(transfer)
        posted.push(message)
      }
    }
  }

  const sandbox = {
    AudioWorkletProcessor: FakeAudioWorkletProcessor,
    registerProcessor: (_name: string, ctor: unknown) => {
      captured = ctor
    },
    sampleRate: inputSampleRate,
    Math
  }

  const context = vm.createContext(sandbox)
  vm.runInContext(source, context, { filename: WORKLET_PATH })

  expect(typeof captured).toBe("function")

  const Ctor = captured as new (options: {
    processorOptions: { inputSampleRate: number }
  }) => WorkletProcessor

  const processor = new Ctor({ processorOptions: { inputSampleRate } })

  return { processor, posted, transfers }
}

/**
 * Feeds `quantaCount` render quanta of 128 samples, built by a generator
 * called with the absolute sample index.
 */
function feed(
  processor: WorkletProcessor,
  quantaCount: number,
  generator: (absoluteIndex: number) => number
): Float32Array[] {
  const chunks: Float32Array[] = []
  for (let q = 0; q < quantaCount; q++) {
    const chunk = new Float32Array(QUANTUM)
    for (let i = 0; i < QUANTUM; i++) {
      chunk[i] = generator(q * QUANTUM + i)
    }
    chunks.push(chunk)
    processor.process([[chunk]], [], {})
  }
  return chunks
}

function quantize(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample))
  const raw = s < 0 ? s * 0x8000 : s * 0x7fff
  // Int16Array assignment truncates toward zero.
  return raw < 0 ? Math.ceil(raw) : Math.floor(raw)
}

function rms(values: Int16Array): number {
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i] / 0x7fff
    sum += v * v
  }
  return Math.sqrt(sum / values.length)
}

describe("pcm-capture-processor frame buffering", () => {
  it("posts exactly three 960-byte frames for 36 quanta at 48kHz", () => {
    const { processor, posted, transfers } = createHarness(48000)

    feed(processor, 36, (i) => Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.4)

    expect(posted).toHaveLength(3)
    for (const frame of posted) {
      expect(frame.pcmBuffer.byteLength).toBe(FRAME_BYTES)
    }

    // Each frame is handed over in the zero-copy transfer form.
    expect(transfers).toHaveLength(3)
    transfers.forEach((transfer, i) => {
      expect(transfer).toEqual([posted[i].pcmBuffer])
    })
  })

  it("posts exactly three 960-byte frames for 12 quanta at 16kHz", () => {
    const { processor, posted } = createHarness(16000)

    feed(processor, 12, (i) => Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.4)

    expect(posted).toHaveLength(3)
    for (const frame of posted) {
      expect(frame.pcmBuffer.byteLength).toBe(FRAME_BYTES)
    }
  })

  it("leaves the 16kHz microphone path bit-exact - no filter, no resample", () => {
    const { processor, posted } = createHarness(16000)

    // Deterministic non-trivial ramp with both signs and a nonlinear component.
    const chunks = feed(processor, 12, (i) => {
      const t = (i % 997) / 997
      return (t * 2 - 1) * 0.83 + Math.sin(i / 13) * 0.1
    })

    const expected: number[] = []
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        expected.push(quantize(chunk[i]))
      }
    }

    const actual: number[] = []
    for (const frame of posted) {
      const view = new Int16Array(frame.pcmBuffer)
      for (let i = 0; i < view.length; i++) {
        actual.push(view[i])
      }
    }

    expect(actual).toHaveLength(3 * FRAME_SIZE)
    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(expected[i])
    }
  })
})

describe("pcm-capture-processor anti-aliasing", () => {
  function meanLevelAt(frequencyHz: number): number {
    const { processor, posted } = createHarness(48000)

    feed(
      processor,
      80,
      (i) => Math.sin((2 * Math.PI * frequencyHz * i) / 48000) * 0.5
    )

    expect(posted.length).toBeGreaterThanOrEqual(6)

    // Discard the first frame so the IIR state has settled.
    const levels = posted.slice(1).map((frame) => frame.level)
    return levels.reduce((a, b) => a + b, 0) / levels.length
  }

  it("attenuates 12kHz far below 1kHz instead of folding it into the speech band", () => {
    const loud = meanLevelAt(1000)
    const aliasing = meanLevelAt(12000)

    // 0.5 amplitude implies an unattenuated RMS near 0.354.
    expect(loud).toBeGreaterThan(0.3)
    expect(aliasing).toBeLessThan(0.35 * loud)
  })
})

describe("pcm-capture-processor per-frame level", () => {
  it("reports the RMS of the frame actually posted, not a stale cached value", () => {
    const { processor, posted } = createHarness(16000)

    // Three loud frames, then three quiet ones.
    const loudSamples = 3 * FRAME_SIZE
    feed(processor, 24, (i) =>
      i < loudSamples
        ? Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.6
        : Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.02
    )

    expect(posted.length).toBeGreaterThanOrEqual(6)

    for (const frame of posted) {
      expect(Number.isFinite(frame.level)).toBe(true)
      expect(frame.level).toBeGreaterThanOrEqual(0)
      expect(frame.level).toBeLessThanOrEqual(1)
    }

    const loudLevels = posted.slice(0, 3).map((f) => f.level)
    const quietLevels = posted.slice(3, 6).map((f) => f.level)

    for (const loud of loudLevels) {
      for (const quiet of quietLevels) {
        expect(loud).toBeGreaterThan(quiet * 5)
      }
    }

    // The level must track the frame contents, not repeat a cached value
    // across frames of differing content.
    expect(loudLevels[0]).not.toBe(quietLevels[0])

    // Each posted level matches the RMS of that exact frame's samples.
    for (const frame of posted) {
      expect(frame.level).toBeCloseTo(rms(new Int16Array(frame.pcmBuffer)), 3)
    }
  })
})

describe("pcm-capture-processor scope", () => {
  it("references no global beyond the AudioWorklet scope", () => {
    const source = readFileSync(WORKLET_PATH, "utf8")

    expect(source).not.toMatch(/\brequire\s*\(/)
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bdocument\./)
    expect(source).not.toMatch(/\bwindow\./)
    expect(source).toContain("registerProcessor('pcm-capture-processor'")
  })
})
