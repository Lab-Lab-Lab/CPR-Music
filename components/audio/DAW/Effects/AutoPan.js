'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const AutoPanTooltips = {
  rate: "Speed of panning movement. Slow rates (0.1-0.5Hz) create gentle stereo sweeps, fast rates (2-5Hz) create rhythmic bouncing effects.",
  depth: "Amount of stereo movement. Higher values move sound further between left and right. 100% creates full left-to-right panning.",
  waveform: "Shape of panning motion. Sine creates smooth sweeps, triangle is linear, square creates hard jumps, sawtooth ramps gradually.",
  phase: "Starting position of panning cycle. 0° starts center, 90° starts left/right, 180° inverts the pattern. Use to create stereo width variations.",
  tempoSync: "Locks panning rate to project tempo using musical note divisions. Essential for rhythmic auto-pan that stays in time with your music."
};

/**
 * Generate LFO waveform
 */
function generateLFOWaveform(type, sampleRate, duration, frequency, phase) {
  const samples = Math.floor(sampleRate * duration);
  const waveform = new Float32Array(samples);
  const phaseOffset = (phase / 360) * Math.PI * 2;

  for (let i = 0; i < samples; i++) {
    const t = (i / sampleRate) * frequency * Math.PI * 2 + phaseOffset;

    switch (type) {
      case 'sine':
        waveform[i] = Math.sin(t);
        break;

      case 'triangle':
        // Triangle wave formula
        const normalized = (t / (Math.PI * 2)) % 1;
        waveform[i] = 4 * Math.abs(normalized - 0.5) - 1;
        break;

      case 'square':
        waveform[i] = Math.sin(t) > 0 ? 1 : -1;
        break;

      case 'sawtooth':
        // Sawtooth wave formula
        waveform[i] = 2 * ((t / (Math.PI * 2)) % 1) - 1;
        break;

      default:
        waveform[i] = Math.sin(t);
    }
  }

  return waveform;
}

/**
 * Process auto-pan on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processAutoPanRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = (endSample - startSample) / sampleRate;

  // Generate LFO for panning
  const lfoWaveform = generateLFOWaveform(
    parameters.waveform || 'sine',
    sampleRate,
    regionDuration,
    parameters.rate || 1,
    parameters.phase || 0,
  );

  // Create output buffer with region length only
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate,
  );

  // Process audio
  if (audioBuffer.numberOfChannels === 2) {
    // Stereo processing
    const leftIn = audioBuffer.getChannelData(0);
    const rightIn = audioBuffer.getChannelData(1);
    const leftOut = outputBuffer.getChannelData(0);
    const rightOut = outputBuffer.getChannelData(1);

    // Apply auto-pan to region only
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      const lfoValue = lfoWaveform[i] * (parameters.depth || 1);

      // Calculate pan values (constant power panning)
      const panValue = (lfoValue + 1) / 2; // Convert from -1...1 to 0...1
      const leftGain = Math.cos((panValue * Math.PI) / 2);
      const rightGain = Math.sin((panValue * Math.PI) / 2);

      const originalLeft = leftIn[sampleIndex];
      const originalRight = rightIn[sampleIndex];

      // Preserve stereo information: scale each channel instead of collapsing to mono
      leftOut[i] = originalLeft * leftGain;
      rightOut[i] = originalRight * rightGain;
    }
  } else {
    // Mono processing - just copy region
    const monoIn = audioBuffer.getChannelData(0);
    const monoOut = outputBuffer.getChannelData(0);

    // Copy region data
    for (let i = 0; i < regionLength; i++) {
      monoOut[i] = monoIn[startSample + i];
    }

    console.warn(
      'Auto-pan works best with stereo audio. Mono audio will be unchanged.',
    );
  }

  return outputBuffer;
}

/**
 * Auto-Pan effect component using Web Audio API StereoPannerNode
 */
export default function AutoPan({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    autoPanRate,
    setAutoPanRate,
    autoPanDepth,
    setAutoPanDepth,
    autoPanWaveform,
    setAutoPanWaveform,
    autoPanPhase,
    setAutoPanPhase,
    autoPanTempoSync,
    setAutoPanTempoSync,
    autoPanNoteDivision,
    setAutoPanNoteDivision,
    globalBPM,
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

  // Calculate tempo-synced auto-pan rate
  const getEffectiveRate = () => {
    if (autoPanTempoSync) {
      return (globalBPM / 60) * (4 / autoPanNoteDivision);
    }
    return autoPanRate;
  };

  // Apply auto-pan to selected region
  const applyAutoPan = useCallback(
    createEffectApplyFunction(processAutoPanRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        rate: getEffectiveRate(),
        depth: autoPanDepth,
        waveform: autoPanWaveform,
        phase: autoPanPhase,
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, autoPanRate, autoPanDepth,
      autoPanWaveform, autoPanPhase, autoPanTempoSync, autoPanNoteDivision, globalBPM, onApply]
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
            overlay={<Tooltip>{AutoPanTooltips.waveform}</Tooltip>}
          >
            <Dropdown
              onSelect={(eventKey) => setAutoPanWaveform(eventKey)}
              size="sm"
            >
              <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
                {waveformTypes.find((t) => t.key === autoPanWaveform)?.name ||
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
            overlay={<Tooltip>{AutoPanTooltips.rate}</Tooltip>}
          >
            <div>
              <Knob
                value={autoPanRate}
                onChange={setAutoPanRate}
                min={0.1}
                max={20}
                step={0.1}
                label="Rate"
                displayValue={`${autoPanRate.toFixed(1)}Hz`}
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
            overlay={<Tooltip>{AutoPanTooltips.depth}</Tooltip>}
          >
            <div>
              <Knob
                value={autoPanDepth}
                onChange={setAutoPanDepth}
                min={0}
                max={1}
                label="Depth"
                displayValue={`${Math.round(autoPanDepth * 100)}%`}
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
            overlay={<Tooltip>{AutoPanTooltips.phase}</Tooltip>}
          >
            <div>
              <Knob
                value={autoPanPhase}
                onChange={setAutoPanPhase}
                min={0}
                max={360}
                step={1}
                label="Phase"
                displayValue={`${autoPanPhase}°`}
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
            overlay={<Tooltip>{AutoPanTooltips.tempoSync}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="auto-pan-tempo-sync"
                label="Sync"
                checked={autoPanTempoSync}
                onChange={(e) => setAutoPanTempoSync(e.target.checked)}
                className="text-white"
              />
            </div>
          </OverlayTrigger>
          {autoPanTempoSync && (
            <Dropdown onSelect={(division) => setAutoPanNoteDivision(Number(division))}>
              <Dropdown.Toggle size="sm" variant="outline-light">
                {autoPanNoteDivision === 1 ? 'Whole' : 
                 autoPanNoteDivision === 2 ? 'Half' :
                 autoPanNoteDivision === 4 ? 'Quarter' :
                 autoPanNoteDivision === 8 ? 'Eighth' :
                 autoPanNoteDivision === 16 ? 'Sixteenth' : 'Custom'}
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
          <Button size="sm" className="w-100" onClick={applyAutoPan}>
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
