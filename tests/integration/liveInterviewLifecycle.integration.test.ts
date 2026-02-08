/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { GeminiLiveService } from "../../electron/audio/GeminiLiveService"
import { HintGenerationService } from "../../electron/audio/HintGenerationService"
import { LiveInterviewService } from "../../electron/audio/LiveInterviewService"

describe("LiveInterviewService lifecycle integration", () => {
  beforeEach(() => {
    vi.useFakeTimers()

    vi.spyOn(GeminiLiveService.prototype, "connect").mockImplementation(
      async function (this: GeminiLiveService): Promise<void> {
        ;(this as unknown as { isConnected: boolean }).isConnected = true
      }
    )

    vi.spyOn(GeminiLiveService.prototype, "disconnect").mockImplementation(
      function (this: GeminiLiveService): void {
        ;(this as unknown as { isConnected: boolean }).isConnected = false
      }
    )

    vi.spyOn(GeminiLiveService.prototype, "isActive").mockReturnValue(true)
    vi.spyOn(GeminiLiveService.prototype, "sendAudio").mockImplementation(() => {})
    vi.spyOn(GeminiLiveService.prototype, "endTurn").mockImplementation(() => {})
    vi.spyOn(GeminiLiveService.prototype, "clearTranscript").mockImplementation(
      () => {}
    )

    vi.spyOn(HintGenerationService.prototype, "generateHint").mockResolvedValue(
      undefined
    )
    vi.spyOn(HintGenerationService.prototype, "deleteCache").mockResolvedValue(
      undefined
    )
    vi.spyOn(HintGenerationService.prototype, "abort").mockImplementation(() => {})
    vi.spyOn(HintGenerationService.prototype, "clearHistory").mockImplementation(
      () => {}
    )
    vi.spyOn(HintGenerationService.prototype, "isActive").mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("starts and stops with expected state transitions", async () => {
    const service = new LiveInterviewService({ apiKey: "test-key" })
    const transitions: string[] = []

    service.on("stateChange", (state: string) => {
      transitions.push(state)
    })

    await service.start()
    expect(transitions).toContain("connecting")
    expect(service.getStatus().state).toBe("listening")
    expect(service.isActive()).toBe(true)

    await service.stop()
    expect(service.getStatus().state).toBe("idle")
    expect(service.isActive()).toBe(false)
    expect(GeminiLiveService.prototype.disconnect).toHaveBeenCalled()
    expect(HintGenerationService.prototype.deleteCache).toHaveBeenCalled()
  })

  it("supports recovery after disconnect and can restart", async () => {
    const service = new LiveInterviewService({ apiKey: "test-key" })

    await service.start()
    service.geminiService?.emit("disconnected")

    expect(service.getStatus().state).toBe("error")

    await service.stop()
    await service.start()

    expect(service.getStatus().state).toBe("listening")
  })

  it("forces endTurn after local silence to avoid stuck turns", async () => {
    const service = new LiveInterviewService({ apiKey: "test-key" })
    await service.start()

    const endTurnSpy = vi.spyOn(service.geminiService!, "endTurn")

    const chunk = Buffer.from("pcm").toString("base64")
    service.receiveAudio(chunk, 0.2)
    service.receiveAudio(chunk, 0.0)

    vi.advanceTimersByTime(1000)

    expect(endTurnSpy).toHaveBeenCalled()
  })
})
