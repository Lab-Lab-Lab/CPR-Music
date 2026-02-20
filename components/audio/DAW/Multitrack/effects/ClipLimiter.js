/**
 * ClipLimiter - Clip-based version of Limiter effect
 * Adapted from single-track Limiter for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip, Modal, Dropdown } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

// Educational tooltips
const LimiterTooltips = {
  ceiling: "The maximum output level. No signal will exceed this threshold, creating a 'brick wall' limit for absolute peak control.",
  release: "How quickly the limiter stops reducing gain after the signal drops below the ceiling. Faster release preserves transients, slower release sounds smoother.",
  lookahead: "Allows the limiter to anticipate incoming peaks by delaying the signal. Prevents transients from slipping through at the cost of added latency.",
  isr: "Inter-Sample Peak detection catches peaks that occur between digital samples. Essential for true peak limiting in mastering.",
  algorithm: "Different limiting characters: Transparent = clean, Vintage = warm coloration, Aggressive = maximum loudness, Mastering = sophisticated multi-stage."
};

// Limiter algorithms
const LimiterAlgorithms = {
  transparent: {
    name: 'Transparent',
    description: 'Clean, transparent limiting with minimal coloration'
  },
  vintage: {
    name: 'Vintage',
    description: 'Warm, musical limiting with harmonic saturation'
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Fast, punchy limiting for maximum loudness'
  },
  mastering: {
    name: 'Mastering',
    description: 'Sophisticated multi-stage limiting for mastering'
  },
  brickwall: {
    name: 'Brickwall',
    description: 'Hard limiting with absolute ceiling control'
  }
};

/**
 * Limiter Transfer Curve Visualization
 */
function LimiterVisualization({ ceiling, release, lookahead, algorithm, width = 400, height = 200 }) {
  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    const padding = 40;
    const graphWidth = w - padding * 2;
    const graphHeight = h - padding * 2;
    const graphX = padding;
    const graphY = padding;

    // Fixed coordinate system
    const minDbInput = -12;
    const maxDbInput = 3;
    const minDbOutput = -12;
    const maxDbOutput = 0;
    const dbRangeInput = maxDbInput - minDbInput;
    const dbRangeOutput = maxDbOutput - minDbOutput;

    const ceilingDb = ceiling;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let db = minDbOutput; db <= maxDbOutput; db += 1) {
      const yPos = graphY + graphHeight - ((db - minDbOutput) / dbRangeOutput) * graphHeight;
      const isMajor = db % 3 === 0;
      ctx.strokeStyle = isMajor ? '#444' : '#2a2a2a';
      ctx.lineWidth = isMajor ? 1 : 0.5;

      ctx.beginPath();
      ctx.moveTo(graphX, yPos);
      ctx.lineTo(graphX + graphWidth, yPos);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${db}`, graphX - 5, yPos + 3);
      }
    }

    for (let db = minDbInput; db <= maxDbInput; db += 1) {
      const xPos = graphX + ((db - minDbInput) / dbRangeInput) * graphWidth;
      const isMajor = db % 3 === 0;
      ctx.strokeStyle = isMajor ? '#444' : '#2a2a2a';
      ctx.lineWidth = isMajor ? 1 : 0.5;

      ctx.beginPath();
      ctx.moveTo(xPos, graphY);
      ctx.lineTo(xPos, graphY + graphHeight);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${db}`, xPos, graphY + graphHeight + 15);
      }
    }

    // Draw ceiling line
    if (ceilingDb >= minDbOutput && ceilingDb <= maxDbOutput) {
      const ceilingY = graphY + graphHeight - ((ceilingDb - minDbOutput) / dbRangeOutput) * graphHeight;

      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(graphX, ceilingY);
      ctx.lineTo(graphX + graphWidth, ceilingY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw unity line
    ctx.strokeStyle = '#666';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let db = minDbInput; db <= Math.min(maxDbOutput, maxDbInput); db += 0.1) {
      const xPos = graphX + ((db - minDbInput) / dbRangeInput) * graphWidth;
      const yPos = graphY + graphHeight - ((db - minDbOutput) / dbRangeOutput) * graphHeight;

      if (db === minDbInput) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate knee width
    let baseKneeWidth = 1;
    if (algorithm === 'brickwall') {
      baseKneeWidth = 0.05;
    } else if (algorithm === 'aggressive') {
      baseKneeWidth = 0.3;
    } else if (algorithm === 'transparent') {
      baseKneeWidth = 1.0;
    } else if (algorithm === 'vintage') {
      baseKneeWidth = 1.5;
    } else if (algorithm === 'mastering') {
      baseKneeWidth = 2.0;
    }

    const lookaheadFactor = lookahead / 20;
    const lookaheadEffect = 1 + (lookaheadFactor * 2);

    let releaseFactor;
    if (release <= 100) {
      releaseFactor = 0.5 + (release / 100) * 0.5;
    } else {
      releaseFactor = 1 + ((release - 100) / 900);
    }

    let kneeWidth = baseKneeWidth * lookaheadEffect * releaseFactor;
    kneeWidth = Math.max(0.05, Math.min(6, kneeWidth));

    // Draw knee region
    if (kneeWidth > 0.1 && ceilingDb >= minDbOutput) {
      const kneeStartDb = Math.max(minDbInput, ceilingDb - kneeWidth);
      const kneeEndDb = ceilingDb;

      if (kneeStartDb <= maxDbInput && kneeEndDb >= minDbInput) {
        const kneeStartX = graphX + ((kneeStartDb - minDbInput) / dbRangeInput) * graphWidth;
        const kneeEndX = graphX + ((kneeEndDb - minDbInput) / dbRangeInput) * graphWidth;

        const gradient = ctx.createLinearGradient(kneeStartX, 0, kneeEndX, 0);
        gradient.addColorStop(0, 'rgba(255, 107, 107, 0.02)');
        gradient.addColorStop(0.5, 'rgba(255, 107, 107, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 107, 107, 0.25)');

        ctx.fillStyle = gradient;
        ctx.fillRect(kneeStartX, graphY, kneeEndX - kneeStartX, graphHeight);
      }
    }

    // Draw limiting curve
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i <= graphWidth; i++) {
      const inputDb = minDbInput + (i / graphWidth) * dbRangeInput;
      let outputDb;

      if (inputDb < ceilingDb - kneeWidth) {
        outputDb = inputDb;
      } else if (inputDb < ceilingDb) {
        const kneeProgress = (inputDb - (ceilingDb - kneeWidth)) / kneeWidth;

        let smoothFactor;
        if (algorithm === 'brickwall') {
          smoothFactor = kneeProgress;
        } else if (algorithm === 'aggressive') {
          smoothFactor = Math.pow(kneeProgress, 0.7);
        } else if (algorithm === 'transparent') {
          smoothFactor = 0.5 * (1 + Math.sin((kneeProgress - 0.5) * Math.PI));
        } else if (algorithm === 'vintage') {
          smoothFactor = kneeProgress * kneeProgress * (3 - 2 * kneeProgress);
        } else if (algorithm === 'mastering') {
          smoothFactor = Math.pow(kneeProgress, 2.5);
        } else {
          smoothFactor = 0.5 * (1 + Math.sin((kneeProgress - 0.5) * Math.PI));
        }

        outputDb = inputDb * (1 - smoothFactor) + ceilingDb * smoothFactor;
      } else {
        outputDb = ceilingDb;
      }

      outputDb = Math.max(minDbOutput, Math.min(outputDb, ceilingDb, maxDbOutput));

      const xPos = graphX + i;
      const yPos = graphY + graphHeight - ((outputDb - minDbOutput) / dbRangeOutput) * graphHeight;

      if (i === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Ceiling: ${ceilingDb.toFixed(1)}dB`, w / 2, graphY - 10);

    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Limiter Transfer Function', w / 2, 15);
    ctx.fillText('Input (dB)', w / 2, h - 5);

    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();

    // Algorithm indicator
    ctx.fillStyle = getAlgorithmColor(algorithm);
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(algorithm?.toUpperCase() || 'TRANSPARENT', w - padding, 15);

    if (lookahead > 0) {
      ctx.fillStyle = '#9b59b6';
      ctx.font = '9px monospace';
      ctx.fillText(`Lookahead: ${lookahead.toFixed(1)}ms`, w - padding, 28);
    }
  }, [ceiling, algorithm, release, lookahead]);

  const getAlgorithmColor = (algo) => {
    const colors = {
      transparent: '#7bafd4',
      vintage: '#cbb677',
      aggressive: '#e75b5c',
      mastering: '#9370db',
      brickwall: '#ff6b6b'
    };
    return colors[algo] || '#7bafd4';
  };

  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-white small">Limiter Analysis</span>
        <OverlayTrigger placement="left" overlay={<Tooltip>Click for help understanding the limiter visualization</Tooltip>}>
          <Button variant="link" size="sm" className="p-0 text-info" onClick={() => setShowHelpModal(true)}>
            <FaQuestionCircle />
          </Button>
        </OverlayTrigger>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: `${height}px`, backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}
      />

      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding the Limiter</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5>What is a Limiter?</h5>
          <p>A limiter is an extreme form of compression that prevents audio from exceeding a maximum level (ceiling).</p>

          <h6 className="mt-3">Reading the Limiting Curve</h6>
          <ul>
            <li><strong>Diagonal dotted line:</strong> Unity gain reference</li>
            <li><strong>Red curve:</strong> Shows the limiting behavior</li>
            <li><strong>Below ceiling:</strong> Signal passes through unchanged</li>
            <li><strong>At ceiling:</strong> Curve becomes horizontal - the "brick wall"</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>Got it!</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/**
 * Limiter effect component - Clip-based version
 */
export default function ClipLimiter({ parameters, onParametersChange }) {
  // Initialize all 7 parameters from props
  const [ceiling, setCeiling] = useState(parameters?.ceiling ?? -0.1);
  const [release, setRelease] = useState(parameters?.release ?? 100);
  const [lookahead, setLookahead] = useState(parameters?.lookahead ?? 5);
  const [algorithm, setAlgorithm] = useState(parameters?.algorithm ?? 'transparent');
  const [isrMode, setIsrMode] = useState(parameters?.isrMode ?? false);
  const [dithering, setDithering] = useState(parameters?.dithering ?? false);
  const [masteringMode, setMasteringMode] = useState(parameters?.masteringMode ?? false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      ceiling,
      release,
      lookahead,
      algorithm,
      isrMode,
      dithering,
      masteringMode
    });
  }, [ceiling, release, lookahead, algorithm, isrMode, dithering, masteringMode, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-3">
        <Col>
          <LimiterVisualization
            ceiling={ceiling}
            release={release}
            lookahead={lookahead}
            algorithm={algorithm}
          />
        </Col>
      </Row>

      {/* Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{LimiterTooltips.ceiling}</Tooltip>}>
            <div>
              <Knob
                value={ceiling}
                onChange={setCeiling}
                min={-3}
                max={0}
                step={0.1}
                label="Ceiling"
                displayValue={`${ceiling.toFixed(1)}dB`}
                size={45}
                color="#e74c3c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{LimiterTooltips.release}</Tooltip>}>
            <div>
              <Knob
                value={release}
                onChange={setRelease}
                min={1}
                max={1000}
                step={1}
                label="Release"
                displayValue={`${release.toFixed(0)}ms`}
                size={45}
                color="#3498db"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{LimiterTooltips.lookahead}</Tooltip>}>
            <div>
              <Knob
                value={lookahead}
                onChange={setLookahead}
                min={0}
                max={20}
                step={0.1}
                label="Lookahead"
                displayValue={`${lookahead.toFixed(1)}ms`}
                size={45}
                color="#9b59b6"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Algorithm Selection */}
        <Col xs={12} sm={6} md={3}>
          <Form.Label className="text-white small">Algorithm</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{LimiterTooltips.algorithm}</Tooltip>}>
            <Form.Select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} size="sm" className="bg-secondary text-white">
              {Object.entries(LimiterAlgorithms).map(([key, algo]) => (
                <option key={key} value={key}>{algo.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        {/* Advanced Controls */}
        <Col xs={6} sm={4} md={2} className="d-flex align-items-end">
          <OverlayTrigger placement="top" overlay={<Tooltip>{LimiterTooltips.isr}</Tooltip>}>
            <div>
              <Form.Check
                type="checkbox"
                id="limiter-isr"
                label="ISR"
                checked={isrMode}
                onChange={(e) => setIsrMode(e.target.checked)}
                className="text-white small"
              />
              <Form.Check
                type="checkbox"
                id="limiter-dither"
                label="Dither"
                checked={dithering}
                onChange={(e) => setDithering(e.target.checked)}
                className="text-white small mt-1"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={1} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="limiter-mastering"
            label="Master"
            checked={masteringMode}
            onChange={(e) => setMasteringMode(e.target.checked)}
            className="text-white small"
          />
        </Col>
      </Row>
    </Container>
  );
}
