/**
 * ClipChorus - Clip-based version of Chorus effect
 * Adapted from single-track Chorus for use with multitrack clip effects
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
const ChorusTooltips = {
  rate: "LFO speed controlling pitch/time modulation. Slow rates (0.1-1Hz) create gentle chorus, fast rates (2-5Hz) add vibrato character.",
  depth: "Amount of pitch/time variation. Sweet spot is 40-70% for classic chorus. Higher values create more pronounced detuning.",
  delay: "Base delay time before modulation. 10-20ms is classic chorus, 20-40ms creates doubling effects.",
  feedback: "Routes output back to input. Low amounts (10-30%) add resonance, higher values create flanging-like effects.",
  mix: "Balance between dry (original) and wet (chorused) signal. 30-50% typical for subtle thickening, 70-100% for special effects.",
  voices: "Number of independent delay lines. More voices create richer, more complex chorusing but use more CPU.",
  width: "Stereo spread of voices. 100% is natural stereo, higher values enhance width, lower values create mono chorus.",
  waveform: "Shape of LFO modulation. Sine is smooth/natural, triangle is gentler, square/sawtooth are rhythmic, random is unpredictable.",
  tempoSync: "Locks modulation rate to song tempo using musical note divisions instead of Hz.",
  output: "Overall output level. Use to compensate for perceived volume changes when mixing wet/dry signals."
};

/**
 * LFO Visualization Component
 */
function LFOVisualization({ rate, depth, waveform, width = 400, height = 120 }) {
  const canvasRef = useRef(null);

  const drawLFO = useCallback(() => {
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

    // Draw centerline
    ctx.strokeStyle = '#555';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw LFO waveform
    ctx.strokeStyle = '#92ce84';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const t = (x / w) * 4; // 4 cycles
      let value;

      switch (waveform) {
        case 'sine':
          value = Math.sin(t * Math.PI * 2 * rate / 2);
          break;
        case 'triangle':
          value = Math.abs((t * rate / 2 % 1) * 2 - 1) * 2 - 1;
          break;
        case 'sawtooth':
          value = (t * rate / 2 % 1) * 2 - 1;
          break;
        case 'square':
          value = Math.sin(t * Math.PI * 2 * rate / 2) > 0 ? 1 : -1;
          break;
        case 'random':
          value = (Math.random() * 2 - 1);
          break;
        default:
          value = Math.sin(t * Math.PI * 2 * rate / 2);
      }

      const y = h / 2 - (value * depth * h / 2);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`${rate.toFixed(2)}Hz`, 5, 15);
    ctx.fillText(`${(depth * 100).toFixed(0)}%`, 5, 30);
    ctx.fillText(waveform, w - 60, 15);

  }, [rate, depth, waveform]);

  useEffect(() => {
    drawLFO();
  }, [drawLFO]);

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
 * Chorus effect component - Clip-based version
 */
export default function ClipChorus({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [rate, setRate] = useState(parameters?.rate ?? 1.5);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.5);
  const [delay, setDelay] = useState(parameters?.delay ?? 20);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.2);
  const [wetMix, setWetMix] = useState(parameters?.wetMix ?? 0.5);
  const [voices, setVoices] = useState(parameters?.voices ?? 3);
  const [stereoWidth, setStereoWidth] = useState(parameters?.stereoWidth ?? 1.0);
  const [waveform, setWaveform] = useState(parameters?.waveform ?? 'sine');
  const [tempoSync, setTempoSync] = useState(parameters?.tempoSync ?? false);
  const [noteDivision, setNoteDivision] = useState(parameters?.noteDivision ?? 4);
  const [globalBPM, setGlobalBPM] = useState(parameters?.globalBPM ?? 120);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      rate,
      depth,
      delay,
      feedback,
      wetMix,
      voices,
      stereoWidth,
      waveform,
      tempoSync,
      noteDivision,
      globalBPM,
      outputGain
    });
  }, [rate, depth, delay, feedback, wetMix, voices, stereoWidth, waveform, tempoSync, noteDivision, globalBPM, outputGain, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* LFO Visualization */}
      <Row className="mb-3">
        <Col>
          <LFOVisualization rate={rate} depth={depth} waveform={waveform} />
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.rate}</Tooltip>}>
            <div>
              <Knob value={rate} onChange={setRate} min={0.01} max={10} step={0.01} label="Rate" displayValue={`${rate.toFixed(2)}Hz`} size={50} color="#92ce84" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.depth}</Tooltip>}>
            <div>
              <Knob value={depth} onChange={setDepth} min={0} max={1} step={0.01} label="Depth" displayValue={`${Math.round(depth * 100)}%`} size={50} color="#7bafd4" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.delay}</Tooltip>}>
            <div>
              <Knob value={delay} onChange={setDelay} min={5} max={50} step={0.1} label="Delay" displayValue={`${delay.toFixed(1)}ms`} size={50} color="#cbb677" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.feedback}</Tooltip>}>
            <div>
              <Knob value={feedback} onChange={setFeedback} min={0} max={0.9} step={0.01} label="Feedback" displayValue={`${Math.round(feedback * 100)}%`} size={50} color="#e75b5c" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.mix}</Tooltip>}>
            <div>
              <Knob value={wetMix} onChange={setWetMix} min={0} max={1} step={0.01} label="Mix" displayValue={`${Math.round(wetMix * 100)}%`} size={50} color="#92ceaa" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.voices}</Tooltip>}>
            <div>
              <Knob value={voices} onChange={setVoices} min={1} max={8} step={1} label="Voices" displayValue={`${voices}`} size={50} color="#dda0dd" />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Secondary Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.width}</Tooltip>}>
            <div>
              <Knob value={stereoWidth} onChange={setStereoWidth} min={0} max={2} step={0.01} label="Width" displayValue={`${Math.round(stereoWidth * 100)}%`} size={45} color="#ffa500" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{ChorusTooltips.output}</Tooltip>}>
            <div>
              <Knob value={outputGain} onChange={setOutputGain} min={0} max={2} step={0.01} label="Output" displayValue={`${outputGain.toFixed(2)}x`} size={45} color="#92ceaa" />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={3}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{ChorusTooltips.waveform}</Tooltip>}>
            <Form.Select value={waveform} onChange={(e) => setWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="sine">Sine</option>
              <option value="triangle">Triangle</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="square">Square</option>
              <option value="random">Random</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check type="checkbox" id="tempoSync" label="Tempo Sync" checked={tempoSync} onChange={(e) => setTempoSync(e.target.checked)} className="text-white" />
          <OverlayTrigger placement="top" overlay={<Tooltip>{ChorusTooltips.tempoSync}</Tooltip>}>
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
            </Form.Select>
          </Col>
        )}
      </Row>
    </Container>
  );
}
