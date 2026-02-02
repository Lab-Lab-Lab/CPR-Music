/**
 * Clip Effects Manager
 *
 * Manages effects chains for individual audio clips in the multitrack editor.
 * Each clip can have its own effects chain that processes the audio non-destructively.
 */

import { processEffect, processEffectsChain } from '../../../../lib/effects/UnifiedEffectsProcessor';
import { getDefaultParameters } from '../../../../lib/effects/EffectsParameterSchemas';

/**
 * Add an effect to a clip's effects chain
 * @param {Object} clip - The clip to modify
 * @param {string} effectType - The effect type to add
 * @returns {Object} - Updated clip with new effect
 */
export function addEffectToClip(clip, effectType) {
  const effects = clip.effects || [];

  const newEffect = {
    id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    type: effectType,
    parameters: getDefaultParameters(effectType),
    enabled: true,
  };

  return {
    ...clip,
    effects: [...effects, newEffect],
  };
}

/**
 * Remove an effect from a clip's effects chain
 * @param {Object} clip - The clip to modify
 * @param {string} effectId - The effect ID to remove
 * @returns {Object} - Updated clip without the effect
 */
export function removeEffectFromClip(clip, effectId) {
  const effects = clip.effects || [];

  return {
    ...clip,
    effects: effects.filter(effect => effect.id !== effectId),
  };
}

/**
 * Update effect parameters
 * @param {Object} clip - The clip to modify
 * @param {string} effectId - The effect ID to update
 * @param {Object} parameters - New parameters to merge
 * @returns {Object} - Updated clip with modified effect
 */
export function updateEffectParameters(clip, effectId, parameters) {
  const effects = clip.effects || [];

  return {
    ...clip,
    effects: effects.map(effect =>
      effect.id === effectId
        ? { ...effect, parameters: { ...effect.parameters, ...parameters } }
        : effect
    ),
  };
}

/**
 * Toggle effect enabled/bypassed state
 * @param {Object} clip - The clip to modify
 * @param {string} effectId - The effect ID to toggle
 * @returns {Object} - Updated clip with toggled effect
 */
export function toggleEffectEnabled(clip, effectId) {
  const effects = clip.effects || [];

  return {
    ...clip,
    effects: effects.map(effect =>
      effect.id === effectId
        ? { ...effect, enabled: !effect.enabled }
        : effect
    ),
  };
}

/**
 * Reorder effects in the chain
 * @param {Object} clip - The clip to modify
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Target index
 * @returns {Object} - Updated clip with reordered effects
 */
export function reorderEffects(clip, fromIndex, toIndex) {
  const effects = [...(clip.effects || [])];

  const [removed] = effects.splice(fromIndex, 1);
  effects.splice(toIndex, 0, removed);

  return {
    ...clip,
    effects,
  };
}

/**
 * Process a clip's audio with its effects chain
 * @param {AudioBuffer} audioBuffer - The clip's audio buffer
 * @param {Object} clip - The clip with effects
 * @param {AudioContext} audioContext - Web Audio context
 * @returns {Promise<AudioBuffer>} - Processed audio buffer
 */
export async function processClipWithEffects(audioBuffer, clip, audioContext) {
  if (!clip.effects || clip.effects.length === 0) {
    return audioBuffer;
  }

  // Process entire buffer (clips are already isolated regions)
  const startSample = 0;
  const endSample = audioBuffer.length;

  return await processEffectsChain(
    audioBuffer,
    startSample,
    endSample,
    clip.effects,
    audioContext
  );
}

/**
 * Get a summary of effects on a clip (for UI display)
 * @param {Object} clip - The clip to analyze
 * @returns {Object} - Summary object
 */
export function getClipEffectsSummary(clip) {
  const effects = clip.effects || [];

  return {
    count: effects.length,
    enabled: effects.filter(e => e.enabled).length,
    disabled: effects.filter(e => !e.enabled).length,
    types: effects.map(e => e.type),
  };
}

/**
 * Check if a clip has any effects
 * @param {Object} clip - The clip to check
 * @returns {boolean} - True if clip has effects
 */
export function clipHasEffects(clip) {
  return clip.effects && clip.effects.length > 0;
}

/**
 * Clear all effects from a clip
 * @param {Object} clip - The clip to modify
 * @returns {Object} - Updated clip without effects
 */
export function clearAllEffects(clip) {
  return {
    ...clip,
    effects: [],
  };
}

/**
 * Duplicate effects from one clip to another
 * @param {Object} sourceClip - Clip to copy effects from
 * @param {Object} targetClip - Clip to copy effects to
 * @returns {Object} - Updated target clip with copied effects
 */
export function copyEffectsToClip(sourceClip, targetClip) {
  if (!sourceClip.effects || sourceClip.effects.length === 0) {
    return targetClip;
  }

  // Deep clone effects with new IDs
  const copiedEffects = sourceClip.effects.map(effect => ({
    ...effect,
    id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    parameters: { ...effect.parameters },
  }));

  return {
    ...targetClip,
    effects: copiedEffects,
  };
}

/**
 * Get preset effects chains
 */
export const EFFECT_CHAIN_PRESETS = {
  vocal: {
    name: 'Vocal Processing',
    effects: [
      { type: 'eq', parameters: {
        bands: [
          { frequency: 60, gain: 0, q: 1.0, type: 'highpass', enabled: true },
          { frequency: 200, gain: -2, q: 0.7, type: 'peaking', enabled: true },
          { frequency: 3000, gain: 3, q: 0.7, type: 'peaking', enabled: true },
        ]
      }},
      { type: 'compressor', parameters: { threshold: -18, ratio: 4, attack: 0.005, release: 0.1 }},
      { type: 'reverb', parameters: { mix: 0.2, preset: 'smallRoom' }},
    ]
  },
  guitar: {
    name: 'Guitar Enhancement',
    effects: [
      { type: 'eq', parameters: {
        bands: [
          { frequency: 80, gain: 1, q: 0.7, type: 'lowshelf', enabled: true },
          { frequency: 2000, gain: 2, q: 0.7, type: 'peaking', enabled: true },
        ]
      }},
      { type: 'compressor', parameters: { threshold: -20, ratio: 3, attack: 0.01, release: 0.15 }},
    ]
  },
  drums: {
    name: 'Drum Punch',
    effects: [
      { type: 'compressor', parameters: { threshold: -24, ratio: 6, attack: 0.001, release: 0.05 }},
      { type: 'eq', parameters: {
        bands: [
          { frequency: 60, gain: 3, q: 0.7, type: 'lowshelf', enabled: true },
          { frequency: 3000, gain: 2, q: 0.7, type: 'peaking', enabled: true },
        ]
      }},
    ]
  },
  telephone: {
    name: 'Lo-Fi / Telephone',
    effects: [
      { type: 'eq', parameters: {
        bands: [
          { frequency: 100, gain: 0, q: 2.0, type: 'highpass', enabled: true },
          { frequency: 500, gain: 3, q: 0.7, type: 'peaking', enabled: true },
          { frequency: 3000, gain: 0, q: 2.0, type: 'lowpass', enabled: true },
        ]
      }},
      { type: 'distortion', parameters: { amount: 30, outputGain: 0.8 }},
    ]
  },
  spacey: {
    name: 'Spacey / Ambient',
    effects: [
      { type: 'reverb', parameters: { mix: 0.6, preset: 'largeHall' }},
      { type: 'chorus', parameters: { rate: 0.3, depth: 0.7, mix: 0.4 }},
      { type: 'eq', parameters: {
        bands: [
          { frequency: 8000, gain: 3, q: 0.7, type: 'highshelf', enabled: true },
        ]
      }},
    ]
  },
};

/**
 * Apply a preset effects chain to a clip
 * @param {Object} clip - The clip to modify
 * @param {string} presetName - The preset name from EFFECT_CHAIN_PRESETS
 * @returns {Object} - Updated clip with preset effects
 */
export function applyEffectChainPreset(clip, presetName) {
  const preset = EFFECT_CHAIN_PRESETS[presetName];

  if (!preset) {
    console.warn(`Unknown preset: ${presetName}`);
    return clip;
  }

  const newEffects = preset.effects.map(effectTemplate => ({
    id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    type: effectTemplate.type,
    parameters: effectTemplate.parameters || getDefaultParameters(effectTemplate.type),
    enabled: true,
  }));

  return {
    ...clip,
    effects: newEffects,
  };
}
