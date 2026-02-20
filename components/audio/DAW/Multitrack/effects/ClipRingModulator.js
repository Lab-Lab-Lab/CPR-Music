/**
 * ClipRingModulator - Clip-based version of RingModulator effect
 * Adapted from single-track RingModulator for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Knob from '../../../../Knob';

// Educational tooltips
const RingModulatorTooltips = {
  frequency: "Modulation frequency. Low frequencies (20-200Hz) create tremolo-like effects, mid (200-800Hz) create metallic tones, high (1-5kHz) create bell-like sounds.",
  depth: "Amount of modulation. 100% is full ring modulation (classic effect), lower values blend with original tone for subtler metallic shimmer.",
  waveform: "Modulator waveform shape. Sine creates smooth, musical tones. Square creates harsh, digital effects. Triangle and sawtooth create unique harmonic content.",
  mode: "Modulation algorithm. Classic is traditional ring mod (sum/difference frequencies), Amplitude is cleaner, Frequency creates FM-like effects, Sync creates locked harmonics.",
  mix: "Balance between dry and wet signal. Ring modulation completely transforms sound, so lower values (30-60%) often sound more musical than 100%."
};

// Ring modulation modes
const RingModModes = {
  classic: {
    name: 'Classic Ring Mod',
    description: 'Traditional ring modulation (amplitude modulation)'
  },
  frequency: {
    name: 'Frequency Mod',
    description: 'Frequency modulation effects'
  },
  amplitude: {
    name: 'Amplitude Mod',
    description: 'Clean amplitude modulation with DC offset'
  },
  sync: {
    name: 'Sync Mod',
    description: 'Frequency-locked modulation'
  }
};

/**
 * Ring Modulation Waveform Visualization
 */
function RingModVisualization({ frequency, waveform, depth, mode, offset, width = 400, height = 150 }) {
  const canvasRef = useRef(null);

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw carrier frequency waveform
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const cycles = 4;
    const carrierFreq = frequency + offset;

    for (let x = 0; x < w; x++) {
      const t = (x / w) * cycles * Math.PI * 2;
      let y;

      switch (waveform) {
        case 'sine':
          y = Math.sin(t);
          break;
        case 'triangle':
          y = Math.asin(Math.sin(t)) * (2 / Math.PI);
          break;
        case 'square':
          y = Math.sign(Math.sin(t));
          break;
        case 'sawtooth':
          y = 2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5));
          break;
        default:
          y = Math.sin(t);
      }

      y = (h / 2) - (y * depth * h / 4);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw modulation envelope
    if (mode !== 'classic') {
      ctx.strokeStyle = '#7bafd4';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const envelope = Math.sin((x / w) * Math.PI) * depth;
        const y = (h / 2) - (envelope * h / 4);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Freq: ${carrierFreq >= 1000 ? `${(carrierFreq/1000).toFixed(1)}kHz` : `${carrierFreq}Hz`}`, 10, 20);
    ctx.fillText(`Mode: ${RingModModes[mode]?.name || 'Classic'}`, 10, 35);

  }, [frequency, waveform, depth, mode, offset]);

  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', height: `${height}px`, backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}
    />
  );
}

/**
 * RingModulator effect component - Clip-based version
 */
export default function ClipRingModulator({ parameters, onParametersChange }) {
  // Initialize all 12 parameters from props
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 440);
  const [waveform, setWaveform] = useState(parameters?.waveform ?? 'sine');
  const [depth, setDepth] = useState(parameters?.depth ?? 1.0);
  const [mode, setMode] = useState(parameters?.mode ?? 'classic');
  const [sync, setSync] = useState(parameters?.sync ?? false);
  const [offset, setOffset] = useState(parameters?.offset ?? 0);
  const [phase, setPhase] = useState(parameters?.phase ?? 0);
  const [filterFreq, setFilterFreq] = useState(parameters?.filterFreq ?? 20000);
  const [filterType, setFilterType] = useState(parameters?.filterType ?? 'none');
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);
  const [stereoSpread, setStereoSpread] = useState(parameters?.stereoSpread ?? 0);
  const [wetMix, setWetMix] = useState(parameters?.wetMix ?? 1.0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      frequency,
      waveform,
      depth,
      mode,
      sync,
      offset,
      phase,
      filterFreq,
      filterType,
      outputGain,
      stereoSpread,
      wetMix
    });
  }, [frequency, waveform, depth, mode, sync, offset, phase, filterFreq, filterType, outputGain, stereoSpread, wetMix, onParametersChange]);

  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' },
    { key: 'noise', name: 'Noise' }
  ];

  const filterTypes = [
    { key: 'none', name: 'No Filter' },
    { key: 'lowpass', name: 'Low Pass' },
    { key: 'highpass', name: 'High Pass' },
    { key: 'bandpass', name: 'Band Pass' }
  ];

  return (
    <Container fluid className="p-2">
      {/* Ring Modulation Visualization */}
      <Row className="mb-3">
        <Col>
          <RingModVisualization
            frequency={frequency}
            waveform={waveform}
            depth={depth}
            mode={mode}
            offset={offset}
          />
        </Col>
      </Row>

      {/* Mode and Waveform Selection */}
      <Row className="mb-2">
        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Mode</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{RingModulatorTooltips.mode}</Tooltip>}>
            <Form.Select value={mode} onChange={(e) => setMode(e.target.value)} size="sm" className="bg-secondary text-white">
              {Object.entries(RingModModes).map(([key, modeObj]) => (
                <option key={key} value={key}>{modeObj.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
          <small className="text-muted">{RingModModes[mode]?.description}</small>
        </Col>

        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{RingModulatorTooltips.waveform}</Tooltip>}>
            <Form.Select value={waveform} onChange={(e) => setWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
              {waveformTypes.map(type => (
                <option key={type.key} value={type.key}>{type.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Filter</Form.Label>
          <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)} size="sm" className="bg-secondary text-white">
            {filterTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{RingModulatorTooltips.frequency}</Tooltip>}>
            <div>
              <Knob
                value={frequency}
                onChange={setFrequency}
                min={0.1}
                max={8000}
                step={0.1}
                label="Frequency"
                displayValue={frequency >= 1000 ? `${(frequency/1000).toFixed(1)}k` : `${frequency.toFixed(1)}Hz`}
                size={50}
                color="#e75b5c"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{RingModulatorTooltips.depth}</Tooltip>}>
            <div>
              <Knob
                value={depth}
                onChange={setDepth}
                min={0}
                max={1}
                step={0.01}
                label="Depth"
                displayValue={`${Math.round(depth * 100)}%`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={offset}
            onChange={setOffset}
            min={-1000}
            max={1000}
            step={1}
            label="Offset"
            displayValue={`${offset > 0 ? '+' : ''}${offset}Hz`}
            size={50}
            color="#cbb677"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={phase}
            onChange={setPhase}
            min={0}
            max={360}
            step={1}
            label="Phase"
            displayValue={`${phase}°`}
            size={50}
            color="#dda0dd"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{RingModulatorTooltips.mix}</Tooltip>}>
            <div>
              <Knob
                value={wetMix}
                onChange={setWetMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(wetMix * 100)}%`}
                size={50}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={outputGain}
            onChange={setOutputGain}
            min={0}
            max={2}
            step={0.01}
            label="Output"
            displayValue={`${outputGain.toFixed(2)}x`}
            size={50}
            color="#ffa500"
          />
        </Col>
      </Row>

      {/* Advanced Controls */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Advanced Controls</div>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={filterFreq}
            onChange={setFilterFreq}
            min={20}
            max={20000}
            step={10}
            label="Filter Freq"
            displayValue={filterFreq >= 1000 ? `${(filterFreq/1000).toFixed(1)}k` : `${filterFreq}Hz`}
            size={45}
            color="#7bafd4"
            logarithmic={true}
            disabled={filterType === 'none'}
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoSpread}
            onChange={setStereoSpread}
            min={0}
            max={1}
            step={0.01}
            label="Stereo"
            displayValue={`${Math.round(stereoSpread * 100)}%`}
            size={45}
            color="#dda0dd"
          />
        </Col>

        <Col xs={6} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="freq-sync"
            label="Frequency Sync"
            checked={sync}
            onChange={(e) => setSync(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>
    </Container>
  );
}
