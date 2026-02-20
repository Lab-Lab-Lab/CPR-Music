// components/audio/DAW/Effects/Paulstretch.js
'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const PaulstretchTooltips = {
  stretch: "Time-stretching factor. 2x doubles length, 10x+ creates ambient drones. Extreme values (50-100x) create evolving soundscapes from any source.",
  windowSize: "FFT analysis window. Larger windows create smoother, more continuous textures. Smaller windows preserve more transient detail.",
  mix: "Blend between original and stretched audio. Lower values add ambient tails to sounds. 100% creates pure atmospheric textures."
};

// FFT implementation for Paulstretch
class FFT {
  constructor(size) {
    if ((size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of two');
    }
    this.size = size;

    // Bit reversal lookup table
    const bits = Math.log2(size) | 0;
    this.reverseTable = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let j = 0;
      for (let k = 0; k < bits; k++) {
        j = (j << 1) | ((i >>> k) & 1);
      }
      this.reverseTable[i] = j;
    }
  }

  _transformInPlace(data, inverse) {
    const N = this.size;

    // Bit-reversed reordering (in-place swaps)
    for (let i = 0; i < N; i++) {
      const j = this.reverseTable[i];
      if (j > i) {
        const i2 = i << 1;
        const j2 = j << 1;
        const tr = data[i2];
        const ti = data[i2 + 1];
        data[i2] = data[j2];
        data[i2 + 1] = data[j2 + 1];
        data[j2] = tr;
        data[j2 + 1] = ti;
      }
    }

    // Iterative Cooley–Tukey
    for (let len = 2; len <= N; len <<= 1) {
      const ang = ((inverse ? 2 : -2) * Math.PI) / len;
      const wLenR = Math.cos(ang);
      const wLenI = Math.sin(ang);

      for (let i = 0; i < N; i += len) {
        let wR = 1;
        let wI = 0;
        const half = len >> 1;

        for (let j = 0; j < half; j++) {
          const i0 = (i + j) << 1;
          const i1 = (i + j + half) << 1;

          const uR = data[i0];
          const uI = data[i0 + 1];
          const vR = data[i1];
          const vI = data[i1 + 1];

          // t = w * v
          const tR = vR * wR - vI * wI;
          const tI = vR * wI + vI * wR;

          data[i0] = uR + tR;
          data[i0 + 1] = uI + tI;
          data[i1] = uR - tR;
          data[i1 + 1] = uI - tI;

          // w *= wLen
          const nwR = wR * wLenR - wI * wLenI;
          const nwI = wR * wLenI + wI * wLenR;
          wR = nwR;
          wI = nwI;
        }
      }
    }

    // Scale on inverse
    if (inverse) {
      const invN = 1 / N;
      for (let i = 0; i < N; i++) {
        const idx = i << 1;
        data[idx] *= invN;
        data[idx + 1] *= invN;
      }
    }
  }

  forward(signal) {
    const N = this.size;
    const data = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const idx = i << 1;
      data[idx] = signal[i] || 0;
      data[idx + 1] = 0;
    }
    this._transformInPlace(data, false);
    return data; // interleaved complex [re, im, re, im, ...]
  }

  inverse(spectrum) {
    const N = this.size;
    const data = new Float32Array(N * 2);
    data.set(spectrum);
    this._transformInPlace(data, true);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      out[i] = data[i << 1];
    }
    return out;
  }
}

// Hann window function
const hannWindow = (length) => {
  const frameWindow = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    frameWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return frameWindow;
};

// sqrt-Hann window for analysis/synthesis (so w^2 = Hann)
const sqrtHannWindow = (length) => {
  const w = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const h = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    w[i] = Math.sqrt(h);
  }
  return w;
};

/**
 * Process paulstretch on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processPaulstretchRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  // New params (with sane defaults)
  const makeupDb = parameters.makeupDb ?? 0; // dB
  const limiterDb = parameters.limiterDb ?? -1; // dBFS (e.g., -1 dBFS)
  const makeupLinear = Math.pow(10, makeupDb / 20);
  const limiterThresh = Math.pow(10, limiterDb / 20); // linear

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Paulstretch parameters
  const stretch = parameters.stretchFactor || 8;
  const windowSizeSamples = Math.floor(
    (parameters.windowSize || 0.25) * sampleRate,
  );
  const halfWindow = Math.floor(windowSizeSamples / 2);

  // Make sure window size is even
  const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSizeSamples)));

  // Output length after stretching
  const outputLength = Math.floor(regionLength * stretch);

  // Create output buffer for JUST the processed region
  // (replaceRegionInBuffer will handle integrating it with the full audio)
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    outputLength,
    sampleRate,
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Extract region data
    const regionData = new Float32Array(regionLength);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }

    // Paulstretch processing
    const stretchedData = new Float32Array(outputLength);
    const frameWindow = sqrtHannWindow(windowSizeSamples);
    const olaWeight = new Float32Array(outputLength);

    // Process overlapping windows
    // Paulstretch formula: N = 4 (overlap factor)
    // outputHop = windowSize / N (fixed, NOT scaled by stretch!)
    // inputHop = windowSize / (N * stretch)
    const overlapFactor = 4; // N = 4 for standard paulstretch
    const outputHopSize = Math.floor(windowSizeSamples / overlapFactor);
    const inputHopSize = Math.floor(windowSizeSamples / (overlapFactor * stretch));

    let inputPos = 0;
    let outputPos = 0;

    // Create FFT instance once, outside the loop
    const fft = new FFT(fftSize);

    while (
      inputPos + windowSizeSamples < regionLength &&
      outputPos + windowSizeSamples < outputLength
    ) {
      // Extract windowed segment (DC-removed) and zero-pad to fftSize
      const segment = new Float32Array(fftSize);
      let dc = 0;
      let count = 0;
      for (let i = 0; i < windowSizeSamples; i++) {
        if (inputPos + i < regionLength) {
          dc += regionData[inputPos + i];
          count++;
        }
      }
      dc = count > 0 ? dc / count : 0;
      for (let i = 0; i < windowSizeSamples; i++) {
        if (inputPos + i < regionLength) {
          const s = regionData[inputPos + i] - dc;
          segment[i] = s * frameWindow[i];
        }
      }

      // FFT
      const spectrum = fft.forward(segment);

      // Randomize phases for positive freqs and enforce Hermitian symmetry
      const N = fftSize;
      const half = N >> 1;

      // Force DC and Nyquist imag parts to zero (avoid offsets/clicks)
      spectrum[1] = 0;
      spectrum[half * 2 + 1] = 0;

      for (let k = 1; k < half; k++) {
        const i = k * 2;
        const re = spectrum[i];
        const im = spectrum[i + 1];
        const mag = Math.hypot(re, im);

        const phase = Math.random() * 2 * Math.PI;
        const reNew = mag * Math.cos(phase);
        const imNew = mag * Math.sin(phase);

        // set positive-frequency bin
        spectrum[i] = reNew;
        spectrum[i + 1] = imNew;

        // mirror to negative frequency (complex conjugate)
        const j = (N - k) * 2;
        spectrum[j] = reNew;
        spectrum[j + 1] = -imNew;
      }

      // IFFT
      const stretched = fft.inverse(spectrum);

      // --- NEW: Per-frame RMS gain compensation (pre-OLA) ---
      // Match output frame RMS to analysis (windowed) input RMS
      let rmsIn = 0;
      let rmsOut = 0;
      for (let i = 0; i < windowSizeSamples; i++) {
        const a = segment[i]; // windowed analysis frame (already DC-removed)
        const b = stretched[i]; // synthesized frame
        rmsIn += a * a;
        rmsOut += b * b;
      }
      rmsIn = Math.sqrt(rmsIn / Math.max(1, windowSizeSamples));
      rmsOut = Math.sqrt(rmsOut / Math.max(1, windowSizeSamples));
      const eps = 1e-12;
      const gain = rmsOut > eps ? rmsIn / rmsOut : 1;
      if (Math.abs(gain - 1) > 1e-6) {
        for (let i = 0; i < windowSizeSamples; i++) {
          stretched[i] *= gain;
        }
      }

      // Add to output with windowing and proper overlap-add weight tracking
      for (let i = 0; i < windowSizeSamples; i++) {
        if (outputPos + i < outputLength) {
          stretchedData[outputPos + i] += stretched[i] * frameWindow[i];
          olaWeight[outputPos + i] += frameWindow[i] * frameWindow[i];
        }
      }

      inputPos += inputHopSize;
      outputPos += outputHopSize;
    }

    // Normalize by overlap-add weights
    for (let i = 0; i < outputLength; i++) {
      if (olaWeight[i] > 0) {
        stretchedData[i] /= olaWeight[i];
      }
    }

    // --- NEW: Make-up gain + soft limiter (tanh) post-OLA ---
    for (let i = 0; i < outputLength; i++) {
      // Apply make-up gain
      let s = stretchedData[i] * makeupLinear;
      // Soft limit around threshold (prevents nasty hard clips)
      // y = thr * tanh(x / thr)
      s = limiterThresh * Math.tanh(s / Math.max(1e-12, limiterThresh));
      stretchedData[i] = s;
    }

    // Copy stretched data directly to output buffer
    // (no offset needed since we're returning only the processed region)
    for (let i = 0; i < outputLength; i++) {
      outputData[i] = stretchedData[i];
    }
  }

  return outputBuffer;
}

/**
 * Paulstretch effect - extreme time stretching algorithm
 * Based on the algorithm by Paul Nasca
 */
export default function Paulstretch({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const { cutRegion } = useEffects();

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Paulstretch parameters
  const [stretchFactor, setStretchFactor] = useState(8);
  const [windowSize, setWindowSize] = useState(0.25);

  // NEW: Output controls
  const [makeupDb, setMakeupDb] = useState(0); // 0..+24 dB
  const [limiterDb, setLimiterDb] = useState(-1); // -24..-0.1 dBFS

  // Apply Paulstretch algorithm
  const applyPaulstretch = useCallback(
    createEffectApplyFunction(processPaulstretchRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        stretchFactor: stretchFactor,
        windowSize: windowSize,
        makeupDb: makeupDb,
        limiterDb: limiterDb
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, stretchFactor, windowSize, makeupDb, limiterDb, onApply]
  );

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PaulstretchTooltips.stretch}</Tooltip>}
          >
            <div>
              <Knob
                value={stretchFactor}
                onChange={setStretchFactor}
                min={2}
                max={50}
                step={1}
                label="Stretch"
                displayValue={`${stretchFactor}x`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PaulstretchTooltips.windowSize}</Tooltip>}
          >
            <div>
              <Knob
                value={windowSize}
                onChange={setWindowSize}
                min={0.05}
                max={1}
                step={0.05}
                label="Window"
                displayValue={`${(windowSize * 1000).toFixed(0)}ms`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* NEW: Make-Up Gain (dB) */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={makeupDb}
            onChange={setMakeupDb}
            min={0}
            max={24}
            step={1}
            label="Make-Up"
            displayValue={`${makeupDb.toFixed(0)} dB`}
            size={45}
            color="#d4a67b"
          />
        </Col>

        {/* NEW: Limiter Threshold (dBFS) */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={limiterDb}
            onChange={setLimiterDb}
            min={-24}
            max={-0.1}
            step={0.1}
            label="Limit Thr"
            displayValue={`${limiterDb.toFixed(1)} dBFS`}
            size={45}
            color="#b78be0"
          />
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyPaulstretch}>
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952);
  // file length
  setUint32(length - 8);
  // RIFF type
  setUint32(0x45564157);
  // format chunk identifier
  setUint32(0x20746d66);
  // format chunk length
  setUint32(16);
  // sample format (PCM)
  setUint16(1);
  // channel count
  setUint16(buffer.numberOfChannels);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
  // block align
  setUint16(buffer.numberOfChannels * 2);
  // bits per sample
  setUint16(16);
  // data chunk identifier
  setUint32(0x61746164);
  // data chunk length
  setUint32(length - pos - 4);

  // Extract channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave channels and convert to 16-bit PCM
  while (offset < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;
}
