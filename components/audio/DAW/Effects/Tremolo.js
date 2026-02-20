// components/audio/DAW/Effects/Tremolo.js
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const TremoloTooltips = {
  rate: "Speed of volume modulation. Slow rates (1-3Hz) create gentle pulsing, fast rates (8-15Hz) create vibrato-like effects. Classic tremolo is 4-6Hz.",
  depth: "Amount of volume variation. Higher values create more pronounced pulsing. 50-70% is natural, 80-100% creates dramatic on/off effects.",
  waveform: "Shape of modulation. Sine is smooth and natural, triangle is linear, square creates hard on/off pulses, sawtooth ramps up gradually.",
  phase: "Starting point of the waveform cycle. Use to sync tremolo with other effects or create rhythmic variations. 180° inverts the pulse.",
  tempoSync: "Locks tremolo rate to project tempo using musical note values. Essential for rhythmic tremolo effects that stay in time with your music."
};

/**
 * Generate LFO waveform for tremolo
 */
function generateLFOWaveform(
  type,
  sampleRate,
  lengthSamples,
  frequency,
  phase,
  depth,
) {
  const waveform = new Float32Array(lengthSamples);
  const phaseOffset = (phase / 360) * Math.PI * 2;

  for (let i = 0; i < lengthSamples; i++) {
    const t = (i / sampleRate) * frequency * Math.PI * 2 + phaseOffset;
    let modValue;

    switch (type) {
      case 'sine':
        modValue = Math.sin(t);
        break;

      case 'triangle':
        const normalized = (t / (Math.PI * 2)) % 1;
        modValue = 4 * Math.abs(normalized - 0.5) - 1;
        break;

      case 'square':
        modValue = Math.sin(t) > 0 ? 1 : -1;
        break;

      case 'sawtooth':
        modValue = 2 * ((t / (Math.PI * 2)) % 1) - 1;
        break;

      default:
        modValue = Math.sin(t);
    }

    // Convert to amplitude modulation (0 to 1 range)
    // depth controls how deep the modulation goes
    waveform[i] = 1 - (depth * (1 - modValue)) / 2;
  }

  return waveform;
}

/**
 * Process tremolo on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processTremoloRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Generate LFO for tremolo using exact sample count
  const lfoWaveform = generateLFOWaveform(
    parameters.waveform || 'sine',
    sampleRate,
    regionLength,
    parameters.rate || 5,
    parameters.phase || 0,
    parameters.depth || 0.5,
  );

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

    // Apply tremolo to region only
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      if (i < lfoWaveform.length) {
        // Safety check
        outputData[i] = inputData[sampleIndex] * lfoWaveform[i];
      }
    }
  }

  return outputBuffer;
}

/**
 * Tremolo effect component - amplitude modulation
 */
export default function Tremolo({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const {
    tremoloRate,
    setTremoloRate,
    tremoloDepth,
    setTremoloDepth,
    tremoloWaveform,
    setTremoloWaveform,
    tremoloPhase,
    setTremoloPhase,
    tremoloTempoSync,
    setTremoloTempoSync,
    tremoloNoteDivision,
    setTremoloNoteDivision,
    globalBPM,
    cutRegion,
  } = useEffects();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Calculate tempo-synced tremolo rate
  const getEffectiveRate = () => {
    if (tremoloTempoSync) {
      return (globalBPM / 60) * (4 / tremoloNoteDivision);
    }
    return tremoloRate;
  };

  // Apply tremolo to selected region
  const applyTremolo = useCallback(
    createEffectApplyFunction(processTremoloRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        rate: getEffectiveRate(),
        depth: tremoloDepth,
        waveform: tremoloWaveform,
        phase: tremoloPhase,
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, tremoloRate, tremoloDepth, tremoloWaveform, tremoloPhase, tremoloTempoSync, tremoloNoteDivision, globalBPM, onApply]
  );

  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' },
  ];

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Waveform selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Waveform</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{TremoloTooltips.waveform}</Tooltip>}
          >
            <Dropdown
              onSelect={(eventKey) => setTremoloWaveform(eventKey)}
              size="sm"
            >
              <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
                {waveformTypes.find((t) => t.key === tremoloWaveform)?.name ||
                  'Sine'}
              </Dropdown.Toggle>
              <Dropdown.Menu className="bg-daw-toolbars">
                {waveformTypes.map((type) => (
                  <Dropdown.Item
                    key={type.key}
                    eventKey={type.key}
                    className="text-white"
                  >
                    {type.name}
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
            overlay={<Tooltip>{TremoloTooltips.rate}</Tooltip>}
          >
            <div>
              <Knob
                value={tremoloRate}
                onChange={setTremoloRate}
                min={0.1}
                max={30}
                step={0.1}
                label="Rate"
                displayValue={`${tremoloRate.toFixed(1)}Hz`}
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
            overlay={<Tooltip>{TremoloTooltips.depth}</Tooltip>}
          >
            <div>
              <Knob
                value={tremoloDepth}
                onChange={setTremoloDepth}
                min={0}
                max={1}
                label="Depth"
                displayValue={`${Math.round(tremoloDepth * 100)}%`}
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
            overlay={<Tooltip>{TremoloTooltips.phase}</Tooltip>}
          >
            <div>
              <Knob
                value={tremoloPhase}
                onChange={setTremoloPhase}
                min={0}
                max={360}
                step={1}
                label="Phase"
                displayValue={`${tremoloPhase}°`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Tempo Sync Controls */}
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{TremoloTooltips.tempoSync}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="tremolo-tempo-sync"
                label="Sync"
                checked={tremoloTempoSync}
                onChange={(e) => setTremoloTempoSync(e.target.checked)}
                className="text-white"
              />
            </div>
          </OverlayTrigger>
          {tremoloTempoSync && (
            <Dropdown onSelect={(division) => setTremoloNoteDivision(Number(division))}>
              <Dropdown.Toggle size="sm" variant="outline-light">
                {tremoloNoteDivision === 1 ? 'Whole' : 
                 tremoloNoteDivision === 2 ? 'Half' :
                 tremoloNoteDivision === 4 ? 'Quarter' :
                 tremoloNoteDivision === 8 ? 'Eighth' :
                 tremoloNoteDivision === 16 ? 'Sixteenth' : 'Custom'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item eventKey="1">Whole Note</Dropdown.Item>
                <Dropdown.Item eventKey="2">Half Note</Dropdown.Item>
                <Dropdown.Item eventKey="4">Quarter Note</Dropdown.Item>
                <Dropdown.Item eventKey="8">Eighth Note</Dropdown.Item>
                <Dropdown.Item eventKey="16">Sixteenth Note</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyTremolo}>
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
