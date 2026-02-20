'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

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
 * Professional Distortion Processor
 * Multiple distortion algorithms with tone shaping
 */
class DistortionProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.preGain = audioContext.createGain();
    this.postGain = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Tone stack (3-band EQ)
    this.bassFilter = audioContext.createBiquadFilter();
    this.midFilter = audioContext.createBiquadFilter();
    this.trebleFilter = audioContext.createBiquadFilter();
    this.presenceFilter = audioContext.createBiquadFilter();
    this.toneFilter = audioContext.createBiquadFilter();
    
    // Distortion processing
    this.waveshaper = audioContext.createWaveShaper();
    this.waveshaper.oversample = '4x';
    
    // Setup filters
    this.setupToneStack();
    this.setupRouting();
    
    // Default settings
    this.distortionType = 'tubeSaturation';
    this.drive = 5;
    this.asymmetry = 0;
    this.harmonics = 0.5;
    this.wetMix = 1.0;
    
    this.updateDistortionCurve();
  }
  
  setupToneStack() {
    // Bass: Low shelf at 100Hz
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 100;
    this.bassFilter.gain.value = 0;
    
    // Mid: Peaking at 1kHz
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 1;
    this.midFilter.gain.value = 0;
    
    // Treble: High shelf at 3kHz
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 3000;
    this.trebleFilter.gain.value = 0;
    
    // Presence: High shelf at 5kHz
    this.presenceFilter.type = 'highshelf';
    this.presenceFilter.frequency.value = 5000;
    this.presenceFilter.gain.value = 0;
    
    // Tone: Low pass filter
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 5000;
    this.toneFilter.Q.value = 0.7;
  }
  
  setupRouting() {
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path: input -> preGain -> toneStack -> waveshaper -> postGain -> output
    this.input.connect(this.preGain);
    this.preGain.connect(this.bassFilter);
    this.bassFilter.connect(this.midFilter);
    this.midFilter.connect(this.trebleFilter);
    this.trebleFilter.connect(this.presenceFilter);
    this.presenceFilter.connect(this.toneFilter);
    this.toneFilter.connect(this.waveshaper);
    this.waveshaper.connect(this.postGain);
    this.postGain.connect(this.wetGain);
    this.wetGain.connect(this.output);
    
    // Default mix
    this.setWetMix(1.0);
  }
  
  /**
   * Generate distortion curve based on type and parameters
   */
  updateDistortionCurve() {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    // Convert drive to gain (0-20dB)
    const driveGain = Math.pow(10, this.drive / 20);
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1
      let y;
      
      switch (this.distortionType) {
        case 'tubeSaturation':
          // Smooth tube-style saturation using tanh
          y = Math.tanh(x * driveGain * 2) * 0.7;
          // Add subtle even harmonics
          y += Math.sin(x * Math.PI * 2) * this.harmonics * 0.1;
          break;
          
        case 'transistorDistortion':
          // Transistor-style clipping with knee
          const threshold = 0.7;
          if (Math.abs(x * driveGain) < threshold) {
            y = x * driveGain;
          } else {
            y = threshold * Math.sign(x) + (Math.abs(x * driveGain) - threshold) * 0.3 * Math.sign(x);
          }
          break;
          
        case 'digitalClipping':
          // Hard digital clipping
          y = Math.max(-1, Math.min(1, x * driveGain));
          break;
          
        case 'tapeCompression':
          // Smooth tape-style compression
          y = x * driveGain / (1 + Math.abs(x * driveGain * 0.5));
          // Add warmth with subtle harmonics
          y *= (1 + this.harmonics * 0.2);
          break;
          
        case 'fuzzBox':
          // Square wave-like fuzz distortion
          y = Math.sign(x * driveGain) * Math.pow(Math.abs(x * driveGain), 0.5);
          // Add octave harmonics
          y += Math.sin(x * Math.PI * 4) * this.harmonics * 0.15;
          break;
          
        case 'bitCrusher':
          // Bit reduction effect
          const bits = Math.floor(16 - this.drive);
          const step = Math.pow(2, bits);
          y = Math.round(x * driveGain * step) / step;
          break;
          
        case 'waveShaper':
          // Polynomial waveshaping
          const a = driveGain * 0.5;
          y = x * (1 + a * Math.abs(x));
          y = Math.max(-1, Math.min(1, y));
          break;
          
        case 'asymmetricClip':
          // Asymmetric clipping (diode-like)
          const posThresh = 0.7 + this.asymmetry * 0.3;
          const negThresh = 0.7 - this.asymmetry * 0.3;
          const scaledX = x * driveGain;
          
          if (scaledX > posThresh) {
            y = posThresh + (scaledX - posThresh) * 0.2;
          } else if (scaledX < -negThresh) {
            y = -negThresh + (scaledX + negThresh) * 0.1;
          } else {
            y = scaledX;
          }
          break;
          
        default:
          y = x;
      }
      
      // Apply asymmetry if specified
      if (this.asymmetry !== 0 && this.distortionType !== 'asymmetricClip') {
        y = y + (y * y * this.asymmetry * 0.3);
      }
      
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    
    this.waveshaper.curve = curve;
    
    // Adjust pre/post gain based on distortion type
    this.preGain.gain.value = this.getPreGain();
    this.postGain.gain.value = this.getPostGain();
  }
  
  getPreGain() {
    // Pre-gain compensation based on distortion type
    switch (this.distortionType) {
      case 'bitCrusher': return 1.0;
      case 'digitalClipping': return 0.8;
      default: return 1.0;
    }
  }
  
  getPostGain() {
    // Post-gain compensation
    const driveCompensation = 1 / (1 + this.drive * 0.05);
    
    switch (this.distortionType) {
      case 'tubeSaturation': return driveCompensation * 1.2;
      case 'fuzzBox': return driveCompensation * 0.8;
      case 'bitCrusher': return driveCompensation * 1.1;
      default: return driveCompensation;
    }
  }
  
  setDistortionType(type) {
    this.distortionType = type;
    this.updateDistortionCurve();
  }
  
  setDrive(drive) {
    this.drive = Math.max(0, Math.min(20, drive));
    this.updateDistortionCurve();
  }
  
  setAsymmetry(asymmetry) {
    this.asymmetry = Math.max(-1, Math.min(1, asymmetry));
    this.updateDistortionCurve();
  }
  
  setHarmonics(harmonics) {
    this.harmonics = Math.max(0, Math.min(1, harmonics));
    this.updateDistortionCurve();
  }
  
  setTone(freq) {
    this.toneFilter.frequency.setValueAtTime(
      Math.max(200, Math.min(20000, freq)), 
      this.context.currentTime
    );
  }
  
  setBass(gain) {
    this.bassFilter.gain.setValueAtTime(
      Math.max(-12, Math.min(12, gain)), 
      this.context.currentTime
    );
  }
  
  setMid(gain) {
    this.midFilter.gain.setValueAtTime(
      Math.max(-12, Math.min(12, gain)), 
      this.context.currentTime
    );
  }
  
  setTreble(gain) {
    this.trebleFilter.gain.setValueAtTime(
      Math.max(-12, Math.min(12, gain)), 
      this.context.currentTime
    );
  }
  
  setPresence(gain) {
    this.presenceFilter.gain.setValueAtTime(
      Math.max(-12, Math.min(12, gain)), 
      this.context.currentTime
    );
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
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Process distortion on an audio buffer region
 * Pure function for offline processing
 */
export async function processDistortionRegion(audioBuffer, startSample, endSample, parameters) {
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

  // Create distortion processor
  const distortion = new DistortionProcessor(offlineContext);
  distortion.setDistortionType(parameters.type || 'tubeSaturation');
  distortion.setDrive(parameters.drive || 5);
  distortion.setTone(parameters.tone || 5000);
  distortion.setPresence(parameters.presence || 0);
  distortion.setBass(parameters.bass || 0);
  distortion.setMid(parameters.mid || 0);
  distortion.setTreble(parameters.treble || 0);
  distortion.setAsymmetry(parameters.asymmetry || 0);
  distortion.setHarmonics(parameters.harmonics || 0.5);
  distortion.setWetMix(parameters.wetMix || 1.0);
  distortion.setOutputGain(parameters.outputGain || 0.7);

  // Connect and render
  source.connect(distortion.input);
  distortion.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  const renderedBuffer = await offlineContext.startRendering();

  // Return processed region directly
  return renderedBuffer;
}

/**
 * Professional Multi-Type Distortion/Saturation Effect
 * Features: Multiple distortion types, tone shaping, harmonic generation
 */
export default function Distortion({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    distortionType,
    setDistortionType,
    distortionDrive,
    setDistortionDrive,
    distortionTone,
    setDistortionTone,
    distortionPresence,
    setDistortionPresence,
    distortionBass,
    setDistortionBass,
    distortionMid,
    setDistortionMid,
    distortionTreble,
    setDistortionTreble,
    distortionOutputGain,
    setDistortionOutputGain,
    distortionAsymmetry,
    setDistortionAsymmetry,
    distortionHarmonics,
    setDistortionHarmonics,
    distortionWetMix,
    setDistortionWetMix
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const distortionProcessorRef = useRef(null);
  const canvasRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize audio context and distortion processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!distortionProcessorRef.current) {
      distortionProcessorRef.current = new DistortionProcessor(audioContextRef.current);
    }
  }, []);

  // Set initial preset values on first load
  useEffect(() => {
    if (!hasInitialized && distortionType) {
      const presets = DistortionTypes[distortionType]?.presets;
      if (presets) {
        setDistortionDrive(presets.drive);
        setDistortionTone(presets.tone);
        setDistortionPresence(presets.presence);
        setDistortionAsymmetry(presets.asymmetry);
        setDistortionHarmonics(presets.harmonics);
        setDistortionWetMix(presets.mix);
        setDistortionBass(presets.bass);
        setDistortionMid(presets.mid);
        setDistortionTreble(presets.treble);
        setDistortionOutputGain(presets.outputGain);
        setHasInitialized(true);
      }
    }
  }, [distortionType, hasInitialized, setDistortionDrive, setDistortionTone, setDistortionPresence,
      setDistortionAsymmetry, setDistortionHarmonics, setDistortionWetMix, setDistortionBass,
      setDistortionMid, setDistortionTreble, setDistortionOutputGain]);
  
  // Update distortion parameters
  useEffect(() => {
    if (distortionProcessorRef.current) {
      distortionProcessorRef.current.setDistortionType(distortionType);
      distortionProcessorRef.current.setDrive(distortionDrive);
      distortionProcessorRef.current.setTone(distortionTone);
      distortionProcessorRef.current.setPresence(distortionPresence);
      distortionProcessorRef.current.setBass(distortionBass);
      distortionProcessorRef.current.setMid(distortionMid);
      distortionProcessorRef.current.setTreble(distortionTreble);
      distortionProcessorRef.current.setAsymmetry(distortionAsymmetry);
      distortionProcessorRef.current.setHarmonics(distortionHarmonics);
      distortionProcessorRef.current.setWetMix(distortionWetMix);
      distortionProcessorRef.current.setOutputGain(distortionOutputGain);
    }
  }, [distortionType, distortionDrive, distortionTone, distortionPresence,
      distortionBass, distortionMid, distortionTreble, distortionAsymmetry,
      distortionHarmonics, distortionWetMix, distortionOutputGain]);
  
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
    if (distortionWetMix < 1.0) {
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

    const driveGain = Math.pow(10, distortionDrive / 20);
    const outputGain = Math.pow(10, distortionOutputGain / 20);

    for (let x = 0; x < width; x++) {
      const input = (x / width) * 2 - 1; // -1 to 1
      let output;

      switch (distortionType) {
        case 'tubeSaturation':
          output = Math.tanh(input * driveGain * 2) * 0.7;
          // Enhanced harmonics effect - add multiple harmonics
          output += Math.sin(input * Math.PI * 2) * distortionHarmonics * 0.15;
          output += Math.sin(input * Math.PI * 3) * distortionHarmonics * 0.08 * distortionHarmonics;
          break;
          
        case 'transistorDistortion':
          const threshold = 0.7 - distortionHarmonics * 0.2; // Harmonics affects threshold
          if (Math.abs(input * driveGain) < threshold) {
            output = input * driveGain;
          } else {
            output = threshold * Math.sign(input) + (Math.abs(input * driveGain) - threshold) * 0.3 * Math.sign(input);
          }
          // Add odd harmonics for transistor character
          output += Math.sin(input * Math.PI * 3) * distortionHarmonics * 0.1;
          break;

        case 'digitalClipping':
          output = Math.max(-1, Math.min(1, input * driveGain));
          // Add digital artifacts/aliasing as harmonics
          if (distortionHarmonics > 0) {
            output = Math.round(output * (10 - distortionHarmonics * 8)) / (10 - distortionHarmonics * 8);
          }
          break;

        case 'tapeCompression':
          output = input * driveGain / (1 + Math.abs(input * driveGain * 0.5));
          // Enhanced tape harmonics - warm even harmonics
          output *= (1 + distortionHarmonics * 0.3);
          output += Math.sin(input * Math.PI * 2) * distortionHarmonics * 0.1;
          output += Math.sin(input * Math.PI * 4) * distortionHarmonics * 0.05;
          break;

        case 'fuzzBox':
          output = Math.sign(input * driveGain) * Math.pow(Math.abs(input * driveGain), 0.5 - distortionHarmonics * 0.3);
          // Heavy harmonic content for fuzz
          output += Math.sin(input * Math.PI * 3) * distortionHarmonics * 0.2;
          output += Math.sin(input * Math.PI * 5) * distortionHarmonics * 0.1;
          break;
          
        case 'bitCrusher':
          const bits = Math.floor(16 - distortionDrive - distortionHarmonics * 8);
          const step = Math.pow(2, bits);
          output = Math.round(input * driveGain * step) / step;
          // Add digital noise as harmonics
          if (distortionHarmonics > 0) {
            output += (Math.random() - 0.5) * distortionHarmonics * 0.05;
          }
          break;

        case 'waveShaper':
          const a = driveGain * (0.5 + distortionHarmonics * 0.5);
          output = input * (1 + a * Math.abs(input));
          // Add wave folding for harmonics
          if (distortionHarmonics > 0.5) {
            output = Math.sin(output * Math.PI * (1 + distortionHarmonics));
          }
          output = Math.max(-1, Math.min(1, output));
          break;

        case 'asymmetricClip':
          const posThresh = 0.7 + distortionAsymmetry * 0.3 - distortionHarmonics * 0.1;
          const negThresh = 0.7 - distortionAsymmetry * 0.3 - distortionHarmonics * 0.1;
          const scaledInput = input * driveGain;

          if (scaledInput > posThresh) {
            output = posThresh + (scaledInput - posThresh) * (0.2 + distortionHarmonics * 0.1);
          } else if (scaledInput < -negThresh) {
            output = -negThresh + (scaledInput + negThresh) * (0.1 + distortionHarmonics * 0.05);
          } else {
            output = scaledInput;
          }
          break;

        default:
          output = input;
      }

      // Apply asymmetry if specified (except for asymmetric clip which has it built-in)
      if (distortionAsymmetry !== 0 && distortionType !== 'asymmetricClip') {
        output = output + (output * output * distortionAsymmetry * 0.3);
      }

      // Apply output gain
      output = output * outputGain;

      // Apply wet/dry mix
      const drySignal = input;
      output = drySignal * (1 - distortionWetMix) + output * distortionWetMix;

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
    ctx.fillText(`${DistortionTypes[distortionType]?.name || 'Unknown'}`, 10, 15);

    // Show active parameters
    const activeParams = [];
    if (distortionDrive !== 0) activeParams.push(`Drive: ${distortionDrive.toFixed(1)}dB`);
    if (distortionHarmonics > 0) activeParams.push(`Harm: ${(distortionHarmonics * 100).toFixed(0)}%`);
    if (distortionAsymmetry !== 0) activeParams.push(`Asym: ${(distortionAsymmetry * 100).toFixed(0)}%`);
    if (distortionWetMix < 1) activeParams.push(`Mix: ${(distortionWetMix * 100).toFixed(0)}%`);
    if (distortionOutputGain !== 0) activeParams.push(`Out: ${distortionOutputGain.toFixed(1)}dB`);

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
  }, [distortionType, distortionDrive, distortionAsymmetry, distortionHarmonics, distortionWetMix, distortionOutputGain]);
  
  // Update visualization
  useEffect(() => {
    drawDistortionCurve();
  }, [drawDistortionCurve]);
  
  // Apply distortion to selected region
  const applyDistortion = useCallback(
    createEffectApplyFunction(processDistortionRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        type: distortionType,
        drive: distortionDrive,
        tone: distortionTone,
        presence: distortionPresence,
        bass: distortionBass,
        mid: distortionMid,
        treble: distortionTreble,
        asymmetry: distortionAsymmetry,
        harmonics: distortionHarmonics,
        wetMix: distortionWetMix,
        outputGain: distortionOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, distortionType,
      distortionDrive, distortionTone, distortionPresence, distortionBass,
      distortionMid, distortionTreble, distortionAsymmetry, distortionHarmonics,
      distortionWetMix, distortionOutputGain, onApply]
  );
  
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
            value={distortionType}
            onChange={(e) => {
              const selectedType = e.target.value;
              const presets = DistortionTypes[selectedType]?.presets;

              // Update all values based on the preset
              if (presets) {
                setDistortionType(selectedType);
                setDistortionDrive(presets.drive);
                setDistortionTone(presets.tone);
                setDistortionPresence(presets.presence);
                setDistortionAsymmetry(presets.asymmetry);
                setDistortionHarmonics(presets.harmonics);
                setDistortionWetMix(presets.mix);
                setDistortionBass(presets.bass);
                setDistortionMid(presets.mid);
                setDistortionTreble(presets.treble);
                setDistortionOutputGain(presets.outputGain);
              } else {
                setDistortionType(selectedType);
              }
            }}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(DistortionTypes).map(([key, type]) => (
              <option key={key} value={key}>{type.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{DistortionTypes[distortionType]?.description}</small>
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
                value={distortionDrive}
                onChange={setDistortionDrive}
                min={0}
                max={20}
                step={0.1}
                label="Drive"
                displayValue={`${distortionDrive.toFixed(1)}dB`}
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
                value={distortionTone}
                onChange={setDistortionTone}
                min={200}
                max={20000}
                step={50}
                label="Tone"
                displayValue={distortionTone >= 1000 ? `${(distortionTone/1000).toFixed(1)}k` : `${distortionTone}Hz`}
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
                value={distortionPresence}
                onChange={setDistortionPresence}
                min={-12}
                max={12}
                step={0.1}
                label="Presence"
                displayValue={`${distortionPresence > 0 ? '+' : ''}${distortionPresence.toFixed(1)}dB`}
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
                value={distortionAsymmetry}
                onChange={setDistortionAsymmetry}
                min={-1}
                max={1}
                step={0.01}
                label="Asymmetry"
                displayValue={`${Math.round(distortionAsymmetry * 100)}%`}
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
                value={distortionHarmonics}
                onChange={setDistortionHarmonics}
                min={0}
                max={1}
                step={0.01}
                label="Harmonics"
                displayValue={`${Math.round(distortionHarmonics * 100)}%`}
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
                value={distortionWetMix}
                onChange={setDistortionWetMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(distortionWetMix * 100)}%`}
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
                value={distortionBass}
                onChange={setDistortionBass}
                min={-12}
                max={12}
                step={0.1}
                label="Bass"
                displayValue={`${distortionBass > 0 ? '+' : ''}${distortionBass.toFixed(1)}dB`}
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
                value={distortionMid}
                onChange={setDistortionMid}
                min={-12}
                max={12}
                step={0.1}
                label="Mid"
                displayValue={`${distortionMid > 0 ? '+' : ''}${distortionMid.toFixed(1)}dB`}
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
                value={distortionTreble}
                onChange={setDistortionTreble}
                min={-12}
                max={12}
                step={0.1}
                label="Treble"
                displayValue={`${distortionTreble > 0 ? '+' : ''}${distortionTreble.toFixed(1)}dB`}
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
                value={distortionOutputGain}
                onChange={setDistortionOutputGain}
                min={0}
                max={2}
                step={0.01}
                label="Output"
                displayValue={`${distortionOutputGain.toFixed(2)}x`}
                size={45}
                color="#92ceaa"
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
            onClick={applyDistortion}
          >
            Apply Distortion to Region
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