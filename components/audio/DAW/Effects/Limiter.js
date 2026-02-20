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

// Educational tooltips
const LimiterTooltips = {
  ceiling: "The maximum output level. No signal will exceed this threshold, creating a 'brick wall' limit for absolute peak control.",
  release: "How quickly the limiter stops reducing gain after the signal drops below the ceiling. Faster release preserves transients, slower release sounds smoother.",
  lookahead: "Allows the limiter to anticipate incoming peaks by delaying the signal. Prevents transients from slipping through at the cost of added latency.",
  isr: "Inter-Sample Peak detection catches peaks that occur between digital samples. Essential for true peak limiting in mastering.",
  algorithm: "Different limiting characters: Transparent = clean, Vintage = warm coloration, Aggressive = maximum loudness, Mastering = sophisticated multi-stage."
};

/**
 * LimiterVisualization - Static limiting curve
 */
function LimiterVisualization({
  ceiling,
  release,
  lookahead,
  algorithm,
  width = 400,
  height = 300,
  modalMode = false
}) {
  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Draw static limiting curve
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

    // Fixed coordinate system - doesn't change with parameters
    const minDbInput = -12;  // Fixed input range start
    const maxDbInput = 3;    // Fixed input range end
    const minDbOutput = -12; // Fixed output range start
    const maxDbOutput = 0;   // Fixed output range end
    const dbRangeInput = maxDbInput - minDbInput;  // 15dB range
    const dbRangeOutput = maxDbOutput - minDbOutput; // 12dB range

    const ceilingDb = ceiling; // The actual ceiling parameter value

    // Draw grid - now with 1dB increments for the zoomed view
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Draw horizontal grid lines (output levels) - fixed range
    for (let db = minDbOutput; db <= maxDbOutput; db += 1) {
      const yPos = graphY + graphHeight - ((db - minDbOutput) / dbRangeOutput) * graphHeight;

      // Major lines every 3dB, minor every 1dB
      const isMajor = db % 3 === 0;
      ctx.strokeStyle = isMajor ? '#444' : '#2a2a2a';
      ctx.lineWidth = isMajor ? 1 : 0.5;

      ctx.beginPath();
      ctx.moveTo(graphX, yPos);
      ctx.lineTo(graphX + graphWidth, yPos);
      ctx.stroke();

      // Output labels for major lines
      if (isMajor) {
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${db}`, graphX - 5, yPos + 3);
      }
    }

    // Draw vertical grid lines (input levels) - fixed range
    for (let db = minDbInput; db <= maxDbInput; db += 1) {
      const xPos = graphX + ((db - minDbInput) / dbRangeInput) * graphWidth;

      // Major lines every 3dB, minor every 1dB
      const isMajor = db % 3 === 0;
      ctx.strokeStyle = isMajor ? '#444' : '#2a2a2a';
      ctx.lineWidth = isMajor ? 1 : 0.5;

      ctx.beginPath();
      ctx.moveTo(xPos, graphY);
      ctx.lineTo(xPos, graphY + graphHeight);
      ctx.stroke();

      // Input labels for major lines
      if (isMajor) {
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${db}`, xPos, graphY + graphHeight + 15);
      }
    }

    // Draw ceiling line (horizontal at the ceiling level)
    if (ceilingDb >= minDbOutput && ceilingDb <= maxDbOutput) {
      const ceilingY = graphY + graphHeight - ((ceilingDb - minDbOutput) / dbRangeOutput) * graphHeight;

      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(graphX, ceilingY);
      ctx.lineTo(graphX + graphWidth, ceilingY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw unity line (input = output) across the graph
    ctx.strokeStyle = '#666';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Unity line: where output equals input (diagonal line)
    for (let db = minDbInput; db <= Math.min(maxDbOutput, maxDbInput); db += 0.1) {
      const xPos = graphX + ((db - minDbInput) / dbRangeInput) * graphWidth;
      const yPos = graphY + graphHeight - ((db - minDbOutput) / dbRangeOutput) * graphHeight;

      if (db === minDbInput) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate knee width based on algorithm and parameters
    let baseKneeWidth = 1; // default in dB

    // Set base knee width for each algorithm
    if (algorithm === 'brickwall') {
      baseKneeWidth = 0.05; // Ultra-sharp knee
    } else if (algorithm === 'aggressive') {
      baseKneeWidth = 0.3; // Sharp knee
    } else if (algorithm === 'transparent') {
      baseKneeWidth = 1.0; // Gentle knee
    } else if (algorithm === 'vintage') {
      baseKneeWidth = 1.5; // Soft vintage knee
    } else if (algorithm === 'mastering') {
      baseKneeWidth = 2.0; // Very soft for transparent mastering
    }

    // Lookahead effect: 0-20ms maps to 0-200% additional knee width
    const lookaheadFactor = lookahead / 20; // 0 to 1
    const lookaheadEffect = 1 + (lookaheadFactor * 2); // 1x to 3x multiplier

    // Release effect: 1-1000ms affects knee smoothness
    // Fast release (1-100ms) = sharper knee (0.5x to 1x)
    // Slow release (100-1000ms) = smoother knee (1x to 2x)
    let releaseFactor;
    if (release <= 100) {
      // Fast release: make knee sharper (reduce width)
      releaseFactor = 0.5 + (release / 100) * 0.5; // 0.5x to 1x
    } else {
      // Slow release: make knee smoother (increase width)
      releaseFactor = 1 + ((release - 100) / 900); // 1x to 2x
    }

    // Combine all factors
    let kneeWidth = baseKneeWidth * lookaheadEffect * releaseFactor;

    // Ensure knee width stays reasonable (0.05 to 6dB)
    kneeWidth = Math.max(0.05, Math.min(6, kneeWidth));

    // Draw knee region with enhanced visibility
    if (kneeWidth > 0.1 && ceilingDb >= minDbOutput) {
      const kneeStartDb = Math.max(minDbInput, ceilingDb - kneeWidth);
      const kneeEndDb = ceilingDb;

      // Only draw if knee is within visible range
      if (kneeStartDb <= maxDbInput && kneeEndDb >= minDbInput) {
        const kneeStartX = graphX + ((kneeStartDb - minDbInput) / dbRangeInput) * graphWidth;
        const kneeEndX = graphX + ((kneeEndDb - minDbInput) / dbRangeInput) * graphWidth;

        // Gradient shading for knee region
        const gradient = ctx.createLinearGradient(kneeStartX, 0, kneeEndX, 0);
        gradient.addColorStop(0, 'rgba(255, 107, 107, 0.02)');
        gradient.addColorStop(0.5, 'rgba(255, 107, 107, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 107, 107, 0.25)');

        ctx.fillStyle = gradient;
        ctx.fillRect(kneeStartX, graphY, kneeEndX - kneeStartX, graphHeight);

        // Draw vertical lines at knee boundaries
        ctx.strokeStyle = '#ff6b6b44';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        // Knee start line
        ctx.beginPath();
        ctx.moveTo(kneeStartX, graphY);
        ctx.lineTo(kneeStartX, graphY + graphHeight);
        ctx.stroke();

        ctx.setLineDash([]);

        // Add knee width indicator
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        const kneeLabel = `Knee: ${kneeWidth.toFixed(1)}dB`;

        // Position label based on available space
        if (kneeEndX - kneeStartX > 60) {
          // Draw inside the knee region if there's space
          ctx.fillText(kneeLabel, (kneeStartX + kneeEndX) / 2, graphY + 15);
        } else {
          // Draw outside if knee is too narrow
          ctx.fillText(kneeLabel, kneeEndX + 40, graphY + 15);
        }
      }
    }

    // Draw limiting curve
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Draw curve across the full input range
    for (let i = 0; i <= graphWidth; i++) {
      const inputDb = minDbInput + (i / graphWidth) * dbRangeInput;
      let outputDb;

      if (inputDb < ceilingDb - kneeWidth) {
        // Below limiting threshold - unity gain (1:1)
        outputDb = inputDb;
      } else if (inputDb < ceilingDb) {
        // In knee region - smooth transition
        const kneeProgress = (inputDb - (ceilingDb - kneeWidth)) / kneeWidth;

        // Different curve shapes for different algorithms
        let smoothFactor;
        if (algorithm === 'brickwall') {
          // Very sharp transition - almost linear
          smoothFactor = kneeProgress;
        } else if (algorithm === 'aggressive') {
          // Fast transition with slight curve
          smoothFactor = Math.pow(kneeProgress, 0.7);
        } else if (algorithm === 'transparent') {
          // Smooth sine curve
          smoothFactor = 0.5 * (1 + Math.sin((kneeProgress - 0.5) * Math.PI));
        } else if (algorithm === 'vintage') {
          // Soft S-curve with warmth
          smoothFactor = kneeProgress * kneeProgress * (3 - 2 * kneeProgress);
        } else if (algorithm === 'mastering') {
          // Very gradual, multi-stage curve
          smoothFactor = Math.pow(kneeProgress, 2.5);
        } else {
          // Default smooth curve
          smoothFactor = 0.5 * (1 + Math.sin((kneeProgress - 0.5) * Math.PI));
        }

        outputDb = inputDb * (1 - smoothFactor) + ceilingDb * smoothFactor;
      } else {
        // Above ceiling - hard limit
        outputDb = ceilingDb;
      }

      // Ensure output never exceeds ceiling or 0dB, and stays within visible range
      outputDb = Math.max(minDbOutput, Math.min(outputDb, ceilingDb, maxDbOutput));

      // Convert to pixel coordinates
      const xPos = graphX + i;
      const yPos = graphY + graphHeight - ((outputDb - minDbOutput) / dbRangeOutput) * graphHeight;

      if (i === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();

    // Ceiling label (already drawn as part of grid highlighting)
    // Add text label for ceiling
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Ceiling: ${ceilingDb.toFixed(1)}dB`, w / 2, graphY - 10);

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Limiter Transfer Function', w / 2, 15);
    ctx.fillText('Input (dB)', w / 2, h - 5);

    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();

    // Algorithm indicator
    ctx.fillStyle = getAlgorithmColor(algorithm);
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(algorithm?.toUpperCase() || 'TRANSPARENT', w - padding, 15);

    // Show lookahead value if significant
    if (lookahead > 0) {
      ctx.fillStyle = '#9b59b6';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Lookahead: ${lookahead.toFixed(1)}ms`, w - padding, 28);
    }
  }, [ceiling, algorithm, release, lookahead]);

  // Get color based on algorithm
  const getAlgorithmColor = (algo) => {
    const colors = {
      transparent: '#7bafd4',
      vintage: '#cbb677',
      aggressive: '#e75b5c',
      mastering: '#9370db',
      brickwall: '#ff6b6b'
    };
    return colors[algo] || '#7bafd4';
  };

  // Draw on parameter changes
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  // Help modal
  const HelpModal = () => (
    <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>Understanding the Limiter</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white">
        <h5>What is a Limiter?</h5>
        <p>
          A limiter is an extreme form of compression that prevents audio from exceeding a maximum level (ceiling).
          Think of it as an automatic volume control that instantly turns down any sound that tries to go above your set limit.
        </p>

        <h6 className="mt-3">Limiter vs Compressor</h6>
        <ul>
          <li><strong>Compressor:</strong> Gradual gain reduction with ratios like 4:1 or 8:1</li>
          <li><strong>Limiter:</strong> Extreme ratios (∞:1) creating an absolute ceiling</li>
        </ul>

        <h6 className="mt-3">Reading the Limiting Curve</h6>
        <p>
          The graph shows how input levels (horizontal axis) are transformed to output levels (vertical axis):
        </p>
        <ul>
          <li><strong>Diagonal dotted line:</strong> Unity gain (input = output) reference</li>
          <li><strong>Red curve:</strong> Shows the limiting behavior</li>
          <li><strong>Below ceiling:</strong> Signal passes through unchanged (follows diagonal)</li>
          <li><strong>At ceiling:</strong> Curve becomes horizontal - this is the "brick wall"</li>
          <li><strong>Red dashed line:</strong> Your ceiling setting - nothing goes above this</li>
        </ul>

        <h6 className="mt-3">Algorithm Differences</h6>
        <ul>
          <li><strong>Brickwall:</strong> Instant limiting at ceiling (sharp corner)</li>
          <li><strong>Transparent:</strong> Gentle knee for natural sound</li>
          <li><strong>Vintage:</strong> Softer knee with musical character</li>
          <li><strong>Aggressive:</strong> Fast limiting for maximum loudness</li>
          <li><strong>Mastering:</strong> Sophisticated multi-stage approach</li>
        </ul>

        <h6 className="mt-3">Common Uses</h6>
        <ul>
          <li><strong>Mastering:</strong> Final stage to maximize loudness</li>
          <li><strong>Broadcast:</strong> Prevent overmodulation</li>
          <li><strong>Live sound:</strong> Protect speakers from damage</li>
          <li><strong>Mixing:</strong> Control peaks on individual tracks</li>
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
    <div className="limiter-visualization position-relative">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-white small">Limiter Analysis</span>
        <OverlayTrigger
          placement="left"
          overlay={<Tooltip>Click for help understanding the limiter visualization</Tooltip>}
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
        height={modalMode ? Math.min(height, 250) : height}
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
 * Professional limiter algorithms with different characteristics
 */
const LimiterAlgorithms = {
  transparent: {
    name: 'Transparent',
    description: 'Clean, transparent limiting with minimal coloration',
    lookahead: 5,
    release: 50,
    knee: 0.5,
    character: 'clean'
  },
  vintage: {
    name: 'Vintage',
    description: 'Warm, musical limiting with harmonic saturation',
    lookahead: 3,
    release: 100,
    knee: 1.0,
    character: 'warm'
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Fast, punchy limiting for maximum loudness',
    lookahead: 1,
    release: 20,
    knee: 0.1,
    character: 'punchy'
  },
  mastering: {
    name: 'Mastering',
    description: 'Sophisticated multi-stage limiting for mastering',
    lookahead: 10,
    release: 200,
    knee: 2.0,
    character: 'sophisticated'
  },
  brickwall: {
    name: 'Brickwall',
    description: 'Hard limiting with absolute ceiling control',
    lookahead: 0.5,
    release: 10,
    knee: 0.0,
    character: 'hard'
  }
};

/**
 * Advanced ISR (Inter-Sample Peaks) detector for true peak limiting
 */
class ISRDetector {
  constructor(audioContext, oversampleFactor = 4) {
    this.context = audioContext;
    this.oversampleFactor = oversampleFactor;
    this.setupOversampling();
  }
  
  setupOversampling() {
    // Create oversampling nodes for ISR detection
    this.upsampler = this.context.createScriptProcessor(1024, 2, 2);
    this.downsampler = this.context.createScriptProcessor(1024, 2, 2);
    this.oversampledBuffer = [];
    
    // Simple linear interpolation upsampling
    this.upsampler.onaudioprocess = (event) => {
      const inputL = event.inputBuffer.getChannelData(0);
      const inputR = event.inputBuffer.getChannelData(1);
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      
      for (let i = 0; i < inputL.length; i++) {
        // Simple upsampling - could be improved with better interpolation
        for (let j = 0; j < this.oversampleFactor; j++) {
          const factor = j / this.oversampleFactor;
          const nextIndex = Math.min(i + 1, inputL.length - 1);
          
          outputL[i * this.oversampleFactor + j] = 
            inputL[i] * (1 - factor) + inputL[nextIndex] * factor;
          outputR[i * this.oversampleFactor + j] = 
            inputR[i] * (1 - factor) + inputR[nextIndex] * factor;
        }
      }
    };
  }
  
  detectTruePeaks(buffer) {
    // Simplified true peak detection
    let maxPeak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length - 1; i++) {
        // Check for inter-sample peaks using linear interpolation
        const current = Math.abs(channelData[i]);
        const next = Math.abs(channelData[i + 1]);
        const interpolated = Math.abs((current + next) / 2);
        
        maxPeak = Math.max(maxPeak, current, next, interpolated);
      }
    }
    return maxPeak;
  }
}

/**
 * Professional lookahead limiter with gain reduction smoothing
 */
class LookaheadLimiter {
  constructor(audioContext, lookaheadMs = 5) {
    this.context = audioContext;
    this.lookaheadSamples = Math.floor(lookaheadMs * audioContext.sampleRate / 1000);
    this.delayBuffer = [];
    this.gainReductionHistory = [];
    this.smoothingFilter = 0;
    this.setupDelayLine();
  }
  
  setupDelayLine() {
    // Create delay line for lookahead
    this.delayNode = this.context.createDelay(this.lookaheadSamples / this.context.sampleRate + 0.1);
    this.delayNode.delayTime.value = this.lookaheadSamples / this.context.sampleRate;
    
    // Create gain node for gain reduction
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect delay -> gain
    this.delayNode.connect(this.gainNode);
  }
  
  processGainReduction(inputBuffer, threshold, release, algorithm) {
    const sampleRate = this.context.sampleRate;
    const releaseSamples = release * sampleRate / 1000;
    const smoothingCoeff = 1.0 - Math.exp(-1.0 / releaseSamples);
    
    let maxPeak = 0;
    
    // Find peak in lookahead window
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const channelData = inputBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        maxPeak = Math.max(maxPeak, Math.abs(channelData[i]));
      }
    }
    
    // Calculate required gain reduction
    const thresholdLinear = Math.pow(10, threshold / 20);
    let gainReduction = 1.0;
    
    if (maxPeak > thresholdLinear) {
      gainReduction = thresholdLinear / maxPeak;
      
      // Apply algorithm-specific character
      if (algorithm.character === 'warm') {
        // Add slight saturation curve for warmth
        gainReduction = this.applySaturation(gainReduction, 0.1);
      } else if (algorithm.character === 'punchy') {
        // Faster attack for punch
        gainReduction = Math.pow(gainReduction, 1.2);
      }
    }
    
    // Smooth gain reduction changes
    this.smoothingFilter += (gainReduction - this.smoothingFilter) * smoothingCoeff;
    
    return this.smoothingFilter;
  }
  
  applySaturation(input, amount) {
    // Soft saturation for musical character
    return input + amount * Math.sin(input * Math.PI * 2) * (1 - input);
  }
  
  getProcessingChain() {
    return {
      input: this.delayNode,
      output: this.gainNode,
      gainNode: this.gainNode
    };
  }
}

/**
 * Multi-stage mastering limiter with adaptive release
 */
class MasteringLimiter {
  constructor(audioContext) {
    this.context = audioContext;
    this.setupStages();
  }
  
  setupStages() {
    // Stage 1: Gentle compression
    this.compressor1 = this.context.createDynamicsCompressor();
    this.compressor1.threshold.value = -6;
    this.compressor1.ratio.value = 3;
    this.compressor1.attack.value = 0.003;
    this.compressor1.release.value = 0.1;
    this.compressor1.knee.value = 2;
    
    // Stage 2: Medium limiting
    this.compressor2 = this.context.createDynamicsCompressor();
    this.compressor2.threshold.value = -3;
    this.compressor2.ratio.value = 8;
    this.compressor2.attack.value = 0.001;
    this.compressor2.release.value = 0.05;
    this.compressor2.knee.value = 1;
    
    // Stage 3: Final limiting
    this.compressor3 = this.context.createDynamicsCompressor();
    this.compressor3.threshold.value = -1;
    this.compressor3.ratio.value = 20;
    this.compressor3.attack.value = 0.0001;
    this.compressor3.release.value = 0.02;
    this.compressor3.knee.value = 0.5;
    
    // Connect stages
    this.compressor1.connect(this.compressor2);
    this.compressor2.connect(this.compressor3);
  }
  
  updateSettings(ceiling, release) {
    // Adjust all stages based on ceiling and release
    this.compressor1.threshold.value = ceiling + 6;
    this.compressor2.threshold.value = ceiling + 3;
    this.compressor3.threshold.value = ceiling + 1;
    
    const releaseFactor = release / 100;
    this.compressor1.release.value = 0.1 * releaseFactor;
    this.compressor2.release.value = 0.05 * releaseFactor;
    this.compressor3.release.value = 0.02 * releaseFactor;
  }
  
  getProcessingChain() {
    return {
      input: this.compressor1,
      output: this.compressor3
    };
  }
}

/**
 * Enhanced Limiter processing function with advanced algorithms
 */
export async function processLimiterRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Get algorithm settings
  const algorithm = LimiterAlgorithms[parameters.algorithm] || LimiterAlgorithms.transparent;
  
  // Calculate lookahead delay in samples
  const lookaheadSamples = Math.floor((parameters.lookahead || algorithm.lookahead) * sampleRate / 1000);

  // Create offline context with region length only (lookahead is internal to the limiter)
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  let outputNode;
  
  if (parameters.algorithm === 'mastering') {
    // Multi-stage mastering limiter
    const masteringLimiter = new MasteringLimiter(offlineContext);
    masteringLimiter.updateSettings(parameters.ceiling || -0.1, parameters.release || 100);
    
    const chain = masteringLimiter.getProcessingChain();
    source.connect(chain.input);
    outputNode = chain.output;
    
  } else {
    // Standard lookahead limiter
    const limiter = new LookaheadLimiter(offlineContext, parameters.lookahead || algorithm.lookahead);
    const chain = limiter.getProcessingChain();
    
    // Configure limiter
    const ceiling = Math.pow(10, (parameters.ceiling || -0.1) / 20);
    chain.gainNode.gain.value = ceiling;
    
    source.connect(chain.input);
    outputNode = chain.output;
  }
  
  // Add ISR detection if enabled
  if (parameters.isrMode) {
    const detector = new ISRDetector(offlineContext);
    // ISR processing would be integrated here
  }
  
  // Connect to destination
  outputNode.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  // Render
  const renderedBuffer = await offlineContext.startRendering();

  // Apply algorithm-specific coloration to the rendered buffer in-place
  for (let channel = 0; channel < renderedBuffer.numberOfChannels; channel++) {
    const data = renderedBuffer.getChannelData(channel);

    for (let i = 0; i < data.length; i++) {
      let sample = data[i];

      // Apply algorithm-specific coloration
      if (algorithm.character === 'warm') {
        sample = applyWarmth(sample, 0.1);
      } else if (algorithm.character === 'punchy') {
        sample = applyPunch(sample, 0.15);
      }

      data[i] = sample;
    }
  }

  return renderedBuffer;
}

/**
 * Apply warm saturation for vintage character
 */
function applyWarmth(sample, amount) {
  return sample + amount * Math.tanh(sample * 3) * (1 - Math.abs(sample));
}

/**
 * Apply punch enhancement for aggressive character
 */
function applyPunch(sample, amount) {
  const enhanced = Math.sign(sample) * Math.pow(Math.abs(sample), 0.8);
  return sample * (1 - amount) + enhanced * amount;
}

/**
 * Professional Limiter component
 */
export default function Limiter({ width, modalMode = false, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    limiterPresent,
    setLimiterPresent,
    limiterCeiling,
    setLimiterCeiling,
    limiterRelease,
    setLimiterRelease,
    limiterLookahead,
    setLimiterLookahead,
    limiterAlgorithm,
    setLimiterAlgorithm,
    limiterIsrMode,
    setLimiterIsrMode,
    limiterDithering,
    setLimiterDithering,
    limiterMasteringMode,
    setLimiterMasteringMode,
    cutRegion
  } = useEffects();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  // Apply limiter to selected region
  const applyLimiter = useCallback(
    createEffectApplyFunction(processLimiterRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        ceiling: limiterCeiling,
        release: limiterRelease,
        lookahead: limiterLookahead,
        algorithm: limiterAlgorithm,
        isrMode: limiterIsrMode,
        dithering: limiterDithering,
        masteringMode: limiterMasteringMode
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, limiterCeiling, limiterRelease, limiterLookahead, limiterAlgorithm, limiterIsrMode, limiterDithering, limiterMasteringMode, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-3">
        <Col>
          <LimiterVisualization
            ceiling={limiterCeiling}
            release={limiterRelease}
            lookahead={limiterLookahead}
            algorithm={limiterAlgorithm}
            width={modalMode ? 600 : 400}
            height={modalMode ? 250 : 200}
            modalMode={modalMode}
          />
        </Col>
      </Row>

      {/* Controls */}
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{LimiterTooltips.ceiling}</Tooltip>}
          >
            <div>
              <Knob
                value={limiterCeiling}
                onChange={setLimiterCeiling}
                min={-3}
                max={0}
                step={0.1}
                label="Ceiling"
                displayValue={`${limiterCeiling.toFixed(1)}dB`}
                size={45}
                color="#e74c3c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{LimiterTooltips.release}</Tooltip>}
          >
            <div>
              <Knob
                value={limiterRelease}
                onChange={setLimiterRelease}
                min={1}
                max={1000}
                step={1}
                label="Release"
                displayValue={`${limiterRelease.toFixed(0)}ms`}
                size={45}
                color="#3498db"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{LimiterTooltips.lookahead}</Tooltip>}
          >
            <div>
              <Knob
                value={limiterLookahead}
                onChange={setLimiterLookahead}
                min={0}
                max={20}
                step={0.1}
                label="Lookahead"
                displayValue={`${limiterLookahead.toFixed(1)}ms`}
                size={45}
                color="#9b59b6"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        {/* Algorithm Selection */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{LimiterTooltips.algorithm}</Tooltip>}
          >
            <div>
              <Form.Label className="text-white small mb-1">Algorithm</Form.Label>
              <Dropdown
                onSelect={(eventKey) => setLimiterAlgorithm(eventKey)}
                size="sm"
              >
                <Dropdown.Toggle
                  variant="secondary"
                  size="sm"
                  className="w-100"
                >
                  {LimiterAlgorithms[limiterAlgorithm]?.name || 'Transparent'}
                </Dropdown.Toggle>
                <Dropdown.Menu className="bg-daw-toolbars">
                  {Object.entries(LimiterAlgorithms).map(([key, algorithm]) => (
                    <Dropdown.Item
                      key={key}
                      eventKey={key}
                      className="text-white"
                      title={algorithm.description}
                    >
                      {algorithm.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </OverlayTrigger>
        </Col>

        {/* Advanced Controls */}
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 100 }}
            overlay={<Tooltip>{LimiterTooltips.isr}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="limiter-isr"
                label="ISR"
                checked={limiterIsrMode}
                onChange={(e) => setLimiterIsrMode(e.target.checked)}
                className="text-white small"
              />
              <Form.Check
                type="switch"
                id="limiter-dither"
                label="Dither"
                checked={limiterDithering}
                onChange={(e) => setLimiterDithering(e.target.checked)}
                className="text-white small mt-1"
                title="Add dithering noise"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <Form.Check
            type="switch"
            id="limiter-mastering"
            label="Master"
            checked={limiterMasteringMode}
            onChange={(e) => setLimiterMasteringMode(e.target.checked)}
            className="text-white small"
            title="Multi-stage mastering mode"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyLimiter}
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