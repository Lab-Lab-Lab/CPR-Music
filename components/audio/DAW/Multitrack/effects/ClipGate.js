/**
 * ClipGate - Clip-based version of Gate effect
 * Adapted from single-track Gate for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

// Educational tooltips
const GateTooltips = {
  threshold: "Signal level that opens the gate. Audio below this level will be reduced or muted.",
  range: "Amount of attenuation when gate is closed. -80dB = full mute, 0dB = no reduction.",
  attack: "How quickly the gate opens when signal exceeds threshold. Faster attack preserves transients, slower attack smooths them.",
  hold: "How long the gate stays open after signal drops below threshold. Prevents choppy gating on sustained sounds.",
  release: "How quickly the gate closes after hold time. Faster release is tighter, slower release is smoother."
};

/**
 * Gate Transfer Curve Visualization
 */
function GateVisualization({ threshold, range, attack, hold, release, width = 400, height = 200 }) {
  const canvasRef = useRef(null);

  const drawGateVisualization = useCallback(() => {
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

    // Fixed scale: -80dB to 0dB
    const minDb = -80;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;

    for (let db = minDb; db <= maxDb; db += 10) {
      const yPos = ((db - minDb) / dbRange) * graphHeight;
      const xPos = ((db - minDb) / dbRange) * graphWidth;

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(graphX, graphY + graphHeight - yPos);
      ctx.lineTo(graphX + graphWidth, graphY + graphHeight - yPos);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(graphX + xPos, graphY);
      ctx.lineTo(graphX + xPos, graphY + graphHeight);
      ctx.stroke();

      // Labels
      if (db % 20 === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${db}`, graphX - 5, graphY + graphHeight - yPos + 3);
        ctx.textAlign = 'center';
        ctx.fillText(`${db}`, graphX + xPos, graphY + graphHeight + 15);
      }
    }

    // Draw unity line (input = output reference)
    ctx.strokeStyle = '#444';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphHeight);
    ctx.lineTo(graphX + graphWidth, graphY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw threshold line
    const thresholdPos = ((threshold - minDb) / dbRange) * graphWidth;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(graphX + thresholdPos, graphY);
    ctx.lineTo(graphX + thresholdPos, graphY + graphHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw range indicator (shaded region below threshold)
    if (range < 0) {
      ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
      ctx.fillRect(graphX, graphY, thresholdPos, graphHeight);
    }

    // Draw gate curve
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let x = 0; x <= graphWidth; x++) {
      const inputDb = minDb + (x / graphWidth) * dbRange;
      let outputDb;

      if (inputDb < threshold) {
        // Below threshold: attenuated by range
        outputDb = inputDb + range;
      } else {
        // Above threshold: unity gain
        outputDb = inputDb;
      }

      // Clamp to visible range
      outputDb = Math.max(minDb, Math.min(maxDb, outputDb));

      const xPos = graphX + x;
      const yPos = graphY + graphHeight - ((outputDb - minDb) / dbRange) * graphHeight;

      if (x === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }

    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Threshold: ${threshold.toFixed(0)}dB`, graphX + 5, graphY + 15);
    ctx.fillText(`Range: ${range.toFixed(0)}dB`, graphX + 5, graphY + 30);

    // Time parameters
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Attack: ${(attack * 1000).toFixed(1)}ms`, graphX + graphWidth, graphY + 15);
    ctx.fillText(`Hold: ${(hold * 1000).toFixed(0)}ms`, graphX + graphWidth, graphY + 28);
    ctx.fillText(`Release: ${(release * 1000).toFixed(0)}ms`, graphX + graphWidth, graphY + 41);

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gate Transfer Function', w / 2, 15);
    ctx.fillText('Input (dB)', w / 2, h - 5);

    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();
  }, [threshold, range, attack, hold, release]);

  useEffect(() => {
    drawGateVisualization();
  }, [drawGateVisualization]);

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
 * Gate effect component - Clip-based version
 */
export default function ClipGate({ parameters, onParametersChange }) {
  // Initialize all 5 parameters from props
  const [threshold, setThreshold] = useState(parameters?.threshold ?? -40);
  const [range, setRange] = useState(parameters?.range ?? -60);
  const [attack, setAttack] = useState(parameters?.attack ?? 0.001);
  const [hold, setHold] = useState(parameters?.hold ?? 0.01);
  const [release, setRelease] = useState(parameters?.release ?? 0.1);

  const [showHelpModal, setShowHelpModal] = useState(false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      threshold,
      range,
      attack,
      hold,
      release
    });
  }, [threshold, range, attack, hold, release, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Gate Curve Visualization */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-white small">Gate Analysis</span>
            <OverlayTrigger placement="left" overlay={<Tooltip>Click for help understanding the gate visualization</Tooltip>}>
              <Button variant="link" size="sm" className="p-0 text-info" onClick={() => setShowHelpModal(true)}>
                <FaQuestionCircle />
              </Button>
            </OverlayTrigger>
          </div>
          <GateVisualization
            threshold={threshold}
            range={range}
            attack={attack}
            hold={hold}
            release={release}
          />
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding the Gate</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5>What is a Gate?</h5>
          <p>
            A gate (or noise gate) is a dynamics processor that automatically mutes or reduces audio
            below a set threshold. Think of it as an automatic volume control that "closes" when the
            signal is too quiet and "opens" when it's loud enough.
          </p>

          <h6 className="mt-3">Reading the Transfer Curve</h6>
          <ul>
            <li><strong>Diagonal dashed line:</strong> Unity gain (no change) reference</li>
            <li><strong>Red vertical line:</strong> Threshold - where the gate opens/closes</li>
            <li><strong>Red curve:</strong> Shows the gating action</li>
            <li><strong>Below threshold:</strong> Signal is reduced by the Range amount</li>
            <li><strong>Above threshold:</strong> Signal passes through unchanged</li>
          </ul>

          <h6 className="mt-3">Common Uses</h6>
          <ul>
            <li><strong>Drum gating:</strong> Clean up drum mic bleed</li>
            <li><strong>Vocal recording:</strong> Remove room noise between phrases</li>
            <li><strong>Guitar amps:</strong> Cut noise and hum during silences</li>
            <li><strong>Creative gating:</strong> Rhythmic stuttering and chopping effects</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>Got it!</Button>
        </Modal.Footer>
      </Modal>

      {/* Controls */}
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{GateTooltips.threshold}</Tooltip>}>
            <div>
              <Knob
                value={threshold}
                onChange={setThreshold}
                min={-80}
                max={0}
                label="Threshold"
                displayValue={`${threshold.toFixed(0)}dB`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{GateTooltips.range}</Tooltip>}>
            <div>
              <Knob
                value={range}
                onChange={setRange}
                min={-80}
                max={0}
                label="Range"
                displayValue={`${range.toFixed(0)}dB`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{GateTooltips.attack}</Tooltip>}>
            <div>
              <Knob
                value={attack * 1000}
                onChange={(v) => setAttack(v / 1000)}
                min={0.1}
                max={10}
                step={0.1}
                label="Attack"
                displayValue={`${(attack * 1000).toFixed(1)}ms`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{GateTooltips.hold}</Tooltip>}>
            <div>
              <Knob
                value={hold * 1000}
                onChange={(v) => setHold(v / 1000)}
                min={0}
                max={100}
                label="Hold"
                displayValue={`${(hold * 1000).toFixed(0)}ms`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{GateTooltips.release}</Tooltip>}>
            <div>
              <Knob
                value={release * 1000}
                onChange={(v) => setRelease(v / 1000)}
                min={10}
                max={1000}
                label="Release"
                displayValue={`${(release * 1000).toFixed(0)}ms`}
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
