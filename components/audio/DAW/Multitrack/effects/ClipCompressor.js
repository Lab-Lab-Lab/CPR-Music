/**
 * ClipCompressor - Clip-based version of Compressor effect
 * Adapted from single-track Compressor for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, OverlayTrigger, Tooltip, Modal, Button } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import Knob from '../../../../Knob';

/**
 * Professional compressor models with vintage character
 */
const CompressorModels = {
  modern: {
    name: 'Modern Digital',
    attack: { min: 0.001, max: 0.1, curve: 'linear' },
    release: { min: 0.01, max: 2.0, curve: 'linear' },
    knee: { default: 2, character: 'clean' },
    saturation: 0
  },
  vca: {
    name: 'VCA Vintage',
    attack: { min: 0.002, max: 0.3, curve: 'exponential' },
    release: { min: 0.05, max: 3.0, curve: 'exponential' },
    knee: { default: 1, character: 'punchy' },
    saturation: 0.1
  },
  optical: {
    name: 'Optical',
    attack: { min: 0.01, max: 0.5, curve: 'logarithmic' },
    release: { min: 0.1, max: 5.0, curve: 'logarithmic' },
    knee: { default: 3, character: 'smooth' },
    saturation: 0.05
  },
  fet: {
    name: 'FET 1176',
    attack: { min: 0.0002, max: 0.008, curve: 'exponential' },
    release: { min: 0.05, max: 1.2, curve: 'exponential' },
    knee: { default: 0.5, character: 'aggressive' },
    saturation: 0.15
  }
};

// Tooltips for educational purposes
const CompressorTooltips = {
  threshold: "The volume level where compression begins. When audio exceeds this level, the compressor starts reducing the volume. Lower values mean more of your audio gets compressed.",
  ratio: "How much compression to apply. 4:1 means for every 4dB above the threshold, only 1dB comes out. Higher ratios = more compression. 1:1 = no compression, ∞:1 = limiting.",
  attack: "How quickly the compressor responds when audio exceeds the threshold. Fast attack (0-5ms) catches transients, slow attack (10-30ms) lets them through for punch.",
  release: "How quickly the compressor stops compressing after the signal drops below threshold. Match this to your material's rhythm for natural pumping or smooth sustain.",
  knee: "The transition smoothness at the threshold. Hard knee (0dB) = abrupt compression. Soft knee (10-20dB) = gradual compression for a more natural sound.",
  makeup: "Compensates for volume reduction after compression. Limited to prevent output from exceeding input level. Maximum 12dB with built-in safety limiting.",
  lookahead: "Delays the audio so the compressor can 'see' what's coming and react perfectly. Prevents transients from slipping through but adds latency.",
  model: "Different compressor circuit emulations. VCA = punchy and precise, Optical = smooth and musical, FET = aggressive and colorful, Modern = clean and transparent.",
  autoMakeup: "Automatically calculates makeup gain to compensate for compression. Ensures output level stays balanced with input level.",
  midSideMode: "Process mid (center) and side (stereo) channels separately. Useful for controlling stereo width or focusing compression on vocals/bass vs ambience.",
  multibandMode: "Split audio into frequency bands and compress each independently. Prevents bass from triggering compression of highs, and vice versa."
};

/**
 * CompressorVisualization - Transfer curve visualization
 */
function CompressorVisualization({
  threshold,
  ratio,
  knee,
  width = 400,
  height = 300,
  modalMode = false
}) {
  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Draw transfer curve
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

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Horizontal grid lines and labels
    for (let i = 0; i <= 6; i++) {
      const y = graphY + (graphHeight * i / 6);
      ctx.beginPath();
      ctx.moveTo(graphX, y);
      ctx.lineTo(graphX + graphWidth, y);
      ctx.stroke();

      // dB labels (output)
      const db = -60 + ((6 - i) * 10);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${db}`, graphX - 5, y + 3);
    }

    // Vertical grid lines and labels
    for (let i = 0; i <= 6; i++) {
      const x = graphX + (graphWidth * i / 6);
      ctx.beginPath();
      ctx.moveTo(x, graphY);
      ctx.lineTo(x, graphY + graphHeight);
      ctx.stroke();

      // dB labels (input)
      const db = -60 + (i * 10);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${db}`, x, graphY + graphHeight + 15);
    }

    // Draw unity line (input = output)
    ctx.strokeStyle = '#444';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphHeight);
    ctx.lineTo(graphX + graphWidth, graphY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw transfer curve
    ctx.strokeStyle = '#7bafd4';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i <= graphWidth; i++) {
      const inputDb = -60 + (i / graphWidth) * 60;
      let outputDb = inputDb;

      // Apply compression curve
      if (inputDb > threshold) {
        const excess = inputDb - threshold;

        // Apply knee smoothing
        let compressionAmount;
        if (knee > 0 && excess < knee) {
          // Smooth knee transition
          const kneeProgress = excess / knee;
          const smoothRatio = 1 + (ratio - 1) * (kneeProgress * kneeProgress);
          compressionAmount = excess * (1 - 1/smoothRatio);
        } else {
          // Hard knee or beyond knee range
          compressionAmount = excess * (1 - 1/ratio);
        }

        outputDb = inputDb - compressionAmount;
      } else {
        outputDb = inputDb;
      }

      // Apply safety limiting - output never exceeds input level
      outputDb = Math.min(outputDb, inputDb);

      // Convert dB to pixel position
      const xPos = graphX + i;
      const yPos = graphY + graphHeight - ((outputDb + 60) / 60) * graphHeight;

      if (i === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();

    // Draw threshold line
    const thresholdX = graphX + ((threshold + 60) / 60) * graphWidth;
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(thresholdX, graphY);
    ctx.lineTo(thresholdX, graphY + graphHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw knee area if applicable
    if (knee > 0) {
      const kneeStartX = thresholdX;
      const kneeEndX = graphX + ((threshold + knee + 60) / 60) * graphWidth;

      ctx.fillStyle = 'rgba(203, 182, 119, 0.1)';
      ctx.fillRect(kneeStartX, graphY, kneeEndX - kneeStartX, graphHeight);
    }

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Transfer Curve', w / 2, 15);
    ctx.fillText('Input (dB)', w / 2, h - 5);

    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();

    // Ratio display at threshold point
    if (threshold > -60 && threshold < 0) {
      ctx.fillStyle = '#7bafd4';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${ratio.toFixed(1)}:1`, thresholdX + 5, graphY + graphHeight / 2);
    }

  }, [threshold, ratio, knee]);

  // Draw on parameter changes
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  // Help modal content
  const HelpModal = () => (
    <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>Understanding the Compressor</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white">
        <h5>What is Audio Compression?</h5>
        <p>
          A compressor reduces the dynamic range of audio by making loud sounds quieter.
          It's like an automatic volume control that turns down the volume when the sound gets too loud.
        </p>

        <h6 className="mt-3">Reading the Transfer Curve</h6>
        <p>
          The graph shows how input levels (horizontal axis) are transformed to output levels (vertical axis):
        </p>
        <ul>
          <li><strong>Diagonal dotted line:</strong> This is the "unity line" where input = output (no change)</li>
          <li><strong>Blue curve:</strong> Shows the actual compression being applied</li>
          <li><strong>Below threshold:</strong> The blue line follows the diagonal (no compression)</li>
          <li><strong>Above threshold:</strong> The blue line flattens based on your ratio setting</li>
          <li><strong>Red dashed line:</strong> Shows your threshold setting</li>
          <li><strong>Yellow shaded area:</strong> Shows the knee region for gradual compression</li>
        </ul>

        <h6 className="mt-3">Example</h6>
        <p>
          With a 4:1 ratio and -20dB threshold: A sound at -10dB (10dB above threshold)
          will be compressed to only 2.5dB above threshold, outputting at -17.5dB instead of -10dB.
        </p>

        <h6 className="mt-3">Key Parameters</h6>
        <ul>
          <li><strong>Threshold:</strong> The level where compression starts</li>
          <li><strong>Ratio:</strong> How much to compress (4:1 means 4dB input becomes 1dB output above threshold)</li>
          <li><strong>Knee:</strong> How gradually compression begins (soft knee = smoother, hard knee = abrupt)</li>
          <li><strong>Attack:</strong> How quickly the compressor reacts</li>
          <li><strong>Release:</strong> How quickly it stops compressing</li>
          <li><strong>Makeup:</strong> Boosts the overall level after compression</li>
        </ul>
      </Modal.Body>
      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
          Got it!
        </Button>
      </Modal.Footer>
    </Modal>
  );

  return (
    <div className="compressor-visualization position-relative">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-white small">Compressor Analysis</span>
        <OverlayTrigger
          placement="left"
          overlay={<Tooltip>Click for help understanding the compressor visualization</Tooltip>}
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
        width={modalMode ? Math.min(width, 600) : width}
        height={modalMode ? Math.min(height, 400) : height}
        className="w-100"
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      />
      <HelpModal />
    </div>
  );
}

/**
 * Calculate auto-makeup gain based on threshold and ratio
 */
function calculateAutoMakeup(threshold, ratio) {
  const estimatedReduction = Math.abs(threshold) / ratio;
  return Math.min(estimatedReduction * 0.5, 6);
}

/**
 * Compressor effect component - Clip-based version
 */
export default function ClipCompressor({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [threshold, setThreshold] = useState(parameters?.threshold ?? -24);
  const [ratio, setRatio] = useState(parameters?.ratio ?? 4);
  const [attack, setAttack] = useState(parameters?.attack ?? 0.003);
  const [release, setRelease] = useState(parameters?.release ?? 0.25);
  const [knee, setKnee] = useState(parameters?.knee ?? 2);
  const [makeup, setMakeup] = useState(parameters?.makeup ?? 0);
  const [lookahead, setLookahead] = useState(parameters?.lookahead ?? 0);
  const [model, setModel] = useState(parameters?.model ?? 'modern');
  const [autoMakeup, setAutoMakeup] = useState(parameters?.autoMakeup ?? false);

  // Mid/Side processing
  const [midSideMode, setMidSideMode] = useState(parameters?.midSideMode ?? false);
  const [midThreshold, setMidThreshold] = useState(parameters?.midThreshold ?? -24);
  const [midRatio, setMidRatio] = useState(parameters?.midRatio ?? 4);
  const [midAttack, setMidAttack] = useState(parameters?.midAttack ?? 0.003);
  const [midRelease, setMidRelease] = useState(parameters?.midRelease ?? 0.25);
  const [midMakeup, setMidMakeup] = useState(parameters?.midMakeup ?? 0);
  const [sideThreshold, setSideThreshold] = useState(parameters?.sideThreshold ?? -24);
  const [sideRatio, setSideRatio] = useState(parameters?.sideRatio ?? 4);
  const [sideAttack, setSideAttack] = useState(parameters?.sideAttack ?? 0.003);
  const [sideRelease, setSideRelease] = useState(parameters?.sideRelease ?? 0.25);
  const [sideMakeup, setSideMakeup] = useState(parameters?.sideMakeup ?? 0);

  // Multiband processing
  const [multibandMode, setMultibandMode] = useState(parameters?.multibandMode ?? false);
  const [crossoverFreqs, setCrossoverFreqs] = useState(parameters?.crossoverFreqs ?? [250, 2000, 8000]);

  // Band 0 (Low)
  const [band0Threshold, setBand0Threshold] = useState(parameters?.band0Threshold ?? -24);
  const [band0Ratio, setBand0Ratio] = useState(parameters?.band0Ratio ?? 4);
  const [band0Attack, setBand0Attack] = useState(parameters?.band0Attack ?? 0.01);
  const [band0Release, setBand0Release] = useState(parameters?.band0Release ?? 0.25);
  const [band0Makeup, setBand0Makeup] = useState(parameters?.band0Makeup ?? 0);

  // Band 1 (Low-Mid)
  const [band1Threshold, setBand1Threshold] = useState(parameters?.band1Threshold ?? -24);
  const [band1Ratio, setBand1Ratio] = useState(parameters?.band1Ratio ?? 4);
  const [band1Attack, setBand1Attack] = useState(parameters?.band1Attack ?? 0.003);
  const [band1Release, setBand1Release] = useState(parameters?.band1Release ?? 0.25);
  const [band1Makeup, setBand1Makeup] = useState(parameters?.band1Makeup ?? 0);

  // Band 2 (High-Mid)
  const [band2Threshold, setBand2Threshold] = useState(parameters?.band2Threshold ?? -24);
  const [band2Ratio, setBand2Ratio] = useState(parameters?.band2Ratio ?? 4);
  const [band2Attack, setBand2Attack] = useState(parameters?.band2Attack ?? 0.001);
  const [band2Release, setBand2Release] = useState(parameters?.band2Release ?? 0.1);
  const [band2Makeup, setBand2Makeup] = useState(parameters?.band2Makeup ?? 0);

  // Band 3 (High)
  const [band3Threshold, setBand3Threshold] = useState(parameters?.band3Threshold ?? -24);
  const [band3Ratio, setBand3Ratio] = useState(parameters?.band3Ratio ?? 4);
  const [band3Attack, setBand3Attack] = useState(parameters?.band3Attack ?? 0.0005);
  const [band3Release, setBand3Release] = useState(parameters?.band3Release ?? 0.05);
  const [band3Makeup, setBand3Makeup] = useState(parameters?.band3Makeup ?? 0);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      threshold,
      ratio,
      attack,
      release,
      knee,
      makeup,
      lookahead,
      model,
      autoMakeup,
      midSideMode,
      midThreshold,
      midRatio,
      midAttack,
      midRelease,
      midMakeup,
      sideThreshold,
      sideRatio,
      sideAttack,
      sideRelease,
      sideMakeup,
      multibandMode,
      crossoverFreqs,
      band0Threshold,
      band0Ratio,
      band0Attack,
      band0Release,
      band0Makeup,
      band1Threshold,
      band1Ratio,
      band1Attack,
      band1Release,
      band1Makeup,
      band2Threshold,
      band2Ratio,
      band2Attack,
      band2Release,
      band2Makeup,
      band3Threshold,
      band3Ratio,
      band3Attack,
      band3Release,
      band3Makeup,
    });
  }, [
    threshold, ratio, attack, release, knee, makeup, lookahead, model, autoMakeup,
    midSideMode, midThreshold, midRatio, midAttack, midRelease, midMakeup,
    sideThreshold, sideRatio, sideAttack, sideRelease, sideMakeup,
    multibandMode, crossoverFreqs,
    band0Threshold, band0Ratio, band0Attack, band0Release, band0Makeup,
    band1Threshold, band1Ratio, band1Attack, band1Release, band1Makeup,
    band2Threshold, band2Ratio, band2Attack, band2Release, band2Makeup,
    band3Threshold, band3Ratio, band3Attack, band3Release, band3Makeup,
    onParametersChange
  ]);

  // Auto-makeup calculation
  useEffect(() => {
    if (autoMakeup) {
      const calculatedMakeup = calculateAutoMakeup(threshold, ratio);
      setMakeup(calculatedMakeup);
    }
  }, [autoMakeup, threshold, ratio]);

  // Get current model settings
  const currentModel = CompressorModels[model];

  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-3">
        <Col>
          <CompressorVisualization
            threshold={threshold}
            ratio={ratio}
            knee={knee}
            width={600}
            height={300}
            modalMode={true}
          />
        </Col>
      </Row>

      {/* Mode Selection */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex gap-3 align-items-center">
            <Form.Check
              type="checkbox"
              id="midSideMode"
              label="Mid/Side Mode"
              checked={midSideMode}
              onChange={(e) => setMidSideMode(e.target.checked)}
              className="text-white"
            />
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{CompressorTooltips.midSideMode}</Tooltip>}
            >
              <FaQuestionCircle className="text-info" />
            </OverlayTrigger>

            <Form.Check
              type="checkbox"
              id="multibandMode"
              label="Multiband Mode"
              checked={multibandMode}
              onChange={(e) => setMultibandMode(e.target.checked)}
              className="text-white ms-3"
            />
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{CompressorTooltips.multibandMode}</Tooltip>}
            >
              <FaQuestionCircle className="text-info" />
            </OverlayTrigger>
          </div>
        </Col>
      </Row>

      {/* Main Controls */}
      {!midSideMode && !multibandMode && (
        <>
          <Row className="text-center align-items-end justify-content-center mb-3">
            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.threshold}</Tooltip>}
              >
                <div>
                  <Knob
                    value={threshold}
                    onChange={setThreshold}
                    min={-60}
                    max={0}
                    label="Threshold"
                    displayValue={`${threshold.toFixed(0)}dB`}
                    size={50}
                    color="#e75b5c"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.ratio}</Tooltip>}
              >
                <div>
                  <Knob
                    value={ratio}
                    onChange={setRatio}
                    min={1}
                    max={20}
                    step={0.1}
                    label="Ratio"
                    displayValue={`${ratio.toFixed(1)}:1`}
                    size={50}
                    color="#7bafd4"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.attack}</Tooltip>}
              >
                <div>
                  <Knob
                    value={attack}
                    onChange={setAttack}
                    min={currentModel.attack.min}
                    max={currentModel.attack.max}
                    step={0.0001}
                    label="Attack"
                    displayValue={`${(attack * 1000).toFixed(1)}ms`}
                    size={50}
                    color="#81c784"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.release}</Tooltip>}
              >
                <div>
                  <Knob
                    value={release}
                    onChange={setRelease}
                    min={currentModel.release.min}
                    max={currentModel.release.max}
                    step={0.01}
                    label="Release"
                    displayValue={`${(release * 1000).toFixed(0)}ms`}
                    size={50}
                    color="#ba68c8"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.knee}</Tooltip>}
              >
                <div>
                  <Knob
                    value={knee}
                    onChange={setKnee}
                    min={0}
                    max={10}
                    label="Knee"
                    displayValue={`${knee.toFixed(0)}dB`}
                    size={50}
                    color="#cbb677"
                  />
                </div>
              </OverlayTrigger>
            </Col>

            <Col xs={6} sm={4} md={3} lg={2}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 100 }}
                overlay={<Tooltip>{CompressorTooltips.makeup}</Tooltip>}
              >
                <div>
                  <Knob
                    value={makeup}
                    onChange={setMakeup}
                    min={0}
                    max={12}
                    step={0.1}
                    label="Makeup"
                    displayValue={`${makeup.toFixed(1)}dB`}
                    size={50}
                    color="#ffa726"
                    disabled={autoMakeup}
                  />
                </div>
              </OverlayTrigger>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col xs={12} md={6} className="mb-2">
              <Form.Label className="text-white">
                Compressor Model
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>{CompressorTooltips.model}</Tooltip>}
                >
                  <FaQuestionCircle className="ms-2 text-info" style={{ cursor: 'pointer' }} />
                </OverlayTrigger>
              </Form.Label>
              <Form.Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-dark text-white"
              >
                {Object.entries(CompressorModels).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name} ({value.character})
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={6} className="mb-2 d-flex align-items-end">
              <Form.Check
                type="checkbox"
                id="autoMakeup"
                label="Auto Makeup Gain"
                checked={autoMakeup}
                onChange={(e) => setAutoMakeup(e.target.checked)}
                className="text-white"
              />
              <OverlayTrigger
                placement="top"
                overlay={<Tooltip>{CompressorTooltips.autoMakeup}</Tooltip>}
              >
                <FaQuestionCircle className="ms-2 text-info" />
              </OverlayTrigger>
            </Col>
          </Row>
        </>
      )}

      {/* Mid/Side Mode Controls */}
      {midSideMode && !multibandMode && (
        <Row className="mb-3">
          <Col md={6}>
            <h6 className="text-white mb-3">Mid (Center) Channel</h6>
            <Row className="text-center align-items-end justify-content-center">
              <Col xs={6} sm={4}>
                <Knob
                  value={midThreshold}
                  onChange={setMidThreshold}
                  min={-60}
                  max={0}
                  label="Threshold"
                  displayValue={`${midThreshold.toFixed(0)}dB`}
                  size={40}
                  color="#e75b5c"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={midRatio}
                  onChange={setMidRatio}
                  min={1}
                  max={20}
                  step={0.1}
                  label="Ratio"
                  displayValue={`${midRatio.toFixed(1)}:1`}
                  size={40}
                  color="#7bafd4"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={midAttack}
                  onChange={setMidAttack}
                  min={0.0001}
                  max={0.5}
                  step={0.0001}
                  label="Attack"
                  displayValue={`${(midAttack * 1000).toFixed(1)}ms`}
                  size={40}
                  color="#81c784"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={midRelease}
                  onChange={setMidRelease}
                  min={0.01}
                  max={5}
                  step={0.01}
                  label="Release"
                  displayValue={`${(midRelease * 1000).toFixed(0)}ms`}
                  size={40}
                  color="#ba68c8"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={midMakeup}
                  onChange={setMidMakeup}
                  min={0}
                  max={12}
                  step={0.1}
                  label="Makeup"
                  displayValue={`${midMakeup.toFixed(1)}dB`}
                  size={40}
                  color="#ffa726"
                />
              </Col>
            </Row>
          </Col>

          <Col md={6}>
            <h6 className="text-white mb-3">Side (Stereo) Channel</h6>
            <Row className="text-center align-items-end justify-content-center">
              <Col xs={6} sm={4}>
                <Knob
                  value={sideThreshold}
                  onChange={setSideThreshold}
                  min={-60}
                  max={0}
                  label="Threshold"
                  displayValue={`${sideThreshold.toFixed(0)}dB`}
                  size={40}
                  color="#e75b5c"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={sideRatio}
                  onChange={setSideRatio}
                  min={1}
                  max={20}
                  step={0.1}
                  label="Ratio"
                  displayValue={`${sideRatio.toFixed(1)}:1`}
                  size={40}
                  color="#7bafd4"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={sideAttack}
                  onChange={setSideAttack}
                  min={0.0001}
                  max={0.5}
                  step={0.0001}
                  label="Attack"
                  displayValue={`${(sideAttack * 1000).toFixed(1)}ms`}
                  size={40}
                  color="#81c784"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={sideRelease}
                  onChange={setSideRelease}
                  min={0.01}
                  max={5}
                  step={0.01}
                  label="Release"
                  displayValue={`${(sideRelease * 1000).toFixed(0)}ms`}
                  size={40}
                  color="#ba68c8"
                />
              </Col>
              <Col xs={6} sm={4}>
                <Knob
                  value={sideMakeup}
                  onChange={setSideMakeup}
                  min={0}
                  max={12}
                  step={0.1}
                  label="Makeup"
                  displayValue={`${sideMakeup.toFixed(1)}dB`}
                  size={40}
                  color="#ffa726"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {/* Multiband Mode Controls */}
      {multibandMode && !midSideMode && (
        <>
          <Row className="mb-3">
            <Col>
              <Form.Label className="text-white">Crossover Frequencies</Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <Form.Control
                  type="number"
                  value={crossoverFreqs[0]}
                  onChange={(e) => setCrossoverFreqs([+e.target.value, crossoverFreqs[1], crossoverFreqs[2]])}
                  className="bg-dark text-white"
                  style={{ width: '100px' }}
                />
                <span className="text-white">Hz</span>
                <Form.Control
                  type="number"
                  value={crossoverFreqs[1]}
                  onChange={(e) => setCrossoverFreqs([crossoverFreqs[0], +e.target.value, crossoverFreqs[2]])}
                  className="bg-dark text-white"
                  style={{ width: '100px' }}
                />
                <span className="text-white">Hz</span>
                <Form.Control
                  type="number"
                  value={crossoverFreqs[2]}
                  onChange={(e) => setCrossoverFreqs([crossoverFreqs[0], crossoverFreqs[1], +e.target.value])}
                  className="bg-dark text-white"
                  style={{ width: '100px' }}
                />
                <span className="text-white">Hz</span>
              </div>
            </Col>
          </Row>

          <Row>
            {/* Band 0 - Low */}
            <Col md={6} lg={3} className="mb-3">
              <h6 className="text-white mb-2">Low (&lt;{crossoverFreqs[0]}Hz)</h6>
              <Row className="text-center">
                <Col xs={6}>
                  <Knob value={band0Threshold} onChange={setBand0Threshold} min={-60} max={0} label="Thresh" displayValue={`${band0Threshold.toFixed(0)}dB`} size={35} color="#e75b5c" />
                </Col>
                <Col xs={6}>
                  <Knob value={band0Ratio} onChange={setBand0Ratio} min={1} max={20} step={0.1} label="Ratio" displayValue={`${band0Ratio.toFixed(1)}:1`} size={35} color="#7bafd4" />
                </Col>
                <Col xs={6}>
                  <Knob value={band0Attack} onChange={setBand0Attack} min={0.0001} max={0.5} step={0.0001} label="Atk" displayValue={`${(band0Attack * 1000).toFixed(1)}ms`} size={35} color="#81c784" />
                </Col>
                <Col xs={6}>
                  <Knob value={band0Release} onChange={setBand0Release} min={0.01} max={5} step={0.01} label="Rel" displayValue={`${(band0Release * 1000).toFixed(0)}ms`} size={35} color="#ba68c8" />
                </Col>
                <Col xs={12}>
                  <Knob value={band0Makeup} onChange={setBand0Makeup} min={0} max={12} step={0.1} label="Makeup" displayValue={`${band0Makeup.toFixed(1)}dB`} size={35} color="#ffa726" />
                </Col>
              </Row>
            </Col>

            {/* Band 1 - Low-Mid */}
            <Col md={6} lg={3} className="mb-3">
              <h6 className="text-white mb-2">Low-Mid ({crossoverFreqs[0]}-{crossoverFreqs[1]}Hz)</h6>
              <Row className="text-center">
                <Col xs={6}>
                  <Knob value={band1Threshold} onChange={setBand1Threshold} min={-60} max={0} label="Thresh" displayValue={`${band1Threshold.toFixed(0)}dB`} size={35} color="#e75b5c" />
                </Col>
                <Col xs={6}>
                  <Knob value={band1Ratio} onChange={setBand1Ratio} min={1} max={20} step={0.1} label="Ratio" displayValue={`${band1Ratio.toFixed(1)}:1`} size={35} color="#7bafd4" />
                </Col>
                <Col xs={6}>
                  <Knob value={band1Attack} onChange={setBand1Attack} min={0.0001} max={0.5} step={0.0001} label="Atk" displayValue={`${(band1Attack * 1000).toFixed(1)}ms`} size={35} color="#81c784" />
                </Col>
                <Col xs={6}>
                  <Knob value={band1Release} onChange={setBand1Release} min={0.01} max={5} step={0.01} label="Rel" displayValue={`${(band1Release * 1000).toFixed(0)}ms`} size={35} color="#ba68c8" />
                </Col>
                <Col xs={12}>
                  <Knob value={band1Makeup} onChange={setBand1Makeup} min={0} max={12} step={0.1} label="Makeup" displayValue={`${band1Makeup.toFixed(1)}dB`} size={35} color="#ffa726" />
                </Col>
              </Row>
            </Col>

            {/* Band 2 - High-Mid */}
            <Col md={6} lg={3} className="mb-3">
              <h6 className="text-white mb-2">High-Mid ({crossoverFreqs[1]}-{crossoverFreqs[2]}Hz)</h6>
              <Row className="text-center">
                <Col xs={6}>
                  <Knob value={band2Threshold} onChange={setBand2Threshold} min={-60} max={0} label="Thresh" displayValue={`${band2Threshold.toFixed(0)}dB`} size={35} color="#e75b5c" />
                </Col>
                <Col xs={6}>
                  <Knob value={band2Ratio} onChange={setBand2Ratio} min={1} max={20} step={0.1} label="Ratio" displayValue={`${band2Ratio.toFixed(1)}:1`} size={35} color="#7bafd4" />
                </Col>
                <Col xs={6}>
                  <Knob value={band2Attack} onChange={setBand2Attack} min={0.0001} max={0.5} step={0.0001} label="Atk" displayValue={`${(band2Attack * 1000).toFixed(1)}ms`} size={35} color="#81c784" />
                </Col>
                <Col xs={6}>
                  <Knob value={band2Release} onChange={setBand2Release} min={0.01} max={5} step={0.01} label="Rel" displayValue={`${(band2Release * 1000).toFixed(0)}ms`} size={35} color="#ba68c8" />
                </Col>
                <Col xs={12}>
                  <Knob value={band2Makeup} onChange={setBand2Makeup} min={0} max={12} step={0.1} label="Makeup" displayValue={`${band2Makeup.toFixed(1)}dB`} size={35} color="#ffa726" />
                </Col>
              </Row>
            </Col>

            {/* Band 3 - High */}
            <Col md={6} lg={3} className="mb-3">
              <h6 className="text-white mb-2">High (&gt;{crossoverFreqs[2]}Hz)</h6>
              <Row className="text-center">
                <Col xs={6}>
                  <Knob value={band3Threshold} onChange={setBand3Threshold} min={-60} max={0} label="Thresh" displayValue={`${band3Threshold.toFixed(0)}dB`} size={35} color="#e75b5c" />
                </Col>
                <Col xs={6}>
                  <Knob value={band3Ratio} onChange={setBand3Ratio} min={1} max={20} step={0.1} label="Ratio" displayValue={`${band3Ratio.toFixed(1)}:1`} size={35} color="#7bafd4" />
                </Col>
                <Col xs={6}>
                  <Knob value={band3Attack} onChange={setBand3Attack} min={0.0001} max={0.5} step={0.0001} label="Atk" displayValue={`${(band3Attack * 1000).toFixed(1)}ms`} size={35} color="#81c784" />
                </Col>
                <Col xs={6}>
                  <Knob value={band3Release} onChange={setBand3Release} min={0.01} max={5} step={0.01} label="Rel" displayValue={`${(band3Release * 1000).toFixed(0)}ms`} size={35} color="#ba68c8" />
                </Col>
                <Col xs={12}>
                  <Knob value={band3Makeup} onChange={setBand3Makeup} min={0} max={12} step={0.1} label="Makeup" displayValue={`${band3Makeup.toFixed(1)}dB`} size={35} color="#ffa726" />
                </Col>
              </Row>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}
