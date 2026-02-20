'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const ChorusTooltips = {
  rate: "Speed of the modulation. Slower rates (0.1-1Hz) create gentle swirling, faster rates (2-5Hz) create more vibrato-like effects.",
  depth: "Amount of pitch/time variation. Higher values create richer chorus but too much (>80%) can sound artificial. Sweet spot is 40-70%.",
  delay: "Base delay time for chorus effect. 10-20ms creates doubling, 20-40ms creates classic chorus. Longer delays create more obvious separation.",
  feedback: "Routes output back to input. Adds resonance and metallic character. Use sparingly (10-30%) as high values can cause buildup.",
  mix: "Balance between dry and wet signal. 50% is traditional chorus, 30-40% is subtle, 60-80% is lush and obvious.",
  voices: "Number of delay lines. More voices (4-8) create thicker, richer chorus. 2-3 voices sound natural, 1 voice is simple doubling.",
  width: "Stereo spread of chorus effect. 100% is normal stereo, higher values create enhanced width. Great for pads and synths.",
  waveform: "Shape of modulation. Sine is smooth and natural, triangle is linear, square is abrupt, random adds shimmer and unpredictability.",
  tempoSync: "Locks modulation rate to project tempo using musical note divisions. Great for rhythmic chorus effects that stay in time."
};

/**
 * LFO Waveforms for chorus modulation
 */
const LFOWaveforms = {
  sine: { name: 'Sine', description: 'Smooth sinusoidal modulation' },
  triangle: { name: 'Triangle', description: 'Linear ramp modulation' },
  sawtooth: { name: 'Sawtooth', description: 'Ramp up modulation' },
  square: { name: 'Square', description: 'Hard switching modulation' },
  random: { name: 'Random', description: 'Sample & hold random modulation' }
};

/**
 * Multi-voice Chorus Processor
 * Professional implementation with multiple delay lines and LFO modulation
 */
class ChorusProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.feedback = audioContext.createGain();
    
    // Delay lines for each voice
    this.delayLines = [];
    this.lfoOscillators = [];
    this.lfoGains = [];
    
    // Stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Default settings
    this.rate = 0.5;
    this.depth = 0.7;
    this.baseDelay = 0.01; // 10ms
    this.feedbackAmount = 0.2;
    this.wetMix = 0.5;
    this.voices = 3;
    this.stereoWidth = 1.0;
    this.phaseOffset = 90;
    this.waveform = 'sine';
    
    this.setupRouting();
    this.createVoices(3);
  }
  
  setupRouting() {
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path through delay lines
    this.input.connect(this.splitter);
    
    // Default mix
    this.setWetMix(0.5);
  }
  
  createVoices(voiceCount) {
    // Clean up existing voices
    this.cleanup();
    
    this.delayLines = [];
    this.lfoOscillators = [];
    this.lfoGains = [];
    
    for (let i = 0; i < voiceCount; i++) {
      // Create delay line
      const delay = this.context.createDelay(0.1); // Max 100ms delay
      const delayGain = this.context.createGain();
      
      // Create LFO for this voice
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      const lfoOffset = this.context.createConstantSource();
      
      // Set up LFO
      lfo.type = this.waveform;
      lfo.frequency.value = this.rate;
      lfoGain.gain.value = this.depth * 0.005; // Scale to delay time modulation
      lfoOffset.offset.value = this.baseDelay + (i * 0.002); // Spread voices
      
      // Connect LFO to delay time
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfoOffset.connect(delay.delayTime);
      
      // Set phase offset for each voice
      const phaseOffset = (i / voiceCount) * 2 * Math.PI;
      
      // Connect audio path
      if (i % 2 === 0) {
        // Even voices go to left channel with phase
        this.splitter.connect(delay, 0);
      } else {
        // Odd voices go to right channel with phase offset
        this.splitter.connect(delay, 1);
      }
      
      delay.connect(delayGain);
      delayGain.gain.value = 1 / voiceCount; // Balance voice levels
      
      // Add feedback
      delay.connect(this.feedback);
      this.feedback.connect(delay);
      
      // Connect to wet output
      delayGain.connect(this.wetGain);
      
      // Start oscillators
      lfo.start();
      lfoOffset.start();
      
      this.delayLines.push({ delay, delayGain, lfo, lfoGain, lfoOffset });
    }
    
    // Connect wet gain to output
    this.wetGain.connect(this.output);
    
    // Set feedback amount
    this.feedback.gain.value = this.feedbackAmount;
  }
  
  setRate(rate) {
    this.rate = Math.max(0.01, Math.min(10, rate));
    this.lfoOscillators.forEach(lfo => {
      lfo.frequency.setValueAtTime(this.rate, this.context.currentTime);
    });
  }
  
  setDepth(depth) {
    this.depth = Math.max(0, Math.min(1, depth));
    this.lfoGains.forEach(lfoGain => {
      lfoGain.gain.setValueAtTime(this.depth * 0.005, this.context.currentTime);
    });
  }
  
  setDelay(delayMs) {
    this.baseDelay = Math.max(5, Math.min(50, delayMs)) / 1000;
    // Recreate voices to update base delay
    this.createVoices(this.voices);
  }
  
  setFeedback(feedback) {
    this.feedbackAmount = Math.max(0, Math.min(0.9, feedback));
    this.feedback.gain.setValueAtTime(this.feedbackAmount, this.context.currentTime);
  }
  
  setWetMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
    this.wetMix = wet;
  }
  
  setVoices(voiceCount) {
    this.voices = Math.max(1, Math.min(8, Math.floor(voiceCount)));
    this.createVoices(this.voices);
  }
  
  setStereoWidth(width) {
    this.stereoWidth = Math.max(0, Math.min(2, width));
    // Implementation would involve pan positioning of voices
  }
  
  setWaveform(waveform) {
    this.waveform = waveform;
    this.delayLines.forEach(voice => {
      voice.lfo.type = waveform === 'random' ? 'square' : waveform;
    });
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
    this.delayLines.forEach(voice => {
      voice.lfo.stop();
      voice.lfoOffset.stop();
      voice.delay.disconnect();
      voice.delayGain.disconnect();
      voice.lfo.disconnect();
      voice.lfoGain.disconnect();
      voice.lfoOffset.disconnect();
    });
    this.delayLines = [];
  }
}

/**
 * Process chorus on an audio buffer region
 * Pure function for offline processing
 */
export async function processChorusRegion(audioBuffer, startSample, endSample, parameters) {
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

  // Create chorus processor
  const chorus = new ChorusProcessor(offlineContext);
  chorus.setRate(parameters.rate || 0.5);
  chorus.setDepth(parameters.depth || 0.7);
  chorus.setDelay(parameters.delay || 10);
  chorus.setFeedback(parameters.feedback || 0.2);
  chorus.setWetMix(parameters.wetMix || 0.5);
  chorus.setVoices(parameters.voices || 3);
  chorus.setStereoWidth(parameters.stereoWidth || 1.0);
  chorus.setWaveform(parameters.waveform || 'sine');
  chorus.setOutputGain(parameters.outputGain || 1.0);

  // Connect and render
  source.connect(chorus.input);
  chorus.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  const renderedBuffer = await offlineContext.startRendering();

  // Return processed region directly
  return renderedBuffer;
}

/**
 * Professional Multi-Voice Chorus Effect
 * Features: Multiple delay lines, LFO modulation, stereo processing
 */
export default function Chorus({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    cutRegion,
    chorusRate,
    setChorusRate,
    chorusDepth,
    setChorusDepth,
    chorusDelay,
    setChorusDelay,
    chorusFeedback,
    setChorusFeedback,
    chorusWetMix,
    setChorusWetMix,
    chorusVoices,
    setChorusVoices,
    chorusStereoWidth,
    setChorusStereoWidth,
    chorusPhaseOffset,
    setChorusPhaseOffset,
    chorusTempoSync,
    setChorusTempoSync,
    chorusNoteDivision,
    setChorusNoteDivision,
    chorusWaveform,
    setChorusWaveform,
    chorusOutputGain,
    setChorusOutputGain,
    globalBPM
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const chorusProcessorRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Initialize audio context and chorus processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!chorusProcessorRef.current) {
      chorusProcessorRef.current = new ChorusProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update chorus parameters
  useEffect(() => {
    if (chorusProcessorRef.current) {
      const effectiveRate = chorusTempoSync 
        ? (globalBPM / 60) / (chorusNoteDivision / 4) 
        : chorusRate;
        
      chorusProcessorRef.current.setRate(effectiveRate);
      chorusProcessorRef.current.setDepth(chorusDepth);
      chorusProcessorRef.current.setDelay(chorusDelay);
      chorusProcessorRef.current.setFeedback(chorusFeedback);
      chorusProcessorRef.current.setWetMix(chorusWetMix);
      chorusProcessorRef.current.setVoices(chorusVoices);
      chorusProcessorRef.current.setStereoWidth(chorusStereoWidth);
      chorusProcessorRef.current.setWaveform(chorusWaveform);
      chorusProcessorRef.current.setOutputGain(chorusOutputGain);
    }
  }, [chorusRate, chorusDepth, chorusDelay, chorusFeedback, chorusWetMix, 
      chorusVoices, chorusStereoWidth, chorusWaveform, chorusOutputGain,
      chorusTempoSync, chorusNoteDivision, globalBPM]);
  
  // Draw LFO visualization
  const drawLFOVisualization = useCallback(() => {
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
    ctx.beginPath();
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);
    ctx.stroke();
    
    // Draw LFO waveform
    ctx.strokeStyle = '#92ce84';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const effectiveRate = chorusTempoSync 
      ? (globalBPM / 60) / (chorusNoteDivision / 4) 
      : chorusRate;
    
    for (let x = 0; x < width; x++) {
      const phase = (x / width) * 4 * Math.PI; // 2 cycles
      let y;
      
      switch (chorusWaveform) {
        case 'sine':
          y = Math.sin(phase);
          break;
        case 'triangle':
          y = (2 / Math.PI) * Math.asin(Math.sin(phase));
          break;
        case 'sawtooth':
          y = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
          break;
        case 'square':
          y = Math.sign(Math.sin(phase));
          break;
        case 'random':
          y = (Math.random() * 2 - 1);
          break;
        default:
          y = Math.sin(phase);
      }
      
      y = height/2 + (y * chorusDepth * height/4);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw rate indicator
    ctx.fillStyle = '#92ce84';
    ctx.font = '12px monospace';
    ctx.fillText(`Rate: ${effectiveRate.toFixed(2)}Hz`, 10, 20);
    ctx.fillText(`Depth: ${(chorusDepth * 100).toFixed(0)}%`, 10, 35);
  }, [chorusRate, chorusDepth, chorusWaveform, chorusTempoSync, chorusNoteDivision, globalBPM]);
  
  // Update visualization
  useEffect(() => {
    drawLFOVisualization();
  }, [drawLFOVisualization]);
  
  // Apply chorus to selected region
  const applyChorus = useCallback(
    createEffectApplyFunction(processChorusRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        rate: chorusTempoSync ? (globalBPM / 60) / (chorusNoteDivision / 4) : chorusRate,
        depth: chorusDepth,
        delay: chorusDelay,
        feedback: chorusFeedback,
        wetMix: chorusWetMix,
        voices: chorusVoices,
        stereoWidth: chorusStereoWidth,
        waveform: chorusWaveform,
        outputGain: chorusOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, chorusRate, chorusDepth,
      chorusDelay, chorusFeedback, chorusWetMix, chorusVoices, chorusStereoWidth,
      chorusWaveform, chorusOutputGain, chorusTempoSync, chorusNoteDivision, globalBPM, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      {/* LFO Visualization */}
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
              <small className="text-muted">LFO Waveform</small>
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
            overlay={<Tooltip>{ChorusTooltips.rate}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusRate}
                onChange={setChorusRate}
                min={0.01}
                max={10}
                step={0.01}
                label="Rate"
                displayValue={chorusTempoSync ? `1/${chorusNoteDivision}` : `${chorusRate.toFixed(2)}Hz`}
                size={50}
                color="#92ce84"
                disabled={chorusTempoSync}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ChorusTooltips.depth}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusDepth}
                onChange={setChorusDepth}
                min={0}
                max={1}
                step={0.01}
                label="Depth"
                displayValue={`${Math.round(chorusDepth * 100)}%`}
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
            overlay={<Tooltip>{ChorusTooltips.delay}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusDelay}
                onChange={setChorusDelay}
                min={5}
                max={50}
                step={0.1}
                label="Delay"
                displayValue={`${chorusDelay.toFixed(1)}ms`}
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
            overlay={<Tooltip>{ChorusTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusFeedback}
                onChange={setChorusFeedback}
                min={0}
                max={0.9}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(chorusFeedback * 100)}%`}
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
            overlay={<Tooltip>{ChorusTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusWetMix}
                onChange={setChorusWetMix}
                min={0}
                max={1}
                step={0.01}
                label="Mix"
                displayValue={`${Math.round(chorusWetMix * 100)}%`}
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
            overlay={<Tooltip>{ChorusTooltips.voices}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusVoices}
                onChange={setChorusVoices}
                min={1}
                max={8}
                step={1}
                label="Voices"
                displayValue={chorusVoices.toString()}
                size={50}
                color="#dda0dd"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
      
      {/* Secondary Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ChorusTooltips.width}</Tooltip>}
          >
            <div>
              <Knob
                value={chorusStereoWidth}
                onChange={setChorusStereoWidth}
                min={0}
                max={2}
                step={0.01}
                label="Width"
                displayValue={`${Math.round(chorusStereoWidth * 100)}%`}
                size={45}
                color="#ffa500"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <Form.Label className="text-white small">Waveform</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ChorusTooltips.waveform}</Tooltip>}
          >
            <Form.Select
              size="sm"
              value={chorusWaveform}
              onChange={(e) => setChorusWaveform(e.target.value)}
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
            overlay={<Tooltip>{ChorusTooltips.tempoSync}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="chorus-tempo-sync"
                label="Tempo Sync"
                checked={chorusTempoSync}
                onChange={(e) => setChorusTempoSync(e.target.checked)}
                className="text-white"
              />
              {chorusTempoSync && (
                <Form.Select
                  size="sm"
                  value={chorusNoteDivision}
                  onChange={(e) => setChorusNoteDivision(parseInt(e.target.value))}
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
            overlay={<Tooltip>Overall output level. Values above 1.0x boost the chorus effect. Use to balance chorus with dry signal.</Tooltip>}
          >
            <div>
              <Knob
                value={chorusOutputGain}
                onChange={setChorusOutputGain}
                min={0}
                max={2}
                step={0.01}
                label="Output"
                displayValue={`${chorusOutputGain.toFixed(2)}x`}
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
            onClick={applyChorus}
          >
            Apply Chorus to Region
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