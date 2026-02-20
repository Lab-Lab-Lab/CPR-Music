// components/audio/DAW/Effects/FrequencyShifter.js
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const FrequencyShifterTooltips = {
  shift: "Amount to shift all frequencies linearly. Unlike pitch shifting, this creates inharmonic, metallic tones. 50-200Hz creates subtle dissonance, 500Hz+ creates alien effects.",
  feedback: "Routes output back through the shifter. Creates cascading frequency shifts and resonances. Use sparingly (10-40%) as it intensifies the effect dramatically.",
  mix: "Balance between dry and wet signal. Lower values (20-50%) add subtle shimmer and movement. Higher values (70-100%) create complete transformation."
};

/**
 * Hilbert transform using FFT for proper frequency shifting
 */
function hilbertTransform(signal) {
  const N = signal.length;
  const fft = new FFT(N);

  // Forward FFT
  const spectrum = fft.forward(signal);

  // Apply Hilbert transform in frequency domain
  // Zero out negative frequencies, double positive frequencies
  for (let i = 1; i < N / 2; i++) {
    spectrum[i * 2] *= 2;
    spectrum[i * 2 + 1] *= 2;
  }
  for (let i = N / 2 + 1; i < N; i++) {
    spectrum[i * 2] = 0;
    spectrum[i * 2 + 1] = 0;
  }

  // Inverse FFT to get analytic signal
  const analytic = fft.inverse(spectrum);

  // Extract imaginary part (Hilbert transform)
  const hilbert = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    hilbert[i] = analytic[i * 2 + 1];
  }

  return hilbert;
}

// Simple FFT implementation for Hilbert transform
class FFT {
  constructor(size) {
    this.size = size;
    this.invSize = 1 / size;

    // Bit reversal lookup table
    this.reverseTable = new Uint32Array(size);
    let limit = 1;
    let bit = size >> 1;
    while (limit < size) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit = limit << 1;
      bit = bit >> 1;
    }

    // Twiddle factors
    this.sin = new Float32Array(size);
    this.cos = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      this.sin[i] = Math.sin((-Math.PI * i) / size);
      this.cos[i] = Math.cos((-Math.PI * i) / size);
    }
  }

  forward(signal) {
    const size = this.size;
    const output = new Float32Array(size * 2);

    // Copy signal to output with bit reversal
    for (let i = 0; i < size; i++) {
      output[this.reverseTable[i] * 2] = signal[i];
      output[this.reverseTable[i] * 2 + 1] = 0;
    }

    // Cooley-Tukey FFT
    let halfSize = 1;
    while (halfSize < size) {
      const step = size / halfSize;
      let k = 0;
      for (let i = 0; i < size; i += halfSize * 2) {
        k = 0;
        for (let j = 0; j < halfSize; j++) {
          const evenR = output[(i + j) * 2];
          const evenI = output[(i + j) * 2 + 1];
          const oddR = output[(i + j + halfSize) * 2];
          const oddI = output[(i + j + halfSize) * 2 + 1];

          const tR = this.cos[k] * oddR - this.sin[k] * oddI;
          const tI = this.cos[k] * oddI + this.sin[k] * oddR;

          output[(i + j) * 2] = evenR + tR;
          output[(i + j) * 2 + 1] = evenI + tI;
          output[(i + j + halfSize) * 2] = evenR - tR;
          output[(i + j + halfSize) * 2 + 1] = evenI - tI;

          k += step;
        }
      }
      halfSize = halfSize << 1;
    }

    return output;
  }

  inverse(spectrum) {
    const size = this.size;
    const output = new Float32Array(size * 2);

    // Copy spectrum with conjugation
    for (let i = 0; i < size * 2; i += 2) {
      output[i] = spectrum[i];
      output[i + 1] = -spectrum[i + 1];
    }

    // Forward FFT on conjugated spectrum
    const result = this.forward(output);

    // Scale and extract real/imaginary parts
    for (let i = 0; i < size * 2; i++) {
      result[i] *= this.invSize;
    }

    return result;
  }
}

/**
 * Process frequency shifter on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processFrequencyShifterRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Create output buffer with region length only
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate,
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Extract region for processing
    const regionData = new Float32Array(regionLength);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }

    // Process in chunks for proper Hilbert transform
    const chunkSize = 4096; // Power of 2 for FFT
    const overlap = chunkSize / 4;
    const hopSize = chunkSize - overlap;
    const shiftedData = new Float32Array(regionLength);

    // Window function for overlap-add
    const window = new Float32Array(chunkSize);
    for (let i = 0; i < chunkSize; i++) {
      window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (chunkSize - 1));
    }

    // Process chunks
    for (let pos = 0; pos < regionLength - chunkSize; pos += hopSize) {
      // Extract windowed chunk
      const chunk = new Float32Array(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        if (pos + i < regionLength) {
          chunk[i] = regionData[pos + i] * window[i];
        }
      }

      // Compute Hilbert transform
      const hilbert = hilbertTransform(chunk);

      // Apply frequency shift using single sideband modulation
      const shiftFreq = parameters.amount || 0;
      const direction = parameters.direction || 'up';

      for (let i = 0; i < chunkSize; i++) {
        const t = (pos + i) / sampleRate;
        const cosPhase = Math.cos(2 * Math.PI * shiftFreq * t);
        const sinPhase = Math.sin(2 * Math.PI * shiftFreq * t);

        let shifted;
        if (direction === 'up' || direction === 'both') {
          // Upper sideband (shift up)
          shifted = chunk[i] * cosPhase - hilbert[i] * sinPhase;
        } else {
          // Lower sideband (shift down)
          shifted = chunk[i] * cosPhase + hilbert[i] * sinPhase;
        }

        if (direction === 'both') {
          // Mix both sidebands for ring mod-like effect
          const lower = chunk[i] * cosPhase + hilbert[i] * sinPhase;
          shifted = (shifted + lower) * 0.5;
        }

        // Add to output with windowing
        if (pos + i < regionLength) {
          shiftedData[pos + i] += shifted * window[i];
        }
      }
    }

    // Normalize overlap-add
    let maxVal = 0;
    for (let i = 0; i < regionLength; i++) {
      maxVal = Math.max(maxVal, Math.abs(shiftedData[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < regionLength; i++) {
        shiftedData[i] /= maxVal;
      }
    }

    // Apply feedback if requested
    if ((parameters.feedback || 0) > 0) {
      const feedbackBuffer = new Float32Array(regionLength);
      const feedbackDelay = Math.floor(sampleRate * 0.1); // 100ms delay

      for (let i = 0; i < regionLength; i++) {
        feedbackBuffer[i] = shiftedData[i];

        if (i >= feedbackDelay) {
          feedbackBuffer[i] +=
            feedbackBuffer[i - feedbackDelay] * (parameters.feedback || 0);
        }
      }

      for (let i = 0; i < regionLength; i++) {
        shiftedData[i] = feedbackBuffer[i];
      }
    }

    // Mix dry and wet signals (write to region indices)
    for (let i = 0; i < regionLength; i++) {
      const drySignal = regionData[i];
      const wetSignal = shiftedData[i];
      outputData[i] =
        drySignal * (1 - (parameters.mix || 0.5)) +
        wetSignal * (parameters.mix || 0.5);
    }
  }

  return outputBuffer;
}

/**
 * Frequency Shifter effect - shifts all frequencies by a fixed amount
 * Unlike pitch shifting, this destroys harmonic relationships for wild effects
 */
export default function FrequencyShifter({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    freqShiftAmount,
    setFreqShiftAmount,
    freqShiftMix,
    setFreqShiftMix,
    freqShiftFeedback,
    setFreqShiftFeedback,
    freqShiftDirection,
    setFreqShiftDirection,
    cutRegion,
  } = useEffects();

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Apply frequency shifting using Hilbert transform
  const applyFrequencyShift = useCallback(
    createEffectApplyFunction(processFrequencyShifterRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        amount: freqShiftAmount,
        mix: freqShiftMix,
        feedback: freqShiftFeedback,
        direction: freqShiftDirection || 'up'
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, freqShiftAmount, freqShiftMix, freqShiftFeedback, freqShiftDirection, onApply]
  );

  const directionOptions = [
    { key: 'up', name: 'Up' },
    { key: 'down', name: 'Down' },
    { key: 'both', name: 'Both' },
  ];

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Direction selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Direction</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setFreqShiftDirection(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
              {directionOptions.find(
                (d) => d.key === (freqShiftDirection || 'up'),
              )?.name || 'Up'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {directionOptions.map((dir) => (
                <Dropdown.Item
                  key={dir.key}
                  eventKey={dir.key}
                  className="text-white"
                >
                  {dir.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>

        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FrequencyShifterTooltips.shift}</Tooltip>}
          >
            <div>
              <Knob
                value={freqShiftAmount}
                onChange={setFreqShiftAmount}
                min={-500}
                max={500}
                step={1}
                label="Shift"
                displayValue={`${freqShiftAmount > 0 ? '+' : ''}${freqShiftAmount}Hz`}
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
            overlay={<Tooltip>{FrequencyShifterTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={freqShiftMix}
                onChange={setFreqShiftMix}
                min={0}
                max={1}
                label="Mix"
                displayValue={`${Math.round(freqShiftMix * 100)}%`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FrequencyShifterTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={freqShiftFeedback}
                onChange={setFreqShiftFeedback}
                min={0}
                max={0.9}
                label="Feedback"
                displayValue={`${Math.round(freqShiftFeedback * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyFrequencyShift}>
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
