'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Card, Row, Col, Form, InputGroup, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  FaMagic,
  FaVolumeDown,
  FaMusic,
  FaCog,
  FaWaveSquare,
  FaClock,
  FaSearch,
  FaTimes,
  FaExpand,
  FaCompress,
  FaArrowRight,
  FaPlay,
  FaInfoCircle
} from 'react-icons/fa';
import { RiEqualizerLine } from 'react-icons/ri';
import { useUI, useEffects } from '../../../../contexts/DAWProvider';

// Effects library organized by category
const EFFECTS_LIBRARY = [
  // Frequency/EQ
  {
    id: 'eq',
    name: 'Equalizer',
    category: 'Frequency',
    icon: RiEqualizerLine,
    description: '8-band parametric equalizer',
    detailedDescription: 'Shape your sound with precise frequency control',
    tooltip: 'Adjusts the volume of specific frequency ranges to shape tonal balance',
    hasVisualization: true,
    color: '#7bafd4'
  },
  {
    id: 'filter',
    name: 'Filter',
    category: 'Frequency',
    icon: FaWaveSquare,
    description: 'Multi-mode filter with LFO',
    detailedDescription: 'Classic filter types with modulation options',
    tooltip: 'Removes frequencies above or below a cutoff point to sculpt sound character',
    hasVisualization: true,
    color: '#92ce84'
  },

  // Dynamics
  {
    id: 'compressor',
    name: 'Compressor',
    category: 'Dynamics',
    icon: FaVolumeDown,
    description: 'Dynamic range control',
    detailedDescription: 'Professional compressor with visual feedback',
    tooltip: 'Reduces dynamic range by attenuating signals above a threshold',
    hasVisualization: true,
    color: '#e75b5c'
  },
  {
    id: 'limiter',
    name: 'Limiter',
    category: 'Dynamics',
    icon: FaVolumeDown,
    description: 'Peak limiting and loudness maximization',
    detailedDescription: 'Transparent limiting with lookahead',
    tooltip: 'Prevents signal peaks from exceeding a maximum level to avoid distortion',
    hasVisualization: true,
    color: '#ff6b6b'
  },
  {
    id: 'gate',
    name: 'Gate',
    category: 'Dynamics',
    icon: FaVolumeDown,
    description: 'Noise gate with threshold control',
    detailedDescription: 'Remove unwanted noise between sounds',
    tooltip: 'Mutes signals below a threshold to eliminate unwanted noise',
    hasVisualization: true,
    color: '#cbb677'
  },
  {
    id: 'distortion',
    name: 'Distortion',
    category: 'Dynamics',
    icon: FaWaveSquare,
    description: 'Harmonic saturation and drive',
    detailedDescription: 'Multiple distortion algorithms for warmth and grit',
    tooltip: 'Adds harmonic content through controlled signal clipping',
    hasVisualization: true,
    color: '#e75b5c'
  },

  // Time/Delay
  {
    id: 'echo',
    name: 'Echo',
    category: 'Time',
    icon: FaClock,
    description: 'Classic echo delay',
    detailedDescription: 'Simple to advanced echo with modulation',
    tooltip: 'Creates discrete delayed repetitions of the input signal',
    hasVisualization: false,
    color: '#92ce84'
  },
  {
    id: 'advdelay',
    name: 'Advanced Delay',
    category: 'Time',
    icon: FaClock,
    description: 'Multi-tap delay with diffusion',
    detailedDescription: 'Complex delay network with filtering',
    tooltip: 'Multi-tap delay system with filtering and modulation capabilities',
    hasVisualization: true,
    color: '#7bafd4'
  },
  {
    id: 'reverb',
    name: 'Reverb',
    category: 'Time',
    icon: FaMusic,
    description: 'Algorithmic reverb processor',
    detailedDescription: 'Create natural and artificial spaces',
    tooltip: 'Simulates acoustic reflections of physical spaces',
    hasVisualization: false,
    color: '#dda0dd'
  },
  {
    id: 'reverseverb',
    name: 'Reverse Reverb',
    category: 'Time',
    icon: FaMagic,
    description: 'Reverse reverb effect',
    detailedDescription: 'Create swelling, ethereal effects',
    tooltip: 'Pre-echo effect that builds up before the original sound',
    hasVisualization: false,
    color: '#ff69b4'
  },

  // Modulation
  {
    id: 'chorus',
    name: 'Chorus',
    category: 'Modulation',
    icon: FaMusic,
    description: 'Multi-voice chorus',
    detailedDescription: 'Rich, lush chorus with up to 8 voices',
    tooltip: 'Combines slightly detuned copies to create a fuller sound',
    hasVisualization: true,
    color: '#92ceaa'
  },
  {
    id: 'flanger',
    name: 'Flanger',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Classic flanging effect',
    detailedDescription: 'Jet-like sweeping with feedback',
    tooltip: 'Short modulated delay creating comb-filter sweeps',
    hasVisualization: false,
    color: '#ffa500'
  },
  {
    id: 'phaser',
    name: 'Phaser',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Multi-stage phaser',
    detailedDescription: '4 to 12 stage phasing with LFO',
    tooltip: 'Phase-shifted signal creates notches that sweep through frequencies',
    hasVisualization: true,
    color: '#92ce84'
  },
  {
    id: 'tremolo',
    name: 'Tremolo',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Amplitude modulation',
    detailedDescription: 'Classic tremolo with multiple waveforms',
    tooltip: 'Periodic amplitude modulation creating rhythmic volume changes',
    hasVisualization: false,
    color: '#e75b5c'
  },
  {
    id: 'autopan',
    name: 'Auto-Pan',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Automatic stereo panning',
    detailedDescription: 'Create movement in the stereo field',
    tooltip: 'Automated stereo positioning that moves sound between channels',
    hasVisualization: false,
    color: '#7bafd4'
  },
  {
    id: 'autowah',
    name: 'Auto-Wah',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Envelope-following filter',
    detailedDescription: 'Dynamic wah effect that responds to input',
    tooltip: 'Envelope-controlled filter that responds to input dynamics',
    hasVisualization: true,
    color: '#ffb347'
  },

  // Pitch
  {
    id: 'pitchshift',
    name: 'Pitch Shifter',
    category: 'Pitch',
    icon: FaMagic,
    description: 'Real-time pitch shifting',
    detailedDescription: 'Change pitch without affecting timing',
    tooltip: 'Transposes audio frequency while maintaining temporal characteristics',
    hasVisualization: true,
    color: '#9370db'
  },
  {
    id: 'freqshift',
    name: 'Frequency Shifter',
    category: 'Pitch',
    icon: FaMagic,
    description: 'Linear frequency shifting',
    detailedDescription: 'Create metallic and dissonant effects',
    tooltip: 'Linearly shifts all frequencies by a fixed amount',
    hasVisualization: false,
    color: '#ba55d3'
  },

  // Creative/Experimental
  {
    id: 'ringmod',
    name: 'Ring Modulator',
    category: 'Creative',
    icon: FaMagic,
    description: 'Ring modulation synthesis',
    detailedDescription: 'Create metallic and bell-like tones',
    tooltip: 'Multiplies two signals to generate sum and difference frequencies',
    hasVisualization: true,
    color: '#ff1493'
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'Creative',
    icon: FaMagic,
    description: 'Random glitch effects',
    detailedDescription: 'Stutter, repeat, and mangle audio',
    tooltip: 'Introduces controlled digital artifacts and repetitions',
    hasVisualization: false,
    color: '#ff4500'
  },
  {
    id: 'granular',
    name: 'Granular Freeze',
    category: 'Creative',
    icon: FaMagic,
    description: 'Granular synthesis',
    detailedDescription: 'Freeze and manipulate audio grains',
    tooltip: 'Samples and loops small audio fragments called grains',
    hasVisualization: false,
    color: '#4682b4'
  },
  {
    id: 'paulstretch',
    name: 'Paulstretch',
    category: 'Creative',
    icon: FaMagic,
    description: 'Extreme time stretching',
    detailedDescription: 'Create ambient textures from any sound',
    tooltip: 'Extreme time-stretching algorithm for ambient textures',
    hasVisualization: false,
    color: '#6495ed'
  },
  {
    id: 'spectral',
    name: 'Spectral Filter',
    category: 'Creative',
    icon: FaWaveSquare,
    description: 'FFT-based filtering',
    detailedDescription: 'Advanced spectral processing',
    tooltip: 'Frequency-domain processing for precise spectral manipulation',
    hasVisualization: false,
    color: '#00ced1'
  },

  // Stereo
  {
    id: 'stereowide',
    name: 'Stereo Widener',
    category: 'Stereo',
    icon: FaExpand,
    description: 'Enhance stereo width',
    detailedDescription: 'Widen or narrow the stereo image',
    tooltip: 'Adjusts the perceived width of the stereo image',
    hasVisualization: true,
    color: '#9370db'
  }
];

// Get categories from library
const CATEGORIES = [...new Set(EFFECTS_LIBRARY.map(e => e.category))];

export default function EffectsModal() {
  const {
    showEffectsModal,
    setShowEffectsModal,
    setShowEffectControlModal,
    setSelectedEffect,
    setEffectPreviewMode
  } = useUI();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [hoveredEffect, setHoveredEffect] = useState(null);

  // Filter effects based on search and category
  const filteredEffects = EFFECTS_LIBRARY.filter(effect => {
    const matchesSearch = effect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         effect.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || effect.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group filtered effects by category
  const effectsByCategory = filteredEffects.reduce((acc, effect) => {
    if (!acc[effect.category]) {
      acc[effect.category] = [];
    }
    acc[effect.category].push(effect);
    return acc;
  }, {});

  const handleEffectSelect = (effect) => {
    setSelectedEffect(effect);
    setShowEffectsModal(false);
    setShowEffectControlModal(true);
  };

  const handleClose = () => {
    setShowEffectsModal(false);
    setHoveredEffect(null);
    setSearchTerm('');
    setSelectedCategory('All');
  };

  return (
    <Modal
      show={showEffectsModal}
      onHide={handleClose}
      size="xl"
      fullscreen="lg-down"
      centered
      backdrop="static"
      keyboard={true}
      className="effects-modal"
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <div className="d-flex justify-content-between align-items-center w-100">
          <Modal.Title className="d-flex align-items-center gap-2">
            <RiEqualizerLine />
            Effects Studio
          </Modal.Title>
          <small className="text-info me-3">
            <FaInfoCircle className="me-1" />
            Hover for tips!
          </small>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0" style={{ height: '80vh', backgroundColor: '#1a1a1a' }}>
        <div className="h-100">
          <div className="p-4 h-100 d-flex flex-column">
              {/* Search and Filter Bar */}
              <div className="mb-3">
                <Row className="g-2">
                  <Col md={7}>
                    <InputGroup>
                      <InputGroup.Text className="bg-secondary border-secondary">
                        <FaSearch className="text-white" />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search effects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-dark text-white border-secondary"
                      />
                    </InputGroup>
                  </Col>
                  <Col md={5}>
                    <Form.Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-secondary text-white border-secondary"
                    >
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>
              </div>

              {/* Effects Grid */}
              <div className="flex-grow-1 overflow-auto">
                {Object.entries(effectsByCategory).map(([category, effects]) => (
                  <div key={category} className="mb-4">
                    <h5 className="text-white mb-3 border-bottom border-secondary pb-2">
                      {category}
                    </h5>
                    <Row className="g-3">
                      {effects.map(effect => {
                        const Icon = effect.icon;
                        return (
                          <Col key={effect.id} xs={12} sm={6} md={4} lg={3}>
                            <OverlayTrigger
                              placement="top"
                              delay={{ show: 1500, hide: 100 }}
                              overlay={
                                <Tooltip id={`tooltip-${effect.id}`}>
                                  {effect.tooltip}
                                </Tooltip>
                              }
                            >
                              <Card
                                className="effect-card h-100 bg-dark text-white border-secondary"
                                style={{
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  borderColor: hoveredEffect?.id === effect.id ? effect.color : undefined,
                                  transform: hoveredEffect?.id === effect.id ? 'translateY(-2px)' : undefined,
                                  boxShadow: hoveredEffect?.id === effect.id ? `0 4px 12px ${effect.color}44` : undefined
                                }}
                                onMouseEnter={() => setHoveredEffect(effect)}
                                onMouseLeave={() => setHoveredEffect(null)}
                                onClick={() => handleEffectSelect(effect)}
                              >
                                <Card.Body className="d-flex flex-column p-3">
                                  <div className="text-center mb-3">
                                    <div
                                      className="effect-icon mx-auto mb-2 p-3 rounded-circle"
                                      style={{
                                        backgroundColor: effect.color + '22',
                                        width: '60px',
                                        height: '60px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <Icon size={28} style={{ color: effect.color }} />
                                    </div>
                                    <h6 className="mb-1">{effect.name}</h6>
                                    <small className="text-muted d-block">
                                      {effect.description}
                                    </small>
                                  </div>
                                  {effect.hasVisualization && (
                                    <Badge
                                      bg="dark"
                                      className="mt-auto mx-auto"
                                      style={{
                                        fontSize: '0.65rem',
                                        border: `1px solid ${effect.color}44`
                                      }}
                                    >
                                      <FaPlay size={8} className="me-1" />
                                      Visual
                                    </Badge>
                                  )}
                                </Card.Body>
                              </Card>
                            </OverlayTrigger>
                          </Col>
                        );
                      })}
                    </Row>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}