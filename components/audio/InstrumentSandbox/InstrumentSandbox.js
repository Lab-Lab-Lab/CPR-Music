'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { FaPlay, FaStop, FaVolumeUp, FaSave, FaFolder, FaCog } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
import SynthControls from './SynthControls';
import AdvancedSynthControls from './AdvancedSynthControls';
import PianoKeyboard from '../DAW/Multitrack/PianoKeyboard';
import SandboxSynth from './SandboxSynth';
import PresetManager from './PresetManager';
import WaveformVisualizer from './WaveformVisualizer';

const InstrumentSandbox = () => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const [currentPreset, setCurrentPreset] = useState('default');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [analyserNode, setAnalyserNode] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(true); // Show advanced by default

  // Synth parameters state
  const [synthParams, setSynthParams] = useState({
    // Basic parameters
    oscillatorType: 'sawtooth',
    filterCutoff: 8000,  // Higher default for better audibility
    filterResonance: 2,  // Lower default resonance
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    detune: 0,
    lfoRate: 4,
    lfoAmount: 0,
    reverb: 0,
    delay: 0,
    distortion: 0,

    // Advanced parameters (only implemented features)
    // Oscillator 2
    osc2Enabled: false,
    osc2Type: 'sawtooth',
    osc2Detune: 7,
    osc2Pitch: 0,
    oscMix: 50,

    // Sub oscillator
    subOscEnabled: false,
    subOscType: 'square',
    subOscLevel: 50,

    // Noise
    noiseLevel: 0,
    noiseType: 'white',

    // Filter type
    filterType: 'lowpass',

    // Filter Envelope
    filterEnvAmount: 0,
    filterAttack: 0.01,
    filterDecay: 0.2,
    filterSustain: 0.5,
    filterRelease: 0.3,

    // Pulse Width Modulation
    pulseWidth: 50,
    pwmAmount: 0,
    pwmRate: 4,

    // LFO 2
    lfo2Target: 'off',
    lfo2Rate: 2,
    lfo2Amount: 0,

    // Cross Modulation
    fmAmount: 0,
    ringModAmount: 0,
    oscSync: false,

    // Experimental/Digital Effects
    bitCrushBits: 16,    // 1-16 bits
    bitCrushRate: 44100, // Sample rate reduction
    waveFoldAmount: 0,    // Wave folding distortion
    feedbackAmount: 0,    // Internal feedback loop
    formantShift: 0,      // Vowel-like formant filtering
    unisonVoices: 1,      // Number of unison voices (1-8)
    unisonDetune: 10,     // Detune spread for unison (cents)
    portamentoTime: 0,    // Glide time in seconds
    stereoSpread: 0,      // Stereo width (0-100%)
    hardClip: 0,          // Hard clipping amount (0-100%)
    freqShift: 0,         // Frequency shift in Hz (-500 to 500)

    // Granular/Buffer Effects
    grainSize: 100,       // Grain size in ms
    grainSpeed: 1.0,      // Playback speed
    grainReverse: false,  // Reverse grains
    grainFreeze: false,   // Freeze/hold buffer

    // Comb Filter
    combFreq: 440,        // Comb filter frequency
    combFeedback: 0,      // Resonance amount
    combMix: 0,           // Dry/wet mix

    // Sample & Hold
    sampleHoldRate: 10,   // S&H rate in Hz
    sampleHoldAmount: 0,  // Amount of S&H modulation
    sampleHoldTarget: 'pitch' // What to modulate
  });

  // Refs
  const synthRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize audio context and synth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      synthRef.current = new SandboxSynth(audioContextRef.current);
      synthRef.current.connect(audioContextRef.current.destination);
      synthRef.current.setVolume(masterVolume);

      // Get analyser node for visualization
      setAnalyserNode(synthRef.current.getAnalyser());

      // Apply initial params
      synthRef.current.updateParams(synthParams);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update synth when parameters change
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.updateParams(synthParams);
    }
  }, [synthParams]);

  // Update master volume
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.setVolume(masterVolume);
    }
  }, [masterVolume]);

  // Handle parameter changes from controls
  const handleParamChange = useCallback((param, value) => {
    setSynthParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Handle note events from piano
  const handleNoteClick = useCallback((note, type) => {
    if (!synthRef.current || !audioContextRef.current) return;

    if (type === 'down') {
      synthRef.current.playNote(note, 100, audioContextRef.current.currentTime);
      setActiveNotes(prev => [...prev, note]);
    } else if (type === 'up') {
      synthRef.current.stopNote(note, audioContextRef.current.currentTime);
      setActiveNotes(prev => prev.filter(n => n !== note));
    }
  }, []);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset) => {
    setSynthParams(preset.params);
    setCurrentPreset(preset.name);
    setShowPresetModal(false);
  }, []);

  // Handle preset save
  const handlePresetSave = useCallback((name) => {
    // This will be handled by PresetManager
    const preset = {
      name,
      params: synthParams,
      timestamp: Date.now()
    };
    // Save to localStorage or backend
    const existingPresets = JSON.parse(localStorage.getItem('instrumentPresets') || '[]');
    existingPresets.push(preset);
    localStorage.setItem('instrumentPresets', JSON.stringify(existingPresets));
    return preset;
  }, [synthParams]);

  return (
    <Container fluid className="instrument-sandbox p-0">
      {/* Main Studio Container */}
      <Card className="border-0 shadow-lg" style={{ backgroundColor: '#0a0a0a' }}>
        <Card.Body className="p-4">
          {/* Header Controls */}
          <Card className="mb-3 border-0 shadow-sm" style={{ backgroundColor: '#1a1a1a' }}>
            <Card.Body className="py-2">
              <Row className="align-items-center">
                <Col xs="auto">
                  <div className="d-flex align-items-center gap-2">
                    <GiSoundWaves size={24} className="text-light" />
                    <h5 className="mb-0 text-light">Virtual Instrument Designer</h5>
                  </div>
                </Col>
                <Col xs="auto" className="ms-auto">
                  <ButtonGroup size="sm">
                    <Button
                      variant={isPlaying ? 'danger' : 'success'}
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <FaStop /> : <FaPlay />}
                      {isPlaying ? ' Stop' : ' Test'}
                    </Button>
                    <Button
                      variant="light"
                      className="preset-btn"
                      onClick={() => setShowPresetModal(true)}
                    >
                      <FaFolder /> Presets
                    </Button>
                    <Button
                      variant="primary"
                      className="save-btn"
                      onClick={() => {
                        const name = prompt('Enter preset name:');
                        if (name) handlePresetSave(name);
                      }}
                    >
                      <FaSave /> Save
                    </Button>
                    <Button
                      variant={showAdvanced ? 'warning' : 'light'}
                      className="advanced-btn"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <FaCog /> {showAdvanced ? 'Basic' : 'Advanced'}
                    </Button>
                  </ButtonGroup>
                </Col>
                <Col xs="auto">
                  <div className="d-flex align-items-center gap-2">
                    <FaVolumeUp className="text-light" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={masterVolume * 100}
                      onChange={(e) => setMasterVolume(e.target.value / 100)}
                      style={{ width: '100px' }}
                      className="form-range"
                    />
                    <Badge bg="secondary" style={{ backgroundColor: '#6c757d', color: '#fff' }}>{Math.round(masterVolume * 100)}%</Badge>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

      {/* Main Content */}
      <Row className="g-3">
        {/* Synth Controls */}
        <Col lg={8}>
          <Card className="h-100 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
            <Card.Body>
              <SynthControls
                params={synthParams}
                onParamChange={handleParamChange}
              />
            </Card.Body>
          </Card>
        </Col>

        {/* Visual Feedback */}
        <Col lg={4}>
          <Card className="h-100 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
            <Card.Header className="bg-dark text-light border-0">
              <h6 className="mb-0">Waveform Visualizer</h6>
            </Card.Header>
            <Card.Body className="p-2" style={{ backgroundColor: '#1a1a1a' }}>
              <WaveformVisualizer
                analyserNode={analyserNode}
                isPlaying={isPlaying}
                activeNotes={activeNotes}
              />

              {/* Current Preset Display */}
              <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#1a1a1a' }}>
                <small className="text-muted">Current Preset</small>
                <h6 className="text-light mb-0">{currentPreset}</h6>
              </div>

              {/* Active Notes Display */}
              <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#1a1a1a' }}>
                <small className="text-muted">Active Notes</small>
                <div className="mt-2">
                  {activeNotes.length > 0 ? (
                    activeNotes.map(note => (
                      <Badge key={note} bg="primary" className="me-1">
                        {note}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted small">No active notes</span>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Advanced Controls */}
      {showAdvanced && (
        <div className="mt-3">
          <AdvancedSynthControls
            params={synthParams}
            onParamChange={handleParamChange}
          />
        </div>
      )}

      {/* Piano Keyboard */}
      <Card className="mt-3 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
        <Card.Header className="bg-dark text-light border-0">
          <h6 className="mb-0">Virtual Keyboard</h6>
        </Card.Header>
        <Card.Body className="d-flex justify-content-center" style={{ backgroundColor: '#1a1a1a' }}>
          <PianoKeyboard
            startNote={36} // C2
            endNote={84}   // C6
            activeNotes={activeNotes}
            onNoteClick={handleNoteClick}
            width={900}
            height={150}
            showNoteNames={true}
            captureComputerKeyboard={true}
          />
        </Card.Body>
        <Card.Footer className="bg-dark border-0" style={{ color: '#adb5bd' }}>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong style={{ color: '#dee2e6' }}>Keyboard Controls:</strong> Z-M (white keys), S/D/G/H/J (black keys) | Q-I (upper octave) | [ ] (shift octave)
            </div>
            <div>
              Press and hold keys to sustain notes
            </div>
          </div>
        </Card.Footer>
      </Card>

      {/* Preset Manager Modal */}
      {showPresetModal && (
        <PresetManager
          show={showPresetModal}
          onHide={() => setShowPresetModal(false)}
          onSelect={handlePresetSelect}
          currentPreset={currentPreset}
        />
      )}

        </Card.Body>
      </Card>

      {/* Inline styles for dark theme */}
      <style jsx>{`
        .instrument-sandbox {
          min-height: 600px;
        }

        .form-range {
          accent-color: #0d6efd;
        }

        /* Preset button - White/Light color */
        .instrument-sandbox :global(.preset-btn) {
          background-color: #fff !important;
          color: #212529 !important;
          border: 1px solid #dee2e6 !important;
        }

        .instrument-sandbox :global(.preset-btn:hover) {
          background-color: #f8f9fa !important;
          border-color: #dee2e6 !important;
          color: #212529 !important;
        }

        /* Save button - Purple color */
        .instrument-sandbox :global(.save-btn) {
          background-color: #9b59b6 !important;
          color: #fff !important;
          border: 1px solid #9b59b6 !important;
        }

        .instrument-sandbox :global(.save-btn:hover) {
          background-color: #8b49a6 !important;
          border-color: #8b49a6 !important;
          color: #fff !important;
        }

        /* Advanced button - light variant */
        .instrument-sandbox :global(.advanced-btn.btn-light) {
          background-color: #f8f9fa;
          color: #212529;
          border: 1px solid #dee2e6;
        }

        .instrument-sandbox :global(.advanced-btn.btn-light:hover) {
          background-color: #e2e6ea;
          border-color: #dae0e5;
        }

        .instrument-sandbox :global(.advanced-btn.btn-warning:hover) {
          opacity: 0.9;
        }
      `}</style>
    </Container>
  );
};

export default InstrumentSandbox;