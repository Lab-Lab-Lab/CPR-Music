'use client';

/**
 * Simple waveform peak generation using Web Audio API
 * This is a lightweight alternative to WaveformCache
 */

/**
 * Generate peaks from an audio URL
 * @param {string} audioURL - The URL of the audio to analyze
 * @param {number} samplesPerPixel - How many audio samples to aggregate per pixel (default 256)
 * @returns {Promise<{peaks: Array<[number, number]>, duration: number}>}
 */
export async function generatePeaks(audioURL, samplesPerPixel = 256) {
  try {
    console.log('🎵 Generating peaks for:', audioURL);

    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Fetch and decode audio
    const response = await fetch(audioURL);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const duration = audioBuffer.duration;

    // If stereo, mix channels
    let mixedData = channelData;
    if (audioBuffer.numberOfChannels > 1) {
      const channel2Data = audioBuffer.getChannelData(1);
      mixedData = new Float32Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        mixedData[i] = (channelData[i] + channel2Data[i]) / 2;
      }
    }

    // Generate peaks
    const peaks = [];
    const totalSamples = mixedData.length;
    const peakCount = Math.ceil(totalSamples / samplesPerPixel);

    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, totalSamples);

      let min = 1.0;
      let max = -1.0;

      for (let j = start; j < end; j++) {
        const sample = mixedData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      peaks.push([min, max]);
    }

    // Close audio context
    await audioContext.close();

    console.log(`🌊 Generated ${peaks.length} peaks for ${duration}s audio`);

    return {
      peaks,
      duration,
      sampleRate,
      samplesPerPixel
    };
  } catch (error) {
    console.error('❌ Error generating peaks:', error);
    throw error;
  }
}

/**
 * Resample peaks to match a target pixel width
 * @param {Array<[number, number]>} peaks - Original peaks
 * @param {number} targetWidth - Target width in pixels
 * @returns {Array<[number, number]>} Resampled peaks
 */
export function resamplePeaks(peaks, targetWidth) {
  if (!peaks || peaks.length === 0) return [];

  const sourceLength = peaks.length;
  const ratio = sourceLength / targetWidth;
  const resampled = [];

  if (ratio > 1) {
    // Downsample - aggregate multiple peaks per pixel
    for (let i = 0; i < targetWidth; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);

      let min = 1.0;
      let max = -1.0;

      for (let j = start; j < end && j < sourceLength; j++) {
        if (peaks[j][0] < min) min = peaks[j][0];
        if (peaks[j][1] > max) max = peaks[j][1];
      }

      resampled.push([min, max]);
    }
  } else {
    // Upsample - interpolate between peaks
    for (let i = 0; i < targetWidth; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index >= sourceLength - 1) {
        resampled.push(peaks[sourceLength - 1]);
      } else {
        // Linear interpolation
        const peak1 = peaks[index];
        const peak2 = peaks[index + 1];

        const min = peak1[0] + (peak2[0] - peak1[0]) * fraction;
        const max = peak1[1] + (peak2[1] - peak1[1]) * fraction;

        resampled.push([min, max]);
      }
    }
  }

  return resampled;
}

/**
 * Draw waveform peaks on a canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<[number, number]>} peaks - Peak data
 * @param {number} width - Width to draw
 * @param {number} height - Height to draw
 * @param {number} offsetY - Y offset for drawing
 * @param {Object} options - Drawing options
 */
export function drawPeaks(ctx, peaks, width, height, offsetY = 0, options = {}) {
  const {
    waveColor = '#7bafd4',
    waveAlpha = 0.7,
    fillColor = null,
    fillAlpha = 0.3,
    centerLineColor = '#7bafd4',
    centerLineAlpha = 0.2,
    mirror = true
  } = options;

  if (!peaks || peaks.length === 0) return;

  ctx.save();

  const centerY = offsetY + height / 2;
  const amplitude = (height - 20) / 2;

  // Resample peaks to match width
  const resampledPeaks = resamplePeaks(peaks, width);

  // Set colors with alpha
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  ctx.strokeStyle = hexToRgba(waveColor, waveAlpha);
  ctx.fillStyle = fillColor ? hexToRgba(fillColor, fillAlpha) : hexToRgba(waveColor, fillAlpha);
  ctx.lineWidth = 1;

  // Draw waveform
  ctx.beginPath();

  // Top line
  resampledPeaks.forEach((peak, i) => {
    const x = i;
    const y = centerY - peak[1] * amplitude;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  if (mirror) {
    // Bottom line (mirrored)
    for (let i = resampledPeaks.length - 1; i >= 0; i--) {
      const x = i;
      const y = centerY - resampledPeaks[i][0] * amplitude;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }

  ctx.stroke();

  // Draw center line
  if (centerLineColor) {
    ctx.strokeStyle = hexToRgba(centerLineColor, centerLineAlpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  ctx.restore();
}