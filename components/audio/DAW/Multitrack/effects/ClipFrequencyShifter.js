/**
 * ClipFrequencyShifter - Clip-based version of FrequencyShifter effect
 * Adapted from single-track FrequencyShifter for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Knob from '../../../../Knob';

// Educational Tooltips
const FrequencyShifterTooltips = {
  shift: "Amount to shift all frequencies linearly. Unlike pitch shifting, this creates inharmonic, metallic tones. 50-200Hz creates subtle dissonance, 500Hz+ creates alien effects.",
  feedback: "Routes output back through the shifter. Creates cascading frequency shifts and resonances. Use sparingly (10-40%) as it intensifies the effect dramatically.",
  mix: "Balance between dry and wet signal. Lower values (20-50%) add subtle shimmer and movement. Higher values (70-100%) create complete transformation.",
  direction: "Direction of frequency shift. Up shifts all frequencies higher, Down shifts lower, Both creates parallel shifted copies in both directions."
};

/**
 * FrequencyShifter effect component - Clip-based version
 */
export default function ClipFrequencyShifter({ parameters, onParametersChange }) {
  // Initialize all 4 parameters from props
  const [amount, setAmount] = useState(parameters?.amount ?? 100);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0);
  const [direction, setDirection] = useState(parameters?.direction ?? 'up');

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      amount,
      mix,
      feedback,
      direction
    });
  }, [amount, mix, feedback, direction, onParametersChange]);

  const directions = [
    { key: 'up', name: 'Up' },
    { key: 'down', name: 'Down' },
    { key: 'both', name: 'Both' }
  ];

  return (
    <Container fluid className="p-2">
      {/* Direction Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Direction</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>{FrequencyShifterTooltips.direction}</Tooltip>}>
            <Form.Select value={direction} onChange={(e) => setDirection(e.target.value)} size="sm" className="bg-secondary text-white">
              {directions.map(dir => (
                <option key={dir.key} value={dir.key}>{dir.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FrequencyShifterTooltips.shift}</Tooltip>}>
            <div>
              <Knob
                value={amount}
                onChange={setAmount}
                min={-500}
                max={500}
                step={1}
                label="Shift"
                displayValue={`${amount > 0 ? '+' : ''}${amount}Hz`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FrequencyShifterTooltips.mix}</Tooltip>}>
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
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{FrequencyShifterTooltips.feedback}</Tooltip>}>
            <div>
              <Knob
                value={feedback}
                onChange={setFeedback}
                min={0}
                max={0.9}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(feedback * 100)}%`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
    </Container>
  );
}
