'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Button,
  Form,
  Modal,
  Badge,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Tooltip definitions for Filter controls
 */
const FilterTooltips = {
  filterType: {
    lowpass: "Removes frequencies above the cutoff point. Like turning down the treble - makes sounds warmer and darker.",
    highpass: "Removes frequencies below the cutoff point. Like turning down the bass - makes sounds thinner and brighter.",
    bandpass: "Only allows frequencies near the cutoff through. Creates a focused, narrow sound like a telephone voice.",
    notch: "Removes a narrow band of frequencies at the cutoff. Useful for removing specific problem frequencies.",
    peaking: "Boosts or cuts frequencies around the cutoff point. Like a single EQ band.",
    lowshelf: "Boosts or cuts all frequencies below the cutoff. Affects bass and low-mids together.",
    highshelf: "Boosts or cuts all frequencies above the cutoff. Affects treble and presence together.",
    allpass: "Shifts the phase without changing frequency levels. Subtle effect used for special processing."
  },
  frequency: "The cutoff point where the filter starts working. Move left for lower/bassier, right for higher/brighter.",
  resonance: "Emphasis at the cutoff frequency. Higher values create a 'peak' or 'whistle' sound at the cutoff point. Use carefully!",
  gain: "For shelf and peaking filters only - how much to boost or cut the selected frequencies.",
  lfoWave: "The shape of the automatic movement pattern. Sine = smooth waves, Square = sudden jumps, Saw = steady sweep, Triangle = back and forth.",
  lfoRate: "How fast the filter sweeps back and forth. Lower = slow movement, Higher = rapid wobbling.",
  lfoDepth: "How much the LFO affects the filter. 0% = no movement, 100% = maximum sweep range.",
  sync: "Lock the LFO speed to your project tempo for rhythmic, musical effects that stay in time.",
  noteDiv: "Syncs LFO to musical note values. 1/4 = quarter notes, 1/8 = eighth notes, 1/16 = sixteenth notes.",
  mix: "Blend between original (dry) and filtered (wet) signal. 100% = fully filtered, 50% = equal mix."
};

/**
 * Knob component with optional tooltip
 */
function KnobWithTooltip({ tooltip, label, ...knobProps }) {
  const knob = <Knob label={label} {...knobProps} />;

  if (!tooltip || !label) {
    return knob;
  }

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 2000, hide: 250 }}
      overlay={
        <Tooltip id={`tooltip-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {tooltip}
        </Tooltip>
      }
    >
      <div>{knob}</div>
    </OverlayTrigger>
  );
}

/**
 * Switch component with tooltip
 */
function SwitchWithTooltip({ tooltip, label, id, ...switchProps }) {
  const switchElement = (
    <Form.Check
      type="switch"
      id={id}
      label={label}
      {...switchProps}
    />
  );

  if (!tooltip) {
    return switchElement;
  }

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 2000, hide: 250 }}
      overlay={
        <Tooltip id={`tooltip-${id}`}>
          {tooltip}
        </Tooltip>
      }
    >
      <div>{switchElement}</div>
    </OverlayTrigger>
  );
}

/**
 * Professional Filter Processor with LFO Modulation
 * Integrates standalone filtering with advanced LFO engine
 */
class FilterProcessor {
  constructor(audioContext, maxDelayTime = 0.1) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Main filter
    this.filter = audioContext.createBiquadFilter();
    
    // LFO System (from Chorus engine)
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfoOffset = audioContext.createGain();
    
    // Input/Output nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Filter types
    this.filterTypes = {
      'lowpass': 'lowpass',
      'highpass': 'highpass', 
      'bandpass': 'bandpass',
      'notch': 'notch',
      'peaking': 'peaking',
      'lowshelf': 'lowshelf',
      'highshelf': 'highshelf',
      'allpass': 'allpass'
    };
    
    // LFO waveforms
    this.lfoWaveforms = ['sine', 'square', 'sawtooth', 'triangle'];
    this.lfoStarted = false;  // Track whether LFO has been started

    this.setupLFO();
    this.setupRouting();
    this.setupVisualization();
    
    // Default parameters
    this.parameters = {
      filterType: 'lowpass',
      frequency: 1000,
      resonance: 1,
      gain: 0,
      lfoRate: 0.5,
      lfoDepth: 0,
      lfoWaveform: 'sine',
      lfoTempoSync: false,
      lfoNoteDiv: 4,
      mix: 1.0
    };
  }
  
  setupLFO() {
    // LFO setup with multiple waveforms
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.5;
    this.lfoGain.gain.value = 0;
    this.lfoOffset.gain.value = 1000; // Base frequency

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
    // Frequency response visualization data
    this.frequencyData = new Float32Array(128);
    this.magnitudeResponse = new Float32Array(128);
    this.phaseResponse = new Float32Array(128);
    
    for (let i = 0; i < 128; i++) {
      this.frequencyData[i] = 20 * Math.pow(10, (i / 128) * 3); // 20Hz to 20kHz
    }
  }
  
  updateParameters(params) {
    Object.assign(this.parameters, params);
    
    // Update filter
    if (params.filterType) {
      this.filter.type = this.filterTypes[params.filterType] || 'lowpass';
    }
    
    if (params.frequency !== undefined) {
      this.lfoOffset.gain.value = params.frequency;
      this.filter.frequency.value = params.frequency;
    }
    
    if (params.resonance !== undefined) {
      this.filter.Q.value = params.resonance;
    }
    
    if (params.gain !== undefined) {
      this.filter.gain.value = params.gain;
    }
    
    // Update LFO
    if (params.lfoRate !== undefined && !params.lfoTempoSync) {
      this.lfo.frequency.value = params.lfoRate;
    }
    
    if (params.lfoDepth !== undefined) {
      // Scale depth based on frequency range
      const depthScale = params.frequency * 0.5;
      this.lfoGain.gain.value = params.lfoDepth * depthScale;
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
  
  getFrequencyResponse() {
    this.filter.getFrequencyResponse(
      this.frequencyData,
      this.magnitudeResponse,
      this.phaseResponse
    );
    return {
      frequencies: this.frequencyData,
      magnitude: this.magnitudeResponse,
      phase: this.phaseResponse
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
 * Process filter on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processFilterRegion(
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

  // Create filter processor
  const processor = new FilterProcessor(offlineContext);
  processor.updateParameters(parameters);

  // If tempo synced, update LFO rate
  if (parameters.lfoTempoSync && parameters.globalBPM) {
    processor.setTempoSyncRate(parameters.globalBPM, parameters.lfoNoteDiv);
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
 * Professional Filter effect with LFO modulation
 */
export default function Filter({ width, modalMode = false, onApply }) {
  const { audioRef, addToEditHistory, audioURL } = useAudio();
  const [showFilterHelp, setShowFilterHelp] = useState(false);

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    filterType,
    setFilterType,
    filterFrequency,
    setFilterFrequency,
    filterResonance,
    setFilterResonance,
    filterGain,
    setFilterGain,
    filterLfoRate,
    setFilterLfoRate,
    filterLfoDepth,
    setFilterLfoDepth,
    filterLfoWaveform,
    setFilterLfoWaveform,
    filterLfoTempoSync,
    setFilterLfoTempoSync,
    filterLfoNoteDiv,
    setFilterLfoNoteDiv,
    filterMix,
    setFilterMix,
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
      processorRef.current = new FilterProcessor(audioContextRef.current);
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
        filterType,
        frequency: filterFrequency,
        resonance: filterResonance,
        gain: filterGain,
        lfoRate: filterLfoRate,
        lfoDepth: filterLfoDepth,
        lfoWaveform: filterLfoWaveform,
        lfoTempoSync: filterLfoTempoSync,
        lfoNoteDiv: filterLfoNoteDiv,
        mix: filterMix,
        globalBPM
      });
      
      if (filterLfoTempoSync) {
        processorRef.current.setTempoSyncRate(globalBPM, filterLfoNoteDiv);
      }
    }
  }, [filterType, filterFrequency, filterResonance, filterGain, filterLfoRate, filterLfoDepth, filterLfoWaveform, filterLfoTempoSync, filterLfoNoteDiv, filterMix, globalBPM]);
  
  // Visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processorRef.current) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Get frequency response
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
      
      // Draw cutoff frequency line
      const nyquist = processorRef.current.sampleRate / 2;
      const cutoffX = (Math.log10(filterFrequency / 20) / Math.log10(nyquist / 20)) * width;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cutoffX, 0);
      ctx.lineTo(cutoffX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw LFO modulation range if active
      if (filterLfoDepth > 0) {
        const range = filterFrequency * 0.5 * filterLfoDepth;
        const minFreq = Math.max(20, filterFrequency - range);
        const maxFreq = Math.min(nyquist, filterFrequency + range);
        
        const minX = (Math.log10(minFreq / 20) / Math.log10(nyquist / 20)) * width;
        const maxX = (Math.log10(maxFreq / 20) / Math.log10(nyquist / 20)) * width;
        
        ctx.fillStyle = 'rgba(255, 107, 107, 0.2)';
        ctx.fillRect(minX, 0, maxX - minX, height);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [filterFrequency, filterLfoDepth]);
  
  // Apply filter to selected region
  const applyFilter = useCallback(
    createEffectApplyFunction(processFilterRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        filterType,
        frequency: filterFrequency,
        resonance: filterResonance,
        gain: filterGain,
        lfoRate: filterLfoRate,
        lfoDepth: filterLfoDepth,
        lfoWaveform: filterLfoWaveform,
        lfoTempoSync: filterLfoTempoSync,
        lfoNoteDiv: filterLfoNoteDiv,
        mix: filterMix,
        globalBPM,
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, filterType,
      filterFrequency, filterResonance, filterGain, filterLfoRate, filterLfoDepth,
      filterLfoWaveform, filterLfoTempoSync, filterLfoNoteDiv, filterMix, globalBPM, onApply]
  );
  
  const filterTypeOptions = [
    { value: 'lowpass', label: 'Low Pass' },
    { value: 'highpass', label: 'High Pass' },
    { value: 'bandpass', label: 'Band Pass' },
    { value: 'notch', label: 'Notch' },
    { value: 'peaking', label: 'Peaking' },
    { value: 'lowshelf', label: 'Low Shelf' },
    { value: 'highshelf', label: 'High Shelf' },
    { value: 'allpass', label: 'All Pass' },
  ];
  
  const lfoWaveformOptions = [
    { value: 'sine', label: 'Sine' },
    { value: 'square', label: 'Square' },
    { value: 'sawtooth', label: 'Saw' },
    { value: 'triangle', label: 'Triangle' },
  ];
  
  const noteDivisionOptions = [
    { value: 1, label: '1/1' },
    { value: 2, label: '1/2' },
    { value: 4, label: '1/4' },
    { value: 8, label: '1/8' },
    { value: 16, label: '1/16' },
    { value: 32, label: '1/32' },
  ];
  
  const getEffectiveLfoRate = () => {
    if (filterLfoTempoSync) {
      return (globalBPM / 60) * (4 / filterLfoNoteDiv);
    }
    return filterLfoRate;
  };
  
  return (
    <>
      <Container fluid className="p-2">
      {/* Visualization */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="position-relative">
            <canvas
              ref={canvasRef}
              width={300}
              height={80}
              style={{
                width: '100%',
                height: '80px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px'
              }}
            />
            {/* Help Icon */}
            <div
              className="position-absolute"
              style={{
                top: '8px',
                right: '8px',
                zIndex: 10,
                cursor: 'pointer'
              }}
            >
              <FaQuestionCircle
                size={18}
                style={{
                  color: '#e75b5c',
                  opacity: 0.7,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.opacity = 1}
                onMouseLeave={(e) => e.target.style.opacity = 0.7}
                onClick={() => setShowFilterHelp(true)}
              />
            </div>
          </div>
        </Col>
      </Row>
      
      <Row className="text-center align-items-end">
        {/* Filter Type */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 2000, hide: 250 }}
            overlay={
              <Tooltip id="tooltip-filter-type">
                {FilterTooltips.filterType[filterType] || "Select the type of filter to apply to your audio"}
              </Tooltip>
            }
          >
            <Form.Label className="text-white small mb-1">Filter Type</Form.Label>
          </OverlayTrigger>
          <Form.Select
            size="sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {filterTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </Col>
        
        {/* Filter Controls */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <KnobWithTooltip
            tooltip={FilterTooltips.frequency}
            value={filterFrequency}
            onChange={setFilterFrequency}
            min={20}
            max={20000}
            step={1}
            label="Frequency"
            displayValue={`${filterFrequency.toFixed(0)}Hz`}
            size={45}
            color="#e75b5c"
            logarithmic={true}
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <KnobWithTooltip
            tooltip={FilterTooltips.resonance}
            value={filterResonance}
            onChange={setFilterResonance}
            min={0.1}
            max={30}
            step={0.1}
            label="Resonance"
            displayValue={`${filterResonance.toFixed(1)}`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        {(filterType === 'peaking' || filterType === 'lowshelf' || filterType === 'highshelf') && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <KnobWithTooltip
              tooltip={FilterTooltips.gain}
              value={filterGain}
              onChange={setFilterGain}
              min={-20}
              max={20}
              step={0.1}
              label="Gain"
              displayValue={`${filterGain > 0 ? '+' : ''}${filterGain.toFixed(1)}dB`}
              size={45}
              color="#92ce84"
            />
          </Col>
        )}
        
        {/* LFO Controls */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 2000, hide: 250 }}
            overlay={
              <Tooltip id="tooltip-lfo-wave">
                {FilterTooltips.lfoWave}
              </Tooltip>
            }
          >
            <Form.Label className="text-white small mb-1">LFO Wave</Form.Label>
          </OverlayTrigger>
          <Form.Select
            size="sm"
            value={filterLfoWaveform}
            onChange={(e) => setFilterLfoWaveform(e.target.value)}
          >
            {lfoWaveformOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <SwitchWithTooltip
            tooltip={FilterTooltips.sync}
            id="filter-tempo-sync"
            label="Sync"
            checked={filterLfoTempoSync}
            onChange={(e) => setFilterLfoTempoSync(e.target.checked)}
            className="text-white small"
          />
        </Col>
        
        {filterLfoTempoSync ? (
          <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
            <OverlayTrigger
              placement="top"
              delay={{ show: 2000, hide: 250 }}
              overlay={
                <Tooltip id="tooltip-note-div">
                  {FilterTooltips.noteDiv}
                </Tooltip>
              }
            >
              <Form.Label className="text-white small mb-1">Note Div</Form.Label>
            </OverlayTrigger>
            <Form.Select
              size="sm"
              value={filterLfoNoteDiv}
              onChange={(e) => setFilterLfoNoteDiv(Number(e.target.value))}
            >
              {noteDivisionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Form.Select>
          </Col>
        ) : (
          <Col xs={6} sm={4} md={2} lg={1}>
            <KnobWithTooltip
              tooltip={FilterTooltips.lfoRate}
              value={filterLfoRate}
              onChange={setFilterLfoRate}
              min={0.01}
              max={10}
              step={0.01}
              label="LFO Rate"
              displayValue={`${filterLfoRate.toFixed(2)}Hz`}
              size={45}
              color="#cbb677"
            />
          </Col>
        )}

        <Col xs={6} sm={4} md={2} lg={1}>
          <KnobWithTooltip
            tooltip={FilterTooltips.lfoDepth}
            value={filterLfoDepth}
            onChange={setFilterLfoDepth}
            min={0}
            max={1}
            step={0.01}
            label="LFO Depth"
            displayValue={`${Math.round(filterLfoDepth * 100)}%`}
            size={45}
            color="#92ceaa"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <KnobWithTooltip
            tooltip={FilterTooltips.mix}
            value={filterMix}
            onChange={setFilterMix}
            min={0}
            max={1}
            step={0.01}
            label="Mix"
            displayValue={`${Math.round(filterMix * 100)}%`}
            size={45}
            color="#9b59b6"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyFilter}>
            Apply to Region
          </Button>
        </Col>
      </Row>
      </Container>

    {/* Filter Help Modal */}
    <Modal
      show={showFilterHelp}
      onHide={() => setShowFilterHelp(false)}
      size="lg"
      centered
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaQuestionCircle className="me-2" />
          Understanding the Filter
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white">
        <div className="mb-4">
          <h5 className="text-info mb-3">What's a Filter?</h5>
          <p>
            A filter is like a smart tone control that removes or emphasizes certain frequencies in your sound.
            Think of it as an audio gatekeeper - it decides which frequencies get through and which don't.
          </p>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">Filter Types Explained</h5>
          <Row>
            <Col md={6} className="mb-3">
              <h6 className="text-warning">Basic Filters</h6>
              <ul className="small">
                <li><strong>Low Pass:</strong> Removes highs, keeps lows (like muffling sound)</li>
                <li><strong>High Pass:</strong> Removes lows, keeps highs (like a tinny radio)</li>
                <li><strong>Band Pass:</strong> Only keeps a narrow range (telephone effect)</li>
                <li><strong>Notch:</strong> Removes a specific frequency (fix feedback)</li>
              </ul>
            </Col>
            <Col md={6} className="mb-3">
              <h6 className="text-warning">EQ-Style Filters</h6>
              <ul className="small">
                <li><strong>Peaking:</strong> Boost/cut around a frequency (like one EQ band)</li>
                <li><strong>Low Shelf:</strong> Boost/cut all lows (bass control)</li>
                <li><strong>High Shelf:</strong> Boost/cut all highs (treble control)</li>
                <li><strong>All Pass:</strong> Changes phase, not volume (special effects)</li>
              </ul>
            </Col>
          </Row>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">The Graph</h5>
          <p>
            The line shows which frequencies are being affected. Higher line = louder frequencies,
            lower line = quieter frequencies. The shape changes based on your filter type and settings.
          </p>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">LFO (Low Frequency Oscillator)</h5>
          <p className="mb-2">
            The LFO makes the filter move automatically over time, creating dynamic, animated effects:
          </p>
          <ul className="small">
            <li><strong>Rate:</strong> How fast it moves (slow sweep vs. rapid wobble)</li>
            <li><strong>Depth:</strong> How much it moves (subtle vs. dramatic)</li>
            <li><strong>Wave Shape:</strong> The pattern of movement (smooth, stepped, etc.)</li>
            <li><strong>Sync:</strong> Lock to tempo for rhythmic effects</li>
          </ul>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">Common Uses</h5>
          <Row>
            <Col md={6}>
              <ul className="small">
                <li><strong>Low Pass + LFO:</strong> Classic "wah" or dubstep wobble</li>
                <li><strong>High Pass:</strong> Clean up muddy recordings</li>
                <li><strong>Band Pass:</strong> Radio/telephone voice effect</li>
                <li><strong>Resonant Filter:</strong> Acid bass sounds</li>
              </ul>
            </Col>
            <Col md={6}>
              <ul className="small">
                <li><strong>Auto-wah:</strong> Set LFO to envelope follower</li>
                <li><strong>Sweeping pads:</strong> Slow LFO on low pass</li>
                <li><strong>Rhythmic gating:</strong> Square wave LFO synced</li>
                <li><strong>Vocal effects:</strong> Band pass with movement</li>
              </ul>
            </Col>
          </Row>
        </div>

        <div className="alert alert-info mb-0">
          <strong>💡 Pro Tip:</strong> Start with Resonance low (1-5) to avoid harsh, piercing sounds.
          Use higher resonance (10+) only for special effects. Add LFO movement to bring static sounds to life -
          even subtle amounts (10-20% depth) can add interest without being obvious!
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={() => setShowFilterHelp(false)}>
          Got it!
        </Button>
      </Modal.Footer>
    </Modal>
    </>
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