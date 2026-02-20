'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner, Container, Row, Col, Form, Dropdown } from 'react-bootstrap';
import { FaCog, FaCheck, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Knob from '../../../Knob';
import { debugLog, debugError } from '../../../../lib/debug';

// Effect processing is handled by UnifiedEffectsProcessor during mixdown.
// Effects are stored on tracks and processed when the multitrack is mixed down.

/**
 * @typedef {Object} DropdownOption
 * @property {string} key - Unique identifier for the option
 * @property {string} name - Display name for the option
 */

/**
 * @typedef {Object} KnobParameterConfig
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} step - Step increment
 * @property {number} default - Default value
 * @property {string} label - Display label
 * @property {string} unit - Unit suffix (%, Hz, dB, ms, etc.)
 * @property {string} color - Knob color (hex)
 * @property {number} [multiplier] - Optional display multiplier for unit conversion
 *
 * ## Multiplier Convention
 *
 * The `multiplier` field converts internal values to display units:
 * - displayValue = internalValue * multiplier
 *
 * Common patterns:
 * - Seconds to milliseconds: { unit: 'ms', multiplier: 1000 }
 *   - Internal: 0.003 (3ms attack time stored in seconds)
 *   - Display: "3ms" (0.003 * 1000 = 3)
 *
 * Why use multipliers:
 * - Audio APIs work in seconds (Web Audio API standard)
 * - Users expect milliseconds for time parameters
 * - Internal value stays in standard units for processing
 * - Only display is converted for human readability
 *
 * Effects using multipliers:
 * - compressor.attack/release: seconds → ms display
 * - reverseReverb.buildupTime/fadeTime: seconds → ms display
 */

/**
 * @typedef {Object} DropdownParameterConfig
 * @property {'dropdown'} type - Parameter type
 * @property {DropdownOption[]} options - Available options
 * @property {string} default - Default option key
 * @property {string} label - Display label
 */

/**
 * @typedef {Object} EffectConfig
 * @property {string} name - Display name
 * @property {string} category - Effect category (Modulation, Space, Dynamics, etc.)
 * @property {string} description - Brief description
 * @property {Object.<string, KnobParameterConfig|DropdownParameterConfig>} parameters - Parameter definitions
 */

/**
 * Format a parameter value for display based on its unit configuration
 *
 * @param {number} value - The raw parameter value
 * @param {KnobParameterConfig} paramConfig - Parameter configuration
 * @returns {string} Formatted display string
 */
function formatParameterValue(value, paramConfig) {
  const { unit, multiplier } = paramConfig;

  switch (unit) {
    case '%':
      return `${Math.round(value * 100)}%`;
    case '°':
      return `${value}°`;
    case 'Hz':
      return `${value.toFixed(1)}Hz`;
    case 'ms':
      return multiplier
        ? `${(value * multiplier).toFixed(0)}ms`
        : `${value}ms`;
    case 'dB':
      return `${value.toFixed(0)}dB`;
    case ':1':
      return `${value.toFixed(1)}:1`;
    case 'x':
      return `${value.toFixed(1)}x`;
    case 'st':
      return `${value > 0 ? '+' : ''}${value}st`;
    case 's':
      return `${value.toFixed(2)}s`;
    case '':
    case undefined:
    default:
      return value.toString();
  }
}

/** @type {Object.<string, EffectConfig>} */
const EFFECT_CONFIGS = {
  tremolo: {
    name: 'Tremolo',
    category: 'Modulation',
    description: 'Amplitude modulation',
    parameters: {
      rate: { min: 0.1, max: 30, step: 0.1, default: 5, label: 'Rate', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Depth', unit: '%', color: '#7bafd4' },
      phase: { min: 0, max: 360, step: 1, default: 0, label: 'Phase', unit: '°', color: '#cbb677' },
      waveform: {
        type: 'dropdown',
        options: [
          { key: 'sine', name: 'Sine' },
          { key: 'triangle', name: 'Triangle' },
          { key: 'square', name: 'Square' },
          { key: 'sawtooth', name: 'Sawtooth' }
        ],
        default: 'sine',
        label: 'Waveform'
      }
    }
  },
  reverb: {
    name: 'Reverb',
    category: 'Space',
    description: 'Algorithmic reverb',
    parameters: {
      preset: {
        type: 'dropdown',
        options: [
          { key: 'smallRoom', name: 'Small Room' },
          { key: 'mediumHall', name: 'Medium Hall' },
          { key: 'largeHall', name: 'Large Hall' },
          { key: 'cathedral', name: 'Cathedral' },
          { key: 'plate', name: 'Plate' },
          { key: 'spring', name: 'Spring' }
        ],
        default: 'mediumHall',
        label: 'Preset'
      },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Mix', unit: '%', color: '#92ce84' },
      preDelay: { min: 0, max: 200, step: 1, default: 0, label: 'Pre-Dly', unit: 'ms', color: '#7bafd4' },
      highDamp: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Hi Damp', unit: '%', color: '#cbb677' },
      lowDamp: { min: 0, max: 1, step: 0.01, default: 0.1, label: 'Lo Damp', unit: '%', color: '#cbb677' },
      earlyLate: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'E/L Mix', unit: '%', color: '#92ceaa' },
      stereoWidth: { min: 0, max: 2, step: 0.01, default: 1, label: 'Width', unit: '%', color: '#e75b5c' },
      outputGain: { min: 0, max: 2, step: 0.01, default: 1, label: 'Output', unit: 'x', color: '#92ceaa' }
    }
  },
  eq: {
    name: 'EQ',
    category: 'Frequency',
    description: 'Multi-band equalizer',
    parameters: {
      bands: {
        type: 'custom',
        default: [
          { frequency: 100, gain: 0, type: 'peaking', q: 1 },
          { frequency: 250, gain: 0, type: 'peaking', q: 1 },
          { frequency: 500, gain: 0, type: 'peaking', q: 1 },
          { frequency: 1000, gain: 0, type: 'peaking', q: 1 },
          { frequency: 2000, gain: 0, type: 'peaking', q: 1 },
          { frequency: 4000, gain: 0, type: 'peaking', q: 1 },
          { frequency: 8000, gain: 0, type: 'peaking', q: 1 },
          { frequency: 16000, gain: 0, type: 'peaking', q: 1 }
        ],
        label: 'EQ Bands'
      }
    }
  },
  compressor: {
    name: 'Compressor',
    category: 'Dynamics',
    description: 'Dynamic range control',
    parameters: {
      threshold: { min: -60, max: 0, step: 1, default: -24, label: 'Threshold', unit: 'dB', color: '#e75b5c' },
      ratio: { min: 1, max: 20, step: 0.1, default: 4, label: 'Ratio', unit: ':1', color: '#7bafd4' },
      attack: { min: 0, max: 1, step: 0.001, default: 0.003, label: 'Attack', unit: 'ms', color: '#92ce84', multiplier: 1000 },
      release: { min: 0, max: 1, step: 0.001, default: 0.1, label: 'Release', unit: 'ms', color: '#92ce84', multiplier: 1000 },
      knee: { min: 0, max: 40, step: 1, default: 30, label: 'Knee', unit: 'dB', color: '#cbb677' },
      makeup: { min: 0, max: 24, step: 1, default: 0, label: 'Makeup', unit: 'dB', color: '#92ceaa' }
    }
  },
  chorus: {
    name: 'Chorus',
    category: 'Modulation',
    description: 'Pitch modulation chorus',
    parameters: {
      rate: { min: 0.1, max: 10, step: 0.1, default: 1, label: 'Rate', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Depth', unit: '%', color: '#7bafd4' },
      delay: { min: 5, max: 50, step: 1, default: 20, label: 'Delay', unit: 'ms', color: '#cbb677' },
      feedback: { min: 0, max: 0.9, step: 0.01, default: 0.2, label: 'Feedback', unit: '%', color: '#92ce84' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  distortion: {
    name: 'Distortion',
    category: 'Dynamics',
    description: 'Harmonic distortion',
    parameters: {
      drive: { min: 1, max: 20, step: 0.1, default: 5, label: 'Drive', unit: 'x', color: '#e75b5c' },
      tone: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Tone', unit: '%', color: '#7bafd4' },
      output: { min: 0, max: 2, step: 0.01, default: 1, label: 'Output', unit: 'x', color: '#92ceaa' }
    }
  },
  gate: {
    name: 'Gate',
    category: 'Dynamics', 
    description: 'Noise gate',
    parameters: {
      threshold: { min: -80, max: 0, step: 1, default: -40, label: 'Threshold', unit: 'dB', color: '#e75b5c' },
      range: { min: -80, max: 0, step: 1, default: -60, label: 'Range', unit: 'dB', color: '#7bafd4' },
      attack: { min: 0.1, max: 10, step: 0.1, default: 1, label: 'Attack', unit: 'ms', color: '#92ce84' },
      hold: { min: 0, max: 100, step: 1, default: 10, label: 'Hold', unit: 'ms', color: '#cbb677' },
      release: { min: 10, max: 1000, step: 10, default: 100, label: 'Release', unit: 'ms', color: '#92ceaa' }
    }
  },
  phaser: {
    name: 'Phaser',
    category: 'Modulation',
    description: 'Phase shifting modulation',
    parameters: {
      rate: { min: 0.1, max: 10, step: 0.1, default: 1, label: 'Rate', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 0.7, label: 'Depth', unit: '%', color: '#7bafd4' },
      feedback: { min: 0, max: 0.95, step: 0.01, default: 0.5, label: 'Feedback', unit: '%', color: '#cbb677' },
      stages: { min: 2, max: 8, step: 1, default: 4, label: 'Stages', unit: '', color: '#92ce84' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  flanger: {
    name: 'Flanger',
    category: 'Modulation',
    description: 'Sweeping comb filter',
    parameters: {
      rate: { min: 0.1, max: 5, step: 0.1, default: 0.5, label: 'Rate', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Depth', unit: '%', color: '#7bafd4' },
      delay: { min: 1, max: 20, step: 0.5, default: 5, label: 'Delay', unit: 'ms', color: '#cbb677' },
      feedback: { min: 0, max: 0.9, step: 0.01, default: 0.3, label: 'Feedback', unit: '%', color: '#92ce84' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  echo: {
    name: 'Echo',
    category: 'Time',
    description: 'Simple echo delay',
    parameters: {
      delayTime: { min: 50, max: 2000, step: 10, default: 250, label: 'Delay', unit: 'ms', color: '#e75b5c' },
      feedback: { min: 0, max: 0.9, step: 0.01, default: 0.4, label: 'Feedback', unit: '%', color: '#7bafd4' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  autoPan: {
    name: 'Auto Pan',
    category: 'Space',
    description: 'Automatic stereo panning',
    parameters: {
      rate: { min: 0.1, max: 10, step: 0.1, default: 1, label: 'Rate', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 0.8, label: 'Depth', unit: '%', color: '#7bafd4' },
      shape: {
        type: 'dropdown',
        options: [
          { key: 'sine', name: 'Sine' },
          { key: 'triangle', name: 'Triangle' },
          { key: 'square', name: 'Square' },
          { key: 'sawtooth', name: 'Sawtooth' }
        ],
        default: 'sine',
        label: 'Shape'
      }
    }
  },
  stereoWidener: {
    name: 'Stereo Widener',
    category: 'Space',
    description: 'Stereo field enhancement',
    parameters: {
      width: { min: 0, max: 2, step: 0.01, default: 1.5, label: 'Width', unit: '%', color: '#e75b5c' },
      delay: { min: 0, max: 50, step: 0.5, default: 10, label: 'Haas Delay', unit: 'ms', color: '#7bafd4' },
      bassFreq: { min: 50, max: 500, step: 10, default: 120, label: 'Bass Freq', unit: 'Hz', color: '#cbb677' }
    }
  },
  pitchShifter: {
    name: 'Pitch Shifter',
    category: 'Pitch',
    description: 'Pitch shifting without time change',
    parameters: {
      shift: { min: -24, max: 24, step: 1, default: 0, label: 'Shift', unit: 'st', color: '#e75b5c' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 1, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  reverseReverb: {
    name: 'Reverse Reverb',
    category: 'Space',
    description: 'Reverse buildup reverb',
    parameters: {
      buildupTime: { min: 0.1, max: 2, step: 0.05, default: 0.5, label: 'Buildup', unit: 'ms', color: '#e75b5c', multiplier: 1000 },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ce84' },
      fadeTime: { min: 0.01, max: 0.5, step: 0.01, default: 0.1, label: 'Fade In', unit: 'ms', color: '#7bafd4', multiplier: 1000 },
      predelay: { min: 0, max: 100, step: 1, default: 0, label: 'Pre-Delay', unit: 'ms', color: '#cbb677' }
    }
  },
  advancedDelay: {
    name: 'Advanced Delay',
    category: 'Time',
    description: 'Multi-tap delay with filtering',
    parameters: {
      delayTime: { min: 10, max: 2000, step: 10, default: 250, label: 'Delay', unit: 'ms', color: '#e75b5c' },
      feedback: { min: 0, max: 0.9, step: 0.01, default: 0.4, label: 'Feedback', unit: '%', color: '#7bafd4' },
      highCut: { min: 1000, max: 20000, step: 100, default: 8000, label: 'Hi Cut', unit: 'Hz', color: '#cbb677' },
      lowCut: { min: 20, max: 1000, step: 10, default: 100, label: 'Lo Cut', unit: 'Hz', color: '#92ce84' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  ringModulator: {
    name: 'Ring Modulator',
    category: 'Modulation',
    description: 'Ring modulation effect',
    parameters: {
      frequency: { min: 1, max: 1000, step: 1, default: 100, label: 'Frequency', unit: 'Hz', color: '#e75b5c' },
      depth: { min: 0, max: 1, step: 0.01, default: 1, label: 'Depth', unit: '%', color: '#7bafd4' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  frequencyShifter: {
    name: 'Frequency Shifter',
    category: 'Pitch',
    description: 'Frequency domain shifting',
    parameters: {
      shift: { min: -500, max: 500, step: 1, default: 0, label: 'Shift', unit: 'Hz', color: '#e75b5c' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  spectralFilter: {
    name: 'Spectral Filter',
    category: 'Frequency',
    description: 'Spectral domain filtering',
    parameters: {
      freeze: { min: 0, max: 1, step: 0.01, default: 0, label: 'Freeze', unit: '%', color: '#e75b5c' },
      blur: { min: 0, max: 1, step: 0.01, default: 0, label: 'Blur', unit: '%', color: '#7bafd4' },
      shift: { min: -1, max: 1, step: 0.01, default: 0, label: 'Shift', unit: '', color: '#cbb677' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  granularFreeze: {
    name: 'Granular Freeze',
    category: 'Time',
    description: 'Granular synthesis freeze',
    parameters: {
      freeze: { min: 0, max: 1, step: 0.01, default: 0, label: 'Freeze', unit: '%', color: '#e75b5c' },
      grainSize: { min: 10, max: 500, step: 10, default: 100, label: 'Grain Size', unit: 'ms', color: '#7bafd4' },
      density: { min: 0.1, max: 4, step: 0.1, default: 1, label: 'Density', unit: 'x', color: '#cbb677' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  autoWah: {
    name: 'Auto Wah',
    category: 'Filter',
    description: 'Automatic wah filter',
    parameters: {
      sensitivity: { min: 0, max: 1, step: 0.01, default: 0.7, label: 'Sensitivity', unit: '%', color: '#e75b5c' },
      frequency: { min: 200, max: 4000, step: 50, default: 800, label: 'Frequency', unit: 'Hz', color: '#7bafd4' },
      q: { min: 0.5, max: 20, step: 0.5, default: 5, label: 'Q', unit: '', color: '#cbb677' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 1, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  glitch: {
    name: 'Glitch',
    category: 'Creative',
    description: 'Digital glitch effects',
    parameters: {
      probability: { min: 0, max: 1, step: 0.01, default: 0.1, label: 'Probability', unit: '%', color: '#e75b5c' },
      intensity: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Intensity', unit: '%', color: '#7bafd4' },
      rate: { min: 1, max: 100, step: 1, default: 10, label: 'Rate', unit: 'Hz', color: '#cbb677' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  },
  paulstretch: {
    name: 'Paulstretch',
    category: 'Time',
    description: 'Extreme time stretching',
    parameters: {
      stretch: { min: 0.1, max: 10, step: 0.1, default: 2, label: 'Stretch', unit: 'x', color: '#e75b5c' },
      windowSize: { min: 0.01, max: 1, step: 0.01, default: 0.25, label: 'Window', unit: 's', color: '#7bafd4' },
      wetMix: { min: 0, max: 1, step: 0.01, default: 1, label: 'Mix', unit: '%', color: '#92ceaa' }
    }
  }
};

const EFFECT_INFO = EFFECT_CONFIGS;

/**
 * Dynamic effect parameters component
 * Renders appropriate controls (knobs, dropdowns, sliders) based on effect configuration
 *
 * @param {Object} props
 * @param {string} props.effectType - The effect type key (e.g., 'reverb', 'compressor')
 * @param {Object.<string, any>} props.parameters - Current parameter values
 * @param {(paramName: string, value: any) => void} props.onParameterChange - Callback when parameter changes
 * @returns {JSX.Element}
 */
function EffectParametersComponent({ effectType, parameters, onParameterChange }) {
  const config = EFFECT_CONFIGS[effectType];
  
  if (!config) {
    return (
      <div className="text-center py-5">
        <FaCog size={48} className="text-muted mb-3" />
        <h4>{effectType}</h4>
        <Alert variant="warning">
          <Alert.Heading>Effect Not Configured</Alert.Heading>
          <p className="mb-0">
            Parameters for {effectType} haven't been configured yet.
            Available effects: {Object.keys(EFFECT_CONFIGS).join(', ')}
          </p>
        </Alert>
      </div>
    );
  }

  const renderParameter = (paramName, paramConfig) => {
    if (paramConfig.type === 'dropdown') {
      return (
        <Col key={paramName} xs={12} sm={6} md={4} lg={3} className="mb-3">
          <Form.Label className="text-white small mb-1">{paramConfig.label}</Form.Label>
          <Dropdown
            onSelect={(eventKey) => onParameterChange(paramName, eventKey)}
            size="sm"
          >
            <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
              {paramConfig.options.find(opt => opt.key === parameters[paramName])?.name || 
               paramConfig.options[0]?.name || 'Select'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {paramConfig.options.map((option) => (
                <Dropdown.Item
                  key={option.key}
                  eventKey={option.key}
                  className="text-white"
                >
                  {option.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
      );
    }

    if (paramConfig.type === 'custom' && paramName === 'bands') {
      // Special EQ bands rendering
      return (
        <Col key={paramName} xs={12} className="mb-3">
          <Form.Label className="text-white small mb-2">{paramConfig.label}</Form.Label>
          <Row>
            {parameters[paramName]?.map((band, index) => {
              const freqLabel = band.frequency >= 1000 ? 
                `${(band.frequency/1000).toFixed(1)}k` : 
                band.frequency;
              
              return (
                <Col key={index} xs={6} sm={4} md={3} lg={2} xl={1} className="mb-2 text-center">
                  <Form.Range
                    min={-26}
                    max={26}
                    step={0.1}
                    value={band.gain}
                    className="eq-slider"
                    onChange={(e) => {
                      const newBands = [...parameters[paramName]];
                      newBands[index].gain = parseFloat(e.target.value);
                      onParameterChange(paramName, newBands);
                    }}
                    style={{ width: '100%', writingMode: 'vertical-lr' }}
                    aria-label={`EQ band ${freqLabel}Hz gain`}
                    aria-valuemin={-26}
                    aria-valuemax={26}
                    aria-valuenow={band.gain}
                    aria-valuetext={`${band.gain.toFixed(1)} decibels`}
                  />
                  <small className="text-white d-block mt-1">{freqLabel}Hz</small>
                  <small className="text-muted d-block" aria-hidden="true">{band.gain.toFixed(1)}dB</small>
                </Col>
              );
            })}
          </Row>
        </Col>
      );
    }

    // Standard knob parameter
    const value = parameters[paramName] !== undefined ? parameters[paramName] : paramConfig.default;
    const displayValue = formatParameterValue(value, paramConfig);

    return (
      <Col key={paramName} xs={6} sm={4} md={3} lg={2} className="mb-3">
        <Knob
          value={value}
          onChange={(newValue) => onParameterChange(paramName, newValue)}
          min={paramConfig.min}
          max={paramConfig.max}
          step={paramConfig.step}
          label={paramConfig.label}
          displayValue={displayValue}
          size={45}
          color={paramConfig.color}
        />
      </Col>
    );
  };

  return (
    <div>
      <div className="text-center mb-4">
        <h5>{config.name}</h5>
        <p className="text-muted small">{config.description}</p>
        <small className="text-muted">Category: <strong>{config.category}</strong></small>
      </div>
      
      <Container fluid className="p-2">
        <Row className="align-items-end justify-content-center">
          {Object.keys(config.parameters).map(paramName => 
            renderParameter(paramName, config.parameters[paramName])
          )}
        </Row>
      </Container>
    </div>
  );
}

/**
 * Modal for configuring effect parameters before adding to a track
 * Displays appropriate controls based on the selected effect type
 * and integrates with the MultitrackContext for track updates
 *
 * @returns {JSX.Element|null}
 */
export default function EffectParametersModal() {
  const {
    showEffectParametersModal,
    setShowEffectParametersModal,
    setShowEffectSelectionModal,
    selectedEffectType,
    setSelectedEffectType,
    effectTargetTrackId,
    tracks,
    updateTrack
  } = useMultitrack();

  const [effectParameters, setEffectParameters] = useState({});
  const [isApplying, setIsApplying] = useState(false);

  const targetTrack = tracks.find(t => t.id === effectTargetTrackId);
  const effectConfig = EFFECT_CONFIGS[selectedEffectType];
  const effectInfo = effectConfig || { name: selectedEffectType, category: 'Unknown' };

  const handleParameterChange = (paramName, value) => {
    setEffectParameters(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleApplyEffect = async () => {
    if (!targetTrack || !selectedEffectType) return;

    setIsApplying(true);

    try {
      // Create effect configuration
      // Processing is handled by UnifiedEffectsProcessor during mixdown
      const newEffect = {
        id: `${selectedEffectType}-${Date.now()}`,
        type: selectedEffectType,
        parameters: effectParameters,
        enabled: true,
        bypass: false
      };

      const updatedEffects = [...(targetTrack.effects || []), newEffect];

      updateTrack(targetTrack.id, {
        effects: updatedEffects
      });

      debugLog('EffectParametersModal', `Added ${effectInfo.name} to track ${targetTrack.name}`, newEffect);

      // Close modal on success
      handleClose();
    } catch (error) {
      debugError('EffectParametersModal', 'Error applying effect:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setShowEffectParametersModal(false);
    setSelectedEffectType(null);
    setEffectParameters({});
  };

  const handleBackToSelection = () => {
    setShowEffectParametersModal(false);
    setShowEffectSelectionModal(true);
    // Keep selectedEffectType and effectTargetTrackId for potential reuse
  };

  // Initialize parameters when effect type changes
  useEffect(() => {
    if (selectedEffectType && EFFECT_CONFIGS[selectedEffectType]) {
      const config = EFFECT_CONFIGS[selectedEffectType];
      const initialParams = {};
      
      Object.keys(config.parameters).forEach(key => {
        const param = config.parameters[key];
        initialParams[key] = param.default;
      });
      
      setEffectParameters(initialParams);
    }
  }, [selectedEffectType]);

  if (!selectedEffectType) {
    return null;
  }

  return (
    <Modal
      show={showEffectParametersModal}
      onHide={handleClose}
      size="lg"
      centered
      backdrop="static"
      keyboard={true}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaCog />
          Configure {effectInfo.name}
          {targetTrack && (
            <small className="text-muted ms-2">
              → {targetTrack.name}
            </small>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: '400px' }}>
        <EffectParametersComponent
          effectType={selectedEffectType}
          parameters={effectParameters}
          onParameterChange={handleParameterChange}
        />
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <Button 
            variant="outline-secondary" 
            onClick={handleBackToSelection}
            className="d-flex align-items-center gap-2"
          >
            <FaArrowLeft size={14} />
            Back to Effects
          </Button>

          <div className="d-flex gap-2">
            <Button variant="secondary" onClick={handleClose}>
              <FaTimes className="me-1" />
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleApplyEffect}
              disabled={isApplying}
              className="d-flex align-items-center gap-2"
            >
              {isApplying ? (
                <>
                  <Spinner size="sm" />
                  Applying...
                </>
              ) : (
                <>
                  <FaCheck />
                  Add Effect
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}