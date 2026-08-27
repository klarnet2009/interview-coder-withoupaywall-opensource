/// <reference types="vitest/globals" />

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { GeminiLiveService } from "../../electron/audio/GeminiLiveService"
import { LiveInterviewService } from "../../electron/audio/LiveInterviewService"

interface FakeSocket {
  readyState: number
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
}

function createFakeSocket(): FakeSocket {
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn(),
    removeAllListeners: vi.fn()
  }
}

/**
 * Drives the private setup send and returns the parsed message that reached
 * the socket. The `send` call count is asserted here rather than in each case
 * so that a broken `as unknown as` cast (which neither tsconfig covers - see
 * the plan's verification notes) fails loudly instead of silently yielding
 * `undefined`.
 */
function captureSetupMessage(service: GeminiLiveService, socket: FakeSocket) {
  ;(service as unknown as { ws: FakeSocket }).ws = socket
  ;(service as unknown as { sendSetup: () => void }).sendSetup()

  expect(socket.send).toHaveBeenCalledTimes(1)
  const raw = socket.send.mock.calls[0][0] as string
  expect(typeof raw).toBe("string")

  return JSON.parse(raw) as {
    setup: {
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: boolean
          startOfSpeechSensitivity: string
          endOfSpeechSensitivity: string
          prefixPaddingMs: number
          silenceDurationMs: number
        }
        activityHandling: string
      }
    }
  }
}

describe("GeminiLiveService setup VAD configuration", () => {
  const services: GeminiLiveService[] = []

  function makeService(): GeminiLiveService {
    const service = new GeminiLiveService({ apiKey: "test-key" })
    services.push(service)
    return service
  }

  afterEach(() => {
    // disconnect() clears the debug-stats interval started by the setup send,
    // otherwise vitest hangs on an open handle.
    while (services.length > 0) {
      services.pop()?.disconnect()
    }
    vi.restoreAllMocks()
  })

  it("sends widened VAD windows with sensitivities left at their LOW values", () => {
    const service = makeService()
    const socket = createFakeSocket()

    const parsed = captureSetupMessage(service, socket)
    const vad = parsed.setup.realtimeInputConfig.automaticActivityDetection

    expect(vad.disabled).toBe(false)
    expect(vad.startOfSpeechSensitivity).toBe("START_SENSITIVITY_LOW")
    expect(vad.endOfSpeechSensitivity).toBe("END_SENSITIVITY_LOW")
    expect(vad.prefixPaddingMs).toBe(400)
    expect(vad.silenceDurationMs).toBe(1200)
    expect(parsed.setup.realtimeInputConfig.activityHandling).toBe(
      "NO_INTERRUPTION"
    )
  })

  it("wires the setup message from the named constants", () => {
    const service = makeService()
    const socket = createFakeSocket()

    const parsed = captureSetupMessage(service, socket)
    const vad = parsed.setup.realtimeInputConfig.automaticActivityDetection

    expect(vad.prefixPaddingMs).toBe(GeminiLiveService.VAD_PREFIX_PADDING_MS)
    expect(vad.silenceDurationMs).toBe(GeminiLiveService.VAD_SILENCE_DURATION_MS)
  })

  it("keeps the Live API silence window below the hint-trigger fallback window", () => {
    const hintTriggerSilenceMs = (
      LiveInterviewService as unknown as { HINT_TRIGGER_SILENCE_MS: number }
    ).HINT_TRIGGER_SILENCE_MS

    // Guard the cast itself: a renamed/removed constant must fail here rather
    // than make the invariant assertion below compare against `undefined`.
    expect(typeof hintTriggerSilenceMs).toBe("number")
    expect(hintTriggerSilenceMs).toBeGreaterThan(0)

    expect(GeminiLiveService.VAD_SILENCE_DURATION_MS).toBeLessThan(
      hintTriggerSilenceMs
    )
  })
})
