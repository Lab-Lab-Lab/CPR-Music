/**
 * ClipAdvancedDelay - Clip-based version of AdvancedDelay effect
 * Adapted from single-track AdvancedDelay for use with multitrack clip effects
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
const AdvancedDelayTooltips = {
  time: "Time between delays. Shorter times (50-200ms) create doubling effects, longer times (300-600ms+) create rhythmic echoes. Use tempo sync to lock to musical timing.",
  feedback: "How much of the delayed signal feeds back into itself. Higher values create more repetitions. Values over 70% can build up quickly.",
  taps: "Number of delay repetitions. Each tap creates a separate delay line with its own timing. More taps create denser, more complex patterns.",
  spread: "Distributes multiple taps across time. 0% places all taps at the same time, 100% spreads them evenly for rhythmic patterns.",
  mix: "Balance between dry (original) and wet (delayed) signal. 50% is equal mix, higher values emphasize the delay effect.",
  modRate: "Speed of delay time modulation. Creates chorus-like movement in the delays. Subtle rates (0.1-2Hz) add analog warmth.",
  modDepth: "Amount of delay time variation. Higher values create more pitch wobble and vintage tape-like character. Use sparingly (5-20%) for natural results.",
  filterFreq: "Cutoff frequency for filtering each delay tap. Lowpass removes highs for darker echoes, highpass removes lows for brighter repeats.",
  saturation: "Adds harmonic distortion to delays. Mimics analog tape saturation. Use subtle amounts (10-30%) for warmth, higher for creative effects.",
  diffusion: "Blurs delay taps together for smoother, more ambient sound. Higher values create reverb-like textures from the delays.",
  stereoWidth: "Controls stereo spread. 100% is normal stereo, 200% creates enhanced width. Lower values narrow the stereo image.",
  pingPong: "Alternates delay taps between left and right channels, creating a bouncing stereo effect. Great for wide, rhythmic patterns.",
  tempoSync: "Locks delay time to project tempo using musical note values (quarter notes, eighth notes, etc.) instead of milliseconds.",
  filterType: "Shape of the filter applied to delays. Lowpass darkens, highpass brightens, bandpass focuses on midrange, notch creates hollow sound."
};

/**
 * Multi-Tap Delay Visualization
 */
function DelayVisualization({ time, taps, spread, pingPong, modRate, modDepth, modWaveform, tempoSync, noteDivision, width = 400, height = 120 }) {
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

    const delayTime = time;
    const maxTime = 2000; // ms

    // Draw delay taps
    for (let i = 0; i < taps; i++) {
      const tapIndex = i + 1;
      let tapTime;

      if (spread === 0) {
        tapTime = delayTime;
      } else {
        const spreadRange = delayTime * spread;
        tapTime = delayTime + (tapIndex - 1) * (spreadRange / (taps - 1 || 1));
      }

      const x = (tapTime / maxTime) * w;
      const tapHeight = (1 - (i / taps)) * h * 0.8;

      // Draw tap line
      ctx.strokeStyle = pingPong && i % 2 === 1 ? '#7bafd4' : '#e75b5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - tapHeight);
      ctx.stroke();

      // Draw tap number
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`${i + 1}`, x - 5, h - tapHeight - 5);
    }

    // Draw modulation wave
    if (modDepth > 0) {
      ctx.strokeStyle = '#cbb677';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = (x / w) * 4 * Math.PI; // 2 cycles
        let y;

        switch (modWaveform) {
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

        y = (h / 2) + (y * modDepth * h / 6);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Time: ${delayTime.toFixed(0)}ms`, 10, 20);
    ctx.fillText(`Taps: ${taps}`, 10, 35);

    if (tempoSync) {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText('SYNC', 10, 50);
    }

    if (pingPong) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText('PING-PONG', 10, h - 25);
    }

    if (modDepth > 0) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText(`Mod: ${modRate.toFixed(1)}Hz`, 10, h - 10);
    }

  }, [time, taps, spread, pingPong, modRate, modDepth, modWaveform, tempoSync, noteDivision]);

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
 * AdvancedDelay effect component - Clip-based version
 */
export default function ClipAdvancedDelay({ parameters, onParametersChange }) {
  // Initialize all 15 parameters from props
  const [time, setTime] = useState(parameters?.time ?? 500);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.5);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);
  const [taps, setTaps] = useState(parameters?.taps ?? 3);
  const [spread, setSpread] = useState(parameters?.spread ?? 0.3);
  const [modRate, setModRate] = useState(parameters?.modRate ?? 0.5);
  const [modDepth, setModDepth] = useState(parameters?.modDepth ?? 0.1);
  const [modWaveform, setModWaveform] = useState(parameters?.modWaveform ?? 'sine');
  const [saturation, setSaturation] = useState(parameters?.saturation ?? 0);
  const [diffusion, setDiffusion] = useState(parameters?.diffusion ?? 0.3);
  const [filterType, setFilterType] = useState(parameters?.filterType ?? 'lowpass');
  const [filterFreq, setFilterFreq] = useState(parameters?.filterFreq ?? 2000);
  const [stereoWidth, setStereoWidth] = useState(parameters?.stereoWidth ?? 1.0);
  const [pingPong, setPingPong] = useState(parameters?.pingPong ?? false);
  const [tempoSync, setTempoSync] = useState(parameters?.tempoSync ?? false);
  const [noteDivision, setNoteDivision] = useState(parameters?.noteDivision ?? 4);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      time,
      feedback,
      mix,
      taps,
      spread,
      modRate,
      modDepth,
      modWaveform,
      saturation,
      diffusion,
      filterType,
      filterFreq,
      stereoWidth,
      pingPong,
      tempoSync,
      noteDivision,
      outputGain
    });
  }, [time, feedback, mix, taps, spread, modRate, modDepth, modWaveform, saturation,
      diffusion, filterType, filterFreq, stereoWidth, pingPong, tempoSync, noteDivision,
      outputGain, onParametersChange]);

  const filterTypes = [
    { key: 'lowpass', name: 'Low Pass' },
    { key: 'highpass', name: 'High Pass' },
    { key: 'bandpass', name: 'Band Pass' },
    { key: 'allpass', name: 'All Pass' },
    { key: 'notch', name: 'Notch' }
  ];

  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' }
  ];

  const noteValues = [
    { key: 1, name: 'Whole', symbol: '𝅝' },
    { key: 2, name: 'Half', symbol: '𝅗𝅥' },
    { key: 4, name: 'Quarter', symbol: '♩' },
    { key: 8, name: 'Eighth', symbol: '♫' },
    { key: 16, name: 'Sixteenth', symbol: '♬' }
  ];

  return (
    <Container fluid className="p-2">
      {/* Delay Visualization */}
      <Row className="mb-3">
        <Col>
          <DelayVisualization
            time={time}
            taps={taps}
            spread={spread}
            pingPong={pingPong}
            modRate={modRate}
            modDepth={modDepth}
            modWaveform={modWaveform}
            tempoSync={tempoSync}
            noteDivision={noteDivision}
          />
        </Col>
      </Row>

      {/* Mode and Settings */}
      <Row className="mb-2">
        <Col xs={12} md={3}>
          <Form.Label className="text-white small">Filter Type</Form.Label>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.filterType}</Tooltip>}>
            <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)} size="sm" className="bg-secondary text-white">
              {filterTypes.map(type => (
                <option key={type.key} value={type.key}>{type.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} md={3}>
          <Form.Label className="text-white small">Mod Waveform</Form.Label>
          <Form.Select value={modWaveform} onChange={(e) => setModWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
            {waveformTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </Form.Select>
        </Col>

        <Col xs={12} md={3} className="d-flex align-items-end">
          <OverlayTrigger placement="top" overlay={<Tooltip>{AdvancedDelayTooltips.pingPong}</Tooltip>}>
            <div>
              <Form.Check
                type="switch"
                id="ping-pong"
                label="Ping-Pong"
                checked={pingPong}
                onChange={(e) => setPingPong(e.target.checked)}
                className="text-white"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={12} md={3} className="d-flex align-items-end">
          <OverlayTrigger placement="top" overlay={<Tooltip>{AdvancedDelayTooltips.tempoSync}</Tooltip>}>
            <div>
              <Form.Check
                type="switch"
                id="tempo-sync"
                label="Tempo Sync"
                checked={tempoSync}
                onChange={(e) => setTempoSync(e.target.checked)}
                className="text-white"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.time}</Tooltip>}>
            <div>
              <Knob
                value={tempoSync ? noteDivision : time}
                onChange={tempoSync ? setNoteDivision : setTime}
                min={tempoSync ? 1 : 1}
                max={tempoSync ? 16 : 2000}
                step={tempoSync ? 1 : 1}
                label="Time"
                displayValue={tempoSync ?
                  noteValues.find(n => n.key === noteDivision)?.symbol || `1/${noteDivision}` :
                  `${time}ms`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.feedback}</Tooltip>}>
            <div>
              <Knob
                value={feedback}
                onChange={setFeedback}
                min={0}
                max={0.95}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(feedback * 100)}%`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.taps}</Tooltip>}>
            <div>
              <Knob
                value={taps}
                onChange={setTaps}
                min={1}
                max={8}
                step={1}
                label="Taps"
                displayValue={`${taps}`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.spread}</Tooltip>}>
            <div>
              <Knob
                value={spread}
                onChange={setSpread}
                min={0}
                max={1}
                step={0.01}
                label="Spread"
                displayValue={`${Math.round(spread * 100)}%`}
                size={50}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.mix}</Tooltip>}>
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
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.modRate}</Tooltip>}>
            <div>
              <Knob
                value={modRate}
                onChange={setModRate}
                min={0.1}
                max={10}
                step={0.1}
                label="Mod Rate"
                displayValue={`${modRate.toFixed(1)}Hz`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.modDepth}</Tooltip>}>
            <div>
              <Knob
                value={modDepth}
                onChange={setModDepth}
                min={0}
                max={1}
                step={0.01}
                label="Mod Depth"
                displayValue={`${Math.round(modDepth * 100)}%`}
                size={45}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.filterFreq}</Tooltip>}>
            <div>
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
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.saturation}</Tooltip>}>
            <div>
              <Knob
                value={saturation}
                onChange={setSaturation}
                min={0}
                max={1}
                step={0.01}
                label="Saturation"
                displayValue={`${Math.round(saturation * 100)}%`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.diffusion}</Tooltip>}>
            <div>
              <Knob
                value={diffusion}
                onChange={setDiffusion}
                min={0}
                max={1}
                step={0.01}
                label="Diffusion"
                displayValue={`${Math.round(diffusion * 100)}%`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AdvancedDelayTooltips.stereoWidth}</Tooltip>}>
            <div>
              <Knob
                value={stereoWidth}
                onChange={setStereoWidth}
                min={0}
                max={2}
                step={0.01}
                label="Stereo Width"
                displayValue={`${stereoWidth.toFixed(2)}x`}
                size={45}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
    </Container>
  );
}
