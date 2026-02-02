'use client';

/**
 * Modulation Context - Manages chorus, phaser, flanger, tremolo, auto-pan,
 * ring modulator, and auto-wah state
 *
 * These effects are grouped together as they all use LFO-based modulation
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const ModulationContext = createContext();

// Initial state for modulation effects
const initialState = {
  // Chorus
  chorusPresent: false,
  chorusRate: 0.5,
  chorusDepth: 0.7,
  chorusDelay: 10,
  chorusFeedback: 0.2,
  chorusWetMix: 0.5,
  chorusVoices: 3,
  chorusStereoWidth: 1.0,
  chorusPhaseOffset: 90,
  chorusTempoSync: false,
  chorusNoteDivision: 4,
  chorusWaveform: 'sine',
  chorusOutputGain: 1.0,

  // Phaser
  phaserPresent: false,
  phaserRate: 0.5,
  phaserDepth: 0.7,
  phaserFeedback: 0.5,
  phaserStages: 4,
  phaserWetMix: 0.5,
  phaserTempoSync: false,
  phaserNoteDivision: 4,
  phaserWaveform: 'sine',
  phaserFreqRange: [200, 2000],
  phaserResonance: 0.7,
  phaserStereoPhase: 90,
  phaserOutputGain: 1.0,

  // Flanger
  flangerPresent: false,
  flangerRate: 0.5,
  flangerDepth: 0.002,
  flangerFeedback: 0.5,
  flangerDelay: 0.005,
  flangerMix: 0.5,
  flangerTempoSync: false,
  flangerNoteDivision: 4,
  flangerThroughZero: false,
  flangerStereoPhase: 0,
  flangerManualOffset: 0,

  // Tremolo
  tremoloPresent: false,
  tremoloRate: 5,
  tremoloDepth: 0.5,
  tremoloWaveform: 'sine',
  tremoloPhase: 0,
  tremoloTempoSync: false,
  tremoloNoteDivision: 4,

  // Auto-Pan
  autoPanPresent: false,
  autoPanRate: 1,
  autoPanDepth: 1,
  autoPanWaveform: 'sine',
  autoPanPhase: 0,
  autoPanTempoSync: false,
  autoPanNoteDivision: 4,

  // Ring Modulator
  ringModPresent: false,
  ringModFrequency: 440,
  ringModWaveform: 'sine',
  ringModMix: 1.0,
  ringModDepth: 1.0,
  ringModMode: 'classic',
  ringModSync: false,
  ringModOffset: 0,
  ringModPhase: 0,
  ringModFilterFreq: 20000,
  ringModFilterType: 'none',
  ringModOutputGain: 1.0,
  ringModStereoSpread: 0,

  // Auto-Wah
  autoWahPresent: false,
  autoWahMode: 'envelope',
  autoWahFilterType: 'bandpass',
  autoWahSensitivity: 0.5,
  autoWahFrequency: 500,
  autoWahRange: 2000,
  autoWahQ: 5,
  autoWahAttack: 0.01,
  autoWahRelease: 0.1,
  autoWahLfoRate: 0.5,
  autoWahLfoDepth: 0.5,
  autoWahLfoWaveform: 'sine',
  autoWahLfoPhase: 0,
  autoWahHybridBalance: 0.5,
  autoWahMix: 1.0,
  autoWahTempoSync: false,
  autoWahNoteDivision: 4,
};

// Action types
const ActionTypes = {
  SET_FIELD: 'SET_FIELD',
  TOGGLE_CHORUS: 'TOGGLE_CHORUS',
  TOGGLE_PHASER: 'TOGGLE_PHASER',
  TOGGLE_FLANGER: 'TOGGLE_FLANGER',
  TOGGLE_TREMOLO: 'TOGGLE_TREMOLO',
  TOGGLE_AUTO_PAN: 'TOGGLE_AUTO_PAN',
  TOGGLE_RING_MOD: 'TOGGLE_RING_MOD',
  TOGGLE_AUTO_WAH: 'TOGGLE_AUTO_WAH',
  RESET: 'RESET',
};

function modulationReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_FIELD:
      return { ...state, [action.field]: action.payload };
    case ActionTypes.TOGGLE_CHORUS:
      return { ...state, chorusPresent: !state.chorusPresent };
    case ActionTypes.TOGGLE_PHASER:
      return { ...state, phaserPresent: !state.phaserPresent };
    case ActionTypes.TOGGLE_FLANGER:
      return { ...state, flangerPresent: !state.flangerPresent };
    case ActionTypes.TOGGLE_TREMOLO:
      return { ...state, tremoloPresent: !state.tremoloPresent };
    case ActionTypes.TOGGLE_AUTO_PAN:
      return { ...state, autoPanPresent: !state.autoPanPresent };
    case ActionTypes.TOGGLE_RING_MOD:
      return { ...state, ringModPresent: !state.ringModPresent };
    case ActionTypes.TOGGLE_AUTO_WAH:
      return { ...state, autoWahPresent: !state.autoWahPresent };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function ModulationProvider({ children }) {
  const [state, dispatch] = useReducer(modulationReducer, initialState);

  // Generic setter factory
  const createSetter = useCallback((field) => {
    return (value) => dispatch({ type: ActionTypes.SET_FIELD, field, payload: value });
  }, []);

  // Toggles
  const toggleChorus = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_CHORUS });
  }, []);

  const togglePhaser = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_PHASER });
  }, []);

  const toggleFlanger = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_FLANGER });
  }, []);

  const toggleTremolo = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_TREMOLO });
  }, []);

  const toggleAutoPan = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_AUTO_PAN });
  }, []);

  const toggleRingMod = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_RING_MOD });
  }, []);

  const toggleAutoWah = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_AUTO_WAH });
  }, []);

  const resetModulation = useCallback(() => {
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
    toggleChorus,
    togglePhaser,
    toggleFlanger,
    toggleTremolo,
    toggleAutoPan,
    toggleRingMod,
    toggleAutoWah,
    resetModulation,
  }), [
    state,
    setters,
    toggleChorus,
    togglePhaser,
    toggleFlanger,
    toggleTremolo,
    toggleAutoPan,
    toggleRingMod,
    toggleAutoWah,
    resetModulation,
  ]);

  return (
    <ModulationContext.Provider value={value}>
      {children}
    </ModulationContext.Provider>
  );
}

export function useModulation() {
  const context = useContext(ModulationContext);
  if (!context) {
    throw new Error('useModulation must be used within ModulationProvider');
  }
  return context;
}
