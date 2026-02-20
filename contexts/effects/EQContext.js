'use client';

/**
 * EQ Context - Manages all EQ-related state
 * Includes standard EQ and Mid/Side processing
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const EQContext = createContext();

// Initial state for EQ
const initialState = {
  // Core EQ
  filters: [],
  eqPresent: false,
  eqLinearPhase: false,
  eqSpectrumAnalyzer: true,
  eqBypass: false,
  eqGain: 0,

  // Mid/Side processing
  eqMidSideMode: false,
  eqMidFilters: [],
  eqSideFilters: [],
  eqMidGain: 0,
  eqSideGain: 0,
  eqStereoLink: true,
};

// Action types
const ActionTypes = {
  SET_FILTERS: 'SET_FILTERS',
  SET_EQ_PRESENT: 'SET_EQ_PRESENT',
  TOGGLE_EQ: 'TOGGLE_EQ',
  SET_LINEAR_PHASE: 'SET_LINEAR_PHASE',
  SET_SPECTRUM_ANALYZER: 'SET_SPECTRUM_ANALYZER',
  SET_BYPASS: 'SET_BYPASS',
  SET_GAIN: 'SET_GAIN',
  SET_MID_SIDE_MODE: 'SET_MID_SIDE_MODE',
  SET_MID_FILTERS: 'SET_MID_FILTERS',
  SET_SIDE_FILTERS: 'SET_SIDE_FILTERS',
  SET_MID_GAIN: 'SET_MID_GAIN',
  SET_SIDE_GAIN: 'SET_SIDE_GAIN',
  SET_STEREO_LINK: 'SET_STEREO_LINK',
  RESET: 'RESET',
};

function eqReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_FILTERS:
      return { ...state, filters: action.payload };
    case ActionTypes.SET_EQ_PRESENT:
      return { ...state, eqPresent: action.payload };
    case ActionTypes.TOGGLE_EQ:
      return { ...state, eqPresent: !state.eqPresent };
    case ActionTypes.SET_LINEAR_PHASE:
      return { ...state, eqLinearPhase: action.payload };
    case ActionTypes.SET_SPECTRUM_ANALYZER:
      return { ...state, eqSpectrumAnalyzer: action.payload };
    case ActionTypes.SET_BYPASS:
      return { ...state, eqBypass: action.payload };
    case ActionTypes.SET_GAIN:
      return { ...state, eqGain: action.payload };
    case ActionTypes.SET_MID_SIDE_MODE:
      return { ...state, eqMidSideMode: action.payload };
    case ActionTypes.SET_MID_FILTERS:
      return { ...state, eqMidFilters: action.payload };
    case ActionTypes.SET_SIDE_FILTERS:
      return { ...state, eqSideFilters: action.payload };
    case ActionTypes.SET_MID_GAIN:
      return { ...state, eqMidGain: action.payload };
    case ActionTypes.SET_SIDE_GAIN:
      return { ...state, eqSideGain: action.payload };
    case ActionTypes.SET_STEREO_LINK:
      return { ...state, eqStereoLink: action.payload };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function EQProvider({ children }) {
  const [state, dispatch] = useReducer(eqReducer, initialState);

  // Memoized action creators
  const setFilters = useCallback((filters) => {
    dispatch({ type: ActionTypes.SET_FILTERS, payload: filters });
  }, []);

  const setEqPresent = useCallback((present) => {
    dispatch({ type: ActionTypes.SET_EQ_PRESENT, payload: present });
  }, []);

  const toggleEQ = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_EQ });
  }, []);

  const setEqLinearPhase = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_LINEAR_PHASE, payload: value });
  }, []);

  const setEqSpectrumAnalyzer = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_SPECTRUM_ANALYZER, payload: value });
  }, []);

  const setEqBypass = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_BYPASS, payload: value });
  }, []);

  const setEqGain = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_GAIN, payload: value });
  }, []);

  const setEqMidSideMode = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_MID_SIDE_MODE, payload: value });
  }, []);

  const setEqMidFilters = useCallback((filters) => {
    dispatch({ type: ActionTypes.SET_MID_FILTERS, payload: filters });
  }, []);

  const setEqSideFilters = useCallback((filters) => {
    dispatch({ type: ActionTypes.SET_SIDE_FILTERS, payload: filters });
  }, []);

  const setEqMidGain = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_MID_GAIN, payload: value });
  }, []);

  const setEqSideGain = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_SIDE_GAIN, payload: value });
  }, []);

  const setEqStereoLink = useCallback((value) => {
    dispatch({ type: ActionTypes.SET_STEREO_LINK, payload: value });
  }, []);

  const resetEQ = useCallback(() => {
    dispatch({ type: ActionTypes.RESET });
  }, []);

  const value = useMemo(() => ({
    // State
    ...state,

    // Actions
    setFilters,
    setEqPresent,
    toggleEQ,
    setEqLinearPhase,
    setEqSpectrumAnalyzer,
    setEqBypass,
    setEqGain,
    setEqMidSideMode,
    setEqMidFilters,
    setEqSideFilters,
    setEqMidGain,
    setEqSideGain,
    setEqStereoLink,
    resetEQ,
  }), [
    state,
    setFilters,
    setEqPresent,
    toggleEQ,
    setEqLinearPhase,
    setEqSpectrumAnalyzer,
    setEqBypass,
    setEqGain,
    setEqMidSideMode,
    setEqMidFilters,
    setEqSideFilters,
    setEqMidGain,
    setEqSideGain,
    setEqStereoLink,
    resetEQ,
  ]);

  return (
    <EQContext.Provider value={value}>
      {children}
    </EQContext.Provider>
  );
}

export function useEQ() {
  const context = useContext(EQContext);
  if (!context) {
    throw new Error('useEQ must be used within EQProvider');
  }
  return context;
}
