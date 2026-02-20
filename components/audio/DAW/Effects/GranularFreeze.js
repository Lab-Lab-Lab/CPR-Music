// components/audio/DAW/Effects/GranularFreeze.js
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const GranularFreezeTooltips = {
  grainSize: "Size of audio grains. Tiny grains (10-50ms) create smooth textures, large grains (100-500ms) preserve more original character.",
  density: "Number of simultaneous grains. Higher density creates thicker, more continuous textures. Lower density creates sparse, pointillistic effects.",
  spread: "Random variation in grain timing. Creates more organic, less mechanical textures. Higher values add shimmer and movement.",
  pitch: "Pitch shift of frozen grains. Can create harmonies or ambient drones. Use subtle shifts (±2-5 semitones) for textures, extreme for effects."
};

/**
 * Process granular freeze on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processGranularFreezeRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Grain parameters
  const grainSizeSamples = Math.floor(
    (parameters.grainSize / 1000) * sampleRate,
  );
  const grainSpacing = Math.floor(
    grainSizeSamples * (1 - (parameters.density || 0.5)),
  );
  const spraySamples = Math.floor((parameters.spray / 1000) * sampleRate);

  // Create output buffer (make it longer for freeze effect)
  const freezeDuration = 2; // 2 seconds of freeze
  const outputLength = Math.max(
    audioBuffer.length,
    startSample + sampleRate * freezeDuration,
  );
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    outputLength,
    sampleRate,
  );

  // Window function for smooth grains (renamed from 'window' to 'win')
  const win = new Float32Array(grainSizeSamples);
  for (let i = 0; i < grainSizeSamples; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grainSizeSamples - 1));
  }

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy original audio up to the freeze point
    for (let i = 0; i < startSample; i++) {
      outputData[i] = inputData[i];
    }

    // Extract freeze buffer from position
    const freezePosition = Math.floor(
      startSample + regionLength * (parameters.position || 0.5),
    );
    const freezeBufferSize = Math.min(grainSizeSamples * 4, regionLength);
    const freezeBuffer = new Float32Array(freezeBufferSize);

    for (let i = 0; i < freezeBufferSize; i++) {
      const sourceIndex = freezePosition + i;
      if (sourceIndex < endSample) {
        freezeBuffer[i] = inputData[sourceIndex];
      }
    }

    // Generate grains for the freeze duration
    let outputPos = startSample;
    const endOutputPos = startSample + sampleRate * freezeDuration;

    while (outputPos < endOutputPos && outputPos < outputLength) {
      // Random position within freeze buffer (with spray)
      const sprayOffset = (Math.random() - 0.5) * spraySamples;
      const grainStart = Math.floor(
        Math.random() * (freezeBufferSize - grainSizeSamples) + sprayOffset,
      );
      const safeGrainStart = Math.max(
        0,
        Math.min(freezeBufferSize - grainSizeSamples, grainStart),
      );

      // Apply pitch shift to grain
      const pitchRatio = Math.pow(2, (parameters.pitch || 0) / 12);
      const pitchedGrainSize = Math.floor(grainSizeSamples / pitchRatio);

      // Process grain
      for (let i = 0; i < grainSizeSamples; i++) {
        if (outputPos + i < outputLength) {
          let grainIndex = Math.floor(i * pitchRatio);

          // Reverse grain?
          if (Math.random() < (parameters.reverse || 0)) {
            grainIndex = pitchedGrainSize - 1 - grainIndex;
          }

          // Belt-and-suspenders bounds checking
          const idx = Math.max(
            0,
            Math.min(freezeBufferSize - 1, safeGrainStart + grainIndex),
          );
          if (idx < freezeBufferSize) {
            const sample = freezeBuffer[idx] * win[i];
            outputData[outputPos + i] += sample * 0.5; // Mix multiple grains
          }
        }
      }

      // Move to next grain position
      outputPos += grainSpacing;

      // Add some randomness to grain spacing
      outputPos += Math.floor((Math.random() - 0.5) * grainSpacing * 0.2);
    }

    // Fade out at the end
    const fadeLength = Math.floor(sampleRate * 0.1); // 100ms fade
    const fadeStart = endOutputPos - fadeLength;
    for (let i = 0; i < fadeLength; i++) {
      const fadePos = fadeStart + i;
      if (fadePos < outputLength) {
        outputData[fadePos] *= 1 - i / fadeLength;
      }
    }
  }

  return outputBuffer;
}

/**
 * Granular Freeze effect - captures and loops small grains of audio
 * Creates evolving textures and drones
 */
export default function GranularFreeze({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    granularGrainSize,
    setGranularGrainSize,
    granularPosition,
    setGranularPosition,
    granularSpray,
    setGranularSpray,
    granularPitch,
    setGranularPitch,
    granularDensity,
    setGranularDensity,
    granularReverse,
    setGranularReverse,
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

  // Apply granular freeze to selected region
  const applyGranularFreeze = useCallback(
    createEffectApplyFunction(processGranularFreezeRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        grainSize: granularGrainSize,
        position: granularPosition,
        spray: granularSpray,
        pitch: granularPitch,
        density: granularDensity,
        reverse: granularReverse
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, granularGrainSize, granularPosition, granularSpray, granularPitch, granularDensity, granularReverse, onApply]
  );

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GranularFreezeTooltips.grainSize}</Tooltip>}
          >
            <div>
              <Knob
                value={granularGrainSize}
                onChange={setGranularGrainSize}
                min={10}
                max={500}
                step={10}
                label="Grain Size"
                displayValue={`${granularGrainSize}ms`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <div>
            <Knob
              value={granularPosition}
              onChange={setGranularPosition}
              min={0}
              max={1}
              label="Position"
              displayValue={`${Math.round(granularPosition * 100)}%`}
              size={45}
              color="#7bafd4"
            />
          </div>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GranularFreezeTooltips.spread}</Tooltip>}
          >
            <div>
              <Knob
                value={granularSpray}
                onChange={setGranularSpray}
                min={0}
                max={200}
                step={5}
                label="Spray"
                displayValue={`${granularSpray}ms`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GranularFreezeTooltips.pitch}</Tooltip>}
          >
            <div>
              <Knob
                value={granularPitch}
                onChange={setGranularPitch}
                min={-24}
                max={24}
                step={1}
                label="Pitch"
                displayValue={`${granularPitch > 0 ? '+' : ''}${granularPitch}`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GranularFreezeTooltips.density}</Tooltip>}
          >
            <div>
              <Knob
                value={granularDensity}
                onChange={setGranularDensity}
                min={0.1}
                max={1}
                label="Density"
                displayValue={`${Math.round(granularDensity * 100)}%`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <div>
            <Knob
              value={granularReverse}
              onChange={setGranularReverse}
              min={0}
              max={1}
              label="Reverse"
              displayValue={`${Math.round(granularReverse * 100)}%`}
              size={45}
              color="#b999aa"
            />
          </div>
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyGranularFreeze}>
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
