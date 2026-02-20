/**
 * AudioEngine - Core audio processing and playback engine
 * Handles audio loading, decoding, and playback using Web Audio API
 *
 * Memory Management:
 * - Integrates with AudioResourceManager for blob URL tracking
 * - Provides destroy() method for full cleanup
 * - Clears audio buffer references when destroyed
 */

import { debugLog, debugError, isDebug } from '../debug';
import { getAudioResourceManager, revokeAudioBlob } from '../audioUtils';

export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.gainNode = null;

    // Playback state
    this.isPlaying = false;
    this.pausedAt = 0;
    this.startedAt = 0;
    this.playbackRate = 1.0;

    // Callbacks
    this.onTimeUpdate = null;
    this.onEnded = null;
    this.onError = null;

    // Resource tracking
    this.currentAudioUrl = null; // Track current loaded URL for cleanup
    this.instanceId = `AudioEngine_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Register with resource manager
    const manager = getAudioResourceManager();
    this.unregisterCleanup = manager.registerCleanupCallback(() => this.destroy());
  }

  /**
   * Initialize audio context (call this on user interaction)
   */
  async init() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Load and decode audio from URL or Blob
   */
  async loadAudio(urlOrBlob) {
    try {
      await this.init();

      // Stop current playback if any
      this.stop();

      // Clean up previous blob URL if it was one
      if (this.currentAudioUrl && this.currentAudioUrl.startsWith('blob:')) {
        revokeAudioBlob(this.currentAudioUrl);
      }

      let arrayBuffer;

      if (urlOrBlob instanceof Blob) {
        arrayBuffer = await urlOrBlob.arrayBuffer();
        this.currentAudioUrl = null; // Blob doesn't have a URL to track
      } else if (typeof urlOrBlob === 'string') {
        this.currentAudioUrl = urlOrBlob; // Track the URL
        const response = await fetch(urlOrBlob);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error('Invalid audio source');
      }

      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Debug: Validate audio data integrity
      if (isDebug()) {
        const firstSamples = this.audioBuffer.getChannelData(0).slice(0, 100);
        debugLog('AudioEngine', 'First 10 samples after loading:',
          Array.from(firstSamples.slice(0, 10)));

        // Calculate RMS to detect changes
        const channelData = this.audioBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < Math.min(10000, channelData.length); i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / Math.min(10000, channelData.length));
        debugLog('AudioEngine', 'RMS of first 10000 samples:', rms);
      }

      return {
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        numberOfChannels: this.audioBuffer.numberOfChannels,
        length: this.audioBuffer.length
      };
    } catch (error) {
      debugError('AudioEngine', 'Error loading audio:', error);
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  /**
   * Get audio buffer for processing
   */
  getAudioBuffer() {
    return this.audioBuffer;
  }

  /**
   * Play audio from specific time
   */
  play(startTime = 0) {
    if (!this.audioBuffer) {
      console.warn('No audio loaded');
      return;
    }

    if (this.isPlaying) {
      this.stop();
    }

    // Create new source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.playbackRate.value = this.playbackRate;
    this.sourceNode.connect(this.gainNode);

    // Set up ended handler
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = this.audioBuffer.duration;
        if (this.onEnded) this.onEnded();
      }
    };

    // Start playback
    const offset = startTime || this.pausedAt;
    this.sourceNode.start(0, offset);
    this.startedAt = this.audioContext.currentTime - offset;
    this.isPlaying = true;
    this.pausedAt = 0;

    // Start time update loop
    this.startTimeUpdateLoop();
  }

  /**
   * Pause audio playback
   */
  pause() {
    if (!this.isPlaying) return;

    this.pausedAt = this.getCurrentTime();
    this.stop();
  }

  /**
   * Stop audio playback
   */
  stop() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.isPlaying = false;
    this.stopTimeUpdateLoop();
  }

  /**
   * Seek to specific time
   */
  seek(time) {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stop();
    }

    this.pausedAt = Math.max(0, Math.min(time, this.audioBuffer?.duration || 0));

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime() {
    if (!this.audioBuffer) return 0;

    if (this.isPlaying && this.audioContext) {
      const elapsed = (this.audioContext.currentTime - this.startedAt) * this.playbackRate;
      return Math.min(elapsed, this.audioBuffer.duration);
    }

    return this.pausedAt;
  }

  /**
   * Get duration
   */
  getDuration() {
    return this.audioBuffer?.duration || 0;
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate) {
    this.playbackRate = rate;

    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Start time update loop
   */
  startTimeUpdateLoop() {
    const update = () => {
      if (!this.isPlaying) return;

      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.getCurrentTime());
      }

      this.timeUpdateFrame = requestAnimationFrame(update);
    };

    update();
  }

  /**
   * Stop time update loop
   */
  stopTimeUpdateLoop() {
    if (this.timeUpdateFrame) {
      cancelAnimationFrame(this.timeUpdateFrame);
      this.timeUpdateFrame = null;
    }
  }

  /**
   * Clean up resources - call this when done with the AudioEngine
   * Properly releases audio buffers and blob URLs to prevent memory leaks
   */
  destroy() {
    debugLog('AudioEngine', `Destroying AudioEngine ${this.instanceId}`);

    this.stop();

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Revoke blob URL if we were using one
    if (this.currentAudioUrl && this.currentAudioUrl.startsWith('blob:')) {
      revokeAudioBlob(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    // Clear buffer reference to help garbage collection
    this.audioBuffer = null;

    // Clear callbacks
    this.onTimeUpdate = null;
    this.onEnded = null;
    this.onError = null;

    // Unregister from resource manager
    if (this.unregisterCleanup) {
      this.unregisterCleanup();
      this.unregisterCleanup = null;
    }

    debugLog('AudioEngine', `AudioEngine ${this.instanceId} destroyed`);
  }

  /**
   * Get memory statistics for this AudioEngine
   * @returns {Object} Stats about buffer usage
   */
  getMemoryStats() {
    let bufferSize = 0;

    if (this.audioBuffer) {
      bufferSize = this.audioBuffer.numberOfChannels * this.audioBuffer.length * 4;
    }

    return {
      bufferSize,
      bufferSizeMB: (bufferSize / (1024 * 1024)).toFixed(2),
      duration: this.audioBuffer?.duration || 0,
      hasAudioLoaded: !!this.audioBuffer,
      currentUrl: this.currentAudioUrl ? 'set' : 'none'
    };
  }
}