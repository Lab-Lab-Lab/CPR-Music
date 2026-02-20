'use client';

import { decodeAudioFromURL, getPeaks } from './AudioEngine';

/**
 * WaveformCache - Centralized service for caching decoded audio and peaks
 * at multiple resolutions. Prevents redundant decoding of the same audio source.
 */
class WaveformCache {
  constructor() {
    // Map of URL -> { audioBuffer, peaks: Map<resolution, peakData> }
    this.cache = new Map();

    // Standard resolutions (samples per pixel)
    this.resolutions = [64, 128, 256, 512, 1024, 2048, 4096];
  }

  /**
   * Get or generate peaks for a given audio URL at specified resolution
   * @param {string} url - Audio source URL
   * @param {number} samplesPerPixel - Desired resolution (will snap to nearest standard)
   * @returns {Promise<{audioBuffer: AudioBuffer, peaks: Array, resolution: number}>}
   */
  async getPeaksForURL(url, samplesPerPixel = 256) {
    if (!url) {
      throw new Error('URL is required');
    }

    // Get or create cache entry
    let cacheEntry = this.cache.get(url);

    if (!cacheEntry) {
      // Decode audio if not cached
      console.log(`WaveformCache: Decoding audio from ${url}`);
      const audioBuffer = await decodeAudioFromURL(url);

      if (!audioBuffer) {
        throw new Error(`Failed to decode audio from ${url}`);
      }

      cacheEntry = {
        audioBuffer,
        peaks: new Map(),
      };

      this.cache.set(url, cacheEntry);
    }

    // Find closest resolution
    const resolution = this.findClosestResolution(samplesPerPixel);

    // Get or generate peaks at this resolution
    if (!cacheEntry.peaks.has(resolution)) {
      console.log(
        `WaveformCache: Generating peaks at resolution ${resolution} for ${url}`,
      );
      const peakData = getPeaks(cacheEntry.audioBuffer, resolution);
      cacheEntry.peaks.set(resolution, peakData);
    }

    return {
      audioBuffer: cacheEntry.audioBuffer,
      peaks: cacheEntry.peaks.get(resolution),
      resolution,
    };
  }

  /**
   * Get peaks for a specific clip (handles offset and duration)
   * Returns an array of [min, max] pairs sized appropriately for the clip.
   */
  async getPeaksForClip(url, offset, duration, pixelWidth, zoomLevel = 100) {
    if (!url) throw new Error('URL is required');
    const dur = Math.max(0, Number(duration) || 0);
    const off = Math.max(0, Number(offset) || 0);
    const scale = Math.max(0.01, Number(zoomLevel) / 100);
    const effectiveWidth = Math.max(
      1,
      Math.floor((Number(pixelWidth) || 1) * scale),
    );

    // First fetch (or decode) to know the sampleRate
    const first = await this.getPeaksForURL(url, 256);
    const sampleRate = first.audioBuffer.sampleRate;

    // Choose a resolution close to desired samples-per-pixel for this clip slice
    const desiredSPP = Math.max(
      1,
      Math.floor((dur * sampleRate) / effectiveWidth),
    );
    const { peaks, resolution } = await this.getPeaksForURL(url, desiredSPP);

    // Convert seconds window -> peak indices
    const startSample = Math.floor(off * sampleRate);
    const endSample = Math.floor((off + dur) * sampleRate);
    const startPeak = Math.max(0, Math.floor(startSample / resolution));
    const endPeak = Math.min(peaks.length, Math.ceil(endSample / resolution));

    // Return a shallow slice of [min,max] pairs for this clip view
    return peaks.slice(startPeak, endPeak);
  }

  /**
   * Find the closest standard resolution to the requested samples per pixel
   */
  findClosestResolution(samplesPerPixel) {
    let closest = this.resolutions[0];
    let minDiff = Math.abs(samplesPerPixel - closest);

    for (const res of this.resolutions) {
      const diff = Math.abs(samplesPerPixel - res);
      if (diff < minDiff) {
        minDiff = diff;
        closest = res;
      }
    }

    return closest;
  }

  /**
   * Preload audio and generate peaks at common resolutions
   * Useful for improving initial render performance
   */
  async preloadURL(url, resolutions = [256, 512, 1024]) {
    const cacheEntry = await this.getPeaksForURL(url, resolutions[0]);

    // Generate peaks at additional resolutions in the background
    for (const res of resolutions.slice(1)) {
      if (!cacheEntry.peaks || !cacheEntry.peaks.has(res)) {
        this.getPeaksForURL(url, res).catch((err) => {
          console.warn(`Failed to preload peaks at resolution ${res}:`, err);
        });
      }
    }
  }

  /**
   * Clear cache for a specific URL
   */
  clearURL(url) {
    this.cache.delete(url);
  }

  /**
   * Clear entire cache
   */
  clearAll() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      urls: this.cache.size,
      totalPeakSets: 0,
      memoryEstimate: 0,
    };

    for (const [url, entry] of this.cache.entries()) {
      stats.totalPeakSets += entry.peaks.size;

      // Rough memory estimate
      if (entry.audioBuffer) {
        stats.memoryEstimate += entry.audioBuffer.length * 4; // 4 bytes per float32
      }

      for (const peaks of entry.peaks.values()) {
        stats.memoryEstimate += peaks.length * 8; // 8 bytes per min/max pair
      }
    }

    return stats;
  }
}

// Create singleton instance
const waveformCache = new WaveformCache();

// Export both the class and the singleton
export { WaveformCache };
export default waveformCache;
