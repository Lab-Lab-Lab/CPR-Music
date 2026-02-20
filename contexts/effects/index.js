'use client';

/**
 * Modular Effects Context System
 *
 * This module provides a more performant and maintainable approach to managing
 * effect state by splitting the monolithic EffectsContext into smaller,
 * focused contexts that only re-render when their specific state changes.
 *
 * Architecture:
 * - Each effect category has its own context and hook
 * - useReducer is used instead of multiple useState calls for better performance
 * - Components can subscribe to only the effects they need
 * - Backward compatibility is maintained through CombinedEffectsProvider
 */

// Effect category contexts
export { EQProvider, useEQ } from './EQContext';
export { DynamicsProvider, useDynamics } from './DynamicsContext';
export { ModulationProvider, useModulation } from './ModulationContext';
export { TimeBasedProvider, useTimeBased } from './TimeBasedContext';
export { SpecialEffectsProvider, useSpecialEffects } from './SpecialEffectsContext';
export { GlobalEffectsProvider, useGlobalEffects } from './GlobalEffectsContext';

// Combined provider for backward compatibility
export { CombinedEffectsProvider } from './CombinedEffectsProvider';
