/**
 * Effects Parameter Schemas
 *
 * Defines default parameters, valid ranges, and metadata for all effects.
 * This creates a consistent interface for effect configuration across
 * both single-track and multitrack DAWs.
 */

import {
  FaBalanceScale,
  FaFilter,
  FaCompressArrowsAlt,
  FaStopCircle,
  FaDoorClosed,
  FaBroadcastTower,
  FaClock,
  FaBuilding,
  FaTheaterMasks,
  FaWater,
  FaCircleNotch,
  FaBolt,
  FaTrumpet,
  FaRing,
  FaWaveSquare,
  FaArrowsAltH,
  FaMusic,
  FaVolumeUp,
  FaExpandArrowsAlt,
  FaExclamationTriangle,
  FaSnowflake,
  FaExpand,
  FaChartBar,
  FaBackward,
} from 'react-icons/fa';

/**
 * Effect Categories
 */
export const EFFECT_CATEGORIES = {
  DYNAMICS: 'Dynamics',
  FREQUENCY: 'Frequency',
  TIME: 'Time',
  SPACE: 'Space',
  MODULATION: 'Modulation',
  PITCH: 'Pitch',
  CREATIVE: 'Creative',
};

/**
 * Effects Catalog
 * Maps effect IDs to their configuration
 * Note: icon is now a React Icon component, not a string
 */
export const EFFECTS_CATALOG = {
  eq: {
    id: 'eq',
    name: 'Equalizer',
    category: EFFECT_CATEGORIES.FREQUENCY,
    description: '8-band parametric EQ with linear phase option',
    icon: FaBalanceScale,
  },
  filter: {
    id: 'filter',
    name: 'Filter',
    category: EFFECT_CATEGORIES.FREQUENCY,
    description: 'Resonant lowpass/highpass/bandpass filter',
    icon: FaFilter,
  },
  compressor: {
    id: 'compressor',
    name: 'Compressor',
    category: EFFECT_CATEGORIES.DYNAMICS,
    description: 'Dynamic range compressor with visualization',
    icon: FaCompressArrowsAlt,
  },
  limiter: {
    id: 'limiter',
    name: 'Limiter',
    category: EFFECT_CATEGORIES.DYNAMICS,
    description: 'Peak limiter to prevent clipping',
    icon: FaStopCircle,
  },
  gate: {
    id: 'gate',
    name: 'Gate',
    category: EFFECT_CATEGORIES.DYNAMICS,
    description: 'Noise gate with threshold',
    icon: FaDoorClosed,
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    category: EFFECT_CATEGORIES.TIME,
    description: 'Simple delay with feedback',
    icon: FaBroadcastTower,
  },
  delay: {
    id: 'delay',
    name: 'Advanced Delay',
    category: EFFECT_CATEGORIES.TIME,
    description: 'Stereo delay with ping-pong and filtering',
    icon: FaClock,
  },
  reverb: {
    id: 'reverb',
    name: 'Reverb',
    category: EFFECT_CATEGORIES.SPACE,
    description: 'Convolution reverb with multiple spaces',
    icon: FaBuilding,
  },
  chorus: {
    id: 'chorus',
    name: 'Chorus',
    category: EFFECT_CATEGORIES.MODULATION,
    description: 'Multi-voice chorus effect',
    icon: FaTheaterMasks,
  },
  flanger: {
    id: 'flanger',
    name: 'Flanger',
    category: EFFECT_CATEGORIES.MODULATION,
    description: 'Sweeping comb filter effect',
    icon: FaWater,
  },
  phaser: {
    id: 'phaser',
    name: 'Phaser',
    category: EFFECT_CATEGORIES.MODULATION,
    description: 'All-pass filter modulation',
    icon: FaCircleNotch,
  },
  distortion: {
    id: 'distortion',
    name: 'Distortion',
    category: EFFECT_CATEGORIES.CREATIVE,
    description: 'Waveshaping distortion with tone control',
    icon: FaBolt,
  },
  autowah: {
    id: 'autowah',
    name: 'Auto-Wah',
    category: EFFECT_CATEGORIES.MODULATION,
    description: 'Envelope-following filter sweep',
    icon: FaTrumpet,
  },
  ringmod: {
    id: 'ringmod',
    name: 'Ring Modulator',
    category: EFFECT_CATEGORIES.CREATIVE,
    description: 'Ring modulation for metallic tones',
    icon: FaRing,
  },
  tremolo: {
    id: 'tremolo',
    name: 'Tremolo',
    category: EFFECT_CATEGORIES.MODULATION,
    description: 'Amplitude modulation',
    icon: FaWaveSquare,
  },
  autopan: {
    id: 'autopan',
    name: 'Auto-Pan',
    category: EFFECT_CATEGORIES.SPACE,
    description: 'Automatic stereo panning',
    icon: FaArrowsAltH,
  },
  pitchshift: {
    id: 'pitchshift',
    name: 'Pitch Shifter',
    category: EFFECT_CATEGORIES.PITCH,
    description: 'Pitch shifting without tempo change',
    icon: FaMusic,
  },
  freqshift: {
    id: 'freqshift',
    name: 'Frequency Shifter',
    category: EFFECT_CATEGORIES.PITCH,
    description: 'Frequency domain shifting',
    icon: FaVolumeUp,
  },
  stereowide: {
    id: 'stereowide',
    name: 'Stereo Widener',
    category: EFFECT_CATEGORIES.SPACE,
    description: 'Stereo image enhancement',
    icon: FaExpandArrowsAlt,
  },
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    category: EFFECT_CATEGORIES.CREATIVE,
    description: 'Randomized glitch effects',
    icon: FaExclamationTriangle,
  },
  granular: {
    id: 'granular',
    name: 'Granular Freeze',
    category: EFFECT_CATEGORIES.CREATIVE,
    description: 'Granular synthesis and freezing',
    icon: FaSnowflake,
  },
  paulstretch: {
    id: 'paulstretch',
    name: 'Paulstretch',
    category: EFFECT_CATEGORIES.TIME,
    description: 'Extreme time stretching',
    icon: FaExpand,
  },
  spectral: {
    id: 'spectral',
    name: 'Spectral Filter',
    category: EFFECT_CATEGORIES.FREQUENCY,
    description: 'Frequency domain filtering',
    icon: FaChartBar,
  },
  reverseverb: {
    id: 'reverseverb',
    name: 'Reverse Reverb',
    category: EFFECT_CATEGORIES.SPACE,
    description: 'Reversed reverb tail effect',
    icon: FaBackward,
  },
};

/**
 * Default Parameters for Each Effect
 */
export const DEFAULT_PARAMETERS = {
  eq: {
    bands: [
      { frequency: 60, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 150, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    ],
    outputGain: 0,
  },
  filter: {
    type: 'lowpass',
    frequency: 1000,
    resonance: 1,
  },
  compressor: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.1,
    knee: 30,
    makeup: 0,
  },
  limiter: {
    threshold: -3,
    release: 0.05,
  },
  gate: {
    threshold: -40,
  },
  echo: {
    time: 250,
    feedback: 0.5,
    mix: 0.5,
  },
  delay: {
    time: 500,
    feedback: 0.5,
    mix: 0.5,
    pingPong: false,
    filterType: 'lowpass',
    filterFreq: 2000,
  },
  reverb: {
    preset: 'mediumHall',
    mix: 0.3,
    preDelay: 0,
    outputGain: 1,
    highDamp: 0.5,
    lowDamp: 0.1,
    stereoWidth: 1,
    earlyLate: 0.5,
  },
  chorus: {
    rate: 1,
    depth: 0.5,
    mix: 0.5,
  },
  flanger: {
    rate: 0.5,
    depth: 0.002,
    feedback: 0.5,
    delay: 0.005,
    mix: 0.5,
  },
  phaser: {
    rate: 0.5,
    depth: 1000,
    mix: 0.5,
  },
  distortion: {
    amount: 50,
    outputGain: 0.7,
  },
  autowah: {
    sensitivity: 0.5,
    frequency: 1000,
    resonance: 5,
  },
  ringmod: {
    frequency: 440,
    mix: 0.5,
  },
  tremolo: {
    rate: 5,
    depth: 0.5,
  },
  autopan: {
    rate: 1,
    depth: 0.8,
  },
  pitchshift: {
    shift: 0, // semitones
  },
  freqshift: {
    shift: 100, // Hz
  },
  stereowide: {
    width: 1.5,
  },
  glitch: {
    intensity: 0.5,
    rate: 0.1,
  },
  granular: {
    grainSize: 0.1,
    overlap: 0.5,
    randomization: 0.3,
  },
  paulstretch: {
    stretch: 8,
    windowSize: 0.25,
  },
  spectral: {
    threshold: 0.5,
    smoothing: 0.8,
  },
  reverseverb: {
    mix: 0.3,
    decay: 2,
  },
};

/**
 * Parameter Ranges and Metadata
 */
export const PARAMETER_RANGES = {
  eq: {
    bands: {
      frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
      gain: { min: -24, max: 24, step: 0.5, unit: 'dB' },
      q: { min: 0.1, max: 10, step: 0.1, unit: '' },
      type: { options: ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'] },
    },
    outputGain: { min: -12, max: 12, step: 0.1, unit: 'dB' },
  },
  filter: {
    type: { options: ['lowpass', 'highpass', 'bandpass', 'notch'] },
    frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
    resonance: { min: 0.1, max: 20, step: 0.1, unit: 'Q' },
  },
  compressor: {
    threshold: { min: -60, max: 0, step: 1, unit: 'dB' },
    ratio: { min: 1, max: 20, step: 0.1, unit: ':1' },
    attack: { min: 0.0001, max: 1, step: 0.0001, unit: 's' },
    release: { min: 0.01, max: 2, step: 0.01, unit: 's' },
    knee: { min: 0, max: 40, step: 1, unit: 'dB' },
    makeup: { min: 0, max: 24, step: 0.5, unit: 'dB' },
  },
  limiter: {
    threshold: { min: -12, max: 0, step: 0.5, unit: 'dB' },
    release: { min: 0.01, max: 1, step: 0.01, unit: 's' },
  },
  gate: {
    threshold: { min: -80, max: 0, step: 1, unit: 'dB' },
  },
  echo: {
    time: { min: 1, max: 2000, step: 1, unit: 'ms' },
    feedback: { min: 0, max: 0.95, step: 0.01, unit: '%' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  delay: {
    time: { min: 1, max: 2000, step: 1, unit: 'ms' },
    feedback: { min: 0, max: 0.95, step: 0.01, unit: '%' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
    pingPong: { type: 'boolean' },
    filterType: { options: ['lowpass', 'highpass', 'bandpass'] },
    filterFreq: { min: 20, max: 20000, step: 1, unit: 'Hz' },
  },
  reverb: {
    preset: { options: ['smallRoom', 'mediumRoom', 'largeRoom', 'smallHall', 'mediumHall', 'largeHall', 'plate', 'chamber'] },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
    preDelay: { min: 0, max: 200, step: 1, unit: 'ms' },
    outputGain: { min: 0, max: 2, step: 0.1, unit: 'x' },
    highDamp: { min: 0, max: 1, step: 0.01, unit: '%' },
    lowDamp: { min: 0, max: 1, step: 0.01, unit: '%' },
    stereoWidth: { min: 0, max: 2, step: 0.01, unit: '%' },
    earlyLate: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  chorus: {
    rate: { min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
    depth: { min: 0, max: 1, step: 0.01, unit: '%' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  flanger: {
    rate: { min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
    depth: { min: 0, max: 0.01, step: 0.0001, unit: 's' },
    feedback: { min: 0, max: 0.95, step: 0.01, unit: '%' },
    delay: { min: 0.001, max: 0.02, step: 0.001, unit: 's' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  phaser: {
    rate: { min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
    depth: { min: 100, max: 5000, step: 10, unit: 'Hz' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  distortion: {
    amount: { min: 0, max: 100, step: 1, unit: '' },
    outputGain: { min: 0, max: 2, step: 0.01, unit: 'x' },
  },
  autowah: {
    sensitivity: { min: 0, max: 1, step: 0.01, unit: '%' },
    frequency: { min: 100, max: 5000, step: 10, unit: 'Hz' },
    resonance: { min: 1, max: 20, step: 0.1, unit: 'Q' },
  },
  ringmod: {
    frequency: { min: 20, max: 5000, step: 1, unit: 'Hz' },
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  tremolo: {
    rate: { min: 0.1, max: 20, step: 0.1, unit: 'Hz' },
    depth: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  autopan: {
    rate: { min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
    depth: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  pitchshift: {
    shift: { min: -24, max: 24, step: 1, unit: 'semitones' },
  },
  freqshift: {
    shift: { min: -1000, max: 1000, step: 1, unit: 'Hz' },
  },
  stereowide: {
    width: { min: 0, max: 3, step: 0.01, unit: 'x' },
  },
  glitch: {
    intensity: { min: 0, max: 1, step: 0.01, unit: '%' },
    rate: { min: 0.01, max: 1, step: 0.01, unit: 's' },
  },
  granular: {
    grainSize: { min: 0.01, max: 0.5, step: 0.01, unit: 's' },
    overlap: { min: 0, max: 1, step: 0.01, unit: '%' },
    randomization: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  paulstretch: {
    stretch: { min: 2, max: 50, step: 1, unit: 'x' },
    windowSize: { min: 0.05, max: 1, step: 0.05, unit: 's' },
  },
  spectral: {
    threshold: { min: 0, max: 1, step: 0.01, unit: '%' },
    smoothing: { min: 0, max: 1, step: 0.01, unit: '%' },
  },
  reverseverb: {
    mix: { min: 0, max: 1, step: 0.01, unit: '%' },
    decay: { min: 0.1, max: 5, step: 0.1, unit: 's' },
  },
};

/**
 * Get default parameters for an effect
 */
export function getDefaultParameters(effectId) {
  return { ...DEFAULT_PARAMETERS[effectId] };
}

/**
 * Get effect metadata
 */
export function getEffectInfo(effectId) {
  return EFFECTS_CATALOG[effectId];
}

/**
 * Get all effects grouped by category
 */
export function getEffectsByCategory() {
  const grouped = {};

  Object.values(EFFECTS_CATALOG).forEach(effect => {
    if (!grouped[effect.category]) {
      grouped[effect.category] = [];
    }
    grouped[effect.category].push(effect);
  });

  return grouped;
}

/**
 * Validate effect parameters against schema
 */
export function validateParameters(effectId, parameters) {
  const ranges = PARAMETER_RANGES[effectId];
  if (!ranges) return true;

  // Simple validation - just check numeric ranges
  for (const [key, value] of Object.entries(parameters)) {
    const range = ranges[key];
    if (!range) continue;

    if (typeof value === 'number' && range.min !== undefined && range.max !== undefined) {
      if (value < range.min || value > range.max) {
        console.warn(`Parameter ${key} value ${value} out of range [${range.min}, ${range.max}]`);
        return false;
      }
    }
  }

  return true;
}
