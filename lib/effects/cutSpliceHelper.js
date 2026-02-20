/**
 * Helper functions for cutting and splicing audio regions
 * Works with WaveformContext's audioBuffer
 */

/**
 * Cut/delete a region from the audio buffer
 * @param {AudioBuffer} audioBuffer - The original audio buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with region removed
 */
export function cutRegionFromBuffer(audioBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  // Calculate new buffer length (original minus cut region)
  const cutLength = endSample - startSample;
  const newLength = audioBuffer.length - cutLength;

  // Use provided context or create new one (fallback for backward compatibility)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create new buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  // Copy audio data, skipping the cut region
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Copy before cut region
    for (let i = 0; i < startSample; i++) {
      newData[i] = originalData[i];
    }

    // Copy after cut region
    for (let i = endSample; i < audioBuffer.length; i++) {
      newData[i - cutLength] = originalData[i];
    }
  }

  return newBuffer;
}

/**
 * Splice/excise - keep only the selected region
 * @param {AudioBuffer} audioBuffer - The original audio buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with only the selected region
 */
export function spliceRegionFromBuffer(audioBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  // Calculate new buffer length (just the selected region)
  const newLength = endSample - startSample;

  // Use provided context or create new one (fallback for backward compatibility)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create new buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  // Copy only the selected region
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Copy selected region
    for (let i = 0; i < newLength; i++) {
      newData[i] = originalData[startSample + i];
    }
  }

  return newBuffer;
}

/**
 * Process region for effects - replaces the region with processed audio
 * Handles both same-length replacements and variable-length replacements (e.g., time-stretching)
 * @param {AudioBuffer} originalBuffer - The original audio buffer
 * @param {AudioBuffer} processedBuffer - The processed region buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with processed region replaced
 */
export function replaceRegionInBuffer(originalBuffer, processedBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = originalBuffer.sampleRate;
  const numberOfChannels = originalBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const originalRegionLength = endSample - startSample;
  const processedRegionLength = processedBuffer.length;

  console.log('replaceRegionInBuffer called:');
  console.log('- startTime:', startTime, 'endTime:', endTime);
  console.log('- startSample:', startSample, 'endSample:', endSample);
  console.log('- originalRegionLength:', originalRegionLength);
  console.log('- processedRegionLength:', processedRegionLength);
  console.log('- originalBuffer.length:', originalBuffer.length);

  // Check if this is a length-changing effect (like time-stretching)
  const isLengthChanging = processedRegionLength !== originalRegionLength;
  if (isLengthChanging) {
    console.log('⚠️ Length-changing effect detected! Processing with variable-length replacement.');
  }

  // Use provided context or fallback to global/new context (backward compatibility)
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (window.globalAudioContext) {
      audioContext = window.globalAudioContext;
    } else {
      audioContext = new AudioContextConstructor();
      window.globalAudioContext = audioContext;
    }
  }

  console.log('Using AudioContext:', audioContext === originalBuffer.context ? 'same as original' : 'different');

  // Calculate the new total buffer length
  // If the processed region has a different length, adjust the total buffer length accordingly
  const newTotalLength = originalBuffer.length - originalRegionLength + processedRegionLength;

  // Create new buffer with adjusted length
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newTotalLength,
    sampleRate
  );

  // First create clean Float32Arrays with the data
  const channelArrays = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const processedData = processedBuffer.getChannelData(Math.min(channel, processedBuffer.numberOfChannels - 1));

    // Create a new clean array with the correct size
    const cleanData = new Float32Array(newTotalLength);

    // Copy before region
    for (let i = 0; i < startSample; i++) {
      cleanData[i] = originalData[i];
    }

    // Copy processed region (entire processed buffer)
    for (let i = 0; i < processedRegionLength; i++) {
      if (startSample + i < cleanData.length) {
        cleanData[startSample + i] = processedData[i];
      }
    }

    // Copy after region
    // Note: if processed region has different length, the "after" part shifts accordingly
    const afterRegionSourceStart = endSample; // Where to start copying from in original
    const afterRegionDestStart = startSample + processedRegionLength; // Where to start writing in new buffer
    const afterRegionLength = originalBuffer.length - endSample; // How much to copy

    for (let i = 0; i < afterRegionLength; i++) {
      if (afterRegionDestStart + i < cleanData.length) {
        cleanData[afterRegionDestStart + i] = originalData[afterRegionSourceStart + i];
      }
    }

    channelArrays.push(cleanData);
  }

  // Now copy the clean arrays to the AudioBuffer
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const newData = newBuffer.getChannelData(channel);
    const cleanData = channelArrays[channel];

    // Use set() method for better performance and to avoid corruption
    newData.set(cleanData);
  }

  // Debug: Check if the replacement worked
  const resultData = newBuffer.getChannelData(0);
  let resultSum = 0;
  let resultMax = 0;
  const checkEndSample = Math.min(startSample + processedRegionLength, startSample + 10000);
  for (let i = startSample; i < checkEndSample; i++) {
    resultSum += resultData[i] * resultData[i];
    resultMax = Math.max(resultMax, Math.abs(resultData[i]));
  }
  const resultRMS = Math.sqrt(resultSum / (checkEndSample - startSample));
  console.log('Result buffer region RMS:', resultRMS);
  console.log('Result buffer region max amplitude:', resultMax);
  console.log('Result buffer region first 5 samples:', Array.from(resultData.slice(startSample, startSample + 5)));
  console.log('New buffer total length:', newBuffer.length, 'samples');

  return newBuffer;
}