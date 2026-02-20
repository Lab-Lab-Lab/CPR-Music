'use client';

import React, { useState } from 'react';
import { Modal, Button, Card, Row, Col, Badge, Form, InputGroup, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaMagic, FaVolumeDown, FaMusic, FaCog, FaWaveSquare, FaRandom, FaSearch, FaFilter, FaMicrochip, FaGraduationCap, FaInfoCircle, FaPlay } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

// Complete effects library from mono editor with detailed metadata
const EFFECTS_LIBRARY = [
  // Frequency/EQ
  {
    id: 'eq',
    name: 'EQ',
    category: 'Frequency',
    icon: FaCog,
    description: '8-band parametric equalizer',
    detailedDescription: 'Professional parametric EQ with 8 frequency bands, adjustable Q, and multiple filter types.',
    parameters: ['frequency', 'gain', 'Q', 'filterType'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['equalizer', 'frequency', 'tone', 'mixing'],
    hasVisualization: true
  },
  {
    id: 'spectralFilter',
    name: 'Spectral Filter',
    category: 'Frequency',
    icon: FaWaveSquare,
    description: 'Advanced frequency-domain filtering',
    detailedDescription: 'FFT-based spectral processing for surgical frequency manipulation and creative sound design.',
    parameters: ['cutoff', 'resonance', 'morphing', 'spectralShape'],
    difficulty: 'Advanced',
    cpuUsage: 'High',
    tags: ['spectral', 'experimental', 'frequency', 'creative'],
    hasVisualization: false
  },

  // Dynamics
  {
    id: 'compressor',
    name: 'Compressor',
    category: 'Dynamics',
    icon: FaVolumeDown,
    description: 'Professional dynamic range compressor',
    detailedDescription: 'Full-featured compressor with adjustable threshold, ratio, attack, release, knee, and makeup gain.',
    parameters: ['threshold', 'ratio', 'attack', 'release', 'knee', 'makeup'],
    difficulty: 'Intermediate',
    cpuUsage: 'Low',
    tags: ['dynamics', 'compression', 'mixing', 'leveling'],
    hasVisualization: true
  },
  {
    id: 'gate',
    name: 'Gate',
    category: 'Dynamics',
    icon: FaVolumeDown,
    description: 'Noise gate with threshold control',
    detailedDescription: 'Intelligent noise gate that automatically mutes audio below a set threshold level.',
    parameters: ['threshold', 'attack', 'release', 'holdTime'],
    difficulty: 'Beginner',
    cpuUsage: 'Low',
    tags: ['gate', 'noise', 'cleanup', 'threshold'],
    hasVisualization: true
  },
  {
    id: 'distortion',
    name: 'Distortion',
    category: 'Dynamics',
    icon: FaWaveSquare,
    description: 'Harmonic saturation and distortion',
    detailedDescription: 'Versatile distortion effect with multiple saturation algorithms and tone shaping.',
    parameters: ['drive', 'tone', 'outputGain', 'saturationMode'],
    difficulty: 'Beginner',
    cpuUsage: 'Low',
    tags: ['distortion', 'saturation', 'warmth', 'harmonics'],
    hasVisualization: true
  },
  
  // Time/Delay
  {
    id: 'echo',
    name: 'Echo',
    category: 'Time',
    icon: FaMusic,
    description: 'Classic echo delay effect',
    detailedDescription: 'Simple and musical echo with adjustable delay time, feedback, and wet/dry mix.',
    parameters: ['delayTime', 'feedback', 'wetDryMix', 'highCut'],
    difficulty: 'Beginner',
    cpuUsage: 'Low',
    tags: ['echo', 'delay', 'repeat', 'space'],
    hasVisualization: false
  },
  {
    id: 'advancedDelay',
    name: 'Advanced Delay',
    category: 'Time',
    icon: FaMusic,
    description: 'Multi-tap delay with filtering',
    detailedDescription: 'Professional delay with multiple taps, stereo positioning, filtering, and modulation.',
    parameters: ['delayTime', 'feedback', 'taps', 'stereoSpread', 'filtering'],
    difficulty: 'Advanced',
    cpuUsage: 'Medium',
    tags: ['delay', 'multi-tap', 'stereo', 'filtering'],
    hasVisualization: true
  },
  {
    id: 'paulstretch',
    name: 'Paulstretch',
    category: 'Time',
    icon: FaCog,
    description: 'Extreme time stretching',
    detailedDescription: 'Paulstretch algorithm for extreme time stretching without pitch change, perfect for ambient textures.',
    parameters: ['stretchRatio', 'windowSize', 'overlap'],
    difficulty: 'Advanced',
    cpuUsage: 'High',
    tags: ['timestretch', 'ambient', 'experimental', 'texture'],
    hasVisualization: false
  },
  
  // Space/Reverb
  {
    id: 'reverb',
    name: 'Reverb',
    category: 'Space',
    icon: FaMusic,
    description: 'Algorithmic reverb processor',
    detailedDescription: 'High-quality algorithmic reverb with multiple room types, pre-delay, and damping controls.',
    parameters: ['roomSize', 'damping', 'predelay', 'wetDryMix', 'stereoWidth'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['reverb', 'space', 'ambient', 'room'],
    hasVisualization: false
  },
  {
    id: 'reverseReverb',
    name: 'Reverse Reverb',
    category: 'Space',
    icon: FaMagic,
    description: 'Backwards reverb effect',
    detailedDescription: 'Creates reversed reverb tails that build up to the original signal for dramatic effect.',
    parameters: ['reverseTime', 'buildUp', 'wetDryMix'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['reverse', 'creative', 'buildup', 'dramatic'],
    hasVisualization: false
  },
  {
    id: 'autoPan',
    name: 'Auto Pan',
    category: 'Space',
    icon: FaRandom,
    description: 'Automatic stereo panning',
    detailedDescription: 'Rhythmic auto-panning with multiple waveform shapes and tempo sync options.',
    parameters: ['rate', 'depth', 'waveform', 'tempoSync'],
    difficulty: 'Beginner',
    cpuUsage: 'Low',
    tags: ['pan', 'stereo', 'movement', 'rhythm'],
    hasVisualization: false
  },
  {
    id: 'stereoWidener',
    name: 'Stereo Widener',
    category: 'Space',
    icon: FaRandom,
    description: 'Stereo field expansion',
    detailedDescription: 'Expands or narrows the stereo image using phase and delay techniques.',
    parameters: ['width', 'bassMonoFreq', 'stereoBalance'],
    difficulty: 'Intermediate',
    cpuUsage: 'Low',
    tags: ['stereo', 'width', 'imaging', 'space'],
    hasVisualization: true
  },
  
  // Modulation
  {
    id: 'chorus',
    name: 'Chorus',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Rich pitch modulation chorus',
    detailedDescription: 'Classic chorus effect with multiple voices, variable delay, and pitch modulation.',
    parameters: ['rate', 'depth', 'voices', 'predelay', 'wetDryMix'],
    difficulty: 'Beginner',
    cpuUsage: 'Medium',
    tags: ['chorus', 'modulation', 'richness', 'ensemble'],
    hasVisualization: true
  },
  {
    id: 'flanger',
    name: 'Flanger',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Sweeping comb filter effect',
    detailedDescription: 'Classic flanger with variable delay, feedback, and LFO modulation for that iconic swoosh.',
    parameters: ['rate', 'depth', 'feedback', 'delay', 'wetDryMix'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['flanger', 'sweep', 'jet', 'modulation'],
    hasVisualization: false
  },
  {
    id: 'phaser',
    name: 'Phaser',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Phase shifting modulation',
    detailedDescription: 'Multi-stage phaser with adjustable stages, feedback, and modulation rate.',
    parameters: ['rate', 'depth', 'stages', 'feedback', 'wetDryMix'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['phaser', 'phase', 'sweep', 'vintage'],
    hasVisualization: true
  },
  {
    id: 'tremolo',
    name: 'Tremolo',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Amplitude modulation effect',
    detailedDescription: 'Classic tremolo with variable rate, depth, and waveform shapes.',
    parameters: ['rate', 'depth', 'waveform', 'tempoSync'],
    difficulty: 'Beginner',
    cpuUsage: 'Low',
    tags: ['tremolo', 'amplitude', 'vintage', 'modulation'],
    hasVisualization: false
  },
  {
    id: 'autoWah',
    name: 'Auto Wah',
    category: 'Modulation',
    icon: FaWaveSquare,
    description: 'Automatic wah filter',
    detailedDescription: 'Envelope-following wah filter that responds to input dynamics.',
    parameters: ['sensitivity', 'range', 'resonance', 'attack', 'release'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['wah', 'filter', 'envelope', 'dynamic'],
    hasVisualization: true
  },
  
  // Pitch
  {
    id: 'pitchShifter',
    name: 'Pitch Shifter',
    category: 'Pitch',
    icon: FaMagic,
    description: 'Real-time pitch shifting',
    detailedDescription: 'High-quality pitch shifting without time change, with formant correction options.',
    parameters: ['pitch', 'formantCorrection', 'wetDryMix'],
    difficulty: 'Intermediate',
    cpuUsage: 'High',
    tags: ['pitch', 'transpose', 'harmony', 'correction'],
    hasVisualization: true
  },
  {
    id: 'frequencyShifter',
    name: 'Frequency Shifter',
    category: 'Pitch',
    icon: FaMagic,
    description: 'Linear frequency shifting',
    detailedDescription: 'Linear frequency shifting that moves all frequencies by a fixed amount, creating metallic effects.',
    parameters: ['shift', 'wetDryMix', 'feedback'],
    difficulty: 'Advanced',
    cpuUsage: 'Medium',
    tags: ['frequency', 'shift', 'metallic', 'experimental'],
    hasVisualization: false
  },

  // Creative/Experimental
  {
    id: 'ringModulator',
    name: 'Ring Modulator',
    category: 'Creative',
    icon: FaMagic,
    description: 'Ring modulation synthesis',
    detailedDescription: 'Classic ring modulation effect for creating metallic, bell-like, and robotic sounds.',
    parameters: ['carrierFreq', 'amount', 'waveform'],
    difficulty: 'Advanced',
    cpuUsage: 'Low',
    tags: ['ring', 'modulation', 'metallic', 'synthesis'],
    hasVisualization: true
  },
  {
    id: 'granularFreeze',
    name: 'Granular Freeze',
    category: 'Creative',
    icon: FaMagic,
    description: 'Granular synthesis freezing',
    detailedDescription: 'Captures and granularly reconstructs audio fragments for ambient textures and soundscapes.',
    parameters: ['grainSize', 'position', 'density', 'pitch'],
    difficulty: 'Advanced',
    cpuUsage: 'High',
    tags: ['granular', 'freeze', 'ambient', 'texture'],
    hasVisualization: false
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'Creative',
    icon: FaRandom,
    description: 'Digital glitch effects',
    detailedDescription: 'Collection of digital artifacts including bit crushing, sample rate reduction, and buffer scrambling.',
    parameters: ['intensity', 'glitchType', 'rate', 'amount'],
    difficulty: 'Intermediate',
    cpuUsage: 'Medium',
    tags: ['glitch', 'digital', 'artifacts', 'experimental'],
    hasVisualization: false
  },
];

const CATEGORY_COLORS = {
  'Frequency': 'primary',
  'Dynamics': 'success',
  'Time': 'info',
  'Space': 'warning',
  'Modulation': 'secondary',
  'Pitch': 'danger',
  'Creative': 'dark'
};

export default function EffectSelectionModal() {
  const {
    showEffectSelectionModal,
    setShowEffectSelectionModal,
    setShowEffectParametersModal,
    setSelectedEffectType,
    effectTargetTrackId,
    tracks
  } = useMultitrack();

  // Local state for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCpuUsage, setSelectedCpuUsage] = useState('All');

  const targetTrack = tracks.find(t => t.id === effectTargetTrackId);

  const handleEffectSelect = (effectId) => {
    setSelectedEffectType(effectId);
    setShowEffectSelectionModal(false);
    setShowEffectParametersModal(true);
  };

  const handleClose = () => {
    setShowEffectSelectionModal(false);
    setSelectedEffectType(null);
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedDifficulty('All');
    setSelectedCpuUsage('All');
    // Don't clear effectTargetTrackId in case user wants to try again
  };

  // Filter effects based on search and filters
  const filteredEffects = EFFECTS_LIBRARY.filter(effect => {
    const matchesSearch = effect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         effect.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         effect.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || effect.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || effect.difficulty === selectedDifficulty;
    const matchesCpuUsage = selectedCpuUsage === 'All' || effect.cpuUsage === selectedCpuUsage;

    return matchesSearch && matchesCategory && matchesDifficulty && matchesCpuUsage;
  });

  // Group filtered effects by category
  const effectsByCategory = filteredEffects.reduce((acc, effect) => {
    if (!acc[effect.category]) {
      acc[effect.category] = [];
    }
    acc[effect.category].push(effect);
    return acc;
  }, {});

  // Get unique values for filter dropdowns
  const categories = [...new Set(EFFECTS_LIBRARY.map(e => e.category))];
  const difficulties = [...new Set(EFFECTS_LIBRARY.map(e => e.difficulty))];
  const cpuUsages = [...new Set(EFFECTS_LIBRARY.map(e => e.cpuUsage))];

  return (
    <Modal
      show={showEffectSelectionModal}
      onHide={handleClose}
      size="xl"
      centered
      backdrop="static"
      keyboard={true}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaMagic />
          Add Effect to {targetTrack?.name || 'Track'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Search and Filter Section */}
        <div className="mb-4">
          <Row className="g-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search effects, tags, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6}>
              <Row className="g-2">
                <Col>
                  <Form.Select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    size="sm"
                  >
                    <option value="All">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Select 
                    value={selectedDifficulty} 
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    size="sm"
                  >
                    <option value="All">All Levels</option>
                    {difficulties.map(diff => (
                      <option key={diff} value={diff}>{diff}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Select 
                    value={selectedCpuUsage} 
                    onChange={(e) => setSelectedCpuUsage(e.target.value)}
                    size="sm"
                  >
                    <option value="All">Any CPU</option>
                    {cpuUsages.map(cpu => (
                      <option key={cpu} value={cpu}>{cpu} CPU</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </Col>
          </Row>
          
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">
              {filteredEffects.length} of {EFFECTS_LIBRARY.length} effects shown
            </small>
            {(searchTerm || selectedCategory !== 'All' || selectedDifficulty !== 'All' || selectedCpuUsage !== 'All') && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setSelectedDifficulty('All');
                  setSelectedCpuUsage('All');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* No Results Message */}
        {filteredEffects.length === 0 && (
          <div className="text-center py-5">
            <FaFilter size={48} className="text-muted mb-3" />
            <h5>No effects found</h5>
            <p className="text-muted mb-3">
              Try adjusting your search terms or filters to find more effects.
            </p>
            <Button
              variant="outline-primary"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedDifficulty('All');
                setSelectedCpuUsage('All');
              }}
            >
              Clear All Filters
            </Button>
          </div>
        )}

        {Object.entries(effectsByCategory).map(([category, effects]) => (
          <div key={category} className="mb-4">
            <h5 className="d-flex align-items-center gap-2 mb-3">
              <Badge bg={CATEGORY_COLORS[category]}>{category}</Badge>
              <span className="text-muted small">({effects.length} effects)</span>
            </h5>

            <Row xs={1} sm={2} md={3} lg={4} className="g-2">
              {effects.map((effect) => {
                const IconComponent = effect.icon;
                return (
                  <Col key={effect.id}>
                    <Card
                      className="effect-card h-100"
                      style={{ 
                        cursor: 'pointer', 
                        transition: 'all 0.2s',
                        border: '1px solid #dee2e6'
                      }}
                      onClick={() => handleEffectSelect(effect.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <Card.Body className="p-3">
                        <div className="text-center mb-2">
                          <IconComponent size={24} className="text-primary" />
                        </div>
                        <Card.Title className="h6 mb-1 text-center">{effect.name}</Card.Title>
                        <Card.Text className="small text-muted mb-2 text-center">
                          {effect.description}
                        </Card.Text>
                        
                        {/* Effect Metadata */}
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="d-flex align-items-center gap-1">
                            <FaGraduationCap size={10} />
                            <span className="small" style={{ fontSize: '0.7rem' }}>
                              {effect.difficulty}
                            </span>
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <FaMicrochip size={10} />
                            <span className="small" style={{ fontSize: '0.7rem' }}>
                              {effect.cpuUsage}
                            </span>
                          </div>
                        </div>

                        {/* Parameters Preview */}
                        <div className="mb-2">
                          <div className="small text-muted" style={{ fontSize: '0.65rem' }}>
                            <strong>Parameters:</strong> {effect.parameters.slice(0, 3).join(', ')}
                            {effect.parameters.length > 3 && '...'}
                          </div>
                        </div>

                        {/* Tags and Visual Badge */}
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          {effect.tags.slice(0, 2).map(tag => (
                            <Badge
                              key={tag}
                              bg="light"
                              text="dark"
                              style={{ fontSize: '0.6rem' }}
                            >
                              {tag}
                            </Badge>
                          ))}
                          {effect.hasVisualization && (
                            <Badge
                              bg="dark"
                              style={{ fontSize: '0.6rem' }}
                            >
                              <FaPlay size={8} className="me-1" />
                              Visual
                            </Badge>
                          )}
                        </div>

                        {/* Detailed Description Tooltip */}
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              <div style={{ textAlign: 'left' }}>
                                <strong>{effect.name}</strong><br/>
                                {effect.detailedDescription}<br/>
                                <small>
                                  <strong>Parameters:</strong> {effect.parameters.join(', ')}
                                </small>
                              </div>
                            </Tooltip>
                          }
                        >
                          <div 
                            className="position-absolute top-0 end-0 p-1"
                            style={{ cursor: 'help' }}
                          >
                            <FaInfoCircle size={10} className="text-muted" />
                          </div>
                        </OverlayTrigger>
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        ))}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-muted small">
            Select an effect to configure its parameters
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}