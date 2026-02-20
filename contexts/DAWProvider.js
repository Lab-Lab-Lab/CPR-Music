// contexts/DAWProvider.js
'use client';

import React from 'react';
import { AudioProvider } from './AudioContext';
import { RecordingProvider } from './RecordingContext';
import { EffectsProvider } from './EffectsContext';
import { FFmpegProvider } from './FFmpegContext';
import { UIProvider } from './UIContext';
import { MultitrackProvider } from './MultitrackContext';
import { WaveformProvider } from './WaveformContext';

/**
 * DAWProvider combines all the context providers needed for the DAW
 * Now includes MultitrackProvider for multitrack functionality
 * and WaveformProvider for custom waveform implementation
 *
 * @param {Object} props
 * @param {Array} props.initialTracks - Initial tracks for multitrack mode
 * @param {Object} props.persistenceConfig - Optional config for audio state persistence
 * @param {boolean} props.persistenceConfig.enabled - Enable audio persistence (default: false)
 * @param {string} props.persistenceConfig.slug - Course slug for API calls
 * @param {number} props.persistenceConfig.assignmentId - Assignment ID for API calls
 * @param {Object} props.persistenceConfig.initialAudioState - Initial audio state to restore
 */
export const DAWProvider = ({
  children,
  initialTracks = [],
  persistenceConfig = { enabled: false }
}) => {
  return (
    <FFmpegProvider>
      <AudioProvider persistenceConfig={persistenceConfig}>
        <RecordingProvider>
          <EffectsProvider>
            <UIProvider>
              <MultitrackProvider initialTracks={initialTracks}>
                <WaveformProvider>
                  {children}
                </WaveformProvider>
              </MultitrackProvider>
            </UIProvider>
          </EffectsProvider>
        </RecordingProvider>
      </AudioProvider>
    </FFmpegProvider>
  );
};

// Export all hooks for convenience
export { useAudio } from './AudioContext';
export { useRecording } from './RecordingContext';
export { useEffects } from './EffectsContext';
export { useFFmpeg } from './FFmpegContext';
export { useUI } from './UIContext';
export { useMultitrack } from './MultitrackContext';
export { useWaveform } from './WaveformContext';

// Export modular effect hooks for better performance
// Components using these will only re-render when their specific effect state changes
export {
  useEQ,
  useDynamics,
  useModulation,
  useTimeBased,
  useSpecialEffects,
  useGlobalEffects,
} from './EffectsContext';