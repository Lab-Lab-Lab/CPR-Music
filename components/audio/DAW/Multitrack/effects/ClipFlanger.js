/**
 * ClipFlanger - Clip-based version of Flanger effect
 * Adapted from single-track Flanger for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Knob from '../../../../Knob';

// Educational tooltips
const FlangerTooltips = {
  rate: "Sweep speed. Slow rates (0.1-1Hz) create gentle swooshing, fast rates (2-5Hz) add vibrato character.",
  depth: "Sweep distance. 0.5-2ms for subtle flanging, 3-5ms for dramatic jet-plane effects.",
  feedback: "Routes output back to input. Positive feedback creates metallic resonance, negative feedback creates hollow tones.",
  delay: "Center point of the sweep. 1-5ms for classic flanging, 10-20ms creates chorus-like effects.",
  mix: "Balance between dry (original) and wet (flanged) signal.",
  throughZero: "Classic tape-style flanging with phase inversion. Creates the famous 'jet plane' swoosh.",
  stereoPhase: "L/R channel phase offset. 90° creates wide stereo imaging, 180° creates opposite-phase flanging.",
  manualOffset: "Manual shift of the sweep position. Use to create asymmetric stereo flanging or static comb filtering."
};

/**
 * Flanger effect component - Clip-based version
 */
export default function ClipFlanger({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [rate, setRate] = useState(parameters?.rate ?? 0.5);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.002); // 2ms
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.5);
  const [delay, setDelay] = useState(parameters?.delay ?? 0.005); // 5ms
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);
  const [throughZero, setThroughZero] = useState(parameters?.throughZero ?? false);
  const [stereoPhase, setStereoPhase] = useState(parameters?.stereoPhase ?? 90);
  const [manualOffset, setManualOffset] = useState(parameters?.manualOffset ?? 0);
  const [tempoSync, setTempoSync] = useState(parameters?.tempoSync ?? false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      rate,
      depth,
      feedback,
      delay,
      mix,
      throughZero,
      stereoPhase,
      manualOffset,
      tempoSync
    });
  }, [rate, depth, feedback, delay, mix, throughZero, stereoPhase, manualOffset, tempoSync, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.rate}</Tooltip>}>
            <div>
              <Knob
                value={rate}
                onChange={setRate}
                min={0.1}
                max={10}
                step={0.01}
                label="Rate"
                displayValue={`${rate.toFixed(2)}Hz`}
                size={50}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.depth}</Tooltip>}>
            <div>
              <Knob
                value={depth}
                onChange={setDepth}
                min={0.0001}
                max={0.005}
                step={0.0001}
                label="Depth"
                displayValue={`${(depth * 1000).toFixed(1)}ms`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.feedback}</Tooltip>}>
            <div>
              <Knob
                value={feedback}
                onChange={setFeedback}
                min={-0.95}
                max={0.95}
                step={0.01}
                label="Feedback"
                displayValue={`${feedback > 0 ? '+' : ''}${Math.round(feedback * 100)}%`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.delay}</Tooltip>}>
            <div>
              <Knob
                value={delay}
                onChange={setDelay}
                min={0.001}
                max={0.02}
                step={0.0001}
                label="Delay"
                displayValue={`${(delay * 1000).toFixed(1)}ms`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.mix}</Tooltip>}>
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

      {/* Secondary Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.stereoPhase}</Tooltip>}>
            <div>
              <Knob
                value={stereoPhase}
                onChange={setStereoPhase}
                min={0}
                max={180}
                step={1}
                label="Stereo °"
                displayValue={`${stereoPhase}°`}
                size={45}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FlangerTooltips.manualOffset}</Tooltip>}>
            <div>
              <Knob
                value={manualOffset}
                onChange={setManualOffset}
                min={0}
                max={1}
                step={0.01}
                label="Manual"
                displayValue={`${Math.round(manualOffset * 100)}%`}
                size={45}
                color="#ffa500"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="throughZero"
            label="Through Zero"
            checked={throughZero}
            onChange={(e) => setThroughZero(e.target.checked)}
            className="text-white"
          />
          <OverlayTrigger placement="top" overlay={<Tooltip>{FlangerTooltips.throughZero}</Tooltip>}>
            <span className="ms-2 text-info" style={{ cursor: 'help' }}>?</span>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="tempoSync"
            label="Tempo Sync"
            checked={tempoSync}
            onChange={(e) => setTempoSync(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>
    </Container>
  );
}
