/**
 * AudioWorklet processor for PCM audio capture.
 * Replaces deprecated ScriptProcessorNode.
 *
 * Runs in a separate audio thread. Buffers audio into fixed 30ms frames
 * (480 samples at the 16kHz target), converts float32 samples to int16 PCM,
 * and posts each completed frame to the main thread via MessagePort together
 * with the RMS level of that exact frame.
 *
 * Emitting on a frame boundary rather than on every 128-sample render quantum
 * cuts message traffic ~11x on 48kHz sources and makes the reported level
 * describe the audio actually being sent.
 *
 * Supports resampling from higher sample rates (e.g. 48kHz system audio). On
 * those paths the signal is low-passed below the target Nyquist first, so
 * content above 8kHz cannot fold back into the speech band during decimation.
 */

// 480 samples = 30ms at the 16000Hz target rate.
const FRAME_SIZE = 480;

// Anti-alias cutoff, 1000Hz below the 8000Hz target Nyquist so the passband
// speech energy is untouched by the transition band.
const ANTI_ALIAS_CUTOFF_HZ = 7000;

// Q values of the two cascaded biquad sections that together form a
// 4th-order Butterworth response.
const BUTTERWORTH_Q = [0.5411961, 1.3065630];

class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        // Target 16kHz for Gemini
        this.targetRate = 16000;
        this.inputRate = options?.processorOptions?.inputSampleRate || sampleRate;
        this.resampleRatio = this.inputRate / this.targetRate;
        // Leftover samples from previous chunk for accurate resampling
        this.resampleBuffer = [];

        // Frame accumulator: filled sample by sample, posted and reset when full.
        // A partial frame is carried across process() calls.
        this.frameBuffer = new Int16Array(FRAME_SIZE);
        this.frameFill = 0;
        this.frameSumSq = 0;

        // Anti-aliasing low-pass, only meaningful when we are about to
        // decimate. At the target rate there is nothing to alias and filtering
        // would shave real content off the microphone signal.
        this.filterActive = this.resampleRatio > 1.01;
        // Two sections x [b0, b1, b2, a1, a2], normalized by a0.
        this.filterCoeffs = new Float64Array(10);
        // Two sections x Direct Form I state [x1, x2, y1, y2].
        this.filterState = new Float64Array(8);
        // Scratch for filtered samples: never filter in place, because a mono
        // input aliases the graph's own render-quantum buffer.
        this.scratch = new Float32Array(128);

        if (this.filterActive) {
            for (let section = 0; section < BUTTERWORTH_Q.length; section++) {
                const q = BUTTERWORTH_Q[section];
                const w0 = (2 * Math.PI * ANTI_ALIAS_CUTOFF_HZ) / this.inputRate;
                const cosW0 = Math.cos(w0);
                const alpha = Math.sin(w0) / (2 * q);

                const b0 = (1 - cosW0) / 2;
                const b1 = 1 - cosW0;
                const b2 = (1 - cosW0) / 2;
                const a0 = 1 + alpha;
                const a1 = -2 * cosW0;
                const a2 = 1 - alpha;

                const offset = section * 5;
                this.filterCoeffs[offset] = b0 / a0;
                this.filterCoeffs[offset + 1] = b1 / a0;
                this.filterCoeffs[offset + 2] = b2 / a0;
                this.filterCoeffs[offset + 3] = a1 / a0;
                this.filterCoeffs[offset + 4] = a2 / a0;
            }
        }
    }

    /**
     * Run the cascaded low-pass over the first `length` samples of `data`,
     * in place. Sections run in series, each carrying its own state across
     * calls exactly the way the resample leftovers do.
     */
    applyLowPass(data, length) {
        const coeffs = this.filterCoeffs;
        const state = this.filterState;

        for (let section = 0; section < BUTTERWORTH_Q.length; section++) {
            const co = section * 5;
            const b0 = coeffs[co];
            const b1 = coeffs[co + 1];
            const b2 = coeffs[co + 2];
            const a1 = coeffs[co + 3];
            const a2 = coeffs[co + 4];

            const so = section * 4;
            let x1 = state[so];
            let x2 = state[so + 1];
            let y1 = state[so + 2];
            let y2 = state[so + 3];

            for (let i = 0; i < length; i++) {
                const x0 = data[i];
                const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
                x2 = x1;
                x1 = x0;
                y2 = y1;
                y1 = y0;
                data[i] = y0;
            }

            state[so] = x1;
            state[so + 1] = x2;
            state[so + 2] = y1;
            state[so + 3] = y2;
        }
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

        // Resample if needed (linear interpolation)
        let outputData;
        if (this.filterActive) {
            // Need to downsample (e.g. 48kHz → 16kHz)

            // Low-pass into the scratch first. The scratch is sized to a
            // high-water mark and is often LONGER than the current quantum, so
            // every read below is bounded by monoData.length — using
            // scratch.length would drag a stale tail from a previous, longer
            // quantum into the stream.
            if (this.scratch.length < monoData.length) {
                this.scratch = new Float32Array(monoData.length);
            }
            this.scratch.set(monoData);
            this.applyLowPass(this.scratch, monoData.length);

            const combined = new Float32Array(this.resampleBuffer.length + monoData.length);
            combined.set(this.resampleBuffer);
            combined.set(this.scratch.subarray(0, monoData.length), this.resampleBuffer.length);

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

        // Accumulate into fixed-size frames, converting float32 to int16 PCM.
        // One process() call may complete several frames, or none.
        for (let i = 0; i < outputData.length; i++) {
            let s = outputData[i];
            if (s > 1) {
                s = 1;
            } else if (s < -1) {
                s = -1;
            }

            this.frameSumSq += s * s;
            this.frameBuffer[this.frameFill] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            this.frameFill++;

            if (this.frameFill === FRAME_SIZE) {
                const level = Math.sqrt(this.frameSumSq / FRAME_SIZE);
                // A fresh copy is required: the buffer is transferred away.
                const frame = new Int16Array(this.frameBuffer);
                this.port.postMessage({
                    pcmBuffer: frame.buffer,
                    level
                }, [frame.buffer]); // Transfer ownership for zero-copy

                this.frameFill = 0;
                this.frameSumSq = 0;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
