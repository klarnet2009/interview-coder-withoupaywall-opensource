/**
 * AudioWorklet processor for PCM audio capture.
 * Replaces deprecated ScriptProcessorNode.
 * 
 * Runs in a separate audio thread — calculates RMS audio level
 * and converts float32 samples to int16 PCM, then sends both
 * back to the main thread via MessagePort.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) {
            return true;
        }

        const inputData = input[0]; // mono channel

        // Calculate RMS audio level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        const level = Math.sqrt(sum / inputData.length);

        // Convert float32 to int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
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
