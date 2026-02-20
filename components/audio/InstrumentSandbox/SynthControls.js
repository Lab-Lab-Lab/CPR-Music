'use client';

import React from 'react';
import { Row, Col, Form, Card, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaWaveSquare, FaSlidersH, FaClock, FaWater } from 'react-icons/fa';
import Knob from '../../Knob';

/**
 * Educational Tooltips
 */
const SynthTooltips = {
  // Oscillator
  oscillatorType: "Choose the basic waveform shape. Sine is pure and smooth, Square is hollow and woody, Sawtooth is bright and buzzy, Triangle is softer and mellow.",
  detune: "Shifts pitch slightly up or down in cents (100 cents = 1 semitone). Creates chorus-like thickness when layered with other oscillators. Use ±7-12 cents for subtle width.",

  // Filter
  filterCutoff: "Sets the frequency where filtering begins. Lower values create darker, bassier sounds. Higher values keep more brightness. Start at 2000-8000 Hz for most sounds.",
  filterResonance: "Emphasizes frequencies near the cutoff point. Low values (1-5) sound natural, medium values (5-15) add character, high values (15+) create resonant peaks or self-oscillation.",

  // Envelope
  attack: "Time for sound to reach full volume after a key press. 0ms is instant (percussive), 10-50ms is plucky, 100-500ms is soft, 500ms+ is pad-like.",
  decay: "Time to drop from peak to sustain level. Short decay (10-100ms) for plucks, medium (100-500ms) for balanced sounds, long (500ms+) for evolving textures.",
  sustain: "Volume level held while key is pressed. 0 creates percussive hits, 0.5 is balanced, 1.0 sustains at full volume indefinitely.",
  release: "Time for sound to fade after key release. Short (10-100ms) for tight sounds, medium (100-500ms) for natural, long (500ms-2s+) for ambient tails.",

  // Effects
  reverb: "Simulates room ambience and space. 10-30% adds subtle depth, 40-60% creates atmosphere, 70%+ for ambient washes and special effects.",
  delay: "Repeating echoes of the sound. Low values (10-30%) add rhythmic interest, higher values (50%+) create pronounced echo effects. Syncs to tempo.",
  distortion: "Adds harmonic saturation and grit. Low values (10-30%) add warmth, medium (40-60%) adds crunch, high (70%+) creates heavy distortion.",

  // LFO
  lfoRate: "Speed of cyclic modulation in Hz. 0.5-2 Hz for slow sweeps, 4-8 Hz for vibrato/tremolo, 10+ Hz for special effects and audio-rate modulation.",
  lfoAmount: "Depth of modulation effect. Higher values create more pronounced wobble or vibrato. Start with 10-30% for subtle movement, 50%+ for dramatic effects."
};

const SynthControls = ({ params, onParamChange }) => {
  // Helper to create a knob control with tooltip
  const createKnob = (param, label, min, max, step = 0.01, unit = '', color = '#7bafd4', tooltip = null) => {
    // Format display value based on parameter type
    let displayValue;
    if (unit === 's') {
      displayValue = `${params[param].toFixed(step < 0.01 ? 3 : 2)}${unit}`;
    } else if (unit === ' Hz') {
      displayValue = `${Math.round(params[param])}${unit}`;
    } else if (unit === ' cents') {
      displayValue = `${Math.round(params[param])}${unit}`;
    } else if (unit === '%') {
      displayValue = `${Math.round(params[param])}${unit}`;
    } else {
      displayValue = `${params[param].toFixed(step < 1 ? 2 : 0)}${unit}`;
    }

    const control = (
      <div>
        <Knob
          value={params[param]}
          min={min}
          max={max}
          step={step}
          onChange={(val) => onParamChange(param, val)}
          label={label}
          displayValue={displayValue}
          size={55}
          color={color}
        />
      </div>
    );

    if (tooltip) {
      return (
        <OverlayTrigger
          placement="top"
          delay={{ show: 1500, hide: 250 }}
          overlay={<Tooltip>{tooltip}</Tooltip>}
        >
          {control}
        </OverlayTrigger>
      );
    }
    return control;
  };

  // Helper to create a select control with tooltip
  const createSelect = (param, label, options, tooltip = null) => {
    const control = (
      <div className="synth-control-group">
        <Form.Label className="text-light small">{label}</Form.Label>
        <Form.Select
          value={params[param]}
          onChange={(e) => onParamChange(param, e.target.value)}
          className="bg-dark text-light border-secondary"
          size="sm"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
      </div>
    );

    if (tooltip) {
      return (
        <OverlayTrigger
          placement="top"
          delay={{ show: 1500, hide: 250 }}
          overlay={<Tooltip>{tooltip}</Tooltip>}
        >
          {control}
        </OverlayTrigger>
      );
    }
    return control;
  };

  return (
    <div className="synth-controls">
      <Row className="g-4">
        {/* Oscillator Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaWaveSquare />
                <span className="fw-bold small">OSCILLATOR</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {createSelect('oscillatorType', 'Waveform', [
                { value: 'sine', label: 'Sine' },
                { value: 'square', label: 'Square' },
                { value: 'sawtooth', label: 'Sawtooth' },
                { value: 'triangle', label: 'Triangle' }
              ], SynthTooltips.oscillatorType)}
              <div className="mt-3 d-flex justify-content-center">
                {createKnob('detune', 'Detune', -100, 100, 1, ' cents', '#92ce84', SynthTooltips.detune)}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Filter Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaSlidersH />
                <span className="fw-bold small">FILTER</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2">
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('filterCutoff', 'Cutoff', 20, 20000, 10, ' Hz', '#cbb677', SynthTooltips.filterCutoff)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('filterResonance', 'Resonance', 0, 30, 0.1, '', '#cbb677', SynthTooltips.filterResonance)}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Envelope Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaClock />
                <span className="fw-bold small">ENVELOPE</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2">
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('attack', 'Attack', 0, 2, 0.001, 's', '#7bafd4', SynthTooltips.attack)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('decay', 'Decay', 0, 2, 0.001, 's', '#7bafd4', SynthTooltips.decay)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('sustain', 'Sustain', 0, 1, 0.01, '', '#92ceaa', SynthTooltips.sustain)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('release', 'Release', 0, 5, 0.001, 's', '#e75b5c', SynthTooltips.release)}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Effects Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaWater />
                <span className="fw-bold small">EFFECTS</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2 justify-content-center">
                <Col xs={12} className="d-flex justify-content-center mb-2">
                  {createKnob('reverb', 'Reverb', 0, 100, 1, '%', '#92ceaa', SynthTooltips.reverb)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('delay', 'Delay', 0, 100, 1, '%', '#7bafd4', SynthTooltips.delay)}
                </Col>
                <Col xs={6} className="d-flex justify-content-center">
                  {createKnob('distortion', 'Distortion', 0, 100, 1, '%', '#e75b5c', SynthTooltips.distortion)}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* LFO Section */}
      <Row className="mt-4">
        <Col>
          <Card className="bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <span className="fw-bold small">LFO (Low Frequency Oscillator)</span>
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-3 justify-content-center">
                <Col xs="auto">
                  {createKnob('lfoRate', 'Rate', 0.1, 20, 0.1, ' Hz', '#9b59b6', SynthTooltips.lfoRate)}
                </Col>
                <Col xs="auto">
                  {createKnob('lfoAmount', 'Amount', 0, 100, 1, '%', '#9b59b6', SynthTooltips.lfoAmount)}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Custom styles */}
      <style jsx>{`
        .synth-controls {
          color: #fff;
        }

        .synth-control-group {
          margin-bottom: 0.75rem;
        }

        .form-select option {
          background-color: #1a1a1a;
        }
      `}</style>
    </div>
  );
};

export default SynthControls;