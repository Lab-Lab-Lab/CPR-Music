/**
 * ClipDistortion - Clip-based version of Distortion effect
 * Adapted from single-track Distortion for use with multitrack clip effects
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

// Educational tooltips
const DistortionTooltips = {
  drive: "Increases input gain before distortion. Higher values push the signal harder, creating more harmonic content and saturation.",
  tone: "Adjusts the high-frequency content. Higher values brighten the sound, lower values darken it.",
  presence: "Boosts or cuts upper-midrange frequencies around 4kHz. Adds clarity and definition to the distorted signal.",
  asymmetry: "Creates uneven clipping between positive and negative signal peaks. Introduces even-order harmonics for a warmer, more organic character.",
  harmonics: "Adds additional harmonic overtones to the distortion. Increases complexity and richness of the distorted sound.",
  mix: "Blends between the dry (clean) signal and the distorted signal. 100% is fully distorted, lower values preserve more of the original sound.",
  bass: "Boosts or cuts low frequencies. Shapes the bottom end of the distorted signal.",
  mid: "Boosts or cuts midrange frequencies around 1kHz. Controls body and presence.",
  treble: "Boosts or cuts high frequencies. Adds or removes brightness and air.",
  output: "Final gain adjustment after all processing. Use to match levels or compensate for volume changes."
};

/**
 * Distortion/Saturation Types with different characteristics and preset values
 */
const DistortionTypes = {
  tubeSaturation: {
    name: 'Tube Saturation',
    description: 'Warm, musical tube-style saturation',
    presets: {
      drive: 8,
      tone: 6000,
      presence: 3,
      asymmetry: 0.2,
      harmonics: 0.7,
      mix: 0.85,
      bass: 2,
      mid: 1,
      treble: 2,
      outputGain: 0.9
    }
  },
  transistorDistortion: {
    name: 'Transistor',
    description: 'Classic transistor distortion',
    presets: {
      drive: 12,
      tone: 4500,
      presence: 5,
      asymmetry: 0.1,
      harmonics: 0.5,
      mix: 0.95,
      bass: 3,
      mid: 4,
      treble: 3,
      outputGain: 0.8
    }
  },
  digitalClipping: {
    name: 'Digital Clip',
    description: 'Hard digital clipping',
    presets: {
      drive: 15,
      tone: 8000,
      presence: 0,
      asymmetry: 0,
      harmonics: 0.2,
      mix: 1.0,
      bass: 0,
      mid: 0,
      treble: 0,
      outputGain: 0.7
    }
  },
  tapeCompression: {
    name: 'Tape Compression',
    description: 'Analog tape saturation',
    presets: {
      drive: 5,
      tone: 5500,
      presence: 2,
      asymmetry: 0.3,
      harmonics: 0.6,
      mix: 0.7,
      bass: 1,
      mid: 0,
      treble: -1,
      outputGain: 1.0
    }
  },
  fuzzBox: {
    name: 'Fuzz Box',
    description: 'Vintage fuzz pedal sound',
    presets: {
      drive: 18,
      tone: 3000,
      presence: 8,
      asymmetry: 0.5,
      harmonics: 1.0,
      mix: 1.0,
      bass: 5,
      mid: 6,
      treble: 4,
      outputGain: 0.6
    }
  },
  bitCrusher: {
    name: 'Bit Crusher',
    description: 'Lo-fi bit reduction',
    presets: {
      drive: 10,
      tone: 2000,
      presence: -2,
      asymmetry: 0,
      harmonics: 0.3,
      mix: 1.0,
      bass: -2,
      mid: 2,
      treble: -5,
      outputGain: 0.85
    }
  },
  waveShaper: {
    name: 'Wave Shaper',
    description: 'Waveshaping distortion',
    presets: {
      drive: 14,
      tone: 7000,
      presence: 4,
      asymmetry: 0.4,
      harmonics: 0.8,
      mix: 0.9,
      bass: 1,
      mid: 3,
      treble: 1,
      outputGain: 0.75
    }
  },
  asymmetricClip: {
    name: 'Asymmetric',
    description: 'Asymmetric clipping distortion',
    presets: {
      drive: 10,
      tone: 5000,
      presence: 3,
      asymmetry: 0.8,
      harmonics: 0.5,
      mix: 0.95,
      bass: 2,
      mid: 2,
      treble: 1,
      outputGain: 0.85
    }
  }
};

/**
 * Clip Distortion effect component - Clip-based version
 */
export default function ClipDistortion({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [type, setType] = useState(parameters?.type ?? 'tubeSaturation');
  const [drive, setDrive] = useState(parameters?.drive ?? 8);
  const [tone, setTone] = useState(parameters?.tone ?? 6000);
  const [presence, setPresence] = useState(parameters?.presence ?? 3);
  const [asymmetry, setAsymmetry] = useState(parameters?.asymmetry ?? 0.2);
  const [harmonics, setHarmonics] = useState(parameters?.harmonics ?? 0.7);
  const [wetMix, setWetMix] = useState(parameters?.wetMix ?? 0.85);
  const [bass, setBass] = useState(parameters?.bass ?? 2);
  const [mid, setMid] = useState(parameters?.mid ?? 1);
  const [treble, setTreble] = useState(parameters?.treble ?? 2);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 0.9);

  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      type,
      drive,
      tone,
      presence,
      asymmetry,
      harmonics,
      wetMix,
      bass,
      mid,
      treble,
      outputGain
    });
  }, [type, drive, tone, presence, asymmetry, harmonics, wetMix, bass, mid, treble, outputGain, onParametersChange]);

  // Draw distortion curve visualization
  const drawDistortionCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw input/output line (no distortion)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();

    // Draw unity line for dry signal (mix reference)
    if (wetMix < 1.0) {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(width, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw distortion curve
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();

    const driveGain = Math.pow(10, drive / 20);
    const outputGainValue = Math.pow(10, outputGain / 20);

    for (let x = 0; x < width; x++) {
      const input = (x / width) * 2 - 1; // -1 to 1
      let output;

      switch (type) {
        case 'tubeSaturation':
          output = Math.tanh(input * driveGain * 2) * 0.7;
          output += Math.sin(input * Math.PI * 2) * harmonics * 0.15;
          output += Math.sin(input * Math.PI * 3) * harmonics * 0.08 * harmonics;
          break;

        case 'transistorDistortion':
          const threshold = 0.7 - harmonics * 0.2;
          if (Math.abs(input * driveGain) < threshold) {
            output = input * driveGain;
          } else {
            output = threshold * Math.sign(input) + (Math.abs(input * driveGain) - threshold) * 0.3 * Math.sign(input);
          }
          output += Math.sin(input * Math.PI * 3) * harmonics * 0.1;
          break;

        case 'digitalClipping':
          output = Math.max(-1, Math.min(1, input * driveGain));
          if (harmonics > 0) {
            output = Math.round(output * (10 - harmonics * 8)) / (10 - harmonics * 8);
          }
          break;

        case 'tapeCompression':
          output = input * driveGain / (1 + Math.abs(input * driveGain * 0.5));
          output *= (1 + harmonics * 0.3);
          output += Math.sin(input * Math.PI * 2) * harmonics * 0.1;
          output += Math.sin(input * Math.PI * 4) * harmonics * 0.05;
          break;

        case 'fuzzBox':
          output = Math.sign(input * driveGain) * Math.pow(Math.abs(input * driveGain), 0.5 - harmonics * 0.3);
          output += Math.sin(input * Math.PI * 3) * harmonics * 0.2;
          output += Math.sin(input * Math.PI * 5) * harmonics * 0.1;
          break;

        case 'bitCrusher':
          const bits = Math.floor(16 - drive - harmonics * 8);
          const step = Math.pow(2, bits);
          output = Math.round(input * driveGain * step) / step;
          if (harmonics > 0) {
            output += (Math.random() - 0.5) * harmonics * 0.05;
          }
          break;

        case 'waveShaper':
          const a = driveGain * (0.5 + harmonics * 0.5);
          output = input * (1 + a * Math.abs(input));
          if (harmonics > 0.5) {
            output = Math.sin(output * Math.PI * (1 + harmonics));
          }
          output = Math.max(-1, Math.min(1, output));
          break;

        case 'asymmetricClip':
          const posThresh = 0.7 + asymmetry * 0.3 - harmonics * 0.1;
          const negThresh = 0.7 - asymmetry * 0.3 - harmonics * 0.1;
          const scaledInput = input * driveGain;

          if (scaledInput > posThresh) {
            output = posThresh + (scaledInput - posThresh) * (0.2 + harmonics * 0.1);
          } else if (scaledInput < -negThresh) {
            output = -negThresh + (scaledInput + negThresh) * (0.1 + harmonics * 0.05);
          } else {
            output = scaledInput;
          }
          break;

        default:
          output = input;
      }

      // Apply asymmetry if specified (except for asymmetric clip which has it built-in)
      if (asymmetry !== 0 && type !== 'asymmetricClip') {
        output = output + (output * output * asymmetry * 0.3);
      }

      // Apply output gain
      output = output * outputGainValue;

      // Apply wet/dry mix
      const drySignal = input;
      output = drySignal * (1 - wetMix) + output * wetMix;

      // Final clipping
      output = Math.max(-1, Math.min(1, output));

      // Convert to canvas coordinates
      const y = height - ((output + 1) / 2) * height;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw parameter indicators
    ctx.fillStyle = '#e75b5c';
    ctx.font = '11px monospace';
    ctx.fillText(`${DistortionTypes[type]?.name || 'Unknown'}`, 10, 15);

    // Show active parameters
    const activeParams = [];
    if (drive !== 0) activeParams.push(`Drive: ${drive.toFixed(1)}dB`);
    if (harmonics > 0) activeParams.push(`Harm: ${(harmonics * 100).toFixed(0)}%`);
    if (asymmetry !== 0) activeParams.push(`Asym: ${(asymmetry * 100).toFixed(0)}%`);
    if (wetMix < 1) activeParams.push(`Mix: ${(wetMix * 100).toFixed(0)}%`);
    if (outputGain !== 0) activeParams.push(`Out: ${outputGain.toFixed(1)}dB`);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#888';
    activeParams.forEach((param, i) => {
      ctx.fillText(param, 10, 30 + i * 12);
    });

    // Draw axis labels with better positioning
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('-1', 5, height - 5);
    ctx.fillText('0', 5, height / 2 + 3);
    ctx.fillText('+1', 5, 15);

    ctx.textAlign = 'center';
    ctx.fillText('Input', width / 2, height - 2);

    // Vertical label
    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Output', 0, 0);
    ctx.restore();
  }, [type, drive, asymmetry, harmonics, wetMix, outputGain]);

  // Update visualization
  useEffect(() => {
    drawDistortionCurve();
  }, [drawDistortionCurve]);

  // Handle type change with preset loading
  const handleTypeChange = useCallback((newType) => {
    const presets = DistortionTypes[newType]?.presets;
    if (presets) {
      setType(newType);
      setDrive(presets.drive);
      setTone(presets.tone);
      setPresence(presets.presence);
      setAsymmetry(presets.asymmetry);
      setHarmonics(presets.harmonics);
      setWetMix(presets.mix);
      setBass(presets.bass);
      setMid(presets.mid);
      setTreble(presets.treble);
      setOutputGain(presets.outputGain);
    } else {
      setType(newType);
    }
  }, []);

  return (
    <Container fluid className="p-2">
      {/* Distortion Curve Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <div className="d-flex justify-content-between align-items-center mb-2 p-2">
              <span className="text-white small">Distortion Analysis</span>
              <OverlayTrigger
                placement="left"
                overlay={<Tooltip>Click for help understanding the distortion visualization</Tooltip>}
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
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">Transfer Curve</small>
            </div>
          </div>
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding Distortion</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5>What is Distortion?</h5>
          <p>
            Distortion changes the shape of an audio waveform by adding harmonics (extra frequencies).
            Think of it like squashing or reshaping the sound wave - clean signals become "dirty" or "crunchy."
          </p>

          <h6 className="mt-3">Reading the Transfer Curve</h6>
          <p>
            The graph shows the input-to-output relationship - how incoming audio levels are transformed:
          </p>
          <ul>
            <li><strong>X-axis (Input):</strong> The original signal level coming in (-1 to +1)</li>
            <li><strong>Y-axis (Output):</strong> The processed signal level going out (-1 to +1)</li>
            <li><strong>Diagonal dashed line:</strong> Unity gain (no distortion) - input equals output</li>
            <li><strong>Red curve:</strong> Shows how distortion changes the signal</li>
          </ul>

          <h6 className="mt-3">Curve Shapes and Sound Character</h6>
          <ul>
            <li><strong>Straight diagonal:</strong> Clean signal (no distortion)</li>
            <li><strong>Gentle S-curve:</strong> Soft saturation (warm, musical)</li>
            <li><strong>Sharp corners:</strong> Hard clipping (aggressive, harsh)</li>
            <li><strong>Asymmetric curve:</strong> Different top and bottom = even harmonics (warmth)</li>
            <li><strong>Wavey/complex curves:</strong> Additional harmonics (rich, complex tone)</li>
          </ul>

          <h6 className="mt-3">Where Distortion Happens</h6>
          <p>
            Notice where the red curve bends away from the unity line - that's where distortion occurs!
            The more it bends, the more the signal is changed. When the curve flattens out (becomes horizontal),
            that's called "clipping" - the signal can't get any louder.
          </p>

          <h6 className="mt-3">Common Uses</h6>
          <ul>
            <li><strong>Guitar/Bass:</strong> Essential for rock, metal, and blues tones</li>
            <li><strong>Vocals:</strong> Gentle saturation adds warmth and presence</li>
            <li><strong>Drums:</strong> Adds punch and aggression</li>
            <li><strong>Mixing:</strong> Subtle saturation glues sounds together</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Got it!
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Distortion Type Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Distortion Type</Form.Label>
          <Form.Select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(DistortionTypes).map(([key, distType]) => (
              <option key={key} value={key}>{distType.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{DistortionTypes[type]?.description}</small>
        </Col>
      </Row>

      {/* Main Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.drive}</Tooltip>}
          >
            <div>
              <Knob
                value={drive}
                onChange={setDrive}
                min={0}
                max={20}
                step={0.1}
                label="Drive"
                displayValue={`${drive.toFixed(1)}dB`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.tone}</Tooltip>}
          >
            <div>
              <Knob
                value={tone}
                onChange={setTone}
                min={200}
                max={20000}
                step={50}
                label="Tone"
                displayValue={tone >= 1000 ? `${(tone/1000).toFixed(1)}k` : `${tone}Hz`}
                size={50}
                color="#cbb677"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.presence}</Tooltip>}
          >
            <div>
              <Knob
                value={presence}
                onChange={setPresence}
                min={-12}
                max={12}
                step={0.1}
                label="Presence"
                displayValue={`${presence > 0 ? '+' : ''}${presence.toFixed(1)}dB`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.asymmetry}</Tooltip>}
          >
            <div>
              <Knob
                value={asymmetry}
                onChange={setAsymmetry}
                min={-1}
                max={1}
                step={0.01}
                label="Asymmetry"
                displayValue={`${Math.round(asymmetry * 100)}%`}
                size={50}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.harmonics}</Tooltip>}
          >
            <div>
              <Knob
                value={harmonics}
                onChange={setHarmonics}
                min={0}
                max={1}
                step={0.01}
                label="Harmonics"
                displayValue={`${Math.round(harmonics * 100)}%`}
                size={50}
                color="#ffa500"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={wetMix}
                onChange={setWetMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(wetMix * 100)}%`}
                size={50}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Tone Stack (EQ) */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Tone Stack</div>
        </Col>

        <Col xs={6} sm={3} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.bass}</Tooltip>}
          >
            <div>
              <Knob
                value={bass}
                onChange={setBass}
                min={-12}
                max={12}
                step={0.1}
                label="Bass"
                displayValue={`${bass > 0 ? '+' : ''}${bass.toFixed(1)}dB`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={3} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.mid}</Tooltip>}
          >
            <div>
              <Knob
                value={mid}
                onChange={setMid}
                min={-12}
                max={12}
                step={0.1}
                label="Mid"
                displayValue={`${mid > 0 ? '+' : ''}${mid.toFixed(1)}dB`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={3} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.treble}</Tooltip>}
          >
            <div>
              <Knob
                value={treble}
                onChange={setTreble}
                min={-12}
                max={12}
                step={0.1}
                label="Treble"
                displayValue={`${treble > 0 ? '+' : ''}${treble.toFixed(1)}dB`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={3} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{DistortionTooltips.output}</Tooltip>}
          >
            <div>
              <Knob
                value={outputGain}
                onChange={setOutputGain}
                min={0}
                max={2}
                step={0.01}
                label="Output"
                displayValue={`${outputGain.toFixed(2)}x`}
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
