'use client';

/**
 * Special Effects Context - Manages distortion, pitch shifter, stereo widener,
 * filter, glitch, frequency shifter, granular, paulstretch, and spectral effects
 *
 * These are specialized effects that don't fit neatly into other categories
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const SpecialEffectsContext = createContext();

// Initial state for special effects
const initialState = {
  // Distortion
  distortionPresent: false,
  distortionType: 'tubeSaturation',
  distortionDrive: 5,
  distortionTone: 5000,
  distortionPresence: 0,
  distortionBass: 0,
  distortionMid: 0,
  distortionTreble: 0,
  distortionOutputGain: 0.7,
  distortionAsymmetry: 0,
  distortionHarmonics: 0.5,
  distortionWetMix: 1.0,

  // Pitch Shifter
  pitchShiftPresent: false,
  pitchShiftSemitones: 0,
  pitchShiftCents: 0,
  pitchShiftFormant: 0,
  pitchShiftFormantCorrection: true,
  pitchShiftMix: 1.0,
  pitchShiftQuality: 'high',
  pitchShiftGrainSize: 1024,
  pitchShiftOverlap: 0.5,
  pitchShiftStretch: 1.0,
  pitchShiftPreserveTimbre: true,
  pitchShiftOutputGain: 1.0,
  pitchShiftPan: 0,

  // Stereo Widener
  stereoWidenerPresent: false,
  stereoWidenerWidth: 1.5,
  stereoWidenerDelay: 10,
  stereoWidenerBassRetain: true,
  stereoWidenerBassFreq: 200,
  stereoWidenerMode: 'classic',
  stereoWidenerMidGain: 0,
  stereoWidenerSideGain: 0,
  stereoWidenerPhase: 0,
  stereoWidenerCorrelation: 0,
  stereoWidenerHighFreqLimit: 20000,
  stereoWidenerSafetyLimit: true,
  stereoWidenerOutputGain: 1.0,

  // Filter
  filterPresent: false,
  filterType: 'lowpass',
  filterFrequency: 1000,
  filterResonance: 1,
  filterGain: 0,
  filterLfoRate: 0.5,
  filterLfoDepth: 0,
  filterLfoWaveform: 'sine',
  filterLfoTempoSync: false,
  filterLfoNoteDiv: 4,
  filterMix: 1.0,

  // Glitch/Beat Repeat
  glitchPresent: false,
  glitchDivision: 16,
  glitchProbability: 0.3,
  glitchRepeats: 2,
  glitchReverse: 0.2,
  glitchPitch: 0,
  glitchCrush: false,
  glitchGate: 1,

  // Frequency Shifter
  freqShiftPresent: false,
  freqShiftAmount: 0,
  freqShiftFeedback: 0,
  freqShiftMix: 0.5,

  // Granular Freeze
  granularPresent: false,
  granularGrainSize: 100,
  granularPosition: 0.5,
  granularSpray: 50,
  granularPitch: 0,
  granularDensity: 0.5,
  granularReverse: 0,

  // Paulstretch
  paulstretchPresent: false,
  paulstretchFactor: 8,
  paulstretchWindow: 0.25,
  paulstretchSmooth: 10,

  // Spectral Filter
  spectralPresent: false,
};

// Action types
const ActionTypes = {
  SET_FIELD: 'SET_FIELD',
  TOGGLE_DISTORTION: 'TOGGLE_DISTORTION',
  TOGGLE_PITCH_SHIFT: 'TOGGLE_PITCH_SHIFT',
  TOGGLE_STEREO_WIDENER: 'TOGGLE_STEREO_WIDENER',
  TOGGLE_FILTER: 'TOGGLE_FILTER',
  TOGGLE_GLITCH: 'TOGGLE_GLITCH',
  TOGGLE_FREQ_SHIFT: 'TOGGLE_FREQ_SHIFT',
  TOGGLE_GRANULAR: 'TOGGLE_GRANULAR',
  TOGGLE_PAULSTRETCH: 'TOGGLE_PAULSTRETCH',
  TOGGLE_SPECTRAL: 'TOGGLE_SPECTRAL',
  RESET: 'RESET',
};

function specialEffectsReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_FIELD:
      return { ...state, [action.field]: action.payload };
    case ActionTypes.TOGGLE_DISTORTION:
      return { ...state, distortionPresent: !state.distortionPresent };
    case ActionTypes.TOGGLE_PITCH_SHIFT:
      return { ...state, pitchShiftPresent: !state.pitchShiftPresent };
    case ActionTypes.TOGGLE_STEREO_WIDENER:
      return { ...state, stereoWidenerPresent: !state.stereoWidenerPresent };
    case ActionTypes.TOGGLE_FILTER:
      return { ...state, filterPresent: !state.filterPresent };
    case ActionTypes.TOGGLE_GLITCH:
      return { ...state, glitchPresent: !state.glitchPresent };
    case ActionTypes.TOGGLE_FREQ_SHIFT:
      return { ...state, freqShiftPresent: !state.freqShiftPresent };
    case ActionTypes.TOGGLE_GRANULAR:
      return { ...state, granularPresent: !state.granularPresent };
    case ActionTypes.TOGGLE_PAULSTRETCH:
      return { ...state, paulstretchPresent: !state.paulstretchPresent };
    case ActionTypes.TOGGLE_SPECTRAL:
      return { ...state, spectralPresent: !state.spectralPresent };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function SpecialEffectsProvider({ children }) {
  const [state, dispatch] = useReducer(specialEffectsReducer, initialState);

  // Generic setter factory
  const createSetter = useCallback((field) => {
    return (value) => dispatch({ type: ActionTypes.SET_FIELD, field, payload: value });
  }, []);

  // Toggles
  const toggleDistortion = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_DISTORTION });
  }, []);

  const togglePitchShift = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_PITCH_SHIFT });
  }, []);

  const toggleStereoWidener = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_STEREO_WIDENER });
  }, []);

  const toggleFilter = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_FILTER });
  }, []);

  const toggleGlitch = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_GLITCH });
  }, []);

  const toggleFreqShift = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_FREQ_SHIFT });
  }, []);

  const toggleGranular = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_GRANULAR });
  }, []);

  const togglePaulstretch = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_PAULSTRETCH });
  }, []);

  const toggleSpectral = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_SPECTRAL });
  }, []);

  const resetSpecialEffects = useCallback(() => {
    dispatch({ type: ActionTypes.RESET });
  }, []);

  // Create all setters
  const setters = useMemo(() => {
    const setterMap = {};
    Object.keys(initialState).forEach(key => {
      const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
      setterMap[setterName] = createSetter(key);
    });
    return setterMap;
  }, [createSetter]);

  const value = useMemo(() => ({
    // State
    ...state,

    // Setters
    ...setters,

    // Toggles
    toggleDistortion,
    togglePitchShift,
    toggleStereoWidener,
    toggleFilter,
    toggleGlitch,
    toggleFreqShift,
    toggleGranular,
    togglePaulstretch,
    toggleSpectral,
    resetSpecialEffects,
  }), [
    state,
    setters,
    toggleDistortion,
    togglePitchShift,
    toggleStereoWidener,
    toggleFilter,
    toggleGlitch,
    toggleFreqShift,
    toggleGranular,
    togglePaulstretch,
    toggleSpectral,
    resetSpecialEffects,
  ]);

  return (
    <SpecialEffectsContext.Provider value={value}>
      {children}
    </SpecialEffectsContext.Provider>
  );
}

export function useSpecialEffects() {
  const context = useContext(SpecialEffectsContext);
  if (!context) {
    throw new Error('useSpecialEffects must be used within SpecialEffectsProvider');
  }
  return context;
}
