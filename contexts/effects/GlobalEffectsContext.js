'use client';

/**
 * Global Effects Context - Manages global settings like tempo sync and cut regions
 */

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const GlobalEffectsContext = createContext();

// Initial state for global effects settings
const initialState = {
  // Global tempo sync
  globalBPM: 120,
  tempoSyncEnabled: false,

  // Regions for cutting
  cutRegion: '',
};

// Action types
const ActionTypes = {
  SET_GLOBAL_BPM: 'SET_GLOBAL_BPM',
  SET_TEMPO_SYNC_ENABLED: 'SET_TEMPO_SYNC_ENABLED',
  SET_CUT_REGION: 'SET_CUT_REGION',
  RESET: 'RESET',
};

function globalEffectsReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_GLOBAL_BPM:
      return { ...state, globalBPM: action.payload };
    case ActionTypes.SET_TEMPO_SYNC_ENABLED:
      return { ...state, tempoSyncEnabled: action.payload };
    case ActionTypes.SET_CUT_REGION:
      return { ...state, cutRegion: action.payload };
    case ActionTypes.RESET:
      return initialState;
    default:
      return state;
  }
}

export function GlobalEffectsProvider({ children }) {
  const [state, dispatch] = useReducer(globalEffectsReducer, initialState);

  const setGlobalBPM = useCallback((bpm) => {
    dispatch({ type: ActionTypes.SET_GLOBAL_BPM, payload: bpm });
  }, []);

  const setTempoSyncEnabled = useCallback((enabled) => {
    dispatch({ type: ActionTypes.SET_TEMPO_SYNC_ENABLED, payload: enabled });
  }, []);

  const setCutRegion = useCallback((region) => {
    dispatch({ type: ActionTypes.SET_CUT_REGION, payload: region });
  }, []);

  const resetGlobalEffects = useCallback(() => {
    dispatch({ type: ActionTypes.RESET });
  }, []);

  const value = useMemo(() => ({
    // State
    ...state,

    // Actions
    setGlobalBPM,
    setTempoSyncEnabled,
    setCutRegion,
    resetGlobalEffects,
  }), [
    state,
    setGlobalBPM,
    setTempoSyncEnabled,
    setCutRegion,
    resetGlobalEffects,
  ]);

  return (
    <GlobalEffectsContext.Provider value={value}>
      {children}
    </GlobalEffectsContext.Provider>
  );
}

export function useGlobalEffects() {
  const context = useContext(GlobalEffectsContext);
  if (!context) {
    throw new Error('useGlobalEffects must be used within GlobalEffectsProvider');
  }
  return context;
}
