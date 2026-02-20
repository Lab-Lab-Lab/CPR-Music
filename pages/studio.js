'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from 'react-bootstrap';
import { IoArrowBack } from 'react-icons/io5';
import Layout from '../components/layout';
import DAW from '../components/audio/DAW';
import { DAWProvider, useAudio, useUI } from '../contexts/DAWProvider';
import SilenceSandboxComponent from '../components/audio/SilenceSandboxComponent';
import InstrumentSandbox from '../components/audio/InstrumentSandbox/InstrumentSandbox';

// Dynamically import the modal to avoid SSR issues
const StudioModeSelector = dynamic(
  () => import('../components/audio/StudioModeSelector'),
  { ssr: false }
);

// Component that initializes DAW in multitrack mode
const StudioDAW = () => {
  const { setDawMode } = useAudio();
  const { setShowDAW } = useUI();

  useEffect(() => {
    // Set multitrack as default mode
    setDawMode('multi');
    // Show the DAW
    setShowDAW(true);
    // Don't set audioURL - let it remain null/undefined for proper modal triggering
  }, [setDawMode, setShowDAW]);

  return <DAW />;
};

const Studio = () => {
  const [selectedMode, setSelectedMode] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
  };

  const handleBackToStudio = () => {
    setSelectedMode(null);
  };

  return (
    <Layout>
      <div className="studio-container">
        {/* Back button when a mode is selected */}
        {selectedMode && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleBackToStudio}
            className="mb-3 d-flex align-items-center gap-2"
          >
            <IoArrowBack />
            Back to Studio
          </Button>
        )}

        {/* Mode selector modal - only render on client side */}
        {mounted && (
          <StudioModeSelector
            show={!selectedMode}
            onSelectMode={handleSelectMode}
          />
        )}

        {/* Show loading state before mount */}
        {!mounted && !selectedMode && (
          <div className="text-center mt-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* Render selected mode */}
        {selectedMode === 'daw' && (
          <>
            <h1 className="mb-3">DAWn_EE</h1>
            <p className="text-muted mb-4">
              Digital Audio Workstation - Multitrack editing and audio production
            </p>
            <DAWProvider>
              <StudioDAW />
            </DAWProvider>
          </>
        )}

        {selectedMode === 'silence-sandbox' && (
          <>
            <h1 className="mb-3">Silence Sandbox</h1>
            <p className="text-muted mb-4">
              Analyze audio files for silence detection
            </p>
            <SilenceSandboxComponent />
          </>
        )}

        {selectedMode === 'instrument-sandbox' && (
          <>
            <h1 className="mb-3">Instrument Sandbox</h1>
            <p className="text-muted mb-4">
              Design and test custom virtual instruments
            </p>
            <InstrumentSandbox />
          </>
        )}
      </div>
    </Layout>
  );
};

export default Studio;