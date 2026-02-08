import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject
} from "react"
import type { AudioSourceType } from "./types"

interface UseAudioCaptureParams {
  isActiveRef: MutableRefObject<boolean>
}

interface UseAudioCaptureResult {
  localAudioLevel: number
  startAudioCapture: (
    source: AudioSourceType,
    appSourceId?: string
  ) => Promise<void>
  stopAudioCapture: () => void
}

export function useAudioCapture({
  isActiveRef
}: UseAudioCaptureParams): UseAudioCaptureResult {
  const [localAudioLevel, setLocalAudioLevel] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<AudioWorkletNode | null>(null)

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    setLocalAudioLevel(0)
  }, [])

  const startAudioCapture = useCallback(
    async (source: AudioSourceType, appSourceId?: string) => {
      try {
        let stream: MediaStream

        if (source === "application" && appSourceId) {
          const desktopCaptureConstraints: MediaStreamConstraints = {
            audio: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: appSourceId
              }
            } as unknown as MediaTrackConstraints,
            video: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: appSourceId
              }
            } as unknown as MediaTrackConstraints
          }
          stream = await navigator.mediaDevices.getUserMedia(desktopCaptureConstraints)
          stream.getVideoTracks().forEach((track) => track.stop())
          if (stream.getAudioTracks().length === 0) {
            throw new Error("No audio track detected from the selected application.")
          }
        } else if (source === "system") {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          })
          stream.getVideoTracks().forEach((track) => track.stop())
          if (stream.getAudioTracks().length === 0) {
            throw new Error("No audio track detected. Enable audio sharing and try again.")
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true
            }
          })
        }

        mediaStreamRef.current = stream

        const useNativeRate = source === "system" || source === "application"
        const contextSampleRate = useNativeRate ? undefined : 16000
        audioContextRef.current = new AudioContext(
          contextSampleRate ? { sampleRate: contextSampleRate } : {}
        )

        const actualRate = audioContextRef.current.sampleRate
        const audioSrc = audioContextRef.current.createMediaStreamSource(stream)

        await audioContextRef.current.audioWorklet.addModule("/pcm-capture-processor.js")
        const processor = new AudioWorkletNode(
          audioContextRef.current,
          "pcm-capture-processor",
          { processorOptions: { inputSampleRate: actualRate } }
        )

        processor.port.onmessage = (event) => {
          const { pcmBuffer, level } = event.data
          setLocalAudioLevel(level)

          if (!isActiveRef.current) {
            return
          }

          const uint8Array = new Uint8Array(pcmBuffer)
          const binary = String.fromCharCode(...Array.from(uint8Array))
          const base64 = btoa(binary)
          void window.electronAPI.liveInterviewSendAudio(base64, level)
        }

        audioSrc.connect(processor)
        processor.connect(audioContextRef.current.destination)
        processorRef.current = processor
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "NotAllowedError") {
          throw new Error("Permission denied. Please allow audio capture and retry.")
        }
        throw error
      }
    },
    [isActiveRef]
  )

  useEffect(() => {
    return () => {
      stopAudioCapture()
    }
  }, [stopAudioCapture])

  return {
    localAudioLevel,
    startAudioCapture,
    stopAudioCapture
  }
}
