'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const PhaserTooltips = {
  rate: "Speed of the phase sweep. Slow rates (0.1-0.5Hz) create smooth, spacey sweeps. Fast rates (2-5Hz) create vibrato-like modulation.",
  depth: "Intensity of the phase shifting. Higher values create more pronounced notches and peaks. Sweet spot is 50-80% for classic phaser sounds.",
  feedback: "Routes output back through the phase stages. Creates more resonant, metallic tones. Higher values (50-80%) intensify the effect dramatically.",
  stages: "Number of all-pass filters. More stages (8-12) create richer, more complex sweeps. Fewer stages (2-4) sound thinner and simpler.",
  mix: "Balance between dry and wet signal. 50% is classic phaser, 30-40% is subtle, 70-90% is intense. Lower mix preserves original character.",
  freqRange: "Frequency range that the phaser sweeps through. Wider ranges create more dramatic sweeps. Narrow ranges focus the effect on specific frequencies.",
  resonance: "Q factor of the all-pass filters. Higher resonance creates more pronounced peaks and notches. Use sparingly as it can become harsh.",
  waveform: "Shape of LFO modulation. Sine is smooth and natural, triangle is linear, square creates stepped sweeps, random adds unpredictability.",
  stereoPhase: "Phase offset between left and right channels. 90° creates wide stereo movement, 180° creates opposite sweeps. 0° is mono phasing.",
  tempoSync: "Locks sweep rate to project tempo using musical note divisions. Great for rhythmic phasing that stays in time with your music."
};

/**
 * LFO Waveforms for phaser modulation
 */
const LFOWaveforms = {
  sine: { name: 'Sine', description: 'Smooth sinusoidal modulation' },
  triangle: { name: 'Triangle', description: 'Linear ramp modulation' },
  sawtooth: { name: 'Sawtooth', description: 'Ramp up modulation' },
  square: { name: 'Square', description: 'Hard switching modulation' },
  random: { name: 'Random', description: 'Sample & hold random modulation' }
};

/**
 * All-Pass Filter for phase shifting
 * Creates the characteristic phaser sweep effect
 */
class AllPassFilter {
  constructor(audioContext) {
    this.context = audioContext;
    this.filter = audioContext.createBiquadFilter();
    this.filter.type = 'allpass';
    this.filter.frequency.value = 440;
    this.filter.Q.value = 1;
  }
  
  setFrequency(freq) {
    this.filter.frequency.setValueAtTime(freq, this.context.currentTime);
  }
  
  setQ(q) {
    this.filter.Q.setValueAtTime(q, this.context.currentTime);
  }
  
  connect(destination) {
    this.filter.connect(destination);
  }
  
  disconnect() {
    this.filter.disconnect();
  }
  
  get input() {
    return this.filter;
  }
  
  get output() {
    return this.filter;
  }
}

/**
 * Multi-Stage Phaser Processor
 * Professional implementation with multiple all-pass filters and LFO modulation
 */
class PhaserProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.feedbackGain = audioContext.createGain();
    
    // All-pass filter stages
    this.allPassFilters = [];
    this.stages = 4;
    
    // LFO for modulation
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfoOffset = audioContext.createConstantSource();
    
    // Stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.leftDelay = audioContext.createDelay(0.01);
    this.rightDelay = audioContext.createDelay(0.01);
    
    // Default settings
    this.rate = 0.5;
    this.depth = 0.7;
    this.feedback = 0.5;
    this.wetMix = 0.5;
    this.freqMin = 200;
    this.freqMax = 2000;
    this.resonance = 0.7;
    this.stereoPhase = 90;
    this.waveform = 'sine';
    this.lfoStarted = false;  // Track whether LFO oscillators have been started

    this.setupRouting();
    this.createAllPassStages(4);
    this.setupLFO();
  }
  
  setupRouting() {
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path setup (will be connected after creating stages)
    this.setWetMix(0.5);
  }
  
  createAllPassStages(stageCount) {
    // Clean up existing stages
    this.cleanup();
    
    this.allPassFilters = [];
    this.stages = Math.max(2, Math.min(12, stageCount));
    
    // Create all-pass filter chain
    let currentNode = this.input;
    
    for (let i = 0; i < this.stages; i++) {
      const allPass = new AllPassFilter(this.context);
      
      // Spread frequencies across the range
      const freq = this.freqMin + (i / (this.stages - 1)) * (this.freqMax - this.freqMin);
      allPass.setFrequency(freq);
      allPass.setQ(this.resonance);
      
      // Connect LFO to frequency modulation
      this.lfoGain.connect(allPass.filter.frequency);
      this.lfoOffset.connect(allPass.filter.frequency);
      
      // Connect in series
      currentNode.connect(allPass.input);
      currentNode = allPass.output;
      
      this.allPassFilters.push(allPass);
    }
    
    // Connect to wet output with feedback
    currentNode.connect(this.wetGain);
    currentNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.input); // Feedback loop
    
    // Connect wet to output
    this.wetGain.connect(this.output);
    
    // Set initial feedback
    this.setFeedback(this.feedback);
  }
  
  setupLFO() {
    // Stop and disconnect existing oscillators if they exist
    if (this.lfoStarted) {
      this.lfo.stop();
      this.lfo.disconnect();
      this.lfoOffset.stop();
      this.lfoOffset.disconnect();
      this.lfoGain.disconnect();

      // Create new oscillators
      this.lfo = this.context.createOscillator();
      this.lfoGain = this.context.createGain();
      this.lfoOffset = this.context.createConstantSource();
    }

    this.lfo.type = this.waveform;
    this.lfo.frequency.value = this.rate;

    // Scale LFO for frequency modulation
    const freqRange = this.freqMax - this.freqMin;
    this.lfoGain.gain.value = (freqRange * this.depth) / 2;
    this.lfoOffset.offset.value = this.freqMin + (freqRange / 2);

    // Connect LFO
    this.lfo.connect(this.lfoGain);

    // Reconnect to all-pass filters
    this.allPassFilters.forEach(allPass => {
      this.lfoGain.connect(allPass.filter.frequency);
      this.lfoOffset.connect(allPass.filter.frequency);
    });

    // Start oscillators only if not already started
    if (!this.lfoStarted) {
      this.lfo.start();
      this.lfoOffset.start();
      this.lfoStarted = true;
    }
  }

  setRate(rate) {
    this.rate = Math.max(0.01, Math.min(10, rate));
    this.lfo.frequency.setValueAtTime(this.rate, this.context.currentTime);
  }
  
  setDepth(depth) {
    this.depth = Math.max(0, Math.min(1, depth));
    const freqRange = this.freqMax - this.freqMin;
    this.lfoGain.gain.setValueAtTime((freqRange * this.depth) / 2, this.context.currentTime);
  }
  
  setFeedback(feedback) {
    this.feedback = Math.max(0, Math.min(0.95, feedback));
    this.feedbackGain.gain.setValueAtTime(this.feedback, this.context.currentTime);
  }
  
  setStages(stageCount) {
    this.createAllPassStages(stageCount);
    this.setupLFO(); // Reconnect LFO after recreating stages
  }
  
  setWetMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
    this.wetMix = wet;
  }
  
  setFrequencyRange(minFreq, maxFreq) {
    this.freqMin = Math.max(20, Math.min(20000, minFreq));
    this.freqMax = Math.max(this.freqMin + 100, Math.min(20000, maxFreq));
    
    // Update all-pass filter frequencies
    this.allPassFilters.forEach((allPass, i) => {
      const freq = this.freqMin + (i / (this.stages - 1)) * (this.freqMax - this.freqMin);
      allPass.setFrequency(freq);
    });
    
    // Update LFO range
    const freqRange = this.freqMax - this.freqMin;
    this.lfoGain.gain.setValueAtTime((freqRange * this.depth) / 2, this.context.currentTime);
    this.lfoOffset.offset.setValueAtTime(this.freqMin + (freqRange / 2), this.context.currentTime);
  }
  
  setResonance(resonance) {
    this.resonance = Math.max(0.1, Math.min(10, resonance));
    this.allPassFilters.forEach(allPass => {
      allPass.setQ(this.resonance);
    });
  }
  
  setWaveform(waveform) {
    this.waveform = waveform;
    this.lfo.type = waveform === 'random' ? 'square' : waveform;
  }
  
  setStereoPhase(phase) {
    this.stereoPhase = Math.max(0, Math.min(180, phase));
    // Implementation would involve phase offset between L/R channels
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
  
  cleanup() {
    this.allPassFilters.forEach(allPass => {
      allPass.disconnect();
    });
    this.allPassFilters = [];
  }
}

/**
 * Process phaser on an audio buffer region
 * Pure function for offline processing
 */
export async function processPhaserRegion(audioBuffer, startSample, endSample, parameters) {
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
  
  // Create phaser processor
  const phaser = new PhaserProcessor(offlineContext);
  phaser.setRate(parameters.rate || 0.5);
  phaser.setDepth(parameters.depth || 0.7);
  phaser.setFeedback(parameters.feedback || 0.5);
  phaser.setStages(parameters.stages || 4);
  phaser.setWetMix(parameters.wetMix || 0.5);
  phaser.setFrequencyRange(
    parameters.freqRange?.[0] || 200,
    parameters.freqRange?.[1] || 2000
  );
  phaser.setResonance(parameters.resonance || 0.7);
  phaser.setWaveform(parameters.waveform || 'sine');
  phaser.setStereoPhase(parameters.stereoPhase || 90);
  phaser.setOutputGain(parameters.outputGain || 1.0);
  
  // Connect and render
  source.connect(phaser.input);
  phaser.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  const renderedBuffer = await offlineContext.startRendering();

  // Return the processed region buffer directly
  return renderedBuffer;
}

/**
 * Professional Multi-Stage Phaser Effect
 * Features: Multiple all-pass stages, LFO modulation, feedback control
 */
export default function Phaser({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    phaserRate,
    setPhaserRate,
    phaserDepth,
    setPhaserDepth,
    phaserFeedback,
    setPhaserFeedback,
    phaserStages,
    setPhaserStages,
    phaserWetMix,
    setPhaserWetMix,
    phaserTempoSync,
    setPhaserTempoSync,
    phaserNoteDivision,
    setPhaserNoteDivision,
    phaserWaveform,
    setPhaserWaveform,
    phaserFreqRange,
    setPhaserFreqRange,
    phaserResonance,
    setPhaserResonance,
    phaserStereoPhase,
    setPhaserStereoPhase,
    phaserOutputGain,
    setPhaserOutputGain,
    globalBPM
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const phaserProcessorRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Initialize audio context and phaser processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!phaserProcessorRef.current) {
      phaserProcessorRef.current = new PhaserProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update phaser parameters
  useEffect(() => {
    if (phaserProcessorRef.current) {
      const effectiveRate = phaserTempoSync 
        ? (globalBPM / 60) / (phaserNoteDivision / 4) 
        : phaserRate;
        
      phaserProcessorRef.current.setRate(effectiveRate);
      phaserProcessorRef.current.setDepth(phaserDepth);
      phaserProcessorRef.current.setFeedback(phaserFeedback);
      phaserProcessorRef.current.setStages(phaserStages);
      phaserProcessorRef.current.setWetMix(phaserWetMix);
      phaserProcessorRef.current.setFrequencyRange(phaserFreqRange[0], phaserFreqRange[1]);
      phaserProcessorRef.current.setResonance(phaserResonance);
      phaserProcessorRef.current.setWaveform(phaserWaveform);
      phaserProcessorRef.current.setStereoPhase(phaserStereoPhase);
      phaserProcessorRef.current.setOutputGain(phaserOutputGain);
    }
  }, [phaserRate, phaserDepth, phaserFeedback, phaserStages, phaserWetMix,
      phaserFreqRange, phaserResonance, phaserWaveform, phaserStereoPhase,
      phaserOutputGain, phaserTempoSync, phaserNoteDivision, globalBPM]);
  
  // Draw frequency sweep visualization
  const drawFrequencySweep = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw frequency range indicator
    ctx.fillStyle = 'rgba(123, 175, 212, 0.2)';
    const minFreqX = (Math.log10(phaserFreqRange[0]) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
    const maxFreqX = (Math.log10(phaserFreqRange[1]) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
    ctx.fillRect(minFreqX, 0, maxFreqX - minFreqX, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const freqs = [20, 100, 1000, 10000, 20000];
    freqs.forEach(freq => {
      const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    
    // Draw LFO sweep visualization
    ctx.strokeStyle = '#92ce84';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const effectiveRate = phaserTempoSync 
      ? (globalBPM / 60) / (phaserNoteDivision / 4) 
      : phaserRate;
    
    for (let x = 0; x < width; x++) {
      const phase = (x / width) * 4 * Math.PI; // 2 cycles
      let lfoValue;
      
      switch (phaserWaveform) {
        case 'sine':
          lfoValue = Math.sin(phase);
          break;
        case 'triangle':
          lfoValue = (2 / Math.PI) * Math.asin(Math.sin(phase));
          break;
        case 'sawtooth':
          lfoValue = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
          break;
        case 'square':
          lfoValue = Math.sign(Math.sin(phase));
          break;
        case 'random':
          lfoValue = (Math.random() * 2 - 1);
          break;
        default:
          lfoValue = Math.sin(phase);
      }
      
      // Map LFO to frequency range
      const centerFreq = (phaserFreqRange[0] + phaserFreqRange[1]) / 2;
      const freqRange = phaserFreqRange[1] - phaserFreqRange[0];
      const currentFreq = centerFreq + (lfoValue * phaserDepth * freqRange / 2);
      
      // Convert to canvas position
      const freqX = (Math.log10(Math.max(20, currentFreq)) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      const y = height/2 + (lfoValue * phaserDepth * height/4);
      
      if (x === 0) {
        ctx.moveTo(freqX, y);
      } else {
        ctx.lineTo(freqX, y);
      }
    }
    
    ctx.stroke();
    
    // Draw stage indicators
    for (let i = 0; i < phaserStages; i++) {
      const stageFreq = phaserFreqRange[0] + (i / (phaserStages - 1)) * (phaserFreqRange[1] - phaserFreqRange[0]);
      const stageX = (Math.log10(stageFreq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      
      ctx.fillStyle = '#e75b5c';
      ctx.beginPath();
      ctx.arc(stageX, height - 20, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw labels
    ctx.fillStyle = '#92ce84';
    ctx.font = '12px monospace';
    ctx.fillText(`Rate: ${effectiveRate.toFixed(2)}Hz`, 10, 20);
    ctx.fillText(`Stages: ${phaserStages}`, 10, 35);
    ctx.fillText(`${phaserFreqRange[0]}-${phaserFreqRange[1]}Hz`, 10, 50);
  }, [phaserRate, phaserDepth, phaserStages, phaserWaveform, phaserFreqRange,
      phaserTempoSync, phaserNoteDivision, globalBPM]);
  
  // Update visualization
  useEffect(() => {
    drawFrequencySweep();
  }, [drawFrequencySweep]);
  
  // Apply phaser to selected region
  const effectiveRate = phaserTempoSync
    ? (globalBPM / 60) / (phaserNoteDivision / 4)
    : phaserRate;

  const applyPhaser = useCallback(
    createEffectApplyFunction(processPhaserRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        rate: effectiveRate,
        depth: phaserDepth,
        feedback: phaserFeedback,
        stages: phaserStages,
        wetMix: phaserWetMix,
        freqRange: phaserFreqRange,
        resonance: phaserResonance,
        waveform: phaserWaveform,
        stereoPhase: phaserStereoPhase,
        outputGain: phaserOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, effectiveRate, phaserDepth, phaserFeedback, phaserStages, phaserWetMix, phaserFreqRange, phaserResonance, phaserWaveform, phaserStereoPhase, phaserOutputGain, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* Frequency Sweep Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              style={{ width: '100%', height: '150px' }}
            />
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">Frequency Sweep</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Main Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.rate}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserRate}
                onChange={setPhaserRate}
                min={0.01}
                max={10}
                step={0.01}
                label="Rate"
                displayValue={phaserTempoSync ? `1/${phaserNoteDivision}` : `${phaserRate.toFixed(2)}Hz`}
                size={50}
                color="#92ce84"
                disabled={phaserTempoSync}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.depth}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserDepth}
                onChange={setPhaserDepth}
                min={0}
                max={1}
                step={0.01}
                label="Depth"
                displayValue={`${Math.round(phaserDepth * 100)}%`}
                size={50}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserFeedback}
                onChange={setPhaserFeedback}
                min={0}
                max={0.95}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(phaserFeedback * 100)}%`}
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
            overlay={<Tooltip>{PhaserTooltips.stages}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserStages}
                onChange={setPhaserStages}
                min={2}
                max={12}
                step={1}
                label="Stages"
                displayValue={phaserStages.toString()}
                size={50}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserWetMix}
                onChange={setPhaserWetMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(phaserWetMix * 100)}%`}
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
            overlay={<Tooltip>{PhaserTooltips.resonance}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserResonance}
                onChange={setPhaserResonance}
                min={0.1}
                max={10}
                step={0.1}
                label="Resonance"
                displayValue={phaserResonance.toFixed(1)}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
      
      {/* Frequency Range Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.freqRange}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserFreqRange[0]}
                onChange={(value) => setPhaserFreqRange([value, phaserFreqRange[1]])}
                min={20}
                max={2000}
                step={10}
                label="Min Freq"
                displayValue={`${phaserFreqRange[0]}Hz`}
                size={45}
                color="#ffa500"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.freqRange}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserFreqRange[1]}
                onChange={(value) => setPhaserFreqRange([phaserFreqRange[0], value])}
                min={200}
                max={20000}
                step={50}
                label="Max Freq"
                displayValue={phaserFreqRange[1] >= 1000 ? `${(phaserFreqRange[1]/1000).toFixed(1)}k` : `${phaserFreqRange[1]}Hz`}
                size={45}
                color="#ff6b6b"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.waveform}</Tooltip>}
          >
            <Form.Select
              size="sm"
              value={phaserWaveform}
              onChange={(e) => setPhaserWaveform(e.target.value)}
              className="bg-secondary text-white border-0"
            >
              {Object.entries(LFOWaveforms).map(([key, wave]) => (
                <option key={key} value={key}>{wave.name}</option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.tempoSync}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="phaser-tempo-sync"
                label="Tempo Sync"
                checked={phaserTempoSync}
                onChange={(e) => setPhaserTempoSync(e.target.checked)}
                className="text-white"
              />
              {phaserTempoSync && (
                <Form.Select
                  size="sm"
                  value={phaserNoteDivision}
                  onChange={(e) => setPhaserNoteDivision(parseInt(e.target.value))}
                  className="bg-secondary text-white border-0 mt-1"
                >
                  <option value={1}>1/1</option>
                  <option value={2}>1/2</option>
                  <option value={4}>1/4</option>
                  <option value={8}>1/8</option>
                  <option value={16}>1/16</option>
                </Form.Select>
              )}
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{PhaserTooltips.stereoPhase}</Tooltip>}
          >
            <div>
              <Knob
                value={phaserStereoPhase}
                onChange={setPhaserStereoPhase}
                min={0}
                max={180}
                step={1}
                label="Stereo°"
                displayValue={`${phaserStereoPhase}°`}
                size={45}
                color="#9370db"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={phaserOutputGain}
            onChange={setPhaserOutputGain}
            min={0}
            max={2}
            step={0.01}
            label="Output"
            displayValue={`${phaserOutputGain.toFixed(2)}x`}
            size={45}
            color="#92ceaa"
          />
        </Col>
      </Row>
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyPhaser}
          >
            Apply Phaser to Region
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