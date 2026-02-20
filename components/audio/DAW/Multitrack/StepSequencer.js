// components/audio/DAW/Multitrack/StepSequencer.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { Modal, Button, Form, ButtonGroup, Badge } from 'react-bootstrap';
import {
  FaPlay,
  FaStop,
  FaCopy,
  FaTrash,
  FaSave,
  FaDrum,
  FaRandom,
  FaVolumeUp,
} from 'react-icons/fa';

// Default drum kit mapping
const DRUM_MAP = {
  Kick: 60, // C3
  Snare: 62, // D3
  'Closed HH': 64, // E3
  'Open HH': 65, // F3
  Crash: 67, // G3
  Ride: 69, // A3
  'Low Tom': 71, // B3 (using kick sound)
  'Mid Tom': 72, // C4 (using kick sound)
  'High Tom': 74, // D4 (using snare sound)
  Clap: 76, // E4 (using hihat sound)
  Cowbell: 77, // F4 (using openhat sound)
  Rimshot: 79, // G4 (using crash sound)
};

// Predefined patterns
const PRESET_PATTERNS = {
  'Basic Rock': {
    Kick: [0, 8],
    Snare: [4, 12],
    'Closed HH': [0, 2, 4, 6, 8, 10, 12, 14],
  },
  'Hip Hop': {
    Kick: [0, 3, 10],
    Snare: [4, 12],
    'Closed HH': [0, 2, 4, 6, 8, 10, 12, 14],
  },
  House: {
    Kick: [0, 4, 8, 12],
    Clap: [4, 12],
    'Open HH': [2, 6, 10, 14],
  },
  Trap: {
    Kick: [0, 7, 10],
    Snare: [4, 12],
    'Closed HH': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    'Open HH': [14],
  },
  Breakbeat: {
    Kick: [0, 10],
    Snare: [5, 13],
    'Closed HH': [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

export default function StepSequencer({
  show,
  onHide,
  instrument,
  onSave,
  initialPattern = null,
  trackName = 'Drum Pattern',
}) {
  const [steps, setSteps] = useState(16);
  const [bars, setBars] = useState(1);
  const [selectedDrums, setSelectedDrums] = useState([
    'Kick',
    'Snare',
    'Closed HH',
  ]);
  const [pattern, setPattern] = useState({});
  const [velocity, setVelocity] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [tempo, setTempo] = useState(120);
  const [swing, setSwing] = useState(0);
  const playbackRef = useRef(null);
  const audioContextRef = useRef(null);
  const instrumentRef = useRef(null);

  // Initialize pattern
  useEffect(() => {
    if (initialPattern) {
      // Load from existing pattern
      const loadedPattern = {};
      initialPattern.notes.forEach((note) => {
        const drumName = Object.keys(DRUM_MAP).find(
          (key) => DRUM_MAP[key] === note.note,
        );
        if (drumName) {
          const step = Math.floor(note.startTime * 4); // Convert beat to step
          if (!loadedPattern[drumName]) loadedPattern[drumName] = [];
          loadedPattern[drumName].push(step);
        }
      });
      setPattern(loadedPattern);
    } else {
      // Initialize empty pattern
      const emptyPattern = {};
      selectedDrums.forEach((drum) => {
        emptyPattern[drum] = [];
      });
      setPattern(emptyPattern);
    }
  }, [initialPattern, selectedDrums]);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    // Create a simple drum instrument if not provided
    if (!instrumentRef.current && instrument) {
      instrumentRef.current = instrument;
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [instrument]);

  // Toggle step
  const toggleStep = (drum, step) => {
    setPattern((prev) => {
      const newPattern = { ...prev };
      if (!newPattern[drum]) newPattern[drum] = [];

      const stepIndex = newPattern[drum].indexOf(step);
      if (stepIndex > -1) {
        newPattern[drum] = newPattern[drum].filter((s) => s !== step);
      } else {
        newPattern[drum] = [...newPattern[drum], step].sort((a, b) => a - b);
      }

      return newPattern;
    });
  };

  // Clear pattern
  const clearPattern = () => {
    const emptyPattern = {};
    selectedDrums.forEach((drum) => {
      emptyPattern[drum] = [];
    });
    setPattern(emptyPattern);
  };

  // Load preset
  const loadPreset = (presetName) => {
    const preset = PRESET_PATTERNS[presetName];
    const newPattern = {};

    // Copy preset pattern
    Object.keys(preset).forEach((drum) => {
      if (selectedDrums.includes(drum)) {
        newPattern[drum] = [...preset[drum]];
      }
    });

    // Fill empty drums
    selectedDrums.forEach((drum) => {
      if (!newPattern[drum]) newPattern[drum] = [];
    });

    setPattern(newPattern);
  };

  // Generate random pattern
  const generateRandom = () => {
    const newPattern = {};
    selectedDrums.forEach((drum) => {
      newPattern[drum] = [];
      const density = drum === 'Kick' ? 0.25 : drum === 'Snare' ? 0.15 : 0.4;

      for (let i = 0; i < steps * bars; i++) {
        if (Math.random() < density) {
          newPattern[drum].push(i);
        }
      }
    });
    setPattern(newPattern);
  };

  // Play/stop pattern
  const togglePlayback = () => {
    if (isPlaying) {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      setIsPlaying(true);
      let step = 0;

      const stepDuration = 60000 / (tempo * 4); // 16th notes

      playbackRef.current = setInterval(() => {
        setCurrentStep(step);

        // Play drums for this step
        selectedDrums.forEach((drum) => {
          if (pattern[drum] && pattern[drum].includes(step)) {
            if (instrumentRef.current) {
              instrumentRef.current.playNote(DRUM_MAP[drum], velocity / 127);
              setTimeout(() => {
                instrumentRef.current.stopNote(DRUM_MAP[drum]);
              }, 50);
            }
          }
        });

        step = (step + 1) % (steps * bars);
      }, stepDuration);
    }
  };

  // Stop playback on unmount
  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, []);

  // Convert pattern to notes
  const convertToNotes = () => {
    const notes = [];
    const stepDuration = 0.25; // 16th note duration in beats

    Object.entries(pattern).forEach(([drum, steps]) => {
      steps.forEach((step) => {
        notes.push({
          id: `drum-${drum}-${step}-${Date.now()}`,
          note: DRUM_MAP[drum],
          velocity: velocity,
          startTime: step * stepDuration,
          duration: 0.1,
        });
      });
    });

    return notes;
  };

  // Save pattern
  const handleSave = () => {
    const patternData = {
      id: `pattern-${Date.now()}`,
      name: trackName,
      length: bars,
      notes: convertToNotes(),
      color: '#ce6a6a',
      type: 'drums',
    };

    onSave(patternData);
  };

  // Add/remove drum
  const toggleDrum = (drum) => {
    if (selectedDrums.includes(drum)) {
      setSelectedDrums((prev) => prev.filter((d) => d !== drum));
      setPattern((prev) => {
        const newPattern = { ...prev };
        delete newPattern[drum];
        return newPattern;
      });
    } else {
      setSelectedDrums((prev) => [...prev, drum]);
      setPattern((prev) => ({
        ...prev,
        [drum]: [],
      }));
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      className="step-sequencer-modal"
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaDrum className="me-2" />
          Step Sequencer - {trackName}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        {/* Controls */}
        <div className="mb-3 p-3 bg-secondary rounded">
          <div className="row g-3">
            {/* Playback controls */}
            <div className="col-auto">
              <Button
                variant={isPlaying ? 'danger' : 'success'}
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <FaStop className="me-1" />
                ) : (
                  <FaPlay className="me-1" />
                )}
                {isPlaying ? 'Stop' : 'Play'}
              </Button>
            </div>

            {/* Pattern controls */}
            <div className="col-auto">
              <ButtonGroup>
                <Button
                  variant="outline-light"
                  onClick={clearPattern}
                  size="sm"
                >
                  <FaTrash className="me-1" /> Clear
                </Button>
                <Button
                  variant="outline-light"
                  onClick={generateRandom}
                  size="sm"
                >
                  <FaRandom className="me-1" /> Random
                </Button>
              </ButtonGroup>
            </div>

            {/* Presets */}
            <div className="col-auto">
              <Form.Select
                size="sm"
                onChange={(e) => e.target.value && loadPreset(e.target.value)}
                className="bg-secondary text-white"
              >
                <option value="">Load Preset...</option>
                {Object.keys(PRESET_PATTERNS).map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </Form.Select>
            </div>

            {/* Tempo */}
            <div className="col-auto">
              <div className="d-flex align-items-center">
                <Form.Label className="text-white mb-0 me-2">BPM:</Form.Label>
                <Form.Control
                  type="number"
                  min="60"
                  max="200"
                  value={tempo}
                  onChange={(e) => setTempo(parseInt(e.target.value))}
                  size="sm"
                  style={{ width: '70px' }}
                  className="bg-secondary text-white"
                />
              </div>
            </div>

            {/* Length */}
            <div className="col-auto">
              <div className="d-flex align-items-center">
                <Form.Label className="text-white mb-0 me-2">Bars:</Form.Label>
                <ButtonGroup size="sm">
                  {[1, 2, 4].map((b) => (
                    <Button
                      key={b}
                      variant={bars === b ? 'primary' : 'outline-secondary'}
                      onClick={() => setBars(b)}
                    >
                      {b}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>

            {/* Velocity */}
            <div className="col">
              <div className="d-flex align-items-center">
                <Form.Label className="text-white mb-0 me-2">
                  <FaVolumeUp /> Velocity:
                </Form.Label>
                <Form.Range
                  min="0"
                  max="127"
                  value={velocity}
                  onChange={(e) => setVelocity(parseInt(e.target.value))}
                  className="flex-grow-1"
                />
                <Badge bg="secondary" className="ms-2">
                  {velocity}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Drum selector */}
        <div className="mb-3">
          <small className="text-white-50">Select drums to show:</small>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {Object.keys(DRUM_MAP).map((drum) => (
              <Button
                key={drum}
                size="sm"
                variant={
                  selectedDrums.includes(drum) ? 'primary' : 'outline-secondary'
                }
                onClick={() => toggleDrum(drum)}
              >
                {drum}
              </Button>
            ))}
          </div>
        </div>

        {/* Step grid */}
        <div className="step-sequencer-grid">
          <table className="w-100">
            <thead>
              <tr>
                <th className="text-white" style={{ width: '100px' }}>
                  Drum
                </th>
                {Array.from({ length: steps * bars }, (_, i) => (
                  <th
                    key={i}
                    className="text-center"
                    style={{ width: `${100 / (steps * bars)}%` }}
                  >
                    <small
                      className={`text-white-50 ${currentStep === i ? 'text-danger' : ''}`}
                    >
                      {i % 4 === 0 ? i / 4 + 1 : ''}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedDrums.map((drum) => (
                <tr key={drum}>
                  <td className="text-white">{drum}</td>
                  {Array.from({ length: steps * bars }, (_, i) => (
                    <td key={i} className="p-1">
                      <button
                        className={`step-button w-100 ${
                          pattern[drum]?.includes(i) ? 'active' : ''
                        } ${currentStep === i ? 'playing' : ''}`}
                        onClick={() => toggleStep(drum, i)}
                        style={{
                          aspectRatio: '1',
                          backgroundColor: pattern[drum]?.includes(i)
                            ? currentStep === i
                              ? '#ff6a6a'
                              : '#ce6a6a'
                            : currentStep === i
                              ? '#3a3a3a'
                              : '#2a2a2a',
                          border: `1px solid ${i % 4 === 0 ? '#666' : '#444'}`,
                          borderRadius: '2px',
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 bg-secondary bg-opacity-25 rounded">
          <small className="text-white-50">
            <strong>Tips:</strong> Click boxes to add/remove beats • Numbers
            show bar positions • Red highlight follows playback • Try the
            presets for inspiration
          </small>
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          <FaSave className="me-1" /> Save Pattern
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
