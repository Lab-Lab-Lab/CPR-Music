'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const RingModulatorTooltips = {
  frequency: "Modulation frequency. Low frequencies (20-200Hz) create tremolo-like effects, mid (200-800Hz) create metallic tones, high (1-5kHz) create bell-like sounds.",
  depth: "Amount of modulation. 100% is full ring modulation (classic effect), lower values blend with original tone for subtler metallic shimmer.",
  waveform: "Modulator waveform shape. Sine creates smooth, musical tones. Square creates harsh, digital effects. Triangle and sawtooth create unique harmonic content.",
  mode: "Modulation algorithm. Classic is traditional ring mod (sum/difference frequencies), Amplitude is cleaner, Frequency creates FM-like effects, Sync creates locked harmonics.",
  mix: "Balance between dry and wet signal. Ring modulation completely transforms sound, so lower values (30-60%) often sound more musical than 100%."
};

/**
 * Ring Modulator modes
 */
const RingModModes = {
  classic: { 
    name: 'Classic Ring Mod', 
    description: 'Traditional ring modulation (amplitude modulation)' 
  },
  frequency: { 
    name: 'Frequency Mod', 
    description: 'Frequency modulation effects' 
  },
  amplitude: { 
    name: 'Amplitude Mod', 
    description: 'Clean amplitude modulation with DC offset' 
  },
  sync: { 
    name: 'Sync Mod', 
    description: 'Frequency-locked modulation' 
  }
};

/**
 * Professional Ring Modulator Processor
 * Multiple modulation modes with filtering and stereo effects
 */
class RingModulatorProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Oscillator for modulation
    this.oscillator = audioContext.createOscillator();
    this.oscillatorGain = audioContext.createGain();
    
    // Filter for post-processing
    this.filter = audioContext.createBiquadFilter();
    
    // Stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.leftDelay = audioContext.createDelay(0.1);
    this.rightDelay = audioContext.createDelay(0.1);
    
    // Parameters
    this.frequency = 440;
    this.waveform = 'sine';
    this.depth = 1.0;
    this.mode = 'classic';
    this.sync = false;
    this.offset = 0;
    this.phase = 0;
    this.filterFreq = 20000;
    this.filterType = 'none';
    this.outputGain = 1.0;
    this.stereoSpread = 0;
    this.wetMix = 1.0;
    this.oscillatorStarted = false;  // Track whether oscillator has been started

    this.setupRouting();
    this.initializeOscillator();
  }
  
  setupRouting() {
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path setup will be handled in processAudio
    this.setWetMix(this.wetMix);
  }
  
  initializeOscillator() {
    this.oscillator.type = this.waveform;
    this.oscillator.frequency.value = this.frequency;
    this.oscillator.connect(this.oscillatorGain);

    // Start oscillator only if not already started
    if (!this.oscillatorStarted) {
      this.oscillator.start();
      this.oscillatorStarted = true;
    }
  }
  
  /**
   * Generate advanced waveforms with anti-aliasing
   */
  generateCarrierWaveform(type, sampleRate, duration, frequency, phase = 0) {
    const samples = Math.floor(sampleRate * duration);
    const waveform = new Float32Array(samples);
    const phaseRad = (phase * Math.PI) / 180;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / sampleRate) * frequency * Math.PI * 2 + phaseRad;
      
      switch(type) {
        case 'sine':
          waveform[i] = Math.sin(t);
          break;
          
        case 'triangle':
          // Band-limited triangle
          let triangleValue = 0;
          const maxTriangleHarmonic = Math.floor(sampleRate / (4 * frequency));
          for (let h = 1; h <= maxTriangleHarmonic; h += 2) {
            triangleValue += (8 / (Math.PI * Math.PI)) * 
              (Math.pow(-1, (h-1)/2) / (h * h)) * Math.sin(h * t);
          }
          waveform[i] = triangleValue;
          break;
          
        case 'square':
          // Band-limited square
          let squareValue = 0;
          const maxSquareHarmonic = Math.floor(sampleRate / (4 * frequency));
          for (let h = 1; h <= maxSquareHarmonic; h += 2) {
            squareValue += (4 / Math.PI) * (1 / h) * Math.sin(h * t);
          }
          waveform[i] = squareValue;
          break;
          
        case 'sawtooth':
          // Band-limited sawtooth
          let sawValue = 0;
          const maxSawHarmonic = Math.floor(sampleRate / (2 * frequency));
          for (let h = 1; h <= maxSawHarmonic; h++) {
            sawValue += (2 / Math.PI) * (Math.pow(-1, h+1) / h) * Math.sin(h * t);
          }
          waveform[i] = sawValue;
          break;
          
        case 'noise':
          waveform[i] = (Math.random() * 2 - 1);
          break;
          
        default:
          waveform[i] = Math.sin(t);
      }
    }
    
    return waveform;
  }
  
  /**
   * Detect fundamental frequency of input signal
   */
  detectFundamentalFreq(inputData, sampleRate) {
    // Simple autocorrelation-based pitch detection
    const minFreq = 50; // Hz
    const maxFreq = 2000; // Hz
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.floor(sampleRate / minFreq);
    
    let bestCorrelation = 0;
    let bestPeriod = minPeriod;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < inputData.length - period; i++) {
        correlation += inputData[i] * inputData[i + period];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return sampleRate / bestPeriod;
  }
  
  /**
   * Apply ring modulation with various modes
   */
  processRingModulation(inputData, carrierWaveform, mode, depth) {
    const outputData = new Float32Array(inputData.length);
    
    for (let i = 0; i < inputData.length && i < carrierWaveform.length; i++) {
      const input = inputData[i];
      const carrier = carrierWaveform[i];
      let output;
      
      switch (mode) {
        case 'classic':
          // Traditional ring modulation
          output = input * carrier * depth;
          break;
          
        case 'amplitude':
          // Amplitude modulation with DC offset
          output = input * (1 + carrier * depth);
          break;
          
        case 'frequency':
          // Frequency modulation effect
          const modIndex = i + Math.floor(carrier * depth * 10);
          output = modIndex < inputData.length ? inputData[modIndex] : input;
          break;
          
        case 'sync':
          // Hard sync effect
          const syncPoint = Math.floor(Math.abs(carrier) * 100 * depth);
          output = syncPoint % 2 === 0 ? input * carrier : input * -carrier;
          break;
          
        default:
          output = input * carrier * depth;
      }
      
      outputData[i] = Math.max(-1, Math.min(1, output));
    }
    
    return outputData;
  }
  
  /**
   * Apply filtering to the modulated signal
   */
  applyFiltering(inputData, sampleRate, filterType, frequency) {
    if (filterType === 'none' || frequency >= sampleRate / 2) {
      return inputData;
    }
    
    const outputData = new Float32Array(inputData.length);
    const nyquist = sampleRate / 2;
    const normalizedFreq = frequency / nyquist;
    
    // Simple first-order filter implementation
    let prev = 0;
    const alpha = normalizedFreq;
    
    for (let i = 0; i < inputData.length; i++) {
      let filtered;
      
      switch (filterType) {
        case 'lowpass':
          filtered = prev + alpha * (inputData[i] - prev);
          break;
          
        case 'highpass':
          filtered = inputData[i] - (prev + alpha * (inputData[i] - prev));
          break;
          
        case 'bandpass':
          // Simple bandpass as combination of high and low pass
          const lowpassed = prev + alpha * (inputData[i] - prev);
          filtered = inputData[i] - lowpassed + lowpassed * 0.5;
          break;
          
        default:
          filtered = inputData[i];
      }
      
      outputData[i] = filtered;
      prev = filtered;
    }
    
    return outputData;
  }
  
  // Parameter setters
  setFrequency(freq) {
    this.frequency = Math.max(0.1, Math.min(8000, freq));
  }
  
  setWaveform(waveform) {
    this.waveform = waveform;
  }
  
  setDepth(depth) {
    this.depth = Math.max(0, Math.min(1, depth));
  }
  
  setMode(mode) {
    this.mode = mode;
  }
  
  setSync(sync) {
    this.sync = sync;
  }
  
  setOffset(offset) {
    this.offset = Math.max(-1000, Math.min(1000, offset));
  }
  
  setPhase(phase) {
    this.phase = Math.max(0, Math.min(360, phase));
  }
  
  setFilterFreq(freq) {
    this.filterFreq = Math.max(20, Math.min(20000, freq));
  }
  
  setFilterType(type) {
    this.filterType = type;
  }
  
  setOutputGain(gain) {
    this.outputGain = Math.max(0, Math.min(2, gain));
  }
  
  setStereoSpread(spread) {
    this.stereoSpread = Math.max(0, Math.min(1, spread));
  }
  
  setWetMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
    this.wetMix = wet;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Process ring modulation on an audio buffer region
 */
export async function processRingModulatorRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = regionLength / sampleRate;
  
  // Create processor
  const processor = new RingModulatorProcessor(audioContext);
  processor.setFrequency(parameters.frequency || 440);
  processor.setWaveform(parameters.waveform || 'sine');
  processor.setDepth(parameters.depth || 1.0);
  processor.setMode(parameters.mode || 'classic');
  processor.setSync(parameters.sync || false);
  processor.setOffset(parameters.offset || 0);
  processor.setPhase(parameters.phase || 0);
  processor.setFilterFreq(parameters.filterFreq || 20000);
  processor.setFilterType(parameters.filterType || 'none');
  processor.setOutputGain(parameters.outputGain || 1.0);
  processor.setStereoSpread(parameters.stereoSpread || 0);
  processor.setWetMix(parameters.wetMix || 1.0);
  
  // Create output buffer for just the region
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
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
    
    // Calculate carrier frequency
    let carrierFreq = processor.frequency + processor.offset;
    
    if (processor.sync) {
      // Try to sync to input frequency
      const detectedFreq = processor.detectFundamentalFreq(regionData, sampleRate);
      if (detectedFreq > 50 && detectedFreq < 2000) {
        carrierFreq = detectedFreq * Math.round(carrierFreq / detectedFreq);
      }
    }
    
    // Generate carrier waveform
    const phaseOffset = channel * processor.stereoSpread * 180; // Stereo spread
    const carrierWaveform = processor.generateCarrierWaveform(
      processor.waveform,
      sampleRate,
      regionDuration,
      carrierFreq,
      processor.phase + phaseOffset
    );
    
    // Apply ring modulation
    const modulatedData = processor.processRingModulation(
      regionData,
      carrierWaveform,
      processor.mode,
      processor.depth
    );
    
    // Apply filtering
    const filteredData = processor.applyFiltering(
      modulatedData,
      sampleRate,
      processor.filterType,
      processor.filterFreq
    );
    
    // Mix back to output with wet/dry control
    const mixAmount = processor.wetMix;
    for (let i = 0; i < regionLength; i++) {
      const original = regionData[i];
      const processed = filteredData[i] * processor.outputGain;
      outputData[i] = original * (1 - mixAmount) + processed * mixAmount;
    }
  }
  
  return outputBuffer;
}

/**
 * Professional Ring Modulator Effect
 * Features: Multiple modes, frequency sync, filtering, stereo effects
 */
export default function RingModulator({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    ringModFrequency,
    setRingModFrequency,
    ringModWaveform,
    setRingModWaveform,
    ringModMix,
    setRingModMix,
    ringModDepth,
    setRingModDepth,
    ringModMode,
    setRingModMode,
    ringModSync,
    setRingModSync,
    ringModOffset,
    setRingModOffset,
    ringModPhase,
    setRingModPhase,
    ringModFilterFreq,
    setRingModFilterFreq,
    ringModFilterType,
    setRingModFilterType,
    ringModOutputGain,
    setRingModOutputGain,
    ringModStereoSpread,
    setRingModStereoSpread
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
      processorRef.current = new RingModulatorProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setFrequency(ringModFrequency);
      processorRef.current.setWaveform(ringModWaveform);
      processorRef.current.setDepth(ringModDepth);
      processorRef.current.setMode(ringModMode);
      processorRef.current.setSync(ringModSync);
      processorRef.current.setOffset(ringModOffset);
      processorRef.current.setPhase(ringModPhase);
      processorRef.current.setFilterFreq(ringModFilterFreq);
      processorRef.current.setFilterType(ringModFilterType);
      processorRef.current.setOutputGain(ringModOutputGain);
      processorRef.current.setStereoSpread(ringModStereoSpread);
      processorRef.current.setWetMix(ringModMix);
    }
  }, [ringModFrequency, ringModWaveform, ringModDepth, ringModMode, ringModSync,
      ringModOffset, ringModPhase, ringModFilterFreq, ringModFilterType,
      ringModOutputGain, ringModStereoSpread, ringModMix]);
  
  // Draw ring modulation visualization
  const drawVisualization = useCallback(() => {
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
    
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw carrier frequency waveform
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const cycles = 4;
    const carrierFreq = ringModFrequency + ringModOffset;
    
    for (let x = 0; x < width; x++) {
      const t = (x / width) * cycles * Math.PI * 2;
      let y;
      
      switch (ringModWaveform) {
        case 'sine':
          y = Math.sin(t);
          break;
        case 'triangle':
          y = Math.asin(Math.sin(t)) * (2 / Math.PI);
          break;
        case 'square':
          y = Math.sign(Math.sin(t));
          break;
        case 'sawtooth':
          y = 2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5));
          break;
        default:
          y = Math.sin(t);
      }
      
      y = (height / 2) - (y * ringModDepth * height / 4);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw modulation envelope
    if (ringModMode !== 'classic') {
      ctx.strokeStyle = '#7bafd4';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const envelope = Math.sin((x / width) * Math.PI) * ringModDepth;
        const y = (height / 2) - (envelope * height / 4);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Freq: ${carrierFreq >= 1000 ? `${(carrierFreq/1000).toFixed(1)}kHz` : `${carrierFreq}Hz`}`, 10, 20);
    ctx.fillText(`Mode: ${RingModModes[ringModMode]?.name || 'Classic'}`, 10, 35);
    
    if (ringModSync) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText('SYNC: ON', 10, 50);
    }
    
    if (ringModFilterType !== 'none') {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText(`Filter: ${ringModFilterType} ${ringModFilterFreq >= 1000 ? `${(ringModFilterFreq/1000).toFixed(1)}k` : `${ringModFilterFreq}Hz`}`, 10, height - 10);
    }
    
  }, [ringModFrequency, ringModWaveform, ringModDepth, ringModMode, ringModSync,
      ringModOffset, ringModFilterFreq, ringModFilterType]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
  // Create ring modulator parameters object
  const ringModParameters = {
    frequency: ringModFrequency,
    waveform: ringModWaveform,
    depth: ringModDepth,
    mode: ringModMode,
    sync: ringModSync,
    offset: ringModOffset,
    phase: ringModPhase,
    filterFreq: ringModFilterFreq,
    filterType: ringModFilterType,
    outputGain: ringModOutputGain,
    stereoSpread: ringModStereoSpread,
    wetMix: ringModMix
  };

  // Apply ring modulation to selected region using WaveformContext
  const applyRingMod = useCallback(
    createEffectApplyFunction(processRingModulatorRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: ringModParameters,
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, ringModFrequency, ringModWaveform, ringModDepth, ringModMode, ringModSync, ringModOffset, ringModPhase, ringModFilterFreq, ringModFilterType, ringModOutputGain, ringModStereoSpread, ringModMix, onApply]
  );
  
  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' },
    { key: 'noise', name: 'Noise' }
  ];
  
  const filterTypes = [
    { key: 'none', name: 'No Filter' },
    { key: 'lowpass', name: 'Low Pass' },
    { key: 'highpass', name: 'High Pass' },
    { key: 'bandpass', name: 'Band Pass' }
  ];
  
  return (
    <Container fluid className="p-2">
      {/* Ring Modulation Visualization */}
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
              <small className="text-muted">Ring Modulation Pattern</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Mode and Waveform Selection */}
      <Row className="mb-2">
        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Mode</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{RingModulatorTooltips.mode}</Tooltip>}
          >
            <Form.Select
              value={ringModMode}
              onChange={(e) => setRingModMode(e.target.value)}
              className="bg-secondary text-white border-0"
            >
              {Object.entries(RingModModes).map(([key, mode]) => (
                <option key={key} value={key}>{mode.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
          <small className="text-muted">{RingModModes[ringModMode]?.description}</small>
        </Col>

        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{RingModulatorTooltips.waveform}</Tooltip>}
          >
            <Form.Select
              value={ringModWaveform}
              onChange={(e) => setRingModWaveform(e.target.value)}
              className="bg-secondary text-white border-0"
            >
              {waveformTypes.map(type => (
                <option key={type.key} value={type.key}>{type.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>
        
        <Col xs={12} md={4}>
          <Form.Label className="text-white small">Filter</Form.Label>
          <Form.Select
            value={ringModFilterType}
            onChange={(e) => setRingModFilterType(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {filterTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>
      
      {/* Main Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModFrequency}
            onChange={setRingModFrequency}
            min={0.1}
            max={8000}
            step={0.1}
            label="Frequency"
            displayValue={ringModFrequency >= 1000 ? `${(ringModFrequency/1000).toFixed(1)}k` : `${ringModFrequency.toFixed(1)}Hz`}
            size={50}
            color="#e75b5c"
            logarithmic={true}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModDepth}
            onChange={setRingModDepth}
            min={0}
            max={1}
            step={0.01}
            label="Depth"
            displayValue={`${Math.round(ringModDepth * 100)}%`}
            size={50}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModOffset}
            onChange={setRingModOffset}
            min={-1000}
            max={1000}
            step={1}
            label="Offset"
            displayValue={`${ringModOffset > 0 ? '+' : ''}${ringModOffset}Hz`}
            size={50}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModPhase}
            onChange={setRingModPhase}
            min={0}
            max={360}
            step={1}
            label="Phase"
            displayValue={`${ringModPhase}°`}
            size={50}
            color="#dda0dd"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModMix}
            onChange={setRingModMix}
            min={0}
            max={1}
            step={0.01}
            label="Mix"
            displayValue={`${Math.round(ringModMix * 100)}%`}
            size={50}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModOutputGain}
            onChange={setRingModOutputGain}
            min={0}
            max={2}
            step={0.01}
            label="Output"
            displayValue={`${ringModOutputGain.toFixed(2)}x`}
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
            value={ringModFilterFreq}
            onChange={setRingModFilterFreq}
            min={20}
            max={20000}
            step={10}
            label="Filter Freq"
            displayValue={ringModFilterFreq >= 1000 ? `${(ringModFilterFreq/1000).toFixed(1)}k` : `${ringModFilterFreq}Hz`}
            size={45}
            color="#7bafd4"
            logarithmic={true}
            disabled={ringModFilterType === 'none'}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={ringModStereoSpread}
            onChange={setRingModStereoSpread}
            min={0}
            max={1}
            step={0.01}
            label="Stereo"
            displayValue={`${Math.round(ringModStereoSpread * 100)}%`}
            size={45}
            color="#dda0dd"
          />
        </Col>
        
        <Col xs={6} sm={4} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="freq-sync"
            label="Frequency Sync"
            checked={ringModSync}
            onChange={(e) => setRingModSync(e.target.checked)}
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
            onClick={applyRingMod}
          >
            Apply Ring Modulator to Region
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