/**
 * Clip EQ Effect
 *
 * Wrapper around the single-track EQ component to work with clip-based effects.
 * Uses the same visual interface but updates clip parameters instead of global state.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Badge,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

/**
 * Filter Types
 */
const FilterTypes = {
  peaking: { name: 'Bell', description: 'Peaking/Notching filter' },
  lowpass: { name: 'Low Pass', description: 'Removes frequencies above cutoff' },
  highpass: { name: 'High Pass', description: 'Removes frequencies below cutoff' },
  lowshelf: { name: 'Low Shelf', description: 'Boosts/cuts low frequencies' },
  highshelf: { name: 'High Shelf', description: 'Boosts/cuts high frequencies' },
  notch: { name: 'Notch', description: 'Narrow cut filter' },
  bandpass: { name: 'Band Pass', description: 'Allows only band to pass' }
};

/**
 * EQ Presets
 */
const EQPresets = {
  flat: {
    name: 'Flat (Default)',
    description: 'No EQ processing',
    bands: [
      { frequency: 60, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 150, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 0, q: 0.7, type: 'peaking', enabled: true }
    ],
    outputGain: 0
  },
  vocalPresence: {
    name: 'Vocal Presence',
    description: 'Enhance vocal clarity and presence',
    bands: [
      { frequency: 60, gain: 0, q: 1.0, type: 'highpass', enabled: true },
      { frequency: 150, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 1, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: 0
  },
  warmBass: {
    name: 'Warm Bass',
    description: 'Rich low-end enhancement',
    bands: [
      { frequency: 60, gain: 4, q: 0.7, type: 'lowshelf', enabled: true },
      { frequency: 150, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: -3, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: -2
  },
  brightAir: {
    name: 'Air & Brightness',
    description: 'Add sparkle and air to the mix',
    bands: [
      { frequency: 60, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 150, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 2, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: 0
  }
};

/**
 * Calculate frequency response for visualization
 */
function calculateFrequencyResponse(bands, sampleRate, numPoints = 512) {
  const frequencies = [];
  const magnitudes = [];

  for (let i = 0; i < numPoints; i++) {
    const freq = 20 * Math.pow(20000 / 20, i / (numPoints - 1));
    frequencies.push(freq);
  }

  frequencies.forEach(freq => {
    let totalGainDB = 0;

    bands.forEach(band => {
      if (band.enabled === false) return;

      const omega = 2 * Math.PI * band.frequency / sampleRate;
      const sin_omega = Math.sin(omega);
      const cos_omega = Math.cos(omega);
      const Q = band.q || 1;
      const A = Math.pow(10, band.gain / 40);
      const alpha = sin_omega / (2 * Q);

      let b0, b1, b2, a0, a1, a2;

      switch (band.type) {
        case 'peaking':
          b0 = 1 + alpha * A;
          b1 = -2 * cos_omega;
          b2 = 1 - alpha * A;
          a0 = 1 + alpha / A;
          a1 = -2 * cos_omega;
          a2 = 1 - alpha / A;
          break;

        case 'lowshelf':
          const sqrt2A = Math.sqrt(2 * A);
          const AmP1 = A + 1;
          const AmM1 = A - 1;
          const AmP1cos = AmP1 * cos_omega;
          const AmM1cos = AmM1 * cos_omega;

          b0 = A * (AmP1 - AmM1cos + sqrt2A * alpha);
          b1 = 2 * A * (AmM1 - AmP1cos);
          b2 = A * (AmP1 - AmM1cos - sqrt2A * alpha);
          a0 = AmP1 + AmM1cos + sqrt2A * alpha;
          a1 = -2 * (AmM1 + AmP1cos);
          a2 = AmP1 + AmM1cos - sqrt2A * alpha;
          break;

        case 'highshelf':
          const sqrt2A_hs = Math.sqrt(2 * A);
          const AmP1_hs = A + 1;
          const AmM1_hs = A - 1;
          const AmP1cos_hs = AmP1_hs * cos_omega;
          const AmM1cos_hs = AmM1_hs * cos_omega;

          b0 = A * (AmP1_hs + AmM1cos_hs + sqrt2A_hs * alpha);
          b1 = -2 * A * (AmM1_hs + AmP1cos_hs);
          b2 = A * (AmP1_hs + AmM1cos_hs - sqrt2A_hs * alpha);
          a0 = AmP1_hs - AmM1cos_hs + sqrt2A_hs * alpha;
          a1 = 2 * (AmM1_hs - AmP1cos_hs);
          a2 = AmP1_hs - AmM1cos_hs - sqrt2A_hs * alpha;
          break;

        case 'highpass':
          b0 = (1 + cos_omega) / 2;
          b1 = -(1 + cos_omega);
          b2 = (1 + cos_omega) / 2;
          a0 = 1 + alpha;
          a1 = -2 * cos_omega;
          a2 = 1 - alpha;
          break;

        case 'lowpass':
          b0 = (1 - cos_omega) / 2;
          b1 = 1 - cos_omega;
          b2 = (1 - cos_omega) / 2;
          a0 = 1 + alpha;
          a1 = -2 * cos_omega;
          a2 = 1 - alpha;
          break;

        case 'notch':
          b0 = 1;
          b1 = -2 * cos_omega;
          b2 = 1;
          a0 = 1 + alpha;
          a1 = -2 * cos_omega;
          a2 = 1 - alpha;
          break;

        case 'bandpass':
          b0 = alpha;
          b1 = 0;
          b2 = -alpha;
          a0 = 1 + alpha;
          a1 = -2 * cos_omega;
          a2 = 1 - alpha;
          break;

        default:
          b0 = 1; b1 = 0; b2 = 0;
          a0 = 1; a1 = 0; a2 = 0;
      }

      b0 /= a0;
      b1 /= a0;
      b2 /= a0;
      a1 /= a0;
      a2 /= a0;

      const w = 2 * Math.PI * freq / sampleRate;
      const cos_w = Math.cos(w);
      const sin_w = Math.sin(w);
      const cos_2w = Math.cos(2 * w);
      const sin_2w = Math.sin(2 * w);

      const num_real = b0 + b1 * cos_w + b2 * cos_2w;
      const num_imag = -b1 * sin_w - b2 * sin_2w;
      const den_real = 1 + a1 * cos_w + a2 * cos_2w;
      const den_imag = -a1 * sin_w - a2 * sin_2w;

      const den_mag_sq = den_real * den_real + den_imag * den_imag;
      const H_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
      const H_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

      const H_mag = Math.sqrt(H_real * H_real + H_imag * H_imag);
      const gainDB = 20 * Math.log10(Math.max(H_mag, 0.0001));

      totalGainDB += gainDB;
    });

    magnitudes.push(totalGainDB);
  });

  return { frequencies, magnitudes };
}

/**
 * Clip EQ Component
 */
export default function ClipEQ({ parameters, onParametersChange }) {
  const canvasRef = useRef(null);
  const [eqBands, setEqBands] = useState(parameters.bands || EQPresets.flat.bands);
  const [outputGain, setOutputGain] = useState(parameters.outputGain || 0);
  const [selectedBand, setSelectedBand] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState('flat');

  // Sync local state with parameters when they change externally
  useEffect(() => {
    if (parameters.bands) {
      setEqBands(parameters.bands);
    }
    if (parameters.outputGain !== undefined) {
      setOutputGain(parameters.outputGain);
    }
  }, [parameters]);

  // Update parent when bands change
  const updateBand = useCallback((index, updates) => {
    setEqBands(prev => {
      const newBands = prev.map((band, i) =>
        i === index ? { ...band, ...updates } : band
      );
      onParametersChange({ bands: newBands, outputGain });
      return newBands;
    });
  }, [onParametersChange, outputGain]);

  // Update output gain
  const handleOutputGainChange = useCallback((newGain) => {
    setOutputGain(newGain);
    onParametersChange({ bands: eqBands, outputGain: newGain });
  }, [onParametersChange, eqBands]);

  // Draw frequency response
  const drawFrequencyResponse = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqs.forEach(freq => {
      const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    for (let db = -24; db <= 24; db += 6) {
      const y = height / 2 - (db / 24) * (height / 2 - 20);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Response curve
    const { frequencies, magnitudes } = calculateFrequencyResponse(eqBands, 48000);

    ctx.strokeStyle = '#92ce84';
    ctx.lineWidth = 3;
    ctx.beginPath();

    frequencies.forEach((freq, i) => {
      const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      const y = height / 2 - (magnitudes[i] / 24) * (height / 2 - 20);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Band points
    eqBands.forEach((band, index) => {
      if (!band.enabled) return;

      const x = (Math.log10(band.frequency) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;

      let actualMagnitude = 0;
      for (let i = 0; i < frequencies.length - 1; i++) {
        if (frequencies[i] <= band.frequency && frequencies[i + 1] >= band.frequency) {
          const ratio = (band.frequency - frequencies[i]) / (frequencies[i + 1] - frequencies[i]);
          actualMagnitude = magnitudes[i] + (magnitudes[i + 1] - magnitudes[i]) * ratio;
          break;
        }
      }

      if (band.frequency <= frequencies[0]) {
        actualMagnitude = magnitudes[0];
      } else if (band.frequency >= frequencies[frequencies.length - 1]) {
        actualMagnitude = magnitudes[magnitudes.length - 1];
      }

      const y = height / 2 - (actualMagnitude / 24) * (height / 2 - 20);

      ctx.fillStyle = index === selectedBand ? '#ffff00' : '#92ce84';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [eqBands, selectedBand]);

  useEffect(() => {
    drawFrequencyResponse();
  }, [drawFrequencyResponse]);

  return (
    <Container fluid className="p-3">
      {/* Preset Selection */}
      <Row className="mb-3">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">
            <strong>EQ Preset</strong>
          </Form.Label>
          <Form.Select
            value={selectedPreset}
            onChange={(e) => {
              const presetKey = e.target.value;
              const preset = EQPresets[presetKey];
              if (preset) {
                setSelectedPreset(presetKey);
                setEqBands(preset.bands.map(band => ({ ...band })));
                setOutputGain(preset.outputGain);
                onParametersChange({ bands: preset.bands, outputGain: preset.outputGain });
              }
            }}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(EQPresets).map(([key, preset]) => (
              <option key={key} value={key}>{preset.name}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {/* EQ Graph */}
      <Row className="mb-4">
        <Col xs={12}>
          <div className="eq-graph-container position-relative bg-dark rounded p-2">
            <canvas
              ref={canvasRef}
              width={800}
              height={300}
              style={{
                width: '100%',
                height: '300px',
                imageRendering: 'crisp-edges'
              }}
            />
          </div>
        </Col>
      </Row>

      {/* Band Controls */}
      <Row className="mb-4">
        <Col xs={12}>
          <div className="d-flex gap-2 flex-wrap justify-content-center">
            {eqBands.map((band, index) => (
              <div
                key={index}
                className={`band-control text-center p-3 rounded ${selectedBand === index ? 'bg-primary bg-opacity-25 border border-primary' : 'bg-dark'
                  } ${!band.enabled ? 'opacity-50' : ''}`}
                onClick={() => setSelectedBand(index)}
                style={{ cursor: 'pointer', minWidth: '90px' }}
              >
                <div className="mb-2">
                  <Badge bg={band.enabled ? 'success' : 'secondary'}>
                    {index + 1}
                  </Badge>
                  <div className="text-white small fw-bold">
                    {band.frequency >= 1000 ? `${(band.frequency / 1000).toFixed(1)}k` : Math.round(band.frequency)}Hz
                  </div>
                </div>
                <Knob
                  value={band.gain}
                  onChange={(val) => updateBand(index, { gain: val })}
                  min={-24}
                  max={24}
                  step={0.5}
                  label=""
                  displayValue={`${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`}
                  size={60}
                  color={selectedBand === index ? '#ffd700' : (band.enabled ? '#92ce84' : '#666666')}
                />
                <Form.Check
                  type="switch"
                  id={`band-${index}`}
                  checked={band.enabled}
                  onChange={(e) => updateBand(index, { enabled: e.target.checked })}
                  label={band.enabled ? 'On' : 'Off'}
                  className="mt-2"
                />
              </div>
            ))}
          </div>
        </Col>
      </Row>

      {/* Selected Band Details */}
      {selectedBand >= 0 && (
        <Row className="border-top pt-3">
          <Col xs={12}>
            <h6 className="text-warning mb-3">Band {selectedBand + 1} Settings</h6>
            <Row>
              <Col xs={6} md={3}>
                <Form.Label className="text-white small">Filter Type</Form.Label>
                <Form.Select
                  size="sm"
                  value={eqBands[selectedBand].type}
                  onChange={(e) => updateBand(selectedBand, { type: e.target.value })}
                  className="bg-secondary text-white border-secondary"
                >
                  {Object.entries(FilterTypes).map(([key, filter]) => (
                    <option key={key} value={key}>{filter.name}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="text-white small">Frequency</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  value={eqBands[selectedBand].frequency}
                  onChange={(e) => updateBand(selectedBand, { frequency: parseFloat(e.target.value) })}
                  min={20}
                  max={20000}
                  className="bg-secondary text-white border-secondary"
                />
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="text-white small">Q Factor</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  value={eqBands[selectedBand].q}
                  onChange={(e) => updateBand(selectedBand, { q: parseFloat(e.target.value) })}
                  min={0.1}
                  max={10}
                  step={0.1}
                  className="bg-secondary text-white border-secondary"
                />
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="text-white small">Gain (dB)</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  value={eqBands[selectedBand].gain}
                  onChange={(e) => updateBand(selectedBand, { gain: parseFloat(e.target.value) })}
                  min={-24}
                  max={24}
                  step={0.5}
                  className="bg-secondary text-white border-secondary"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {/* Output Gain */}
      <Row className="mt-3 border-top pt-3">
        <Col xs={12} md={4}>
          <div className="text-center">
            <Form.Label className="text-white">Output Gain</Form.Label>
            <Knob
              value={outputGain}
              onChange={handleOutputGainChange}
              min={-12}
              max={12}
              step={0.1}
              label=""
              displayValue={`${outputGain > 0 ? '+' : ''}${outputGain.toFixed(1)}dB`}
              size={60}
              color="#ffd700"
            />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
