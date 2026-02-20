'use client';

import React, { lazy, Suspense } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import { useUI } from '../../../../contexts/DAWProvider';

// Dynamically import effect components
const effectComponents = {
  eq: lazy(() => import('./EQ')),
  filter: lazy(() => import('./Filter')),
  compressor: lazy(() => import('./Compressor')),
  limiter: lazy(() => import('./Limiter')),
  gate: lazy(() => import('./Gate')),
  distortion: lazy(() => import('./Distortion')),
  echo: lazy(() => import('./Echo')),
  advdelay: lazy(() => import('./AdvancedDelay')),
  reverb: lazy(() => import('./Reverb')),
  reverseverb: lazy(() => import('./ReverseReverb')),
  chorus: lazy(() => import('./Chorus')),
  flanger: lazy(() => import('./Flanger')),
  phaser: lazy(() => import('./Phaser')),
  tremolo: lazy(() => import('./Tremolo')),
  autopan: lazy(() => import('./AutoPan')),
  autowah: lazy(() => import('./AutoWah')),
  pitchshift: lazy(() => import('./PitchShifter')),
  freqshift: lazy(() => import('./FrequencyShifter')),
  ringmod: lazy(() => import('./RingModulator')),
  glitch: lazy(() => import('./Glitch')),
  granular: lazy(() => import('./GranularFreeze')),
  paulstretch: lazy(() => import('./Paulstretch')),
  spectral: lazy(() => import('./SpectralFilter')),
  stereowide: lazy(() => import('./StereoWidener'))
};

export default function EffectControlModal() {
  const {
    showEffectControlModal,
    setShowEffectControlModal,
    setShowEffectsModal,
    selectedEffect,
    setSelectedEffect
  } = useUI();


  const handleBack = () => {
    setShowEffectControlModal(false);
    setShowEffectsModal(true);
  };

  const handleClose = () => {
    setShowEffectControlModal(false);
    setSelectedEffect(null);
  };


  if (!selectedEffect) {
    return null;
  }

  const EffectComponent = effectComponents[selectedEffect.id];
  const Icon = selectedEffect.icon;

  return (
    <Modal
      show={showEffectControlModal}
      onHide={handleClose}
      size="xl"
      centered
      backdrop="static"
      keyboard={true}
      className="effect-control-modal"
    >
      <Modal.Header className="bg-dark text-white border-secondary">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleBack}
          >
            <FaArrowLeft className="me-2" />
            Back
          </Button>
          <div className="d-flex align-items-center gap-2">
            <div
              className="effect-icon p-2 rounded"
              style={{ backgroundColor: selectedEffect.color + '33' }}
            >
              <Icon size={20} style={{ color: selectedEffect.color }} />
            </div>
            <Modal.Title className="mb-0">
              {selectedEffect.name}
            </Modal.Title>
          </div>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={handleClose}
        >
          <FaTimes />
        </Button>
      </Modal.Header>

      <Modal.Body className="p-0" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="d-flex flex-column">
          {/* Main content area */}
          <div className="p-4">
            <Suspense
              fallback={
                <div className="d-flex align-items-center justify-content-center h-100">
                  <Spinner animation="border" variant="primary" />
                </div>
              }
            >
              {EffectComponent ? (
                <div className="effect-controls-container">
                  <EffectComponent width={100} modalMode={true} onApply={handleClose} />
                </div>
              ) : (
                <Alert variant="warning">
                  Effect component not found for: {selectedEffect.id}
                </Alert>
              )}
            </Suspense>
          </div>

          {/* Fixed bottom action bar */}
          <div className="border-top border-secondary p-3 bg-darker">
            <div className="d-flex gap-2 justify-content-end">
              <Button
                variant="outline-secondary"
                onClick={handleClose}
                style={{ minWidth: '120px' }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}