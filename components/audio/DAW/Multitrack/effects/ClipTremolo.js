/**
 * ClipTremolo - Clip-based version of Tremolo effect
 * Adapted from single-track Tremolo for use with multitrack clip effects
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
const TremoloTooltips = {
  rate: "Speed of volume modulation. Slow rates (0.1-3Hz) create gentle pulsing, medium rates (4-8Hz) are classic tremolo, fast rates (10-30Hz) approach ring modulation.",
  depth: "Amount of volume variation. 0% is no effect, 100% pulsates between silence and full volume. Sweet spot is usually 40-70% for musical tremolo.",
  waveform: "Shape of amplitude modulation. Sine is smooth, Triangle is linear, Square creates rhythmic on/off, Sawtooth ramps.",
  phase: "Starting position of the tremolo cycle. Use to align tremolo with musical phrases or adjust timing.",
  tempoSync: "Lock tremolo rate to song tempo using musical note divisions instead of Hz. Perfect for rhythmic tremolo effects."
};

/**
 * Tremolo effect component - Clip-based version
 */
export default function ClipTremolo({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [rate, setRate] = useState(parameters?.rate ?? 5);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.5);
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
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{TremoloTooltips.rate}</Tooltip>}>
            <div>
              <Knob
                value={rate}
                onChange={setRate}
                min={0.1}
                max={30}
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
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{TremoloTooltips.depth}</Tooltip>}>
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
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{TremoloTooltips.phase}</Tooltip>}>
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
          <OverlayTrigger placement="top" overlay={<Tooltip>{TremoloTooltips.waveform}</Tooltip>}>
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
          <OverlayTrigger placement="top" overlay={<Tooltip>{TremoloTooltips.tempoSync}</Tooltip>}>
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
