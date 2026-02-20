/**
 * Clip Effect Parameters Modal
 *
 * Modal that displays effect parameter controls for clip-based effects.
 * Reuses the visual effect components from the single-track editor.
 */

'use client';

import { useState, useCallback } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { updateEffectParameters } from './ClipEffectsManager';
import { EFFECTS_CATALOG } from '../../../../lib/effects/EffectsParameterSchemas';

// Import effect components from single-track editor
import ClipEQ from './effects/ClipEQ';
import ClipReverb from './effects/ClipReverb';
import ClipEcho from './effects/ClipEcho';
import ClipChorus from './effects/ClipChorus';
import ClipDistortion from './effects/ClipDistortion';
import ClipPhaser from './effects/ClipPhaser';
import ClipAutoPan from './effects/ClipAutoPan';
import ClipTremolo from './effects/ClipTremolo';
import ClipCompressor from './effects/ClipCompressor';
import ClipRingModulator from './effects/ClipRingModulator';
import ClipFlanger from './effects/ClipFlanger';
import ClipFilter from './effects/ClipFilter';
import ClipGate from './effects/ClipGate';
import ClipLimiter from './effects/ClipLimiter';
import ClipPitchShifter from './effects/ClipPitchShifter';
import ClipFrequencyShifter from './effects/ClipFrequencyShifter';
import ClipStereoWidener from './effects/ClipStereoWidener';
import ClipAutoWah from './effects/ClipAutoWah';
import ClipAdvancedDelay from './effects/ClipAdvancedDelay';

/**
 * Map effect types to their components
 */
const EFFECT_COMPONENTS = {
  eq: ClipEQ,
  reverb: ClipReverb,
  echo: ClipEcho,
  chorus: ClipChorus,
  distortion: ClipDistortion,
  phaser: ClipPhaser,
  autopan: ClipAutoPan,
  tremolo: ClipTremolo,
  compressor: ClipCompressor,
  ringmod: ClipRingModulator,
  flanger: ClipFlanger,
  filter: ClipFilter,
  gate: ClipGate,
  limiter: ClipLimiter,
  pitchshift: ClipPitchShifter,
  freqshift: ClipFrequencyShifter,
  stereowide: ClipStereoWidener,
  autowah: ClipAutoWah,
  delay: ClipAdvancedDelay,
};

/**
 * Main Modal Component
 */
export default function ClipEffectParametersModal({
  show,
  onHide,
  clipId,
  effectId,
  effectType,
  currentParameters
}) {
  const { tracks, updateTrack } = useMultitrack();

  // Find the clip and track
  const clipData = tracks
    .flatMap(track => (track.clips || []).map(clip => ({ ...clip, trackId: track.id })))
    .find(clip => clip.id === clipId);

  const track = tracks.find(t => t.id === clipData?.trackId);

  // Update effect parameters
  const handleParameterChange = useCallback((newParameters) => {
    if (!clipData || !track) return;

    const updatedClip = updateEffectParameters(clipData, effectId, newParameters);

    updateTrack(track.id, {
      clips: track.clips.map(c => c.id === clipId ? updatedClip : c)
    });
  }, [clipData, track, effectId, clipId, updateTrack]);

  // Get effect info
  const effectInfo = EFFECTS_CATALOG[effectType];
  const EffectComponent = EFFECT_COMPONENTS[effectType];
  const IconComponent = effectInfo?.icon;

  if (!show || !effectInfo || !EffectComponent) {
    return null;
  }

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      className="clip-effect-modal"
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          {IconComponent && <IconComponent className="me-2" />}
          {effectInfo.name}
          <small className="text-muted ms-3">
            Clip: {clipData?.name || 'Unnamed'}
          </small>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark text-white" style={{ minHeight: '400px' }}>
        <EffectComponent
          parameters={currentParameters}
          onParametersChange={handleParameterChange}
        />
      </Modal.Body>

      <Modal.Footer className="bg-dark border-secondary">
        <small className="text-muted me-auto">
          {effectInfo.description}
        </small>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
