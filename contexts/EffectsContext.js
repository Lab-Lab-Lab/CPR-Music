'use client';

/**
 * Effects Context - Backward Compatible Wrapper
 *
 * This module now uses the modular effects context system under the hood.
 * The original monolithic context has been split into smaller, focused contexts
 * for better performance (components only re-render when their specific effects change).
 *
 * NEW ARCHITECTURE:
 * - useEQ: EQ and Mid/Side processing
 * - useDynamics: Compressor, Gate, Limiter
 * - useModulation: Chorus, Phaser, Flanger, Tremolo, Auto-Pan, Ring Mod, Auto-Wah
 * - useTimeBased: Echo, Reverb, Advanced Delay, Reverse Reverb
 * - useSpecialEffects: Distortion, Pitch Shifter, Stereo Widener, Filter, Glitch, etc.
 * - useGlobalEffects: BPM, Tempo Sync, Cut Region
 *
 * For new code, import specific hooks from 'contexts/effects' for better performance.
 * This file maintains backward compatibility with existing useEffects consumers.
 *
 * @example
 * // New way (recommended for performance):
 * import { useEQ, useDynamics } from '@/contexts/effects';
 * const { filters, setFilters } = useEQ();
 * const { compressorPresent, toggleCompressor } = useDynamics();
 *
 * // Legacy way (still works, but causes more re-renders):
 * import { useEffects } from '@/contexts/EffectsContext';
 * const { filters, setFilters, compressorPresent } = useEffects();
 */

import { CombinedEffectsProvider, useCombinedEffects } from './effects/CombinedEffectsProvider';

// Re-export for backward compatibility
export const EffectsProvider = CombinedEffectsProvider;
export const useEffects = useCombinedEffects;

// Also export the new modular hooks for gradual migration
export {
  useEQ,
  useDynamics,
  useModulation,
  useTimeBased,
  useSpecialEffects,
  useGlobalEffects,
} from './effects';
