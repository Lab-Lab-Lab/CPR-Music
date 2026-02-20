'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Dropdown, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  useAudio,
  useEffects,
  useWaveform
} from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import { ReverbProcessor } from '../../../../lib/ReverbProcessor';
import { getPresetNames, impulseResponsePresets } from '../../../../lib/impulseResponses';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const ReverseReverbTooltips = {
  preset: "Choose reverb space character. Larger spaces (halls, chambers) create more dramatic swells. Smaller spaces (rooms) create tighter buildups.",
  buildup: "Duration of the pre-echo swell before the sound. Longer times (1-2s) create dramatic cinematic effects, shorter times (0.2-0.5s) add subtle tension.",
  mix: "Balance between dry signal and reverse reverb effect. Higher values create more pronounced swelling pre-echo. Use 50-80% for obvious effect.",
  fadeIn: "How quickly the reverse reverb fades in. Shorter fades create sudden swells, longer fades make the buildup more gradual and smooth.",
  preDelay: "Gap between the reverse reverb buildup and the original sound. Can be used to separate the swell from the attack for rhythmic effects."
};

/**
 * Process reverse reverb on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processReverseReverbRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Create reverb processor
  const reverbProcessor = new ReverbProcessor(audioContext);
  
  // Apply reverb parameters
  reverbProcessor.loadPreset(parameters.preset || 'mediumHall');
  reverbProcessor.setWetDryMix(parameters.wetMix || 0.7);
  reverbProcessor.setPreDelay(parameters.predelay || 0);
  
  // Extract region
  const regionBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const regionData = regionBuffer.getChannelData(channel);
    
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }
  }
  
  // Process region with reverb
  const reverbResult = await reverbProcessor.processRegion(
    regionBuffer,
    0,
    regionLength
  );
  
  // Reverse the reverb tail
  const reversedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    reverbResult.buffer.length,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const reverbData = reverbResult.buffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    
    // Reverse the audio
    for (let i = 0; i < reverbData.length; i++) {
      reversedData[i] = reverbData[reverbData.length - 1 - i];
    }
  }
  
  // Calculate buildup samples
  const buildupSamples = Math.floor((parameters.buildupTime || 0.5) * sampleRate);
  const fadeSamples = Math.floor((parameters.fadeTime || 0.1) * sampleRate);
  const predelaySamples = Math.floor((parameters.predelay || 0) / 1000 * sampleRate);

  // Create output buffer - same length as input, we overlay the reverse reverb
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);

    // First, copy all original audio
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i];
    }

    // Calculate where the reverse reverb should start and end
    const reverbEndPosition = startSample - predelaySamples;
    const reverbStartPosition = Math.max(0, reverbEndPosition - buildupSamples);
    const actualBuildupLength = reverbEndPosition - reverbStartPosition;

    // Only add reverse reverb if we have room before the region
    if (reverbStartPosition >= 0 && actualBuildupLength > 0) {
      // Find the tail portion of the reversed reverb to use
      const reverbTailStart = Math.max(0, reversedData.length - actualBuildupLength);

      for (let i = 0; i < actualBuildupLength; i++) {
        const outputIdx = reverbStartPosition + i;
        const reverbIdx = reverbTailStart + i;

        if (outputIdx >= 0 && outputIdx < outputData.length && reverbIdx < reversedData.length) {
          // Apply fade-in envelope
          const fadeProgress = i / Math.min(fadeSamples, actualBuildupLength);
          const envelope = Math.min(1, fadeProgress);

          // Mix reversed reverb with existing audio
          const dry = outputData[outputIdx];
          const wet = reversedData[reverbIdx] * envelope;
          outputData[outputIdx] = dry * (1 - parameters.wetMix) + wet * parameters.wetMix;
        }
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Reverse Reverb (Pre-verb) effect
 * Creates the supernatural effect of reverb that comes before the sound
 */
export default function ReverseReverb({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const reverbProcessorRef = useRef(null);
  
  // Parameters
  const [preset, setPreset] = useState('mediumHall');
  const [wetMix, setWetMix] = useState(0.7);
  const [fadeTime, setFadeTime] = useState(0.1);
  const [predelay, setPredelay] = useState(0);
  const [buildupTime, setBuildupTime] = useState(0.5);
  
  // Initialize audio context and reverb processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!reverbProcessorRef.current) {
      reverbProcessorRef.current = new ReverbProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update reverb parameters and apply preset parameters to knobs
  useEffect(() => {
    if (reverbProcessorRef.current) {
      reverbProcessorRef.current.loadPreset(preset);
      reverbProcessorRef.current.setWetDryMix(wetMix);
      reverbProcessorRef.current.setPreDelay(predelay);

      // Apply preset-specific reverse reverb parameters to knobs
      const presetData = impulseResponsePresets[preset];
      if (presetData && presetData.reverseParameters) {
        setWetMix(presetData.reverseParameters.wetMix);
        setFadeTime(presetData.reverseParameters.fadeTime);
        setPredelay(presetData.reverseParameters.predelay);
        setBuildupTime(presetData.reverseParameters.buildupTime);
      }
    }
  }, [preset]);
  
  // Apply reverse reverb
  const applyReverseReverb = useCallback(
    createEffectApplyFunction(processReverseReverbRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        preset,
        wetMix,
        fadeTime,
        predelay,
        buildupTime
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, preset, wetMix, fadeTime, predelay, buildupTime, onApply]
  );
  
  const presetNames = getPresetNames();
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Preset selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Reverb Type</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverseReverbTooltips.preset}</Tooltip>}
          >
            <Dropdown
              onSelect={(eventKey) => setPreset(eventKey)}
              size="sm"
            >
              <Dropdown.Toggle
                variant="secondary"
                size="sm"
                className="w-100"
              >
                {impulseResponsePresets[preset]?.name || 'Select Preset'}
              </Dropdown.Toggle>
              <Dropdown.Menu className="bg-daw-toolbars" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {presetNames.map(key => (
                  <Dropdown.Item
                    key={key}
                    eventKey={key}
                    className="text-white"
                  >
                    {impulseResponsePresets[key].name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </OverlayTrigger>
        </Col>

        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverseReverbTooltips.buildup}</Tooltip>}
          >
            <div>
              <Knob
                value={buildupTime}
                onChange={setBuildupTime}
                min={0.1}
                max={2}
                step={0.05}
                label="Buildup"
                displayValue={`${(buildupTime * 1000).toFixed(0)}ms`}
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
            overlay={<Tooltip>{ReverseReverbTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={wetMix}
                onChange={setWetMix}
                min={0}
                max={1}
                label="Mix"
                displayValue={`${Math.round(wetMix * 100)}%`}
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
            overlay={<Tooltip>{ReverseReverbTooltips.fadeIn}</Tooltip>}
          >
            <div>
              <Knob
                value={fadeTime}
                onChange={setFadeTime}
                min={0.01}
                max={0.5}
                step={0.01}
                label="Fade In"
                displayValue={`${(fadeTime * 1000).toFixed(0)}ms`}
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
            overlay={<Tooltip>{ReverseReverbTooltips.preDelay}</Tooltip>}
          >
            <div>
              <Knob
                value={predelay}
                onChange={setPredelay}
                min={0}
                max={100}
                step={1}
                label="Pre-Delay"
                displayValue={`${predelay}ms`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyReverseReverb}
          >
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