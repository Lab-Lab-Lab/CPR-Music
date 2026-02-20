/**
 * Helper functions for integrating effects with the new WaveformContext
 * Provides a unified interface for applying effects to the custom waveform
 */

import { replaceRegionInBuffer } from './cutSpliceHelper';
import { cutRegionFromBuffer, spliceRegionFromBuffer } from './cutSpliceHelper';

/**
 * Create an effect apply function that works with WaveformContext
 * @param {Function} processFunction - The effect's process function (e.g., processEQRegion, processReverbRegion)
 * @param {Object} deps - Dependencies object containing:
 *   - audioBuffer: Audio buffer from WaveformContext
 *   - activeRegion: Active region from WaveformContext
 *   - cutRegion: Legacy cutRegion from effects context (fallback)
 *   - applyProcessedAudio: Function to apply processed audio from WaveformContext
 *   - audioContext: AudioContext from WaveformContext (for buffer operations)
 *   - parameters: Effect parameters to pass to the process function
 *   - onApply: Optional callback after successful application
 * @returns {Function} Async function that applies the effect
 */
export function createEffectApplyFunction(processFunction, deps) {
  return async () => {
    const {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters,
      onApply
    } = deps;

    // Use activeRegion from WaveformContext, fall back to legacy cutRegion
    const region = activeRegion || cutRegion;

    if (!region || !audioBuffer) {
      alert('Please select a region first');
      return;
    }

    try {
      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(region.start * sampleRate);
      const endSample = Math.floor(region.end * sampleRate);

      // Check the original region before processing
      const originalChannelData = audioBuffer.getChannelData(0);
      let originalSum = 0;
      let originalMax = 0;
      let nonZeroCount = 0;
      for (let i = startSample; i < Math.min(startSample + 10000, endSample); i++) {
        const val = originalChannelData[i];
        originalSum += val * val;
        originalMax = Math.max(originalMax, Math.abs(val));
        if (Math.abs(val) > 1e-30) nonZeroCount++;
      }
      const originalRMS = Math.sqrt(originalSum / Math.min(10000, endSample - startSample));
      console.log('Original region RMS:', originalRMS);
      console.log('Original region max amplitude:', originalMax);
      console.log('Original region non-zero samples:', nonZeroCount, 'out of', Math.min(10000, endSample - startSample));

      // Find first non-zero sample
      let firstNonZeroIndex = -1;
      for (let i = startSample; i < endSample; i++) {
        if (Math.abs(originalChannelData[i]) > 1e-30) {
          firstNonZeroIndex = i;
          break;
        }
      }
      if (firstNonZeroIndex !== -1) {
        console.log('First non-zero sample at index:', firstNonZeroIndex - startSample);
        console.log('First non-zero value:', originalChannelData[firstNonZeroIndex]);
      }
      // Get proper samples for debugging
      const debugSamples = [];
      for (let i = startSample; i < startSample + 5 && i < endSample; i++) {
        const val = originalChannelData[i];
        debugSamples.push(Math.abs(val) < 1e-30 ? 0 : val);
      }
      console.log('Original region first 5 samples (cleaned):', debugSamples);

      // Process the audio using the effect's process function
      // This returns only the processed region
      const processedRegion = await processFunction(
        audioBuffer,
        startSample,
        endSample,
        parameters
      );

      console.log('Effect processed region:', processedRegion);
      console.log('Region length:', processedRegion.length, 'samples');

      // Check if the processed region has actual audio
      const processedChannelData = processedRegion.getChannelData(0);
      let processedSum = 0;
      let processedMax = 0;
      for (let i = 0; i < Math.min(10000, processedChannelData.length); i++) {
        processedSum += processedChannelData[i] * processedChannelData[i];
        processedMax = Math.max(processedMax, Math.abs(processedChannelData[i]));
      }
      const processedRMS = Math.sqrt(processedSum / Math.min(10000, processedChannelData.length));
      console.log('Processed region RMS:', processedRMS);
      console.log('Processed region max amplitude:', processedMax);
      console.log('Processed region first 5 samples:', Array.from(processedChannelData.slice(0, 5)));

      // Replace the region in the original buffer with the processed region
      // Pass the AudioContext to ensure all buffers use the same context
      const outputBuffer = replaceRegionInBuffer(
        audioBuffer,
        processedRegion,
        region.start,
        region.end,
        audioContext
      );

      console.log('Output buffer after replacing region:', outputBuffer);
      console.log('Output buffer length:', outputBuffer.length, 'samples');

      // Check the output buffer right before returning
      const outputChannelData = outputBuffer.getChannelData(0);
      let outputSum = 0;
      for (let i = 0; i < Math.min(10000, outputChannelData.length); i++) {
        outputSum += outputChannelData[i] * outputChannelData[i];
      }
      const outputRMS = Math.sqrt(outputSum / Math.min(10000, outputChannelData.length));
      console.log('Output buffer RMS before passing to applyProcessedAudio:', outputRMS);
      console.log('Output buffer first 5 samples:', Array.from(outputChannelData.slice(0, 5)));

      // Attach effect name to the buffer for history tracking
      if (parameters && parameters.effectName) {
        outputBuffer.effectName = parameters.effectName;
      }

      // Apply the full audio with the processed region replaced
      // This handles WAV conversion, history, and region clearing
      await applyProcessedAudio(outputBuffer);

      // Call onApply callback if provided
      if (onApply) {
        onApply();
      }

      return true; // Success
    } catch (error) {
      console.error(`Error applying effect:`, error);
      alert(`Error applying effect. Please try again.`);
      return false; // Failure
    }
  };
}

/**
 * Hook helper to get required dependencies from contexts
 * Use this in effect components to get all necessary context values
 */
export function useEffectWaveformIntegration() {
  // This should be imported and called within the effect component
  // Returns an object with all necessary values from contexts
  return {
    // From WaveformContext
    audioBuffer: null, // Should be obtained from useWaveform()
    activeRegion: null, // Should be obtained from useWaveform()
    applyProcessedAudio: null, // Should be obtained from useWaveform()

    // From EffectsContext (legacy fallback)
    cutRegion: null // Should be obtained from useEffects()
  };
}

/**
 * Check if WaveformContext is available and properly initialized
 */
export function isWaveformContextAvailable(waveformContext) {
  return !!(
    waveformContext &&
    waveformContext.audioBuffer &&
    waveformContext.applyProcessedAudio &&
    typeof waveformContext.applyProcessedAudio === 'function'
  );
}

/**
 * Get the current region (with fallback support)
 */
export function getCurrentRegion(activeRegion, cutRegion) {
  return activeRegion || cutRegion || null;
}