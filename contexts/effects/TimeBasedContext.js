'use client';

/**
 * Time-Based Effects Context - Manages echo, reverb, advanced delay,
 * and reverse reverb state
 *
 * These effects are grouped together as they all deal with time-domain processing
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const TimeBasedContext = createContext();

// Initial state for time-based effects
const initialState = {
  // Echo (legacy)
  rvbPresent: false,
  inGain: 0,
  outGain: 0,
  delay: 0,
  decay: 0,

  // Echo-specific parameters
  echoDelay: 500,
  echoFeedback: 0.5,
  echoInputGain: 1.0,
  echoOutputGain: 1.0,

  // Reverb (new Web Audio)
  reverbPresent: false,
  reverbPreset: 'mediumHall',
  reverbWetMix: 0.3,
  reverbPreDelay: 0,
  reverbOutputGain: 1,
  reverbHighDamp: 0.5,
  reverbLowDamp: 0.1,
  reverbEarlyLate: 0.5,
  reverbStereoWidth: 1,

  // Reverse Reverb
  reverseReverbPresent: false,
  reverseReverbPreset: 'mediumHall',
  reverseReverbMix: 0.7,
  reverseReverbFade: 0.1,
  reverseReverbPredelay: 0,
  reverseReverbBuildup: 0.5,

  // Advanced Delay
  advDelayPresent: false,
  advDelayTime: 500,
  advDelayFeedback: 0.5,
  advDelayMix: 0.5,
  advDelayPingPong: false,
  advDelayFilterFreq: 2000,
  advDelayFilterType: 'lowpass',
  advDelayTempoSync: false,
  advDelayNoteDivision: 4,
  advDelayTaps: 3,
  advDelaySpread: 0.3,
  advDelayModRate: 0.5,
  advDelayModDepth: 0.1,
  advDelayModWaveform: 'sine',
  advDelaySaturation: 0,
  advDelayDiffusion: 0.3,
  advDelayStereoWidth: 1.0,
  advDelayOutputGain: 1.0,
};

// Action types
const ActionTypes = {
  SET_FIELD: 'SET_FIELD',
  TOGGLE_REVERB: 'TOGGLE_REVERB',
  TOGGLE_REVERB_NEW: 'TOGGLE_REVERB_NEW',
  TOGGLE_REVERSE_REVERB: 'TOGGLE_REVERSE_REVERB',
  TOGGLE_ADV_DELAY: 'TOGGLE_ADV_DELAY',
  RESET: 'RESET',
};

function timeBasedReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_FIELD:
      return { ...state, [action.field]: action.payload };
    case ActionTypes.TOGGLE_REVERB:
      return { ...state, rvbPresent: !state.rvbPresent };
    case ActionTypes.TOGGLE_REVERB_NEW:
      return { ...state, reverbPresent: !state.reverbPresent };
    case ActionTypes.TOGGLE_REVERSE_REVERB:
      return { ...state, reverseReverbPresent: !state.reverseReverbPresent };
    case ActionTypes.TOGGLE_ADV_DELAY:
      return { ...state, advDelayPresent: !state.advDelayPresent };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function TimeBasedProvider({ children }) {
  const [state, dispatch] = useReducer(timeBasedReducer, initialState);

  // Generic setter factory
  const createSetter = useCallback((field) => {
    return (value) => dispatch({ type: ActionTypes.SET_FIELD, field, payload: value });
  }, []);

  // Toggles
  const toggleReverb = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_REVERB });
  }, []);

  const toggleReverbNew = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_REVERB_NEW });
  }, []);

  const toggleReverseReverb = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_REVERSE_REVERB });
  }, []);

  const toggleAdvDelay = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_ADV_DELAY });
  }, []);

  const resetTimeBased = useCallback(() => {
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
    toggleReverb,
    toggleReverbNew,
    toggleReverseReverb,
    toggleAdvDelay,
    resetTimeBased,
  }), [
    state,
    setters,
    toggleReverb,
    toggleReverbNew,
    toggleReverseReverb,
    toggleAdvDelay,
    resetTimeBased,
  ]);

  return (
    <TimeBasedContext.Provider value={value}>
      {children}
    </TimeBasedContext.Provider>
  );
}

export function useTimeBased() {
  const context = useContext(TimeBasedContext);
  if (!context) {
    throw new Error('useTimeBased must be used within TimeBasedProvider');
  }
  return context;
}
