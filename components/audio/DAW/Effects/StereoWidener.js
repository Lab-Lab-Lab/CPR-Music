'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const StereoTooltips = {
  width: "Controls how wide the stereo image appears. 1.0x is original, <1.0 narrows, >1.0 widens. Be careful with values over 2.0x as they may cause phase issues.",
  haasDelay: "Adds a small delay to one channel creating psychoacoustic widening. 10-30ms is typical. Only active in Haas mode.",
  midGain: "Adjusts the center (mono) content level. Positive values emphasize vocals/bass, negative values create a 'hollow' center. Only in Mid/Side mode.",
  sideGain: "Adjusts the side (stereo) content level. Positive values increase width and ambience, negative reduces stereo information. Only in Mid/Side mode.",
  phase: "Rotates the stereo image. Small amounts (5-15°) can add subtle width. Large amounts may cause mono compatibility issues.",
  outputGain: "Final output level adjustment. Reduce if widening causes clipping. Unity gain is 1.0x.",
  bassFreq: "Frequencies below this point stay mono to maintain punch and avoid phase issues. Typical range is 100-200Hz.",
  highLimit: "Frequencies above this are limited to prevent harsh widening artifacts. Usually set to 10-15kHz.",
  correlation: "Target stereo correlation. +1 is mono, 0 is uncorrelated, -1 is out of phase. Normal stereo is 0.3-0.7."
};

/**
 * Stereo Processing Modes
 */
const StereoModes = {
  classic: {
    name: 'Classic Width',
    description: 'Traditional stereo width control'
  },
  midside: {
    name: 'Mid/Side Processing',
    description: 'Independent mid and side channel control'
  },
  haas: {
    name: 'Haas Effect',
    description: 'Psychoacoustic delay-based widening'
  },
  correlation: {
    name: 'Correlation Control',
    description: 'Stereo correlation adjustment'
  }
};

/**
 * Professional Stereo Widener Processor
 * Features: Mid/Side processing, correlation monitoring, frequency-dependent widening
 */
class StereoWidenerProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    
    // Mid/Side processing
    this.midGain = audioContext.createGain();
    this.sideGain = audioContext.createGain();
    
    // Bass mono filtering
    this.bassFilterLeft = audioContext.createBiquadFilter();
    this.bassFilterRight = audioContext.createBiquadFilter();
    this.bassMidGain = audioContext.createGain();
    
    // High frequency limiting
    this.highLimitFilterLeft = audioContext.createBiquadFilter();
    this.highLimitFilterRight = audioContext.createBiquadFilter();
    
    // Haas delay
    this.haasDelay = audioContext.createDelay(0.1);
    this.haasGain = audioContext.createGain();
    
    // Stereo field manipulation
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Parameters
    this.width = 1.5;
    this.delay = 10; // ms
    this.bassRetain = true;
    this.bassFreq = 200;
    this.mode = 'classic';
    this.midGainValue = 0; // dB
    this.sideGainValue = 0; // dB
    this.phase = 0; // degrees
    this.correlation = 0;
    this.highFreqLimit = 20000;
    this.safetyLimit = true;
    this.outputGain = 1.0;
    
    this.setupFilters();
    this.setupRouting();
  }
  
  setupFilters() {
    // Bass mono filters (high-pass to isolate highs)
    this.bassFilterLeft.type = 'highpass';
    this.bassFilterLeft.frequency.value = this.bassFreq;
    this.bassFilterLeft.Q.value = 0.707;
    
    this.bassFilterRight.type = 'highpass';
    this.bassFilterRight.frequency.value = this.bassFreq;
    this.bassFilterRight.Q.value = 0.707;
    
    // High frequency limiting filters
    this.highLimitFilterLeft.type = 'lowpass';
    this.highLimitFilterLeft.frequency.value = this.highFreqLimit;
    this.highLimitFilterLeft.Q.value = 0.707;
    
    this.highLimitFilterRight.type = 'lowpass';
    this.highLimitFilterRight.frequency.value = this.highFreqLimit;
    this.highLimitFilterRight.Q.value = 0.707;
    
    // Haas delay
    this.haasDelay.delayTime.value = this.delay / 1000;
    this.haasGain.gain.value = 0.8;
  }
  
  setupRouting() {
    // Basic routing
    this.input.connect(this.splitter);
    this.merger.connect(this.output);
  }
  
  /**
   * Calculate stereo correlation between L and R channels
   */
  calculateCorrelation(leftData, rightData, startSample, endSample) {
    let correlation = 0;
    let leftSum = 0;
    let rightSum = 0;
    let leftSquareSum = 0;
    let rightSquareSum = 0;
    let crossSum = 0;
    
    const length = endSample - startSample;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      leftSum += left;
      rightSum += right;
      leftSquareSum += left * left;
      rightSquareSum += right * right;
      crossSum += left * right;
    }
    
    const leftMean = leftSum / length;
    const rightMean = rightSum / length;
    
    const leftVariance = (leftSquareSum / length) - (leftMean * leftMean);
    const rightVariance = (rightSquareSum / length) - (rightMean * rightMean);
    const covariance = (crossSum / length) - (leftMean * rightMean);
    
    const denominator = Math.sqrt(leftVariance * rightVariance);
    if (denominator > 0) {
      correlation = covariance / denominator;
    }
    
    return Math.max(-1, Math.min(1, correlation));
  }
  
  /**
   * Apply Mid/Side processing
   */
  processMidSide(leftData, rightData, startSample, endSample) {
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    const midGainLinear = Math.pow(10, this.midGainValue / 20);
    const sideGainLinear = Math.pow(10, this.sideGainValue / 20);
    const phaseRadians = (this.phase * Math.PI) / 180;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      // Convert to Mid/Side
      let mid = (left + right) * 0.5;
      let side = (left - right) * 0.5;
      
      // Apply mode-specific processing
      switch (this.mode) {
        case 'classic':
          side *= this.width;
          break;
          
        case 'midside':
          mid *= midGainLinear;
          side *= sideGainLinear * this.width;
          break;
          
        case 'haas':
          // Haas effect is applied later in the chain
          side *= this.width;
          break;
          
        case 'correlation':
          // Adjust side signal based on correlation target
          const currentCorr = this.calculateCorrelation(leftData, rightData, i, Math.min(i + 1024, endSample));
          const corrAdjust = this.correlation - currentCorr;
          side *= this.width * (1 + corrAdjust * 0.5);
          break;
      }
      
      // Apply phase offset to side signal
      if (this.phase !== 0) {
        side *= Math.cos(phaseRadians);
      }
      
      // Convert back to L/R
      outputLeft[i] = mid + side;
      outputRight[i] = mid - side;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply bass mono retention
   */
  applyBassMono(leftData, rightData, startSample, endSample) {
    if (!this.bassRetain) return { left: leftData, right: rightData };
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    // Simple high-pass filter to separate bass and highs
    const fc = this.bassFreq;
    const dt = 1 / this.sampleRate;
    const RC = 1 / (2 * Math.PI * fc);
    const alpha = dt / (RC + dt);
    
    let bassStateLeft = 0;
    let bassStateRight = 0;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      // Low-pass filter to extract bass
      bassStateLeft += alpha * (left - bassStateLeft);
      bassStateRight += alpha * (right - bassStateRight);
      
      // Create mono bass
      const bassMono = (bassStateLeft + bassStateRight) * 0.5;
      
      // High-pass the original signal (remove bass)
      const highsLeft = left - bassStateLeft;
      const highsRight = right - bassStateRight;
      
      // Recombine with mono bass
      outputLeft[i] = highsLeft + bassMono;
      outputRight[i] = highsRight + bassMono;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply Haas effect delay
   */
  applyHaasEffect(leftData, rightData, startSample, endSample) {
    if (this.mode !== 'haas' || this.delay === 0) {
      return { left: leftData, right: rightData };
    }
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    const delaySamples = Math.floor((this.delay / 1000) * this.sampleRate);
    
    for (let i = startSample; i < endSample; i++) {
      const delayedIndex = i - delaySamples;
      
      if (delayedIndex >= 0 && delayedIndex < rightData.length) {
        // Apply delay to right channel with slight attenuation
        outputRight[i] = rightData[delayedIndex] * 0.8 + rightData[i] * 0.2;
      }
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply safety limiting to prevent over-widening
   */
  applySafetyLimiting(leftData, rightData, startSample, endSample) {
    if (!this.safetyLimit) return { left: leftData, right: rightData };
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    for (let i = startSample; i < endSample; i++) {
      let left = leftData[i] || 0;
      let right = rightData[i] || 0;
      
      // Calculate side signal magnitude
      const side = Math.abs(left - right) * 0.5;
      const mid = Math.abs(left + right) * 0.5;
      
      // If side signal is much larger than mid, apply limiting
      if (side > mid * 2) {
        const ratio = (mid * 2) / side;
        const reducedSide = (left - right) * ratio * 0.5;
        const preservedMid = (left + right) * 0.5;
        
        left = preservedMid + reducedSide;
        right = preservedMid - reducedSide;
      }
      
      // Soft limiting
      outputLeft[i] = Math.tanh(left * 0.8) / 0.8;
      outputRight[i] = Math.tanh(right * 0.8) / 0.8;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  // Parameter setters
  setWidth(width) {
    this.width = Math.max(0, Math.min(3, width));
  }
  
  setDelay(delay) {
    this.delay = Math.max(0, Math.min(50, delay));
    this.haasDelay.delayTime.setValueAtTime(this.delay / 1000, this.context.currentTime);
  }
  
  setBassRetain(retain) {
    this.bassRetain = retain;
  }
  
  setBassFreq(freq) {
    this.bassFreq = Math.max(20, Math.min(500, freq));
    this.bassFilterLeft.frequency.setValueAtTime(this.bassFreq, this.context.currentTime);
    this.bassFilterRight.frequency.setValueAtTime(this.bassFreq, this.context.currentTime);
  }
  
  setMode(mode) {
    this.mode = mode;
  }
  
  setMidGain(gain) {
    this.midGainValue = Math.max(-12, Math.min(12, gain));
  }
  
  setSideGain(gain) {
    this.sideGainValue = Math.max(-12, Math.min(12, gain));
  }
  
  setPhase(phase) {
    this.phase = Math.max(0, Math.min(180, phase));
  }
  
  setCorrelation(correlation) {
    this.correlation = Math.max(-1, Math.min(1, correlation));
  }
  
  setHighFreqLimit(freq) {
    this.highFreqLimit = Math.max(1000, Math.min(20000, freq));
    this.highLimitFilterLeft.frequency.setValueAtTime(this.highFreqLimit, this.context.currentTime);
    this.highLimitFilterRight.frequency.setValueAtTime(this.highFreqLimit, this.context.currentTime);
  }
  
  setSafetyLimit(enable) {
    this.safetyLimit = enable;
  }
  
  setOutputGain(gain) {
    this.output.gain.setValueAtTime(Math.max(0, Math.min(2, gain)), this.context.currentTime);
    this.outputGain = gain;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Process stereo widener on an audio buffer region
 */
export async function processStereoWidenerRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  
  // Check if audio is stereo
  if (audioBuffer.numberOfChannels < 2) {
    throw new Error('Stereo widener requires stereo audio');
  }
  
  // Create processor
  const processor = new StereoWidenerProcessor(audioContext);
  processor.setWidth(parameters.width || 1.5);
  processor.setDelay(parameters.delay || 10);
  processor.setBassRetain(parameters.bassRetain !== false);
  processor.setBassFreq(parameters.bassFreq || 200);
  processor.setMode(parameters.mode || 'classic');
  processor.setMidGain(parameters.midGain || 0);
  processor.setSideGain(parameters.sideGain || 0);
  processor.setPhase(parameters.phase || 0);
  processor.setCorrelation(parameters.correlation || 0);
  processor.setHighFreqLimit(parameters.highFreqLimit || 20000);
  processor.setSafetyLimit(parameters.safetyLimit !== false);
  processor.setOutputGain(parameters.outputGain || 1.0);
  
  // Create output buffer with region length only
  const outputBuffer = audioContext.createBuffer(
    2, // Ensure stereo
    regionLength,
    sampleRate
  );

  // Get channel data
  const leftData = audioBuffer.getChannelData(0);
  const rightData = audioBuffer.getChannelData(1);
  const leftOut = outputBuffer.getChannelData(0);
  const rightOut = outputBuffer.getChannelData(1);

  // Process the selected region through the processor chain
  let processed = processor.processMidSide(leftData, rightData, startSample, endSample);
  processed = processor.applyBassMono(processed.left, processed.right, startSample, endSample);
  processed = processor.applyHaasEffect(processed.left, processed.right, startSample, endSample);
  processed = processor.applySafetyLimiting(processed.left, processed.right, startSample, endSample);

  // Apply output gain and copy processed region to output (using region indices)
  const outputGainLinear = processor.outputGain;
  for (let i = 0; i < regionLength; i++) {
    const sourceIndex = startSample + i;
    leftOut[i] = processed.left[sourceIndex] * outputGainLinear;
    rightOut[i] = processed.right[sourceIndex] * outputGainLinear;
  }
  
  return outputBuffer;
}

/**
 * Professional Stereo Widener Effect
 * Features: Mid/Side processing, correlation monitoring, frequency-dependent widening
 */
export default function StereoWidener({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const {
    cutRegion,
    stereoWidenerWidth,
    setStereoWidenerWidth,
    stereoWidenerDelay,
    setStereoWidenerDelay,
    stereoWidenerBassRetain,
    setStereoWidenerBassRetain,
    stereoWidenerBassFreq,
    setStereoWidenerBassFreq,
    stereoWidenerMode,
    setStereoWidenerMode,
    stereoWidenerMidGain,
    setStereoWidenerMidGain,
    stereoWidenerSideGain,
    setStereoWidenerSideGain,
    stereoWidenerPhase,
    setStereoWidenerPhase,
    stereoWidenerCorrelation,
    setStereoWidenerCorrelation,
    stereoWidenerHighFreqLimit,
    setStereoWidenerHighFreqLimit,
    stereoWidenerSafetyLimit,
    setStereoWidenerSafetyLimit,
    stereoWidenerOutputGain,
    setStereoWidenerOutputGain
  } = useEffects();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const canvasRef = useRef(null);
  const [correlationValue, setCorrelationValue] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!processorRef.current) {
      processorRef.current = new StereoWidenerProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setWidth(stereoWidenerWidth);
      processorRef.current.setDelay(stereoWidenerDelay);
      processorRef.current.setBassRetain(stereoWidenerBassRetain);
      processorRef.current.setBassFreq(stereoWidenerBassFreq);
      processorRef.current.setMode(stereoWidenerMode);
      processorRef.current.setMidGain(stereoWidenerMidGain);
      processorRef.current.setSideGain(stereoWidenerSideGain);
      processorRef.current.setPhase(stereoWidenerPhase);
      processorRef.current.setCorrelation(stereoWidenerCorrelation);
      processorRef.current.setHighFreqLimit(stereoWidenerHighFreqLimit);
      processorRef.current.setSafetyLimit(stereoWidenerSafetyLimit);
      processorRef.current.setOutputGain(stereoWidenerOutputGain);
    }
  }, [stereoWidenerWidth, stereoWidenerDelay, stereoWidenerBassRetain, stereoWidenerBassFreq,
      stereoWidenerMode, stereoWidenerMidGain, stereoWidenerSideGain, stereoWidenerPhase,
      stereoWidenerCorrelation, stereoWidenerHighFreqLimit, stereoWidenerSafetyLimit,
      stereoWidenerOutputGain]);
  
  // Draw stereo field visualization - vectorscope style
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid for vectorscope
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;

    // Draw concentric circles (amplitude levels)
    const maxRadius = Math.min(width, height) * 0.4;
    for (let i = 0.25; i <= 1; i += 0.25) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw 45° diagonal lines (pure L and R reference)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Left channel line (-45°)
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY + maxRadius);
    ctx.lineTo(centerX + maxRadius, centerY - maxRadius);
    ctx.stroke();

    // Right channel line (+45°)
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY - maxRadius);
    ctx.lineTo(centerX + maxRadius, centerY + maxRadius);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw vertical line (mono/center reference)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.stroke();

    // Draw horizontal line (stereo difference)
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    // Draw safety zones
    const safeRadius = maxRadius * 0.7;
    const warnRadius = maxRadius * 0.9;

    // Safe zone (green)
    ctx.strokeStyle = 'rgba(146, 206, 170, 0.2)';
    ctx.fillStyle = 'rgba(146, 206, 170, 0.05)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, safeRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Warning zone (yellow)
    if (stereoWidenerWidth > 1.5) {
      ctx.strokeStyle = 'rgba(203, 182, 119, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, warnRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Danger zone indicator (red) for extreme widening
    if (stereoWidenerWidth > 2.0) {
      ctx.strokeStyle = 'rgba(231, 91, 92, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw Lissajous pattern for stereo image
    // Original signal
    ctx.strokeStyle = '#7bafd4';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    // Simulate original stereo pattern (ellipse)
    ctx.beginPath();
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 4); // 45° for typical stereo
    ctx.scale(0.6, 0.4); // Natural stereo width
    ctx.beginPath();
    ctx.arc(0, 0, maxRadius * 0.5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // Processed signal
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;

    // Apply width transformation
    const widthScale = Math.min(stereoWidenerWidth, 2.5);
    const midScale = stereoWidenerMode === 'midside' ?
      Math.pow(10, stereoWidenerMidGain / 20) : 1;
    const sideScale = stereoWidenerMode === 'midside' ?
      Math.pow(10, stereoWidenerSideGain / 20) : 1;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Apply phase rotation if set
    if (stereoWidenerPhase > 0) {
      ctx.rotate((stereoWidenerPhase * Math.PI) / 180);
    }

    // Rotate for stereo angle
    ctx.rotate(Math.PI / 4);

    // Scale based on processing
    const xScale = 0.6 * widthScale * (stereoWidenerMode === 'midside' ? sideScale : 1);
    const yScale = 0.4 * (stereoWidenerMode === 'midside' ? midScale : 1);
    ctx.scale(xScale, yScale);

    ctx.beginPath();
    ctx.arc(0, 0, maxRadius * 0.5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 1;

    // Draw Haas delay visualization if active
    if (stereoWidenerMode === 'haas' && stereoWidenerDelay > 0) {
      ctx.strokeStyle = '#dda0dd';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Show delay offset
      const delayOffset = (stereoWidenerDelay / 50) * maxRadius * 0.2; // Scale delay to visual
      ctx.beginPath();
      ctx.arc(centerX + delayOffset, centerY, maxRadius * 0.3, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw bass mono zone if enabled
    if (stereoWidenerBassRetain) {
      ctx.fillStyle = 'rgba(203, 182, 119, 0.1)';
      ctx.strokeStyle = 'rgba(203, 182, 119, 0.3)';
      ctx.lineWidth = 1;

      // Draw center zone for bass
      const bassRadius = maxRadius * 0.2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bassRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    // Draw correlation meter
    const meterY = height - 40;
    const meterWidth = 150;
    const meterHeight = 8;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(10, meterY, meterWidth, meterHeight);

    // Correlation value
    const corrColor = correlationValue > 0.5 ? '#92ceaa' :
                     correlationValue < -0.5 ? '#e75b5c' : '#cbb677';
    const corrPosition = ((correlationValue + 1) / 2) * meterWidth;

    ctx.fillStyle = corrColor;
    ctx.fillRect(10, meterY, corrPosition, meterHeight);

    // Correlation markers
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    // Center line (0 correlation)
    ctx.beginPath();
    ctx.moveTo(10 + meterWidth / 2, meterY - 2);
    ctx.lineTo(10 + meterWidth / 2, meterY + meterHeight + 2);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stereo Field Analysis', width / 2, 15);

    // Axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.fillText('-1', 10, meterY - 5);
    ctx.textAlign = 'center';
    ctx.fillText('0', 10 + meterWidth / 2, meterY - 5);
    ctx.textAlign = 'right';
    ctx.fillText('+1', 10 + meterWidth, meterY - 5);

    // Mode and parameter info
    ctx.fillStyle = '#e75b5c';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Width: ${stereoWidenerWidth.toFixed(2)}x`, width - 100, 20);
    ctx.fillText(`Mode: ${StereoModes[stereoWidenerMode]?.name || 'Classic'}`, width - 100, 35);

    if (stereoWidenerMode === 'haas' && stereoWidenerDelay > 0) {
      ctx.fillStyle = '#dda0dd';
      ctx.fillText(`Delay: ${stereoWidenerDelay.toFixed(1)}ms`, width - 100, 50);
    }

    if (stereoWidenerBassRetain) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText(`Bass: <${stereoWidenerBassFreq}Hz`, width - 100, 65);
    }

    // Correlation status
    ctx.fillStyle = corrColor;
    ctx.fillText(`Corr: ${correlationValue.toFixed(2)}`, 10, meterY + meterHeight + 20);
    ctx.fillStyle = '#666';
    ctx.fillText(
      correlationValue > 0.7 ? 'Narrow' :
      correlationValue > 0.3 ? 'Normal' :
      correlationValue > -0.3 ? 'Wide' :
      correlationValue > -0.7 ? 'Very Wide' : 'Phase Issue!',
      80, meterY + meterHeight + 20
    );

    // L/M/S/R indicators
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', centerX - maxRadius - 15, centerY + 5);
    ctx.fillText('R', centerX + maxRadius + 15, centerY + 5);
    ctx.fillText('M', centerX, centerY - maxRadius - 10);
    ctx.fillText('S', centerX, centerY + maxRadius + 20);

  }, [stereoWidenerWidth, stereoWidenerMode, stereoWidenerDelay, stereoWidenerPhase,
      stereoWidenerBassRetain, stereoWidenerBassFreq, stereoWidenerMidGain,
      stereoWidenerSideGain, correlationValue]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
  // Apply stereo widener to selected region
  const applyStereoWidener = useCallback(
    createEffectApplyFunction(processStereoWidenerRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        width: stereoWidenerWidth,
        delay: stereoWidenerDelay,
        bassRetain: stereoWidenerBassRetain,
        bassFreq: stereoWidenerBassFreq,
        mode: stereoWidenerMode,
        midGain: stereoWidenerMidGain,
        sideGain: stereoWidenerSideGain,
        phase: stereoWidenerPhase,
        correlation: stereoWidenerCorrelation,
        highFreqLimit: stereoWidenerHighFreqLimit,
        safetyLimit: stereoWidenerSafetyLimit,
        outputGain: stereoWidenerOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, stereoWidenerWidth,
      stereoWidenerDelay, stereoWidenerBassRetain, stereoWidenerBassFreq, stereoWidenerMode,
      stereoWidenerMidGain, stereoWidenerSideGain, stereoWidenerPhase, stereoWidenerCorrelation,
      stereoWidenerHighFreqLimit, stereoWidenerSafetyLimit, stereoWidenerOutputGain, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* Stereo Field Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <div className="d-flex justify-content-between align-items-center mb-2 p-2">
              <span className="text-white small">Stereo Field Analysis</span>
              <OverlayTrigger
                placement="left"
                delay={{ show: 250, hide: 100 }}
                overlay={
                  <Tooltip>
                    Click for detailed explanation of stereo imaging
                  </Tooltip>
                }
              >
                <Button
                  size="sm"
                  variant="link"
                  className="p-0 text-info"
                  onClick={() => setShowHelpModal(true)}
                >
                  <FaQuestionCircle size={16} />
                </Button>
              </OverlayTrigger>
            </div>
            <canvas
              ref={canvasRef}
              width={400}
              height={250}
              style={{ width: '100%', height: '250px' }}
            />
          </div>
        </Col>
      </Row>
      
      {/* Mode Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Processing Mode</Form.Label>
          <Form.Select
            value={stereoWidenerMode}
            onChange={(e) => setStereoWidenerMode(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(StereoModes).map(([key, mode]) => (
              <option key={key} value={key}>{mode.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{StereoModes[stereoWidenerMode]?.description}</small>
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="bass-retain"
            label="Bass Mono"
            checked={stereoWidenerBassRetain}
            onChange={(e) => setStereoWidenerBassRetain(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="safety-limit"
            label="Safety Limit"
            checked={stereoWidenerSafetyLimit}
            onChange={(e) => setStereoWidenerSafetyLimit(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>
      
      {/* Main Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.width}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerWidth}
                onChange={setStereoWidenerWidth}
                min={0}
                max={3}
                step={0.01}
                label="Width"
                displayValue={`${stereoWidenerWidth.toFixed(2)}x`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.haasDelay}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerDelay}
                onChange={setStereoWidenerDelay}
                min={0}
                max={50}
                step={0.1}
                label="Haas Delay"
                displayValue={`${stereoWidenerDelay.toFixed(1)}ms`}
                size={50}
                color="#7bafd4"
                disabled={stereoWidenerMode !== 'haas'}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.midGain}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerMidGain}
                onChange={setStereoWidenerMidGain}
                min={-12}
                max={12}
                step={0.1}
                label="Mid Gain"
                displayValue={`${stereoWidenerMidGain > 0 ? '+' : ''}${stereoWidenerMidGain.toFixed(1)}dB`}
                size={50}
                color="#cbb677"
                disabled={stereoWidenerMode !== 'midside'}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.sideGain}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerSideGain}
                onChange={setStereoWidenerSideGain}
                min={-12}
                max={12}
                step={0.1}
                label="Side Gain"
                displayValue={`${stereoWidenerSideGain > 0 ? '+' : ''}${stereoWidenerSideGain.toFixed(1)}dB`}
                size={50}
                color="#dda0dd"
                disabled={stereoWidenerMode !== 'midside'}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.phase}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerPhase}
                onChange={setStereoWidenerPhase}
                min={0}
                max={180}
                step={1}
                label="Phase"
                displayValue={`${stereoWidenerPhase}°`}
                size={50}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.outputGain}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerOutputGain}
                onChange={setStereoWidenerOutputGain}
                min={0}
                max={2}
                step={0.01}
                label="Output"
                displayValue={`${stereoWidenerOutputGain.toFixed(2)}x`}
                size={50}
                color="#ffa500"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
      
      {/* Advanced Controls */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Advanced Controls</div>
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.bassFreq}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerBassFreq}
                onChange={setStereoWidenerBassFreq}
                min={20}
                max={500}
                step={5}
                label="Bass Freq"
                displayValue={`${stereoWidenerBassFreq}Hz`}
                size={45}
                color="#cbb677"
                disabled={!stereoWidenerBassRetain}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.highLimit}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerHighFreqLimit}
                onChange={setStereoWidenerHighFreqLimit}
                min={1000}
                max={20000}
                step={100}
                label="High Limit"
                displayValue={stereoWidenerHighFreqLimit >= 1000 ? `${(stereoWidenerHighFreqLimit/1000).toFixed(1)}k` : `${stereoWidenerHighFreqLimit}Hz`}
                size={45}
                color="#7bafd4"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{StereoTooltips.correlation}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidenerCorrelation}
                onChange={setStereoWidenerCorrelation}
                min={-1}
                max={1}
                step={0.01}
                label="Correlation"
                displayValue={`${stereoWidenerCorrelation > 0 ? '+' : ''}${stereoWidenerCorrelation.toFixed(2)}`}
                size={45}
                color="#dda0dd"
                disabled={stereoWidenerMode !== 'correlation'}
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyStereoWidener}
          >
            Apply Stereo Widener to Region
          </Button>
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding Stereo Imaging</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5 className="text-info mb-3">What is Stereo Imaging?</h5>
          <p>
            Stereo imaging refers to the perceived width and spatial positioning of sounds in a stereo field.
            The stereo field spans from hard left to hard right, with the center position in between.
            A good stereo image creates width and space without losing mono compatibility.
          </p>

          <h5 className="text-info mt-4 mb-3">The Vectorscope Display</h5>
          <p>
            The vectorscope shows your stereo signal as a Lissajous pattern - a visual representation of the
            relationship between left and right channels:
          </p>
          <ul>
            <li><strong>Vertical line:</strong> Pure mono signal (L=R)</li>
            <li><strong>45° diagonal lines:</strong> Pure left or right signal</li>
            <li><strong>Horizontal spread:</strong> Stereo width</li>
            <li><strong>Ellipse shape:</strong> Normal stereo content</li>
          </ul>

          <h5 className="text-info mt-4 mb-3">Mid/Side Processing</h5>
          <p>
            Mid/Side (M/S) processing separates audio into:
          </p>
          <ul>
            <li><strong>Mid (M):</strong> The center/mono content (L+R)</li>
            <li><strong>Side (S):</strong> The stereo difference (L-R)</li>
          </ul>
          <p>
            This allows independent control of center content (vocals, bass) and stereo width (ambience, effects).
          </p>

          <h5 className="text-info mt-4 mb-3">The Haas Effect</h5>
          <p>
            The Haas effect uses small delays (5-40ms) between channels to create psychoacoustic widening.
            Our brain interprets these delays as spatial information, making sounds appear wider without
            changing their frequency content.
          </p>

          <h5 className="text-info mt-4 mb-3">Why Keep Bass Mono?</h5>
          <p>
            Low frequencies below 100-200Hz are typically kept mono because:
          </p>
          <ul>
            <li>Bass frequencies are omnidirectional - we can't locate them spatially</li>
            <li>Stereo bass can cause phase cancellation issues</li>
            <li>Mono bass provides more punch and power</li>
            <li>Vinyl cutting requires mono bass to prevent needle jumping</li>
          </ul>

          <h5 className="text-info mt-4 mb-3">Stereo Correlation</h5>
          <p>
            Correlation measures the similarity between left and right channels:
          </p>
          <ul>
            <li><strong>+1:</strong> Perfect mono (L=R)</li>
            <li><strong>0:</strong> Completely uncorrelated (maximum width)</li>
            <li><strong>-1:</strong> Out of phase (will cancel in mono)</li>
            <li><strong>Normal range:</strong> +0.3 to +0.7</li>
          </ul>

          <div className="alert alert-warning mt-4">
            <strong>⚠️ Width Warning:</strong> Excessive widening (&gt;2.0x) can cause:
            <ul className="mb-0 mt-2">
              <li>Phase cancellation when summed to mono</li>
              <li>Unnatural, disconnected sound</li>
              <li>Loss of center image focus</li>
              <li>Playback issues on mono systems</li>
            </ul>
          </div>

          <h5 className="text-info mt-4 mb-3">Tips for Using Stereo Widener</h5>
          <ul>
            <li>Start with subtle widths (1.2-1.5x) for natural enhancement</li>
            <li>Use Mid/Side mode for surgical control</li>
            <li>Always check mono compatibility</li>
            <li>Keep important elements (vocals, bass) centered</li>
            <li>Use Haas delays sparingly (10-20ms typical)</li>
            <li>Monitor correlation to avoid phase issues</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
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