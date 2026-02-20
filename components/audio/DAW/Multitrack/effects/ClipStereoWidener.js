/**
 * ClipStereoWidener - Clip-based version of StereoWidener effect
 * Adapted from single-track StereoWidener for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

// Educational Tooltips
const StereoTooltips = {
  width: "Controls how wide the stereo image appears. 1.0x is original, <1.0 narrows, >1.0 widens. Be careful with values over 2.0x as they may cause phase issues.",
  haasDelay: "Adds a small delay to one channel creating psychoacoustic widening. 10-30ms is typical. Only active in Haas mode.",
  midGain: "Adjusts the center (mono) content level. Positive values emphasize vocals/bass, negative values create a 'hollow' center. Only in Mid/Side mode.",
  sideGain: "Adjusts the side (stereo) content level. Positive values increase width and ambience, negative reduces stereo information. Only in Mid/Side mode.",
  phase: "Rotates the stereo image. Small amounts (5-15°) can add subtle width. Large amounts may cause mono compatibility issues.",
  outputGain: "Final output level adjustment. Reduce if widening causes clipping. Unity gain is 1.0x.",
  bassFreq: "Frequencies below this point stay mono to maintain punch and avoid phase issues. Typical range is 100-200Hz.",
  highLimit: "Frequencies above this are limited to prevent harsh widening artifacts. Usually set to 10-15kHz.",
  correlation: "Target stereo correlation. +1 is mono, 0 is uncorrelated, -1 is out of phase. Normal stereo is 0.3-0.7."
};

// Processing Modes
const StereoModes = {
  classic: { name: 'Classic Width', description: 'Traditional stereo width control' },
  midside: { name: 'Mid/Side Processing', description: 'Independent mid and side channel control' },
  haas: { name: 'Haas Effect', description: 'Psychoacoustic delay-based widening' },
  correlation: { name: 'Correlation Control', description: 'Stereo correlation adjustment' }
};

/**
 * Vectorscope Visualization
 */
function VectorscopeVisualization({ width, delay, mode, midGain, sideGain, phase, bassRetain, bassFreq, correlation, width: canvasWidth = 400, height: canvasHeight = 250 }) {
  const canvasRef = useRef(null);

  const drawVectorscope = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2 - 30;

    // Draw concentric circles (25%, 50%, 75%, 100%)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw reference lines
    ctx.strokeStyle = '#444';
    ctx.setLineDash([5, 5]);

    // Horizontal (mono center line)
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();

    // Vertical (stereo center line)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    // Diagonal L/R lines
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.7, centerY - radius * 0.7);
    ctx.lineTo(centerX + radius * 0.7, centerY + radius * 0.7);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.7, centerY + radius * 0.7);
    ctx.lineTo(centerX + radius * 0.7, centerY - radius * 0.7);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw safety zones based on width
    if (width > 1.5) {
      // Yellow warning zone
      ctx.fillStyle = 'rgba(255, 193, 7, 0.05)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    if (width > 2.0) {
      // Red danger zone
      ctx.strokeStyle = 'rgba(244, 67, 54, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Green safe zone
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Draw original stereo pattern (blue ellipse)
    ctx.strokeStyle = '#7bafd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 0.5, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw processed stereo pattern (red ellipse/circle based on width)
    const processedWidth = radius * 0.5 * Math.min(width, 3);
    const processedHeight = radius * 0.3;

    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();

    if (mode === 'haas' && delay > 0) {
      // Haas mode: offset circle
      const offset = (delay / 50) * radius * 0.2;
      ctx.arc(centerX + offset, centerY, radius * 0.4, 0, Math.PI * 2);
    } else if (mode === 'midside') {
      // Mid/Side mode: adjust based on gains
      const effectiveMid = Math.pow(10, midGain / 20);
      const effectiveSide = Math.pow(10, sideGain / 20);
      ctx.ellipse(centerX, centerY, radius * 0.5 * effectiveSide, radius * 0.3 * effectiveMid, 0, 0, Math.PI * 2);
    } else {
      // Classic mode: simple width scaling
      ctx.ellipse(centerX, centerY, processedWidth, processedHeight, phase * Math.PI / 180, 0, Math.PI * 2);
    }

    ctx.stroke();

    // Draw bass mono zone if enabled
    if (bassRetain) {
      ctx.fillStyle = 'rgba(255, 235, 59, 0.1)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw correlation meter
    const meterWidth = 150;
    const meterHeight = 8;
    const meterX = centerX - meterWidth / 2;
    const meterY = h - 30;

    // Meter background
    ctx.fillStyle = '#333';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    // Correlation value indicator
    const corrPos = ((correlation + 1) / 2) * meterWidth;
    let corrColor;
    if (correlation > 0.5) corrColor = '#4caf50';
    else if (correlation < -0.5) corrColor = '#f44336';
    else corrColor = '#ffc107';

    ctx.fillStyle = corrColor;
    ctx.fillRect(meterX, meterY, corrPos, meterHeight);

    // Meter markers
    ctx.fillStyle = '#888';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('-1', meterX, meterY - 3);
    ctx.fillText('0', centerX, meterY - 3);
    ctx.fillText('+1', meterX + meterWidth, meterY - 3);

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stereo Field Analysis', centerX, 15);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e75b5c';
    ctx.fillText(`Width: ${width.toFixed(1)}x`, w - 10, 15);
    ctx.fillStyle = '#888';
    ctx.fillText(StereoModes[mode]?.name || mode, w - 10, 28);

    if (mode === 'haas' && delay > 0) {
      ctx.fillText(`Delay: ${delay.toFixed(0)}ms`, w - 10, 41);
    }

    if (bassRetain) {
      ctx.textAlign = 'left';
      ctx.fillText(`Bass Mono: ${bassFreq}Hz`, 10, h - 15);
    }

    // Correlation status
    let status;
    if (correlation > 0.7) status = 'Narrow';
    else if (correlation > 0.3) status = 'Normal';
    else if (correlation > -0.3) status = 'Wide';
    else if (correlation > -0.7) status = 'Very Wide';
    else status = 'Phase Issue!';

    ctx.textAlign = 'left';
    ctx.fillText(`Correlation: ${correlation.toFixed(2)} (${status})`, 10, meterY - 5);

    // Channel indicators
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', 15, centerY);
    ctx.fillText('R', w - 15, centerY);
    ctx.fillText('M', centerX, 15);
    ctx.fillText('S', centerX, h - 5);

  }, [width, delay, mode, midGain, sideGain, phase, bassRetain, bassFreq, correlation]);

  useEffect(() => {
    drawVectorscope();
  }, [drawVectorscope]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{ width: '100%', height: `${canvasHeight}px`, backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}
    />
  );
}

/**
 * StereoWidener effect component - Clip-based version
 */
export default function ClipStereoWidener({ parameters, onParametersChange }) {
  // Initialize all 12 parameters from props
  const [width, setWidth] = useState(parameters?.width ?? 1.5);
  const [delay, setDelay] = useState(parameters?.delay ?? 10);
  const [bassRetain, setBassRetain] = useState(parameters?.bassRetain ?? true);
  const [bassFreq, setBassFreq] = useState(parameters?.bassFreq ?? 200);
  const [mode, setMode] = useState(parameters?.mode ?? 'classic');
  const [midGain, setMidGain] = useState(parameters?.midGain ?? 0);
  const [sideGain, setSideGain] = useState(parameters?.sideGain ?? 0);
  const [phase, setPhase] = useState(parameters?.phase ?? 0);
  const [targetCorrelation, setTargetCorrelation] = useState(parameters?.targetCorrelation ?? 0);
  const [highFreqLimit, setHighFreqLimit] = useState(parameters?.highFreqLimit ?? 20000);
  const [safetyLimit, setSafetyLimit] = useState(parameters?.safetyLimit ?? true);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);

  const [showHelpModal, setShowHelpModal] = useState(false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      width,
      delay,
      bassRetain,
      bassFreq,
      mode,
      midGain,
      sideGain,
      phase,
      targetCorrelation,
      highFreqLimit,
      safetyLimit,
      outputGain
    });
  }, [width, delay, bassRetain, bassFreq, mode, midGain, sideGain, phase, targetCorrelation, highFreqLimit, safetyLimit, outputGain, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Vectorscope Visualization */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-white small">Stereo Analysis</span>
            <OverlayTrigger placement="left" overlay={<Tooltip>Click for help understanding stereo widening</Tooltip>}>
              <Button variant="link" size="sm" className="p-0 text-info" onClick={() => setShowHelpModal(true)}>
                <FaQuestionCircle />
              </Button>
            </OverlayTrigger>
          </div>
          <VectorscopeVisualization
            width={width}
            delay={delay}
            mode={mode}
            midGain={midGain}
            sideGain={sideGain}
            phase={phase}
            bassRetain={bassRetain}
            bassFreq={bassFreq}
            correlation={targetCorrelation}
          />
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding Stereo Widening</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5>What is Stereo Widening?</h5>
          <p>Stereo widening makes audio sound wider and more spacious by manipulating the relationship between left and right channels.</p>

          <h6 className="mt-3">Processing Modes</h6>
          <ul>
            <li><strong>Classic:</strong> Simple width multiplication - most common</li>
            <li><strong>Mid/Side:</strong> Independent control of center vs stereo content</li>
            <li><strong>Haas:</strong> Psychoacoustic delay-based widening</li>
            <li><strong>Correlation:</strong> Target specific stereo correlation values</li>
          </ul>

          <h6 className="mt-3">Safety Features</h6>
          <ul>
            <li><strong>Bass Mono:</strong> Keeps low frequencies centered for punch</li>
            <li><strong>Safety Limit:</strong> Prevents extreme phase issues</li>
            <li><strong>Correlation Meter:</strong> Shows stereo field health</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>Got it!</Button>
        </Modal.Footer>
      </Modal>

      {/* Mode Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Processing Mode</Form.Label>
          <Form.Select value={mode} onChange={(e) => setMode(e.target.value)} size="sm" className="bg-secondary text-white">
            {Object.entries(StereoModes).map(([key, modeObj]) => (
              <option key={key} value={key}>{modeObj.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{StereoModes[mode]?.description}</small>
        </Col>

        <Col xs={12} md={6} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="bass-retain"
            label="Bass Mono"
            checked={bassRetain}
            onChange={(e) => setBassRetain(e.target.checked)}
            className="text-white me-3"
          />
          <Form.Check
            type="checkbox"
            id="safety-limit"
            label="Safety Limit"
            checked={safetyLimit}
            onChange={(e) => setSafetyLimit(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.width}</Tooltip>}>
            <div>
              <Knob
                value={width}
                onChange={setWidth}
                min={0}
                max={3}
                step={0.1}
                label="Width"
                displayValue={`${width.toFixed(1)}x`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {mode === 'haas' && (
          <Col xs={6} sm={4} md={2}>
            <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.haasDelay}</Tooltip>}>
              <div>
                <Knob
                  value={delay}
                  onChange={setDelay}
                  min={0}
                  max={50}
                  step={1}
                  label="Delay"
                  displayValue={`${delay}ms`}
                  size={50}
                  color="#9b59b6"
                />
              </div>
            </OverlayTrigger>
          </Col>
        )}

        {mode === 'midside' && (
          <>
            <Col xs={6} sm={4} md={2}>
              <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.midGain}</Tooltip>}>
                <div>
                  <Knob
                    value={midGain}
                    onChange={setMidGain}
                    min={-12}
                    max={12}
                    step={0.1}
                    label="Mid Gain"
                    displayValue={`${midGain > 0 ? '+' : ''}${midGain.toFixed(1)}dB`}
                    size={50}
                    color="#7bafd4"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={2}>
              <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.sideGain}</Tooltip>}>
                <div>
                  <Knob
                    value={sideGain}
                    onChange={setSideGain}
                    min={-12}
                    max={12}
                    step={0.1}
                    label="Side Gain"
                    displayValue={`${sideGain > 0 ? '+' : ''}${sideGain.toFixed(1)}dB`}
                    size={50}
                    color="#92ce84"
                  />
                </div>
              </OverlayTrigger>
            </Col>
          </>
        )}

        {mode === 'correlation' && (
          <Col xs={6} sm={4} md={2}>
            <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.correlation}</Tooltip>}>
              <div>
                <Knob
                  value={targetCorrelation}
                  onChange={setTargetCorrelation}
                  min={-1}
                  max={1}
                  step={0.01}
                  label="Target Corr"
                  displayValue={`${targetCorrelation.toFixed(2)}`}
                  size={50}
                  color="#ffc107"
                />
              </div>
            </OverlayTrigger>
          </Col>
        )}

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.phase}</Tooltip>}>
            <div>
              <Knob
                value={phase}
                onChange={setPhase}
                min={0}
                max={180}
                step={1}
                label="Phase"
                displayValue={`${phase}°`}
                size={50}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.outputGain}</Tooltip>}>
            <div>
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
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Advanced Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Advanced Controls</div>
        </Col>

        {bassRetain && (
          <Col xs={6} sm={4} md={2}>
            <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.bassFreq}</Tooltip>}>
              <div>
                <Knob
                  value={bassFreq}
                  onChange={setBassFreq}
                  min={20}
                  max={500}
                  step={10}
                  label="Bass Freq"
                  displayValue={`${bassFreq}Hz`}
                  size={45}
                  color="#cbb677"
                />
              </div>
            </OverlayTrigger>
          </Col>
        )}

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{StereoTooltips.highLimit}</Tooltip>}>
            <div>
              <Knob
                value={highFreqLimit}
                onChange={setHighFreqLimit}
                min={1000}
                max={20000}
                step={100}
                label="High Limit"
                displayValue={highFreqLimit >= 1000 ? `${(highFreqLimit/1000).toFixed(1)}k` : `${highFreqLimit}Hz`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
    </Container>
  );
}
