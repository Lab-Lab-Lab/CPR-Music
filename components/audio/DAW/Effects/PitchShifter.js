'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const PitchShifterTooltips = {
  pitch: "Amount of pitch shift in semitones. +12 is one octave up, -12 is one octave down. Use whole numbers for musical intervals, decimals for detuning.",
  cents: "Fine tuning in cents (100 cents = 1 semitone). Use for subtle detuning effects or precise pitch correction. ±50 cents creates chorus-like doubling.",
  formantPreserve: "Preserves vocal character when shifting pitch. Essential for natural-sounding vocal pitch correction. Disable for creative robotic effects.",
  quality: "Processing quality vs speed trade-off. High/Ultra for final mixes, Medium for real-time, Low for quick previews. Higher quality = less artifacts.",
  mix: "Balance between dry and wet signal. 100% replaces original pitch entirely. 50% creates harmony. Lower values add subtle pitch character."
};

/**
 * Quality Presets for Pitch Shifting
 *
 * Trade-offs between quality and performance:
 *
 * | Quality | FFT Size | Overlap | Latency  | Use Case                      |
 * |---------|----------|---------|----------|-------------------------------
 * | Low     | 1024     | 25%     | ~23ms    | Real-time, preview, low-end   |
 * | Medium  | 2048     | 50%     | ~46ms    | Live playback, instruments    |
 * | High    | 4096     | 75%     | ~93ms    | Final mix, vocals             |
 * | Ultra   | 8192     | 87.5%   | ~186ms   | Mastering, critical vocals    |
 *
 * Quality factors:
 * - FFT Size: Larger = better frequency resolution, less "chipmunk" artifacts
 * - Overlap: Higher = smoother transitions, less phasiness
 * - Formant Correction: Preserves vocal character (recommended for High/Ultra)
 *
 * Recommendations:
 * - Vocals: High or Ultra with formant correction
 * - Instruments: Medium usually sufficient
 * - Real-time preview: Low (higher may cause audible delay)
 * - Offline render: Ultra for best quality
 *
 * CPU Impact:
 * - Low: ~1x baseline
 * - Medium: ~2x baseline
 * - High: ~4x baseline
 * - Ultra: ~8-10x baseline (may cause audio dropouts on slower systems)
 */
const QualitySettings = {
  low: {
    name: 'Low (Fast)',
    fftSize: 1024,
    overlap: 0.25,
    formantCorrection: false,
    description: 'Quick preview, some artifacts. ~23ms latency.',
  },
  medium: {
    name: 'Medium',
    fftSize: 2048,
    overlap: 0.5,
    formantCorrection: false,
    description: 'Good for instruments. ~46ms latency.',
  },
  high: {
    name: 'High',
    fftSize: 4096,
    overlap: 0.75,
    formantCorrection: true,
    description: 'Recommended for vocals. ~93ms latency.',
  },
  ultra: {
    name: 'Ultra (Slow)',
    fftSize: 8192,
    overlap: 0.875,
    formantCorrection: true,
    description: 'Best quality, high CPU. ~186ms latency.',
  },
};

/**
 * Professional Pitch Shifter Processor
 * Uses phase vocoder with optional formant correction
 */
class PitchShifterProcessor {
  constructor(audioContext, quality = 'high') {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Parameters
    this.semitones = 0;
    this.cents = 0;
    this.formantShift = 0;
    this.formantCorrection = true;
    this.preserveTimbre = true;
    this.stretch = 1.0;
    this.wetMix = 1.0;
    this.outputGain = 1.0;
    this.pan = 0;
    
    // Set quality
    this.setQuality(quality);
    
    // Setup routing
    this.setupRouting();
  }
  
  setupRouting() {
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path will be processed and connected manually
    this.setWetMix(this.wetMix);
  }
  
  setQuality(quality) {
    const settings = QualitySettings[quality] || QualitySettings.high;
    this.fftSize = settings.fftSize;
    this.overlap = settings.overlap;
    this.hopSize = Math.floor(this.fftSize * (1 - this.overlap));
    this.enableFormantCorrection = settings.formantCorrection && this.formantCorrection;
  }
  
  /**
   * Calculate pitch shift ratio from semitones and cents
   */
  getPitchRatio() {
    const totalCents = (this.semitones * 100) + this.cents;
    return Math.pow(2, totalCents / 1200);
  }
  
  /**
   * Calculate formant shift ratio
   */
  getFormantRatio() {
    return Math.pow(2, this.formantShift / 12);
  }
  
  /**
   * Create Hann window function
   */
  createWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
  }
  
  /**
   * FFT implementation for spectral analysis
   */
  fft(real, imag) {
    const N = real.length;
    if (N <= 1) return;
    
    // Divide
    const evenReal = new Float32Array(N / 2);
    const evenImag = new Float32Array(N / 2);
    const oddReal = new Float32Array(N / 2);
    const oddImag = new Float32Array(N / 2);
    
    for (let i = 0; i < N / 2; i++) {
      evenReal[i] = real[i * 2];
      evenImag[i] = imag[i * 2];
      oddReal[i] = real[i * 2 + 1];
      oddImag[i] = imag[i * 2 + 1];
    }
    
    // Conquer
    this.fft(evenReal, evenImag);
    this.fft(oddReal, oddImag);
    
    // Combine
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const tReal = cos * oddReal[k] - sin * oddImag[k];
      const tImag = sin * oddReal[k] + cos * oddImag[k];
      
      real[k] = evenReal[k] + tReal;
      imag[k] = evenImag[k] + tImag;
      real[k + N / 2] = evenReal[k] - tReal;
      imag[k + N / 2] = evenImag[k] - tImag;
    }
  }
  
  /**
   * Inverse FFT
   */
  ifft(real, imag) {
    const N = real.length;
    
    // Conjugate
    for (let i = 0; i < N; i++) {
      imag[i] = -imag[i];
    }
    
    // Forward FFT
    this.fft(real, imag);
    
    // Conjugate and scale
    for (let i = 0; i < N; i++) {
      real[i] /= N;
      imag[i] = -imag[i] / N;
    }
  }
  
  /**
   * Extract formants using spectral envelope
   */
  extractFormants(magnitude, sampleRate) {
    const formants = [];
    const freqBin = sampleRate / magnitude.length;
    
    // Simple peak picking for formant detection
    for (let i = 2; i < magnitude.length - 2; i++) {
      const freq = i * freqBin;
      if (freq > 80 && freq < 5000) { // Human vocal range
        if (magnitude[i] > magnitude[i-1] && magnitude[i] > magnitude[i+1] &&
            magnitude[i] > magnitude[i-2] && magnitude[i] > magnitude[i+2]) {
          formants.push({
            frequency: freq,
            magnitude: magnitude[i],
            bin: i
          });
        }
      }
    }
    
    // Sort by magnitude and take top formants
    return formants.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
  }
  
  /**
   * Apply formant correction to magnitude spectrum
   */
  applyFormantCorrection(magnitude, originalFormants, pitchRatio) {
    const correctedMagnitude = new Float32Array(magnitude.length);
    const formantRatio = this.getFormantRatio();
    
    // Create formant-corrected spectrum
    for (let i = 0; i < magnitude.length; i++) {
      let correctedValue = 0;
      
      // Apply formant preservation
      for (const formant of originalFormants) {
        const originalBin = formant.bin;
        const shiftedBin = Math.round(originalBin / pitchRatio);
        const formantCorrectedBin = Math.round(originalBin * formantRatio);
        
        if (i === formantCorrectedBin && shiftedBin < magnitude.length) {
          correctedValue = Math.max(correctedValue, magnitude[shiftedBin] * formant.magnitude);
        }
      }
      
      // Blend with original if no formant correction applied
      correctedMagnitude[i] = correctedValue > 0 ? correctedValue : magnitude[i];
    }
    
    return correctedMagnitude;
  }
  
  /**
   * Phase vocoder pitch shifting
   */
  processPhaseVocoder(inputData, pitchRatio, stretchRatio) {
    const inputLength = inputData.length;
    const outputLength = Math.floor(inputLength / stretchRatio);
    const outputData = new Float32Array(outputLength);
    
    const window = this.createWindow(this.fftSize);
    const overlap = this.fftSize - this.hopSize;
    
    // Initialize phase accumulators
    const phaseAccum = new Float32Array(this.fftSize / 2 + 1);
    const lastPhase = new Float32Array(this.fftSize / 2 + 1);
    
    let inputPos = 0;
    let outputPos = 0;
    
    while (outputPos < outputLength - this.fftSize && inputPos < inputLength - this.fftSize) {
      // Extract windowed frame
      const frame = new Float32Array(this.fftSize);
      const frameImag = new Float32Array(this.fftSize);
      
      for (let i = 0; i < this.fftSize; i++) {
        const idx = Math.floor(inputPos) + i;
        if (idx < inputLength) {
          frame[i] = inputData[idx] * window[i];
        }
      }
      
      // FFT
      this.fft(frame, frameImag);
      
      // Convert to magnitude and phase
      const magnitude = new Float32Array(this.fftSize / 2 + 1);
      const phase = new Float32Array(this.fftSize / 2 + 1);
      
      for (let i = 0; i <= this.fftSize / 2; i++) {
        magnitude[i] = Math.sqrt(frame[i] * frame[i] + frameImag[i] * frameImag[i]);
        phase[i] = Math.atan2(frameImag[i], frame[i]);
      }
      
      // Extract formants for correction
      let originalFormants = [];
      if (this.enableFormantCorrection && this.preserveTimbre) {
        originalFormants = this.extractFormants(magnitude, this.sampleRate);
      }
      
      // Pitch shift by resampling spectrum
      const shiftedMagnitude = new Float32Array(this.fftSize / 2 + 1);
      const shiftedPhase = new Float32Array(this.fftSize / 2 + 1);
      
      for (let i = 0; i <= this.fftSize / 2; i++) {
        const sourceI = Math.round(i * pitchRatio);
        if (sourceI <= this.fftSize / 2) {
          shiftedMagnitude[i] = magnitude[sourceI] || 0;
          
          // Phase handling with accumulation
          if (sourceI < lastPhase.length) {
            const phaseDiff = phase[sourceI] - lastPhase[sourceI];
            const expectedPhase = (2 * Math.PI * this.hopSize * sourceI) / this.fftSize;
            const deviation = phaseDiff - expectedPhase;
            const wrappedDev = ((deviation + Math.PI) % (2 * Math.PI)) - Math.PI;
            const trueFreq = (2 * Math.PI * sourceI) / this.fftSize + wrappedDev / this.hopSize;
            
            phaseAccum[i] += trueFreq * this.hopSize / pitchRatio;
            shiftedPhase[i] = phaseAccum[i];
          }
        }
      }
      
      // Apply formant correction if enabled
      if (this.enableFormantCorrection && this.preserveTimbre && originalFormants.length > 0) {
        const correctedMagnitude = this.applyFormantCorrection(shiftedMagnitude, originalFormants, pitchRatio);
        shiftedMagnitude.set(correctedMagnitude);
      }
      
      // Update last phase
      for (let i = 0; i <= this.fftSize / 2; i++) {
        if (i < phase.length) {
          lastPhase[i] = phase[i];
        }
      }
      
      // Convert back to complex
      const outputFrame = new Float32Array(this.fftSize);
      const outputFrameImag = new Float32Array(this.fftSize);
      
      for (let i = 0; i <= this.fftSize / 2; i++) {
        outputFrame[i] = shiftedMagnitude[i] * Math.cos(shiftedPhase[i]);
        outputFrameImag[i] = shiftedMagnitude[i] * Math.sin(shiftedPhase[i]);
        
        // Mirror for negative frequencies
        if (i > 0 && i < this.fftSize / 2) {
          outputFrame[this.fftSize - i] = outputFrame[i];
          outputFrameImag[this.fftSize - i] = -outputFrameImag[i];
        }
      }
      
      // IFFT
      this.ifft(outputFrame, outputFrameImag);
      
      // Overlap-add with windowing
      for (let i = 0; i < this.fftSize; i++) {
        const outputIdx = outputPos + i;
        if (outputIdx < outputLength) {
          outputData[outputIdx] += outputFrame[i] * window[i];
        }
      }
      
      // Advance positions
      inputPos += this.hopSize * stretchRatio;
      outputPos += this.hopSize;
    }
    
    // Normalize
    let maxVal = 0;
    for (let i = 0; i < outputLength; i++) {
      maxVal = Math.max(maxVal, Math.abs(outputData[i]));
    }
    if (maxVal > 1) {
      for (let i = 0; i < outputLength; i++) {
        outputData[i] /= maxVal * 1.1; // Small headroom
      }
    }
    
    return outputData;
  }
  
  // Parameter setters
  setSemitones(semitones) {
    this.semitones = Math.max(-24, Math.min(24, semitones));
  }
  
  setCents(cents) {
    this.cents = Math.max(-100, Math.min(100, cents));
  }
  
  setFormantShift(shift) {
    this.formantShift = Math.max(-12, Math.min(12, shift));
  }
  
  setFormantCorrection(enabled) {
    this.formantCorrection = enabled;
    this.enableFormantCorrection = enabled && QualitySettings[this.currentQuality]?.formantCorrection;
  }
  
  setPreserveTimbre(preserve) {
    this.preserveTimbre = preserve;
  }
  
  setStretch(stretch) {
    this.stretch = Math.max(0.25, Math.min(4.0, stretch));
  }
  
  setWetMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
    this.wetMix = wet;
  }
  
  setOutputGain(gain) {
    this.output.gain.setValueAtTime(Math.max(0, Math.min(2, gain)), this.context.currentTime);
    this.outputGain = gain;
  }
  
  setPan(pan) {
    this.pan = Math.max(-1, Math.min(1, pan));
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Process pitch shifting on an audio buffer region
 */
export async function processPitchShiftRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Create processor
  const processor = new PitchShifterProcessor(audioContext, parameters.quality || 'high');
  processor.setSemitones(parameters.semitones || 0);
  processor.setCents(parameters.cents || 0);
  processor.setFormantShift(parameters.formantShift || 0);
  processor.setFormantCorrection(parameters.formantCorrection !== false);
  processor.setPreserveTimbre(parameters.preserveTimbre !== false);
  processor.setStretch(parameters.stretch || 1.0);
  processor.setWetMix(parameters.wetMix || 1.0);
  processor.setOutputGain(parameters.outputGain || 1.0);
  
  const pitchRatio = processor.getPitchRatio();

  // Calculate the output length based on stretch ratio
  const outputLength = Math.floor(regionLength / processor.stretch);

  // Create output buffer with the correct length based on stretch
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    outputLength,
    sampleRate
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Extract region for processing
    const regionData = new Float32Array(regionLength);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }

    // Apply pitch shifting using phase vocoder
    const processedData = processor.processPhaseVocoder(regionData, pitchRatio, processor.stretch);

    // Mix to output - handle both dry and wet signals with correct lengths
    const mixAmount = processor.wetMix;
    for (let i = 0; i < outputLength; i++) {
      // For stretched audio, we need to interpolate the dry signal or repeat/skip samples
      const dryIndex = Math.min(Math.floor(i * processor.stretch), regionLength - 1);
      const original = regionData[dryIndex];
      const processed = i < processedData.length ? processedData[i] * processor.outputGain : 0;
      outputData[i] = original * (1 - mixAmount) + processed * mixAmount;
    }
  }
  
  return outputBuffer;
}

/**
 * Professional Pitch Shifter Effect with Formant Correction
 * Features: Phase vocoder, formant preservation, spectral analysis
 */
export default function PitchShifter({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    pitchShiftSemitones,
    setPitchShiftSemitones,
    pitchShiftCents,
    setPitchShiftCents,
    pitchShiftFormant,
    setPitchShiftFormant,
    pitchShiftFormantCorrection,
    setPitchShiftFormantCorrection,
    pitchShiftMix,
    setPitchShiftMix,
    pitchShiftQuality,
    setPitchShiftQuality,
    pitchShiftGrainSize,
    setPitchShiftGrainSize,
    pitchShiftOverlap,
    setPitchShiftOverlap,
    pitchShiftStretch,
    setPitchShiftStretch,
    pitchShiftPreserveTimbre,
    setPitchShiftPreserveTimbre,
    pitchShiftOutputGain,
    setPitchShiftOutputGain,
    pitchShiftPan,
    setPitchShiftPan
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!processorRef.current) {
      processorRef.current = new PitchShifterProcessor(audioContextRef.current, pitchShiftQuality);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setSemitones(pitchShiftSemitones);
      processorRef.current.setCents(pitchShiftCents);
      processorRef.current.setFormantShift(pitchShiftFormant);
      processorRef.current.setFormantCorrection(pitchShiftFormantCorrection);
      processorRef.current.setPreserveTimbre(pitchShiftPreserveTimbre);
      processorRef.current.setStretch(pitchShiftStretch);
      processorRef.current.setWetMix(pitchShiftMix);
      processorRef.current.setOutputGain(pitchShiftOutputGain);
      processorRef.current.setPan(pitchShiftPan);
      processorRef.current.setQuality(pitchShiftQuality);
    }
  }, [pitchShiftSemitones, pitchShiftCents, pitchShiftFormant, pitchShiftFormantCorrection,
      pitchShiftMix, pitchShiftQuality, pitchShiftStretch, pitchShiftPreserveTimbre,
      pitchShiftOutputGain, pitchShiftPan]);
  
  // Draw pitch shift visualization
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw frequency response visualization
    const totalCents = (pitchShiftSemitones * 100) + pitchShiftCents;
    const pitchRatio = Math.pow(2, totalCents / 1200);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal lines for pitch levels
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Vertical lines for time
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw original pitch line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Draw shifted pitch line
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const shiftedY = height / 2 - (totalCents / 1200) * (height / 4);
    ctx.moveTo(0, shiftedY);
    ctx.lineTo(width, shiftedY);
    ctx.stroke();
    
    // Draw formant preservation indicator
    if (pitchShiftFormantCorrection) {
      ctx.strokeStyle = '#7bafd4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      // Formant frequencies remain at original positions
      for (let i = 1; i <= 3; i++) {
        const formantY = height - (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, formantY);
        ctx.lineTo(width, formantY);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
    
    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Pitch: ${pitchShiftSemitones > 0 ? '+' : ''}${pitchShiftSemitones}st ${pitchShiftCents > 0 ? '+' : ''}${pitchShiftCents}¢`, 10, 20);
    ctx.fillText(`Ratio: ${pitchRatio.toFixed(3)}x`, 10, 35);
    
    if (pitchShiftFormantCorrection) {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText('Formant Preservation: ON', 10, 50);
    }
    
    // Draw quality indicator
    ctx.fillStyle = '#cbb677';
    ctx.fillText(`Quality: ${QualitySettings[pitchShiftQuality]?.name || 'Unknown'}`, 10, height - 10);
    
  }, [pitchShiftSemitones, pitchShiftCents, pitchShiftFormantCorrection, pitchShiftQuality]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
  // Apply pitch shift to selected region
  const applyPitchShift = useCallback(
    createEffectApplyFunction(processPitchShiftRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        semitones: pitchShiftSemitones,
        cents: pitchShiftCents,
        formantShift: pitchShiftFormant,
        formantCorrection: pitchShiftFormantCorrection,
        preserveTimbre: pitchShiftPreserveTimbre,
        stretch: pitchShiftStretch,
        wetMix: pitchShiftMix,
        outputGain: pitchShiftOutputGain,
        quality: pitchShiftQuality
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, pitchShiftSemitones, pitchShiftCents, pitchShiftFormant, pitchShiftFormantCorrection, pitchShiftPreserveTimbre, pitchShiftStretch, pitchShiftMix, pitchShiftOutputGain, pitchShiftQuality, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* Pitch Shift Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              style={{ width: '100%', height: '150px' }}
            />
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">Pitch Shift Visualization</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Quality and Mode Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Quality</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PitchShifterTooltips.quality}</Tooltip>}
          >
            <Form.Select
              value={pitchShiftQuality}
              onChange={(e) => setPitchShiftQuality(e.target.value)}
              className="bg-secondary text-white border-0"
            >
              {Object.entries(QualitySettings).map(([key, setting]) => (
                <option key={key} value={key}>{setting.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={12} md={6} className="d-flex align-items-end">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PitchShifterTooltips.formantPreserve}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="formant-correction"
                label="Formant Correction"
                checked={pitchShiftFormantCorrection}
                onChange={(e) => setPitchShiftFormantCorrection(e.target.checked)}
                className="text-white"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Main Pitch Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PitchShifterTooltips.pitch}</Tooltip>}
          >
            <div>
              <Knob
                value={pitchShiftSemitones}
                onChange={setPitchShiftSemitones}
                min={-24}
                max={24}
                step={1}
                label="Semitones"
                displayValue={`${pitchShiftSemitones > 0 ? '+' : ''}${pitchShiftSemitones}`}
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
            overlay={<Tooltip>{PitchShifterTooltips.cents}</Tooltip>}
          >
            <div>
              <Knob
                value={pitchShiftCents}
                onChange={setPitchShiftCents}
                min={-100}
                max={100}
                step={1}
                label="Fine Tune"
                displayValue={`${pitchShiftCents > 0 ? '+' : ''}${pitchShiftCents}¢`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftFormant}
            onChange={setPitchShiftFormant}
            min={-12}
            max={12}
            step={0.1}
            label="Formant"
            displayValue={`${pitchShiftFormant > 0 ? '+' : ''}${pitchShiftFormant.toFixed(1)}st`}
            size={50}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftStretch}
            onChange={setPitchShiftStretch}
            min={0.25}
            max={4.0}
            step={0.01}
            label="Stretch"
            displayValue={`${pitchShiftStretch.toFixed(2)}x`}
            size={50}
            color="#dda0dd"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftMix}
            onChange={setPitchShiftMix}
            min={0}
            max={1}
            step={0.01}
            label="Mix"
            displayValue={`${Math.round(pitchShiftMix * 100)}%`}
            size={50}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftOutputGain}
            onChange={setPitchShiftOutputGain}
            min={0}
            max={2}
            step={0.01}
            label="Output"
            displayValue={`${pitchShiftOutputGain.toFixed(2)}x`}
            size={50}
            color="#ffa500"
          />
        </Col>
      </Row>
      
      {/* Advanced Controls */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Advanced Controls</div>
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftGrainSize}
            onChange={setPitchShiftGrainSize}
            min={512}
            max={8192}
            step={512}
            label="Grain Size"
            displayValue={`${pitchShiftGrainSize}`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftOverlap}
            onChange={setPitchShiftOverlap}
            min={0.25}
            max={0.875}
            step={0.125}
            label="Overlap"
            displayValue={`${Math.round(pitchShiftOverlap * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={pitchShiftPan}
            onChange={setPitchShiftPan}
            min={-1}
            max={1}
            step={0.01}
            label="Pan"
            displayValue={pitchShiftPan === 0 ? 'Center' : (pitchShiftPan > 0 ? `${Math.round(pitchShiftPan * 100)}% R` : `${Math.round(-pitchShiftPan * 100)}% L`)}
            size={45}
            color="#dda0dd"
          />
        </Col>
        
        <Col xs={6} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="preserve-timbre"
            label="Preserve Timbre"
            checked={pitchShiftPreserveTimbre}
            onChange={(e) => setPitchShiftPreserveTimbre(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyPitchShift}
          >
            Apply Pitch Shift to Region
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