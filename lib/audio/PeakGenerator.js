/**
 * PeakGenerator - Generate waveform peaks from audio data
 * Supports multi-resolution peak generation for efficient zooming
 */

export class PeakGenerator {
  constructor() {
    this.peakCache = new Map();
    this.worker = null;
  }

  /**
   * Generate peaks from AudioBuffer
   * @param {AudioBuffer} audioBuffer - The audio buffer to process
   * @param {number} samplesPerPixel - Number of audio samples per pixel
   * @param {number} width - Width in pixels
   * @returns {Object} Peak data with min/max arrays for each channel
   */
  generatePeaks(audioBuffer, samplesPerPixel, width) {
    if (!audioBuffer) {
      return null;
    }

    // Check cache
    const cacheKey = `${samplesPerPixel}_${width}`;
    if (this.peakCache.has(cacheKey)) {
      return this.peakCache.get(cacheKey);
    }

    const channels = [];
    const numberOfChannels = audioBuffer.numberOfChannels;

    // Process each channel
    for (let c = 0; c < numberOfChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      const peaks = this.extractPeaks(channelData, samplesPerPixel, width);
      channels.push(peaks);
    }

    // Merge channels for display (average for stereo)
    const mergedPeaks = this.mergeChannels(channels);

    const result = {
      channels,
      merged: mergedPeaks,
      samplesPerPixel,
      width,
      length: mergedPeaks.min.length
    };

    // Cache the result
    this.peakCache.set(cacheKey, result);

    return result;
  }

  /**
   * Extract peaks from channel data
   */
  extractPeaks(channelData, samplesPerPixel, width) {
    const peaks = {
      min: new Float32Array(width),
      max: new Float32Array(width)
    };

    const sampleSize = Math.floor(samplesPerPixel);
    const sampleStep = Math.max(1, Math.floor(sampleSize / 10)); // Sub-sample for performance

    for (let x = 0; x < width; x++) {
      const start = Math.floor(x * samplesPerPixel);
      const end = Math.min(start + sampleSize, channelData.length);

      let min = 0;
      let max = 0;

      // Find min/max in this pixel's samples
      if (start < channelData.length) {
        for (let i = start; i < end; i += sampleStep) {
          const value = channelData[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        // Don't artificially add values to silence - let it be natural
        // The small silence at the beginning is likely from MediaRecorder initialization
      }

      peaks.min[x] = min;
      peaks.max[x] = max;
    }

    return peaks;
  }

  /**
   * Merge multiple channels into a single peak representation
   */
  mergeChannels(channels) {
    if (channels.length === 0) {
      return { min: new Float32Array(0), max: new Float32Array(0) };
    }

    const length = channels[0].min.length;
    const merged = {
      min: new Float32Array(length),
      max: new Float32Array(length)
    };

    for (let i = 0; i < length; i++) {
      let minSum = 0;
      let maxSum = 0;

      for (let c = 0; c < channels.length; c++) {
        minSum += channels[c].min[i];
        maxSum += channels[c].max[i];
      }

      merged.min[i] = minSum / channels.length;
      merged.max[i] = maxSum / channels.length;
    }

    return merged;
  }

  /**
   * Generate normalized peaks (0-1 range)
   */
  normalizePeaks(peaks, targetMax = 0.8) {
    if (!peaks) return null;

    // Find absolute maximum
    let absMax = 0;
    for (let i = 0; i < peaks.min.length; i++) {
      absMax = Math.max(absMax, Math.abs(peaks.min[i]), Math.abs(peaks.max[i]));
    }

    // Apply normalization with target maximum
    // This ensures the waveform uses a good portion of available height
    if (absMax === 0) absMax = 1;

    // Normalize to targetMax (e.g., 0.8 = 80% of available height)
    const scaleFactor = targetMax / absMax;

    const normalized = {
      min: new Float32Array(peaks.min.length),
      max: new Float32Array(peaks.max.length)
    };

    for (let i = 0; i < peaks.min.length; i++) {
      normalized.min[i] = peaks.min[i] * scaleFactor;
      normalized.max[i] = peaks.max[i] * scaleFactor;
    }

    return normalized;
  }

  /**
   * Generate multi-resolution peaks for different zoom levels
   */
  generateMultiResolution(audioBuffer, resolutions = [128, 256, 512, 1024, 2048, 4096]) {
    const multiRes = {};

    for (const resolution of resolutions) {
      const samplesPerPixel = Math.floor(audioBuffer.length / resolution);
      multiRes[resolution] = this.generatePeaks(audioBuffer, samplesPerPixel, resolution);
    }

    return multiRes;
  }

  /**
   * Get optimal resolution for given zoom level
   */
  getOptimalResolution(zoom, containerWidth, duration) {
    const pixelsPerSecond = zoom;
    const totalPixels = duration * pixelsPerSecond;

    // Choose resolution that best matches the required detail level
    const targetSamplesPerPixel = 44100 / pixelsPerSecond; // Assuming 44.1kHz

    return {
      samplesPerPixel: targetSamplesPerPixel,
      width: Math.ceil(totalPixels)
    };
  }

  /**
   * Clear peak cache
   */
  clearCache() {
    this.peakCache.clear();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.clearCache();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}