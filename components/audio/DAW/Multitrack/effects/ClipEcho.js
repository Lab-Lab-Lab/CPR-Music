/**
 * ClipEcho - Clip-based version of Echo effect
 * Adapted from single-track Echo for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, OverlayTrigger, Tooltip, Modal, Button } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

// Educational tooltips
const EchoTooltips = {
  delayTime: "Gap between echoes. 50-200ms creates tight slapback, 200-600ms creates rhythmic echoes, 600ms+ creates ambient space.",
  feedback: "Repetition amount. Low feedback (10-30%) gives a few repeats, high feedback (50-80%) creates long trails. Capped at 80% for safety.",
  inputGain: "Signal level going into the echo. Use to drive the echo harder or softer without affecting dry signal.",
  outputGain: "Overall effect volume. Use to match echo level with dry signal or create prominent echo effects."
};

/**
 * Echo effect component - Clip-based version
 */
export default function ClipEcho({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [delayTime, setDelayTime] = useState(parameters?.delayTime ?? 250);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.4);
  const [inputGain, setInputGain] = useState(parameters?.inputGain ?? 1.0);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1.0);

  const [showHelpModal, setShowHelpModal] = useState(false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      delayTime,
      feedback,
      inputGain,
      outputGain
    });
  }, [delayTime, feedback, inputGain, outputGain, onParametersChange]);

  return (
    <Container fluid className="p-2">
      {/* Help Button */}
      <Row className="mb-2">
        <Col className="text-end">
          <OverlayTrigger
            placement="left"
            overlay={<Tooltip>Click for help understanding echo effects</Tooltip>}
          >
            <Button
              variant="link"
              size="sm"
              className="p-0 text-info"
              onClick={() => setShowHelpModal(true)}
            >
              <FaQuestionCircle /> What is Echo?
            </Button>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding Echo Effects</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5>What is Echo?</h5>
          <p>
            An echo is a distinct repetition of a sound after a delay. Unlike reverb (which creates a dense wash of reflections),
            echo creates clear, separate repetitions that you can count individually.
          </p>

          <h6 className="mt-3">Echo vs Delay vs Reverb</h6>
          <ul>
            <li><strong>Echo:</strong> Discrete repetitions with feedback control (this effect)</li>
            <li><strong>Delay:</strong> More advanced with multiple taps, modulation, and filtering</li>
            <li><strong>Reverb:</strong> Dense reflections simulating acoustic spaces</li>
          </ul>

          <h6 className="mt-3">Common Uses</h6>
          <ul>
            <li><strong>Slapback Echo (50-150ms):</strong> Classic rockabilly/rock vocals and guitar</li>
            <li><strong>Quarter Note Echo (sync to tempo):</strong> Creates rhythmic interest in modern music</li>
            <li><strong>Long Echo (500ms+):</strong> Ambient effects, dub music, soundscapes</li>
            <li><strong>Multi-tap Echo:</strong> Complex rhythmic patterns (not yet implemented in this version)</li>
          </ul>

          <h6 className="mt-3">Tips for Great Echo</h6>
          <ul>
            <li>Match delay time to song tempo for musical echoes</li>
            <li>Use low feedback (20-40%) for subtle enhancement</li>
            <li>High feedback (60-80%) creates "infinite" echo trails</li>
            <li>Adjust input gain to control echo character without changing volume</li>
            <li>Safety features prevent runaway feedback and clipping</li>
          </ul>

          <h6 className="mt-3">Safety Features</h6>
          <p>
            This echo includes built-in protection:
          </p>
          <ul>
            <li>Feedback automatically capped at 80% to prevent infinite buildup</li>
            <li>Internal compression prevents distortion from loud echoes</li>
            <li>Gain limits prevent output from exceeding safe levels</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Got it!
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Main Controls */}
      <Row className="text-center align-items-end mb-2">
        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{EchoTooltips.delayTime}</Tooltip>}>
            <div>
              <Knob
                value={delayTime}
                onChange={setDelayTime}
                min={1}
                max={2000}
                step={1}
                label="Delay"
                displayValue={`${Math.round(delayTime)}ms`}
                size={60}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{EchoTooltips.feedback}</Tooltip>}>
            <div>
              <Knob
                value={feedback}
                onChange={setFeedback}
                min={0}
                max={0.8}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(feedback * 100)}%`}
                size={60}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{EchoTooltips.inputGain}</Tooltip>}>
            <div>
              <Knob
                value={inputGain}
                onChange={setInputGain}
                min={0}
                max={1.5}
                step={0.01}
                label="Input"
                displayValue={`${inputGain.toFixed(2)}x`}
                size={60}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={3}>
          <OverlayTrigger placement="top" delay={{ show: 1500, hide: 100 }} overlay={<Tooltip>{EchoTooltips.outputGain}</Tooltip>}>
            <div>
              <Knob
                value={outputGain}
                onChange={setOutputGain}
                min={0}
                max={1.5}
                step={0.01}
                label="Output"
                displayValue={`${outputGain.toFixed(2)}x`}
                size={60}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
    </Container>
  );
}
