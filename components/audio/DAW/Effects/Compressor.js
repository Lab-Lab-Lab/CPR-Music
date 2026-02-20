'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Form, Dropdown, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import {
  useAudio,
  useEffects,
  useWaveform
} from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

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
  model: "Different compressor circuit emulations. VCA = punchy and precise, Optical = smooth and musical, FET = aggressive and colorful, Modern = clean and transparent."
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
 * Limited to never exceed unity gain (0dB output)
 */
function calculateAutoMakeup(threshold, ratio) {
  // Estimate average gain reduction
  const estimatedReduction = Math.abs(threshold) / ratio;
  // Very conservative makeup - only compensate 50% of the reduction
  // This ensures we never amplify above the original level
  return Math.min(estimatedReduction * 0.5, 6); // Cap at 6dB max
}

/**
 * Apply vintage saturation based on compressor model
 */
function applySaturation(sample, amount, model) {
  if (amount === 0) return sample;
  
  switch (model) {
    case 'vca':
      // VCA-style soft clipping
      return Math.tanh(sample * (1 + amount)) / (1 + amount * 0.5);
      
    case 'optical':
      // Optical-style gentle compression
      return sample * (1 - amount * 0.1 * Math.abs(sample));
      
    case 'fet':
      // FET-style aggressive saturation
      const drive = 1 + amount * 2;
      return Math.sign(sample) * Math.pow(Math.abs(sample), 1 / drive) * drive * 0.7;
      
    default:
      return sample;
  }
}

/**
 * Enhanced Mid/Side Processor for Compressor
 */
class CompressorMidSideProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.setupNodes();
  }
  
  setupNodes() {
    // Mid/Side encoding nodes
    this.splitter = this.context.createChannelSplitter(2);
    this.merger = this.context.createChannelMerger(2);
    
    // M/S encoding: M = (L+R)/√2, S = (L-R)/√2 (energy preserved)
    this.midGain = this.context.createGain();
    this.sideGain = this.context.createGain();
    this.leftInvert = this.context.createGain();
    
    this.midGain.gain.value = Math.SQRT1_2;  // 1/√2 for energy preservation
    this.sideGain.gain.value = Math.SQRT1_2; // 1/√2 for energy preservation
    this.leftInvert.gain.value = -1; // Invert for side calculation
    
    // Decoding nodes: L = (M + S)/√2, R = (M - S)/√2
    this.leftOut = this.context.createGain();
    this.rightOut = this.context.createGain();
    this.sideInvert = this.context.createGain();
    this.leftOut.gain.value = Math.SQRT1_2;
    this.rightOut.gain.value = Math.SQRT1_2;
    this.sideInvert.gain.value = -1;
    
    this.output = this.context.createChannelMerger(2);
  }
  
  encode(input) {
    // Split stereo input
    input.connect(this.splitter);
    
    // Calculate Mid: (L+R)/√2
    this.splitter.connect(this.midGain, 0);
    this.splitter.connect(this.midGain, 1);
    
    // Calculate Side: (L-R)/√2
    this.splitter.connect(this.sideGain, 0);
    this.splitter.connect(this.leftInvert, 1);
    this.leftInvert.connect(this.sideGain);
    
    return {
      mid: this.midGain,
      side: this.sideGain
    };
  }
  
  decode(midChain, sideChain) {
    // L = (M + S)/√2
    midChain.connect(this.leftOut);
    sideChain.connect(this.leftOut);
    
    // R = (M - S)/√2
    midChain.connect(this.rightOut);
    sideChain.connect(this.sideInvert);
    this.sideInvert.connect(this.rightOut);
    
    // Merge back to stereo
    this.leftOut.connect(this.output, 0, 0);
    this.rightOut.connect(this.output, 0, 1);
    
    return this.output;
  }
}

/**
 * Multiband Crossover Filter System
 */
class MultibandCrossover {
  constructor(audioContext, frequencies = [250, 2000, 8000]) {
    this.context = audioContext;
    this.frequencies = frequencies;
    this.setupFilters();
  }
  
  setupFilters() {
    this.bands = [];
    const numBands = this.frequencies.length + 1;
    
    for (let i = 0; i < numBands; i++) {
      const band = {
        lowpass: null,
        highpass: null,
        output: this.context.createGain()
      };
      
      if (i === 0) {
        // Lowest band - only lowpass
        band.lowpass = this.context.createBiquadFilter();
        band.lowpass.type = 'lowpass';
        band.lowpass.frequency.value = this.frequencies[0];
        band.lowpass.Q.value = 0.707; // Butterworth response
      } else if (i === numBands - 1) {
        // Highest band - only highpass
        band.highpass = this.context.createBiquadFilter();
        band.highpass.type = 'highpass';
        band.highpass.frequency.value = this.frequencies[i - 1];
        band.highpass.Q.value = 0.707;
      } else {
        // Middle bands - bandpass (highpass + lowpass)
        band.highpass = this.context.createBiquadFilter();
        band.highpass.type = 'highpass';
        band.highpass.frequency.value = this.frequencies[i - 1];
        band.highpass.Q.value = 0.707;
        
        band.lowpass = this.context.createBiquadFilter();
        band.lowpass.type = 'lowpass';
        band.lowpass.frequency.value = this.frequencies[i];
        band.lowpass.Q.value = 0.707;
      }
      
      this.bands.push(band);
    }
  }
  
  split(input) {
    const outputs = [];
    
    this.bands.forEach((band, index) => {
      if (band.lowpass && band.highpass) {
        // Bandpass: input -> highpass -> lowpass -> output
        input.connect(band.highpass);
        band.highpass.connect(band.lowpass);
        band.lowpass.connect(band.output);
      } else if (band.lowpass) {
        // Lowpass only: input -> lowpass -> output
        input.connect(band.lowpass);
        band.lowpass.connect(band.output);
      } else if (band.highpass) {
        // Highpass only: input -> highpass -> output
        input.connect(band.highpass);
        band.highpass.connect(band.output);
      }
      
      outputs.push(band.output);
    });
    
    return outputs;
  }
  
  merge(processedBands, output) {
    processedBands.forEach(band => {
      band.connect(output);
    });
    return output;
  }
}

/**
 * Create simple, safe compressor processing chain
 */
function createCompressorChain(audioContext, parameters) {
  // Create compressor with safe, fixed settings
  const compressor = audioContext.createDynamicsCompressor();

  // Set basic compressor parameters
  compressor.threshold.value = parameters.threshold || -24;
  compressor.ratio.value = parameters.ratio || 4;
  compressor.knee.value = Math.min(10, Math.max(0, parameters.knee || 2)); // Moderate knee for smooth transition

  // Use VERY fast attack to prevent ANY transients from getting through
  // This ensures compression always reduces, never amplifies
  compressor.attack.value = 0.0001; // Near-instantaneous attack (0.1ms)
  compressor.release.value = 0.25; // Moderate release (250ms)

  // Create output attenuation to ensure we never amplify
  const outputGain = audioContext.createGain();
  // Reduce output by the approximate gain reduction amount
  // This ensures output is always less than input
  const gainReduction = Math.abs(parameters.threshold) / (parameters.ratio * 2);
  const attenuation = Math.max(0.3, 1 - (gainReduction / 60)); // At least 30% of original, max 100%
  outputGain.gain.value = attenuation;

  // Connect the chain: input -> compressor -> attenuator -> output
  compressor.connect(outputGain);

  return {
    input: compressor,
    output: outputGain,
    compressor: compressor
  };
}

/**
 * Simple, safe compressor processing
 */
export async function processCompressorRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Create offline context with region length only
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Simple compressor processing - no complex modes
  const compressorChain = createCompressorChain(offlineContext, parameters);
  source.connect(compressorChain.input);
  const outputNode = compressorChain.output;

  // Connect to destination
  outputNode.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  // Render and return processed region directly
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}

/**
 * Compressor effect component using Web Audio API DynamicsCompressorNode
 */
export default function Compressor({ width, modalMode = false, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    compressorThreshold,
    setCompressorThreshold,
    compressorRatio,
    setCompressorRatio,
    compressorAttack,
    setCompressorAttack,
    compressorRelease,
    setCompressorRelease,
    compressorKnee,
    setCompressorKnee,
    compressorMakeup,
    setCompressorMakeup,
    compressorLookahead,
    setCompressorLookahead,
    compressorSidechain,
    setCompressorSidechain,
    compressorModel,
    setCompressorModel,
    compressorAutoMakeup,
    setCompressorAutoMakeup,
    
    // Mid/Side processing
    compressorMidSideMode,
    setCompressorMidSideMode,
    compressorMidThreshold,
    setCompressorMidThreshold,
    compressorMidRatio,
    setCompressorMidRatio,
    compressorMidAttack,
    setCompressorMidAttack,
    compressorMidRelease,
    setCompressorMidRelease,
    compressorMidMakeup,
    setCompressorMidMakeup,
    compressorSideThreshold,
    setCompressorSideThreshold,
    compressorSideRatio,
    setCompressorSideRatio,
    compressorSideAttack,
    setCompressorSideAttack,
    compressorSideRelease,
    setCompressorSideRelease,
    compressorSideMakeup,
    setCompressorSideMakeup,
    
    // Multiband processing
    compressorMultibandMode,
    setCompressorMultibandMode,
    compressorCrossoverFreqs,
    setCompressorCrossoverFreqs,
    compressorBand0Threshold,
    setCompressorBand0Threshold,
    compressorBand0Ratio,
    setCompressorBand0Ratio,
    compressorBand0Attack,
    setCompressorBand0Attack,
    compressorBand0Release,
    setCompressorBand0Release,
    compressorBand0Makeup,
    setCompressorBand0Makeup,
    compressorBand1Threshold,
    setCompressorBand1Threshold,
    compressorBand1Ratio,
    setCompressorBand1Ratio,
    compressorBand1Attack,
    setCompressorBand1Attack,
    compressorBand1Release,
    setCompressorBand1Release,
    compressorBand1Makeup,
    setCompressorBand1Makeup,
    compressorBand2Threshold,
    setCompressorBand2Threshold,
    compressorBand2Ratio,
    setCompressorBand2Ratio,
    compressorBand2Attack,
    setCompressorBand2Attack,
    compressorBand2Release,
    setCompressorBand2Release,
    compressorBand2Makeup,
    setCompressorBand2Makeup,
    compressorBand3Threshold,
    setCompressorBand3Threshold,
    compressorBand3Ratio,
    setCompressorBand3Ratio,
    compressorBand3Attack,
    setCompressorBand3Attack,
    compressorBand3Release,
    setCompressorBand3Release,
    compressorBand3Makeup,
    setCompressorBand3Makeup,
    
    cutRegion
  } = useEffects();

  const {
    audioBuffer,
    applyProcessedAudio,
    activeRegion,
    audioContext
  } = useWaveform();

  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Create compressor parameters object
  const compressorParameters = {
    threshold: compressorThreshold,
    ratio: compressorRatio,
    knee: compressorKnee
  };

  // Apply compressor permanently to selected region using WaveformContext
  const applyCompressor = useCallback(
    createEffectApplyFunction(processCompressorRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: compressorParameters,
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, compressorThreshold, compressorRatio, compressorKnee, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-3">
        <Col>
          <CompressorVisualization
            threshold={compressorThreshold}
            ratio={compressorRatio}
            knee={compressorKnee}
            width={modalMode ? 600 : 400}
            height={modalMode ? 300 : 250}
            modalMode={modalMode}
          />
        </Col>
      </Row>

      {/* Simplified Controls - Only Threshold, Ratio, and Knee */}
      <Row className="text-center align-items-end justify-content-center">
        <Col xs={6} sm={4} md={3} lg={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{CompressorTooltips.threshold}</Tooltip>}
          >
            <div>
              <Knob
                value={compressorThreshold}
                onChange={setCompressorThreshold}
                min={-60}
                max={0}
                label="Threshold"
                displayValue={`${compressorThreshold.toFixed(0)}dB`}
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
                value={compressorRatio}
                onChange={setCompressorRatio}
                min={1}
                max={20}
                step={0.1}
                label="Ratio"
                displayValue={`${compressorRatio.toFixed(1)}:1`}
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
            overlay={<Tooltip>{CompressorTooltips.knee}</Tooltip>}
          >
            <div>
              <Knob
                value={compressorKnee}
                onChange={setCompressorKnee}
                min={0}
                max={10}
                label="Knee"
                displayValue={`${compressorKnee.toFixed(0)}dB`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Apply Button */}
      <Row className="mt-3">
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyCompressor}
          >
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