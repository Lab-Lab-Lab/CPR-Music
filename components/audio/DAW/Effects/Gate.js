// components/audio/DAW/Effects/Gate.js
'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

// Educational tooltips
const GateTooltips = {
  threshold: "Signal level that opens the gate. Audio below this level will be reduced or muted.",
  range: "Amount of attenuation when gate is closed. -80dB = full mute, 0dB = no reduction.",
  attack: "How quickly the gate opens when signal exceeds threshold. Faster attack preserves transients, slower attack smooths them.",
  hold: "How long the gate stays open after signal drops below threshold. Prevents choppy gating on sustained sounds.",
  release: "How quickly the gate closes after hold time. Faster release is tighter, slower release is smoother."
};

/**
 * Process gate on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processGateRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Convert dB to linear
  const dbToLinear = (db) => Math.pow(10, db / 20);

  // Gate parameters
  const thresholdLinear = dbToLinear(parameters.threshold || -40);
  const rangeLinear = dbToLinear(parameters.range || -60);
  const attackSamples = Math.floor((parameters.attack || 0.001) * sampleRate);
  const releaseSamples = Math.floor((parameters.release || 0.1) * sampleRate);
  const holdSamples = Math.floor((parameters.hold || 0.01) * sampleRate);

  // Create output buffer with region length only
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate,
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Gate state variables
    let gateOpen = false;
    let gateGain = 0;
    let holdCounter = 0;
    let envelope = 0;

    // Envelope follower coefficient
    const envCoeff = 0.99;

    // Process region only
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      const inputSample = inputData[sampleIndex];

      // Update envelope
      const rectified = Math.abs(inputSample);
      envelope = rectified + (envelope - rectified) * envCoeff;

      // Gate logic
      if (envelope > thresholdLinear) {
        gateOpen = true;
        holdCounter = holdSamples;
      } else if (holdCounter > 0) {
        holdCounter--;
      } else {
        gateOpen = false;
      }

      // Calculate target gain
      const targetGain = gateOpen ? 1 : rangeLinear;

      // Smooth gain changes
      if (targetGain > gateGain) {
        // Attack
        const attackRate = 1 / attackSamples;
        gateGain = Math.min(targetGain, gateGain + attackRate);
      } else {
        // Release
        const releaseRate = 1 / releaseSamples;
        gateGain = Math.max(targetGain, gateGain - releaseRate);
      }

      // Apply gate to output buffer (region index i, not sampleIndex)
      outputData[i] = inputSample * gateGain;
    }
  }

  return outputBuffer;
}

/**
 * Gate effect component - cuts audio below threshold
 */
export default function Gate({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    gateThreshold,
    setGateThreshold,
    gateAttack,
    setGateAttack,
    gateRelease,
    setGateRelease,
    gateHold,
    setGateHold,
    gateRange,
    setGateRange,
    cutRegion,
  } = useEffects();

  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Draw gate transfer curve visualization
  const drawGateVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const graphX = padding;
    const graphY = padding;

    // Fixed scale: -80dB to 0dB
    const minDb = -80;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;

    // Horizontal and vertical grid lines every 10dB
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
    const thresholdPos = ((gateThreshold - minDb) / dbRange) * graphWidth;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(graphX + thresholdPos, graphY);
    ctx.lineTo(graphX + thresholdPos, graphY + graphHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw range indicator (shaded region below threshold)
    if (gateRange < 0) {
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

      if (inputDb < gateThreshold) {
        // Below threshold: attenuated by range
        outputDb = inputDb + gateRange;
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
    ctx.fillText(`Threshold: ${gateThreshold.toFixed(0)}dB`, graphX + 5, graphY + 15);
    ctx.fillText(`Range: ${gateRange.toFixed(0)}dB`, graphX + 5, graphY + 30);

    // Time parameters
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Attack: ${(gateAttack * 1000).toFixed(1)}ms`, graphX + graphWidth, graphY + 15);
    ctx.fillText(`Hold: ${(gateHold * 1000).toFixed(0)}ms`, graphX + graphWidth, graphY + 28);
    ctx.fillText(`Release: ${(gateRelease * 1000).toFixed(0)}ms`, graphX + graphWidth, graphY + 41);

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gate Transfer Function', width / 2, 15);
    ctx.fillText('Input (dB)', width / 2, height - 5);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();
  }, [gateThreshold, gateRange, gateAttack, gateHold, gateRelease]);

  // Update visualization
  useEffect(() => {
    drawGateVisualization();
  }, [drawGateVisualization]);

  // Apply gate to selected region
  const applyGate = useCallback(
    createEffectApplyFunction(processGateRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        threshold: gateThreshold,
        attack: gateAttack,
        release: gateRelease,
        hold: gateHold,
        range: gateRange
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, gateThreshold, gateAttack, gateRelease, gateHold, gateRange, onApply]
  );

  return (
    <Container fluid className="p-2">
      {/* Gate Curve Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <div className="d-flex justify-content-between align-items-center mb-2 p-2">
              <span className="text-white small">Gate Analysis</span>
              <OverlayTrigger
                placement="left"
                overlay={<Tooltip>Click for help understanding the gate visualization</Tooltip>}
              >
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-info"
                  onClick={() => setShowHelpModal(true)}
                >
                  <FaQuestionCircle />
                </Button>
              </OverlayTrigger>
            </div>
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              style={{ width: '100%', height: '200px' }}
            />
          </div>
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
          <p>
            The graph shows how input levels are transformed to output levels:
          </p>
          <ul>
            <li><strong>X-axis (Input):</strong> The original signal level (-80dB to 0dB)</li>
            <li><strong>Y-axis (Output):</strong> The processed signal level (-80dB to 0dB)</li>
            <li><strong>Diagonal dashed line:</strong> Unity gain (no change) reference</li>
            <li><strong>Red vertical line:</strong> Threshold - where the gate opens/closes</li>
            <li><strong>Red curve:</strong> Shows the gating action</li>
          </ul>

          <h6 className="mt-3">How the Gate Works</h6>
          <ul>
            <li><strong>Below threshold:</strong> Gate is closed - signal is reduced by the Range amount</li>
            <li><strong>Above threshold:</strong> Gate is open - signal passes through unchanged</li>
            <li><strong>Sharp transition:</strong> Unlike a compressor, the gate has a distinct on/off point</li>
          </ul>

          <h6 className="mt-3">Parameters Explained</h6>
          <ul>
            <li><strong>Threshold:</strong> The level that opens the gate (move vertical line)</li>
            <li><strong>Range:</strong> How much to reduce when closed (depth of the "floor")</li>
            <li><strong>Attack:</strong> How fast the gate opens (not visible on static curve)</li>
            <li><strong>Hold:</strong> Keeps gate open briefly after signal drops</li>
            <li><strong>Release:</strong> How fast the gate closes (smoothness of transition)</li>
          </ul>

          <h6 className="mt-3">Common Uses</h6>
          <ul>
            <li><strong>Drum gating:</strong> Clean up drum mic bleed</li>
            <li><strong>Vocal recording:</strong> Remove room noise between phrases</li>
            <li><strong>Guitar amps:</strong> Cut noise and hum during silences</li>
            <li><strong>Creative gating:</strong> Rhythmic stuttering and chopping effects</li>
          </ul>

          <h6 className="mt-3">Gate vs Compressor</h6>
          <p>
            A gate is like an opposite of a compressor - instead of reducing loud signals, it reduces
            quiet signals. The curve shows this: signals below threshold get attenuated, while signals
            above threshold pass through untouched.
          </p>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Got it!
          </Button>
        </Modal.Footer>
      </Modal>

      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GateTooltips.threshold}</Tooltip>}
          >
            <div>
              <Knob
                value={gateThreshold}
                onChange={setGateThreshold}
                min={-80}
                max={0}
                label="Threshold"
                displayValue={`${gateThreshold.toFixed(0)}dB`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GateTooltips.range}</Tooltip>}
          >
            <div>
              <Knob
                value={gateRange}
                onChange={setGateRange}
                min={-80}
                max={0}
                label="Range"
                displayValue={`${gateRange.toFixed(0)}dB`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GateTooltips.attack}</Tooltip>}
          >
            <div>
              <Knob
                value={gateAttack * 1000}
                onChange={(v) => setGateAttack(v / 1000)}
                min={0.1}
                max={10}
                step={0.1}
                label="Attack"
                displayValue={`${(gateAttack * 1000).toFixed(1)}ms`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GateTooltips.hold}</Tooltip>}
          >
            <div>
              <Knob
                value={gateHold * 1000}
                onChange={(v) => setGateHold(v / 1000)}
                min={0}
                max={100}
                label="Hold"
                displayValue={`${(gateHold * 1000).toFixed(0)}ms`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{GateTooltips.release}</Tooltip>}
          >
            <div>
              <Knob
                value={gateRelease * 1000}
                onChange={(v) => setGateRelease(v / 1000)}
                min={10}
                max={1000}
                label="Release"
                displayValue={`${(gateRelease * 1000).toFixed(0)}ms`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyGate}>
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952);
  // file length
  setUint32(length - 8);
  // RIFF type
  setUint32(0x45564157);
  // format chunk identifier
  setUint32(0x20746d66);
  // format chunk length
  setUint32(16);
  // sample format (PCM)
  setUint16(1);
  // channel count
  setUint16(buffer.numberOfChannels);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
  // block align
  setUint16(buffer.numberOfChannels * 2);
  // bits per sample
  setUint16(16);
  // data chunk identifier
  setUint32(0x61746164);
  // data chunk length
  setUint32(length - pos - 4);

  // Extract channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave channels and convert to 16-bit PCM
  while (offset < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;
}
