/**
 * ClipAutoWah - Clip-based version of AutoWah effect
 * Adapted from single-track AutoWah for use with multitrack clip effects
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
const AutoWahTooltips = {
  mode: "Control method: Envelope follows input dynamics (classic wah), LFO creates rhythmic sweeps, Manual locks frequency, Hybrid combines envelope + LFO.",
  sensitivity: "How responsive the envelope follower is to input level. Higher values create more dramatic sweeps from quieter signals.",
  frequency: "Center frequency of the filter sweep. Lower frequencies (200-800Hz) create deep wah, higher (1-3kHz) create vocal-like effects.",
  resonance: "Emphasis at the swept frequency (Q factor). Higher values create more pronounced, vocal-like wah. Use sparingly (2-8) to avoid harshness.",
  range: "Width of the frequency sweep in semitones. Wider ranges (12-24) create dramatic effects, narrow ranges (6-12) are subtle.",
  filterType: "Filter shape: Bandpass is classic wah, Lowpass is muffled wah, Highpass is thin wah, Peaking creates vowel-like sounds.",
  lfoRate: "Speed of LFO modulation (in LFO or Hybrid mode). Slow rates (0.5-2Hz) create smooth sweeps, fast rates (4-8Hz) create tremolo-like effects.",
  lfoDepth: "Amount of LFO modulation (in LFO or Hybrid mode). Controls how much the filter frequency varies with the LFO.",
  mix: "Balance between dry and wet signal. Lower values (20-40%) preserve original tone, higher values (60-80%) emphasize the wah effect."
};

/**
 * Frequency Response Visualization with Modulation History
 */
function AutoWahVisualization({ mode, filterType, frequency, q, range, width = 300, height = 100 }) {
  const canvasRef = useRef(null);

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Draw frequency response
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      // Logarithmic frequency scale (20Hz to 20kHz)
      const freq = 20 * Math.pow(1000, x / w);
      const ratio = freq / frequency;

      let magnitude = 0;

      switch (filterType) {
        case 'bandpass':
          magnitude = (ratio * q) / Math.sqrt(1 + Math.pow(ratio * q - q / ratio, 2));
          break;
        case 'lowpass':
          magnitude = 1 / Math.sqrt(1 + Math.pow(ratio * q, 2));
          break;
        case 'highpass':
          magnitude = ratio / Math.sqrt(1 + Math.pow(ratio * q, 2));
          break;
        case 'peaking':
          const A = 2; // Fixed gain for visualization
          magnitude = Math.sqrt((1 + Math.pow(A * q * (ratio - 1 / ratio), 2)) / (1 + Math.pow(q * (ratio - 1 / ratio), 2)));
          break;
        default:
          magnitude = 1;
      }

      // Convert to dB and normalize
      const dB = 20 * Math.log10(Math.max(magnitude, 0.001));
      const y = h - ((dB + 40) / 80) * h; // -40dB to +40dB range

      if (x === 0) {
        ctx.moveTo(x, Math.max(0, Math.min(h, y)));
      } else {
        ctx.lineTo(x, Math.max(0, Math.min(h, y)));
      }
    }
    ctx.stroke();

    // Draw current filter frequency indicator
    const currentFreqX = w * Math.log(frequency / 20) / Math.log(1000);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(currentFreqX, 0);
    ctx.lineTo(currentFreqX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw frequency range (sweep range)
    if (range > 0) {
      const minFreq = Math.max(20, frequency - range / 2);
      const maxFreq = Math.min(20000, frequency + range / 2);
      const minX = w * Math.log(minFreq / 20) / Math.log(1000);
      const maxX = w * Math.log(maxFreq / 20) / Math.log(1000);

      ctx.fillStyle = 'rgba(255, 165, 0, 0.1)';
      ctx.fillRect(minX, 0, maxX - minX, h);
    }

    // Mode indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText(`Mode: ${mode.toUpperCase()}`, 5, 12);
    ctx.fillText(`Filter: ${filterType}`, 5, 24);

  }, [mode, filterType, frequency, q, range]);

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
 * AutoWah effect component - Clip-based version
 */
export default function ClipAutoWah({ parameters, onParametersChange }) {
  // Initialize all 18 parameters from props
  const [mode, setMode] = useState(parameters?.mode ?? 'envelope');
  const [filterType, setFilterType] = useState(parameters?.filterType ?? 'bandpass');
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 500);
  const [range, setRange] = useState(parameters?.range ?? 2000);
  const [sensitivity, setSensitivity] = useState(parameters?.sensitivity ?? 0.5);
  const [q, setQ] = useState(parameters?.q ?? 5);
  const [attack, setAttack] = useState(parameters?.attack ?? 0.01);
  const [release, setRelease] = useState(parameters?.release ?? 0.1);
  const [lfoRate, setLfoRate] = useState(parameters?.lfoRate ?? 0.5);
  const [lfoDepth, setLfoDepth] = useState(parameters?.lfoDepth ?? 0.5);
  const [lfoWaveform, setLfoWaveform] = useState(parameters?.lfoWaveform ?? 'sine');
  const [lfoTempoSync, setLfoTempoSync] = useState(parameters?.lfoTempoSync ?? false);
  const [lfoNoteDiv, setLfoNoteDiv] = useState(parameters?.lfoNoteDiv ?? 4);
  const [lfoPhase, setLfoPhase] = useState(parameters?.lfoPhase ?? 0);
  const [hybridBalance, setHybridBalance] = useState(parameters?.hybridBalance ?? 0.5);
  const [mix, setMix] = useState(parameters?.mix ?? 1.0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      mode,
      filterType,
      frequency,
      range,
      sensitivity,
      q,
      attack,
      release,
      lfoRate,
      lfoDepth,
      lfoWaveform,
      lfoTempoSync,
      lfoNoteDiv,
      lfoPhase,
      hybridBalance,
      mix
    });
  }, [mode, filterType, frequency, range, sensitivity, q, attack, release, lfoRate, lfoDepth, lfoWaveform, lfoTempoSync, lfoNoteDiv, lfoPhase, hybridBalance, mix, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-3">
        <Col>
          <AutoWahVisualization
            mode={mode}
            filterType={filterType}
            frequency={frequency}
            q={q}
            range={range}
          />
        </Col>
      </Row>

      {/* Mode and Filter Type Selection */}
      <Row className="mb-2">
        <Col xs={12} sm={6} md={3}>
          <Form.Label className="text-white small">Mode</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{AutoWahTooltips.mode}</Tooltip>}>
            <Form.Select value={mode} onChange={(e) => setMode(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="envelope">Envelope</option>
              <option value="lfo">LFO</option>
              <option value="manual">Manual</option>
              <option value="hybrid">Hybrid</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Form.Label className="text-white small">Filter Type</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{AutoWahTooltips.filterType}</Tooltip>}>
            <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="bandpass">Band Pass</option>
              <option value="lowpass">Low Pass</option>
              <option value="highpass">High Pass</option>
              <option value="peaking">Peaking</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Core Filter Controls - Always visible */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.frequency}</Tooltip>}>
            <div>
              <Knob
                value={frequency}
                onChange={setFrequency}
                min={200}
                max={4000}
                step={10}
                label="Base Freq"
                displayValue={frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}k` : `${frequency}Hz`}
                size={50}
                color="#e75b5c"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.range}</Tooltip>}>
            <div>
              <Knob
                value={range}
                onChange={setRange}
                min={100}
                max={5000}
                step={50}
                label="Range"
                displayValue={range >= 1000 ? `${(range / 1000).toFixed(1)}k` : `${range}Hz`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.resonance}</Tooltip>}>
            <div>
              <Knob
                value={q}
                onChange={setQ}
                min={0.5}
                max={20}
                step={0.1}
                label="Resonance"
                displayValue={`${q.toFixed(1)}`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.mix}</Tooltip>}>
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
                color="#8e44ad"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Envelope Controls - Show when mode is envelope or hybrid */}
      {(mode === 'envelope' || mode === 'hybrid') && (
        <>
          <Row className="mb-2">
            <Col xs={12}>
              <div className="text-white small mb-2">Envelope Follower</div>
            </Col>
          </Row>

          <Row className="text-center align-items-end mb-2">
            <Col xs={6} sm={4} md={2}>
              <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.sensitivity}</Tooltip>}>
                <div>
                  <Knob
                    value={sensitivity}
                    onChange={setSensitivity}
                    min={0}
                    max={1}
                    step={0.01}
                    label="Sensitivity"
                    displayValue={`${Math.round(sensitivity * 100)}%`}
                    size={45}
                    color="#92ce84"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={2}>
              <Knob
                value={attack * 1000}
                onChange={(v) => setAttack(v / 1000)}
                min={1}
                max={100}
                step={1}
                label="Attack"
                displayValue={`${(attack * 1000).toFixed(0)}ms`}
                size={45}
                color="#92ceaa"
              />
            </Col>

            <Col xs={6} sm={4} md={2}>
              <Knob
                value={release * 1000}
                onChange={(v) => setRelease(v / 1000)}
                min={10}
                max={1000}
                step={10}
                label="Release"
                displayValue={`${(release * 1000).toFixed(0)}ms`}
                size={45}
                color="#9b59b6"
              />
            </Col>
          </Row>
        </>
      )}

      {/* LFO Controls - Show when mode is lfo or hybrid */}
      {(mode === 'lfo' || mode === 'hybrid') && (
        <>
          <Row className="mb-2">
            <Col xs={12}>
              <div className="text-white small mb-2">LFO Modulation</div>
            </Col>
          </Row>

          <Row className="text-center align-items-end mb-2">
            <Col xs={12} sm={6} md={3}>
              <Form.Label className="text-white small">LFO Waveform</Form.Label>
              <Form.Select value={lfoWaveform} onChange={(e) => setLfoWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
              </Form.Select>
            </Col>

            <Col xs={12} sm={6} md={3} className="d-flex align-items-end">
              <Form.Check
                type="checkbox"
                id="lfoTempoSync"
                label="Tempo Sync"
                checked={lfoTempoSync}
                onChange={(e) => setLfoTempoSync(e.target.checked)}
                className="text-white"
              />
            </Col>

            {lfoTempoSync && (
              <Col xs={12} sm={6} md={3}>
                <Form.Label className="text-white small">Note Division</Form.Label>
                <Form.Select value={lfoNoteDiv} onChange={(e) => setLfoNoteDiv(Number(e.target.value))} size="sm" className="bg-secondary text-white">
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

          <Row className="text-center align-items-end mb-2">
            {!lfoTempoSync && (
              <Col xs={6} sm={4} md={2}>
                <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.lfoRate}</Tooltip>}>
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
                      color="#e67e22"
                    />
                  </div>
                </OverlayTrigger>
              </Col>
            )}

            <Col xs={6} sm={4} md={2}>
              <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoWahTooltips.lfoDepth}</Tooltip>}>
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
                    color="#27ae60"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={2}>
              <Knob
                value={lfoPhase}
                onChange={setLfoPhase}
                min={0}
                max={360}
                step={5}
                label="LFO Phase"
                displayValue={`${lfoPhase}°`}
                size={45}
                color="#3498db"
              />
            </Col>
          </Row>
        </>
      )}

      {/* Hybrid Balance - Show only when mode is hybrid */}
      {mode === 'hybrid' && (
        <Row className="text-center align-items-end mb-2">
          <Col xs={12}>
            <div className="text-white small mb-2">Hybrid Mix</div>
          </Col>
          <Col xs={6} sm={4} md={2}>
            <Knob
              value={hybridBalance}
              onChange={setHybridBalance}
              min={0}
              max={1}
              step={0.01}
              label="Env/LFO"
              displayValue={`${Math.round((1 - hybridBalance) * 100)}/${Math.round(hybridBalance * 100)}`}
              size={45}
              color="#f39c12"
            />
          </Col>
        </Row>
      )}
    </Container>
  );
}
