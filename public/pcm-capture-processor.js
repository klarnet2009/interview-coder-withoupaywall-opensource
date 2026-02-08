/**
 * AudioWorklet processor for PCM audio capture.
 * Replaces deprecated ScriptProcessorNode.
 * 
 * Runs in a separate audio thread — calculates RMS audio level
 * and converts float32 samples to int16 PCM at 16kHz, then sends both
 * back to the main thread via MessagePort.
 * 
 * Supports resampling from higher sample rates (e.g. 48kHz system audio).
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        // Target 16kHz for Gemini
        this.targetRate = 16000;
        this.inputRate = options?.processorOptions?.inputSampleRate || sampleRate;
        this.resampleRatio = this.inputRate / this.targetRate;
        // Leftover samples from previous chunk for accurate resampling
        this.resampleBuffer = [];
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) {
            return true;
        }

        // Mix down to mono if stereo
        let monoData;
        if (input.length > 1) {
            monoData = new Float32Array(input[0].length);
            for (let i = 0; i < input[0].length; i++) {
                let sum = 0;
                for (let ch = 0; ch < input.length; ch++) {
                    sum += input[ch][i];
                }
                monoData[i] = sum / input.length;
            }
        } else {
            monoData = input[0];
        }

        // Calculate RMS audio level (before resampling for accuracy)
        let sum = 0;
        for (let i = 0; i < monoData.length; i++) {
            sum += monoData[i] * monoData[i];
        }
        const level = Math.sqrt(sum / monoData.length);

        // Resample if needed (linear interpolation)
        let outputData;
        if (this.resampleRatio > 1.01) {
            // Need to downsample (e.g. 48kHz → 16kHz)
            const combined = new Float32Array(this.resampleBuffer.length + monoData.length);
            combined.set(this.resampleBuffer);
            combined.set(monoData, this.resampleBuffer.length);

            const outputLength = Math.floor(combined.length / this.resampleRatio);
            outputData = new Float32Array(outputLength);

            for (let i = 0; i < outputLength; i++) {
                const srcIndex = i * this.resampleRatio;
                const srcFloor = Math.floor(srcIndex);
                const srcCeil = Math.min(srcFloor + 1, combined.length - 1);
                const frac = srcIndex - srcFloor;
                outputData[i] = combined[srcFloor] * (1 - frac) + combined[srcCeil] * frac;
            }

            // Save leftover samples
            const consumed = Math.floor(outputLength * this.resampleRatio);
            this.resampleBuffer = Array.from(combined.slice(consumed));
        } else {
            outputData = monoData;
        }

        // Convert float32 to int16 PCM
        const pcmData = new Int16Array(outputData.length);
        for (let i = 0; i < outputData.length; i++) {
            const s = Math.max(-1, Math.min(1, outputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send PCM data and level to main thread
        this.port.postMessage({
            pcmBuffer: pcmData.buffer,
            level
        }, [pcmData.buffer]); // Transfer ownership for zero-copy

        return true; // Keep processor alive
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
