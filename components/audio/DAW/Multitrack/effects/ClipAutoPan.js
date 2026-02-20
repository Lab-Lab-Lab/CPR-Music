/**
 * ClipAutoPan - Clip-based version of AutoPan effect
 * Adapted from single-track AutoPan for use with multitrack clip effects
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
const AutoPanTooltips = {
  rate: "Speed of panning modulation. Slow rates (0.1-1Hz) create gentle stereo movement, fast rates (5-20Hz) create tremolo-like effects.",
  depth: "Amount of left-right panning. 0% keeps audio centered, 100% pans fully left to right. Sweet spot is usually 60-80% for natural stereo movement.",
  waveform: "Shape of panning modulation. Sine is smooth, Triangle is linear, Square alternates hard left/right, Sawtooth sweeps directionally.",
  phase: "Starting position of the panning cycle. Use to align panning with musical phrases or create stereo effects across multiple tracks.",
  tempoSync: "Lock panning rate to song tempo using musical note divisions instead of Hz. Great for rhythmic stereo effects."
};

/**
 * AutoPan effect component - Clip-based version
 */
export default function ClipAutoPan({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [rate, setRate] = useState(parameters?.rate ?? 1);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.8);
  const [waveform, setWaveform] = useState(parameters?.waveform ?? 'sine');
  const [phase, setPhase] = useState(parameters?.phase ?? 0);
  const [tempoSync, setTempoSync] = useState(parameters?.tempoSync ?? false);
  const [noteDivision, setNoteDivision] = useState(parameters?.noteDivision ?? 4);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      rate,
      depth,
      waveform,
      phase,
      tempoSync,
      noteDivision
    });
  }, [rate, depth, waveform, phase, tempoSync, noteDivision, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoPanTooltips.rate}</Tooltip>}>
            <div>
              <Knob
                value={rate}
                onChange={setRate}
                min={0.1}
                max={20}
                step={0.1}
                label="Rate"
                displayValue={`${rate.toFixed(1)}Hz`}
                size={60}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoPanTooltips.depth}</Tooltip>}>
            <div>
              <Knob
                value={depth}
                onChange={setDepth}
                min={0}
                max={1}
                step={0.01}
                label="Depth"
                displayValue={`${Math.round(depth * 100)}%`}
                size={60}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{AutoPanTooltips.phase}</Tooltip>}>
            <div>
              <Knob
                value={phase}
                onChange={setPhase}
                min={0}
                max={360}
                step={1}
                label="Phase"
                displayValue={`${phase}°`}
                size={60}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Secondary Controls */}
      <Row className="align-items-end mb-2">
        <Col xs={12} sm={6} md={4}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{AutoPanTooltips.waveform}</Tooltip>}>
            <Form.Select value={waveform} onChange={(e) => setWaveform(e.target.value)} size="sm" className="bg-secondary text-white">
              <option value="sine">Sine</option>
              <option value="triangle">Triangle</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} sm={6} md={4} className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            id="tempoSync"
            label="Tempo Sync"
            checked={tempoSync}
            onChange={(e) => setTempoSync(e.target.checked)}
            className="text-white"
          />
          <OverlayTrigger placement="top" overlay={<Tooltip>{AutoPanTooltips.tempoSync}</Tooltip>}>
            <span className="ms-2 text-info" style={{ cursor: 'help' }}>?</span>
          </OverlayTrigger>
        </Col>

        {tempoSync && (
          <Col xs={12} sm={6} md={4}>
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
