// components/audio/DAW/Multitrack/AudioContextManager.js
'use client';

/**
 * Singleton AudioContextManager to ensure we only have one AudioContext
 * This prevents timing issues and improves performance
 */
class AudioContextManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
    this.startTime = 0;
    this.globalTimelineStartTime = null; // Audio context time when global timeline started
  }

  /**
   * Get or create the shared AudioContext
   */
  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.startTime = this.audioContext.currentTime;
      this.initialized = true;
    }

    // Resume if suspended (happens on some browsers)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Get current time relative to start
   */
  getCurrentTime() {
    if (!this.audioContext) return 0;
    return this.audioContext.currentTime - this.startTime;
  }

  /**
   * Schedule a function to run at a specific audio time.
   * Uses efficient non-blocking scheduling instead of busy-wait.
   *
   * For audio-critical timing, prefer using Web Audio API's native scheduling
   * (e.g., AudioBufferSourceNode.start(when), oscillator.start(when))
   * which provides sample-accurate timing without CPU overhead.
   *
   * @param {Function} callback - Function to execute at the scheduled time
   * @param {number} audioTime - Target audio context time
   * @param {Object} options - Scheduling options
   * @param {number} options.maxWaitMs - Maximum wait time before giving up (default: 30000ms)
   * @param {number} options.precision - How close we need to be in seconds (default: 0.005 = 5ms)
   */
  scheduleAtTime(callback, audioTime, options = {}) {
    const { maxWaitMs = 30000, precision = 0.005 } = options;
    const context = this.getContext();
    const now = context.currentTime;
    const delay = audioTime - now;

    // Already past the target time
    if (delay <= 0) {
      callback();
      return { cancel: () => {} };
    }

    // Track timeout IDs for cancellation
    let timeoutId = null;
    let rafId = null;
    let cancelled = false;
    const startTime = performance.now();

    const cancel = () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };

    // For very short delays (< 50ms), use requestAnimationFrame with iteration limit
    if (delay < 0.05) {
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      const checkTime = () => {
        if (cancelled) return;

        iterations++;
        const currentDelay = audioTime - context.currentTime;

        if (currentDelay <= precision || iterations >= maxIterations) {
          callback();
        } else {
          rafId = requestAnimationFrame(checkTime);
        }
      };

      rafId = requestAnimationFrame(checkTime);
      return { cancel };
    }

    // For longer delays, use setTimeout with a single precision check
    // Schedule callback slightly early, then do one RAF check for precision
    const timeoutDelay = Math.max(0, (delay - 0.02) * 1000); // 20ms early

    timeoutId = setTimeout(() => {
      if (cancelled) return;

      // Check if we've exceeded maximum wait time
      if (performance.now() - startTime > maxWaitMs) {
        console.warn('AudioContextManager: scheduleAtTime exceeded max wait time');
        callback();
        return;
      }

      // Single RAF check for final precision
      const checkOnce = () => {
        if (cancelled) return;

        const remaining = audioTime - context.currentTime;
        if (remaining <= precision) {
          callback();
        } else if (remaining < 0.02) {
          // Very close, one more RAF
          rafId = requestAnimationFrame(() => {
            if (!cancelled) callback();
          });
        } else {
          // Still too early, use another short timeout
          timeoutId = setTimeout(checkOnce, remaining * 500); // 50% of remaining
        }
      };

      checkOnce();
    }, timeoutDelay);

    return { cancel };
  }

  /**
   * Schedule audio-critical events using Web Audio API's native timing.
   * This is the preferred method for sample-accurate audio scheduling.
   *
   * Returns a silent audio node that triggers at the specified time,
   * allowing you to connect it to other nodes or use its onended event.
   *
   * @param {number} audioTime - Target audio context time
   * @param {Function} onTrigger - Callback when the time is reached
   * @returns {Object} Object with cancel method
   */
  scheduleAudioEvent(audioTime, onTrigger) {
    const context = this.getContext();

    // Create a silent buffer of minimal length
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;

    // Connect to a gain node set to 0 (silent) connected to destination
    const silentGain = context.createGain();
    silentGain.gain.value = 0;
    source.connect(silentGain);
    silentGain.connect(context.destination);

    // Use onended event for the callback
    source.onended = onTrigger;

    // Schedule the source to play at the target time
    const startAt = Math.max(context.currentTime, audioTime);
    source.start(startAt);

    return {
      cancel: () => {
        try {
          source.stop();
          source.disconnect();
          silentGain.disconnect();
        } catch (e) {
          // Already stopped or disconnected
        }
      }
    };
  }

  /**
   * Create a gain node for volume control
   */
  createGain() {
    const context = this.getContext();
    return context.createGain();
  }

  /**
   * Create a stereo panner
   */
  createStereoPanner() {
    const context = this.getContext();
    return context.createStereoPanner();
  }

  /**
   * Get the destination (speakers)
   */
  getDestination() {
    const context = this.getContext();
    return context.destination;
  }

  /**
   * Set the global timeline start time
   * Called when global playback starts
   */
  setGlobalTimelineStart(startBeat = 0) {
    const context = this.getContext();
    // Calculate the audio context time when timeline started
    // startBeat is where we're starting in the timeline
    this.globalTimelineStartTime = context.currentTime - startBeat;
  }

  /**
   * Get the global timeline start time
   * Returns the audio context time when the timeline started playing
   */
  getGlobalTimelineStart() {
    // If not set, assume timeline started at context creation
    if (this.globalTimelineStartTime === null) {
      return this.startTime;
    }
    return this.globalTimelineStartTime;
  }

  /**
   * Clean up (rarely needed)
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
      this.initialized = false;
      this.globalTimelineStartTime = null;
    }
  }
}

// Export singleton instance
const audioContextManager = new AudioContextManager();
export default audioContextManager;
