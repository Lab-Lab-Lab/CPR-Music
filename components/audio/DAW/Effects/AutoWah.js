'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const AutoWahTooltips = {
  mode: "Control method: Envelope follows input dynamics (classic wah), LFO creates rhythmic sweeps, Manual locks frequency, Hybrid combines envelope + LFO.",
  sensitivity: "How responsive the envelope follower is to input level. Higher values create more dramatic sweeps from quieter signals.",
  frequency: "Center frequency of the filter sweep. Lower frequencies (200-800Hz) create deep wah, higher (1-3kHz) create vocal-like effects.",
  resonance: "Emphasis at the swept frequency (Q factor). Higher values create more pronounced, vocal-like wah. Use sparingly (2-8) to avoid harshness.",
  range: "Width of the frequency sweep in semitones. Wider ranges (12-24) create dramatic effects, narrow ranges (6-12) are subtle.",
  filterType: "Filter shape: Bandpass is classic wah, Lowpass is muffled wah, Highpass is thin wah, Peaking creates vowel-like sounds.",
  lfoRate: "Speed of LFO modulation (in LFO or Hybrid mode). Slow rates (0.5-2Hz) create smooth sweeps, fast rates (4-8Hz) create tremolo-like effects.",
  lfoDepth: "Amount of LFO modulation (in LFO or Hybrid mode). Controls how much the filter frequency varies with the LFO.",
  mix: "Balance between dry and wet signal. Lower values (20-40%) preserve original tone, higher values (60-80%) emphasize the wah effect."
};

/**
 * Enhanced Auto-Wah Processor with Multiple LFO Modes
 * Integrates envelope following, LFO modulation, and hybrid control
 */
class AutoWahProcessor {
  constructor(audioContext, maxDelayTime = 0.1) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Filter chain
    this.filter = audioContext.createBiquadFilter();
    
    // LFO System (from Chorus/Filter engines)
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfoOffset = audioContext.createGain();
    
    // Input/Output nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Modulation modes
    this.modeModes = {
      'envelope': 'envelope',      // Traditional auto-wah
      'lfo': 'lfo',               // LFO-controlled wah
      'manual': 'manual',         // Manual frequency control
      'hybrid': 'hybrid'          // Envelope + LFO combined
    };
    
    // Filter types for different wah characters
    this.filterTypes = {
      'bandpass': 'bandpass',     // Classic wah sound
      'lowpass': 'lowpass',       // Muffled wah
      'highpass': 'highpass',     // Thin wah
      'peaking': 'peaking'        // Vowel-like wah
    };
    
    // LFO waveforms
    this.lfoWaveforms = ['sine', 'square', 'sawtooth', 'triangle'];
    this.lfoStarted = false;  // Track whether LFO has been started

    this.setupLFO();
    this.setupRouting();
    this.setupVisualization();
    
    // Default parameters
    this.parameters = {
      mode: 'envelope',
      filterType: 'bandpass',
      frequency: 500,
      range: 2000,
      sensitivity: 0.5,
      q: 5,
      attack: 0.01,
      release: 0.1,
      lfoRate: 0.5,
      lfoDepth: 0.5,
      lfoWaveform: 'sine',
      lfoTempoSync: false,
      lfoNoteDiv: 4,
      lfoPhase: 0,
      hybridBalance: 0.5, // 0 = all envelope, 1 = all LFO
      mix: 1.0
    };
    
    // Envelope follower state
    this.envelopeValue = 0;
    this.envelopeAttackCoeff = 0;
    this.envelopeReleaseCoeff = 0;
  }
  
  setupLFO() {
    // LFO setup with multiple waveforms
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.5;
    this.lfoGain.gain.value = 0;
    this.lfoOffset.gain.value = 500; // Base frequency
    
    // Connect LFO to filter frequency with offset
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfoOffset.connect(this.filter.frequency);

    // Start LFO only if not already started
    if (!this.lfoStarted) {
      this.lfo.start();
      this.lfoStarted = true;
    }
  }
  
  setupRouting() {
    // Main signal path
    this.input.connect(this.filter);
    this.input.connect(this.dryGain);
    
    this.filter.connect(this.wetGain);
    
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }
  
  setupVisualization() {
    // Frequency response and modulation visualization data
    this.frequencyData = new Float32Array(128);
    this.magnitudeResponse = new Float32Array(128);
    this.phaseResponse = new Float32Array(128);
    this.modulationHistory = new Float32Array(256);
    this.historyIndex = 0;
    
    for (let i = 0; i < 128; i++) {
      this.frequencyData[i] = 20 * Math.pow(10, (i / 128) * 3); // 20Hz to 20kHz
    }
  }
  
  updateParameters(params) {
    Object.assign(this.parameters, params);
    
    // Update filter
    if (params.filterType) {
      this.filter.type = this.filterTypes[params.filterType] || 'bandpass';
    }
    
    if (params.frequency !== undefined) {
      this.lfoOffset.gain.value = params.frequency;
      if (params.mode === 'manual') {
        this.filter.frequency.value = params.frequency;
      }
    }
    
    if (params.q !== undefined) {
      this.filter.Q.value = params.q;
    }
    
    // Update envelope coefficients
    if (params.attack !== undefined) {
      this.envelopeAttackCoeff = Math.exp(-1 / (params.attack * this.sampleRate));
    }
    
    if (params.release !== undefined) {
      this.envelopeReleaseCoeff = Math.exp(-1 / (params.release * this.sampleRate));
    }
    
    // Update LFO
    if (params.lfoRate !== undefined && !params.lfoTempoSync) {
      this.lfo.frequency.value = params.lfoRate;
    }
    
    if (params.lfoDepth !== undefined && params.range !== undefined) {
      // Scale LFO depth based on frequency range
      const depthScale = params.range * params.lfoDepth;
      this.lfoGain.gain.value = depthScale;
    }
    
    if (params.lfoWaveform) {
      this.lfo.type = params.lfoWaveform;
    }
    
    if (params.mix !== undefined) {
      this.wetGain.gain.value = params.mix;
      this.dryGain.gain.value = 1 - params.mix;
    }
  }
  
  setTempoSyncRate(bpm, noteDiv) {
    if (this.parameters.lfoTempoSync) {
      const rate = (bpm / 60) * (4 / noteDiv);
      this.lfo.frequency.value = rate;
    }
  }
  
  // Process envelope following for real-time use
  processEnvelopeFollower(inputSample) {
    const rectified = Math.abs(inputSample);
    
    if (rectified > this.envelopeValue) {
      // Attack
      this.envelopeValue = rectified + (this.envelopeValue - rectified) * this.envelopeAttackCoeff;
    } else {
      // Release
      this.envelopeValue = rectified + (this.envelopeValue - rectified) * this.envelopeReleaseCoeff;
    }
    
    return this.envelopeValue * this.parameters.sensitivity;
  }
  
  // Get current modulation value based on mode
  getCurrentModulation(inputSample, lfoValue) {
    const envMod = this.processEnvelopeFollower(inputSample);
    
    switch (this.parameters.mode) {
      case 'envelope':
        return envMod;
      
      case 'lfo':
        return lfoValue * this.parameters.lfoDepth;
      
      case 'manual':
        return 0; // No modulation, fixed frequency
      
      case 'hybrid':
        const balance = this.parameters.hybridBalance;
        return envMod * (1 - balance) + lfoValue * this.parameters.lfoDepth * balance;
      
      default:
        return envMod;
    }
  }
  
  // Update modulation history for visualization
  updateModulationHistory(modValue) {
    this.modulationHistory[this.historyIndex] = modValue;
    this.historyIndex = (this.historyIndex + 1) % this.modulationHistory.length;
  }
  
  getFrequencyResponse() {
    this.filter.getFrequencyResponse(
      this.frequencyData,
      this.magnitudeResponse,
      this.phaseResponse
    );
    return {
      frequencies: this.frequencyData,
      magnitude: this.magnitudeResponse,
      phase: this.phaseResponse,
      modulation: this.modulationHistory,
      currentFreq: this.filter.frequency.value
    };
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
  
  dispose() {
    this.lfo.stop();
    this.lfo.disconnect();
    this.filter.disconnect();
    this.input.disconnect();
    this.output.disconnect();
  }
}

/**
 * Process enhanced auto-wah on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processAutoWahRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
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
  
  // Create enhanced processor
  const processor = new AutoWahProcessor(offlineContext);
  processor.updateParameters(parameters);
  
  // If tempo synced, update LFO rate
  if (parameters.lfoTempoSync && parameters.globalBPM) {
    processor.setTempoSyncRate(parameters.globalBPM, parameters.lfoNoteDiv);
  }
  
  // Advanced automation for different modulation modes
  if (parameters.mode === 'envelope' || parameters.mode === 'hybrid') {
    // Pre-analyze audio for envelope following (only the region)
    const analysisData = audioBuffer.getChannelData(0); // Use first channel for analysis
    const envelope = new Float32Array(regionLength);
    let envValue = 0;

    const attackCoeff = Math.exp(-1 / ((parameters.attack || 0.01) * sampleRate));
    const releaseCoeff = Math.exp(-1 / ((parameters.release || 0.1) * sampleRate));

    for (let i = 0; i < regionLength; i++) {
      const rectified = Math.abs(analysisData[startSample + i]);

      if (rectified > envValue) {
        envValue = rectified + (envValue - rectified) * attackCoeff;
      } else {
        envValue = rectified + (envValue - rectified) * releaseCoeff;
      }

      envelope[i] = envValue;
    }

    // Create automation based on envelope and/or LFO
    const automationRate = 64; // Higher resolution for smoother modulation
    const stepSec = automationRate / sampleRate;
    let lastTime = offlineContext.currentTime;

    // Set initial frequency
    processor.filter.frequency.setValueAtTime(parameters.frequency, lastTime);

    for (let i = 0; i < regionLength; i += automationRate) {
      const relativeTime = i / sampleRate;
      const envValue = envelope[i] * (parameters.sensitivity || 0.5);
      
      let modValue = 0;
      if (parameters.mode === 'envelope') {
        modValue = envValue;
      } else if (parameters.mode === 'hybrid') {
        // Combine envelope and LFO
        const lfoPhase = (relativeTime * parameters.lfoRate * 2 * Math.PI) + (parameters.lfoPhase || 0);
        let lfoValue = 0;
        
        switch (parameters.lfoWaveform) {
          case 'sine':
            lfoValue = Math.sin(lfoPhase);
            break;
          case 'square':
            lfoValue = Math.sin(lfoPhase) > 0 ? 1 : -1;
            break;
          case 'sawtooth':
            lfoValue = 2 * ((lfoPhase / (2 * Math.PI)) % 1) - 1;
            break;
          case 'triangle':
            const sawValue = ((lfoPhase / (2 * Math.PI)) % 1);
            lfoValue = sawValue < 0.5 ? 4 * sawValue - 1 : 3 - 4 * sawValue;
            break;
        }
        
        const balance = parameters.hybridBalance || 0.5;
        modValue = envValue * (1 - balance) + lfoValue * (parameters.lfoDepth || 0.5) * balance;
      }
      
      const targetFreq = Math.max(20, Math.min(20000, 
        (parameters.frequency || 500) + modValue * (parameters.range || 2000)
      ));
      
      const time = lastTime + stepSec;
      const t1 = Math.max(time, lastTime + 1e-6); // Ensure strictly increasing
      processor.filter.frequency.linearRampToValueAtTime(targetFreq, t1);
      lastTime = t1;
    }
  }
  
  // Connect and process
  source.connect(processor.input);
  processor.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  // Render and return processed region directly
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}

/**
 * Enhanced Auto-Wah effect component with multiple LFO modes
 */
export default function AutoWah({ width, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    autoWahMode,
    setAutoWahMode,
    autoWahFilterType,
    setAutoWahFilterType,
    autoWahSensitivity,
    setAutoWahSensitivity,
    autoWahFrequency,
    setAutoWahFrequency,
    autoWahRange,
    setAutoWahRange,
    autoWahQ,
    setAutoWahQ,
    autoWahAttack,
    setAutoWahAttack,
    autoWahRelease,
    setAutoWahRelease,
    autoWahLfoRate,
    setAutoWahLfoRate,
    autoWahLfoDepth,
    setAutoWahLfoDepth,
    autoWahLfoWaveform,
    setAutoWahLfoWaveform,
    autoWahLfoPhase,
    setAutoWahLfoPhase,
    autoWahHybridBalance,
    setAutoWahHybridBalance,
    autoWahMix,
    setAutoWahMix,
    autoWahTempoSync,
    setAutoWahTempoSync,
    autoWahNoteDivision,
    setAutoWahNoteDivision,
    globalBPM,
    cutRegion,
  } = useEffects();

  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const processorRef = useRef(null);

  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      processorRef.current = new AutoWahProcessor(audioContextRef.current);
    }
    
    return () => {
      if (processorRef.current) {
        processorRef.current.dispose();
      }
    };
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateParameters({
        mode: autoWahMode,
        filterType: autoWahFilterType,
        sensitivity: autoWahSensitivity,
        frequency: autoWahFrequency,
        range: autoWahRange,
        q: autoWahQ,
        attack: autoWahAttack,
        release: autoWahRelease,
        lfoRate: autoWahLfoRate,
        lfoDepth: autoWahLfoDepth,
        lfoWaveform: autoWahLfoWaveform,
        lfoPhase: autoWahLfoPhase,
        hybridBalance: autoWahHybridBalance,
        mix: autoWahMix,
        lfoTempoSync: autoWahTempoSync,
        lfoNoteDiv: autoWahNoteDivision,
        globalBPM
      });
      
      if (autoWahTempoSync) {
        processorRef.current.setTempoSyncRate(globalBPM, autoWahNoteDivision);
      }
    }
  }, [autoWahMode, autoWahFilterType, autoWahSensitivity, autoWahFrequency, autoWahRange, autoWahQ, autoWahAttack, autoWahRelease, autoWahLfoRate, autoWahLfoDepth, autoWahLfoWaveform, autoWahLfoPhase, autoWahHybridBalance, autoWahMix, autoWahTempoSync, autoWahNoteDivision, globalBPM]);
  
  // Visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processorRef.current) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Get frequency response and modulation data
      const response = processorRef.current.getFrequencyResponse();
      
      // Draw frequency response
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < response.magnitude.length; i++) {
        const x = (i / response.magnitude.length) * width;
        const magnitude = response.magnitude[i];
        const db = 20 * Math.log10(magnitude);
        const y = height - ((db + 40) / 80) * height; // -40dB to +40dB range
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Draw current filter frequency
      const nyquist = processorRef.current.sampleRate / 2;
      const currentFreqX = (Math.log10(response.currentFreq / 20) / Math.log10(nyquist / 20)) * width;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(currentFreqX, 0);
      ctx.lineTo(currentFreqX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw modulation history (bottom section)
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const modHeight = height * 0.2; // Use bottom 20% for modulation display
      const modY = height - modHeight;
      
      for (let i = 0; i < response.modulation.length; i++) {
        const x = (i / response.modulation.length) * width;
        const modValue = response.modulation[i];
        const y = modY + (1 - modValue) * modHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Draw mode indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(`Mode: ${autoWahMode.toUpperCase()}`, 10, 20);
      ctx.fillText(`Filter: ${autoWahFilterType}`, 10, 35);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoWahMode, autoWahFilterType]);

  // Calculate tempo-synced envelope timing
  const getEffectiveAttack = () => {
    if (autoWahTempoSync) {
      // Convert musical note division to seconds for attack timing
      const beatDurationSeconds = 60 / globalBPM;
      return (beatDurationSeconds / autoWahNoteDivision) * 0.25; // 25% of note duration
    }
    return autoWahAttack;
  };

  const getEffectiveRelease = () => {
    if (autoWahTempoSync) {
      // Convert musical note division to seconds for release timing
      const beatDurationSeconds = 60 / globalBPM;
      return (beatDurationSeconds / autoWahNoteDivision) * 0.75; // 75% of note duration
    }
    return autoWahRelease;
  };

  // Apply auto-wah to selected region
  const applyAutoWah = useCallback(
    createEffectApplyFunction(processAutoWahRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        mode: autoWahMode,
        filterType: autoWahFilterType,
        sensitivity: autoWahSensitivity,
        frequency: autoWahFrequency,
        range: autoWahRange,
        q: autoWahQ,
        attack: getEffectiveAttack(),
        release: getEffectiveRelease(),
        lfoRate: autoWahLfoRate,
        lfoDepth: autoWahLfoDepth,
        lfoWaveform: autoWahLfoWaveform,
        lfoPhase: autoWahLfoPhase,
        hybridBalance: autoWahHybridBalance,
        mix: autoWahMix,
        lfoTempoSync: autoWahTempoSync,
        lfoNoteDiv: autoWahNoteDivision,
        globalBPM,
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, autoWahMode, autoWahFilterType,
      autoWahSensitivity, autoWahFrequency, autoWahRange, autoWahQ, autoWahAttack, autoWahRelease,
      autoWahLfoRate, autoWahLfoDepth, autoWahLfoWaveform, autoWahLfoPhase, autoWahHybridBalance,
      autoWahMix, autoWahTempoSync, autoWahNoteDivision, globalBPM, onApply]
  );

  // Helper functions for UI display
  const getModeOptions = () => [
    { value: 'envelope', label: 'Envelope' },
    { value: 'lfo', label: 'LFO' },
    { value: 'manual', label: 'Manual' },
    { value: 'hybrid', label: 'Hybrid' },
  ];
  
  const getFilterTypeOptions = () => [
    { value: 'bandpass', label: 'Band Pass' },
    { value: 'lowpass', label: 'Low Pass' },
    { value: 'highpass', label: 'High Pass' },
    { value: 'peaking', label: 'Peaking' },
  ];
  
  const getLfoWaveformOptions = () => [
    { value: 'sine', label: 'Sine' },
    { value: 'square', label: 'Square' },
    { value: 'sawtooth', label: 'Sawtooth' },
    { value: 'triangle', label: 'Triangle' },
  ];
  
  const getNoteDivisionOptions = () => [
    { value: 1, label: '1/1' },
    { value: 2, label: '1/2' },
    { value: 4, label: '1/4' },
    { value: 8, label: '1/8' },
    { value: 16, label: '1/16' },
    { value: 32, label: '1/32' },
  ];
  
  const getEffectiveLfoRate = () => {
    if (autoWahTempoSync) {
      return (globalBPM / 60) * (4 / autoWahNoteDivision);
    }
    return autoWahLfoRate;
  };

  return (
    <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-2">
        <Col xs={12}>
          <canvas
            ref={canvasRef}
            width={300}
            height={100}
            style={{
              width: '100%',
              height: '100px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px'
            }}
          />
        </Col>
      </Row>
      
      <Row className="text-center align-items-end">
        {/* Modulation Mode */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Mode</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AutoWahTooltips.mode}</Tooltip>}
          >
            <Form.Select
              size="sm"
              value={autoWahMode}
              onChange={(e) => setAutoWahMode(e.target.value)}
            >
              {getModeOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        {/* Filter Type */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Filter Type</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AutoWahTooltips.filterType}</Tooltip>}
          >
            <Form.Select
              size="sm"
              value={autoWahFilterType}
              onChange={(e) => setAutoWahFilterType(e.target.value)}
            >
              {getFilterTypeOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Form.Select>
          </OverlayTrigger>
        </Col>

        {/* Core Filter Controls */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AutoWahTooltips.frequency}</Tooltip>}
          >
            <div>
              <Knob
                value={autoWahFrequency}
                onChange={setAutoWahFrequency}
                min={200}
                max={4000}
                step={10}
                label="Base Freq"
                displayValue={
                  autoWahFrequency >= 1000
                    ? `${(autoWahFrequency / 1000).toFixed(1)}k`
                    : `${autoWahFrequency}Hz`
                }
                size={45}
                color="#e75b5c"
                logarithmic={true}
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AutoWahTooltips.range}</Tooltip>}
          >
            <div>
              <Knob
                value={autoWahRange}
                onChange={setAutoWahRange}
                min={100}
                max={5000}
                step={50}
                label="Range"
                displayValue={
                  autoWahRange >= 1000
                    ? `${(autoWahRange / 1000).toFixed(1)}k`
                    : `${autoWahRange}Hz`
                }
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{AutoWahTooltips.resonance}</Tooltip>}
          >
            <div>
              <Knob
                value={autoWahQ}
                onChange={setAutoWahQ}
                min={0.5}
                max={20}
                step={0.1}
                label="Resonance"
                displayValue={`${autoWahQ.toFixed(1)}`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        {/* Envelope Controls (show when mode is envelope or hybrid) */}
        {(autoWahMode === 'envelope' || autoWahMode === 'hybrid') && (
          <>
            <Col xs={6} sm={4} md={2} lg={1}>
              <OverlayTrigger
                placement="top"
                delay={{ show: 1500, hide: 250 }}
                overlay={<Tooltip>{AutoWahTooltips.sensitivity}</Tooltip>}
              >
                <div>
                  <Knob
                    value={autoWahSensitivity}
                    onChange={setAutoWahSensitivity}
                    min={0}
                    max={1}
                    label="Sensitivity"
                    displayValue={`${Math.round(autoWahSensitivity * 100)}%`}
                    size={45}
                    color="#92ce84"
                  />
                </div>
              </OverlayTrigger>
            </Col>
            
            <Col xs={6} sm={4} md={2} lg={1}>
              <Knob
                value={autoWahAttack * 1000}
                onChange={(v) => setAutoWahAttack(v / 1000)}
                min={1}
                max={100}
                label="Attack"
                displayValue={`${(autoWahAttack * 1000).toFixed(0)}ms`}
                size={45}
                color="#92ceaa"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2} lg={1}>
              <Knob
                value={autoWahRelease * 1000}
                onChange={(v) => setAutoWahRelease(v / 1000)}
                min={10}
                max={1000}
                label="Release"
                displayValue={`${(autoWahRelease * 1000).toFixed(0)}ms`}
                size={45}
                color="#9b59b6"
              />
            </Col>
          </>
        )}
        
        {/* LFO Controls (show when mode is lfo or hybrid) */}
        {(autoWahMode === 'lfo' || autoWahMode === 'hybrid') && (
          <>
            <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
              <Form.Label className="text-white small mb-1">LFO Wave</Form.Label>
              <Form.Select
                size="sm"
                value={autoWahLfoWaveform}
                onChange={(e) => setAutoWahLfoWaveform(e.target.value)}
              >
                {getLfoWaveformOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            
            <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
              <Form.Check
                type="switch"
                id="auto-wah-tempo-sync"
                label="Sync"
                checked={autoWahTempoSync}
                onChange={(e) => setAutoWahTempoSync(e.target.checked)}
                className="text-white small"
              />
            </Col>
            
            {autoWahTempoSync ? (
              <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
                <Form.Label className="text-white small mb-1">Note Div</Form.Label>
                <Form.Select
                  size="sm"
                  value={autoWahNoteDivision}
                  onChange={(e) => setAutoWahNoteDivision(Number(e.target.value))}
                >
                  {getNoteDivisionOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            ) : (
              <Col xs={6} sm={4} md={2} lg={1}>
                <Knob
                  value={autoWahLfoRate}
                  onChange={setAutoWahLfoRate}
                  min={0.01}
                  max={10}
                  step={0.01}
                  label="LFO Rate"
                  displayValue={`${autoWahLfoRate.toFixed(2)}Hz`}
                  size={45}
                  color="#e67e22"
                />
              </Col>
            )}
            
            <Col xs={6} sm={4} md={2} lg={1}>
              <Knob
                value={autoWahLfoDepth}
                onChange={setAutoWahLfoDepth}
                min={0}
                max={1}
                step={0.01}
                label="LFO Depth"
                displayValue={`${Math.round(autoWahLfoDepth * 100)}%`}
                size={45}
                color="#27ae60"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2} lg={1}>
              <Knob
                value={autoWahLfoPhase}
                onChange={setAutoWahLfoPhase}
                min={0}
                max={360}
                step={5}
                label="LFO Phase"
                displayValue={`${autoWahLfoPhase}°`}
                size={45}
                color="#3498db"
              />
            </Col>
          </>
        )}
        
        {/* Hybrid Balance (show only when mode is hybrid) */}
        {autoWahMode === 'hybrid' && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={autoWahHybridBalance}
              onChange={setAutoWahHybridBalance}
              min={0}
              max={1}
              step={0.01}
              label="Env/LFO"
              displayValue={`${Math.round((1 - autoWahHybridBalance) * 100)}/${Math.round(autoWahHybridBalance * 100)}`}
              size={45}
              color="#f39c12"
            />
          </Col>
        )}
        
        {/* Mix Control */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahMix}
            onChange={setAutoWahMix}
            min={0}
            max={1}
            step={0.01}
            label="Mix"
            displayValue={`${Math.round(autoWahMix * 100)}%`}
            size={45}
            color="#8e44ad"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyAutoWah}>
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
