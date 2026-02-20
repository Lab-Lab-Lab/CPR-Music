'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const AdvancedDelayTooltips = {
  time: "Time between delays. Shorter times (50-200ms) create doubling effects, longer times (300-600ms+) create rhythmic echoes. Use tempo sync to lock to musical timing.",
  feedback: "How much of the delayed signal feeds back into itself. Higher values create more repetitions. Values over 70% can build up quickly.",
  taps: "Number of delay repetitions. Each tap creates a separate delay line with its own timing. More taps create denser, more complex patterns.",
  spread: "Distributes multiple taps across time. 0% places all taps at the same time, 100% spreads them evenly for rhythmic patterns.",
  mix: "Balance between dry (original) and wet (delayed) signal. 50% is equal mix, higher values emphasize the delay effect.",
  modRate: "Speed of delay time modulation. Creates chorus-like movement in the delays. Subtle rates (0.1-2Hz) add analog warmth.",
  modDepth: "Amount of delay time variation. Higher values create more pitch wobble and vintage tape-like character. Use sparingly (5-20%) for natural results.",
  filterFreq: "Cutoff frequency for filtering each delay tap. Lowpass removes highs for darker echoes, highpass removes lows for brighter repeats.",
  saturation: "Adds harmonic distortion to delays. Mimics analog tape saturation. Use subtle amounts (10-30%) for warmth, higher for creative effects.",
  diffusion: "Blurs delay taps together for smoother, more ambient sound. Higher values create reverb-like textures from the delays.",
  stereoWidth: "Controls stereo spread. 100% is normal stereo, 200% creates enhanced width. Lower values narrow the stereo image.",
  pingPong: "Alternates delay taps between left and right channels, creating a bouncing stereo effect. Great for wide, rhythmic patterns.",
  tempoSync: "Locks delay time to project tempo using musical note values (quarter notes, eighth notes, etc.) instead of milliseconds.",
  filterType: "Shape of the filter applied to delays. Lowpass darkens, highpass brightens, bandpass focuses on midrange, notch creates hollow sound."
};

/**
 * Professional Multi-Tap Delay Processor
 * Features: Multiple taps, modulation, diffusion, saturation, filtering
 */
class AdvancedDelayProcessor {
  constructor(audioContext, maxDelayTime = 2.0) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    this.maxDelayTime = maxDelayTime;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Multi-tap delay lines
    this.delayTaps = [];
    this.tapGains = [];
    this.tapFilters = [];
    this.tapSaturators = [];
    
    // LFO for modulation
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    
    // Diffusion for spacious sound
    this.diffusionDelays = [];
    this.diffusionGains = [];
    
    // Stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.leftProcessor = audioContext.createGain();
    this.rightProcessor = audioContext.createGain();
    
    // Parameters
    this.baseDelayTime = 0.5; // seconds
    this.feedback = 0.5;
    this.wetMix = 0.5;
    this.taps = 3;
    this.spread = 0.3;
    this.modRate = 0.5;
    this.modDepth = 0.1;
    this.modWaveform = 'sine';
    this.saturation = 0;
    this.diffusion = 0.3;
    this.stereoWidth = 1.0;
    this.outputGain = 1.0;
    this.pingPong = false;
    this.filterType = 'lowpass';
    this.filterFreq = 2000;
    this.lfoStarted = false;  // Track whether LFO has been started

    this.setupDelayTaps(this.taps);
    this.setupDiffusion();
    this.setupLFO();
    this.setupRouting();
  }
  
  setupDelayTaps(numTaps) {
    // Clean up existing taps
    this.delayTaps.forEach(tap => tap.disconnect());
    this.tapGains.forEach(gain => gain.disconnect());
    this.tapFilters.forEach(filter => filter.disconnect());
    this.tapSaturators.forEach(saturator => saturator.disconnect());
    
    this.delayTaps = [];
    this.tapGains = [];
    this.tapFilters = [];
    this.tapSaturators = [];
    
    // Create new taps
    for (let i = 0; i < numTaps; i++) {
      // Delay line
      const delay = this.context.createDelay(this.maxDelayTime);
      
      // Gain for tap level
      const gain = this.context.createGain();
      gain.gain.value = 1.0 / numTaps; // Normalize gain
      
      // Filter for each tap
      const filter = this.context.createBiquadFilter();
      filter.type = this.filterType;
      filter.frequency.value = this.filterFreq;
      filter.Q.value = 1;
      
      // Saturation (using WaveShaper)
      const saturator = this.context.createWaveShaper();
      saturator.curve = this.createSaturationCurve();
      saturator.oversample = '2x';
      
      this.delayTaps.push(delay);
      this.tapGains.push(gain);
      this.tapFilters.push(filter);
      this.tapSaturators.push(saturator);
    }
    
    this.updateTapTimes();
    this.connectTaps();
  }
  
  updateTapTimes() {
    for (let i = 0; i < this.delayTaps.length; i++) {
      const tapIndex = i + 1;
      let tapTime;
      
      if (this.spread === 0) {
        // All taps at same time
        tapTime = this.baseDelayTime;
      } else {
        // Spread taps across time
        const spreadRange = this.baseDelayTime * this.spread;
        tapTime = this.baseDelayTime + (tapIndex - 1) * (spreadRange / (this.delayTaps.length - 1 || 1));
      }
      
      this.delayTaps[i].delayTime.setValueAtTime(
        Math.max(0.001, Math.min(this.maxDelayTime, tapTime)),
        this.context.currentTime
      );
    }
  }
  
  connectTaps() {
    // Connect each tap in series with processing
    for (let i = 0; i < this.delayTaps.length; i++) {
      const delay = this.delayTaps[i];
      const gain = this.tapGains[i];
      const filter = this.tapFilters[i];
      const saturator = this.tapSaturators[i];
      
      // Connect: input -> delay -> filter -> saturator -> gain -> output
      delay.connect(filter);
      filter.connect(saturator);
      saturator.connect(gain);
      gain.connect(this.wetGain);
      
      // Connect modulation to delay time
      this.lfoGain.connect(delay.delayTime);
    }
  }
  
  setupDiffusion() {
    // Create multiple short delays for diffusion
    const diffusionTaps = 4;
    const diffusionTimes = [0.0051, 0.0071, 0.0131, 0.0191]; // Prime-based delays
    
    for (let i = 0; i < diffusionTaps; i++) {
      const delay = this.context.createDelay(0.1);
      delay.delayTime.value = diffusionTimes[i];
      
      const gain = this.context.createGain();
      gain.gain.value = 0.7;
      
      delay.connect(gain);
      
      this.diffusionDelays.push(delay);
      this.diffusionGains.push(gain);
    }
  }
  
  setupLFO() {
    this.lfo.type = this.modWaveform;
    this.lfo.frequency.value = this.modRate;
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;

    this.lfo.connect(this.lfoGain);

    // Start LFO only if not already started
    if (!this.lfoStarted) {
      this.lfo.start();
      this.lfoStarted = true;
    }
  }
  
  setupRouting() {
    // Input splitting
    this.input.connect(this.splitter);
    this.input.connect(this.dryGain);
    
    // Dry path
    this.dryGain.connect(this.output);
    
    // Basic wet connection (will be enhanced with diffusion and feedback)
    this.wetGain.connect(this.output);
    
    // Set initial mix
    this.setWetMix(this.wetMix);
  }
  
  createSaturationCurve() {
    const samples = 44100;
    const curve = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1
      
      if (this.saturation === 0) {
        curve[i] = x;
      } else {
        // Soft saturation using tanh
        const drive = 1 + this.saturation * 5;
        curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
      }
    }
    
    return curve;
  }
  
  updateSaturation() {
    const newCurve = this.createSaturationCurve();
    this.tapSaturators.forEach(saturator => {
      saturator.curve = newCurve;
    });
  }
  
  // Process audio with feedback and diffusion
  processAudioWithFeedback(inputNode) {
    // Create feedback path
    const feedbackGain = this.context.createGain();
    feedbackGain.gain.value = this.feedback;
    
    // Input -> taps
    for (let i = 0; i < this.delayTaps.length; i++) {
      if (this.pingPong && i % 2 === 1) {
        // Ping-pong: alternate taps go to opposite channels
        this.splitter.connect(this.delayTaps[i], 1);
      } else {
        this.splitter.connect(this.delayTaps[i], 0);
      }
      
      // Add feedback
      feedbackGain.connect(this.delayTaps[i]);
    }
    
    // Apply diffusion if enabled
    if (this.diffusion > 0) {
      this.applyDiffusion();
    }
    
    // Feedback connection
    this.wetGain.connect(feedbackGain);
  }
  
  applyDiffusion() {
    // Route through diffusion network
    for (let i = 0; i < this.diffusionDelays.length; i++) {
      const delay = this.diffusionDelays[i];
      const gain = this.diffusionGains[i];
      
      // Adjust diffusion gain based on diffusion parameter
      gain.gain.value = 0.7 * this.diffusion;
      
      // Connect input to diffusion delays
      this.input.connect(delay);
      gain.connect(this.wetGain);
    }
  }
  
  // Parameter setters
  setDelayTime(time) {
    this.baseDelayTime = Math.max(0.001, Math.min(this.maxDelayTime, time / 1000));
    this.updateTapTimes();
    
    // Update LFO modulation depth based on delay time
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;
  }
  
  setFeedback(feedback) {
    this.feedback = Math.max(0, Math.min(0.95, feedback));
  }
  
  setWetMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
    this.wetMix = wet;
  }
  
  setTaps(taps) {
    this.taps = Math.max(1, Math.min(8, taps));
    this.setupDelayTaps(this.taps);
  }
  
  setSpread(spread) {
    this.spread = Math.max(0, Math.min(1, spread));
    this.updateTapTimes();
  }
  
  setModulation(rate, depth, waveform) {
    this.modRate = Math.max(0.1, Math.min(10, rate));
    this.modDepth = Math.max(0, Math.min(1, depth));
    this.modWaveform = waveform;
    
    this.lfo.frequency.setValueAtTime(this.modRate, this.context.currentTime);
    this.lfo.type = this.modWaveform;
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;
  }
  
  setSaturation(saturation) {
    this.saturation = Math.max(0, Math.min(1, saturation));
    this.updateSaturation();
  }
  
  setDiffusion(diffusion) {
    this.diffusion = Math.max(0, Math.min(1, diffusion));
    
    // Update diffusion gains
    this.diffusionGains.forEach(gain => {
      gain.gain.value = 0.7 * this.diffusion;
    });
  }
  
  setFilter(type, frequency) {
    this.filterType = type;
    this.filterFreq = Math.max(20, Math.min(20000, frequency));
    
    this.tapFilters.forEach(filter => {
      filter.type = this.filterType;
      filter.frequency.setValueAtTime(this.filterFreq, this.context.currentTime);
    });
  }
  
  setStereoWidth(width) {
    this.stereoWidth = Math.max(0, Math.min(2, width));
  }
  
  setPingPong(pingPong) {
    this.pingPong = pingPong;
    // Reconnect taps for ping-pong mode
    this.connectTaps();
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
 * Process advanced multi-tap delay on an audio buffer region
 */
export async function processAdvancedDelayRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Calculate processing time with delay tails
  const maxDelayTime = (parameters.time || 500) / 1000;
  const delayTailSamples = Math.floor(maxDelayTime * sampleRate * 3); // 3x for reverb tail
  
  // Create offline context with region length only (delay tails are built in)
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create delay processor
  const delayProcessor = new AdvancedDelayProcessor(offlineContext);
  delayProcessor.setDelayTime(parameters.time || 500);
  delayProcessor.setFeedback(parameters.feedback || 0.5);
  delayProcessor.setWetMix(parameters.mix || 0.5);
  delayProcessor.setTaps(parameters.taps || 3);
  delayProcessor.setSpread(parameters.spread || 0.3);
  delayProcessor.setModulation(
    parameters.modRate || 0.5,
    parameters.modDepth || 0.1,
    parameters.modWaveform || 'sine'
  );
  delayProcessor.setSaturation(parameters.saturation || 0);
  delayProcessor.setDiffusion(parameters.diffusion || 0.3);
  delayProcessor.setFilter(parameters.filterType || 'lowpass', parameters.filterFreq || 2000);
  delayProcessor.setStereoWidth(parameters.stereoWidth || 1.0);
  delayProcessor.setPingPong(parameters.pingPong || false);
  delayProcessor.setOutputGain(parameters.outputGain || 1.0);

  // Connect and process
  source.connect(delayProcessor.input);
  delayProcessor.processAudioWithFeedback(source);
  delayProcessor.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  const renderedBuffer = await offlineContext.startRendering();

  // Extract just the region length from rendered buffer (delay tails included)
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const processedData = renderedBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy processed data (delay tails are naturally included)
    const copyLength = Math.min(regionLength, processedData.length);
    for (let i = 0; i < copyLength; i++) {
      outputData[i] = processedData[i];
    }
  }

  return outputBuffer;
}

/**
 * Professional Advanced Multi-Tap Delay Effect
 * Features: Multi-tap, modulation, diffusion, saturation, filtering
 */
export default function AdvancedDelay({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    globalBPM,
    advDelayTime,
    setAdvDelayTime,
    advDelayFeedback,
    setAdvDelayFeedback,
    advDelayMix,
    setAdvDelayMix,
    advDelayPingPong,
    setAdvDelayPingPong,
    advDelayFilterFreq,
    setAdvDelayFilterFreq,
    advDelayFilterType,
    setAdvDelayFilterType,
    advDelayTempoSync,
    setAdvDelayTempoSync,
    advDelayNoteDivision,
    setAdvDelayNoteDivision,
    advDelayTaps,
    setAdvDelayTaps,
    advDelaySpread,
    setAdvDelaySpread,
    advDelayModRate,
    setAdvDelayModRate,
    advDelayModDepth,
    setAdvDelayModDepth,
    advDelayModWaveform,
    setAdvDelayModWaveform,
    advDelaySaturation,
    setAdvDelaySaturation,
    advDelayDiffusion,
    setAdvDelayDiffusion,
    advDelayStereoWidth,
    setAdvDelayStereoWidth,
    advDelayOutputGain,
    setAdvDelayOutputGain
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
      processorRef.current = new AdvancedDelayProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setDelayTime(getEffectiveDelayTime());
      processorRef.current.setFeedback(advDelayFeedback);
      processorRef.current.setWetMix(advDelayMix);
      processorRef.current.setTaps(advDelayTaps);
      processorRef.current.setSpread(advDelaySpread);
      processorRef.current.setModulation(advDelayModRate, advDelayModDepth, advDelayModWaveform);
      processorRef.current.setSaturation(advDelaySaturation);
      processorRef.current.setDiffusion(advDelayDiffusion);
      processorRef.current.setFilter(advDelayFilterType, advDelayFilterFreq);
      processorRef.current.setStereoWidth(advDelayStereoWidth);
      processorRef.current.setPingPong(advDelayPingPong);
      processorRef.current.setOutputGain(advDelayOutputGain);
    }
  }, [advDelayTime, advDelayFeedback, advDelayMix, advDelayTaps, advDelaySpread,
      advDelayModRate, advDelayModDepth, advDelayModWaveform, advDelaySaturation,
      advDelayDiffusion, advDelayFilterType, advDelayFilterFreq, advDelayStereoWidth,
      advDelayPingPong, advDelayOutputGain, advDelayTempoSync, advDelayNoteDivision, globalBPM]);
  
  // Calculate tempo-synced delay time
  const getEffectiveDelayTime = () => {
    if (advDelayTempoSync) {
      const beatDurationMs = (60 / globalBPM) * 1000;
      return beatDurationMs * (4 / advDelayNoteDivision);
    }
    return advDelayTime;
  };
  
  // Draw delay visualization
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
    
    const delayTime = getEffectiveDelayTime();
    const maxTime = 2000; // ms
    
    // Draw delay taps
    for (let i = 0; i < advDelayTaps; i++) {
      const tapIndex = i + 1;
      let tapTime;
      
      if (advDelaySpread === 0) {
        tapTime = delayTime;
      } else {
        const spreadRange = delayTime * advDelaySpread;
        tapTime = delayTime + (tapIndex - 1) * (spreadRange / (advDelayTaps - 1 || 1));
      }
      
      const x = (tapTime / maxTime) * width;
      const tapHeight = (1 - (i / advDelayTaps)) * height * 0.8;
      
      // Draw tap line
      ctx.strokeStyle = advDelayPingPong && i % 2 === 1 ? '#7bafd4' : '#e75b5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x, height - tapHeight);
      ctx.stroke();
      
      // Draw tap number
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`${i + 1}`, x - 5, height - tapHeight - 5);
    }
    
    // Draw modulation wave
    if (advDelayModDepth > 0) {
      ctx.strokeStyle = '#cbb677';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * 4 * Math.PI; // 2 cycles
        let y;
        
        switch (advDelayModWaveform) {
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
        
        y = (height / 2) + (y * advDelayModDepth * height / 6);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Time: ${delayTime.toFixed(0)}ms`, 10, 20);
    ctx.fillText(`Taps: ${advDelayTaps}`, 10, 35);
    
    if (advDelayTempoSync) {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText('SYNC', 10, 50);
    }
    
    if (advDelayPingPong) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText('PING-PONG', 10, height - 25);
    }
    
    if (advDelayModDepth > 0) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText(`Mod: ${advDelayModRate.toFixed(1)}Hz`, 10, height - 10);
    }
    
  }, [advDelayTime, advDelayTaps, advDelaySpread, advDelayPingPong, advDelayModRate,
      advDelayModDepth, advDelayModWaveform, advDelayTempoSync, advDelayNoteDivision, globalBPM]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
  // Apply advanced delay to selected region
  const applyAdvancedDelay = useCallback(
    createEffectApplyFunction(processAdvancedDelayRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        time: getEffectiveDelayTime(),
        feedback: advDelayFeedback,
        mix: advDelayMix,
        taps: advDelayTaps,
        spread: advDelaySpread,
        modRate: advDelayModRate,
        modDepth: advDelayModDepth,
        modWaveform: advDelayModWaveform,
        saturation: advDelaySaturation,
        diffusion: advDelayDiffusion,
        filterType: advDelayFilterType,
        filterFreq: advDelayFilterFreq,
        stereoWidth: advDelayStereoWidth,
        pingPong: advDelayPingPong,
        outputGain: advDelayOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, advDelayTime, advDelayFeedback,
      advDelayMix, advDelayTaps, advDelaySpread, advDelayModRate, advDelayModDepth,
      advDelayModWaveform, advDelaySaturation, advDelayDiffusion, advDelayFilterType,
      advDelayFilterFreq, advDelayStereoWidth, advDelayPingPong, advDelayOutputGain,
      advDelayTempoSync, advDelayNoteDivision, globalBPM, onApply]
  );
  
  const filterTypes = [
    { key: 'lowpass', name: 'Low Pass' },
    { key: 'highpass', name: 'High Pass' },
    { key: 'bandpass', name: 'Band Pass' },
    { key: 'allpass', name: 'All Pass' },
    { key: 'notch', name: 'Notch' }
  ];
  
  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' }
  ];
  
  const noteValues = [
    { key: 1, name: 'Whole', symbol: '𝅝' },
    { key: 2, name: 'Half', symbol: '𝅗𝅥' },
    { key: 4, name: 'Quarter', symbol: '♩' },
    { key: 8, name: 'Eighth', symbol: '♫' },
    { key: 16, name: 'Sixteenth', symbol: '♬' }
  ];
  
  return (
    <Container fluid className="p-2">
      {/* Delay Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              style={{ width: '100%', height: '120px' }}
            />
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">Multi-Tap Delay Pattern</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Mode and Settings */}
      <Row className="mb-2">
        <Col xs={12} md={3}>
          <Form.Label className="text-white small">Filter Type</Form.Label>
          <Form.Select
            value={advDelayFilterType}
            onChange={(e) => setAdvDelayFilterType(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {filterTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </Form.Select>
        </Col>
        
        <Col xs={12} md={3}>
          <Form.Label className="text-white small">Mod Waveform</Form.Label>
          <Form.Select
            value={advDelayModWaveform}
            onChange={(e) => setAdvDelayModWaveform(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {waveformTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </Form.Select>
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="ping-pong"
            label="Ping-Pong"
            checked={advDelayPingPong}
            onChange={(e) => setAdvDelayPingPong(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="tempo-sync"
            label="Tempo Sync"
            checked={advDelayTempoSync}
            onChange={(e) => setAdvDelayTempoSync(e.target.checked)}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.time}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayTempoSync ? advDelayNoteDivision : advDelayTime}
                onChange={advDelayTempoSync ? setAdvDelayNoteDivision : setAdvDelayTime}
                min={advDelayTempoSync ? 1 : 1}
                max={advDelayTempoSync ? 16 : 2000}
                step={advDelayTempoSync ? 1 : 1}
                label="Time"
                displayValue={advDelayTempoSync ?
                  noteValues.find(n => n.key === advDelayNoteDivision)?.symbol || `1/${advDelayNoteDivision}` :
                  `${advDelayTime}ms`}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayFeedback}
                onChange={setAdvDelayFeedback}
                min={0}
                max={0.95}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(advDelayFeedback * 100)}%`}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.taps}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayTaps}
                onChange={setAdvDelayTaps}
                min={1}
                max={8}
                step={1}
                label="Taps"
                displayValue={`${advDelayTaps}`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AdvancedDelayTooltips.spread}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelaySpread}
                onChange={setAdvDelaySpread}
                min={0}
                max={1}
                step={0.01}
                label="Spread"
                displayValue={`${Math.round(advDelaySpread * 100)}%`}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayMix}
                onChange={setAdvDelayMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(advDelayMix * 100)}%`}
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
            overlay={<Tooltip>Overall output level. Values above 1.0x boost the delayed signal. Use with caution to avoid clipping.</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayOutputGain}
                onChange={setAdvDelayOutputGain}
                min={0}
                max={2}
                step={0.01}
                label="Output"
                displayValue={`${advDelayOutputGain.toFixed(2)}x`}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.modRate}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayModRate}
                onChange={setAdvDelayModRate}
                min={0.1}
                max={10}
                step={0.1}
                label="Mod Rate"
                displayValue={`${advDelayModRate.toFixed(1)}Hz`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AdvancedDelayTooltips.modDepth}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayModDepth}
                onChange={setAdvDelayModDepth}
                min={0}
                max={1}
                step={0.01}
                label="Mod Depth"
                displayValue={`${Math.round(advDelayModDepth * 100)}%`}
                size={45}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AdvancedDelayTooltips.filterFreq}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayFilterFreq}
                onChange={setAdvDelayFilterFreq}
                min={20}
                max={20000}
                step={10}
                label="Filter Freq"
                displayValue={advDelayFilterFreq >= 1000 ? `${(advDelayFilterFreq/1000).toFixed(1)}k` : `${advDelayFilterFreq}Hz`}
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
            overlay={<Tooltip>{AdvancedDelayTooltips.saturation}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelaySaturation}
                onChange={setAdvDelaySaturation}
                min={0}
                max={1}
                step={0.01}
                label="Saturation"
                displayValue={`${Math.round(advDelaySaturation * 100)}%`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AdvancedDelayTooltips.diffusion}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayDiffusion}
                onChange={setAdvDelayDiffusion}
                min={0}
                max={1}
                step={0.01}
                label="Diffusion"
                displayValue={`${Math.round(advDelayDiffusion * 100)}%`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AdvancedDelayTooltips.stereoWidth}</Tooltip>}
          >
            <div>
              <Knob
                value={advDelayStereoWidth}
                onChange={setAdvDelayStereoWidth}
                min={0}
                max={2}
                step={0.01}
                label="Stereo Width"
                displayValue={`${advDelayStereoWidth.toFixed(2)}x`}
                size={45}
                color="#dda0dd"
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
            onClick={applyAdvancedDelay}
          >
            Apply Advanced Delay to Region
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