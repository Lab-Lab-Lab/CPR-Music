'use client';

import React from 'react';
import { WaveformProvider } from '../../../../contexts/WaveformContext';
import TimelineRenderer from './TimelineRenderer';
import WaveformRenderer from './WaveformRenderer';
import MinimapRenderer from './MinimapRenderer';
import CustomTransport from './CustomTransport';
import CustomTimeline from './CustomTimeline';
import { useUI } from '../../../../contexts/DAWProvider';

/**
 * CustomWaveform - Complete replacement for WaveSurfer
 * Provides all waveform visualization and interaction functionality
 */
export default function CustomWaveform({ logOperation = null }) {
  const { mapPresent } = useUI();

  return (
    <WaveformProvider logOperation={logOperation}>
      <div className="custom-waveform-container" style={{ width: '100%' }}>
        {/* Toolbar with effects and region tools */}
        <CustomTimeline />

        {/* Timeline with time markers */}
        <TimelineRenderer />

        {/* Main waveform display */}
        <WaveformRenderer />

        {/* Transport controls */}
        <CustomTransport />

        {/* Optional minimap */}
        {mapPresent && <MinimapRenderer />}
      </div>
    </WaveformProvider>
  );
}

// Export individual components for flexibility
export {
  TimelineRenderer,
  WaveformRenderer,
  MinimapRenderer,
  CustomTransport,
  CustomTimeline
};