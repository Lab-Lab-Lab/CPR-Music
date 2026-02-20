// components/audio/DAW/Multitrack/InstrumentSelector.js
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Card, Row, Col } from 'react-bootstrap';
import {
  FaMusic,
  FaWaveSquare,
  FaMicrochip,
  FaDrum,
  FaKeyboard,
} from 'react-icons/fa';
import { MdPiano } from 'react-icons/md';
import { BsMusicNote, BsSoundwave } from 'react-icons/bs';

const INSTRUMENTS = [
  {
    id: 'synth-default',
    type: 'synth',
    preset: 'default',
    name: 'Basic Synth',
    icon: FaWaveSquare,
    color: '#4a7c9e',
    description: 'Classic subtractive synthesizer',
  },
  {
    id: 'synth-bass',
    type: 'synth',
    preset: 'bass',
    name: 'Bass Synth',
    icon: BsSoundwave,
    color: '#9e4a7c',
    description: 'Deep bass synthesizer',
  },
  {
    id: 'synth-lead',
    type: 'synth',
    preset: 'lead',
    name: 'Lead Synth',
    icon: FaWaveSquare,
    color: '#7c9e4a',
    description: 'Bright lead synthesizer',
  },
  {
    id: 'synth-pad',
    type: 'synth',
    preset: 'pad',
    name: 'Pad Synth',
    icon: FaMicrochip,
    color: '#4a9e7c',
    description: 'Lush pad synthesizer',
  },
  {
    id: 'synth-pluck',
    type: 'synth',
    preset: 'pluck',
    name: 'Pluck Synth',
    icon: BsMusicNote,
    color: '#9e7c4a',
    description: 'Plucked string synthesizer',
  },
  {
    id: 'piano',
    type: 'piano',
    preset: null,
    name: 'Piano',
    icon: MdPiano,
    color: '#6a6a6a',
    description: 'Simple acoustic piano',
  },
  {
    id: 'organ',
    type: 'organ',
    preset: null,
    name: 'Pipe Organ',
    icon: FaMusic,
    color: '#8B4513', // Warm brown like mahogany
    description: 'Classic pipe organ with multiple ranks',
  },
  {
    id: 'reedorgan',
    type: 'reedorgan',
    preset: null,
    name: 'Reed Organ',
    icon: FaMusic,
    color: '#CD853F',
    description: 'Warm harmonium with characteristic beating',
  },
  {
    id: 'drums',
    type: 'drums',
    preset: null,
    name: 'Drum Kit',
    icon: FaDrum,
    color: '#ce6a6a',
    description: '16-pad drum sampler',
  },
  {
    id: 'wuulf',
    type: 'wuulf',
    preset: null,
    name: 'WUULF',
    icon: BsSoundwave,
    color: '#9b59b6',
    description: 'Ethereal time-warping synthesizer',
  },
  {
    id: 'wuulf2',
    type: 'wuulf2',
    preset: null,
    name: 'WUULF 2',
    icon: BsSoundwave,
    color: '#aa77beff',
    description: 'Ethereal time-warping synthesizer. Revision 2.',
  },
  {
    id: 'strings',
    type: 'strings',
    preset: null,
    name: 'WUULF 4',
    icon: BsSoundwave,
    color: '#4B0082', // Deep indigo for darkness
    description: 'Inverted space-time synthesizer',
  },
  {
    id: 'brass',
    type: 'brass',
    preset: null,
    name: 'WUULF 3',
    icon: BsSoundwave,
    color: '#FFD700', // Gold
    description: 'Formant-Pulse Powered Synthesizer',
  },
  {
    id: 'theremin',
    type: 'theremin',
    preset: null,
    name: 'Theremin',
    icon: BsSoundwave,
    color: '#FF6B6B',
    description: 'Classic electronic instrument with portamento',
  },
];

export default function InstrumentSelector({
  show,
  onHide,
  onSelect,
  currentInstrument,
}) {
  const [selectedInstrument, setSelectedInstrument] = useState(
    (currentInstrument && currentInstrument.id) ||
      currentInstrument ||
      'synth-default',
  );
  const selectedMeta =
    INSTRUMENTS.find((i) => i.id === selectedInstrument) || INSTRUMENTS[0];
  const [previewNote, setPreviewNote] = useState(null);

  const handleSelect = () => {
    const instrument = INSTRUMENTS.find((i) => i.id === selectedInstrument);
    if (instrument) {
      onSelect(instrument);
      onHide();
    }
  };

  const handlePreview = (instrumentId) => {
    const instrument = INSTRUMENTS.find((i) => i.id === instrumentId);
    if (instrument) {
      // Trigger a preview note
      // This would be handled by the parent component
      if (onSelect) {
        onSelect(instrument, true); // true = preview only
      }
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>Select Instrument</Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        <Row>
          {INSTRUMENTS.map((instrument) => {
            const Icon = instrument.icon;
            const isSelected = selectedInstrument === instrument.id;

            return (
              <Col key={instrument.id} md={4} className="mb-3">
                <Card
                  className={`instrument-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    backgroundColor: isSelected
                      ? instrument.color + '33'
                      : '#2a2a2a',
                    borderColor: isSelected ? instrument.color : '#444',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedInstrument(instrument.id)}
                  onDoubleClick={() => handlePreview(instrument.id)}
                >
                  <Card.Body className="text-center">
                    <Icon
                      size={48}
                      style={{
                        color: isSelected ? instrument.color : '#666',
                        marginBottom: '0.5rem',
                      }}
                    />
                    <h6 style={{ color: isSelected ? '#fff' : '#aaa' }}>
                      {instrument.name}
                    </h6>
                    <small className="text-muted">
                      {instrument.description}
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>

        <div className="mt-3 text-muted text-center">
          <small>Double-click to preview • Click to select</small>
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSelect}
          style={{
            backgroundColor: selectedMeta.color,
            borderColor: selectedMeta.color,
          }}
        >
          Select {selectedMeta.name}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// Inline styles for the instrument cards
const styles = `
.instrument-card {
  border-width: 2px;
  border-style: solid;
  height: 100%;
}

.instrument-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.instrument-card.selected {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
}
`;
