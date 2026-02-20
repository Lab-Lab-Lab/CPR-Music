/**
 * ClipFilter - Clip-based version of Filter effect
 * Adapted from single-track Filter for use with multitrack clip effects
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
const FilterTooltips = {
  type: "Filter shape: Lowpass removes highs, Highpass removes lows, Bandpass keeps middle, Notch removes middle, Peaking/Shelving boost/cut specific frequencies.",
  frequency: "Cutoff or center frequency. The point where the filter starts affecting the signal. Use your ears and the visualization to dial in the sweet spot.",
  resonance: "Emphasis at the cutoff frequency. Low Q (0.5-2) is subtle, medium Q (2-10) is musical, high Q (10+) creates ringing/whistling effects.",
  gain: "Boost or cut amount for Peaking, Low Shelf, and High Shelf filters. Doesn't affect other filter types.",
  lfoRate: "Speed of automatic frequency modulation. Slow rates create subtle movement, fast rates create vibrato-like effects.",
  lfoDepth: "Amount of frequency modulation. Higher values create more dramatic sweeps. Watch the visualization to see the modulation range.",
  lfoWaveform: "Shape of the modulation. Sine is smooth, Triangle is linear, Square jumps between extremes, Sawtooth ramps up/down.",
  tempoSync: "Lock LFO rate to song tempo using musical note divisions instead of Hz.",
  mix: "Blend between dry (unfiltered) and wet (filtered) signal. 100% is fully filtered, lower values preserve more of the original sound."
};

/**
 * Frequency Response Visualization
 */
function FrequencyResponseViz({ type, frequency, resonance, gain, lfoDepth, width = 400, height = 100 }) {
  const canvasRef = useRef(null);

  const drawResponse = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
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

    // Draw 0dB line
    ctx.strokeStyle = '#555';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw frequency response curve
    ctx.strokeStyle = '#7bafd4';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const Q = resonance;
    const centerFreq = frequency;

    for (let x = 0; x < w; x++) {
      // Logarithmic frequency scale (20Hz to 20kHz)
      const freq = 20 * Math.pow(1000, x / w);
      const ratio = freq / centerFreq;

      let magnitude = 0;

      switch (type) {
        case 'lowpass':
          magnitude = 1 / Math.sqrt(1 + Math.pow(ratio * Q, 2));
          break;
        case 'highpass':
          magnitude = ratio / Math.sqrt(1 + Math.pow(ratio * Q, 2));
          break;
        case 'bandpass':
          magnitude = (ratio * Q) / Math.sqrt(1 + Math.pow(ratio * Q - Q / ratio, 2));
          break;
        case 'notch':
          magnitude = Math.abs(1 - ratio) / Math.sqrt(1 + Math.pow(Q * (ratio - 1 / ratio), 2));
          break;
        case 'peaking':
          const A = Math.pow(10, gain / 40);
          magnitude = Math.sqrt((1 + Math.pow(A * Q * (ratio - 1 / ratio), 2)) / (1 + Math.pow(Q * (ratio - 1 / ratio), 2)));
          break;
        case 'lowshelf':
          const AL = Math.pow(10, gain / 40);
          magnitude = AL * Math.sqrt((AL * AL + 1) / (ratio * ratio + AL * AL));
          break;
        case 'highshelf':
          const AH = Math.pow(10, gain / 40);
          magnitude = Math.sqrt((ratio * ratio + AH * AH) / (ratio * ratio + 1));
          break;
        case 'allpass':
          magnitude = 1;
          break;
        default:
          magnitude = 1;
      }

      // Convert to dB and normalize
      const dB = 20 * Math.log10(Math.max(magnitude, 0.001));
      const y = h / 2 - (dB / 24) * (h / 2); // ±24dB range

      if (x === 0) {
        ctx.moveTo(x, Math.max(0, Math.min(h, y)));
      } else {
        ctx.lineTo(x, Math.max(0, Math.min(h, y)));
      }
    }
    ctx.stroke();

    // Draw cutoff frequency indicator
    const cutoffX = w * Math.log(centerFreq / 20) / Math.log(1000);
    ctx.strokeStyle = '#e75b5c';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, 0);
    ctx.lineTo(cutoffX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw LFO modulation range if depth > 0
    if (lfoDepth > 0) {
      const modRange = centerFreq * lfoDepth;
      const minFreq = Math.max(20, centerFreq - modRange);
      const maxFreq = Math.min(20000, centerFreq + modRange);
      const minX = w * Math.log(minFreq / 20) / Math.log(1000);
      const maxX = w * Math.log(maxFreq / 20) / Math.log(1000);

      ctx.fillStyle = 'rgba(146, 206, 132, 0.1)';
      ctx.fillRect(minX, 0, maxX - minX, h);
    }

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText('20Hz', 2, h - 2);
    ctx.fillText('20kHz', w - 35, h - 2);
    ctx.fillText(type.toUpperCase(), 5, 10);

  }, [type, frequency, resonance, gain, lfoDepth]);

  useEffect(() => {
    drawResponse();
  }, [drawResponse]);

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
 * Filter effect component - Clip-based version
 */
export default function ClipFilter({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [filterType, setFilterType] = useState(parameters?.filterType ?? 'lowpass');
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 1000);
  const [resonance, setResonance] = useState(parameters?.resonance ?? 1);
  const [gain, setGain] = useState(parameters?.gain ?? 0);
  const [lfoRate, setLfoRate] = useState(parameters?.lfoRate ?? 1);
  const [lfoDepth, setLfoDepth] = useState(parameters?.lfoDepth ?? 0);
  const [lfoWaveform, setLfoWaveform] = useState(parameters?.lfoWaveform ?? 'sine');
  const [tempoSync, setTempoSync] = useState(parameters?.tempoSync ?? false);
  const [noteDivision, setNoteDivision] = useState(parameters?.noteDivision ?? 4);
  const [mix, setMix] = useState(parameters?.mix ?? 1);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      filterType,
      frequency,
      resonance,
      gain,
      lfoRate,
      lfoDepth,
      lfoWaveform,
      tempoSync,
      noteDivision,
      mix
    });
  }, [filterType, frequency, resonance, gain, lfoRate, lfoDepth, lfoWaveform, tempoSync, noteDivision, mix, onParametersChange]);

  // Check if current filter type uses gain
  const usesGain = ['peaking', 'lowshelf', 'highshelf'].includes(filterType);

  return (
    <Container fluid className="p-2">
      {/* Frequency Response Visualization */}
      <Row className="mb-3">
        <Col>
          <FrequencyResponseViz
            type={filterType}
            frequency={frequency}
            resonance={resonance}
            gain={gain}
            lfoDepth={lfoDepth}
          />
        </Col>
      </Row>

      {/* Filter Type Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Filter Type</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{FilterTooltips.type}</Tooltip>}>
            <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="lowpass">Lowpass</option>
              <option value="highpass">Highpass</option>
              <option value="bandpass">Bandpass</option>
              <option value="notch">Notch</option>
              <option value="peaking">Peaking</option>
              <option value="lowshelf">Low Shelf</option>
              <option value="highshelf">High Shelf</option>
              <option value="allpass">All Pass</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.frequency}</Tooltip>}>
            <div>
              <Knob
                value={frequency}
                onChange={setFrequency}
                min={20}
                max={20000}
                step={1}
                label="Frequency"
                displayValue={frequency >= 1000 ? `${(frequency/1000).toFixed(1)}k` : `${Math.round(frequency)}Hz`}
                size={50}
                color="#7bafd4"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.resonance}</Tooltip>}>
            <div>
              <Knob
                value={resonance}
                onChange={setResonance}
                min={0.1}
                max={30}
                step={0.1}
                label="Resonance"
                displayValue={`${resonance.toFixed(1)}`}
                size={50}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {usesGain && (
          <Col xs={6} sm={4} md={2}>
            <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.gain}</Tooltip>}>
              <div>
                <Knob
                  value={gain}
                  onChange={setGain}
                  min={-20}
                  max={20}
                  step={0.1}
                  label="Gain"
                  displayValue={`${gain > 0 ? '+' : ''}${gain.toFixed(1)}dB`}
                  size={50}
                  color="#ffa500"
                />
              </div>
            </OverlayTrigger>
          </Col>
        )}

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.mix}</Tooltip>}>
            <div>
              <Knob
                value={mix}
                onChange={setMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(mix * 100)}%`}
                size={50}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* LFO Controls */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">LFO Modulation</div>
        </Col>
      </Row>

      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.lfoRate}</Tooltip>}>
            <div>
              <Knob
                value={lfoRate}
                onChange={setLfoRate}
                min={0.01}
                max={10}
                step={0.01}
                label="LFO Rate"
                displayValue={`${lfoRate.toFixed(2)}Hz`}
                size={45}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FilterTooltips.lfoDepth}</Tooltip>}>
            <div>
              <Knob
                value={lfoDepth}
                onChange={setLfoDepth}
                min={0}
                max={1}
                step={0.01}
                label="LFO Depth"
                displayValue={`${Math.round(lfoDepth * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={3}>
          <Form.Label className="text-white small">LFO Waveform</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{FilterTooltips.lfoWaveform}</Tooltip>}>
            <Form.Select value={lfoWaveform} onChange={(e) => setLfoWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="sine">Sine</option>
              <option value="triangle">Triangle</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={2} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="tempoSync"
            label="Tempo Sync"
            checked={tempoSync}
            onChange={(e) => setTempoSync(e.target.checked)}
            className="text-white"
          />
          <OverlayTrigger placement="top" overlay={<Tooltip>{FilterTooltips.tempoSync}</Tooltip>}>
            <span className="ms-2 text-info" style={{ cursor: 'help' }}>?</span>
          </OverlayTrigger>
        </Col>

        {tempoSync && (
          <Col xs={12} sm={4} md={2}>
            <Form.Label className="text-white small">Note Division</Form.Label>
            <Form.Select value={noteDivision} onChange={(e) => setNoteDivision(Number(e.target.value))} size="sm" className="bg-secondary text-white">
              <option value={1}>1/1</option>
              <option value={2}>1/2</option>
              <option value={4}>1/4</option>
              <option value={8}>1/8</option>
              <option value={16}>1/16</option>
              <option value={32}>1/32</option>
            </Form.Select>
          </Col>
        )}
      </Row>
    </Container>
  );
}
