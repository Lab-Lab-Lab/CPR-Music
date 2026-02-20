'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const GlitchTooltips = {
  sliceSize: "Size of audio chunks to manipulate. Smaller slices (10-50ms) create stuttery glitches, larger slices (100-500ms) create rhythmic repeats.",
  probability: "Chance of glitch occurring. 100% creates constant glitching, 20-50% creates occasional digital artifacts. Lower values sound more natural.",
  mix: "Balance between original and glitched audio. 50% blends effects, 100% replaces audio completely. Lower values (20-40%) add subtle digital character."
};

/**
 * Process glitch/beat repeat on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processGlitchRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Calculate beat division in samples (assuming 120 BPM for now)
  const bpm = 120;
  const beatLength = (60 / bpm) * sampleRate;
  const divisionLength = Math.floor(beatLength / (parameters.division || 16));

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

    // Process region with glitch
    let position = 0;
    while (position < regionLength) {
      const shouldGlitch = Math.random() < (parameters.probability || 0.3);

      if (shouldGlitch) {
        // Capture a slice
        const sliceLength = Math.min(divisionLength, regionLength - position);
        const slice = new Float32Array(sliceLength);

        for (let i = 0; i < sliceLength; i++) {
          slice[i] = inputData[startSample + position + i];
        }

        // Apply effects to slice
        let processedSlice = slice;

        // Reverse?
        if (Math.random() < (parameters.reverse || 0)) {
          processedSlice = new Float32Array(sliceLength);
          for (let i = 0; i < sliceLength; i++) {
            processedSlice[i] = slice[sliceLength - 1 - i];
          }
        }

        // Pitch shift?
        if ((parameters.pitch || 0) !== 0) {
          const pitchRatio = Math.pow(2, (parameters.pitch || 0) / 12);
          const pitchedLength = Math.floor(sliceLength / pitchRatio);
          const tempSlice = new Float32Array(pitchedLength);

          for (let i = 0; i < pitchedLength; i++) {
            const sourceIndex = Math.floor(i * pitchRatio);
            if (sourceIndex < sliceLength) {
              tempSlice[i] = processedSlice[sourceIndex];
            } else {
              tempSlice[i] = 0;
            }
          }
          processedSlice = tempSlice;
        }

        // Bit crush?
        if (parameters.crush) {
          const bits = 4; // Crush to 4-bit
          const levels = Math.pow(2, bits);
          for (let i = 0; i < sliceLength; i++) {
            processedSlice[i] = Math.round(processedSlice[i] * levels) / levels;
          }
        }

        // Repeat the slice (blend with dry)
        const writeLen = Math.min(processedSlice.length, sliceLength);
        for (let repeat = 0; repeat < (parameters.repeats || 1); repeat++) {
          for (let i = 0; i < writeLen; i++) {
            const regionIndex = position + repeat * sliceLength + i;
            const sourceIndex = startSample + position + i;
            if (regionIndex < regionLength && sourceIndex < endSample) {
              const mixAmount = 0.8 + Math.random() * 0.2; // 80–100% wet
              const dry = inputData[sourceIndex];
              const wet = processedSlice[i];
              outputData[regionIndex] = dry * (1 - mixAmount) + wet * mixAmount;
            }
          }
        }

        // Skip ahead
        position += sliceLength * (parameters.repeats || 1);
      } else {
        // No glitch, just move forward
        position += divisionLength;
      }
    }
  }

  return outputBuffer;
}

/**
 * Glitch/Beat Repeat effect - rhythmic stutters and chaos
 */
export default function Glitch({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  let effectsContext;
  try {
    effectsContext = useEffects();
  } catch (error) {
    console.error('Glitch: Failed to get EffectsContext:', error);
    effectsContext = null;
  }

  // Debug logging
  if (!effectsContext) {
    console.warn('Glitch: EffectsContext is null/undefined');
  } else if (!effectsContext.setGlitchCrush) {
    console.warn('Glitch: setGlitchCrush is not available in context', effectsContext);
  }

  // Provide defaults if context is not ready
  const {
    glitchDivision = '1/16',
    setGlitchDivision = () => { console.log('setGlitchDivision: using default no-op'); },
    glitchProbability = 30,
    setGlitchProbability = () => { console.log('setGlitchProbability: using default no-op'); },
    glitchRepeats = 1,
    setGlitchRepeats = () => { console.log('setGlitchRepeats: using default no-op'); },
    glitchReverse = 20,
    setGlitchReverse = () => { console.log('setGlitchReverse: using default no-op'); },
    glitchPitch = 0,
    setGlitchPitch = () => { console.log('setGlitchPitch: using default no-op'); },
    glitchCrush = false,
    setGlitchCrush = () => { console.log('setGlitchCrush: using default no-op'); },
    cutRegion = () => { console.log('cutRegion: using default no-op'); },
  } = effectsContext || {};

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Apply glitch effect to selected region
  const applyGlitch = useCallback(
    createEffectApplyFunction(processGlitchRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        division: glitchDivision,
        probability: glitchProbability,
        repeats: glitchRepeats,
        reverse: glitchReverse,
        pitch: glitchPitch,
        crush: glitchCrush
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, glitchDivision, glitchProbability, glitchRepeats, glitchReverse, glitchPitch, glitchCrush, onApply]
  );

  const divisionOptions = [
    { value: 4, label: '1/4' },
    { value: 8, label: '1/8' },
    { value: 16, label: '1/16' },
    { value: 32, label: '1/32' },
    { value: 64, label: '1/64' },
  ];

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Division selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Division</Form.Label>
          <Form.Select
            size="sm"
            value={glitchDivision}
            onChange={(e) => setGlitchDivision(Number(e.target.value))}
          >
            {divisionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </Col>

        {/* Bit Crush toggle */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Bit Crush</Form.Label>
          <Form.Check
            type="switch"
            id="crush-switch"
            label={glitchCrush ? 'On' : 'Off'}
            checked={glitchCrush}
            onChange={(e) => {
              try {
                if (typeof setGlitchCrush === 'function') {
                  setGlitchCrush(e.target.checked);
                } else {
                  console.error('setGlitchCrush is not a function:', typeof setGlitchCrush);
                }
              } catch (error) {
                console.error('Error in Glitch onChange:', error);
              }
            }}
            className="text-white"
          />
        </Col>

        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GlitchTooltips.probability}</Tooltip>}
          >
            <div>
              <Knob
                value={glitchProbability}
                onChange={setGlitchProbability}
                min={0}
                max={1}
                label="Probability"
                displayValue={`${Math.round(glitchProbability * 100)}%`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <div>
            <Knob
              value={glitchRepeats}
              onChange={setGlitchRepeats}
              min={1}
              max={16}
              step={1}
              label="Repeats"
              displayValue={`${glitchRepeats}x`}
              size={45}
              color="#7bafd4"
            />
          </div>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <div>
            <Knob
              value={glitchReverse}
              onChange={setGlitchReverse}
              min={0}
              max={1}
              label="Reverse"
              displayValue={`${Math.round(glitchReverse * 100)}%`}
              size={45}
              color="#cbb677"
            />
          </div>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <div>
            <Knob
              value={glitchPitch}
              onChange={setGlitchPitch}
              min={-12}
              max={12}
              step={1}
              label="Pitch"
              displayValue={`${glitchPitch > 0 ? '+' : ''}${glitchPitch}`}
              size={45}
              color="#92ce84"
            />
          </div>
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyGlitch}>
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
