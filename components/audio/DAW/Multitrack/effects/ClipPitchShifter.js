/**
 * ClipPitchShifter - Clip-based version of PitchShifter effect
 * Adapted from single-track PitchShifter for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Knob from '../../../../Knob';

// Educational Tooltips
const PitchShifterTooltips = {
  pitch: "Amount of pitch shift in semitones. +12 is one octave up, -12 is one octave down. Use whole numbers for musical intervals, decimals for detuning.",
  cents: "Fine tuning in cents (100 cents = 1 semitone). Use for subtle detuning effects or precise pitch correction. ±50 cents creates chorus-like doubling.",
  formantPreserve: "Preserves vocal character when shifting pitch. Essential for natural-sounding vocal pitch correction. Disable for creative robotic effects.",
  quality: "Processing quality vs speed trade-off. High/Ultra for final mixes, Medium for real-time, Low for quick previews. Higher quality = less artifacts.",
  mix: "Balance between dry and wet signal. 100% replaces original pitch entirely. 50% creates harmony. Lower values add subtle pitch character."
};

/**
 * Quality Presets for Pitch Shifting
 *
 * Trade-offs between quality and performance:
 *
 * | Quality | FFT Size | Latency   | CPU Usage | Best For                    |
 * |---------|----------|-----------|-----------|-----------------------------
 * | Low     | 1024     | ~23ms     | Low       | Real-time preview, low-end  |
 * | Medium  | 2048     | ~46ms     | Medium    | Live monitoring, rehearsal  |
 * | High    | 4096     | ~93ms     | High      | Final mix, vocals, solo     |
 * | Ultra   | 8192     | ~186ms    | Very High | Critical vocals, mastering  |
 *
 * Notes:
 * - Larger FFT = better frequency resolution = fewer "chipmunk" artifacts
 * - Smaller FFT = faster processing = lower latency but more artifacts
 * - For vocals: Use High or Ultra with formant correction ON
 * - For instruments: Medium usually sufficient
 * - For real-time playback: Low or Medium recommended
 * - Ultra can cause audible delay, best for offline rendering
 *
 * Latency calculated at 44.1kHz: latency = fftSize / sampleRate
 */
const QualitySettings = {
  low: {
    name: 'Low (Fast)',
    fftSize: 1024,
    description: 'Low latency (~23ms), some artifacts. Good for previews.',
  },
  medium: {
    name: 'Medium',
    fftSize: 2048,
    description: 'Balanced (~46ms latency). Good for most instruments.',
  },
  high: {
    name: 'High',
    fftSize: 4096,
    description: 'High quality (~93ms). Recommended for vocals and final mix.',
  },
  ultra: {
    name: 'Ultra (Slow)',
    fftSize: 8192,
    description: 'Maximum quality (~186ms). Best for critical vocals/mastering.',
  },
};

/**
 * Pitch Shift Visualization
 */
function PitchShiftVisualization({ semitones, cents, formantCorrection, quality, width = 400, height = 150 }) {
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

    // Draw original pitch line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Draw shifted pitch line
    const totalCents = (semitones * 100) + cents;
    const pitchRatio = Math.pow(2, totalCents / 1200);

    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const shiftedY = h / 2 - (totalCents / 1200) * (h / 4);
    ctx.moveTo(0, shiftedY);
    ctx.lineTo(w, shiftedY);
    ctx.stroke();

    // Draw formant preservation indicator
    if (formantCorrection) {
      ctx.strokeStyle = '#7bafd4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      for (let i = 1; i <= 3; i++) {
        const formantY = h - (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, formantY);
        ctx.lineTo(w, formantY);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Pitch: ${semitones > 0 ? '+' : ''}${semitones}st ${cents > 0 ? '+' : ''}${cents}¢`, 10, 20);
    ctx.fillText(`Ratio: ${pitchRatio.toFixed(3)}x`, 10, 35);

    if (formantCorrection) {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText('Formant Preservation: ON', 10, 50);
    }

    // Draw quality indicator
    ctx.fillStyle = '#cbb677';
    ctx.fillText(`Quality: ${QualitySettings[quality]?.name || 'Unknown'}`, 10, h - 10);

  }, [semitones, cents, formantCorrection, quality]);

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
 * PitchShifter effect component - Clip-based version
 */
export default function ClipPitchShifter({ parameters, onParametersChange }) {
  // Initialize all 12 parameters from props
  const [semitones, setSemitones] = useState(parameters?.semitones ?? 0);
  const [cents, setCents] = useState(parameters?.cents ?? 0);
  const [formantShift, setFormantShift] = useState(parameters?.formantShift ?? 0);
  const [formantCorrection, setFormantCorrection] = useState(parameters?.formantCorrection ?? true);
  const [preserveTimbre, setPreserveTimbre] = useState(parameters?.preserveTimbre ?? true);
  const [stretch, setStretch] = useState(parameters?.stretch ?? 1.0);
  const [wetMix, setWetMix] = useState(parameters?.wetMix ?? 1.0);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);
  const [quality, setQuality] = useState(parameters?.quality ?? 'high');
  const [grainSize, setGrainSize] = useState(parameters?.grainSize ?? 2048);
  const [overlap, setOverlap] = useState(parameters?.overlap ?? 0.75);
  const [pan, setPan] = useState(parameters?.pan ?? 0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      semitones,
      cents,
      formantShift,
      formantCorrection,
      preserveTimbre,
      stretch,
      wetMix,
      outputGain,
      quality,
      grainSize,
      overlap,
      pan
    });
  }, [semitones, cents, formantShift, formantCorrection, preserveTimbre, stretch, wetMix, outputGain, quality, grainSize, overlap, pan, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Pitch Shift Visualization */}
      <Row className="mb-3">
        <Col>
          <PitchShiftVisualization
            semitones={semitones}
            cents={cents}
            formantCorrection={formantCorrection}
            quality={quality}
          />
        </Col>
      </Row>

      {/* Quality and Mode Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Quality</Form.Label>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{PitchShifterTooltips.quality}</Tooltip>}>
            <Form.Select value={quality} onChange={(e) => setQuality(e.target.value)} size="sm" className="bg-secondary text-white">
              {Object.entries(QualitySettings).map(([key, setting]) => (
                <option key={key} value={key}>{setting.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} md={6} className="d-flex align-items-end">
          <OverlayTrigger placement="top" overlay={<Tooltip>{PitchShifterTooltips.formantPreserve}</Tooltip>}>
            <div>
              <Form.Check
                type="checkbox"
                id="formant-correction"
                label="Formant Correction"
                checked={formantCorrection}
                onChange={(e) => setFormantCorrection(e.target.checked)}
                className="text-white"
              />
              <Form.Check
                type="checkbox"
                id="preserve-timbre"
                label="Preserve Timbre"
                checked={preserveTimbre}
                onChange={(e) => setPreserveTimbre(e.target.checked)}
                className="text-white mt-1"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Main Pitch Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{PitchShifterTooltips.pitch}</Tooltip>}>
            <div>
              <Knob
                value={semitones}
                onChange={setSemitones}
                min={-24}
                max={24}
                step={1}
                label="Semitones"
                displayValue={`${semitones > 0 ? '+' : ''}${semitones}`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{PitchShifterTooltips.cents}</Tooltip>}>
            <div>
              <Knob
                value={cents}
                onChange={setCents}
                min={-100}
                max={100}
                step={1}
                label="Fine Tune"
                displayValue={`${cents > 0 ? '+' : ''}${cents}¢`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={formantShift}
            onChange={setFormantShift}
            min={-12}
            max={12}
            step={0.1}
            label="Formant"
            displayValue={`${formantShift > 0 ? '+' : ''}${formantShift.toFixed(1)}st`}
            size={50}
            color="#cbb677"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stretch}
            onChange={setStretch}
            min={0.25}
            max={4.0}
            step={0.01}
            label="Stretch"
            displayValue={`${stretch.toFixed(2)}x`}
            size={50}
            color="#dda0dd"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{PitchShifterTooltips.mix}</Tooltip>}>
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
            value={grainSize}
            onChange={setGrainSize}
            min={512}
            max={8192}
            step={512}
            label="Grain Size"
            displayValue={`${grainSize}`}
            size={45}
            color="#92ce84"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={overlap}
            onChange={setOverlap}
            min={0.25}
            max={0.875}
            step={0.125}
            label="Overlap"
            displayValue={`${Math.round(overlap * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pan}
            onChange={setPan}
            min={-1}
            max={1}
            step={0.01}
            label="Pan"
            displayValue={pan === 0 ? 'Center' : (pan > 0 ? `${Math.round(pan * 100)}% R` : `${Math.round(-pan * 100)}% L`)}
            size={45}
            color="#dda0dd"
          />
        </Col>
      </Row>
    </Container>
  );
}
