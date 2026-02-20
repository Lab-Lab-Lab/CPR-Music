'use client';

/**
 * Dynamics Context - Manages compressor, gate, and limiter state
 * These effects are grouped together as they all deal with dynamic range
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const DynamicsContext = createContext();

// Initial state for dynamics effects
const initialState = {
  // Compressor core
  compressorPresent: false,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.1,
  compressorKnee: 30,
  compressorMakeup: 0,
  compressorLookahead: 0,
  compressorSidechain: false,
  compressorModel: 'modern',
  compressorAutoMakeup: true,

  // Compressor Mid/Side mode
  compressorMidSideMode: false,
  compressorMidThreshold: -24,
  compressorMidRatio: 4,
  compressorMidAttack: 0.003,
  compressorMidRelease: 0.1,
  compressorMidMakeup: 0,
  compressorSideThreshold: -24,
  compressorSideRatio: 4,
  compressorSideAttack: 0.003,
  compressorSideRelease: 0.1,
  compressorSideMakeup: 0,

  // Compressor Multiband mode
  compressorMultibandMode: false,
  compressorCrossoverFreqs: [250, 2000, 8000],
  compressorBand0Threshold: -24,
  compressorBand0Ratio: 4,
  compressorBand0Attack: 0.01,
  compressorBand0Release: 0.2,
  compressorBand0Makeup: 0,
  compressorBand1Threshold: -24,
  compressorBand1Ratio: 4,
  compressorBand1Attack: 0.005,
  compressorBand1Release: 0.15,
  compressorBand1Makeup: 0,
  compressorBand2Threshold: -24,
  compressorBand2Ratio: 4,
  compressorBand2Attack: 0.003,
  compressorBand2Release: 0.1,
  compressorBand2Makeup: 0,
  compressorBand3Threshold: -24,
  compressorBand3Ratio: 4,
  compressorBand3Attack: 0.001,
  compressorBand3Release: 0.05,
  compressorBand3Makeup: 0,

  // Gate
  gatePresent: false,
  gateThreshold: -40,
  gateRatio: 10,
  gateAttack: 0.001,
  gateRelease: 0.1,
  gateHold: 0.01,
  gateRange: -60,

  // Limiter
  limiterPresent: false,
  limiterCeiling: -0.1,
  limiterRelease: 50,
  limiterLookahead: 5,
  limiterAlgorithm: 'transparent',
  limiterIsrMode: true,
  limiterDithering: false,
  limiterMasteringMode: false,
  limiterInputGain: 0,
  limiterOutputGain: 0,
};

// Action types
const ActionTypes = {
  SET_FIELD: 'SET_FIELD',
  TOGGLE_COMPRESSOR: 'TOGGLE_COMPRESSOR',
  TOGGLE_GATE: 'TOGGLE_GATE',
  TOGGLE_LIMITER: 'TOGGLE_LIMITER',
  RESET: 'RESET',
};

function dynamicsReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_FIELD:
      return { ...state, [action.field]: action.payload };
    case ActionTypes.TOGGLE_COMPRESSOR:
      return { ...state, compressorPresent: !state.compressorPresent };
    case ActionTypes.TOGGLE_GATE:
      return { ...state, gatePresent: !state.gatePresent };
    case ActionTypes.TOGGLE_LIMITER:
      return { ...state, limiterPresent: !state.limiterPresent };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function DynamicsProvider({ children }) {
  const [state, dispatch] = useReducer(dynamicsReducer, initialState);

  // Generic setter factory
  const createSetter = useCallback((field) => {
    return (value) => dispatch({ type: ActionTypes.SET_FIELD, field, payload: value });
  }, []);

  // Toggles
  const toggleCompressor = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_COMPRESSOR });
  }, []);

  const toggleGate = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_GATE });
  }, []);

  const toggleLimiter = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_LIMITER });
  }, []);

  const resetDynamics = useCallback(() => {
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
    toggleCompressor,
    toggleGate,
    toggleLimiter,
    resetDynamics,
  }), [state, setters, toggleCompressor, toggleGate, toggleLimiter, resetDynamics]);

  return (
    <DynamicsContext.Provider value={value}>
      {children}
    </DynamicsContext.Provider>
  );
}

export function useDynamics() {
  const context = useContext(DynamicsContext);
  if (!context) {
    throw new Error('useDynamics must be used within DynamicsProvider');
  }
  return context;
}
