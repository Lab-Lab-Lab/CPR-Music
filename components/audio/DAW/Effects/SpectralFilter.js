// components/audio/DAW/Effects/SpectralFilter.js
'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const SpectralFilterTooltips = {
  mode: "Filtering algorithm. Bandpass isolates frequencies, Notch removes them, Comb creates harmonic series, Smear blurs spectral content.",
  frequency: "Center frequency for spectral operation. Determines which frequencies are affected by the filtering or manipulation.",
  bandwidth: "Width of affected frequency range. Narrow bandwidth creates surgical filtering, wide bandwidth affects broad spectral regions.",
  amount: "Intensity of spectral processing. Higher values create more dramatic filtering or smearing effects. Use subtly for natural results."
};

// Create window function for spectral processing
function createWindow(length) {
  const frameWindow = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    frameWindow[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1)); // Hann window
  }
  return frameWindow;
}

// Simple FFT implementation for spectral processing
function fft(signal) {
  const N = signal.length;
  const spectrum = new Float32Array(N * 2); // Complex array [real, imag, real, imag, ...]

  // DFT - not efficient but works for demo
  for (let k = 0; k < N; k++) {
    let real = 0;
    let imag = 0;

    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      real += signal[n] * Math.cos(angle);
      imag += signal[n] * Math.sin(angle);
    }

    spectrum[k * 2] = real;
    spectrum[k * 2 + 1] = imag;
  }

  return spectrum;
}

function ifft(spectrum) {
  const N = spectrum.length / 2;
  const signal = new Float32Array(N);

  // IDFT
  for (let n = 0; n < N; n++) {
    let real = 0;

    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      const specReal = spectrum[k * 2];
      const specImag = spectrum[k * 2 + 1];

      real += specReal * Math.cos(angle) - specImag * Math.sin(angle);
    }

    signal[n] = real / N;
  }

  return signal;
}

// Spectral filter implementations
function applyRobotFilter(spectrum, bands) {
  const N = spectrum.length / 2;
  const bandSize = Math.floor(N / bands);

  for (let band = 0; band < bands; band++) {
    const start = band * bandSize;
    const end = Math.min((band + 1) * bandSize, N);

    // Find dominant frequency in band
    let maxMag = 0;
    let maxBin = start;

    for (let i = start; i < end; i++) {
      const mag = Math.sqrt(
        spectrum[i * 2] * spectrum[i * 2] +
          spectrum[i * 2 + 1] * spectrum[i * 2 + 1],
      );
      if (mag > maxMag) {
        maxMag = mag;
        maxBin = i;
      }
    }

    // Clear band and keep only dominant frequency
    for (let i = start; i < end; i++) {
      if (i !== maxBin) {
        spectrum[i * 2] = 0;
        spectrum[i * 2 + 1] = 0;
      }
    }
  }
}

function applyWhisperFilter(spectrum, threshold) {
  const N = spectrum.length / 2;

  for (let i = 0; i < N; i++) {
    const real = spectrum[i * 2];
    const imag = spectrum[i * 2 + 1];
    const mag = Math.sqrt(real * real + imag * imag);

    // Randomize phase but keep magnitude
    const phase = Math.random() * 2 * Math.PI;
    spectrum[i * 2] = mag * Math.cos(phase);
    spectrum[i * 2 + 1] = mag * Math.sin(phase);

    // Apply threshold
    if (mag < threshold) {
      spectrum[i * 2] = 0;
      spectrum[i * 2 + 1] = 0;
    }
  }
}

function applyHarmonicBoost(spectrum, spread) {
  const N = spectrum.length / 2;
  const fundamental = findFundamental(spectrum);

  // Boost harmonics
  for (let harmonic = 2; harmonic <= 10; harmonic++) {
    const bin = Math.round(fundamental * harmonic);
    if (bin < N) {
      const boost = 1 + spread * (1 / harmonic);
      spectrum[bin * 2] *= boost;
      spectrum[bin * 2 + 1] *= boost;
    }
  }
}

function applyFrequencyShift(spectrum, shiftHz, sampleRate) {
  const N = spectrum.length / 2;
  const binShift = Math.round(shiftHz / (sampleRate / N));
  const temp = new Float32Array(spectrum.length);

  for (let i = 0; i < N; i++) {
    const targetBin = i + binShift;
    if (targetBin >= 0 && targetBin < N) {
      temp[targetBin * 2] = spectrum[i * 2];
      temp[targetBin * 2 + 1] = spectrum[i * 2 + 1];
    }
  }

  spectrum.set(temp);
}

function applySpectralGate(spectrum, threshold) {
  const N = spectrum.length / 2;

  for (let i = 0; i < N; i++) {
    const mag = Math.sqrt(
      spectrum[i * 2] * spectrum[i * 2] +
        spectrum[i * 2 + 1] * spectrum[i * 2 + 1],
    );
    if (mag < threshold) {
      spectrum[i * 2] = 0;
      spectrum[i * 2 + 1] = 0;
    }
  }
}

function applyOddHarmonicsFilter(spectrum) {
  const N = spectrum.length / 2;
  const fundamental = findFundamental(spectrum);
  const temp = new Float32Array(spectrum.length);

  // Keep only odd harmonics
  for (let harmonic = 1; harmonic <= 20; harmonic += 2) {
    const bin = Math.round(fundamental * harmonic);
    if (bin < N) {
      temp[bin * 2] = spectrum[bin * 2];
      temp[bin * 2 + 1] = spectrum[bin * 2 + 1];
    }
  }

  spectrum.set(temp);
}

function findFundamental(spectrum) {
  const N = spectrum.length / 2;
  let maxMag = 0;
  let fundamentalBin = 0;

  // Start from bin 1 to avoid DC
  for (let i = 1; i < N / 4; i++) {
    const mag = Math.sqrt(
      spectrum[i * 2] * spectrum[i * 2] +
        spectrum[i * 2 + 1] * spectrum[i * 2 + 1],
    );
    if (mag > maxMag) {
      maxMag = mag;
      fundamentalBin = i;
    }
  }

  return fundamentalBin;
}

/**
 * Process spectral filter on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processSpectralFilterRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // FFT size (must be power of 2)
  const fftSize = 2048;
  const hopSize = fftSize / 4;

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

    // Process region with overlap-add
    const processedRegion = new Float32Array(regionLength);
    const frameWindow = createWindow(fftSize);

    for (let pos = 0; pos < regionLength - fftSize; pos += hopSize) {
      // Extract windowed frame
      const frame = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        if (startSample + pos + i < endSample) {
          frame[i] = inputData[startSample + pos + i] * frameWindow[i];
        }
      }

      // FFT
      const spectrum = fft(frame);

      // Apply spectral filter based on type
      switch (parameters.type) {
        case 'robot':
          // Vocoder-like effect - quantize frequencies
          applyRobotFilter(spectrum, parameters.bands || 16);
          break;

        case 'whisper':
          // Remove pitched content, keep noise
          applyWhisperFilter(spectrum, parameters.threshold || 0.1);
          break;

        case 'harmonicBoost':
          // Enhance harmonics
          applyHarmonicBoost(spectrum, parameters.spread || 1);
          break;

        case 'frequencyShift':
          // Shift all frequencies
          applyFrequencyShift(spectrum, parameters.shift || 0, sampleRate);
          break;

        case 'spectralGate':
          // Gate based on magnitude
          applySpectralGate(spectrum, parameters.threshold || 0.1);
          break;

        case 'oddHarmonics':
          // Keep only odd harmonics
          applyOddHarmonicsFilter(spectrum);
          break;
      }

      // IFFT
      const processed = ifft(spectrum);

      // Overlap-add
      for (let i = 0; i < fftSize; i++) {
        if (pos + i < regionLength) {
          processedRegion[pos + i] += processed[i] * frameWindow[i];
        }
      }
    }

    // Normalize
    let maxVal = 0;
    for (let i = 0; i < regionLength; i++) {
      maxVal = Math.max(maxVal, Math.abs(processedRegion[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < regionLength; i++) {
        processedRegion[i] /= maxVal;
      }
    }

    // Copy processed region back
    for (let i = 0; i < regionLength; i++) {
      outputData[i] = processedRegion[i] * 0.8;
    }
  }

  return outputBuffer;
}

/**
 * Spectral Filter effect - FFT-based frequency manipulation
 * Can create robotic voices, whisper effects, and frequency-based morphing
 */
export default function SpectralFilter({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { cutRegion } = useEffects();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const audioContextRef = useRef(null);
  const [filterType, setFilterType] = useState('robot');
  const [threshold, setThreshold] = useState(0.1);
  const [bands, setBands] = useState(16);
  const [spread, setSpread] = useState(1);
  const [shift, setShift] = useState(0);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Apply spectral filter
  const applySpectralFilter = useCallback(
    createEffectApplyFunction(processSpectralFilterRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        type: filterType,
        threshold,
        bands,
        spread,
        shift,
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, filterType, threshold, bands, spread, shift, onApply]
  );

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Filter Type Selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{SpectralFilterTooltips.mode}</Tooltip>}
          >
            <div>
              <Dropdown onSelect={(e) => setFilterType(e)}>
                <Dropdown.Toggle size="sm" className="w-100">
                  {filterType === 'robot' && 'Robot Voice'}
                  {filterType === 'whisper' && 'Whisper'}
                  {filterType === 'harmonicBoost' && 'Harmonic Boost'}
                  {filterType === 'frequencyShift' && 'Frequency Shift'}
                  {filterType === 'spectralGate' && 'Spectral Gate'}
                  {filterType === 'oddHarmonics' && 'Odd Harmonics'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item eventKey="robot">Robot Voice</Dropdown.Item>
                  <Dropdown.Item eventKey="whisper">Whisper</Dropdown.Item>
                  <Dropdown.Item eventKey="harmonicBoost">
                    Harmonic Boost
                  </Dropdown.Item>
                  <Dropdown.Item eventKey="frequencyShift">
                    Frequency Shift
                  </Dropdown.Item>
                  <Dropdown.Item eventKey="spectralGate">
                    Spectral Gate
                  </Dropdown.Item>
                  <Dropdown.Item eventKey="oddHarmonics">
                    Odd Harmonics
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </OverlayTrigger>
        </Col>

        {/* Parameters based on filter type */}
        {filterType === 'robot' && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={bands}
              onChange={setBands}
              min={4}
              max={32}
              step={1}
              label="Bands"
              displayValue={`${bands}`}
              size={45}
              color="#e75b5c"
            />
          </Col>
        )}

        {(filterType === 'whisper' || filterType === 'spectralGate') && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={threshold}
              onChange={setThreshold}
              min={0.01}
              max={1}
              step={0.01}
              label="Threshold"
              displayValue={`${(threshold * 100).toFixed(0)}%`}
              size={45}
              color="#7bafd4"
            />
          </Col>
        )}

        {filterType === 'harmonicBoost' && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={spread}
              onChange={setSpread}
              min={0}
              max={2}
              step={0.1}
              label="Spread"
              displayValue={`${spread.toFixed(1)}`}
              size={45}
              color="#92ce84"
            />
          </Col>
        )}

        {filterType === 'frequencyShift' && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={shift}
              onChange={setShift}
              min={-500}
              max={500}
              step={10}
              label="Shift"
              displayValue={`${shift > 0 ? '+' : ''}${shift}Hz`}
              size={45}
              color="#cbb677"
            />
          </Col>
        )}

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applySpectralFilter}>
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
